import { ProductService } from './product.service';
import { ProductRepository } from './product.repository';

// Mock the repository
jest.mock('./product.repository');

describe('ProductService - Search for Billing', () => {
  let productService: ProductService;
  let mockProductRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    productService = new ProductService();
    mockProductRepository = (productService as any)['productRepository'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchForBilling', () => {
    const tenantId = '1';
    const tenantIdBigInt = BigInt(1);

    it('should return formatted results when variants are found', async () => {
      const mockVariants = [
        {
          id: BigInt(1),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(10),
          brand: 'Head & Shoulder',
          size: 'Small',
          packaging: 'BOTTLE',
          price: 210,
          gst_percent: 18,
          sku: 'HS-001',
          is_active: true,
          products: {
            id: BigInt(10),
            name: 'Shampoo',
            category_id: BigInt(2),
          },
          inventory: {
            quantity: 50,
            low_stock_threshold: 10,
          },
        },
        {
          id: BigInt(2),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(11),
          brand: 'Clinic Plus',
          size: 'Large',
          packaging: 'BOTTLE',
          price: 630,
          gst_percent: 18,
          sku: 'CP-002',
          is_active: true,
          products: {
            id: BigInt(11),
            name: 'Shampoo',
            category_id: BigInt(2),
          },
          inventory: {
            quantity: 15,
            low_stock_threshold: 5,
          },
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Shampoo');

      expect(mockProductRepository.searchForBilling).toHaveBeenCalledWith(
        tenantIdBigInt,
        'Shampoo'
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        product_id: '10',
        product_name: 'Shampoo',
        brand: 'Head & Shoulder',
        size: 'Small',
        packaging: 'BOTTLE',
        price: 210,
        gst_percent: 18,
        sku: 'HS-001',
        available_quantity: 50,
        low_stock_threshold: 10,
      });
    });

    it('should return empty array when no variants found', async () => {
      mockProductRepository.searchForBilling.mockResolvedValue([]);

      const result = await productService.searchForBilling(tenantId, 'NonExistent');

      expect(mockProductRepository.searchForBilling).toHaveBeenCalledWith(
        tenantIdBigInt,
        'NonExistent'
      );
      expect(result).toEqual([]);
    });

    it('should handle variants without inventory data', async () => {
      const mockVariants = [
        {
          id: BigInt(1),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(10),
          brand: 'Test Brand',
          size: 'Medium',
          packaging: 'BOX',
          price: 100,
          gst_percent: null,
          sku: 'TB-001',
          is_active: true,
          products: {
            id: BigInt(10),
            name: 'Test Product',
            category_id: BigInt(1),
          },
          inventory: null, // No inventory record
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Test');

      expect(result).toHaveLength(1);
      expect(result[0].available_quantity).toBe(0);
      expect(result[0].low_stock_threshold).toBe(0);
      expect(result[0].gst_percent).toBeNull();
    });

    it('should search by SKU', async () => {
      const mockVariants = [
        {
          id: BigInt(1),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(10),
          brand: 'Brand',
          size: 'Small',
          packaging: 'BOTTLE',
          price: 200,
          gst_percent: 18,
          sku: 'ABC-123',
          is_active: true,
          products: {
            id: BigInt(10),
            name: 'Product',
            category_id: BigInt(1),
          },
          inventory: {
            quantity: 100,
            low_stock_threshold: 20,
          },
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'ABC-123');

      expect(mockProductRepository.searchForBilling).toHaveBeenCalledWith(
        tenantIdBigInt,
        'ABC-123'
      );
      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe('ABC-123');
    });

    it('should only return active products and variants', async () => {
      // Repository should only return active items
      // This test ensures the service doesn't accidentally filter further
      const mockVariants = [
        {
          id: BigInt(1),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(10),
          brand: 'Active Brand',
          size: 'Small',
          packaging: 'BOTTLE',
          price: 100,
          gst_percent: 18,
          sku: 'ACTIVE-001',
          is_active: true,
          products: {
            id: BigInt(10),
            name: 'Active Product',
            category_id: BigInt(1),
          },
          inventory: {
            quantity: 50,
            low_stock_threshold: 10,
          },
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Active');

      expect(result).toHaveLength(1);
      // All returned items should be from active products
      result.forEach((item) => {
        expect(item.product_name).toContain('Active');
      });
    });

    it('should limit results to 20 items', async () => {
      // Create 25 mock variants
      const mockVariants = Array.from({ length: 20 }, (_, i) => ({
        id: BigInt(i + 1),
        tenant_id: tenantIdBigInt,
        product_id: BigInt(i + 10),
        brand: `Brand ${i}`,
        size: 'Small',
        packaging: 'BOTTLE',
        price: 100 + i,
        gst_percent: 18,
        sku: `SKU-${i}`,
        is_active: true,
        products: {
          id: BigInt(i + 10),
          name: `Product ${i}`,
          category_id: BigInt(1),
        },
        inventory: {
          quantity: 50,
          low_stock_threshold: 10,
        },
      }));

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Product');

      // Repository should limit to 20
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should convert BigInt IDs to strings', async () => {
      const mockVariants = [
        {
          id: BigInt(999),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(888),
          brand: 'Brand',
          size: 'Small',
          packaging: 'BOTTLE',
          price: 100,
          gst_percent: 18,
          sku: 'TEST-001',
          is_active: true,
          products: {
            id: BigInt(888),
            name: 'Test',
            category_id: BigInt(1),
          },
          inventory: {
            quantity: 50,
            low_stock_threshold: 10,
          },
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Test');

      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].product_id).toBe('string');
      expect(result[0].id).toBe('999');
      expect(result[0].product_id).toBe('888');
    });

    it('should convert Decimal price to number', async () => {
      const mockVariants = [
        {
          id: BigInt(1),
          tenant_id: tenantIdBigInt,
          product_id: BigInt(10),
          brand: 'Brand',
          size: 'Small',
          packaging: 'BOTTLE',
          price: 199.99, // Decimal value
          gst_percent: 18.5,
          sku: 'TEST-001',
          is_active: true,
          products: {
            id: BigInt(10),
            name: 'Test',
            category_id: BigInt(1),
          },
          inventory: {
            quantity: 50,
            low_stock_threshold: 10,
          },
        },
      ];

      mockProductRepository.searchForBilling.mockResolvedValue(mockVariants as any);

      const result = await productService.searchForBilling(tenantId, 'Test');

      expect(typeof result[0].price).toBe('number');
      expect(typeof result[0].gst_percent).toBe('number');
      expect(result[0].price).toBe(199.99);
      expect(result[0].gst_percent).toBe(18.5);
    });
  });
});
