export type GpsProviderId = "traccar";

export type GpsConnectionState =
  | "not_configured"
  | "connected"
  | "no_position"
  | "stale"
  | "permission_denied"
  | "provider_error"
  | "unsupported_provider";

/** Provider-independent fields persisted in bus_positions. */
export type NormalizedBusPosition = {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDegrees: number | null;
  recordedAt: string;
  /** Present only when an adapter receives an actual boolean ignition field. */
  ignitionOn?: boolean;
  /** Present only when a provider supplies an explicitly percent-based fuel field. */
  fuelPercent?: number;
};

/** Safe-to-return status; never includes provider credentials or device identifiers. */
export type GpsBusStatus = {
  routeId: string;
  state: GpsConnectionState;
  providerName: string | null;
  checkedAt: string | null;
  lastUpdatedAt: string | null;
  message: string;
};

export type ProviderPositionResult =
  | { state: "connected"; position: NormalizedBusPosition }
  | { state: "no_position"; message: string }
  | { state: "permission_denied"; message: string }
  | { state: "provider_error"; message: string };
