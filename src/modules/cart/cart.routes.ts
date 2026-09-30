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

/**
 * @route   GET /cart
 * @desc    Get customer's cart
 * @access  Customer authenticated
 */
router.get('/', controller.getCart);

/**
 * @route   POST /cart/add
 * @desc    Add item to cart
 * @access  Customer authenticated
 */
router.post('/add', validate(addCartItemSchema), controller.addItem);

/**
 * @route   PUT /cart/update
 * @desc    Update cart item quantity
 * @access  Customer authenticated
 */
router.put('/update', validate(updateCartItemSchema), controller.updateItem);

/**
 * @route   DELETE /cart/remove/:itemId
 * @desc    Remove item from cart
 * @access  Customer authenticated
 */
router.delete('/remove/:itemId', validate(removeCartItemSchema), controller.removeItem);

/**
 * @route   DELETE /cart/clear
 * @desc    Clear entire cart
 * @access  Customer authenticated
 */
router.delete('/clear', controller.clearCart);

/**
 * @route   POST /cart/checkout
 * @desc    Checkout cart and create order
 * @access  Customer authenticated
 */
router.post('/checkout', controller.checkout);

export default router;
