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
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263714757857',
  BOT_VERSION: '1.0.2',
  OWNER_NAME: 'ᴍʀ xᴅᴋɪɴɢ',
  BOT_FOOTER: '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴀʟᴠɪɴ ᴛᴇᴄʜ',
};

// ---------------- MONGO SETUP ----------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://yuresh:yuresh@cluster0.imsvg84.mongodb.net/?appName=Cluster0';
const MONGO_DB = process.env.MONGO_DB || 'Free_Mini';

let mongoClient, mongoDB;
let sessionsCol, numbersCol, adminsCol, configsCol;

async function initMongo() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) return;
    mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await mongoClient.connect();
    mongoDB = mongoClient.db(MONGO_DB);
    sessionsCol = mongoDB.collection('sessions');
    numbersCol = mongoDB.collection('numbers');
    adminsCol = mongoDB.collection('admins');
    configsCol = mongoDB.collection('configs');
    console.log('✅ Mongo initialized');
  } catch(e){ console.error('Mongo Init Error:', e); }
}

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

    if (!command) return;

    // Group Admin Check Helper
    const groupMetadata = isGroup ? await socket.groupMetadata(from) : null;
    const participants = isGroup ? groupMetadata.participants : [];
    const botId = jidNormalizedUser(socket.user.id);
    const botAdmin = isGroup ? participants.find(p => p.id === botId)?.admin : false;
    const userAdmin = isGroup ? participants.find(p => p.id === sender)?.admin : false;

    switch (command) {
      // --- GROUP COMMANDS ---
      case 'add':
        if (!isGroup) return socket.sendMessage(from, { text: '❌ This command is for groups only.' });
        if (!userAdmin && !isOwner) return socket.sendMessage(from, { text: '❌ You are not an admin.' });
        if (!botAdmin) return socket.sendMessage(from, { text: '❌ Make the bot an admin first.' });
        
        let usersToAdd = args.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        await socket.groupParticipantsUpdate(from, usersToAdd, 'add');
        socket.sendMessage(from, { text: '✅ Added successfully.' });
        break;

      case 'kick':
        if (!isGroup) return;
        if (!userAdmin && !isOwner) return;
        let usersToKick = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (usersToKick.length === 0) return socket.sendMessage(from, { text: '❌ Tag someone to kick.' });
        await socket.groupParticipantsUpdate(from, usersToKick, 'remove');
        socket.sendMessage(from, { text: '✅ Removed.' });
        break;

      case 'promote':
        if (!isGroup || !userAdmin) return;
        let toPromote = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        await socket.groupParticipantsUpdate(from, toPromote, 'promote');
        socket.sendMessage(from, { text: '✅ Promoted to Admin.' });
        break;

      case 'demote':
        if (!isGroup || !userAdmin) return;
        let toDemote = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        await socket.groupParticipantsUpdate(from, toDemote, 'demote');
        socket.sendMessage(from, { text: '✅ Demoted.' });
        break;

      case 'hidetag':
        if (!isGroup || !userAdmin) return;
        socket.sendMessage(from, { text: args.join(' ') || '', mentions: participants.map(a => a.id) });
        break;

      // --- MENU & INFO ---
      case 'menu':
        const menuText = `
╭──「 ${config.BOT_NAME_FREE} 」
│ 🥷 Owner: ${config.OWNER_NAME}
│ 🧬 Version: ${config.BOT_VERSION}
╰───────────
╭──「 GROUP CMDS 」
│ ✦ ${config.PREFIX}add
│ ✦ ${config.PREFIX}kick
│ ✦ ${config.PREFIX}promote
│ ✦ ${config.PREFIX}demote
│ ✦ ${config.PREFIX}hidetag
╰───────────`;
        await socket.sendMessage(from, { 
          image: { url: config.FREE_IMAGE }, 
          caption: menuText,
          footer: config.BOT_FOOTER 
        });
        break;
    }
  });
}

// ---------------- EXPORTS ----------------
module.exports = { setupCommandHandlers, initMongo };
