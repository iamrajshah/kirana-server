import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  getProductByIdSchema,
  updateProductStatusSchema,
  createVariantSchema,
} from './product.validation';

const router = Router();
const controller = new ProductController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /products
 * @desc    Get all products
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get('/', hasPermission('PRODUCT_VIEW'), controller.getAllProducts);

/**
 * @route   GET /products/:id
 * @desc    Get product by ID
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get(
  '/:id',
  hasPermission('PRODUCT_VIEW'),
  validate(getProductByIdSchema),
  controller.getProductById
);

/**
 * @route   POST /products
 * @desc    Create product
 * @access  PRODUCT_CREATE permission (OWNER, MANAGER)
 */
router.post(
  '/',
  hasPermission('PRODUCT_CREATE'),
  validate(createProductSchema),
  controller.createProduct
);

/**
 * @route   PATCH /products/:id
 * @desc    Update product
 * @access  PRODUCT_UPDATE permission (OWNER, MANAGER)
 */
router.patch(
  '/:id',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateProductSchema),
  controller.updateProduct
);

/**
 * @route   PATCH /products/:id/status
 * @desc    Update product status
 * @access  PRODUCT_UPDATE permission (OWNER, MANAGER)
 */
router.patch(
  '/:id/status',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateProductStatusSchema),
  controller.updateProductStatus
);

/**
 * @route   POST /products/:id/variants
 * @desc    Create variant for a product
 * @access  PRODUCT_CREATE permission (OWNER, MANAGER)
 */
router.post(
  '/:id/variants',
  hasPermission('PRODUCT_CREATE'),
  validate(createVariantSchema),
  controller.createVariant
);

export default router;
