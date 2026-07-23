import { prisma } from '../../lib/prisma.js';
import { orderService } from '../order/order.service.js';

const BATCH_TRANSITIONS: Record<string, string> = {
  '集货中': '已发运',
  '已发运': '已到达',
  '已到达': '已完成',
};

export class BatchService {
  async advanceBatch(batchId: string): Promise<{ batchStatus: string; ordersAffected: number }> {
    const batch = await prisma.deliveryBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error('BATCH_NOT_FOUND');

    const nextStatus = BATCH_TRANSITIONS[batch.status];
    if (!nextStatus) throw new Error(`INVALID_BATCH_TRANSITION: ${batch.status} 无法继续推进`);

    await prisma.deliveryBatch.update({
      where: { id: batchId },
      data: { status: nextStatus },
    });

    let ordersAffected = 0;

    if (nextStatus === '已发运') {
      const orders = await prisma.order.findMany({
        where: { delivery_batch_id: batchId, status: '集货中' },
      });
      for (const order of orders) {
        try {
          await orderService.transitionStatus(order.id, '运输中');
          ordersAffected++;
        } catch (err: any) {
          console.error(`批次推进订单失败 ${order.order_no}: ${err.message}`);
        }
      }
    }

    if (nextStatus === '已到达') {
      const orders = await prisma.order.findMany({
        where: { delivery_batch_id: batchId, status: '运输中' },
      });
      for (const order of orders) {
        try {
          await orderService.transitionStatus(order.id, '待提货');
          ordersAffected++;
        } catch (err: any) {
          console.error(`批次推进订单失败 ${order.order_no}: ${err.message}`);
        }
      }
    }

    return { batchStatus: nextStatus, ordersAffected };
  }

  async processMatureBatches(): Promise<{ shipped: number; arrived: number }> {
    const now = new Date();
    let shipped = 0;
    let arrived = 0;

    const readyToShip = await prisma.deliveryBatch.findMany({
      where: { status: '集货中', ship_date: { lte: now } },
    });
    for (const batch of readyToShip) {
      try {
        await this.advanceBatch(batch.id);
        shipped++;
      } catch (err: any) {
        console.error(`批次发运失败 ${batch.batch_no}: ${err.message}`);
      }
    }

    const readyToArrive = await prisma.deliveryBatch.findMany({
      where: { status: '已发运', estimated_arrival: { lte: now } },
    });
    for (const batch of readyToArrive) {
      try {
        await this.advanceBatch(batch.id);
        arrived++;
      } catch (err: any) {
        console.error(`批次到达失败 ${batch.batch_no}: ${err.message}`);
      }
    }

    return { shipped, arrived };
  }
}

export const batchService = new BatchService();
