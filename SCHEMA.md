# Database Schema

PostgreSQL database managed via Prisma ORM.

---

## Tables

### users

| Column       | Type      | Notes                        |
|--------------|-----------|------------------------------|
| id           | UUID      | Primary key                  |
| name         | String    |                              |
| email        | String    | Unique                       |
| passwordHash | String    | bcrypt hashed                |
| avatarColor  | String    | Default `#6366f1`            |
| createdAt    | DateTime  | Auto                         |

---

### documents

| Column    | Type      | Notes                                         |
|-----------|-----------|-----------------------------------------------|
| id        | UUID      | Primary key                                   |
| title     | String    | Default "Untitled Document"                   |
| ownerId   | UUID      | FK → users.id (cascade delete)                |
| ydocState | Bytes     | Binary Yjs CRDT snapshot — source of truth    |
| createdAt | DateTime  | Auto                                          |
| updatedAt | DateTime  | Auto-updated on every change                  |
| deletedAt | DateTime  | Nullable — soft delete                        |

Index on `ownerId`.

---

### document_shares

| Column     | Type     | Notes                                        |
|------------|----------|----------------------------------------------|
| id         | UUID     | Primary key                                  |
| documentId | UUID     | FK → documents.id (cascade delete)           |
| userId     | UUID     | FK → users.id (cascade delete)               |
| role       | Enum     | VIEWER \| COMMENTER \| EDITOR                |
| createdAt  | DateTime | Auto                                         |

Unique constraint on `(documentId, userId)`.

---

### document_versions

| Column           | Type     | Notes                                  |
|------------------|----------|----------------------------------------|
| id               | UUID     | Primary key                            |
| documentId       | UUID     | FK → documents.id (cascade delete)     |
| createdById      | UUID     | FK → users.id                          |
| snapshot         | Bytes    | Yjs binary snapshot at this point      |
| plainTextPreview | String   | Max 500 chars, for UI preview          |
| createdAt        | DateTime | Auto                                   |

Index on `(documentId, createdAt)`.

---

### comments

| Column     | Type     | Notes                                        |
|------------|----------|----------------------------------------------|
| id         | UUID     | Primary key                                  |
| documentId | UUID     | FK → documents.id (cascade delete)           |
| authorId   | UUID     | FK → users.id (cascade delete)               |
| parentId   | UUID     | Nullable — FK → comments.id (for replies)    |
| anchorFrom | Int      | Nullable — character offset for inline anchor|
| anchorTo   | Int      | Nullable — character offset end              |
| body       | String   |                                              |
| resolved   | Boolean  | Default false                                |
| createdAt  | DateTime | Auto                                         |
| deletedAt  | DateTime | Nullable — soft delete                       |

Index on `documentId`.

---

### recent_documents

| Column     | Type     | Notes                                    |
|------------|----------|------------------------------------------|
| id         | UUID     | Primary key                              |
| userId     | UUID     | FK → users.id (cascade delete)           |
| documentId | UUID     | FK → documents.id (cascade delete)       |
| openedAt   | DateTime | Updated on each open                     |

Unique constraint on `(userId, documentId)`.

---

## Enums

```
Role: VIEWER | COMMENTER | EDITOR
```

Owners are not in this enum — ownership is determined by `documents.ownerId`.
