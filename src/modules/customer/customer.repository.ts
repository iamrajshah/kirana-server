import { Customer, Prisma } from '@prisma/client';
import { BaseRepository } from '../base.repository';
import { prisma } from '@config/database';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.validation';

export class CustomerRepository extends BaseRepository<
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput
> {
  protected readonly model = 'Customer';

  protected getDelegate() {
    return prisma.customer as never;
  }

  /**
   * Create customer
   */
  async createCustomer(data: {
    tenant_id: bigint;
    name: string;
    phone: string;
    email?: string | null;
  }): Promise<Customer> {
    return prisma.customer.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        credit_balance: 0,
      },
    });
  }

  /**
   * Find customer by phone with tenant isolation
   */
  async findByPhone(phone: string, tenantId: string | bigint): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: {
        phone,
        tenant_id: typeof tenantId === 'string' ? BigInt(tenantId) : tenantId,
      },
    });
  }

  /**
   * Find customer by email with tenant isolation
   */
  async findByEmail(email: string, tenantId: string | bigint): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: {
        email,
        tenant_id: typeof tenantId === 'string' ? BigInt(tenantId) : tenantId,
      },
    });
  }

  /**
   * Find customer by ID with tenant check
   */
  async findByIdAndTenant(customerId: bigint, tenantId: bigint): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: {
        id: customerId,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Get all customers for tenant with pagination
   */
  async findAllByTenant(
    tenantId: bigint,
    options?: {
      skip?: number;
      take?: number;
      searchQuery?: string;
      includeInactive?: boolean;
    }
  ): Promise<{ customers: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      tenant_id: tenantId,
      ...(!options?.includeInactive && { is_active: true }),
      ...(options?.searchQuery && {
        OR: [
          { name: { contains: options.searchQuery } },
          { phone: { contains: options.searchQuery } },
          { email: { contains: options.searchQuery } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: { created_at: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: bigint,
    tenantId: bigint,
    data: {
      name?: string;
      phone?: string;
      email?: string | null;
    }
  ): Promise<Customer> {
    return prisma.customer.update({
      where: {
        id: customerId,
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
   * Update customer balance (only used to sync calculated balance)
   */
  async updateBalance(customerId: bigint, tenantId: bigint, balance: number): Promise<Customer> {
    return prisma.customer.update({
      where: {
        id: customerId,
        tenant_id: tenantId,
      },
      data: {
        credit_balance: balance,
      },
    });
  }

  /**
   * Update customer status
   */
  async updateStatus(
    customerId: bigint,
    tenantId: bigint,
    is_active: boolean
  ): Promise<Customer> {
    return prisma.customer.update({
      where: {
        id: customerId,
        tenant_id: tenantId,
      },
      data: {
        is_active,
      },
    });
  }
}
