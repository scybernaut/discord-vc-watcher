import fs from "fs";
import path from "path";
import YAML from "yaml";

interface Config {
  discord: {
    token: string;
    appId: string;
  };
  database: {
    file: {
      name: string;
    };
  };
  guildId: string;
  logLevel: "error" | "warn" | "info" | "debug";
}

const file = fs.readFileSync(path.join(__dirname, "../config.yml"), "utf8");
export default YAML.parse(file) as Config;
