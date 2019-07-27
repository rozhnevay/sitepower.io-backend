const axios = require('axios');
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
    });

    app.post("/api/payfatcalc", authMiddleware, (req, res) => {
        debug("/api/payfatcalc", "{BEGIN}");
        if (!req.body.cnt_trains  || parseInt(req.body.amount) < 1 ) {
            debug("/api/payfatcalc", "Incorrect params", "{ERROR}", req.body);
            res.status(400).send("Incorrect params");
            return;
        }
        db.createPayment(req.session.passport.user, req.body.cnt_trains, 0, req.body.amount)
            .then((payment) => {
                // Запрос на создание платежа в Яндекс
                axios.post(process.env.YA_API,
                    {
                        amount: {
                            value: req.body.amount,
                            currency: "RUB"
                        },
                        capture: true,
                        confirmation: {
                            type: "redirect",
                            return_url: "https://app.sitepower.io/private/payments"
                        },
                        description: "Оплата"
                    },
                    {
                        auth: {
                            username:process.env.YA_SHOP_ID,
                            password:process.env.YA_SECRET
                        },
                        headers: {
                            "Idempotence-Key": payment.sitepower_id
                        }
                    }
                ).then(ans => {
                    return db.updatePayment(payment.sitepower_id, ans.data.id, ans.data.status)
                        .then(() => {
                            res.send({url:ans.data.confirmation.confirmation_url})
                        })
                        .catch((err) => {
                            debug("/api/payfatcalc", "updatePayment", "{ERROR}", err.message);
                            res.status(400).send("Cannot create payment");
                        })
                }).catch((err) => {
                    debug("/api/payfatcalc", "YA_API", "{ERROR}", err.message);
                    res.status(400).send("Cannot create payment");
                })
            })
            .catch((err) => {
                debug("/api/payfatcalc", "createPayment", "{ERROR}", err.message);
                res.status(400).send("Cannot create payment");
            })
    })
}
