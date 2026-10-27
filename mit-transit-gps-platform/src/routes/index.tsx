import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BusFront,
  Search,
  LocateFixed,
  Navigation,
  Clock3,
  MapPin,
  BellRing,
  Phone,
  Mic,
  ShieldCheck,
  ArrowRight,
  CircleDot,
  Route as RouteIcon,
  Square,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CollegeShell, useAccount, SignInDialog } from "@/components/college-shell";
import { LiveMap } from "@/components/live-map";
import { GpsLiveDetails } from "@/components/gps-live-details";
import { supabase } from "@/integrations/supabase/client";
import {
  routePoints,
  routeStops,
  distanceMeters,
  nearStop,
  isFresh,
  etaFor,
  type BusRoute,
  type Position,
  type Point,
} from "@/lib/tracking";
import { matchesRoute, searchSelection } from "@/lib/campus";
import { syncGpsPositions } from "@/lib/gps.functions";
import type { GpsBusStatus } from "@/lib/gps/types";
import busImage from "@/assets/college-bus.jpg";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Travel | MIT Thandavapura" },
      {
        name: "description",
        content:
          "Secure MIT Thandavapura college bus tracking, live route locations and stop alerts.",
      },
      { property: "og:title", content: "MIT Thandavapura Campus Transport" },
      {
        property: "og:description",
        content: "Find your college bus and follow real GPS updates with secure personnel access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Travel,
});
function Travel() {
  const { data: user } = useAccount();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [location, setLocation] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [splash, setSplash] = useState(true);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [radius, setRadius] = useState(500);
  const [stopName, setStopName] = useState("");
  const notified = useRef("");
  const [now, setNow] = useState(Date.now());
  const [recording, setRecording] = useState(false);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const approval = useQuery({
    queryKey: ["personnel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_personnel");
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const authorized = approval.data === true;
  const syncGps = useServerFn(syncGpsPositions);
  const gpsSync = useQuery({
    queryKey: ["gps-status", user?.id],
    enabled: authorized,
    queryFn: () => syncGps(),
    refetchInterval: authorized ? 10000 : false,
    retry: false,
  });
  const fleet = useQuery({
    queryKey: ["fleet", user?.id],
    enabled: authorized,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bus_routes")
        .select(
          "id,route_number,bus_number,origin,destination,direction,geometry,stops,driver_name,driver_phone,default_color",
        )
        .order("route_number");
      if (error) throw error;
      return data as BusRoute[];
    },
    retry: false,
  });
  const gps = useQuery({
    queryKey: ["positions", user?.id],
    enabled: authorized,
    queryFn: async () => {
      const { data, error } = await supabase.from("bus_positions").select("*");
      if (error) throw error;
      return data as Position[];
    },
    refetchInterval: authorized ? 10000 : false,
    retry: false,
  });
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("alert_distance_m")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const routes = useMemo(() => fleet.data ?? [], [fleet.data]);
  const gpsStatuses = (gpsSync.data?.statuses ?? []) as GpsBusStatus[];
  const connectedRouteIds = new Set(
    gpsStatuses.filter((status) => status.state === "connected").map((status) => status.routeId),
  );
  const positions = (gps.data ?? []).filter((position) => connectedRouteIds.has(position.route_id));
  const bus = routes.find((r) => r.id === selected);
  const position = positions.find((p) => p.route_id === selected && isFresh(p, now));
  const stops = routeStops(bus?.stops);
  const stop = stops.find((s) => s.name === stopName);
  const target = stop ?? location;
  const distance =
    position && target
      ? distanceMeters({ lat: position.latitude, lng: position.longitude }, target)
      : null;
  const eta = position ? etaFor(position, target) : null;
  const results = routes.filter((r) => matchesRoute(r, search));
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1800);
    const clock = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearTimeout(t);
      clearInterval(clock);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (profile.data) setRadius(profile.data.alert_distance_m);
  }, [profile.data]);
  useEffect(() => {
    if (!authorized) return;
    const channel = supabase
      .channel("campus-positions")
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_positions" }, () =>
        qc.invalidateQueries({ queryKey: ["positions"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized, qc]);
  const selectBus = useCallback((id: string) => {
    setSelected(id);
    setStopName("");
    notified.current = "";
    setVoice(null);
  }, []);
  useEffect(() => {
    const next = searchSelection(routes, search, selected);
    if (next !== selected) {
      setSelected(next);
      setStopName("");
      notified.current = "";
    }
  }, [search, routes, selected]);
  useEffect(() => {
    if (!alertEnabled || !position || !stop || !bus) return;
    const key = `${bus.id}:${stop.name}`;
    if (nearStop({ lat: position.latitude, lng: position.longitude }, stop, radius)) {
      if (notified.current !== key) {
        notified.current = key;
        toast.success(`Bus ${bus.bus_number} is near ${stop.name}`);
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("Your college bus is nearby", {
            body: `Bus ${bus.bus_number} is within ${radius} m of ${stop.name}.`,
          });
      }
    } else if (
      distanceMeters({ lat: position.latitude, lng: position.longitude }, stop) >
      radius * 1.5
    ) {
      notified.current = "";
    }
  }, [alertEnabled, position, stop, bus, radius]);
  async function locate() {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
        toast.success("Your location is ready.");
      },
      () => {
        setLocating(false);
        toast.error("Allow location access to calculate your distance.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }
  async function toggleAlert(enabled: boolean) {
    if (enabled && !stop) {
      toast.error("Select a stop first.");
      return;
    }
    if (enabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        toast.info("Alerts will appear inside the app while it is open.");
    }
    setAlertEnabled(enabled);
  }
  async function changeRadius(value: number) {
    const previous = radius;
    setRadius(value);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ alert_distance_m: value })
        .eq("id", user.id);
      if (error) {
        setRadius(previous);
        toast.error("Could not save alert distance.");
      }
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error("Voice recording is unavailable on this device.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(media);
      recorder.current = r;
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        setVoice(new Blob(chunks, { type: r.mimeType }));
        media.getTracks().forEach((t) => t.stop());
      };
      r.start();
      setRecording(true);
      setTimeout(() => {
        if (r.state === "recording") {
          r.stop();
          setRecording(false);
        }
      }, 60000);
    } catch {
      toast.error("Allow microphone access to record a message.");
    }
  }
  async function sendVoice() {
    if (!voice || !user || !bus) return;
    setSending(true);
    try {
      const extension = voice.type.includes("mp4")
        ? "m4a"
        : voice.type.includes("ogg")
          ? "ogg"
          : "webm";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("voice-messages").upload(path, voice);
      if (error) throw error;
      const result = await supabase
        .from("voice_messages")
        .insert({ user_id: user.id, route_id: bus.id, storage_path: path });
      if (result.error) throw result.error;
      toast.success("Voice message saved for this bus. Driver delivery is not connected yet.");
      setVoice(null);
    } catch {
      toast.error("Could not save your voice message.");
    } finally {
      setSending(false);
    }
  }
  return (
    <CollegeShell tab="travel">
      {splash && (
        <div className="splash" aria-hidden="true">
          <div className="splash-brand">MIT</div>
          <div className="splash-location">Thandavapura</div>
          <div className="splash-line" />
        </div>
      )}
      <div className="page-heading">
        <div>
          <div className="eyebrow">Campus transport</div>
          <h1>
            Let’s get you there<span className="text-primary">.</span>
          </h1>
          <p>Your college bus. Your route. One less thing to worry about.</p>
        </div>
        <Button variant="outline" className="location-button" onClick={locate} disabled={locating}>
          <LocateFixed size={14} />
          <span>{locating ? "Locating…" : location ? "Location enabled" : "Use my location"}</span>
        </Button>
      </div>
      <div className="travel-layout">
        <aside className="fleet-panel">
          <div className="fleet-top">
            <div className="section-title">
              Find your bus <span className="count">{routes.length} routes</span>
            </div>
            <label className="search-box">
              <Search />
              <input
                aria-label="Search bus or route number"
                placeholder="Search bus or route number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setSelected(null);
                  }}
                >
                  ×
                </Button>
              )}
            </label>
          </div>
          {results.length ? (
            results.map((r) => (
              <Button
                key={r.id}
                variant="ghost"
                className={`fleet-item ${selected === r.id ? "selected" : ""}`}
                onClick={() => selectBus(r.id)}
              >
                <span className="route-chip">{r.bus_number}</span>
                <span className="min-w-0">
                  <strong className="text-xs">Route {r.route_number}</strong>
                  <p>
                    {r.origin && r.destination
                      ? `${r.origin} → ${r.destination}`
                      : "Route details unavailable"}
                  </p>
                </span>
                <ArrowRight size={14} className="ml-auto" />
              </Button>
            ))
          ) : (
            <div className="fleet-empty">
              <img
                src={busImage}
                alt="Orange college shuttle illustration"
                width={1024}
                height={768}
              />
              <h3>
                {!user
                  ? "A better way to campus"
                  : approval.isPending
                    ? "Checking college access"
                    : !authorized
                      ? "College approval required"
                      : fleet.isPending
                        ? "Loading your buses"
                        : fleet.error
                          ? "Routes unavailable"
                          : search
                            ? "No matching bus"
                            : "No buses connected yet"}
              </h3>
              <p>
                {!user
                  ? "Your next ride is just a sign-in away."
                  : !authorized
                    ? "Your account must be on the college’s approved personnel list."
                    : search
                      ? "Try another bus or route number."
                      : "Registered buses will appear here when your college adds them."}
              </p>
              {!user && (
                <Button
                  variant="link"
                  size="sm"
                  className="empty-auth px-0 mt-1"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in to travel
                  <ArrowRight size={13} />
                </Button>
              )}
            </div>
          )}
          <div className="fleet-note">
            <ShieldCheck size={14} />
            <span>
              Verified college transport.
              <br />
              Live locations from onboard GPS devices.
            </span>
          </div>
        </aside>
        <LiveMap
          routes={routes}
          positions={positions}
          statuses={gpsStatuses}
          gpsLoading={gpsSync.isPending}
          gpsError={!!gpsSync.error}
          selected={selected}
          userLocation={location}
          authorized={authorized}
          onSelect={selectBus}
        />
      </div>
      <section className="journey-panel">
        <div className="journey-heading">
          <h2>
            <RouteIcon size={16} />
            {bus ? `Bus ${bus.bus_number} · Route ${bus.route_number}` : "Your journey"}
          </h2>
          <span>{bus?.direction ?? "Select a bus to see your journey details"}</span>
        </div>
        <div className="journey-metrics">
          <div className="metric">
            <div className="metric-label">
              <Navigation size={13} />
              Distance to {stop ? "your stop" : "you"}
            </div>
            <div className="metric-value">
              {distance !== null ? (distance / 1000).toFixed(1) : "—"}
              <small>km</small>
            </div>
            <p className="metric-sub">
              {!location && !stop
                ? "Location not set"
                : position
                  ? "From the latest GPS update"
                  : "Waiting for live location"}
            </p>
          </div>
          <div className="metric">
            <div className="metric-label">
              <Clock3 size={13} />
              Estimated arrival
            </div>
            <div className="metric-value">
              {eta !== null ? Math.ceil(eta / 60) : "—"}
              <small>min</small>
            </div>
            <p className="metric-sub">
              {eta !== null ? "Live estimated arrival" : "Arrival estimate unavailable"}
            </p>
          </div>
          <div className="metric">
            <div className="metric-label">
              <MapPin size={13} />
              Your pickup stop
            </div>
            <div className="metric-value text-base">{stop?.name ?? "Not selected"}</div>
            <p className="metric-sub">{bus?.destination ?? "Choose your stop from the route"}</p>
          </div>
        </div>
        {bus && routePoints(bus.geometry).length > 0 && (
          <div className="route-stops">
            <span>
              <CircleDot size={12} />
              {bus.origin ?? "Starting point"}
            </span>
            {stops.map((s, i) => (
              <span key={`${s.name}-${i}`}>
                <ArrowRight size={11} />
                {s.name}
              </span>
            ))}
            <span>
              <ArrowRight size={11} />
              {bus.destination ?? "Destination"}
            </span>
          </div>
        )}
      </section>
      <GpsLiveDetails
        busNumber={bus?.bus_number}
        status={gpsStatuses.find((status) => status.routeId === selected)}
        position={position}
        loading={gpsSync.isPending}
        failed={!!gpsSync.error}
      />
      <div className="utility-grid">
        <section className="utility">
          <div className="utility-header">
            <div className="utility-title">
              <span className="utility-icon">
                <BellRing size={17} />
              </span>
              <div>
                <h3>Never miss your bus</h3>
                <p>Get an alert when your bus is near your stop.</p>
              </div>
            </div>
            <Switch
              aria-label="Enable stop-near notifications"
              checked={alertEnabled}
              onCheckedChange={toggleAlert}
              disabled={!authorized || !bus}
            />
          </div>
          <div className="alert-settings">
            <select
              aria-label="Pickup stop"
              className="field-select"
              value={stopName}
              onChange={(e) => {
                setStopName(e.target.value);
                setAlertEnabled(false);
              }}
              disabled={!stops.length}
            >
              <option value="">Select your stop</option>
              {stops.map((s, i) => (
                <option key={i}>{s.name}</option>
              ))}
            </select>
            <select
              aria-label="Alert distance"
              className="field-select distance-select"
              value={radius}
              onChange={(e) => changeRadius(Number(e.target.value))}
            >
              {[100, 250, 500, 1000, 2000, 5000].map((v) => (
                <option value={v} key={v}>
                  {v >= 1000 ? `${v / 1000} km` : `${v} m`} away
                </option>
              ))}
            </select>
          </div>
        </section>
        <section className="utility">
          <div className="utility-header">
            <div className="utility-title">
              <span className="utility-icon">
                <Phone size={16} />
              </span>
              <div>
                <h3>{bus?.driver_name ?? "Connect with your driver"}</h3>
                <p>{bus ? "Your route’s driver contact" : "Select a bus to contact the driver."}</p>
              </div>
            </div>
            <span className="safe-badge">
              <ShieldCheck size={11} />
              College verified
            </span>
          </div>
          <div className="driver-actions">
            {bus?.driver_phone ? (
              <Button asChild variant="outline">
                <a href={`tel:${bus.driver_phone}`}>
                  <Phone />
                  Call driver
                </a>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <Phone />
                Call driver
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!authorized || !bus || sending}
              onClick={voice ? sendVoice : record}
            >
              {recording ? <Square /> : voice ? <Send /> : <Mic />}
              {recording
                ? "Stop recording"
                : voice
                  ? sending
                    ? "Saving…"
                    : "Save message"
                  : "Voice message"}
            </Button>
          </div>
          {voice && (
            <p className="empty-hint">Recording ready. Delivery to the driver is not connected.</p>
          )}
        </section>
      </div>
      <SignInDialog open={authOpen} onOpenChange={setAuthOpen} />
    </CollegeShell>
  );
}
