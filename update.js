const { exec } = require('child_process');

/**
 * ඕනෑම කෙනෙකුට පාවිච්චි කළ හැකි විදිහට සකස් කළ Update Function එක
 */
async function handleUpdate(socket, from) {
    // Owner check එක මෙතනින් අයින් කළා. දැන් ඕනෑම කෙනෙකුට පුළුවන්.
    
    await socket.sendMessage(from, { text: '🚀 *අලුත්ම Updates පරීක්ෂා කරමින් පවතී...*' });

    // Git Pull command එක මගින් අලුත් Code එක GitHub එකෙන් ලබා ගැනීම
    exec('git pull', async (err, stdout, stderr) => {
        if (err) {
            return socket.sendMessage(from, { 
                text: `❌ *Update Error:* \n\n\`\`\`${err.message}\`\`\`` 
            });
        }

        // දැනටමත් Update වී ඇත්දැයි බැලීම
        if (stdout.includes('Already up to date')) {
            return socket.sendMessage(from, { text: '✅ *Bot එක දැනටමත් අලුත්ම Version එකේ පවතී.*' });
        } else {
            // සාර්ථකව Update වුවහොත් පණිවිඩයක් යවා Bot එක Restart කිරීම
            await socket.sendMessage(from, { 
                text: '🔄 *Updates සාර්ථකව ලැබුණා! Bot එක දැන් Restart වෙනවා...*\n\n' + '```' + stdout + '```' 
            });

            // තත්පර 2කින් Bot එක නවතා අලුත් Code එකෙන් පණ ගැන්වීම
            setTimeout(() => {
                process.exit();
            }, 2000);
        }
    });
}

module.exports = { handleUpdate };
