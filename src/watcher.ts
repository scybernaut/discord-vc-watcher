import sqlite3 from "sqlite3"; // sqlite driver
import { Database, open } from "sqlite"; // sqlite interface
import CONFIG from "./configLoader";
import {
  GuildMember,
  StageChannel,
  VoiceChannel,
  VoiceState,
} from "discord.js";

interface VoiceData {
  user: string;
  voice_time: number;
  muted_time: number;
}

const ongoing: {
  [id: string]: {
    // inCall: boolean;
    callStart?: number;
    muteStart?: number;
  };
} = {};

let DB: Database<sqlite3.Database, sqlite3.Statement>;

export const init = async () => {
  await open({
    filename: CONFIG.database.file.name,
    driver: sqlite3.Database,
  }).then((db) => (DB = db));
};

export const getVoiceDataById = async (id: string): Promise<VoiceData> => {
  const queryData = (_id: string) =>
    DB.get("SELECT * FROM voicetime WHERE user = ?", _id) as Promise<VoiceData>;

  const result = await queryData(id);

  if (result !== undefined) return result;

  await DB.run("INSERT INTO voicetime (user) VALUES (?)", id);
  return await queryData(id);
};

export const getMutedTime = (id: string) => {
  return ongoing[id].muteStart
    ? Math.round((Date.now() - <number>ongoing[id].muteStart) / 1000)
    : 0;
};

export const startCall = (member: GuildMember): void => {
  if (member.user.bot) return;

  ongoing[member.id] ||= {};
  ongoing[member.id].callStart ||= Date.now();
  if (member.voice.selfMute) ongoing[member.id].muteStart ||= Date.now();
};

export const endCall = async (member: GuildMember): Promise<void> => {
  const id = member.id;

  const data = await getVoiceDataById(id);

  if (!ongoing[id].callStart) return;
  data.voice_time += Math.round(
    (Date.now() - <number>ongoing[id].callStart) / 1000
  );

  data.muted_time += getMutedTime(id);

  delete ongoing[id];

  await DB.run(
    "UPDATE voicetime SET voice_time = ?, muted_time = ? WHERE user = ?",
    data.voice_time,
    data.muted_time,
    id
  );
};

export const endMute = async (member: GuildMember): Promise<void> => {
  const data = await getVoiceDataById(member.id);

  data.muted_time += getMutedTime(member.id);

  delete ongoing[member.id].muteStart;

  await DB.run(
    "UPDATE voicetime SET muted_time = ? WHERE user = ?",
    data.muted_time,
    member.id
  );
};

export const onVoiceUpdate = async (
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> => {
  const guild = oldState.guild;

  ongoing[oldState.id] ||= {};

  const joinedHumansCount = (voiceChannel: VoiceChannel) =>
    voiceChannel.members.reduce((acc, val) => acc + +!val.user.bot, 0);

  const [oldChannel, newChannel] = await Promise.all([
    oldState.channelId ? guild.channels.fetch(oldState.channelId) : null,
    newState.channelId ? guild.channels.fetch(newState.channelId) : null,
  ]);

  if (!(oldChannel === null || oldChannel instanceof VoiceChannel)) return;
  if (!(newChannel === null || newChannel instanceof VoiceChannel)) return;

  if (newChannel) {
    // channel changed
    if (oldState.channelId != newState.channelId) {
      newChannel.members.forEach(
        joinedHumansCount(newChannel) > 1 ? startCall : endCall
      );
    }

    if (!newState.member) return;

    if (ongoing[newState.member.id].callStart) {
      // mute state changed
      switch (Number(oldState.selfMute) - Number(newState.selfMute)) {
        case 1: // unmute
          endMute(newState.member);
        case -1: // mute
          ongoing[newState.member.id].muteStart ||= Date.now();
      }
    }
  } else {
    // user disconnects
    if (oldChannel) {
      if (!oldState.member) return;

      endCall(oldState.member);

      console.log(oldState.member.id);

      if (joinedHumansCount(oldChannel) <= 1)
        oldChannel.members.forEach(endCall);
    } else {
      // old channel not cached
    }
  }
};

export const getStats = (): Promise<Array<VoiceData>> => {
  return DB.all("SELECT * FROM voicetime");
};
