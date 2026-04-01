const express = require('express');
const fs = require('fs-extra');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');

// Update Function එක ආරක්ෂිතව ගෙන ඒම
let handleUpdate;
try {
    handleUpdate = require('./update').handleUpdate;
} catch (e) {
    console.log("Update file not found, but server will continue.");
}

// Pairing Page එකට අදාළ Route එක (ඔයාගේ කලින් තිබූ එකට සමානයි)
router.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, '../temp/pair.html')); 
});

// මෙන්න මෙතන තමයි වැදගත්ම කොටස - Command Handler එක
// (මෙය ඔබගේ message handler එකට ගලපා ගන්න)
async function onMessage(socket, m, isOwner) {
    const from = m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const prefix = "."; // ඔබ භාවිතා කරන Prefix එක
    const command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";

    switch (command) {
        case 'update': {
            if (typeof handleUpdate === 'function') {
                await handleUpdate(socket, from);
            } else {
                await socket.sendMessage(from, { text: "❌ update.js සොයාගත නොහැක." });
            }
            break;
        }
        // අනෙකුත් command මෙතනින් පල්ලෙහාට...
    }
}

module.exports = router;
