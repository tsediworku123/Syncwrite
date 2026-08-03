import { useEffect, useRef, useState } from "react";

/**
 * Rich presence bar — stacked avatars, online dots, typing indicator.
 * Props:
 *   users        — [{ id, name, color }]
 *   typingUsers  — [{ userId, name, color }]
 *   saveStatus   — string shown at the right
 */
export default function PresenceBar({ users = [], typingUsers = [], saveStatus }) {
  const MAX_VISIBLE = 4;
  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  const typingNames = typingUsers.map(u => u.name);
  let typingText = "";
  if (typingNames.length === 1) typingText = `${typingNames[0]} is typing…`;
  else if (typingNames.length === 2) typingText = `${typingNames[0]} and ${typingNames[1]} are typing…`;
  else if (typingNames.length > 2) typingText = `${typingNames.length} people are typing…`;

  return (
    <div className="presence-bar">
      {/* Avatar stack */}
      <div className="avatars" role="list" aria-label="Active collaborators">
        {visible.map((u, i) => (
          <Avatar key={u.id} user={u} index={i} isTyping={typingUsers.some(t => t.userId === u.id)} />
        ))}
        {overflow > 0 && (
          <div
            className="avatar avatar-overflow"
            title={users.slice(MAX_VISIBLE).map(u => u.name).join(", ")}
            role="listitem"
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {typingText && (
        <span className="typing-indicator" aria-live="polite">
          <span className="typing-dots" aria-hidden="true">
            <span /><span /><span />
          </span>
          {typingText}
        </span>
      )}

      {/* Save status */}
      <span className={`save-status ${saveStatus?.includes("Saving") ? "saving" : saveStatus?.includes("✓") ? "saved" : ""}`}>
        {saveStatus === "Saved ✓" && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {saveStatus}
      </span>
    </div>
  );
}

function Avatar({ user, index, isTyping }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const ref = useRef(null);

  return (
    <div
      className={`avatar-wrap${isTyping ? " is-typing" : ""}`}
      style={{ zIndex: 10 - index }}
      ref={ref}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      role="listitem"
      aria-label={user.name}
    >
      <div
        className="avatar"
        style={{ background: user.color }}
      >
        {user.name?.[0]?.toUpperCase()}
        {isTyping && <span className="avatar-typing-ring" aria-hidden="true" />}
      </div>

      {tooltipVisible && (
        <div className="avatar-tooltip" role="tooltip">
          <span className="online-dot" aria-hidden="true" />
          <strong>{user.name}</strong>
          {isTyping && <em> · typing…</em>}
        </div>
      )}
    </div>
  );
}
