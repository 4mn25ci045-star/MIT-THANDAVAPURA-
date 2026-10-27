CREATE TABLE public.bus_gps_devices (
  route_id uuid PRIMARY KEY REFERENCES public.bus_routes(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  provider_device_id text NOT NULL CHECK (length(trim(provider_device_id)) BETWEEN 1 AND 128),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code IN ('not_configured','no_position','stale','permission_denied','provider_error','unsupported_provider')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_device_id)
);

ALTER TABLE public.bus_gps_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bus_gps_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_gps_devices TO service_role;

ALTER TABLE public.bus_positions
  ADD COLUMN ignition_on boolean,
  ADD COLUMN fuel_percent double precision CHECK (fuel_percent IS NULL OR fuel_percent BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.student_bus_feed() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE WHEN NOT public.is_personnel() THEN jsonb_build_object('routes','[]'::jsonb,'positions','[]'::jsonb) ELSE jsonb_build_object(
  'routes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'bus_number',r.bus_number,'route_number',r.route_number,'origin',r.origin,'destination',r.destination,'direction',r.direction,'geometry',r.geometry,'stops',r.stops,'default_color',r.default_color) ORDER BY r.route_number) FROM public.bus_routes r WHERE r.student_visible), '[]'::jsonb),
  'positions', COALESCE((SELECT jsonb_agg(jsonb_build_object('route_id',p.route_id,'latitude',p.latitude,'longitude',p.longitude,'recorded_at',p.recorded_at,'speed_mps',p.speed_mps,'eta_seconds',p.eta_seconds,'eta_target_latitude',p.eta_target_latitude,'eta_target_longitude',p.eta_target_longitude,'ignition_on',p.ignition_on,'fuel_percent',p.fuel_percent)) FROM public.bus_positions p JOIN public.bus_routes r ON r.id=p.route_id WHERE r.student_visible AND p.recorded_at > now()-interval '2 minutes' AND p.recorded_at <= now()+interval '30 seconds'), '[]'::jsonb)) END;
$$;
REVOKE ALL ON FUNCTION public.student_bus_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_bus_feed() TO authenticated;
