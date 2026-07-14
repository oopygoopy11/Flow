'use strict';

const mongoose = require('mongoose');

const GuildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  erlcApiKey: { type: String },
  erlcServerId: { type: String },
  roles: {
    admin: { type: [String], default: [] },
    staff: { type: [String], default: [] },
    leo: { type: [String], default: [] },
    ems: { type: [String], default: [] },
    fire: { type: [String], default: [] },
    civ: { type: [String], default: [] }
  },
  channels: {
    modLog: { type: String },
    joinLeave: { type: String },
    inGameCmd: { type: String },
    killLog: { type: String },
    serverLock: { type: String },
    shiftLog: { type: String },
    ticketCategory: { type: String },
    ticketTranscripts: { type: String }
  },
  automod: {
    antiLink: {
      enabled: { type: Boolean, default: false },
      whitelist: { type: [String], default: [] }
    },
    antiSpam: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 5 },
      timeWindow: { type: Number, default: 5000 }
    },
    wordBlacklist: {
      enabled: { type: Boolean, default: false },
      words: { type: [String], default: [] }
    }
  },
  statusMessage: {
    channelId: { type: String },
    messageId: { type: String }
  },
  ticketsConfig: {
    panelChannelId: { type: String },
    panelMessageId: { type: String },
    nextTicketNumber: { type: Number, default: 1 }
  },
  setupComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

GuildSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Guild', GuildSchema);
