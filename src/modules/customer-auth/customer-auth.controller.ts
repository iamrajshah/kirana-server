import { Request, Response } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { CustomerRequest } from '@middlewares/customer-auth.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CustomerRegisterInput, CustomerLoginInput } from './customer.validation';

export class CustomerAuthController {
  private readonly customerAuthService: CustomerAuthService;

  constructor() {
    this.customerAuthService = new CustomerAuthService();
  }

  /**
   * Register customer - POST /customer-auth/register
   */
  register = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const data = req.body as CustomerRegisterInput;

    const result = await this.customerAuthService.register(BigInt(tenantId), data);

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result,
    });
  });

  /**
   * Login customer - POST /customer-auth/login
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const data = req.body as CustomerLoginInput;

    const result = await this.customerAuthService.login(BigInt(tenantId), data);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  /**
   * Get customer profile - GET /customer-auth/me
   */
  getProfile = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const custReq = req as CustomerRequest;

    const customer = await this.customerAuthService.getProfile(BigInt(tenantId), custReq.customer.id);

    return res.status(200).json({
      success: true,
      data: customer,
    });
  });
}
