const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-chat');
const moment = require('moment');
const fs = require('fs');
const nodemailer = require('nodemailer');

module.exports = function (app, authMiddleware) {
    /*app.get("/api/chats", authMiddleware, (req, res) => {
        debug("/api/chats");
        db.getChatsByUserId(req.session.passport.user).then(chats => {
            responseChats = [];
            let cnt = 0;
            for (let i = 0, l = chats.length; i < l; i++) {
                let chat = chats[i];
                mongodb.db("sitepower").collection("chats").findOne({_id:chat.sitepower_id}, (err, result) => {
                    if (err) debug("/api/chats", "ERROR", err.message);
                    let responseChat = {}
                    responseChat.created = chat.created;
                    responseChat.sitepower_id = chat.sitepower_id;
                    responseChat.class = chat.class;
                    responseChat.login = chat.login;
                    responseChat.phone = chat.phone;
                    responseChat.name = chat.full_name;
                    responseChat.lastOpenDt = chat.last_open_dt;
                    if (result && result.messages && result.messages.length > 0) {
                        responseChat.messages = result.messages;
                    }

                    responseChats.push(responseChat);
                    cnt++;
                    if (cnt === l){
                       res.send(responseChats);
                    }
                });
            }
        }).catch((err) => {
            res.status(400).send("Cannot get chats");
            debug("/api/chats", err.message);
        });
    })
    */
    app.get("/api/chats", authMiddleware, (req, res) => {
        debug("/api/chats");
        let limit = req.query.limit ? req.query.limit : 50;
        let beforeId = req.query.beforeId ? req.query.beforeId : Number.MAX_SAFE_INTEGER;
        debug("/api/chats", limit, beforeId);
        db.getChatsByUserId(req.session.passport.user, limit, beforeId).then(chats => {
            let chatsMap = {};
            chats.forEach(item => chatsMap[item.sitepower_id] = item);
            res.send(chatsMap);
        }).catch((err) => {
            res.status(400).send("Не удается получить список диалогов (" + req.session.passport.user + ")");
            debug(req.session.passport.user, "/api/chats", err.message);
        });
    })
    app.get("/api/chat/:id", authMiddleware, (req, res) => {
        debug("/api/chat GET", req.params.id);
        db.getChatBySpId(req.params.id).then(chat => {
            /*mongodb.db("sitepower").collection("chats").findOne({_id:chat.sitepower_id}, (err, result) => {
                if (err) debug("/api/chats", "ERROR", err.message);
                let responseChat = {}
                responseChat.created = chat.created;
                responseChat.sitepower_id = chat.sitepower_id;
                responseChat.class = chat.class;
                responseChat.login = chat.login;
                responseChat.phone = chat.phone;
                responseChat.name = chat.full_name;
                responseChat.lastOpenDt = chat.last_open_dt;
                if (result && result.messages && result.messages.length > 0) {
                    responseChat.messages = result.messages;
                }
                    res.send(responseChat);
            });*/
            /*let responseChat = {}
            responseChat.created = chat.created;
            responseChat.sitepower_id = chat.sitepower_id;
            responseChat.class = chat.class;
            responseChat.login = chat.login;
            responseChat.phone = chat.phone;
            responseChat.name = chat.full_name;
            res.send(responseChat);*/
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
        debug("/api/chat/:id", req.params.id);


        /*mongoPromise(req.params.id).then(function(result) {
            res.header("Access-Control-Allow-Origin", req.headers.origin);
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.send(result)
            debug("/api/chat/:id", req.params.id, JSON.stringify(result));
        }).catch(err => {
            res.status(400).send("Cannot get chat for " + req.params.id);
            debug("/api/chat/:id", req.params.id, err.message);
        });*/
        return {};

    })
    /* TODO!!! Продумать проверку на Origin и ограничение на кол-во запросов в день (не больше тысчяи)*/
    app.get("/api/prospect/:id", (req, res) => {
        debug("/api/prospect/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        db.getFormBySpId(req.params.id).then(qres =>
            db.getUserById(qres.user_id).then(
                user => db.createProspect(user.id, getName()).then(
                    prospect => {
                        debug("/api/prospect/:id", JSON.stringify(prospect));
                        res.send({sitepower_id: prospect.sitepower_id})
                    }
                ).catch(err => new Error(err))
            ).catch(err => new Error(err))
        ).catch(err => {
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
                                    let email = req.session.passport.user.login;
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

    function getName(){
        var adjs = ["осенний", "скрытый", "горький", "туманный", "тихий", "пустой", "сухой","темный", "летний", "ледяной", "нежный", "тихий", "белый", "прохладный", "весенний","зимний", "сумеречный", "рассветный", "малиновый", "тоненький","выветрившийся","синий", "вздымающийся", "сломанный", "холодный", "влажный", "падающий", "морозный", "зеленый", "длинный", "поздний", "затяжной", "жирный", "маленький", "утренний", "грязный", "старый",  "красный", "грубый", "неподвижный", "маленький", "сверкающий", "пульсирующий", "застенчивый", "блуждающий", "увядший", "дикий", "черный", "молодой", "святой", "одинокий","ароматный", "выдержанный", "снежный", "гордый", "цветочный", "беспокойный", "божественный","полированный", "древний", "фиолетовый", "живой", "безымянный"]

            , nouns = ["водопад", "ветер", "дождь", "снег", "закат", "лист", "рассвет", "блеск", "лес", "холм", "облако", "луг", "солнце","ручеек", "куст", "огонь", "цветок", "светлячок", "перо", "пруд","звук", "прибой",  "гром", "цветок","резонанс","лес", "туман", "мороз", "голос","дым"];

        return jsUcfirst(adjs[Math.floor(Math.random()*(adjs.length-1))])+" "+jsUcfirst(nouns[Math.floor(Math.random()*(nouns.length-1))]);
    }
    function jsUcfirst(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const sendChat = (html, email) => {
        const transporter = nodemailer.createTransport({
            host: process.env.MAILGUN_SMTP_SERVER,
            auth: {
                user: process.env.MAILGUN_SMTP_LOGIN,
                pass: process.env.MAILGUN_SMTP_PASSWORD
            }
        });
        const mailOptions = {
            from: process.env.MAILGUN_SMTP_LOGIN,
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
