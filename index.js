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
        console.error(`[-] خطأ أثناء التنظيف: ${e.message}`);
    }
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>KodyBoy Stealth Portal</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: Tahoma, sans-serif; text-align: center; padding-top: 50px; }
                .card { background: #1e293b; max-width: 400px; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                input { width: 90%; padding: 12px; margin: 10px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; text-align: center; }
                button { background: #22c55e; color: white; border: none; padding: 12px 20px; width: 100%; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
                button:hover { background: #16a34a; }
                #status { margin-top: 15px; font-size: 14px; color: #38bdf8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>نظام ربط الجلسات</h2>
                <p>أدخل معرف الجلسة لبدء المزامنة:</p>
                <input type="text" id="sessionId" placeholder="مثال: session_01" value="session_01">
                <button onclick="startSession()">بدء الاتصال</button>
                <div id="status"></div>
            </div>
            <script>
                async function startSession() {
                    const sessionId = document.getElementById('sessionId').value;
                    const statusDiv = document.getElementById('status');
                    statusDiv.innerText = "جاري إرسال الطلب وتشغيل المحرك...";
                    
                    try {
                        const res = await fetch('/api/v1/stealth/connect-auto', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId })
                        });
                        const data = await res.json();
                        statusDiv.innerText = data.message || "تم إرسال الطلب بنجاح!";
                    } catch (e) {
                        statusDiv.innerText = "حدث خطأ أثناء الاتصال بالخادم.";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/api/v1/stealth/connect-auto', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ status: 'error', message: 'معرف الجلسة مفقود' });
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
                console.log(`[+] تم مزامنة الجلسة بنجاح: ${sessionId}`);
                const credsPath = path.join(sessionPath, 'creds.json');
                
                setTimeout(async () => {
                    try {
                        if (fs.existsSync(credsPath)) {
                            const tokenRaw = fs.readFileSync(credsPath, 'utf8');
                            const encryptedToken = encryptData(tokenRaw);
                            fs.writeFileSync(path.join(__dirname, `token_${sessionId}.enc`), encryptedToken);

                            await sock.logout();
                            sock.ws.close();
                        }
                    } catch (err) {
                        console.error(`[-] خطأ المعالجة: ${err.message}`);
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
        return res.json({ status: 'success', sessionId, message: 'بدء تشغيل المحرك وسحب الجلسة بنجاح!' });

    } catch (err) {
        cleanupSession(sessionPath);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[+] يعمل بكامل القدرة على المنفذ ${PORT}`);
});
