import { useEffect, useState } from 'react';
import type { FieldNote } from '../types';

interface Props {
  note: FieldNote;
  isNew: boolean;
  onSave: (note: FieldNote) => void;
  onCancel: () => void;
}

export default function NoteEditor({ note, isNew, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(note.title);
  const [location, setLocation] = useState(note.location);
  const [body, setBody] = useState(note.body);
  const [tagsText, setTagsText] = useState(note.tags.join(', '));

  // Reset the form when a different note is selected.
  useEffect(() => {
    setTitle(note.title);
    setLocation(note.location);
    setBody(note.body);
    setTagsText(note.tags.join(', '));
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const wordCount = body.trim() === '' ? 0 : body.trim().split(/\s+/).length;

  function save() {
    const tags = tagsText
      .split(/[,#\s]+/)
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);
    onSave({
      ...note,
      title: title.trim(),
      location: location.trim(),
      body,
      tags: [...new Set(tags)],
      updatedAt: Date.now(),
      synced: false,
    });
  }

  return (
    <section className="editor">
      <h2>{isNew ? 'New note' : 'Edit note'}</h2>
      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Mangrove survey — transect 3"
        />
      </label>
      <label>
        Location
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Beihai mangrove boardwalk, Guangxi"
        />
      </label>
      <label>
        Tags <span className="hint">(comma separated)</span>
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="mangrove, birds, water-quality"
        />
      </label>
      <label>
        Notes / audio transcript
        <span className="hint">
          — type observations or paste a transcript. Saved on this device
          immediately, even offline.
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you see, hear, and learn? Paste an audio transcript here…"
          rows={12}
        />
      </label>
      <p className="word-count">
        {wordCount} words · {body.length} characters
      </p>
      <div className="editor-actions">
        <button className="btn" onClick={save}>
          Save note
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
