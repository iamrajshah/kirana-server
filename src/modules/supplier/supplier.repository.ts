import { prisma } from '@config/database';
import { Prisma } from '@prisma/client';

export class SupplierRepository {
  /**
   * Create a new supplier
   */
  async create(data: {
    tenant_id: bigint;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  }) {
    return prisma.suppliers.create({
      data,
    });
  }

  /**
   * Find supplier by ID and tenant
   */
  async findById(id: bigint, tenantId: bigint) {
    return prisma.suppliers.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Find all suppliers for a tenant
   */
  async findAll(
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
      isActive?: boolean;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.suppliersWhereInput = {
      tenant_id: tenantId,
      ...(options?.isActive !== undefined && { is_active: options.isActive }),
    };

    const [suppliers, total] = await Promise.all([
      prisma.suppliers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.suppliers.count({ where }),
    ]);

    return {
      suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update supplier
   */
  async update(
    id: bigint,
    _tenantId: bigint,
    data: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    }
  ) {
    return prisma.suppliers.update({
      where: { id },
      data,
    });
  }

  /**
   * Check if supplier exists by phone
   */
  async existsByPhone(phone: string, tenantId: bigint, excludeId?: bigint) {
    const where: Prisma.suppliersWhereInput = {
      tenant_id: tenantId,
      phone,
      ...(excludeId && { id: { not: excludeId } }),
    };

    const count = await prisma.suppliers.count({ where });
    return count > 0;
  }

  /**
   * Get supplier balance (sum of credits - debits)
   */
  async getBalance(supplierId: bigint, tenantId: bigint): Promise<number> {
    const result = await prisma.supplier_ledger.aggregate({
      where: {
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
      _sum: {
        credit: true,
        debit: true,
      },
    });

    const credits = Number(result._sum.credit || 0);
    const debits = Number(result._sum.debit || 0);
    return credits - debits;
  }

  /**
   * Get supplier ledger entries
   */
  async getLedger(
    supplierId: bigint,
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      supplier_id: supplierId,
      tenant_id: tenantId,
    };

    const [entries, total] = await Promise.all([
      prisma.supplier_ledger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.supplier_ledger.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create ledger entry
   */
  async createLedgerEntry(data: {
    tenant_id: bigint;
    supplier_id: bigint;
    ref_type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
    ref_id?: bigint | null;
    credit: number;
    debit: number;
    payment_mode?: string;
    description?: string;
  }) {
    const balance = await this.getBalance(data.supplier_id, data.tenant_id);
    const newBalance = balance + data.credit - data.debit;

    return prisma.supplier_ledger.create({
      data: {
        tenant_id: data.tenant_id,
        supplier_id: data.supplier_id,
        ref_type: data.ref_type,
        ref_id: data.ref_id,
        credit: data.credit,
        debit: data.debit,
        balance: newBalance,
        payment_mode: data.payment_mode,
        description: data.description,
      },
    });
  }

  /**
   * Check if opening balance exists
   */
  async hasOpeningBalance(supplierId: bigint, tenantId: bigint): Promise<boolean> {
    const count = await prisma.supplier_ledger.count({
      where: {
        supplier_id: supplierId,
        tenant_id: tenantId,
        ref_type: 'OPENING',
      },
    });
    return count > 0;
  }
}
