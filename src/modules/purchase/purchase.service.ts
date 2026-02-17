import { PurchaseRepository } from './purchase.repository';
import { SupplierRepository } from '@modules/supplier/supplier.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { prisma } from '@config/database';
import { AuditLogger } from '@utils/auditLogger';
import { serializeBigInt } from '@utils/serializeBigInt';

interface PurchaseItem {
  variant_id: number;
  quantity: number;
  unit_price: number;
}

export interface PurchaseResponse {
  id: string;
  tenant_id: string;
  supplier_id: string;
  invoice_number: string | null;
  invoice_date: Date;
  total_amount: number;
  paid_amount: number;
  status: string;
  created_at: Date | null;
  supplier?: {
    id: string;
    name: string;
    phone: string | null;
  };
  items?: Array<{
    id: string;
    variant_id: string;
    quantity: number;
    purchase_price: number;
    product_name?: string;
    sku?: string;
    brand?: string;
    size?: string;
  }>;
}

export class PurchaseService {
  private readonly repository: PurchaseRepository;
  private readonly supplierRepository: SupplierRepository;

  constructor() {
    this.repository = new PurchaseRepository();
    this.supplierRepository = new SupplierRepository();
  }

  /**
   * Create purchase invoice
   * - Increases inventory
   * - Creates supplier ledger CREDIT entry
   * - Supports partial/full payment
   * - Wrapped in transaction
   */
  async createPurchase(
    tenantId: bigint,
    userId: bigint,
    data: {
      supplier_id: number;
      invoice_number?: string;
      invoice_date: string;
      items: PurchaseItem[];
      payment_amount?: number;
      payment_mode?: 'CASH' | 'UPI' | 'CARD' | 'BANK';
    },
    ip?: string,
    userAgent?: string
  ) {
    const supplierId = BigInt(data.supplier_id);

    // Verify supplier exists
    const supplier = await this.supplierRepository.findById(supplierId, tenantId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    // Verify all variants exist and belong to this tenant
    const variantIds = data.items.map((item) => BigInt(item.variant_id));
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: variantIds },
        tenant_id: tenantId,
      },
    });

    if (variants.length !== data.items.length) {
      throw new BadRequestError('One or more variants not found or do not belong to this tenant');
    }

    // Calculate total amount
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const paymentAmount = data.payment_amount || 0;

    if (paymentAmount > totalAmount) {
      throw new BadRequestError('Payment amount cannot exceed total amount');
    }

    // Determine status
    let status: 'PAID' | 'UNPAID' | 'PARTIAL';
    if (paymentAmount === 0) {
      status = 'UNPAID';
    } else if (paymentAmount >= totalAmount) {
      status = 'PAID';
    } else {
      status = 'PARTIAL';
    }

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create purchase invoice with items - use tx directly instead of repository method
      const purchase = await tx.purchase_invoices.create({
        data: {
          tenant_id: tenantId,
          supplier_id: supplierId,
          invoice_number: data.invoice_number || null,
          invoice_date: new Date(data.invoice_date),
          total_amount: totalAmount,
          paid_amount: paymentAmount,
          status,
          purchase_invoice_items: {
            create: data.items.map((item) => ({
              product_id: BigInt(item.variant_id),
              variant_id: BigInt(item.variant_id),
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

      // 2. Update inventory for each item
      for (const item of data.items) {
        await tx.inventory.upsert({
          where: { variant_id: BigInt(item.variant_id) },
          update: {
            quantity: { increment: item.quantity },
            version: { increment: 1 },
          },
          create: {
            variant_id: BigInt(item.variant_id),
            tenant_id: tenantId,
            quantity: item.quantity,
            low_stock_threshold: 5,
          },
        });
      }

      // 3. Create supplier ledger entry (CREDIT for total amount - we owe supplier)
      const currentBalance = await this.supplierRepository.getBalance(supplierId, tenantId);
      const newBalance = currentBalance + totalAmount - paymentAmount;

      await tx.supplier_ledger.create({
        data: {
          tenant_id: tenantId,
          supplier_id: supplierId,
          ref_type: 'PURCHASE',
          ref_id: purchase.id,
          credit: totalAmount,
          debit: 0,
          balance: currentBalance + totalAmount,
        },
      });

      // 4. If payment made, create DEBIT entry
      if (paymentAmount > 0) {
        await tx.supplier_ledger.create({
          data: {
            tenant_id: tenantId,
            supplier_id: supplierId,
            ref_type: 'PAYMENT',
            ref_id: purchase.id,
            credit: 0,
            debit: paymentAmount,
            balance: newBalance,
          },
        });
      }

      return purchase;
    });

    AuditLogger.create(tenantId, userId, 'PURCHASE', result.id, result, ip, userAgent);

    return this.formatPurchaseResponse(result);
  }

  /**
   * Get all purchases
   */
  async getPurchases(
    tenantId: bigint,
    options?: {
      page?: number;
      limit?: number;
      supplierId?: bigint;
      status?: 'PAID' | 'UNPAID' | 'PARTIAL';
    }
  ) {
    const result = await this.repository.findAll(tenantId, options);
    return {
      purchases: result.purchases.map((p: any) => this.formatPurchaseResponse(p)),
      pagination: result.pagination,
    };
  }

  /**
   * Get purchase by ID
   */
  async getPurchaseById(id: bigint, tenantId: bigint): Promise<PurchaseResponse> {
    const purchase = await this.repository.findById(id, tenantId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }

    return this.formatPurchaseResponse(purchase);
  }

  /**
   * Format purchase response
   */
  private formatPurchaseResponse(purchase: any): PurchaseResponse {
    return serializeBigInt({
      id: purchase.id,
      tenant_id: purchase.tenant_id,
      supplier_id: purchase.supplier_id,
      invoice_number: purchase.invoice_number,
      invoice_date: purchase.invoice_date,
      total_amount: Number(purchase.total_amount),
      paid_amount: Number(purchase.paid_amount),
      status: purchase.status,
      created_at: purchase.created_at,
      ...(purchase.suppliers && {
        supplier: {
          id: purchase.suppliers.id,
          name: purchase.suppliers.name,
          phone: purchase.suppliers.phone,
        },
      }),
      ...(purchase.purchase_invoice_items && {
        items: purchase.purchase_invoice_items.map((item: any) => {
          const variant = item.product_variants;
          const product = item.products || variant?.products;

          return {
            id: item.id,
            variant_id: item.variant_id || '',
            quantity: Number(item.quantity),
            purchase_price: Number(item.purchase_price),
            product_name: product?.name || 'Unknown Product',
            sku: variant?.sku || '',
            brand: variant?.brand || '',
            size: variant?.size || '',
          };
        }),
      }),
    });
  }
}
