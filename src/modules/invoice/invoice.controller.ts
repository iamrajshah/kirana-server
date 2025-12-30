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
    const { customer_id, items, gst_amount, invoice_url } = req.body;

    const invoice = await this.invoiceService.createInvoice(
      tenant_id,
      BigInt(customer_id),
      items,
      gst_amount || 0,
      invoice_url,
      created_by
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
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
}
