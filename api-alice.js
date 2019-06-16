const debug = require('debug')('sitepower.io-backend:api-alice');
const nodemailer = require('nodemailer');
const redis = require('redis'),client = redis.createClient(process.env.REDIS_URL);
const db = require('./queries');

module.exports = function (app) {

    const getValues = (req, attrs, skill_id) => {
        return new Promise((resolve, reject) => {
          if (skill_id === "96a9f802-2aba-4626-8fa5-bf10fb9b1110")  {
              values = [];
              attrs.forEach(attr => {
                  if (attr === "height") {
                      let height=-1, cnt = 0;
                      req.nlu.entities.filter(item => {
                          return item.type === "YANDEX.NUMBER"
                      }).forEach(item => {
                          height = parseInt(item.value);
                          cnt++;
                      });
                      if (cnt === 1){
                          if (parseInt(height) < 150 || parseInt(height) > 220) {
                              reject("NOT_HEIGHT_INTERVAL");
                          } else {
                              values.push({height})
                          }
                      } else {
                          reject("NO_HEIGHT");
                      }
                  }
                  else if (attr === "weight"){
                      let weight=-1, cnt = 0;
                      req.nlu.entities.filter(item => {
                          return item.type === "YANDEX.NUMBER"
                      }).forEach(item => {
                          weight = parseInt(item.value);
                          cnt++;
                      });
                      if (cnt === 1){
                          if (weight < 40 || weight > 150) {
                              reject("NOT_WEIGHT_INTERVAL");
                          } else {
                              values.push({weight})
                          }
                      } else {
                          reject("NO_WEIGHT");
                      }
                  }
              });
              resolve(values);
          }
        })
    }
    const getResultCode = (obj, skill_id) => {
        if (skill_id === "96a9f802-2aba-4626-8fa5-bf10fb9b1110")  {
            obj.height = obj.height/100;
            let imt = obj.weight/(obj.height * obj.height);
            if (imt <= 16) return 0;
            else if (imt > 16 &&  imt <= 18.5) return 1;
            else if (imt > 18.5 &&  imt <= 25) return 2;
            else if (imt > 25 &&  imt <= 30) return 3;
            else if (imt > 30 &&  imt <= 35) return 4;
            else if (imt > 35 &&  imt <= 40) return 5;
            else return 6;
        }
    }
    const getAnswer = (session, req) => {
        return new Promise((resolve, reject) => {
            client.get("alice:" + session.session_id, (err, reply) => {
                if (!reply){
                    let skill = session.skill_id;
                    return db.getAliceFirstSentence(skill).then(q => {
                            let sess_obj = {sentence_id : q.id, fail_num: 0, skill_object:{}};
                            client.set("alice:" + session.session_id, JSON.stringify(sess_obj));
                            resolve({sentence:q.sentence, last:false});
                        }).catch((err) => {
                            debug("getAliceFirstSentence", err.message)
                            reject()
                        })

                } else {
                    let sess_obj = JSON.parse(reply);
                    const current_sentence_id = sess_obj.sentence_id;
                    return db.getAliceSentence(current_sentence_id).then(q => {
                            return getValues(req, q.reply_attr, session.skill_id).then(values => {
                                values.forEach(item => sess_obj.skill_object[Object.keys(item)[0]] = Object.values(item)[0]);
                                client.set("alice:" + session.session_id, JSON.stringify(sess_obj));
                                /* переходим к следующему вопросу */
                                return db.getAliceSentence(q.next_id).then(q => {
                                    sess_obj.sentence_id = q.id;
                                    sess_obj.fail_num = 0;
                                    client.set("alice:" + session.session_id, JSON.stringify(sess_obj));
                                    if (q.flag === "E") {
                                        let result = getResultCode(sess_obj.skill_object, session.skill_id);
                                        resolve({sentence:q.sentence[result], last:true});
                                    } else {
                                        resolve({sentence:q.sentence, last:true});
                                    }
                                }).catch((err) => {
                                    debug("getAliceSentence", '{GO TO NEXT}', err.message)
                                    reject()
                                })
                            }).catch(err => {
                                sess_obj.fail_num++;
                                client.set("alice:" + session.session_id, JSON.stringify(sess_obj));
                                resolve({sentence:q.sentence_error[err], last:false});
                            })
                        }).catch((err) => {
                            debug("getAliceSentence", '{SET ATTRIBUTES}', err.message)
                            reject()
                        })
                }
            })
        })
    }

    app.post("/api/alice/fatcalc", (req, res) => {
        getAnswer(req.body.session, req.body.request).then((dat, end) => {
            res.send({
                session : req.body.session,
                version : req.body.version,
                response: {
                    text : dat.sentence.text,
                    tts : dat.sentence.text,
                    "end_session": dat.last
                }
            })
        }).catch(() => {
            res.send({
                session : req.body.session,
                version : req.body.version,
                response: {
                    text : "Я болею и не могу ответить. Приходите в другой раз",
                    tts : "Я болею и не могу ответить. Приходите в другой раз",
                    "end_session": true
                }
            })
        });



    });

    const sendNewLead = (mail) => {
        var transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            auth: {
                user: process.env.SMTP_LOGIN,
                pass: process.env.SMTP_PASSWORD
            }
        });
        let mailOptions = {
            from: process.env.SMTP_LOGIN,
            to: "rozhnevay@gmail.com",
            subject: 'Запрос на Алису',
            html:'Запрос от клиента: ' + mail
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                debug("sendRegOperatorLink", error);
            } else {
                debug("sendRegOperatorLink", 'Email sent: ' + info.response);
            }
        });
    };

    app.post("/api/alice/lead", (req, res) => {
        sendNewLead(req.body.email);
        res.send("OK");
    });
}


