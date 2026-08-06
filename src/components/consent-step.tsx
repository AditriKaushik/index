"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

export interface RegionRules {
  code: string;
  label: string;
  minimumAge: number;
  requiredConsents: Array<{ key: string; label: string }>;
  dataResidencyPreferred: boolean;
  notes: string;
}

export function ConsentStep({ onDone }: { onDone: () => void }) {
  const [rules, setRules] = useState<RegionRules | null>(null);
  const [region, setRegion] = useState<string>("DEFAULT");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ detectedRegion: string | null; rules: RegionRules }>("/api/compliance/region").then(
      (res) => {
        setRules(res.rules);
        setRegion(res.detectedRegion ?? res.rules.code);
      }
    );
  }, []);

  if (!rules) return <p className="text-sm text-muted">Loading your region&apos;s requirements…</p>;

  const allChecked = rules.requiredConsents.every((c) => checked[c.key]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/compliance/consent", {
        method: "POST",
        body: JSON.stringify({ region, consents: checked }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save consent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Before you start — {rules.label}</p>
        <p className="mt-1 text-xs text-muted">{rules.notes}</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {rules.requiredConsents.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(checked[c.key])}
              onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
            />
            I agree to the {c.label}
          </label>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!allChecked || busy}
        className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Agree and continue"}
      </button>
    </div>
  );
}
