const ipRangeCheck = require("ip-range-check");
const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-pay');
const axios = require('axios');

module.exports = function (app, authMiddleware) {
    app.post("/api/pay", authMiddleware, (req, res) => {
        debug("/api/pay", "{BEGIN}");
        if (!req.body.cnt_operators || !req.body.cnt_days || !req.body.amount || parseInt(req.body.amount) < 1 ) {
            debug("/api/pay", "Incorrect params", "{ERROR}", req.body);
            res.status(400).send("Incorrect params");
            return;
        }
        db.createPayment(req.session.passport.user, req.body.cnt_operators, req.body.cnt_days, req.body.amount)
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
                        description: "Оплата лицензий Sitepower"
                    },
                    {
                        auth: {
                            username:604823,
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
                                debug("/api/pay", "updatePayment", "{ERROR}", err.message);
                                res.status(400).send("Cannot create payment");
                            })
                    }).catch((err) => {
                    debug("/api/pay", "YA_API", "{ERROR}", err.message);
                    res.status(400).send("Cannot create payment");
                })
            })
            .catch((err) => {
                debug("/api/pay", "createPayment", "{ERROR}", err.message);
                res.status(400).send("Cannot create payment");
            })
    })

    app.post("/api/payment", (req, res) => {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
        debug("/api/payment", "ip", ip);
        if (
            !ipRangeCheck(ip, "185.71.76.0/27")||
            !ipRangeCheck(ip, "185.71.77.0/27")||
            !ipRangeCheck(ip, "77.75.153.0/25")||
            !ipRangeCheck(ip, "77.75.154.128/25")||
            !ipRangeCheck(ip, "2a02:5180:0:1509::/64")||
            !ipRangeCheck(ip, "2a02:5180:0:2655::/64")||
            !ipRangeCheck(ip, "2a02:5180:0:1533::/64")||
            !ipRangeCheck(ip, "2a02:5180:0:2669::/64")
        ) {
            res.status(400).send("IP not in list!");
            return;
        }
        debug("/api/payment", "IP OK!!!");

        return db.updatePaymentByYaId(req.body.object.id, req.body.object.status)
            .then(() => {
                if (!req.body.object.paid) {
                    res.send("OK");
                    return;
                }
                return db.getPaymentByYaId(req.body.object.id)
                    .then((payment) => {
                        const daysInc = parseInt(payment.cnt_days)*parseInt(payment.cnt_operators);
                        return db.incrementDaysAmount(payment.user_id, daysInc)
                                .then(() => {
                                    res.send("OK");
                                })
                                .catch((err) => {
                                    debug("/api/payment", "incrementDaysAmount", "{ERROR}", err.message);
                                    res.status(400).send("Cannot handle payment");
                                })
                    })
                    .catch((err) => {
                        debug("/api/payment", "getPaymentByYaId", "{ERROR}", err.message);
                        res.status(400).send("Cannot handle payment");
                    })
            })
            .catch((err) => {
                debug("/api/payment", "updatePaymentByYaId", "{ERROR}", err.message);
                res.status(400).send("Cannot handle payment");
            })
    })

}


