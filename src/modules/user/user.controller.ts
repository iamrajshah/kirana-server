import { Request, Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler } from '@utils/asyncHandler';
import { AuthRequest } from '@middlewares/auth.middleware';
import { TenantRequest } from '@middlewares/tenant.middleware';
import {
  CreateUserInput,
  UpdateUserStatusInput,
  UpdateOwnProfileInput,
  ChangeOwnPasswordInput,
} from './user.validation';

export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Create a new user - POST /users
   * Permission: USER_CREATE (OWNER only)
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data: CreateUserInput = req.body;

    const result = await this.userService.createUser(tenantId, data, user?.roles || []);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result,
    });
  });

  /**
   * Get all users - GET /users
   * Permission: USER_VIEW (OWNER only)
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const includeInactive = req.query.includeInactive === 'true';

    const users = await this.userService.getAllUsers(tenantId, includeInactive);

    return res.json({
      success: true,
      data: users,
    });
  });

  /**
   * Update user status - PATCH /users/:id/status
   * Permission: USER_UPDATE (OWNER only)
   */
  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data: UpdateUserStatusInput = req.body;

    const result = await this.userService.updateUserStatus(
      id,
      tenantId,
      data,
      user?.userId || '',
      user?.roles || []
    );

    return res.json({
      success: true,
      message: 'User status updated successfully',
      data: result,
    });
  });

  /**
   * Update own profile - PATCH /me/profile
   * Any authenticated user can update their own profile
   */
  updateOwnProfile = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data: UpdateOwnProfileInput = req.body;

    const result = await this.userService.updateOwnProfile(user?.userId || '', tenantId, data);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result,
    });
  });

  /**
   * Change own password - PATCH /me/password
   * Any authenticated user can change their own password
   */
  changeOwnPassword = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data: ChangeOwnPasswordInput = req.body;

    const result = await this.userService.changeOwnPassword(user?.userId || '', tenantId, data);

    return res.json({
      success: true,
      message: result.message,
    });
  });
}
