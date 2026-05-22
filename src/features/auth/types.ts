export type AuthTab = "sign-in" | "sign-up";

export type AuthScreen =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "confirm-email-sent"
  | "reset-email-sent"
  | "new-password";

export type AuthPanelContext = "apply" | "eligibility" | "header" | "route";
