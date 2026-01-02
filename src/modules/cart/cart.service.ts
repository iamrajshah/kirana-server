import { CartRepository, Cart } from './cart.repository';
import { AppError } from '@utils/errors';
import { AddCartItemInput, UpdateCartItemInput } from './cart.validation';
import { OrderService } from '@modules/order/order.service';

export class CartService {
  private readonly repository: CartRepository;

  constructor() {
    this.repository = new CartRepository();
  }

  async getOrCreateCart(tenantId: bigint, customerId: bigint): Promise<Cart> {
    let cart = await this.repository.findActiveCart(tenantId, customerId);

    if (!cart) {
      cart = await this.repository.createCart(tenantId, customerId);
    }

    return cart;
  }

  async addItem(tenantId: bigint, customerId: bigint, data: AddCartItemInput): Promise<Cart> {
    const cart = await this.getOrCreateCart(tenantId, customerId);

    const variantIdStr = String(data.variant_id);
    const variant = await this.repository.getVariantWithPrice(tenantId, variantIdStr);

    if (!variant) {
      throw new AppError('Product variant not found', 404);
    }

    if (!variant.selling_price) {
      throw new AppError('Product variant does not have a selling price', 400);
    }

    const existingItem = await this.repository.findCartItem(cart.id, variantIdStr);

    if (existingItem) {
      const newQuantity = Number(existingItem.quantity) + data.quantity;
      await this.repository.updateCartItemQuantity(existingItem.id, newQuantity);
    } else {
      await this.repository.addCartItem(cart.id, variantIdStr, data.quantity, variant.selling_price);
    }

    return this.getOrCreateCart(tenantId, customerId);
  }

  async updateItem(tenantId: bigint, customerId: bigint, itemId: bigint, data: UpdateCartItemInput): Promise<Cart> {
    const cart = await this.getOrCreateCart(tenantId, customerId);

    const itemIdStr = String(itemId);
    const item = await this.repository.findCartItemById(cart.id, BigInt(itemIdStr));

    if (!item) {
      throw new AppError('Cart item not found', 404);
    }

    await this.repository.updateCartItemQuantity(itemId, data.quantity);

    return this.getOrCreateCart(tenantId, customerId);
  }

  async removeItem(tenantId: bigint, customerId: bigint, itemId: bigint): Promise<Cart> {
    const cart = await this.getOrCreateCart(tenantId, customerId);

    const itemIdStr = String(itemId);
    const item = await this.repository.findCartItemById(cart.id, BigInt(itemIdStr));

    if (!item) {
      throw new AppError('Cart item not found', 404);
    }

    await this.repository.deleteCartItem(itemId);

    return this.getOrCreateCart(tenantId, customerId);
  }

  async clearCart(tenantId: bigint, customerId: bigint): Promise<void> {
    const cart = await this.getOrCreateCart(tenantId, customerId);
    await this.repository.clearCartItems(cart.id);
  }

  async checkout(tenantId: bigint, customerId: bigint): Promise<any> {
    const cart = await this.getOrCreateCart(tenantId, customerId);

    if (!cart.items || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    const orderService = new OrderService();
    const order = await orderService.createOrderFromCart(tenantId, customerId);

    // Clear cart after successful order creation
    await this.clearCart(tenantId, customerId);

    return order;
  }
}
