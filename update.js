const { exec } = require('child_process');

async function handleUpdate(socket, from) {
    await socket.sendMessage(from, { text: '🚀 *අලුත්ම Updates පරීක්ෂා කරමින් පවතී...*' });

    exec('git pull', async (err, stdout, stderr) => {
        if (err) {
            return socket.sendMessage(from, { text: `❌ *Update Error:* \n\n\`\`\`${err.message}\`\`\`` });
        }

        if (stdout.includes('Already up to date')) {
            return socket.sendMessage(from, { text: '✅ *Bot එක දැනටමත් අලුත්ම Version එකේ පවතී.*' });
        } else {
            await socket.sendMessage(from, { 
                text: '🔄 *Updates සාර්ථකව ලැබුණා! Bot එක දැන් Restart වෙනවා...*\n\n' + '```' + stdout + '```' 
            });
            setTimeout(() => { process.exit(); }, 2000);
        }
    });
}

module.exports = { handleUpdate };
