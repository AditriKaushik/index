/**
 * Region-aware compliance ruleset.
 *
 * This is engineering scaffolding, not a legal guarantee. It gives every
 * region a sane, privacy-protective default (based on the strictest common
 * global norms — GDPR-style consent, a 16+ minimum, and honoring export/
 * delete requests) and lets specific jurisdictions override fields where
 * their public law is well known and stable. Before launch in any country,
 * have local counsel review and adjust the entry for that region — this
 * file intentionally does not claim to cover all ~195 countries' law.
 */

export interface RegionRules {
  /** ISO 3166-1 alpha-2 region code, or "DEFAULT" for the fallback. */
  code: string;
  label: string;
  minimumAge: number;
  /** Consent line items that must be explicitly granted at signup. */
  requiredConsents: Array<{
    key: string;
    label: string;
  }>;
  /** Whether local law expects data for this region to stay in-region. */
  dataResidencyPreferred: boolean;
  notes: string;
}

const DEFAULT_RULES: RegionRules = {
  code: "DEFAULT",
  label: "Rest of world (conservative default)",
  minimumAge: 16,
  requiredConsents: [
    { key: "terms_of_service", label: "Terms of Service" },
    { key: "privacy_policy", label: "Privacy Policy" },
  ],
  dataResidencyPreferred: false,
  notes:
    "No jurisdiction-specific override on file. Applying the conservative " +
    "global default until this region's rules are reviewed by counsel.",
};

const REGION_RULES: Record<string, RegionRules> = {
  // European Economic Area representative entry (GDPR). In production, map
  // every EEA country code to this entry rather than only "EU".
  EU: {
    code: "EU",
    label: "European Economic Area (GDPR)",
    minimumAge: 16,
    requiredConsents: [
      { key: "terms_of_service", label: "Terms of Service" },
      { key: "privacy_policy", label: "Privacy Policy (GDPR Art. 13)" },
      { key: "processing_basis", label: "Lawful basis for processing acknowledgement" },
    ],
    dataResidencyPreferred: true,
    notes:
      "GDPR: explicit consent, right to access/export/erase (implemented via " +
      "DataRequest), and a documented lawful basis are required. Member " +
      "states may set the age of consent for information-society services " +
      "between 13 and 16 — verify per country.",
  },
  US_CA: {
    code: "US_CA",
    label: "California, USA (CCPA/CPRA)",
    minimumAge: 13,
    requiredConsents: [
      { key: "terms_of_service", label: "Terms of Service" },
      { key: "privacy_policy", label: "Privacy Policy incl. CCPA notice" },
    ],
    dataResidencyPreferred: false,
    notes:
      "CCPA/CPRA: right to know, delete, and opt out of sale/sharing of " +
      "personal information. 'Do not sell or share my data' control required.",
  },
  IN: {
    code: "IN",
    label: "India (DPDP Act 2023)",
    minimumAge: 18,
    requiredConsents: [
      { key: "terms_of_service", label: "Terms of Service" },
      { key: "privacy_policy", label: "Privacy Policy" },
      { key: "dpdp_consent", label: "Notice & consent under the DPDP Act" },
    ],
    dataResidencyPreferred: false,
    notes:
      "DPDP Act 2023: verifiable parental consent required under 18 unless " +
      "notified otherwise; consent must be itemized and withdrawable.",
  },
  BR: {
    code: "BR",
    label: "Brazil (LGPD)",
    minimumAge: 18,
    requiredConsents: [
      { key: "terms_of_service", label: "Terms of Service" },
      { key: "privacy_policy", label: "Privacy Policy (LGPD)" },
    ],
    dataResidencyPreferred: false,
    notes: "LGPD: consent must be specific, informed, and freely given.",
  },
};

export function getRegionRules(regionCode: string | null | undefined): RegionRules {
  if (!regionCode) return DEFAULT_RULES;
  return REGION_RULES[regionCode.toUpperCase()] ?? DEFAULT_RULES;
}

export function listKnownRegions(): RegionRules[] {
  return [...Object.values(REGION_RULES), DEFAULT_RULES];
}
