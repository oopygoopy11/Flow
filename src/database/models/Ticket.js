'use strict';

const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true }, // e.g. TKT-00001
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  userTag: { type: String },
  subject: { type: String },
  claimedBy: { type: String }, // Staff user ID
  claimedByTag: { type: String },
  status: { 
    type: String, 
    enum: ['open', 'closed', 'deleted'], 
    default: 'open' 
  },
  number: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
});

module.exports = mongoose.model('Ticket', TicketSchema);
