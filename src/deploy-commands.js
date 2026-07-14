'use strict';

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');
const Logger = require('./core/Logger');

const commands = [];

function loadCommandsRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommandsRecursive(fullPath);
    } else if (entry.name.endsWith('.js')) {
      try {
        const cmd = require(fullPath);
        if (cmd.data && cmd.data.toJSON) {
          commands.push(cmd.data.toJSON());
          Logger.info(`Registered command: ${cmd.data.name}`);
        }
      } catch (err) {
        Logger.error(`Failed to load command ${fullPath}: ${err.message}`);
      }
    }
  }
}

async function deploy() {
  const commandsDir = path.join(__dirname, 'commands');
  loadCommandsRecursive(commandsDir);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  Logger.info(`Deploying ${commands.length} application commands globally...`);

  const data = await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  Logger.info(`Successfully deployed ${data.length} global commands.`);
}

deploy().catch((err) => {
  Logger.error(`Failed to deploy commands: ${err.message}`);
  process.exit(1);
});
