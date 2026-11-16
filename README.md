# 📓 FieldNotes — the offline-first field research notebook

**Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)** with Firebase AI Logic (Hybrid Inference SDK).

Field researchers, journalists and teachers often work where the internet is unreliable — a mangrove boardwalk, a village classroom, a night market. FieldNotes lets them capture structured field notes offline and get instant AI summaries **on-device**, with the cloud as a fallback — never the other way round.

## What it does

| Feature | How it works |
|---|---|
| **Structured field notes** | Title, tags, location, and notes / audio-transcript text. Stored locally first (localStorage), so the app works fully offline. |
| **Instant on-device summaries** | Each note is summarised by **Gemini Nano on-device** via Firebase AI Logic hybrid inference — private, free, no connection needed. |
| **Cloud fallback** | If no on-device model is available, the same call falls back to `gemini-3.5-flash-lite` in the cloud. |
| **Proof of where inference ran** | Every summary shows a badge — 🟢 **On-device · Gemini Nano**, ☁️ **Cloud · Gemini**, or 🧪 **Demo mock** — plus latency and model name. |
| **Deep field reports** | Cross-note themes, action items and connections, analysed in the cloud by `gemini-3.5-flash-lite` (cross-note reasoning needs the cloud model). |
| **Firestore sync** | Notes sync to `users/{uid}/notes/{noteId}` when back online; unsynced notes are re-pushed automatically. |
| **Anonymous Auth** | One anonymous uid per device — no sign-up, no personal data. |
| **Remote Config** | Summary length (`short` / `standard` / `detailed`), cloud-analysis on/off, and hybrid mode are all remotely tunable without redeploying. |
| **App Check** | reCAPTCHA v3 in production, debug provider for local development. |
| **Search, tag filters, export** | Full-text search, tag chips, Markdown / JSON export. |

## How Firebase AI Logic is used

The core of the app is in [`src/lib/ai.ts`](src/lib/ai.ts).

**1. Hybrid inference for per-note summaries** — `summarizeNote()`:

```ts
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// PREFER_ON_DEVICE: Gemini Nano in Chrome when available,
// otherwise fall back to the cloud model.
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: summarySchema, // { summary, tags, keyPoints }
    },
  },
});

// Must be called on/after a user interaction (Chrome requirement).
await model.initializeDeviceModel((progress) => /* download % */);

const result = await model.generateContent(prompt);
const text = result.response.text();
const source = result.response.inferenceSource; // 'on_device' | 'in_cloud'
```

The returned `inferenceSource` is stored on the note and rendered as a badge, so the hybrid behaviour is visible — not just claimed.

**2. Cloud-only inference for deep analysis** — `analyzeFieldReport()` uses a plain cloud model (`gemini-3.5-flash-lite`) with a JSON response schema for themes, action items and cross-note connections. On-device inference only supports single-turn text generation, so long, multi-document reasoning belongs in the cloud.

**3. Other Firebase products** (see [`src/lib/firebase.ts`](src/lib/firebase.ts)):

- **Authentication** — anonymous sign-in on boot.
- **Firestore** — per-user note sync (`src/lib/store.ts`).
- **App Check** — reCAPTCHA v3 in production; debug token in development.
- **Remote Config** — `summary_length`, `cloud_analysis_enabled`, `hybrid_mode`, with local defaults.

## Demo mode (no Firebase project needed to try it)

If no Firebase config is present, the app runs in **demo mode**: notes stay on the device and summaries use a deterministic, extractive mock summarizer. Every mock result is labelled **🧪 Demo mock — no model call**, in the UI and in the data — mock output is never presented as model output. The real Firebase AI Logic code path is already implemented in `src/lib/ai.ts` and activates as soon as a config is added.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (tsc + vite)
npm run preview    # serve the production build
```

### With real Firebase (enables hybrid inference)

Follow the setup below, then:

```bash
cp .env.example .env.local   # fill in your values
npm run dev
```

### On-device inference requirements

- **Chrome on Desktop, version 139+** (on-device inference is Chrome-only).
- Enable the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart Chrome.
- The Gemini Nano model downloads on first use (a few GB of free disk space). Click **Prepare on-device model** in the app, or just tap **Summarise** — the first call triggers the download and shows progress. You can also pre-download it from DevTools with `await LanguageModel.create()`.
- Without Nano, summaries automatically fall back to the cloud model — the badge tells you which ran.

## Firebase setup (exact steps)

All steps are free — no purchase or payment is needed. Use the **Gemini Developer API** backend (free tier) and the Firebase **Spark (free) plan**.

1. **Create a Firebase project**
   - Go to the [Firebase console](https://console.firebase.google.com/) → **Add project** → name it (e.g. `fieldnotes-hybrid`) → continue. Google Analytics is **not** required.

2. **Register the web app**
   - Project settings (⚙️) → **Your apps** → **Web** (`</>`) → register the app (nickname `fieldnotes-web`).
   - Copy the `firebaseConfig` values into `.env.local` (see `.env.example`).

3. **Enable Firebase AI Logic**
   - Console → **AI Services → AI Logic** → **Get started**.
   - When asked for a Gemini API provider, choose **Gemini Developer API** (free, no billing).
   - The guided workflow enables the required APIs and **enforces App Check for AI Logic**.

4. **Enable Anonymous Authentication**
   - Console → **Build → Authentication → Sign-in method** → enable **Anonymous**.

5. **Create the Firestore database**
   - Console → **Build → Firestore Database** → **Create database** → **Start in production mode** (the repo's `firestore.rules` restrict notes to their owner; deploy them with `firebase deploy --only firestore:rules`).
   - Location: pick the region closest to your users.

6. **App Check**
   - **Local development (debug provider):** run the app, open DevTools → Console, copy the printed debug token (`AppCheck debug token: "..."`), then Console → **App Check → Apps → ⋮ → Manage debug tokens** → add it. Or set `VITE_APPCHECK_DEBUG_TOKEN` in `.env.local` to a token you already registered.
   - **Production:** register a reCAPTCHA v3 site key (Console → **App Check → Apps → reCAPTCHA v3**), then set `VITE_APPCHECK_RECAPTCHA_SITE_KEY` in your hosting environment.

7. **Remote Config**
   - Console → **Run → Remote Config** → add three parameters (or rely on the in-app defaults):
     - `summary_length` — string, default `standard` (`short` / `standard` / `detailed`)
     - `cloud_analysis_enabled` — boolean, default `true`
     - `hybrid_mode` — string, default `prefer_on_device`
   - **Publish** the changes. The app fetches them on boot and shows the live values in the status bar.

8. **Deploy to Firebase Hosting (optional)**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # select your project
   npm run build
   firebase deploy --only hosting
   ```
   `firebase.json` in this repo already points Hosting at `dist/` with SPA rewrites.

## Project structure

```
src/
  App.tsx                 — layout, state, toolbar, stats
  types.ts                — FieldNote, NoteSummary, ReportAnalysis, Remote Config
  lib/
    firebase.ts           — init: App, AI Logic, Auth, Firestore, App Check, Remote Config
    ai.ts                 — ★ hybrid summarise + cloud analysis + labelled demo mock
    store.ts              — offline-first store: localStorage + Firestore sync
    seed.ts               — three realistic sample field notes
  components/
    StatusBar.tsx         — online / Firebase / on-device / Remote Config status
    NoteCard.tsx          — note + AI summary with inference-source badge
    NoteEditor.tsx        — create / edit form
    ReportPanel.tsx       — cloud deep-analysis results
firebase.json             — Hosting config (dist/, SPA rewrites)
firestore.rules           — per-user notes, owner-only access
firestore.indexes.json    — (no composite indexes needed)
DEMO-SCRIPT.md            — ≤3-minute demo video script
```

## Value proposition

- **For field workers:** summaries and tags in seconds, with no signal and no cost — the notes are searchable and organised before they even get back to the office.
- **For privacy:** on-device summaries never leave the device; only long reports the researcher explicitly requests go to the cloud.
- **For the product:** hybrid inference means one code path and one UX on every device — the SDK decides where the work runs, and the app shows its work.

## Tech

Vite + React 19 + TypeScript, Firebase JS SDK 13 (`firebase/ai`, `firebase/firestore`, `firebase/auth`, `firebase/app-check`, `firebase/remote-config`), Firebase Hosting. No other runtime dependencies.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
