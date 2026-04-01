const { exec } = require('child_process');

/**
 * Bot එක Update කිරීමට භාවිතා කරන ප්‍රධාන Function එක
 */
async function handleUpdate(socket, from, isOwner) {
    // 1. මේක හදලා තියෙන්නේ ආරක්ෂාවට - Owner ට විතරයි Update කරන්න පුළුවන්
    if (!isOwner) {
        return socket.sendMessage(from, { text: '❌ මෙම Command එක භාවිතා කළ හැක්කේ Bot හි හිමිකරුට (Owner) පමණි.' });
    }

    await socket.sendMessage(from, { text: '🚀 *Checking for updates from GitHub...*' });

    // 2. Git Pull command එක මගින් අලුත් Code එක ගන්නවා
    exec('git pull', async (err, stdout, stderr) => {
        if (err) {
            return socket.sendMessage(from, { 
                text: `❌ *Update Error:* \n\n\`\`\`${err.message}\`\`\`` 
            });
        }

        // 3. දැනටමත් Update ද කියලා බලනවා
        if (stdout.includes('Already up to date')) {
            return socket.sendMessage(from, { text: '✅ *Bot එක දැනටමත් අලුත්ම Version එකේ තියෙන්නේ.*' });
        } else {
            // 4. සාර්ථකව Update වුණොත් පණිවිඩයක් යවා Restart කරනවා
            await socket.sendMessage(from, { 
                text: '🔄 *Updates සාර්ථකව Install වුණා! Bot එක දැන් Restart වෙනවා...*\n\n' + '```' + stdout + '```' 
            });

            // තත්පර 2කින් Bot එක පීච්චි කරලා අලුත් Code එකෙන් පණ ගන්වනවා (Process Exit)
            setTimeout(() => {
                process.exit();
            }, 2000);
        }
    });
}

module.exports = { handleUpdate };
