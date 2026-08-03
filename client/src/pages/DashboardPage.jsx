import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatDistanceToNow } from "date-fns";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState({ owned: [], shared: [], recent: [], totalOwned: 0, totalShared: 0, hasMoreOwned: false, hasMoreShared: false });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [ownedPage, setOwnedPage] = useState(1);
  const [sharedPage, setSharedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 350);

  const fetchDocs = useCallback(async (reset = false, oPage = ownedPage, sPage = sharedPage) => {
    try {
      if (reset) {
        oPage = 1;
        sPage = 1;
      }
      const res = await api.get(`/documents?ownedPage=${oPage}&sharedPage=${sPage}`);
      setData(prev => {
        if (reset || (oPage === 1 && sPage === 1)) {
          return res.data;
        }
        return {
          ...res.data,
          owned: oPage > 1 ? [...prev.owned, ...res.data.owned] : res.data.owned,
          shared: sPage > 1 ? [...prev.shared, ...res.data.shared] : res.data.shared,
        };
      });
      if (reset) {
        setOwnedPage(1);
        setSharedPage(1);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      toast("Could not load documents", "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line
  }, [ownedPage, sharedPage]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    api.get(`/documents/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => setSearchResults(res.data))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery]);

  const handleCreate = async () => {
    try {
      const res = await api.post("/documents", {});
      navigate(`/documents/${res.data.id}`);
    } catch {
      toast("Could not create document", "error");
    }
  };

  const handleDupe = async (id, e) => {
    e.stopPropagation();
    try {
      await api.post(`/documents/${id}/duplicate`);
      fetchDocs(true);
      toast("Document duplicated!", "success");
    } catch {
      toast("Could not duplicate document", "error");
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocs(true);
      toast("Document deleted", "info");
    } catch {
      toast("Could not delete document", "error");
    }
  };

  const handleRename = async (id, currentTitle, e) => {
    e.stopPropagation();
    const newTitle = window.prompt("New title", currentTitle);
    if (!newTitle || newTitle === currentTitle) return;
    try {
      await api.patch(`/documents/${id}`, { title: newTitle });
      fetchDocs(true);
      toast("Renamed successfully!", "success");
    } catch {
      toast("Could not rename document", "error");
    }
  };

  const loadMoreOwned = () => {
    setLoadingMore(true);
    const nextPage = ownedPage + 1;
    setOwnedPage(nextPage);
    fetchDocs(false, nextPage, sharedPage);
  };

  const loadMoreShared = () => {
    setLoadingMore(true);
    const nextPage = sharedPage + 1;
    setSharedPage(nextPage);
    fetchDocs(false, ownedPage, nextPage);
  };

  if (loading) {
    return (
      <div className="center-screen">
        <div className="loading-spinner" />
        <p className="muted">Loading your workspace…</p>
      </div>
    );
  }

  const totalDocs = data.owned.length + data.shared.length;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--accent)" opacity="0.12" />
            <path d="M8 10h16M8 15h12M8 20h10" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div>
            <h1>SyncWrite</h1>
            <p className="muted">Welcome back, <strong>{user?.name}</strong></p>
          </div>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === "light" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>
          <button className="secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      {/* Search */}
      <div className="search-bar">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search documents…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search documents"
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery("")} aria-label="Clear search">✕</button>
        )}
      </div>

      <button className="primary create-btn" onClick={handleCreate} id="create-doc-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Document
      </button>

      {searchQuery ? (
        <section>
          <h2 className="section-heading">
            {searchLoading
              ? "Searching…"
              : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${debouncedQuery}"`}
          </h2>
          {searchResults.length > 0 ? (
            <div className="doc-grid">
              {searchResults.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  navigate={navigate}
                  onRename={handleRename}
                  onDupe={handleDupe}
                  onDelete={handleDelete}
                  showRole
                />
              ))}
            </div>
          ) : !searchLoading && (
            <EmptyState
              icon="search"
              title="No results found"
              message={`No documents match "${debouncedQuery}". Try a different keyword.`}
            />
          )}
        </section>
      ) : (
        <>
          {data.recent.length > 0 && (
            <section>
              <h2 className="section-heading">Recently opened</h2>
              <div className="doc-grid">
                {data.recent.map(doc => (
                  <DocCard key={doc.id} doc={doc} navigate={navigate}
                    onRename={handleRename} onDupe={handleDupe} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-heading">Your documents ({data.totalOwned})</h2>
            {data.owned.length > 0 ? (
              <>
                <div className="doc-grid">
                  {data.owned.map(doc => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      navigate={navigate}
                      onRename={handleRename}
                      onDupe={handleDupe}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
                {data.hasMoreOwned && (
                  <div className="load-more-wrap">
                    <button className="secondary" onClick={loadMoreOwned} disabled={loadingMore}>
                      {loadingMore ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon="doc"
                title="No documents yet"
                message="Create your first document to start collaborating in real-time."
                action={handleCreate}
                actionLabel="Create a document"
              />
            )}
          </section>

          {data.shared.length > 0 && (
            <section>
              <h2 className="section-heading">Shared with you ({data.totalShared})</h2>
              <div className="doc-grid">
                {data.shared.map(doc => (
                  <DocCard key={doc.id} doc={doc} navigate={navigate} showRole />
                ))}
              </div>
              {data.hasMoreShared && (
                <div className="load-more-wrap">
                  <button className="secondary" onClick={loadMoreShared} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </section>
          )}


        </>
      )}
    </div>
  );
}

// ─── DocCard ──────────────────────────────────────────────────────────────────
function DocCard({ doc, navigate, onRename, onDupe, onDelete, showRole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const canEdit = !!onRename;

  // Derive a colour per document based on id hash for the preview banner
  const hue = doc.id
    ? (doc.id.charCodeAt(0) + doc.id.charCodeAt(1) + doc.id.charCodeAt(2)) % 360
    : 30;

  return (
    <div
      className="doc-card"
      onClick={() => navigate(`/documents/${doc.id}`)}
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && navigate(`/documents/${doc.id}`)}
      role="button"
      aria-label={`Open ${doc.title || "Untitled Document"}`}
    >
      {/* Coloured preview banner */}
      <div
        className="doc-preview-banner"
        style={{ "--doc-hue": hue }}
        aria-hidden="true"
      >
        <div className="doc-preview-lines">
          <span /><span /><span /><span />
        </div>
      </div>

      {/* Card body */}
      <div className="doc-card-body">
        <div className="doc-card-title-row">
          <div className="doc-title">{doc.title || "Untitled Document"}</div>

          {/* ··· menu */}
          {canEdit && (
            <div className="doc-menu-wrap" ref={menuRef} onClick={e => e.stopPropagation()}>
              <button
                className="doc-menu-btn"
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                title="More options"
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="doc-menu-dropdown" role="menu">
                  <button role="menuitem" className="menu-item" onClick={e => { onRename(doc.id, doc.title, e); setMenuOpen(false); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Rename
                  </button>
                  <button role="menuitem" className="menu-item" onClick={e => { onDupe(doc.id, e); setMenuOpen(false); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Duplicate
                  </button>
                  <div className="menu-divider" />
                  <button role="menuitem" className="menu-item danger" onClick={e => { onDelete(doc.id, e); setMenuOpen(false); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="doc-meta">
          {doc.ownerName && <span className="doc-owner">{doc.ownerName}</span>}
          <span className="doc-time">Edited {formatDistanceToNow(new Date(doc.updatedAt))} ago</span>
          {showRole && doc.myRole && (
            <span className="badge">{doc.myRole}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, message, action, actionLabel }) {
  const illustrations = {
    doc: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <rect x="12" y="8" width="44" height="56" rx="6" fill="var(--accent-bg)" stroke="var(--border-color-dark)" strokeWidth="1.5"/>
        <rect x="20" y="20" width="28" height="3" rx="1.5" fill="var(--border-color-dark)"/>
        <rect x="20" y="27" width="22" height="3" rx="1.5" fill="var(--border-color-dark)"/>
        <rect x="20" y="34" width="26" height="3" rx="1.5" fill="var(--border-color-dark)"/>
        <rect x="20" y="41" width="18" height="3" rx="1.5" fill="var(--border-color-dark)"/>
        <circle cx="52" cy="52" r="12" fill="var(--accent)"/>
        <path d="M52 47v10M47 52h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    search: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="31" cy="31" r="20" fill="var(--accent-bg)" stroke="var(--border-color-dark)" strokeWidth="1.5"/>
        <circle cx="31" cy="31" r="12" fill="none" stroke="var(--border-color-dark)" strokeWidth="1.5"/>
        <line x1="46" y1="46" x2="58" y2="58" stroke="var(--border-color-dark)" strokeWidth="3" strokeLinecap="round"/>
        <path d="M26 28h10M26 33h7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="55" cy="55" r="1.5" fill="var(--text-muted)"/>
      </svg>
    ),
    workspace: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <rect x="6" y="16" width="60" height="40" rx="6" fill="var(--accent-bg)" stroke="var(--border-color-dark)" strokeWidth="1.5"/>
        <rect x="14" y="24" width="20" height="24" rx="3" fill="var(--bg-secondary)" stroke="var(--border-color-dark)" strokeWidth="1"/>
        <rect x="38" y="24" width="20" height="11" rx="3" fill="var(--bg-secondary)" stroke="var(--border-color-dark)" strokeWidth="1"/>
        <rect x="38" y="38" width="20" height="10" rx="3" fill="var(--bg-secondary)" stroke="var(--border-color-dark)" strokeWidth="1"/>
        <rect x="16" y="60" width="40" height="4" rx="2" fill="var(--border-color-dark)"/>
      </svg>
    ),
  };

  return (
    <div className="empty-state">
      <div className="empty-state-art">{illustrations[icon] ?? illustrations.doc}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-msg">{message}</p>
      {action && (
        <button className="primary" onClick={action} style={{ marginTop: "1.25rem" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
