const express = require('express');
const app = express();
const PORT = 4040;

// السماح بقراءة البيانات المرسلة بصيغة JSON أو Form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// مسار رئيسي لاستقبال البيانات أو فحص الاتصال
app.all('/', (req, res) => {
    console.log(`[+] Received ${req.method} request from ${req.ip}`);
    console.log('Headers:', req.headers);
    console.log('Query Params:', req.query);
    console.log('Body Data:', req.body);

    res.status(200).send({
        status: 'success',
        message: 'Data logged successfully',
        received_data: {
            query: req.query,
            body: req.body
        }
    });
});

// تشغيل السيرفر على البورت 4040
app.listen(PORT, () => {
    console.log(`[+] Server running and listening on http://localhost:${PORT}`);
});
