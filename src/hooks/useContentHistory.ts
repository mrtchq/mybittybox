import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseContentHistoryOptions {
  initialContent: string;
  maxHistory?: number;
  debounceMs?: number;
  onChange?: (content: string) => void;
}

export interface UseContentHistoryResult {
  content: string;
  setContent: (newContent: string, immediate?: boolean) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  reset: (newContent: string) => void;
  commitPending: () => void;
}

export function useContentHistory({
  initialContent,
  maxHistory = 80,
  debounceMs = 500,
  onChange,
}: UseContentHistoryOptions): UseContentHistoryResult {
  const [content, setContentState] = useState<string>(initialContent);
  const contentRef = useRef<string>(initialContent);

  // Stack of previous snapshots
  const pastRef = useRef<string[]>([]);
  // Stack of undone snapshots for redo
  const futureRef = useRef<string[]>([]);

  // The last snapshot committed to history
  const lastCommittedRef = useRef<string>(initialContent);

  // Debounce timer reference for typing bursts
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State flags for UI re-rendering
  const [historyCounts, setHistoryCounts] = useState<{ undo: number; redo: number }>({
    undo: 0,
    redo: 0,
  });

  const syncCounts = useCallback(() => {
    setHistoryCounts({
      undo: pastRef.current.length,
      redo: futureRef.current.length,
    });
  }, []);

  // Flush any in-flight typing debounce timer
  const commitPending = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      lastCommittedRef.current = contentRef.current;
    }
  }, []);

  // Set new content with smart history tracking
  const setContent = useCallback(
    (newContent: string, immediate = false) => {
      if (newContent === contentRef.current) return;

      const previousContent = contentRef.current;

      if (immediate) {
        // Immediate action (e.g. font change, template load, clear, paste)
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        // Push current content to past stack
        pastRef.current = [...pastRef.current, previousContent].slice(-maxHistory);
        // Clear future redo stack on any new edit
        futureRef.current = [];

        lastCommittedRef.current = newContent;
        contentRef.current = newContent;
        setContentState(newContent);
        syncCounts();
        onChange?.(newContent);
        return;
      }

      // Typing burst mode:
      // If this is the start of a typing burst, snapshot the baseline before the burst started
      if (debounceTimerRef.current === null) {
        pastRef.current = [...pastRef.current, lastCommittedRef.current].slice(-maxHistory);
        futureRef.current = [];
        syncCounts();
      } else {
        clearTimeout(debounceTimerRef.current);
      }

      // Update current content state immediately so textarea feels instant and fluid
      contentRef.current = newContent;
      setContentState(newContent);
      onChange?.(newContent);

      // Start debounce timer to seal this typing burst once user pauses
      debounceTimerRef.current = setTimeout(() => {
        lastCommittedRef.current = contentRef.current;
        debounceTimerRef.current = null;
      }, debounceMs);
    },
    [debounceMs, maxHistory, onChange, syncCounts]
  );

  // Revert recent edit
  const undo = useCallback((): boolean => {
    // If a debounce burst was running, stop it
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (pastRef.current.length === 0) return false;

    // Pop the previous content from the past stack
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);

    // Push the current content to the future stack
    futureRef.current = [...futureRef.current, contentRef.current];

    lastCommittedRef.current = previous;
    contentRef.current = previous;
    setContentState(previous);
    syncCounts();
    onChange?.(previous);
    return true;
  }, [onChange, syncCounts]);

  // Restore undone edit
  const redo = useCallback((): boolean => {
    if (futureRef.current.length === 0) return false;

    // Pop the next content from the future stack
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);

    // Push the current content to the past stack
    pastRef.current = [...pastRef.current, contentRef.current].slice(-maxHistory);

    lastCommittedRef.current = next;
    contentRef.current = next;
    setContentState(next);
    syncCounts();
    onChange?.(next);
    return true;
  }, [maxHistory, onChange, syncCounts]);

  // Reset entire history (e.g. when opening a new box or switching sessions)
  const reset = useCallback(
    (newContent: string) => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pastRef.current = [];
      futureRef.current = [];
      lastCommittedRef.current = newContent;
      contentRef.current = newContent;
      setContentState(newContent);
      syncCounts();
    },
    [syncCounts]
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    content,
    setContent,
    undo,
    redo,
    canUndo: historyCounts.undo > 0,
    canRedo: historyCounts.redo > 0,
    undoCount: historyCounts.undo,
    redoCount: historyCounts.redo,
    reset,
    commitPending,
  };
}
