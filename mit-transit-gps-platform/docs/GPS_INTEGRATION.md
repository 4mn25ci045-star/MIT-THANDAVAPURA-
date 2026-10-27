# GPS provider integration

## Architecture and current connection state

GPS polling and third-party credential use live in `supabase/functions/gps-integration`, a JWT-verified Supabase Edge Function. The existing TanStack Start server functions are authenticated wrappers for the function and for restricted per-bus mapping administration. The Edge Function validates the user JWT and college-personnel authorization; administrative tests additionally require the current Security password session. It reads provider credentials from Supabase Function secrets, not from browser code or the bus mapping table.

The Edge Function writes validated, provider-neutral positions into the existing `bus_positions` table. The Travel and Student views continue using the existing routes, Supabase Auth, Google Maps and bus selection/ETA features. The map and telemetry components only treat a position as live after a successful provider read and freshness check. Missing configuration is explicitly shown as **GPS not connected**; stale, permission-denied, API-error, loading and no-position states are distinct. Optional ignition and fuel values are persisted and shown only when the provider response actually contains valid fields.

An adapter registry is included. **Traccar is the only concrete provider adapter currently implemented.** The registry is where additional separate adapters can be added after receiving the relevant vendor's official documentation and authorization. No unknown provider is presented as supported or connected.

## Traccar compatibility and identifier mapping

Traccar lists supported tracker models and protocols, and directs users to its protocol-identification guide when a model is missing. Compatibility cannot be inferred from an IMEI alone. Before choosing Traccar, obtain the exact tracker manufacturer/model, firmware and current server/host/port/protocol settings; confirm that the model/protocol appears in Traccar's supported list or complete protocol identification, then conduct an authorized end-to-end test. The hardware may need to be configured to send data to the Traccar server.

The adapter uses the Traccar **server-assigned numeric device ID** stored in `bus_gps_devices`, then requests its current `positionId` and verifies the response's `deviceId` matches that mapping. It does not query by the existing bus IMEI or Traccar `uniqueId`. Traccar position records include coordinates, speed, fix time and attributes. Speed in knots is converted to meters per second for `bus_positions.speed_mps`. Ignition is shown only for a boolean `ignition` attribute; fuel is shown only for a numeric `fuelPercent` in the 0–100 range. Device/protocol-specific or absent attributes are not inferred.

## Supabase Function secrets

After the provider account and authorization are ready, configure these in the Supabase project as **Edge Function secrets** (not app `.env`, database rows, client variables or `VITE_` values):

- `TRACCAR_SERVER_URL`: the actual authorized Traccar server origin/base path, HTTPS in production.
- `TRACCAR_API_TOKEN`: a Traccar account token with minimum read permissions for the mapped device/position.
- `GPS_POLL_INTERVAL_MS` (optional): provider request interval in milliseconds. The default is 30 seconds, clamped to at least 10 seconds; confirm the vendor's rate limits before lowering it.

For example, once authorized, set the actual owner-supplied values with the Supabase CLI or dashboard secret manager. Do not put real values in this project or send them through the frontend. The app's existing browser refresh remains 10 seconds; server-side provider polling is independently throttled. Traccar recommends its WebSocket API rather than frequent REST polling for live updates; a persistent WebSocket integration needs its session-cookie/authentication deployment pattern confirmed before implementation.

## Details still required

For the existing GPS system (or each additional provider), provide:

1. Provider/company name, authorized service plan/account contact and written permission to access these buses.
2. Official API documentation/version and base URL, authentication method, scope, expiry and rotation procedure.
3. Exact GPS tracker manufacturer, model, firmware, protocol and current host/port configuration.
4. Provider-side device ID for each bus, copied from the authorized provider account. The bus IMEI is not a substitute for that ID.
5. Field names, types, units and timestamp/time-zone semantics for location, speed, ignition and fuel.
6. Current-position versus push/webhook/WebSocket options, rate limits, IP allowlist/network constraints and representative redacted response examples.
7. A test account/device and approval for an end-to-end read test.

## Migration and deployment boundary

`drizzle/migrations/0005_gps_provider_integration.sql` is included as source only. It creates a service-role-only per-bus mapping table and adds optional normalized telemetry columns; it also updates the existing student feed RPC. It has **not** been applied to any database. The Edge Function has **not** been deployed, no production secrets have been set, and no provider test has run. Do not deploy/apply the migration or configure production secrets until the project owner authorizes it.

## Official references

- Traccar supported devices: https://www.traccar.org/devices/
- Traccar protocol identification: https://www.traccar.org/identify-protocol/
- Traccar API reference: https://www.traccar.org/api-reference/
- Traccar API overview and WebSocket notes: https://www.traccar.org/traccar-api/
- Traccar API speed unit (knots): https://www.traccar.org/forums/topic/speed-value-in-api/
