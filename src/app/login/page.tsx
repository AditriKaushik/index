"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiFetch, ApiError } from "@/lib/api-client";
import { detectPlatform, getOrCreateDeviceKey } from "@/lib/device";
import { useAuth } from "@/components/auth-provider";
import { ConsentStep, type RegionRules } from "@/components/consent-step";

type Mode = "choose" | "contact" | "otp" | "pin" | "consent";
type Intent = "SIGNUP" | "LOGIN";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [mode, setMode] = useState<Mode>("choose");
  const [intent, setIntent] = useState<Intent>("LOGIN");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    getOrCreateDeviceKey();
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      setPasskeyAvailable(true);
    }
  }, []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ target: string }>("/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ identifier, purpose: intent }),
      });
      setMaskedTarget(res.target);
      setMode("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          identifier,
          purpose: intent,
          code,
          displayName: intent === "SIGNUP" ? displayName : undefined,
          deviceKey: getOrCreateDeviceKey(),
          platform: detectPlatform(),
          userAgent: navigator.userAgent,
        }),
      });
      await refresh();
      if (intent === "SIGNUP") {
        setMode("consent");
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/pin/login", {
        method: "POST",
        body: JSON.stringify({ deviceKey: getOrCreateDeviceKey(), pin }),
      });
      await refresh();
      router.push("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Incorrect PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    setError(null);
    setBusy(true);
    try {
      const deviceKey = getOrCreateDeviceKey();
      const options = await apiFetch<Parameters<typeof startAuthentication>[0]["optionsJSON"]>(
        "/api/auth/passkey/login/options",
        { method: "POST", body: JSON.stringify({ deviceKey }) }
      );
      const response = await startAuthentication({ optionsJSON: options });
      await apiFetch("/api/auth/passkey/login/verify", {
        method: "POST",
        body: JSON.stringify({ deviceKey, response }),
      });
      await refresh();
      router.push("/chat");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No passkey found for this device yet. Try another sign-in method."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Nearby</h1>
          <p className="text-muted mt-1 text-sm">Talk freely — text, voice, and video.</p>
        </div>

        <div className="rounded-2xl border bg-surface p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {mode === "choose" && (
            <div className="flex flex-col gap-3">
              {passkeyAvailable && (
                <button
                  onClick={loginWithPasskey}
                  disabled={busy}
                  className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-50"
                >
                  Continue with passkey / biometrics
                </button>
              )}
              <button
                onClick={() => setMode("pin")}
                className="rounded-xl border px-4 py-3 font-medium"
              >
                Enter device PIN
              </button>
              <div className="my-1 flex items-center gap-2 text-xs text-muted">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <button
                onClick={() => {
                  setIntent("LOGIN");
                  setMode("contact");
                }}
                className="rounded-xl border px-4 py-3 font-medium"
              >
                Log in with phone or email
              </button>
              <button
                onClick={() => {
                  setIntent("SIGNUP");
                  setMode("contact");
                }}
                className="text-sm text-accent underline underline-offset-2"
              >
                New here? Create an account
              </button>
            </div>
          )}

          {mode === "contact" && (
            <form onSubmit={requestCode} className="flex flex-col gap-4">
              <p className="text-sm font-medium">
                {intent === "SIGNUP" ? "Create your account" : "Log in"}
              </p>
              {intent === "SIGNUP" && (
                <label className="flex flex-col gap-1 text-sm">
                  Display name
                  <input
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-lg border bg-background px-3 py-2"
                    placeholder="How should we show your name?"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                Phone number or email
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2"
                  placeholder="+1 415 555 0100 or you@example.com"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send code"}
              </button>
              <button type="button" onClick={() => setMode("choose")} className="text-sm text-muted">
                Back
              </button>
            </form>
          )}

          {mode === "otp" && (
            <form onSubmit={verifyCode} className="flex flex-col gap-4">
              <p className="text-sm">
                Enter the 6-digit code sent to <span className="font-medium">{maskedTarget}</span>
              </p>
              <input
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-lg border bg-background px-3 py-2 text-center text-lg tracking-[0.5em]"
                placeholder="••••••"
              />
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <button type="button" onClick={() => setMode("contact")} className="text-sm text-muted">
                Use a different contact
              </button>
            </form>
          )}

          {mode === "pin" && (
            <form onSubmit={loginWithPin} className="flex flex-col gap-4">
              <p className="text-sm">Enter your device PIN</p>
              <input
                required
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-lg border bg-background px-3 py-2 text-center text-lg tracking-[0.5em]"
                placeholder="••••"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-50"
              >
                {busy ? "Checking…" : "Unlock"}
              </button>
              <button type="button" onClick={() => setMode("choose")} className="text-sm text-muted">
                Back
              </button>
            </form>
          )}

          {mode === "consent" && (
            <ConsentStep
              onDone={() => router.push("/chat")}
            />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Your data stays tied to the account and device you log in from, and only
          leaves it in ways the law where you live allows.
        </p>
      </div>
    </main>
  );
}

export type { RegionRules };
