# ADR 0004: Institutional LDAP Authentication via Microservice and Next.js BFF

## Context

The system previously used Clerk as an external SaaS identity provider (ADR 0003). To integrate seamlessly with UNMSM institutional infrastructure, single sign-on with institutional credentials (`@unmsm.edu.pe` and LDAP UID) was required. The faculty deployed `av-auth-microservice`, a self-hosted microservice providing central authentication against the university's institutional LDAP directory with role and system authorization (`HORARIOS_FISI`).

## Decision

Migrate from Clerk to `av-auth-microservice` using a Next.js Backend-For-Frontend (BFF) pattern:

1. **BFF Session Management**:
   Next.js manages sessions via an encrypted/sealed HTTP-only cookie (`horarios_session`) signed with AES-GCM (256-bit) using `AUTH_SESSION_SECRET`. The client browser never receives raw access/refresh JWT tokens.
   Next.js server endpoints (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`) communicate directly with `av-auth-microservice` server-to-server. Verification and token lifecycle are handled upstream by the microservice; `AUTH_SERVICE_JWT_SECRET` is intentionally omitted from Next.js.

2. **Primary Identity Identifier**:
   `app_users.ldap_uid` is the primary key (replacing `clerk_user_id`). Institutional reference columns (`auth_user_id`, `auth_account_id`, `code`, `institutional_roles text[]`, `account_status`) are preserved for auditability and event synchronization.

3. **Hierarchical Role Resolution**:
   The microservice returns roles scoped to `HORARIOS_FISI`:
   - `ADMIN` $\rightarrow$ `admin`
   - `DIRECTOR_ESCUELA`, `DEPARTAMENTO` $\rightarrow$ `direccion`
   - `DOCENTE` $\rightarrow$ `docente`
   - Other or unassigned institutional roles are rejected with 403 Forbidden.

4. **Just-In-Time (JIT) User Synchronization**:
   Upon successful login through `/api/auth/login`, Next.js synchronizes the user profile in `app_users` and provisions `teacher_profiles` without requiring external webhooks.

## Consequences

- Full autonomy from external third-party SaaS identity providers.
- Direct alignment with UNMSM institutional identity and security policies.
- Elimination of external webhook dependencies (`/api/webhooks/clerk`, svix).
- Next.js acts as a secure BFF proxying authentication calls to `av-auth-microservice`.
