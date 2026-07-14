'use strict';

const Guild = require('../database/models/Guild');
const AutoMod = require('../modules/moderation/AutoMod');
const Logger = require('../core/Logger');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    // Ignore bots, system messages, or DMs
    if (message.author.bot || !message.guild || !message.guildId) return;

    try {
      // ── Guild Config Cache Check ──────────────────────────────────────────
      let guildConfig = client.cache.get(message.guildId);

      if (!guildConfig) {
        guildConfig = await Guild.findOne({ guildId: message.guildId }).lean();
        if (guildConfig) {
          client.cache.set(message.guildId, guildConfig);
        }
      }

      // If guild is not initialized, ignore AutoMod checks
      if (!guildConfig) return;

      // ── Run AutoMod Checks ────────────────────────────────────────────────
      await AutoMod.check(message, guildConfig, client);
    } catch (err) {
      Logger.error(`Error in messageCreate event handler: ${err.message}`);
    }
  }
};
