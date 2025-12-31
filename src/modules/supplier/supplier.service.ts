import { suppliers, supplier_ledger } from '@prisma/client';
import { SupplierRepository } from './supplier.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { AuditLogger } from '@utils/auditLogger';

export interface SupplierResponse {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: Date | null;
  balance?: number;
}

export interface SupplierLedgerResponse {
  id: string;
  ref_type: string;
  ref_id: string | null;
  credit: number;
  debit: number;
  balance: number;
  payment_mode?: string;
  description?: string;
  created_at: Date | null;
}

export class SupplierService {
  private readonly repository: SupplierRepository;

  constructor() {
    this.repository = new SupplierRepository();
  }

  /**
   * Create a new supplier
   */
  async createSupplier(
    tenantId: bigint,
    userId: bigint,
    data: {
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    // Check for duplicate phone
    if (data.phone) {
      const exists = await this.repository.existsByPhone(data.phone, tenantId);
      if (exists) {
        throw new BadRequestError('Supplier with this phone number already exists');
      }
    }

    const supplier = await this.repository.create({
      tenant_id: tenantId,
      ...data,
    });

    AuditLogger.create(
      tenantId,
      userId,
      'SUPPLIER',
      supplier.id,
      supplier,
      ip,
      userAgent
    );

    return this.formatSupplierResponse(supplier);
  }

  /**
   * Get all suppliers
   */
  async getSuppliers(
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
      isActive?: boolean;
    }
  ) {
    const result = await this.repository.findAll(tenantId, options);
    
    // Get balances for all suppliers
    const suppliersWithBalance = await Promise.all(
      result.suppliers.map(async (supplier) => {
        const balance = await this.repository.getBalance(supplier.id, tenantId);
        return this.formatSupplierResponse(supplier, balance);
      })
    );
    
    return {
      suppliers: suppliersWithBalance,
      pagination: result.pagination,
    };
  }

  /**
   * Get supplier by ID with balance
   */
  async getSupplierById(id: bigint, tenantId: bigint): Promise<SupplierResponse> {
    const supplier = await this.repository.findById(id, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const balance = await this.repository.getBalance(id, tenantId);

    return this.formatSupplierResponse(supplier, balance);
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    id: bigint,
    tenantId: bigint,
    userId: bigint,
    data: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const supplier = await this.repository.findById(id, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Check for duplicate phone if phone is being updated
    if (data.phone && data.phone !== supplier.phone) {
      const exists = await this.repository.existsByPhone(data.phone, tenantId, id);
      if (exists) {
        throw new BadRequestError('Another supplier with this phone number already exists');
      }
    }

    const updated = await this.repository.update(id, tenantId, data);

    AuditLogger.update(
      tenantId,
      userId,
      'SUPPLIER',
      id,
      supplier,
      updated,
      ip,
      userAgent
    );

    return this.formatSupplierResponse(updated);
  }

  /**
   * Add opening balance for supplier
   * Can only be done once per supplier
   */
  async addOpeningBalance(
    supplierId: bigint,
    tenantId: bigint,
    userId: bigint,
    amount: number,
    ip?: string,
    userAgent?: string
  ) {
    const supplier = await this.repository.findById(supplierId, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Check if opening balance already exists
    const hasOpening = await this.repository.hasOpeningBalance(supplierId, tenantId);
    if (hasOpening) {
      throw new BadRequestError('Opening balance already set for this supplier');
    }

    // Create opening balance entry (credit for amount we owe)
    const ledgerEntry = await this.repository.createLedgerEntry({
      tenant_id: tenantId,
      supplier_id: supplierId,
      ref_type: 'OPENING',
      ref_id: null,
      credit: amount,
      debit: 0,
    });

    AuditLogger.create(
      tenantId,
      userId,
      'SUPPLIER_LEDGER',
      ledgerEntry.id,
      ledgerEntry,
      ip,
      userAgent
    );

    return this.formatLedgerResponse(ledgerEntry);
  }

  /**
   * Make payment to supplier
   */
  async makePayment(
    supplierId: bigint,
    tenantId: bigint,
    userId: bigint,
    data: {
      amount: number;
      payment_mode: 'CASH' | 'UPI' | 'CARD' | 'BANK';
      description?: string;
    },
    ip?: string,
    userAgent?: string
  ) {
    const supplier = await this.repository.findById(supplierId, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const currentBalance = await this.repository.getBalance(supplierId, tenantId);
    if (data.amount > currentBalance) {
      throw new BadRequestError(
        `Payment amount (${data.amount}) exceeds outstanding balance (${currentBalance})`
      );
    }

    // Create ledger entry (debit for payment made)
    const ledgerEntry = await this.repository.createLedgerEntry({
      tenant_id: tenantId,
      supplier_id: supplierId,
      ref_type: 'PAYMENT',
      ref_id: null,
      credit: 0,
      debit: data.amount,
      payment_mode: data.payment_mode,
      description: data.description,
    });

    const result = { ledgerEntry };

    AuditLogger.create(
      tenantId,
      userId,
      'SUPPLIER_PAYMENT',
      result.ledgerEntry.id,
      result.ledgerEntry,
      ip,
      userAgent
    );

    return this.formatLedgerResponse(result.ledgerEntry);
  }

  /**
   * Get supplier ledger
   */
  async getSupplierLedger(
    supplierId: bigint,
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
    }
  ) {
    const supplier = await this.repository.findById(supplierId, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const result = await this.repository.getLedger(supplierId, tenantId, options);
    const balance = await this.repository.getBalance(supplierId, tenantId);

    // Calculate summary from entries
    const summary = result.entries.reduce(
      (acc, entry) => ({
        totalCredit: acc.totalCredit + Number(entry.credit),
        totalDebit: acc.totalDebit + Number(entry.debit),
        balance,
      }),
      { totalCredit: 0, totalDebit: 0, balance: 0 }
    );

    return {
      entries: result.entries.map(entry => this.formatLedgerResponse(entry)),
      summary,
    };
  }

  /**
   * Format supplier response
   */
  private formatSupplierResponse(supplier: suppliers, balance?: number): SupplierResponse {
    return {
      id: supplier.id.toString(),
      tenant_id: supplier.tenant_id.toString(),
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      is_active: supplier.is_active ?? true,
      created_at: supplier.created_at,
      ...(balance !== undefined && { balance }),
    };
  }

  /**
   * Format ledger response
   */
  private formatLedgerResponse(entry: supplier_ledger): SupplierLedgerResponse {
    return {
      id: entry.id.toString(),
      ref_type: entry.ref_type,
      ref_id: entry.ref_id?.toString() || null,
      credit: Number(entry.credit),
      debit: Number(entry.debit),
      balance: Number(entry.balance),
      payment_mode: entry.payment_mode || undefined,
      description: entry.description || undefined,
      created_at: entry.created_at,
    };
  }
}
