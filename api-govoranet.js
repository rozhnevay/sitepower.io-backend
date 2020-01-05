const debug = require('debug')('sitepower.io-backend:api-govoranet');
const nodemailer = require('nodemailer');

module.exports = function (app) {

    const sendNewLead = (phone) => {
        var transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            auth: {
                user: process.env.SMTP_LOGIN,
                pass: process.env.SMTP_PASSWORD
            }
        });
        let mailOptions = {
            from: process.env.SMTP_LOGIN,
            to: "yybalakina@yandex.ru;rozhnevay@gmail.com",
            subject: 'Заявка с сайта',
            html: `
                <p>Телефон: <a href="tel:${phone}">${phone}</a></p>
        `
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                debug("send", error);
            } else {
                debug("send", 'Email sent: ' + info.response);
            }
        });
    };

    app.post("/api/govoranet/lead", (req, res) => {
        sendNewLead(req.body.phone);
        res.send("OK");
    });
}
