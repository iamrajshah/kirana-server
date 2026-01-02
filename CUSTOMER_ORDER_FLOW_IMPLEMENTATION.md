# Customer-Facing Order Flow Implementation

## Overview
Implemented a complete customer-facing ordering system for the kirana store backend that allows customers to browse products, manage carts, place orders, and track their order status.

## Key Features Implemented

### 1. Customer Authentication (`/customer-auth`)
- **POST /customer-auth/register** - Customer registration with phone + password
- **POST /customer-auth/login** - Customer login returning JWT token
- **GET /customer-auth/me** - Get authenticated customer profile

**Implementation Details:**
- Uses existing `customers` table with `password_hash` field
- JWT tokens with type='customer' to differentiate from POS user tokens
- Tenant isolation enforced on all routes
- Updates `last_login_at` on successful login

### 2. Product Catalog (`/catalog`)
- **GET /catalog/categories** - List all active categories
- **GET /catalog/products** - List products with filtering and pagination
  - Query params: `category_id`, `search`, `skip`, `take`
- **GET /catalog/products/:id** - Get product details with variants

**Implementation Details:**
- Read-only APIs (no modifications)
- Returns product images, variant images, and stock quantities
- Includes all variant details (brand, size, packaging, prices)
- Only shows active products and variants

### 3. Shopping Cart (`/cart`)
- **GET /cart** - Get or create active cart for customer
- **POST /cart/items** - Add item to cart with price snapshot
- **PUT /cart/items/:id** - Update cart item quantity
- **DELETE /cart/items/:id** - Remove item from cart
- **DELETE /cart** - Clear entire cart

**Implementation Details:**
- Uses `carts` and `cart_items` tables
- **Price snapshotting**: Captures `selling_price` when item added to cart
- Automatically creates cart on first add
- Updates quantity if item already exists in cart
- Returns complete cart with all items and total amount

### 4. Order Management (`/orders`)
**Customer Routes:**
- **POST /orders** - Create order from active cart
- **GET /orders** - Get customer order history
- **GET /orders/:id** - Get order details

**POS User Routes:**
- **PATCH /orders/:id/status** - Update order status (requires auth middleware)

**Implementation Details:**
- Creates order and draft invoice in single transaction
- Order statuses: PLACED, CONFIRMED, READY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
- Automatically generates invoice number (format: INV-YYYYMM-NNNN)
- Links order to invoice via `order_id` field
- Clears cart after order creation
- **IMPORTANT**: Invoice created with status='DRAFT' (inventory NOT reduced)

## Design Decisions

### Price Snapshotting
- Cart items store `selling_price_snapshot` to protect against price changes
- Order items store `unit_price` from cart snapshot
- Invoice items use prices from order items
- This ensures customers pay the price they saw when adding to cart

### Draft Invoice Strategy
- Orders automatically create DRAFT invoices
- Inventory is NOT reduced until invoice is finalized
- POS users must explicitly finalize invoice to:
  - Reduce inventory
  - Allow payments
  - Generate final invoice

### Payment Reconciliation
- Payments link to invoices via `invoice_id`
- Invoice `paid_amount` auto-updates on payment (existing logic)
- Invoice status auto-updates: DRAFT → FINALIZED → UNPAID/PARTIAL/PAID
- No changes to existing payment/invoice logic needed

### Tenant Isolation
- All queries filter by `tenant_id`
- Middleware validates tenant_id from subdomain/header
- Customer tokens include tenant_id validation

## Database Tables Used

**Existing Tables (No Schema Changes):**
- `customers` - Customer authentication and profile
- `carts` - Shopping cart status
- `cart_items` - Cart line items with price snapshot
- `orders` - Customer orders
- `order_items` - Order line items
- `invoices` - Draft/finalized invoices (linked via order_id)
- `invoice_items` - Invoice line items
- `payments` - Payment records
- `products` - Product catalog
- `product_variants` - Product SKUs
- `categories` - Product categories
- `inventory` - Stock levels

## API Flow Example

### Complete Customer Journey:

1. **Customer Registration**
```bash
POST /api/customer-auth/register
{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "password": "password123"
}
```

2. **Customer Login**
```bash
POST /api/customer-auth/login
{
  "phone": "9876543210",
  "password": "password123"
}
# Returns: { token, customer }
```

3. **Browse Catalog**
```bash
GET /api/catalog/categories
GET /api/catalog/products?category_id=1&skip=0&take=20
GET /api/catalog/products/123
```

4. **Add to Cart** (with Bearer token)
```bash
POST /api/cart/items
{
  "variant_id": "456",
  "quantity": 2
}
# Captures current selling_price as snapshot
```

5. **Update Cart**
```bash
PUT /api/cart/items/789
{
  "quantity": 3
}
```

6. **Place Order**
```bash
POST /api/orders
# Creates order + draft invoice
# Clears cart
# Returns order with invoice details
```

7. **Track Order**
```bash
GET /api/orders
GET /api/orders/123
```

### POS User Actions:

8. **Update Order Status**
```bash
PATCH /api/orders/123/status
{
  "status": "CONFIRMED"
}
# Requires POS user auth token
```

9. **Finalize Invoice** (existing API)
```bash
POST /api/invoices/456/finalize
# Reduces inventory
# Enables payment collection
```

10. **Record Payment** (existing API)
```bash
POST /api/payments
{
  "customer_id": "789",
  "invoice_id": "456",
  "amount": 500.00,
  "payment_mode": "CASH"
}
# Auto-updates invoice.paid_amount
# Auto-updates invoice.status to PAID/PARTIAL
```

## Security Considerations

1. **Customer Token vs POS Token**
   - Customer JWT has `type: 'customer'`
   - POS user JWT has different structure
   - Middleware validates token type

2. **Tenant Isolation**
   - All queries filter by tenant_id
   - Customer tokens embed tenant_id
   - Middleware validates tenant match

3. **Authorization**
   - Customers can only see/modify their own orders/carts
   - POS users can update any order status
   - Order status updates require POS auth

## Files Created

```
src/modules/
├── customer-auth/
│   ├── customer-auth.controller.ts
│   ├── customer-auth.service.ts
│   ├── customer-auth.validation.ts
│   └── index.ts
├── catalog/
│   ├── catalog.controller.ts
│   ├── catalog.service.ts
│   └── index.ts
├── cart/
│   ├── cart.controller.ts
│   ├── cart.service.ts
│   ├── cart.validation.ts
│   └── index.ts
└── order/
    ├── order.controller.ts
    ├── order.service.ts
    ├── order.validation.ts
    └── index.ts

src/middlewares/
└── customer-auth.middleware.ts
```

## Integration Points

### With Existing Code:
- **Invoice Module**: Orders create draft invoices, POS finalizes them
- **Payment Module**: Payments reconcile against invoices created from orders
- **Inventory Module**: Stock reduced only when invoice finalized (existing logic)
- **Product Module**: Catalog reads from existing products/variants
- **Customer Module**: Uses existing customers table

### No Changes Required To:
- Invoice finalization logic
- Inventory reduction logic
- Payment reconciliation logic
- Invoice status calculations
- Ledger entries

## Testing Checklist

- [ ] Customer registration with duplicate phone
- [ ] Customer login with wrong password
- [ ] Browse catalog without auth
- [ ] Add to cart captures correct price
- [ ] Multiple adds to same item updates quantity
- [ ] Order creation clears cart
- [ ] Draft invoice created with correct items
- [ ] POS can update order status
- [ ] Invoice finalization reduces inventory
- [ ] Payment updates invoice amounts
- [ ] Tenant isolation works correctly
- [ ] Customer can only see own orders

## Next Steps

1. Add order cancellation by customer
2. Add payment intents for online payments
3. Add order notifications (SMS/Email)
4. Add delivery tracking
5. Add order rating/feedback
6. Add reorder functionality
7. Add wishlist feature
8. Add product reviews
