import { InvoiceRepository } from './invoice.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { prisma } from '@config/database';
import { AuditLogger } from '@utils/auditLogger';

export class InvoiceService {
  private invoiceRepository: InvoiceRepository;
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.invoiceRepository = new InvoiceRepository();
    this.inventoryRepository = new InventoryRepository();
  }

  /**
   * Create invoice with atomic transaction and idempotency support
   * Idempotency is enforced using the unique constraint on (tenant_id, idempotency_key)
   * If a duplicate idempotency key is provided, returns the existing invoice instead of creating a new one
   */
  async createInvoice(
    tenant_id: bigint,
    customer_id: bigint,
    items: Array<{ variant_id: string; quantity: number; price: number }>,
    gst_amount: number,
    invoice_url: string | undefined,
    created_by: bigint,
    idempotency_key?: string
  ) {
    // If idempotency key is provided, check for existing invoice
    if (idempotency_key) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          tenant_id,
          idempotency_key,
        },
      });

      if (existingInvoice) {
        // Return existing invoice with full details
        return this.getInvoiceById(existingInvoice.id, tenant_id);
      }
    }

    // Validate customer exists
    const customer = await prisma.customer.findFirst({
      where: {
        id: customer_id,
        tenant_id,
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Use Prisma transaction for atomicity with increased timeout for complex operations
    const invoice = await prisma.$transaction(async (tx) => {
      // Step 1: Validate all variants and check inventory
      for (const item of items) {
        const variant_id = BigInt(item.variant_id);

        // Validate variant exists and is active
        const variant = await tx.product_variants.findFirst({
          where: {
            id: variant_id,
            is_active: true,
          },
          include: {
            products: true,
          },
        });

        if (!variant) {
          throw new NotFoundError(`Variant ${item.variant_id} not found or inactive`);
        }

        if (!variant.products || !variant.products.is_active) {
          throw new BadRequestError(
            `Product "${variant.products?.name}" is inactive and cannot be billed`
          );
        }

        // Check if variant belongs to tenant
        if (variant.products.tenant_id.toString() !== tenant_id.toString()) {
          throw new BadRequestError(`Variant ${item.variant_id} does not belong to your tenant`);
        }

        // Check inventory
        const inventory = await tx.inventory.findFirst({
          where: {
            variant_id,
            tenant_id,
          },
        });

        if (!inventory) {
          throw new BadRequestError(
            `No inventory found for variant ${item.variant_id} (SKU: ${variant.sku})`
          );
        }

        const currentQuantity = inventory.quantity ?? 0;
        if (currentQuantity < item.quantity) {
          throw new BadRequestError(
            `Insufficient inventory for variant ${item.variant_id} (SKU: ${variant.sku}). Available: ${currentQuantity}, Required: ${item.quantity}`
          );
        }
      }

      // Step 2: Generate invoice number
      const invoice_number = await this.invoiceRepository.generateInvoiceNumber(tenant_id);

      // Step 3: Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0) + gst_amount;

      // Step 4: Create invoice with idempotency key
      const invoice = await tx.invoice.create({
        data: {
          tenant_id,
          customer_id,
          invoice_number,
          total_amount,
          gst_amount,
          status: 'UNPAID',
          invoice_url,
          idempotency_key, // Store idempotency key (can be null)
        },
      });

      // Step 5: Create invoice items
      const invoice_items = items.map((item) => ({
        invoice_id: invoice.id,
        variant_id: BigInt(item.variant_id),
        quantity: item.quantity,
        price: item.price,
      }));

      await this.invoiceRepository.createInvoiceItems(invoice_items, tx);

      // Step 6: Reduce inventory quantities with optimistic locking
      for (const item of items) {
        await this.inventoryRepository.reduceQuantity(
          BigInt(item.variant_id),
          tenant_id,
          item.quantity,
          tx
        );
      }

      // Step 7: Create ledger entry
      await tx.customer_ledger.create({
        data: {
          customer_id,
          tenant_id,
          entry_type: 'INVOICE',
          amount: total_amount,
          reference_id: invoice.id,
          description: `Invoice ${invoice_number}`,
          created_by,
        },
      });

      // Step 8: Update customer balance with optimistic locking
      const currentCustomer = await tx.customer.findUnique({
        where: { id: customer_id },
      });

      if (!currentCustomer) {
        throw new NotFoundError('Customer not found');
      }

      const customerVersion = currentCustomer.version;

      const updatedCustomer = await tx.customer.updateMany({
        where: {
          id: customer_id,
          version: customerVersion, // Only update if version hasn't changed
        },
        data: {
          credit_balance: {
            increment: total_amount,
          },
          version: {
            increment: 1,
          },
        },
      });

      // If no rows updated, version conflict
      if (updatedCustomer.count === 0) {
        throw new Error(
          'Customer balance update failed due to concurrent modification. Please retry the operation.'
        );
      }

      return invoice;
    }, {
      maxWait: 10000, // Wait up to 10s to start transaction
      timeout: 30000, // Transaction timeout 30s
    });

    // Audit log
    AuditLogger.create(
      tenant_id,
      created_by,
      'invoice',
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        customer_id: customer_id.toString(),
        total_amount: Number(invoice.total_amount),
        gst_amount,
        items_count: items.length,
        idempotency_key: idempotency_key || null,
      }
    );

    // Fetch the created invoice with all details
    return this.getInvoiceById(invoice.id, tenant_id);
  }

  /**
   * Get all invoices for a tenant
   */
  async getAllInvoices(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ) {
    const { invoices, total } = await this.invoiceRepository.findAllByTenant(tenant_id, options);

    return {
      invoices: invoices.map((invoice) => this.formatInvoiceResponse(invoice)),
      total,
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoice_id: bigint, tenant_id: bigint) {
    const invoice = await this.invoiceRepository.findById(invoice_id, tenant_id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Get invoices by customer ID
   */
  async getInvoicesByCustomer(
    customer_id: bigint,
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ) {
    const { invoices, total } = await this.invoiceRepository.findByCustomerId(customer_id, tenant_id, options);

    return {
      invoices: invoices.map((invoice) => this.formatInvoiceResponse(invoice)),
      total,
    };
  }

  /**
   * Format invoice response
   */
  private formatInvoiceResponse(invoice: any) {
    return {
      id: invoice.id.toString(),
      invoice_number: invoice.invoice_number,
      customer: invoice.customers
        ? {
            id: invoice.customers.id.toString(),
            name: invoice.customers.name,
            phone: invoice.customers.phone,
            email: invoice.customers.email,
          }
        : null,
      items: invoice.invoice_items
        ? invoice.invoice_items.map((item: any) => ({
            id: item.id.toString(),
            variant_id: item.variant_id.toString(),
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
            variant: item.product_variants
              ? {
                  id: item.product_variants.id.toString(),
                  sku: item.product_variants.sku,
                  price: item.product_variants.price,
                  product: item.product_variants.products
                    ? {
                        id: item.product_variants.products.id.toString(),
                        name: item.product_variants.products.name,
                      }
                    : null,
                }
              : null,
          }))
        : [],
      total_amount: invoice.total_amount,
      gst_amount: invoice.gst_amount,
      status: invoice.status,
      invoice_url: invoice.invoice_url,
      created_at: invoice.created_at,
    };
  }
}
