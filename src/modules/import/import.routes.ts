import { Router } from 'express';
import { ImportController } from './import.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createImportJobSchema,
  getImportJobSchema,
  commitImportJobSchema,
  getImportJobsSchema,
  exportDataSchema,
  exportFormatSchema,
} from './import.validation';
import multer from 'multer';
import path from 'path';

const router = Router();
const controller = new ImportController();

// Configure multer for file uploads - use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// All routes require authentication and IMPORT_DATA permission
router.use(authenticate);

/**
 * @route   POST /api/import/upload
 * @desc    Upload file and create import job
 * @access  OWNER, MANAGER (IMPORT_DATA permission)
 */
router.post(
  '/upload',
  hasPermission('IMPORT_DATA'),
  upload.single('file'),
  validate(createImportJobSchema),
  controller.uploadFile
);

/**
 * @route   GET /api/import
 * @desc    Get all import jobs
 * @access  OWNER, MANAGER (IMPORT_DATA permission)
 */
router.get('/', hasPermission('IMPORT_DATA'), validate(getImportJobsSchema), controller.getJobs);

/**
 * @route   GET /api/import/:jobId
 * @desc    Get import job details with row-level errors
 * @access  OWNER, MANAGER (IMPORT_DATA permission)
 */
router.get(
  '/:jobId',
  hasPermission('IMPORT_DATA'),
  validate(getImportJobSchema),
  controller.getJob
);

/**
 * @route   POST /api/import/:jobId/commit
 * @desc    Commit import job (import valid rows only)
 * @access  OWNER, MANAGER (IMPORT_DATA permission)
 */
router.post(
  '/:jobId/commit',
  hasPermission('IMPORT_DATA'),
  validate(commitImportJobSchema),
  controller.commitJob
);

/**
 * @route   POST /api/import/export
 * @desc    Export data to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 */
router.post(
  '/export',
  hasPermission('EXPORT_DATA'),
  validate(exportDataSchema),
  controller.exportData
);

/**
 * @route   GET /api/export/customers
 * @desc    Export customers to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 * @query   format - CSV or EXCEL (default: CSV)
 */
router.get(
  '/export/customers',
  hasPermission('EXPORT_DATA'),
  validate(exportFormatSchema),
  controller.exportCustomers
);

/**
 * @route   GET /api/export/products
 * @desc    Export products to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 * @query   format - CSV or EXCEL (default: CSV)
 */
router.get(
  '/export/products',
  hasPermission('EXPORT_DATA'),
  validate(exportFormatSchema),
  controller.exportProducts
);

/**
 * @route   GET /api/export/inventory
 * @desc    Export inventory to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 * @query   format - CSV or EXCEL (default: CSV)
 */
router.get(
  '/export/inventory',
  hasPermission('EXPORT_DATA'),
  validate(exportFormatSchema),
  controller.exportInventory
);

/**
 * @route   GET /api/export/invoices
 * @desc    Export invoices to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 * @query   format - CSV or EXCEL (default: CSV)
 */
router.get(
  '/export/invoices',
  hasPermission('EXPORT_DATA'),
  validate(exportFormatSchema),
  controller.exportInvoices
);

/**
 * @route   GET /api/export/ledger
 * @desc    Export customer ledger to CSV/Excel
 * @access  OWNER, MANAGER (EXPORT_DATA permission)
 * @query   format - CSV or EXCEL (default: CSV)
 */
router.get(
  '/export/ledger',
  hasPermission('EXPORT_DATA'),
  validate(exportFormatSchema),
  controller.exportLedger
);

export default router;
