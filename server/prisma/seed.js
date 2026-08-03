import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@syncwrite.dev" },
    update: {},
    create: { name: "Alice", email: "alice@syncwrite.dev", passwordHash: password, avatarColor: "#6366f1" },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@syncwrite.dev" },
    update: {},
    create: { name: "Bob", email: "bob@syncwrite.dev", passwordHash: password, avatarColor: "#ec4899" },
  });

  const doc = await prisma.document.upsert({
    where: { id: "seed-doc-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "seed-doc-0000-0000-0000-000000000000",
      title: "Welcome to SyncWrite",
      ownerId: alice.id,
    },
  });

  await prisma.documentShare.upsert({
    where: { documentId_userId: { documentId: doc.id, userId: bob.id } },
    update: {},
    create: { documentId: doc.id, userId: bob.id, role: "EDITOR" },
  });

  console.log("Seeded users: alice@syncwrite.dev / bob@syncwrite.dev (password: password123)");
  console.log(`Seeded shared document: ${doc.id}`);
}

main().finally(() => prisma.$disconnect());
