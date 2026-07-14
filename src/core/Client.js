'use strict';

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const NodeCache = require('node-cache');

class FlowClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.DirectMessages
      ],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
    });
    
    this.commands = new Collection();
    this.cooldowns = new Collection();
    
    // In-memory cache for guild configs to avoid database calls on every message/webhook. TTL = 5 mins.
    this.cache = new NodeCache({ stdTTL: 300 });
  }
}

module.exports = FlowClient;
