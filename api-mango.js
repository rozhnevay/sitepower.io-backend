const debug = require('debug')('sitepower.io-backend:api-bitrix');
const nodemailer = require('nodemailer');
const db = require('./queries');

module.exports = function (app) {

    const save = (req) => {
        db.createRequestLog(JSON.stringify(req));
    }

    app.post("/api/mango/events/call", (req, res) => {
        save(req.body);
        res.send("OK");
    });

    app.post("/api/mango/events/summary", (req, res) => {
        save(req.body);
        res.send("OK");
    });
}
