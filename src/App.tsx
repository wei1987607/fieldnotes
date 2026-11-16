import { useCallback, useEffect, useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import StatusBar from './components/StatusBar';
import NoteCard from './components/NoteCard';
import NoteEditor from './components/NoteEditor';
import ReportPanel from './components/ReportPanel';
import {
  initFirebase,
  getFirebaseStatus,
  getRemoteConfigValues,
  type FirebaseStatus,
} from './lib/firebase';
import {
  summarizeNote,
  analyzeFieldReport,
  checkOnDeviceAvailability,
  type OnDeviceAvailability,
} from './lib/ai';
import {
  loadLocalNotes,
  saveLocalNotes,
  blankNote,
  syncNoteToFirestore,
  deleteNoteFromFirestore,
  pullNotesFromFirestore,
  pushUnsyncedNotes,
  notesToMarkdown,
  downloadFile,
} from './lib/store';
import { SAMPLE_NOTES } from './lib/seed';
import type { FieldNote, ReportAnalysis, RemoteConfigValues } from './types';
import './App.css';

export default function App() {
  const [notes, setNotes] = useState<FieldNote[]>(() => loadLocalNotes());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ note: FieldNote; isNew: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportAnalysis | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [onDevice, setOnDevice] = useState<OnDeviceAvailability>('unsupported');
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>(() =>
    getFirebaseStatus(),
  );
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfigValues>(() =>
    getRemoteConfigValues(),
  );

  const refreshOnDevice = useCallback(async () => {
    setOnDevice(await checkOnDeviceAvailability());
  }, []);

  // Export a PNG snapshot of the whole page (used for the demo video:
  // the cloud browser cannot hand screenshots back as files, so the app
  // renders its own snapshot for download).
  const downloadSnapshot = useCallback(async () => {
    const el = document.querySelector('.app') as HTMLElement | null;
    if (!el || snapshotBusy) return;
    setSnapshotBusy(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#f7f3ea',
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Snapshot failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fieldnotes-snapshot.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        'Snapshot failed: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setSnapshotBusy(false);
    }
  }, [snapshotBusy]);

  // Boot: Firebase, Firestore pull, on-device probe, connectivity listeners.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initFirebase();
      if (cancelled) return;
      setFirebaseStatus({ ...getFirebaseStatus() });
      setRemoteConfig({ ...getRemoteConfigValues() });
      const merged = await pullNotesFromFirestore(loadLocalNotes());
      if (cancelled) return;
      setNotes(merged);
      saveLocalNotes(merged);
      await refreshOnDevice();
    })();

    const onOnline = async () => {
      setOnline(true);
      const pushed = await pushUnsyncedNotes(loadLocalNotes());
      setNotes(pushed);
      saveLocalNotes(pushed);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshOnDevice]);

  /** Persist locally, update state, and push the changed note to Firestore. */
  function persist(next: FieldNote[], changed?: FieldNote) {
    setNotes(next);
    saveLocalNotes(next);
    if (changed) {
      void syncNoteToFirestore(changed).then((ok) => {
        if (ok) {
          setNotes((prev) => {
            const updated = prev.map((n) =>
              n.id === changed.id ? { ...n, synced: true } : n,
            );
            saveLocalNotes(updated);
            return updated;
          });
        }
      });
    }
  }

  function createNote() {
    const note = blankNote();
    setEditing({ note, isNew: true });
    setSelectedId(note.id);
  }

  function saveNote(updated: FieldNote) {
    const exists = notes.some((n) => n.id === updated.id);
    const next = exists
      ? notes.map((n) => (n.id === updated.id ? updated : n))
      : [updated, ...notes];
    persist(next, updated);
    setEditing(null);
    setSelectedId(updated.id);
  }

  function deleteNote(id: string) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    const next = notes.filter((n) => n.id !== id);
    persist(next);
    void deleteNoteFromFirestore(id);
    if (selectedId === id) setSelectedId(null);
    setEditing((e) => (e && e.note.id === id ? null : e));
  }

  async function summarize(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note || note.body.trim() === '') return;
    setError(null);
    setSummarizingId(id);
    try {
      const summary = await summarizeNote(note);
      const updated = { ...note, summary, updatedAt: Date.now(), synced: false };
      persist(
        notes.map((n) => (n.id === id ? updated : n)),
        updated,
      );
    } catch (e) {
      setError(`Summarise failed: ${(e as Error).message}`);
    } finally {
      setSummarizingId(null);
    }
  }

  async function runReport() {
    setError(null);
    setReportBusy(true);
    try {
      const analysis = await analyzeFieldReport(visibleNotes);
      setReport(analysis);
    } catch (e) {
      setError(`Deep analysis failed: ${(e as Error).message}`);
    } finally {
      setReportBusy(false);
    }
  }

  function loadSamples() {
    const existingIds = new Set(notes.map((n) => n.id));
    const fresh = SAMPLE_NOTES.filter((n) => !existingIds.has(n.id));
    if (fresh.length === 0) return;
    const next = [...fresh, ...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    persist(next);
  }

  // --- Derived data -------------------------------------------------------
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.location.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, search, tagFilter]);

  const stats = useMemo(() => {
    const summarized = notes.filter((n) => n.summary);
    return {
      total: notes.length,
      summarized: summarized.length,
      onDevice: summarized.filter((n) => n.summary?.inferenceSource === 'on_device').length,
      inCloud: summarized.filter((n) => n.summary?.inferenceSource === 'in_cloud').length,
      mock: summarized.filter((n) => n.summary?.inferenceSource === 'demo_mock').length,
    };
  }, [notes]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const samplesLoaded = SAMPLE_NOTES.every((s) => notes.some((n) => n.id === s.id));

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>📓 FieldNotes</h1>
          <p className="tagline">
            The offline-first field research notebook. Summaries run on-device
            with Gemini Nano when available — and fall back to the cloud when
            they can&apos;t.
          </p>
        </div>
        <div className="stats">
          <span><strong>{stats.total}</strong> notes</span>
          <span><strong>{stats.summarized}</strong> summarised</span>
          <span title="Summaries that ran on-device">🟢 {stats.onDevice}</span>
          <span title="Summaries that ran in the cloud">☁️ {stats.inCloud}</span>
          {stats.mock > 0 && <span title="Demo-mode mock summaries">🧪 {stats.mock}</span>}
        </div>
      </header>

      <StatusBar
        online={online}
        firebaseStatus={firebaseStatus}
        remoteConfig={remoteConfig}
        onDevice={onDevice}
        onRefreshOnDevice={refreshOnDevice}
      />

      {!firebaseStatus.configured && (
        <div className="demo-banner" role="status">
          <strong>Demo mode.</strong> No Firebase project is configured, so
          notes stay on this device and summaries use a clearly-labelled local
          mock (never presented as model output). To enable real hybrid
          inference — on-device Gemini Nano with cloud fallback — follow the
          setup steps in <code>README.md</code> and add your Firebase config
          to <code>.env.local</code>. The real Firebase AI Logic code path is
          already in the app (<code>src/lib/ai.ts</code>).
        </div>
      )}
      {firebaseStatus.error && (
        <div className="error-banner" role="alert">{firebaseStatus.error}</div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}{' '}
          <button className="btn btn-small btn-ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search notes, tags, places…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn" onClick={createNote}>+ New note</button>
        <button className="btn btn-ghost" onClick={loadSamples} disabled={samplesLoaded}>
          Load sample notes
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => downloadFile('fieldnotes.md', notesToMarkdown(visibleNotes), 'text/markdown')}
          disabled={visibleNotes.length === 0}
        >
          Export .md
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => downloadFile('fieldnotes.json', JSON.stringify(visibleNotes, null, 2), 'application/json')}
          disabled={visibleNotes.length === 0}
        >
          Export .json
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter">
          <button
            className={`tag ${tagFilter === null ? 'tag-active' : ''}`}
            onClick={() => setTagFilter(null)}
          >
            All
          </button>
          {allTags.map(([t, count]) => (
            <button
              key={t}
              className={`tag ${tagFilter === t ? 'tag-active' : ''}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              #{t} ({count})
            </button>
          ))}
        </div>
      )}

      <main className="layout">
        <section className="notes-list">
          {visibleNotes.length === 0 ? (
            <div className="empty">
              <p>No notes yet.</p>
              <p>
                Create your first field note — or load the sample notes to see
                hybrid summarisation in action.
              </p>
              <button className="btn" onClick={loadSamples}>Load sample notes</button>
            </div>
          ) : (
            visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                summarizing={summarizingId === note.id}
                onSelect={() => setSelectedId(note.id)}
                onSummarize={() => void summarize(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))
          )}
        </section>

        <aside className="detail">
          {editing ? (
            <NoteEditor
              note={editing.note}
              isNew={editing.isNew}
              onSave={saveNote}
              onCancel={() => setEditing(null)}
            />
          ) : selected ? (
            <div className="detail-view">
              <h2>{selected.title || '(Untitled note)'}</h2>
              <p className="note-meta">
                {new Date(selected.createdAt).toLocaleString()}
                {selected.location ? ` · 📍 ${selected.location}` : ''}
              </p>
              <p className="detail-body">{selected.body}</p>
              <div className="editor-actions">
                <button
                  className="btn"
                  onClick={() => setEditing({ note: selected, isNew: false })}
                >
                  Edit note
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void summarize(selected.id)}
                  disabled={summarizingId === selected.id || selected.body.trim() === ''}
                >
                  {summarizingId === selected.id ? 'Summarising…' : '✦ Summarise'}
                </button>
              </div>
            </div>
          ) : (
            <div className="how-it-works">
              <h2>How hybrid inference works here</h2>
              <ol>
                <li>
                  <strong>On-device first.</strong> Tap <em>Summarise</em> on
                  any note. Firebase AI Logic tries Gemini Nano in Chrome
                  (Chrome 139+, Prompt API) — private, free, works offline.
                </li>
                <li>
                  <strong>Cloud fallback.</strong> If no on-device model is
                  available, the same call falls back to{' '}
                  <code>gemini-3.5-flash-lite</code> in the cloud.
                </li>
                <li>
                  <strong>Proof on every summary.</strong> Each summary shows
                  a badge — 🟢 on-device, ☁️ cloud, or 🧪 demo mock — plus
                  latency and model name, so you can see exactly where the
                  inference ran.
                </li>
                <li>
                  <strong>Deep analysis is cloud-only.</strong> Cross-note
                  themes and action items go to{' '}
                  <code>gemini-3.5-flash-lite</code> (below), gated by Remote
                  Config.
                </li>
              </ol>
              <p className="how-note">
                Notes are stored locally first and synced to Firestore when
                you&apos;re back online. Anonymous Auth, App Check and Remote
                Config are wired up in <code>src/lib/firebase.ts</code>.
              </p>
            </div>
          )}
        </aside>
      </main>

      <ReportPanel
        report={report}
        busy={reportBusy}
        noteCount={visibleNotes.length}
        cloudEnabled={remoteConfig.cloudAnalysisEnabled}
        onRun={runReport}
        onClose={() => setReport(null)}
      />

      <footer className="footer">
        <p>
          FieldNotes — built for #BuildHybridAI 2026 with Firebase AI Logic
          (Hybrid Inference SDK). Open source under the Apache License 2.0.{' '}
          <a href="https://firebase.google.com/docs/ai-logic/hybrid/web/get-started" target="_blank" rel="noreferrer">
            Firebase AI Logic hybrid docs
          </a>
        </p>
        <button
          type="button"
          className="snapshot-btn"
          onClick={downloadSnapshot}
          disabled={snapshotBusy}
        >
          {snapshotBusy ? 'Capturing…' : 'Download snapshot (PNG)'}
        </button>
      </footer>
    </div>
  );
}
