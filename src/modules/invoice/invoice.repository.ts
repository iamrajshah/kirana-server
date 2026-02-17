import { prisma } from '@config/database';

export class InvoiceRepository {
  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(tenant_id: bigint): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const prefix = `INV-${year}${month}-`;

    // Get the last invoice for this tenant in this month
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenant_id,
        invoice_number: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoice_number: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice && lastInvoice.invoice_number) {
      const lastSequence = parseInt(lastInvoice.invoice_number.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Create invoice within a transaction
   */
  async createInvoice(
    data: {
      tenant_id: bigint;
      customer_id: bigint;
      invoice_number: string;
      total_amount: number;
      gst_amount: number;
      status: 'PAID' | 'UNPAID';
      invoice_url?: string;
    },
    tx: any
  ): Promise<any> {
    return tx.invoice.create({
      data,
    });
  }

  /**
   * Get all invoices for a tenant
   */
  async findAllByTenant(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      customer_id?: bigint;
    }
  ): Promise<{ invoices: any[]; total: number }> {
    const where: any = {
      tenant_id,
    };

    if (options?.customer_id) {
      where.customer_id = options.customer_id;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          customers: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          invoice_items: {
            include: {
              product_variants: {
                include: {
                  products: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Get invoice by ID
   */
  async findById(invoice_id: bigint, tenant_id: bigint): Promise<any | null> {
    return prisma.invoice.findFirst({
      where: {
        id: invoice_id,
        tenant_id,
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
        invoice_items: {
          include: {
            product_variants: {
              include: {
                products: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get invoices by customer ID
   */
  async findByCustomerId(
    customer_id: bigint,
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ): Promise<{ invoices: any[]; total: number }> {
    return this.findAllByTenant(tenant_id, {
      ...options,
      customer_id,
    });
  }
}
