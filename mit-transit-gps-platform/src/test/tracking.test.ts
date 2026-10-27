import { describe, it, expect } from "vitest";
import {
  routeStyle,
  routePoints,
  nearStop,
  isFresh,
  etaFor,
  type BusRoute,
  type Position,
} from "@/lib/tracking";
const a: BusRoute = {
  id: "a",
  route_number: "1",
  bus_number: "1",
  imei: "123456789012345",
  origin: null,
  destination: null,
  direction: null,
  geometry: [
    { lat: 12, lng: 76 },
    { lat: 12.1, lng: 76.1 },
  ],
  stops: [],
  driver_name: null,
  driver_phone: null,
  default_color: "#658B80",
};
const b = { ...a, id: "b", default_color: "#758AA0" };
describe("Actual bus route rules", () => {
  it("highlights only the selected route in MIT Orange even with overlapping geometry", () => {
    expect(routeStyle(a, "a").strokeColor).toBe("#FF7900");
    expect(routeStyle(a, "a").strokeWeight).toBe(7);
    expect(routeStyle(b, "a").strokeColor).toBe("#758AA0");
    expect(routeStyle(b, "a").strokeOpacity).toBe(0.3);
  });
  it("removes the prior orange highlight on a different selection", () => {
    expect(routeStyle(a, "b").strokeColor).toBe("#658B80");
    expect(routeStyle(b, "b").strokeColor).toBe("#FF7900");
  });
  it("leaves unselected routes in their original colors", () => {
    expect(routeStyle(a, null).strokeColor).toBe("#658B80");
    expect(routeStyle(b, null).strokeColor).toBe("#758AA0");
  });
  it("does not fabricate unavailable or malformed geometry", () => {
    expect(routePoints(null)).toEqual([]);
    expect(
      routePoints([
        { lat: 91, lng: 0 },
        { lat: 0, lng: 0 },
      ]),
    ).toEqual([]);
  });
  it("alerts only within the configured stop distance", () => {
    expect(nearStop({ lat: 0, lng: 0 }, { lat: 0, lng: 0.004 }, 500)).toBe(true);
    expect(nearStop({ lat: 0, lng: 0 }, { lat: 0, lng: 0.004 }, 250)).toBe(false);
  });
  it("does not display stale GPS as live", () => {
    const p = { latitude: 12.1, longitude: 76.65, recorded_at: "2026-10-10T12:00:00Z" } as Position;
    expect(isFresh(p, Date.parse("2026-10-10T12:01:00Z"))).toBe(true);
    expect(isFresh(p, Date.parse("2026-10-10T12:03:00Z"))).toBe(false);
  });
  it("never invents ETA or uses an ETA for another destination", () => {
    const p = { recorded_at: new Date().toISOString(), eta_seconds: null } as Position;
    expect(etaFor(p, { lat: 12, lng: 76 })).toBe(null);
    expect(
      etaFor(
        { ...p, eta_seconds: 600, eta_target_latitude: 13, eta_target_longitude: 77 },
        { lat: 12, lng: 76 },
      ),
    ).toBe(null);
  });
});
