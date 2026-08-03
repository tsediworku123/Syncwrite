import { z } from "zod";
import { prisma } from "../config/prisma.js";

// dashboard data
export async function listDashboard(req, res) {
  const userId = req.user.id;
  const ownedPage = parseInt(req.query.ownedPage) || 1;
  const sharedPage = parseInt(req.query.sharedPage) || 1;
  const limit = 12;

  const ownedOffset = (ownedPage - 1) * limit;
  const sharedOffset = (sharedPage - 1) * limit;

  const [owned, sharedWith, recent, ownedCount, sharedCount] = await Promise.all([
    prisma.document.findMany({
      where: {ownerId: userId, deletedAt: null},
      include: {owner: {select: {name: true}}},
      orderBy: {updatedAt: "desc"},
      skip: ownedOffset,
      take: limit + 1,
    }),
    prisma.documentShare.findMany({
      where: {userId},
      include: {
        document: {include: {owner: {select: {name: true}}}},
      },
      orderBy: {document: {updatedAt: "desc"}},
      skip: sharedOffset,
      take: limit + 1,
    }),
    // recent is always the first page (top 10)
    prisma.recentDocument.findMany({
      where: {userId},
      include: {
        document: {include: {owner: {select: {name: true}}}},
      },
      orderBy: {openedAt: "desc"},
      take: 10,
    }),
    prisma.document.count({
      where: {ownerId: userId, deletedAt: null},
    }),
    prisma.documentShare.count({
      where: {userId, document: {deletedAt: null}},
    })
  ]);

  const hasMoreOwned = owned.length > limit;
  if (hasMoreOwned) owned.pop();

  const hasMoreShared = sharedWith.length > limit;
  if (hasMoreShared) sharedWith.pop();

  res.json({
    owned: owned.map(serializeDoc),
    hasMoreOwned,
    totalOwned: ownedCount,
    shared: sharedWith
      .filter(s => s.document && !s.document.deletedAt)
      .map(s => ({...serializeDoc(s.document), myRole: s.role})),
    hasMoreShared,
    totalShared: sharedCount,
    recent: recent
      .filter(r => r.document && !r.document.deletedAt)
      .map(r => serializeDoc(r.document)),
  });
}

// search docs by title
export async function searchDocuments(req, res) {
  const userId = req.user.id;
  const query = req.query.q?.trim();

  if(!query) {
    return res.json([]);
  }

  const [ownedDocs, sharedDocs] = await Promise.all([
    prisma.document.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        title: {contains: query, mode: "insensitive"},
      },
      include: {owner: {select: {name: true}}},
      orderBy: {updatedAt: "desc"},
      take: 20,
    }),
    prisma.documentShare.findMany({
      where: {
        userId,
        document: {
          deletedAt: null,
          title: {contains: query, mode: "insensitive"},
        },
      },
      include: {
        document: {include: {owner: {select: {name: true}}}},
      },
      orderBy: {document: {updatedAt: "desc"}},
      take: 20,
    }),
  ]);

  const results = [
    ...ownedDocs.map(doc => ({...serializeDoc(doc), myRole: "OWNER"})),
    ...sharedDocs.map(s => ({...serializeDoc(s.document), myRole: s.role})),
  ];

  res.json(results);
}

const createSchema = z.object({title: z.string().max(200).optional()});

export async function createDocument(req, res) {
  const parsed = createSchema.safeParse(req.body);
  const title = parsed.success && parsed.data.title ? parsed.data.title : "Untitled Document";

  const doc = await prisma.document.create({
    data: {title, ownerId: req.user.id},
  });
  res.status(201).json(serializeDoc(doc));
}

export async function getDocument(req, res) {
  const doc = await prisma.document.findUnique({where: {id: req.params.id}});
  if(!doc || doc.deletedAt) return res.status(404).json({error: "Document not found"});

  // track recently opened
  await prisma.recentDocument.upsert({
    where: {userId_documentId: {userId: req.user.id, documentId: doc.id}},
    update: {openedAt: new Date()},
    create: {userId: req.user.id, documentId: doc.id},
  });

  res.json({...serializeDoc(doc), myRole: req.docRole});
}

const renameSchema = z.object({title: z.string().min(1).max(200)});

export async function renameDocument(req, res) {
  const parsed = renameSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error: "Title is required"});

  const doc = await prisma.document.update({
    where: {id: req.params.id},
    data: {title: parsed.data.title},
  });
  res.json(serializeDoc(doc));
}

export async function deleteDocument(req, res) {
  // soft delete - owner only
  const doc = await prisma.document.findUnique({where: {id: req.params.id}});
  if(!doc || doc.ownerId !== req.user.id) {
    return res.status(403).json({error: "Only the owner can delete this document"});
  }
  await prisma.document.update({where: {id: doc.id}, data: {deletedAt: new Date()}});
  res.status(204).send();
}

export async function duplicateDocument(req, res) {
  const original = await prisma.document.findUnique({where: {id: req.params.id}});
  if(!original || original.deletedAt) return res.status(404).json({error: "Document not found"});

  const copy = await prisma.document.create({
    data: {
      title: `${original.title} (Copy)`,
      ownerId: req.user.id,
      ydocState: original.ydocState,
    },
  });
  res.status(201).json(serializeDoc(copy));
}

function serializeDoc(doc) {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    ownerName: doc.owner?.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
