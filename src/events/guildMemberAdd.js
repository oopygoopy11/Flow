'use strict';

const Guild = require('../database/models/Guild');
const Logger = require('../core/Logger');
const { flowEmbed } = require('../utils/embeds');
const { EMOJIS, COLORS } = require('../config');
const { formatRelativeTimestamp, formatFullTimestamp } = require('../utils/time');
const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    if (!member.guild) return;

    try {
      let guildConfig = client.cache.get(member.guild.id);
      if (!guildConfig) {
        guildConfig = await Guild.findOne({ guildId: member.guild.id }).lean();
        if (guildConfig) {
          client.cache.set(member.guild.id, guildConfig);
        }
      }

      if (!guildConfig || !guildConfig.channels || !guildConfig.channels.joinLeave) {
        return;
      }

      const logChannel = await member.guild.channels.fetch(guildConfig.channels.joinLeave).catch(() => null);
      if (!logChannel) return;

      const created = member.user.createdAt;
      const fields = [
        { key: 'Username', value: `${member.user.tag} (${member})` },
        { key: 'User ID', value: `\`${member.id}\`` },
        { key: 'Created At', value: `${formatFullTimestamp(created)} (${formatRelativeTimestamp(created)})` },
        { key: 'Member Count', value: `\`${member.guild.memberCount}\`` }
      ];

      const container = flowEmbed(
        `${EMOJIS.CHECK} Member Joined`,
        null,
        fields,
        COLORS.SUCCESS
      );

      await logChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`Error in guildMemberAdd event: ${err.message}`);
    }
  }
};
