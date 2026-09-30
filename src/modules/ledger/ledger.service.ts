import { Ledger, LedgerEntry } from '@prisma/client';
import { BaseService } from '../base.service';
import { LedgerRepository } from './ledger.repository';
import { CreateLedgerInput, UpdateLedgerInput } from './ledger.validation';
import { ConflictError } from '@utils/errors';

export class LedgerService extends BaseService<Ledger, CreateLedgerInput, UpdateLedgerInput> {
  protected readonly repository: LedgerRepository;

  constructor() {
    super();
    this.repository = new LedgerRepository();
  }

  /**
   * Create a new ledger with validation
   */
  async create(tenantId: string, data: CreateLedgerInput): Promise<Ledger> {
    // Check if ledger with code already exists
    const existingLedger = await this.repository.findByCode(data.code, tenantId);
    if (existingLedger) {
      throw new ConflictError('Ledger with this code already exists');
    }

    return this.repository.create(tenantId, data);
  }

  /**
   * Update ledger with validation
   */
  async update(id: string, tenantId: string, data: UpdateLedgerInput): Promise<Ledger> {
    // If code is being updated, check for duplicates
    if (data.code && typeof data.code === 'string') {
      const existingLedger = await this.repository.findByCode(data.code, tenantId);
      if (existingLedger && existingLedger.id !== id) {
        throw new ConflictError('Ledger with this code already exists');
      }
    }

    return this.repository.update(id, tenantId, data);
  }

  /**
   * Get ledgers by type
   */
  async getByType(
    type: string,
    tenantId: string,
    options?: { skip?: number; take?: number }
  ): Promise<Ledger[]> {
    return this.repository.findByType(type, tenantId, options);
  }

  /**
   * Get ledger entries
   */
  async getEntries(
    ledgerId: string,
    tenantId: string,
    options?: {
      skip?: number;
      take?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<LedgerEntry[]> {
    await this.repository.findByIdOrFail(ledgerId, tenantId);
    return this.repository.getLedgerEntries(ledgerId, tenantId, options);
  }

  /**
   * Get ledger balance
   */
  async getBalance(
    ledgerId: string,
    tenantId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ debit: number; credit: number; balance: number }> {
    await this.repository.findByIdOrFail(ledgerId, tenantId);
    return this.repository.getBalance(ledgerId, tenantId, options);
  }
}
