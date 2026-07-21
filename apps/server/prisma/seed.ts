import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const deadline1 = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  const deadline2 = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
  const deadline3 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const shipDate1 = new Date(now.getTime() + 4 * 24 * 3600 * 1000);
  const shipDate2 = new Date(now.getTime() + 6 * 24 * 3600 * 1000);
  const arrival1 = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  const arrival2 = new Date(now.getTime() + 18 * 24 * 3600 * 1000);

  const batches = [
    {
      batch_no: 'B240701A',
      region: 'US',
      area: '洛杉矶',
      pickup_address: { city: 'Los Angeles', address: '123 Main St, Los Angeles, CA 90001' },
      pickup_contact_name: '张经理',
      pickup_contact_phone: '+1-213-555-0101',
      current_orders: 18,
      current_value: 3200,
      order_deadline: deadline1,
      ship_date: shipDate1,
      estimated_arrival: arrival1,
      status: '集货中',
    },
    {
      batch_no: 'B240701B',
      region: 'US',
      area: '纽约',
      pickup_address: { city: 'New York', address: '456 Broadway, New York, NY 10013' },
      pickup_contact_name: '李经理',
      pickup_contact_phone: '+1-212-555-0202',
      current_orders: 12,
      current_value: 2800,
      order_deadline: deadline2,
      ship_date: shipDate2,
      estimated_arrival: arrival2,
      status: '集货中',
    },
    {
      batch_no: 'B240701C',
      region: 'US',
      area: '旧金山',
      pickup_address: { city: 'San Francisco', address: '789 Market St, San Francisco, CA 94103' },
      pickup_contact_name: '王经理',
      pickup_contact_phone: '+1-415-555-0303',
      current_orders: 8,
      current_value: 1500,
      order_deadline: deadline3,
      ship_date: null,
      estimated_arrival: null,
      status: '集货中',
    },
  ];

  for (const b of batches) {
    await prisma.deliveryBatch.upsert({
      where: { batch_no: b.batch_no },
      update: b,
      create: b,
    });
  }

  console.log('Seeded 3 delivery batches');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
