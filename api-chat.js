const axios = require('axios');
const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-chat');
const moment = require('moment');
const fs = require('fs');
const nodemailer = require('nodemailer');

module.exports = function (app, authMiddleware) {
    app.get("/api/chats", authMiddleware, (req, res) => {
        debug("/api/chats");
        let limit = req.query.limit ? req.query.limit : 50;
        let beforeId = req.query.beforeId ? req.query.beforeId : Number.MAX_SAFE_INTEGER;
        debug("/api/chats", limit, beforeId);

        let mainUserId = req.user.parent ? req.user.parent : req.user.id;

        db.getChatsByUserId(mainUserId, limit, beforeId).then(chats => {
            let chatsObj = {meta : {}, chats: {}};
            chats.forEach((item, index) => {
                chatsObj.chats[item.sitepower_id] = item;
                if (!chats[index + 1]) {
                    chatsObj.meta.lastId = item.last_msg_id;
                }
            });
            res.send(chatsObj);
        }).catch((err) => {
            res.status(400).send("Не удается получить список диалогов (" + req.session.passport.user + ")");
            debug(req.session.passport.user, "/api/chats", err.message);
        });
    })
    app.get("/api/chat/:id", authMiddleware, (req, res) => {
        debug("/api/chat GET", req.params.id);
        db.getChatBySpId(req.params.id).then(chat => {
            return db.getMessagesByChatId(chat.sitepower_id).then(chats => res.send(chats)).catch((err) => {return new Error(err)});
        }).catch((err) => {
            res.status(400).send("Cannot get chats");
            debug("/api/chats", err.message);
        });
    })
/*
    let mongoPromise = (id) => {
        return new Promise((resolve, reject) => {
            mongodb.db("sitepower").collection("chats").findOne({_id:id}, (err, result) => {
                err ? reject(err) : resolve(result)
            })
        })
    };
*/


    app.post("/api/chat/:id", authMiddleware, (req, res) => {
        debug("/api/chat/:id POST", req.params.id, JSON.stringify(req.body));
        if (req.body.lastOpenDt) {
            debug("/api/chat/:id POST", req.body.lastOpenDt);
            db.updateLastOpen(req.params.id, req.body.lastOpenDt).then(() => res.send("OK")).catch(err => res.status(400).send("Cannot set data"));
        }
        if (req.body.class) {
            debug("/api/chat/:id POST", req.body.class);
            db.updateClass(req.params.id, req.body.class).then(() => res.send("OK")).catch(err => res.status(400).send("Cannot set data"));
        }

    })
    app.post("/api/chat/:id/contact", authMiddleware, (req, res) => {
        db.updateContact(req.params.id, req.body.name, req.body.login, req.body.phone).then(() => res.send("OK")).catch(err => res.status(400).send("Cannot set data"));
    })

    app.get("/api/prospect/chat/:id", (req, res) => {
        debug("/api/prospect/chat/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        db.getMessagesByChatId(req.params.id).then(chats => res.send(chats)).catch((err) => {res.status(400).send("Error on getting chats")});

    })

    /*app.post("/api/prospect/geo/:id", (req, res) => {
        debug("/api/prospect/geo/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        db.setRegionByChatId(req.params.id, req.body.region).then(() => res.send("OK")).catch((err) => {res.status(400).send("Error on settin region")});

    })*/
    app.post("/api/prospect/get/:id", (req, res) => {
        debug("/api/prospect/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        return db.getFormBySpId(req.params.id).then(qres => {
            debug("/api/prospect/:id/:prospect_id", qres)

            return db.getUserById(qres.user_id)
                .then(
                    user => {

                        return db.getChatBySpId(req.body.prospect_id)
                            .then(prospect => {
                                debug("/api/prospect/:id", JSON.stringify(prospect));
                                res.send({sitepower_id: prospect.sitepower_id})
                            })
                            .catch(err => {


                                return db.createProspect(user.id, getName(qres.test), qres.id)
                                    .then(prospect => {
                                        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                                        debug("/api/prospect/:id", "setRegionByChatId", ip);
                                        axios.get('http://free.ipwhois.io/json/' + ip)
                                            .then(result => {
                                                debug("/api/prospect/:id", "setRegionByChatId", result.data);
                                                if (result.data && result.data.region && result.data.city) {
                                                    let region = result.data.region === result.data.city ? result.data.city : result.data.region + ", " + result.data.city;
                                                    debug("/api/prospect/:id", "setRegionByChatId", "qqq", prospect.sitepower_id, region);
                                                    db.setRegionByChatId(prospect.sitepower_id, region).then().catch((err) => {
                                                        debug("/api/prospect/:id", "{ERROR}", "setRegionByChatId", req.params.id, req.body.prospect_id, err.message);
                                                    });
                                                }
                                            })
                                            .catch(err => {
                                                debug("/api/prospect/:id", "{ERROR}", "http://free.ipwhois.io/json/", req.params.id, req.body.prospect_id, err.message);
                                            })

                                        debug("/api/prospect/:id", JSON.stringify(prospect));
                                        res.send({sitepower_id: prospect.sitepower_id})
                                    })
                                    .catch(err => {
                                        res.status(400).send("Cannot get prospect sitepower_id for " + req.params.id);
                                        debug("/api/prospect/:id", "{ERROR}", "createProspect", req.params.id, req.body.prospect_id, err.message);
                                    })
                            })
                    })
                .catch(err => {
                    res.status(400).send("Cannot get prospect sitepower_id for " + req.params.id);
                    debug("/api/prospect/:id", "{ERROR}", "getUserById", req.params.id, req.body.prospect_id, err.message);
                })
        }).catch(err => {
            res.status(400).send("Cannot get prospect sitepower_id for " + req.params.id);
            debug("/api/prospect/:id", "{ERROR}", "getFormBySpId", req.params.id, req.body.prospect_id, err.message);
        })
    })



    app.get("/api/prospect/form/:id", (req, res) => {
        debug("/api/prospect/form/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        db.getFormBySpId(req.params.id).then(qres => {
                            res.send({label:qres.label, color:qres.color, gradient: qres.gradient, message_placeholder: qres.message_placeholder})
        }).catch(err => {
            res.status(400).send("Cannot get prospect sitepower_id for " + req.params.id);
            debug("/api/prospect/:id", req.params.id, err.message);
        })
    })



    fs.readFile("./views/mail_chat.html", (err, data) => {
        if (err) debug("/api/chat/:id/send", err.message)
        if (data) {
            app.get("/api/chat/:id/send", authMiddleware, (req, res) => {
                debug("/api/chat/:id/send", req.params.id)
                db.getMessagesByChatId(req.params.id).then(messages => {
                    return db.getChatBySpId(req.params.id).then(chat => {
                        return db.getUserById(req.session.passport.user).then(
                            (user) => {
                                try {
                                    let messagesHtml = "";
                                    messages.forEach(item => {
                                        let type = item.direction === "from_user" ? "admin" : "client";
                                        let body = item.body;
                                        let time = moment(item.created).format("HH:mm:ss");
                                        messagesHtml += `
                                        <div class="${type} text-left">
                                            <span class="msg">${body}</span>
                                            <span class="time">${time}</span>
                                        </div>
                                    `;
                                    })
                                    let html = data.toString().replace("%%MESSAGES%%", messagesHtml);
                                    html = html.replace("%%PROSPECT_NAME%%", chat.full_name);
                                    html = html.replace("%%PROSPECT_REGION%%", "");
                                    html = html.replace("%%PROSPECT_PHONE%%", chat.phone ? chat.phone : "");
                                    html = html.replace("%%PROSPECT_EMAIL%%", chat.login ? chat.login : "");
                                    sendChat(html, user.login);
                                    res.send("OK")
                                } catch (e) {
                                    res.status(400).send(e.message)
                                }
                            }
                        ).catch((err) => res.status(400).send(err.message));
                    }).catch((err) => res.status(400).send(err.message));
                }).catch(err => res.status(400).send(err.message));
            })
        }
    })

    function getName(test){
        if (test === "Y") return "Тест Тестович";
        var adjs = ["осенний", "скрытый", "горький", "туманный", "тихий", "пустой", "сухой","темный", "летний", "ледяной", "нежный", "тихий", "белый", "прохладный", "весенний","зимний", "сумеречный", "рассветный", "малиновый", "тоненький","выветрившийся","синий", "вздымающийся", "сломанный", "холодный", "влажный", "падающий", "морозный", "зеленый", "длинный", "поздний", "затяжной", "жирный", "маленький", "утренний", "грязный", "старый",  "красный", "грубый", "неподвижный", "маленький", "сверкающий", "пульсирующий", "застенчивый", "блуждающий", "увядший", "дикий", "черный", "молодой", "святой", "одинокий","ароматный", "выдержанный", "снежный", "гордый", "цветочный", "беспокойный", "божественный","полированный", "древний", "фиолетовый", "живой", "безымянный"]

            , nouns = ["водопад", "ветер", "дождь", "снег", "закат", "лист", "рассвет", "блеск", "лес", "холм", "луг", "ручеек", "куст", "огонь", "цветок", "светлячок", "пруд","звук", "прибой",  "гром", "цветок","резонанс","лес", "туман", "мороз", "голос","дым"];

        return jsUcfirst(adjs[Math.floor(Math.random()*(adjs.length-1))])+" "+jsUcfirst(nouns[Math.floor(Math.random()*(nouns.length-1))]);
    }
    function jsUcfirst(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const sendChat = (html, email) => {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            auth: {
                user: process.env.SMTP_LOGIN,
                pass: process.env.SMTP_PASSWORD
            }
        });
        const mailOptions = {
            from: process.env.SMTP_LOGIN,
            to: email,
            subject: 'sitepower.io: Диалог',
            html:html
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (!error) {
                console.log('Email sent: ' + info.response);
            } else {
                console.log(error);
            }
        });
    };
}
