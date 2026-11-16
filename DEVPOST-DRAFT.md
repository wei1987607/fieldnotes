# Devpost submission draft — FieldNotes (#BuildHybridAI 2026)

Submit under **weirongcheng9** (https://devpost.com/weirongcheng9).
Hackathon: https://firebasehybridaihackathon.devpost.com/
**Deadline: Dec 1, 2026 06:00 Beijing** (Nov 30, 17:00 ET).

## Title
FieldNotes

## Tagline
The offline-first field research notebook — on-device AI summaries with a cloud fallback.

## Links
- Live app: https://fieldnotes-hybrid.web.app
- GitHub: https://github.com/wei1987607/fieldnotes (public, Apache-2.0)
- Demo video: [YouTube link — TODO, Ines uploads the MP4 and sends the link]

## Built with
Firebase AI Logic (Hybrid Inference SDK), Gemini Nano, gemini-3.5-flash-lite,
Firestore, Firebase App Check, Firebase Remote Config, React, Vite, TypeScript

## Description (paste into Devpost)

### Inspiration
Field researchers, journalists and teachers often work where the internet is
unreliable — a mangrove boardwalk, a village classroom, a night market.
FieldNotes lets them capture structured field notes offline and get instant AI
summaries on-device, with the cloud as a fallback — never the other way round.

### What it does
- Structured field notes (title, tags, location, text) stored locally first,
  so the app works fully offline.
- Instant on-device summaries: each note is summarised by Gemini Nano
  on-device via Firebase AI Logic hybrid inference — private, free, no
  connection needed.
- Cloud fallback: if no on-device model is available, the same call falls
  back to gemini-3.5-flash-lite in the cloud.
- Proof of where inference ran: every summary shows a badge — On-device,
  Cloud, or Demo mock — plus latency and model name, so the hybrid behaviour
  is visible, not just claimed.
- Deep field reports: cross-note themes, action items and connections,
  analysed in the cloud (exactly 4 themes, 4 action items, 3 connections).
- Firestore sync when back online, anonymous Auth, Remote Config
  (summary length, cloud analysis on/off, hybrid mode), App Check,
  search, tag filters, Markdown/JSON export.

### How Firebase AI Logic is used
`summarizeNote()` uses `InferenceMode.PREFER_ON_DEVICE`: Gemini Nano in
Chrome when available, otherwise the cloud model, with a JSON response
schema (`summary`, `tags`, `keyPoints`). The returned `inferenceSource`
(`on_device` | `in_cloud`) is stored on the note and rendered as a badge.
`analyzeFieldReport()` uses a plain cloud model for cross-note reasoning —
on-device inference only supports single-turn text generation, so long,
multi-document reasoning belongs in the cloud.

### Challenges
- `gemini-2.5-flash` was retired mid-build; `gemini-3.8-flash` took ~180s per
  call. Settled on the proven `gemini-3.5-flash-lite`.
- Deep analysis kept returning empty action items and connections: the bug
  was in the code, not the prompt — `ObjectSchema`'s 3rd constructor argument
  is `optionalProperties`, not `required`, so no field was required at all.
  Removing it (plus exact-count schema constraints) fixed it.
- Summarise hung while Gemini Nano was still downloading: the warm-up call
  is now fire-and-forget, so the cloud fallback answers immediately.

### Accomplishments
Real inference verified end to end on the live site: cloud summaries in
~2.3s with badges and model names, deep analysis 4/4/3 in ~2.4s, Firestore
sync confirmed. The demo video shows the real app, not a mock.

### What's next
- Show the on-device badge live once Gemini Nano finishes downloading.
- Audio-note capture with on-device transcription.
- Shared field projects for research teams.

## Cover image
Use `demo-video/crop_top.png` (or the full `fieldnotes-snapshot.png`) as the
project thumbnail — real UI, Firebase connected.

## Checklist before submitting
- [ ] YouTube demo link added above (waiting on Ines)
- [ ] Cover image uploaded
- [ ] "Built with" tags filled in
- [ ] Submit as weirongcheng9
