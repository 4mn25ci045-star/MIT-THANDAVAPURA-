import { Clock3, Fuel, MapPin, Radio, Zap } from "lucide-react";
import { isFresh, type Position } from "@/lib/tracking";
import { gpsStatusLabel } from "@/lib/gps/status";
import type { GpsBusStatus } from "@/lib/gps/types";

export function GpsLiveDetails({
  busNumber,
  status,
  position,
  loading = false,
  failed = false,
}: {
  busNumber: string | undefined;
  status: GpsBusStatus | undefined;
  position: Position | undefined;
  loading?: boolean;
  failed?: boolean;
}) {
  const fresh = !!position && isFresh(position);
  const live = status?.state === "connected" && fresh;
  const lastKnown = status?.state === "stale" && !!position;
  const updatedAt = position?.recorded_at ?? status?.lastUpdatedAt ?? null;
  const statusMessage = failed
    ? "GPS connection status could not be checked. Location is not shown as live."
    : (status?.message ??
      (loading
        ? "Checking authorized GPS provider configuration…"
        : "No authorized GPS provider is configured for this bus."));

  return (
    <section className="utility gps-live-details" aria-live="polite" aria-label="Bus GPS details">
      <div className="utility-header">
        <div className="utility-title">
          <span className="utility-icon">
            <Radio size={16} />
          </span>
          <div>
            <h3>{busNumber ? `Bus ${busNumber} GPS` : "Bus GPS"}</h3>
            <p>{gpsStatusLabel(status, loading, failed)}</p>
          </div>
        </div>
        <span className={`safe-badge ${live ? "gps-connected-badge" : ""}`}>
          <span className={`status-dot ${live ? "live" : ""}`} />
          {live ? "Verified live" : lastKnown ? "Last known · stale" : "Not live"}
        </span>
      </div>
      <p className="metric-sub gps-status-message">
        {statusMessage}
        {status?.state === "stale" && updatedAt && (
          <> Last provider report: {new Date(updatedAt).toLocaleString()}.</>
        )}
        {status?.state === "connected" && position && !fresh && (
          <> The returned position is no longer fresh enough to show as live.</>
        )}
      </p>
      {(live || lastKnown) && position && (
        <div className="gps-telemetry-grid">
          <div>
            <span className="metric-label">
              <MapPin size={12} />
              {live ? "Live coordinates" : "Last known coordinates"}
            </span>
            <strong>
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </strong>
          </div>
          {position.speed_mps !== null && Number.isFinite(position.speed_mps) && (
            <div>
              <span className="metric-label">Speed</span>
              <strong>{(position.speed_mps * 3.6).toFixed(1)} km/h</strong>
            </div>
          )}
          {updatedAt && (
            <div>
              <span className="metric-label">
                <Clock3 size={12} />
                {live ? "Last updated" : "Recorded"}
              </span>
              <strong>{new Date(updatedAt).toLocaleString()}</strong>
            </div>
          )}
          {typeof position.ignition_on === "boolean" && (
            <div>
              <span className="metric-label">
                <Zap size={12} />
                Ignition
              </span>
              <strong>{position.ignition_on ? "On" : "Off"}</strong>
            </div>
          )}
          {typeof position.fuel_percent === "number" && Number.isFinite(position.fuel_percent) && (
            <div>
              <span className="metric-label">
                <Fuel size={12} />
                Fuel
              </span>
              <strong>{position.fuel_percent.toFixed(0)}%</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
