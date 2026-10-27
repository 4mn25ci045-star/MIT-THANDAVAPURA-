import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getProviderAdapter, listProviderAdapters } from "./_shared/registry.ts";
import type { GpsBusStatus, GpsConnectionState, ProviderPositionResult } from "./_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const stateMessages: Record<GpsConnectionState, string> = {
  not_configured: "GPS not connected. Backend provider access is not configured.",
  connected: "Provider API verified and a valid GPS position was received.",
  no_position: "Provider access is configured, but no valid position is available.",
  stale: "The provider position is stale; the map will not show it as live.",
  permission_denied: "The provider denied access. Check account permissions.",
  provider_error: "The provider API could not be reached or returned an error.",
  unsupported_provider: "No adapter is available for this provider yet.",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function pollIntervalMs() {
  const configured = Number(Deno.env.get("GPS_POLL_INTERVAL_MS"));
  return Number.isFinite(configured) && configured >= 10_000
    ? Math.min(configured, 15 * 60_000)
    : 30_000;
}

function stateFromDb(value: string | null): GpsConnectionState {
  if (
    value === "not_configured" ||
    value === "connected" ||
    value === "no_position" ||
    value === "stale" ||
    value === "permission_denied" ||
    value === "provider_error" ||
    value === "unsupported_provider"
  )
    return value;
  return "not_configured";
}

function statusMessage(state: GpsConnectionState) {
  return stateMessages[state];
}

function clientForUser(url: string, key: string, authorization: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function assertPersonnel(userClient: SupabaseClient) {
  const { data, error } = await userClient.rpc("is_personnel");
  if (error || data !== true) throw new Error("College approval is required.");
}

async function assertAdminSession(db: SupabaseClient, userId: string, sessionId: unknown) {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error("Security session expired. Unlock Security again.");
  }
  const { data: session } = await db
    .from("admin_sessions")
    .select("id,credential_version")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const { data: credential } = await db
    .from("admin_credentials")
    .select("version")
    .eq("id", 1)
    .maybeSingle();
  if (!session || !credential || session.credential_version !== credential.version) {
    throw new Error("Security session expired. Unlock Security again.");
  }
}

async function persistAttempt(
  db: SupabaseClient,
  routeId: string,
  state: GpsConnectionState,
  success: boolean,
) {
  const now = new Date().toISOString();
  const update: Record<string, string | null> = {
    last_checked_at: now,
    last_error_code: success ? null : state,
    updated_at: now,
  };
  if (success) update.last_success_at = now;
  const { error } = await db.from("bus_gps_devices").update(update).eq("route_id", routeId);
  if (error) throw new Error("GPS connection status could not be saved.");
}

async function attemptRoute(
  db: SupabaseClient,
  routeId: string,
  provider: string,
  providerDeviceId: string,
): Promise<GpsBusStatus> {
  const adapter = getProviderAdapter(provider);
  const checkedAt = new Date().toISOString();
  if (!adapter) {
    await persistAttempt(db, routeId, "unsupported_provider", false);
    return {
      routeId,
      state: "unsupported_provider",
      providerName: provider,
      checkedAt,
      lastUpdatedAt: null,
      message: statusMessage("unsupported_provider"),
    };
  }
  const result: ProviderPositionResult = await adapter.readPosition(providerDeviceId);
  if (result.state !== "connected") {
    await persistAttempt(db, routeId, result.state, false);
    return {
      routeId,
      state: result.state,
      providerName: adapter.name,
      checkedAt,
      lastUpdatedAt: null,
      message: result.message,
    };
  }

  const point = result.position;
  const ageMs = Date.now() - Date.parse(point.recordedAt);
  const now = new Date().toISOString();
  const storedPosition = {
    route_id: routeId,
    latitude: point.latitude,
    longitude: point.longitude,
    speed_mps: point.speedMps,
    heading: point.headingDegrees,
    recorded_at: point.recordedAt,
    ignition_on: point.ignitionOn ?? null,
    fuel_percent: point.fuelPercent ?? null,
  };
  if (!Number.isFinite(ageMs) || ageMs < -30_000 || ageMs >= 120_000) {
    const { error } = await db
      .from("bus_positions")
      .upsert(storedPosition, { onConflict: "route_id" });
    if (error) throw new Error("GPS position could not be saved.");
    await persistAttempt(db, routeId, "stale", false);
    return {
      routeId,
      state: "stale",
      providerName: adapter.name,
      checkedAt: now,
      lastUpdatedAt: point.recordedAt,
      message: statusMessage("stale"),
    };
  }

  const { error } = await db
    .from("bus_positions")
    .upsert(storedPosition, { onConflict: "route_id" });
  if (error) {
    await persistAttempt(db, routeId, "provider_error", false);
    return {
      routeId,
      state: "provider_error",
      providerName: adapter.name,
      checkedAt: now,
      lastUpdatedAt: null,
      message: "A verified provider position could not be saved.",
    };
  }
  await persistAttempt(db, routeId, "connected", true);
  return {
    routeId,
    state: "connected",
    providerName: adapter.name,
    checkedAt: now,
    lastUpdatedAt: point.recordedAt,
    message: statusMessage("connected"),
  };
}

async function readStatuses(db: SupabaseClient): Promise<GpsBusStatus[]> {
  const { data: mappings, error } = await db
    .from("bus_gps_devices")
    .select("route_id,provider,last_checked_at,last_success_at,last_error_code");
  if (error) throw new Error("GPS connection status could not be loaded.");
  const { data: positions, error: positionError } = await db
    .from("bus_positions")
    .select("route_id,recorded_at");
  if (positionError) throw new Error("GPS position status could not be loaded.");
  const positionByRoute = new Map(
    (positions ?? []).map((position) => [position.route_id, position.recorded_at]),
  );
  return (mappings ?? []).map((mapping) => {
    const lastUpdatedAt = positionByRoute.get(mapping.route_id) ?? null;
    let state = stateFromDb(mapping.last_error_code);
    if (mapping.last_success_at && lastUpdatedAt) {
      const age = Date.now() - Date.parse(lastUpdatedAt);
      if (Number.isFinite(age) && age >= -30_000 && age < 120_000 && state === "not_configured")
        state = "connected";
      else if ((!Number.isFinite(age) || age >= 120_000) && state === "connected") state = "stale";
    }
    return {
      routeId: mapping.route_id,
      state,
      providerName: getProviderAdapter(mapping.provider)?.name ?? null,
      checkedAt: mapping.last_checked_at,
      lastUpdatedAt,
      message: statusMessage(state),
    };
  });
}

async function syncMappedGps(db: SupabaseClient): Promise<GpsBusStatus[]> {
  const { data: mappings, error } = await db
    .from("bus_gps_devices")
    .select("route_id,provider,provider_device_id,last_checked_at");
  if (error) throw new Error("GPS device mappings could not be loaded.");
  const interval = pollIntervalMs();
  const attempted: GpsBusStatus[] = [];
  for (const mapping of mappings ?? []) {
    const adapter = getProviderAdapter(mapping.provider);
    if (!adapter) {
      attempted.push(
        await attemptRoute(db, mapping.route_id, mapping.provider, mapping.provider_device_id),
      );
      continue;
    }
    const checkedAt = mapping.last_checked_at ? Date.parse(mapping.last_checked_at) : 0;
    if (Number.isFinite(checkedAt) && Date.now() - checkedAt < interval) continue;
    attempted.push(
      await attemptRoute(db, mapping.route_id, mapping.provider, mapping.provider_device_id),
    );
  }
  const stored = await readStatuses(db);
  const merged = new Map(stored.map((status) => [status.routeId, status]));
  for (const status of attempted) merged.set(status.routeId, status);
  return [...merged.values()];
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anonKey || !serviceKey)
    return json({ error: "GPS integration backend is not configured." }, 503);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "Authentication is required." }, 401);
  const token = authorization.slice("Bearer ".length);
  const userClient = clientForUser(url, anonKey, authorization);
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData.user) return json({ error: "Authentication is required." }, 401);

  const db = serviceClient(url, serviceKey);
  await assertPersonnel(userClient);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Invalid request." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (body.action === "providers") return json({ providers: listProviderAdapters() });
  if (body.action === "sync") return json({ statuses: await syncMappedGps(db) });
  if (body.action !== "test" || typeof body.routeId !== "string")
    return json({ error: "Unsupported GPS action." }, 400);
  await assertAdminSession(db, userData.user.id, body.sessionId);
  const { data: mapping, error } = await db
    .from("bus_gps_devices")
    .select("route_id,provider,provider_device_id")
    .eq("route_id", body.routeId)
    .maybeSingle();
  if (error || !mapping)
    return json({ error: "Save a provider device mapping before testing." }, 404);
  return json(
    await attemptRoute(db, mapping.route_id, mapping.provider, mapping.provider_device_id),
  );
}

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch {
    return json({ error: "GPS integration request could not be completed." }, 500);
  }
});
