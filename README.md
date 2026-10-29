# Bakery CRM, Inventory and Billing System

A web-based system for a single bakery and sweet shop covering the full chain:
raw material purchasing, production batch tracking, finished goods stock,
GST-compliant billing, customer CRM, and owner dashboards.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand, Recharts |
| Backend | Node.js, Express, TypeScript, PostgreSQL |
| Auth | JWT (access + refresh tokens), PIN-based quick login for cashiers |
| DB | PostgreSQL with migration scripts |

## Project Structure

```
bakery-crm/
├── backend/
│   ├── src/
│   │   ├── config/          # env + database pool
│   │   ├── db/
│   │   │   ├── migrations/  # 23 SQL migration files
│   │   │   ├── migrate.ts   # migration runner
│   │   │   └── seed.ts      # seed admin + default data
│   │   ├── middleware/      # auth, RBAC, validation, errors, audit
│   │   ├── modules/         # feature modules (auth, billing, production, etc.)
│   │   ├── routes.ts        # root API router with RBAC guards
│   │   ├── app.ts           # Express app
│   │   └── server.ts        # entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client + API modules
│   │   ├── components/       # shared UI (Layout, DataTable, Card, etc.)
│   │   ├── pages/           # one page per feature
│   │   ├── store/           # Zustand stores (auth)
│   │   ├── types/           # shared TypeScript types
│   │   ├── App.tsx          # routes
│   │   └── main.tsx         # entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env    # edit DB credentials and JWT secrets
npm run migrate         # create database tables
npm run seed            # create admin user + default categories
npm run dev             # start dev server on port 4000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev             # start dev server on port 5173
```

### Default Admin

- Username: `admin`
- Password: `admin123`

## Features by Phase

### Phase 1 (core) — implemented
- Authentication with role-based access control (admin, manager, cashier)
- Product catalog with categories, variants, price history
- Billing with GST invoices, FEFO stock deduction, hold/resume, split payments
- Raw material purchases with quality check and lot tracking
- Basic inventory and sales dashboards

### Phase 2 (production) — implemented
- Recipes (bill of materials)
- Production batches with MM-YY-NNN numbering
- FEFO finished goods stock
- Wastage tracking with cost valuation
- Batch traceability (material to bill)
- Expiry alerts

### Phase 3 (business) — implemented
- Customer CRM with loyalty points
- Custom cake and bulk orders
- Shifts with cash reconciliation
- Expenses tracking
- Full report suite: sales, profit, GST, wastage, production, stock
- Audit log

### Phase 4 (extras) — not yet implemented
- WhatsApp/SMS bill sharing
- PWA offline billing
- Barcode/scale integration
- Demand-based production suggestions
- Regional language support
