import { Request, Response } from 'express';
import { CartService } from './cart.service';
import { asyncHandler } from '@utils/asyncHandler';
import { CustomerRequest } from '@middlewares/customer-auth.middleware';
import {
  AddCartItemInput,
  UpdateCartItemInput,
} from './cart.validation';

export class CartController {
  private readonly cartService: CartService;

  constructor() {
    this.cartService = new CartService();
  }

  /**
   * Get customer cart - GET /cart
   */
  getCart = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenant, customer } = req as unknown as CustomerRequest;
    const tenantId = tenant.id;
    const customerId = customer.id;

    const cart = await this.cartService.getOrCreateCart(tenantId, customerId);

    return res.status(200).json({
      success: true,
      data: cart,
    });
  });

  /**
   * Add item to cart - POST /cart/add
   */
  addItem = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const data = req.body as AddCartItemInput;

      const cart = await this.cartService.addItem(tenantId, customerId, data);

      return res.status(200).json({
        success: true,
        message: 'Item added to cart',
        data: cart,
      });
    }
  );

  /**
   * Update cart item - PUT /cart/update
   */
  updateItem = asyncHandler(
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const data = req.body as UpdateCartItemInput;
      const itemId = BigInt(data.item_id);

      const cart = await this.cartService.updateItem(tenantId, customerId, itemId, data);

      return res.status(200).json({
        success: true,
        message: 'Cart item updated',
        data: cart,
      });
    }
  );

  /**
   * Remove item from cart - DELETE /cart/remove/:itemId
   */
  removeItem = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant, customer } = req as unknown as CustomerRequest;
      const tenantId = tenant.id;
      const customerId = customer.id;
      const itemId = BigInt(req.params.itemId);

      const cart = await this.cartService.removeItem(tenantId, customerId, itemId);

      return res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        data: cart,
      });
    }
  );

  /**
   * Clear cart - DELETE /cart/clear
   */
  clearCart = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenant, customer } = req as unknown as CustomerRequest;
    const tenantId = tenant.id;
    const customerId = customer.id;

    await this.cartService.clearCart(tenantId, customerId);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
    });
  });
  /**
   * Checkout cart (create order) - POST /cart/checkout
   */
  checkout = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenant, customer } = req as unknown as CustomerRequest;
    const tenantId = tenant.id;
    const customerId = customer.id;

    const order = await this.cartService.checkout(tenantId, customerId);

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  });}
