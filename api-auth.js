const db = require('./queries');
const nodemailer = require('nodemailer');
const jwt = require('jwt-simple');
const bcrypt = require('bcryptjs');
const fs = require('fs');

module.exports = function (app, authMiddleware, passport) {

    app.post("/api/login", (req, res, next) => {
        passport.authenticate("local", (err, user, info) => {
            if (err) {
                return next(err);
            }

            if (!user) {
                return res.status(400).send([user, "Cannot log in", info]);
            }

            req.login(user, err => {
                res.send({id: user.id, login: user.login, name: user.name, created: user.created, sitepower_id: user.sitepower_id});
            });

        })(req, res, next);
    });

    app.get("/api/logout", function(req, res) {
        req.logout();

        console.log("logged out")

        return res.send();
    });

    app.get("/api/user", authMiddleware, (req, res) => {
        db.getUserById(req.session.passport.user).then(user => res.send({ user: {id: user.id, login: user.login, name: user.name, created: user.created, sitepower_id: user.sitepower_id} }));
    })

    app.post('/api/register', function(req, res, next) {
        bcrypt.genSalt(10, function(err, salt) {
            if (err) return next(err);
            bcrypt.hash(req.body.password, salt, function(err, hash) {
                if (err) return next(err);
                db.createUser(req.body.email, hash, req.body.name).then((data) => {
                    db.getUserById(data.id).then((user) => {
                        req.login(user, err => res.send(user));
                    }).catch((err) => res.status(400).send(err.toString()))
                }).catch((err) => res.status(400).send(err.toString()));
            });
        });
    });


    const sendResetLink = user => {
        const payload = {
            id: user.id,
            email: user.login
        }
        const secret = user.pass + "-" + user.created.getTime();
        const token = jwt.encode(payload, secret);
        const transporter = nodemailer.createTransport({
            host: process.env.MAILGUN_SMTP_SERVER,
            auth: {
                user: process.env.MAILGUN_SMTP_LOGIN,
                pass: process.env.MAILGUN_SMTP_PASSWORD
            }
        });
        let lnk = "http://" + process.env.DOMAIN + "/api/resetpassword/" + payload.id + "/" + token;
        let logo = "http://" + process.env.DOMAIN + "/static/logo-black.svg";
        const mailOptions = {
            from: process.env.MAILGUN_SMTP_LOGIN,
            to: payload.email,
            subject: 'sitepower.io: Password Reset',
            html:`
                <center>
                <div style="border-radius:10px 10px 0px 0px;background-color:black;width:600px;margin-top:30px">
                        <img src="${logo}" width=\'301px\' style=\'margin-top:51px;\'>
                        <p style="font-size:18px;color:white;padding-bottom: 65px;font-weight: bold;margin: 0;">Восстановление пароля</p>
                    </div>
                    <div style="background:white;box-shadow: 0px 0px 6px 0px rgba(0,0,0,0.16);width:600px;padding-bottom: 60px;">
                        <p class="text">Здравствуйте, ${user.name}.  Используйте ссылку ниже для установки нового пароля. Если вы не запрашивали смену пароля, проигнорируйте данное сообщение.</p>
                        <a href="${lnk}">${lnk}</a>
                    </div>
                </center>
                `
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    };

    fs.readFile("./views/new_pass_form.html", (err, data) => {
        if (err) {
            debug("/api/resetpassword/:id/:token", err.message)
            return;
        }
        if (data) {
            app.get("/api/resetpassword/:id/:token", (req, res) => {
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

    fs.readFile("./views/reset_ok.html", (err, data) => {
        if (err) {
            debug("/api/resetpassword", err.message)
            return;
        }
        if (data) {
            app.post('/api/resetpassword', function(req, res) {
                db.getUserById(req.body.id).then((user) => {
                        const payload = jwt.decode(req.body.token, user.pass + "-" + user.created.getTime());
                        bcrypt.genSalt(10, function(err, salt) {
                            bcrypt.hash(req.body.password, salt, function (err, hash) {
                                if (err) {
                                    debug("/api/resetpassword", err.message)
                                    return;
                                }
                                db.updateUserPassword(req.body.id, hash).then(() => {
                                        let html = data.toString().replace("%%DOMAIN%%", process.env.DOMAIN);
                                        res.send(html)
                                }).catch(err => res.status(400).send(err.toString()))
                            });
                        })
                    }
                ).catch((err) => res.status(400).send(err.toString()));

            });
            // app.get("/api/resetpassword/:id/:token", (req, res) => {
            //     db.getUserById(req.params.id).then((user) => {
            //         const payload = jwt.decode(req.params.token, user.pass + "-" + user.created.getTime());
            //         let html = data.toString().replace("%%DOMAIN%%", process.env.DOMAIN);
            //         html = html.replace("%%ID%%", req.params.id);
            //         html = html.replace("%%TOKEN%%", req.params.token);
            //         res.send(html);
            //     }).catch(err => res.status(400).send(err.message))
            // })
        }
    })




    app.post("/api/reset", (req, res) => {
        //db.getUserById(req.session.passport.user).then(user => res.send({ user: user }));
        console.log("reset");
        if (req.body.email) {
            const email = req.body.email;
            db.getUserByLogin(email).then(
                (user) => {
                    sendResetLink(user)
                    res.send("OK")
                }
            ).catch((err) => res.status(400).send(err.toString()));
        } else {
            throw "Email address is missing";
        }
    })
}
