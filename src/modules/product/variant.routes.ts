import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import { updateVariantSchema } from './product.validation';

const router = Router();
const controller = new ProductController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   PATCH /variants/:id
 * @desc    Update variant
 * @access  PRODUCT_UPDATE permission (OWNER, MANAGER)
 */
router.patch(
  '/:id',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateVariantSchema),
  controller.updateVariant
);

export default router;
