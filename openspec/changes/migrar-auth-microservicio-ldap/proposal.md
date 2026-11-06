# Proposal

## Why

Actualmente, Horarios FISI depende de Clerk como proveedor SaaS externo de autenticación y metadatos de roles. Para alinearse con la infraestructura tecnológica de la UNMSM, centralizar el control de acceso de la facultad y permitir que los docentes y directores inicien sesión directamente con sus credenciales institucionales, se migrará la autenticación a un microservicio institucional propio (`av-auth-microservice`) respaldado por el servidor LDAP de la universidad y su base de datos de autorización.

## What Changes

- **Autenticación Institucional e Integración LDAP**: Implementación de inicio de sesión con credenciales institucionales (usuario/correo LDAP y contraseña) contra el endpoint `/api/v1/auth/login` del microservicio para el sistema `HORARIOS_FISI`.
- **Arquitectura BFF (Backend-For-Frontend)**: Next.js asume la gestión de sesión mediante cookies `HttpOnly` selladas/cifradas localmente con `AUTH_SESSION_SECRET` (sin requerir compartir `AUTH_SERVICE_JWT_SECRET`), coordinando la renovación transparente de tokens (`/api/v1/auth/refresh`) y el cierre de sesión (`/api/v1/auth/logout`).
- **Mapeo y Resolución de Roles**: Conversión jerárquica de los roles devueltos por el microservicio (`ADMIN` $\rightarrow$ `admin`, `DIRECTOR_ESCUELA` o `DEPARTAMENTO` $\rightarrow$ `direccion`, `DOCENTE` $\rightarrow$ `docente`), denegando el acceso a cuentas sin rol asignado en `HORARIOS_FISI` (403 con mensaje de soporte).
- **Esquema de Datos y Referencia Institucional (Enfoque A)**: **BREAKING** Migración de la clave primaria y foráneas de `clerk_user_id` a `ldap_uid` en `app_users`, `teacher_profiles` y `schedule_events`. Incorporación en `app_users` de campos de referencia institucional (`auth_user_id`, `auth_account_id`, `code`, `institutional_roles`, `account_status`). Sincronización Just-In-Time (JIT) de perfil al iniciar sesión.
- **Reemplazo de Interfaz de Usuario (UI)**: **BREAKING** Sustitución del componente `<SignIn />` de Clerk por un formulario institucional nativo con diseño de UNMSM/FISI en `/sign-in`. Reemplazo de `<UserButton />` y `<SignOutButton />` por controles nativos en el encabezado.
- **Eliminación de Dependencias de Clerk**: **BREAKING** Desinstalación de `@clerk/nextjs` y `@clerk/ui`, eliminación de la ruta de webhook `/api/webhooks/clerk`, remoción de scripts asociados a metadatos de Clerk y actualización de variables de entorno.

## Capabilities

### New Capabilities
- `institutional-auth`: Autenticación con credenciales LDAP institucionales, gestión de sesiones BFF con cookies seguras, resolución jerárquica de roles para `HORARIOS_FISI`, sincronización Just-In-Time de usuarios en `app_users` y control de acceso en rutas protegidas.

### Modified Capabilities
<!-- None. Currently the project has no baseline specs. -->

## Impact

- **Código y Rutas**:
  - Sustitución de `clerkMiddleware` en `src/proxy.ts` por un middleware nativo de Next.js que valida la sesión BFF.
  - Reemplazo de `src/lib/auth/schedule-identity.ts` para resolver identidad desde la sesión BFF.
  - Rediseño de `src/app/sign-in/[[...sign-in]]/page.tsx` y componentes en `src/components/schedule-app.tsx`.
  - Eliminación de `src/app/api/webhooks/clerk/route.ts`.
  - Actualización de `src/lib/data/schedule-db.ts` y migraciones para reflejar `ldap_uid` y los nuevos campos institucionales.
- **Dependencias**: Remoción de `@clerk/nextjs` y `@clerk/ui`. Incorporación de utilidad ligera para sellado/cifrado de sesión BFF si aplica.
- **Configuración y Entorno**: Nuevas variables `AUTH_SERVICE_URL`, `AUTH_SYSTEM_CODE` y `AUTH_SESSION_SECRET`; eliminación de claves de Clerk.
