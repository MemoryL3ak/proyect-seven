const MOBILE_KEY = "seven.mobile";
const FROM_APP_KEY = "seven.fromApp";

export function markFromApp() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FROM_APP_KEY, "1");
}

export function isFromApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FROM_APP_KEY) === "1";
}

export function clearFromApp() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FROM_APP_KEY);
}

/**
 * Logout helper that clears every auth artifact and redirects.
 * If the session originated from the mobile app, sends back to /m/login.
 * Otherwise sends to the regular /login.
 *
 * Paints an opaque overlay before navigating so the user never sees a flash
 * of the previous portal during the transition.
 */
export function mobileAwareLogout() {
  if (typeof window === "undefined") return;
  const fromApp = isFromApp();

  // Mask the page synchronously to hide any flicker during navigation.
  try {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-seven-logout-mask", "");
    overlay.style.cssText =
      "position:fixed;inset:0;background:#020c18;z-index:2147483647;display:flex;align-items:center;justify-content:center;";
    const spinner = document.createElement("div");
    spinner.style.cssText =
      "width:36px;height:36px;border-radius:50%;border:3px solid rgba(52,243,198,0.25);border-top-color:#34F3C6;animation:seven-logout-spin 0.8s linear infinite;";
    const style = document.createElement("style");
    style.textContent = "@keyframes seven-logout-spin{to{transform:rotate(360deg)}}";
    overlay.appendChild(style);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
  } catch {
    // ignore — best-effort visual mask
  }

  // Clear web auth (admin)
  window.localStorage.removeItem("seven.auth");
  window.localStorage.removeItem("seven.user");
  document.cookie = "seven.auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  // Clear mobile session and from-app flag
  window.localStorage.removeItem(MOBILE_KEY);
  window.localStorage.removeItem(FROM_APP_KEY);
  // Redirect
  window.location.replace(fromApp ? "/m/login" : "/login");
}

export type MobileProfile = {
  id: string;
  fullName: string;
  email: string | null;
};

export type MobileSession =
  | { kind: "athlete"; athleteId: string; profile: MobileProfile }
  | { kind: "driver"; driverId: string; profile: MobileProfile };

export function getMobileSession(): MobileSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOBILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileSession;
  } catch {
    return null;
  }
}

export function setMobileSession(session: MobileSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(MOBILE_KEY);
    return;
  }
  window.localStorage.setItem(MOBILE_KEY, JSON.stringify(session));
}

export function isInReactNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } })
      .ReactNativeWebView,
  );
}

export function postToReactNative(payload: unknown) {
  if (typeof window === "undefined") return;
  const bridge = (window as unknown as {
    ReactNativeWebView?: { postMessage: (s: string) => void };
  }).ReactNativeWebView;
  if (!bridge) return;
  try {
    bridge.postMessage(JSON.stringify(payload));
  } catch {
    // swallow — RN side decides what to do
  }
}
