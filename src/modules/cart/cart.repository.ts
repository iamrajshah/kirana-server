import { prisma } from '@config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface CartItem {
  id: bigint;
  cart_id: bigint;
  variant_id: bigint;
  quantity: number;
  selling_price_snapshot: Decimal;
  brand: string;
  size: string | null;
  packaging: string | null;
  sku: string;
  variant_image_url: string | null;
  product_name: string;
  product_image_url: string | null;
  stock_quantity: number;
}

export interface Cart {
  id: bigint;
  tenant_id: bigint;
  customer_id: bigint;
  status: string;
  created_at: Date;
  items: CartItem[];
  total_amount: number;
}

export class CartRepository {
  protected readonly prisma;

  constructor() {
    this.prisma = prisma;
  }

  async findActiveCart(tenantId: bigint, customerId: bigint): Promise<Cart | null> {
    const cart = await this.prisma.$queryRaw<any[]>`
      SELECT c.id, c.tenant_id, c.customer_id, c.status, c.created_at
      FROM carts c
      WHERE c.tenant_id = ${tenantId}
        AND c.customer_id = ${customerId}
        AND c.status = 'ACTIVE'
      LIMIT 1
    `;

    if (!cart || cart.length === 0) {
      return null;
    }

    const cartData = cart[0];

    // Get cart items
    const items = await this.prisma.$queryRaw<CartItem[]>`
      SELECT 
        ci.id,
        ci.cart_id,
        ci.variant_id,
        ci.quantity,
        ci.selling_price_snapshot,
        pv.brand,
        pv.size,
        pv.packaging,
        pv.sku,
        pv.image_url as variant_image_url,
        p.name as product_name,
        p.image_url as product_image_url,
        i.quantity as stock_quantity
      FROM cart_items ci
      INNER JOIN product_variants pv ON ci.variant_id = pv.id
      INNER JOIN products p ON pv.product_id = p.id
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE ci.cart_id = ${cartData.id}
    `;

    return {
      ...cartData,
      items,
      total_amount: items.reduce(
        (sum, item) => sum + Number(item.selling_price_snapshot) * Number(item.quantity),
        0
      ),
    };
  }

  async createCart(tenantId: bigint, customerId: bigint): Promise<Cart> {
    await this.prisma.$queryRaw`
      INSERT INTO carts (tenant_id, customer_id, status, created_at)
      VALUES (${tenantId}, ${customerId}, 'ACTIVE', NOW())
    `;

    const cart = await this.prisma.$queryRaw<any[]>`
      SELECT c.id, c.tenant_id, c.customer_id, c.status, c.created_at
      FROM carts c
      WHERE c.id = LAST_INSERT_ID()
    `;

    return {
      ...cart[0],
      items: [],
      total_amount: 0,
    };
  }

  async findCartItem(cartId: bigint, variantId: string): Promise<any | null> {
    const items = await this.prisma.$queryRaw<any[]>`
      SELECT id, quantity
      FROM cart_items
      WHERE cart_id = ${cartId} AND variant_id = ${variantId}
      LIMIT 1
    `;

    return items.length > 0 ? items[0] : null;
  }

  async addCartItem(cartId: bigint, variantId: string, quantity: number, priceSnapshot: Decimal): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO cart_items (cart_id, variant_id, quantity, selling_price_snapshot)
      VALUES (${cartId}, ${variantId}, ${quantity}, ${priceSnapshot})
    `;
  }

  async updateCartItemQuantity(itemId: bigint, quantity: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE cart_items
      SET quantity = ${quantity}
      WHERE id = ${itemId}
    `;
  }

  async findCartItemById(cartId: bigint, itemId: bigint): Promise<any | null> {
    const items = await this.prisma.$queryRaw<any[]>`
      SELECT id
      FROM cart_items
      WHERE id = ${itemId} AND cart_id = ${cartId}
      LIMIT 1
    `;

    return items.length > 0 ? items[0] : null;
  }

  async deleteCartItem(itemId: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM cart_items
      WHERE id = ${itemId}
    `;
  }

  async clearCartItems(cartId: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM cart_items
      WHERE cart_id = ${cartId}
    `;
  }

  async getVariantWithPrice(tenantId: bigint, variantId: string) {
    return this.prisma.product_variants.findFirst({
      where: {
        id: BigInt(variantId),
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        selling_price: true,
      },
    });
  }
}
