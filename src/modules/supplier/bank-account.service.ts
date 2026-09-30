import { supplier_bank_details } from '@prisma/client';
import { BankAccountRepository } from './bank-account.repository';
import { SupplierRepository } from './supplier.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { AuditLogger } from '@utils/auditLogger';

export interface BankAccountResponse {
  id: string;
  tenant_id: string;
  supplier_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string; // Masked
  ifsc_code: string;
  branch_name: string | null;
  account_type: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

export class BankAccountService {
  private readonly repository: BankAccountRepository;
  private readonly supplierRepository: SupplierRepository;

  constructor() {
    this.repository = new BankAccountRepository();
    this.supplierRepository = new SupplierRepository();
  }

  /**
   * Mask account number (show only last 4 digits)
   */
  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) {
      return accountNumber;
    }
    const lastFour = accountNumber.slice(-4);
    const masked = 'X'.repeat(accountNumber.length - 4);
    return masked + lastFour;
  }

  /**
   * Format bank account response
   */
  private formatResponse(account: supplier_bank_details): BankAccountResponse {
    return {
      id: account.id.toString(),
      tenant_id: account.tenant_id.toString(),
      supplier_id: account.supplier_id.toString(),
      account_holder_name: account.account_holder_name,
      bank_name: account.bank_name,
      account_number: this.maskAccountNumber(account.account_number),
      ifsc_code: account.ifsc_code,
      branch_name: account.branch_name,
      account_type: account.account_type,
      is_primary: account.is_primary ?? false,
      is_active: account.is_active ?? true,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };
  }

  /**
   * Validate supplier exists and belongs to tenant
   */
  private async validateSupplier(supplierId: bigint, tenantId: bigint): Promise<void> {
    const supplier = await this.supplierRepository.findById(supplierId, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    if (!supplier.is_active) {
      throw new BadRequestError('Supplier is not active');
    }
  }

  /**
   * Create bank account
   */
  async createBankAccount(
    tenantId: bigint,
    userId: bigint,
    supplierId: bigint,
    data: {
      account_holder_name: string;
      bank_name: string;
      account_number: string;
      ifsc_code: string;
      branch_name?: string;
      account_type?: string;
      is_primary?: boolean;
    },
    ip?: string,
    userAgent?: string
  ): Promise<BankAccountResponse> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    let account: supplier_bank_details;

    // If is_primary is true, use transaction to ensure single primary
    if (data.is_primary === true) {
      account = await this.repository.createAndSetPrimary({
        tenant_id: tenantId,
        supplier_id: supplierId,
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        branch_name: data.branch_name || null,
        account_type: data.account_type || null,
      });
    } else {
      account = await this.repository.create({
        tenant_id: tenantId,
        supplier_id: supplierId,
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        branch_name: data.branch_name || null,
        account_type: data.account_type || null,
        is_primary: data.is_primary ?? false,
      });
    }

    // Log activity
    AuditLogger.create(
      tenantId,
      userId,
      'SUPPLIER_BANK_ACCOUNT',
      account.id,
      account,
      ip,
      userAgent
    );

    return this.formatResponse(account);
  }

  /**
   * Get all bank accounts for a supplier
   */
  async getBankAccounts(
    tenantId: bigint,
    supplierId: bigint
  ): Promise<BankAccountResponse[]> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    const accounts = await this.repository.findBySupplier(supplierId, tenantId, true);

    return accounts.map((account) => this.formatResponse(account));
  }

  /**
   * Get bank account by ID
   */
  async getBankAccountById(
    tenantId: bigint,
    supplierId: bigint,
    bankAccountId: bigint
  ): Promise<BankAccountResponse> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    const account = await this.repository.findById(bankAccountId, supplierId, tenantId);
    if (!account) {
      throw new NotFoundError('Bank account not found');
    }

    if (!account.is_active) {
      throw new NotFoundError('Bank account is not active');
    }

    return this.formatResponse(account);
  }

  /**
   * Update bank account
   */
  async updateBankAccount(
    tenantId: bigint,
    userId: bigint,
    supplierId: bigint,
    bankAccountId: bigint,
    data: {
      account_holder_name?: string;
      bank_name?: string;
      account_number?: string;
      ifsc_code?: string;
      branch_name?: string;
      account_type?: string;
      is_primary?: boolean;
    },
    ip?: string,
    userAgent?: string
  ): Promise<BankAccountResponse> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    // Get existing account
    const existingAccount = await this.repository.findById(bankAccountId, supplierId, tenantId);
    if (!existingAccount) {
      throw new NotFoundError('Bank account not found');
    }

    if (!existingAccount.is_active) {
      throw new BadRequestError('Cannot update inactive bank account');
    }

    let updatedAccount: supplier_bank_details;

    // Prepare update data
    const updateData = {
      account_holder_name: data.account_holder_name,
      bank_name: data.bank_name,
      account_number: data.account_number,
      ifsc_code: data.ifsc_code,
      branch_name: data.branch_name,
      account_type: data.account_type,
    };

    // If is_primary is true, use transaction to ensure single primary
    if (data.is_primary === true) {
      updatedAccount = await this.repository.updateAndSetPrimary(
        bankAccountId,
        supplierId,
        tenantId,
        updateData
      );
    } else {
      updatedAccount = await this.repository.update(bankAccountId, {
        ...updateData,
        is_primary: data.is_primary,
      });
    }

    // Log activity
    AuditLogger.update(
      tenantId,
      userId,
      'SUPPLIER_BANK_ACCOUNT',
      updatedAccount.id,
      existingAccount,
      updatedAccount,
      ip,
      userAgent
    );

    return this.formatResponse(updatedAccount);
  }

  /**
   * Delete bank account (soft delete)
   */
  async deleteBankAccount(
    tenantId: bigint,
    userId: bigint,
    supplierId: bigint,
    bankAccountId: bigint,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    // Get existing account
    const existingAccount = await this.repository.findById(bankAccountId, supplierId, tenantId);
    if (!existingAccount) {
      throw new NotFoundError('Bank account not found');
    }

    if (!existingAccount.is_active) {
      throw new BadRequestError('Bank account is already inactive');
    }

    // Soft delete
    await this.repository.softDelete(bankAccountId);

    // Log activity
    AuditLogger.delete(
      tenantId,
      userId,
      'SUPPLIER_BANK_ACCOUNT',
      bankAccountId,
      existingAccount,
      ip,
      userAgent
    );
  }

  /**
   * Set bank account as primary
   */
  async setPrimaryBankAccount(
    tenantId: bigint,
    userId: bigint,
    supplierId: bigint,
    bankAccountId: bigint,
    ip?: string,
    userAgent?: string
  ): Promise<BankAccountResponse> {
    // Validate supplier
    await this.validateSupplier(supplierId, tenantId);

    // Get existing account
    const existingAccount = await this.repository.findById(bankAccountId, supplierId, tenantId);
    if (!existingAccount) {
      throw new NotFoundError('Bank account not found');
    }

    if (!existingAccount.is_active) {
      throw new BadRequestError('Cannot set inactive bank account as primary');
    }

    // Set as primary
    const updatedAccount = await this.repository.setPrimary(
      bankAccountId,
      supplierId,
      tenantId
    );

    // Log activity
    AuditLogger.update(
      tenantId,
      userId,
      'SUPPLIER_BANK_ACCOUNT',
      updatedAccount.id,
      existingAccount,
      updatedAccount,
      ip,
      userAgent
    );

    return this.formatResponse(updatedAccount);
  }
}
