{
  "name": "golden-queen-mini-bot",
  "version": "1.0.0",
  "description": "Golden Queen Mini - Multi-session WhatsApp Bot with MongoDB integration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "pm2": "pm2 start index.js --name golden-queen-mini",
    "pm2:stop": "pm2 stop golden-queen-mini",
    "pm2:restart": "pm2 restart golden-queen-mini",
    "pm2:delete": "pm2 delete golden-queen-mini"
  },
  "keywords": [
    "whatsapp",
    "bot",
    "baileys",
    "multi-session",
    "mongodb",
    "golden-queen"
  ],
  "author": "GQueen Team",
  "license": "ISC",
  "dependencies": {
    "@whiskeysockets/baileys": "npm:@dark-yasiya/baileys",
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "express": "^4.21.2",
    "file-type": "^16.5.4",
    "fluent-ffmpeg": "^2.1.3",
    "form-data": "^4.0.1",
    "fs-extra": "^11.2.0",
    "jimp": "^0.22.12",
    "google-tts-api": "^2.0.2",
    "megajs": "^1.3.0",
    "mongodb": "^6.12.0",
    "node-fetch": "^2.7.0",
    "papaparse": "^5.4.1",
    "pino": "^9.5.0",
    "qrcode-terminal": "^0.12.0",
    "wa-sticker-formatter": "^4.4.4",
    "yt-search": "^2.10.4"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/SLGoldenQueen/Mini-db.git"
  },
  "bugs": {
    "url": "https://github.com/SLGoldenQueen/Mini-db/issues"
  }
}
