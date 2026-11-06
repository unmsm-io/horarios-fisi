# Horarios UNMSM

Open-source app for recording teacher availability, validating rules by contract type, and enabling administrative review with PDF/XLSX export.

## Stack

- Next.js 16
- React 19
- Microservicio de Autenticación Institucional (LDAP / av-auth-microservice)
- Neon Postgres
- shadcn/ui
- Tailwind CSS 4
- Bun
- Biome

## Documentation

- [docs/architecture.md](docs/architecture.md) - Overview, layers, authentication flow, naming conventions, and use as a template.
- [docs/data-model.md](docs/data-model.md) - Entity-relationship diagram, table dictionary, and domain invariants.
- [docs/adr/0001-nextjs-fullstack.md](docs/adr/0001-nextjs-fullstack.md) - Why Next.js full-stack instead of a separate backend.
- [docs/adr/0002-postgres-raw-sql.md](docs/adr/0002-postgres-raw-sql.md) - Why raw parameterized SQL instead of an ORM.
- [docs/adr/0004-institutional-ldap-auth.md](docs/adr/0004-institutional-ldap-auth.md) - Institutional LDAP authentication via Next.js BFF.

## Development

```bash
bun install
bun dev
```

Configure `.env.local` from `.env.example`. To prepare Neon:

```bash
bun run db:migrate
```

The migration creates the schema, verifies critical columns and constraints, and seeds only the base course catalog. Demo teachers are seeded only if you run `bun run db:migrate --demo`.

## Quality

```bash
bun run check
bun run smoke https://horarios-unmsm.vercel.app
```

### Database tests

The characterization tests in `src/lib/data/schedule-db.test.ts` require a dedicated Neon database. Never use the production URL.

To create a Neon branch exclusively for tests: `neonctl branches create --name tests --parent main --project-id <your-project>`.

Then run the full suite with:

```bash
TEST_DATABASE_URL=postgres://... bun run test
```

Without `TEST_DATABASE_URL`, the 18 DB tests are skipped automatically (`describe.skip`) and the rest of the suite stays green.

`bun run check` runs Biome, schedule-rule tests, and a production build. The smoke test validates protected routes and authentication state of the deployment.

For an operational verification against production:

```bash
vercel env pull /tmp/horarios-unmsm-prod.env --environment=production
neonctl connection-string <branch> --project-id <project> --role-name <app-role> --database-name neondb --pooled --ssl require --no-color > /tmp/horarios-unmsm-db.url
bun run ops:verify -- --vercel-env-file /tmp/horarios-unmsm-prod.env --database-url-file /tmp/horarios-unmsm-db.url --min-teachers 90 --min-linked-teachers 90 --min-active-courses 200
rm -f /tmp/horarios-unmsm-prod.env /tmp/horarios-unmsm-db.url
```

The verifier checks public routes, critical env vars, schema, Neon counts, and availability and slot invariants without printing secrets. `DATABASE_URL` is passed via a temporary file because in Vercel it must be marked as sensitive and `env pull` may return only a placeholder.

## Teacher Import

Study plans and the FISI registry do not include a teacher-course matrix. When the Direction office delivers that matrix, it is loaded with a validated CSV:

```csv
teacher_code,teacher_email,course_code,school,position
012345,docente@unmsm.edu.pe,202W0701,Ing. de Sistemas,1
```

Accepted columns for teacher: `teacher_id`, `teacher_code`, `teacher_email`. Accepted columns for course: `course_id`, `course_code`, `school`. If a course code exists in more than one school, the CSV must include `school` or `course_id`.

```bash
bun run db:import:teacher-courses carga-docente.csv
bun run db:import:teacher-courses carga-docente.csv --apply --replace-teachers
```

Without `--apply`, the importer only validates. With `--replace-teachers`, it replaces the load for the teachers included in the file and respects per-contract slot limits.

## Roles

Los roles efectivos se determinan a partir de los roles institucionales asignados en `av-auth-microservice` para el sistema `HORARIOS_FISI` y se sincronizan en `app_users`:

- `docente`: asignado desde el rol institucional `DOCENTE`. Registra su propia disponibilidad y cursos.
- `direccion`: asignado desde `DIRECTOR_ESCUELA` o `DEPARTAMENTO`. Permite la revisión y aprobación de horarios.
- `admin`: asignado desde `ADMIN`. Acceso total a Dirección, Usuarios, Auditoría y Configuración.

Los roles institucionales se administran centralizadamente en el microservicio de autenticación institucional.

## Features

- Autenticación institucional con credenciales LDAP UNMSM (`@unmsm.edu.pe`).
- Sincronización Just-In-Time (JIT) de usuarios y perfiles docentes al iniciar sesión.
- Sesiones cifradas seguras gestionadas por Next.js BFF con renovación proactiva de tokens.
- Registro de disponibilidad docente por bloques horarios.
- Validación de reglas por tipo de contrato (tiempo completo, tiempo parcial 20h y 10h).
- Catálogo de escuelas y cursos editable desde Administración.
- Búsqueda y filtros de cursos por escuela y estado.
- Vista de Dirección para revisión de disponibilidad docente.
- Búsqueda administrativa y filtros por docente, correo y estado.
- Gestión de usuarios y escuelas desde Administración.
- Filtros de usuarios por rol y estado de inducción.
- Cierre y apertura de periodo académico con congelación de disponibilidad.
- Observaciones administrativas e historial de eventos.
- Registro de auditoría institucional con exportación a CSV.
- Exportación de disponibilidad horaria a PDF y Excel.

## License

MIT
