'use strict';

const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');

async function loadCommands(client) {
  const commandsDir = path.join(__dirname, '..', 'commands');
  let loadedCount = 0;

  function loadRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        loadRecursive(fullPath);
      } else if (entry.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            loadedCount++;
          } else {
            Logger.warn(`Skipping invalid command file: ${fullPath}`);
          }
        } catch (err) {
          Logger.error(`Error loading command ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  loadRecursive(commandsDir);
  Logger.info(`Loaded ${loadedCount} application commands.`);
}

module.exports = { loadCommands };
