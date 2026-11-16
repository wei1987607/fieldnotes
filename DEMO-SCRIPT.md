# FieldNotes — demo video script (≤ 3 minutes)

**Target length:** ~2:45. Record in Chrome 139+ with the Gemini Nano model downloaded (see README "On-device inference requirements") and a real Firebase project configured, so the on-device badge appears live. If Nano is not available, the cloud-fallback badge appears instead — say so on camera; the hybrid behaviour is the point either way. English narration; add English subtitles if any on-screen text is not in English (all UI text is English).

**Prep before recording:**
1. `cp .env.example .env.local` with a real Firebase config; App Check debug token registered.
2. Chrome flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled; restart Chrome.
3. Pre-download Nano: DevTools console → `await LanguageModel.create()` → wait until `await LanguageModel.availability()` returns `"available"`.
4. Clear site data for localhost, then load the app fresh. Click **Load sample notes** so the three sample notes are present.
5. Open DevTools → Network → set **Offline** for the offline shot (Shot 3), then back online.

---

## Shot list

### Shot 1 — The problem (0:00–0:20, ~20s)
**Visual:** Full-screen app, empty state. Cut to a still photo of a field site (mangrove boardwalk) — any royalty-free image.
**Narration:**
> "Field researchers work where the internet doesn't — mangrove boardwalks, village classrooms, night markets. They take pages of notes, and the organising happens hours later, back at the office — if it happens at all."

### Shot 2 — Capture a note offline (0:20–0:50, ~30s)
**Visual:** Click **+ New note**. Type title "Mangrove survey — transect 3", location "Beihai mangrove boardwalk", paste/type 2–3 sentences of observations. Click **Save note**. Point at the status bar pill: "Offline — notes saved locally".
**Narration:**
> "FieldNotes is an offline-first notebook. Notes are structured — title, tags, location, transcript text — and saved on the device immediately, even with no connection."

### Shot 3 — On-device summary (0:50–1:30, ~40s)
**Visual:** With Network still **Offline**, click **✦ Summarise** on the mangrove note. Wait for the summary to appear. Zoom in on the badge: **🟢 On-device · Gemini Nano** and the latency (e.g. "812 ms"). Point at the auto-tags and key points.
**Narration:**
> "Now the key moment. With no connection at all, I tap Summarise — and Gemini Nano, running on-device in Chrome through Firebase AI Logic, summarises the note and tags it. Private, free, and instant. The badge proves it ran on-device, and you can see the latency."

### Shot 4 — Cloud fallback (1:30–2:00, ~30s)
**Visual:** Back online. Open a second note (classroom observation), click **Summarise**. If Nano is available this will also be on-device — so instead, narrate over the status bar: click **Re-check AI engine**, then explain while showing the code in the editor (`src/lib/ai.ts`, the `PREFER_ON_DEVICE` block) for 5 seconds.
**Narration:**
> "The same code path falls back to the cloud — Gemini 2.5 Flash Lite — on any device without Nano. One model call, `PREFER_ON_DEVICE` mode; the SDK decides where it runs, and every summary shows you which one it was."

### Shot 5 — Deep analysis in the cloud (2:00–2:30, ~30s)
**Visual:** Scroll to **Field report — deep analysis**, click **Run deep analysis (cloud)**. Show themes, action items and connections appearing, with the **☁️ Cloud · Gemini** badge.
**Narration:**
> "For the bigger job — themes across all my notes, action items, connections between interviews — that goes to the cloud model. Long documents need the bigger brain, and Remote Config can switch this off without redeploying."

### Shot 6 — Sync + close (2:30–2:45, ~15s)
**Visual:** Status bar: "Firebase connected · anon …" and a note card showing "✓ synced". End on the app title screen.
**Narration:**
> "When I'm back online, notes sync to Firestore automatically. FieldNotes: your field notes, summarised where you are — on-device first, cloud when it counts."

---

## Recording notes

- Keep the mouse slow and deliberate; hover each badge for a beat so viewers can read it.
- If the on-device model is still downloading during Shot 3, keep the progress visible — the download progress callback is part of the story ("first use downloads Nano once").
- Do **not** show the demo-mode mock badge in the video: the video must show real inference. If no Firebase project is configured yet, record after setup (README "Firebase setup").
- Export at 1080p, upload to YouTube as **Public** (or Unlisted with a public link), and add the link to the Devpost submission.
