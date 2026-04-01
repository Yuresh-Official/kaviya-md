const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');
const uri = 'mongodb://mongo:AtncDEhKqwEuzBhVjzggpKGwoqEujVsg@tramway.proxy.rlwy.net:34443';

const client = new MongoClient(uri, {
  maxPoolSize: 10,   
});

const defaults = {
      OWNER_NAME: "GoldenQueenMini",
      OWNER_FROM: "Sri Lanka",
      BUTTON: "true",
      OWNER_AGE: "+99",
      PRIFIX: ".",
      MODE: "private",
      VIMA_LAN: "EN",
      AUTO_REACT: "false",
      ANTI_DELETE: "from",
      ANTI_CALL: "false",
      CALL_REJECT_LIST: "",
      CALL_OPEN_LIST: "",
      AUTO_REACT_STATUS: "true",
      AUTO_TYPING: "false",
      AUTO_RECODING: "false",
      ALWAYS_ONLINE: "false",
      AUTO_READ_STATUS: "true",
      AUTO_READ_MSG: "false",
      AUTO_SAVE: "false",
      CMD_READ: "false",
      AUTO_VOICE: "false",
      AUTO_BLOCK: "false",
      OWNER_IMG: "https://files.catbox.moe/wdzt28.jpg",
      MENU_LOGO: "https://files.catbox.moe/wdzt28.jpg",
      ALIVE_LOGO: "https://files.catbox.moe/wdzt28.jpg",
      ALIVE_MSG: "©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ɢᴏʟᴅᴇɴ Qᴜᴇᴇɴ ᴛᴇᴀᴍ",
      AUTO_DP_CHANGE: "false",
      AUTO_DP: "",
      BAN: "",
      SUDO: "",
      AUTO_CHANNEL_SONG: "false",
      XNX_VIDEO: "false",
      CHANNEL_JID: ""
    };


async function defEnv(ownerNumber) {
  try {
    await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    let doc = await collection.findOne({ ownerNumber });

    if (!doc) {
      // Document එක create කරන්න
      await collection.updateOne(
        { ownerNumber },
        { $set: { ownerNumber, ...defaults } },
        { upsert: true }
      );
      console.log(`✅ Created defaults for ${ownerNumber}`);
    } else {
      // Missing defaults add කරන්න
      const update = {};
      for (const [key, value] of Object.entries(defaults)) {
        if (!Object.prototype.hasOwnProperty.call(doc, key)) {
          update[key] = value;
        }
      }

      if (Object.keys(update).length > 0) {
        await collection.updateOne({ ownerNumber }, { $set: update });
        console.log(`✅ Added missing defaults for ${ownerNumber}`);
      } else {
        console.log(`ℹ️ All defaults already exist for ${ownerNumber}`);
      }
    }
  } catch (err) {
    console.error(`❌ Error adding defaults for ${ownerNumber}:`, err.message);
  } finally {
    await client.close();
  }
}





let liveSettings = {}; 

/*
function toStringValues(obj) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = obj[key] !== undefined && obj[key] !== null 
        ? String(obj[key]) 
        : "";
    }
  }
  return result;
}

async function loadSettings(ownerNumber) {
  try {
    await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    const doc = await collection.findOne({ ownerNumber });

    if (doc) {
      liveSettings[ownerNumber] = toStringValues(doc); // ✅ All string
    } else {
      liveSettings[ownerNumber] = toStringValues({ ownerNumber, ...defaults });
      console.log(`⚠️ No document found, using defaults for ${ownerNumber}`);
    }

    const settingsDir = path.resolve(__dirname, 'SETTINGS');
    await fs.ensureDir(settingsDir);
    const filePath = path.join(settingsDir, `${ownerNumber}.js`);
    const fileContent = `module.exports = ${JSON.stringify(liveSettings[ownerNumber], null, 2)};\n`;
    await fs.writeFile(filePath, fileContent, 'utf8');
    delete require.cache[require.resolve(filePath)];

    return liveSettings[ownerNumber];
  } catch (err) {
    console.error(`❌ Error loading settings:`, err.message);
    return toStringValues({ ...defaults });
  } finally {
    await client.close();
  }
}

function readEnv(ownerNumber) {
  if (!liveSettings[ownerNumber]) {
    console.log(`⚠️ Settings for ${ownerNumber} not loaded, returning defaults`);
    return toStringValues({ ...defaults }); // ✅ Always strings
  }
  return toStringValues(liveSettings[ownerNumber]); // ✅ Always strings
}

*/
async function loadSettings(ownerNumber) {
  try {
    await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    const doc = await collection.findOne({ ownerNumber });

    if (doc) {
      // Primary: MongoDB doc
      liveSettings[ownerNumber] = doc;
    } else {
      // Fallback: defaults
      liveSettings[ownerNumber] = { ownerNumber, ...defaults };
      console.log(`⚠️ No document found, using defaults for ${ownerNumber}`);
    }

    // Local backup file
    const settingsDir = path.resolve(__dirname, 'SETTINGS');
    await fs.ensureDir(settingsDir);
    const filePath = path.join(settingsDir, `${ownerNumber}.js`);
    const fileContent = `module.exports = ${JSON.stringify(liveSettings[ownerNumber], null, 2)};\n`;
    await fs.writeFile(filePath, fileContent, 'utf8');
    delete require.cache[require.resolve(filePath)];

    return liveSettings[ownerNumber];
  } catch (err) {
    console.error(`❌ Error loading settings:`, err.message);
    return { ...defaults };
  } finally {
    await client.close();
  }
}

function readEnv(ownerNumber) {
  // memory object එක check කරන්න
  if (!liveSettings[ownerNumber]) {
    console.log(`⚠️ Settings for ${ownerNumber} not loaded, returning defaults`);
    return { ...defaults };
  }
  return liveSettings[ownerNumber];
}


/*

async function updateEnv(ownerNumber, key, newValue) {
  try {
  await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    // Dynamic key update කරන්න $set object එක තනාගන්න
    const updateObj = { [key]: newValue };

    const result = await collection.updateOne(
      { ownerNumber },      // filter by ownerNumber
      { $set: updateObj }   // set only that key's value
    );
     
    if (result.matchedCount === 0) {
      console.log(`⚠️ No document found with ownerNumber ${ownerNumber}`);
      return false;
    }

    console.log(`✅ Updated key "${key}" for ownerNumber ${ownerNumber} with value:`, newValue);
    await loadSettings(ownerNumber);
    return true;

  } catch (err) {
    console.error(`❌ Error updating key "${key}" for ownerNumber ${ownerNumber}:`, err);
    return false;
  }finally{
  await client.close();



  }
}
*/

async function updateEnv(ownerNumber, key, newValue) {
  try {
    await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    let updateObj = {};

    if (key === "AUTO_DP") {
      // Get existing document for that owner
      const doc = await collection.findOne({ ownerNumber });
      let currentValues = [];

      if (doc && typeof doc.AUTO_DP === "string" && doc.AUTO_DP.trim() !== "") {
        currentValues = doc.AUTO_DP.split(",").map(v => v.trim()).filter(v => v !== "");
      }

      // Add new value
      currentValues.push(newValue);

      // If more than 5, remove the oldest (first item)
      if (currentValues.length > 5) {
        currentValues.shift();
      }

      // Join back to comma-separated string
      updateObj[key] = currentValues.join(",");
    } 
    else {
      // Normal update for other keys
      updateObj[key] = newValue;
    }

    const result = await collection.updateOne(
      { ownerNumber },
      { $set: updateObj }
    );

    if (result.matchedCount === 0) {
      console.log(`⚠️ No document found with ownerNumber ${ownerNumber}`);
      return false;
    }

    console.log(`✅ Updated key "${key}" for ownerNumber ${ownerNumber} with value:`, updateObj[key]);
    await loadSettings(ownerNumber);
    return true;

  } catch (err) {
    console.error(`❌ Error updating key "${key}" for ownerNumber ${ownerNumber}:`, err);
    return false;
  } finally {
    await client.close();
  }
}

async function updateList(ownerNumber, key, values, action = "add") {
  try {
    await client.connect();
    const db = client.db('VIMADB');
    const collection = db.collection('SETTINGS');

    // Step 1: Get existing value
    const doc = await collection.findOne({ ownerNumber });
    if (!doc) {
      console.log(`⚠️ No document found with ownerNumber ${ownerNumber}`);
      return false;
    }

    let currentValue = doc[key] || ""; // existing string or empty

    // Convert values param to array
    let valuesArray = [];
    if (Array.isArray(values)) {
      valuesArray = values;
    } else if (typeof values === 'string') {
      valuesArray = values.split(',').map(v => v.trim()).filter(v => v !== '');
    } else {
      console.log('❌ values must be string or array');
      return false;
    }

    // Current DB array
    let currentArray = currentValue.split(',').map(v => v.trim()).filter(v => v !== '');

    if (action === "add") {
      // Combine and remove duplicates
      const combinedSet = new Set([...currentArray, ...valuesArray]);
      currentArray = Array.from(combinedSet);
    } else if (action === "remove") {
      // Filter out values to remove
      currentArray = currentArray.filter(v => !valuesArray.includes(v));
    } else {
      console.log('❌ action must be "add" or "remove"');
      return false;
    }

    // Join back to comma separated string (optional trailing comma)
    const newValue = currentArray.join(',') + (currentArray.length > 0 ? ',' : '');

    // Step 3: Update DB
    const updateObj = { [key]: newValue };
    const result = await collection.updateOne(
      { ownerNumber },
      { $set: updateObj }
    );

    if (result.matchedCount === 0) {
      console.log(`⚠️ No document found with ownerNumber ${ownerNumber}`);
      return false;
    }

    console.log(`✅ Updated key "${key}" for ownerNumber ${ownerNumber} [${action}]: ${newValue}`);
    await loadSettings(ownerNumber);
    return true;

  } catch (err) {
    console.error(`❌ Error updating key "${key}" for ownerNumber ${ownerNumber}:`, err);
    return false;
  } finally {
    await client.close();
  }
}

async function dpchange(conn, jid, url) {
    // Guard clause
    if (!conn || !jid || !url) return;

    try {
        const Atu = await readEnv(jid);

        // AUTO_DP_CHANGE 'true' නම් DP change කරන්න
        if (Atu.AUTO_DP_CHANGE !== 'true') return;

        // jid අවසාන ඉලක්කම බලන්න
        const lastDigit = parseInt(jid.slice(-1), 10);

        // last digit එකේ base එකෙන් delay set කරන්න (seconds to ms)
        // example: lastDigit = 0 → 1s, lastDigit = 9 → 10s
        const delay = (lastDigit + 1) * 1000;

        // delay ක්‍රියාත්මක කරන්න
        await new Promise(res => setTimeout(res, delay));

        // DP update
        await conn.updateProfilePicture(`${jid}@s.whatsapp.net`, { url: url });

      //  console.log(`DP changed for ${jid} after ${delay / 1000}s delay`);
    } catch (e) {
       // console.error(`DP change failed for ${jid}`, e);
    }
}
module.exports = { updateList,readEnv,defEnv,updateEnv, loadSettings,dpchange };