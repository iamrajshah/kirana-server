import { prisma } from '@config/database';
import { User, roles } from '@prisma/client';

export class UserRepository {
  /**
   * Create user with role assignment in a transaction
   */
  async createUserWithRole(
    userData: {
      tenant_id: bigint;
      name: string;
      phone: string;
      email?: string;
      password_hash: string;
    },
    roleName: 'MANAGER' | 'CASHIER'
  ): Promise<{ user: User; role: roles }> {
    return prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          tenant_id: userData.tenant_id,
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          password_hash: userData.password_hash,
          is_active: true,
        },
      });

      // Get role
      const role = await tx.roles.findFirst({
        where: { name: roleName },
      });

      if (!role) {
        throw new Error(`${roleName} role not found in database. Please run seed script.`);
      }

      // Assign role to user in user_roles table
      await tx.user_roles.create({
        data: {
          user_id: user.id,
          role_id: role.id,
        },
      });

      return { user, role };
    });
  }

  /**
   * Find all users for a tenant with their roles
   */
  async findAllByTenant(
    tenantId: bigint,
    includeInactive: boolean = false
  ): Promise<
    Array<
      User & {
        user_roles: Array<{
          roles: roles;
        }>;
      }
    >
  > {
    const where: any = {
      tenant_id: tenantId,
    };

    // By default, only return active users
    if (!includeInactive) {
      where.is_active = true;
    }

    return prisma.user.findMany({
      where,
      include: {
        user_roles: {
          include: {
            roles: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Find user by ID with tenant check and roles
   */
  async findByIdAndTenant(
    userId: bigint,
    tenantId: bigint
  ): Promise<
    | (User & {
        user_roles: Array<{
          roles: roles;
        }>;
      })
    | null
  > {
    return prisma.user.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
      include: {
        user_roles: {
          include: {
            roles: true,
          },
        },
      },
    });
  }

  /**
   * Update user status
   */
  async updateStatus(userId: bigint, tenantId: bigint, isActive: boolean): Promise<User> {
    return prisma.user.update({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
      data: {
        is_active: isActive,
      },
    });
  }

  /**
   * Check if email exists for tenant
   */
  async emailExistsInTenant(email: string, tenantId: bigint): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        email,
        tenant_id: tenantId,
      },
    });
    return count > 0;
  }

  /**
   * Check if phone exists for tenant
   */
  async phoneExistsInTenant(phone: string, tenantId: bigint): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        phone,
        tenant_id: tenantId,
      },
    });
    return count > 0;
  }

  /**
   * Update user profile (self-update)
   */
  async updateProfile(
    userId: bigint,
    tenantId: bigint,
    data: {
      name?: string;
      phone?: string;
      email?: string;
    }
  ): Promise<User> {
    return prisma.user.update({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
      },
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: bigint, tenantId: bigint, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
      data: {
        password_hash: passwordHash,
      },
    });
  }

  /**
   * Get user by ID (without roles)
   */
  async findById(userId: bigint): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Check if email exists for tenant (excluding specific user)
   */
  async emailExistsInTenantExcludingUser(
    email: string,
    tenantId: bigint,
    excludeUserId: bigint
  ): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        email,
        tenant_id: tenantId,
        id: {
          not: excludeUserId,
        },
      },
    });
    return count > 0;
  }

  /**
   * Check if phone exists for tenant (excluding specific user)
   */
  async phoneExistsInTenantExcludingUser(
    phone: string,
    tenantId: bigint,
    excludeUserId: bigint
  ): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        phone,
        tenant_id: tenantId,
        id: {
          not: excludeUserId,
        },
      },
    });
    return count > 0;
  }
}
