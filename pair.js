const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  DisconnectReason
} = require('baileys');

// ---------------- CONFIG ----------------
const BOT_NAME_FREE = 'ғʀᴇᴇ-ᴍɪɴɪ';

const config = {
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_RECORDING: 'false',
  AUTO_LIKE_EMOJI: ['🎈','👀','❤️‍🔥','💗','😩','☘️','🗣️','🌸'],
  PREFIX: '.',
  MAX_RETRIES: 3,
  GROUP_INVITE_LINK: 'https://chat.whatsapp.com/Dh7gxX9AoVD8gsgWUkhB9r',
  FREE_IMAGE: 'https://files.catbox.moe/f9gwsx.jpg',
  NEWSLETTER_JID: '120363402507750390@newsletter',
  IMAGE_PATH: 'https://files.catbox.moe/f9gwsx.jpg',
  OWNER_NUMBER: '263714757857',
  OWNER_NAME: 'ᴍʀ xᴅᴋɪɴɢ',
  BOT_VERSION: '1.0.2'
};

// --- JSON SETTINGS SYSTEM (FOR MULTI-NUMBER SUPPORT) ---
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function getBotSettings(botNum) {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}));
        const allData = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        return allData[botNum] || { 
            auto_view: config.AUTO_VIEW_STATUS, 
            auto_like: config.AUTO_LIKE_STATUS, 
            auto_rec: config.AUTO_RECORDING 
        };
    } catch (e) {
        return { auto_view: 'false', auto_like: 'false', auto_rec: 'false' };
    }
}

function saveBotSettings(botNum, newData) {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}));
        const allData = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        allData[botNum] = newData;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allData, null, 2));
    } catch (e) {
        console.error("Settings Save Error:", e);
    }
}

// ---------------- MONGO SETUP ----------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://yuresh:yuresh@cluster0.imsvg84.mongodb.net/?appName=Cluster0';
const MONGO_DB = process.env.MONGO_DB || 'Free_Mini';
let mongoClient, mongoDB, sessionsCol, configsCol;

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);
    sessionsCol = mongoDB.collection('sessions');
    configsCol = mongoDB.collection('configs');
    console.log('✅ Mongo initialized');
  } catch(e) { console.error('Mongo Init Error', e); }
}

async function loadUserConfigFromMongo(number) {
    try {
        await initMongo();
        const doc = await configsCol.findOne({ number: number.replace(/[^0-9]/g, '') });
        return doc ? doc.config : null;
    } catch (e) { return null; }
}

// ---------------- STATUS HANDLERS (USING SETTINGS) ----------------
async function setupStatusHandlers(socket, number) {
  const botNum = number.replace(/[^0-9]/g, '');
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast') return;

    const userSet = getBotSettings(botNum);

    try {
      if (userSet.auto_rec === 'true') await socket.sendPresenceUpdate("recording", message.key.remoteJid);
      if (userSet.auto_view === 'true') await socket.readMessages([message.key]);
      if (userSet.auto_like === 'true') {
        const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
        await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
      }
    } catch (e) { console.error('Status Error:', e); }
  });
}

// ---------------- COMMAND HANDLERS ----------------
function setupCommandHandlers(socket, number) {
  const botNum = number.replace(/[^0-9]/g, '');

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message) return;

    const from = msg.key.remoteJid;
    const sender = from;
    const type = getContentType(msg.message);
    const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : (type === 'imageMessage') ? msg.message.imageMessage.caption : '';
    
    const isOwner = (msg.key.participant || msg.key.remoteJid).includes(config.OWNER_NUMBER);
    const isCmd = body.startsWith(config.PREFIX);
    const command = isCmd ? body.slice(config.PREFIX.length).trim().split(' ').shift().toLowerCase() : null;

    const fakevcard = {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "FREE_MD" },
        message: { contactMessage: { displayName: BOT_NAME_FREE, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME_FREE}\nEND:VCARD` } }
    };

    if (!command) {
        // Number Reply Handler
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption?.includes("SETTINGS") && isOwner) {
            let currentSet = getBotSettings(botNum);
            const choice = body.trim();
            let updated = false;

            if (choice === '1') { currentSet.auto_view = currentSet.auto_view === 'true' ? 'false' : 'true'; updated = true; }
            else if (choice === '2') { currentSet.auto_like = currentSet.auto_like === 'true' ? 'false' : 'true'; updated = true; }
            else if (choice === '3') { currentSet.auto_rec = currentSet.auto_rec === 'true' ? 'false' : 'true'; updated = true; }

            if (updated) {
                saveBotSettings(botNum, currentSet);
                await socket.sendMessage(from, { text: `✅ Settings updated for ${botNum}!` }, { quoted: msg });
            }
        }
        return;
    }

    switch (command) {
        case 'settings': {
            try {
                await socket.sendMessage(from, { react: { text: "⚙️", key: msg.key } });
                const userSet = getBotSettings(botNum);
                const text = `
╭──「 *${BOT_NAME_FREE} SETTINGS* 」──➤
│
│ 1️⃣ *Auto Status View:* ${userSet.auto_view === 'true' ? '✅ ON' : '❌ OFF'}
│ 2️⃣ *Auto Status Like:* ${userSet.auto_like === 'true' ? '✅ ON' : '❌ OFF'}
│ 3️⃣ *Auto Recording:* ${userSet.auto_rec === 'true' ? '✅ ON' : '❌ OFF'}
│
├─ 🗑️ *SESSION MNG*
│ ✦ ${config.PREFIX}deleteme
╰──────────────●●➤

*සැකසුම් වෙනස් කිරීමට අංකය (1, 2, 3) Reply කරන්න.*`.trim();

                await socket.sendMessage(from, {
                    image: { url: config.IMAGE_PATH },
                    caption: text,
                    footer: "⚙️ 𝘚𝘦𝘵𝘵𝘪𝘯𝘨𝘴 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
                    buttons: [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
                        { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: "🥷 ᴏᴡɴᴇʀ" }, type: 1 }
                    ],
                    headerType: 4
                }, { quoted: fakevcard });
            } catch (e) { console.error(e); }
            break;
        }

        case 'menu': {
            await socket.sendMessage(from, { text: `Free Mini Bot Menu\nPrefix: ${config.PREFIX}\n\nUse .settings to configure bot.` }, { quoted: fakevcard });
            break;
        }
    }
  });
}

module.exports = router;
