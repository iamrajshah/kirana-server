# Kirana Server - Multi-Tenant REST API

A production-ready Node.js REST API for Kirana (retail) store management with multi-tenant architecture, ledger-based accounting, and JWT authentication.

## Features

- 🏢 **Multi-tenant architecture** with tenant isolation
- 🔐 **JWT authentication** with role-based access control
- 📊 **Ledger-based accounting** for financial management
- ✅ **Input validation** using Zod
- 🧪 **Unit testing** with Jest
- 🎨 **Code quality** with ESLint and Prettier
- 🔄 **Service-Repository pattern** for clean architecture
- 📝 **TypeScript** for type safety
- 🗄️ **Prisma ORM** for database management

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: MySQL
- **Validation**: Zod
- **Testing**: Jest
- **Authentication**: JWT
- **Code Quality**: ESLint, Prettier, Husky

## Project Structure

```
kirana-server/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server entry point
│   ├── config/
│   │   ├── env.ts            # Environment configuration
│   │   └── database.ts       # Database connection
│   ├── modules/
│   │   ├── base.repository.ts # Base repository with tenant isolation
│   │   ├── base.service.ts    # Base service class
│   │   ├── customer/          # Customer module
│   │   └── ledger/            # Ledger module
│   ├── middlewares/
│   │   ├── auth.middleware.ts    # JWT authentication
│   │   ├── tenant.middleware.ts  # Tenant extraction
│   │   ├── error.middleware.ts   # Error handling
│   │   └── validate.middleware.ts # Request validation
│   ├── routes/
│   │   └── index.ts          # Route aggregator
│   ├── utils/
│   │   ├── logger.ts         # Winston logger
│   │   ├── asyncHandler.ts  # Async error handler
│   │   └── errors.ts         # Custom error classes
│   └── tests/
│       └── setup.ts          # Test configuration
├── prisma/
│   └── schema.prisma         # Database schema
├── .vscode/                  # VS Code settings
├── package.json
├── tsconfig.json
└── jest.config.ts
```

## Getting Started

### Prerequisites

- Node.js >= 18
- MySQL >= 8.0
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kirana-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## API Documentation

### Authentication

All API routes (except health check) require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

The JWT must contain:
- `userId` - User ID
- `tenantId` - Tenant ID (for multi-tenant isolation)
- `email` - User email
- `role` - User role (SUPER_ADMIN, ADMIN, USER)

### API Endpoints

#### Health Check
- `GET /api/v1/health` - Check API health

#### Customers
- `GET /api/v1/customers` - Get all customers (with pagination)
- `GET /api/v1/customers/search?q=query` - Search customers
- `GET /api/v1/customers/:id` - Get customer by ID
- `POST /api/v1/customers` - Create new customer
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

#### Ledgers
- `GET /api/v1/ledgers` - Get all ledgers
- `GET /api/v1/ledgers?type=ASSET` - Get ledgers by type
- `GET /api/v1/ledgers/:id` - Get ledger by ID
- `GET /api/v1/ledgers/:id/entries` - Get ledger entries
- `GET /api/v1/ledgers/:id/balance` - Get ledger balance
- `POST /api/v1/ledgers` - Create new ledger
- `PUT /api/v1/ledgers/:id` - Update ledger
- `DELETE /api/v1/ledgers/:id` - Delete ledger

## Architecture

### Multi-Tenant Isolation

All data is isolated by `tenantId` which is extracted from the JWT token. The `BaseRepository` class ensures tenant isolation at the database level.

### Service-Repository Pattern

- **Controllers**: Handle HTTP requests/responses, no business logic
- **Services**: Contain business logic and validation
- **Repositories**: Handle database operations with tenant isolation

### Error Handling

Centralized error handling with custom error classes:
- `AppError` - Base error class
- `BadRequestError` - 400
- `UnauthorizedError` - 401
- `ForbiddenError` - 403
- `NotFoundError` - 404
- `ValidationError` - 422
- `ConflictError` - 409

### Validation

Request validation using Zod schemas with the `validate` middleware.

## Database Schema

The Prisma schema includes:
- **Tenant**: Multi-tenant organization
- **User**: User accounts with roles
- **Customer**: Customer management
- **Product**: Product catalog
- **Inventory**: Stock management
- **Invoice**: Sales invoices
- **Payment**: Payment transactions
- **Ledger**: Accounting ledgers
- **LedgerEntry**: Double-entry bookkeeping

## Testing

Run tests with:
```bash
npm test
```

Example test file: `src/modules/customer/customer.service.test.ts`

## Code Quality

### Pre-commit Hooks

Husky runs linting and formatting on staged files before commit.

### VS Code Integration

Recommended extensions are listed in `.vscode/extensions.json`. The workspace is configured for automatic formatting on save.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 3000 |
| DATABASE_URL | MySQL connection string | - |
| JWT_SECRET | JWT secret key (min 32 chars) | - |
| JWT_EXPIRES_IN | JWT expiration time | 7d |
| LOG_LEVEL | Logging level | info |
| CORS_ORIGIN | CORS allowed origins | * |

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions, please open an issue on GitHub.