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

/**
 * SUPPLIER & PURCHASE REPORTS
 */

/**
 * @route   GET /reports/supplier-outstanding
 * @desc    Get suppliers with outstanding balances (what we owe them)
 * @query   page (optional) - Page number, defaults to 1
 * @query   limit (optional) - Items per page, defaults to 50
 * @query   minAmount (optional) - Minimum outstanding amount filter
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/supplier-outstanding',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getSupplierOutstanding)
);

/**
 * @route   GET /reports/purchase-register
 * @desc    Get purchase register with filters (all purchases)
 * @query   page (optional) - Page number, defaults to 1
 * @query   limit (optional) - Items per page, defaults to 50
 * @query   from (optional) - Start date (YYYY-MM-DD)
 * @query   to (optional) - End date (YYYY-MM-DD)
 * @query   supplierId (optional) - Filter by supplier ID
 * @query   status (optional) - Filter by status: PAID, UNPAID, PARTIAL
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/purchase-register',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getPurchaseRegister)
);

/**
 * @route   GET /reports/supplier-ledger-summary
 * @desc    Get supplier ledger summary grouped by supplier
 * @query   page (optional) - Page number, defaults to 1
 * @query   limit (optional) - Items per page, defaults to 50
 * @query   from (optional) - Start date (YYYY-MM-DD)
 * @query   to (optional) - End date (YYYY-MM-DD)
 * @query   supplierId (optional) - Filter by supplier ID
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/supplier-ledger-summary',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getSupplierLedgerSummary)
);

/**
 * @route   GET /reports/top-payables
 * @desc    Get top suppliers we owe the most to
 * @query   limit (optional) - Number of suppliers to return, defaults to 10
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/top-payables',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getTopPayables)
);

/**
 * @route   GET /reports/purchase-trend
 * @desc    Get purchase trend by month for analysis
 * @query   months (optional) - Number of months to show, defaults to 12
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/purchase-trend',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getPurchaseTrend)
);

/**
 * @route   GET /reports/supplier/:supplierId/payment-history
 * @desc    Get detailed payment history for a specific supplier
 * @param   supplierId - Supplier ID
 * @query   page (optional) - Page number, defaults to 1
 * @query   limit (optional) - Items per page, defaults to 50
 * @query   from (optional) - Start date (YYYY-MM-DD)
 * @query   to (optional) - End date (YYYY-MM-DD)
 * @access  REPORT_VIEW permission (OWNER, MANAGER)
 */
router.get(
  '/supplier/:supplierId/payment-history',
  hasPermission('REPORT_VIEW'),
  asyncHandler(reportsController.getSupplierPaymentHistory)
);

export default router;
