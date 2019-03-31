var promise = require('bluebird');
var options = {
    // Initialization Options
    promiseLib: promise
};
var pgp = require('pg-promise')(options);

require('dotenv').config()
var connectionString = process.env.DATABASE_URL;

var db = pgp({connectionString});

module.exports = {
    getUserByLogin: getUserByLogin,
    getUserById: getUserById,
    createUser: createUser,
    getFormsByUserId: getFormsByUserId,
    getFormById: getFormById,
    createForm: createForm,
    updateUserPassword: updateUserPassword,
    getChatsByUserId:getChatsByUserId,
    getChatBodyBySpId:getChatBodyBySpId,
    updateUserChatId:updateUserChatId,
    getUserBySPId:getUserBySPId,
    createProspect:createProspect,
    updateProspectChatId:updateProspectChatId,
    getProspectUserBySPId:getProspectUserBySPId,
    getChatIdByUserId:getChatIdByUserId
};

function getUserByLogin(login) {
    return db.one('select * from t_user where login = $1', login);
}

function getUserById(id) {
    return db.one('select * from t_user where id = $1', id);
}

function createUser(login, pass, name) {
    return db.one('insert into t_user(login, pass, name) values($1, $2, $3) returning id', [login, pass, name]);
}

function updateUserPassword(user_id, pass) {
    return db.none('update t_user set pass = $1 where id = $2', [pass, user_id]);
}

function updateUserChatId(user_id, chat_id) {
    console.log("usser = " + user_id);
    return db.none('update t_user set chat_id = $1 where id = $2', [chat_id, user_id]);
}

function getFormsByUserId(user_id) {
    return db.any('select * from t_form where user_id = $1', user_id);
}

function getFormById(id) {
    return db.one('select * from t_form where id = $1', id);
}

function createForm(user_id, origin, form) {
    return db.one('insert into t_form(user_id, origin, form) values($1, $2, $3) returning id', [user_id, origin, form]);
}

function getChatsByUserId(user_id) {
    return db.any('select id, created, login, sitepower_id from t_prospect where user_id = $1', user_id);
}

function getChatBodyBySpId(id) {
    return db.one('select chat from t_prospect where sitepower_id = $1', id);
}

function getUserBySPId(sitepower_id) {
    return db.one('select * from t_user where sitepower_id = $1', sitepower_id);
}

function createProspect(user_id) {
    return db.one('insert into t_prospect (user_id) values($1) returning sitepower_id', user_id);
}

function updateProspectChatId(sitepower_id, chat_id) {
    console.log("updateProspectChatId [sitepower_id = " + sitepower_id + "] [chat_id = " + chat_id + "]");
    return db.none('update t_prospect set chat_id = $1 where sitepower_id = $2', [chat_id, sitepower_id]);
}

function getProspectUserBySPId(sitepower_id) {
    console.log("getProspectUserBySPId");
    return db.one('select user_id from t_prospect where sitepower_id = $1', sitepower_id);
}

function getChatIdByUserId(user_id) {
    console.log("getChatIdByUserId [user_id = " + user_id + "]");
    return db.one('select chat_id from t_user where id = $1', user_id);
}
