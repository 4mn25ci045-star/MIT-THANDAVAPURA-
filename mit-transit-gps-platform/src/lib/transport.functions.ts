import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { newSalt, passwordHash, secureCompare } from "./security.server";
const password = z.string().min(1).max(128);
export const unlockSecurity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ password }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: limitError } = await db.rpc("reserve_admin_attempt", {
      p_user: context.userId,
    });
    if (limitError || !allowed)
      throw new Error("Too many attempts. Please try again in 15 minutes.");
    let { data: credential } = await db
      .from("admin_credentials")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!credential) {
      const initial = process.env["INITIAL_ADMIN_PASSWORD"];
      if (!initial) throw new Error("Administrator password is not configured.");
      const salt = newSalt();
      const verifier = await passwordHash(initial, salt);
      await db
        .from("admin_credentials")
        .upsert({ id: 1, salt, verifier }, { onConflict: "id", ignoreDuplicates: true });
      const result = await db.from("admin_credentials").select("*").eq("id", 1).single();
      credential = result.data;
    }
    if (
      !credential ||
      !secureCompare(await passwordHash(data.password, credential.salt), credential.verifier)
    )
      throw new Error("Incorrect password.");
    await db
      .from("admin_attempts")
      .update({ failures: 0, blocked_until: null })
      .eq("user_id", context.userId);
    const { data: session, error } = await db
      .from("admin_sessions")
      .insert({
        user_id: context.userId,
        credential_version: credential.version,
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !session) throw new Error("Could not unlock Security.");
    return { sessionId: session.id };
  });
const sessionSchema = z.object({ sessionId: z.string().uuid() });
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number.")
  .or(z.literal(""));
async function requireSession(db: SupabaseClient<Database>, userId: string, sessionId: string) {
  const { data: s } = await db
    .from("admin_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const { data: c } = await db.from("admin_credentials").select("version").eq("id", 1).single();
  if (!s || s.credential_version !== c?.version)
    throw new Error("Security session expired. Unlock again.");
}
export const requireAdminSecuritySession = requireSession;
export const saveBusRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    sessionSchema.extend({
      imei: z.string().regex(/^\d{15}$/),
      routeNumber: z.string().trim().min(1).max(30),
      busNumber: z.string().trim().min(1).max(30),
      driverName: z.string().trim().max(60),
      driverPhone: phone,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await requireSession(db, context.userId, data.sessionId);
    const { error } = await db.from("bus_routes").upsert(
      {
        imei: data.imei,
        route_number: data.routeNumber,
        bus_number: data.busNumber,
        driver_name: data.driverName || null,
        driver_phone: data.driverPhone || null,
      },
      { onConflict: "route_number" },
    );
    if (error)
      throw new Error(
        error.code === "23505"
          ? "This IMEI is already registered to another bus."
          : "Could not save. The bus number or IMEI may already be linked.",
      );
    return { ok: true };
  });
export const listBusRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await requireSession(db, context.userId, data.sessionId);
    const { data: routes, error } = await db
      .from("bus_routes")
      .select("id,route_number,bus_number,imei,driver_name,driver_phone")
      .order("route_number");
    if (error) throw new Error("Could not load registered buses.");
    return { routes: routes ?? [] };
  });
export const deleteBusRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema.extend({ routeId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await requireSession(db, context.userId, data.sessionId);
    const { error } = await db.from("bus_routes").delete().eq("id", data.routeId);
    if (error) throw new Error("Could not delete this bus.");
    return { ok: true };
  });
export const changeAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionSchema.extend({ currentPassword: password, newPassword: password.min(8) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: allowed } = await db.rpc("reserve_admin_attempt", { p_user: context.userId });
    if (!allowed) throw new Error("Too many attempts. Please try again in 15 minutes.");
    const { data: s } = await db
      .from("admin_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const { data: c } = await db.from("admin_credentials").select("*").eq("id", 1).single();
    if (!s || !c || s.credential_version !== c.version)
      throw new Error("Security session expired.");
    if (!secureCompare(await passwordHash(data.currentPassword, c.salt), c.verifier))
      throw new Error("Incorrect current password.");
    const salt = newSalt();
    const verifier = await passwordHash(data.newPassword, salt);
    const { error } = await db
      .from("admin_credentials")
      .update({ salt, verifier, version: c.version + 1 })
      .eq("id", 1)
      .eq("version", c.version);
    if (error) throw new Error("Could not update password.");
    await db.from("admin_sessions").delete().eq("user_id", context.userId);
    await db
      .from("admin_attempts")
      .update({ failures: 0, blocked_until: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });
