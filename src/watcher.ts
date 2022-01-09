import { createConnection, Repository } from "typeorm";

import CONFIG from "./configLoader";
import { GuildMember, VoiceChannel, VoiceState } from "discord.js";

import { VoiceData } from "./VoiceData";

const ongoing: {
  [id: string]: {
    callStart?: number;
    muteStart?: number;
  };
} = {};

let repo: Repository<VoiceData>;

createConnection({
  type: "sqlite",
  database: CONFIG.database.file.name,
  entities: [VoiceData],
}).then((connection) => {
  repo = connection.getRepository(VoiceData);
  console.log("connected to database");
});

const calcCallTime = (id: string, refTime: number) => {
  const callStart = ongoing[id].callStart;
  return callStart ? Math.floor((refTime - callStart) / 1000) : 0;
};

const calcMutedTime = (id: string, refTime: number) => {
  const muteStart = ongoing[id].muteStart;
  return muteStart ? Math.floor((refTime - muteStart) / 1000) : 0;
};

export const startCall = (member: GuildMember, refTime: number): void => {
  ongoing[member.id] ||= {};
  ongoing[member.id].callStart ||= refTime;
  if (member.voice.selfMute) ongoing[member.id].muteStart ||= refTime;
};

type durationEndHandler = (
  member: GuildMember,
  refTime: number
) => Promise<void>;

const createIfNotExist = (id: string): Promise<boolean> =>
  repo
    .insert({ UserID: id })
    .then(() => true)
    .catch((err) => {
      if (err.code === "SQLITE_CONSTRAINT") return false;
      throw err;
    });

export const endCall: durationEndHandler = async (member, refTime) => {
  await createIfNotExist(member.id);
  await repo.increment(
    { UserID: member.id },
    "CallTime",
    calcCallTime(member.id, refTime)
  );

  delete ongoing[member.id];
};

export const endMute: durationEndHandler = async (member, refTime) => {
  await createIfNotExist(member.id);
  await repo.increment(
    { UserID: member.id },
    "MutedTime",
    calcMutedTime(member.id, refTime)
  );

  delete ongoing[member.id]?.muteStart;
};

export const onVoiceUpdate = async (
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> => {
  const guild = oldState.guild;
  if (guild.id != CONFIG.guildId) return;

  if (oldState.member?.user.bot) return;
  if (newState.member?.user.bot) return;

  ongoing[newState.id] ||= {};

  const joinedHumansCount = (voiceChannel: VoiceChannel) =>
    voiceChannel.members.reduce((acc, val) => acc + +!val.user.bot, 0);

  const [oldChannel, newChannel] = await Promise.all([
    oldState.channelId ? guild.channels.fetch(oldState.channelId) : null,
    newState.channelId ? guild.channels.fetch(newState.channelId) : null,
  ]);

  if (!(oldChannel === null || oldChannel instanceof VoiceChannel)) return;
  if (!(newChannel === null || newChannel instanceof VoiceChannel)) return;

  const recvTime = Date.now(); // for fair time

  if (newChannel) {
    // channel changed
    if (oldState.channelId != newState.channelId) {
      const checkChannelState = (channel: VoiceChannel) => {
        const isCall = joinedHumansCount(channel) > 1;
        channel.members.forEach((member) => {
          if (member.user.bot) return;

          if (isCall) startCall(member, recvTime);
          else endCall(member, recvTime);
        });
      };

      if (oldChannel) checkChannelState(oldChannel);
      checkChannelState(newChannel);
    }

    if (!newState.member) return;
    if (ongoing[newState.member.id].callStart) {
      // mute state changed
      switch (Number(oldState.selfMute) - Number(newState.selfMute)) {
        case 1: // unmute
          endMute(newState.member, recvTime);
        case -1: // mute
          ongoing[newState.member.id].muteStart ||= recvTime;
      }
    }
  } else {
    // user disconnects
    if (oldChannel) {
      if (!oldState.member) return;

      endCall(oldState.member, recvTime);

      if (joinedHumansCount(oldChannel) <= 1)
        oldChannel.members.forEach(
          (member) => !member.user.bot && endCall(member, recvTime)
        );
    } else {
      // old state not cached, do nothing
    }
  }
};

export const getStats = async (
  id: string | undefined,
  timeRef: number
): Promise<Array<VoiceData>> => {
  let voiceData: Array<VoiceData>;

  if (id) {
    let fetchedData = await repo.findOne(id);
    fetchedData ||= {
      UserID: id,
      CallTime: 0,
      MutedTime: 0,
    };

    voiceData = [fetchedData];
  } else {
    voiceData = await repo.find();
  }

  return voiceData.map((each) => {
    // Add ongoing time
    const callStart = ongoing[each.UserID]?.callStart;
    if (callStart) each.CallTime += Math.floor((timeRef - callStart) / 1000);

    const muteStart = ongoing[each.UserID]?.muteStart;
    if (muteStart) each.MutedTime += Math.floor((timeRef - muteStart) / 1000);

    return each;
  });
};
