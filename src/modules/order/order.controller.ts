import { Request, Response } from 'express';
import { OrderService } from './order.service';
import { asyncHandler } from '@utils/asyncHandler';
import { CustomerRequest } from '@middlewares/customer-auth.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';

export class OrderController {
  private readonly orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  /**
   * Create order from cart - POST /orders
   */
  createOrder = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenant, customer } = req as unknown as CustomerRequest;
    const tenantId = tenant.id;
    const customerId = customer.id;

    const order = await this.orderService.createOrderFromCart(tenantId, customerId);

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  });

  /**
   * Get customer orders - GET /orders
   */
  getOrders = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const { skip = 0, take = 20 } = req.query;

      const orders = await this.orderService.getCustomerOrders(tenantId, customerId, {
        skip: Number(skip),
        take: Number(take),
      });

      return res.status(200).json({
        success: true,
        data: orders,
      });
    }
  );

  /**
   * Get order details - GET /orders/:id
   */
  getOrderById = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const orderId = BigInt(req.params.id);

      const order = await this.orderService.getOrderById(tenantId, customerId, orderId);

      return res.status(200).json({
        success: true,
        data: order,
      });
    }
  );

  /**
   * Update order status (POS only) - PATCH /orders/:id/status
   */
  updateOrderStatus = asyncHandler(
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {
      const authReq = req as unknown as AuthRequest;
      if (!authReq.user) {
        throw new Error('User not authenticated');
      }
      const tenantId = BigInt(authReq.user.tenantId);
      const orderId = BigInt(req.params.id);
      const { status } = req.body;

      const order = await this.orderService.updateOrderStatus(tenantId, orderId, status);

      return res.status(200).json({
        success: true,
        message: 'Order status updated',
        data: order,
      });
    }
  );

  /**
   * Cancel order - POST /orders/:id/cancel
   */
  cancelOrder = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const orderId = BigInt(req.params.id);

      const order = await this.orderService.cancelOrder(tenantId, customerId, orderId);

      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: order,
      });
    }
  );

  /**
   * Get order status - GET /orders/:id/status
   */
  getOrderStatus = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const orderId = BigInt(req.params.id);

      const status = await this.orderService.getOrderStatus(tenantId, customerId, orderId);

      return res.status(200).json({
        success: true,
        data: status,
      });
    }
  );
}
