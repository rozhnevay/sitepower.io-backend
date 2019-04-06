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

