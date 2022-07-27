const debug = require('debug')('sitepower.io-backend:api-uiscom');
const db = require('./queries');

module.exports = function (app) {

    const save = (req) => {
        db.createRequestLog(JSON.stringify(req));
    }

    app.post("/api/mango/events/call/waiting", (req, res) => {
        console.log("!!! waiting !!!");
        console.log(JSON.parse(req.body));
        res.send("OK");
    });

    app.post("/api/mango/events/call/connected", (req, res) => {
        console.log("!!! connected !!!");
        console.log(JSON.parse(req.body));
        res.send("OK");
    });

    app.post("/api/mango/events/call/disconnected", (req, res) => {
        console.log("!!! disconnected !!!");
        console.log(JSON.parse(req.body));
        res.send("OK");
    });

    app.post("/api/mango/events/call/missed", (req, res) => {
        console.log("!!! missed !!!");
        console.log(JSON.parse(req.body));
        res.send("OK");
    });

}
