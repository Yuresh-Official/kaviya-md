const express = require('express');
const fs = require('fs-extra'); // මෙතන error එකක් ආවොත් 'npm install fs-extra' කරන්න
const router = express.Router();
const config = require('./config');

// --- UPDATE FUNCTION එක ආරක්ෂිතව ඇතුළත් කිරීම ---
let handleUpdate;
try {
    handleUpdate = require('./update').handleUpdate;
} catch (e) {
    console.log("⚠️ update.js file එක සොයාගත නොහැක. Update command එක වැඩ නොකරනු ඇත.");
}
// ------------------------------------------

router.get('/', async (req, res) => {
    // මෙතන ඔයාගේ පරණ pair.js එකේ තිබුණ QR/Pairing logic එක තියෙනවා...
    // (මෙය සරල කර ඇත, ඔයාගේ පරණ file එකේ තිබුණ GET route එකම තබාගන්න)
    res.send("Kaviya-MD Pairing Server is Running!");
});

// මෙය ඔයාගේ ප්‍රධාන Command Handler එක (සාරාංශයක්)
async function messageHandler(socket, m, isOwner) {
    const from = m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const command = body.startsWith(config.PREFIX) ? body.slice(config.PREFIX.length).trim().split(' ')[0].toLowerCase() : "";

    switch (command) {
        case 'menu':
            await socket.sendMessage(from, { text: "Kaviya-MD Menu is here!" });
            break;

        case 'autotyping':
            // ඔයාගේ autotyping logic එක මෙතන තියෙයි...
            break;

        // --- අලුතින් එකතු කළ UPDATE COMMAND එක ---
        case 'update': {
            if (typeof handleUpdate === 'function') {
                // මෙතන true දමා ඇත්තේ ඕනෑම කෙනෙකුට පරීක්ෂා කිරීමටයි. 
                // පසුව මෙය isOwner ලෙස වෙනස් කරන්න.
                await handleUpdate(socket, from, true); 
            } else {
                await socket.sendMessage(from, { text: "❌ update.js file එක සොයාගත නොහැක. කරුණාකර file එක නිවැරදිව සාදා ඇත්දැයි බලන්න." });
            }
            break;
        }
    }
}

module.exports = router;
