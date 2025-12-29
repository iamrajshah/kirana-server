import { Request, Response } from 'express';
import { CustomerService } from './customer.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.validation';

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
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const result = await this.customerService.getPaginated(tenantId, page, limit, search);

    return res.json({
      success: true,
      data: result.customers,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit,
      },
    });
  });

  /**
   * Get customer by ID
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    const customer = await this.customerService.getByIdOrFail(id, tenantId);

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
    const data = req.body as CreateCustomerInput;

    const customer = await this.customerService.create(tenantId, data);

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
    const { id } = req.params;
    const data = req.body as UpdateCustomerInput;

    const customer = await this.customerService.update(id, tenantId, data);

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  });

  /**
   * Delete a customer
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    await this.customerService.delete(id, tenantId);

    return res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  });

  /**
   * Search customers
   */
  search = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const customers = await this.customerService.search(query, tenantId, { take: limit });

    return res.json({
      success: true,
      data: customers,
    });
  });
}
