import { prisma } from '@config/database';
import { Inventory } from '@prisma/client';

export class InventoryRepository {
  /**
   * Get all inventory with variants and products
   */
  async findAllByTenant(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      searchQuery?: string;
    }
  ): Promise<{ inventory: any[]; total: number }> {
    const where: any = {
      tenant_id,
    };

    // Search by product name or variant SKU
    if (options?.searchQuery) {
      where.OR = [
        {
          product_variants: {
            products: {
              name: {
                contains: options.searchQuery,
              },
            },
          },
        },
        {
          product_variants: {
            sku: {
              contains: options.searchQuery,
            },
          },
        },
      ];
    }

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          product_variants: {
            include: {
              products: true,
            },
          },
        },
        orderBy: {
          variant_id: 'desc',
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    return { inventory, total };
  }

  /**
   * Get low stock inventory
   */
  async findLowStock(tenant_id: bigint): Promise<any[]> {
    return prisma.$queryRaw`
      SELECT i.*, pv.*, p.*
      FROM inventory i
      INNER JOIN product_variants pv ON i.variant_id = pv.id
      INNER JOIN products p ON pv.product_id = p.id
      WHERE i.tenant_id = ${tenant_id}
        AND i.quantity <= i.low_stock_threshold
      ORDER BY i.quantity ASC
    `;
  }

  /**
   * Find inventory by variant ID and tenant
   */
  async findByVariantIdAndTenant(variant_id: bigint, tenant_id: bigint): Promise<Inventory | null> {
    return prisma.inventory.findFirst({
      where: {
        variant_id,
        tenant_id,
      },
    });
  }

  /**
   * Update inventory quantity
   */
  async updateQuantity(
    variant_id: bigint,
    tenant_id: bigint,
    quantity: number,
    low_stock_threshold?: number
  ): Promise<Inventory> {
    const data: any = {
      quantity,
    };

    if (low_stock_threshold !== undefined) {
      data.low_stock_threshold = low_stock_threshold;
    }

    return prisma.inventory.update({
      where: {
        variant_id,
        tenant_id,
      },
      data,
    });
  }

  /**
   * Reduce inventory quantity (for invoice creation)
   * Must be called within a transaction
   */
  async reduceQuantity(variant_id: bigint, tenant_id: bigint, quantity: number, tx?: any): Promise<Inventory> {
    const db = tx || prisma;
    
    return db.inventory.update({
      where: {
        variant_id,
        tenant_id,
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    });
  }

  /**
   * Create or update inventory for a variant
   */
  async upsertInventory(
    variant_id: bigint,
    tenant_id: bigint,
    quantity: number,
    low_stock_threshold: number = 5
  ): Promise<Inventory> {
    return prisma.inventory.upsert({
      where: {
        variant_id,
      },
      create: {
        variant_id,
        tenant_id,
        quantity,
        low_stock_threshold,
      },
      update: {
        quantity,
        low_stock_threshold,
      },
    });
  }
}
