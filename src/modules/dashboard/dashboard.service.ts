import { prisma } from '@config/database';

export class DashboardService {
  /**
   * Get dashboard statistics
   */
  async getStats(tenantId: bigint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales (sum of all invoices created today)
    const todaySales = await prisma.invoice.aggregate({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        total_amount: true,
      },
    });

    // Pending invoices count (UNPAID)
    const pendingInvoices = await prisma.invoice.count({
      where: {
        tenant_id: tenantId,
        status: 'UNPAID',
      },
    });

    // Low stock items count
    const lowStockItems = await prisma.inventory.count({
      where: {
        tenant_id: tenantId,
        quantity: {
          lte: prisma.inventory.fields.low_stock_threshold,
        },
      },
    });

    // Total customers count
    const totalCustomers = await prisma.customer.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    // Total supplier payables (amount we owe suppliers)
    const supplierPayables = await prisma.supplier_ledger.aggregate({
      where: {
        tenant_id: tenantId,
      },
      _sum: {
        credit: true,
        debit: true,
      },
    });

    const totalPayables =
      Number(supplierPayables._sum.credit || 0) - Number(supplierPayables._sum.debit || 0);

    return {
      today_sales: Number(todaySales._sum.total_amount || 0),
      pending_invoices: pendingInvoices,
      low_stock_items: lowStockItems,
      total_customers: totalCustomers,
      supplier_payables: totalPayables,
    };
  }
}
