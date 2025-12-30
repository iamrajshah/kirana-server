import { PaymentRepository } from './payment.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { prisma } from '@config/database';

export class PaymentService {
  private paymentRepository: PaymentRepository;

  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  /**
   * Create payment with atomic transaction
   * Steps:
   * 1. Validate customer exists
   * 2. Validate amount > 0
   * 3. If invoice_id provided, validate invoice exists and belongs to customer
   * 4. Create payment
   * 5. Create ledger entry (PAYMENT type - negative amount)
   * 6. Update customer.credit_balance
   */
  async createPayment(
    tenant_id: bigint,
    customer_id: bigint,
    amount: number,
    payment_mode: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'ADJUSTMENT',
    created_by: bigint,
    invoice_id?: string,
    reference_note?: string
  ) {
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

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create payment
      const payment = await this.paymentRepository.createPayment(
        {
          tenant_id,
          customer_id,
          invoice_id: invoice_id_bigint,
          amount,
          payment_mode,
          reference_note,
        },
        tx
      );

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

      // Step 3: Update customer balance
      await tx.customer.update({
        where: {
          id: customer_id,
        },
        data: {
          credit_balance: {
            decrement: amount,
          },
        },
      });

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
    });

    // Fetch the created payment with all details
    return this.getPaymentById(result.id, tenant_id);
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
