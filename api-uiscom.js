const debug = require('debug')('sitepower.io-backend:api-uiscom');
const db = require('./queries');

module.exports = function (app) {

    const save = (req) => {
        db.createRequestLog(JSON.stringify(req));
    }

    app.post("/api/uiscom/events/call/waiting", (req, res) => {
        console.log("!!! waiting !!!");
        console.log(req.body);
        res.send("OK");
    });

    app.post("/api/uiscom/events/call/connected", (req, res) => {
        console.log("!!! connected !!!");
        console.log(req.body);
        res.send("OK");
    });

    app.post("/api/uiscom/events/call/disconnected", (req, res) => {
        console.log("!!! disconnected !!!");
        console.log(req.body);
        res.send("OK");
    });

    app.post("/api/uiscom/events/call/missed", (req, res) => {
        console.log("!!! missed !!!");
        console.log(req.body);
        res.send("OK");
    });

}
