import { Request, Response } from 'express';
import { ProductBarcodeService } from './product-barcode.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CreateProductFromBarcodeInput, ScanBarcodeParams, BarcodeLookupParams } from './product-barcode.validation';
import { logger } from '@utils/logger';

/**
 * Controller for barcode-based product operations
 */
export class ProductBarcodeController {
  private readonly service: ProductBarcodeService;

  constructor() {
    this.service = new ProductBarcodeService();
  }

  /**
   * Lookup barcode (local + external sources)
   * GET /api/products/barcode/:barcode/lookup
   */
  lookupBarcode = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const authReq = req as AuthRequest;
    const { barcode } = req.params as BarcodeLookupParams;
    const tenantId = Number(authReq.user!.tenantId);

    logger.info(`Barcode lookup request for ${barcode} by tenant ${tenantId}`);

    const result = await this.service.lookupBarcode(tenantId, barcode);

    return res.status(200).json({
      success: true,
      message: result.found
        ? `Product found (${result.source})`
        : 'Product not found',
      data: result,
    });
  });

  /**
   * Scan barcode and return product details if exists (local only)
   * GET /api/products/barcode/:barcode
   */
  scanBarcode = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { barcode } = req.params as ScanBarcodeParams;

    const result = await this.service.scanBarcode(tenantId, barcode);

    return res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * Create product using barcode
   * POST /api/products/barcode
   */
  createProductFromBarcode = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const data = req.body as CreateProductFromBarcodeInput;

    const result = await this.service.createProductFromBarcode(tenantId, data);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully with barcode',
      data: result,
    });
  });
}
