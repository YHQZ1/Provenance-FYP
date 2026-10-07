# Contributing

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Make the change with tests, then run `make check`, which runs what CI runs.
3. Commit in logical pieces using [Conventional Commits](https://www.conventionalcommits.org/) with a scope: `feat(web): …`, `fix(backend): …`, `refactor(rag-regulatory): …`, `ci: …`, `docs: …`. Use the body to explain why.
4. Open a pull request. CI runs lint, tests and builds for all five apps and must pass.

Never commit `.env` files, keys or database URLs. If a secret is committed, rotate it, because deleting the commit isn't enough.

## Code conventions

**Everywhere**
- Match the surrounding code: naming, comment density, file layout.
- Don't comment code. Names, small functions and tests carry the explanation; longer reasoning belongs in these docs.
- No hardcoded URLs or ports. Addresses come from environment variables: `apps/*/.env*` for each app, `infra/.env` for Docker. Required values fail at startup with a clear message instead of falling back to a default.
- No emojis, in code, logs or docs.
- Run `make format` before committing.
- User-facing text is plain, specific and calm. Say what happened and what to do next, for example "Already uploaded as invoice_4.jpg (FY 2025-26)", never "Error 409".

**Backend**
- Business rules live in services, not controllers or the UI.
- Pure logic, such as `filing.summary.js`, goes in modules that don't import the database client, so it can be unit-tested in CI.
- Every query is scoped to the caller's company.
- Expected failures throw `AppError` helpers and return 4xx; only bugs return 500.
- Schema additions go through a numbered migration, plus a probe in `config/schema.js` if the code must work before the migration is applied.

**Frontend**
- Pages call the backend through `src/lib/api.js`, never Supabase tables directly; the database only lets clients read.
- Shared state (selected financial year, filing, account) comes from `useWorkspace()`.
- Domain constants and formatting (categories, document types, `formatKg`, FY helpers) live in `src/lib/domain.js`.
- Build with the components in `src/components/ui.jsx` before writing new ones.

**Python services**
- FastAPI with Pydantic models for every request and response.
- Keep model loading lazy so tests run without the ML stack.

## UI design rules

The interface is deliberately quiet: a compliance tool should look precise, not decorative.

- **Colour.** White, near-black `#0a0a0a`, the neutral greys and one accent, emerald `#059669`. Red is used only for errors. Don't add hues or gradients.
- **Shape.** Sharp corners. The radius scale is defined in `src/index.css` and runs from about 2 px to 14 px. Buttons are rectangles with a small radius, never pills.
- **Type.** Inter for everything. The `.mono` class gives numbers, codes and small uppercase labels tabular figures so columns line up. Quantities are right-aligned.
- **Layout.** Content fills nearly the full width with small gutters (`max-w-[1680px]`, 16–32 px padding). It must work at 390 px wide; give grid and flex children `min-w-0` so they can shrink.
- **Interaction.** Everything clickable gets `cursor: pointer` (set globally in `@layer base`) and a visible emerald focus ring. Respect `prefers-reduced-motion`.
- **No emojis.** Icons come from `lucide-react`.
- **States.** Every data view has loading (a skeleton or spinner), empty (what to do next), error (what failed, with a retry) and success states.

## Tests

| Where | Add a test when you… |
| --- | --- |
| `apps/web-app/src/test/` | Change a page's behaviour: what it shows for a given API response, or what an action sends |
| `apps/backend-service/test/` | Change filing logic, normalisation, auth or any rule in the business-rules list |
| `apps/*/tests/` (Python) | Change parsing, taxonomy, chunking or response handling |

Tests must not need network access, credentials or running services. Use fixtures and mocks, as the existing suites do.

## Database changes

See [DATABASE.md](DATABASE.md#migrations). In short:
- Add a new numbered file; never edit an applied migration.
- Make it safe to re-run.
- Test it on a scratch Postgres.
- Don't widen client access. The database is read-only to clients by design.
