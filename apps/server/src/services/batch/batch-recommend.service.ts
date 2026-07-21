import { prisma } from '../../lib/prisma.js';

export interface BatchRecommendation {
  batchId: string;
  batchNo: string;
  area: string;
  pickupContactName: string;
  currentOrders: number;
  currentValue: number;
  shipDate: Date | null;
  estimatedArrival: Date | null;
  orderDeadline: Date;
  recommendLabel: string;
  score: number;
}

export class BatchRecommendService {
  async recommendForUser(userId: string, limit = 3): Promise<BatchRecommendation[]> {
    const batches = await prisma.deliveryBatch.findMany({
      where: {
        status: '集货中',
        order_deadline: { gt: new Date() },
      },
      orderBy: { current_orders: 'desc' },
      take: 20,
    });

    const scored = batches.map(batch => ({
      batch,
      score: this.calculateScore(batch),
      label: this.generateLabel(batch),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ batch, label, score }) => ({
        batchId: batch.id,
        batchNo: batch.batch_no,
        area: batch.area,
        pickupContactName: batch.pickup_contact_name,
        currentOrders: batch.current_orders,
        currentValue: Number(batch.current_value),
        shipDate: batch.ship_date,
        estimatedArrival: batch.estimated_arrival,
        orderDeadline: batch.order_deadline,
        recommendLabel: label,
        score,
      }));
  }

  private calculateScore(batch: any): number {
    let score = 0;
    score += batch.current_orders * 2;
    score += Math.min(Number(batch.current_value) / 100, 20);

    const hoursLeft = (batch.order_deadline.getTime() - Date.now()) / (1000 * 3600);
    if (hoursLeft < 24) score += 10;
    else if (hoursLeft < 48) score += 5;

    return score;
  }

  private generateLabel(batch: any): string {
    if (batch.current_orders >= 15) {
      return `与本周 ${batch.current_orders} 件订单同批次 · 运费最优`;
    }
    if (Number(batch.current_value) >= 2000) {
      return `本批次货值最高 $${Number(batch.current_value).toLocaleString()} · 优先配送`;
    }
    return `本周货量最大 ${batch.current_orders} 件 · 单件运费最低`;
  }
}

export const batchRecommendService = new BatchRecommendService();
