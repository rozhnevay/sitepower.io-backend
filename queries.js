const debug = require('debug')('sitepower.io-backend:queries');
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
    getChatBySpId:getChatBySpId,
    updateUserChatId:updateUserChatId,
    getUserBySPId:getUserBySPId,
    createProspect:createProspect,
    updateProspectChatId:updateProspectChatId,
    getProspectUserBySPId:getProspectUserBySPId,
    getChatIdByUserId:getChatIdByUserId,
    getFormByUserIdOrigin:getFormByUserIdOrigin,
    uploadFile:uploadFile,
    getFileByUUId:getFileByUUId,
    updateLastMessageOperator:updateLastMessageOperator,
    setCountUnanswered:setCountUnanswered,
    updateLastOpen:updateLastOpen,
    updateClass:updateClass,
    updateContact:updateContact,
    updateForm:updateForm,
    getFormBySpId:getFormBySpId,
    createOperator:createOperator,
    getOperators:getOperators,
    updateUserNamePassword:updateUserNamePassword,
    createMessage:createMessage,
    getMessageById:getMessageById,
    getChatById:getChatById,
    getMessagesByChatId:getMessagesByChatId
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
function createOperator(login, pass, user_id) {
    return db.one('insert into t_user(login, pass, parent_id, admin) values($1, $2, $3, 0) returning id', [login, pass, user_id]);
}

function updateUserPassword(user_id, pass) {
    return db.none('update t_user set pass = $1 where id = $2', [pass, user_id]);
}

function updateUserNamePassword(user_id, name, pass) {
    return db.none('update t_user set pass = $1, name = $2 where id = $3', [pass, name, user_id]);
}

function updateUserChatId(user_id, chat_id) {
    console.log("usser = " + user_id);
    return db.none('update t_user set chat_id = $1 where id = $2', [chat_id, user_id]);
}

function getFormsByUserId(user_id) {
    return db.any('select id, origin, color, gradient, label, position, message_placeholder, sitepower_id, created from t_form where user_id = $1', user_id);
}

function getOperators(user_id) {
    return db.any('select login, name, admin, sitepower_id, created created from t_user where parent_id = $1', user_id);
}

function getFormByUserIdOrigin(user_id, origin) {
    return db.one('select * from t_form where user_id = $1 and origin = $2', [user_id, origin]);
}

function getFormBySpId(id) {
    return db.one('select * from t_form where sitepower_id = $1', id);
}

function getFormById(id) {
    return db.one('select * from t_form where id = $1', id);
}

function createForm(user_id, origin) {
    return db.one('insert into t_form(user_id, origin) values($1, $2) returning id', [user_id, origin]);
}

function updateForm(id, user_id, form) {
    debug("updateForm", user_id, id, JSON.stringify(form));
    return db.none('update t_form set color = $3, gradient = $4, label = $5, position = $6, message_placeholder = $7 where user_id=$1 AND id = $2', [user_id, id, form.color, form.gradient, form.label, form.position, form.message_placeholder]);
}

function getChatsByUserId(user_id, limit, before_id) {
    return db.any(`
		select
            p.created,
            p.id,
            p.sitepower_id,
            p.class,
            p.full_name as name,
            p.phone,
            p.login,
            m.body as last_msg_body,
            m.created as last_msg_created,
            p.last_msg_id,
            p.cnt_unanswered,
            p.last_open_dt as lastOpenDt
        from t_prospect p
        inner join t_msg m on m.id = p.last_msg_id
        where p.user_id = $1 and (p.class <> $2 or p.class is null)
        and p.last_msg_id < $4
        order by p.last_msg_id desc, p.id desc
        limit $3
		`, [user_id, 'SPAM', limit, before_id]);
}

function getChatBySpId(id) {
    return db.one('select * from t_prospect where sitepower_id = $1', id);
}

function getChatById(id) {
    return db.one(`
		select
            p.created,
            p.id,
            p.sitepower_id,
            p.class,
            p.full_name as name,
            p.phone,
            p.login,
            m.body as last_msg_body,
            m.created as last_msg_created,
            p.last_msg_id,
            p.cnt_unanswered,
            p.last_open_dt as lastOpenDt
        from t_prospect p
        inner join t_msg m on m.id = p.last_msg_id
        where p.id = $1 and (p.class <> $2 or p.class is null)
        `, [id, 'SPAM']);
}

function getUserBySPId(sitepower_id) {
    return db.one('select * from t_user where sitepower_id = $1', sitepower_id);
}

function createProspect(user_id, name) {
    return db.one('insert into t_prospect (user_id, full_name) values($1, $2) returning sitepower_id', [user_id, name]);
}

function updateProspectChatId(sitepower_id, chat_id) {
    console.log("updateProspectChatId [sitepower_id = " + sitepower_id + "] [chat_id = " + chat_id + "]");
    return db.none('update t_prospect set chat_id = $1 where sitepower_id = $2', [chat_id, sitepower_id]);
}
function updateLastMessageOperator(id, msg_id, direction, operator_id) {
    return db.none('update t_prospect set last_msg_id = $2, operator_id = case when $3 = \'from_user\' then $4 else operator_id end where id = $1', [id, msg_id, direction, operator_id]);
}

function setCountUnanswered(id, direction) {
    return db.none('update t_prospect set cnt_unanswered = case when $2 = \'from_user\' then 0 else cnt_unanswered + 1 end where id = $1', [id, direction]);
}

function updateLastOpen(sitepower_id, dt) {
    return db.none('update t_prospect set last_open_dt = $1 where sitepower_id = $2', [dt, sitepower_id]);
}
function updateClass(sitepower_id, class_name) {
    return db.none('update t_prospect set class = $1 where sitepower_id = $2', [class_name, sitepower_id]);
}


function updateContact(sitepower_id, name, login, phone) {
    return db.none('update t_prospect set full_name = $2, login = $3, phone = $4 where sitepower_id = $1', [sitepower_id, name, login, phone]);
}

function getProspectUserBySPId(sitepower_id) {
    console.log("getProspectUserBySPId");
    return db.one('select user_id from t_prospect where sitepower_id = $1', sitepower_id);
}


function getChatIdByUserId(user_id) {
    console.log("getChatIdByUserId [user_id = " + user_id + "]");
    return db.one('select chat_id from t_user where id = $1', user_id);
}

function uploadFile(key, filename) {
    console.log("uploadFile");
    return db.one('insert into t_file ("key", filename) values($1, $2) returning uuid', [key, filename]);
}

function getFileByUUId(uuid) {
    console.log("uploadFile");
    return db.one('select "key", filename from t_file where uuid=$1', uuid);
}

function createMessage(prospect_id, body, type, link, operator_id, direction) {
    return db.one('insert into t_msg (prospect_id, body, type, link, operator_id, direction)' +
        ' values($1, $2, $3, $4, $5, $6) returning id', [prospect_id, body, type, link, operator_id, direction]);
}

function getMessageById(id) {
    console.log("getMessageById id = " + id);
    return db.one(`
        select
            m.id,
            m.created,
            m.body,
            m.type,
            m.link,
            m.direction,
            m.operator_id,
            o.name,
            case when m.direction = 'from_user' then p.sitepower_id else u.sitepower_id end recepient_id,
            case when m.direction = 'from_user' then u.sitepower_id else p.sitepower_id end sender_id
        from t_msg m
        inner join t_prospect p on m.prospect_id = p.id
        inner join t_user u on p.user_id = u.id
        left join t_user o on m.operator_id = o.id
        where m.id = $1
		`, id);
}

function getMessagesByChatId(sitepower_id) {
    console.log("getMessageById id = " + sitepower_id);
    return db.any(
        'select ' +
        '    m.id, ' +
        '    m.created, ' +
        '    m.body, ' +
        '    m.type, ' +
        '    m.link, ' +
        '    m.direction, ' +
        '    m.operator_id, ' +
        '    o.name as operator_name, ' +
        '    case when m.direction = \'from_user\' then p.sitepower_id else u.sitepower_id end recepient_id, ' +
        '    case when m.direction = \'from_user\' then u.sitepower_id else p.sitepower_id end sender_id ' +
        'from t_msg m ' +
        'inner join t_prospect p on m.prospect_id = p.id ' +
        'inner join t_user u on p.user_id = u.id ' +
        'left join t_user o on m.operator_id = o.id ' +
        'where p.sitepower_id = $1 ' +
        'order by m.id asc', sitepower_id);
}
