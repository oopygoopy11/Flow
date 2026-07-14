'use strict';

const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');

async function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(eventsDir)) return;
  
  const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.js'));
  let loadedCount = 0;

  for (const file of files) {
    const fullPath = path.join(eventsDir, file);
    try {
      const event = require(fullPath);
      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
        loadedCount++;
      } else {
        Logger.warn(`Skipping invalid event file: ${fullPath}`);
      }
    } catch (err) {
      Logger.error(`Error loading event ${fullPath}: ${err.message}`);
    }
  }

  Logger.info(`Loaded ${loadedCount} client events.`);
}

module.exports = { loadEvents };
