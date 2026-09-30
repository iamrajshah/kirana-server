import { CustomerService } from '../customer.service';
import { CustomerRepository } from '../customer.repository';

// Mock the repository
jest.mock('../customer.repository');

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockRepository: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    customerService = new CustomerService();
    mockRepository = (customerService as never)['repository'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a customer when phone is unique', async () => {
      const tenantId = 'tenant-123';
      const customerData = {
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
        openingBalance: 0,
      };

      const expectedCustomer = {
        id: 'customer-123',
        ...customerData,
        tenantId,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedCustomer);

      const result = await customerService.create(tenantId, customerData);

      expect(mockRepository.findByPhone).toHaveBeenCalledWith(customerData.phone, tenantId);
      expect(mockRepository.create).toHaveBeenCalledWith(tenantId, customerData);
      expect(result).toEqual(expectedCustomer);
    });

    it('should throw ConflictError when phone already exists', async () => {
      const tenantId = 'tenant-123';
      const customerData = {
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
        openingBalance: 0,
      };

      const existingCustomer = {
        id: 'existing-customer',
        ...customerData,
        tenantId,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(existingCustomer);

      await expect(customerService.create(tenantId, customerData)).rejects.toThrow(
        'Customer with this phone number already exists'
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return customer when found', async () => {
      const tenantId = 'tenant-123';
      const customerId = 'customer-123';

      const expectedCustomer = {
        id: customerId,
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
        tenantId,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        openingBalance: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(expectedCustomer);

      const result = await customerService.getById(customerId, tenantId);

      expect(mockRepository.findById).toHaveBeenCalledWith(customerId, tenantId);
      expect(result).toEqual(expectedCustomer);
    });

    it('should return null when customer not found', async () => {
      const tenantId = 'tenant-123';
      const customerId = 'non-existent-id';

      mockRepository.findById.mockResolvedValue(null);

      const result = await customerService.getById(customerId, tenantId);

      expect(result).toBeNull();
    });
  });
});
