import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { requireAdminSecuritySession } from "@/lib/transport.functions";
import type { GpsBusStatus } from "@/lib/gps/types";

const sessionSchema = z.object({ sessionId: z.string().uuid() });
const routeIdSchema = z.string().uuid();
const mappingSchema = sessionSchema.extend({
  routeId: routeIdSchema,
  provider: z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/),
  providerDeviceId: z.string().trim().min(1).max(128),
});
type AuthenticatedClient = SupabaseClient<Database>;
type GpsEdgeAction = "providers" | "sync" | "test";

async function assertPersonnel(client: AuthenticatedClient) {
  const { data, error } = await client.rpc("is_personnel");
  if (error || data !== true) throw new Error("College approval is required.");
}

async function invokeGpsEdge<T>(
  client: AuthenticatedClient,
  body: { action: GpsEdgeAction; [key: string]: unknown },
): Promise<T> {
  const { data, error } = await client.functions.invoke("gps-integration", { body });
  if (error || !data) throw new Error("GPS integration service could not be reached.");
  return data as T;
}

export const getGpsProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPersonnel(context.supabase);
    return invokeGpsEdge<{ providers: { id: string; name: string }[] }>(context.supabase, {
      action: "providers",
    });
  });

export const listGpsMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema)
  .handler(async ({ data, context }) => {
    await assertPersonnel(context.supabase);
    await requireAdminSecuritySession(supabaseAdmin, context.userId, data.sessionId);
    const { data: mappings, error } = await supabaseAdmin
      .from("bus_gps_devices")
      .select(
        "route_id,provider,provider_device_id,last_checked_at,last_success_at,last_error_code",
      );
    if (error) throw new Error("GPS bus mappings could not be loaded.");
    return { mappings: mappings ?? [] };
  });

export const saveGpsMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(mappingSchema)
  .handler(async ({ data, context }) => {
    await assertPersonnel(context.supabase);
    await requireAdminSecuritySession(supabaseAdmin, context.userId, data.sessionId);
    const { providers } = await invokeGpsEdge<{
      providers: { id: string; name: string }[];
    }>(context.supabase, { action: "providers" });
    if (!providers.some((provider) => provider.id === data.provider)) {
      throw new Error("This GPS provider adapter is not currently available.");
    }
    const { data: route, error: routeError } = await supabaseAdmin
      .from("bus_routes")
      .select("id")
      .eq("id", data.routeId)
      .maybeSingle();
    if (routeError || !route) throw new Error("This bus is no longer available.");
    const { error } = await supabaseAdmin.from("bus_gps_devices").upsert(
      {
        route_id: data.routeId,
        provider: data.provider,
        provider_device_id: data.providerDeviceId,
        last_checked_at: null,
        last_success_at: null,
        last_error_code: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "route_id" },
    );
    if (error)
      throw new Error(
        error.code === "23505"
          ? "That provider device is already assigned to another bus."
          : "Could not save the GPS device mapping.",
      );
    return { ok: true };
  });

export const removeGpsMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema.extend({ routeId: routeIdSchema }))
  .handler(async ({ data, context }) => {
    await assertPersonnel(context.supabase);
    await requireAdminSecuritySession(supabaseAdmin, context.userId, data.sessionId);
    const { error } = await supabaseAdmin
      .from("bus_gps_devices")
      .delete()
      .eq("route_id", data.routeId);
    if (error) throw new Error("Could not remove the GPS provider mapping.");
    return { ok: true };
  });

export const testGpsMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema.extend({ routeId: routeIdSchema }))
  .handler(async ({ data, context }) => {
    await assertPersonnel(context.supabase);
    await requireAdminSecuritySession(supabaseAdmin, context.userId, data.sessionId);
    return invokeGpsEdge<GpsBusStatus>(context.supabase, {
      action: "test",
      sessionId: data.sessionId,
      routeId: data.routeId,
    });
  });

export const syncGpsPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPersonnel(context.supabase);
    return invokeGpsEdge<{ statuses: GpsBusStatus[] }>(context.supabase, { action: "sync" });
  });

export async function syncGpsPositionsForAuthorizedUser(context: {
  supabase: AuthenticatedClient;
}) {
  await assertPersonnel(context.supabase);
  const response = await invokeGpsEdge<{ statuses: GpsBusStatus[] }>(context.supabase, {
    action: "sync",
  });
  return response.statuses;
}

export type { GpsBusStatus } from "@/lib/gps/types";
