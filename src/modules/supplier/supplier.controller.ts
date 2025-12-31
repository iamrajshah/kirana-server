import { Request, Response } from 'express';
import { SupplierService } from './supplier.service';
import { asyncHandler } from '@utils/asyncHandler';
import { AuthRequest } from '@middlewares/auth.middleware';

export class SupplierController {
  private readonly service: SupplierService;

  constructor() {
    this.service = new SupplierService();
  }

  /**
   * Create supplier
   * POST /suppliers
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const supplier = await this.service.createSupplier(
      tenantId,
      userId,
      req.body,
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier,
    });
  });

  /**
   * Get all suppliers
   * GET /suppliers
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);

    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await this.service.getSuppliers(tenantId, {
      page,
      limit,
      isActive,
    });

    res.status(200).json({
      success: true,
      data: result.suppliers,
      pagination: result.pagination,
    });
  });

  /**
   * Get supplier by ID
   * GET /suppliers/:id
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const supplierId = BigInt(req.params.id);

    const supplier = await this.service.getSupplierById(supplierId, tenantId);

    res.status(200).json({
      success: true,
      data: supplier,
    });
  });

  /**
   * Update supplier
   * PATCH /suppliers/:id
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.id);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const supplier = await this.service.updateSupplier(
      supplierId,
      tenantId,
      userId,
      req.body,
      ip,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
    });
  });

  /**
   * Add opening balance
   * POST /suppliers/:id/opening-balance
   */
  addOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.id);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const ledgerEntry = await this.service.addOpeningBalance(
      supplierId,
      tenantId,
      userId,
      req.body.amount,
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Opening balance added successfully',
      data: ledgerEntry,
    });
  });

  /**
   * Get supplier ledger
   * GET /suppliers/:id/ledger
   */
  getLedger = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const supplierId = BigInt(req.params.id);

    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');

    const result = await this.service.getSupplierLedger(supplierId, tenantId, {
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * Make payment to supplier
   * POST /suppliers/:id/payments
   */
  makePayment = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.id);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const payment = await this.service.makePayment(
      supplierId,
      tenantId,
      userId,
      req.body,
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  });
}
