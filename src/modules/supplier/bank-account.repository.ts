import { prisma } from '@config/database';
import { supplier_bank_details } from '@prisma/client';

export class BankAccountRepository {
  /**
   * Create bank account
   */
  async create(data: {
    tenant_id: bigint;
    supplier_id: bigint;
    account_holder_name: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    branch_name?: string | null;
    account_type?: string | null;
    is_primary?: boolean;
  }): Promise<supplier_bank_details> {
    return prisma.supplier_bank_details.create({
      data: {
        tenant_id: data.tenant_id,
        supplier_id: data.supplier_id,
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        branch_name: data.branch_name,
        account_type: data.account_type,
        is_primary: data.is_primary ?? true,
        is_active: true,
      },
    });
  }

  /**
   * Find bank account by ID
   */
  async findById(
    id: bigint,
    supplierId: bigint,
    tenantId: bigint
  ): Promise<supplier_bank_details | null> {
    return prisma.supplier_bank_details.findFirst({
      where: {
        id,
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Find all bank accounts for a supplier
   */
  async findBySupplier(
    supplierId: bigint,
    tenantId: bigint,
    activeOnly: boolean = true
  ): Promise<supplier_bank_details[]> {
    return prisma.supplier_bank_details.findMany({
      where: {
        supplier_id: supplierId,
        tenant_id: tenantId,
        ...(activeOnly && { is_active: true }),
      },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Update bank account
   */
  async update(
    id: bigint,
    data: {
      account_holder_name?: string;
      bank_name?: string;
      account_number?: string;
      ifsc_code?: string;
      branch_name?: string | null;
      account_type?: string | null;
      is_primary?: boolean;
    }
  ): Promise<supplier_bank_details> {
    return prisma.supplier_bank_details.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete bank account
   */
  async softDelete(id: bigint): Promise<supplier_bank_details> {
    return prisma.supplier_bank_details.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Set all bank accounts of supplier to non-primary
   */
  async unsetAllPrimary(supplierId: bigint, tenantId: bigint): Promise<void> {
    await prisma.supplier_bank_details.updateMany({
      where: {
        supplier_id: supplierId,
        tenant_id: tenantId,
        is_active: true,
      },
      data: {
        is_primary: false,
      },
    });
  }

  /**
   * Create bank account and set as primary (transaction)
   */
  async createAndSetPrimary(data: {
    tenant_id: bigint;
    supplier_id: bigint;
    account_holder_name: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    branch_name?: string | null;
    account_type?: string | null;
  }): Promise<supplier_bank_details> {
    return prisma.$transaction(async (tx) => {
      // Unset all existing primary accounts
      await tx.supplier_bank_details.updateMany({
        where: {
          supplier_id: data.supplier_id,
          tenant_id: data.tenant_id,
          is_active: true,
        },
        data: {
          is_primary: false,
        },
      });

      // Create new account as primary
      return tx.supplier_bank_details.create({
        data: {
          tenant_id: data.tenant_id,
          supplier_id: data.supplier_id,
          account_holder_name: data.account_holder_name,
          bank_name: data.bank_name,
          account_number: data.account_number,
          ifsc_code: data.ifsc_code,
          branch_name: data.branch_name,
          account_type: data.account_type,
          is_primary: true,
          is_active: true,
        },
      });
    });
  }

  /**
   * Update bank account and set as primary (transaction)
   */
  async updateAndSetPrimary(
    id: bigint,
    supplierId: bigint,
    tenantId: bigint,
    data: {
      account_holder_name?: string;
      bank_name?: string;
      account_number?: string;
      ifsc_code?: string;
      branch_name?: string | null;
      account_type?: string | null;
    }
  ): Promise<supplier_bank_details> {
    return prisma.$transaction(async (tx) => {
      // Unset all existing primary accounts
      await tx.supplier_bank_details.updateMany({
        where: {
          supplier_id: supplierId,
          tenant_id: tenantId,
          is_active: true,
        },
        data: {
          is_primary: false,
        },
      });

      // Update account and set as primary
      return tx.supplier_bank_details.update({
        where: { id },
        data: {
          ...data,
          is_primary: true,
        },
      });
    });
  }

  /**
   * Set bank account as primary (transaction)
   */
  async setPrimary(
    id: bigint,
    supplierId: bigint,
    tenantId: bigint
  ): Promise<supplier_bank_details> {
    return prisma.$transaction(async (tx) => {
      // Unset all existing primary accounts
      await tx.supplier_bank_details.updateMany({
        where: {
          supplier_id: supplierId,
          tenant_id: tenantId,
          is_active: true,
        },
        data: {
          is_primary: false,
        },
      });

      // Set this account as primary
      return tx.supplier_bank_details.update({
        where: { id },
        data: {
          is_primary: true,
        },
      });
    });
  }
}
