import { Request, Response } from 'express';
import { CustomerService } from './customer.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CreateCustomerInput, UpdateCustomerInput, AddOpeningBalanceInput, UpdateCustomerStatusInput } from './customer.validation';

export class CustomerController {
  private readonly customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  /**
   * Get all customers
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await this.customerService.getAll(tenantId, page, limit, search, includeInactive);

    return res.json({
      success: true,
      data: result.customers,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  });

  /**
   * Get customer by ID
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    const customer = await this.customerService.getById(id, tenantId);

    return res.json({
      success: true,
      data: customer,
    });
  });

  /**
   * Create a new customer
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data = req.body as CreateCustomerInput;

    const customer = await this.customerService.create(tenantId, data, user!.userId);

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer,
    });
  });

  /**
   * Update a customer
   */
  update = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as UpdateCustomerInput;

    const customer = await this.customerService.update(id, tenantId, data, user?.userId);

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  });

  /**
   * Add opening balance to customer
   */
  addOpeningBalance = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as AddOpeningBalanceInput;

    const result = await this.customerService.addOpeningBalance(id, tenantId, data, user!.userId);

    return res.json({
      success: true,
      message: result.message,
      data: { balance: result.balance },
    });
  });

  /**
   * Update customer status
   */
  updateCustomerStatus = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const { is_active } = req.body as UpdateCustomerStatusInput;

    const customer = await this.customerService.updateCustomerStatus(id, tenantId, is_active, user?.userId);

    return res.json({
      success: true,
      message: 'Customer status updated successfully',
      data: customer,
    });
  });

  /**
   * Get customer ledger
   */
  getCustomerLedger = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await this.customerService.getCustomerLedger(id, tenantId, page, limit);

    return res.json({
      success: true,
      data: {
        ledger: result.ledger,
        summary: result.summary,
      },
      meta: {
        page: result.page,
        limit: result.limit,
      },
    });
  });
}
