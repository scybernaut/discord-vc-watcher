import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import CONFIG from "./configLoader";
import { SlashCommandBuilder } from "@discordjs/builders";

const commands = [
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("shows stats of guild members")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("user to check stats")
        .setRequired(false)
    ),
];

const rest = new REST({ version: "9" }).setToken(CONFIG.discord.token);

console.log("Started refreshing application (/) commands.");
rest
  .put(Routes.applicationGuildCommands(CONFIG.discord.appId, CONFIG.guildId), {
    body: commands,
  })
  .then(() => {
    console.log("Successfully reloaded application (/) commands.");
  })
  .catch((error) => {
    console.error(error);
  });
