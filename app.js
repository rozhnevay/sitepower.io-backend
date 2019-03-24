

const publicRoot = 'C:\\Users\\User\\sitepower.io\\dist'


const express = require('express');

// creating an express instance
const app = express();

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

