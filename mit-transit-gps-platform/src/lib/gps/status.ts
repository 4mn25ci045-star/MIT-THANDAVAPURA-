import type { GpsBusStatus } from "./types";

export function gpsStatusLabel(status: GpsBusStatus | undefined, loading = false, failed = false) {
  if (failed) return "GPS status unavailable";
  if (loading) return "Checking GPS…";
  if (!status || status.state === "not_configured") return "GPS not connected";
  if (status.state === "connected") return "GPS connected";
  if (status.state === "stale") return "GPS data stale";
  if (status.state === "permission_denied") return "Provider access denied";
  if (status.state === "no_position") return "No GPS position";
  if (status.state === "unsupported_provider") return "Provider not supported";
  return "GPS API error";
}

export function canShowLivePosition(status: GpsBusStatus | undefined) {
  return status?.state === "connected";
}
