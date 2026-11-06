# Design

## Context

El sistema Horarios FISI fue construido utilizando Next.js 16 (App Router) con soporte para Server Components, Middleware y Server Actions. Hasta ahora, la autenticación y la gestión de roles estaban delegadas a Clerk mediante `@clerk/nextjs`, protegiendo rutas en `src/proxy.ts` y persistiendo datos en PostgreSQL (`app_users`) con `clerk_user_id` como clave primaria.

El nuevo microservicio institucional (`av-auth-microservice`) implementa un esquema de autenticación que valida contraseñas contra un servidor LDAP y consulta una base de datos relacional PostgreSQL propia para comprobar cuentas institucionales activas y roles asignados por sistema (`system_rol`). El microservicio emite Access Tokens (JWT de 15 min, firmados con HMAC-SHA256) y Refresh Tokens (7 días) para la audiencia `aud: HORARIOS_FISI`.

Para más detalles sobre la motivación y alcance, consultar [proposal.md](proposal.md) y [specs/institutional-auth/spec.md](specs/institutional-auth/spec.md).

## Goals / Non-Goals

**Goals:**
- Implementar el patrón Backend-For-Frontend (BFF) en Next.js para gestionar el ciclo de vida de la sesión mediante cookies seguras `HttpOnly`, `SameSite=Lax` y `Path=/`.
- Proveer renovación transparente de tokens (silent refresh) en Server Components y Server Actions cuando el Access Token esté vencido o próximo a expirar (< 2 min).
- Reestructurar el esquema de base de datos de Horarios FISI bajo el **Enfoque A**: consolidar los datos de referencia institucional en `app_users` usando `ldap_uid` como clave primaria.
- Mapear jerárquicamente los roles de `HORARIOS_FISI` a los roles de la aplicación (`admin`, `direccion`, `docente`), preservando el arreglo crudo `institutional_roles` para auditoría y futuras reglas de alcance.
- Sustituir completamente las dependencias de Clerk por componentes UI nativos con diseño y tipografía de la UNMSM/FISI.
- Mantener la capacidad de desarrollo local y pruebas (mediante el servidor LDAP embebido del microservicio en modo dev y el modo preview existente).

**Non-Goals:**
- Implementar sincronización basada en eventos en tiempo real (webhooks / colas Kafka): en esta fase la sincronización es Just-In-Time (JIT) al momento del login.
- Validar criptográficamente la firma del JWT en Next.js mediante `AUTH_SERVICE_JWT_SECRET`: Next.js opera como BFF y confía en los tokens provistos y validados directamente por el microservicio en canal servidor a servidor.
- Proveer pantallas de administración de contraseñas LDAP o recuperación de credenciales (gestionadas centralmente por la universidad).

## Decisions

### 1. Patrón BFF en Next.js con Cookie de Sesión Sellada
* **Decisión**: Next.js actúa como Backend-For-Frontend. Expone endpoints internos (`/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`) o Server Actions que se comunican con `av-auth-microservice`. La sesión se mantiene en el navegador mediante una cookie `HttpOnly` sellada/cifrada localmente con `AUTH_SESSION_SECRET`.
* **Razón**: Next.js App Router renderiza páginas en el servidor (SSR). Si se usara una arquitectura SPA pura con tokens en memoria del cliente, el servidor no dispondría de las credenciales en la primera carga de `/teacher` o `/direction` para autorizar y canalizar al usuario.
* **Alternativas consideradas**:
  - *SPA puro*: Obligaría a cargar páginas en blanco en el cliente mientras un script de React pide el token y redirige, perdiendo los beneficios de SSR y protección en middleware.
  - *Pasar la cookie original con Path=/api/v1/auth*: El navegador no la enviaría a las rutas de navegación de Next.js (`/teacher`, `/direction`).

### 2. Omisión de `AUTH_SERVICE_JWT_SECRET`
* **Decisión**: Next.js no valida la firma HMAC del token JWT localmente ni requiere conocer el secreto del microservicio. Next.js decodifica el payload en base64 para leer claims de identidad (`sub`, `roles`, `exp`) y delega la validación estricta de vigencia y revocación al microservicio en cada llamada de refresh o consumo de APIs.
* **Razón**: Simplifica el despliegue desacoplando los secretos criptográficos de firma de tokens entre el microservicio y el frontend. La comunicación Next.js $\leftrightarrow$ Microservicio se realiza en un entorno de red seguro (servidor a servidor).
* **Alternativas consideradas**:
  - *Compartir la clave simétrica*: Introduciría acoplamiento de configuración innecesario para un microservicio con clave compartida HS256.

### 3. Enfoque A: Tabla de Referencia Consolidada en `app_users`
* **Decisión**: Modificar `app_users` para que `ldap_uid` sea su clave primaria, agregando los campos `auth_user_id`, `auth_account_id`, `code`, `institutional_roles` (`text[]`) y `account_status`.
* **Razón**: Evita la sobrecarga de replicar 5 tablas normalizadas del microservicio en la base de datos de horarios, manteniendo las consultas y relaciones de perfiles docentes (`teacher_profiles`) limpias y eficientes.
* **Alternativas consideradas**:
  - *Enfoque B (5 tablas réplica relacionales)*: Añadiría complejidad prematura dado que la sincronización por eventos se implementará en una fase posterior.

### 4. Mapeo Jerárquico de Roles
* **Decisión**:
  - Si el arreglo de roles del microservicio contiene `ADMIN` $\rightarrow$ `role = 'admin'`.
  - Si contiene `DIRECTOR_ESCUELA` o `DEPARTAMENTO` $\rightarrow$ `role = 'direccion'`.
  - Si contiene `DOCENTE` $\rightarrow$ `role = 'docente'`.
  - Si no contiene ninguno de los anteriores $\rightarrow$ denegación de acceso (403).
  Los roles institucionales originales se preservan en `app_users.institutional_roles`.
* **Razón**: Permite compatibilidad total con la lógica actual de permisos y estados (`canUseDirectionRole`, `teacherMode`) de `horarios-fisi`.

### 5. Reemplazo de Interfaz de Usuario (UI)
* **Decisión**: Construir un formulario de inicio de sesión nativo en `/sign-in` utilizando componentes basados en `@base-ui/react` / Tailwind CSS ya presentes en el proyecto, estilizado con el escudo UNMSM y la paleta institucional. El menú de usuario en el header se reemplaza por un dropdown nativo con datos del usuario y botón de cierre de sesión.
* **Razón**: Eliminar totalmente el bundle y estilos de `@clerk/ui` y `@clerk/nextjs`, reduciendo el tamaño del paquete y unificando el diseño visual.

## Architecture & Data Flow

```
+-----------------------------------------------------------------------------------------+
|                                    FLUJO DE AUTENTICACIÓN (BFF)                         |
+-----------------------------------------------------------------------------------------+

  [Navegador]                     [Next.js (BFF)]                    [av-auth-microservice]
       |                                 |                                      |
       | 1. POST /api/auth/login         |                                      |
       |    (username, password)         |                                      |
       |-------------------------------->| 2. POST /api/v1/auth/login           |
       |                                 |    (username, password, HORARIOS_...) |
       |                                 |------------------------------------->|
       |                                 |                                      |--+ 3. Valida LDAP
       |                                 |                                      |  |    y PostgreSQL
       |                                 | 4. 200 OK + JWT Tokens               |<-+
       |                                 |<-------------------------------------|
       |                                 |
       |                                 |--+ 5. JIT Sync en app_users (ldap_uid)
       |                                 |  |    y resuelve rol jerárquico
       | 6. 200 OK                       |<-+
       |    Set-Cookie: session_token    |
       |    (HttpOnly, SameSite=Lax)     |
       |<--------------------------------|
       |                                 |
       | 7. Navega a /teacher            |
       |    Cookie: session_token        |
       |-------------------------------->|
       |                                 |--+ 8. Middleware / Server Component
       |                                 |  |    lee sesión BFF y renderiza
       | 9. HTML renderizado             |<-+
       |<--------------------------------|
```

## Risks / Trade-offs

- **[Riesgo] Tamaño de la cookie de sesión BFF**: Empaquetar el Access Token y Refresh Token en una sola cookie cifrada podría superar los límites de cabecera HTTP (4KB).
  - *Mitigación*: Almacenar en la cookie de sesión únicamente los tokens JWT y los campos mínimos de identidad (`ldap_uid`, `role`, `name`, `email`), o comprimir/codificar de manera compacta el payload cifrado.
- **[Riesgo] Expiración de Access Token en medio de peticiones de Server Actions**:
  - *Mitigación*: Implementar una función centralizada de cliente de autenticación en Next.js que verifique el claim `exp`. Si restan menos de 120 segundos para expirar, realiza la llamada a `/api/v1/auth/refresh` proactivamente antes de completar la operación.
- **[Riesgo] Migración de claves foráneas en la base de datos**: Tablas como `teacher_profiles` y `schedule_events` referencian actualmente `clerk_user_id`.
  - *Mitigación*: Actualizar `ensureScheduleSchema` y el script de migración para renombrar la columna a `ldap_uid`. Dado que estamos en entorno de desarrollo/demo sobre Neon, se ajustan los datos semilla (`seedScheduleData`) con UIDs institucionales reales/demo.

## Migration Plan

1. **Esquema y Persistencia**: Actualizar definiciones de tabla en `src/lib/data/schedule-db.ts` para cambiar `clerk_user_id` por `ldap_uid` y añadir campos de referencia institucional. Actualizar scripts de migración y seed data.
2. **Cliente del Microservicio y Sesión BFF**: Implementar `src/lib/auth/auth-service-client.ts` para comunicarse con los endpoints del microservicio y `src/lib/auth/session.ts` para sellar/abrir cookies con `AUTH_SESSION_SECRET`.
3. **Endpoints de Autenticación y Server Actions**: Crear rutas de API (`/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`) o Server Actions equivalentes para el frontend.
4. **Middleware e Identidad**: Reemplazar `clerkMiddleware` en `src/proxy.ts` y actualizar `src/lib/auth/schedule-identity.ts`.
5. **Interfaz de Usuario**: Reemplazar `/sign-in` con el formulario institucional, actualizar la barra de navegación en `src/components/schedule-app.tsx` y eliminar `<ClerkProvider>` en `src/components/app-providers.tsx`.
6. **Limpieza de Dependencias**: Desinstalar paquetes `@clerk/nextjs` y `@clerk/ui`, eliminar `/api/webhooks/clerk` y actualizar `.env.example`.
7. **Verificación**: Ejecutar suite de pruebas unitarias (`bun test`) y verificar el ciclo completo de autenticación contra el servidor en modo dev.
