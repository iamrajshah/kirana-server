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

    const report = await this.reportsService.getProfitLoss(
      tenant_id,
      from as string,
      to as string
    );

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
}
