import { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import { TenantRequest } from '@middlewares/tenant.middleware';

export class ReportsController {
  private reportsService: ReportsService;

  constructor() {
    this.reportsService = new ReportsService();
  }

  getSalesReport = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const { from, to, groupBy } = req.query;

    const report = await this.reportsService.getSalesReport(
      tenant_id,
      from as string,
      to as string,
      groupBy as string
    );

    res.json({
      success: true,
      data: report,
    });
  };

  getOutstandingCustomers = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);

    const report = await this.reportsService.getOutstandingCustomers(tenant_id);

    res.json({
      success: true,
      data: report,
    });
  };

  getInventorySummary = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);

    const report = await this.reportsService.getInventorySummary(tenant_id);

    res.json({
      success: true,
      data: report,
    });
  };

  getDailyCashbook = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const { date } = req.query;

    const report = await this.reportsService.getDailyCashbook(tenant_id, date as string);

    res.json({
      success: true,
      data: report,
    });
  };

  getProfitLoss = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const { from, to } = req.query;

    const report = await this.reportsService.getProfitLoss(tenant_id, from as string, to as string);

    res.json({
      success: true,
      data: report,
    });
  };

  getTopSellingProducts = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const report = await this.reportsService.getTopSellingProducts(tenant_id, limit);

    res.json({
      success: true,
      data: report,
    });
  };

  /**
   * SUPPLIER & PURCHASE REPORTS
   */

  getSupplierOutstanding = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;

    const report = await this.reportsService.getSupplierOutstanding(
      tenant_id,
      page,
      limit,
      minAmount
    );

    res.json({
      success: true,
      data: report.data,
      pagination: report.pagination,
    });
  };

  getPurchaseRegister = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const { from, to, supplierId, status } = req.query;

    const report = await this.reportsService.getPurchaseRegister(tenant_id, page, limit, {
      from: from as string,
      to: to as string,
      supplierId: supplierId as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: report.data,
      summary: report.summary,
      pagination: report.pagination,
    });
  };

  getSupplierLedgerSummary = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const { from, to, supplierId } = req.query;

    const report = await this.reportsService.getSupplierLedgerSummary(tenant_id, page, limit, {
      from: from as string,
      to: to as string,
      supplierId: supplierId as string,
    });

    res.json({
      success: true,
      data: report.data,
      pagination: report.pagination,
    });
  };

  getTopPayables = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const report = await this.reportsService.getTopPayables(tenant_id, limit);

    res.json({
      success: true,
      data: report.data,
    });
  };

  getPurchaseTrend = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const months = req.query.months ? parseInt(req.query.months as string) : 12;

    const report = await this.reportsService.getPurchaseTrend(tenant_id, months);

    res.json({
      success: true,
      data: report.data,
    });
  };

  getSupplierPaymentHistory = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const { supplierId } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const { from, to } = req.query;

    const report = await this.reportsService.getSupplierPaymentHistory(
      tenant_id,
      supplierId,
      page,
      limit,
      {
        from: from as string,
        to: to as string,
      }
    );

    res.json({
      success: true,
      data: report.data,
      pagination: report.pagination,
    });
  };
}
