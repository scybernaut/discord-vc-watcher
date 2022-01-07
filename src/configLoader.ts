import fs from "fs";
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
}

const file = fs.readFileSync("../config.yml", "utf8");
export default YAML.parse(file) as Config;
