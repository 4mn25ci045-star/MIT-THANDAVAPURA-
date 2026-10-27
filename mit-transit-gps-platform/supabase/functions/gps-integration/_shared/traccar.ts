import type { NormalizedBusPosition, ProviderPositionResult } from "./types.ts";

type TraccarDevice = { id?: unknown; positionId?: unknown };
type TraccarPosition = {
  id?: unknown;
  deviceId?: unknown;
  valid?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  speed?: unknown;
  course?: unknown;
  fixTime?: unknown;
  deviceTime?: unknown;
  attributes?: Record<string, unknown>;
};
type TraccarConfig = { baseUrl: string; token: string };

const KNOTS_TO_METERS_PER_SECOND = 0.514444;
const REQUEST_TIMEOUT_MS = 8_000;

function configuredCredentials(): TraccarConfig | null {
  const serverUrl = Deno.env.get("TRACCAR_SERVER_URL")?.trim();
  const token = Deno.env.get("TRACCAR_API_TOKEN")?.trim();
  if (!serverUrl || !token) return null;
  try {
    const parsed = new URL(serverUrl);
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(localHost && parsed.protocol === "http:")) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return { baseUrl: parsed.toString().replace(/\/$/, ""), token };
  } catch {
    return null;
  }
}

function apiUrl(baseUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/api/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function traccarGet<T>(
  config: TraccarConfig,
  path: string,
  params: Record<string, string>,
): Promise<{ response: Response; payload: T | null }> {
  const response = await fetch(apiUrl(config.baseUrl, path, params), {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return { response, payload: null };
  try {
    return { response, payload: (await response.json()) as T };
  } catch {
    return { response, payload: null };
  }
}

function deniedOrError(status: number): ProviderPositionResult {
  if (status === 401 || status === 403) {
    return {
      state: "permission_denied",
      message: "The provider denied API access for this account.",
    };
  }
  return { state: "provider_error", message: "The provider API request failed." };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalize(position: TraccarPosition): NormalizedBusPosition | null {
  if (position.valid !== true) return null;
  const latitude = finiteNumber(position.latitude);
  const longitude = finiteNumber(position.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  const timestamp = typeof position.fixTime === "string" ? position.fixTime : position.deviceTime;
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) return null;
  const rawSpeedKnots = finiteNumber(position.speed);
  const rawCourse = finiteNumber(position.course);
  const attributes = position.attributes ?? {};
  const normalized: NormalizedBusPosition = {
    latitude,
    longitude,
    speedMps:
      rawSpeedKnots === null ? null : Math.max(0, rawSpeedKnots * KNOTS_TO_METERS_PER_SECOND),
    headingDegrees: rawCourse === null ? null : ((rawCourse % 360) + 360) % 360,
    recordedAt: new Date(Date.parse(timestamp)).toISOString(),
  };
  if (typeof attributes["ignition"] === "boolean") normalized.ignitionOn = attributes["ignition"];
  const fuelPercent = finiteNumber(attributes["fuelPercent"]);
  if (fuelPercent !== null && fuelPercent >= 0 && fuelPercent <= 100)
    normalized.fuelPercent = fuelPercent;
  return normalized;
}

/** Traccar's server-assigned device ID is used; IMEI/uniqueId is never used for lookup. */
export async function readTraccarPosition(
  providerDeviceId: string,
): Promise<ProviderPositionResult> {
  const config = configuredCredentials();
  if (!config) {
    return { state: "not_configured", message: "Traccar backend secrets are not configured." };
  }
  if (!/^\d{1,18}$/.test(providerDeviceId)) {
    return { state: "provider_error", message: "The saved Traccar device ID is invalid." };
  }
  try {
    const { response: deviceResponse, payload: devices } = await traccarGet<TraccarDevice[]>(
      config,
      "devices",
      { id: providerDeviceId },
    );
    if (!deviceResponse.ok) return deniedOrError(deviceResponse.status);
    const device = Array.isArray(devices)
      ? devices.find((candidate) => String(candidate.id) === providerDeviceId)
      : undefined;
    if (!device)
      return { state: "no_position", message: "The saved provider device was not found." };
    if (typeof device.positionId !== "number" || !Number.isSafeInteger(device.positionId)) {
      return { state: "no_position", message: "The provider device has not reported a position." };
    }
    const { response: positionResponse, payload: positions } = await traccarGet<TraccarPosition[]>(
      config,
      "positions",
      { id: String(device.positionId) },
    );
    if (!positionResponse.ok) return deniedOrError(positionResponse.status);
    const position = Array.isArray(positions)
      ? positions.find(
          (candidate) =>
            candidate.id === device.positionId && String(candidate.deviceId) === providerDeviceId,
        )
      : undefined;
    if (!position)
      return {
        state: "no_position",
        message: "The provider returned no position for this device.",
      };
    const normalized = normalize(position);
    if (!normalized) {
      return {
        state: "no_position",
        message: "The provider position is invalid or lacks a valid GPS fix.",
      };
    }
    return { state: "connected", position: normalized };
  } catch {
    return { state: "provider_error", message: "The provider could not be reached." };
  }
}
