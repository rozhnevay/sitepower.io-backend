const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-chat');

module.exports = function (app, authMiddleware, mongodb) {
    app.get("/api/chats", authMiddleware, (req, res) => {
        debug("/api/chats");
        db.getChatsByUserId(req.session.passport.user).then(chats => res.send(chats)).catch((err) => {
            res.status(400).send("Cannot get chats");
            debug("/api/chats", err.message);
        });
    })
    app.get("/api/chat/:id", (req, res) => {
        debug("/api/chat/:id", req.params.id);

        let mongoPromise = () => {
            return new Promise((resolve, reject) => {
                mongodb.db("sitepower").collection("chats").findOne({_id:req.params.id}, (err, result) => {
                    err ? reject(err) : resolve(result)
                })
            })
        };
        mongoPromise().then(function(result) {
            res.header("Access-Control-Allow-Origin", req.headers.origin);
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.send(result)
            debug("/api/chat/:id", req.params.id, JSON.stringify(result));
        }).catch(err => {
            res.status(400).send("Cannot get chat for " + req.params.id);
            debug("/api/chat/:id", req.params.id, err.message);
        });

    })

    /* TODO!!! Продумать проверку на Origin и ограничение на кол-во запросов в день (не больше тысчяи)*/
    app.get("/api/prospect/:id", (req, res) => {
        debug("/api/prospect/:id", req.params.id);
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        db.getUserBySPId(req.params.id).then(
            user => db.createProspect(user.id, getName()).then(
                prospect => res.send({sitepower_id: prospect.sitepower_id})
            ).catch(err => {
                res.status(400).send("Cannot get prospect sitepower_id for " + req.params.id);
                debug("/api/prospect/:id", req.params.id, err.message);
            })
        );

    })
    function getName(){
        var adjs = ["осенний", "скрытый", "горький", "туманный", "тихий", "пустой", "сухой","темный", "летний", "ледяной", "нежный", "тихий", "белый", "прохладный", "весенний","зимний", "сумеречный", "рассветный", "малиновый", "тоненький","выветрившийся","синий", "вздымающийся", "сломанный", "холодный", "влажный", "падающий", "морозный", "зеленый", "длинный", "поздний", "затяжной", "жирный", "маленький", "утренний", "грязный", "старый",  "красный", "грубый", "неподвижный", "маленький", "сверкающий", "пульсирующий", "застенчивый", "блуждающий", "увядший", "дикий", "черный", "молодой", "святой", "одинокий","ароматный", "выдержанный", "снежный", "гордый", "цветочный", "беспокойный", "божественный","полированный", "древний", "фиолетовый", "живой", "безымянный"]

            , nouns = ["водопад", "ветер", "дождь", "снег", "закат", "лист", "рассвет", "блеск", "лес", "холм", "облако", "луг", "солнце","ручеек", "куст", "огонь", "цветок", "светлячок", "перо", "пруд","звук", "прибой",  "гром", "цветок","резонанс","лес", "туман", "мороз", "голос","дым"];

        return jsUcfirst(adjs[Math.floor(Math.random()*(adjs.length-1))])+" "+jsUcfirst(nouns[Math.floor(Math.random()*(nouns.length-1))]);
    }
    function jsUcfirst(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}
