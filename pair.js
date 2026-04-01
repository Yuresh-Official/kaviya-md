const express = require('express');
const fs = require('fs-extra'); 
const router = express.Router();
const config = require('./config');

// --- UPDATE FUNCTION එක ආරක්ෂිතව ඇතුළත් කිරීම ---
let handleUpdate;
try {
    // update.js file එක තිබේ නම් පමණක් එය ලබා ගනී
    handleUpdate = require('./update').handleUpdate;
} catch (e) {
    console.log("⚠️ update.js file එක සොයාගත නොහැක. Update command එක වැඩ නොකරනු ඇත.");
}
// ------------------------------------------

router.get('/', async (req, res) => {
    // මෙතන ඔයාගේ බොට් එකේ පරණ තිබුණ QR/Pairing logic එක තියෙන්න ඕනේ.
    // දැනට මම සරලව දමමි.
    res.send("Kaviya-MD Pairing Server is Running!");
});

/**
 * ප්‍රධාන මැසේජ් හැන්ඩ්ලර් එක
 * (මෙය ඔයාගේ බොට් එකේ structure එක අනුව වෙනස් විය හැක)
 */
async function messageHandler(socket, m, isOwner) {
    const from = m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const command = body.startsWith(config.PREFIX) ? body.slice(config.PREFIX.length).trim().split(' ')[0].toLowerCase() : "";

    switch (command) {
        case 'menu':
            await socket.sendMessage(from, { text: "Kaviya-MD Menu is here!" });
            break;

        case 'autotyping': {
            // ඔයාගේ පරණ autotyping code එක මෙතන තියෙන්න ඕනේ
            await socket.sendMessage(from, { text: "Auto Typing configuration..." });
            break;
        }

        // --- ඕනෑම කෙනෙකුට පාවිච්චි කළ හැකි UPDATE COMMAND එක ---
        case 'update': {
            if (typeof handleUpdate === 'function') {
                // මෙතන isOwner check එක නැතිව කෙලින්ම function එක call කරයි
                await handleUpdate(socket, from); 
            } else {
                await socket.sendMessage(from, { 
                    text: "❌ *Error:* `update.js` file එක සොයාගත නොහැක. කරුණාකර file එක නිවැරදි තැන තිබේදැයි පරීක්ෂා කරන්න." 
                });
            }
            break;
        }
    }
}

module.exports = router;
