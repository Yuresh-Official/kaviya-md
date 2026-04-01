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
  AUTO_LIKE_STATUS: 'true',
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

// ---------------- Mongo helpers (All preserved) ----------------

async function saveCredsToMongo(number, creds, keys = null) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = { number: sanitized, creds, keys, updatedAt: new Date() };
    await sessionsCol.updateOne({ number: sanitized }, { $set: doc }, { upsert: true });
  } catch (e) { console.error('saveCredsToMongo error:', e.message); }
}

async function loadCredsFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await sessionsCol.findOne({ number: sanitized });
    return doc || null;
  } catch (e) { console.error('loadCredsFromMongo error:', e.message); return null; }
}

async function removeSessionFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sessionsCol.deleteOne({ number: sanitized });
  } catch (e) { console.error('removeSessionFromMongo error:', e.message); }
}

async function addNumberToMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.updateOne({ number: sanitized }, { $set: { number: sanitized } }, { upsert: true });
  } catch (e) { console.error('addNumberToMongo', e.message); }
}

async function removeNumberFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.deleteOne({ number: sanitized });
  } catch (e) { console.error('removeNumberFromMongo', e.message); }
}

async function getAllNumbersFromMongo() {
  try {
    await initMongo();
    const docs = await numbersCol.find({}).toArray();
    return docs.map(d => d.number);
  } catch (e) { console.error('getAllNumbersFromMongo', e.message); return []; }
}

async function loadAdminsFromMongo() {
  try {
    await initMongo();
    const docs = await adminsCol.find({}).toArray();
    return docs.map(d => d.jid || d.number).filter(Boolean);
  } catch (e) { console.error('loadAdminsFromMongo', e.message); return []; }
}

async function addAdminToMongo(jidOrNumber) {
  try {
    await initMongo();
    await adminsCol.updateOne({ jid: jidOrNumber }, { $set: { jid: jidOrNumber } }, { upsert: true });
  } catch (e) { console.error('addAdminToMongo', e.message); }
}

async function removeAdminFromMongo(jidOrNumber) {
  try {
    await initMongo();
    await adminsCol.deleteOne({ jid: jidOrNumber });
  } catch (e) { console.error('removeAdminFromMongo', e.message); }
}

async function addNewsletterToMongo(jid, emojis = []) {
  try {
    await initMongo();
    const doc = { jid, emojis: Array.isArray(emojis) ? emojis : [], addedAt: new Date() };
    await newsletterCol.updateOne({ jid }, { $set: doc }, { upsert: true });
  } catch (e) { console.error('addNewsletterToMongo', e.message); throw e; }
}

async function removeNewsletterFromMongo(jid) {
  try {
    await initMongo();
    await newsletterCol.deleteOne({ jid });
  } catch (e) { console.error('removeNewsletterFromMongo', e.message); throw e; }
}

async function listNewslettersFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewslettersFromMongo', e.message); return []; }
}

async function saveNewsletterReaction(jid, messageId, emoji, sessionNumber) {
  try {
    await initMongo();
    if (!mongoDB) await initMongo();
    const col = mongoDB.collection('newsletter_reactions_log');
    await col.insertOne({ jid, messageId, emoji, sessionNumber, ts: new Date() });
  } catch (e) { console.error('saveNewsletterReaction', e.message); }
}

async function setUserConfigInMongo(number, conf) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await configsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('setUserConfigInMongo', e.message); }
}

async function loadUserConfigFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await configsCol.findOne({ number: sanitized });
    return doc ? doc.config : null;
  } catch (e) { console.error('loadUserConfigFromMongo', e.message); return null; }
}

async function addNewsletterReactConfig(jid, emojis = []) {
  try {
    await initMongo();
    await newsletterReactsCol.updateOne({ jid }, { $set: { jid, emojis, addedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('addNewsletterReactConfig', e.message); throw e; }
}

async function removeNewsletterReactConfig(jid) {
  try {
    await initMongo();
    await newsletterReactsCol.deleteOne({ jid });
  } catch (e) { console.error('removeNewsletterReactConfig', e.message); throw e; }
}

async function listNewsletterReactsFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterReactsCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewsletterReactsFromMongo', e.message); return []; }
}

async function getReactConfigForJid(jid) {
  try {
    await initMongo();
    const doc = await newsletterReactsCol.findOne({ jid });
    return doc ? (Array.isArray(doc.emojis) ? doc.emojis : []) : null;
  } catch (e) { console.error('getReactConfigForJid', e.message); return null; }
}

// ---------------- basic utils ----------------

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getZimbabweanTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }

const activeSockets = new Map();
const socketCreationTime = new Map();
const otpStore = new Map();
const botSettings = new Map();

// ---------------- helpers ----------------

async function joinGroup(socket) {
  let retries = config.MAX_RETRIES;
  const inviteCodeMatch = (config.GROUP_INVITE_LINK || '').match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  if (!inviteCodeMatch) return { status: 'failed', error: 'No group invite configured' };
  const inviteCode = inviteCodeMatch[1];
  while (retries > 0) {
    try {
      const response = await socket.groupAcceptInvite(inviteCode);
      if (response?.gid) return { status: 'success', gid: response.gid };
      throw new Error('No group ID in response');
    } catch (error) {
      retries--;
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('not-authorized')) errorMessage = 'Bot not authorized';
      else if (error.message && error.message.includes('conflict')) errorMessage = 'Already a member';
      else if (error.message && error.message.includes('gone')) errorMessage = 'Invite invalid/expired';
      if (retries === 0) return { status: 'failed', error: errorMessage };
      await delay(2000 * (config.MAX_RETRIES - retries));
    }
  }
  return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  const admins = await loadAdminsFromMongo();
  const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
  const botName = sessionConfig.botName || BOT_NAME_FREE;
  const image = sessionConfig.logo || config.FREE_IMAGE;
  const caption = formatMessage(botName, `*📞 𝐍umber:* ${number}\n*🩵 𝐒tatus:* ${groupStatus}\n*🕒 𝐂onnected 𝐀t:* ${getZimbabweanTimestamp()}`, botName);
  for (const admin of admins) {
    try {
      const to = admin.includes('@') ? admin : `${admin}@s.whatsapp.net`;
      if (String(image).startsWith('http')) {
        await socket.sendMessage(to, { image: { url: image }, caption });
      } else {
        try {
          const buf = fs.readFileSync(image);
          await socket.sendMessage(to, { image: buf, caption });
        } catch (e) {
          await socket.sendMessage(to, { image: { url: config.FREE_IMAGE }, caption });
        }
      }
    } catch (err) {
      console.error('Failed to send connect message to admin', admin, err?.message);
    }
  }
}

async function sendOwnerConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const activeCount = activeSockets.size;
    const botName = sessionConfig.botName || BOT_NAME_FREE;
    const image = sessionConfig.logo || config.FREE_IMAGE;
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(`*🥷 OWNER CONNECT — ${botName}*`, `*📞 𝐍umber:* ${number}\n*🩵 𝐒tatus:* ${groupStatus}\n*🕒 𝐂onnected 𝐀t:* ${getZimbabweanTimestamp()}\n\n*🔢 𝐀ctive 𝐒essions:* ${activeCount}`, botName);
    if (String(image).startsWith('http')) {
      await socket.sendMessage(ownerJid, { image: { url: image }, caption });
    } else {
      try {
        const buf = fs.readFileSync(image);
        await socket.sendMessage(ownerJid, { image: buf, caption });
      } catch (e) {
        await socket.sendMessage(ownerJid, { image: { url: config.FREE_IMAGE }, caption });
      }
    }
  } catch (err) { console.error('Failed to send owner connect message:', err?.message); }
}

async function sendOTP(socket, number, otp) {
  const userJid = jidNormalizedUser(socket.user.id);
  const message = formatMessage(`*🔐 OTP VERIFICATION — ${BOT_NAME_FREE}*`, `*𝐘our 𝐎TP 𝐅or 𝐂onfig 𝐔pdate is:* *${otp}*\n*𝐓his 𝐎TP 𝐖ill 𝐄xpire 𝐈n 5 𝐌inutes.*\n\n*𝐍umber:* ${number}`, BOT_NAME_FREE);
  try { await socket.sendMessage(userJid, { text: message }); }
  catch (error) { console.error(`Failed to send OTP to ${number}:`, error.message); throw error; }
}

// ---------------- handlers ----------------

async function setupNewsletterHandlers(socket, sessionNumber) {
  const rrPointers = new Map();

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key) return;
    const jid = message.key.remoteJid;

    try {
      const followedDocs = await listNewslettersFromMongo();
      const reactConfigs = await listNewsletterReactsFromMongo();
      const reactMap = new Map();
      for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

      const followedJids = followedDocs.map(d => d.jid);
      if (!followedJids.includes(jid) && !reactMap.has(jid)) return;

      let emojis = reactMap.get(jid) || null;
      if ((!emojis || emojis.length === 0) && followedDocs.find(d => d.jid === jid)) {
        emojis = (followedDocs.find(d => d.jid === jid).emojis || []);
      }
      if (!emojis || emojis.length === 0) emojis = config.AUTO_LIKE_EMOJI;

      let idx = rrPointers.get(jid) || 0;
      const emoji = emojis[idx % emojis.length];
      rrPointers.set(jid, (idx + 1) % emojis.length);

      const messageId = message.newsletterServerId || message.key.id;
      if (!messageId) return;

      let retries = 3;
      while (retries-- > 0) {
        try {
          if (typeof socket.newsletterReactMessage === 'function') {
            await socket.newsletterReactMessage(jid, messageId.toString(), emoji);
          } else {
            await socket.sendMessage(jid, { react: { text: emoji, key: message.key } });
          }
          await saveNewsletterReaction(jid, messageId.toString(), emoji, sessionNumber || null);
          break;
        } catch (err) {
          await delay(1200);
        }
      }

    } catch (error) {
      console.error('Newsletter reaction handler error:', error?.message);
    }
  });
}

async function setupStatusHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
    
    const settings = botSettings.get(number) || { statusReact: false, autoTyping: false };

    try {
      if (config.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate("recording", message.key.remoteJid);
      if (config.AUTO_VIEW_STATUS === 'true') {
          await socket.readMessages([message.key]);
      }
      
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
  socket.ev.on('messages.delete', async ({ keys }) => {
    if (!keys || keys.length === 0) return;
    const messageKey = keys[0];
    const userJid = jidNormalizedUser(socket.user.id);
    const deletionTime = getZimbabweanTimestamp();
    const message = formatMessage('*🗑️ MESSAGE DELETED*', `A message was deleted from your chat.\n*📄 𝐅rom:* ${messageKey.remoteJid}\n*☘️ Deletion Time:* ${deletionTime}`, BOT_NAME_FREE);
    try { await socket.sendMessage(userJid, { image: { url: config.FREE_IMAGE }, caption: message }); }
    catch (error) { console.error('Failed to send deletion notification:', error.message); }
  });
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

    const settings = botSettings.get(number) || { statusReact: false, autoTyping: false };
    if (settings.autoTyping && !msg.key.fromMe) {
        await socket.sendPresenceUpdate('composing', from);
    }

    const fakevcard = {
      key: {
        remoteJid: "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe: false,
        id: "META_AI_FAKE_ID"
      },
      message: {
        contactMessage: {
          displayName: "ғʀᴇᴇ ᴍɪɴɪ",
          vcard: `BEGIN:VCARD
VERSION:3.0
N:Free;;;;
FN:Meta
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002
END:VCARD`
        }
      }
    };

    if (!command) return;

    try {
      switch (command) {
      
case 'menu': {
  try { await socket.sendMessage(sender, { react: { text: "🎐", key: msg.key } }); } catch(e){}
  try {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    let userCfg = {};
    try { if (number) userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; }
    catch(e){ userCfg = {}; }

    const title = userCfg.botName || '©ғʀᴇᴇ ᴍɪɴɪ ';
    const text = `
╭─「  \`🤖${title}\`  」 ─➤* *│
*│*🥷 *Oᴡɴᴇʀ :* ${config.OWNER_NAME || 'ᴍʀ xᴅᴋɪɴɢ'}
*│*✒️ *Pʀᴇғɪx :* ${config.PREFIX}
*│*🧬 *Vᴇʀsɪᴏɴ :* ${config.BOT_VERSION || 'ʟᴀᴛᴇsᴛ'}
*│*🎈 *Pʟᴀᴛғᴏʀᴍ :* ${process.env.PLATFORM || 'Hᴇʀᴏᴋᴜ'}
*│*⏰ *Uᴘᴛɪᴍᴇ :* ${hours}h ${minutes}m ${seconds}s
*╰──────●●➤*

╭────────￫
│  🔧ғᴇᴀᴛᴜʀᴇs                       
│  [1] 👑 ᴏᴡɴᴇʀ                            
│  [2] 📥 ᴅᴏᴡɴʟᴏᴀᴅ                            
│  [3] 🛠️ ᴛᴏᴏʟs                            
│  [4] ⚙️ sᴇᴛᴛɪɴɢs                        
│  [5] 🎨 ᴄʀᴇᴀᴛɪᴠᴇ                              
╰───────￫

🎯 ᴛᴀᴘ ᴀ ᴄᴀᴛᴇɢᴏʀʏ ʙᴇʟᴏᴡ!`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: "👑 ᴏᴡɴᴇʀ" }, type: 1 },
      { buttonId: `${config.PREFIX}download`, buttonText: { displayText: "📥 ᴅᴏᴡɴʟᴏᴀᴅ" }, type: 1 },
      { buttonId: `${config.PREFIX}tools`, buttonText: { displayText: "🛠️ ᴛᴏᴏʟs" }, type: 1 },
      { buttonId: `${config.PREFIX}settings`, buttonText: { displayText: "⚙️ 𝘚𝘦𝘵𝘵𝘪𝘯𝘨𝘴" }, type: 1 },
      { buttonId: `${config.PREFIX}creative`, buttonText: { displayText: "🎨 ᴄʀᴇᴀᴛɪᴠᴇ" }, type: 1 },
    ];

    const defaultImg = "https://files.catbox.moe/f9gwsx.jpg";
    const useLogo = userCfg.logo || defaultImg;

    let imagePayload = String(useLogo).startsWith('http') ? { url: useLogo } : { url: defaultImg };

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: "*▶ ● 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃 *",
      buttons,
      headerType: 4
    }, { quoted: fakevcard });
  } catch (err) { console.error('menu error:', err); }
  break;
}

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
  try {
    const text = `
  \`👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ \`

╭─ 🤖 𝐀𝐈 𝐅𝐄𝐀𝐓𝐔𝐑𝐄𝐒
│ ✦ ${config.PREFIX}developer
│ ✦ ${config.PREFIX}deletemenumber
│ ✦ ${config.PREFIX}bots
│ ✦ ${config.PREFIX}update
╰────────`.trim();
    const buttons = [{ buttonId: `${config.PREFIX}developer`, buttonText: { displayText: "📥 ᴄʀᴇᴀᴛᴏʀ" }, type: 1 }];
    await socket.sendMessage(sender, { text, footer: "👑 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴", buttons }, { quoted: fakevcard });
  } catch (err) { console.error('owner error:', err); }
  break;
}

case 'update': {
    if (!isOwner) return socket.sendMessage(from, { text: '❌ Permission denied. Only the Owner can update the bot.' });
    await socket.sendMessage(from, { text: '🚀 *Checking for updates...*' });
    exec('git pull', async (err, stdout, stderr) => {
        if (err) return socket.sendMessage(from, { text: `❌ *Update Error:* ${err.message}` });
        if (stdout.includes('Already up to date')) {
            return socket.sendMessage(from, { text: '✅ *Bot is already up to date!*' });
        } else {
            await socket.sendMessage(from, { text: '🔄 *Update installed successfully! Restarting the bot...*' });
            process.exit(); // PM2 will automatically restart the bot
        }
    });
    break;
}

case 'developer': {
  const text = `
 \`👑 𝐎𝐖𝐍𝐄𝐑 𝐈𝐍𝐅𝐎 👑\`
╭─ 🧑‍💼 𝐃𝐄𝐓𝐀𝐈𝐋𝐒
│
│ ✦ 𝐍𝐚𝐦𝐞 : ᴍʀ xᴅᴋɪɴɢ
│ ✦ 𝐀𝐠𝐞  : 20+
│ ✦ 𝐍𝐨.  : +263714757857
│
╰────────✧`.trim();
  await socket.sendMessage(sender, { text, footer: "👑 𝘖𝘸𝘯𝘦𝘳 𝘐𝘯𝘧𝘰", buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 }] }, { quoted: fakevcard });
  break;
}

case 'deleteme': {
  const sanitized = (number || '').replace(/[^0-9]/g, '');
  await removeSessionFromMongo(sanitized);
  await removeNumberFromMongo(sanitized);
  await socket.sendMessage(sender, { text: '✅ Session deleted successfully.' });
  process.exit();
  break;
}

case 'bots': {
    const activeCount = activeSockets.size;
    const activeNumbers = Array.from(activeSockets.keys());
    let text = `📊 *Total Active Sessions:* ${activeCount}\n\n`;
    activeNumbers.forEach((num, index) => { text += `${index + 1}. ${num}\n`; });
    await socket.sendMessage(sender, { text, footer: "📊 Bot Stats" });
    break;
}

      }
    } catch (err) { console.error('command execution error:', err); }
  });
}

module.exports = router;
