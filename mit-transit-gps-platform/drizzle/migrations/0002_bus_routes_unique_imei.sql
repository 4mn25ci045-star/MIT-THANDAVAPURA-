CREATE UNIQUE INDEX IF NOT EXISTS bus_routes_imei_key ON public.bus_routes (imei);
COMMENT ON COLUMN public.bus_routes.imei IS 'Registered GPS device IMEI; unique per device; visible to approved personnel only.';
COMMENT ON COLUMN public.bus_routes.driver_phone IS 'Assigned driver contact; visible to approved personnel only.';