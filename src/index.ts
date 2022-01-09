import { Client, MessageEmbed, Formatters, Intents } from "discord.js";
import CONFIG from "./configLoader";
import * as Watcher from "./watcher";

import { stripIndents } from "common-tags";

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
dayjs.extend(duration);

const client = new Client({
  intents: [Intents.FLAGS.GUILD_VOICE_STATES],
});

const DISPLAY: "long" | "short" | "narrow" = "short"; // "long" / "short" / "narrow"

const timeFormatters = {
  hour: Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "hour",
    unitDisplay: DISPLAY,
  }),
  min: Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "minute",
    unitDisplay: DISPLAY,
  }),
  sec: Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "second",
    unitDisplay: DISPLAY,
  }),
};

client.once("ready", () => console.log(`logged in as ${client.user?.tag}`));

client.on("voiceStateUpdate", Watcher.onVoiceUpdate);

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand() && interaction.inGuild()) {
    if (interaction.guildId !== CONFIG.guildId) {
      console.log("Guild ID not whitelisted.");
      return;
    }

    if (interaction.commandName === "stats") {
      const stats = await Watcher.getStats();

      stats.sort((left, right) => right.CallTime - left.CallTime);

      const durationString = (duration: duration.Duration) =>
        [
          Math.floor(duration.asHours())
            ? timeFormatters.hour.format(Math.floor(duration.asHours()))
            : "",
          timeFormatters.min.format(duration.minutes()),
          timeFormatters.sec.format(duration.seconds()),
        ]
          .join(" ")
          .trimStart();

      const embed = new MessageEmbed().setTitle("Voice time").setDescription(
        stats.reduce((acc, cur, i) => {
          const callDuration = dayjs.duration(cur.CallTime, "seconds");
          const mutedDuration = dayjs.duration(cur.MutedTime, "seconds");

          acc += stripIndents`
            **#${i + 1} — ${Formatters.memberNicknameMention(cur.UserID)}**
            Call time: \t${durationString(callDuration)}
            Muted time: \t${durationString(mutedDuration)}`;

          acc += "\n\n";

          return acc;
        }, "")
      );
      interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(CONFIG.discord.token);
