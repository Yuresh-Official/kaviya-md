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
const BOT_NAME_FANCY = 'ғʀᴇᴇ-ᴍɪɴɪ';

const config = {
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true', // මේක global setting එකක්, නමුත් පහත On/Off එකෙන් පාලනය වේ
  AUTO_RECORDING: 'false',
  AUTO_LIKE_EMOJI: ['🎈','👀','❤️‍🔥','💗','😩','☘️','🗣️','🌸'],
  PREFIX: '.',
  MAX_RETRIES: 3,
  GROUP_INVITE_LINK: 'https://chat.whatsapp.com/Dh7gxX9AoVD8gsgWUkhB9r',
  FREE_IMAGE: 'https://files.catbox.moe/f9gwsx.jpg',
  NEWSLETTER_JID: '120363402507750390@newsletter',
  RCD_IMAGE_PATH: 'https://files.catbox.moe/f9gwsx.jpg',
  
  SUPPORT_NEWSLETTER: {
    jid: '120363402507750390@newsletter',
    emojis: ['❤️', '🌟', '🔥', '💯'],
    name: 'Malvin King Tech',
    description: 'Bot updates & support channel'
  },
  
  DEFAULT_NEWSLETTERS: [
    { 
      jid: '120363420989526190@newsletter',
      emojis: ['❤️', '🌟', '🔥', '💯'],
      name: 'FREE Tech',
      description: 'Free Channel'
    },
    { 
      jid: '120363420989526190@newsletter', 
      emojis: ['🎵', '🎶', '📻'],
      name: 'Music Updates'
    }
  ],
  
  OTP_EXPIRY: 300000,
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263714757857',
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbB3YxTDJ6H15SKoBv3S',
  BOT_NAME: 'ғʀᴇᴇ-ᴍɪɴɪ',
  BOT_VERSION: '1.0.2',
  OWNER_NAME: 'ᴍʀ xᴅᴋɪɴɢ',
  IMAGE_PATH: 'https://files.catbox.moe/f9gwsx.jpg',
  BOT_FOOTER: '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴀʟᴠɪɴ ᴛᴇᴄʜ',
  BUTTON_IMAGES: { ALIVE: 'https://files.catbox.moe/f9gwsx.jpg' }
};

// ---------------- MONGO SETUP ----------------

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://yuresh:yuresh@cluster0.imsvg84.mongodb.net/?appName=Cluster0';
const MONGO_DB = process.env.MONGO_DB || 'Free_Mini';

let mongoClient = null;
let mongoDB = null;
let sessionsCol, numbersCol, adminsCol, newsletterCol, configsCol, newsletterReactsCol;
let mongoInitialized = false;

async function initMongo() {
  try {
    if (mongoClient && mongoDB && mongoInitialized) {
      try {
        if (mongoClient.topology && mongoClient.topology.isConnected && mongoClient.topology.isConnected()) {
          return;
        }
      } catch(e) {
        mongoInitialized = false;
      }
    }
    
    mongoClient = new MongoClient(MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);

    sessionsCol = mongoDB.collection('sessions');
    numbersCol = mongoDB.collection('numbers');
    adminsCol = mongoDB.collection('admins');
    newsletterCol = mongoDB.collection('newsletter_list');
    configsCol = mongoDB.collection('configs');
    newsletterReactsCol = mongoDB.collection('newsletter_reacts');

    try { await sessionsCol.createIndex({ number: 1 }, { unique: true }); } catch(e) {}
    try { await numbersCol.createIndex({ number: 1 }, { unique: true }); } catch(e) {}
    try { await newsletterCol.createIndex({ jid: 1 }, { unique: true }); } catch(e) {}
    try { await newsletterReactsCol.createIndex({ jid: 1 }, { unique: true }); } catch(e) {}
    try { await configsCol.createIndex({ number: 1 }, { unique: true }); } catch(e) {}
    
    mongoInitialized = true;
    console.log('✅ Mongo initialized and collections ready');
  } catch (e) { 
    console.error('Mongo init error:', e.message);
    mongoInitialized = false;
    throw e; 
  }
}

// ---------------- Mongo helpers (Skipped for brevity, assume they are there as per original) ----------------
// ... [අනෙකුත් සියලුම Mongo Helper Functions මෙතැන තිබිය යුතුය] ...

// ---------------- basic utils ----------------

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getZimbabweanTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }

const activeSockets = new Map();
const socketCreationTime = new Map();
const otpStore = new Map();
const botSettings = new Map(); // නව Settings ගබඩා කිරීමට

// ---------------- handlers ----------------

async function setupNewsletterHandlers(socket, sessionNumber) {
  const rrPointers = new Map();

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key) return;
    const jid = message.key.remoteJid;
    // ... [Original Newsletter Logic] ...
  });
}

// --- Modified Status Handlers ---
async function setupStatusHandlers(socket, sessionNumber) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;

    // Setting එක check කිරීම (Default Off)
    const settings = botSettings.get(sessionNumber) || { statusReact: false, autoTyping: false };

    try {
      if (config.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate("recording", message.key.remoteJid);
      
      if (config.AUTO_VIEW_STATUS === 'true') {
          await socket.readMessages([message.key]);
      }

      // On කරලා තිබ්බොත් විතරක් React කරයි
      if (settings.statusReact) {
        const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
        await socket.sendMessage(message.key.remoteJid, { 
            react: { text: randomEmoji, key: message.key } 
        }, { statusJidList: [message.key.participant] });
      }
    } catch (error) { console.error('Status handler error:', error.message); }
  });
}

async function handleMessageRevocation(socket, number) {
  // ... [Original Revocation Logic] ...
}

// ---------------- command handlers ----------------

function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

    const type = getContentType(msg.message);
    msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;

    const from = msg.key.remoteJid;
    const sender = from;
    const nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
    const senderNumber = (nowsender || '').split('@')[0];
    const isOwner = senderNumber === config.OWNER_NUMBER.replace(/[^0-9]/g,'');

    const body = (type === 'conversation') ? msg.message.conversation
      : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text
      : (type === 'imageMessage' && msg.message.imageMessage.caption) ? msg.message.imageMessage.caption
      : (type === 'videoMessage' && msg.message.videoMessage.caption) ? msg.message.videoMessage.caption
      : (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage?.selectedButtonId
      : (type === 'listResponseMessage') ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
      : (type === 'viewOnceMessage') ? (msg.message.viewOnceMessage?.message?.imageMessage?.caption || '') : '';

    if (!body || typeof body !== 'string') return;

    const prefix = config.PREFIX;
    const isCmd = body && body.startsWith && body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);

    // --- Auto Typing Logic ---
    const settings = botSettings.get(number) || { statusReact: false, autoTyping: false };
    if (settings.autoTyping && !msg.key.fromMe) {
        await socket.sendPresenceUpdate('composing', from);
    }

    if (!command) return;

    try {
      switch (command) {
      
case 'menu': {
  // ... [Original Menu Logic] ...
  break;
}

// --- නව On/Off Commands ---
case 'statusreact': {
    if (!args[0]) return socket.sendMessage(from, { text: `Usage: ${prefix}statusreact on/off` });
    const mode = args[0].toLowerCase();
    const current = botSettings.get(number) || { statusReact: false, autoTyping: false };
    
    if (mode === 'on') {
        current.statusReact = true;
        botSettings.set(number, current);
        await socket.sendMessage(from, { text: "✅ Status React Enabled!" });
    } else if (mode === 'off') {
        current.statusReact = false;
        botSettings.set(number, current);
        await socket.sendMessage(from, { text: "❌ Status React Disabled!" });
    }
    break;
}

case 'autotyping': {
    if (!args[0]) return socket.sendMessage(from, { text: `Usage: ${prefix}autotyping on/off` });
    const mode = args[0].toLowerCase();
    const current = botSettings.get(number) || { statusReact: false, autoTyping: false };

    if (mode === 'on') {
        current.autoTyping = true;
        botSettings.set(number, current);
        await socket.sendMessage(from, { text: "✅ Auto Typing Enabled!" });
    } else if (mode === 'off') {
        current.autoTyping = false;
        botSettings.set(number, current);
        await socket.sendMessage(from, { text: "❌ Auto Typing Disabled!" });
    }
    break;
}

case 'owner': {
  // ... [Original Owner Logic] ...
  break;
}

case 'developer': {
  // ... [Original Developer Logic] ...
  break;
}

case 'deleteme': {
  // ... [Original Deleteme Logic] ...
  break;
}

case 'deletemenumber': {
  // ... [Original Deletemenumber Logic] ...
  break;
}

case 'bots': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FREE;
    const logo = cfg.logo || config.IMAGE_PATH;

    const activeCount = activeSockets.size;
    const activeNumbers = Array.from(activeSockets.keys());

    let text = ` *👀 𝐀ctive 𝐒essions - ${botName}*\n\n`;
    text += `📊 *𝐓otal 𝐀ctive 𝐒essions:* ${activeCount}\n\n`;

    if (activeCount > 0) {
      text += `📱 *𝐀ctive 𝐍umbers:*\n`;
      activeNumbers.forEach((num, index) => {
        text += `${index + 1}. ${num}\n`;
      });
    } else {
      text += `*⚠️ No active sessions found.*`;
    }

    text += `\n*🕒 𝐂hecked 𝐀t:* ${getZimbabweanTimestamp()}`;

    let imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `*📊 ${botName} 𝐒ession 𝐒tatos*`,
      buttons: [
        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 }
      ],
      headerType: 4
    });

  } catch (err) {
    console.error('bots command error:', err);
  }
  break;
}

      }
    } catch (err) {
      console.error('command execution error:', err);
    }
  });
}

// ---------------- Server Export ----------------
module.exports = router;
