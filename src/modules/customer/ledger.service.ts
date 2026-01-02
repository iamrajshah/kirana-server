import { prisma } from '@config/database';
import { customer_ledger, customer_ledger_entry_type } from '@prisma/client';

/**
 * LedgerService - Handles all customer ledger operations
 * This is the single source of truth for customer balance changes
 */
export class LedgerService {
  /**
   * Check if opening balance already exists for a customer
   */
  async hasOpeningBalance(customer_id: bigint, tenant_id: bigint): Promise<boolean> {
    const count = await prisma.customer_ledger.count({
      where: {
        customer_id,
        tenant_id,
        entry_type: 'OPENING_BALANCE',
      },
    });
    return count > 0;
  }

  /**
   * Create a ledger entry
   * This must be called whenever customer balance changes
   */
  async createLedgerEntry(data: {
    tenant_id: bigint;
    customer_id: bigint;
    entry_type: customer_ledger_entry_type;
    amount: number;
    description: string;
    reference_id?: bigint;
    created_by?: bigint;
  }): Promise<customer_ledger> {
    return prisma.customer_ledger.create({
      data: {
        tenant_id: data.tenant_id,
        customer_id: data.customer_id,
        entry_type: data.entry_type,
        amount: data.amount,
        description: data.description,
        reference_id: data.reference_id,
        created_by: data.created_by,
      },
    });
  }

  /**
   * Get customer ledger entries
   */
  async getCustomerLedger(
    customerId: bigint,
    tenantId: bigint,
    options?: {
      skip?: number;
      take?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<customer_ledger[]> {
    return prisma.customer_ledger.findMany({
      where: {
        customer_id: customerId,
        tenant_id: tenantId,
        ...(options?.startDate &&
          options?.endDate && {
            created_at: {
              gte: options.startDate,
              lte: options.endDate,
            },
          }),
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: options?.skip,
      take: options?.take,
    });
  }

  /**
   * Calculate customer balance from ledger
   * This is the source of truth for customer balance
   */
  async calculateCustomerBalance(customerId: bigint, tenantId: bigint): Promise<number> {
    const result = await prisma.customer_ledger.aggregate({
      where: {
        customer_id: customerId,
        tenant_id: tenantId,
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  /**
   * Get ledger summary (total debits, credits, balance)
   */
  async getLedgerSummary(
    customerId: bigint,
    tenantId: bigint
  ): Promise<{
    totalDebit: number;
    totalCredit: number;
    balance: number;
  }> {
    const entries = await prisma.customer_ledger.findMany({
      where: {
        customer_id: customerId,
        tenant_id: tenantId,
      },
      select: {
        amount: true,
      },
    });

    const totalDebit = entries
      .filter((e) => Number(e.amount) > 0)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalCredit = Math.abs(
      entries.filter((e) => Number(e.amount) < 0).reduce((sum, e) => sum + Number(e.amount), 0)
    );

    const balance = entries.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      totalDebit,
      totalCredit,
      balance,
    };
  }
}
