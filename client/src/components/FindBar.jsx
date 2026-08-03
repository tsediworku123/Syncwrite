import { useCallback, useEffect, useRef, useState } from "react";

/**
 * In-editor Find & Replace bar.
 * Triggered by Ctrl+F from EditorPage.
 * Uses DOM selection + ProseMirror decorations for highlighting.
 *
 * Props:
 *   editor   — TipTap editor instance
 *   onClose  — callback to hide this panel
 */
export default function FindBar({ editor, onClose }) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matches, setMatches] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-scan on query or editor content change
  const scan = useCallback(() => {
    if (!editor || !query) { setMatches([]); return; }
    const text = editor.getText();
    const results = [];
    let lower = text.toLowerCase();
    let q = query.toLowerCase();
    let from = 0;
    while (true) {
      const idx = lower.indexOf(q, from);
      if (idx === -1) break;
      results.push(idx);
      from = idx + q.length;
    }
    setMatches(results);
    setCurrentIdx(0);
  }, [editor, query]);

  useEffect(() => { scan(); }, [scan]);

  // Jump to match — use ProseMirror's resolvePos to get coordinates
  const jumpTo = useCallback((idx) => {
    if (!editor || matches.length === 0) return;
    const pos = matches[idx] + 1; // ProseMirror positions are 1-indexed in text
    // Select the found text in the editor
    try {
      editor.chain().focus().setTextSelection({ from: pos, to: pos + query.length }).run();
    } catch { /* ignore if position is out of range */ }
  }, [editor, matches, query]);

  const goNext = () => {
    const next = (currentIdx + 1) % matches.length;
    setCurrentIdx(next);
    jumpTo(next);
  };

  const goPrev = () => {
    const prev = (currentIdx - 1 + matches.length) % matches.length;
    setCurrentIdx(prev);
    jumpTo(prev);
  };

  // Jump on first scan
  useEffect(() => {
    if (matches.length > 0) jumpTo(0);
  }, [matches, jumpTo]);

  const doReplace = () => {
    if (!editor || !query || matches.length === 0) return;
    // Replace current match
    const pos = matches[currentIdx] + 1;
    editor.chain().focus()
      .setTextSelection({ from: pos, to: pos + query.length })
      .insertContent(replace)
      .run();
    scan();
  };

  const doReplaceAll = () => {
    if (!editor || !query) return;
    const text = editor.getText();
    const count = (text.toLowerCase().split(query.toLowerCase()).length - 1);
    if (count === 0) return;
    // Walk in reverse so positions stay stable
    const positions = [...matches].reverse();
    editor.chain().focus().run();
    for (const pos of positions) {
      try {
        editor.chain()
          .setTextSelection({ from: pos + 1, to: pos + 1 + query.length })
          .insertContent(replace)
          .run();
      } catch { /* skip */ }
    }
    scan();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "Enter") { e.shiftKey ? goPrev() : goNext(); }
  };

  return (
    <div className="find-bar" role="dialog" aria-label="Find and replace">
      <button
        className="find-bar-expand"
        onClick={() => setShowReplace(r => !r)}
        title={showReplace ? "Hide replace" : "Show replace"}
        aria-expanded={showReplace}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showReplace ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div className="find-bar-inputs">
        {/* Find row */}
        <div className="find-row">
          <input
            ref={inputRef}
            className="find-input"
            type="text"
            placeholder="Find…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Find"
          />
          <span className="find-count">
            {query ? (matches.length === 0 ? "No results" : `${currentIdx + 1} / ${matches.length}`) : ""}
          </span>
          <button className="find-nav-btn" onClick={goPrev} disabled={matches.length === 0} title="Previous (Shift+Enter)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="find-nav-btn" onClick={goNext} disabled={matches.length === 0} title="Next (Enter)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Replace row */}
        {showReplace && (
          <div className="find-row">
            <input
              className="find-input"
              type="text"
              placeholder="Replace with…"
              value={replace}
              onChange={e => setReplace(e.target.value)}
              onKeyDown={e => e.key === "Escape" && onClose()}
              aria-label="Replace with"
            />
            <button className="find-action-btn" onClick={doReplace} disabled={matches.length === 0}>Replace</button>
            <button className="find-action-btn" onClick={doReplaceAll} disabled={matches.length === 0}>All</button>
          </div>
        )}
      </div>

      <button className="find-close-btn" onClick={onClose} title="Close (Escape)" aria-label="Close find bar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}
