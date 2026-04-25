# Konvent POS

Konvent POS is a trust-based student corporation POS system.

Regular users use a shared computer to:
- pick a product,
- enter quantity,
- select a person,
- add optional comment,
- save purchase.

Purchases increase personal debt and decrease stock only for inventory-tracked products.

## Stack

- Client: Vue 3, Vite, Pinia, Vue Router
- Server: Node.js, Express
- Database: PostgreSQL
- Auth: HTTP Basic Auth (regular + admin credentials)

## Auth Model

There is no personal login account system.

The app uses two shared HTTP Basic Auth credential sets:

- Regular credentials:
  - `APP_USERNAME`
  - `APP_PASSWORD`
- Admin credentials:
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`

Regular auth is used for normal app API calls.
Admin auth is required for `/api/admin/*` endpoints and `/admin` frontend routes.

## Setup
 
1. Start database:
   - `docker compose up -d`
2. Apply schema:
   - `psql postgresql://konvent:konvent@localhost:5433/konvent_pos -f database/schema.sql`
3. Seed sample data:
   - `psql postgresql://konvent:konvent@localhost:5433/konvent_pos -f database/seed.sql`
4. Start server:
   - `cd server`
   - `cp .env.example .env`
   - `npm install`
   - `npm run dev`
5. Start client in another terminal:
   - `cd client`
   - `npm install`
   - `npm run dev`
6. Open `http://localhost:5173`

If local `psql` is missing, import SQL through Docker:
- `cat database/schema.sql | docker compose exec -T db psql -U konvent -d konvent_pos`
- `cat database/seed.sql | docker compose exec -T db psql -U konvent -d konvent_pos`

## Environment Variables

`server/.env`:

- `PORT=3000`
- `DATABASE_URL=postgresql://konvent:konvent@localhost:5433/konvent_pos`
- `APP_USERNAME=konvent`
- `APP_PASSWORD=MirtelPohlaTissid`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin`
- `CLIENT_ORIGIN=http://localhost:5173`

## Regular Routes (Frontend)

- `/` Pane kirja
- `/quantity`
- `/person`
- `/confirm`
- `/debts` Võlad
- `/purchases` Kirjed
- `/stats` Statistika
- `/inventory` Inventuur

## Admin Routes (Frontend)

- `/admin`
- `/admin/products`
- `/admin/categories`
- `/admin/people`
- `/admin/stock-overview`
- `/admin/stock-add`
- `/admin/inventory-count`
- `/admin/inventory-reports`
- `/admin/purchases`

## Regular API Highlights

- `GET /api/products/menu`
- `GET /api/people/visible`
- `GET /api/people/:id/balance`
- `GET /api/people/:id/monthly-purchases?month=YYYY-MM&include_cancelled=false`
- `POST /api/purchases`
- `GET /api/purchases`
- `GET /api/payments/debts`
- `GET /api/stats/*`

## Admin API Highlights

- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `POST /api/admin/people`
- `PUT /api/admin/people/:id`
- `DELETE /api/admin/people/:id`
- `PATCH /api/admin/purchases/:id/cancel`
- `POST /api/admin/inventory/movement`
- `POST /api/admin/inventory/reports`
- `GET /api/admin/inventory/reports`
- `GET /api/admin/inventory/reports/:id`

## Inventory Workflow

Stock addition and inventory counting are separated:

- Regular inventory (`/inventory`):
  - daily inventory counting and report saving
  - inventory report log and report detail view
  - updates stock via transactional report save

- Stock addition (`/admin/stock-add`):
  - for incoming stock
  - UI asks only product, quantity and optional comment
  - backend stores reason as `stock_add`
  - writes `inventory_movements`
  - increases `products.stock_quantity`

- Inventory count (`/admin/inventory-count`):
  - admin-side advanced counting view
  - saves one report header to `inventory_count_reports`
  - saves count rows to `inventory_counts`
  - updates each product stock to counted quantity
  - all done in a single database transaction

- Inventory reports (`/admin/inventory-reports`):
  - shows saved reports permanently
  - opens detailed lines with expected vs counted differences

## Important Business Rules

- Old purchases keep original unit price.
- Debt is calculated from purchases and payments (not stored directly).
- Purchases are not deleted; mistakes are cancelled.
- Cancelled purchases are excluded from debt and statistics.
- Cancelling tracked purchases adds quantity back to stock.
- Stock can go negative.
- Product visibility controls menu visibility.
- Inventory-tracked flag controls stock deduction on purchase.
- People visibility controls buyer selection.
- Product menu order uses `products.sort_order`.
- Frequent buyers can be prioritized via `people.sort_order`.
