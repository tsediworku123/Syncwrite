import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app (avoids exhausting
// DB connections during dev hot-reload).
export const prisma = new PrismaClient();
