# @johncarroll/eligibility-rules

Shared eligibility rules engine for the Applications app proxy.

Contains requirement models, matcher/evaluators, v2 pathway IR, check copy,
assessment resolution, transcript request context schema, and submit-policy
constants (English-medium countries, AHPRA regex).

The eligibility-service **runtime** stays extraction-only (v1 contract). This
package is consumed by the Applications repo via a `file:` dependency.
