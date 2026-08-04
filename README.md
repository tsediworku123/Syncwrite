# SyncWrite

A real-time collaborative document editor. Multiple users can write and edit documents simultaneously, with live cursors, presence awareness, version history, and comments.

## Tech Stack

**Frontend:** React 18, Vite, TipTap (ProseMirror), Yjs, Socket.IO Client, Vanilla CSS  
**Backend:** Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL, JWT (cookie-based auth)

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm

## Setup

### 1. Clone the repository

```
git clone https://github.com/tsediworku123/Syncwrite.git
cd syncwrite
```

### 2. Create the database

```sql
CREATE DATABASE syncwrite;
```

### 3. Configure the server

```
cd server
cp .env.example .env
```

Edit `server/.env`:

```
DATABASE_URL="Enter-your-URL"
JWT_SECRET="your-secret-key-here"
CLIENT_URL="http://localhost:5173"
PORT=4000
```

### 4. Install and migrate

```
cd server
npm install
npx prisma migrate dev
```

### 5. Install client dependencies

```
cd ../client
npm install
```

### 6. Run the application

Terminal 1 — Backend:
```
cd server
npm run dev
```

Terminal 2 — Frontend:
```
cd client
npm run dev
```

App runs at http://localhost:5173

---

## Project Structure

```
syncwrite/
├── client/
│   └── src/
│       ├── api/          # HTTP client, Socket.IO Yjs provider
│       ├── components/   # UI components (Toolbar, Comments, Presence, etc.)
│       ├── context/      # Auth, Theme, Toast, Notifications
│       ├── hooks/        # Custom hooks
│       ├── pages/        # Dashboard, Editor, Login, Register
│       └── styles/       # Global CSS with CSS variables
│
└── server/
    ├── prisma/
    │   └── schema.prisma # Database schema
    └── src/
        ├── controllers/  # Route logic
        ├── middleware/    # Auth + role guards
        ├── routes/       # Express routes
        └── sockets/      # Socket.IO collaboration logic
```

---

## Features

- Real-time collaborative editing via Yjs CRDTs
- Live cursor tracking with name labels
- Presence awareness and typing indicators
- Inline comments and threads
- Version history with restore
- Role-based access: Owner / Editor / Commenter / Viewer
- Document sharing by email
- Find and Replace (Ctrl+F)
- Markdown import and export
- PDF export via browser print
- Dark and light theme
- Paginated document dashboard
- Per-user notifications
