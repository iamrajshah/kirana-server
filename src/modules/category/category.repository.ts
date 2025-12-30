import { prisma } from '@config/database';
import { categories } from '@prisma/client';

export class CategoryRepository {
  /**
   * Create a new category
   */
  async createCategory(data: { tenant_id: bigint; name: string }): Promise<categories> {
    return prisma.categories.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
      },
    });
  }

  /**
   * Find category by ID and tenant
   */
  async findByIdAndTenant(id: bigint, tenant_id: bigint): Promise<categories | null> {
    return prisma.categories.findFirst({
      where: {
        id,
        tenant_id,
      },
    });
  }

  /**
   * Find category by name (case-sensitive) within tenant
   */
  async findByName(name: string, tenant_id: string | bigint): Promise<categories | null> {
    return prisma.categories.findFirst({
      where: {
        tenant_id: typeof tenant_id === 'string' ? BigInt(tenant_id) : tenant_id,
        name: name,
      },
    });
  }

  /**
   * Find all categories by tenant with pagination and search
   */
  async findAllByTenant(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      searchQuery?: string;
      includeInactive?: boolean;
    }
  ): Promise<{ categories: categories[]; total: number }> {
    const where: any = {
      tenant_id,
    };

    // By default, only return active categories
    if (!options?.includeInactive) {
      where.is_active = true;
    }

    if (options?.searchQuery) {
      where.name = {
        contains: options.searchQuery,
      };
    }

    const [categories, total] = await Promise.all([
      prisma.categories.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: {
          id: 'desc',
        },
      }),
      prisma.categories.count({ where }),
    ]);

    return { categories, total };
  }

  /**
   * Update category
   */
  async updateCategory(
    id: bigint,
    tenant_id: bigint,
    data: {
      name?: string;
    }
  ): Promise<categories> {
    return prisma.categories.update({
      where: {
        id,
        tenant_id,
      },
      data,
    });
  }

  /**
   * Update category status
   */
  async updateStatus(
    id: bigint,
    tenant_id: bigint,
    is_active: boolean
  ): Promise<categories> {
    return prisma.categories.update({
      where: {
        id,
        tenant_id,
      },
      data: {
        is_active,
      },
    });
  }
}
