const RECEIVER_DISCOUNT_RATE = 0.80;

export class DiscountService {
  calculateShippingDiscount(
    originalShippingFee: number,
    willingToReceiveForOthers: boolean,
    userIsSelectedAsPickup: boolean,
  ): { discount: number; finalFee: number; discountRate: number } {
    if (!willingToReceiveForOthers || !userIsSelectedAsPickup) {
      return { discount: 0, finalFee: originalShippingFee, discountRate: 1.0 };
    }

    const discount = Math.round(originalShippingFee * (1 - RECEIVER_DISCOUNT_RATE) * 100) / 100;
    const finalFee = Math.round(originalShippingFee * RECEIVER_DISCOUNT_RATE * 100) / 100;

    return {
      discount,
      finalFee,
      discountRate: RECEIVER_DISCOUNT_RATE,
    };
  }

  calculateOrderTotal(params: {
    productPrice: number;
    shippingFee: number;
    willingToReceiveForOthers: boolean;
    userIsSelectedAsPickup: boolean;
  }): { productPrice: number; shippingFee: number; discount: number; totalAmount: number } {
    const { discount, finalFee } = this.calculateShippingDiscount(
      params.shippingFee,
      params.willingToReceiveForOthers,
      params.userIsSelectedAsPickup,
    );

    return {
      productPrice: params.productPrice,
      shippingFee: finalFee,
      discount,
      totalAmount: Math.round((params.productPrice + finalFee) * 100) / 100,
    };
  }
}

export const discountService = new DiscountService();
