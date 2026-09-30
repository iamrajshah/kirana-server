import { prisma } from '../config/database';

beforeAll(async () => {
  // Setup test database connection
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup and disconnect
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear all data before each test (optional)
  // Uncomment if you want to clear data between tests
  /*
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  
  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
  */
});

// Mock JWT for testing
export const mockJWT = {
  userId: 'test-user-id',
  tenantId: 'test-tenant-id',
  email: 'test@example.com',
  role: 'ADMIN',
};

// Helper to create auth header
export const createAuthHeader = (token: string = 'mock-token'): Record<string, string> => {
  return {
    Authorization: `Bearer ${token}`,
  };
};
