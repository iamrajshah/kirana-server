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
   * Find customer by phone with tenant isolation
   */
  async findByPhone(phone: string, tenantId: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: this.withTenant(tenantId, { phone }),
    });
  }

  /**
   * Find customer by email with tenant isolation
   */
  async findByEmail(email: string, tenantId: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: this.withTenant(tenantId, { email }),
    });
  }

  /**
   * Search customers by name or phone
   */
  async search(
    query: string,
    tenantId: string,
    options?: { skip?: number; take?: number }
  ): Promise<Customer[]> {
    return prisma.customer.findMany({
      where: {
        tenant_id: BigInt(tenantId),
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      skip: options?.skip,
      take: options?.take,
    });
  }

  /**
   * Get customers with pagination
   */
  async findAllPaginated(
    tenantId: string,
    options: { skip: number; take: number; searchQuery?: string }
  ): Promise<{ customers: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      tenant_id: BigInt(tenantId),
      ...(options.searchQuery && {
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
        skip: options.skip,
        take: options.take,
        orderBy: { created_at: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }
}
