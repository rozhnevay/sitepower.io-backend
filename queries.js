var promise = require('bluebird');
var options = {
    // Initialization Options
    promiseLib: promise
};

var pgp = require('pg-promise')(options);
var connectionString = 'postgres://postgres:postgres@localhost:5432/postgres';
var db = pgp(connectionString);

module.exports = {
    getUserByLogin: getUserByLogin,
    getUserById: getUserById,
    createUser: createUser,
    getFormsByUserId: getFormsByUserId,
    getFormById: getFormById,
    createForm: createForm,
    updateUserPassword: updateUserPassword
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
    return db.one('update t_user set pass = $1 where id = $2', [pass, user_id]);
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
