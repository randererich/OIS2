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
- `/admin/inventory` (varud + varu lisamine + viimased inventuurid)
- `/admin/purchases`

## Regular API Highlights

- `GET /api/products/menu`
- `GET /api/people/visible`
- `GET /api/people/recent-buyers?minutes=20`
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
- `GET /api/admin/inventory`
- `POST /api/admin/inventory/movement`
- `GET /api/admin/inventory/reports?limit=14`
- `GET /api/admin/inventory/reports/:id`

## Inventory Workflow

Stock addition and inventory counting are separated by role:

- Regular inventory (`/inventory`):
  - daily inventory counting and report saving only
  - requires `Valvevärv` and supports per-row comments
  - shows dynamic inventory status (green/yellow/red) based on difference
  - updates stock via transactional report save

- Admin inventory (`/admin/inventory`):
  - shows current stock overview
  - supports incoming stock adds via `inventory/movement` with reason `stock_add`
  - shows last 14 inventory reports with status and detail modal

## Important Business Rules

- Old purchases keep original unit price.
- Quantity `0` is rejected; negative quantities are allowed as corrections.
- Purchase/debt/statistics views mark negative quantity rows as `Parandus`.
- Debt is calculated from purchases and payments (not stored directly).
- Purchases are not deleted; mistakes are cancelled.
- Cancelled purchases are excluded from debt and statistics.
- Cancelling tracked purchases adds quantity back to stock.
- Stock can go negative.
- Product unit is explicit (`tk` or `cl`) and is shown in POS, purchases, debts, inventory and stats.
- Product visibility controls menu visibility.
- Inventory-tracked flag controls stock deduction on purchase.
- People visibility controls buyer selection.
- Product menu order uses `products.sort_order`.
- Frequent buyers can be prioritized via `people.sort_order`.