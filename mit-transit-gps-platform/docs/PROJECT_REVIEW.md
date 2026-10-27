# MIT Thandavapura Bus Tracker — inspection and change report

## Existing application/backend inspected

The supplied archive contains a TanStack Start / React TypeScript web application with existing Supabase Auth and Postgres/RPC/Realtime/Storage access, a Google Maps route view, `bus_routes`, `bus_positions`, college access checks, student-feed RPC, bus/IMEI administration and existing travel/student/security routes. Its front end already has a polling/realtime position flow and freshness checks. The archive did not contain an authorized GPS-provider integration, provider API documentation or provider credentials.

The source is configured to use Supabase, but this task did not sign into or query a live project to verify the current production connection. The original archive's `.env` was deliberately excluded from the working copy and deliverable; no secret values were inspected or carried forward. Google Maps key configuration and all unrelated app features are preserved in source.

## Files changed or added

- `src/lib/gps/types.ts`, `src/lib/gps/status.ts`: provider-neutral normalized position/status contracts and safe status labels.
- `supabase/functions/gps-integration/index.ts` and `_shared/{types,registry,traccar}.ts`: authenticated Supabase Edge Function, adapter registry and the first provider adapter (Traccar). Its request flow uses the server-assigned provider device ID, validates returned device identity/fix/timestamp, normalizes speed, and writes positions with optional telemetry.
- `supabase/config.toml`: explicitly requires JWT verification for the new Edge Function.
- `src/lib/gps.functions.ts`: authenticated app-side wrappers plus protected, per-bus provider-ID mapping administration and test calls.
- `src/lib/transport.functions.ts`: exposes the app's existing admin-session verifier for the new restricted mapping operations.
- `drizzle/migrations/0005_gps_provider_integration.sql`: source-only mapping-table/telemetry/student-feed migration; not applied.
- `src/integrations/supabase/types.ts`: generated Supabase types for the migration's new fields/table.
- `src/lib/campus.functions.ts`, `src/lib/campus.ts`: student feed invokes authorized GPS sync and filters to mapped, successfully connected buses.
- `src/components/live-map.tsx`, `src/components/gps-live-details.tsx`, `src/routes/index.tsx`, `src/routes/student.tsx`, `src/routes/security.tsx`, `src/styles.css`: live-only map gating, loading/error/stale/disconnected states, conditional provider telemetry, and the admin provider mapping/test UI; existing navigation and unrelated features remain.
- `.env.example`, `.gitignore`: do not keep provider credentials in app or client environment files.
- `src/test/gps-status.test.ts`, `src/test/tracking.test.ts`: status and freshness tests.

## Still required from the GPS provider/owner

The app cannot connect to the current fleet until the owner supplies the provider name and official API documentation, confirms written access permission, supplies provider-server origin and auth details via Supabase Function secrets, identifies each tracker model/firmware/protocol and its provider-side device ID, confirms that the tracker is reporting into that provider, and approves a real end-to-end test. IMEI alone is intentionally not used as a position lookup key. For Traccar specifically, exact supported hardware/protocol and each Traccar server-assigned device ID must be verified.

## Work performed and not performed

The integration framework and UI are implemented in an isolated source copy. Local checks passed: TypeScript (`tsc --noEmit`), the app test suite (13 tests), targeted ESLint (no errors or warnings), and a production build. No live GPS data was requested. The SQL migration was not applied, Edge Function was not deployed, production data/secrets were not changed, and no provider is claimed to be connected.
