import { z } from "zod";
export const issueSchema = z.object({
  routeId: z.string().uuid().nullable(),
  category: z.enum(["delay", "missed_stop", "safety", "other"]),
  description: z.string().trim().min(10).max(2000),
});
export function matchesRoute(route: { bus_number: string; route_number: string }, search: string) {
  const value = search.trim().toLowerCase();
  return (
    !value ||
    route.bus_number.toLowerCase().includes(value) ||
    route.route_number.toLowerCase().includes(value)
  );
}
export function searchSelection(
  routes: { id: string; bus_number: string; route_number: string }[],
  search: string,
  current: string | null,
) {
  if (!search.trim()) return current;
  const matches = routes.filter((r) => matchesRoute(r, search));
  const exact = matches.filter(
    (r) =>
      r.bus_number.toLowerCase() === search.trim().toLowerCase() ||
      r.route_number.toLowerCase() === search.trim().toLowerCase(),
  );
  if (exact.length === 1) return exact[0]?.id ?? null;
  if (matches.length === 1) return matches[0]?.id ?? null;
  return matches.some((r) => r.id === current) ? current : null;
}
export function safeStudentFeed(input: unknown) {
  const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
  const route = z.object({
    id: z.string(),
    bus_number: z.string(),
    route_number: z.string(),
    origin: z.string().nullable(),
    destination: z.string().nullable(),
    direction: z.string().nullable(),
    geometry: z.array(point).nullable(),
    stops: z.array(point.extend({ name: z.string() })),
    default_color: z.string(),
  });
  const position = z.object({
    route_id: z.string(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    recorded_at: z.string(),
    speed_mps: z.number().finite().nullable(),
    eta_seconds: z.number().finite().nonnegative().nullable(),
    eta_target_latitude: z.number().min(-90).max(90).nullable(),
    eta_target_longitude: z.number().min(-180).max(180).nullable(),
    ignition_on: z.boolean().nullable(),
    fuel_percent: z.number().min(0).max(100).nullable(),
  });
  return z.object({ routes: z.array(route), positions: z.array(position) }).parse(input);
}
export function campusHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} | MIT Thandavapura` },
      { name: "description", content: description },
      { property: "og:title", content: `MIT Thandavapura ${title}` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
