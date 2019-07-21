const moment = require('moment');
const debug = require('debug')('sitepower.io-backend:api-alice');
const nodemailer = require('nodemailer');
const redis = require('redis'),client = redis.createClient(process.env.REDIS_URL);
const db = require('./queries');
const round = require("lodash/math").round;
const {sample} = require('lodash');
const axios = require('axios');
const httpClient = axios.create();
httpClient.defaults.timeout = 1000;

module.exports = function (app) {
    client.keys("alice*", function(err, rows) {
        for(var i = 0, j = rows.length; i < j; ++i) {
            client.del(rows[i])
        }
    });
    const dictExercise = {
        easy : [
            {name: "pushups", count:"10", quantity : "items"},
            {name: "squats", count:"10", quantity : "items"},
            {name: "bepery", count:"5", quantity : "items"},
            {name: "plank", count:"30", quantity : "secs"},
            {name: "jumping", count:"30", quantity : "items"},
            {name: "forward", count:"20", quantity : "items"},
            {name: "chair", count:"30", quantity : "secs"},
            {name: "down", count:"5", quantity : "items"}
        ],
        normal: [
            {name: "pushups", count:"15", quantity : "items"},
            {name: "squats", count:"15", quantity : "items"},
            {name: "bepery", count:"7", quantity : "items"},
            {name: "plank", count:"60", quantity : "secs"},
            {name: "jumping", count:"40", quantity : "items"},
            {name: "forward", count:"25   ", quantity : "items"},
            {name: "chair", count:"60", quantity : "secs"},
            {name: "down", count:"7", quantity : "items"}
        ],
        hard: [
            {name: "pushups", count:"15", quantity : "items"},
            {name: "squats", count:"20", quantity : "items"},
            {name: "bepery", count:"10", quantity : "items"},
            {name: "plank", count:"90", quantity : "secs"},
            {name: "jumping", count:"40", quantity : "items"},
            {name: "forward", count:"30", quantity : "items"},
            {name: "chair", count:"60", quantity : "secs"},
            {name: "down", count:"15", quantity : "items"}
        ]
    };
    const generateTrain = (type) => {
        /*if (type === "easy") {
            return {plan: [{name: "pushups", count:"10", quantity : "items", seq:0}, {name: "squats", count:"10", quantity : "items", seq:1}, {name: "bepery", count:"10", quantity : "items", seq:2}, {name: "plank", count:"60", quantity : "secs", seq:3}]};
        } else if (type === "normal") {
            return {plan: [{name: "pushups", count:"15", quantity : "items", seq:0}, {name: "squats", count:"20", quantity : "items", seq:1}, {name: "bepery", count:"10", quantity : "items", seq:2}, {name: "plank", count:"90", quantity : "secs", seq:3}]};
        } else if (type === "hard") {
            return {plan: [{name: "pushups", count:"25", quantity : "items", seq:0}, {name: "squats", count:"30", quantity : "items", seq:1}, {name: "bepery", count:"20", quantity : "items", seq:2}, {name: "plank", count:"120", quantity : "secs", seq:3}]};
        }*/
        let training = [];
        let cnt = 0;
        let num_exercise = type === "hard" ? 5 : 4;
        let plan = dictExercise[type];
        while(cnt < num_exercise)//loop until Unique number
        {
            let randomExercise = Math.floor(Math.random()*plan.length);

            if (training.filter(item => item.seq === randomExercise).length === 0)//if you have got your unique random number
            {
                let ex = {name: plan[randomExercise].name, count: plan[randomExercise].count, quantity : plan[randomExercise].quantity, seq: randomExercise}
                training.push(ex);
                cnt++;
            }
        }
        return {plan: training};
    };

    const getTrainNum = (nlu) => {
        let trainNumStr = "";
        nlu.entities.filter(item => {
            return item.type === "YANDEX.NUMBER"
        }).forEach(item => {
            trainNumStr += item.value;
        });
        if (parseInt(trainNumStr)) {
            return parseInt(trainNumStr);
        }
        return -1;
    };
    const getIndividualTrain = (num) => {
        return new Promise((resolve, reject) => {
            /* ищем треню, */
            return db.getTrainByNum(num).then(train => {
                let values = [];
                if (train && train.status === "NEW") {
                    values.push({intensity : "individual"});
                    values.push({train_num : train.train_num});
                    values.push({user_name : train.user_name});
                    values.push({train : {plan : train.train_obj}});
                    resolve(values);
                } else if (train && train.status === "COMPLETED") {

                    reject("TRAIN_COMPLETED");
                } else {
                    reject("NO_TRAIN");
                }

            }).catch(err => reject("NO_TRAIN"))
        })
    };

    const getValues = (req, attrs, skill_id, sess_obj) => {
        return new Promise((resolve, reject) => {
          if (!attrs) {
              resolve([]);
          }
          if (skill_id === "96a9f802-2aba-4626-8fa5-bf10fb9b1110")  {
              let values = [];
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
                          if (parseInt(height) < 140 || parseInt(height) > 220) {
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
          } else if (skill_id === "d3c624cc-2b82-4594-9a7a-33d8f60a5e59") {
              let values = [];
              let found = false;
              const getTrain = (type) => {
                  let train = generateTrain(type);
                  values.push({intensity : type})
                  values.push({train})
              };
              // собираем номер тренировки из чисел


              attrs.forEach(attr => {
                  if (attr === "intensity") {
                      found = true;
                      /* сначала проверяем по регулярным выражениям */
                      if (/легкая/i.test(req.command)) {
                          getTrain("easy"); resolve(values);
                      } else if (/обычная/i.test(req.command)) {
                          getTrain("normal"); resolve(values);
                      } else if (/высокая/i.test(req.command)) {
                          getTrain("hard"); resolve(values);
                      } else {
                          /* проверяем номер тренировки, вдруг это индивидуальная */
                          let trainNum = getTrainNum(req.nlu);
                          if (trainNum > -1) {
                              getIndividualTrain(trainNum).then(res_vals => resolve(res_vals)).catch(err => reject(err));
                          } else {
                              /* идём в NLP, чтобы всё-таки попытаться расшифровать, что там нам сказали */
                              httpClient.post("https://sitepower-nlp.herokuapp.com", {data : req.command}).then(res => {
                                  if (res.data !== "NO_ANSWER") {
                                      /легкая/i.test(res.data) ? getTrain("easy") : /обычная/i.test(res.data) ? getTrain("normal") : (/высокая/i.test(res.data)) ? getTrain("hard") : reject("NO_INTENSITY");
                                      resolve(values);
                                  } else {
                                      reject("NO_INTENSITY");
                                  }
                              }).catch(err => {
                                  debug("sitepower-nlp", err.message);
                                  reject("NO_INTENSITY");
                              });
                          }
                      }

                  } else if (attr === "train_start"){
                      let train_obj = sess_obj.skill_object.train;
                      train_obj.start_time = new Date().getTime();
                      train_obj.round_start= train_obj.start_time;
                      train_obj.finished_round = 0;
                      /старт/i.test(req.command) ? values.push({train: train_obj}) : "";
                  } else if (attr === "train_end"){
                      let train_obj = sess_obj.skill_object.train;
                      train_obj.end_time = new Date().getTime();
                      train_obj.finished_round = 1;
                      /старт/i.test(req.command) ? values.push({train: train_obj}) : "";
                  } else if (attr === "pulse"){
                      let pulse=-1, cnt = 0;
                      req.nlu.entities.filter(item => {
                          return item.type === "YANDEX.NUMBER"
                      }).forEach(item => {
                          pulse = parseInt(item.value);
                          cnt++;
                      });
                      if (cnt === 1){
                          if (pulse < 50 || pulse > 200) {
                              reject("NOT_PULSE_INTERVAL");
                          } else {
                              values.push({pulse})
                          }
                      } else {
                          reject("NO_PULSE");
                      }
                  } else if (attr === "height") {
                      let height=-1, cnt = 0;
                      req.nlu.entities.filter(item => {
                          return item.type === "YANDEX.NUMBER"
                      }).forEach(item => {
                          height = parseInt(item.value);
                          cnt++;
                      });
                      if (cnt === 1){
                          if (parseInt(height) < 140 || parseInt(height) > 220) {
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
                  } else if (attr === "not_like"){
                      values.push({not_like:req.command})
                  } else if (attr === "goals"){
                      values.push({goals:req.command})
                  } else if (attr === "fact_obj"){
                      return db.setObjByTrainNum(sess_obj.skill_object.train_num, sess_obj).then().catch(err => reject("ERROR"));
                  }
              });
              if (!found) {
                  resolve(values);
              }
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
        } else if (skill_id === "d3c624cc-2b82-4594-9a7a-33d8f60a5e59") {
            if (obj.train && obj.train_num && obj.train.end_time) {
                return 2;       // индивидуальная тренировка - завершена полностью
            }
            else if (obj.train && obj.train.end_time) {
                return 1;       // обычная тренировка - завершена полностью
            } else {
                return 0;       // обычная тренировка - не завершена
            }
        }
    }
    const getHelp = (skill_id)=> {
        if (skill_id === "96a9f802-2aba-4626-8fa5-bf10fb9b1110") {
            return {text:"Я калькулятор индекса массы тела. В процессе диалога я спрошу у вас рост и вес. По итогам рассчитаю ваш индекс и что-нибудь пожелаю."};
        } else if (skill_id === "d3c624cc-2b82-4594-9a7a-33d8f60a5e59") {
            return {text:"Я ваш тренер по фитнесу. Вам будет предложена на выбор интенсивность тренировки. После старта будут последовательно объявляться упражнения. При необходимости, вы можете уточнить технику выполнения, назвав интересующее упражнение. Вы всегда можете выйти из тренировки, сказав «Финиш». По итогам тренировки будет объявлен ваш результат."};
        }
    }

    const setRedisValue = (session_id, obj) => {
        client.set("alice:" + session_id, JSON.stringify(obj));
        client.expireat("alice:" + session_id, parseInt((+new Date)/1000) + 3600);
    }


    const getExercise = (name) => {
        return  name === "pushups" ? "Отжимания" :
                name === "squats" ? "Приседания" :
                name === "bepery" ? "Берпи" :
                name === "plank" ? "Планка" :
                name === "jumping" ? "Jumping Jack" :
                name === "forward" ? "Выпады вперёд на каждую ногу" :
                name === "chair" ? "Стульчик": "Выпрыгивания из приседа";
    }

    const getTrainingDesc = (obj) => getTraining(obj).text;
    const getTrainingTts = (obj) => getTraining(obj).tts;

    const getTraining = (obj) => {
        let text = "";
        let tts = "";
        if (obj.train.plan) {
            tts = "- - - - - -";
        }
        obj.train.plan.sort((a, b) => a.seq - b.seq).forEach(item => {
            let exercise = getExercise(item.name);
            let count = item.quantity === "items" ? item.count + " раз" :  item.count + " секунд";
            text = text + "\n" + exercise + " - " + count;
            tts = tts + " - - - " + exercise + " - - " + count;
        })
        return {text, tts};
    }

    const getTrainingNextDesc = (obj) => {
        let desc = ""
        /*if (obj.train.last_ex_code) {
            let ex_time = Math.round((obj.train.last_ex_end_time - obj.train.last_ex_start_time)/1000);
            desc = "Вы выполнили упражнение за " + ex_time + " сек. Следующее упражнение - ";
        }*/
        if (obj.train.finished_round && obj.train.active_round && obj.train.finished_round === obj.train.active_round) {
            let ex_time = Math.round((obj.train.end_time - obj.train.round_start)/1000);
            desc = `Время прохождения круга ${getDurationStr(ex_time)}. Отдохните одну минуту. ${sample(['Следующее упражнение','Далее','Идём дальше'])} - `;
        } else {
            if (obj.train.last_ex_code) {
                desc = `${sample(['Следующее упражнение','Далее'])} - `;
            }
        }

        let item = obj.train.plan.sort((a, b) => a.seq - b.seq)[obj.train.last_ex_seq ? obj.train.last_ex_seq : 0];

        let exercise = getExercise(item.name);
        let count = item.quantity === "items" ? item.count + " раз" :  item.count + " секунд";
        desc = desc + exercise + " - " + count;
        return desc
    }

    const getDurationStr = (secs) => {
        let minutes = Math.floor(secs/60);
        let minutes_part = minutes % 100;
        let seconds = secs - minutes*60;
        let seconds_part = seconds % 100;
        let minutes_label = minutes_part === 1 || (minutes_part%10 === 1 && minutes_part > 20) ? "минута" : minutes_part > 1 && minutes_part < 5 ? "минуты" : "минут";
        let seconds_label = seconds_part === 1 || (seconds_part%10 === 1 && seconds_part > 20) ? "секунда" : seconds_part > 1 && seconds_part < 5 ? "секунды" : "секунд";
        return minutes > 0 ? minutes + " " + minutes_label + " " + seconds + " " + seconds_label  : seconds + " " + seconds_label;
    };

    const getResultDesc = (obj) => {
        let all_duration = Math.round((obj.train.end_time - obj.train.start_time)/1000);
        let last_round_duration = Math.round((obj.train.end_time - obj.train.round_start)/1000);
        let desc = `${sample(['Время прохождения последнего круга - '])} ${getDurationStr(last_round_duration)}.\n`
        if (obj.train.finished_round > 1 )  {
            desc += `\n${sample(['Общая длительность тренировки', 'Тренировка длилась'])} ${getDurationStr(all_duration)}. `;
        }
        desc += `\n${sample(['Количество полностью выполненных', 'Количество успешно пройденных'])}  кругов - ${obj.train.finished_round}`;
        return desc;
    }

    const generateButtonsTrain = (obj) => {
        let buttons = []
        buttons.push({title: "⚡ Старт ⚡"})
        obj.train.plan.sort((a, b) => a.seq - b.seq).forEach(item => {
            let exercise = getExercise(item.name);
            buttons.push({title: exercise});
        })
        buttons.push({title: "Повторить"});
        return buttons;
    }

    const getNextHandler = (item, obj, prev_id) => {
        let next_id = -1;
        let now = new Date().getTime();
        if (item.next_special) {
            let skill_obj = obj.skill_object;
            if (item.next_special === "train_ex_start") {
                if (!skill_obj.train.last_ex_seq) {
                    skill_obj.train.round_start = now;
                    if (!(skill_obj.train.last_ex_seq === 0)) {
                        skill_obj.train.last_ex_seq = 0;
                        skill_obj.train.start_time = now;
                        skill_obj.train.fact = [];
                        skill_obj.train.active_round = 1;
                        skill_obj.train.finished_round = 0;
                    }
                }
                if (skill_obj.train.finished_round === skill_obj.train.active_round) {
                    skill_obj.train.active_round++;
                }
                skill_obj.train.last_ex_code = skill_obj.train.plan.sort((a, b) => a.seq - b.seq)[skill_obj.train.last_ex_seq]["name"];
                skill_obj.train.last_ex_start_time = now;
                next_id = 8;
            } else if (item.next_special === "train_ex_end") {
                skill_obj.train.last_ex_seq = skill_obj.train.last_ex_seq + 1;
                skill_obj.train.last_ex_end_time = now;
                skill_obj.train.end_time = now;
                let secs = Math.round((skill_obj.train.last_ex_end_time - skill_obj.train.last_ex_start_time)/1000);
                skill_obj.train.fact.push({name : skill_obj.train.last_ex_code, secs});
                if (skill_obj.train.last_ex_seq < skill_obj.train.plan.length) {
                    next_id = 7;
                }
                else {
                    skill_obj.train.finished_round++;
                    if (skill_obj.train.finished_round === 4) {
                        next_id = 5;
                        if (skill_obj.train_num) {
                            db.setObjByTrainNum(skill_obj.train_num, obj).then(() => {}).catch((err) => {});
                        }
                    } else {
                        next_id = 7;
                        skill_obj.train.last_ex_seq = 0;
                    }
                }
            }  else if (item.next_special === "back") {
                next_id = obj.prev_sentence_id;
            }
        } else {
            next_id = item.next_id;
        }
        return next_id;
    }
    const getNextId = (req, next_decl, obj, inp_next_id, oth_handler) => {
        return new Promise((resolve, reject) => {
            if (inp_next_id) {
                return resolve(inp_next_id);
            }
            let next_id = -1;
            /* 1. Пытаемся получить следующий шаг из массива next_decl БЕЗ похода в NLP */
            next_decl.forEach(item => {
                let matcher = new RegExp(item.name, "i");
                if (matcher.test(req.command)) {
                    next_id = getNextHandler(item, obj);
                }
            });
            if (next_id === -1) {
            /* 2. Проверим - может прописан other handler, и мы по нему проскочим */
                if (oth_handler === "individual"){
                    let trainNum = getTrainNum(req.nlu);
                    if (trainNum > -1) {
                        return db.getTrainByNum(trainNum).then(train => resolve(train.next_id)).catch(err => reject("NO_ANSWER"))
                    }
                }
            } else {
                resolve(next_id);
            }
            /* 3. Ну если ничего не помогло - идем в NLP */
            httpClient.post("https://sitepower-nlp.herokuapp.com", {data : req.command}).then(res => {
                debug("{getNextId - NLP Response}", res.data)
                if (res.data !== "NO_ANSWER") {
                    let next_id = -1;
                    next_decl.forEach(item => {
                        let matcher = new RegExp(item.name, "i");
                        if (matcher.test(res.data)) {
                            next_id = getNextHandler(item, obj);
                        }
                    });
                    if (next_id === -1) {
                        reject("NO_ANSWER");
                    } else {
                        resolve(next_id);
                    }
                } else {
                   reject("NO_ANSWER")
                }
            }).catch(err => {
                debug("{getNextId - NLP Response}", err.message)
                reject("NO_ANSWER");
            })
        })
    }

    const getAnswer = (session, req) => {
        //req.command =
        return new Promise((resolve, reject) => {
            client.get("alice:" + session.session_id, (err, reply) => {
                if (!reply){
                    let skill = session.skill_id;
                    return db.getAliceFirstSentence(skill).then(q => {
                            let sess_obj = {sentence_id : q.id, fail_num: 0, skill_object:{}, created: moment().format(), updated: moment().format()};
                            setRedisValue(session.session_id, sess_obj);
                            resolve({sentence:q.sentence, last:false});
                        }).catch((err) => {
                            debug("getAliceFirstSentence", err.message)
                            reject()
                        })

                } else {
                    let sess_obj = JSON.parse(reply);
                    const current_sentence_id = sess_obj.sentence_id;

                    if (session.skill_id === "d3c624cc-2b82-4594-9a7a-33d8f60a5e59" && /финиш/i.test(req.command)) {
                        return db.getAliceLastSentence(session.skill_id).then(q => {
                            if (sess_obj.sentence_id !== q.id) {
                                sess_obj.prev_sentence_id = sess_obj.sentence_id;
                            }
                            sess_obj.sentence_id = q.id;
                            sess_obj.fail_num = 0;
                            setRedisValue(session.session_id, sess_obj);
                            let result = getResultCode(sess_obj.skill_object, session.skill_id);
                            q.sentence[result].text = eval("`" + q.sentence[result].text + "`")
                            if (q.sentence[result].tts) {
                                q.sentence[result].tts = eval("`" + q.sentence[result].tts + "`")
                            }
                            resolve({sentence:q.sentence[result], last:true});
                        }).catch((err) => {
                            debug("getAliceSentence", '{GO TO NEXT}', err.message)
                            reject()
                        })
                    }
                    return db.getAliceSentence(current_sentence_id).then(q => {
                            if (/помощь/i.test(req.command) || /что ты умеешь/i.test(req.command)) {
                                if (q.sentence && q.sentence.text) {
                                    delete q.sentence.card;
                                    q.sentence.text = getHelp(session.skill_id).text + "\n\n" + eval("`" + q.sentence.text + "`");
                                    if (q.sentence.tts) {
                                        q.sentence.tts = getHelp(session.skill_id).text + "\n\n" + eval("`" + q.sentence.tts + "`");
                                    }

                                    q.sentence.buttons === "generateButtonsTrain" ? q.sentence.buttons = generateButtonsTrain(sess_obj.skill_object) : q.sentence.buttons;
                                } else {
                                    q.sentence.text = getHelp(session.skill_id).text;
                                }

                                resolve({sentence:q.sentence, last:false});
                            }
                            return getValues(req, q.reply_attr, session.skill_id, sess_obj).then(values => {
                                values.forEach(item => sess_obj.skill_object[Object.keys(item)[0]] = Object.values(item)[0]);
                                setRedisValue(session.session_id, sess_obj);
                                /* переходим к следующему вопросу */
                                /*if (!q.next_id) {
                                    q.next_id = getNextId(req, q.next_decl, sess_obj.skill_object);
                                }*/
                                return getNextId(req, q.next_decl, sess_obj, q.next_id, q.next_decl_oth_handler).then(res_next_id => {
                                    q.next_id = res_next_id;
                                    console.log("next_id = " + q.next_id);
                                    return db.getAliceSentence(q.next_id).then(q => {
                                        if (sess_obj.sentence_id !== q.id) {
                                            sess_obj.prev_sentence_id = sess_obj.sentence_id;
                                        }
                                        sess_obj.sentence_id = q.id;
                                        sess_obj.fail_num = 0;
                                        setRedisValue(session.session_id, sess_obj);
                                        if (q.flag === "E") {
                                            let result = getResultCode(sess_obj.skill_object, session.skill_id);
                                            q.sentence[result].text = eval("`" + q.sentence[result].text + "`");
                                            if (q.sentence[result].tts) {
                                                q.sentence[result].tts = eval("`" + q.sentence[result].tts + "`");
                                            }
                                            resolve({sentence:q.sentence[result], last:true});
                                        } else {
                                            q.sentence.buttons === "generateButtonsTrain" ? q.sentence.buttons = generateButtonsTrain(sess_obj.skill_object) : q.sentence.buttons;
                                            q.sentence.text = eval("`" + q.sentence.text + "`");
                                            if (q.sentence.tts) {
                                                q.sentence.tts = eval("`" + q.sentence.tts + "`");
                                            }
                                            resolve({sentence:q.sentence, last:false});
                                        }
                                    }).catch((err) => {
                                        debug("getAliceSentence", '{GO TO NEXT}', err.message)
                                        reject()
                                    })
                                }).catch(err => {
                                    debug("getNextId", '{ERROR}', err.message)
                                    throw err;
                                })

                            }).catch(err => {
                                sess_obj.fail_num++;
                                setRedisValue(session.session_id, sess_obj);
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
        let ping = req.body.request.command === "ping" ? "Y" : "N";
        let session_id = req.body.session.session_id;
        let skill_id = req.body.session.skill_id;
        logAlice(session_id, skill_id, "req", req.body, ping, req.body.request.command);
        if (!req.body.request.command && req.body.request.type === "ButtonPressed" && req.body.request.payload) {
            req.body.request.command = req.body.request.payload.command;
        }
        getAnswer(req.body.session, req.body.request).then((dat, end) => {
            const sentence = eval("`" + dat.sentence.text + "`")
            let tts = "";
            if (dat.sentence.tts) {
                tts = eval("`" + dat.sentence.tts + "`");
            } else {
                tts = sentence;
            }

            let response = {
                session : req.body.session,
                version : req.body.version,
                response: {
                    text : sentence,
                    tts : tts,
                    card: dat.sentence.card,
                    buttons: dat.sentence.buttons,
                    "end_session": dat.last
                }
            }
            logAlice(session_id, skill_id, "res", response, ping, response.response.text);
            res.send(response)
        }).catch((err) => {
            debug("getAnswer", '{ERROR}', err.message);
            let response = {
                session : req.body.session,
                version : req.body.version,
                response: {
                    text : "Что то пошло не так. Повторите позже",
                    tts : "Что то пошло не так. Повторите позже",
                    "end_session": true
                }
            }
            db.createAliceLog(req.body.session.session_id, "res", response, ping, response.response.text);
            res.send(response)
        });



    });

    const logAlice = (session_id, skill_id, type, body, ping, text) => {
        if (ping === "Y") {
            return db.getAlicePingbySkill(skill_id, type).then(log => {
                if (log.length > 0){
                    return db.updateAlicePingbySkill(session_id, skill_id, type, text).catch((err) => {
                        debug("updateAlicePingbySkill", '{ERROR}', err.message)
                    })
                } else {
                    return db.insertAlicePingbySkill(session_id, skill_id, type, text).catch((err) => {
                        debug("insertAlicePingbySkill", '{ERROR}', err.message)
                    })
                }
            }).catch((err) => {
                debug("getAlicePingbySkill", '{ERROR}', err.message)
            })
        } else {
            return db.createAliceLog(session_id, skill_id, type, body, text).catch((err) => {
                debug("createAliceLog", '{ERROR}', err.message)
            });
        }
    }

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


