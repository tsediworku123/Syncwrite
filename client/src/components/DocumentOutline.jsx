import { useMemo, useCallback } from "react";

/**
 * DocumentOutline — interactive Table of Contents generated from H1-H3 headings
 * in the TipTap editor. Clicking a heading item scrolls smoothly to that node.
 */
export default function DocumentOutline({ editor, onClose }) {
  // Extract all headings from the editor's current document
  const headings = useMemo(() => {
    if (!editor) return [];

    const items = [];
    const doc = editor.state.doc;

    doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        const level = node.attrs.level;
        const text = node.textContent;
        if (text.trim()) {
          items.push({ level, text, pos });
        }
      }
    });

    return items;
  }, [editor?.state]);

  // Scroll to a heading by its document position
  const scrollTo = useCallback(
    (pos) => {
      if (!editor) return;

      // Move cursor to the heading position
      editor.chain().focus().setTextSelection(pos).run();

      // Then scroll the DOM element into view
      const editorDom = editor.view.dom;
      const node = editorDom.querySelector(`[data-pos="${pos}"]`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Fallback: use ProseMirror's coordsAtPos
      const coords = editor.view.coordsAtPos(pos);
      const editorWrapper = editorDom.closest(".tiptap-content") || editorDom;
      const scrollParent = editorWrapper.closest(".editor-body") || window;

      if (scrollParent === window) {
        window.scrollTo({ top: coords.top + window.scrollY - 80, behavior: "smooth" });
      } else {
        scrollParent.scrollTo({
          top: scrollParent.scrollTop + coords.top - scrollParent.getBoundingClientRect().top - 80,
          behavior: "smooth",
        });
      }
    },
    [editor]
  );

  return (
    <aside className="outline-panel" aria-label="Document outline">
      <div className="outline-header">
        <div className="outline-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Outline</span>
        </div>
        <button
          className="outline-close-btn"
          onClick={onClose}
          aria-label="Close outline"
          title="Close outline"
        >
          ✕
        </button>
      </div>

      <div className="outline-body">
        {headings.length === 0 ? (
          <div className="outline-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.35 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <p>No headings found.</p>
            <p className="outline-empty-hint">Add headings (H1, H2, H3) to build an outline.</p>
          </div>
        ) : (
          <nav>
            <ol className="outline-list">
              {headings.map((h, i) => (
                <li key={i} className={`outline-item outline-h${h.level}`}>
                  <button
                    className="outline-item-btn"
                    onClick={() => scrollTo(h.pos)}
                    title={h.text}
                  >
                    <span className="outline-level-badge">H{h.level}</span>
                    <span className="outline-item-text">{h.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </aside>
  );
}
