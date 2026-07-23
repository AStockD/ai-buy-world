import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensurePartitions() {
  const now = new Date();
  const partitions: { name: string; from: string; to: string }[] = [];

  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const from = d.toISOString().slice(0, 10);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
    const name = `messages_y${d.getFullYear()}m${String(d.getMonth() + 1).padStart(2, '0')}`;
    partitions.push({ name, from, to });
  }

  for (const p of partitions) {
    const checkSql = `SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = '${p.name}') as exists`;
    const checkResult = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(checkSql);

    if (!checkResult[0].exists) {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${p.name}" PARTITION OF "messages" FOR VALUES FROM ('${p.from}') TO ('${p.to}')`,
      );
      console.log(`✅ 创建分区: ${p.name} (${p.from} ~ ${p.to})`);
    } else {
      console.log(`⏭️ 分区已存在: ${p.name}`);
    }
  }
}

ensurePartitions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
