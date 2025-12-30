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
    idempotency_key?: string
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

    // Validate invoice if provided
    if (invoice_id) {
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
    }

    // Use Prisma transaction for atomicity with increased timeout
    const payment = await prisma.$transaction(async (tx) => {
      // Step 1: Create payment with idempotency key
      const payment = await tx.payment.create({
        data: {
          tenant_id,
          customer_id,
          invoice_id: invoice_id_bigint,
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
          description: invoice_id
            ? `Payment for Invoice ${invoice_id}`
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

      // Step 4: If payment is for an invoice and amount >= invoice amount, mark invoice as PAID
      if (invoice_id_bigint) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoice_id_bigint },
        });

        if (invoice && invoice.total_amount && amount >= Number(invoice.total_amount)) {
          await tx.invoice.update({
            where: { id: invoice_id_bigint },
            data: { status: 'PAID' },
          });
        }
      }

      return payment;
    }, {
      maxWait: 10000, // Wait up to 10s to start transaction
      timeout: 30000, // Transaction timeout 30s
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
          }
        : null,
      amount: payment.amount,
      payment_mode: payment.payment_mode,
      reference_note: payment.reference_note,
      created_at: payment.created_at,
    };
  }
}
