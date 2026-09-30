# Data Import & Export Guide

This guide explains how to import data into your Kirana billing system using the CSV files provided.

## 📁 Available CSV Files

Located in `/kirana-server/`:
- `Category.csv` - Product categories (22 categories)
- `Customer.csv` - Sample customers (20 customers)
- `Supplier.csv` - Sample suppliers (15 suppliers)
- `Product.csv` - Products with variants (44 products with full pricing)
- `Inventory.csv` - Inventory stock levels (44 items)

## 🚀 Quick Start - Import All Data

### Step 1: Start Your Backend Server
```bash
cd kirana-server
npm run start
```

### Step 2: Get Your Authentication Token
Login via Postman or your UI and copy the JWT token.

### Step 3: Import in Correct Order

**IMPORTANT:** Import in this order to avoid foreign key errors:

```bash
# 1. Import Categories First
curl -X POST http://localhost:5000/api/v1/import/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1" \
  -F "file=@Category.csv" \
  -F "type=CATEGORY"

# Note the job_id from response, e.g., "id": "1"

# 2. Check status and commit
curl -X GET http://localhost:5000/api/v1/import/jobs/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1"

curl -X POST http://localhost:5000/api/v1/import/jobs/1/commit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1"

# 3. Import Suppliers
curl -X POST http://localhost:5000/api/v1/import/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1" \
  -F "file=@Supplier.csv" \
  -F "type=SUPPLIER"

# Get job_id and commit (repeat check + commit steps)

# 4. Import Products (with auto-create categories enabled)
curl -X POST http://localhost:5000/api/v1/import/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1" \
  -F "file=@Product.csv" \
  -F "type=PRODUCT" \
  -F "autoCreateCategories=true"

# Get job_id and commit

# 5. Import Customers
curl -X POST http://localhost:5000/api/v1/import/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1" \
  -F "file=@Customer.csv" \
  -F "type=CUSTOMER"

# Get job_id and commit

# 6. Update Inventory (Optional - Product.csv already has quantities)
curl -X POST http://localhost:5000/api/v1/import/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "X-Tenant-ID: 1" \
  -F "file=@Inventory.csv" \
  -F "type=INVENTORY"

# Get job_id and commit
```

## 📊 What's Included in Sample Data

### Categories (22 items)
- Flour, Rice, Dal & Pulses
- Cooking Oil, Ghee & Butter
- Salt, Spices & Masala
- Tea & Coffee, Biscuits, Namkeen
- Cold Drinks, Juices
- Milk & Curd, Paneer
- Personal Care items (Soap, Shampoo, Toothpaste)
- Household items (Detergent, Cleaning)
- Stationery (Notebooks, Pens)

### Products (44 items with PROPER PRICES)
All products have:
- ✅ **selling_price** set (this is what shows in customer app!)
- ✅ **mrp_price** set
- ✅ **Initial quantity** set
- ✅ **SKU** unique identifier
- ✅ **GST percentage** (5%, 12%, or 18%)

Examples:
- Aashirvaad Atta (1kg, 2kg, 5kg, 10kg) - ₹50 to ₹490
- Fortune Oil (1L, 5L) - ₹155 to ₹750
- Tata Salt (500g, 1kg) - ₹11 to ₹20
- India Gate Rice (1kg, 5kg) - ₹90 to ₹400
- Amul products (Butter, Ghee) - ₹58 to ₹305
- Tata/Taj Tea - ₹95 to ₹190
- Nescafe/Bru Coffee - ₹125 to ₹130
- Parle-G, Good Day, Marie Biscuits - ₹30 to ₹48
- Haldiram, Kurkure, Lays - ₹22 to ₹48
- Coke, Pepsi, Sprite, Thums Up - ₹65 each
- Frooti, Maaza, Real, Tropicana - ₹50 to ₹105

### Customers (20 items)
- Indian names with realistic data
- Mix of customers with and without email
- Some have opening credit balance (₹75 to ₹500)
- All have valid 10-digit phone numbers

### Suppliers (15 items)
- Real Indian brands: ITC, HUL, Britannia, Parle, etc.
- Contact details and addresses
- Ready for purchase invoice management

## 🔧 Fixing Existing Price Issues

If you already have products showing ₹0.00:

```sql
-- Connect to MySQL
mysql -u root -p kirana_db

-- Check current prices
SELECT 
  p.name,
  pv.sku,
  pv.selling_price,
  pv.mrp_price,
  i.quantity
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN inventory i ON i.variant_id = pv.id
WHERE pv.tenant_id = 1;

-- Fix NULL or 0 selling prices
UPDATE product_variants 
SET 
  selling_price = CASE 
    WHEN price IS NOT NULL AND price > 0 THEN price
    ELSE 100.00
  END,
  mrp_price = CASE 
    WHEN price IS NOT NULL AND price > 0 THEN price * 1.1
    ELSE 110.00
  END
WHERE tenant_id = 1 
  AND (selling_price IS NULL OR selling_price = 0);
```

## 📱 Verify in Customer App

After importing:

1. **Set Tenant Name:**
   Edit `/kirana-ui-customer/.env`:
   ```
   VITE_TENANT_NAME=Raj Kirana Store
   ```

2. **Restart Frontend:**
   ```bash
   cd kirana-ui-customer
   npm run dev
   ```

3. **Login and Check:**
   - Products should show with prices
   - Categories should be listed
   - Cart should work with proper prices
   - Tenant name should appear in header

## 🎯 Tenant Name Display

The tenant name now shows in the customer app header:

**Before:**
```
Kirana Store
```

**After:**
```
Raj Kirana Store  ← Your store name
Kirana Store     ← App subtitle
```

Set it in `.env`:
```bash
VITE_TENANT_NAME=Your Store Name Here
```

## 🔍 Logout Button

The logout button is in the **Profile** tab:
- Navigate to Profile (person icon in bottom navigation)
- Scroll down
- Red "Logout" button is at the bottom

## 📋 Import Process Details

### 1. Upload CSV
System validates and creates import job

### 2. Check Job Status
```bash
curl -X GET http://localhost:5000/api/v1/import/jobs/{job_id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: 1"
```

Response shows:
- Total rows
- Valid rows
- Invalid rows  
- Error details

### 3. Fix Errors (if any)
- Edit CSV to fix validation errors
- Re-upload

### 4. Commit Import
```bash
curl -X POST http://localhost:5000/api/v1/import/jobs/{job_id}/commit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: 1"
```

This actually imports the data!

## 📚 Full Documentation

See [CSV_IMPORT_TEMPLATES.md](./CSV_IMPORT_TEMPLATES.md) for:
- Detailed field descriptions
- Validation rules
- Custom CSV format creation
- Database schema mappings
- Troubleshooting guide

## ⚠️ Important Notes

1. **Price Fields:** Always set `selling_price` in Product.csv - this is what displays in the customer app
2. **Import Order:** Categories → Suppliers → Products → Customers → Inventory
3. **Unique Constraints:**
   - Customer phone must be unique
   - Product SKU must be unique
   - Supplier phone must be unique (if provided)
4. **Auto-Create Categories:** Use `autoCreateCategories=true` when importing products to auto-create missing categories

## 🎉 Success Checklist

After importing, verify:
- [ ] Categories visible in product listing
- [ ] Products show with non-zero prices
- [ ] Images show (or placeholders appear)
- [ ] Add to cart works
- [ ] Cart shows correct prices (not ₹0.00)
- [ ] Tenant name displays in header
- [ ] Logout button works in Profile tab
- [ ] Language switcher works (EN/HI/MR/GU)
- [ ] Theme toggle works (Dark/Light)

## 🐛 Troubleshooting

**Q: Products still showing ₹0.00 after import**
A: Run the SQL fix above or ensure your Product.csv has `selling_price` column filled

**Q: Can't see tenant name**
A: Check `.env` file has `VITE_TENANT_NAME` and restart dev server

**Q: Import job stuck in PROCESSING**
A: Check backend logs for errors. File might be too large or malformed

**Q: Categories not found error**
A: Import categories first, OR use `autoCreateCategories=true` flag

**Q: Phone already exists error**
A: Duplicate phone numbers. Make each phone unique in CSV

---

Need help? Check [CSV_IMPORT_TEMPLATES.md](./CSV_IMPORT_TEMPLATES.md) for detailed format guides!
