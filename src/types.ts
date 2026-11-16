/**
 * FieldNotes — shared types.
 *
 * A field note is a structured observation captured in the field
 * (title, body / audio-transcript text, tags, location). AI summaries are
 * stored on the note together with *where* the inference ran, so the hybrid
 * behaviour is visible in the UI and to judges.
 */

/** Where a piece of AI output was produced. */
export type InferenceSource = 'on_device' | 'in_cloud' | 'demo_mock';

export interface NoteSummary {
  /** 1–3 sentence summary of the note. */
  summary: string;
  /** Auto-generated tags (lowercase, no `#`). */
  tags: string[];
  /** 2–5 key points pulled out of the note. */
  keyPoints: string[];
  /** Where the inference ran. */
  inferenceSource: InferenceSource;
  /** Wall-clock time of the model call, in milliseconds. */
  latencyMs: number;
  /** Human-readable model label, e.g. "Gemini Nano (on-device)". */
  modelLabel: string;
  /** Unix epoch ms when the summary was produced. */
  generatedAt: number;
}

export interface FieldNote {
  id: string;
  title: string;
  /** Free-form field observations and/or pasted audio-transcript text. */
  body: string;
  tags: string[];
  /** Free-text location, e.g. "Beihai mangrove boardwalk, Guangxi". */
  location: string;
  createdAt: number;
  updatedAt: number;
  /** Latest AI summary, if one has been generated. */
  summary?: NoteSummary;
  /** True once this version of the note has been written to Firestore. */
  synced?: boolean;
}

export interface ReportAnalysis {
  /** Cross-cutting themes found across the selected notes. */
  themes: string[];
  /** Concrete next steps for the researcher. */
  actionItems: string[];
  /** Connections between notes, e.g. "Note A and Note C both mention …". */
  connections: string[];
  inferenceSource: InferenceSource;
  latencyMs: number;
  modelLabel: string;
  generatedAt: number;
  /** Number of notes the analysis covered. */
  noteCount: number;
}

/** Remote Config values (with local defaults when Firebase is absent). */
export interface RemoteConfigValues {
  /** "short" | "standard" | "detailed" — controls summary length. */
  summaryLength: string;
  /** Kill-switch for the cloud deep-analysis feature. */
  cloudAnalysisEnabled: boolean;
  /** "prefer_on_device" | "prefer_in_cloud" — hybrid routing preference. */
  hybridMode: string;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigValues = {
  summaryLength: 'standard',
  cloudAnalysisEnabled: true,
  hybridMode: 'prefer_on_device',
};
