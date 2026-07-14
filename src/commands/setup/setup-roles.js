'use strict';

const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { flowEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Configure admin, staff, or department roles for game permission synchronization.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The role category you want to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Administrator Roles', value: 'admin' },
          { name: 'Staff / Moderator Roles', value: 'staff' },
          { name: 'LEO Department Roles', value: 'leo' },
          { name: 'EMS Department Roles', value: 'ems' },
          { name: 'Fire Department Roles', value: 'fire' },
          { name: 'Civilian Roles', value: 'civ' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    
    const selectMenu = new RoleSelectMenuBuilder()
      .setCustomId(`setup_role_${type}`)
      .setPlaceholder(`Select roles for ${type.toUpperCase()}`)
      .setMinValues(1)
      .setMaxValues(10); // Allow up to 10 roles per type

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const container = flowEmbed(
      `Configure ${type.toUpperCase()} Roles`,
      `Select the roles below that belong to the **${type.toUpperCase()}** category. These roles will be saved to the database and used for permission checks.`
    );

    await interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | 64 // Ephemeral v2
    });
  }
};
