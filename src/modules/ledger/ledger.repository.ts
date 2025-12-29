import { Ledger, LedgerEntry, Prisma } from '@prisma/client';
import { BaseRepository } from '../base.repository';
import { prisma } from '@config/database';
import { CreateLedgerInput, UpdateLedgerInput } from './ledger.validation';

export class LedgerRepository extends BaseRepository<Ledger, CreateLedgerInput, UpdateLedgerInput> {
  protected readonly model = 'Ledger';

  protected getDelegate() {
    return prisma.ledger as never;
  }

  /**
   * Find ledger by code with tenant isolation
   */
  async findByCode(code: string, tenantId: string): Promise<Ledger | null> {
    return prisma.ledger.findFirst({
      where: this.withTenant(tenantId, { code }),
    });
  }

  /**
   * Get ledgers by type
   */
  async findByType(
    type: string,
    tenantId: string,
    options?: { skip?: number; take?: number }
  ): Promise<Ledger[]> {
    return prisma.ledger.findMany({
      where: this.withTenant(tenantId, { type: type as never }),
      skip: options?.skip,
      take: options?.take,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get ledger entries for a ledger
   */
  async getLedgerEntries(
    ledgerId: string,
    tenantId: string,
    options?: {
      skip?: number;
      take?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<LedgerEntry[]> {
    return prisma.ledgerEntry.findMany({
      where: {
        ledgerId,
        tenantId,
        ...(options?.startDate && { entryDate: { gte: options.startDate } }),
        ...(options?.endDate && { entryDate: { lte: options.endDate } }),
      },
      skip: options?.skip,
      take: options?.take,
      orderBy: { entryDate: 'desc' },
      include: {
        ledger: true,
      },
    });
  }

  /**
   * Get ledger balance
   */
  async getBalance(
    ledgerId: string,
    tenantId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ debit: number; credit: number; balance: number }> {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        ledgerId,
        tenantId,
        ...(options?.startDate && { entryDate: { gte: options.startDate } }),
        ...(options?.endDate && { entryDate: { lte: options.endDate } }),
      },
      select: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const debit = entries.reduce(
      (sum: number, entry: { debitAmount: Prisma.Decimal }) => sum + (Number(entry.debitAmount) || 0),
      0
    );
    const credit = entries.reduce(
      (sum: number, entry: { creditAmount: Prisma.Decimal }) => sum + (Number(entry.creditAmount) || 0),
      0
    );
    const balance = debit - credit;

    return { debit, credit, balance };
  }

  /**
   * Create a ledger entry
   */
  async createEntry(
    tenantId: string,
    data: Prisma.LedgerEntryCreateInput
  ): Promise<LedgerEntry> {
    return prisma.ledgerEntry.create({
      data: {
        ...data,
        tenantId,
      } as never,
    });
  }
}
