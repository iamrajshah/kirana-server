import { Router } from 'express';
import { CategoryController } from './category.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoryByIdSchema,
  updateCategoryStatusSchema,
} from './category.validation';

const router = Router();
const controller = new CategoryController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /categories
 * @desc    Get all categories
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get('/', hasPermission('PRODUCT_VIEW'), controller.getAllCategories);

/**
 * @route   GET /categories/:id
 * @desc    Get category by ID
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get(
  '/:id',
  hasPermission('PRODUCT_VIEW'),
  validate(getCategoryByIdSchema),
  controller.getCategoryById
);

/**
 * @route   POST /categories
 * @desc    Create category
 * @access  PRODUCT_CREATE permission (OWNER, MANAGER)
 */
router.post(
  '/',
  hasPermission('PRODUCT_CREATE'),
  validate(createCategorySchema),
  controller.createCategory
);

/**
 * @route   PATCH /categories/:id
 * @desc    Update category
 * @access  PRODUCT_UPDATE permission (OWNER, MANAGER)
 */
router.patch(
  '/:id',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateCategorySchema),
  controller.updateCategory
);

/**
 * @route   PATCH /categories/:id/status
 * @desc    Update category status
 * @access  PRODUCT_UPDATE permission (OWNER, MANAGER)
 */
router.patch(
  '/:id/status',
  hasPermission('PRODUCT_UPDATE'),
  validate(updateCategoryStatusSchema),
  controller.updateCategoryStatus
);

export default router;
