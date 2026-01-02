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
   * Supports: DRAFT/FINALIZED status, discounts, price overrides, partial payments
   * Idempotency is enforced using the unique constraint on (tenant_id, idempotency_key)
   * If a duplicate idempotency key is provided, returns the existing invoice instead of creating a new one
   */
  async createInvoice(
    tenant_id: bigint,
    customer_id: bigint,
    items: Array<{
      variant_id: string;
      quantity: number;
      price?: number; // Optional price override
      discount_amount?: number; // Item-level discount
    }>,
    gst_amount: number,
    invoice_url: string | undefined,
    created_by: bigint,
    idempotency_key?: string,
    discount_amount: number = 0, // Bill-level discount
    status: 'DRAFT' | 'FINALIZED' = 'DRAFT' // Default to DRAFT
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
    const invoice = await prisma.$transaction(
      async (tx) => {
        let subtotal = 0;
        let totalItemDiscount = 0;
        const validatedItems: Array<{
          variant_id: bigint;
          variant: any;
          quantity: number;
          unit_price: number; // Original or overridden price
          discount_amount: number;
          final_price: number;
        }> = [];

        // Step 1: Validate all variants, calculate prices, and check inventory
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

          // Determine the unit price (override or default selling_price)
          const unit_price =
            item.price !== undefined
              ? item.price
              : Number(variant.selling_price || variant.price || 0);

          if (unit_price <= 0) {
            throw new BadRequestError(
              `Invalid price for variant ${item.variant_id} (SKU: ${variant.sku})`
            );
          }

          const item_discount = item.discount_amount || 0;
          const line_total = unit_price * item.quantity;
          const final_price = Math.max(0, line_total - item_discount);

          subtotal += line_total;
          totalItemDiscount += item_discount;

          validatedItems.push({
            variant_id,
            variant,
            quantity: item.quantity,
            unit_price,
            discount_amount: item_discount,
            final_price,
          });

          // Check inventory only for FINALIZED invoices (not for DRAFT)
          if (status === 'FINALIZED') {
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
        }

        // Step 2: Calculate totals
        const subtotal_amount = subtotal;
        const total_discount = totalItemDiscount + discount_amount;
        const amount_after_discount = Math.max(0, subtotal - total_discount);
        const total_amount = amount_after_discount + gst_amount;

        // Step 3: Generate invoice number
        const invoice_number = await this.invoiceRepository.generateInvoiceNumber(tenant_id);

        // Step 4: Determine invoice status
        let invoice_status: 'DRAFT' | 'FINALIZED' | 'UNPAID' | 'PARTIAL' | 'PAID' = status;
        const finalized_at = status === 'FINALIZED' ? new Date() : null;

        // If FINALIZED, set as UNPAID (payment will update status)
        if (status === 'FINALIZED') {
          invoice_status = 'UNPAID';
        }

        // Step 5: Create invoice with all calculated fields
        const invoice = await tx.invoice.create({
          data: {
            tenant_id,
            customer_id,
            invoice_number,
            subtotal_amount,
            discount_amount: total_discount,
            gst_amount,
            total_amount,
            paid_amount: 0,
            status: invoice_status,
            invoice_url,
            idempotency_key,
            finalized_at,
          },
        });

        // Step 6: Create invoice items with snapshots
        for (const item of validatedItems) {
          await tx.invoiceItem.create({
            data: {
              invoice_id: invoice.id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              unit_price: item.unit_price, // Price per unit (original or overridden)
              price: item.unit_price * item.quantity, // Total line price before discount
              discount_amount: item.discount_amount,
              final_price: item.final_price, // Final price after discount
            },
          });
        }

        // Step 7: For FINALIZED invoices, reduce inventory and update customer balance
        if (status === 'FINALIZED') {
          // Reduce inventory quantities with optimistic locking
          for (const item of validatedItems) {
            await this.inventoryRepository.reduceQuantity(
              item.variant_id,
              tenant_id,
              item.quantity,
              tx
            );
          }

          // Create ledger entry
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

          // Update customer balance with optimistic locking
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
              version: customerVersion,
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

          if (updatedCustomer.count === 0) {
            throw new Error(
              'Customer balance update failed due to concurrent modification. Please retry the operation.'
            );
          }
        }

        return invoice;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    // Audit log
    AuditLogger.create(tenant_id, created_by, 'invoice', invoice.id, {
      action: 'create',
      invoice_number: invoice.invoice_number,
      customer_id: customer_id.toString(),
      status: invoice.status,
      subtotal_amount: Number(invoice.subtotal_amount),
      discount_amount: Number(invoice.discount_amount),
      total_amount: Number(invoice.total_amount),
      gst_amount,
      items_count: items.length,
      idempotency_key: idempotency_key || null,
    });

    // Fetch the created invoice with all details
    return this.getInvoiceById(invoice.id, tenant_id);
  }

  /**
   * Update DRAFT invoice
   * Can only update invoices in DRAFT status
   */
  async updateInvoice(
    invoice_id: bigint,
    tenant_id: bigint,
    updateData: {
      customer_id?: string;
      items?: Array<{
        variant_id: string;
        quantity: number;
        price?: number;
        discount_amount?: number;
      }>;
      gst_amount?: number;
      discount_amount?: number;
      invoice_url?: string;
    },
    updated_by: bigint
  ) {
    // Fetch existing invoice
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoice_id,
        tenant_id,
      },
      include: {
        invoice_items: true,
      },
    });

    if (!existingInvoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Only DRAFT invoices can be updated
    if (existingInvoice.status !== 'DRAFT') {
      throw new BadRequestError(
        `Cannot update invoice in ${existingInvoice.status} status. Only DRAFT invoices can be updated.`
      );
    }

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalItemDiscount = 0;

      // If items are being updated, delete old items and create new ones
      if (updateData.items && updateData.items.length > 0) {
        // Delete existing items
        await tx.invoiceItem.deleteMany({
          where: {
            invoice_id,
          },
        });

        // Validate and create new items
        for (const item of updateData.items) {
          const variant_id = BigInt(item.variant_id);

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
            throw new BadRequestError(`Product "${variant.products?.name}" is inactive`);
          }

          const unit_price =
            item.price !== undefined
              ? item.price
              : Number(variant.selling_price || variant.price || 0);

          const item_discount = item.discount_amount || 0;
          const line_total = unit_price * item.quantity;
          const final_price = Math.max(0, line_total - item_discount);

          subtotal += line_total;
          totalItemDiscount += item_discount;

          await tx.invoiceItem.create({
            data: {
              invoice_id,
              variant_id,
              quantity: item.quantity,
              unit_price,
              price: line_total, // Line total before discount
              discount_amount: item_discount,
              final_price,
            },
          });
        }
      } else {
        // Recalculate from existing items
        const items = existingInvoice.invoice_items;
        for (const item of items) {
          const line_total = Number(item.unit_price) * (item.quantity || 0);
          subtotal += line_total;
          totalItemDiscount += Number(item.discount_amount || 0);
        }
      }

      // Calculate new totals
      const gst =
        updateData.gst_amount !== undefined
          ? updateData.gst_amount
          : Number(existingInvoice.gst_amount);
      const billDiscount =
        updateData.discount_amount !== undefined
          ? updateData.discount_amount
          : Number(existingInvoice.discount_amount);
      const total_discount = totalItemDiscount + billDiscount;
      const amount_after_discount = Math.max(0, subtotal - total_discount);
      const total_amount = amount_after_discount + gst;

      // Update invoice
      const invoice = await tx.invoice.update({
        where: {
          id: invoice_id,
        },
        data: {
          customer_id: updateData.customer_id ? BigInt(updateData.customer_id) : undefined,
          subtotal_amount: subtotal,
          discount_amount: total_discount,
          gst_amount: gst,
          total_amount,
          invoice_url: updateData.invoice_url,
        },
      });

      return invoice;
    });

    // Audit log
    AuditLogger.create(tenant_id, updated_by, 'invoice', invoice_id, {
      action: 'update',
      invoice_number: existingInvoice.invoice_number,
      changes: updateData,
    });

    return this.getInvoiceById(invoice_id, tenant_id);
  }

  /**
   * Finalize DRAFT invoice
   * Moves invoice from DRAFT to UNPAID, deducts inventory, updates customer balance
   */
  async finalizeInvoice(invoice_id: bigint, tenant_id: bigint, finalized_by: bigint) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoice_id,
        tenant_id,
      },
      include: {
        invoice_items: {
          include: {
            product_variants: {
              include: {
                products: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestError(
        `Cannot finalize invoice in ${invoice.status} status. Only DRAFT invoices can be finalized.`
      );
    }

    // Use transaction
    await prisma.$transaction(async (tx) => {
      // Check inventory for all items
      for (const item of invoice.invoice_items) {
        if (!item.variant_id) {
          throw new BadRequestError('Invalid invoice item: missing variant_id');
        }

        const inventory = await tx.inventory.findFirst({
          where: {
            variant_id: item.variant_id,
            tenant_id,
          },
        });

        if (!inventory) {
          throw new BadRequestError(
            `No inventory found for variant ${item.variant_id.toString()} (SKU: ${item.product_variants?.sku})`
          );
        }

        const currentQuantity = inventory.quantity ?? 0;
        const itemQuantity = item.quantity || 0;
        if (currentQuantity < itemQuantity) {
          throw new BadRequestError(
            `Insufficient inventory for variant ${item.variant_id.toString()} (SKU: ${item.product_variants?.sku}). Available: ${currentQuantity}, Required: ${itemQuantity}`
          );
        }
      }

      // Reduce inventory
      for (const item of invoice.invoice_items) {
        if (!item.variant_id) continue;
        await this.inventoryRepository.reduceQuantity(
          item.variant_id,
          tenant_id,
          item.quantity || 0,
          tx
        );
      }

      // Create ledger entry
      await tx.customer_ledger.create({
        data: {
          customer_id: invoice.customer_id!,
          tenant_id,
          entry_type: 'INVOICE',
          amount: invoice.total_amount!,
          reference_id: invoice_id,
          description: `Invoice ${invoice.invoice_number}`,
          created_by: finalized_by,
        },
      });

      // Update customer balance with optimistic locking
      const customer = await tx.customer.findUnique({
        where: { id: invoice.customer_id! },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const updatedCustomer = await tx.customer.updateMany({
        where: {
          id: invoice.customer_id!,
          version: customer.version,
        },
        data: {
          credit_balance: {
            increment: invoice.total_amount!,
          },
          version: {
            increment: 1,
          },
        },
      });

      if (updatedCustomer.count === 0) {
        throw new Error(
          'Customer balance update failed due to concurrent modification. Please retry.'
        );
      }

      // Update invoice status
      const updated = await tx.invoice.update({
        where: {
          id: invoice_id,
        },
        data: {
          status: 'UNPAID',
          finalized_at: new Date(),
        },
      });

      return updated;
    });

    // Audit log
    AuditLogger.create(tenant_id, finalized_by, 'invoice', invoice_id, {
      action: 'finalize',
      invoice_number: invoice.invoice_number,
      total_amount: Number(invoice.total_amount),
    });

    return this.getInvoiceById(invoice_id, tenant_id);
  }

  /**
   * Cancel invoice
   * Can cancel DRAFT, UNPAID, or PARTIAL invoices
   * Restores inventory and reverses customer balance for finalized invoices
   */
  async cancelInvoice(
    invoice_id: bigint,
    tenant_id: bigint,
    cancelled_by: bigint,
    reason?: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoice_id,
        tenant_id,
      },
      include: {
        invoice_items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Cannot cancel already paid or cancelled invoices
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot cancel invoice in ${invoice.status} status.`);
    }

    const wasFinalizedOrPartial =
      invoice.status === 'UNPAID' || invoice.status === 'PARTIAL' || invoice.status === 'FINALIZED';

    // Use transaction
    await prisma.$transaction(async (tx) => {
      // If invoice was finalized, restore inventory and reverse customer balance
      if (wasFinalizedOrPartial) {
        // Restore inventory
        for (const item of invoice.invoice_items) {
          if (!item.variant_id) continue;
          await this.inventoryRepository.increaseQuantity(
            item.variant_id,
            tenant_id,
            item.quantity || 0,
            tx
          );
        }

        // Reverse customer ledger
        await tx.customer_ledger.create({
          data: {
            customer_id: invoice.customer_id!,
            tenant_id,
            entry_type: 'ADJUSTMENT',
            amount: -(Number(invoice.total_amount) - Number(invoice.paid_amount || 0)),
            reference_id: invoice_id,
            description: `Cancelled Invoice ${invoice.invoice_number}${reason ? ` - ${reason}` : ''}`,
            created_by: cancelled_by,
          },
        });

        // Update customer balance
        const customer = await tx.customer.findUnique({
          where: { id: invoice.customer_id! },
        });

        if (!customer) {
          throw new NotFoundError('Customer not found');
        }

        const balanceAdjustment = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);

        const updatedCustomer = await tx.customer.updateMany({
          where: {
            id: invoice.customer_id!,
            version: customer.version,
          },
          data: {
            credit_balance: {
              decrement: balanceAdjustment,
            },
            version: {
              increment: 1,
            },
          },
        });

        if (updatedCustomer.count === 0) {
          throw new Error(
            'Customer balance update failed due to concurrent modification. Please retry.'
          );
        }
      }

      // Update invoice status
      const updated = await tx.invoice.update({
        where: {
          id: invoice_id,
        },
        data: {
          status: 'CANCELLED',
          cancelled_at: new Date(),
        },
      });

      return updated;
    });

    // Audit log
    AuditLogger.create(tenant_id, cancelled_by, 'invoice', invoice_id, {
      action: 'cancel',
      invoice_number: invoice.invoice_number,
      reason: reason || 'No reason provided',
      previous_status: invoice.status,
    });

    return this.getInvoiceById(invoice_id, tenant_id);
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
    const { invoices, total } = await this.invoiceRepository.findByCustomerId(
      customer_id,
      tenant_id,
      options
    );

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
            unit_price: item.unit_price, // Price per unit (original or overridden)
            discount_amount: item.discount_amount || 0, // Item-level discount
            final_price: item.final_price, // Final price after discount
            price: item.price, // Total line price (for backward compatibility)
            total: item.final_price, // Use final_price as total
            variant: item.product_variants
              ? {
                  id: item.product_variants.id.toString(),
                  sku: item.product_variants.sku,
                  price: item.product_variants.price,
                  selling_price: item.product_variants.selling_price,
                  mrp_price: item.product_variants.mrp_price,
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
      subtotal_amount: invoice.subtotal_amount, // Amount before discounts and GST
      discount_amount: invoice.discount_amount || 0, // Total discount (items + bill-level)
      gst_amount: invoice.gst_amount || 0,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      balance_amount: Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0),
      status: invoice.status,
      invoice_url: invoice.invoice_url,
      created_at: invoice.created_at,
      finalized_at: invoice.finalized_at,
      cancelled_at: invoice.cancelled_at,
    };
  }

  /**
   * Get pending invoices for a customer (UNPAID and PARTIAL status)
   */
  async getPendingInvoicesByCustomer(customer_id: bigint, tenant_id: bigint) {
    const invoices = await prisma.invoice.findMany({
      where: {
        tenant_id,
        customer_id,
        status: {
          in: ['UNPAID', 'PARTIAL'],
        },
      },
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc', // Oldest first
      },
    });

    return invoices.map((invoice) => ({
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
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      balance_amount: Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0),
      status: invoice.status,
      created_at: invoice.created_at,
      finalized_at: invoice.finalized_at,
    }));
  }
}
