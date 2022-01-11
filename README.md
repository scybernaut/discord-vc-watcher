# discord-vc-watcher

A Discord bot to watch guild members' total duration in voice channels and duration when they're muted.

_This bot is only designed for use in a single small server._

## Features

- slash command (/stats) to list members' stats
- watch guild members' time in voice channels

## Setup

1. Install required packages

```shell
$ yarn
```

2. Create a config file named `config.yml` in the root directory. See `src/ConfigLoader.ts` for details.

3. Transpile Typescript to Javascript

```shell
$ yarn transpile
```

4. Register commands with Discord (first time only)

```shell
$ yarn register
```

5. Start the bot

```shell
$ yarn start
```
