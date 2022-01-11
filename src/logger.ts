import CONFIG from "./configLoader";
import chalk from "chalk";

const log = (levelStr: string, message: string) =>
  console.log(`${Date.now()} [${levelStr}]: ${message}`);

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export const logger = {
  error: (message: string) => {
    if (levels[CONFIG.logLevel] >= levels.error)
      log(chalk.red("error"), message);
  },

  warn: (message: string) =>
    levels[CONFIG.logLevel] >= levels.warn ||
    log(chalk.yellow("warn"), message),

  info: (message: string) => {
    if (levels[CONFIG.logLevel] >= levels.info)
      log(chalk.blue("info"), message);
  },

  debug: (message: string) => {
    if (levels[CONFIG.logLevel] >= levels.debug)
      log(chalk.gray("debug"), message);
  },
};
