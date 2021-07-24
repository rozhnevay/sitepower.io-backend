const debug = require('debug')('sitepower.io-backend:api-bitrix');
const nodemailer = require('nodemailer');
const db = require('./queries');

module.exports = function (app) {

    const sendJSON = (req) => {
        var transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            auth: {
                user: process.env.SMTP_LOGIN,
                pass: process.env.SMTP_PASSWORD
            }
        });
        let mailOptions = {
            from: process.env.SMTP_LOGIN,
            to: "rozhnevay@gmail.com",
            subject: 'Bitrix Test',
            html: JSON.stringify(req.body)
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                debug("send", error);
            } else {
                debug("send", 'Email sent: ' + info.response);
            }
        });
    };

    app.post("/api/mango/events/call", (req, res) => {
        sendJSON(req);
        res.send("OK");
    });

    app.post("/api/mango/events/summary", (req, res) => {
        sendJSON(req);
        res.send("OK");
    });
}
