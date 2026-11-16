import type { FieldNote, InferenceSource } from '../types';

export function InferenceBadge({ source }: { source: InferenceSource }) {
  if (source === 'on_device') {
    return (
      <span className="badge badge-device" title="Summary ran on-device with Gemini Nano — private, free, offline.">
        🟢 On-device · Gemini Nano
      </span>
    );
  }
  if (source === 'in_cloud') {
    return (
      <span className="badge badge-cloud" title="Summary ran in the cloud (Gemini) because the on-device model was unavailable.">
        ☁️ Cloud · Gemini
      </span>
    );
  }
  return (
    <span className="badge badge-demo" title="Demo mode: no Firebase project is configured, so this is a deterministic local mock — not a model call.">
      🧪 Demo mock — no model call
    </span>
  );
}

interface Props {
  note: FieldNote;
  selected: boolean;
  summarizing: boolean;
  onSelect: () => void;
  onSummarize: () => void;
  onDelete: () => void;
}

export default function NoteCard({
  note,
  selected,
  summarizing,
  onSelect,
  onSummarize,
  onDelete,
}: Props) {
  const excerpt =
    note.body.length > 240 ? `${note.body.slice(0, 240)}…` : note.body;

  return (
    <article
      className={`note-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
      }}
    >
      <div className="note-card-head">
        <h3>{note.title || '(Untitled note)'}</h3>
        <span className="sync-state" title={note.synced ? 'Synced to Firestore' : 'Stored locally only'}>
          {note.synced ? '✓ synced' : '○ local only'}
        </span>
      </div>
      <p className="note-meta">
        {new Date(note.createdAt).toLocaleString()}
        {note.location ? ` · 📍 ${note.location}` : ''}
      </p>
      <p className="note-excerpt">{excerpt || 'No text yet.'}</p>
      {note.tags.length > 0 && (
        <div className="tags">
          {note.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
      )}

      {note.summary ? (
        <div className="summary-block">
          <div className="summary-head">
            <InferenceBadge source={note.summary.inferenceSource} />
            <span className="latency" title="Time taken for the model call">
              {note.summary.latencyMs} ms
            </span>
          </div>
          <p className="summary-text">{note.summary.summary}</p>
          {note.summary.keyPoints.length > 0 && (
            <ul className="key-points">
              {note.summary.keyPoints.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          )}
          <p className="model-label">{note.summary.modelLabel}</p>
        </div>
      ) : (
        <p className="no-summary">No AI summary yet.</p>
      )}

      <div className="note-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn btn-small"
          onClick={onSummarize}
          disabled={summarizing || note.body.trim().length === 0}
          title="Summarise with Firebase AI Logic — on-device Gemini Nano when available, cloud fallback otherwise"
        >
          {summarizing
            ? 'Summarising…'
            : note.summary
              ? '↻ Re-summarise'
              : '✦ Summarise'}
        </button>
        <button
          className="btn btn-small btn-ghost btn-danger"
          onClick={onDelete}
          title="Delete this note"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
