import { Router } from 'express';
import { CartController } from './cart.controller';
import { validate } from '@middlewares/validate.middleware';
import { addCartItemSchema, updateCartItemSchema, removeCartItemSchema } from './cart.validation';
import { extractTenant } from '@middlewares/tenant.middleware';
import { customerAuth } from '@middlewares/customer-auth.middleware';

const router = Router();
const controller = new CartController();

// Apply middlewares
router.use(extractTenant);
router.use(customerAuth);

// Get cart
router.get('/', controller.getCart);

// Add item to cart
router.post('/add', validate(addCartItemSchema), controller.addItem);

// Update cart item
router.put('/update', validate(updateCartItemSchema), controller.updateItem);

// Remove item from cart
router.delete('/remove/:itemId', validate(removeCartItemSchema), controller.removeItem);

// Clear cart
router.delete('/clear', controller.clearCart);

// Checkout cart (create order)
router.post('/checkout', controller.checkout);

export default router;
