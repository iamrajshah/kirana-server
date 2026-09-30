import { Router } from 'express';
import { ProductBarcodeController } from './product-barcode.controller';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  scanBarcodeSchema,
  createProductFromBarcodeSchema,
  barcodeLookupSchema,
} from './product-barcode.validation';

const router = Router();
const controller = new ProductBarcodeController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * @route   GET /products/barcode/:barcode/lookup
 * @desc    Lookup product by barcode (local + external sources like Open Food Facts)
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get(
  '/:barcode/lookup',
  hasPermission('PRODUCT_VIEW'),
  validate(barcodeLookupSchema),
  controller.lookupBarcode
);

/**
 * @route   GET /products/barcode/:barcode
 * @desc    Scan barcode and check if product exists in local database
 * @access  PRODUCT_VIEW permission (OWNER, MANAGER, CASHIER)
 */
router.get(
  '/:barcode',
  hasPermission('PRODUCT_VIEW'),
  validate(scanBarcodeSchema),
  controller.scanBarcode
);

/**
 * @route   POST /products/barcode
 * @desc    Create product using barcode
 * @access  PRODUCT_CREATE permission (OWNER, MANAGER)
 */
router.post(
  '/',
  hasPermission('PRODUCT_CREATE'),
  validate(createProductFromBarcodeSchema),
  controller.createProductFromBarcode
);

export default router;
