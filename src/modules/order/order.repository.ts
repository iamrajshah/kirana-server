import { prisma } from '@config/database';
import { Decimal } from '@prisma/client/runtime/library';

interface PaginationParams {
  skip: number;
  take: number;
}

export class OrderRepository {
  protected readonly prisma;

  constructor() {
    this.prisma = prisma;
  }

  async findActiveCart(tenantId: bigint, customerId: bigint) {
    const cartResult = await this.prisma.$queryRaw<any[]>`
      SELECT c.id as cart_id
      FROM carts c
      WHERE c.tenant_id = ${tenantId}
        AND c.customer_id = ${customerId}
        AND c.status = 'ACTIVE'
      LIMIT 1
    `;

    return cartResult && cartResult.length > 0 ? cartResult[0] : null;
  }

  async getCartItems(cartId: bigint) {
    return this.prisma.$queryRaw<any[]>`
      SELECT 
        ci.variant_id,
        ci.quantity,
        ci.selling_price_snapshot,
        pv.product_id
      FROM cart_items ci
      INNER JOIN product_variants pv ON ci.variant_id = pv.id
      WHERE ci.cart_id = ${cartId}
    `;
  }

  async createOrder(tenantId: bigint, customerId: bigint, totalAmount: number) {
    await this.prisma.$executeRaw`
      INSERT INTO orders (tenant_id, customer_id, status, total_amount, source, created_at, updated_at)
      VALUES (${tenantId}, ${customerId}, 'PLACED', ${totalAmount}, 'CUSTOMER_APP', NOW(), NOW())
    `;

    const orderId = await this.prisma.$queryRaw<any[]>`SELECT LAST_INSERT_ID() as id`;
    return orderId[0].id;
  }

  async createOrderItem(
    orderId: bigint,
    productId: bigint,
    variantId: bigint,
    quantity: number,
    unitPrice: Decimal,
    totalPrice: number
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, total_price)
      VALUES (${orderId}, ${productId}, ${variantId}, ${quantity}, ${unitPrice}, ${totalPrice})
    `;
  }

  async createInvoice(tenantId: bigint, customerId: bigint, orderId: bigint, totalAmount: number) {
    await this.prisma.$executeRaw`
      INSERT INTO invoices (tenant_id, customer_id, order_id, status, subtotal_amount, total_amount, discount_amount, gst_amount, created_at)
      VALUES (${tenantId}, ${customerId}, ${orderId}, 'DRAFT', ${totalAmount}, ${totalAmount}, 0, 0, NOW())
    `;

    const invoiceResult = await this.prisma.$queryRaw<any[]>`SELECT LAST_INSERT_ID() as id`;
    return invoiceResult[0].id;
  }

  async generateInvoiceNumber(tenantId: bigint) {
    const invoiceNumberResult = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) + 1 as next_num
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND YEAR(created_at) = YEAR(NOW())
        AND MONTH(created_at) = MONTH(NOW())
    `;
    const nextNum = invoiceNumberResult[0].next_num;
    return `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextNum).padStart(4, '0')}`;
  }

  async updateInvoiceNumber(invoiceId: bigint, invoiceNumber: string) {
    await this.prisma.$executeRaw`
      UPDATE invoices
      SET invoice_number = ${invoiceNumber}
      WHERE id = ${invoiceId}
    `;
  }

  async createInvoiceItem(
    invoiceId: bigint,
    variantId: bigint,
    quantity: number,
    unitPrice: Decimal,
    finalPrice: number
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO invoice_items (invoice_id, variant_id, quantity, unit_price, price, discount_amount, final_price)
      VALUES (${invoiceId}, ${variantId}, ${quantity}, ${unitPrice}, ${unitPrice}, 0, ${finalPrice})
    `;
  }

  async clearCart(cartId: bigint) {
    await this.prisma.$executeRaw`
      DELETE FROM cart_items WHERE cart_id = ${cartId}
    `;

    await this.prisma.$executeRaw`
      UPDATE carts SET status = 'COMPLETED' WHERE id = ${cartId}
    `;
  }

  async findCustomerOrders(tenantId: bigint, customerId: bigint, params: PaginationParams) {
    const orders = await this.prisma.$queryRaw<any[]>`
      SELECT 
        o.id,
        o.status,
        o.total_amount,
        o.source,
        o.created_at,
        o.updated_at,
        i.invoice_number,
        i.status as invoice_status,
        i.paid_amount
      FROM orders o
      LEFT JOIN invoices i ON i.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.customer_id = ${customerId}
      ORDER BY o.created_at DESC
      LIMIT ${params.take}
      OFFSET ${params.skip}
    `;

    const totalResult = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND customer_id = ${customerId}
    `;

    return {
      orders,
      total: Number(totalResult[0].total),
    };
  }

  async findOrderById(tenantId: bigint, orderId: bigint, customerId?: bigint) {
    let query;
    if (customerId) {
      query = this.prisma.$queryRaw<any[]>`
        SELECT 
          o.id,
          o.status,
          o.total_amount,
          o.source,
          o.created_at,
          o.updated_at,
          i.id as invoice_id,
          i.invoice_number,
          i.status as invoice_status,
          i.paid_amount,
          i.finalized_at
        FROM orders o
        LEFT JOIN invoices i ON i.order_id = o.id
        WHERE o.id = ${orderId}
          AND o.tenant_id = ${tenantId}
          AND o.customer_id = ${customerId}
        LIMIT 1
      `;
    } else {
      query = this.prisma.$queryRaw<any[]>`
        SELECT 
          o.id,
          o.status,
          o.total_amount,
          o.source,
          o.created_at,
          o.updated_at,
          i.id as invoice_id,
          i.invoice_number,
          i.status as invoice_status,
          i.paid_amount,
          i.finalized_at
        FROM orders o
        LEFT JOIN invoices i ON i.order_id = o.id
        WHERE o.id = ${orderId}
          AND o.tenant_id = ${tenantId}
        LIMIT 1
      `;
    }

    const orderResult = await query;
    return orderResult && orderResult.length > 0 ? orderResult[0] : null;
  }

  async findOrderItems(orderId: bigint) {
    return this.prisma.$queryRaw<any[]>`
      SELECT 
        oi.id,
        oi.product_id,
        oi.variant_id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        p.name as product_name,
        p.image_url as product_image_url,
        pv.brand,
        pv.size,
        pv.packaging,
        pv.sku,
        pv.image_url as variant_image_url
      FROM order_items oi
      INNER JOIN product_variants pv ON oi.variant_id = pv.id
      INNER JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${orderId}
    `;
  }

  async updateOrderStatus(orderId: bigint, status: string) {
    await this.prisma.$executeRaw`
      UPDATE orders
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${orderId}
    `;
  }

  async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Replace this.prisma with tx temporarily
      const originalPrisma = this.prisma;
      (this as any).prisma = tx;
      try {
        return await callback();
      } finally {
        (this as any).prisma = originalPrisma;
      }
    });
  }
}
