import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { CustomerAuthRepository } from './customer-auth.repository';
import { AppError } from '@utils/errors';
import { CustomerRegisterInput, CustomerLoginInput } from './customer.validation';

export class CustomerAuthService {
  private readonly repository: CustomerAuthRepository;

  constructor() {
    this.repository = new CustomerAuthRepository();
  }

  async register(tenantId: bigint, data: CustomerRegisterInput) {
    // Check if customer exists
    const existing = await this.repository.findByPhone(data.phone, tenantId);

    if (existing) {
      throw new AppError('Customer with this phone already exists', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 10);

    // Create customer
    const customer = await this.repository.create({
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      password_hash,
    });

    // Generate token
    const token = this.generateToken(customer.id, tenantId);

    return {
      customer: {
        id: customer.id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        created_at: customer.created_at,
      },
      token,
    };
  }

  async login(tenantId: bigint, data: CustomerLoginInput) {
    // Find customer
    const customer = await this.repository.findByPhone(data.phone, tenantId);

    if (!customer || !customer.is_active) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!customer.password_hash) {
      throw new AppError('Password not set for this account', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, customer.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await this.repository.updateLastLogin(customer.id);

    // Generate token
    const token = this.generateToken(customer.id, tenantId);

    return {
      customer: {
        id: customer.id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },
      token,
    };
  }

  async getProfile(tenantId: bigint, customerId: bigint) {
    const customer = await this.repository.findById(customerId, tenantId);

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    return {
      id: customer.id.toString(),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      credit_balance: Number(customer.credit_balance),
      created_at: customer.created_at,
    };
  }

  private generateToken(customerId: bigint, tenantId: bigint): string {
    return jwt.sign(
      {
        customerId: customerId.toString(),
        tenantId: tenantId.toString(),
        type: 'customer',
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      } as jwt.SignOptions
    );
  }
}
