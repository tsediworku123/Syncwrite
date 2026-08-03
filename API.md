# API Documentation

Base URL: `http://localhost:4000/api`

All endpoints require authentication via HttpOnly JWT cookie unless stated otherwise.
Authentication is established by calling `POST /auth/login` or `POST /auth/register`.

---

## Auth

### POST /auth/register
Create a new account.

**Body:**
```json
{ "name": "string", "email": "string", "password": "string" }
```

**Response:** `200` — sets auth cookie, returns user object.

---

### POST /auth/login
Log in to an existing account.

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Response:** `200` — sets auth cookie, returns user object.

---

### POST /auth/logout
End the current session.

**Response:** `200` — clears auth cookie.

---

### GET /auth/me
Get the currently authenticated user.

**Response:**
```json
{ "id": "uuid", "name": "string", "email": "string" }
```

---

## Documents

### GET /documents
Get the authenticated user's dashboard data (owned docs, shared docs, recently opened).

**Query params:**
- `ownedPage` (optional, default 1) — page number for owned documents (12 per page)
- `sharedPage` (optional, default 1) — page number for shared documents (12 per page)

**Response:**
```json
{
  "owned": [ { "id": "uuid", "title": "string", "updatedAt": "datetime", "owner": { "name": "string" } } ],
  "hasMoreOwned": true,
  "totalOwned": 45,
  "shared": [ { "id": "uuid", "title": "string", "myRole": "EDITOR" } ],
  "hasMoreShared": false,
  "totalShared": 3,
  "recent": [ { "id": "uuid", "title": "string" } ]
}
```

---

### GET /documents/search
Full-text search across all accessible documents.

**Query params:**
- `q` — search query string

**Response:** Array of matching document objects.

---

### POST /documents
Create a new document. The authenticated user becomes the owner.

**Response:** `201` — new document object.

---

### GET /documents/:id
Get metadata for a single document.

**Roles required:** VIEWER and above.

**Response:**
```json
{
  "id": "uuid",
  "title": "string",
  "ownerId": "uuid",
  "myRole": "OWNER | EDITOR | COMMENTER | VIEWER",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### PATCH /documents/:id
Rename a document.

**Roles required:** EDITOR and above.

**Body:**
```json
{ "title": "string" }
```

**Response:** Updated document object.

---

### DELETE /documents/:id
Soft-delete a document. Sets `deletedAt` timestamp.

**Roles required:** OWNER only.

**Response:** `204 No Content`.

---

### POST /documents/:id/duplicate
Create a copy of the document under the authenticated user.

**Roles required:** VIEWER and above (copy is owned by requester).

**Response:** `201` — new document object.

---

## Sharing

### GET /documents/:id/shares
List all users who have access to this document.

**Roles required:** EDITOR and above.

**Response:** Array of `{ userId, name, email, role }`.

---

### POST /documents/:id/shares
Grant or update access for a user.

**Roles required:** EDITOR and above.

**Body:**
```json
{ "email": "string", "role": "EDITOR | COMMENTER | VIEWER" }
```

**Response:** Share object.

---

### DELETE /documents/:id/shares/:userId
Remove a user's access to the document.

**Roles required:** EDITOR and above.

**Response:** `204 No Content`.

---

## Versions

### GET /documents/:id/versions
List all saved version snapshots for a document.

**Roles required:** VIEWER and above.

**Response:** Array of `{ id, plainTextPreview, createdAt, createdBy: { name } }`.

---

### POST /documents/:id/versions/:versionId/restore
Restore the document to a previous snapshot. Broadcasts the restored state to all connected clients.

**Roles required:** EDITOR and above.

**Response:** `200` with the restored version object.

---

## Comments

### GET /documents/:id/comments
Get all comments on a document including replies.

**Roles required:** VIEWER and above.

**Response:** Array of comment objects with nested `replies`.

---

### POST /documents/:id/comments
Add a comment to the document.

**Roles required:** COMMENTER and above.

**Body:**
```json
{
  "body": "string",
  "parentId": "uuid (optional — for replies)",
  "anchorFrom": "number (optional)",
  "anchorTo": "number (optional)"
}
```

**Response:** `201` — new comment object.

---

### PATCH /documents/:id/comments/:commentId/resolve
Toggle the resolved state of a comment.

**Roles required:** COMMENTER and above.

**Response:** Updated comment object.

---

### DELETE /documents/:id/comments/:commentId
Soft-delete a comment.

**Roles required:** COMMENTER and above. Authors can only delete their own comments.

**Response:** `204 No Content`.

---

## Real-Time (Socket.IO)

The real-time layer uses Socket.IO at the same origin. Connect with `withCredentials: true`.

### Events emitted by client

| Event             | Payload                                      | Description                              |
|-------------------|----------------------------------------------|------------------------------------------|
| `join-document`   | `{ documentId }`                             | Join a document room. Returns role + state. |
| `doc-update`      | `{ documentId, update: number[] }`           | Send a Yjs binary update                  |
| `awareness-update`| `{ documentId, update: number[] }`           | Send cursor/presence awareness update     |
| `typing-start`    | `{ documentId }`                             | Signal that this user started typing      |
| `typing-stop`     | `{ documentId }`                             | Signal that this user stopped typing      |

### Events received by client

| Event             | Payload                                      | Description                              |
|-------------------|----------------------------------------------|------------------------------------------|
| `doc-state`       | `{ state: number[] }`                        | Full document state on join              |
| `doc-update`      | `{ update: number[] }`                       | Incremental update from another user     |
| `awareness-update`| `{ update: number[] }`                       | Cursor/presence from another user        |
| `presence-sync`   | `[{ id, name, color }]`                      | Full presence list on join               |
| `presence-join`   | `{ id, name, color }`                        | Another user joined                      |
| `presence-leave`  | `{ id }`                                     | A user left                              |
| `typing-start`    | `{ userId, name, color }`                    | Another user started typing              |
| `typing-stop`     | `{ userId }`                                 | Another user stopped typing              |
