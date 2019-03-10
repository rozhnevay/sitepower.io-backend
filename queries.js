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
    createUser: createUser
};

function getUserByLogin(login) {
    return db.one('select * from t_user where login = $1', login);
}

function getUserById(id) {
    return db.one('select * from t_user where id = $1', id);
}

function createUser(login, pass, name) {
    return db.none('insert into t_user(login, pass, name) values($1, $2, $3)', [login, pass, name]);
}