import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const categories = ['Vegetables', 'Fruits', 'Grains & Cereals', 'Dairy & Eggs', 'Livestock', 'Coffee & Spices', 'Honey', 'Other'];

async function main() {
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('Seeded categories');
}
main().finally(() => prisma.$disconnect());
