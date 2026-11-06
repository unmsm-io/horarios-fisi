# Flujo de Autenticación Híbrida (Tokens JWT y Cookies HttpOnly)

## 1. Visión General

El microservicio `av-auth-microservice` implementa un **enfoque híbrido de autenticación** diseñado para maximizar la seguridad en aplicaciones web (SPAs) y clientes institucionales (Moodle / Aula Virtual):

1. **Refresh Token en Cookie HttpOnly:**
   - Transportado exclusivamente en una cookie HTTP con directivas `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, y `Secure` condicionada al entorno (`false` en desarrollo bajo perfil `dev`, `true` en producción sobre HTTPS).
   - Inaccesible desde JavaScript en el navegador, mitigando de raíz el robo de credenciales de larga duración ante vulnerabilidades de Cross-Site Scripting (XSS).
2. **Access Token en Memoria y Cabecera Bearer:**
   - Retornado en el cuerpo de la respuesta (`AuthResponse`) para ser almacenado únicamente en la memoria volátil de la aplicación frontend (ej. estado de React/Vue), nunca en `localStorage` ni `sessionStorage`.
   - Transmitido a endpoints de recursos protegidos mediante la cabecera estándar `Authorization: Bearer <token>`, preservando la inmunidad contra ataques de Cross-Site Request Forgery (CSRF).
3. **CORS Controlado y Diferenciación por Perfil:**
   - Orígenes permitidos parametrizados mediante `CORS_ALLOWED_ORIGINS`.
   - Perfil `dev` (`APP_ENV=dev`, `@Profile("dev")`) para desarrollo local sobre HTTP y perfil no-dev para producción estricta.

---

## 2. Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Frontend as Cliente / SPA (Navegador)
    participant AuthCtrl as AuthController
    participant AuthService as AuthService
    participant LDAP as Servidor LDAP
    participant DB as PostgreSQL
    participant Revocation as TokenRevocationService

    %% ==========================================
    %% 1. INICIO DE SESIÓN (LOGIN)
    %% ==========================================
    Note over Usuario, DB: 1. Autenticación Inicial (Login)
    Usuario ->> Frontend: Ingresa credenciales (username, password, systemCode)
    Frontend ->> AuthCtrl: POST /api/v1/auth/login (JSON Body)
    AuthCtrl ->> AuthService: login(LoginRequest)
    AuthService ->> LDAP: authenticate(username, password)
    LDAP -->> AuthService: Credenciales válidas
    AuthService ->> DB: Verificar cuenta activa y roles en systemCode
    DB -->> AuthService: Cuenta y roles encontrados
    AuthService ->> AuthService: Generar Access Token (15 min) y Refresh Token (7 días)
    AuthService -->> AuthCtrl: AuthResponse (accessToken, refreshToken, user)
    AuthCtrl ->> AuthCtrl: Crear ResponseCookie(refreshToken, HttpOnly, SameSite=Strict, Path=/api/v1/auth)
    AuthCtrl -->> Frontend: HTTP 200 OK<br/>Set-Cookie: refreshToken=...#59; HttpOnly#59; SameSite=Strict#59; Path=/api/v1/auth<br/>Body: { data: { accessToken, user } }
    Frontend ->> Frontend: Guardar accessToken en memoria volátil (RAM)

    %% ==========================================
    %% 2. CONSUMO DE RECURSO PROTEGIDO
    %% ==========================================
    Note over Frontend, AuthCtrl: 2. Petición a Recurso Protegido
    Frontend ->> AuthCtrl: GET /api/v1/recurso-protegido<br/>Header: Authorization: Bearer [accessToken]
    AuthCtrl ->> AuthCtrl: Validar firma y claims en JwtAuthenticationFilter
    AuthCtrl -->> Frontend: HTTP 200 OK (Datos del recurso)

    %% ==========================================
    %% 3. RENOVACIÓN TRANSPARENTE (REFRESH)
    %% ==========================================
    Note over Frontend, DB: 3. Renovación de Sesión (Refresh Token)
    Note right of Frontend: Access Token expirado o renovación periódica
    Frontend ->> AuthCtrl: POST /api/v1/auth/refresh<br/>Cookie: refreshToken=... (automático por navegador)
    AuthCtrl ->> AuthCtrl: Extraer token desde Cookie (o fallback en body)
    AuthCtrl ->> AuthService: refreshToken(TokenRefreshRequest)
    AuthService ->> Revocation: isRevoked(refreshToken)
    Revocation -->> AuthService: false (token no revocado)
    AuthService ->> DB: Validar cuenta activa y obtener roles actualizados
    DB -->> AuthService: Cuenta y roles activos
    AuthService ->> AuthService: Generar nuevo Access Token (15 min)
    AuthService -->> AuthCtrl: TokenRefreshResponse (nuevo accessToken)
    AuthCtrl -->> Frontend: HTTP 200 OK<br/>Set-Cookie: refreshToken=... (renovación/rotación)<br/>Body: { data: { accessToken } }
    Frontend ->> Frontend: Actualizar accessToken en memoria

    %% ==========================================
    %% 4. CIERRE DE SESIÓN (LOGOUT)
    %% ==========================================
    Note over Usuario, Revocation: 4. Cierre de Sesión (Logout)
    Usuario ->> Frontend: Clic en "Cerrar Sesión"
    Frontend ->> AuthCtrl: POST /api/v1/auth/logout<br/>Cookie: refreshToken=...<br/>Header: Authorization: Bearer [accessToken]
    AuthCtrl ->> AuthService: logout(refreshToken, authHeader)
    AuthService ->> Revocation: revoke(refreshToken, 7 días)
    AuthService ->> Revocation: revoke(accessToken, 15 min)
    AuthCtrl ->> AuthCtrl: Crear ResponseCookie(refreshToken, Max-Age=0)
    AuthCtrl -->> Frontend: HTTP 200 OK<br/>Set-Cookie: refreshToken=#59; Max-Age=0#59; Path=/api/v1/auth<br/>Body: { success: true, message: 'Sesión cerrada exitosamente' }
    Frontend ->> Frontend: Limpiar accessToken de memoria volátil
```

---

## 3. Descripción de los Pasos

### Paso 1: Login
- El cliente envía credenciales mediante `POST /api/v1/auth/login`.
- Al validar exitosamente LDAP y los roles en PostgreSQL, el microservicio construye un `ResponseCookie` que encapsula el `refreshToken`.
- El cliente almacena el `accessToken` en memoria del estado de la aplicación (evitando `localStorage`).

### Paso 2: Consumo de APIs Protegidas
- Cada petición a endpoints de negocio incluye la cabecera `Authorization: Bearer <accessToken>`.
- Como los endpoints protegidos no dependen de cookies para autorizarse, la aplicación está protegida por diseño contra ataques CSRF.

### Paso 3: Renovación Automática de Tokens (Refresh)
- El cliente invoca `POST /api/v1/auth/refresh`. El navegador adjunta automáticamente la cookie `refreshToken` gracias a la directiva `Path=/api/v1/auth` y `credentials: 'include'`.
- El endpoint admite compatibilidad dual: si la cookie no está presente (por ejemplo en clientes no basados en navegador), extrae el token del cuerpo JSON (`TokenRefreshRequest`).
- Retorna un nuevo `accessToken` y actualiza la cookie en el navegador.

### Paso 4: Cierre de Sesión (Logout)
- Al invocar `POST /api/v1/auth/logout`, el microservicio registra los tokens en el `TokenRevocationService` y emite una cabecera `Set-Cookie` con `Max-Age=0`, provocando que el navegador destruya inmediatamente la cookie de refresco.

