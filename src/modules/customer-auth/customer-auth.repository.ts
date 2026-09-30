import { prisma } from '@config/database';

export class CustomerAuthRepository {
  /**
   * Find customer by phone with tenant isolation
   */
  async findByPhone(phone: string, tenantId: bigint): Promise<any | null> {
    return prisma.customer.findFirst({
      where: {
        tenant_id: tenantId,
        phone,
      },
    });
  }

  /**
   * Find customer by phone with tenant information
   */
  async findByPhoneWithTenant(phone: string, tenantId: bigint): Promise<any | null> {
    return prisma.customer.findFirst({
      where: {
        tenant_id: tenantId,
        phone,
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Find customer by ID with tenant isolation
   */
  async findById(customerId: bigint, tenantId: bigint): Promise<any | null> {
    return prisma.customer.findFirst({
      where: {
        id: customerId,
        tenant_id: tenantId,
        is_active: true,
      },
    });
  }

  /**
   * Create customer
   */
  async create(data: {
    tenant_id: bigint;
    name: string;
    phone: string;
    email?: string | null;
    password_hash: string;
  }): Promise<any> {
    return prisma.customer.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        password_hash: data.password_hash,
        is_active: true,
      } as any,
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(customerId: bigint): Promise<void> {
    await prisma.customer.update({
      where: { id: customerId },
      data: { last_login_at: new Date() } as any,
    });
  }
}
