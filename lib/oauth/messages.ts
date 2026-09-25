/**
 * lib/oauth/messages.ts — client-safe (no Node imports) texts for ?error= codes on /login and /settings.
 */
/** Friendly, user-facing messages for ?error= codes on /login. */
export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled. Try again when you're ready.",
  oauth_disabled: "Social sign-in is temporarily disabled. Please use email and password.",
  provider_unavailable: "This sign-in method is not set up yet. Please use email and password.",
  missing_code_or_state: "The sign-in reply was incomplete. Please try again.",
  invalid_state: "Your sign-in session expired. Please try again.",
  provider_mismatch: "Sign-in provider mismatch. Please try again.",
  oauth_failed_google: "Google sign-in failed. Please try again or use email and password.",
  oauth_failed_github: "GitHub sign-in failed. Please try again or use email and password.",
  oauth_no_email: "We couldn't read your email address. Please grant email access and retry.",
  oauth_no_verified_email:
    "We need a verified email address to sign you in. Verify your email with the provider first, then retry.",
  email_taken_unverified:
    "This email is already registered. Sign in with your password first, then link the provider in Settings.",
  identity_taken: "This provider account is already linked to a different SeedInfer account.",
  already_linked: "This provider is already linked to your account.",
  provider_already_linked: "Your account already has a different account of this provider linked. Unlink it first.",
  link_needs_login: "Sign in first, then link the provider from Settings.",
  db_upsert_failed: "We couldn't save your account. Please try again.",
  session_failed: "We couldn't start your session. Please try again.",
};

export function oauthErrorMessage(code: string | null): string {
  if (!code) return "";
  return OAUTH_ERROR_MESSAGES[code] || `Sign-in error: ${code}`;
}
