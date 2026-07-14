'use strict';

const { ActivityType } = require('discord.js');
const Logger = require('../core/Logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    Logger.info(`Logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} guilds.`);
    
    // Set status
    client.user.setActivity('ER:LC Servers', { type: ActivityType.Watching });

    // Start background status updates polling loop
    try {
      const StatusEmbedManager = require('../modules/erlc/StatusEmbedManager');
      StatusEmbedManager.startCronJob(client);
    } catch (err) {
      Logger.error(`Failed to initialize StatusEmbedManager cron: ${err.message}`);
    }

    // Start leaderboard weekly reset cron
    try {
      const LeaderboardManager = require('../modules/shifts/LeaderboardManager');
      LeaderboardManager.scheduleWeeklyReset(client);
    } catch (err) {
      Logger.error(`Failed to initialize LeaderboardManager cron: ${err.message}`);
    }
  }
};
