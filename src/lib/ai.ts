/**
 * AI layer — Firebase AI Logic (Hybrid Inference SDK).
 *
 * TWO REAL CODE PATHS (both genuinely implemented and called at runtime
 * when Firebase is configured):
 *
 * 1. `summarizeNote()` — HYBRID inference. One `GenerativeModel` created
 *    with `mode: InferenceMode.PREFER_ON_DEVICE`:
 *      - Chrome with Gemini Nano available  → summary runs ON-DEVICE
 *        (private, free, works offline) via the Chrome Prompt API.
 *      - Otherwise → the SDK falls back to the cloud model
 *        (`gemini-3.5-flash-lite`, the SDK v13 default).
 *    The response's `inferenceSource` (`'on_device' | 'in_cloud'`) is
 *    returned and displayed on every note, so the hybrid behaviour is
 *    visible to judges.
 *
 * 2. `analyzeFieldReport()` — CLOUD-ONLY inference. Long documents and
 *    cross-note analysis go to `gemini-2.5-flash` in the cloud, where the
 *    bigger model can do themes, action items and cross-note connections.
 *
 * DEMO MODE (no Firebase config): both functions use a deterministic,
 * extractive mock summarizer. Every mock result is labelled
 * `inferenceSource: 'demo_mock'` and the UI shows a "Demo mock" badge —
 * mock output is never presented as model output.
 *
 * Structured output: the cloud path requests JSON via `responseSchema`.
 * The on-device path cannot carry a `generationConfig` in `HybridParams`
 * (only `onDeviceParams`/`inCloudParams` exist), so the prompt itself
 * instructs the model to reply with ONLY the JSON shape, and the parser
 * extracts the first `{...}` block robustly. This keeps one code path
 * working for both on-device and cloud responses.
 */
import {
  getGenerativeModel,
  InferenceMode,
  ObjectSchema,
  StringSchema,
  ArraySchema,
  type GenerativeModel,
} from 'firebase/ai';
import { getServices, getRemoteConfigValues } from './firebase';
import type {
  FieldNote,
  NoteSummary,
  ReportAnalysis,
  InferenceSource,
} from '../types';

/** Cloud model used as the hybrid fallback (Firebase JS SDK v13 default). */
export const HYBRID_CLOUD_MODEL = 'gemini-3.5-flash-lite';
/** Cloud model used for deep, cross-note analysis. */
export const CLOUD_ANALYSIS_MODEL = 'gemini-2.5-flash';

const summarySchema = new ObjectSchema(
  { description: 'Structured summary of a single field note.' },
  {
    summary: new StringSchema({
      description: 'One to three sentence summary of the note.',
    }),
    tags: new ArraySchema(
      { description: 'Three to six short lowercase topic tags.' },
      new StringSchema(),
    ),
    keyPoints: new ArraySchema(
      { description: 'Two to five key points from the note.' },
      new StringSchema(),
    ),
  },
  ['summary', 'tags', 'keyPoints'],
);

const reportSchema = new ObjectSchema(
  { description: 'Deep analysis across several field notes.' },
  {
    themes: new ArraySchema(
      { description: 'Three to five recurring themes across the notes.' },
      new StringSchema(),
    ),
    actionItems: new ArraySchema(
      { description: 'Three to six concrete next steps for the researcher.' },
      new StringSchema(),
    ),
    connections: new ArraySchema(
      {
        description:
          'Two to five connections between notes, each naming the notes involved.',
      },
      new StringSchema(),
    ),
  },
  ['themes', 'actionItems', 'connections'],
);

let hybridModel: GenerativeModel | null = null;
let cloudModel: GenerativeModel | null = null;
let deviceModelInitAttempted = false;

/** Lazily create the hybrid (on-device-first) model. */
function getHybridModel(): GenerativeModel | null {
  const services = getServices();
  if (!services) return null;
  if (!hybridModel) {
    hybridModel = getGenerativeModel(services.ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: {
        model: HYBRID_CLOUD_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: summarySchema,
        },
      },
    });
  }
  return hybridModel;
}

/** Lazily create the cloud-only model used for deep analysis. */
function getCloudModel(): GenerativeModel | null {
  const services = getServices();
  if (!services) return null;
  if (!cloudModel) {
    cloudModel = getGenerativeModel(services.ai, {
      model: CLOUD_ANALYSIS_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: reportSchema,
      },
    });
  }
  return cloudModel;
}

/**
 * Initialise the on-device model (downloads Gemini Nano on first use).
 * MUST be called on/after a user interaction — summarising a note is one,
 * so `summarizeNote()` calls this first. Failures are non-fatal:
 * PREFER_ON_DEVICE simply falls back to the cloud.
 */
export async function ensureDeviceModelReady(
  onProgress?: (progress: number) => void,
): Promise<boolean> {
  const model = getHybridModel();
  if (!model || deviceModelInitAttempted) return deviceModelInitAttempted;
  deviceModelInitAttempted = true;
  try {
    await model.initializeDeviceModel(onProgress);
    return true;
  } catch (e) {
    console.warn(
      '[FieldNotes] On-device model not ready (cloud fallback will be used):',
      e,
    );
    return false;
  }
}

/** Extract the first JSON object from model text (tolerates prose wrappers). */
function extractJson<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const LENGTH_HINT: Record<string, string> = {
  short: 'Keep the summary to ONE sentence and at most 3 key points.',
  standard: 'Keep the summary to 1-2 sentences and 3-4 key points.',
  detailed: 'Write a 2-3 sentence summary and 4-5 key points.',
};

interface RawSummary {
  summary?: string;
  tags?: string[];
  keyPoints?: string[];
}

/**
 * Summarise one note with hybrid inference.
 * Call this from a button click (user gesture) so the on-device model can
 * initialise/download.
 */
export async function summarizeNote(
  note: FieldNote,
): Promise<NoteSummary> {
  const startedAt = performance.now();
  const summaryLength = getRemoteConfigValues().summaryLength;
  const model = getHybridModel();

  if (!model) {
    // Demo mode — no Firebase configured. Labelled mock, no model call.
    return mockSummarize(note, summaryLength, startedAt);
  }

  // User-gesture context: warm up the on-device model first (no-op if the
  // model is already downloaded; falls back silently if unavailable).
  await ensureDeviceModelReady();

  const prompt = [
    'You are a field-research assistant. Summarise the following field note.',
    LENGTH_HINT[summaryLength] ?? LENGTH_HINT.standard,
    'Tags must be short, lowercase, without "#".',
    'Reply with ONLY a JSON object of this exact shape, no other text:',
    '{"summary": "...", "tags": ["...", "..."], "keyPoints": ["...", "..."]}',
    '',
    `TITLE: ${note.title}`,
    `LOCATION: ${note.location || 'not recorded'}`,
    `NOTE:\n${note.body}`,
  ].join('\n');

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const parsed = extractJson<RawSummary>(text);
  const latencyMs = Math.round(performance.now() - startedAt);
  const source: InferenceSource =
    response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud';

  if (!parsed || typeof parsed.summary !== 'string') {
    throw new Error(
      `Model returned unparsable output (source: ${source}). Raw text: ${text.slice(0, 200)}`,
    );
  }

  return {
    summary: parsed.summary.trim(),
    tags: (parsed.tags ?? [])
      .map((t) => t.toLowerCase().replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 6),
    keyPoints: (parsed.keyPoints ?? []).map((k) => k.trim()).filter(Boolean),
    inferenceSource: source,
    latencyMs,
    modelLabel:
      source === 'on_device'
        ? 'Gemini Nano (on-device)'
        : `${HYBRID_CLOUD_MODEL} (cloud fallback)`,
    generatedAt: Date.now(),
  };
}

interface RawReport {
  themes?: string[];
  actionItems?: string[];
  connections?: string[];
}

/**
 * Deep analysis across several notes — themes, action items, cross-note
 * connections. Cloud-only: long context and cross-document reasoning need
 * the bigger cloud model. Gated by the Remote Config flag
 * `cloud_analysis_enabled`.
 */
export async function analyzeFieldReport(
  notes: FieldNote[],
): Promise<ReportAnalysis> {
  const startedAt = performance.now();
  if (notes.length === 0) {
    throw new Error('Select at least one note to analyse.');
  }
  if (!getRemoteConfigValues().cloudAnalysisEnabled) {
    throw new Error(
      'Cloud analysis is disabled by Remote Config (cloud_analysis_enabled = false).',
    );
  }
  const model = getCloudModel();
  if (!model) {
    // Demo mode — labelled mock, no model call.
    return mockAnalyze(notes, startedAt);
  }

  const notesText = notes
    .map(
      (n, i) =>
        `--- Note ${i + 1}: "${n.title}" (${n.location || 'no location'}) ---\n${n.body}`,
    )
    .join('\n\n');

  const prompt = [
    'You are a field-research analyst. Analyse these field notes together.',
    'Find recurring themes, concrete action items for the researcher, and connections between notes (name the notes involved).',
    'Reply with ONLY a JSON object of this exact shape, no other text:',
    '{"themes": ["...", "..."], "actionItems": ["...", "..."], "connections": ["...", "..."]}',
    '',
    notesText,
  ].join('\n');

  const result = await model.generateContent(prompt);
  const parsed = extractJson<RawReport>(result.response.text());
  if (!parsed) {
    throw new Error('Cloud model returned unparsable output.');
  }
  return {
    themes: (parsed.themes ?? []).map((t) => t.trim()).filter(Boolean),
    actionItems: (parsed.actionItems ?? []).map((t) => t.trim()).filter(Boolean),
    connections: (parsed.connections ?? []).map((t) => t.trim()).filter(Boolean),
    inferenceSource: 'in_cloud',
    latencyMs: Math.round(performance.now() - startedAt),
    modelLabel: `${CLOUD_ANALYSIS_MODEL} (cloud)`,
    generatedAt: Date.now(),
    noteCount: notes.length,
  };
}

// ---------------------------------------------------------------------------
// Demo-mode mock (used ONLY when no Firebase config is present).
// Deterministic and extractive; every result carries inferenceSource
// 'demo_mock' and a modelLabel that says so.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  'the a an and or of to in on at for with by from as is are was were be been it its this that these those we they he she you i my our their his her not no but so if then than when where which who whom how what all any each few more most other some such only own same too very can will just should now also after before between into through during about over under again once here there'.split(
    ' ',
  ),
);

function sentences(text: string): string[] {
  // Protect common abbreviations so "Mrs. Chen" is not split into "Mrs."
  let t = text.replace(/\s+/g, ' ');
  for (const abbr of ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Sr', 'Jr', 'vs', 'e.g', 'i.e']) {
    t = t.split(`${abbr}. `).join(`${abbr}@@@ `);
  }
  return t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/@@@/g, '.'))
    .filter((s) => s.length > 3);
}

function mockTags(text: string, max = 5): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/)) {
    const w = word.replace(/^-+|-+$/g, '');
    if (w.length > 3 && !STOPWORDS.has(w)) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

function mockSummarize(
  note: FieldNote,
  summaryLength: string,
  startedAt: number,
): NoteSummary {
  const sents = sentences(note.body);
  const count = summaryLength === 'short' ? 1 : summaryLength === 'detailed' ? 3 : 2;
  const keyCount = summaryLength === 'short' ? 2 : summaryLength === 'detailed' ? 5 : 3;
  return {
    summary:
      sents.slice(0, count).join(' ') ||
      '(Demo mock: this note has no text to summarise yet.)',
    tags: mockTags(note.body),
    keyPoints: sents.slice(0, keyCount),
    inferenceSource: 'demo_mock',
    latencyMs: Math.round(performance.now() - startedAt),
    modelLabel: 'Demo mock — no model call (configure Firebase for real inference)',
    generatedAt: Date.now(),
  };
}

function mockAnalyze(notes: FieldNote[], startedAt: number): ReportAnalysis {
  const allTags = [...new Set(notes.flatMap((n) => mockTags(n.body, 8)))];
  return {
    themes: allTags.slice(0, 4).map((t) => `Recurring topic: ${t}`),
    actionItems: notes.slice(0, 3).map((n) => `Follow up on "${n.title}".`),
    connections:
      notes.length > 1
        ? [`"${notes[0].title}" and "${notes[1].title}" share topics: ${allTags.slice(0, 3).join(', ') || '—'}.`]
        : ['Add a second note to see cross-note connections.'],
    inferenceSource: 'demo_mock',
    latencyMs: Math.round(performance.now() - startedAt),
    modelLabel: 'Demo mock — no model call (configure Firebase for real inference)',
    generatedAt: Date.now(),
    noteCount: notes.length,
  };
}

// ---------------------------------------------------------------------------
// On-device availability probe (Chrome Prompt API).
// ---------------------------------------------------------------------------

export type OnDeviceAvailability =
  | 'available'
  | 'downloading'
  | 'downloadable'
  | 'unavailable'
  | 'unsupported';

export async function checkOnDeviceAvailability(): Promise<OnDeviceAvailability> {
  const lm = (
    window as unknown as {
      LanguageModel?: { availability: () => Promise<string> };
    }
  ).LanguageModel;
  if (!lm || typeof lm.availability !== 'function') return 'unsupported';
  try {
    const a = await lm.availability();
    if (a === 'available' || a === 'downloading' || a === 'downloadable') return a;
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
