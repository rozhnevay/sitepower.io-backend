const debug = require('debug')('sitepower.io-backend:app');
const publicRoot = './dist'
const widgetRoot = './widget'
const express = require('express');
const app = express();

require('dotenv').config();
const session = require('express-session');
const compression = require('compression');
const redisStore = require('connect-redis') (session);
const bodyParser = require('body-parser')
const passport = require('passport')
const rateLimit = require("express-rate-limit");
app.enable("trust proxy");

const LocalStrategy = require('passport-local').Strategy
const db = require('./queries');
const bcrypt = require('bcryptjs');
const busboy = require('connect-busboy');
const schedule = require('node-schedule');

app.use(busboy());
app.use(express.static(publicRoot))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(compression());
app.use(function(req, res, next) {
    var allowedOrigins = ['https://app.sitepower.io', 'http://app.sitepower.io', 'http://app.sitepower.io.s3-website.eu-west-3.amazonaws.com', 'http://localhost'];
    var origin = req.headers.origin;
    if(allowedOrigins.indexOf(origin) > -1){
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Credentials', true);
    return next();
});
// app.get("/", (req, res, next) => {
//   res.sendFile("index.html", { root: publicRoot })
// })

/* Widget Send*/
const fs = require('fs');
fs.readFile(widgetRoot+"/"+"widget.js", (err, data) => {
    if (err) debug("{WIDGET}", err.message)
    if (data) {
        app.get("/api/widget/:id", (req, res, next) => {
            res.send(data.toString().replace(/%%DOMAIN%%/g, process.env.DOMAIN).replace(/%%WIDGET_ID%%/g, req.params.id))
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
  proxy:    true,
  resave:   true,
  rolling: true,
  saveUninitialized: false,
  cookie: {
        path: '/',
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 1000
    }
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
passport.deserializeUser((id, done) => db.getUserById(id).then(user => done(null, {id:user.id, parent:user.parent_id, parent_sitepower_id:user.parent_sitepower_id, login:user.login, name:user.name, created:user.created, sitepower_id:user.sitepower_id, days_amount:user.days_amount, test_form_id:user.test_form_id})));


require('./api-auth')(app, authMiddleware, passport, rateLimit); // Auth API
require('./api-forms')(app, authMiddleware); // Forms API

require('./api-upload')(app, authMiddleware); // Upload

 // Socket API
require('./api-chat')(app, authMiddleware); // Chat API

require('./api-pay')(app, authMiddleware); // Pay API


//* Планировщик для списания дней *//
let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = new schedule.Range(0, 6);
rule.hour = 0;
rule.minute = 0;

schedule.scheduleJob(rule,
    () => {
        debug("scheduleJob", "START")
        return db.getOperatorsCountByUser().then((res) => {
            res.forEach(item => {
                return db.decrementDaysAmount(item.id, item.cnt).then(() => {
                }).catch(err => debug("scheduleJob", "decrementDaysAmount", err.message))
            })
            return db.insertJobLog(JSON.stringify(res)).catch(err => debug("insertJobLog", "getOperatorsCountByUser", err.message));
        }).catch(err => debug("scheduleJob", "getOperatorsCountByUser", err.message))
    }
);


module.exports = {app, session, passport};

