import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { addressService } from '../services/address/address.service.js';
import { createAddressSchema, updateAddressSchema } from '../services/address/address.schema.js';
import { authMiddleware } from './middleware/auth.js';

export async function addressRoutes(app: FastifyInstance) {
  // 所有地址路由需要认证
  app.addHook('onRequest', authMiddleware);

  // 列表
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const addresses = await addressService.list(userId);
    return { success: true, data: addresses };
  });

  // 详情
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (req as any).userId;
    try {
      const address = await addressService.getById(userId, req.params.id);
      return { success: true, data: address };
    } catch (err: any) {
      if (err.message === 'ADDRESS_NOT_FOUND') {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '地址不存在' } });
      }
      throw err;
    }
  });

  // 创建
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const body = createAddressSchema.parse(req.body);
    const address = await addressService.create(userId, body);
    return reply.code(201).send({ success: true, data: address });
  });

  // 更新
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const body = updateAddressSchema.parse(req.body);
    try {
      const address = await addressService.update(userId, req.params.id, body);
      return { success: true, data: address };
    } catch (err: any) {
      if (err.message === 'ADDRESS_NOT_FOUND') {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '地址不存在' } });
      }
      throw err;
    }
  });

  // 删除
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (req as any).userId;
    try {
      const result = await addressService.delete(userId, req.params.id);
      return { success: true, data: result };
    } catch (err: any) {
      if (err.message === 'ADDRESS_NOT_FOUND') {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '地址不存在' } });
      }
      throw err;
    }
  });

  // 设为默认
  app.patch('/:id/default', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (req as any).userId;
    try {
      const address = await addressService.setDefault(userId, req.params.id);
      return { success: true, data: address };
    } catch (err: any) {
      if (err.message === 'ADDRESS_NOT_FOUND') {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '地址不存在' } });
      }
      throw err;
    }
  });
}
