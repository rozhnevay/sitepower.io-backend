const db = require('./queries');

module.exports = function (app, authMiddleware) {
    app.get("/api/forms", authMiddleware, (req, res) => {
        db.getFormsByUserId(req.session.passport.user).then(forms => res.send(forms)).catch((err) => res.send(err.toString()));
    })

    app.get("/api/form", authMiddleware, (req, res) => {
        db.getFormsById(req.id).then(form => res.send(form)).catch((err) => res.send(err.toString()));
    })

    app.post("/api/form", authMiddleware, (req, res) => {
        db.createForm(req.session.passport.user, req.body.origin, req.body.form).then(id => res.send(id)).catch((err) => res.send(err.toString()));
    })
}
