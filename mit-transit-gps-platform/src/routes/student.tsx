import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, useMemo } from "react";
import { CollegeShell } from "@/components/college-shell";
import { CampusAccess, useCollegeAccess } from "@/components/campus-access";
import { Button } from "@/components/ui/button";
import { LiveMap } from "@/components/live-map";
import { GpsLiveDetails } from "@/components/gps-live-details";
import { getStudentFeed } from "@/lib/campus.functions";
import { campusHead, matchesRoute, searchSelection } from "@/lib/campus";
import { etaFor, isFresh, routeStops } from "@/lib/tracking";
import type { GpsBusStatus } from "@/lib/gps/types";
export const Route = createFileRoute("/student")({
  head: () =>
    campusHead(
      "Student tracking",
      "College-approved bus routes, current bus locations and verified arrival estimates without private device details.",
    ),
  component: Student,
});
function Student() {
  const access = useCollegeAccess();
  const load = useServerFn(getStudentFeed);
  const query = useQuery({
    queryKey: ["student-feed", access.user?.id],
    enabled: access.authorized,
    queryFn: () => load(),
    refetchInterval: 10000,
    retry: false,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [stopName, setStopName] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  const routes = useMemo(() => query.data?.routes ?? [], [query.data?.routes]);
  const gpsStatuses = (query.data?.gpsStatuses ?? []) as GpsBusStatus[];
  const positions = (query.data?.positions ?? []).filter((p) => now !== null && isFresh(p, now));
  const bus = routes.find((r) => r.id === selected);
  const stops = routeStops(bus?.stops);
  const stop = stops.find((s) => s.name === stopName);
  const position = positions.find((p) => p.route_id === selected);
  const eta = position ? etaFor(position, stop ?? null) : null;
  const select = useCallback((id: string) => {
    setSelected(id);
    setStopName("");
  }, []);
  useEffect(() => {
    setSelected((current) => searchSelection(routes, search, current));
  }, [routes, search]);
  return (
    <CollegeShell tab="student">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Approved college buses</div>
          <h1>
            Student tracking<span className="text-primary">.</span>
          </h1>
        </div>
      </div>
      <CampusAccess access={access}>
        <div className="campus-filters">
          <input
            className="form-input"
            aria-label="Search approved student buses"
            placeholder="Search bus or route number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-select"
            aria-label="Student pickup stop"
            value={stopName}
            disabled={!stops.length}
            onChange={(e) => setStopName(e.target.value)}
          >
            <option value="">Select pickup stop</option>
            {stops.map((s, i) => (
              <option key={i}>{s.name}</option>
            ))}
          </select>
        </div>
        {query.error ? (
          <p role="alert" className="form-error">
            Student tracking unavailable.{" "}
            <Button variant="link" onClick={() => query.refetch()}>
              Try again
            </Button>
          </p>
        ) : query.isPending ? (
          <p className="empty-hint">Loading approved buses…</p>
        ) : !routes.length ? (
          <p className="empty-hint">No buses have been approved for student tracking yet.</p>
        ) : (
          <div className="student-buses">
            {routes
              .filter((r) => matchesRoute(r, search))
              .map((r) => (
                <Button
                  key={r.id}
                  variant={selected === r.id ? "default" : "outline"}
                  onClick={() => select(r.id)}
                >
                  Bus {r.bus_number} · Route {r.route_number}
                </Button>
              ))}
            {!routes.some((r) => matchesRoute(r, search)) && (
              <p className="empty-hint">No matching bus or route.</p>
            )}
          </div>
        )}
        <LiveMap
          routes={routes}
          positions={positions}
          statuses={gpsStatuses}
          gpsLoading={query.isPending}
          gpsError={!!query.error}
          selected={selected}
          userLocation={null}
          authorized={access.authorized}
          onSelect={select}
        />
        <GpsLiveDetails
          busNumber={bus?.bus_number}
          status={gpsStatuses.find((status) => status.routeId === selected)}
          position={position}
          loading={query.isPending}
          failed={!!query.error}
        />
        <section className="student-arrival">
          <h2>
            {bus ? `Bus ${bus.bus_number} · Route ${bus.route_number}` : "Select an approved bus"}
          </h2>
          <p>{bus?.origin && bus?.destination ? `${bus.origin} → ${bus.destination}` : ""}</p>
          <p>
            {position
              ? `Current location: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : "Current location unavailable"}
          </p>
          <p>
            {eta === null
              ? "Estimated arrival unavailable"
              : `Estimated arrival: ${Math.ceil(eta / 60)} min to ${stopName}`}
          </p>
        </section>
      </CampusAccess>
    </CollegeShell>
  );
}
