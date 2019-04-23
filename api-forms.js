const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-forms');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jwt-simple');
const nodemailer = require('nodemailer');

module.exports = function (app, authMiddleware) {
    app.get("/api/forms", authMiddleware, (req, res) => {
        db.getFormsByUserId(req.session.passport.user).then(forms => res.send(forms)).catch((err) => res.status(400).send(err.message));
    })

    app.get("/api/form", authMiddleware, (req, res) => {
        db.getFormsById(req.id).then(form => res.send(form)).catch((err) => res.status(400).send(err.message));
    })

    app.post("/api/form", authMiddleware, (req, res) => {
        db.createForm(req.session.passport.user, req.body.origin).then(id => res.send(id)).catch((err) => res.status(400).send(err.message));
    })

    app.post("/api/form/:id", authMiddleware, (req, res) => {
        debug("/api/form/:id POST", req.params.id, JSON.stringify(req.body));
        db.updateForm(req.params.id, req.session.passport.user, req.body).then(() => res.send("OK")).catch((err) => res.status(400).send(err.message));
    })

    app.get("/api/operators/", authMiddleware, (req, res) => {
        debug("/api/operators/ GET", JSON.stringify(req.body));
        db.getOperators(req.session.passport.user).then((operators) => res.send(operators)).catch((err) => res.status(400).send(err.message));
    })




    const sendRegOperatorLink = (user, data, domain) => {
        const payload = {
            id: user.id,
            email: user.login
        }
        const secret = user.pass + "-" + user.created.getTime();
        const token = jwt.encode(payload, secret);

        const html = data.toString().replace(/%%LINK%%/g, "http://" + process.env.DOMAIN + "/api/operator/"+ payload.id + "/" + token);
        var transporter = nodemailer.createTransport({
            host: process.env.MAILGUN_SMTP_SERVER,
            auth: {
                user: process.env.MAILGUN_SMTP_LOGIN,
                pass: process.env.MAILGUN_SMTP_PASSWORD
            }
        });
        let mailOptions = {
            from: process.env.MAILGUN_SMTP_LOGIN,
            to: payload.email,
            subject: 'sitepower.io: Operator Register',
            html:html
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                debug("sendRegOperatorLink", error);
            } else {
                debug("sendRegOperatorLink", 'Email sent: ' + info.response);
            }
        });
    };

    fs.readFile("./views/mail_reg_operator.html", (err, data) => {
        if (err) debug("{reg_operator}", err.message)
        if (data) {
            app.post("/api/operator/", authMiddleware, (req, res) => {
                debug("/api/operator/ POST", JSON.stringify(req.body));
                //db.createOperator(req.body.login, req.session.passport.user).then(() => /*TODO: отправка письма - приглашения!!!*/ res.send("OK")).catch((err) => res.status(400).send(err.message));
                bcrypt.genSalt(10, function(err, salt) {
                    let uuid = require('uuid').v4();
                    debug("/api/operator/ POST", uuid);
                    bcrypt.hash(uuid, salt, function (err, hash) {
                        if (err) return res.status(400).send(err.message);
                        db.createOperator(req.body.login, hash, req.session.passport.user).then((operator) => {
                            /*TODO: отправка письма - приглашения!!!*/
                            debug("/api/operator/ POST", "operator_id", operator.id);
                            db.getUserById(operator.id).then((user) => {
                                sendRegOperatorLink(user, data, process.env.DOMAIN)
                                res.send("OK");
                            }).catch(err => res.status(400).send(err.message))

                        }).catch((err) => res.status(400).send(err.message));
                    });
                })
            })
        }
    })
    fs.readFile("./views/form_reg_operator.html", (err, data) => {
        if (err) debug("{reg_operator}", err.message)
        if (data) {
            app.get("/api/operator/:id/:token", (req, res) => {
                debug("/api/operator/:id/:token GET", JSON.stringify(req.body));
                db.getUserById(req.params.id).then((user) => {
                    const payload = jwt.decode(req.params.token, user.pass + "-" + user.created.getTime());
                    let html = data.toString().replace("%%DOMAIN%%", process.env.DOMAIN);
                    html = html.replace("%%ID%%", req.params.id);
                    html = html.replace("%%TOKEN%%", req.params.token);
                    res.send(html);
                }).catch(err => res.status(400).send(err.message))
            })
        }
    })
    app.post('/api/operator/create', function(req, res) {
        db.getUserById(req.body.id).then((user) => {
                const payload = jwt.decode(req.body.token, user.pass + "-" + user.created.getTime());
                console.log("req.body.id = " + req.body.id);
                console.log("req.body.password = " + req.body.password);
                bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(req.body.password, salt, function (err, hash) {
                        if (err) return res.status(400).send(err.message);
                        db.updateUserNamePassword(req.body.id, req.body.name, hash).then(() =>
                            res.send('<h1>Your register has been successfully</h1>')
                        ).catch((err) => res.status(400).send(err.message))
                    });
                })
            }
        ).catch((err) => res.status(400).send(err.message));

    });
}
