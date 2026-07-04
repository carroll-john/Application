// Moved to api/_shared/sentry.ts so any API route can use it (the api_route
// tag is now derived from the request URL instead of being hard-coded to
// /api/parse-cv). This shim keeps existing import paths working.
export * from "../_shared/sentry.js";
