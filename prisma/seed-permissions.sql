-- Seed Permissions and Role Permissions
-- This file contains INSERT queries to populate permissions and role_permissions tables
-- Sync with existing hardcoded ROLE_PERMISSIONS in auth.middleware.ts

-- Insert all unique permissions
INSERT INTO permissions (code, description) VALUES
('USER_CREATE', 'Create new users'),
('USER_VIEW', 'View user details'),
('USER_UPDATE', 'Update user information'),
('USER_DELETE', 'Delete users'),
('BILL_CREATE', 'Create new invoices/bills'),
('BILL_VIEW', 'View invoice/bill details'),
('BILL_UPDATE', 'Update invoice/bill information'),
('BILL_DELETE', 'Delete invoices/bills'),
('CUSTOMER_CREATE', 'Create new customers'),
('CUSTOMER_VIEW', 'View customer details'),
('CUSTOMER_UPDATE', 'Update customer information'),
('CUSTOMER_DELETE', 'Delete customers'),
('PRODUCT_CREATE', 'Create new products'),
('PRODUCT_VIEW', 'View product details'),
('PRODUCT_UPDATE', 'Update product information'),
('PRODUCT_DELETE', 'Delete products'),
('REPORT_VIEW', 'View reports and analytics'),
('SETTINGS_ALL', 'Full access to system settings'),
('IMPORT_DATA', 'Import data from CSV/Excel files'),
('EXPORT_DATA', 'Export data to CSV/Excel files')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Insert role-permission mappings for OWNER
-- OWNER has all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'OWNER', id FROM permissions
WHERE code IN (
  'USER_CREATE', 'USER_VIEW', 'USER_UPDATE', 'USER_DELETE',
  'BILL_CREATE', 'BILL_VIEW', 'BILL_UPDATE', 'BILL_DELETE',
  'CUSTOMER_CREATE', 'CUSTOMER_VIEW', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'PRODUCT_CREATE', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
  'REPORT_VIEW', 'SETTINGS_ALL', 'IMPORT_DATA', 'EXPORT_DATA'
)
ON DUPLICATE KEY UPDATE role = role;

-- Insert role-permission mappings for MANAGER
-- MANAGER has most permissions except user management and settings
INSERT INTO role_permissions (role, permission_id)
SELECT 'MANAGER', id FROM permissions
WHERE code IN (
  'BILL_CREATE', 'BILL_VIEW', 'BILL_UPDATE',
  'CUSTOMER_CREATE', 'CUSTOMER_VIEW', 'CUSTOMER_UPDATE',
  'PRODUCT_CREATE', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
  'REPORT_VIEW', 'IMPORT_DATA', 'EXPORT_DATA'
)
ON DUPLICATE KEY UPDATE role = role;

-- Insert role-permission mappings for CASHIER
-- CASHIER has limited permissions (create bills, view customers and products)
INSERT INTO role_permissions (role, permission_id)
SELECT 'CASHIER', id FROM permissions
WHERE code IN (
  'BILL_CREATE', 'BILL_VIEW',
  'CUSTOMER_VIEW',
  'PRODUCT_VIEW'
)
ON DUPLICATE KEY UPDATE role = role;

-- Verification queries (commented out - uncomment to verify data)
-- SELECT * FROM permissions ORDER BY code;
-- SELECT rp.role, p.code, p.description 
-- FROM role_permissions rp 
-- JOIN permissions p ON rp.permission_id = p.id 
-- ORDER BY rp.role, p.code;
