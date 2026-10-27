import { describe, expect, it } from "vitest";
import { canShowLivePosition, gpsStatusLabel } from "@/lib/gps/status";
import type { GpsBusStatus } from "@/lib/gps/types";

const status = (state: GpsBusStatus["state"]): GpsBusStatus => ({
  routeId: "route-id",
  state,
  providerName: state === "not_configured" ? null : "Traccar",
  checkedAt: null,
  lastUpdatedAt: null,
  message: "Test status",
});

describe("GPS connection presentation", () => {
  it("shows disconnected until a configured provider test succeeds", () => {
    expect(gpsStatusLabel(undefined)).toBe("GPS not connected");
    expect(gpsStatusLabel(status("not_configured"))).toBe("GPS not connected");
    expect(canShowLivePosition(undefined)).toBe(false);
    expect(canShowLivePosition(status("not_configured"))).toBe(false);
  });

  it("permits live map data only after a successful provider position read", () => {
    expect(gpsStatusLabel(status("connected"))).toBe("GPS connected");
    expect(canShowLivePosition(status("connected"))).toBe(true);
    expect(canShowLivePosition(status("permission_denied"))).toBe(false);
    expect(canShowLivePosition(status("provider_error"))).toBe(false);
    expect(canShowLivePosition(status("stale"))).toBe(false);
  });

  it("labels loading, errors, permission denial and stale data distinctly", () => {
    expect(gpsStatusLabel(undefined, true)).toBe("Checking GPS…");
    expect(gpsStatusLabel(undefined, false, true)).toBe("GPS status unavailable");
    expect(gpsStatusLabel(status("permission_denied"))).toBe("Provider access denied");
    expect(gpsStatusLabel(status("stale"))).toBe("GPS data stale");
  });
});
