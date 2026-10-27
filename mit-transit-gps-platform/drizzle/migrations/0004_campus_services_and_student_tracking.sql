ALTER TABLE public.bus_routes ADD COLUMN student_visible boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bus_routes.student_visible IS 'Explicit college approval for the limited student tracking projection; private details are never returned.';
CREATE TABLE public.college_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000), published boolean NOT NULL DEFAULT false, published_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.college_updates TO authenticated; GRANT ALL ON public.college_updates TO service_role;
ALTER TABLE public.college_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY personnel_updates_read ON public.college_updates FOR SELECT TO authenticated USING (public.is_personnel() AND published);
CREATE TABLE public.bus_timetable (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), route_id uuid NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE, weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6), departure_time time NOT NULL, arrival_time time, pickup_stop text NOT NULL CHECK(length(pickup_stop) BETWEEN 1 AND 160), direction text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.bus_timetable TO authenticated; GRANT ALL ON public.bus_timetable TO service_role;
ALTER TABLE public.bus_timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY personnel_timetable_read ON public.bus_timetable FOR SELECT TO authenticated USING (public.is_personnel() AND published);
CREATE TABLE public.transport_issues (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), route_id uuid REFERENCES public.bus_routes(id) ON DELETE SET NULL, category text NOT NULL CHECK(category IN ('delay','missed_stop','safety','other')), description text NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000), status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','in_review','resolved')), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.transport_issues TO authenticated; GRANT ALL ON public.transport_issues TO service_role;
ALTER TABLE public.transport_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_issue_read ON public.transport_issues FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_personnel());
CREATE POLICY own_issue_insert ON public.transport_issues FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_personnel() AND status = 'submitted');
CREATE FUNCTION public.student_bus_feed() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE WHEN NOT public.is_personnel() THEN jsonb_build_object('routes','[]'::jsonb,'positions','[]'::jsonb) ELSE jsonb_build_object(
'routes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'bus_number',r.bus_number,'route_number',r.route_number,'origin',r.origin,'destination',r.destination,'direction',r.direction,'geometry',r.geometry,'stops',r.stops,'default_color',r.default_color) ORDER BY r.route_number) FROM public.bus_routes r WHERE r.student_visible), '[]'::jsonb),
'positions', COALESCE((SELECT jsonb_agg(jsonb_build_object('route_id',p.route_id,'latitude',p.latitude,'longitude',p.longitude,'recorded_at',p.recorded_at,'eta_seconds',p.eta_seconds,'eta_target_latitude',p.eta_target_latitude,'eta_target_longitude',p.eta_target_longitude)) FROM public.bus_positions p JOIN public.bus_routes r ON r.id=p.route_id WHERE r.student_visible AND p.recorded_at > now()-interval '2 minutes' AND p.recorded_at <= now()+interval '30 seconds'), '[]'::jsonb)) END;
$$;
REVOKE ALL ON FUNCTION public.student_bus_feed() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.student_bus_feed() TO authenticated;