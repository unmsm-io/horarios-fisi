# Tasks

## 1. Migración del Esquema de Datos e Identificadores

- [x] 1.1 Actualizar el esquema de `app_users` en `src/lib/data/schedule-db.ts` sustituyendo `clerk_user_id` por `ldap_uid` como clave primaria, agregando los campos de referencia institucional (`auth_user_id`, `auth_account_id`, `code`, `institutional_roles`, `account_status`) y actualizando las claves foráneas en `teacher_profiles` y `schedule_events`. Verificar ejecutando `bun run db:migrate --demo` y comprobando que `verifyScheduleSchema` reporte todas las tablas como válidas.
- [x] 1.2 Refactorizar los tipos de dominio en `src/lib/domain/types.ts` reemplazando `clerkUserId` por `ldapUid` y actualizando `ScheduleIdentity`, `ScheduleUser` y `SchedulePayload`. Verificar ejecutando `bun run typecheck`.
- [x] 1.3 Adaptar los datos semilla en `src/lib/data/schedule-db.ts` y helpers de prueba en `src/lib/data/test-helpers.ts` para utilizar identificadores `ldap_uid` representativos. Verificar ejecutando la suite de pruebas con `bun test`.

## 2. Cliente del Microservicio y Gestión de Sesión BFF

- [x] 2.1 Implementar `src/lib/auth/auth-service-client.ts` para consumir los endpoints `/api/v1/auth/login`, `/api/v1/auth/refresh` y `/api/v1/auth/logout` de `av-auth-microservice` con `systemCode: "HORARIOS_FISI"` y normalización de correo a nombre de usuario LDAP. Escribir pruebas unitarias en `src/lib/auth/auth-service-client.test.ts` y verificar con `bun test`.
- [x] 2.2 Implementar `src/lib/auth/session.ts` para sellar, validar y revocar la cookie de sesión BFF `HttpOnly` (`Path=/`, `SameSite=Lax`) utilizando `AUTH_SESSION_SECRET` (omitiendo `AUTH_SERVICE_JWT_SECRET`). Escribir pruebas unitarias en `src/lib/auth/session.test.ts` y verificar con `bun test`.
- [x] 2.3 Implementar la resolución jerárquica de roles en `src/lib/auth/roles.ts` (`ADMIN` $\rightarrow$ `admin`, `DIRECTOR_ESCUELA`/`DEPARTAMENTO` $\rightarrow$ `direccion`, `DOCENTE` $\rightarrow$ `docente`). Escribir pruebas unitarias cubriendo roles únicos, combinados y denegados, y verificar con `bun test`.

## 3. Endpoints de Autenticación y Sincronización JIT

- [x] 3.1 Crear endpoints o Server Actions de autenticación (`/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`) que gestionen el inicio de sesión, emisión y eliminación de cookies de sesión, y ejecuten la sincronización Just-In-Time del usuario en `app_users`. Verificar el flujo con pruebas unitarias o de integración.
- [x] 3.2 Actualizar `src/lib/auth/schedule-identity.ts` para resolver la identidad del usuario desde la sesión BFF de Next.js, ejecutando renovación transparente cuando el token esté por expirar. Verificar mediante pruebas unitarias en `src/lib/auth/schedule-identity.test.ts`.

## 4. Middleware y Protección de Rutas

- [x] 4.1 Reemplazar `clerkMiddleware` en `src/proxy.ts` por un middleware nativo de Next.js que inspeccione la sesión BFF, redirija solicitudes no autenticadas a `/sign-in` y canalice usuarios autenticados según su rol efectivo. Verificar la redirección con pruebas unitarias.
- [x] 4.2 Actualizar la página raíz `src/app/page.tsx` para determinar la redirección inicial a `/teacher` o `/direction` en base a la sesión BFF. Verificar el comportamiento con pruebas.

## 5. Interfaz de Usuario y Experiencia Institucional

- [x] 5.1 Rediseñar la página `/sign-in` (`src/app/sign-in/[[...sign-in]]/page.tsx`) con un formulario nativo institucional UNMSM/FISI (usuario o correo LDAP, contraseña, retroalimentación de errores y accesibilidad). Verificar el renderizado en el navegador y pruebas de componentes.
- [x] 5.2 Sustituir `<UserButton />`, `<SignInButton />` y `<SignOutButton />` en `src/components/schedule-app.tsx` por un dropdown nativo con datos de perfil docente y botón de cierre de sesión. Verificar la interacción en cliente.
- [x] 5.3 Remover `<ClerkProvider>` en `src/components/app-providers.tsx` y eliminar importaciones de estilos de Clerk en `src/app/globals.css`. Verificar que la aplicación compile y renderice correctamente.

## 6. Limpieza de Dependencias y Validación Final

- [x] 6.1 Eliminar las dependencias `@clerk/nextjs` y `@clerk/ui` de `package.json`, borrar el webhook `src/app/api/webhooks/clerk/route.ts` y depurar scripts obsoletos de Clerk en `scripts/`. Verificar que no queden referencias a `@clerk` en el código fuente mediante búsqueda global.
- [x] 6.2 Actualizar `.env.example`, `.github/workflows/ci.yml` y documentación técnica (`README.md` y nuevo ADR sustituyendo a `0003-clerk-roles.md`). Verificar la integridad global del proyecto ejecutando `bun run check`.
