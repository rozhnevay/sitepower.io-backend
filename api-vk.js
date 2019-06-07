const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-vk');
const axios = require('axios');

module.exports = function (app, authMiddleware) {
    app.get("/api/vk/groups/:token", authMiddleware, (req, res) => {
        debug("/api/vk/groups/:token", req.params.token);
        axios.get("https://api.vk.com/method/groups.get?access_token=" + req.params.token + "&filter=admin&extended=1&v=5.95")
            .then(result => {
                let groups = [];
                result.data.response.items.forEach((item) => {
                    groups.push({id: item.id, name: item.name})
                })
                res.send(groups);
            })
            .catch(err => {
                debug("/api/vk/groups/:token", "{ERROR}", req.params.token, err.message);
                res.status(400).send("Cannot get vk groups for " + req.params.token);
            })
    })

    app.post("/api/vk/group", authMiddleware, (req, res) => {
        debug("/api/vk/group", req.body.id, req.body.name);
        db.getFormVkByGroupId(req.body.id).then(form => {
            if (form.length > 0) {
                res.send("OK");
            } else {
                return db.createFormVk(req.session.passport.user, req.body.name, req.body.id).then(() => {
                    res.send("OK");
                }).catch(err => {
                    res.status(400).send("Cannot create vk form " + req.body.id + " " + req.body.name);
                    debug("/api/vk/group", "{ERROR}", "{CREATE}",  req.body.id, req.body.name, err.message);
                })
            }
        }).catch(err => {
            res.status(400).send("Cannot create vk form " + req.body.id + " " + req.body.name);
            debug("/api/vk/group", "{ERROR}", "{GET}",  req.body.id, req.body.name, err.message);
        })
    })

    app.get("/api/vk/group/:id/:code", authMiddleware, (req, res) => {
        debug("/api/vk/group/:id/:code", req.params.code, req.params.id);
        axios.get("https://oauth.vk.com/access_token?client_id=" + process.env.VK_ID + "&client_secret=" + process.env.VK_SECRET + "&redirect_uri=https://app.sitepower.io/private/vk&code=" + req.params.code)
            .then(result => {
                let token = result.data["access_token_" + req.params.id];
                db.updateFormVkToken(req.params.id, token).then(() => {
                    axios.get("https://api.vk.com/method/groups.getCallbackConfirmationCode?group_id=" + req.params.id + "&access_token="+token + "&v=5.95")
                        .then(result => {
                            db.updateFormVkConfirm(req.params.id, result.data.response.code).then(() => {
                                axios.get("https://api.vk.com/method/groups.addCallbackServer?group_id=" + req.params.id + "&url=https://ws.sitepower.io/api/vk/message&title=Sitepower&access_token="+token + "&v=5.95")
                                    .then(result => {
                                        res.send("OK");
                                    })
                                    .catch(err => {
                                        debug("/api/vk/group/:id/:code", "{ERROR}", req.params.code, err.message);
                                        res.status(400).send("Cannot get vk manage for " + req.params.code);
                                    })
                            }).catch(err => {
                                debug("/api/vk/group/:id/:code", "{ERROR}", req.params.code, err.message);
                                res.status(400).send("Cannot get vk manage for " + req.params.code);
                            })
                        })
                        .catch(err => {
                            debug("/api/vk/group/:id/:code", "{ERROR}", req.params.code, err.message);
                            res.status(400).send("Cannot get vk manage for " + req.params.code);
                        })
                }).catch(err => {
                    debug("/api/vk/group/:id/:code", "{ERROR}", req.params.code, err.message);
                    res.status(400).send("Cannot get vk manage for " + req.params.code);
                })
            })
            .catch(err => {
                debug("/api/vk/group/:id/:code", "{ERROR}", req.params.code, err.message);
                res.status(400).send("Cannot get vk manage for " + req.params.code);
            })
    })

    app.post("/api/vk/message", (req, res) => {
        debug("/api/vk/message", req.body);
        if (req.body.type === "confirmation") {
            return db.getFormVkByGroupId(req.body.group_id).then(dat => {
                debug("/api/vk/message", "{COOL}", dat);
                res.send(dat[0].vk_confirm);
            }).catch(err => {
                debug("/api/vk/message", "{ERROR}", req.body.group_id, err.message);
                res.status(400).send("Cannot get confirmation");
            })
        } else {
            res.send("OK");
        }
    })
    //
    // app.get("/api/vk/token/:code/:name/:id", (req, res) => {
    //     debug("/api/vk/token/:code/:name/:id", req.params.code, req.params.name, req.params.id);
    //     axios.get("https://oauth.vk.com/access_token?client_id=7003708&client_secret=f8101ae3f8101ae3f8101ae35ff87ac4dfff810f8101ae3a4e05a94ac3c0557625f9d93&redirect_uri=https://app.sitepower.io/private/vk&code=" + req.params.code)
    //         .then(result => {
    //             /*save token*/
    //             /*add callback*/
    //             let token = result.data["access_token_" + req.params.id];
    //             db.createFormVk(req.session.passport.user, req.params.name, req.params.id, token).then(() => {
    //                 axios.get("https://api.vk.com/method/groups.addCallbackServer?group_id=" + req.params.id + "&url=https://ws.sitepower.io/api/vk/message&title=Sitepower&secret_key="+token)
    //                     .then(result => {
    //                         res.send("OK");
    //                     })
    //                     .catch(err => {
    //                         debug("/api/vk/token/:code/:name/:id", "{ERROR}", req.params.code, err.message);
    //                         res.status(400).send("Cannot get vk groups for " + req.params.token);
    //                     })
    //             })
    //         })
    //         .catch(err => {
    //             debug("/api/vk/token/:code/:name/:id", "{ERROR}", req.params.code, err.message);
    //             res.status(400).send("Cannot get vk manage for " + req.params.code);
    //         })
    // })

}
