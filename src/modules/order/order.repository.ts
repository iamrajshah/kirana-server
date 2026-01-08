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

  async findActiveCart(tenantId: bigint, customerId: bigint, tx?: any) {
    const client = tx || this.prisma;
    const cartResult = await client.$queryRaw<any[]>`
      SELECT c.id as cart_id
      FROM carts c
      WHERE c.tenant_id = ${tenantId}
        AND c.customer_id = ${customerId}
        AND c.status = 'ACTIVE'
      LIMIT 1
    `;

    return cartResult && cartResult.length > 0 ? cartResult[0] : null;
  }

  async getCartItems(cartId: bigint, tx?: any) {
    const client = tx || this.prisma;
    return client.$queryRaw<any[]>`
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

  async createOrder(tenantId: bigint, customerId: bigint, totalAmount: number, tx?: any) {
    const client = tx || this.prisma;
    const order = await client.orders.create({
      data: {
        tenant_id: tenantId,
        customer_id: customerId,
        status: 'PLACED',
        total_amount: totalAmount,
        source: 'CUSTOMER_APP',
      },
    });
    return order.id;
  }

  async createOrderItem(
    orderId: bigint,
    productId: bigint,
    variantId: bigint,
    quantity: number,
    unitPrice: Decimal,
    totalPrice: number,
    tx?: any
  ) {
    const client = tx || this.prisma;
    await client.order_items.create({
      data: {
        order_id: orderId,
        product_id: productId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      },
    });
  }

  async createInvoice(tenantId: bigint, customerId: bigint, orderId: bigint, totalAmount: number, tx?: any) {
    const client = tx || this.prisma;
    const invoice = await client.invoice.create({
      data: {
        tenant_id: tenantId,
        customer_id: customerId,
        order_id: orderId,
        status: 'DRAFT',
        subtotal_amount: totalAmount,
        total_amount: totalAmount,
        discount_amount: 0,
        gst_amount: 0,
      },
    });
    return invoice.id;
  }

  async generateInvoiceNumber(tenantId: bigint, tx?: any) {
    const client = tx || this.prisma;
    const invoiceNumberResult = await client.$queryRaw<any[]>`
      SELECT COUNT(*) + 1 as next_num
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND YEAR(created_at) = YEAR(NOW())
        AND MONTH(created_at) = MONTH(NOW())
    `;
    const nextNum = invoiceNumberResult[0].next_num;
    return `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(nextNum).padStart(4, '0')}`;
  }

  async updateInvoiceNumber(invoiceId: bigint, invoiceNumber: string, tx?: any) {
    const client = tx || this.prisma;
    await client.invoice.update({
      where: { id: invoiceId },
      data: { invoice_number: invoiceNumber },
    });
  }

  async createInvoiceItem(
    invoiceId: bigint,
    variantId: bigint,
    quantity: number,
    unitPrice: Decimal,
    finalPrice: number,
    tx?: any
  ) {
    const client = tx || this.prisma;
    await client.invoiceItem.create({
      data: {
        invoice_id: invoiceId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice,
        price: unitPrice,
        discount_amount: 0,
        final_price: finalPrice,
      },
    });
  }

  async clearCart(cartId: bigint, tx?: any) {
    const client = tx || this.prisma;
    await client.cart_items.deleteMany({
      where: { cart_id: cartId },
    });
    await client.carts.update({
      where: { id: cartId },
      data: { status: 'CONVERTED' },
    });
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

  async updateInvoiceStatusByOrderId(orderId: bigint, status: string) {
    if (status === 'CANCELLED') {
      await this.prisma.$executeRaw`
        UPDATE invoices
        SET status = ${status}, 
            cancelled_at = NOW()
        WHERE order_id = ${orderId}
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE invoices
        SET status = ${status}
        WHERE order_id = ${orderId}
      `;
    }
  }

  async executeInTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return await callback(tx);
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }
}
