import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.roles.createMany({
    data: [
      { name: 'OWNER' },
      { name: 'MANAGER' },
      { name: 'CASHIER' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Roles seeded');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
