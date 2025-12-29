import { Customer, customer_ledger } from '@prisma/client';
import { CustomerRepository } from './customer.repository';
import { LedgerService } from './ledger.service';
import { CreateCustomerInput, UpdateCustomerInput, AddOpeningBalanceInput } from './customer.validation';
import { ConflictError, NotFoundError } from '@utils/errors';

export interface CustomerResponse {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  credit_balance: number;
  created_at: Date | null;
}

export interface CustomerLedgerResponse {
  id: string;
  entry_type: string | null;
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: Date | null;
  created_by: string | null;
}

export class CustomerService {
  private readonly repository: CustomerRepository;
  private readonly ledgerService: LedgerService;

  constructor() {
    this.repository = new CustomerRepository();
    this.ledgerService = new LedgerService();
  }

  /**
   * Create a new customer with optional opening balance
   */
  async create(tenantId: string, data: CreateCustomerInput, createdBy: string): Promise<CustomerResponse> {
    const tenantIdBigInt = BigInt(tenantId);

    // Check if customer with phone already exists
    const existingCustomer = await this.repository.findByPhone(data.phone, tenantId);
    if (existingCustomer) {
      throw new ConflictError('Customer with this phone number already exists');
    }

    // Check if email is provided and if it already exists
    if (data.email) {
      const existingEmail = await this.repository.findByEmail(data.email, tenantId);
      if (existingEmail) {
        throw new ConflictError('Customer with this email already exists');
      }
    }

    // Create customer
    const customer = await this.repository.createCustomer({
      tenant_id: tenantIdBigInt,
      name: data.name,
      phone: data.phone,
      email: data.email,
    });

    // If opening balance is provided and non-zero, create ledger entry
    if (data.opening_balance && data.opening_balance !== 0) {
      // Check if opening balance already exists (should never happen in create, but safeguard)
      const hasOpeningBalance = await this.ledgerService.hasOpeningBalance(
        customer.id,
        tenantIdBigInt
      );
      if (hasOpeningBalance) {
        throw new ConflictError('Opening balance already exists for this customer');
      }

      await this.ledgerService.createLedgerEntry({
        tenant_id: tenantIdBigInt,
        customer_id: customer.id,
        entry_type: 'OPENING_BALANCE',
        amount: data.opening_balance,
        description: 'Opening balance',
        created_by: BigInt(createdBy),
      });

      // Update customer balance
      await this.repository.updateBalance(customer.id, tenantIdBigInt, data.opening_balance);
    }

    return this.formatCustomerResponse(customer);
  }

  /**
   * Get all customers with pagination
   */
  async getAll(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
    searchQuery?: string
  ): Promise<{ customers: CustomerResponse[]; total: number; page: number; limit: number }> {
    const tenantIdBigInt = BigInt(tenantId);
    const skip = (page - 1) * limit;

    const { customers, total } = await this.repository.findAllByTenant(tenantIdBigInt, {
      skip,
      take: limit,
      searchQuery,
    });

    return {
      customers: customers.map((c) => this.formatCustomerResponse(c)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get customer by ID
   */
  async getById(customerId: string, tenantId: string): Promise<CustomerResponse> {
    const customerIdBigInt = BigInt(customerId);
    const tenantIdBigInt = BigInt(tenantId);

    const customer = await this.repository.findByIdAndTenant(customerIdBigInt, tenantIdBigInt);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    return this.formatCustomerResponse(customer);
  }

  /**
   * Update customer
   */
  async update(customerId: string, tenantId: string, data: UpdateCustomerInput): Promise<CustomerResponse> {
    const customerIdBigInt = BigInt(customerId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if customer exists
    const existingCustomer = await this.repository.findByIdAndTenant(customerIdBigInt, tenantIdBigInt);
    if (!existingCustomer) {
      throw new NotFoundError('Customer not found');
    }

    // If phone is being updated, check for duplicates
    if (data.phone && data.phone !== existingCustomer.phone) {
      const phoneExists = await this.repository.findByPhone(data.phone, tenantId);
      if (phoneExists && phoneExists.id.toString() !== customerId) {
        throw new ConflictError('Customer with this phone number already exists');
      }
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== existingCustomer.email) {
      const emailExists = await this.repository.findByEmail(data.email, tenantId);
      if (emailExists && emailExists.id.toString() !== customerId) {
        throw new ConflictError('Customer with this email already exists');
      }
    }

    const updatedCustomer = await this.repository.updateCustomer(customerIdBigInt, tenantIdBigInt, data);

    return this.formatCustomerResponse(updatedCustomer);
  }

  /**
   * Add opening balance to customer
   */
  async addOpeningBalance(
    customerId: string,
    tenantId: string,
    data: AddOpeningBalanceInput,
    createdBy: string
  ): Promise<{ message: string; balance: number }> {
    const customerIdBigInt = BigInt(customerId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if customer exists
    const customer = await this.repository.findByIdAndTenant(customerIdBigInt, tenantIdBigInt);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check if opening balance already exists
    const hasOpeningBalance = await this.ledgerService.hasOpeningBalance(
      customerIdBigInt,
      tenantIdBigInt
    );
    if (hasOpeningBalance) {
      throw new ConflictError(
        'Opening balance already exists for this customer. Use adjustment entry for further balance changes.'
      );
    }

    // Create ledger entry
    await this.ledgerService.createLedgerEntry({
      tenant_id: tenantIdBigInt,
      customer_id: customerIdBigInt,
      entry_type: 'OPENING_BALANCE',
      amount: data.amount,
      description: data.description || 'Opening balance',
      created_by: BigInt(createdBy),
    });

    // Calculate new balance from ledger
    const newBalance = await this.ledgerService.calculateCustomerBalance(
      customerIdBigInt,
      tenantIdBigInt
    );

    // Update customer balance
    await this.repository.updateBalance(customerIdBigInt, tenantIdBigInt, newBalance);

    return {
      message: 'Opening balance added successfully',
      balance: newBalance,
    };
  }

  /**
   * Get customer ledger
   */
  async getCustomerLedger(
    customerId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    ledger: CustomerLedgerResponse[];
    summary: { totalDebit: number; totalCredit: number; balance: number };
    page: number;
    limit: number;
  }> {
    const customerIdBigInt = BigInt(customerId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if customer exists
    const customer = await this.repository.findByIdAndTenant(customerIdBigInt, tenantIdBigInt);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const skip = (page - 1) * limit;

    const [ledgerEntries, summary] = await Promise.all([
      this.ledgerService.getCustomerLedger(customerIdBigInt, tenantIdBigInt, {
        skip,
        take: limit,
      }),
      this.ledgerService.getLedgerSummary(customerIdBigInt, tenantIdBigInt),
    ]);

    return {
      ledger: ledgerEntries.map((entry) => this.formatLedgerResponse(entry)),
      summary,
      page,
      limit,
    };
  }

  /**
   * Format customer response
   */
  private formatCustomerResponse(customer: Customer): CustomerResponse {
    return {
      id: customer.id.toString(),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      credit_balance: Number(customer.credit_balance),
      created_at: customer.created_at,
    };
  }

  /**
   * Format ledger response
   */
  private formatLedgerResponse(entry: customer_ledger): CustomerLedgerResponse {
    return {
      id: entry.id.toString(),
      entry_type: entry.entry_type,
      amount: Number(entry.amount),
      description: entry.description,
      reference_id: entry.reference_id?.toString() || null,
      created_at: entry.created_at,
      created_by: entry.created_by?.toString() || null,
    };
  }
}
