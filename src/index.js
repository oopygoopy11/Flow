'use strict';

require('dotenv').config();

const FlowClient = require('./core/Client');
const { loadCommands } = require('./core/CommandHandler');
const { loadEvents } = require('./core/EventHandler');
const { connectDB } = require('./database/connection');
const Logger = require('./core/Logger');
const { startWebhookServer } = require('./webhook/server');

async function main() {
  Logger.info('Starting flow bot...');

  // ── Database ─────────────────────────────────────────────────────────────
  await connectDB();

  // ── Discord Client ────────────────────────────────────────────────────────
  const client = new FlowClient();

  // ── Load Handlers ─────────────────────────────────────────────────────────
  await loadCommands(client);
  await loadEvents(client);

  // ── Webhook Server (Express — receives ER:LC push events) ─────────────────
  startWebhookServer(client);

  // ── Login ─────────────────────────────────────────────────────────────────
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((err) => {
  Logger.error(`Fatal startup error: ${err.message}`);
  Logger.error(err.stack);
  process.exit(1);
});
