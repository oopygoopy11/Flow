'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const Guild = require('../../database/models/Guild');
const LinkedAccount = require('../../database/models/LinkedAccount');
const ModerationCase = require('../../database/models/ModerationCase');
const ERLCApiClient = require('../../modules/erlc/ERLCApiClient');
const { flowEmbed, errorEmbed } = require('../../utils/embeds');
const { formatFullTimestamp, formatRelativeTimestamp } = require('../../utils/time');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up a Roblox player profile, connection status, and history.')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('The Roblox username to search')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const username = interaction.options.getString('username');

    await interaction.deferReply({ ephemeral: true });

    try {
      // ── 1. Search Roblox User ──────────────────────────────────────────────
      const searchRes = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`)
        .catch(() => null);

      if (!searchRes || !searchRes.data || !searchRes.data.data || searchRes.data.data.length === 0) {
        const err = errorEmbed('Roblox User Not Found', `No Roblox user matches the username **${username}**.`);
        return await interaction.editReply({ components: [err] });
      }

      const robloxUser = searchRes.data.data[0];
      const robloxId = robloxUser.id;
      const robloxTag = robloxUser.name;
      const displayName = robloxUser.displayName;

      // ── 2. Get User Detail (Created date) ──────────────────────────────────
      const detailsRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`).catch(() => null);
      const createdDate = detailsRes && detailsRes.data ? new Date(detailsRes.data.created) : null;

      // ── 3. Get Avatar Thumbnail ───────────────────────────────────────────
      const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png`)
        .catch(() => null);
      const avatarUrl = thumbRes && thumbRes.data && thumbRes.data.data && thumbRes.data.data[0] 
        ? thumbRes.data.data[0].imageUrl 
        : null;

      // ── 4. Cross-Reference Discord Links ───────────────────────────────────
      const linkDoc = await LinkedAccount.findOne({ robloxId, verified: true }).lean();
      const discordMention = linkDoc ? `<@${linkDoc.discordId}>` : '*Not linked to Discord*';

      // ── 5. Fetch Guild In-Game Moderation History ─────────────────────────
      const cases = await ModerationCase.find({
        guildId: guild.id,
        $or: [
          { userId: String(robloxId) },
          { userTag: robloxTag }
        ]
      }).lean();

      const activeWarnings = cases.filter(c => c.type === 'warn' && c.active).length;
      const totalInfractions = cases.length;

      // ── 6. Check Online Status ────────────────────────────────────────────
      let onlineStatus = 'Offline';
      let onlineTeam = '';
      
      let guildConfig = interaction.client.cache.get(guild.id);
      if (!guildConfig) {
        guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
      }

      if (guildConfig && guildConfig.erlcApiKey) {
        try {
          const players = await ERLCApiClient.getPlayers(guildConfig.erlcApiKey) || [];
          const playerMatch = players.find(p => {
            const [pName] = p.Player.split(':');
            return pName.toLowerCase() === robloxTag.toLowerCase();
          });

          if (playerMatch) {
            onlineStatus = `Online 🟢`;
            onlineTeam = playerMatch.Team;
          }
        } catch (apiErr) {
          Logger.debug(`lookup: failed online check: ${apiErr.message}`);
        }
      }

      // ── 7. Build Details ──────────────────────────────────────────────────
      const fields = [
        { key: 'Roblox Username', value: `\`${robloxTag}\`` },
        { key: 'Display Name', value: `\`${displayName}\`` },
        { key: 'Roblox ID', value: `\`${robloxId}\`` },
        { key: 'Account Created', value: createdDate ? `${formatFullTimestamp(createdDate)} (${formatRelativeTimestamp(createdDate)})` : 'Unknown' },
        { key: 'Discord Link', value: discordMention },
        { key: 'Current Game Status', value: onlineStatus + (onlineTeam ? ` on **${onlineTeam}**` : '') },
        { key: 'In-Game Warnings', value: `**${activeWarnings}** active warning(s)` },
        { key: 'Total Cases logged', value: `**${totalInfractions}** case(s)` }
      ];

      const container = flowEmbed(
        'Roblox Player Card',
        `Verification and status snapshot for Roblox user **${displayName}**.`,
        fields,
        0x00A2FF // Roblox blue
      );

      // Embed Roblox avatar if available (via markdown image formatting inside ContainerBuilder)
      if (avatarUrl) {
        container.addTextDisplayComponents(
          new (require('discord.js').TextDisplayBuilder)().setContent(`![Avatar](${avatarUrl})`)
        );
      }

      await interaction.editReply({
        components: [container]
      });
    } catch (err) {
      Logger.error(`lookup command error: ${err.message}`);
      const errContainer = errorEmbed('Lookup Failed', `An error occurred while fetching player details: ${err.message}`);
      await interaction.editReply({ components: [errContainer] });
    }
  }
};
