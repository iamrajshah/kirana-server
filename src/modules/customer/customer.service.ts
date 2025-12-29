import { Customer } from '@prisma/client';
import { BaseService } from '../base.service';
import { CustomerRepository } from './customer.repository';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.validation';
import { ConflictError } from '@utils/errors';

export class CustomerService extends BaseService<
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput
> {
  protected readonly repository: CustomerRepository;

  constructor() {
    super();
    this.repository = new CustomerRepository();
  }

  /**
   * Create a new customer with validation
   */
  async create(tenantId: string, data: CreateCustomerInput): Promise<Customer> {
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

    return this.repository.create(tenantId, data);
  }

  /**
   * Update customer with validation
   */
  async update(id: string, tenantId: string, data: UpdateCustomerInput): Promise<Customer> {
    // If phone is being updated, check for duplicates
    if (data.phone) {
      const existingCustomer = await this.repository.findByPhone(data.phone, tenantId);
      if (existingCustomer && existingCustomer.id.toString() !== id) {
        throw new ConflictError('Customer with this phone number already exists');
      }
    }

    // If email is being updated, check for duplicates
    if (data.email) {
      const existingEmail = await this.repository.findByEmail(data.email, tenantId);
      if (existingEmail && existingEmail.id.toString() !== id) {
        throw new ConflictError('Customer with this email already exists');
      }
    }

    return this.repository.update(id, tenantId, data);
  }

  /**
   * Search customers
   */
  async search(
    query: string,
    tenantId: string,
    options?: { skip?: number; take?: number }
  ): Promise<Customer[]> {
    return this.repository.search(query, tenantId, options);
  }

  /**
   * Get paginated customers
   */
  async getPaginated(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
    searchQuery?: string
  ): Promise<{ customers: Customer[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const { customers, total } = await this.repository.findAllPaginated(tenantId, {
      skip,
      take: limit,
      searchQuery,
    });

    return {
      customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
