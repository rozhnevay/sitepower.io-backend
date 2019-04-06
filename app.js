
const publicRoot = './dist'
const widgetRoot = './widget'
const express = require('express');
const app = express();

require('dotenv').config();
const session = require('express-session');

const redisStore = require('connect-redis') (session);
const bodyParser = require('body-parser')
const passport = require('passport')
const rateLimit = require("express-rate-limit");
app.enable("trust proxy");

const LocalStrategy = require('passport-local').Strategy
const db = require('./queries');
const bcrypt = require('bcryptjs');
app.use(express.static(publicRoot))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.get("/", (req, res, next) => {
  res.sendFile("index.html", { root: publicRoot })
})

/* Widget Send*/
const fs = require('fs');
fs.readFile(widgetRoot+"/"+"widget.js", (err, data) => {
    if (err) debug("{WIDGET}", err.message)
    if (data) {
        app.get("/widget/:id", (req, res, next) => {
            res.send(data.toString().replace(/%%HOST%%/g, process.env.HOST).replace(/%%WIDGET_ID%%/g, req.params.id))
        })
    }
})

/* anti - ddos */
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60 // limit each IP to 10 requests per windowMs
});
app.use("/api/", limiter);


const sessionStore = new redisStore({url:process.env.REDIS_URL});
app.use(session({
  store:    sessionStore,
  secret:   process.env.SECRET,
  key:      'sitepower.sid.' + process.env.NODE_ENV,
  resave:   true,
  saveUninitialized: false,
  cookie: {
        path: '/',
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 1000
    },
  rolling: true
}));
app.use(passport.initialize());
app.use(passport.session());
/*
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
*/

const authMiddleware = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).send('You are not authenticated')
  } else {
    return next()
  }
}

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
passport.deserializeUser((id, done) => db.getUserById(id).then(user => done(null, {id:user.id, login:user.login, name:user.name, created:user.created, sitepower_id:user.sitepower_id})));


require('./api-auth')(app, authMiddleware, passport, rateLimit); // Auth API
require('./api-forms')(app, authMiddleware); // Forms API

require('./api-upload')(app, authMiddleware); // Upload

const mongo = require("mongodb").MongoClient;
mongo.connect(process.env.MONGO_URL, (err, db) => {
    if (err) return debug(err);
    require('./socket')(app, session, passport, db); // Socket API
    require('./api-chat')(app, authMiddleware, db); // Chat API
})





module.exports = app;

