import { Request, Response } from 'express';
import { BankAccountService } from './bank-account.service';
import { asyncHandler } from '@utils/asyncHandler';
import { AuthRequest } from '@middlewares/auth.middleware';

export class BankAccountController {
  private readonly service: BankAccountService;

  constructor() {
    this.service = new BankAccountService();
  }

  /**
   * Create bank account
   * POST /suppliers/:supplierId/bank-accounts
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.supplierId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const bankAccount = await this.service.createBankAccount(
      tenantId,
      userId,
      supplierId,
      req.body,
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: bankAccount,
    });
  });

  /**
   * Get all bank accounts for a supplier
   * GET /suppliers/:supplierId/bank-accounts
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const supplierId = BigInt(req.params.supplierId);

    const bankAccounts = await this.service.getBankAccounts(tenantId, supplierId);

    res.status(200).json({
      success: true,
      data: bankAccounts,
    });
  });

  /**
   * Get bank account by ID
   * GET /suppliers/:supplierId/bank-accounts/:bankAccountId
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const supplierId = BigInt(req.params.supplierId);
    const bankAccountId = BigInt(req.params.bankAccountId);

    const bankAccount = await this.service.getBankAccountById(
      tenantId,
      supplierId,
      bankAccountId
    );

    res.status(200).json({
      success: true,
      data: bankAccount,
    });
  });

  /**
   * Update bank account
   * PUT /suppliers/:supplierId/bank-accounts/:bankAccountId
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.supplierId);
    const bankAccountId = BigInt(req.params.bankAccountId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const bankAccount = await this.service.updateBankAccount(
      tenantId,
      userId,
      supplierId,
      bankAccountId,
      req.body,
      ip,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Bank account updated successfully',
      data: bankAccount,
    });
  });

  /**
   * Delete bank account (soft delete)
   * DELETE /suppliers/:supplierId/bank-accounts/:bankAccountId
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.supplierId);
    const bankAccountId = BigInt(req.params.bankAccountId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    await this.service.deleteBankAccount(
      tenantId,
      userId,
      supplierId,
      bankAccountId,
      ip,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Bank account deleted successfully',
    });
  });

  /**
   * Set bank account as primary
   * POST /suppliers/:supplierId/bank-accounts/:bankAccountId/set-primary
   */
  setPrimary = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);
    const supplierId = BigInt(req.params.supplierId);
    const bankAccountId = BigInt(req.params.bankAccountId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const bankAccount = await this.service.setPrimaryBankAccount(
      tenantId,
      userId,
      supplierId,
      bankAccountId,
      ip,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Bank account set as primary successfully',
      data: bankAccount,
    });
  });
}
