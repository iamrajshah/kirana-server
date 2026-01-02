import { OrderRepository } from './order.repository';
import { AppError } from '@utils/errors';

interface PaginationParams {
  skip: number;
  take: number;
}

export class OrderService {
  private readonly repository: OrderRepository;

  constructor() {
    this.repository = new OrderRepository();
  }

  async createOrderFromCart(tenantId: bigint, customerId: bigint) {
    const cart = await this.repository.findActiveCart(tenantId, customerId);

    if (!cart) {
      throw new AppError('No active cart found', 400);
    }

    const cartId = cart.cart_id;
    const cartItems = await this.repository.getCartItems(cartId);

    if (!cartItems || cartItems.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    const totalAmount = cartItems.reduce((sum, item) => {
      return sum + Number(item.selling_price_snapshot) * Number(item.quantity);
    }, 0);

    return await this.repository.executeInTransaction(async () => {
      const orderId = await this.repository.createOrder(tenantId, customerId, totalAmount);

      for (const item of cartItems) {
        const totalPrice = Number(item.selling_price_snapshot) * Number(item.quantity);
        await this.repository.createOrderItem(
          orderId,
          item.product_id,
          item.variant_id,
          item.quantity,
          item.selling_price_snapshot,
          totalPrice
        );
      }

      const invoiceId = await this.repository.createInvoice(tenantId, customerId, orderId, totalAmount);
      const invoiceNumber = await this.repository.generateInvoiceNumber(tenantId);
      await this.repository.updateInvoiceNumber(invoiceId, invoiceNumber);

      for (const item of cartItems) {
        const finalPrice = Number(item.selling_price_snapshot) * Number(item.quantity);
        await this.repository.createInvoiceItem(
          invoiceId,
          item.variant_id,
          item.quantity,
          item.selling_price_snapshot,
          finalPrice
        );
      }

      await this.repository.clearCart(cartId);

      return this.getOrderById(tenantId, customerId, orderId);
    });
  }

  async getCustomerOrders(tenantId: bigint, customerId: bigint, params: PaginationParams) {
    const { orders, total } = await this.repository.findCustomerOrders(tenantId, customerId, params);

    return {
      orders,
      pagination: {
        total,
        skip: params.skip,
        take: params.take,
      },
    };
  }

  async getOrderById(tenantId: bigint, customerId: bigint, orderId: bigint) {
    const order = await this.repository.findOrderById(tenantId, orderId, customerId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const items = await this.repository.findOrderItems(orderId);

    return {
      ...order,
      items,
    };
  }

  async updateOrderStatus(tenantId: bigint, orderId: bigint, status: string) {
    const validStatuses = ['PLACED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid order status', 400);
    }

    const order = await this.repository.findOrderById(tenantId, orderId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    await this.repository.updateOrderStatus(orderId, status);

    return this.getOrderById(tenantId, BigInt(0), orderId);
  }
}
