'use strict';

class TranscriptGenerator {
  /**
   * Generate an HTML transcript file buffer of text messages in a channel
   * @param {TextChannel} channel 
   * @returns {Promise<Buffer>}
   */
  static async generate(channel) {
    let allMessages = [];
    let lastId = null;

    // Fetch up to 500 messages (paginated)
    for (let i = 0; i < 5; i++) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options).catch(() => null);
      if (!messages || messages.size === 0) break;

      allMessages = allMessages.concat(Array.from(messages.values()));
      lastId = messages.last().id;

      if (messages.size < 100) break;
    }

    // Sort chronologically
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket Transcript - #${channel.name}</title>
  <style>
    body {
      background: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .header {
      background: #1e1f22;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 4px solid #D91E1E;
    }
    .header h1 {
      margin: 0 0 8px 0;
      color: #fff;
      font-size: 24px;
    }
    .header p {
      margin: 4px 0;
      font-size: 14px;
      color: #b5bac1;
    }
    .message {
      display: flex;
      margin: 16px 0;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .message:hover {
      background: #2e3035;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 16px;
      background: #5865f2;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    .msg-content {
      display: flex;
      flex-direction: column;
    }
    .msg-header {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
    }
    .username {
      color: #fff;
      font-weight: 600;
      font-size: 15px;
      margin-right: 8px;
    }
    .timestamp {
      color: #949ba4;
      font-size: 12px;
    }
    .content {
      color: #dbdee1;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bot-tag {
      background: #5865f2;
      color: white;
      font-size: 10px;
      padding: 2px 4px;
      border-radius: 3px;
      margin-right: 8px;
      font-weight: bold;
    }
    .embed {
      border-left: 4px solid #D91E1E;
      background: #2b2d31;
      padding: 12px;
      margin-top: 8px;
      border-radius: 4px;
      max-width: 520px;
    }
    .embed-title {
      font-weight: bold;
      color: white;
      margin-bottom: 4px;
    }
    .embed-description {
      font-size: 13px;
      color: #dbdee1;
    }
    .attachment {
      margin-top: 8px;
      color: #00b0f4;
      text-decoration: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ticket Transcript</h1>
    <p>Channel Name: <strong>#${channel.name}</strong></p>
    <p>Message Count: <strong>${allMessages.length}</strong></p>
    <p>Archived At: <strong>${new Date().toUTCString()}</strong></p>
  </div>
  <div class="messages">`;

    for (const msg of allMessages) {
      const timeStr = new Date(msg.createdTimestamp).toLocaleString();
      const firstChar = msg.author.username ? msg.author.username.charAt(0).toUpperCase() : '?';

      html += `
    <div class="message">
      <div class="avatar">${firstChar}</div>
      <div class="msg-content">
        <div class="msg-header">
          <span class="username">${msg.author.tag}</span>
          ${msg.author.bot ? '<span class="bot-tag">BOT</span>' : ''}
          <span class="timestamp">${timeStr}</span>
        </div>
        <div class="content">${this.cleanContent(msg.content)}</div>`;

      // Render attachments
      if (msg.attachments.size > 0) {
        for (const [id, attach] of msg.attachments) {
          html += `\n        <a href="${attach.url}" class="attachment" target="_blank">Attachment: ${attach.name}</a>`;
        }
      }

      // Render embeds
      if (msg.embeds && msg.embeds.length > 0) {
        for (const embed of msg.embeds) {
          html += `\n        <div class="embed">`;
          if (embed.title) html += `\n          <div class="embed-title">${embed.title}</div>`;
          if (embed.description) html += `\n          <div class="embed-description">${embed.description}</div>`;
          html += `\n        </div>`;
        }
      }

      html += `
      </div>
    </div>`;
    }

    html += `
  </div>
</body>
</html>`;

    return Buffer.from(html, 'utf-8');
  }

  static cleanContent(content) {
    if (!content) return '';
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

module.exports = TranscriptGenerator;
