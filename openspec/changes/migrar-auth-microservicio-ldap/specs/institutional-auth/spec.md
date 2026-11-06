# Spec Delta

## Purpose

Proporciona autenticación institucional centralizada a través del microservicio de autenticación FISI y servidor LDAP, gestionando sesiones seguras mediante el patrón BFF en Next.js, resolución jerárquica de roles y sincronización Just-In-Time de usuarios para el sistema Horarios FISI.

## ADDED Requirements

### Requirement: Institutional Credential Authentication
El sistema SHALL autenticar a los usuarios contra el microservicio de autenticación institucional (`POST /api/v1/auth/login`) enviando el identificador del usuario, la contraseña LDAP y el código de sistema `HORARIOS_FISI`.

#### Scenario: Successful authentication with username
- **WHEN** un docente o directivo ingresa su nombre de usuario LDAP válido (ej. `lmotaa`) y su contraseña correcta
- **THEN** el sistema completa la autenticación exitosamente, emite la sesión BFF y responde con HTTP 200

#### Scenario: Successful authentication with institutional email
- **WHEN** un usuario ingresa su correo institucional completo (ej. `lmotaa@unmsm.edu.pe`) y su contraseña correcta
- **THEN** el sistema normaliza el correo extrayendo el nombre de usuario LDAP (`lmotaa`) antes de invocar al microservicio y completa la autenticación

#### Scenario: Invalid credentials
- **WHEN** un usuario ingresa credenciales inválidas o no reconocidas por el servidor LDAP
- **THEN** el microservicio responde con error 401 Unauthorized y el sistema muestra un mensaje de credenciales incorrectas sin revelar detalles del directorio

#### Scenario: Unauthorized system access
- **WHEN** un usuario institucional autenticado en LDAP no posee ningún rol asignado en la base de datos para el sistema `HORARIOS_FISI`
- **THEN** el sistema deniega el acceso con error 403 Forbidden y presenta un mensaje indicando que no cuenta con asignación en el sistema y debe contactar a soporte

#### Scenario: Inactive or suspended institutional account
- **WHEN** un usuario posee una cuenta institucional con estado `SUSPENDIDO` o `ELIMINADO`
- **THEN** el sistema deniega el acceso con error 403 Forbidden informando el estado de la cuenta

### Requirement: BFF Session Lifecycle and Silent Token Refresh
El sistema SHALL mantener la sesión del usuario mediante una cookie `HttpOnly` y `SameSite=Lax` administrada por Next.js usando `AUTH_SESSION_SECRET`. El servidor BFF SHALL renovar transparentemente los tokens expirados invocando `/api/v1/auth/refresh` con el Refresh Token antes de atender peticiones del usuario.

#### Scenario: Session establishment on login
- **WHEN** el usuario se autentica exitosamente contra el microservicio
- **THEN** el BFF de Next.js genera una cookie de sesión sellada conteniendo los tokens y datos de identidad, configurada con flags `HttpOnly`, `Path=/` y `SameSite=Lax`

#### Scenario: Transparent access token renewal
- **WHEN** un usuario autenticado realiza una petición con un Access Token expirado o próximo a expirar (menor a 2 minutos) pero con un Refresh Token válido
- **THEN** el BFF invoca silenciosamente `POST /api/v1/auth/refresh` al microservicio, obtiene un nuevo Access Token, actualiza la cookie de sesión y atiende la petición original sin interrupciones

#### Scenario: Expired or revoked refresh token
- **WHEN** el Refresh Token almacenado en la sesión ha expirado o ha sido revocado en el microservicio
- **THEN** el BFF destruye la cookie de sesión y redirige al usuario a `/sign-in` solicitando un nuevo inicio de sesión

#### Scenario: Explicit user logout
- **WHEN** el usuario hace clic en la acción de "Cerrar sesión"
- **THEN** el BFF invoca `POST /api/v1/auth/logout` al microservicio para revocar los tokens, elimina la cookie de sesión del navegador y redirige a la página principal

### Requirement: Hierarchical Role Resolution for Horarios FISI
El sistema SHALL evaluar el arreglo de roles provisto por el microservicio para el sistema `HORARIOS_FISI` y mapearlo al rol efectivo de la aplicación siguiendo una jerarquía estricta: `ADMIN` $\rightarrow$ `admin`, `DIRECTOR_ESCUELA` o `DEPARTAMENTO` $\rightarrow$ `direccion`, y `DOCENTE` $\rightarrow$ `docente`.

#### Scenario: User with ADMIN role resolves to admin
- **WHEN** los roles del usuario incluyen `ADMIN`
- **THEN** el sistema asigna el rol efectivo `admin` otorgando acceso a la administración global de horarios y usuarios

#### Scenario: User with DIRECTOR_ESCUELA or DEPARTAMENTO resolves to direccion
- **WHEN** los roles del usuario incluyen `DIRECTOR_ESCUELA` o `DEPARTAMENTO` y no incluyen `ADMIN`
- **THEN** el sistema asigna el rol efectivo `direccion` permitiendo la revisión y aprobación de horarios en su departamento académico

#### Scenario: User with DOCENTE role resolves to docente
- **WHEN** los roles del usuario incluyen exclusivamente `DOCENTE`
- **THEN** el sistema asigna el rol efectivo `docente` permitiendo el registro y envío de disponibilidad horaria

#### Scenario: User with multiple roles resolves to highest privilege
- **WHEN** un usuario posee múltiples roles para `HORARIOS_FISI` (ej. `["DOCENTE", "DIRECTOR_ESCUELA"]`)
- **THEN** el sistema asigna el rol efectivo de mayor privilegio (`direccion`), vinculando simultáneamente su perfil oficial de docente si está registrado en la plantilla docente

### Requirement: Just-In-Time Institutional User Synchronization
Al autenticarse exitosamente, el sistema SHALL sincronizar los datos del usuario en la tabla local `app_users` utilizando `ldap_uid` como identificador primario, persistiendo su código de usuario, correo institucional, roles institucionales y vinculándolo con su perfil docente en `teacher_profiles`.

#### Scenario: New user first-time login
- **WHEN** un usuario institucional inicia sesión por primera vez en el sistema de horarios
- **THEN** el sistema inserta un nuevo registro en `app_users` con su `ldap_uid`, nombre completo, correo institucional, roles y estado de cuenta, vinculando su perfil docente oficial si coincide por correo o código

#### Scenario: Returning user login updates metadata
- **WHEN** un usuario existente inicia sesión nuevamente
- **THEN** el sistema actualiza su nombre, roles institucionales asignados y marca de tiempo `last_seen_at` en `app_users`

#### Scenario: Automatic linkage to existing official teacher profile
- **WHEN** el correo o código institucional del usuario coincide con un registro precargado en `teacher_profiles`
- **THEN** el sistema vincula el `ldap_uid` del usuario al perfil docente correspondiente, permitiéndole operar en modo oficial

### Requirement: Route Protection and Access Redirection
El middleware de Next.js SHALL verificar la validez de la sesión BFF en cada solicitud a rutas protegidas, redirigiendo solicitudes no autenticadas a `/sign-in` y canalizando a los usuarios autenticados a la vista correspondiente según su rol efectivo.

#### Scenario: Unauthenticated request to protected route
- **WHEN** un usuario sin sesión activa intenta acceder a `/teacher`, `/direction` o `/onboarding`
- **THEN** el middleware intercepta la solicitud y redirige inmediatamente al usuario a `/sign-in`

#### Scenario: Authenticated docente visiting root redirects to teacher portal
- **WHEN** un usuario autenticado con rol efectivo `docente` visita la ruta raíz `/`
- **THEN** el sistema lo redirige automáticamente a `/teacher`

#### Scenario: Authenticated direccion or admin visiting root redirects to direction portal
- **WHEN** un usuario autenticado con rol efectivo `direccion` o `admin` visita la ruta raíz `/`
- **THEN** el sistema lo redirige automáticamente a `/direction`

#### Scenario: Authenticated user visiting sign-in page
- **WHEN** un usuario con sesión activa navega a `/sign-in`
- **THEN** el sistema lo redirige a la ruta principal que corresponde a su rol efectivo sin mostrar el formulario de login
