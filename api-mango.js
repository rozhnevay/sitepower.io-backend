const debug = require('debug')('sitepower.io-backend:api-bitrix');
const nodemailer = require('nodemailer');
const db = require('./queries');

module.exports = function (app) {

    const save = (req) => {
        db.createRequestLog(JSON.stringify(req));
    }

    app.post("/api/mango/events/call", (req, res) => {
        console.log("!!! CALL !!!");``
        console.log(req.body);
        res.send("OK");
    });

    app.post("/api/mango/events/summary", (req, res) => {
        console.log("!!! SUMMARY !!!");``
        console.log(req.body);
        res.send("OK");
    });

    app.post("/api/mango/events/recording", (req, res) => {
        console.log("!!! RECORDING !!!");``
        console.log(req.body);
        res.send("OK");
    });
}
