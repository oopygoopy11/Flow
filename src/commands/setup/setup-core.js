'use strict';

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-core')
    .setDescription('Initialize the ER:LC API and Server connection configurations.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('setup_core_modal')
      .setTitle('flow Server Integration');

    const apiInput = new TextInputBuilder()
      .setCustomId('erlc_api_key')
      .setLabel('ER:LC API Key')
      .setPlaceholder('Enter your official ER:LC API/Server Key')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const serverIdInput = new TextInputBuilder()
      .setCustomId('erlc_server_id')
      .setLabel('Roblox Server ID')
      .setPlaceholder('Enter your Roblox Private Server ID')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(apiInput),
      new ActionRowBuilder().addComponents(serverIdInput)
    );

    // Show the modal to the user
    await interaction.showModal(modal);
  }
};
