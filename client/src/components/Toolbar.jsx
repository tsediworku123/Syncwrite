import { useState, useRef, useEffect } from "react";

// ─── Inline SVG icon helpers ─────────────────────────────────────────────────
const Icon = ({ d, size = 15, viewBox = "0 0 24 24", children, strokeWidth = 2 }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ flexShrink: 0 }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Bold:          () => <Icon><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></Icon>,
  Italic:        () => <Icon><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></Icon>,
  Underline:     () => <Icon><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></Icon>,
  Strike:        () => <Icon><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 20H8a3 3 0 0 1-2.83-4"/><line x1="4" y1="12" x2="20" y2="12"/></Icon>,
  Code:          () => <Icon><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></Icon>,
  CodeBlock:     () => <Icon><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m10 9-3 3 3 3"/><path d="m14 15 3-3-3-3"/></Icon>,
  BulletList:    () => <Icon><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></Icon>,
  OrderedList:   () => <Icon><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10H6"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></Icon>,
  Blockquote:    () => <Icon><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></Icon>,
  AlignLeft:     () => <Icon><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></Icon>,
  AlignCenter:   () => <Icon><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></Icon>,
  AlignRight:    () => <Icon><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></Icon>,
  AlignJustify:  () => <Icon><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></Icon>,
  Link:          () => <Icon><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Icon>,
  Undo:          () => <Icon><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></Icon>,
  Redo:          () => <Icon><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></Icon>,
  ChevronDown:   () => <Icon size={12}><polyline points="6 9 12 15 18 9"/></Icon>,
  Export:        () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>,
};

// ─── Style dropdown (replaces H1/H2/H3 buttons) ──────────────────────────────
const STYLE_OPTIONS = [
  { label: "Paragraph",  active: e => !e.isActive("heading"), set: e => e.chain().focus().setParagraph().run() },
  { label: "Heading 1",  active: e => e.isActive("heading", { level: 1 }), set: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "Heading 2",  active: e => e.isActive("heading", { level: 2 }), set: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Heading 3",  active: e => e.isActive("heading", { level: 3 }), set: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
];

function StyleDropdown({ editor, canEdit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = STYLE_OPTIONS.find(o => o.active(editor)) ?? STYLE_OPTIONS[0];

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="style-dropdown-wrap" ref={ref}>
      <button
        className="tb-btn style-dropdown-btn"
        type="button"
        disabled={!canEdit}
        onClick={() => setOpen(v => !v)}
        title="Text style"
      >
        <span className="style-label">{current.label}</span>
        <Icons.ChevronDown />
      </button>
      {open && (
        <div className="style-dropdown-menu">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              className={`style-opt${opt.active(editor) ? " active" : ""} style-opt-${opt.label.replace(/\s/g, "").toLowerCase()}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { opt.set(editor); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────
export default function Toolbar({ editor, canEdit, onExport }) {
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Enter URL (leave blank to remove link)");
    if (url === null) return;
    url === ""
      ? editor.chain().focus().unsetLink().run()
      : editor.chain().focus().setLink({ href: url }).run();
  };

  const Btn = ({ onClick, active, disabled, title, children, shortcut }) => (
    <button
      className={`tb-btn${active ? " active" : ""}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled ?? !canEdit}
      title={shortcut ? `${title} (${shortcut})` : title}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">

      {/* Style dropdown */}
      <StyleDropdown editor={editor} canEdit={canEdit} />

      <div className="toolbar-sep" />

      {/* Text formatting */}
      <Btn active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"           shortcut="Ctrl+B"><Icons.Bold /></Btn>
      <Btn active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"         shortcut="Ctrl+I"><Icons.Italic /></Btn>
      <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"      shortcut="Ctrl+U"><Icons.Underline /></Btn>
      <Btn active={editor.isActive("strike")}    onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough"><Icons.Strike /></Btn>
      <Btn active={editor.isActive("code")}      onClick={() => editor.chain().focus().toggleCode().run()}      title="Inline code"    shortcut="Ctrl+E"><Icons.Code /></Btn>
      <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block"><Icons.CodeBlock /></Btn>

      <div className="toolbar-sep" />

      {/* Lists */}
      <Btn active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list"><Icons.BulletList /></Btn>
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><Icons.OrderedList /></Btn>
      <Btn active={editor.isActive("blockquote")}  onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Blockquote"><Icons.Blockquote /></Btn>

      <div className="toolbar-sep" />

      {/* Alignment */}
      <Btn active={editor.isActive({ textAlign: "left" })}    onClick={() => editor.chain().focus().setTextAlign("left").run()}    title="Align left"><Icons.AlignLeft /></Btn>
      <Btn active={editor.isActive({ textAlign: "center" })}  onClick={() => editor.chain().focus().setTextAlign("center").run()}  title="Align center"><Icons.AlignCenter /></Btn>
      <Btn active={editor.isActive({ textAlign: "right" })}   onClick={() => editor.chain().focus().setTextAlign("right").run()}   title="Align right"><Icons.AlignRight /></Btn>
      <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify"><Icons.AlignJustify /></Btn>

      <div className="toolbar-sep" />

      {/* Link */}
      <Btn active={editor.isActive("link")} onClick={addLink} title="Insert / edit link" shortcut="Ctrl+K"><Icons.Link /></Btn>

      {/* Undo / Redo */}
      <Btn disabled={!canEdit || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo" shortcut="Ctrl+Z"><Icons.Undo /></Btn>
      <Btn disabled={!canEdit || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo" shortcut="Ctrl+Shift+Z"><Icons.Redo /></Btn>

      {/* Export dropdown */}
      <div className="toolbar-export" ref={exportRef}>
        <button
          className="tb-btn tb-export-btn"
          type="button"
          onClick={() => setShowExport(v => !v)}
          title="Export document"
        >
          <Icons.Export />
          <span>Export</span>
          <Icons.ChevronDown />
        </button>
        {showExport && (
          <div className="export-dropdown">
            <button type="button" onClick={() => { onExport?.("pdf");      setShowExport(false); }}>Export as PDF</button>
            <button type="button" onClick={() => { onExport?.("markdown"); setShowExport(false); }}>Export as Markdown</button>
            <button type="button" onClick={() => { onExport?.("text");     setShowExport(false); }}>Export as Plain Text</button>
          </div>
        )}
      </div>
    </div>
  );
}
