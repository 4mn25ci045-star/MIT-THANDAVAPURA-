import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Save,
  Smartphone,
  Eye,
  EyeOff,
  Trash2,
  Bus,
  Radio,
  PlugZap,
} from "lucide-react";
import { CollegeShell, useAccount, SignInDialog } from "@/components/college-shell";
import { Button } from "@/components/ui/button";
import {
  unlockSecurity,
  saveBusRoute,
  changeAdminPassword,
  listBusRoutes,
  deleteBusRoute,
} from "@/lib/transport.functions";
import {
  getGpsProviders,
  listGpsMappings,
  removeGpsMapping,
  saveGpsMapping,
  testGpsMapping,
} from "@/lib/gps.functions";
import { gpsStatusLabel } from "@/lib/gps/status";
import type { GpsBusStatus, GpsConnectionState } from "@/lib/gps/types";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security | MIT Thandavapura" },
      {
        name: "description",
        content:
          "Authorized MIT Thandavapura transport administration, IMEI route mapping and secure password settings.",
      },
      { property: "og:title", content: "MIT Thandavapura Transport Security" },
      {
        property: "og:description",
        content: "Protected college bus administration and GPS device registration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Security,
});

type BusRow = {
  id: string;
  route_number: string;
  bus_number: string;
  imei: string;
  driver_name: string | null;
  driver_phone: string | null;
};
type MappingRow = {
  route_id: string;
  provider: string;
  provider_device_id: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error_code: GpsConnectionState | null;
};
type GpsFormState = { provider: string; providerDeviceId: string; status?: GpsBusStatus };

function Security() {
  const { data: user } = useAccount();
  const qc = useQueryClient();
  const unlock = useServerFn(unlockSecurity);
  const save = useServerFn(saveBusRoute);
  const change = useServerFn(changeAdminPassword);
  const list = useServerFn(listBusRoutes);
  const remove = useServerFn(deleteBusRoute);
  const getProviders = useServerFn(getGpsProviders);
  const listMappings = useServerFn(listGpsMappings);
  const saveProviderMapping = useServerFn(saveGpsMapping);
  const removeMapping = useServerFn(removeGpsMapping);
  const testMapping = useServerFn(testGpsMapping);
  const [session, setSession] = useState("");
  const [pw, setPw] = useState("");
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [imei, setImei] = useState("");
  const [route, setRoute] = useState("");
  const [bus, setBus] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [providerOptions, setProviderOptions] = useState<{ id: string; name: string }[]>([]);
  const [gpsForms, setGpsForms] = useState<Record<string, GpsFormState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  async function refreshBuses(sessionId: string) {
    try {
      const result = await list({ data: { sessionId } });
      setBuses(result.routes);
    } catch {
      setBuses([]);
    }
  }

  async function refreshProviderOptions() {
    try {
      const result = await getProviders();
      setProviderOptions(result.providers);
    } catch {
      setProviderOptions([]);
    }
  }

  async function refreshGpsMappings(sessionId: string) {
    try {
      const result = await listMappings({ data: { sessionId } });
      const next: Record<string, GpsFormState> = {};
      for (const mapping of result.mappings as MappingRow[]) {
        let state: GpsConnectionState =
          mapping.last_error_code ?? (mapping.last_success_at ? "connected" : "not_configured");
        if (state === "connected" && mapping.last_success_at) {
          const age = Date.now() - Date.parse(mapping.last_success_at);
          if (!Number.isFinite(age) || age >= 120_000) state = "stale";
        }
        next[mapping.route_id] = {
          provider: mapping.provider,
          providerDeviceId: mapping.provider_device_id,
          status: {
            routeId: mapping.route_id,
            state,
            providerName: mapping.provider,
            checkedAt: mapping.last_checked_at,
            lastUpdatedAt: mapping.last_success_at,
            message:
              state === "connected"
                ? "An authorized provider position was received recently."
                : state === "stale"
                  ? "The last successful provider result is stale; test the connection again."
                  : "Provider connection has not been verified.",
          },
        };
      }
      setGpsForms(next);
    } catch {
      setGpsForms({});
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await unlock({ data: { password: pw } });
      setSession(result.sessionId);
      setPw("");
      await Promise.all([
        refreshBuses(result.sessionId),
        refreshGpsMappings(result.sessionId),
        refreshProviderOptions(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to unlock Security.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMapping(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await save({
        data: {
          sessionId: session,
          imei,
          routeNumber: route,
          busNumber: bus,
          driverName,
          driverPhone,
        },
      });
      setSuccess(
        "Bus, IMEI and driver linked. GPS provider access and a provider device ID are configured separately.",
      );
      await qc.invalidateQueries({ queryKey: ["fleet"] });
      setImei("");
      setBus("");
      setRoute("");
      setDriverName("");
      setDriverPhone("");
      await refreshBuses(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBus(row: BusRow) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await remove({ data: { sessionId: session, routeId: row.id } });
      setSuccess(
        `Bus ${row.bus_number} (route ${row.route_number}) deleted. Its IMEI is free to link again.`,
      );
      await qc.invalidateQueries({ queryKey: ["fleet"] });
      await Promise.all([refreshBuses(session), refreshGpsMappings(session)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this bus.");
    } finally {
      setBusy(false);
    }
  }

  function updateGpsForm(routeId: string, patch: Partial<GpsFormState>) {
    setGpsForms((previous) => ({
      ...previous,
      [routeId]: { provider: "", providerDeviceId: "", ...previous[routeId], ...patch },
    }));
  }

  async function saveGpsDeviceMapping(routeId: string) {
    const form = gpsForms[routeId];
    if (!form?.provider || !form.providerDeviceId.trim()) {
      setError("Choose a provider and enter its server-assigned device ID.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await saveProviderMapping({
        data: {
          sessionId: session,
          routeId,
          provider: form.provider,
          providerDeviceId: form.providerDeviceId.trim(),
        },
      });
      updateGpsForm(routeId, {
        status: {
          routeId,
          state: "not_configured",
          providerName:
            providerOptions.find((provider) => provider.id === form.provider)?.name ??
            form.provider,
          checkedAt: null,
          lastUpdatedAt: null,
          message:
            "Mapping saved. Backend credentials and a successful provider test are still required.",
        },
      });
      setSuccess(
        "Provider device mapping saved. GPS remains disconnected until backend credentials are configured and the provider test succeeds.",
      );
      await Promise.all([
        refreshGpsMappings(session),
        qc.invalidateQueries({ queryKey: ["gps-status"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the GPS device mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGpsDeviceMapping(routeId: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await removeMapping({ data: { sessionId: session, routeId } });
      setGpsForms((previous) => {
        const next = { ...previous };
        delete next[routeId];
        return next;
      });
      setSuccess("GPS provider mapping removed. The bus IMEI registration is unchanged.");
      await qc.invalidateQueries({ queryKey: ["gps-status"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the GPS provider mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function testGpsDeviceMapping(routeId: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await testMapping({ data: { sessionId: session, routeId } });
      updateGpsForm(routeId, { status: result });
      setSuccess(result.message);
      await qc.invalidateQueries({ queryKey: ["gps-status"] });
      await qc.invalidateQueries({ queryKey: ["positions"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "GPS provider test failed.");
    } finally {
      setBusy(false);
    }
  }

  async function update(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPw !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await change({ data: { sessionId: session, currentPassword: current, newPassword: newPw } });
      setCurrent("");
      setNewPw("");
      setConfirm("");
      setSession("");
      setSuccess("Password updated. Unlock Security with your new password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollegeShell tab="security">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Transport administration</div>
          <h1>
            Security<span className="text-primary">.</span>
          </h1>
          <p>Protected access to your college’s transport settings.</p>
        </div>
        <span className="safe-badge">
          <ShieldCheck size={13} />
          Restricted access
        </span>
      </div>
      {!session ? (
        <div className="security-layout">
          <div className="security-intro">
            <span className="security-lock-icon">
              <ShieldCheck size={30} />
            </span>
            <h2>
              Safe journeys start
              <br />
              with secure systems.
            </h2>
            <p>
              College-approved administrators manage bus devices and routes. Your transport settings
              stay protected.
            </p>
            <div className="auth-foot justify-start mt-6">
              <LockKeyhole size={13} />
              Encrypted passwords · Protected access
            </div>
          </div>
          <section className="security-form">
            <h2>Unlock Security</h2>
            <p>Enter your administrator password to continue.</p>
            <form onSubmit={submit}>
              <label className="form-label" htmlFor="admin-password">
                Administrator password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={show ? "text" : "password"}
                  className="form-input pr-12"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="form-success">
                  {success}
                </p>
              )}
              <Button className="w-full h-11 mt-6" disabled={busy}>
                <LockKeyhole />
                {busy ? "Verifying…" : user ? "Unlock Security" : "Sign in to continue"}
                <ArrowRight />
              </Button>
            </form>
            <div className="auth-foot">
              <ShieldCheck size={12} />
              Password-protected access
            </div>
          </section>
        </div>
      ) : (
        <div className="security-unlocked">
          <div className="flex items-center justify-between mb-5">
            <span className="safe-badge">
              <ShieldCheck size={13} />
              Security unlocked
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSession("");
                setCurrent("");
                setNewPw("");
                setConfirm("");
              }}
            >
              Lock Security
              <LockKeyhole />
            </Button>
          </div>
          <section className="security-form">
            <h2 className="flex items-center gap-2">
              <Smartphone size={18} />
              Link a bus device
            </h2>
            <p>
              Assign a bus, route and driver to its onboard IMEI. This IMEI is an inventory
              identifier; it does not fetch GPS positions by itself.
            </p>
            <form onSubmit={saveMapping}>
              <label className="form-label" htmlFor="imei">
                IMEI number
              </label>
              <input
                id="imei"
                className="form-input"
                inputMode="numeric"
                pattern="[0-9]{15}"
                minLength={15}
                maxLength={15}
                placeholder="15-digit device IMEI"
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ""))}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="bus">
                    Bus number
                  </label>
                  <input
                    id="bus"
                    className="form-input"
                    placeholder="Bus number"
                    value={bus}
                    onChange={(e) => setBus(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="route">
                    Route number
                  </label>
                  <input
                    id="route"
                    className="form-input"
                    placeholder="Route number"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="driver-name">
                    Driver name
                  </label>
                  <input
                    id="driver-name"
                    className="form-input"
                    placeholder="Assigned driver"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="driver-phone">
                    Driver phone
                  </label>
                  <input
                    id="driver-phone"
                    className="form-input"
                    inputMode="tel"
                    placeholder="+91…"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value.replace(/[^\d+]/g, ""))}
                  />
                </div>
              </div>
              <Button className="mt-6 w-full h-11" disabled={busy}>
                <Save />
                Save bus mapping
              </Button>
            </form>
          </section>

          <section className="security-form mt-6">
            <h2 className="flex items-center gap-2">
              <Bus size={18} />
              Registered buses
            </h2>
            <p>
              Link each bus to a provider-side device ID. The provider credentials are configured
              separately on the backend and never entered here.
            </p>
            {buses.length === 0 ? (
              <p className="auth-foot justify-start">No buses registered yet.</p>
            ) : (
              <ul className="registered-bus-list">
                {buses.map((row) => {
                  const form = gpsForms[row.id] ?? { provider: "" as const, providerDeviceId: "" };
                  const status = form.status;
                  return (
                    <li key={row.id} className="registered-bus-item gps-admin-item">
                      <div className="min-w-0 gps-admin-bus">
                        <p className="font-semibold truncate">
                          Bus {row.bus_number} · Route {row.route_number}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          IMEI {row.imei}
                          {row.driver_name ? ` · ${row.driver_name}` : ""}
                          {row.driver_phone ? ` · ${row.driver_phone}` : ""}
                        </p>
                        <div className="gps-admin-controls">
                          <label className="form-label" htmlFor={`gps-provider-${row.id}`}>
                            GPS provider
                          </label>
                          <select
                            id={`gps-provider-${row.id}`}
                            className="field-select"
                            value={form.provider}
                            onChange={(e) => updateGpsForm(row.id, { provider: e.target.value })}
                          >
                            <option value="">Not configured</option>
                            {form.provider &&
                              !providerOptions.some((item) => item.id === form.provider) && (
                                <option value={form.provider}>
                                  {form.provider} (adapter unavailable)
                                </option>
                              )}
                            {providerOptions.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                          <label className="form-label" htmlFor={`gps-device-${row.id}`}>
                            Provider device ID (not IMEI)
                          </label>
                          <input
                            id={`gps-device-${row.id}`}
                            className="form-input"
                            inputMode="numeric"
                            pattern="[0-9]{1,18}"
                            maxLength={18}
                            placeholder="Provider server-assigned ID"
                            value={form.providerDeviceId}
                            onChange={(e) =>
                              updateGpsForm(row.id, {
                                providerDeviceId: e.target.value.replace(/\D/g, ""),
                              })
                            }
                          />
                          <p className="auth-foot justify-start gps-admin-note">
                            Use the provider-side ID from your authorized account. Do not enter the
                            bus IMEI here.
                          </p>
                          <div className="gps-admin-actions">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy || !form.provider || !form.providerDeviceId.trim()}
                              onClick={() => saveGpsDeviceMapping(row.id)}
                            >
                              <Save size={14} />
                              Save provider mapping
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy || !form.providerDeviceId.trim()}
                              onClick={() => testGpsDeviceMapping(row.id)}
                            >
                              <PlugZap size={14} />
                              Test connection
                            </Button>
                            {form.provider && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => removeGpsDeviceMapping(row.id)}
                              >
                                <Trash2 size={14} />
                                Remove provider
                              </Button>
                            )}
                          </div>
                          <p
                            role="status"
                            className={`gps-admin-status ${status?.state === "connected" ? "gps-admin-status-ok" : ""}`}
                          >
                            <Radio size={13} />
                            {gpsStatusLabel(status)}
                            {status
                              ? ` · ${status.message}`
                              : " · GPS not connected until backend access is configured and a real provider test succeeds."}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => deleteBus(row)}
                      >
                        <Trash2 />
                        Delete bus
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="auth-foot justify-start mt-4">
              Provider URLs/tokens belong in Supabase Edge Function secrets. Only adapters returned
              by the Edge registry can be configured; additional providers require separate adapters
              based on official API documentation.
            </p>
          </section>

          <section className="security-form mt-6">
            <h2 className="flex items-center gap-2">
              <KeyRound size={18} />
              Change administrator password
            </h2>
            <form onSubmit={update}>
              <label className="form-label" htmlFor="current">
                Current password
              </label>
              <input
                id="current"
                type="password"
                className="form-input"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
              <label className="form-label" htmlFor="new">
                New password
              </label>
              <input
                id="new"
                type="password"
                className="form-input"
                autoComplete="new-password"
                minLength={8}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
              <label className="form-label" htmlFor="confirm">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                className="form-input"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <Button variant="outline" className="w-full h-11 mt-6" disabled={busy}>
                <KeyRound />
                Update password
              </Button>
            </form>
          </section>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="form-success">
              {success}
            </p>
          )}
        </div>
      )}
      <SignInDialog open={authOpen} onOpenChange={setAuthOpen} />
    </CollegeShell>
  );
}
