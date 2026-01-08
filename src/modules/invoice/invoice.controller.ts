import { Request, Response } from 'express';
import { InvoiceService } from './invoice.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';

export class InvoiceController {
  private invoiceService: InvoiceService;

  constructor() {
    this.invoiceService = new InvoiceService();
  }

  createInvoice = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const created_by = BigInt(user!.userId);
    const {
      customer_id,
      items,
      gst_amount,
      invoice_url,
      idempotency_key,
      discount_amount,
      status,
    } = req.body;

    // Idempotency key from header takes precedence over body
    const idempotencyKey = (req.headers['idempotency-key'] as string) || idempotency_key;

    const invoice = await this.invoiceService.createInvoice(
      tenant_id,
      BigInt(customer_id),
      items,
      gst_amount || 0,
      invoice_url,
      created_by,
      idempotencyKey,
      discount_amount || 0,
      status || 'DRAFT'
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  };

  updateInvoice = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const updated_by = BigInt(user!.userId);
    const invoice_id = BigInt(req.params.id);

    const invoice = await this.invoiceService.updateInvoice(
      invoice_id,
      tenant_id,
      req.body,
      updated_by
    );

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice,
    });
  };

  finalizeInvoice = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const finalized_by = BigInt(user!.userId);
    const invoice_id = BigInt(req.params.id);

    const invoice = await this.invoiceService.finalizeInvoice(invoice_id, tenant_id, finalized_by);

    res.json({
      success: true,
      message: 'Invoice finalized successfully',
      data: invoice,
    });
  };

  cancelInvoice = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const cancelled_by = BigInt(user!.userId);
    const invoice_id = BigInt(req.params.id);
    const { reason } = req.body;

    const invoice = await this.invoiceService.cancelInvoice(
      invoice_id,
      tenant_id,
      cancelled_by,
      reason
    );

    res.json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice,
    });
  };

  getPendingInvoicesByCustomer = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const customer_id = BigInt(req.params.customerId);

    const invoices = await this.invoiceService.getPendingInvoicesByCustomer(customer_id, tenant_id);

    res.json({
      success: true,
      data: invoices,
    });
  };

  getAllInvoices = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
    const take = req.query.take ? parseInt(req.query.take as string) : undefined;

    const result = await this.invoiceService.getAllInvoices(tenant_id, {
      skip,
      take,
    });

    res.json({
      success: true,
      data: result.invoices,
      pagination: {
        total: result.total,
        skip: skip || 0,
        take: take || result.total,
      },
    });
  };

  getInvoiceById = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const invoice_id = BigInt(req.params.id);

    const invoice = await this.invoiceService.getInvoiceById(invoice_id, tenant_id);

    res.json({
      success: true,
      data: invoice,
    });
  };

  getInvoicesByCustomer = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const customer_id = BigInt(req.params.customerId);
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
    const take = req.query.take ? parseInt(req.query.take as string) : undefined;

    const result = await this.invoiceService.getInvoicesByCustomer(customer_id, tenant_id, {
      skip,
      take,
    });

    res.json({
      success: true,
      data: result.invoices,
      pagination: {
        total: result.total,
        skip: skip || 0,
        take: take || result.total,
      },
    });
  };

  // Customer-facing endpoints

  /**
   * Create invoice from order - POST /invoices/from-order/:orderId
   */
  createInvoiceFromOrder = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const tenant_id = BigInt(tenantId);
    const created_by = BigInt(user!.userId);
    const order_id = BigInt(req.params.orderId);

    // Check if invoice already exists for this order
    const existingInvoice = await this.invoiceService.getInvoiceByOrderId(order_id, tenant_id);
    
    if (existingInvoice) {
      return res.json({
        success: true,
        message: 'Invoice already exists for this order',
        data: existingInvoice,
      });
    }

    const invoice = await this.invoiceService.createInvoiceFromOrder(order_id, tenant_id, created_by);

    return res.status(201).json({
      success: true,
      message: 'Invoice created from order successfully',
      data: invoice,
    });
  };

  /**
   * Update invoice items - PATCH /invoices/:id/items
   */
  updateInvoiceItems = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const invoice_id = BigInt(req.params.id);
    const { items } = req.body;

    const invoice = await this.invoiceService.updateInvoiceItemsOnly(
      invoice_id,
      tenant_id,
      items
    );

    return res.json({
      success: true,
      message: 'Invoice items updated successfully',
      data: invoice,
    });
  };

  /**
   * Get invoice - GET /invoices/:id
   */
  getInvoice = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const invoice_id = BigInt(req.params.id);

    const invoice = await this.invoiceService.getInvoiceById(invoice_id, tenant_id);

    res.json({
      success: true,
      data: invoice,
    });
  };
}
