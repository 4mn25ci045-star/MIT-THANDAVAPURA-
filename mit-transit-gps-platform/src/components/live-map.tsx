/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, LocateFixed, Plus, Minus, Radio, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canShowLivePosition, gpsStatusLabel } from "@/lib/gps/status";
import type { GpsBusStatus } from "@/lib/gps/types";
import {
  routeStyle,
  routePoints,
  routeStops,
  isFresh,
  MIT_ORANGE,
  type BusRoute,
  type Position,
  type Point,
} from "@/lib/tracking";

declare global {
  interface Window {
    initCollegeMap?: () => void;
  }
}

type LiveMapProps = {
  routes: BusRoute[];
  positions: Position[];
  statuses?: GpsBusStatus[];
  gpsLoading?: boolean;
  gpsError?: boolean;
  selected: string | null;
  userLocation: Point | null;
  authorized: boolean;
  onSelect: (id: string) => void;
};

export function LiveMap({
  routes,
  positions,
  statuses = [],
  gpsLoading = false,
  gpsError = false,
  selected,
  userLocation,
  authorized,
  onSelect,
}: LiveMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const frames = useRef(new Map<string, number>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasGeometry = routes.some((route) => routePoints(route.geometry).length > 0);
  const selectedRoute = routes.find((route) => route.id === selected);
  const selectedStatus = statuses.find((status) => status.routeId === selected);
  const selectedPosition = positions.find(
    (position) =>
      position.route_id === selected && canShowLivePosition(selectedStatus) && isFresh(position),
  );
  const livePositionCount = positions.filter((position) => {
    const status = statuses.find((candidate) => candidate.routeId === position.route_id);
    return canShowLivePosition(status) && isFresh(position);
  }).length;

  useEffect(() => {
    if (!authorized || !hasGeometry || !host.current) return;
    let disposed = false;
    function init() {
      if (disposed || !host.current) return;
      map.current = new google.maps.Map(host.current, {
        center: { lat: 12.1, lng: 76.65 },
        zoom: 12,
        disableDefaultUI: true,
        clickableIcons: false,
        mapTypeControl: false,
      });
      setReady(true);
    }
    if (window.google?.maps?.Map) {
      init();
      return;
    }
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    if (!key) {
      setFailed(true);
      return;
    }
    window.initCollegeMap = init;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=initCollegeMap&channel=${encodeURIComponent(import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "")}`;
    script.async = true;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => {
      disposed = true;
      delete window.initCollegeMap;
      script.remove();
      setReady(false);
      map.current = null;
    };
  }, [authorized, hasGeometry]);

  useEffect(() => {
    const current = map.current;
    if (!ready || !current) return;
    const overlays: (google.maps.Polyline | google.maps.Marker)[] = [];
    const bounds = new google.maps.LatLngBounds();
    for (const route of routes) {
      const path = routePoints(route.geometry);
      if (!path.length) continue;
      const line = new google.maps.Polyline({
        map: current,
        path,
        ...routeStyle(route, selected),
        icons: [
          {
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2 },
            offset: "50%",
            repeat: "150px",
          },
        ],
      });
      line.addListener("click", () => onSelect(route.id));
      overlays.push(line);
      if (!selected || route.id === selected) path.forEach((point) => bounds.extend(point));
      if (route.id !== selected) continue;
      const first = path[0];
      const last = path[path.length - 1];
      if (!first || !last) continue;
      const points = [
        { ...first, name: route.origin ?? "Starting point" },
        ...routeStops(route.stops),
        { ...last, name: route.destination ?? "Destination" },
      ];
      points.forEach((stop, index) =>
        overlays.push(
          new google.maps.Marker({
            map: current,
            position: stop,
            title: stop.name,
            label: { text: `${index + 1}`, color: MIT_ORANGE },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: getComputedStyle(document.documentElement).getPropertyValue("--card"),
              fillOpacity: 1,
              strokeColor: MIT_ORANGE,
              strokeWeight: 2,
            },
          }),
        ),
      );
    }
    if (!bounds.isEmpty()) current.fitBounds(bounds, 65);
    return () => overlays.forEach((overlay) => overlay.setMap(null));
  }, [routes, selected, ready, onSelect]);

  useEffect(() => {
    const current = map.current;
    if (!ready || !current) return;
    const active = new Set<string>();
    for (const position of positions) {
      const status = statuses.find((candidate) => candidate.routeId === position.route_id);
      if (!canShowLivePosition(status) || !isFresh(position)) continue;
      const route = routes.find((candidate) => candidate.id === position.route_id);
      if (!route) continue;
      active.add(position.route_id);
      let marker = markers.current.get(position.route_id);
      const target = { lat: position.latitude, lng: position.longitude };
      if (!marker) {
        marker = new google.maps.Marker({
          map: current,
          position: target,
          title: `Bus ${route.bus_number}`,
        });
        marker.addListener("click", () => onSelect(route.id));
        markers.current.set(position.route_id, marker);
      }
      marker.setIcon({
        path: "M -9,-12 L 9,-12 L 9,10 L 6,10 L 6,13 L 3,13 L 3,10 L -3,10 L -3,13 L -6,13 L -6,10 L -9,10 Z M -6,-8 L 6,-8 L 6,1 L -6,1 Z",
        fillColor: route.id === selected ? MIT_ORANGE : route.default_color,
        fillOpacity: selected && route.id !== selected ? 0.7 : 1,
        strokeColor: MIT_ORANGE,
        strokeWeight: 1,
        scale: 1.4,
      });
      const previous = marker.getPosition();
      const oldFrame = frames.current.get(position.route_id);
      if (oldFrame) cancelAnimationFrame(oldFrame);
      if (previous) {
        const start = performance.now();
        const from = { lat: previous.lat(), lng: previous.lng() };
        const movingMarker = marker;
        const animate = (now: number) => {
          const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 1
            : Math.min(1, (now - start) / 1800);
          movingMarker.setPosition({
            lat: from.lat + (target.lat - from.lat) * duration,
            lng: from.lng + (target.lng - from.lng) * duration,
          });
          if (duration < 1) frames.current.set(position.route_id, requestAnimationFrame(animate));
        };
        frames.current.set(position.route_id, requestAnimationFrame(animate));
      }
    }
    for (const [id, marker] of markers.current) {
      if (active.has(id)) continue;
      marker.setMap(null);
      markers.current.delete(id);
      const frame = frames.current.get(id);
      if (frame) cancelAnimationFrame(frame);
    }
  }, [positions, statuses, routes, selected, ready, onSelect]);

  useEffect(() => {
    const current = map.current;
    if (!ready || !current || !userLocation) return;
    const marker = new google.maps.Marker({
      map: current,
      position: userLocation,
      title: "Your location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: MIT_ORANGE,
        fillOpacity: 1,
        strokeColor: MIT_ORANGE,
        strokeWeight: 2,
      },
    });
    return () => marker.setMap(null);
  }, [userLocation, ready]);

  useEffect(
    () => () => {
      for (const frame of frames.current.values()) cancelAnimationFrame(frame);
      for (const marker of markers.current.values()) marker.setMap(null);
    },
    [],
  );

  const selectedLocationStale = selectedStatus?.state === "connected" && !selectedPosition;
  const statusLabel = selected
    ? selectedLocationStale && !gpsError && !gpsLoading
      ? "GPS location stale"
      : gpsStatusLabel(selectedStatus, gpsLoading, gpsError)
    : livePositionCount > 0
      ? "GPS connected"
      : gpsStatusLabel(undefined, gpsLoading, gpsError);
  const emptyTitle = !authorized
    ? "Your journey starts here"
    : failed
      ? "Map unavailable"
      : !hasGeometry
        ? "Waiting for route data"
        : selectedStatus?.state === "stale" || selectedLocationStale
          ? "GPS location stale"
          : selectedStatus?.state === "permission_denied"
            ? "GPS provider access denied"
            : selectedStatus?.state === "provider_error" || gpsError
              ? "GPS API error"
              : selected && selectedStatus?.state === "no_position"
                ? "No GPS position received"
                : selected && (!selectedStatus || selectedStatus.state === "not_configured")
                  ? "GPS not connected"
                  : selected && !selectedPosition
                    ? "Waiting for GPS location"
                    : "Loading your map";
  const emptyMessage = !authorized
    ? "Sign in to find your college bus and follow its journey."
    : failed
      ? "The map could not be loaded. Please try again later."
      : !hasGeometry
        ? "Your college’s routes will appear when real route data is connected."
        : selectedLocationStale
          ? "The provider was reached, but the latest position is not fresh enough to display as live."
          : (selectedStatus?.message ??
            (gpsError
              ? "GPS connection status could not be checked. No location is shown as live."
              : "Connect an authorized provider and map its server-side device ID to this bus."));

  return (
    <section className="map-panel" aria-label="Live bus map">
      <div ref={host} className="map-container" />
      <div className="map-head">
        <span className="map-tag">
          <MapPin size={13} />
          Thandavapura campus
        </span>
        <span className="map-tag">
          <span className={`status-dot ${selectedPosition ? "live" : ""}`} />
          {statusLabel}
        </span>
      </div>
      {(!ready || failed || (!!selected && !selectedPosition)) && (
        <div className="map-empty">
          <span className="map-icon">
            <Navigation size={27} />
          </span>
          <h2>{emptyTitle}</h2>
          <p>{emptyMessage}</p>
        </div>
      )}
      <div className="map-bottom">
        <span className="map-attribution">
          <Radio size={12} />
          {selectedRoute ? `Route ${selectedRoute.route_number}` : "No bus selected"}
        </span>
        <div className="map-controls">
          <Button
            size="icon"
            variant="outline"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={!ready}
            onClick={() => map.current?.setZoom((map.current.getZoom() ?? 12) + 1)}
          >
            <Plus />
          </Button>
          <Button
            size="icon"
            variant="outline"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => map.current?.setZoom((map.current.getZoom() ?? 12) - 1)}
          >
            <Minus />
          </Button>
          <Button
            size="icon"
            variant="outline"
            title="Center on my location"
            aria-label="Center on my location"
            disabled={!ready || !userLocation}
            onClick={() => {
              if (userLocation) map.current?.panTo(userLocation);
            }}
          >
            <LocateFixed />
          </Button>
          <Button
            size="icon"
            variant="outline"
            title="Expand map"
            aria-label="Expand map"
            onClick={() => host.current?.parentElement?.requestFullscreen().catch(() => {})}
          >
            <Maximize />
          </Button>
        </div>
      </div>
    </section>
  );
}
