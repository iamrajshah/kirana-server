import { PaymentRepository } from './payment.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { prisma } from '@config/database';
import { AuditLogger } from '@utils/auditLogger';

export class PaymentService {
  private paymentRepository: PaymentRepository;

  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  /**
   * Create payment with atomic transaction and idempotency support
   * Supports multi-invoice payment allocation
   * Idempotency is enforced using the unique constraint on (tenant_id, idempotency_key)
   * If a duplicate idempotency key is provided, returns the existing payment instead of creating a new one
   */
  async createPayment(
    tenant_id: bigint,
    customer_id: bigint,
    amount: number,
    payment_mode: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'ADJUSTMENT',
    created_by: bigint,
    invoice_id?: string,
    reference_note?: string,
    idempotency_key?: string,
    invoice_allocations?: Array<{ invoice_id: string; amount: number }> // Multi-invoice support
  ) {
    // If idempotency key is provided, check for existing payment
    if (idempotency_key) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          tenant_id,
          idempotency_key,
        },
      });

      if (existingPayment) {
        // Return existing payment with full details
        return this.getPaymentById(existingPayment.id, tenant_id);
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

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    let invoice_id_bigint: bigint | undefined;
    let allocations: Array<{ invoice_id: bigint; amount: number }> = [];

    // Handle multi-invoice allocation
    if (invoice_allocations && invoice_allocations.length > 0) {
      // Validate all invoices and calculate total allocated
      let totalAllocated = 0;
      for (const allocation of invoice_allocations) {
        const invoice = await prisma.invoice.findFirst({
          where: {
            id: BigInt(allocation.invoice_id),
            tenant_id,
            customer_id,
            status: {
              in: ['UNPAID', 'PARTIAL'],
            },
          },
        });

        if (!invoice) {
          throw new NotFoundError(
            `Invoice ${allocation.invoice_id} not found or not eligible for payment`
          );
        }

        const balance = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
        if (allocation.amount > balance) {
          throw new BadRequestError(
            `Allocation amount ${allocation.amount} exceeds invoice ${allocation.invoice_id} balance ${balance}`
          );
        }

        allocations.push({
          invoice_id: BigInt(allocation.invoice_id),
          amount: allocation.amount,
        });
        totalAllocated += allocation.amount;
      }

      if (totalAllocated > amount) {
        throw new BadRequestError('Total allocated amount exceeds payment amount');
      }
    } else if (invoice_id) {
      // Single invoice payment (legacy support)
      invoice_id_bigint = BigInt(invoice_id);
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoice_id_bigint,
          tenant_id,
          customer_id,
        },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice not found or does not belong to this customer');
      }

      allocations = [{ invoice_id: invoice_id_bigint, amount }];
    }

    // Use Prisma transaction for atomicity with increased timeout
    const payment = await prisma.$transaction(async (tx) => {
      // Step 1: Create payment with idempotency key
      const payment = await tx.payment.create({
        data: {
          tenant_id,
          customer_id,
          invoice_id: allocations.length === 1 ? allocations[0].invoice_id : undefined, // Legacy single invoice support
          amount,
          payment_mode,
          reference_note,
          idempotency_key, // Store idempotency key (can be null)
        },
      });

      // Step 2: Create ledger entry (negative amount for payment)
      await tx.customer_ledger.create({
        data: {
          customer_id,
          tenant_id,
          entry_type: 'PAYMENT',
          amount: -amount, // Negative because it reduces the balance
          reference_id: payment.id,
          description:
            allocations.length > 0
              ? `Payment for ${allocations.length} invoice(s)`
              : `Payment received - ${payment_mode}`,
          created_by,
        },
      });

      // Step 3: Update customer balance with optimistic locking
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
            decrement: amount,
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

      // Step 4: Process invoice allocations and update invoice statuses
      for (const allocation of allocations) {
        const invoice = await tx.invoice.findUnique({
          where: { id: allocation.invoice_id },
        });

        if (!invoice) {
          throw new NotFoundError(`Invoice ${allocation.invoice_id} not found`);
        }

        // Create invoice_payment junction record
        await tx.invoice_payments.create({
          data: {
            tenant_id,
            invoice_id: allocation.invoice_id,
            payment_id: payment.id,
            amount: allocation.amount,
          },
        });

        // Recalculate invoice status based on payment
        const currentPaidAmount = Number(invoice.paid_amount || 0);
        const newPaidAmount = currentPaidAmount + allocation.amount;
        const totalAmount = Number(invoice.total_amount || 0);

        // Determine new invoice status based on recalculated amounts
        let newStatus: 'DRAFT' | 'FINALIZED' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED' =
          invoice.status as any;

        if (newPaidAmount >= totalAmount) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0 && newPaidAmount < totalAmount) {
          newStatus = 'PARTIAL';
        } else if (newPaidAmount === 0 && invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED') {
          newStatus = 'UNPAID';
        }

        // Update invoice with new paid amount and recalculated status
        await tx.invoice.update({
          where: { id: allocation.invoice_id },
          data: {
            paid_amount: newPaidAmount,
            status: newStatus,
          },
        });
      }

      return payment;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    // Audit log
    AuditLogger.create(
      tenant_id,
      created_by,
      'payment',
      payment.id,
      {
        customer_id: customer_id.toString(),
        amount,
        payment_mode,
        invoice_id: invoice_id || null,
        reference_note: reference_note || null,
        idempotency_key: idempotency_key || null,
      }
    );

    // Fetch the created payment with all details
    return this.getPaymentById(payment.id, tenant_id);
  }

  /**
   * Get all payments for a tenant
   */
  async getAllPayments(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ) {
    const { payments, total } = await this.paymentRepository.findAllByTenant(tenant_id, options);

    return {
      payments: payments.map((payment) => this.formatPaymentResponse(payment)),
      total,
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(payment_id: bigint, tenant_id: bigint) {
    const payment = await this.paymentRepository.findById(payment_id, tenant_id);

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Get payments by customer ID
   */
  async getPaymentsByCustomer(
    customer_id: bigint,
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
    }
  ) {
    const { payments, total } = await this.paymentRepository.findByCustomerId(customer_id, tenant_id, options);

    return {
      payments: payments.map((payment) => this.formatPaymentResponse(payment)),
      total,
    };
  }

  /**
   * Format payment response
   */
  private formatPaymentResponse(payment: any) {
    return {
      id: payment.id.toString(),
      customer: payment.customers
        ? {
            id: payment.customers.id.toString(),
            name: payment.customers.name,
            phone: payment.customers.phone,
            email: payment.customers.email,
          }
        : null,
      invoice: payment.invoices
        ? {
            id: payment.invoices.id.toString(),
            invoice_number: payment.invoices.invoice_number,
            total_amount: payment.invoices.total_amount,
            paid_amount: payment.invoices.paid_amount,
            status: payment.invoices.status,
          }
        : null,
      amount: payment.amount,
      applied_amount: payment.applied_amount, // Amount actually applied to invoice
      payment_mode: payment.payment_mode,
      reference_note: payment.reference_note,
      created_at: payment.created_at,
    };
  }
}
