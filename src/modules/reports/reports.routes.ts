import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import { salesReportSchema, dailyCashbookSchema, profitLossSchema } from './reports.validation';

const router = Router();
const reportsController = new ReportsController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /reports/sales
 * @desc    Get sales summary report with optional date range and grouping
 * @query   from (optional) - Start date (YYYY-MM-DD)
 * @query   to (optional) - End date (YYYY-MM-DD)
 * @query   groupBy (optional) - Group by: day, week, month
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/sales',
  hasPermission('REPORT_VIEW'),
  validate(salesReportSchema),
  asyncHandler(reportsController.getSalesReport)
);

/**
 * @route   GET /reports/outstanding-customers
 * @desc    Get customers with outstanding balances
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/outstanding-customers',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getOutstandingCustomers)
);

/**
 * @route   GET /reports/inventory-summary
 * @desc    Get inventory stock summary with low stock alerts
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/inventory-summary',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getInventorySummary)
);

/**
 * @route   GET /reports/daily-cashbook
 * @desc    Get daily cashbook - payment collections by mode
 * @query   date (optional) - Date in YYYY-MM-DD format, defaults to today
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/daily-cashbook',
  hasPermission('REPORT_VIEW'),
  validate(dailyCashbookSchema),
  asyncHandler(reportsController.getDailyCashbook)
);

/**
 * @route   GET /reports/profit-loss
 * @desc    Get profit & loss statement
 * @query   from (optional) - Start date (YYYY-MM-DD)
 * @query   to (optional) - End date (YYYY-MM-DD)
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/profit-loss',
  hasPermission('REPORT_VIEW'),
  validate(profitLossSchema),
  asyncHandler(reportsController.getProfitLoss)
);

/**
 * @route   GET /reports/top-selling
 * @desc    Get top selling products
 * @query   limit (optional) - Number of products to return, defaults to 10
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/top-selling',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getTopSellingProducts)
);

export default router;
