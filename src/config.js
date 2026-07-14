'use strict';

require('dotenv').config();

module.exports = {
  STRINGS: {
    BOT_NAME: 'flow',
    VERSION: '1.0.0',
    SUPPORT_INVITE: 'https://discord.gg/flow'
  },
  
  COLORS: {
    ACCENT: 0xD91E1E,    // flow red
    NEUTRAL: 0x1A1A1A,   // Dark neutral for embeds
    SUCCESS: 0x57F287,   // Discord green
    WARNING: 0xFEE75C,   // Discord yellow
    ERROR: 0xED4245,     // Discord red
    INFO: 0x5865F2       // Discord blurple
  },

  EMOJIS: {
    FLOW: '<:flow:1526603051211948102>',
    CHECK: '<:Check:1510412029075394684>',
    CROSS: '<:Cross:1510412146700193812>',
    FIX: '<:Fix:1510412765792178280>',
    STATS: '<:Stats:1510412659798048768>',
    WARNING_E: '<:Warning:1510413272892047420>',
    BOOK: '<:book:1510412616898576384>',
    CALENDAR: '<:calendar:1510413037415301272>',
    CHAT: '<:chat:1510411768642535455>',
    CROWN: '<:crown:1510413344094425200>',
    FOLDER: '<:folder:1510413930676092971>',
    MENTION: '<:mention:1510411338319532197>',
    PEOPLE: '<:people:1510413162288124025>',
    SETTINGS: '<:settings:1510412216674025625>',
    TICKET_E: '<:ticket:1510592492456906782>',
    BELL: '<:bell:1510412962626539741>',
    SHOUTS: '<:shouts:1510412387474215082>',
    BLOCKED: '<:blocked:1510412331916464257>',
    PIN: '<:pin:1510412267597074652>'
  },

  ERLC: {
    BASE_URL: 'https://api.erlc.gg/v2',
    TIMEOUT_MS: 8000,
    MAX_RETRIES: 3,
    STATUS_UPDATE_INTERVAL: 60000 // 60s status update interval
  },

  LIMITS: {
    PURGE_MAX: 100,
    SHIFTS_LEADERBOARD_LIMIT: 10,
    TICKET_MESSAGE_TRANSCRIPT_LIMIT: 1000
  }
};
