import { Request, Response } from 'express';
import { PurchaseService } from './purchase.service';
import { asyncHandler } from '@utils/asyncHandler';
import { AuthRequest } from '@middlewares/auth.middleware';

export class PurchaseController {
  private readonly service: PurchaseService;

  constructor() {
    this.service = new PurchaseService();
  }

  /**
   * Create purchase invoice
   * POST /purchases
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const purchase = await this.service.createPurchase(tenantId, userId, req.body, ip, userAgent);

    res.status(201).json({
      success: true,
      message: 'Purchase invoice created successfully',
      data: purchase,
    });
  });

  /**
   * Get all purchases
   * GET /purchases
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);

    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');
    const supplierId = req.query.supplier_id ? BigInt(req.query.supplier_id as string) : undefined;
    const status = req.query.status as 'PAID' | 'UNPAID' | 'PARTIAL' | undefined;

    const result = await this.service.getPurchases(tenantId, {
      page,
      limit,
      supplierId,
      status,
    });

    res.status(200).json({
      success: true,
      data: result.purchases,
      pagination: result.pagination,
    });
  });

  /**
   * Get purchase by ID
   * GET /purchases/:id
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const purchaseId = BigInt(req.params.id);

    const purchase = await this.service.getPurchaseById(purchaseId, tenantId);

    res.status(200).json({
      success: true,
      data: purchase,
    });
  });
}
