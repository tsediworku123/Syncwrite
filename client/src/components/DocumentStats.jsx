import { useMemo } from "react";

/**
 * DocumentStats — displays live word count, character count and estimated
 * reading time derived from the TipTap editor's current content.
 */
export default function DocumentStats({ editor }) {
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, readingTime: "< 1 min" };

    const text = editor.getText();
    const trimmed = text.trim();

    const chars = trimmed.length;
    const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

    // Average reading speed: 200 words per minute
    const minutes = Math.ceil(words / 200);
    const readingTime = minutes < 1 ? "< 1 min" : `${minutes} min read`;

    return { words, chars, readingTime };
  }, [editor?.state]); // re-compute whenever editor state changes

  return (
    <div className="doc-stats-bar">
      <span className="doc-stat" title="Word count">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h10"/>
        </svg>
        <strong>{stats.words.toLocaleString()}</strong>
        <span>words</span>
      </span>

      <span className="stat-divider" aria-hidden="true" />

      <span className="doc-stat" title="Character count">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
        </svg>
        <strong>{stats.chars.toLocaleString()}</strong>
        <span>chars</span>
      </span>

      <span className="stat-divider" aria-hidden="true" />

      <span className="doc-stat" title="Estimated reading time">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <strong>{stats.readingTime}</strong>
      </span>
    </div>
  );
}
