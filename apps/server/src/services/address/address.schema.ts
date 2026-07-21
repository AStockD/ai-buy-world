import { z } from 'zod';

export const createAddressSchema = z.object({
  recipient_name: z.string().min(1, '请输入收件人姓名').max(100),
  phone: z.string().min(5, '请输入有效电话号码').max(20),
  country_code: z.string().length(2, '国家代码为2位'),
  postal_code: z.string().max(20).optional(),
  admin_area1: z.string().min(1, '请输入省/州').max(100),
  admin_area2: z.string().max(100).optional(),
  admin_area3: z.string().max(100).optional(),
  street_address1: z.string().min(1, '请输入街道地址').max(255),
  street_address2: z.string().max(255).optional(),
  landmark: z.string().max(255).optional(),
  label: z.string().max(50).optional(),
  is_default: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
