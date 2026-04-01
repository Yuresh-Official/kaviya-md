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
const BOT_NAME_FANCY = 'ғʀᴇᴇ-ᴍɪɴɪ'; // Fixed ReferenceError

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
  BOT_VERSION: '1.0.2',
  BOT_FOOTER: '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴀʟᴠɪɴ ᴛᴇᴄʜ'
};

// --- SETTINGS STORAGE ---
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function getBotSettings(botNum) {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}));
        const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        return data[botNum] || { auto_view: 'true', auto_like: 'true', auto_rec: 'false' };
    } catch (e) { return { auto_view: 'true', auto_like: 'true', auto_rec: 'false' }; }
}

function saveBotSettings(botNum, newData) {
    try {
        let data = {};
        if (fs.existsSync(SETTINGS_FILE)) data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        data[botNum] = newData;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error("Settings Error", e); }
}

// ---------------- HELPERS ----------------
async function sendOwnerConnectMessage(socket, number) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const caption = `*✅ SESSION CONNECTED*\n\n*Number:* ${number}\n*Time:* ${moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss')}`;
    await socket.sendMessage(ownerJid, { image: { url: config.FREE_IMAGE }, caption });
  } catch (err) { console.log('Owner notify error'); }
}

// ---------------- STATUS HANDLERS ----------------
async function setupStatusHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m?.key || m.key.remoteJid !== 'status@broadcast') return;
    const settings = getBotSettings(number.replace(/[^0-9]/g, ''));

    try {
      if (settings.auto_view === 'true') await socket.readMessages([m.key]);
      if (settings.auto_like === 'true') {
        const emoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
        await socket.sendMessage(m.key.remoteJid, { react: { text: emoji, key: m.key } }, { statusJidList: [m.key.participant] });
      }
    } catch (e) {}
  });
}

// ---------------- COMMAND HANDLERS ----------------
function setupCommandHandlers(socket, number) {
  const botNum = number.replace(/[^0-9]/g, '');

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const type = getContentType(msg.message);
    const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
    const isOwner = (msg.key.participant || msg.key.remoteJid).includes(config.OWNER_NUMBER);

    if (body.startsWith(config.PREFIX)) {
      const command = body.slice(config.PREFIX.length).trim().split(' ').shift().toLowerCase();

      if (command === 'settings') {
        const s = getBotSettings(botNum);
        const text = `*⚙️ ${BOT_NAME_FREE} SETTINGS*\n\n1. Auto View: ${s.auto_view}\n2. Auto Like: ${s.auto_like}\n3. Auto Rec: ${s.auto_rec}\n\n*Reply with number to toggle.*`;
        await socket.sendMessage(from, { text }, { quoted: msg });
      }

      if (command === 'menu') {
        await socket.sendMessage(from, { text: `*Hi, I am ${BOT_NAME_FANCY}*\nUse .settings to config.` }, { quoted: msg });
      }
    }

    // Toggle logic for settings
    if (!body.startsWith(config.PREFIX) && msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.includes(" toggle")) {
        let s = getBotSettings(botNum);
        if (body === '1') s.auto_view = s.auto_view === 'true' ? 'false' : 'true';
        if (body === '2') s.auto_like = s.auto_like === 'true' ? 'false' : 'true';
        if (body === '3') s.auto_rec = s.auto_rec === 'true' ? 'false' : 'true';
        saveBotSettings(botNum, s);
        await socket.sendMessage(from, { text: '✅ Updated!' });
    }
  });
}

module.exports = router;
