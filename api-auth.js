const db = require('./queries');
const nodemailer = require('nodemailer');
const jwt = require('jwt-simple');
const bcrypt = require('bcryptjs');

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
                res.send(user);
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
                    }).catch((err) => res.send(err.toString()))
                }).catch((err) => res.send(err.toString()));
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
        var transporter = nodemailer.createTransport({
            host: process.env.MAILGUN_SMTP_SERVER,
            auth: {
                user: process.env.MAILGUN_SMTP_LOGIN,
                pass: process.env.MAILGUN_SMTP_PASSWORD
            }
        });

        var mailOptions = {
            from: process.env.MAILGUN_SMTP_LOGIN,
            to: payload.email,
            subject: 'sitepower.io: Password Reset',
            text: "<h1>Welcome</h1><p>" + "http://" + process.env.DOMAIN + "/api/resetpassword/" + payload.id + "/" + token + "</p>"
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    };

    app.get('/api/resetpassword/:id/:token', function(req, res) {
        db.getUserById(req.params.id).then((user) => {
            const payload = jwt.decode(req.params.token, user.pass + "-" + user.created.getTime());
            res.send('<form action="http://' + process.env.DOMAIN + '/api/resetpassword" method="POST">' +
                '<input type="hidden" name="id" value="' + payload.id + '" />' +
                '<input type="hidden" name="token" value="' + req.params.token + '" />' +
                '<input type="password" name="password" value="" placeholder="Enter your new password..." />' +
                '<input type="submit" value="Reset Password" />' +
                '</form>');
        }).catch((err) => res.send(err.toString()))


    });
    app.post('/api/resetpassword', function(req, res) {
        db.getUserById(req.body.id).then((user) => {
                const payload = jwt.decode(req.body.token, user.pass + "-" + user.created.getTime());
                console.log("req.body.id = " + req.body.id);
                console.log("req.body.password = " + req.body.password);
                bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(req.body.password, salt, function (err, hash) {
                        if (err) return next(err);
                        db.updateUserPassword(req.body.id, hash).then(
                            res.send('<h1>Your password has been successfully changed</h1>')
                        ).catch(err => err)
                    });
                })
            }
        ).catch((err) => res.send(err.toString()));

    });

    app.post("/api/reset", (req, res) => {
        //db.getUserById(req.session.passport.user).then(user => res.send({ user: user }));
        console.log("reset");
        if (req.body.email) {
            const email = req.body.email;
            db.getUserByLogin(email).then(
                (user) => sendResetLink(user).then(res.send("OK")).catch((err) => res.send(err.toString()))
            ).catch((err) => res.send(err.toString()));
        } else {
            throw "Email address is missing";
        }
    })
}
