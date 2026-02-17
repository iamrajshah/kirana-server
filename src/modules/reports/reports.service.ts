import { ReportsRepository } from './reports.repository';
import { serializeBigInt } from '@utils/serializeBigInt';

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

    return serializeBigInt({
      summary: {
        total_customers: customers.length,
        total_outstanding: totalOutstanding,
      },
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        outstanding_balance: Number(customer.credit_balance || 0),
      })),
    });
  }

  /**
   * Get inventory summary report
   */
  async getInventorySummary(tenant_id: bigint) {
    const summary = await this.reportsRepository.getInventorySummary(tenant_id);
    const stockList = await this.reportsRepository.getInventoryStockList(tenant_id);

    return serializeBigInt({
      summary: {
        total_items: summary.totalItems,
        low_stock_items: summary.lowStockItems,
        out_of_stock_items: summary.outOfStockItems,
        total_inventory_value: summary.totalValue,
      },
      items: stockList.map((item) => ({
        variant_id: item.variant_id,
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
    });
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

    return serializeBigInt({
      products: products.map((product: any) => ({
        variant_id: product.variant_id,
        sku: product.sku,
        product_name: product.product_name,
        brand: product.brand,
        size: product.size,
        total_sold: Number(product.total_sold || 0),
        total_revenue: Number(product.total_revenue || 0),
      })),
    });
  }

  /**
   * SUPPLIER & PURCHASE REPORTS
   */

  /**
   * Get supplier outstanding report
   */
  async getSupplierOutstanding(
    tenant_id: bigint,
    page: number = 1,
    limit: number = 50,
    minAmount?: number
  ) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.reportsRepository.getSupplierOutstanding(tenant_id, {
      skip,
      take: limit,
      minAmount,
    });

    return serializeBigInt({
      data: data.map((supplier: any) => ({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        outstanding_balance: Number(supplier.outstanding_balance || 0),
        total_invoices: Number(supplier.total_invoices || 0),
        last_transaction_date: supplier.last_transaction_date,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get purchase register
   */
  async getPurchaseRegister(
    tenant_id: bigint,
    page: number = 1,
    limit: number = 50,
    filters?: {
      from?: string;
      to?: string;
      supplierId?: string;
      status?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const { data, total, summary } = await this.reportsRepository.getPurchaseRegister(tenant_id, {
      skip,
      take: limit,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      supplierId: filters?.supplierId ? BigInt(filters.supplierId) : undefined,
      status: filters?.status,
    });

    return serializeBigInt({
      data: data.map((purchase: any) => ({
        id: purchase.id,
        invoice_number: purchase.invoice_number,
        invoice_date: purchase.invoice_date,
        total_amount: Number(purchase.total_amount || 0),
        paid_amount: Number(purchase.paid_amount || 0),
        pending_amount: Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0),
        status: purchase.status,
        supplier_name: purchase.supplier_name,
        supplier_phone: purchase.supplier_phone,
        item_count: Number(purchase.item_count || 0),
        created_at: purchase.created_at,
      })),
      summary: {
        total_purchases: Number(summary.total_purchases || 0),
        total_amount: Number(summary.total_amount || 0),
        total_paid: Number(summary.total_paid || 0),
        total_outstanding: Number(summary.total_outstanding || 0),
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get supplier ledger summary
   */
  async getSupplierLedgerSummary(
    tenant_id: bigint,
    page: number = 1,
    limit: number = 50,
    filters?: {
      from?: string;
      to?: string;
      supplierId?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.reportsRepository.getSupplierLedgerSummary(tenant_id, {
      skip,
      take: limit,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      supplierId: filters?.supplierId ? BigInt(filters.supplierId) : undefined,
    });

    return serializeBigInt({
      data: data.map((supplier: any) => ({
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.supplier_name,
        phone: supplier.phone,
        email: supplier.email,
        transaction_count: Number(supplier.transaction_count || 0),
        total_credit: Number(supplier.total_credit || 0),
        total_debit: Number(supplier.total_debit || 0),
        balance: Number(supplier.balance || 0),
        first_transaction: supplier.first_transaction,
        last_transaction: supplier.last_transaction,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get top payables
   */
  async getTopPayables(tenant_id: bigint, limit: number = 10) {
    const data = await this.reportsRepository.getTopPayables(tenant_id, limit);

    return serializeBigInt({
      data: data.map((supplier: any) => ({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        outstanding_amount: Number(supplier.outstanding_amount || 0),
        unpaid_invoices: Number(supplier.unpaid_invoices || 0),
        latest_invoice_date: supplier.latest_invoice_date,
        last_transaction_date: supplier.last_transaction_date,
      })),
    });
  }

  /**
   * Get purchase trend by month
   */
  async getPurchaseTrend(tenant_id: bigint, months: number = 12) {
    const data = await this.reportsRepository.getPurchaseTrendByMonth(tenant_id, months);

    return {
      data: data.map((month: any) => ({
        month: month.month,
        purchase_count: Number(month.purchase_count || 0),
        total_amount: Number(month.total_amount || 0),
        paid_amount: Number(month.paid_amount || 0),
        avg_purchase_value: Number(month.avg_purchase_value || 0),
      })),
    };
  }

  /**
   * Get supplier payment history
   */
  async getSupplierPaymentHistory(
    tenant_id: bigint,
    supplier_id: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      from?: string;
      to?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.reportsRepository.getSupplierPaymentHistory(
      tenant_id,
      BigInt(supplier_id),
      {
        skip,
        take: limit,
        from: filters?.from ? new Date(filters.from) : undefined,
        to: filters?.to ? new Date(filters.to) : undefined,
      }
    );

    return serializeBigInt({
      data: data.map((entry: any) => ({
        id: entry.id,
        ref_type: entry.ref_type,
        ref_id: entry.ref_id,
        credit: Number(entry.credit || 0),
        debit: Number(entry.debit || 0),
        balance: Number(entry.balance || 0),
        payment_mode: entry.payment_mode,
        description: entry.description,
        created_at: entry.created_at,
        invoice_number: entry.invoice_number,
        invoice_date: entry.invoice_date,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}
