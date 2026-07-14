# flow — ER:LC Multi-Guild Discord Bot

**flow** is a comprehensive, production-ready Discord bot built with Node.js and discord.js v14 that integrates with Emergency Response: Liberty County server APIs. It consolidates Moderation, API Webhooks, Support Tickets, and Shift Tracking, replacing Circle, Ducky, Melonly, ERM, Ticket Tool, and Warden in a single unified system.

## 🚀 Key Features

*   **Universal Multi-Guild Setup:** Dynamic configurations per-server using MongoDB schemas.
*   **Advanced Moderation:** Warnings, kicks, mutes (timeout), bans, case logs tracking, and automod filters (anti-link, anti-spam, word blacklist).
*   **ER:LC Integration:** Live snapshot status embeds, in-game command triggers, in-game mod/join/kill polling log feeds, and player lookup cards.
*   **Support Tickets:** Rich modal-based support tickets with private channels, staff claim, close, reopen logs, and HTML archive transcripts.
*   **Shift Tracker:** duty clock (On-Duty, Breaks, Off-Duty) with leaderboard logs and weekly reset crons.

---

## 🛠️ Command List

### Module 1: Setup
*   `/setup-core` - Initialize API Key and private server ID details.
*   `/setup-roles` - Configure roles (Admins, Staff, LEO, EMS, Fire, Civ).
*   `/setup-channels` - Configure log channels (Modlog, JoinLeave, CommandLogs, KillLogs, ShiftLogs, Transcripts).
*   `/setup-tickets` - Initialize ticket categories, archives, and spawn buttons panel.

### Module 2: Moderation
*   `/warn @user [reason]` - Warn a member.
*   `/mute @user [duration] [reason]` - Mute (Timeout) a member.
*   `/kick @user [reason]` - Kick a member.
*   `/ban @user [reason] [delete_days]` - Ban a member.
*   `/unban [id] [reason]` - Lift a ban.
*   `/purge [amount] [@user]` - Bulk delete channel messages.
*   `/history @user` - View all moderation infractions and active warning cases.

### Module 3: ER:LC Integration
*   `/status view` - Get snapshot of player counts, queue sizes, and lock status.
*   `/status setup-persistent` - Post a persistent auto-updating status embed (refreshes every 60s).
*   `/game-kick [username] [reason]` - Remotely kick a player from the game server.
*   `/game-ban [username] [reason]` - Remotely ban a player.
*   `/game-unban [username]` - Remotely lift an in-game ban.
*   `/lookup [username]` - Roblox profile card details (Account age, linked discord, warnings history, game online status).

### Module 4: Support Tickets
*   `/ticket panel create [channel]` - Send ticket open button board.
*   `/ticket close` - Close the current support ticket.
*   `/ticket add @user` - Add user permissions to ticket.
*   `/ticket remove @user` - Remove user permissions.

### Module 5: Shift Tracking
*   `/shift patrol` - Spawn active shift duty clock panel.
*   `/shift stats [@user]` - Look up staff duty hours and statistics.
*   `/leaderboard [period]` - View top staff duty hours (week, month, all-time).

---

## 💻 Installation and Deployment

### Prerequisites
*   Node.js v20 or higher.
*   MongoDB Instance.
*   ER:LC Private Server API key (purchased in Roblox game private server configurations).

### Setup Steps
1.  Clone the project repository.
2.  Copy `.env.example` to `.env` and fill out credentials.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Deploy global slash commands to Discord:
    ```bash
    npm run deploy
    ```
5.  Start the bot:
    ```bash
    npm start
    ```

### Docker Deployments
To start local containers:
```bash
docker build -t flow-bot .
docker run -d --name flow -p 3000:3000 --env-file .env flow-bot
```
