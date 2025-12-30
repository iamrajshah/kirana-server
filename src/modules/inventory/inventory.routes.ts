import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  getInventoryByVariantIdSchema,
  updateInventorySchema,
  adjustInventorySchema,
} from './inventory.validation';

const router = Router();
const inventoryController = new InventoryController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

// GET /inventory - Get all inventory (PRODUCT_VIEW permission)
router.get('/', hasPermission('PRODUCT_VIEW'), asyncHandler(inventoryController.getAllInventory));

// GET /inventory/low-stock - Get low stock inventory (PRODUCT_VIEW permission)
router.get('/low-stock', hasPermission('PRODUCT_VIEW'), asyncHandler(inventoryController.getLowStockInventory));

// GET /inventory/:variantId - Get inventory by variant ID (PRODUCT_VIEW permission)
router.get(
  '/:variantId',
  hasPermission('PRODUCT_VIEW'),
  validate(getInventoryByVariantIdSchema),
  asyncHandler(inventoryController.getInventoryByVariant)
);

// PATCH /inventory/:variantId - Update inventory (PRODUCT_UPDATE permission - OWNER/MANAGER only)
router.patch(
  '/:variantId',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateInventorySchema),
  asyncHandler(inventoryController.updateInventory)
);

// POST /inventory/:variantId/adjust - Adjust inventory (PRODUCT_UPDATE permission - OWNER/MANAGER only)
router.post(
  '/:variantId/adjust',
  hasPermission('PRODUCT_UPDATE'),
  validate(adjustInventorySchema),
  asyncHandler(inventoryController.adjustInventory)
);

export default router;
