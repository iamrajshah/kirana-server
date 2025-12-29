import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '@middlewares/validate.middleware';
import { registerOwnerSchema, loginSchema, refreshTokenSchema } from './auth.validation';

const router = Router();
const authController = new AuthController();

/**
 * @route   POST /auth/register-owner
 * @desc    Register owner - Creates tenant and owner user
 * @access  Public
 */
router.post('/register-owner', validate(registerOwnerSchema), authController.registerOwner);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @route   POST /auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

export default router;
