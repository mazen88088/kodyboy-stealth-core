const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

const ENCRYPTION_KEY = crypto.scryptSync(process.env.SESSION_SECRET || 'kodyboy-secret-key-2026', 'salt', 32);
const IV_LENGTH = 16;

function encryptData(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function cleanupSession(sessionPath) {
    try {
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error(`[-] خطأ أثناء تنظيف الملفات: ${e.message}`);
    }
}

app.post('/api/v1/stealth/connect-auto', async (req, res) => {
    const { sessionId, webhookUrl } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ status: 'error', message: 'معرف الجلسة (sessionId) مفقود' });
    }

    const sessionPath = path.join(sessionsDir, sessionId);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['KodyBoy Advanced Auto-Sync Engine', 'Chrome', '124.0.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`[+] تم مزامنة الجلسة وسحب التوكن بنجاح: ${sessionId}`);
                const credsPath = path.join(sessionPath, 'creds.json');
                
                setTimeout(async () => {
                    try {
                        if (fs.existsSync(credsPath)) {
                            const tokenRaw = fs.readFileSync(credsPath, 'utf8');
                            const encryptedToken = encryptData(tokenRaw);

                            if (webhookUrl) {
                                console.log(`[+] جاري إرسال التوكن المشفّر إلى الويب هوك...`);
                            } else {
                                fs.writeFileSync(path.join(__dirname, `token_${sessionId}.enc`), encryptedToken);
                            }

                            await sock.logout();
                            sock.ws.close();
                        }
                    } catch (err) {
                        console.error(`[-] خطأ أثناء معالجة التوكن: ${err.message}`);
                    } finally {
                        cleanupSession(sessionPath);
                    }
                }, 1500);

            } else if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                    cleanupSession(sessionPath);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        return res.json({ status: 'success', sessionId, message: 'بدء تشغيل المحرك المطور بنجاح' });

    } catch (err) {
        cleanupSession(sessionPath);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[+] KodyBoy Advanced Core يعمل بكامل القدرة على المنفذ ${PORT}`);
});
