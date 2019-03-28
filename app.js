

const publicRoot = 'C:\\Users\\User\\sitepower.io\\dist'

const host = "localhost:8080";
const express = require('express');
const nodemailer = require('nodemailer');

// creating an express instance
const app = express();
const jwt = require('jwt-simple');

const cookieSession = require('cookie-session')
const bodyParser = require('body-parser')
const passport = require('passport')

// getting the local authentication type
const LocalStrategy = require('passport-local').Strategy
const db = require('./queries');
const bcrypt = require('bcryptjs');

app.get("/", (req, res, next) => {
  res.sendFile("index.html", { root: publicRoot })
})

/* [begin] Auth API*/
app.use(express.static(publicRoot))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(cookieSession({
  name: 'account.sitepower.io',
  keys: ['sitepower'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(passport.initialize());
app.use(passport.session());


app.post("/api/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(400).send([user, "Cannot log in", info]);
    }

    req.login(user, err => {
      res.send(user);
    });
  })(req, res, next);
});

app.get("/api/logout", function(req, res) {
  req.logout();

  console.log("logged out")

  return res.send();
});

const authMiddleware = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).send('You are not authenticated')
  } else {
    return next()
  }
}

app.get("/api/user", authMiddleware, (req, res) => {
  db.getUserById(req.session.passport.user).then(user => res.send({ user: user }));
})

passport.use(
    new LocalStrategy(
        {usernameField: "email",passwordField: "password"},
        (username, password, done) => db.getUserByLogin(username).then(user => {
                    bcrypt.compare(password, user.pass, (err, res) => {
                        if (err) return done(null, false, {message: err.toString()})

                        if (res === false)
                            return done(null, false, {message: 'Incorrect username or password'})
                        else
                            return done(null, user);
                    })
                }
            )
            .catch(err => done(null, false, {message: 'Incorrect username or password'}))
    )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => db.getUserById(id).then(user => done(null, user)));

app.post('/api/register', function(req, res, next) {
    bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(req.body.password, salt, function(err, hash) {
        if (err) return next(err);
        db.createUser(req.body.email, hash, req.body.name).then((data) => {
            console.log(data.id);
            db.getUserById(data.id).then((user) => {
                req.login(user, err => res.send(user));
            }).catch((err) => res.send(err.toString()))
        }).catch((err) => res.send(err.toString()));
    });
  });
});
const sendResetLink = user => {
    const payload = {
        id: user.id,
        email: user.login
    }
    const secret = user.pass + "-" + user.created.getTime();
    const token = jwt.encode(payload, secret);
    console.log("http://" + host + "/resetpassword/" + payload.id + "/" + token);
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'sitepower.io@gmail.com',
            pass: 'Qwerty123@'
        }
    });

    var mailOptions = {
        from: 'sitepower.io@gmail.com',
        to: payload.email,
        subject: 'sitepower.io: Password Reset',
        text: "<h1>Welcome</h1><p>" + "http://" + host + "/api/resetpassword/" + payload.id + "/" + token + "</p>"
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};
app.get('/api/resetpassword/:id/:token', function(req, res) {
    db.getUserById(req.params.id).then((user) => {
        const payload = jwt.decode(req.params.token, user.pass + "-" + user.created.getTime());
        res.send('<form action="http://localhost:3000/api/resetpassword" method="POST">' +
            '<input type="hidden" name="id" value="' + payload.id + '" />' +
            '<input type="hidden" name="token" value="' + req.params.token + '" />' +
            '<input type="password" name="password" value="" placeholder="Enter your new password..." />' +
            '<input type="submit" value="Reset Password" />' +
            '</form>');
    }).catch((err) => res.send(err.toString()))


});
app.post('/api/resetpassword', function(req, res) {
    db.getUserById(req.body.id).then((user) => {
            const payload = jwt.decode(req.body.token, user.pass + "-" + user.created.getTime());
            console.log("req.body.id = " + req.body.id);
            console.log("req.body.password = " + req.body.password);
            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(req.body.password, salt, function (err, hash) {
                    if (err) return next(err);
                    db.updateUserPassword(req.body.id, hash).then(
                        res.send('<h1>Your password has been successfully changed</h1>')
                    ).catch(err => err)
                });
            })
        }
    ).catch((err) => res.send(err.toString()));

});

app.post("/api/reset", (req, res) => {
    //db.getUserById(req.session.passport.user).then(user => res.send({ user: user }));
    console.log("reset");
    if (req.body.email) {
        const email = req.body.email;
        db.getUserByLogin(email).then(
                (user) => sendResetLink(user).then(res.send("OK")).catch((err) => res.send(err.toString()))
        ).catch((err) => res.send(err.toString()));
    } else {
        throw "Email address is missing";
    }
})

/* [end] Auth API*/
/* [begin] Forms API*/
app.get("/api/forms", authMiddleware, (req, res) => {
    db.getFormsByUserId(req.session.passport.user).then(forms => res.send(forms)).catch((err) => res.send(err.toString()));
})

app.get("/api/form", authMiddleware, (req, res) => {
    db.getFormsById(req.id).then(form => res.send(form)).catch((err) => res.send(err.toString()));
})

app.post("/api/form", authMiddleware, (req, res) => {
    db.createForm(req.session.passport.user, req.body.origin, req.body.form).then(id => res.send(id)).catch((err) => res.send(err.toString()));
})
/* [end] Forms API*/

//app.listen(3000, () => console.log("App listening on port 3000"))

module.exports = app;

