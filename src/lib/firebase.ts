/**
 * Firebase bootstrap for FieldNotes.
 *
 * Everything reads from Vite environment variables (`VITE_FIREBASE_*`).
 * When no config is present the app runs in **demo mode**: notes are stored
 * locally, AI calls use a clearly-labelled mock summarizer, and the UI says
 * so. No Firebase account is created by this code — see README.md for the
 * exact console setup steps.
 *
 * Services wired up when configured:
 *  - Firebase AI Logic (Gemini Developer API backend) — see `src/lib/ai.ts`
 *  - Firestore — note sync (see `src/lib/store.ts`)
 *  - Authentication — anonymous sign-in, one uid per device
 *  - App Check — reCAPTCHA v3 in production, debug provider in dev
 *  - Remote Config — summary length, cloud-analysis toggle, hybrid mode
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import {
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  getRemoteConfig,
  fetchAndActivate,
  getBoolean,
  getString,
  type RemoteConfig,
} from 'firebase/remote-config';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  DEFAULT_REMOTE_CONFIG,
  type RemoteConfigValues,
} from '../types';

export interface FirebaseStatus {
  /** True when a Firebase config was supplied via environment variables. */
  configured: boolean;
  /** Human-readable reason when not configured. */
  configNote: string;
  /** Anonymous uid once signed in (null in demo mode). */
  uid: string | null;
  /** True once App Check was initialised. */
  appCheckReady: boolean;
  /** True once Remote Config values were fetched (or defaults applied). */
  remoteConfigReady: boolean;
  /** Last error encountered while initialising (if any). */
  error: string | null;
}

export interface FirebaseServices {
  app: FirebaseApp;
  ai: AI;
  auth: Auth;
  db: Firestore;
  remoteConfig: RemoteConfig;
  appCheck: AppCheck | null;
}

const env = (key: string): string | undefined => {
  const v = import.meta.env[key] as string | undefined;
  return v && v.trim() !== '' ? v.trim() : undefined;
};

function readConfig() {
  return {
    apiKey: env('VITE_FIREBASE_API_KEY'),
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: env('VITE_FIREBASE_APP_ID'),
  };
}

/** True when the minimum config needed to initialise Firebase is present. */
export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.projectId && c.appId);
}

let services: FirebaseServices | null = null;
let status: FirebaseStatus = {
  configured: false,
  configNote:
    'No Firebase config found. Running in local demo mode — add VITE_FIREBASE_* variables (see .env.example) to enable real Gemini Nano hybrid inference and Firestore sync.',
  uid: null,
  appCheckReady: false,
  remoteConfigReady: false,
  error: null,
};
let remoteConfigValues: RemoteConfigValues = { ...DEFAULT_REMOTE_CONFIG };

export function getFirebaseStatus(): FirebaseStatus {
  return status;
}

export function getRemoteConfigValues(): RemoteConfigValues {
  return remoteConfigValues;
}

export function getServices(): FirebaseServices | null {
  return services;
}

/**
 * Initialise Firebase (idempotent). Safe to call in demo mode — it simply
 * records that no config is present and returns null.
 */
export async function initFirebase(): Promise<FirebaseServices | null> {
  if (services) return services;
  if (!isFirebaseConfigured()) return null;

  try {
    const config = readConfig();
    const app = initializeApp(config);
    status.configured = true;
    status.configNote = `Connected to Firebase project "${config.projectId}".`;

    // --- App Check -------------------------------------------------------
    // Production: reCAPTCHA v3 (site key from env).
    // Development: debug provider — the debug token printed in the console
    // must be registered in Console > App Check > Manage debug tokens.
    // See README.md "Firebase setup" for the exact steps.
    let appCheck: AppCheck | null = null;
    try {
      const recaptchaSiteKey = env('VITE_APPCHECK_RECAPTCHA_SITE_KEY');
      if (recaptchaSiteKey) {
        // Production path: real reCAPTCHA v3 attestation.
        appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (import.meta.env.DEV) {
        // Development path: debug provider.
        // Setting FIREBASE_APPCHECK_DEBUG_TOKEN *before* initializeAppCheck
        // makes the SDK exchange debug tokens instead of calling the
        // configured provider (verified in @firebase/app-check source:
        // getToken() short-circuits to the debug exchange when debug mode
        // is on), so the placeholder provider below is never invoked.
        // The generated debug token is printed in the browser console and
        // must be registered in Console > App Check > Manage debug tokens.
        const debugToken = env('VITE_APPCHECK_DEBUG_TOKEN');
        (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
          debugToken && debugToken !== 'true' ? debugToken : true;
        appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider('debug-placeholder-unused-in-debug-mode'),
          isTokenAutoRefreshEnabled: true,
        });
      }
      status.appCheckReady = appCheck !== null;
    } catch (e) {
      console.warn('[FieldNotes] App Check init failed (continuing without it):', e);
    }

    // --- AI Logic --------------------------------------------------------
    // Gemini Developer API backend (free tier, no billing required).
    // Hybrid inference (on-device Gemini Nano with cloud fallback) is
    // configured per-model in src/lib/ai.ts.
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const auth = getAuth(app);
    const db = getFirestore(app);

    // --- Remote Config ---------------------------------------------------
    const remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV
      ? 0
      : 3_600_000;
    remoteConfig.defaultConfig = {
      summary_length: DEFAULT_REMOTE_CONFIG.summaryLength,
      cloud_analysis_enabled: String(DEFAULT_REMOTE_CONFIG.cloudAnalysisEnabled),
      hybrid_mode: DEFAULT_REMOTE_CONFIG.hybridMode,
    };
    try {
      await fetchAndActivate(remoteConfig);
      remoteConfigValues = {
        summaryLength: getString(remoteConfig, 'summary_length') || 'standard',
        cloudAnalysisEnabled: getBoolean(remoteConfig, 'cloud_analysis_enabled'),
        hybridMode: getString(remoteConfig, 'hybrid_mode') || 'prefer_on_device',
      };
      status.remoteConfigReady = true;
    } catch (e) {
      console.warn('[FieldNotes] Remote Config fetch failed, using defaults:', e);
      remoteConfigValues = { ...DEFAULT_REMOTE_CONFIG };
      status.remoteConfigReady = true; // defaults are in effect
    }

    // --- Anonymous Auth --------------------------------------------------
    try {
      const cred = await signInAnonymously(auth);
      status.uid = cred.user.uid;
    } catch (e) {
      status.error = `Anonymous sign-in failed: ${(e as Error).message}`;
      console.warn('[FieldNotes] Anonymous sign-in failed:', e);
    }

    services = { app, ai, auth, db, remoteConfig, appCheck };
    return services;
  } catch (e) {
    status.error = `Firebase init failed: ${(e as Error).message}`;
    console.error('[FieldNotes] Firebase init failed:', e);
    return null;
  }
}

/** Current signed-in user, if any. */
export function currentUser(): User | null {
  return services?.auth.currentUser ?? null;
}
