// prisma/prisma.config.ts
import { PrismaClient } from '@prisma/client';

// Create a Prisma client with your MySQL connection URL
export const prisma = new PrismaClient({
  adapter: {
    type: 'mysql',
    url: process.env.DATABASE_URL, // Make sure .env has DATABASE_URL
  },
});
