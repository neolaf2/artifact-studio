'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSavedClock, stableJson } from '@/components/artifactEditorPreview';
import type { ValidationIssue } from '@/lib/validate';

const AUTOSAVE_MS = 1500;

export type SaveChip = 'saved' | 'unsaved' | 'saving';

export function useArtifactPersist(
  artifactId: string,
  data: Record<string, unknown>,
  _setData: (d: Record<string, unknown>) => void,
  initialData: Record<string, unknown>,
) {
  const [lastSavedJson, setLastSavedJson] = useState(() => stableJson(initialData));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = stableJson(data) !== lastSavedJson;
  const chip: SaveChip = saving ? 'saving' : dirty ? 'unsaved' : 'saved';

  const persist = useCallback(
    async (reason: 'manual' | 'autosave') => {
      if (savingRef.current) return;
      const payload = dataRef.current;
      if (stableJson(payload) === lastSavedJson && reason === 'autosave') return;
      savingRef.current = true;
      setSaving(true);
      setStatus(reason === 'autosave' ? 'Autosaving…' : 'Saving…');
      try {
        const res = await fetch(`/api/artifacts/${artifactId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: payload }),
        });
        const body = await res.json();
        if (!res.ok) {
          setIssues(
            body.issues || [{ path: '/', message: body.error || 'Save failed' }],
          );
          setStatus('Validation failed — edits kept, not saved');
          return;
        }
        setIssues([]);
        setLastSavedJson(stableJson(payload));
        const when = new Date();
        setSavedAt(when);
        const where = body.persistedTo
          ? `${body.persistedTo}:${body.path || ''}`
          : `content/artifacts/${artifactId}/data.json`;
        setStatus(
          `Saved ${formatSavedClock(when)} → ${where}${body.sha ? ` (${String(body.sha).slice(0, 7)})` : ''}`,
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Save failed');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [artifactId, lastSavedJson],
  );

  useEffect(() => {
    if (!dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist('autosave');
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [data, dirty, persist]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persist('manual');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist]);

  function syncSaved(next: Record<string, unknown>) {
    setLastSavedJson(stableJson(next));
  }

  return {
    dirty,
    chip,
    saving,
    status,
    setStatus,
    issues,
    setIssues,
    savedAt,
    persist,
    syncSaved,
    setLastSavedJson,
  };
}
