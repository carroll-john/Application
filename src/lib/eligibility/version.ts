/**
 * Single source of truth for the eligibility rules-engine version.
 *
 * Stamped onto every assessment the matcher produces (as `rulesVersion`, appended to any
 * upstream version for provenance, e.g. `service-v2+rules-v1`). Bump this when the matcher's
 * evaluation semantics change so stored results can be tied back to the rules that produced them.
 */
export const RULES_VERSION = "rules-v1";
