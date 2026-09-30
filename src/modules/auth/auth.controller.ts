import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '@utils/asyncHandler';
import { RegisterOwnerInput, LoginInput, RefreshTokenInput } from './auth.validation';

export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register owner - POST /auth/register-owner
   */
  registerOwner = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const data: RegisterOwnerInput = req.body;

    const result = await this.authService.registerOwner(data);

    return res.status(201).json({
      success: true,
      message: 'Owner registered successfully',
      data: result,
    });
  });

  /**
   * Login - POST /auth/login
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const data: LoginInput = req.body;

    const result = await this.authService.login(data);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  /**
   * Refresh token - POST /auth/refresh-token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { refreshToken }: RefreshTokenInput = req.body;

    const result = await this.authService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  });
}
