import { prisma } from '@config/database';
import { User, Tenant, roles } from '@prisma/client';

export class AuthRepository {
  /**
   * Create tenant with owner user in a transaction
   */
  async createTenantWithOwner(
    tenantData: {
      name: string;
      owner_name: string;
      phone: string;
      email?: string;
      gst_number?: string;
    },
    userData: {
      name: string;
      phone: string;
      email?: string;
      password_hash: string;
    }
  ): Promise<{ tenant: Tenant; user: User; role: roles }> {
    return prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantData.name,
          owner_name: tenantData.owner_name,
          phone: tenantData.phone,
          email: tenantData.email,
          gst_number: tenantData.gst_number,
          status: 'ACTIVE',
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          password_hash: userData.password_hash,
          is_active: true,
        },
      });

      // Get OWNER role
      const ownerRole = await tx.roles.findFirst({
        where: { name: 'OWNER' },
      });

      if (!ownerRole) {
        throw new Error('OWNER role not found in database. Please run seed script.');
      }

      // Assign OWNER role to user
      await tx.user_roles.create({
        data: {
          user_id: user.id,
          role_id: ownerRole.id,
        },
      });

      return { tenant, user, role: ownerRole };
    });
  }

  /**
   * Find user by email with roles
   */
  async findUserByEmail(email: string): Promise<
    | (User & {
        user_roles: Array<{
          roles: roles;
        }>;
      })
    | null
  > {
    return prisma.user.findFirst({
      where: { email },
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
   * Find user by phone with roles
   */
  async findUserByPhone(phone: string): Promise<
    | (User & {
        user_roles: Array<{
          roles: roles;
        }>;
      })
    | null
  > {
    return prisma.user.findFirst({
      where: { phone },
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
   * Find user by ID with roles
   */
  async findUserById(userId: bigint): Promise<
    | (User & {
        user_roles: Array<{
          roles: roles;
        }>;
      })
    | null
  > {
    return prisma.user.findUnique({
      where: { id: userId },
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
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * Check if phone exists
   */
  async phoneExists(phone: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { phone },
    });
    return count > 0;
  }
}
