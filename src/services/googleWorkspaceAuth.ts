import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Strictly in-memory OAuth token & profile cache (NEVER persisted in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUserEmail: string | null = null;
let grantedScopes: Set<string> = new Set();
let isSigningIn = false;
const authListeners = new Set<(state: WorkspaceAuthState) => void>();

export interface WorkspaceAuthState {
  user: User | null;
  hasReadAccess: boolean;
  hasComposeSendAccess: boolean;
  email: string | null;
}

export function getAuthSnapshot(): WorkspaceAuthState {
  const user = auth.currentUser;
  return {
    user,
    hasReadAccess: Boolean(cachedAccessToken && grantedScopes.has(GMAIL_READ_SCOPE)),
    hasComposeSendAccess: Boolean(cachedAccessToken && grantedScopes.has(GMAIL_COMPOSE_SCOPE)),
    email: user?.email || cachedUserEmail || null,
  };
}

function notifyAuthListeners() {
  const snap = getAuthSnapshot();
  for (const listener of authListeners) {
    try {
      listener(snap);
    } catch {}
  }
}

export function initWorkspaceAuth(
  onUpdate: (state: WorkspaceAuthState) => void
) {
  authListeners.add(onUpdate);
  onUpdate(getAuthSnapshot());

  const unsubFirebase = onAuthStateChanged(auth, (user) => {
    if (!user && !isSigningIn && !cachedUserEmail) {
      cachedAccessToken = null;
      grantedScopes.clear();
    }
    notifyAuthListeners();
  });

  return () => {
    authListeners.delete(onUpdate);
    unsubFirebase();
  };
}

export function isEmbeddedInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function formatGoogleAuthError(err: any): string {
  const code = String(err?.code || err?.type || "").toLowerCase();
  const msg = String(err?.message || err || "");

  if (code.includes("popup-blocked") || code.includes("popup_failed_to_open")) {
    return "Chrome blocked the Google Sign-In popup inside this iframe. Allow popups for this site, try 'Direct Google OAuth', or click 'Open App in New Tab' below.";
  }
  if (code.includes("popup-closed-by-user") || code.includes("popup_closed")) {
    return "Sign-in popup was closed before finishing. If AI Studio's preview iframe interrupted the popup, try 'Direct Google OAuth' or open NEXA in a New Tab.";
  }
  if (code.includes("cancelled-popup-request")) {
    return "A sign-in popup is already open or was interrupted. Close any extra popup and try once more.";
  }
  if (code.includes("unauthorized-domain")) {
    return `Domain "${typeof window !== "undefined" ? window.location.hostname : ""}" is not authorized for Firebase popup auth. Try 'Direct Google OAuth' instead.`;
  }
  if (code.includes("access_denied")) {
    return "Google access was denied or app verification warning blocked consent. If you see 'Google hasn't verified this app', click Advanced -> Go to app.";
  }
  return msg || "Google sign-in failed. Try 'Direct Google OAuth' or open NEXA in a New Tab.";
}

async function fetchGmailProfileEmail(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      return data?.emailAddress || null;
    }
  } catch {}
  return null;
}

async function ensureGisScriptLoaded(): Promise<any> {
  const w = window as any;
  if (w.google?.accounts?.oauth2?.initTokenClient) {
    return w.google.accounts.oauth2;
  }
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      let checks = 0;
      const timer = setInterval(() => {
        checks++;
        if (w.google?.accounts?.oauth2?.initTokenClient) {
          clearInterval(timer);
          resolve();
        } else if (checks > 40) {
          clearInterval(timer);
          reject(new Error("Google Identity Services script failed to initialize."));
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In script (accounts.google.com)."));
    document.head.appendChild(script);
  });
  return (window as any).google?.accounts?.oauth2;
}

/**
 * Direct Google Identity Services OAuth Token Flow using the provisioned oAuthClientId.
 * Works cleanly inside AI Studio preview iframes when Firebase auth handler storage is partitioned.
 */
export async function signInWithGmailDirectOAuth(
  includeComposeSend: boolean = false
): Promise<WorkspaceAuthState> {
  if (isSigningIn) {
    throw new Error("Sign-in is already in progress. Please complete the popup.");
  }
  const clientId = (firebaseConfig as any).oAuthClientId;
  if (!clientId) {
    throw new Error("OAuth Client ID is missing from firebase-applet-config.json.");
  }

  isSigningIn = true;
  try {
    const oauth2 = await ensureGisScriptLoaded();
    if (!oauth2?.initTokenClient) {
      throw new Error("Google OAuth client unavailable in this browser.");
    }

    const scopes = [GMAIL_READ_SCOPE];
    if (includeComposeSend) scopes.push(GMAIL_COMPOSE_SCOPE);

    const tokenResp: any = await new Promise((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(" "),
        callback: (resp: any) => {
          if (resp?.error) {
            reject(new Error(resp.error_description || resp.error));
          } else if (!resp?.access_token) {
            reject(new Error("Google OAuth completed without returning an access token."));
          } else {
            resolve(resp);
          }
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    });

    cachedAccessToken = tokenResp.access_token;
    grantedScopes.add(GMAIL_READ_SCOPE);
    if (includeComposeSend || String(tokenResp.scope || "").includes(GMAIL_COMPOSE_SCOPE)) {
      grantedScopes.add(GMAIL_COMPOSE_SCOPE);
    }
    cachedUserEmail = (await fetchGmailProfileEmail(cachedAccessToken!)) || cachedUserEmail;
    notifyAuthListeners();
    return getAuthSnapshot();
  } catch (err: any) {
    throw new Error(formatGoogleAuthError(err));
  } finally {
    isSigningIn = false;
  }
}

/**
 * Least-privilege step 1: Connect Gmail with Read-Only scope first,
 * or request both if user chooses full assistant mode.
 */
export async function signInWithGmail(includeComposeSend: boolean = false): Promise<WorkspaceAuthState> {
  if (isSigningIn) {
    throw new Error("Sign-in is already in progress. Please check the Google popup window.");
  }
  isSigningIn = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(GMAIL_READ_SCOPE);
    if (includeComposeSend) {
      provider.addScope(GMAIL_COMPOSE_SCOPE);
    }
    provider.setCustomParameters({
      prompt: includeComposeSend ? "consent" : "select_account",
      include_granted_scopes: "true",
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Google sign-in completed, but no Gmail access token was returned.");
    }

    cachedAccessToken = credential.accessToken;
    cachedUserEmail = result.user?.email || (await fetchGmailProfileEmail(cachedAccessToken)) || null;
    grantedScopes.add(GMAIL_READ_SCOPE);
    if (includeComposeSend) {
      grantedScopes.add(GMAIL_COMPOSE_SCOPE);
    }
    notifyAuthListeners();
    return getAuthSnapshot();
  } catch (err: any) {
    throw new Error(formatGoogleAuthError(err));
  } finally {
    isSigningIn = false;
  }
}

/**
 * Incremental authorization for drafting and sending emails (separated from read scope).
 */
export async function authorizeGmailComposeAndSend(): Promise<WorkspaceAuthState> {
  try {
    return await signInWithGmail(true);
  } catch {
    return await signInWithGmailDirectOAuth(true);
  }
}

export function getInMemoryGmailToken(): string | null {
  return cachedAccessToken;
}

export function clearExpiredGmailToken(): void {
  cachedAccessToken = null;
  grantedScopes.clear();
  notifyAuthListeners();
}

export async function signOutWorkspace(): Promise<void> {
  cachedAccessToken = null;
  cachedUserEmail = null;
  grantedScopes.clear();
  try {
    await auth.signOut();
  } catch {}
  notifyAuthListeners();
}
