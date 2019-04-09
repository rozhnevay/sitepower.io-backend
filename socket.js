const db = require('./queries');
const http = require('http');
const passportSocketIo = require("passport.socketio");

const debug = require('debug')('sitepower.io-backend:socket');
const moment = require('moment');
const redis = require('redis');



module.exports = function (app, session, passport, mongodb) {
    var server = http.createServer();
    server.listen(3031);
    server.on('listening', onListening);
    function onListening() {
        var addr = server.address();
        var bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        debug('Listening Socket on ' + bind);
    }
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
    io.on('connect', function (socket) {
        let connection = {
            prospectSpId    : socket.handshake.query.sitepower_id,
            userSpId        : socket.request.user.sitepower_id,
            origin          : socket.handshake.headers.origin,
            formattedOrigin : extractHostname(socket.handshake.headers.origin),
            chatId          : socket.client.id
        }
        let scon = JSON.stringify(connection);
        debug("{CONNECT START Auth}", scon);
        if (connection.prospectSpId) {
            db.getProspectUserBySPId(connection.prospectSpId).then(prospect =>{
                debug("{CONNECT OK getProspectUserBySPId}", scon)
                return db.getUserById(prospect.user_id).then(user => {
                    debug("{CONNECT OK getUserById}", scon)

                    return db.getFormByUserIdOrigin(prospect.user_id, connection.formattedOrigin).then((form) =>{
                        debug("{CONNECT OK getFormByUserIdOrigin}", scon)
                        try {
                            const localTime = moment();
                            const endingDate = moment(user.date_ending);
                            const diff = endingDate.diff(localTime, 'days');
                            if (diff <= 0) {
                                disconnect("Agreement is Ended!");
                            }
                            chatStore.set('chat:'+connection.prospectSpId, JSON.stringify({chat: connection.chatId, type: "prospect", origin:connection.origin, recepient_id: user.sitepower_id, created: moment()}));
                            socket.sitepower_id = connection.prospectSpId;
                            debug("{CONNECT SUCCESS PROSPECT}", scon);
                        } catch (e) {
                            disconnect(e.message);
                        }

                        //prospectChats[socket.handshake.query.sitepower_id] = chatId;
                    }).catch(err => disconnect("Origin not found!"))
                }).catch(err => disconnect("User not found!"))
            }).catch(err => disconnect("Widget not found!"))

        } else if (connection.userSpId) {
            chatStore.set('chat:'+connection.userSpId, JSON.stringify({chat: connection.chatId, type: "user", origin:connection.origin, created: moment().format()}));
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
    });

    io.on('connection', function(socket){
        socket.on('send', function(msg){
            debug("{SEND}", socket.sitepower_id, JSON.stringify(msg));

            chatStore.get("chat:"+socket.sitepower_id, (err, value) => {
                if (err) debug("{SEND ERROR}", err.message);
                if (!value) return;
                let sender = JSON.parse(value);
                let ssender = JSON.stringify(sender);
                let msgSend = {created:moment().format(), body:msg.body, type:msg.type, link:msg.link}; // сообщение для отправки

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
                db.updateLastMessage(prospect_id, msgSend).then(() => {
                    mongodb.db("sitepower").collection("chats").updateOne({ _id: prospect_id }, {$push: {messages: msgSend}/*, $set: {last : msgSend}*/}, { upsert: true });
                }).catch(err => {
                    debug("{SAVE MESSAGE ERROR}", err.message);
                })


                if (senderType === "prospect") {
                    msgSend.sender_id = prospect_id;
                }

                /* 1 - прямой получатель */
                chatStore.get("chat:"+recepient_id, (err, value) => {
                    if (err) debug("{SEND ERROR 2}", err.message);
                    let recepient = JSON.parse(value);
                    if (recepient) {
                        io.to(recepient.chat).emit("receive", msg);
                    }

                })
                /* 2 - себе же */
                debug("{SEND TO SENDER}", ssender, sender.chatId);
                io.to(sender.chat).emit("receive", msg);
            })
        });
        socket.on('disconnect', function () {
            debug("{DISCONNECT}", socket.sitepower_id);
            chatStore.del("chat:"+socket.sitepower_id);
        });
    });
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
