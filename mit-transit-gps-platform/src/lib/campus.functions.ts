import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GpsBusStatus } from "@/lib/gps/types";
import { issueSchema, safeStudentFeed } from "./campus";
export const getCampusData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data: allowed, error } = await db.rpc("is_personnel");
    if (error || !allowed) throw new Error("College approval is required.");
    const [updates, timetable, routes, issues] = await Promise.all([
      db
        .from("college_updates")
        .select("id,title,body,published_at")
        .order("published_at", { ascending: false }),
      db
        .from("bus_timetable")
        .select("id,route_id,weekday,departure_time,arrival_time,pickup_stop,direction")
        .order("departure_time"),
      db.from("bus_routes").select("id,bus_number,route_number").order("route_number"),
      db
        .from("transport_issues")
        .select("id,route_id,category,description,status,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (updates.error || timetable.error || routes.error || issues.error)
      throw new Error("College information could not be loaded. Please try again.");
    return {
      updates: updates.data ?? [],
      timetable: timetable.data ?? [],
      routes: routes.data ?? [],
      issues: issues.data ?? [],
    };
  });
export const reportIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(issueSchema)
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_personnel");
    if (error || !allowed) throw new Error("College approval is required.");
    if (data.routeId) {
      const { data: route, error: routeError } = await context.supabase
        .from("bus_routes")
        .select("id")
        .eq("id", data.routeId)
        .maybeSingle();
      if (routeError || !route) throw new Error("This route is no longer available.");
    }
    const { data: issue, error: insertError } = await context.supabase
      .from("transport_issues")
      .insert({
        user_id: context.userId,
        route_id: data.routeId,
        category: data.category,
        description: data.description,
      })
      .select("id")
      .single();
    if (insertError || !issue) throw new Error("Your report could not be saved. Please try again.");
    return { id: issue.id };
  });
export const getStudentFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGpsPositionsForAuthorizedUser } = await import("@/lib/gps.functions");
    let gpsStatuses: GpsBusStatus[];
    let gpsUnavailable = false;
    try {
      gpsStatuses = await syncGpsPositionsForAuthorizedUser(context);
    } catch {
      gpsUnavailable = true;
      gpsStatuses = [];
    }
    const { data, error } = await context.supabase.rpc("student_bus_feed");
    if (error) throw new Error("Student tracking could not be loaded.");
    const feed = safeStudentFeed(data);
    if (gpsUnavailable) {
      gpsStatuses = feed.routes.map((route) => ({
        routeId: route.id,
        state: "provider_error" as const,
        providerName: null,
        checkedAt: new Date().toISOString(),
        lastUpdatedAt: null,
        message: "GPS integration service is unavailable. No location is shown as live.",
      }));
    }
    const visibleRouteIds = new Set(feed.routes.map((route) => route.id));
    const visibleStatuses = gpsStatuses.filter((status) => visibleRouteIds.has(status.routeId));
    const connectedRouteIds = new Set(
      visibleStatuses
        .filter((status) => status.state === "connected")
        .map((status) => status.routeId),
    );
    return {
      ...feed,
      positions: feed.positions.filter((position) => connectedRouteIds.has(position.route_id)),
      gpsStatuses: visibleStatuses,
    };
  });
