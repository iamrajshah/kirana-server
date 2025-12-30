import bcrypt from 'bcryptjs';
import { config } from '@config/env';
import { UserRepository } from './user.repository';
import {
  CreateUserInput,
  UpdateUserStatusInput,
  UpdateOwnProfileInput,
  ChangeOwnPasswordInput,
} from './user.validation';
import { ConflictError, NotFoundError, ForbiddenError, UnauthorizedError } from '@utils/errors';
import { User } from '@prisma/client';

export interface UserResponse {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  roles: string[];
  created_at: Date | null;
}

export class UserService {
  private readonly repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  /**
   * Create a new user (MANAGER or CASHIER only)
   * Only OWNER can create users
   */
  async createUser(
    tenantId: string,
    data: CreateUserInput,
    creatorRoles: string[]
  ): Promise<UserResponse> {
    // Verify creator is OWNER
    if (!creatorRoles.includes('OWNER')) {
      throw new ForbiddenError('Only OWNER can create users');
    }

    // Note: Role escalation prevention is handled by validation schema
    // which only allows MANAGER or CASHIER roles

    const tenantIdBigInt = BigInt(tenantId);

    // Check if email already exists in this tenant
    if (data.email) {
      const emailExists = await this.repository.emailExistsInTenant(data.email, tenantIdBigInt);
      if (emailExists) {
        throw new ConflictError('Email already registered for this tenant');
      }
    }

    // Check if phone already exists in this tenant
    const phoneExists = await this.repository.phoneExistsInTenant(data.phone, tenantIdBigInt);
    if (phoneExists) {
      throw new ConflictError('Phone number already registered for this tenant');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.rounds);

    // Create user with role assignment
    const { user, role } = await this.repository.createUserWithRole(
      {
        tenant_id: tenantIdBigInt,
        name: data.name,
        phone: data.phone,
        email: data.email,
        password_hash: passwordHash,
      },
      data.role
    );

    return this.formatUserResponse(user, [role.name as string]);
  }

  /**
   * Get all users for a tenant
   */
  async getAllUsers(tenantId: string, includeInactive: boolean = false): Promise<UserResponse[]> {
    const tenantIdBigInt = BigInt(tenantId);
    const users = await this.repository.findAllByTenant(tenantIdBigInt, includeInactive);

    return users.map((user) => {
      const roles = user.user_roles.map((ur) => ur.roles.name as string);
      return this.formatUserResponse(user, roles);
    });
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(
    userId: string,
    tenantId: string,
    data: UpdateUserStatusInput,
    updaterUserId: string,
    updaterRoles: string[]
  ): Promise<UserResponse> {
    // Only OWNER can update user status
    if (!updaterRoles.includes('OWNER')) {
      throw new ForbiddenError('Only OWNER can update user status');
    }

    const userIdBigInt = BigInt(userId);
    const tenantIdBigInt = BigInt(tenantId);

    // Prevent self-deactivation
    if (userId === updaterUserId && !data.is_active) {
      throw new ForbiddenError('Cannot deactivate your own account');
    }

    // Find user with tenant check
    const existingUser = await this.repository.findByIdAndTenant(userIdBigInt, tenantIdBigInt);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Prevent changing OWNER status
    const userRoles = existingUser.user_roles.map((ur) => ur.roles.name);
    if (userRoles.includes('OWNER')) {
      throw new ForbiddenError('Cannot change OWNER user status');
    }

    // Update status
    const updatedUser = await this.repository.updateStatus(
      userIdBigInt,
      tenantIdBigInt,
      data.is_active
    );

    return this.formatUserResponse(updatedUser, userRoles as string[]);
  }

  /**
   * Update own profile
   */
  async updateOwnProfile(
    userId: string,
    tenantId: string,
    data: UpdateOwnProfileInput
  ): Promise<UserResponse> {
    const userIdBigInt = BigInt(userId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if user exists
    const existingUser = await this.repository.findByIdAndTenant(userIdBigInt, tenantIdBigInt);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check if email is being changed and already exists (excluding current user)
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.repository.emailExistsInTenantExcludingUser(
        data.email,
        tenantIdBigInt,
        userIdBigInt
      );
      if (emailExists) {
        throw new ConflictError('Email already registered for this tenant');
      }
    }

    // Check if phone is being changed and already exists (excluding current user)
    if (data.phone && data.phone !== existingUser.phone) {
      const phoneExists = await this.repository.phoneExistsInTenantExcludingUser(
        data.phone,
        tenantIdBigInt,
        userIdBigInt
      );
      if (phoneExists) {
        throw new ConflictError('Phone number already registered for this tenant');
      }
    }

    // Update profile
    const updatedUser = await this.repository.updateProfile(userIdBigInt, tenantIdBigInt, data);

    // Get roles
    const roles = existingUser.user_roles.map((ur) => ur.roles.name as string);

    return this.formatUserResponse(updatedUser, roles);
  }

  /**
   * Change own password
   */
  async changeOwnPassword(
    userId: string,
    tenantId: string,
    data: ChangeOwnPasswordInput
  ): Promise<{ message: string }> {
    const userIdBigInt = BigInt(userId);
    const tenantIdBigInt = BigInt(tenantId);

    // Get user with password hash
    const user = await this.repository.findById(userIdBigInt);
    if (!user || user.tenant_id !== tenantIdBigInt) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    if (!user.password_hash) {
      throw new UnauthorizedError('No password set for this user');
    }

    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(data.newPassword, user.password_hash);
    if (isSamePassword) {
      throw new ConflictError('New password must be different from current password');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(data.newPassword, config.bcrypt.rounds);

    // Update password
    await this.repository.updatePassword(userIdBigInt, tenantIdBigInt, newPasswordHash);

    return { message: 'Password changed successfully' };
  }

  /**
   * Format user response
   */
  private formatUserResponse(user: User, roles: string[]): UserResponse {
    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      is_active: user.is_active,
      roles,
      created_at: user.created_at,
    };
  }
}
