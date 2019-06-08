const db = require('./queries');
const axios = require('axios');
const passportSocketIo = require("passport.socketio");

const debug = require('debug')('sitepower.io-backend:socket');
const moment = require('moment');
const redis = require('redis');



module.exports = function (server, app, session, passport) {
    const redisStore = require('connect-redis') (session);
    const store = new redisStore({url:process.env.REDIS_URL});

    const io = require('socket.io').listen(server,  {resource: '/socket.io'});

    io.use(passportSocketIo.authorize({
        passport:     passport,
        secret:       process.env.SECRET,
        key:          'sitepower.sid.' + process.env.NODE_ENV,       // the name of the cookie where express/connect stores its session_id
        store:        store,
        success:      onAuthorizeSuccess,
        fail:         onAuthorizeFail,
    }));

    function onAuthorizeSuccess(data, accept){
        debug('Successful connection to socket.io [id = ' + data.user.id + ']');
        accept();
    }

    function onAuthorizeFail(data, message, error, accept){
        if (error)
            throw new Error(message);
        debug('Failed connection to socket.io:', message);
        accept();
    }

    function extractHostname(url) {
        let hostname = (url.indexOf("//") > -1)? url.split('/')[2] : url.split('/')[0]
        return hostname.split('?')[0];
    }

    const chatStore = redis.createClient({url:process.env.REDIS_URL});
    chatStore.keys("chat*", function(err, rows) {
        rows.forEach(row => chatStore.del(row));
    });


    io.use((socket, next)=> {
        debug("{CONNECT START Auth GET SESSION ID}");
        if (!socket || !socket.handshake || !socket.handshake.query || !socket.handshake.query.session_id || socket.request.user) {
            return next();
        } else {
            let sval = socket.handshake.query.session_id;
            console.log("sval = " + sval);
        }
        return next();
    });
    io.on('connect', function (socket) {
        debug("{CONNECT START Auth}", socket.handshake.query, socket.handshake.headers);

        let connection = {
            prospectSpId    : socket.handshake.query.sitepower_id,
            userSpId        : socket.request.user.parent_sitepower_id ? socket.request.user.parent_sitepower_id : socket.request.user.sitepower_id,
            origin          : socket.handshake.headers.origin,
            formattedOrigin : socket.handshake.headers.origin ? extractHostname(socket.handshake.headers.origin) : process.env.NODE_ENV === "production" ? "ws.sitepower.io" : "localhost:63342",
            chatId          : socket.client.id,
            deviceId        : socket.handshake.query.device_id
        }
        let scon = JSON.stringify(connection);
        debug("{CONNECT START Auth}", scon);
        if (connection.prospectSpId) {
            db.getProspectUserBySPId(connection.prospectSpId).then(prospect =>{
                debug("{CONNECT OK getProspectUserBySPId}", prospect.user_id, scon)
                return db.getUserById(prospect.user_id).then(user => {
                    debug("{CONNECT OK getUserById}", user.id, connection.formattedOrigin);

                    return db.getFormByUserIdOrigin(user.id, connection.formattedOrigin).then(() =>{
                        debug("{CONNECT OK getFormByUserIdOrigin}", scon)
                        try {
                            /*const localTime = new Date();
                            const endingDate = new Date(user.date_ending);
                            //const diff = endingDate.diff(localTime, 'days');
                            if (endingDate < localTime) {
                                disconnect("Agreement is Ended!");
                            }*/
                            if (user.days_amount < 1) {
                                disconnect("Agreement is Ended!");
                            }
                            chatStore.set('chat:'+connection.prospectSpId, JSON.stringify({chat: [{chatId: connection.chatId}], type: "prospect", origin:connection.origin, recepient_id: user.sitepower_id, created: moment().format(), updated: moment().format()}));
                            socket.sitepower_id = connection.prospectSpId;
                            debug("{CONNECT SUCCESS PROSPECT}", scon);
                        } catch (e) {
                            disconnect(e.message);
                        }
                        //prospectChats[socket.handshake.query.sitepower_id] = chatId;
                    }).catch(err => disconnect("Origin not found! " + err.message))
                }).catch(err => disconnect("User not found! " + err.message))
            }).catch(err => disconnect("Widget not found!"))

        } else if (connection.userSpId) {
            chatStore.get("chat:" + connection.userSpId, (err, value) => {
              let sVal = "";
              if (!value) {
                  sVal = JSON.stringify({chat: [{chatId: connection.chatId, sitepower_id:socket.request.user.sitepower_id, device_id:connection.deviceId, created: moment().format()}], type: "user", origin:connection.origin, created: moment().format(), updated: moment().format()})
              } else {
                  let pval = JSON.parse(value);
                  pval.chat.push({chatId: connection.chatId, sitepower_id:socket.request.user.sitepower_id, device_id:connection.deviceId, created: moment().format()});
                  pval.updated = moment().format();
                  sVal = JSON.stringify(pval);
              }
              chatStore.set('chat:'+connection.userSpId, sVal);
            })
            //chatStore.set('chat:'+connection.userSpId, JSON.stringify({chat: connection.chatId, type: "user", origin:connection.origin, created: moment().format()}));
            socket.sitepower_id = connection.userSpId;
            debug("{CONNECT SUCCESS USER}", scon);
        }

        function disconnect(errmsg) {
            socket.error(errmsg);
            socket.disconnect(true);
            debug("{CONNECT ERROR}", errmsg, scon)
        }
    })
    /* Функция - обработчик сообщения */
    // С фронта приходит:
    // из админки: body, type, link, recepient_id
    // из виджета: body, type, link
    // 1. Берет из сокета наш sitepower_id, идем в Redis определяем кто мы                              +
    // 2. Если мы - user - берет из сообщения recepient_id, идем в Redis и определяем, кому посылаем    +
    // 2. Если мы - prospect - идем в t_prospect, определяем, кому посылаем, идем в Redis за ним        +
    // 3. Если чат не создан - создаем в MongoDB, проставляем ссылку в t_prospect                       +-
    // 4. Пушаем сообщение в MongoDB c параметрами: created, body, type, link, direction                +
    // 5. Если в redis есть пользователь - Делаем ресив, при этом на фронт передаем, дополнительно к метаданным сообщения:
    //  - для USER: sender_id



    io.on('disconnect', socket => {
        debug("{DISCONNECT}", socket.sitepower_id);
        chatStore.del("chat:"+socket.sitepower_id);
        /*chatStore.get("chat:" + socket.sitepower_id, (err, value) => {
            let pval = JSON.parse(value);
        });*/
    });

    io.on('connection', function(socket){
        socket.on('send', function(msg){
            debug("{SEND}", socket.sitepower_id, JSON.stringify(msg));
            chatStore.get("chat:" + socket.sitepower_id, (err, value) => {
                if (err) debug("{SEND ERROR}", err.message);
                if (!value) return;
                /* Параметры сообщения */
                let msg_body = msg.body; //тело сообщения
                let msg_type = msg.type; // тип сообщения (текст, ссылка)
                let msg_link = msg.link; // url вложения
                let msg_direction = "";       // направление
                //let msg_recepient_sp_id;       // получатель сообщения (sitepower_id): если мы - user, то берется из сообщения, если мы - prospect - берется из Redis, записывается при connect
                let msg_prospect_id;
                let msg_operator_id;    //socket.request.user


                let sender = JSON.parse(value);
                let senderType = sender.type;
                debug("{SEND}", value);
                let msgSend = {body: msg.body, type: msg.type, link: msg.link, recepient_id: msg.recepient_id};

                if (senderType === "user") {
                    msg_direction = "from_user";
                    msg_prospect_id = msg.recepient_id;
                    msg_operator_id = socket.request.user.id;
                } else {
                    msg_direction = "to_user";
                    msg_prospect_id = socket.sitepower_id
                }
                db.getChatBySpId(msg_prospect_id).then(prospect =>{
                    msg_prospect_id = prospect.id;
                    return db.createMessage(msg_prospect_id, msg_body, msg_type, msg_link, msg_operator_id, msg_direction).then(res => {
                        return db.getMessageById(res.id).then(msg => {
                            return db.updateLastMessageOperator(msg_prospect_id, msg.id, msg_direction, msg_operator_id).then(() => {
                                return db.setCountUnanswered(msg_prospect_id, msg_direction).then(() => {
                                    // посылаем обновленный чат и message
                                    return db.getChatById(msg_prospect_id).then(chat => {
                                        // 1 - прямой получатель
                                        debug("{SEND TO RECEPIENT}", sender, msg.recepient_id);
                                        chatStore.get("chat:" + msg.recepient_id, (err, value) => {
                                            if (err) debug("{SEND ERROR 2}", err.message);
                                            let recepient = JSON.parse(value);
                                            if (recepient) {
                                                recepient.chat.forEach(item => io.to(item.chatId).emit("receive", {chat: chat, msg: msg}))
                                            }   // посылаем актуальное состояние чата


                                        })
                                        // 2 - себе же
                                        debug("{SEND TO SENDER}", sender.chat);
                                        //io.to(sender.chat).emit("receive", {chat: chat, msg: msg});
                                        sender.chat.forEach(item => {
                                            console.log("item = " + item);
                                            io.to(item.chatId).emit("receive", {chat: chat, msg: msg})
                                        })
                                        // 3 - на свои девайсы
                                        if (msg_direction === "to_user") {
                                            return db.getUserDevices(prospect.user_id).then(devices => {
                                                devices.map(device => device.online = false);
                                                chatStore.get("chat:" + msg.recepient_id, (err, value) => {
                                                    let recepient = JSON.parse(value);
                                                    /*
                                                    Пока отлкючил
                                                    if (recepient) {
                                                        recepient.chat.forEach(item => {
                                                            devices.map(device => {
                                                                if (device.device_id === item.device_id) {
                                                                    device.online = true;
                                                                }
                                                            });
                                                        });
                                                    }
                                                    debug("{DEVICES}", devices);
                                                    */
                                                    devices.filter(item => !item.online).forEach(item => {
                                                    debug("{DEVICE SEND TO}", item.device_id);

                                                    axios.post("https://fcm.googleapis.com/fcm/send",
                                                        {
                                                            notification:
                                                                {
                                                                    id: msg_prospect_id,
                                                                    title: "Онлайн-диалог \"" + prospect.full_name + "\"",
                                                                    text: msgSend.body,
                                                                    badge: 1,
                                                                    sound: "default"
                                                                },
                                                            priority: "High",
                                                            to: item.device_id
                                                        },
                                                        {
                                                            headers: {'Authorization': 'key=' + process.env.GOOGLE_FB_KEY}
                                                        }).then(res => {
                                                        debug("{DEVICES - GOOGLE OK}", res.data.results)
                                                        if (res.data.results[0].error && (res.data.results[0].error === "NotRegistered" || res.data.results[0].error === "InvalidRegistration")){
                                                            db.deleteDeviceToken(item.device_id).then(() => {
                                                                debug("{DEVICES - DELETED TOKEN}", item.device_id)
                                                            }).catch(err => {
                                                                debug("{DEVICES - CANNOT DELETE TOKEN}", item.device_id, err.message);
                                                            })
                                                        }

                                                    })
                                                        .catch(err => debug("{DEVICES - GOOGLE ERROR}", err))
                                                });
                                                })
                                            })
                                        }
                                        // вконтактик
                                        if (prospect.vk_from_id) {
                                            return db.getFormById(prospect.form_id).then(form => {
                                                axios.get("https://api.vk.com/method/messages.send?user_id=" + prospect.vk_from_id + "&message=" + encodeURIComponent(msg.body) + "&random_id=" + msg.id + "&peer_id=" + prospect.vk_from_id + "&access_token="+ form.vk_token + "&v=5.95").then(result => {
                                                }).catch(err => {
                                                    debug("VK send", "{ERROR}", err.message);
                                                })
                                            })
                                        }
                                    }).catch(err => debug("socket", "send", "getChatById", err.message))
                                }).catch(err => debug("socket", "send", "setCountUnanswered", err.message))
                            }).catch(err => debug("socket", "send", "updateLastMessage", err.message));
                        }).catch(err => debug("send error", "getMessageById", err.message))
                    }).catch(err => debug("send error", "createMessage", err.message))
                }).catch(err => debug("send error", "getChatBySpId", err.message))


                //if (!recepient_id) throw Error("Recipient not found!")
                //

            })
            /*db.getMessageId().then(res => {
                chatStore.get("chat:" + socket.sitepower_id, (err, value) => {
                    if (err) debug("{SEND ERROR}", err.message);
                    if (!value) return;
                    let sender = JSON.parse(value);
                    let ssender = JSON.stringify(sender);
                    let msgSend = {
                        id : res.id,
                        created: Date.now(),
                        body: msg.body,
                        type: msg.type,
                        link: msg.link,
                        recepient_id: msg.recepient_id
                    }; // сообщение для отправки

                    let senderType = sender.type;
                    debug("{SEND}", ssender);
                    if (senderType == "user") {
                        let recepient_id = msg.recepient_id;
                        msgSend.direction = "from_user";
                    } else {
                        msgSend.direction = "to_user";
                    }
                    let recepient_id = senderType === "user" ? msg.recepient_id : sender.recepient_id;
                    debug("{SEND TO RECEPIENT}", ssender, recepient_id);
                    if (!recepient_id) throw Error("Recipient not found!")

                    let prospect_id = senderType === "user" ? msg.recepient_id : socket.sitepower_id;

                    mongodb.db("sitepower").collection("chats").updateOne({_id: prospect_id}, {$push: {messages: msgSend}}, {upsert: true}).then().catch(err => debug("socket", "send", "updateOne", err.message));
                    debug("socket", msgSend.id);
                    db.updateLastMessage(prospect_id, msgSend, msgSend.id).then().catch(err => debug("socket", "send", "updateLastMessage", err.message));
                    db.incCountUnanswered(prospect_id).then().catch(err => debug("socket", "send", "incCountUnanswered", err.message));

                    if (senderType === "prospect") {
                        msgSend.sender_id = prospect_id;
                    }

                    /!* 1 - прямой получатель *!/
                    chatStore.get("chat:" + recepient_id, (err, value) => {
                        if (err) debug("{SEND ERROR 2}", err.message);
                        let recepient = JSON.parse(value);
                        if (recepient) {
                            io.to(recepient.chat).emit("receive", msgSend);
                        }

                    })
                    /!* 2 - себе же *!/
                    debug("{SEND TO SENDER}", ssender, sender.chatId);
                    io.to(sender.chat).emit("receive", msgSend);
                })
            }).catch(err => debug("send error", err.message))*/
        });
        socket.on('disconnect', function () {
            deleteChatId()
        });
        socket.on('exit', function () {
            socket.disconnect(true);
        });

        const deleteChatId = () => {
            debug("{deleteChatId}", socket.id);
            chatStore.get("chat:" + socket.sitepower_id, (err, value) => {
                let pval = JSON.parse(value);
                let sval = "";
                if (!pval||!pval.chat) return;
                if (pval.chat.length === 1) {
                    chatStore.del("chat:"+socket.sitepower_id);
                } else {
                    /*delete pval.chat[pval.chat.indexOf(socket.id)];*/
                    pval.chat.splice(pval.chat.findIndex(e => e.chatId === socket.id),1);
                    pval.updated = moment().format();
                    sval = JSON.stringify(pval);
                    chatStore.set('chat:'+socket.sitepower_id, sval);
                }
            });
        }
        socket.on('print', function (msg) {
            debug("{PRINT}", socket.sitepower_id);
            chatStore.get("chat:"+socket.sitepower_id, (err, value) => {
                if (err) debug("{PRINT ERROR}", err.message);
                if (!value) return;
                let sender = JSON.parse(value);
                let recepient_id = sender.recepient_id;

                msg.sender_id = socket.sitepower_id;
                msg.created = moment().format();
                chatStore.get("chat:"+recepient_id, (err, value) => {
                    if (err) debug("{PRINT ERROR 2}", err.message);
                    let recepient = JSON.parse(value);


                    if (recepient) {
                        recepient.chat.forEach(item => io.to(item.chatId).emit("print", msg))
                    }
                })
                // своим
                if (!recepient_id) {
                    chatStore.get("chat:"+socket.sitepower_id, (err, value) => {
                        if (err) debug("{PRINT ERROR 3}", err.message);
                        let recepient = JSON.parse(value);


                        if (recepient) {
                            recepient.chat.forEach(item => {
                                if (item.chatId === socket.id) return;
                                io.to(item.chatId).emit("print", msg)
                            })
                        }
                    })
                }
            });
        });

    });
    sendToDevice = (prospect, msg) => {
        return db.getUserDevices(prospect.user_id).then(devices => {
            devices.map(device => device.online = false);
            chatStore.get("chat:" + msg.recepient_id, (err, value) => {
                let recepient = JSON.parse(value);
                devices.filter(item => !item.online).forEach(item => {
                    debug("{DEVICE SEND TO}", item.device_id);

                    axios.post("https://fcm.googleapis.com/fcm/send",
                        {
                            notification:
                                {
                                    id: prospect.id,
                                    title: "Онлайн-диалог \"" + prospect.full_name + "\"",
                                    text: msg.body,
                                    badge: 1,
                                    sound: "default"
                                },
                            priority: "High",
                            to: item.device_id
                        },
                        {
                            headers: {'Authorization': 'key=' + process.env.GOOGLE_FB_KEY}
                        }).then(res => {
                        debug("{DEVICES - GOOGLE OK}", res.data.results)
                        if (res.data.results[0].error && (res.data.results[0].error === "NotRegistered" || res.data.results[0].error === "InvalidRegistration")){
                            db.deleteDeviceToken(item.device_id).then(() => {
                                debug("{DEVICES - DELETED TOKEN}", item.device_id)
                            }).catch(err => {
                                debug("{DEVICES - CANNOT DELETE TOKEN}", item.device_id, err.message);
                            })
                        }

                    })
                        .catch(err => debug("{DEVICES - GOOGLE ERROR}", err))
                });
            })
        })
    }
    sendToUser = (userSpId, chat, msg, prospect) => {
        chatStore.get("chat:" + userSpId, (err, value) => {
            if (err) debug("{SEND ERROR 2}", err.message);
            let recepient = JSON.parse(value);
            if (recepient) {
                recepient.chat.forEach(item => io.to(item.chatId).emit("receive", {chat: chat, msg: msg}))
            }   // посылаем актуальное состояние чата
        })
        sendToDevice(prospect, msg);
        return true;
    }

    getChatSendMessage = (prospect_sp_id, msg_body) => {
        return db.getChatBySpId(prospect_sp_id).then(prospect => {
            let msg_prospect_id = prospect.id;
            return db.createMessage(msg_prospect_id, msg_body, "text", "", null, "to_user").then(res => {
                return db.getMessageById(res.id).then(msg => {
                    return db.updateLastMessageOperator(msg_prospect_id, msg.id, "to_user", null).then(() => {
                        return db.setCountUnanswered(msg_prospect_id, "to_user").then(() => {
                            return db.getChatById(msg_prospect_id).then(chat => {
                                return db.getUserById(prospect.user_id).then(user => {
                                    return sendToUser(user.sitepower_id, chat, msg, prospect);
                                }).catch(err => debug("socket", "send", "getUserById", err.message))
                            }).catch(err => debug("socket", "send", "getChatById", err.message))
                        }).catch(err => debug("socket", "send", "setCountUnanswered", err.message))
                    }).catch(err => debug("socket", "send", "updateLastMessageOperator", err.message))
                }).catch(err => debug("socket", "send", "getMessageById", err.message))
            }).catch(err => debug("socket", "send", "createMessage", err.message))
        }).catch(err => debug("socket", "send", "getChatBySpId", err.message))
    }

    app.post("/api/vk/message", (req, res) => {
        debug("/api/vk/message", req.body);
        if (req.body.type === "confirmation") {
            return db.getFormVkByGroupId(req.body.group_id).then(dat => {
                res.send(dat[0].vk_confirm);
            }).catch(err => {
                debug("/api/vk/message", "{ERROR}", req.body.group_id, err.message);
                res.status(400).send("Cannot get confirmation");
            })
        } else if (req.body.type === "message_new") {
            return db.getFormVkByGroupId(req.body.group_id).then(form => {
                if (form.length > 0) {
                    form = form[0];
                    return db.getVkProspect(req.body.object.from_id, form.id).then(prospect => {
                        if (getChatSendMessage(prospect.sitepower_id, req.body.object.text)) {
                            res.send("OK");
                            return true;
                        }
                    }).catch(err => {
                        axios.get("https://api.vk.com/method/users.get?user_ids=2727146&fields=first_name&access_token="+ form.vk_token + "&v=5.95").then(result => {
                            return db.createVkProspect(form.user_id, req.body.object.from_id, result.data.response[0].first_name + " " + result.data.response[0].last_name, form.id).then(prospect => {
                                if (getChatSendMessage(prospect.sitepower_id, req.body.object.text)) {
                                    res.send("OK");
                                    return true;
                                }
                            }).catch(err => {
                                debug("/api/vk/message", "{ERROR}", "createVkProspect", req.body, err.message);
                            })
                        }).catch(err => {
                            debug("/api/vk/message", "{ERROR}", "createVkProspect", req.body, err.message);
                            res.status(400).send("Cannot get name for");
                        })


                    })
                }
            }).catch(err => {
                res.status(400).send("Cannot create vk form");
                debug("/api/vk/group", "{ERROR}", "{GET}", "getFormVkByGroupId", req.body, err.message);
            })

        } else {
            res.send("OK");
        }
    })
/*
    function updateChat(id, msg) {
        db.getChatBodyBySpId(id).then(
            chat => {
                let chatObj = chat.chat;
                chatObj = chatObj ? chatObj : {};
                chatObj.messages = chatObj.messages ? chatObj.messages : [];
                chatObj.messages.push(msg);
                db.updateProspectChat(id, chatObj).then().catch(err => console.log(err))
            }
        ).catch(err => console.log(err))
    }
   */
}
