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
const config = require('./config'); // config.js එකෙන් data ගන්නවා

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

// ---------------- GLOBAL VARIABLES ----------------
const BOT_NAME_FANCY = config.BOT_NAME || 'ғʀᴇᴇ-ᴍɪɴɪ';
const BOT_NAME_FREE = config.BOT_NAME || 'ғʀᴇᴇ-ᴍɪɴɪ';
const activeSockets = new Map();
const socketCreationTime = new Map();

// ---------------- HELPERS ----------------
function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function getZimbabweanTimestamp() { 
  return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); 
}

// ✅ FIXED: sendOwnerConnectMessage (කලින් error ආපු තැන)
async function sendOwnerConnectMessage(socket, number, groupResult = {}, sessionConfig = {}) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const activeCount = activeSockets.size;
    const botName = sessionConfig.botName || BOT_NAME_FREE;
    const image = sessionConfig.logo || config.IMAGE_PATH;
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed: ${groupResult.error}`;
    
    const caption = formatMessage(
      `*🥷 OWNER CONNECT — ${botName}*`, 
      `*📞 Number:* ${number}\n*🩵 Status:* ${groupStatus}\n*🕒 Connected At:* ${getZimbabweanTimestamp()}\n\n*🔢 Active Sessions:* ${activeCount}`, 
      botName
    );

    await socket.sendMessage(ownerJid, { 
      image: { url: image.startsWith('http') ? image : config.IMAGE_PATH }, 
      caption: caption 
    });
  } catch (err) { console.error('Owner notification error:', err); }
}

// ---------------- MONGO SETUP ----------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://yuresh:yuresh@cluster0.imsvg84.mongodb.net/?appName=Cluster0';
const MONGO_DB = 'Free_Mini';
let mongoClient, mongoDB, sessionsCol, numbersCol, configsCol;

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);
    sessionsCol = mongoDB.collection('sessions');
    numbersCol = mongoDB.collection('numbers');
    configsCol = mongoDB.collection('configs');
    console.log('✅ Mongo initialized and collections ready');
  } catch(e) { console.error('Mongo Init Error:', e); }
}

async function removeSessionFromMongo(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  await sessionsCol.deleteOne({ number: sanitized });
  await numbersCol.deleteOne({ number: sanitized });
}

// ---------------- COMMAND HANDLERS ----------------
function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const type = getContentType(msg.message);
    const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
    
    if (!body || !body.startsWith(config.PREFIX)) return;

    const args = body.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const senderNumber = (msg.key.participant || msg.key.remoteJid).split('@')[0];
    const isOwner = senderNumber === config.OWNER_NUMBER.replace(/[^0-9]/g,'');

    // Fake contact payload
    const fakevcard = {
      key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "FREE_MINI_AI" },
      message: { contactMessage: { displayName: BOT_NAME_FANCY, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME_FANCY}\nTEL;waid=${senderNumber}:${senderNumber}\nEND:VCARD` } }
    };

    switch (command) {
      case 'menu':
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = moment.duration(Date.now() - startTime);
        const menuText = `╭─「 \`${BOT_NAME_FANCY}\` 」\n│\n│ 🥷 Owner: ${config.OWNER_NAME}\n│ 🧬 Version: ${config.BOT_VERSION}\n│ ⏰ Uptime: ${uptime.hours()}h ${uptime.minutes()}m\n╰──────────●●➤`;
        await socket.sendMessage(from, { image: { url: config.IMAGE_PATH }, caption: menuText }, { quoted: fakevcard });
        break;

      case 'alive':
        await socket.sendMessage(from, { text: `*${BOT_NAME_FANCY} IS ONLINE 🚀*` }, { quoted: msg });
        break;

      case 'deleteme':
        const myNum = (number || '').replace(/[^0-9]/g, '');
        if (senderNumber !== myNum && !isOwner) return socket.sendMessage(from, { text: '❌ No Permission.' });
        await removeSessionFromMongo(myNum);
        await socket.sendMessage(from, { text: '✅ Session deleted.' });
        socket.ws.close();
        break;

      // ✅ FIXED: deletemenumber (සම්පූර්ණ කරන ලදි)
      case 'deletemenumber':
        if (!isOwner) return socket.sendMessage(from, { text: '❌ Only Bot Owner can use this.' });
        const target = args[0] ? args[0].replace(/[^0-9]/g, '') : '';
        if (!target) return socket.sendMessage(from, { text: '❌ Use: .deletemenumber 947xxx' });
        try {
          await removeSessionFromMongo(target);
          await socket.sendMessage(from, { text: `✅ Session for ${target} removed from Database.` });
        } catch (e) { await socket.sendMessage(from, { text: `❌ Error: ${e.message}` }); }
        break;
    }
  });
}

// ---------------- EXPRESS ROUTER ----------------
router.get('/', (req, res) => {
  res.json({ status: "Online", bot: BOT_NAME_FREE });
});

module.exports = router;
