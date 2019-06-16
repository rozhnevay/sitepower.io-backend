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
    createFormVk:createFormVk,
    getFormVkByGroupId:getFormVkByGroupId,
    updateFormVkToken:updateFormVkToken,
    updateFormVkConfirm:updateFormVkConfirm,
    updateUserPassword: updateUserPassword,
    getChatsByUserId:getChatsByUserId,
    getChatBySpId:getChatBySpId,
    updateUserChatId:updateUserChatId,
    getUserBySPId:getUserBySPId,
    createProspect:createProspect,
    createVkProspect:createVkProspect,
    getVkProspect:getVkProspect,
    updateFormVkServerComplete:updateFormVkServerComplete,
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
    getMessagesByChatId:getMessagesByChatId,
    setRegionByChatId:setRegionByChatId,
    createDeviceToken: createDeviceToken,
    deleteDeviceToken: deleteDeviceToken,
    getDeviceToken: getDeviceToken,
    getUserDevices:getUserDevices,
    blockOperator:blockOperator,
    insertJobLog:insertJobLog,
    getOperatorsCountByUser:getOperatorsCountByUser,
    decrementDaysAmount:decrementDaysAmount,
    incrementDaysAmount:incrementDaysAmount,
    createPayment:createPayment,
    updatePayment:updatePayment,
    updatePaymentByYaId:updatePaymentByYaId,
    getPaymentByYaId:getPaymentByYaId,
    getAliceFirstSentence:getAliceFirstSentence,
    getAliceSentence:getAliceSentence
};

function getUserByLogin(login) {
    return db.one(`
      select t.id, t.login, t.name, t.sitepower_id, t.parent_id, 
      t.created, t.updated, 
      p.sitepower_id as parent_sitepower_id, t.pass,
      t.days_amount,
      f.sitepower_id test_form_id
      from t_user t 
      left join t_user p on t.parent_id = p.id
      left join t_form f on f.user_id = t.id and f.test = 'Y'
      where t.login = $1`, login);
}

function getUserById(id) {
    return db.one(`
      select t.id, t.login, t.name, t.sitepower_id, t.parent_id, 
      t.created, t.updated, p.sitepower_id as parent_sitepower_id, 
      t.pass, t.days_amount,
      f.sitepower_id test_form_id
      from t_user t 
      left join t_user p on t.parent_id = p.id
      left join t_form f on f.user_id = t.id and f.test = 'Y'
      where t.id = $1`
    , id);
}

function createUser(login, pass, name) {
    return db.one('insert into t_user(login, pass, name) values($1, $2, $3) returning id', [login, pass, name]);
}
function createOperator(login, pass, user_id) {
    return db.one('insert into t_user(login, pass, parent_id, status, days_amount) values($1, $2, $3, -1, -1) returning id', [login, pass, user_id]);
}

function updateUserPassword(user_id, pass) {
    return db.none('update t_user set pass = $1 where id = $2', [pass, user_id]);
}

function updateUserNamePassword(user_id, name, pass) {
    return db.none('update t_user set pass = $1, name = $2, status = 1 where id = $3', [pass, name, user_id]);
}

function updateUserChatId(user_id, chat_id) {
    console.log("usser = " + user_id);
    return db.none('update t_user set chat_id = $1 where id = $2', [chat_id, user_id]);
}

function getFormsByUserId(user_id) {
    return db.any('select id, origin, color, gradient, label, position, message_placeholder, sitepower_id, created, test, type from t_form where user_id = $1 and status = 1', user_id);
}

function getOperators(user_id) {
    return db.any(`select 
                      login, 
                      name, 
                      case when parent_id is not null then 'N' else 'Y' end as admin, 
                      sitepower_id, 
                      created,
                      case status when 1 then 'Активный' when 0 then 'Заблокирован' when -1 then 'Отправлено приглашение' else 'Удален' end as status
                      from t_user 
                      where parent_id = $1 
                      or id = $1
                      order by status, created
                      `, user_id);
}

function blockOperator(id, block) {
    return db.none('update t_user set status = case when $2 then 0 else 1 end where sitepower_id = $1', [id, block]);
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

function createForm(user_id, origin, test) {
    return db.one('insert into t_form(user_id, origin, test) values($1, $2, $3) returning id', [user_id, origin, test]);
}

function createFormVk(user_id, origin, vk_group_id) {
    return db.one('insert into t_form(user_id, origin, type, status, vk_group_id) values($1, $2, $3, 0, $4) returning id', [user_id, origin, "vk", vk_group_id]);
}

function updateFormVkToken(id, token) {
    return db.none('update t_form set vk_token=$2 where vk_group_id=$1', [id, token]);
}

function updateFormVkConfirm(id, confirm) {
    return db.none('update t_form set vk_confirm=$2 where vk_group_id=$1', [id, confirm]);
}

function updateFormVkServerComplete(id, server_id) {
    return db.none('update t_form set vk_server_id=$2, status=1 where vk_group_id=$1', [id, server_id]);
}


function getFormVkByGroupId(id) {
    return db.any('select * from t_form where vk_group_id = $1', id);
}

function updateForm(id, user_id, form) {
    debug("updateForm", user_id, id, JSON.stringify(form));
    return db.none('update t_form set color = $3, gradient = $4, label = $5, message_placeholder = $6 where user_id=$1 AND id = $2', [user_id, id, form.color, form.gradient, form.label, form.message_placeholder]);
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
            p.last_open_dt as lastOpenDt,
            p.region,
            f.origin,
            f.type
        from t_prospect p
        inner join t_msg m on m.id = p.last_msg_id
        inner join t_form f on p.form_id = f.id
        where p.user_id = $1 and ((p.class <> $2 and p.class <> $5) or p.class is null)
        and p.last_msg_id < $4
        order by p.last_msg_id desc, p.id desc
        limit $3
		`, [user_id, 'SPAM', limit, before_id, 'DELETED']);
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
            p.last_open_dt as lastOpenDt,
            p.region,
            f.origin,
            f.type
        from t_prospect p
        inner join t_msg m on m.id = p.last_msg_id
        inner join t_form f on p.form_id = f.id
        where p.id = $1 and ((p.class <> $2 and p.class <> $3) or p.class is null)
        `, [id, 'SPAM', 'DELETED']);
}

function getUserBySPId(sitepower_id) {
    return db.one('select * from t_user where sitepower_id = $1', sitepower_id);
}

function createProspect(user_id, name, form_id) {
    return db.one('insert into t_prospect (user_id, full_name, form_id) values($1, $2, $3) returning sitepower_id', [user_id, name, form_id]);
}

function createVkProspect(user_id, vk_from_id, name, form_id) {
    return db.one('insert into t_prospect (user_id, full_name, form_id, vk_from_id, region) values($1, $3, $4, $2, "") returning sitepower_id', [user_id, vk_from_id, name, form_id]);
}

function getVkProspect(vk_from_id, form_id) {
    return db.one('select * from t_prospect where vk_from_id = $1 and form_id = $2', [vk_from_id, form_id]);
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


function setRegionByChatId(sitepower_id, region) {
    return db.none('update t_prospect set region = $1 where sitepower_id = $2', [region, sitepower_id]);
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

function createDeviceToken(user_id, device_id, platform) {
    return db.one('insert into t_user_device (user_id, device_id, platform)' +
        ' values($1, $2, $3) returning id', [user_id, device_id, platform]);
}

function deleteDeviceToken(device_id) {
    return db.none('delete from t_user_device where device_id = $1', device_id);
}

function getDeviceToken(device_id) {
    return db.any(`select * from t_user_device where device_id = $1`, [device_id]);
}

function getUserDevices(user_id) {
    console.log("getUserDevices user_id = " + user_id);
    return db.any(`
        select
            d.device_id
        from t_user_device d
        inner join t_user u on d.user_id = u.id
        inner join t_user par on (u.parent_id = par.id or u.id = par.id)
        where par.id = $1
		`, user_id);
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
            o.name as operator_name,
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

function insertJobLog(info) {
    return db.none(`insert into t_job_log(info) values ($1)`, info);
}

function getOperatorsCountByUser() {
    return db.any(`
     select
            u.id,
            count(1) as cnt
        from t_user u
        inner join t_user o on o.parent_id = u.id or o.id = u.id
        where u.days_amount > 0
        group by u.id
    `);
};

function decrementDaysAmount(user_id, cnt) {
    return db.none(`
     update t_user set days_amount = greatest(0, days_amount - $2) where id = $1
    `, [user_id, parseInt(cnt)]);
};

function incrementDaysAmount(user_id, cnt) {
    return db.none(`
     update t_user set days_amount = days_amount + $2 where id = $1
    `, [user_id, parseInt(cnt)]);
};

function createPayment (user_id, cnt_operators, cnt_days, amount) {
    return db.one('insert into t_payment (user_id, cnt_operators, cnt_days, amount) values($1, $2, $3, $4) returning sitepower_id', [user_id, cnt_operators, cnt_days, amount]);
}

function updatePayment (sitepower_id, ya_id, status) {
    return db.none(`update t_payment set ya_id = $2, status=$3 where sitepower_id=$1`, [sitepower_id, ya_id, status]);
}

function updatePaymentByYaId (ya_id, status) {
    return db.none(`update t_payment set status=$2 where ya_id=$1`, [ya_id, status]);
}


function getPaymentByYaId (ya_id) {
    return db.one(`select * from t_payment where ya_id=$1`, ya_id);
}


function getAliceFirstSentence(skill_id) {
    return db.one(`select * from t_alice_sentence where skill_id=$1 and flag='B'`, skill_id);
}


function getAliceSentence(sentence_id) {
    return db.one(`select * from t_alice_sentence where id=$1`, sentence_id);
}
