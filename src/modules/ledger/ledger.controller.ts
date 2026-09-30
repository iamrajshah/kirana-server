import { Request, Response } from 'express';
import { LedgerService } from './ledger.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CreateLedgerInput, UpdateLedgerInput } from './ledger.validation';

export class LedgerController {
  private readonly ledgerService: LedgerService;

  constructor() {
    this.ledgerService = new LedgerService();
  }

  /**
   * Get all ledgers
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const type = req.query.type as string | undefined;

    let ledgers;
    if (type) {
      ledgers = await this.ledgerService.getByType(type, tenantId);
    } else {
      ledgers = await this.ledgerService.getAll(tenantId);
    }

    return res.json({
      success: true,
      data: ledgers,
    });
  });

  /**
   * Get ledger by ID
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    const ledger = await this.ledgerService.getByIdOrFail(id, tenantId);

    return res.json({
      success: true,
      data: ledger,
    });
  });

  /**
   * Create a new ledger
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const data = req.body as CreateLedgerInput;

    const ledger = await this.ledgerService.create(tenantId, data);

    return res.status(201).json({
      success: true,
      message: 'Ledger created successfully',
      data: ledger,
    });
  });

  /**
   * Update a ledger
   */
  update = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;
    const data = req.body as UpdateLedgerInput;

    const ledger = await this.ledgerService.update(id, tenantId, data);

    return res.json({
      success: true,
      message: 'Ledger updated successfully',
      data: ledger,
    });
  });

  /**
   * Delete a ledger
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    await this.ledgerService.delete(id, tenantId);

    return res.json({
      success: true,
      message: 'Ledger deleted successfully',
    });
  });

  /**
   * Get ledger entries
   */
  getEntries = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const entries = await this.ledgerService.getEntries(id, tenantId, {
      startDate,
      endDate,
    });

    return res.json({
      success: true,
      data: entries,
    });
  });

  /**
   * Get ledger balance
   */
  getBalance = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const balance = await this.ledgerService.getBalance(id, tenantId, {
      startDate,
      endDate,
    });

    return res.json({
      success: true,
      data: balance,
    });
  });
}
