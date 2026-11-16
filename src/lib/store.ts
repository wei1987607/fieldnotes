/**
 * Notes store — offline-first.
 *
 * Source of truth on the device is localStorage, so the app works fully
 * offline (including in demo mode). When Firebase is configured and the
 * user is signed in anonymously, every mutation is also written to
 * Firestore at `users/{uid}/notes/{noteId}`, and notes are pulled from
 * Firestore on startup (newest `updatedAt` wins per note). Unsynced notes
 * are re-pushed when the browser comes back online.
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import { getServices, currentUser } from './firebase';
import type { FieldNote } from '../types';

const STORAGE_KEY = 'fieldnotes.notes.v1';

export function loadLocalNotes(): FieldNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FieldNote[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => n && typeof n.id === 'string' && typeof n.body === 'string');
  } catch {
    return [];
  }
}

export function saveLocalNotes(notes: FieldNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn('[FieldNotes] localStorage write failed:', e);
  }
}

export function newNoteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function blankNote(): FieldNote {
  const now = Date.now();
  return {
    id: newNoteId(),
    title: '',
    body: '',
    tags: [],
    location: '',
    createdAt: now,
    updatedAt: now,
    synced: false,
  };
}

function notesCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'notes');
}

/** Push one note to Firestore (no-op in demo mode / offline). */
export async function syncNoteToFirestore(note: FieldNote): Promise<boolean> {
  const services = getServices();
  const user = currentUser();
  if (!services || !user) return false;
  if (!navigator.onLine) return false;
  try {
    const { synced: _synced, ...payload } = note;
    await setDoc(doc(notesCollection(services.db, user.uid), note.id), {
      ...payload,
      synced: true,
    });
    return true;
  } catch (e) {
    console.warn('[FieldNotes] Firestore write failed:', e);
    return false;
  }
}

/** Delete one note from Firestore (no-op in demo mode / offline). */
export async function deleteNoteFromFirestore(noteId: string): Promise<void> {
  const services = getServices();
  const user = currentUser();
  if (!services || !user || !navigator.onLine) return;
  try {
    await deleteDoc(doc(notesCollection(services.db, user.uid), noteId));
  } catch (e) {
    console.warn('[FieldNotes] Firestore delete failed:', e);
  }
}

/**
 * Pull notes from Firestore and merge with local notes.
 * Newest `updatedAt` wins per note id. Returns the merged list.
 */
export async function pullNotesFromFirestore(
  local: FieldNote[],
): Promise<FieldNote[]> {
  const services = getServices();
  const user = currentUser();
  if (!services || !user || !navigator.onLine) return local;
  try {
    const snap = await getDocs(notesCollection(services.db, user.uid));
    const remote = snap.docs.map((d) => {
      const data = d.data() as Omit<FieldNote, 'id'>;
      return { ...data, id: d.id, synced: true } as FieldNote;
    });
    const merged = new Map<string, FieldNote>();
    for (const n of local) merged.set(n.id, n);
    for (const n of remote) {
      const existing = merged.get(n.id);
      if (!existing || n.updatedAt >= existing.updatedAt) merged.set(n.id, n);
    }
    return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    console.warn('[FieldNotes] Firestore read failed:', e);
    return local;
  }
}

/** Push every unsynced note (used when coming back online). */
export async function pushUnsyncedNotes(
  notes: FieldNote[],
): Promise<FieldNote[]> {
  const out = [...notes];
  for (let i = 0; i < out.length; i++) {
    if (!out[i].synced) {
      const ok = await syncNoteToFirestore(out[i]);
      if (ok) out[i] = { ...out[i], synced: true };
    }
  }
  return out;
}

/** Export helpers for the Download buttons. */
export function notesToMarkdown(notes: FieldNote[]): string {
  const lines: string[] = ['# FieldNotes export', ''];
  for (const n of notes) {
    lines.push(`## ${n.title || '(untitled)'}`);
    lines.push('');
    lines.push(`- Date: ${new Date(n.createdAt).toLocaleString()}`);
    if (n.location) lines.push(`- Location: ${n.location}`);
    if (n.tags.length) lines.push(`- Tags: ${n.tags.map((t) => `#${t}`).join(' ')}`);
    lines.push('');
    lines.push(n.body);
    if (n.summary) {
      lines.push('');
      lines.push(`> AI summary (${n.summary.modelLabel}, ${n.summary.latencyMs} ms): ${n.summary.summary}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
