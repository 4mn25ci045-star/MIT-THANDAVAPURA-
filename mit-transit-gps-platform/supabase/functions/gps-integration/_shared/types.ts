export type GpsConnectionState =
  | "not_configured"
  | "connected"
  | "no_position"
  | "stale"
  | "permission_denied"
  | "provider_error"
  | "unsupported_provider";

export type NormalizedBusPosition = {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDegrees: number | null;
  recordedAt: string;
  ignitionOn?: boolean;
  fuelPercent?: number;
};

export type ProviderPositionResult =
  | { state: "connected"; position: NormalizedBusPosition }
  | {
      state: Exclude<GpsConnectionState, "connected" | "stale" | "unsupported_provider">;
      message: string;
    };

export type GpsBusStatus = {
  routeId: string;
  state: GpsConnectionState;
  providerName: string | null;
  checkedAt: string | null;
  lastUpdatedAt: string | null;
  message: string;
};

export type ProviderAdapter = {
  id: string;
  name: string;
  readPosition: (providerDeviceId: string) => Promise<ProviderPositionResult>;
};
