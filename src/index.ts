import { Client, MessageEmbed, Formatters, Intents } from "discord.js";
import CONFIG from "./ConfigLoader";
import * as Watcher from "./Watcher";

import logger from "./Logger";

import { stripIndents, oneLine } from "common-tags";

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
  logger.info(oneLine`
    interaction received;
    discord-provided timestamp: ${interaction.createdTimestamp}
  `);

  if (interaction.isCommand() && interaction.inGuild()) {
    if (interaction.guildId !== CONFIG.guildId) {
      logger.info(`replying: guild ${interaction.guildId} is not whitelisted.`);
      interaction.reply({
        embeds: [
          new MessageEmbed({
            description: "This guild is not whitelisted",
            color: "RED",
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "stats") {
      logger.debug("command name is stats");
      const user = interaction.options.getUser("user", false);

      if (user?.bot) {
        logger.info("replying: user param is a bot");
        interaction.reply({
          embeds: [
            new MessageEmbed({
              description: "Bots' voice time is not tracked",
              color: "RED",
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      // had to defer because sometimes DiscordAPIError: Unknown interaction
      // would be thrown, probably due to discord.js's ratelimit :(
      const deferAction = interaction.deferReply();

      const userID = user?.id;

      const stats = await Watcher.getStats(
        userID,
        interaction.createdTimestamp
      );
      logger.debug(`stats fetched with size ${stats.length}`);

      stats.sort(
        (left, right) =>
          right.CallTime - left.CallTime || left.MutedTime - right.MutedTime
      );

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

      const embed = new MessageEmbed()
        .setTitle("Voice time")
        .setColor("AQUA")
        .setTimestamp(interaction.createdTimestamp);

      if (userID) {
        logger.info("user specified: filling up embed");

        const callDuration = dayjs.duration(stats[0].CallTime, "seconds");
        const mutedDuration = dayjs.duration(stats[0].MutedTime, "seconds");

        embed
          .setDescription(
            `${Formatters.memberNicknameMention(userID)}'s voice time`
          )
          .addField("Call time", durationString(callDuration), true)
          .addField("Muted time", durationString(mutedDuration), true);
      } else {
        logger.info("user not specified: filling up embed");

        const numberToEmojis = (n: number): string => {
          // prettier-ignore
          const NAME_LIST = [
            "zero", "one",   "two", "three", "four",
            "five", "six", "seven", "eight", "nine",
          ];

          let result = "";

          for (const c of n.toString()) {
            result += `:${NAME_LIST[parseInt(c)]}:`;
          }

          return result;
        };

        embed.setDescription(
          stats.reduce((acc, cur, i) => {
            const callDuration = dayjs.duration(cur.CallTime, "seconds");
            const mutedDuration = dayjs.duration(cur.MutedTime, "seconds");

            const userMention = Formatters.memberNicknameMention(cur.UserID);
            acc += stripIndents`
              **${numberToEmojis(i + 1)} ??? ${userMention}**
              Call time: \`${durationString(callDuration)}\`
              Muted time: \`${durationString(mutedDuration)}\``;

            acc += "\n\n";

            return acc;
          }, "")
        );
      }

      await deferAction;
      logger.info(`replying with embed`);
      interaction
        .editReply({ embeds: [embed] })
        .catch((err) => logger.error("error in sending embed: " + err));
    }
  }
});

client.login(CONFIG.discord.token);
