import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private reportsRepository: ReportsRepository;

  constructor() {
    this.reportsRepository = new ReportsRepository();
  }

  /**
   * Get sales report summary
   */
  async getSalesReport(tenant_id: bigint, from?: string, to?: string, groupBy?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
      const dailySales = await this.reportsRepository.getDailySales(tenant_id, fromDate, toDate);
      return {
        breakdown: dailySales.map((item: any) => ({
          date: item.date,
          invoice_count: Number(item.invoice_count),
          total_sales: Number(item.total_sales || 0),
          total_gst: Number(item.total_gst || 0),
          paid_count: Number(item.paid_count || 0),
          unpaid_count: Number(item.unpaid_count || 0),
        })),
      };
    }

    const summary = await this.reportsRepository.getSalesSummary(tenant_id, fromDate, toDate);

    return {
      summary: {
        total_sales: summary.totalSales,
        total_invoices: summary.totalInvoices,
        total_gst: summary.totalGst,
        paid_invoices: summary.paidInvoices,
        unpaid_invoices: summary.unpaidInvoices,
        average_invoice_value:
          summary.totalInvoices > 0 ? summary.totalSales / summary.totalInvoices : 0,
      },
      period: {
        from: fromDate?.toISOString(),
        to: toDate?.toISOString(),
      },
    };
  }

  /**
   * Get outstanding customers report
   */
  async getOutstandingCustomers(tenant_id: bigint) {
    const customers = await this.reportsRepository.getOutstandingCustomers(tenant_id);

    const totalOutstanding = customers.reduce(
      (sum, customer) => sum + Number(customer.credit_balance || 0),
      0
    );

    return {
      summary: {
        total_customers: customers.length,
        total_outstanding: totalOutstanding,
      },
      customers: customers.map((customer) => ({
        id: customer.id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        outstanding_balance: Number(customer.credit_balance || 0),
      })),
    };
  }

  /**
   * Get inventory summary report
   */
  async getInventorySummary(tenant_id: bigint) {
    const summary = await this.reportsRepository.getInventorySummary(tenant_id);
    const stockList = await this.reportsRepository.getInventoryStockList(tenant_id);

    return {
      summary: {
        total_items: summary.totalItems,
        low_stock_items: summary.lowStockItems,
        out_of_stock_items: summary.outOfStockItems,
        total_inventory_value: summary.totalValue,
      },
      items: stockList.map((item) => ({
        variant_id: item.variant_id.toString(),
        product_name: item.product_variants?.products?.name,
        sku: item.product_variants?.sku,
        brand: item.product_variants?.brand,
        size: item.product_variants?.size,
        quantity: item.quantity ?? 0,
        low_stock_threshold: item.low_stock_threshold ?? 5,
        price: Number(item.product_variants?.price || 0),
        stock_value: (item.quantity ?? 0) * Number(item.product_variants?.price || 0),
        is_low_stock: (item.quantity ?? 0) <= (item.low_stock_threshold ?? 5),
        is_active: item.product_variants?.products?.is_active ?? false,
      })),
    };
  }

  /**
   * Get daily cashbook report
   */
  async getDailyCashbook(tenant_id: bigint, date?: string) {
    const reportDate = date ? new Date(date) : new Date();
    const cashbook = await this.reportsRepository.getDailyCashbook(tenant_id, reportDate);

    const totalCollection = cashbook.reduce(
      (sum, entry: any) => sum + Number(entry.total_amount || 0),
      0
    );

    return {
      date: reportDate.toISOString().split('T')[0],
      summary: {
        total_collection: totalCollection,
        total_transactions: cashbook.reduce(
          (sum, entry: any) => sum + Number(entry.transaction_count || 0),
          0
        ),
      },
      breakdown: cashbook.map((entry: any) => ({
        payment_mode: entry.payment_mode,
        transaction_count: Number(entry.transaction_count || 0),
        total_amount: Number(entry.total_amount || 0),
      })),
    };
  }

  /**
   * Get profit & loss report
   */
  async getProfitLoss(tenant_id: bigint, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const data = await this.reportsRepository.getProfitLoss(tenant_id, fromDate, toDate);

    return {
      period: {
        from: fromDate?.toISOString(),
        to: toDate?.toISOString(),
      },
      revenue: {
        gross_revenue: data.revenue,
        gst_collected: data.gstCollected,
        net_revenue: data.netRevenue,
      },
      collections: {
        total_payments: data.totalPayments,
        outstanding_amount: data.outstandingAmount,
        collection_efficiency:
          data.revenue > 0 ? ((data.totalPayments / data.revenue) * 100).toFixed(2) : 0,
      },
      summary: {
        cash_in_hand: data.totalPayments,
        receivables: data.outstandingAmount,
      },
    };
  }

  /**
   * Get top selling products
   */
  async getTopSellingProducts(tenant_id: bigint, limit: number = 10) {
    const products = await this.reportsRepository.getTopSellingProducts(tenant_id, limit);

    return {
      products: products.map((product: any) => ({
        variant_id: product.variant_id?.toString(),
        sku: product.sku,
        product_name: product.product_name,
        brand: product.brand,
        size: product.size,
        total_sold: Number(product.total_sold || 0),
        total_revenue: Number(product.total_revenue || 0),
      })),
    };
  }
}
