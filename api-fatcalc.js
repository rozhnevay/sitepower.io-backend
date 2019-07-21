const db = require('./queries');
const nodemailer = require('nodemailer');
const jwt = require('jwt-simple');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const debug = require('debug')('sitepower.io-backend:api-fatcalc');

module.exports = function (app, authMiddleware) {
    app.get("/api/trains", authMiddleware, (req, res) => {
        debug("/api/trains");
        let limit = req.query.limit ? req.query.limit : 50;
        let beforeId = req.query.beforeId ? req.query.beforeId : Number.MAX_SAFE_INTEGER;
        debug("/api/trains", limit, beforeId);


        /*db.getChatsByUserId(mainUserId, limit, beforeId).then(chats => {
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
        });*/

        db.getTrainsByUserId(req.user.id, limit, beforeId).then(trains => {
            let trainsObj = {meta : {}, trains: []};
            trains.forEach((item, index) => {
                if (!trains[index + 1]) {
                    trainsObj.meta.lastId = item.id;
                }
            });
            trainsObj.trains = trains;

            res.send(trainsObj);
        }).catch((err) => {
            res.status(400).send("Не удается получить список тренировок (" + req.session.passport.user + ")");
            debug(req.session.passport.user, "/api/trains", err.message);
        });
    })
}
