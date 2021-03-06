CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
ALTER TABLE t_user ALTER COLUMN sitepower_id SET NOT NULL;
ALTER TABLE t_user ALTER COLUMN sitepower_id SET DEFAULT uuid_generate_v1();
ALTER TABLE t_user ALTER COLUMN sitepower_id TYPE VARCHAR(36);

ALTER TABLE t_prospect ALTER COLUMN sitepower_id SET NOT NULL;
ALTER TABLE t_prospect ALTER COLUMN sitepower_id SET DEFAULT uuid_generate_v1();
ALTER TABLE t_prospect ALTER COLUMN sitepower_id TYPE VARCHAR(36);

ALTER TABLE t_prospect DROP COLUMN chat_id;
ALTER TABLE t_user DROP COLUMN chat_id;

ALTER TABLE t_user ADD COLUMN parent_id integer;
ALTER TABLE t_user ADD COLUMN date_ending DATE default current_date + 30;

create sequence t_file_id_seq
  as integer
  maxvalue 2147483647;

alter sequence t_file_id_seq owner to postgres;

CREATE TABLE t_file (
                      id  integer DEFAULT nextval('t_file_id_seq'::regclass),
                      uuid  varchar(36) DEFAULT uuid_generate_v1(),
                      key varchar(1000)  not null,
                      filename varchar(1000)   not null
);

create unique index t_file_id_uindex
  on t_file (id);
create unique index t_file_uuid_uindex
  on t_file (uuid);

ALTER TABLE t_prospect drop column chat;

ALTER TABLE t_prospect add column class VARCHAR(10);
ALTER TABLE t_prospect add column full_name VARCHAR(1000);
ALTER TABLE t_prospect add column last_open_dt TIMESTAMP DEFAULT now();
ALTER TABLE t_prospect add column phone varchar(100);
ALTER TABLE t_form add column created  TIMESTAMPTZ DEFAULT now() not null;
ALTER TABLE t_form add column color VARCHAR(100) DEFAULT 'black' not null;
ALTER TABLE t_form add column gradient int DEFAULT 0 not null;

ALTER TABLE t_form add column position int DEFAULT 0 not null;
ALTER TABLE t_form add column label VARCHAR(100) DEFAULT 'Задайте вопрос в наш чат!' not null;
ALTER TABLE t_form add column message_placeholder VARCHAR(100) DEFAULT 'Введите сообщение...' not null;
ALTER TABLE t_form drop column form;
ALTER TABLE t_form add column sitepower_id varchar(36) DEFAULT uuid_generate_v1();

create index t_form_sp_index on t_form (sitepower_id);
create index t_user_parent_id_index on t_user (parent_id);

ALTER TABLE t_user ADD COLUMN admin int DEFAULT 1 not null;
ALTER TABLE t_user DROP COLUMN created;
ALTER TABLE t_user ADD COLUMN created TIMESTAMPTZ DEFAULT now() not null;

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE t_user ADD COLUMN updated TIMESTAMPTZ DEFAULT now() not null;

CREATE TRIGGER set_timestamp_t_user
BEFORE UPDATE ON t_user
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE t_prospect add column last_msg JSON;
ALTER TABLE t_prospect add column cnt_unanswered int default 0;
ALTER TABLE t_prospect ADD COLUMN updated TIMESTAMPTZ DEFAULT now() not null;

CREATE TRIGGER set_timestamp_t_prospect
BEFORE UPDATE ON t_prospect
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE t_prospect DROP COLUMN created;
ALTER TABLE t_prospect ADD COLUMN created TIMESTAMPTZ DEFAULT now() not null;
ALTER TABLE t_prospect DROP COLUMN last_open_dt;
ALTER TABLE t_prospect ADD COLUMN last_open_dt TIMESTAMPTZ DEFAULT now() not null;
ALTER TABLE t_prospect ADD COLUMN last_msg_id bigint default -1;

create sequence t_message_id_seq
  as bigint
  maxvalue 9223372036854775807;

ALTER TABLE t_prospect DROP COLUMN last_msg;
create table t_msg
(
	id bigserial not null,
	created TIMESTAMPTZ default now() not null,
	body VARCHAR(2000),
	type varchar(100),
	link varchar(1000),
	direction varchar(10),
	updated TIMESTAMPTZ default now(),
	operator_id int,
	prospect_id int
);

create index t_msg_created_index
	on t_msg (created desc);

create unique index t_msg_id_uindex
	on t_msg (id);

create index t_msg_prospect_index
	on t_msg (prospect_id);

alter table t_msg
	add constraint t_msg_pk
		primary key (id);


ALTER TABLE t_prospect ADD COLUMN operator_id int;
create index t_prospect_operator_id_index
	on t_prospect (operator_id asc);

ALTER TABLE t_prospect ADD COLUMN region varchar(1000);
/*     DONE       */

create sequence t_user_device_id_seq
  as integer
  maxvalue 2147483647;

alter sequence t_user_device_id_seq owner to postgres;


create table t_user_device (
  id integer DEFAULT nextval('t_user_device_id_seq'::regclass),
  user_id integer not null,
  device_id varchar(100) not null,
  platform  varchar(100) not null,
  created TIMESTAMPTZ default now() not null,
);

create index t_user_device_user_id_index
	on t_user_device (user_id asc);

create index t_user_device_device_id_index
	on t_user_device (device_id asc);

alter table t_user_device
	add constraint t_user_device_pk
		primary key (id);

create unique index t_user_device_uindex
  on t_user_device (device_id);

alter table t_user_device alter column device_id type varchar(2000);

alter table t_user add column status int default 1;

create index t_msg_operator_index
  on t_msg (operator_id);

alter table t_user drop column admin;

alter table t_user drop column date_ending;
alter table t_user add column days_amount int default 30;
update t_user set days_amount = -1 where parent_id is not null;
create table t_job_log (
  created TIMESTAMPTZ default now() not null,
  info JSON
);
ALTER TABLE t_form drop column color;
ALTER TABLE t_form drop column gradient;
ALTER TABLE t_form add column color VARCHAR(100) DEFAULT 'sitepower' not null;
ALTER TABLE t_form add column gradient int DEFAULT 1 not null;

ALTER TABLE t_form drop column label;
ALTER TABLE t_form add column label VARCHAR(100) DEFAULT 'Напишите нам!' not null;

ALTER TABLE t_form add column test VARCHAR(1) DEFAULT 'N';


create sequence t_payment_id_seq
  as integer
  maxvalue 2147483647;

alter sequence t_payment_id_seq owner to postgres;


CREATE TABLE t_payment (
     id integer DEFAULT nextval('t_payment_id_seq'::regclass),
     created TIMESTAMPTZ default now() not null,
     sitepower_id varchar(36) DEFAULT uuid_generate_v1(),
     cnt_operators integer,
     cnt_days integer,
     amount numeric(22,2)
);
create index t_payment_index
  on t_payment (sitepower_id);

create unique index t_payment_id_index
  on t_payment (id);
ALTER TABLE t_payment add column status int DEFAULT 0;

ALTER TABLE t_payment add column user_id int not null;
create index t_payment_user_id_index
  on t_payment (user_id);

ALTER TABLE t_payment add column ya_id varchar(36);
create index t_payment_ya_id_index
  on t_payment (ya_id);

ALTER TABLE t_payment drop column status;
ALTER TABLE t_payment add column status varchar(100)  default 'new';

ALTER TABLE t_prospect add column form_id int;
update t_prospect set form_id=8 /*?????*/
where form_id is null

alter table t_form add column vk_group_id INT;
alter table t_form add column vk_token varchar(100);
alter table t_form add column type varchar(30) default 'site';
alter table t_form add column status int default 1;
create unique index t_form_vk_id_index
  on t_form (vk_group_id);
alter table t_form add column vk_confirm varchar(100);
alter table t_prospect add column vk_from_id INT;
create index t_prospect_vk_from_id_index
  on t_prospect (vk_from_id);
alter table t_form add column vk_server_id int;

create sequence t_alice_sentence_id_seq
  as integer
  maxvalue 2147483647;

alter sequence t_alice_sentence_id_seq owner to postgres;
create table t_alice_sentence (
      id integer DEFAULT nextval('t_alice_sentence_id_seq'::regclass),
      created TIMESTAMPTZ default now() not null,
      updated TIMESTAMPTZ default now() not null,
      skill_id varchar(36),
      flag varchar(1),
      sentence JSON,
      reply_attr JSON
);

CREATE TRIGGER set_timestamp_t_alice_sentence
  BEFORE UPDATE ON t_alice_sentence
  FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

alter table t_alice_sentence
  add constraint t_alice_sentence_pk
    primary key (id);

create index t_alice_sentence_index
  on t_alice_sentence (skill_id);

alter table t_alice_sentence add column next_id INT;
alter table t_alice_sentence add column sentence_error JSON;

create table t_alice_log (
    session_id varchar(36),
    created TIMESTAMPTZ default now() not null,
    type  varchar(100),
    body  JSON
);

alter table t_alice_log add column skill_id varchar(36);
alter table t_alice_log add column updated TIMESTAMPTZ default now() not null;

CREATE TRIGGER set_timestamp_t_alice_log
  BEFORE UPDATE ON t_alice_log
  FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

alter table t_alice_log add column ping varchar(1) default 'N';

create index t_alice_log_skill_id_ping_index
  on t_alice_log (skill_id, type, ping);

alter table t_alice_log add column text varchar(4000);


alter table t_alice_sentence add column next_decl JSON;
/*     DONE       */
create sequence t_train_item_id_seq
  as integer
  maxvalue 2147483647;

create table t_train_item (
       id integer DEFAULT nextval('t_train_item_id_seq'::regclass),
       created TIMESTAMPTZ default now() not null,
       updated TIMESTAMPTZ default now() not null,
       train_num integer,
       user_id integer not null,
       status varchar(100) default 'NEW' not null,
       name varchar(1000),
       next_id integer not null,
       train_obj json,
       fact_obj json,
       finish_dt TIMESTAMPTZ
);

CREATE TRIGGER set_timestamp_t_train_item
  BEFORE UPDATE ON t_train_item
  FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

alter table t_train_item
  add constraint t_train_item_pk
    primary key (id);

create unique index t_train_item_num
  on t_train_item (train_num);

create index t_train_item_user_id
  on t_train_item (user_id);

create index t_train_item_created
  on t_train_item (created);

alter table t_alice_sentence add column next_decl_oth_handler varchar(100);
