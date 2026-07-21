import { prisma } from '../../lib/prisma.js';
import { CreateAddressInput, UpdateAddressInput } from './address.schema.js';

export class AddressService {
  async list(userId: string) {
    return prisma.userAddress.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getById(userId: string, addressId: string) {
    const address = await prisma.userAddress.findFirst({
      where: { id: addressId, user_id: userId },
    });
    if (!address) throw new Error('ADDRESS_NOT_FOUND');
    return address;
  }

  async create(userId: string, input: CreateAddressInput) {
    const formatted = this.formatAddress(input);

    // 如果设为默认，先取消其他默认
    if (input.is_default) {
      await prisma.userAddress.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return prisma.userAddress.create({
      data: {
        ...input,
        user_id: userId,
        formatted,
        is_default: input.is_default ?? false,
      },
    });
  }

  async update(userId: string, addressId: string, input: UpdateAddressInput) {
    await this.getById(userId, addressId); // 确认归属

    if (input.is_default) {
      await prisma.userAddress.updateMany({
        where: { user_id: userId, is_default: true, id: { not: addressId } },
        data: { is_default: false },
      });
    }

    const formatted = input.street_address1
      ? this.formatAddress({
          country_code: input.country_code || 'US',
          admin_area1: input.admin_area1 || '',
          admin_area2: input.admin_area2,
          admin_area3: input.admin_area3,
          street_address1: input.street_address1,
          street_address2: input.street_address2,
          postal_code: input.postal_code,
          landmark: input.landmark,
        })
      : undefined;

    return prisma.userAddress.update({
      where: { id: addressId },
      data: {
        ...input,
        ...(formatted && { formatted }),
      },
    });
  }

  async delete(userId: string, addressId: string) {
    await this.getById(userId, addressId);
    await prisma.userAddress.delete({ where: { id: addressId } });
    return { deleted: true };
  }

  async setDefault(userId: string, addressId: string) {
    await this.getById(userId, addressId);

    await prisma.$transaction([
      prisma.userAddress.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      }),
      prisma.userAddress.update({
        where: { id: addressId },
        data: { is_default: true },
      }),
    ]);

    return prisma.userAddress.findUnique({ where: { id: addressId } });
  }

  private formatAddress(input: { country_code: string; admin_area1: string; admin_area2?: string | null; admin_area3?: string | null; street_address1: string; street_address2?: string | null; postal_code?: string | null; landmark?: string | null }): string {
    const parts = [
      input.street_address1,
      input.street_address2,
      input.admin_area3,
      input.admin_area2,
      input.admin_area1,
      input.postal_code,
    ].filter(Boolean);
    return parts.join(', ');
  }
}

export const addressService = new AddressService();
