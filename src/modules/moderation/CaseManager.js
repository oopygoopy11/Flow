'use strict';

const ModerationCase = require('../../database/models/ModerationCase');
const Guild = require('../../database/models/Guild');
const { generateCaseId } = require('../../utils/caseId');
const { caseEmbed } = require('../../utils/embeds');
const Logger = require('../../core/Logger');
const { MessageFlags } = require('discord.js');

class CaseManager {
  /**
   * Create a new moderation case, log it, and DM the user
   * @param {Guild} guild 
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.userTag
   * @param {User|GuildMember} params.moderator 
   * @param {string} params.type
   * @param {string} params.reason
   * @param {number} params.duration
   * @returns {Promise<object>}
   */
  static async create(guild, { userId, userTag, moderator, type, reason = 'No reason provided', duration = null }) {
    try {
      const caseId = await generateCaseId(guild.id);
      
      const newCase = new ModerationCase({
        caseId,
        guildId: guild.id,
        userId,
        userTag,
        moderatorId: moderator.id,
        moderatorTag: moderator.user ? moderator.user.tag : moderator.tag,
        type,
        reason,
        duration,
        timestamp: new Date()
      });

      await newCase.save();
      Logger.info(`Case ${caseId} created in guild ${guild.id} for user ${userId} (${type})`);

      // Retrieve guild config (for channels info)
      let guildConfig = guild.client.cache.get(guild.id);
      if (!guildConfig) {
        guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
        if (guildConfig) {
          guild.client.cache.set(guild.id, guildConfig);
        }
      }

      if (guildConfig && guildConfig.channels && guildConfig.channels.modLog) {
        await this.postModLog(guild, guildConfig, newCase);
      }

      // Try to DM the user
      await this.dmUser(guild, newCase);

      return newCase;
    } catch (err) {
      Logger.error(`CaseManager.create error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Post moderation case details to the configured mod logs channel
   * @param {Guild} guild 
   * @param {object} guildConfig 
   * @param {object} caseDoc 
   */
  static async postModLog(guild, guildConfig, caseDoc) {
    try {
      const logChannelId = guildConfig.channels.modLog;
      if (!logChannelId) return;

      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) {
        Logger.warn(`Mod logs channel ${logChannelId} not found in guild ${guild.id}`);
        return;
      }

      const container = caseEmbed(caseDoc);
      await logChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`CaseManager.postModLog error: ${err.message}`);
    }
  }

  /**
   * Send a Direct Message to the disciplined user detailing the moderation action
   * @param {Guild} guild 
   * @param {object} caseDoc 
   */
  static async dmUser(guild, caseDoc) {
    try {
      const targetUser = await guild.client.users.fetch(caseDoc.userId).catch(() => null);
      if (!targetUser || targetUser.bot) return;

      // Build a DM embed
      const typesMap = {
        warn: { verb: 'warned', action: 'Warning' },
        mute: { verb: 'muted', action: 'Mute' },
        kick: { verb: 'kicked', action: 'Kick' },
        ban: { verb: 'banned', action: 'Ban' },
        unban: { verb: 'unbanned', action: 'Unban' },
        note: { verb: 'noted', action: 'Note' }
      };

      const verb = typesMap[caseDoc.type]?.verb || 'disciplined';
      const actionTitle = typesMap[caseDoc.type]?.action || caseDoc.type.toUpperCase();

      const fields = [
        { key: 'Server', value: guild.name },
        { key: 'Case ID', value: `\`${caseDoc.caseId}\`` },
        { key: 'Action', value: actionTitle },
        { key: 'Reason', value: caseDoc.reason }
      ];

      if (caseDoc.duration) {
        const { formatDuration } = require('../../utils/time');
        fields.push({ key: 'Duration', value: formatDuration(caseDoc.duration) });
      }

      const container = caseEmbed(caseDoc); // Reuse case embed directly to give users the exact case details
      await targetUser.send({
        content: `You have been **${verb}** in **${guild.name}**. Details below:`,
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      // DMs are frequently disabled; log debug only to avoid cluttering errors
      Logger.debug(`Failed to DM user ${caseDoc.userId} for case ${caseDoc.caseId}: ${err.message}`);
    }
  }
}

module.exports = CaseManager;
