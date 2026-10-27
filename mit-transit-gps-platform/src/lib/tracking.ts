export type Point = { lat: number; lng: number };
export type Stop = Point & { name: string };
export type BusRoute = {
  id: string;
  route_number: string;
  bus_number: string;
  imei?: string;
  origin: string | null;
  destination: string | null;
  direction: string | null;
  geometry: unknown;
  stops: unknown;
  driver_name?: string | null;
  driver_phone?: string | null;
  default_color: string;
};
export type Position = {
  route_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed_mps: number | null;
  eta_seconds: number | null;
  eta_target_latitude: number | null;
  eta_target_longitude: number | null;
  ignition_on?: boolean | null;
  fuel_percent?: number | null;
};
export const MIT_ORANGE = "#FF7900";
export function routeStyle(route: BusRoute, selected: string | null) {
  const active = selected === route.id;
  return {
    strokeColor: active ? MIT_ORANGE : route.default_color,
    strokeWeight: active ? 7 : 3,
    strokeOpacity: selected ? (active ? 1 : 0.3) : 0.7,
    zIndex: active ? 10 : 1,
  };
}
export function validPoint(p: unknown): p is Point {
  return (
    !!p &&
    typeof p === "object" &&
    "lat" in p &&
    "lng" in p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
export function routePoints(value: unknown): Point[] {
  return Array.isArray(value) && value.length >= 2 && value.every(validPoint) ? value : [];
}
export function routeStops(value: unknown): Stop[] {
  return Array.isArray(value)
    ? value.filter((s): s is Stop => validPoint(s) && "name" in s && typeof s.name === "string")
    : [];
}
export function distanceMeters(a: Point, b: Point) {
  const r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  const x =
    Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function isFresh(p: Position, now = Date.now()) {
  if (!validPoint({ lat: p.latitude, lng: p.longitude })) return false;
  const age = now - Date.parse(p.recorded_at);
  return age >= -30000 && age < 120000;
}
export function nearStop(bus: Point, stop: Point, radius: number) {
  return distanceMeters(bus, stop) <= radius;
}
export function etaFor(p: Position, target: Point | null) {
  if (
    !target ||
    !isFresh(p) ||
    p.eta_seconds == null ||
    !Number.isFinite(p.eta_seconds) ||
    p.eta_seconds < 0 ||
    !validPoint({ lat: p.eta_target_latitude, lng: p.eta_target_longitude }) ||
    p.eta_target_latitude == null ||
    p.eta_target_longitude == null
  )
    return null;
  return distanceMeters(target, { lat: p.eta_target_latitude, lng: p.eta_target_longitude }) < 100
    ? p.eta_seconds
    : null;
}
