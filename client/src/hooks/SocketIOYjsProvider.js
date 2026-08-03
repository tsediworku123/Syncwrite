import * as Y from "yjs";
import {Awareness, encodeAwarenessUpdate, applyAwarenessUpdate} from "y-protocols/awareness";
import {io} from "socket.io-client";

/**
 * Custom Yjs provider using our Socket.IO backend.
 *
 * KEY FIX: We connect to "/" (same origin) instead of "http://localhost:4000"
 * directly. The Vite dev server proxies /socket.io → :4000, which means the
 * auth cookie (scoped to localhost:5173) is included in every request, so the
 * server's JWT cookie auth actually works.
 */
export class SocketIOYjsProvider {
  constructor({documentId, ydoc, user}) {
    this.documentId = documentId;
    this.ydoc = ydoc;
    this.awareness = new Awareness(ydoc);
    // Connect to same origin — Vite proxy forwards to :4000.
    // Do NOT hard-code localhost:4000 here; that bypasses the cookie.
    this.socket = io("/", {
      withCredentials: true,
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    this.role = "VIEWER";
    this._listeners = {};
    this._presenceMap = new Map(); // userId → presence info (local cache)
    this._joined = false;

    this.awareness.setLocalStateField("user", {
      name: user.name,
      color: colorFor(user.id),
    });

    this.socket.on("connect", () => {
      console.log("[SyncWrite] Socket connected, joining document...");
      this.emit("status", {status: "connected"});
      this._doJoin();
    });

    if (this.socket.connected) {
      this._doJoin();
    }

    this.socket.on("disconnect", () => {
      this.emit("status", {status: "disconnected"});
    });

    // Handle reconnects — re-join and re-sync state
    this.socket.on("reconnect", () => {
      console.log("[SyncWrite] Socket reconnected, re-joining...");
      this._joined = false;
      this._doJoin();
    });

    // Receive a full Y.Doc state update from the server (on join or reconnect)
    this.socket.on("doc-state", ({state}) => {
      console.log("[SyncWrite] Received doc-state from server");
      Y.applyUpdate(this.ydoc, new Uint8Array(state), "remote");
    });

    // Receive incremental doc updates from other clients
    this.socket.on("doc-update", ({update}) => {
      Y.applyUpdate(this.ydoc, new Uint8Array(update), "remote");
    });

    // Send our own local edits to the server
    this.ydoc.on("update", (update, origin) => {
      if (origin === "remote") return; // don't echo server updates back
      this.socket.emit("doc-update", {documentId, update: Array.from(update)});
    });

    // Send our awareness updates to the server (for live cursors)
    this.awareness.on("update", ({added, updated, removed}, origin) => {
      if (origin === "remote") return;
      const changedClients = added.concat(updated, removed);
      const enc = encodeAwarenessUpdate(this.awareness, changedClients);
      this.socket.emit("awareness-update", {documentId, update: Array.from(enc)});
    });

    // Receive awareness updates from other clients
    this.socket.on("awareness-update", ({update}) => {
      applyAwarenessUpdate(this.awareness, new Uint8Array(update), "remote");
    });


    // Full presence list on initial join
    this.socket.on("presence-sync", (users) => {
      this._presenceMap.clear();
      users.forEach(u => this._presenceMap.set(u.id, u));
      this.emit("presence", Array.from(this._presenceMap.values()));
    });

    // A new user joined — add them to local presence, no need to re-join
    this.socket.on("presence-join", (user) => {
      this._presenceMap.set(user.id, user);
      this.emit("presence", Array.from(this._presenceMap.values()));
    });

    // A user left — remove from local presence
    this.socket.on("presence-leave", ({id}) => {
      this._presenceMap.delete(id);
      this.emit("presence", Array.from(this._presenceMap.values()));
    });

    // Remote cursor positions
    this.socket.on("cursor-update", ({userId, name, color, cursor}) => {
      this._remoteCursor?.(userId, name, color, cursor);
    });

    // Typing indicators
    this.socket.on("typing-start", ({userId, name, color}) => {
      this.emit("typing", {type: "start", userId, name, color});
    });
    this.socket.on("typing-stop", ({userId}) => {
      this.emit("typing", {type: "stop", userId});
    });

    this.socket.on("connect_error", (err) => {
      console.error("[SyncWrite] Socket connection error:", err.message);
    });
  }

  _doJoin() {
    this.socket.emit("join-document", {documentId: this.documentId}, (res) => {
      if (res?.error) {
        console.error("[SyncWrite] Join error:", res.error);
        return;
      }
      console.log("[SyncWrite] Joined document. Role:", res.role);
      // Apply full server state on join — this is the canonical source of truth
      if (res.state?.length > 0) {
        Y.applyUpdate(this.ydoc, new Uint8Array(res.state), "remote");
      }
      this.role = res.role;
      this._joined = true;
      this.emit("synced", this.role);
      this.emit("status", {status: "connected"});
    });
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(fn => fn !== cb);
  }

  emit(event, ...args) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => cb(...args));
  }

  onSynced(cb) {
    this.on("synced", cb);
  }

  onPresence(cb) {
    this.on("presence", cb);
  }

  onTyping(cb) {
    this.on("typing", cb);
  }

  onRemoteCursor(cb) {
    this._remoteCursor = cb;
  }

  sendCursor(cursor) {
    this.socket.emit("cursor-update", {documentId: this.documentId, cursor});
  }

  sendTypingStart() {
    this.socket.emit("typing-start", {documentId: this.documentId});
  }

  sendTypingStop() {
    this.socket.emit("typing-stop", {documentId: this.documentId});
  }

  _emit(evt, payload) {
    this._listeners[evt].forEach(cb => cb(payload));
  }

  destroy() {
    this.socket.disconnect();
    this.awareness.destroy();
  }
}

// Deterministic color assignment from user ID
function colorFor(userId) {
  const palette = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
