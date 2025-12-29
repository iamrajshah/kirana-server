import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createUserSchema,
  updateUserStatusSchema,
  updateOwnProfileSchema,
  changeOwnPasswordSchema,
} from './user.validation';

const router = Router();
const controller = new UserController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   PATCH /users/me/profile
 * @desc    Update own profile (name, phone, email)
 * @access  All authenticated users
 */
router.patch('/me/profile', validate(updateOwnProfileSchema), controller.updateOwnProfile);

/**
 * @route   PATCH /users/me/password
 * @desc    Change own password
 * @access  All authenticated users
 */
router.patch('/me/password', validate(changeOwnPasswordSchema), controller.changeOwnPassword);

/**
 * @route   POST /users
 * @desc    Create a new user (MANAGER or CASHIER)
 * @access  USER_CREATE permission (OWNER only)
 */
router.post('/', hasPermission('USER_CREATE'), validate(createUserSchema), controller.create);

/**
 * @route   GET /users
 * @desc    Get all users for the tenant
 * @access  USER_VIEW permission (OWNER only)
 */
router.get('/', hasPermission('USER_VIEW'), controller.getAll);

/**
 * @route   PATCH /users/:id/status
 * @desc    Update user status (activate/deactivate)
 * @access  USER_UPDATE permission (OWNER only)
 */
router.patch(
  '/:id/status',
  hasPermission('USER_UPDATE'),
  validate(updateUserStatusSchema),
  controller.updateStatus
);

export default router;
