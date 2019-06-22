const debug = require('debug')('sitepower.io-backend:api-oratorart');
const nodemailer = require('nodemailer');

module.exports = function (app) {

const sendNewLead = (name, phone, mail, text) => {
    var transporter = nodemailer.createTransport({
        host: process.env.SMTP_SERVER,
        auth: {
            user: process.env.SMTP_LOGIN,
            pass: process.env.SMTP_PASSWORD
        }
    });
    let mailOptions = {
        from: process.env.SMTP_LOGIN,
        to: "moskvina.vera-m@yandex.ru;rozhnevay@gmail.com",
        subject: 'Заявка с сайта',
        html: `
            <p>Имя: ${name}</p>
            <p>Телефон: <a href="tel:${phone}">${phone}</a></p>
            <p>Email: <a href="mailto:${mail}">${mail}</a></p>
            <p>Сообщение: ${text}</p>
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

app.post("/api/oratorart/lead", (req, res) => {
    sendNewLead(req.body.name, req.body.phone, req.body.email, req.body.text);
    res.send("OK");
});
}
