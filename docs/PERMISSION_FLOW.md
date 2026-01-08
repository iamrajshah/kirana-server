# Permission System Architecture

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REGISTRATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

POST /auth/register-owner
         │
         ▼
┌─────────────────────┐
│  Create Tenant      │
│  Create User        │──────► Database Transaction
│  Assign OWNER Role  │        • tenants table
└─────────────────────┘        • users table
         │                     • user_roles table (user_id, role_id)
         ▼
┌─────────────────────┐
│  Generate JWT       │
│  {                  │
│    userId: "1",     │
│    tenantId: "1",   │
│    roles: ["OWNER"] │──────► Stored in JWT Token (NO permissions)
│  }                  │
└─────────────────────┘
         │
         ▼
   Return Token



┌─────────────────────────────────────────────────────────────────────────┐
│                     REQUEST AUTHORIZATION FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

Client Request
  ├─ Header: Authorization: Bearer <JWT_TOKEN>
  └─ Endpoint: POST /customers

         │
         ▼
┌─────────────────────────────────┐
│  1. JWT Middleware              │
│  ────────────────────────────   │
│  • Verify token signature       │
│  • Extract payload:             │
│    {                            │
│      userId: "1",               │
│      tenantId: "1",             │
│      roles: ["OWNER"]           │
│    }                            │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  2. Get Permissions from Roles  │
│  ────────────────────────────   │
│  IN-MEMORY LOOKUP (No DB!)      │
│                                 │
│  ROLE_PERMISSIONS["OWNER"] =    │
│  [                              │
│    "USER_CREATE",               │
│    "CUSTOMER_CREATE",           │
│    "CUSTOMER_VIEW",             │
│    "CUSTOMER_DELETE",           │
│    ...                          │
│  ]                              │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  3. Attach to Request           │
│  ────────────────────────────   │
│  req.user = {                   │
│    userId: "1",                 │
│    tenantId: "1",               │
│    roles: ["OWNER"],            │
│    permissions: [               │
│      "USER_CREATE",             │
│      "CUSTOMER_CREATE",         │
│      "CUSTOMER_VIEW",           │
│      ...                        │
│    ]                            │
│  }                              │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  4. Permission Middleware       │
│  ────────────────────────────   │
│  hasPermission("CUSTOMER_CREATE")│
│                                 │
│  Check:                         │
│  req.user.permissions           │
│    .includes("CUSTOMER_CREATE") │
│                                 │
│  Result: ✓ TRUE                 │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  5. Tenant Middleware           │
│  ────────────────────────────   │
│  Extract & Validate tenantId    │
│  Attach to request              │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  6. Controller                  │
│  ────────────────────────────   │
│  Execute business logic         │
│  Return response                │
└─────────────────────────────────┘



┌─────────────────────────────────────────────────────────────────────────┐
│                     PERMISSION DENIED FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

CASHIER tries to DELETE customer

         │
         ▼
┌─────────────────────────────────┐
│  JWT Middleware                 │
│  roles: ["CASHIER"]             │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Get Permissions                │
│  ROLE_PERMISSIONS["CASHIER"] =  │
│  [                              │
│    "BILL_CREATE",               │
│    "BILL_VIEW",                 │
│    "CUSTOMER_VIEW",             │
│    "PRODUCT_VIEW"               │
│  ]                              │
│  (NO CUSTOMER_DELETE)           │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Permission Middleware          │
│  hasPermission("CUSTOMER_DELETE")│
│                                 │
│  Check:                         │
│  req.user.permissions           │
│    .includes("CUSTOMER_DELETE") │
│                                 │
│  Result: ✗ FALSE                │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  401 Unauthorized               │
│  {                              │
│    success: false,              │
│    message: "Access denied.     │
│      Required permission:       │
│      CUSTOMER_DELETE"           │
│  }                              │
└─────────────────────────────────┘



┌─────────────────────────────────────────────────────────────────────────┐
│                  ROLE-PERMISSION MATRIX                                  │
└─────────────────────────────────────────────────────────────────────────┘

Permission              OWNER    MANAGER    CASHIER
────────────────────────────────────────────────────
USER_CREATE              ✓         ✗          ✗
USER_VIEW                ✓         ✗          ✗
USER_UPDATE              ✓         ✗          ✗
USER_DELETE              ✓         ✗          ✗

BILL_CREATE              ✓         ✓          ✓
BILL_VIEW                ✓         ✓          ✓
BILL_UPDATE              ✓         ✓          ✗
BILL_DELETE              ✓         ✗          ✗

CUSTOMER_CREATE          ✓         ✓          ✗
CUSTOMER_VIEW            ✓         ✓          ✓
CUSTOMER_UPDATE          ✓         ✓          ✗
CUSTOMER_DELETE          ✓         ✗          ✗

PRODUCT_CREATE           ✓         ✓          ✗
PRODUCT_VIEW             ✓         ✓          ✓
PRODUCT_UPDATE           ✓         ✓          ✗
PRODUCT_DELETE           ✓         ✓          ✗

SETTINGS_ALL             ✓         ✗          ✗



┌─────────────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE NOTES                                    │
└─────────────────────────────────────────────────────────────────────────┘

Why NO database hits for permission checks?
───────────────────────────────────────────

1. JWT contains ROLES (from DB during login)
2. ROLE_PERMISSIONS map is IN-MEMORY
3. Permissions computed on each request from roles
4. Fast O(1) lookup in JavaScript object

Timeline:
─────────
Login:           DB hit (get user + roles)
Request 1:       No DB hit (permissions from JWT roles)
Request 2:       No DB hit (permissions from JWT roles)
Request 3:       No DB hit (permissions from JWT roles)
...              ...
Request N:       No DB hit (permissions from JWT roles)

Trade-off:
──────────
✓ Fast & Scalable
✗ Permission changes require re-login (token refresh)
