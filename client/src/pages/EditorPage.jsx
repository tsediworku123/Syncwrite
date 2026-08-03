import {useEffect, useMemo, useRef, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import * as Y from "yjs";
import {useEditor, EditorContent} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

import {api} from "../api/client";
import {useAuth} from "../context/AuthContext.jsx";
import {useTheme} from "../context/ThemeContext.jsx";
import {useToast} from "../context/ToastContext.jsx";
import {useNotifications} from "../context/NotificationContext.jsx";
import {SocketIOYjsProvider} from "../hooks/SocketIOYjsProvider.js";
import Toolbar from "../components/Toolbar.jsx";
import PresenceBar from "../components/PresenceBar.jsx";
import CommentsPanel from "../components/CommentsPanel.jsx";
import VersionHistory from "../components/VersionHistory.jsx";
import ShareModal from "../components/ShareModal.jsx";
import ShortcutsModal from "../components/ShortcutsModal.jsx";
import DocumentOutline from "../components/DocumentOutline.jsx";
import DocumentStats from "../components/DocumentStats.jsx";
import FindBar from "../components/FindBar.jsx";
import NotificationPanel from "../components/NotificationPanel.jsx";

export default function EditorPage() {
  const {id: documentId} = useParams();
  const {user} = useAuth();

  const [ydocState, setYdocState] = useState(null);

  useEffect(() => {
    if (!user) return;
    const doc = new Y.Doc();
    const p = new SocketIOYjsProvider({documentId, ydoc: doc, user});
    setYdocState({ydoc: doc, provider: p});
    return () => {
      p.destroy();
      doc.destroy();
    };
  }, [documentId, user]);

  if (!ydocState) {
    return (
      <div className="editor-loading">
        <div className="loading-spinner" />
        <p>Connecting to collaboration server…</p>
      </div>
    );
  }

  return <EditorInner documentId={documentId} user={user} ydoc={ydocState.ydoc} provider={ydocState.provider} />;
}

function EditorInner({documentId, user, ydoc, provider}) {
  const {theme, toggleTheme} = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const {add: addNotification, unread: unreadCount} = useNotifications();

  const [title, setTitle] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [presence, setPresence] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [saveStatus, setSaveStatus] = useState("Synced");
  const [panel, setPanel] = useState(null); // "comments" | "versions" | "share" | "shortcuts" | "notifications"
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Import markdown file input
  const importRef = useRef(null);

  const typingMapRef = useRef(new Map());

  // Load document metadata
  useEffect(() => {
    api.get(`/documents/${documentId}`)
      .then(res => {
        setTitle(res.data.title);
        setRole(res.data.myRole);
        document.title = `${res.data.title} — SyncWrite`;
      })
      .catch(err => {
        console.error("Failed to load document metadata", err);
        toast("Could not load document", "error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [documentId]);

  // Wire provider events
  useEffect(() => {
    if (!provider || !ydoc) return;

    provider.onSynced(r => setRole(r));

    provider.onPresence(users => setPresence(users));

    provider.onTyping(({type, userId, name, color}) => {
      if (type === "start") {
        typingMapRef.current.set(userId, {userId, name, color});
      } else {
        typingMapRef.current.delete(userId);
      }
      setTypingUsers(Array.from(typingMapRef.current.values()));
    });

    // Notify on new presence joins (other users)
    provider.on("presence", (users) => {
      // handled above
    });

    let saveTimer;
    const onUpdate = (_u, origin) => {
      if (origin === "remote") return;
      setSaveStatus("Saving…");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => setSaveStatus("Saved ✓"), 2200);
    };
    ydoc.on("update", onUpdate);

    return () => {
      clearTimeout(saveTimer);
      ydoc.off("update", onUpdate);
      document.title = "SyncWrite";
    };
  }, [documentId, ydoc, provider]);

  // Typing indicator — detect when user types
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleTyping = () => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      provider.sendTypingStart();
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      provider.sendTypingStop();
    }, 2000);
  };

  const canEdit = role === "OWNER" || role === "EDITOR";
  const canComment = canEdit || role === "COMMENTER";

  const editor = useEditor({
    editable: canEdit,
    extensions: [
      StarterKit.configure({history: false}),
      Underline,
      Link.configure({openOnClick: false}),
      TextAlign.configure({types: ["heading", "paragraph"]}),
      Collaboration.configure({document: ydoc, field: "default"}),
      CollaborationCursor.configure({
        provider: provider,
        user: {name: user.name, color: colorFor(user.id)},
      }),
    ],
    onUpdate: () => { handleTyping(); },
  }, [documentId, canEdit, provider, user, ydoc]);

  // Export handlers
  const handleExport = (format) => {
    if (format === "pdf") {
      window.print();
      toast("Print dialog opened — save as PDF", "success");
    } else if (format === "markdown") {
      const md = editorToMarkdown(editor);
      downloadFile(`${title || "document"}.md`, md, "text/markdown");
      toast("Markdown exported!", "success");
      addNotification(`Exported "${title || "document"}" as Markdown`, "success");
    } else if (format === "text") {
      const text = editor?.getText() || "";
      downloadFile(`${title || "document"}.txt`, text, "text/plain");
      toast("Plain text exported!", "success");
    }
  };

  // Import markdown file
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const md = ev.target.result;
      const content = markdownToProseMirror(md);
      editor.chain().focus().setContent(content).run();
      toast("Markdown imported successfully!", "success");
      addNotification(`Imported "${file.name}" into the document`, "info");
    };
    reader.readAsText(file);
    // Reset so same file can be imported again
    e.target.value = "";
  };

  const handleRename = async () => {
    const newTitle = window.prompt("Document title", title);
    if (!newTitle || newTitle === title) return;
    try {
      await api.patch(`/documents/${documentId}`, {title: newTitle});
      setTitle(newTitle);
      document.title = `${newTitle} — SyncWrite`;
      toast("Document renamed", "success");
    } catch {
      toast("Could not rename document", "error");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied to clipboard!", "success");
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = e => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "f") {
        e.preventDefault();
        setFindOpen(o => !o);
        return;
      }
      if (ctrl && e.key === "k") {
        e.preventDefault();
        const url = window.prompt("Enter URL (blank to remove)");
        if (url === null) return;
        url === ""
          ? editor.chain().focus().unsetLink().run()
          : editor.chain().focus().setLink({href: url}).run();
      }
      if (ctrl && e.shiftKey && e.key === "H") {
        e.preventDefault();
        setPanel(p => p === "versions" ? null : "versions");
      }
      if (ctrl && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setPanel(p => p === "comments" ? null : "comments");
      }
      if (ctrl && e.shiftKey && e.key === "S" && role === "OWNER") {
        e.preventDefault();
        setPanel(p => p === "share" ? null : "share");
      }
      if (ctrl && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setPanel(p => p === "shortcuts" ? null : "shortcuts");
      }
      if (ctrl && e.shiftKey && e.key === "O") {
        e.preventDefault();
        setOutlineOpen(o => !o);
      }
      if (e.key === "Escape") {
        if (findOpen) { setFindOpen(false); return; }
        if (panel) { setPanel(null); return; }
        if (outlineOpen) { setOutlineOpen(false); return; }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, panel, outlineOpen, findOpen, role]);

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="loading-spinner" />
        <p>Loading document…</p>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="icon-btn back-btn" onClick={() => navigate("/")} title="Back to dashboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>

        <div className="editor-title-wrap">
          <h2
            onClick={canEdit ? handleRename : undefined}
            className={canEdit ? "editable-title" : ""}
            title={canEdit ? "Click to rename" : undefined}
          >
            {title || "Untitled Document"}
          </h2>
          {canEdit && <span className="edit-hint" aria-hidden="true">✏️</span>}
        </div>

        <div className="header-actions">
          <PresenceBar
            users={presence}
            saveStatus={canEdit ? saveStatus : "Read-only"}
            typingUsers={typingUsers}
          />

          {/* Find toggle */}
          <button
            className={`icon-btn${findOpen ? " active" : ""}`}
            onClick={() => setFindOpen(o => !o)}
            title="Find & Replace (Ctrl+F)"
            aria-label="Find and replace"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>

          {/* Notification bell */}
          <div className="notif-bell-wrap">
            <button
              className={`icon-btn notif-bell${unreadCount > 0 ? " has-unread" : ""}`}
              onClick={() => setPanel(p => p === "notifications" ? null : "notifications")}
              title="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>

          {/* Import markdown */}
          {canEdit && (
            <>
              <input
                ref={importRef}
                type="file"
                accept=".md,.markdown"
                style={{display: "none"}}
                onChange={handleImportFile}
                aria-label="Import Markdown file"
              />
              <button
                className="icon-btn"
                onClick={() => importRef.current?.click()}
                title="Import Markdown file"
                aria-label="Import Markdown"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
            </>
          )}

          <button className="icon-btn" onClick={copyLink} title="Copy share link" aria-label="Copy link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>

          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === "light" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>

          <button
            className={`outline-toggle-btn${outlineOpen ? " active" : ""}`}
            onClick={() => setOutlineOpen(o => !o)}
            title="Document outline (Ctrl+Shift+O)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Outline
          </button>

          <button onClick={() => setPanel("versions")} title="Ctrl+Shift+H">History</button>
          <button onClick={() => setPanel("comments")} title="Ctrl+Shift+C">Comments</button>
          {role === "OWNER" && (
            <button className="primary" onClick={() => setPanel("share")} title="Ctrl+Shift+S">Share</button>
          )}
          <button className="icon-btn" onClick={() => setPanel("shortcuts")} title="Keyboard shortcuts (Ctrl+Shift+?)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="3"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8"/>
            </svg>
          </button>
        </div>
      </header>

      <Toolbar editor={editor} canEdit={canEdit} onExport={handleExport} />

      {/* Find bar sits between toolbar and canvas */}
      {findOpen && <FindBar editor={editor} onClose={() => setFindOpen(false)} />}

      <div className="editor-workstation">
        {outlineOpen && (
          <DocumentOutline editor={editor} onClose={() => setOutlineOpen(false)} />
        )}

        <div className="editor-body">
          <EditorContent editor={editor} className="tiptap-content" />
          <DocumentStats editor={editor} />

          {panel === "comments" && (
            <CommentsPanel
              documentId={documentId}
              canComment={canComment}
              onClose={() => setPanel(null)}
            />
          )}
        </div>

        {/* Notification panel overlays on right */}
        {panel === "notifications" && (
          <NotificationPanel onClose={() => setPanel(null)} />
        )}
      </div>

      {panel === "versions" && (
        <VersionHistory
          documentId={documentId}
          canRestore={canEdit}
          onClose={() => setPanel(null)}
          onRestored={() => {
            addNotification("Document version restored", "success");
            toast("Version restored! Reloading…", "success");
            setTimeout(() => window.location.reload(), 800);
          }}
        />
      )}

      {panel === "share" && (
        <ShareModal
          documentId={documentId}
          onClose={() => setPanel(null)}
          onShared={(email) => {
            addNotification(`You shared this document with ${email}`, "info");
            toast("Invitation sent!", "success");
          }}
        />
      )}

      {panel === "shortcuts" && (
        <ShortcutsModal onClose={() => setPanel(null)} />
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function colorFor(userId) {
  const palette = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Markdown → ProseMirror JSON ────────────────────────────────────────────
function markdownToProseMirror(md) {
  const lines = md.split("\n");
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      nodes.push({ type: "heading", attrs: { level: hMatch[1].length }, content: [{ type: "text", text: hMatch[2].trim() }] });
      i++; continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      nodes.push({ type: "codeBlock", content: [{ type: "text", text: codeLines.join("\n") }] });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      nodes.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(line.slice(2)) }] });
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      nodes.push({ type: "horizontalRule" });
      i++; continue;
    }

    // Bullet list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^[-*+]\s/, "")) }] });
        i++;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^\d+\.\s/, "")) }] });
        i++;
      }
      nodes.push({ type: "orderedList", content: items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") { i++; continue; }

    // Paragraph
    nodes.push({ type: "paragraph", content: parseInline(line) });
    i++;
  }

  return { type: "doc", content: nodes.length > 0 ? nodes : [{ type: "paragraph" }] };
}

function parseInline(text) {
  if (!text) return [];
  // Very simple inline parser: bold, italic, code, links
  const result = [];
  let remaining = text;
  while (remaining.length > 0) {
    // Bold **text** or __text__
    let m = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
    if (m) {
      if (m[1]) result.push({ type: "text", text: m[1] });
      if (m[2]) result.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
      remaining = m[3]; continue;
    }
    // Italic *text* or _text_
    m = remaining.match(/^(.*?)\*(.*?)\*(.*)/s);
    if (m) {
      if (m[1]) result.push({ type: "text", text: m[1] });
      if (m[2]) result.push({ type: "text", text: m[2], marks: [{ type: "italic" }] });
      remaining = m[3]; continue;
    }
    // Inline code `text`
    m = remaining.match(/^(.*?)`(.*?)`(.*)/s);
    if (m) {
      if (m[1]) result.push({ type: "text", text: m[1] });
      if (m[2]) result.push({ type: "text", text: m[2], marks: [{ type: "code" }] });
      remaining = m[3]; continue;
    }
    // Link [text](url)
    m = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
    if (m) {
      if (m[1]) result.push({ type: "text", text: m[1] });
      result.push({ type: "text", text: m[2], marks: [{ type: "link", attrs: { href: m[3] } }] });
      remaining = m[4]; continue;
    }
    result.push({ type: "text", text: remaining });
    break;
  }
  return result;
}

// ─── Editor → Markdown ─────────────────────────────────────────────────────
function editorToMarkdown(editor) {
  if (!editor) return "";
  const json = editor.getJSON();
  return nodesToMd(json.content || []);
}

function nodesToMd(nodes) { return nodes.map(nodeToMd).join("\n"); }

function nodeToMd(node) {
  switch (node.type) {
    case "paragraph":    return inlineToMd(node.content) + "\n";
    case "heading":      return "#".repeat(node.attrs?.level || 1) + " " + inlineToMd(node.content) + "\n";
    case "bulletList":   return (node.content || []).map(li => "- " + nodesToMd(li.content || []).trim()).join("\n") + "\n";
    case "orderedList":  return (node.content || []).map((li, i) => `${i + 1}. ` + nodesToMd(li.content || []).trim()).join("\n") + "\n";
    case "listItem":     return nodesToMd(node.content || []);
    case "blockquote":   return nodesToMd(node.content || []).split("\n").map(l => "> " + l).join("\n") + "\n";
    case "codeBlock":    return "```\n" + (node.content?.[0]?.text || "") + "\n```\n";
    case "horizontalRule": return "---\n";
    case "hardBreak":    return "  \n";
    default:             return inlineToMd(node.content) + "\n";
  }
}

function inlineToMd(nodes = []) {
  return (nodes || []).map(n => {
    if (n.type === "text") {
      let t = n.text || "";
      const marks = n.marks || [];
      if (marks.find(m => m.type === "bold"))   t = `**${t}**`;
      if (marks.find(m => m.type === "italic")) t = `*${t}*`;
      if (marks.find(m => m.type === "strike")) t = `~~${t}~~`;
      if (marks.find(m => m.type === "code"))   t = `\`${t}\``;
      const link = marks.find(m => m.type === "link");
      if (link) t = `[${t}](${link.attrs.href})`;
      return t;
    }
    if (n.type === "hardBreak") return "  \n";
    return "";
  }).join("");
}
