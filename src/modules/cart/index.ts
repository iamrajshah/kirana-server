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

router.get('/', controller.getCart);
router.post('/items', validate(addCartItemSchema), controller.addItem);
router.put('/items/:id', validate(updateCartItemSchema), controller.updateItem);
router.delete('/items/:id', validate(removeCartItemSchema), controller.removeItem);
router.delete('/', controller.clearCart);

export default router;
