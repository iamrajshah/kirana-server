import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '@config/env';
import { AuthRepository } from './auth.repository';
import { RegisterOwnerInput, LoginInput } from './auth.validation';
import { ConflictError, UnauthorizedError, NotFoundError } from '@utils/errors';
import { User, Tenant, roles } from '@prisma/client';

export interface AuthResponse {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    roles: string[];
  };
  tenant: {
    id: string;
    name: string;
    status: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  isFirstLogin?: boolean;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string | null;
  roles: string[];
  permissions: string[];
}

export class AuthService {
  private readonly repository: AuthRepository;

  constructor() {
    this.repository = new AuthRepository();
  }

  /**
   * Register owner - Creates tenant and owner user
   */
  async registerOwner(data: RegisterOwnerInput): Promise<AuthResponse> {
    // Check if email already exists
    if (data.email) {
      const emailExists = await this.repository.emailExists(data.email);
      if (emailExists) {
        throw new ConflictError('Email already registered');
      }
    }

    // Check if phone already exists
    const phoneExists = await this.repository.phoneExists(data.phone);
    if (phoneExists) {
      throw new ConflictError('Phone number already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.rounds);

    // Create tenant and user
    const { tenant, user, role } = await this.repository.createTenantWithOwner(
      {
        name: data.shopName,
        owner_name: data.ownerName,
        phone: data.phone,
        email: data.email,
        gst_number: data.gstNumber,
      },
      {
        name: data.ownerName,
        phone: data.phone,
        email: data.email,
        password_hash: passwordHash,
      }
    );

    // Generate tokens
    const tokens = await this.generateTokens(user, tenant, [role]);

    return this.formatAuthResponse(user, tenant, [role], tokens,true);
  }

  /**
   * Login user
   */
  async login(data: LoginInput): Promise<AuthResponse> {
    // Find user by email or phone
    let user;
    if (data.email) {
      user = await this.repository.findUserByEmail(data.email);
    } else if (data.phone) {
      user = await this.repository.findUserByPhone(data.phone);
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Verify password
    if (!user.password_hash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Get tenant info
    const tenant = await this.getTenantById(user.tenant_id);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Check if tenant is active
    if (tenant.status !== 'ACTIVE') {
      throw new UnauthorizedError('Tenant account is suspended');
    }

    // Extract roles
    const roles = user.user_roles.map((ur) => ur.roles);

    // Generate tokens
    const tokens = await this.generateTokens(user, tenant, roles);

    return this.formatAuthResponse(user, tenant, roles, tokens);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JWTPayload;

      // Find user to ensure still active
      const user = await this.repository.findUserById(BigInt(decoded.userId));
      if (!user || !user.is_active) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Reload permissions from database in case they changed
      const roles = user.user_roles.map((ur) => ur.roles.name as string);
      const permissions = await this.repository.getPermissionsForRoles(roles);

      // Generate new access token with updated permissions
      const payload: JWTPayload = {
        ...decoded,
        roles,
        permissions,
      };
      const accessToken = this.generateAccessToken(payload);

      return { accessToken };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    tenant: Tenant,
    roles: roles[]
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const roleNames = roles.map((r) => r.name as string);
    
    // Load permissions from database for the user's roles
    const permissions = await this.repository.getPermissionsForRoles(roleNames);

    const payload: JWTPayload = {
      userId: user.id.toString(),
      tenantId: tenant.id.toString(),
      email: user.email,
      roles: roleNames,
      permissions,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token only
   */
  private generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Format auth response
   */
  private formatAuthResponse(
    user: User,
    tenant: Tenant,
    roles: roles[],
    tokens: { accessToken: string; refreshToken: string },
    isSignup: boolean = false
  ): AuthResponse {
    return {
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: roles.map((r) => r.name as string),
      },
      tenant: {
        id: tenant.id.toString(),
        name: tenant.name,
        status: tenant.status,
      },
      tokens,
      isFirstLogin: isSignup,
    };
  }

  /**
   * Get tenant by ID
   */
  private async getTenantById(tenantId: bigint): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }
}

// Import prisma at the end to avoid circular dependency
import { prisma } from '@config/database';
