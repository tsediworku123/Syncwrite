import * as Y from "yjs";
import {verifyToken} from "../utils/auth.js";
import {prisma} from "../config/prisma.js";
import {getEffectiveRole, hasAtLeast} from "../middleware/documentAccess.js";

// In-memory Y.Doc instances for active documents.
// Each entry: { ydoc, saveTimer, lastSnapshotAt }
// TODO: migrate to Redis for multi-instance horizontal scaling
const rooms = new Map();

// Typing debounce: if we don't hear from a user for this long, auto-clear
const TYPING_TIMEOUT_MS = 3000;
const AUTOSAVE_DEBOUNCE_MS = 2000;
const VERSION_SNAPSHOT_INTERVAL_MS = Number(
  process.env.VERSION_SNAPSHOT_INTERVAL_MS || 60000
);

async function getOrCreateRoom(documentId) {
  if (rooms.has(documentId)) return rooms.get(documentId);

  const doc = await prisma.document.findUnique({where: {id: documentId}});
  const ydoc = new Y.Doc();

  if (doc?.ydocState && doc.ydocState.length > 0) {
    Y.applyUpdate(ydoc, doc.ydocState);
  }

  const room = {ydoc, saveTimer: null, lastSnapshotAt: 0, typingTimers: new Map()};
  rooms.set(documentId, room);
  return room;
}

async function persist(documentId, room) {
  const state = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
  await prisma.document.update({
    where: {id: documentId},
    data: {ydocState: state},
  });
  return state;
}

async function maybeSnapshotVersion(documentId, room, userId) {
  const now = Date.now();
  if (now - room.lastSnapshotAt < VERSION_SNAPSHOT_INTERVAL_MS) return;
  room.lastSnapshotAt = now;

  const state = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
  const text = extractPlainText(room.ydoc);
  await prisma.documentVersion.create({
    data: {
      documentId,
      createdById: userId,
      snapshot: state,
      plainTextPreview: text.slice(0, 500),
    },
  });
}

function scheduleAutosave(documentId, room, userId) {
  clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(async () => {
    await persist(documentId, room);
    await maybeSnapshotVersion(documentId, room, userId);
  }, AUTOSAVE_DEBOUNCE_MS);
}

export function registerCollaborationHandlers(io) {
  // Authenticate socket connections using JWT cookie
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const token = parseCookie(cookieHeader, "token");
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyToken(token);
      socket.user = {id: payload.sub, name: payload.name, email: payload.email};
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    let joinedDocId = null;

    socket.on("join-document", async ({documentId}, ack) => {
      const role = await getEffectiveRole(socket.user.id, documentId);
      if (!role) return ack?.({error: "forbidden"});

      // If already in a room, leave it first (handles reconnects cleanly)
      if (joinedDocId && joinedDocId !== documentId) {
        socket.leave(joinedDocId);
        // Check if user still has other sockets in the old room
        const stillInOldRoom = getRoomPresence(io, joinedDocId).some(u => u.id === socket.user.id);
        if (!stillInOldRoom) {
          socket.to(joinedDocId).emit("presence-leave", {id: socket.user.id});
        }
      }

      joinedDocId = documentId;
      socket.join(documentId);
      socket.docRole = role;

      const room = await getOrCreateRoom(documentId);
      // Send full state vector so client can sync
      const stateVector = Y.encodeStateAsUpdate(room.ydoc);

      // Acknowledge with state + role
      ack?.({state: Array.from(stateVector), role});

      // Tell the joining socket about all currently connected users
      const presenceList = getRoomPresence(io, documentId);
      socket.emit("presence-sync", presenceList);

      // Tell everyone else this user joined (with full user info)
      socket.to(documentId).emit("presence-join", {
        id: socket.user.id,
        name: socket.user.name,
        color: colorFor(socket.user.id),
      });

      console.log(`[SyncWrite] ${socket.user.name} joined document ${documentId} as ${role}`);
    });

    // Incremental document updates from clients
    socket.on("doc-update", async ({documentId, update}) => {
      if (documentId !== joinedDocId) return;
      if (!hasAtLeast(socket.docRole, "EDITOR")) return; // viewers/commenters can't edit

      const room = rooms.get(documentId);
      if (!room) return;

      const u8 = new Uint8Array(update);
      Y.applyUpdate(room.ydoc, u8, socket.id);

      // Broadcast to all OTHER clients in the room
      socket.to(documentId).emit("doc-update", {update});

      scheduleAutosave(documentId, room, socket.user.id);
    });

    // Relay awareness updates for live cursors
    socket.on("awareness-update", ({documentId, update}) => {
      if (documentId !== joinedDocId) return;
      socket.to(documentId).emit("awareness-update", {update});
    });

    // Live cursor position updates (ephemeral, not persisted)
    socket.on("cursor-update", ({documentId, cursor}) => {
      if (documentId !== joinedDocId) return;
      socket.to(documentId).emit("cursor-update", {
        userId: socket.user.id,
        name: socket.user.name,
        color: colorFor(socket.user.id),
        cursor,
      });
    });

    // Typing indicators (ephemeral)
    socket.on("typing-start", ({documentId}) => {
      if (documentId !== joinedDocId) return;

      const room = rooms.get(documentId);
      if (!room) return;

      // Broadcast typing status to others
      socket.to(documentId).emit("typing-start", {
        userId: socket.user.id,
        name: socket.user.name,
        color: colorFor(socket.user.id),
      });

      // Auto-clear typing after timeout (in case typing-stop is never sent)
      clearTimeout(room.typingTimers.get(socket.id));
      room.typingTimers.set(socket.id, setTimeout(() => {
        socket.to(documentId).emit("typing-stop", {userId: socket.user.id});
        room.typingTimers.delete(socket.id);
      }, TYPING_TIMEOUT_MS));
    });

    socket.on("typing-stop", ({documentId}) => {
      if (documentId !== joinedDocId) return;

      const room = rooms.get(documentId);
      if (room) {
        clearTimeout(room.typingTimers.get(socket.id));
        room.typingTimers.delete(socket.id);
      }

      socket.to(documentId).emit("typing-stop", {userId: socket.user.id});
    });

    socket.on("disconnect", async () => {
      if (!joinedDocId) return;

      // Clear any typing timer for this socket
      const room = rooms.get(joinedDocId);
      if (room) {
        clearTimeout(room.typingTimers.get(socket.id));
        room.typingTimers.delete(socket.id);
      }

      // Check if this user still has other active sockets in this room
      const stillPresentInRoom = getRoomPresence(io, joinedDocId).some(u => u.id === socket.user.id);
      if (!stillPresentInRoom) {
        socket.to(joinedDocId).emit("presence-leave", {id: socket.user.id});
        // Also clear typing for this user in other clients
        socket.to(joinedDocId).emit("typing-stop", {userId: socket.user.id});
      }

      const stillPresent = io.sockets.adapter.rooms.get(joinedDocId);
      if (room && (!stillPresent || stillPresent.size === 0)) {
        // Last user left — save immediately and clean up memory
        clearTimeout(room.saveTimer);
        await persist(joinedDocId, room);
        rooms.delete(joinedDocId);
        console.log(`[SyncWrite] Document ${joinedDocId} unloaded from memory (all users left)`);
      }
    });
  });
}

function getRoomPresence(io, documentId) {
  const socketIds = io.sockets.adapter.rooms.get(documentId) || new Set();
  const seenUsers = new Map(); // dedupe by user ID
  for (const id of socketIds) {
    const s = io.sockets.sockets.get(id);
    if (s?.user && !seenUsers.has(s.user.id)) {
      seenUsers.set(s.user.id, {
        id: s.user.id,
        name: s.user.name,
        color: colorFor(s.user.id),
      });
    }
  }
  return Array.from(seenUsers.values());
}

// Extract plain text from the Yjs document for version preview snippets
function extractPlainText(ydoc) {
  const fragment = ydoc.getXmlFragment("default");
  let out = "";
  fragment.forEach((node) => {
    out += walk(node);
  });
  return out.trim();

  function walk(node) {
    if (node.constructor.name === "YXmlText") return node.toString() + " ";
    let text = "";
    if (typeof node.toArray === "function") {
      node.toArray().forEach((child) => (text += walk(child)));
    }
    return text;
  }
}

// Deterministic color from user ID — must match client-side colorFor()
function colorFor(userId) {
  const palette = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function parseCookie(header, name) {
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
