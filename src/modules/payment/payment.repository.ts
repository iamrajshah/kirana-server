import { prisma } from '@config/database';

export class PaymentRepository {
  /**
   * Create payment within a transaction
   */
  async createPayment(
    data: {
      tenant_id: bigint;
      customer_id: bigint;
      invoice_id?: bigint;
      amount: number;
      payment_mode: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'ADJUSTMENT';
      reference_note?: string;
    },
    tx: any
  ): Promise<any> {
    return tx.payment.create({
      data,
    });
  }

  /**
   * Get all payments for a tenant
   */
  async findAllByTenant(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      customer_id?: bigint;
    }
  ): Promise<{ payments: any[]; total: number }> {
    const where: any = {
      tenant_id,
    };

    if (options?.customer_id) {
      where.customer_id = options.customer_id;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
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
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              total_amount: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  /**
   * Get payment by ID
   */
  async findById(payment_id: bigint, tenant_id: bigint): Promise<any | null> {
    return prisma.payment.findFirst({
      where: {
        id: payment_id,
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
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            total_amount: true,
          },
        },
      },
    });
  }

  /**
   * Get payments by customer ID
   */
  async findByCustomerId(
    customer_id: bigint,
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ): Promise<{ payments: any[]; total: number }> {
    return this.findAllByTenant(tenant_id, {
      ...options,
      customer_id,
    });
  }
}
