CREATE DATABASE "av_auth_microservice";

\c av_auth_microservice

CREATE TYPE "account_status" AS ENUM (
  'ACTIVO',
  'ELIMINADO',
  'SUSPENDIDO'
);

CREATE TYPE "role_enum" AS ENUM (
  'INVITADO',
  'DOCENTE',
  'DIRECTOR_ESCUELA',
  'DEPARTAMENTO',
  'ALUMNO',
  'ADMIN'
);

CREATE TABLE IF NOT EXISTS "user" (
  "id" BIGSERIAL NOT NULL UNIQUE,
  "code" VARCHAR(20) NOT NULL UNIQUE,
  "first_name" VARCHAR(120) NOT NULL,
  "last_name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "institutional_account" (
  "id" BIGSERIAL NOT NULL UNIQUE,
  "id_user" BIGINT NOT NULL,
  "ldap_uid" VARCHAR(30) NOT NULL,
  "institutional_email" VARCHAR(60) NOT NULL,
  "main" BOOLEAN DEFAULT FALSE,
  "account_status" ACCOUNT_STATUS DEFAULT 'ACTIVO',
  "updated_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "system" (
  "id" BIGSERIAL NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "description" VARCHAR(100),
  PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "role" (
  "id" BIGSERIAL NOT NULL,
  "code" ROLE_ENUM DEFAULT 'INVITADO',
  "name" VARCHAR(30) NOT NULL,
  "description" VARCHAR(100),
  PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "system_rol" (
  "id" BIGSERIAL NOT NULL,
  "id_system" BIGINT NOT NULL,
  "id_role" BIGINT NOT NULL,
  "id_institutional_account" BIGINT NOT NULL,
  PRIMARY KEY("id")
);

ALTER TABLE "institutional_account"
ADD FOREIGN KEY("id_user") REFERENCES "user"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "system_rol"
ADD FOREIGN KEY("id_system") REFERENCES "system"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "system_rol"
ADD FOREIGN KEY("id_role") REFERENCES "role"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "system_rol"
ADD FOREIGN KEY("id_institutional_account") REFERENCES "institutional_account"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;

