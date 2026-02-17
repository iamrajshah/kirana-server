import { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';
import { CustomerRequest } from '@middlewares/customer-auth.middleware';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  createPayment = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const created_by = BigInt(user!.userId);
    const {
      customer_id,
      amount,
      payment_mode,
      invoice_id,
      reference_note,
      idempotency_key,
      invoice_allocations,
    } = req.body;

    // Idempotency key from header takes precedence over body
    const idempotencyKey = (req.headers['idempotency-key'] as string) || idempotency_key;

    const payment = await this.paymentService.createPayment(
      tenant_id,
      BigInt(customer_id),
      amount,
      payment_mode,
      created_by,
      invoice_id,
      reference_note,
      idempotencyKey,
      invoice_allocations
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  };

  getAllPayments = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
    const take = req.query.take ? parseInt(req.query.take as string) : undefined;

    const result = await this.paymentService.getAllPayments(tenant_id, {
      skip,
      take,
    });

    res.json({
      success: true,
      data: result.payments,
      pagination: {
        total: result.total,
        skip: skip || 0,
        take: take || result.total,
      },
    });
  };

  getPaymentById = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const payment_id = BigInt(req.params.id);

    const payment = await this.paymentService.getPaymentById(payment_id, tenant_id);

    res.json({
      success: true,
      data: payment,
    });
  };

  getPaymentsByCustomer = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const customer_id = BigInt(req.params.customerId);
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
    const take = req.query.take ? parseInt(req.query.take as string) : undefined;

    const result = await this.paymentService.getPaymentsByCustomer(customer_id, tenant_id, {
      skip,
      take,
    });

    res.json({
      success: true,
      data: result.payments,
      pagination: {
        total: result.total,
        skip: skip || 0,
        take: take || result.total,
      },
    });
  };

  // Customer-facing endpoints

  /**
   * Create payment intent - POST /payments/intent
   */
  createPaymentIntent = async (req: Request, res: Response) => {
    const { tenant, customer } = req as unknown as CustomerRequest;
    const tenantId = tenant.id;
    const customerId = customer.id;
    const { invoice_id, amount } = req.body;

    const intent = await this.paymentService.createPaymentIntent(
      tenantId,
      customerId,
      BigInt(invoice_id),
      amount
    );

    res.status(200).json({
      success: true,
      message: 'Payment intent created',
      data: intent,
    });
  };

  /**
   * Get payments by invoice - GET /payments?invoiceId=
   */
  getPaymentsByInvoice = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const invoice_id = req.query.invoiceId ? BigInt(req.query.invoiceId as string) : undefined;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId query parameter is required',
      });
    }

    const payments = await this.paymentService.getPaymentsByInvoice(invoice_id, tenant_id);

    return res.json({
      success: true,
      data: payments,
    });
  };
}
