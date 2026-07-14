'use strict';

const { SlashCommandBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { flowEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-channels')
    .setDescription('Configure designated logging channels for specific actions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The logging channel type to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Mod Logs', value: 'modlog' },
          { name: 'Join / Leave Logs', value: 'joinleave' },
          { name: 'In-Game Command Logs', value: 'ingamecmd' },
          { name: 'Kill Logs', value: 'killlog' },
          { name: 'Shift Logs', value: 'shiftlog' },
          { name: 'Ticket Transcripts', value: 'transcripts' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');

    const selectMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`setup_channel_${type}`)
      .setPlaceholder(`Select channel for ${type.toUpperCase()}`)
      .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const container = flowEmbed(
      `Configure ${type.toUpperCase()} Channel`,
      `Select the text channel below to receive **${type.toUpperCase()}** logs.`
    );

    await interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | 64 // Ephemeral v2
    });
  }
};
