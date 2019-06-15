const debug = require('debug')('sitepower.io-backend:api-alice');
const nodemailer = require('nodemailer');

module.exports = function (app) {
    app.post("/api/alice/fatcalc", (req, res) => {
        res.send({
            session : req.body.session,
            version : req.body.version,
            response: {
                text: "Здравствуйте! Это навык для расчета индеса массы тела. Пожалуйста, назовите Ваш рост и вес",
                tts: "Здравствуйте!  Это навык для расчета индеса массы тела. Пожалуйста, назовите Ваш рост и вес",
                "end_session": true
            }
        })
    });

    const sendNewLead = (mail) => {
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
            subject: 'Запрос на Алису',
            html:'Запрос от клиента: ' + mail
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                debug("sendRegOperatorLink", error);
            } else {
                debug("sendRegOperatorLink", 'Email sent: ' + info.response);
            }
        });
    };

    app.post("/api/alice/lead", (req, res) => {
        sendNewLead(req.body.email);
        res.send("OK");
    });
}
