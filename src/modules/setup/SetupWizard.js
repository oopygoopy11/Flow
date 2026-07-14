'use strict';

const Guild = require('../../database/models/Guild');
const ERLCApiClient = require('../erlc/ERLCApiClient');
const Logger = require('../../core/Logger');
const { flowEmbed, successEmbed, errorEmbed, v2Reply, v2EditReply } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const { MessageFlags } = require('discord.js');

class SetupWizard {
  /**
   * Process the core modal submission: API key and Server ID
   * @param {ModalSubmitInteraction} interaction 
   */
  static async handleCoreModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const apiKey = interaction.fields.getTextInputValue('erlc_api_key');
    const serverId = interaction.fields.getTextInputValue('erlc_server_id');

    try {
      // Validate key with ER:LC API
      const testResult = await ERLCApiClient.testConnection(apiKey);
      if (!testResult.success) {
        const errContainer = errorEmbed(
          'API Connection Failed',
          `The ER:LC API returned an error. Please verify your API key is correct and has the required permissions.\n\n**Error:** ${testResult.error || 'Unknown'}`
        );
        return await v2EditReply(interaction, errContainer);
      }

      // Update database config
      let guildDoc = await Guild.findOne({ guildId: interaction.guildId });
      if (!guildDoc) {
        guildDoc = new Guild({ guildId: interaction.guildId });
      }

      guildDoc.erlcApiKey = apiKey;
      guildDoc.erlcServerId = serverId;
      guildDoc.setupComplete = true;
      await guildDoc.save();

      // Update client cache
      interaction.client.cache.set(interaction.guildId, guildDoc.toObject());

      // Mask key for safety (show first 4 and last 4)
      const maskedKey = apiKey.length > 8 
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
        : '••••••••';

      const fields = [
        { key: 'Roblox Server ID', value: `\`${serverId}\`` },
        { key: 'API Key Status', value: `\`${maskedKey}\` (Verified ${EMOJIS.CHECK})` }
      ];

      const container = successEmbed(
        'Core Setup Completed',
        'Your ER:LC server connection has been initialized and verified successfully.',
        fields
      );

      await v2EditReply(interaction, container);
    } catch (err) {
      Logger.error(`SetupWizard.handleCoreModal error: ${err.message}`);
      const container = errorEmbed('Setup Error', `Failed to save core configurations: ${err.message}`);
      await v2EditReply(interaction, container);
    }
  }

  /**
   * Process role select menu selection
   * @param {RoleSelectMenuInteraction} interaction 
   */
  static async handleRolesSelect(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const customId = interaction.customId;
    const selectedRoles = Array.from(interaction.values);
    
    // Parse role type from customId (e.g. setup_role_admin -> admin)
    const roleType = customId.replace('setup_role_', '');
    const validTypes = ['admin', 'staff', 'leo', 'ems', 'fire', 'civ'];

    if (!validTypes.includes(roleType)) {
      const errContainer = errorEmbed('Invalid Role Type', `Role type \`${roleType}\` is not recognized.`);
      return await v2EditReply(interaction, errContainer);
    }

    try {
      let guildDoc = await Guild.findOne({ guildId: interaction.guildId });
      if (!guildDoc) {
        guildDoc = new Guild({ guildId: interaction.guildId });
      }

      guildDoc.roles[roleType] = selectedRoles;
      await guildDoc.save();
      interaction.client.cache.set(interaction.guildId, guildDoc.toObject());

      const mentions = selectedRoles.map(id => `<@&${id}>`).join(', ') || '*None selected*';
      const container = successEmbed(
        'Roles Updated',
        `Successfully updated roles for department/level: **${roleType.toUpperCase()}**.\n\n**Selected Roles:** ${mentions}`
      );
      await v2EditReply(interaction, container);
    } catch (err) {
      Logger.error(`SetupWizard.handleRolesSelect error: ${err.message}`);
      const container = errorEmbed('Setup Error', `Failed to save role settings: ${err.message}`);
      await v2EditReply(interaction, container);
    }
  }

  /**
   * Process channel select menu selection
   * @param {ChannelSelectMenuInteraction} interaction 
   */
  static async handleChannelsSelect(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const customId = interaction.customId;
    const selectedChannel = interaction.values[0];

    // Parse channel type from customId (e.g. setup_channel_modlog -> modLog)
    const rawType = customId.replace('setup_channel_', '');
    
    // Map custom ID suffixes to database fields
    const channelMap = {
      modlog: 'modLog',
      joinleave: 'joinLeave',
      ingamecmd: 'inGameCmd',
      killlog: 'killLog',
      shiftlog: 'shiftLog',
      transcripts: 'ticketTranscripts'
    };

    const dbField = channelMap[rawType];
    if (!dbField) {
      const errContainer = errorEmbed('Invalid Channel Type', `Channel type \`${rawType}\` is not recognized.`);
      return await v2EditReply(interaction, errContainer);
    }

    try {
      let guildDoc = await Guild.findOne({ guildId: interaction.guildId });
      if (!guildDoc) {
        guildDoc = new Guild({ guildId: interaction.guildId });
      }

      guildDoc.channels[dbField] = selectedChannel;
      await guildDoc.save();
      interaction.client.cache.set(interaction.guildId, guildDoc.toObject());

      const container = successEmbed(
        'Channel Updated',
        `Successfully designated <#${selectedChannel}> for **${rawType.toUpperCase()}** logs.`
      );
      await v2EditReply(interaction, container);
    } catch (err) {
      Logger.error(`SetupWizard.handleChannelsSelect error: ${err.message}`);
      const container = errorEmbed('Setup Error', `Failed to save channel settings: ${err.message}`);
      await v2EditReply(interaction, container);
    }
  }
}

module.exports = SetupWizard;
