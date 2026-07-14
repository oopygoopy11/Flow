'use strict';

const express = require('express');
const crypto = require('crypto');
const Guild = require('../database/models/Guild');
const WebhookParser = require('../modules/erlc/WebhookParser');
const Logger = require('../core/Logger');

const PUBLIC_KEY_BASE64 = 'MCowBQYDK2VwAyEAjSICb9pp0kHizGQtdG8ySWsDChfGqi+gyFCttigBNOA=';

/**
 * Verify ER:LC Ed25519 Webhook Signature
 */
function verifySignature(rawBody, timestamp, signature) {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(PUBLIC_KEY_BASE64, 'base64'),
      format: 'der',
      type: 'spki'
    });

    const data = Buffer.concat([
      Buffer.from(timestamp),
      rawBody
    ]);

    return crypto.verify(
      undefined,
      data,
      publicKey,
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    Logger.error(`Webhook signature verification error: ${err.message}`);
    return false;
  }
}

function startWebhookServer(client) {
  const app = express();
  const port = process.env.WEBHOOK_PORT || 3000;

  // Use Express raw parser to preserve bytes for signature verification
  app.use(express.raw({ type: 'application/json' }));

  app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    // Verify signature
    const isValid = verifySignature(req.body, timestamp, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (err) {
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    // Identify guild
    const guildId = req.query.guildId;
    if (!guildId) {
      return res.status(400).json({ error: 'Missing guildId query parameter' });
    }

    try {
      let guildDoc = client.cache.get(guildId);
      if (!guildDoc) {
        guildDoc = await Guild.findOne({ guildId }).lean();
        if (guildDoc) {
          client.cache.set(guildId, guildDoc);
        }
      }

      if (!guildDoc) {
        return res.status(404).json({ error: 'Guild config not found' });
      }

      // Process event asynchronously
      WebhookParser.processWebhook(client, guildDoc, payload);

      res.status(200).json({ success: true });
    } catch (err) {
      Logger.error(`Error handling webhook: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(port, () => {
    Logger.info(`Express Webhook Server running on port ${port}`);
  });
}

module.exports = { startWebhookServer };
