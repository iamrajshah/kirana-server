import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';

const router = Router();
const dashboardController = new DashboardController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /dashboard/stats
 * @desc    Get dashboard statistics (today's sales, pending invoices, low stock, total customers)
 * @access  All authenticated users
 */
router.get('/stats', asyncHandler(dashboardController.getStats));

export default router;
