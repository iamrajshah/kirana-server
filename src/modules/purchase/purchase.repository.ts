import { prisma } from '@config/database';
import { Prisma } from '@prisma/client';

export class PurchaseRepository {
  /**
   * Create purchase invoice with items (within transaction)
   */
  async create(
    data: {
      tenant_id: bigint;
      supplier_id: bigint;
      invoice_number: string | null;
      invoice_date: Date;
      total_amount: number;
      paid_amount: number;
      status: 'PAID' | 'UNPAID' | 'PARTIAL';
    },
    items: Array<{
      variant_id: bigint;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>,
    tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>
  ) {
    const client = tx || prisma;

    const purchase = await client.purchase_invoices.create({
      data: {
        ...data,
        purchase_invoice_items: {
          create: items.map(item => ({
            product_id: item.variant_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            purchase_price: item.unit_price,
          })),
        },
      },
      include: {
        purchase_invoice_items: true,
        suppliers: true,
      },
    });

    return purchase;
  }

  /**
   * Find purchase by ID
   */
  async findById(id: bigint, tenantId: bigint) {
    return prisma.purchase_invoices.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        purchase_invoice_items: true,
        suppliers: true,
      },
    });
  }

  /**
   * Find all purchases
   */
  async findAll(
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
      supplierId?: bigint;
      status?: 'PAID' | 'UNPAID' | 'PARTIAL';
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.purchase_invoicesWhereInput = {
      tenant_id: tenantId,
      ...(options?.supplierId && { supplier_id: options.supplierId }),
      ...(options?.status && { status: options.status }),
    };

    const [purchases, total] = await Promise.all([
      prisma.purchase_invoices.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          suppliers: true,
          purchase_invoice_items: true,
        },
      }),
      prisma.purchase_invoices.count({ where }),
    ]);

    return {
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update inventory quantity
   */
  async updateInventory(
    variantId: bigint,
    tenantId: bigint,
    quantityToAdd: number,
    tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>
  ) {
    const client = tx || prisma;

    // Check if inventory exists
    const existing = await client.inventory.findUnique({
      where: { variant_id: variantId },
    });

    if (existing) {
      // Update existing inventory
      return client.inventory.update({
        where: { variant_id: variantId },
        data: {
          quantity: { increment: quantityToAdd },
          version: { increment: 1 },
        },
      });
    } else {
      // Create new inventory record
      return client.inventory.create({
        data: {
          variant_id: variantId,
          tenant_id: tenantId,
          quantity: quantityToAdd,
          low_stock_threshold: 5,
        },
      });
    }
  }
}
