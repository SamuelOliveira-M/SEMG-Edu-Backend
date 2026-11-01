# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SEMG.Edu backend: an Express + TypeScript REST API (Postgres via Prisma 7) for a school-secretariat management app (schools, students, teachers, managers, classes, subjects, grades, calendar). Domain names are in Portuguese (Escola, Aluno, Professor, Gestor, Turma, Disciplina, Lotacao, ...). README is in Portuguese.

## Commands

- `npm run dev` — run with `tsx watch src/server.ts` (default port 3333, or `PORT`).
- `npm run build` — `npx prisma generate && tsc -p .` (output to `./build`).
- `npm start` — build, then `node ./build/server.js`.
- `npm test` (Vitest + Supertest), `npm run test:unit` (no DB needed), `npm run test:coverage`. Single file: `npx vitest run tests/integration/auth.test.ts`; single test: add `-t "<name>"`.
- Integration tests need a local Postgres. Without Docker: `npm run db:up` (embedded-postgres, port 5434, data in `.pgdata/`, creates `semg_dev` and `semg_test`; keep that terminal open), plus `.env.test` copied from `.env.test.example`.
- Local dev DB: `npm run db:up` → `cp .env.dev.example .env.dev` → `npm run db:migrate` → `npm run db:seed` (logins `gestor@semg.edu`/`prof1@semg.edu`, password `123456`) → `npm run dev:local` (API on the local DB) and `npm run db:studio` (Prisma Studio, http://localhost:5555). These scripts load `.env.dev`, never `.env` (remote Supabase).
- No lint script is configured (eslint is installed but has no script/config).
- Prisma: `npx prisma migrate dev` / `npx prisma generate`. Schema in `prisma/schema.prisma`, migrations in `prisma/migrations`.

## Environment

`.env` needs `DATABASE_URL` and `DIRECT_URL`. Both `prisma.config.ts` and `src/lib/prisma.ts` use **`DIRECT_URL`** (Prisma 7 driver-adapter style: `new PrismaClient({ adapter: new PrismaPg(...) })`). Auth needs `KEY_TOKEN` (JWT secret). Firebase Admin initialization in `src/server.ts` is currently commented out, yet `middlewares/uploadToFirebaseStorage.ts` depends on it (upload route is commented out in `schoolRoutes.ts`).

## Testing

- `src/app.ts` builds the Express app (no `listen`); `src/server.ts` only calls `listen`. Tests import `app` with Supertest.
- Safety guard: `vitest.config.ts` / `tests/setup/env.ts` load `.env.test` and refuse to run unless `DIRECT_URL` is a **local** host with "test" in the database name; `resetDb()` (`tests/setup/db.ts`) re-checks before `TRUNCATE`. The real `.env` points at a remote database, so never bypass this. Without `.env.test`, only runs limited to `tests/unit` are allowed (inert DB URL).
- Integration tests share one DB, so files run serially; call `resetDb()` in `beforeEach` and build data with `tests/factories`.
- Known bugs are pinned with `it.fails` (they pass while the bug exists and start failing once it is fixed — then flip them to plain `it`). External calls (ViaCEP via axios) are mocked.
- `GET /studantee/:classId` uses Postgres `unaccent()`; no migration creates the extension, so `tests/setup/global.ts` creates it for the test DB.

## Architecture

Entry: `src/server.ts` mounts three routers (`studentRoutes`, `schoolRoutes`, `teacherRoutes`) at root, Swagger UI at `/docs` (from `src/swagger.json`, edit by hand), and a final error handler. Routes are not prefixed; paths are Portuguese/English mixed (e.g. `/escola`, `/create/professor`).

Feature code lives in `src/useCase/<feature>/<action>/` with a Controller/Model pair per use case:
- **Controller** (`*Controller.ts`): handles request/response and/or input validation (via `src/services/Validator.ts`, Joi-based). Exported as a singleton instance (`export default new XController()`).
- **Model** (`*Model.ts`): Prisma data access; exported as singleton.
- **`transetion/` (sic) folders** orchestrate multi-entity creation: the controller validates all parts (e.g. address + school), then the model runs them inside `prisma.$transaction`, passing the `tx` client into the individual `Create*Model` methods. Sub-controllers' `Create*` methods are validators returning `{error, message}` rather than HTTP handlers.

Models typically return `{message, data}` and treat "already exists" as a non-error result (check `Read*Model` first). Request/entity types are in `src/interface/I*.ts`; shared Prisma client in `src/lib/prisma.ts`; `src/services/` holds helpers (token generation, data reshaping for performance sheets, CPF checks in `middlewares/cpfValidationMiddleware.ts`).

Auth: gestor/professor login via `useCase/autentication`, JWT access token plus refresh-token models (`RefreshTokenGestor`, `RefreshTokenProfessor`; `useCase/refreshtoken`). `ensureAuthenticated` expects the raw token in the `Authorization` header (no `Bearer ` prefix) and is applied per-route, not globally.

Note: the error handler in `server.ts` and many controllers return 200 with an error body or just `console.log` caught errors, so don't rely on status codes when tracing failures.
