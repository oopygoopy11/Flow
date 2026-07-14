'use strict';

const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../database/models/Guild');
const Shift = require('../../database/models/Shift');
const ShiftManager = require('../../modules/shifts/ShiftManager');
const { hasStaffRole } = require('../../utils/permissions');
const { flowEmbed, successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { formatDuration } = require('../../utils/time');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Manage your staff patrol shifts and duty stats.')
    .addSubcommand(sub =>
      sub.setName('patrol')
        .setDescription('Create a new interactive shift clock panel.')
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('Check your historical logged shifts and total active durations.')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Check stats of another staff member (Admin/Manager only)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (!hasStaffRole(interaction.member, guildConfig)) {
      const err = errorEmbed('Permission Denied', 'You do not have the required staff roles to check duty statistics.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    if (subcommand === 'patrol') {
      // Check if user already has an active shift
      const active = await Shift.findOne({ userId: interaction.user.id, guildId: guild.id, status: { $ne: 'off_duty' } });
      
      const { panel, row } = ShiftManager.buildShiftPanel(
        active || { status: 'off_duty', totalDurationMs: 0, totalBreakMs: 0 },
        interaction.user
      );

      await interaction.reply({
        components: [panel, row],
        flags: MessageFlags.IsComponentsV2
      });
      return;
    }

    if (subcommand === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      let targetUser = interaction.options.getUser('user') || interaction.user;

      // Restrict looking up others to Admins/Managers only
      if (targetUser.id !== interaction.user.id) {
        const { hasAdminRole } = require('../../utils/permissions');
        if (!hasAdminRole(interaction.member, guildConfig)) {
          const err = errorEmbed('Permission Denied', 'You need Administrator roles to look up other staff statistics.');
          return await interaction.editReply({ components: [err] });
        }
      }

      try {
        // Query finished shifts
        const shifts = await Shift.find({ userId: targetUser.id, guildId: guild.id, status: 'off_duty' }).lean();

        let totalDuration = 0;
        let totalBreaks = 0;
        let totalShifts = shifts.length;

        for (const s of shifts) {
          totalDuration += s.totalDurationMs || 0;
          totalBreaks += s.totalBreakMs || 0;
        }

        const avgDuration = totalShifts > 0 ? Math.floor(totalDuration / totalShifts) : 0;

        const fields = [
          { key: 'Staff Member', value: `<@${targetUser.id}> (\`${targetUser.tag}\`)` },
          { key: 'Total Patrols Logged', value: `\`${totalShifts}\`` },
          { key: 'Total Active Duty Time', value: `**${formatDuration(totalDuration)}**` },
          { key: 'Total Break Accumulation', value: `**${formatDuration(totalBreaks)}**` },
          { key: 'Average Shift Duration', value: `**${formatDuration(avgDuration)}**` }
        ];

        const container = infoEmbed(
          'Staff Activity Statistics',
          `Historical duty and patrol stats for **${targetUser.tag}**.`,
          fields
        );

        await interaction.editReply({
          components: [container]
        });
      } catch (err) {
        Logger.error(`shift stats error: ${err.message}`);
        await interaction.editReply({ components: [errorEmbed('Failed to Retrieve Stats', err.message)] });
      }
    }
  }
};
