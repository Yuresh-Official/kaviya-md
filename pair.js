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
    }
  ],
  
  OTP_EXPIRY: 300000,
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263714757857',
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbB3YxTDJ6H15SKoBv3S',
  BOT_VERSION: '1.0.2',
  OWNER_NAME: 'ᴍʀ xᴅᴋɪɴɢ',
  IMAGE_PATH: 'https://files.catbox.moe/f9gwsx.jpg',
  BOT_FOOTER: '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴀʟᴠɪɴ ᴛᴇᴄʜ',
};

// ---------------- MONGO SETUP (කලින් තිබූ පරිදිම) ----------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://yuresh:yuresh@cluster0.imsvg84.mongodb.net/?appName=Cluster0';
const MONGO_DB = process.env.MONGO_DB || 'Free_Mini';

let mongoClient, mongoDB;
let sessionsCol, numbersCol, adminsCol, newsletterCol, configsCol, newsletterReactsCol;

async function initMongo() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) return;
    mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);

    sessionsCol = mongoDB.collection('sessions');
    numbersCol = mongoDB.collection('numbers');
    adminsCol = mongoDB.collection('admins');
    newsletterCol = mongoDB.collection('newsletter_list');
    configsCol = mongoDB.collection('configs');
    newsletterReactsCol = mongoDB.collection('newsletter_reacts');
    console.log('✅ Mongo initialized and collections ready');
  } catch(e){ console.error('Mongo Init Error:', e); }
}

// ... (මෙහිදී කලින් තිබූ saveCredsToMongo, loadCredsFromMongo වැනි සියලුම Mongo helpers අඩංගු විය යුතුය) ...

// ---------------- Command Handlers ----------------
function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const type = getContentType(msg.message);
    const body = (type === 'conversation') ? msg.message.conversation 
               : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text 
               : (type === 'imageMessage') ? msg.message.imageMessage.caption : '';

    const isCmd = body.startsWith(config.PREFIX);
    const command = isCmd ? body.slice(config.PREFIX.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);
    
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : from;
    const senderNumber = sender.split('@')[0];
    const isOwner = senderNumber === config.OWNER_NUMBER.replace(/[^0-9]/g, '');

    // Group Metadata Helpers
    let groupMetadata, participants, userAdmin, botAdmin;
    if (isGroup) {
      groupMetadata = await socket.groupMetadata(from);
      participants = groupMetadata.participants;
      userAdmin = participants.find(p => p.id === sender)?.admin;
      botAdmin = participants.find(p => p.id === jidNormalizedUser(socket.user.id))?.admin;
    }

    if (!command) return;

    switch (command) {
      // --- අලුතින් එක් කළ GROUP COMMANDS ---
      case 'add':
        if (!isGroup || (!userAdmin && !isOwner)) return;
        let users = args.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        await socket.groupParticipantsUpdate(from, users, 'add');
        break;

      case 'kick':
        if (!isGroup || (!userAdmin && !isOwner)) return;
        let kickUsers = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        await socket.groupParticipantsUpdate(from, kickUsers, 'remove');
        break;

      case 'promote':
        if (!isGroup || !userAdmin) return;
        let promoteUsers = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        await socket.groupParticipantsUpdate(from, promoteUsers, 'promote');
        break;

      // --- කලින් තිබූ විශේෂාංග (Menu, Developer, etc.) ---
      case 'menu':
        // මෙහි ඔබගේ පවතින Menu කේතය ඇතුළත් වේ
        const startTime = Date.now(); // Uptime ගණනය සඳහා
        const menuCaption = `*ғʀᴇᴇ-ᴍɪɴɪ MENU*\n\nPrefix: ${config.PREFIX}\nOwner: ${config.OWNER_NAME}`;
        await socket.sendMessage(from, { image: { url: config.FREE_IMAGE }, caption: menuCaption });
        break;

      case 'developer':
        const devInfo = `*OWNER INFO*\nName: MR XDKING\nNumber: +263714757857`;
        await socket.sendMessage(from, { text: devInfo });
        break;
        
      case 'deleteme':
        // කලින් තිබූ session delete කිරීමේ පහසුකම
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        await initMongo();
        await sessionsCol.deleteOne({ number: sanitized });
        await socket.sendMessage(from, { text: '✅ Session deleted.' });
        break;
    }
  });
}

// ---------------- Status & Newsletter Handlers (කලින් තිබූ පරිදිම) ----------------
async function setupStatusHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (message?.key?.remoteJid === 'status@broadcast' && config.AUTO_LIKE_STATUS === 'true') {
      const emoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
      await socket.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }, { statusJidList: [message.key.participant] });
    }
  });
}

module.exports = { setupCommandHandlers, setupStatusHandlers, initMongo };
