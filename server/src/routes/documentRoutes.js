import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireDocRole } from "../middleware/documentAccess.js";
import {
  listDashboard,
  searchDocuments,
  createDocument,
  getDocument,
  renameDocument,
  deleteDocument,
  duplicateDocument,
} from "../controllers/documentController.js";
import { listShares, upsertShare, removeShare } from "../controllers/shareController.js";
import { listVersions, restoreVersion } from "../controllers/versionController.js";
import {
  listComments,
  createComment,
  resolveComment,
  deleteComment,
} from "../controllers/commentController.js";

const router = Router();
router.use(requireAuth);

// Dashboard + creation
router.get("/", listDashboard);
router.get("/search", searchDocuments);
router.post("/", createDocument);

// Single document — viewers and above can open
router.get("/:id", requireDocRole("VIEWER"), getDocument);
router.patch("/:id", requireDocRole("EDITOR"), renameDocument);
router.delete("/:id", deleteDocument); // owner-only check happens inside controller
router.post("/:id/duplicate", requireDocRole("VIEWER"), duplicateDocument);

// Sharing — only editors/owner manage shares
router.get("/:id/shares", requireDocRole("EDITOR"), listShares);
router.post("/:id/shares", requireDocRole("EDITOR"), upsertShare);
router.delete("/:id/shares/:userId", requireDocRole("EDITOR"), removeShare);

// Version history — viewers can see history, editors can restore
router.get("/:id/versions", requireDocRole("VIEWER"), listVersions);
router.post("/:id/versions/:versionId/restore", requireDocRole("EDITOR"), restoreVersion);

// Comments — commenters and above can post, viewers can read
router.get("/:id/comments", requireDocRole("VIEWER"), listComments);
router.post("/:id/comments", requireDocRole("COMMENTER"), createComment);
router.patch("/:id/comments/:commentId/resolve", requireDocRole("COMMENTER"), resolveComment);
router.delete("/:id/comments/:commentId", requireDocRole("COMMENTER"), deleteComment);

export default router;
