"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";

interface DeviceInfo {
  id: string;
  label: string | null;
  platform: string | null;
  lastRegion: string | null;
  lastSeenAt: string;
  trusted: boolean;
  hasPin: boolean;
  hasPasskey: boolean;
  isCurrent: boolean;
}

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [exportData, setExportData] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadDevices() {
    const res = await apiFetch<{ devices: DeviceInfo[] }>("/api/devices");
    setDevices(res.devices);
  }

  useEffect(() => {
    if (user) loadDevices();
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  async function setupPin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await apiFetch("/api/auth/pin/setup", { method: "POST", body: JSON.stringify({ pin }) });
      setMessage("PIN saved for this device.");
      setPin("");
      loadDevices();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save PIN.");
    }
  }

  async function setupPasskey() {
    setMessage(null);
    try {
      const options = await apiFetch<Parameters<typeof startRegistration>[0]["optionsJSON"]>(
        "/api/auth/passkey/register/options",
        { method: "POST" }
      );
      const response = await startRegistration({ optionsJSON: options });
      await apiFetch("/api/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify(response),
      });
      setMessage("Passkey registered for this device.");
      loadDevices();
    } catch (err) {
      setMessage(
        err instanceof ApiError ? err.message : "This device or browser doesn't support passkeys."
      );
    }
  }

  async function revokeDevice(id: string) {
    await apiFetch(`/api/devices/${id}/revoke`, { method: "POST" });
    loadDevices();
  }

  async function exportMyData() {
    const res = await apiFetch<{ export: unknown }>("/api/compliance/data-requests", {
      method: "POST",
      body: JSON.stringify({ type: "EXPORT" }),
    });
    setExportData(JSON.stringify(res.export, null, 2));
  }

  async function deleteMyAccount() {
    await apiFetch("/api/compliance/data-requests", {
      method: "POST",
      body: JSON.stringify({ type: "DELETE" }),
    });
    // Full reload (not router.push) is intentional: it clears all in-memory
    // auth/chat state for the now-deleted account.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-xl font-semibold">Settings</h1>

        {message && <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2 text-sm">{message}</p>}

        <section className="mb-8 rounded-2xl border bg-surface p-4">
          <h2 className="mb-1 font-medium">Quick access for this device</h2>
          <p className="mb-4 text-sm text-muted">
            Set a PIN or register a passkey so you can jump back in without a full sign-in on this
            device. These credentials never leave this device&apos;s account.
          </p>

          <form onSubmit={setupPin} className="mb-3 flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4-8 digit PIN"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pin.length < 4}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              Save PIN
            </button>
          </form>

          <button onClick={setupPasskey} className="rounded-lg border px-3 py-2 text-sm font-medium">
            Register biometrics / passkey
          </button>
        </section>

        <section className="mb-8 rounded-2xl border bg-surface p-4">
          <h2 className="mb-1 font-medium">Devices signed in</h2>
          <p className="mb-4 text-sm text-muted">
            Your chats and account only stay accessible from devices you&apos;ve approved. Revoke any you
            don&apos;t recognize.
          </p>
          <ul className="flex flex-col gap-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {d.label ?? d.platform ?? "Unknown device"}
                    {d.isCurrent && <span className="ml-2 text-xs text-accent">(this device)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {d.lastRegion ? `Region: ${d.lastRegion} · ` : ""}
                    Last active {new Date(d.lastSeenAt).toLocaleString()}
                    {d.hasPin && " · PIN set"}
                    {d.hasPasskey && " · Passkey set"}
                  </p>
                </div>
                {!d.isCurrent && (
                  <button onClick={() => revokeDevice(d.id)} className="text-sm text-danger">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 rounded-2xl border bg-surface p-4">
          <h2 className="mb-1 font-medium">Your data</h2>
          <p className="mb-4 text-sm text-muted">
            Export everything tied to your account, or permanently erase it. This follows the consent
            and erasure rules for {user.region ?? "your region"}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportMyData} className="rounded-lg border px-3 py-2 text-sm font-medium">
              Export my data
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger"
              >
                Delete my account
              </button>
            ) : (
              <button
                onClick={deleteMyAccount}
                className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white"
              >
                Confirm permanent deletion
              </button>
            )}
          </div>
          {exportData && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs">
              {exportData}
            </pre>
          )}
        </section>
      </div>
    </AppShell>
  );
}
