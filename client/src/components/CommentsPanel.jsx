import {useEffect, useRef, useState} from "react";
import {api} from "../api/client";
import {formatDistanceToNow} from "date-fns";

export default function CommentsPanel({documentId, canComment, onClose}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // {id, authorName}
  const [showResolved, setShowResolved] = useState(false);
  const textareaRef = useRef(null);

  const fetchComments = async () => {
    const res = await api.get(`/documents/${documentId}/comments`);
    setComments(res.data);
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line
  }, [documentId]);

  // When replying, focus the textarea
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const postComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api.post(`/documents/${documentId}/comments`, {
      body: text,
      parentId: replyTo?.id ?? undefined,
    });
    setText("");
    setReplyTo(null);
    fetchComments();
  };

  const resolveComment = async (id) => {
    await api.patch(`/documents/${documentId}/comments/${id}/resolve`);
    fetchComments();
  };

  const deleteComment = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    await api.delete(`/documents/${documentId}/comments/${id}`);
    fetchComments();
  };

  const startReply = (comment) => {
    setReplyTo({id: comment.id, authorName: comment.author.name});
  };

  // Build comment tree
  const topLevel = comments.filter(c => !c.parentId && (showResolved || !c.resolved));
  const repliesFor = (parentId) => comments.filter(c => c.parentId === parentId);

  const CommentItem = ({c, isReply = false}) => (
    <div className={`comment ${c.resolved ? "resolved" : ""} ${isReply ? "comment-reply" : ""}`}>
      <div className="comment-header">
        <div
          className="comment-avatar-sm"
          style={{background: avatarColor(c.author.name)}}
        >
          {c.author.name[0].toUpperCase()}
        </div>
        <div>
          <span className="comment-author">{c.author.name}</span>
          <span className="comment-time">
            {" · "}{formatDistanceToNow(new Date(c.createdAt))} ago
          </span>
        </div>
        {c.resolved && <span className="resolved-badge">Resolved</span>}
      </div>
      <div className="comment-body">{c.body}</div>
      <div className="comment-actions">
        {!isReply && canComment && !c.resolved && (
          <button onClick={() => startReply(c)}>Reply</button>
        )}
        {!c.resolved && canComment && (
          <button onClick={() => resolveComment(c.id)}>Resolve</button>
        )}
        <button className="danger-text" onClick={() => deleteComment(c.id)}>Delete</button>
      </div>

      {/* Nested replies */}
      {!isReply && repliesFor(c.id).map(reply => (
        <CommentItem key={reply.id} c={reply} isReply />
      ))}
    </div>
  );

  return (
    <aside className="side-panel">
      <div className="side-panel-header">
        <h3>Comments</h3>
        <div style={{display: "flex", gap: "0.5rem", alignItems: "center"}}>
          <label className="toggle-label" title="Show resolved comments">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
            />
            {" "}Resolved
          </label>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="comments-list">
        {topLevel.length === 0 && (
          <p className="muted" style={{textAlign: "center", paddingTop: "2rem"}}>
            {showResolved ? "No resolved comments." : "No comments yet. Be the first!"}
          </p>
        )}
        {topLevel.map(c => <CommentItem key={c.id} c={c} />)}
      </div>

      {canComment && (
        <form className="comment-form" onSubmit={postComment}>
          {replyTo && (
            <div className="reply-banner">
              Replying to <strong>{replyTo.authorName}</strong>
              <button
                type="button"
                className="icon-btn"
                style={{marginLeft: "auto"}}
                onClick={() => setReplyTo(null)}
              >✕</button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : "Add a comment…"}
            onKeyDown={e => {
              // Ctrl/Cmd+Enter to submit
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                postComment(e);
              }
            }}
          />
          <div style={{display: "flex", gap: "0.5rem"}}>
            <button type="submit" className="primary" style={{flex: 1}}>
              {replyTo ? "Post Reply" : "Post Comment"}
            </button>
            {replyTo && (
              <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
            )}
          </div>
        </form>
      )}
    </aside>
  );
}

// Simple color assignment for comment avatars
function avatarColor(name) {
  const palette = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
