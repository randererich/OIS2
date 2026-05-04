# Konvent ÕIS

Konvent ÕIS is a trust-based purchase, debt, stock and inventory system for a shared computer.

Regular users can select a product, enter a quantity or cash amount, select a person, add an optional comment, and save the record. Admin users manage products, categories, people, inventory and mistaken purchase cancellations.

## Stack

- Client: Vue 3, Vite, Pinia, Vue Router
- Server: Node.js, Express
- Database: PostgreSQL
- Auth: shared HTTP Basic Auth credentials
- Runtime: Docker Compose

## Quick Start

Start the full app with Docker:

```bash
docker compose up -d --build
```

Open:

- client: `http://localhost:5173`
- server health: `http://localhost:3000/api/health`
- database: `localhost:5433`

For a fresh database, initialize schema and seed data:

```bash
cat database/schema.sql | docker compose exec -T db psql -U konvent -d konvent_pos
cat database/seed.sql | docker compose exec -T db psql -U konvent -d konvent_pos
```

Useful Docker commands:

```bash
docker compose ps
docker compose logs -f server
docker compose logs -f client
docker compose logs -f db
docker compose restart server
docker compose up -d --build
```

Reset local database data:

```bash
docker compose down -v
docker compose up -d --build
cat database/schema.sql | docker compose exec -T db psql -U konvent -d konvent_pos
cat database/seed.sql | docker compose exec -T db psql -U konvent -d konvent_pos
```

Warning: `docker compose down -v` deletes the database volume.

## Configuration

Docker Compose reads `.env` from the repository root if present.

Common variables:

```text
POSTGRES_USER=konvent
POSTGRES_PASSWORD=change-me
POSTGRES_DB=konvent_pos
PORT=3000
APP_USERNAME=konvent
APP_PASSWORD=change-me
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
CLIENT_ORIGIN=http://localhost:5173
CLIENT_ORIGINS=http://localhost:5173,http://ois2.tartu.vironia.ee:5173,http://ois2.tartu.vironia.ee,https://ois2.tartu.vironia.ee
VITE_API_BASE=/api
```

Auth model:

- regular API calls use `APP_USERNAME` / `APP_PASSWORD`
- `/api/admin/*` calls and admin pages use `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- there are no personal login accounts

## Running Without Docker

Server:

```bash
cd server
npm install
npm run dev
```

Client:

```bash
cd client
npm install
npm run dev
```

For non-Docker server use, set:

```text
DATABASE_URL=postgresql://konvent:konvent@localhost:5433/konvent_pos
```

The Docker client uses Vite proxy `/api -> http://server:3000`, configured in `client/vite.config.js`.

## Main Workflows

### Purchase Entry

Routes:

1. `/` select product
2. `/quantity` enter quantity or cash amount
3. `/person` select person
4. `/confirm` save purchase

Rules:

- quantity cannot be `0`
- normal products require integer quantity
- a single normal purchase is limited to 100 items
- negative normal quantities are allowed as corrections
- inventory-tracked products reduce stock automatically
- purchases are not deleted; admin users cancel mistakes

### Cash Operations

The old `REPART` category is migrated to `Sularaha`.

`Sularaha` contains:

- `Sissemakse`
- `Väljamakse`

For cash operations, the quantity screen becomes a sum screen and decimal amounts are allowed.

Rules:

- `Sissemakse`: selected person's debt decreases and `Sula Raha` balance decreases
- `Väljamakse`: selected person's debt increases and `Sula Raha` balance increases
- `Sula Raha` is created automatically if missing
- `Sula Raha` is hidden from "Viimase 20 minuti ostjad"

### Debts

Debt is calculated dynamically:

```text
debt = non-cancelled purchase totals - payments
```

Positive debt means the person owes money. Negative debt means the person has money over.

### Inventory

Regular inventory page:

- route: `/inventory`
- requires `Valvevärv`
- saves per-product counted quantities and comments
- row is green when counted stock is equal to or greater than expected
- row is red when counted stock is lower than expected
- summary is yellow when total difference is negative

Admin inventory page:

- route: `/admin/inventory`
- shows current stock
- supports incoming stock additions
- shows recent inventory reports

## Frontend Routes

Regular:

- `/` Pane kirja
- `/quantity`
- `/person`
- `/confirm`
- `/debts`
- `/purchases`
- `/stats`
- `/inventory`

Admin:

- `/admin`
- `/admin/products`
- `/admin/categories`
- `/admin/people`
- `/admin/inventory`
- `/admin/purchases`
- `/admin/password`

## API Highlights

Regular:

- `GET /api/products/menu`
- `GET /api/people/visible`
- `GET /api/people/recent-buyers?minutes=20`
- `GET /api/people/:id/balance`
- `GET /api/people/:id/monthly-purchases?month=YYYY-MM&include_cancelled=false`
- `POST /api/purchases`
- `GET /api/purchases`
- `GET /api/payments/debts`
- `GET /api/stats/*`

Admin:

- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `GET /api/admin/people`
- `POST /api/admin/people`
- `PUT /api/admin/people/:id`
- `DELETE /api/admin/people/:id`
- `PATCH /api/admin/purchases/:id/cancel`
- `GET /api/admin/inventory`
- `POST /api/admin/inventory/movement`
- `GET /api/admin/inventory/reports?limit=14`
- `GET /api/admin/inventory/reports/:id`

## How To Change Things

Top navigation, top bar background and light/dark button:

- `client/src/App.vue`

Theme colors, table colors, app spacing and global styles:

- `client/src/style.css`

Product menu/category table rendering:

- `client/src/components/ProductCategoryTable.vue`

Quantity and cash amount entry screen:

- `client/src/pages/POSQuantity.vue`

Confirm page and saved balance text:

- `client/src/pages/POSConfirm.vue`

Auth popup styling:

- `client/src/api/client.js`

Purchase validation and API handling:

- `server/src/controllers/purchases.controller.js`
- `server/src/services/purchase.service.js`

Cash setup and cash double-entry logic:

- `server/src/services/purchase.service.js`
- `server/src/controllers/products.controller.js`

Recent buyers query:

- `server/src/controllers/people.controller.js`

Inventory colors:

- `client/src/pages/Inventory.vue`
- `client/src/pages/admin/AdminInventoryCount.vue`

Database schema and seed data:

- `database/schema.sql`
- `database/seed.sql`

Use idempotent SQL for schema changes when possible: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and guarded inserts. Production data lives in a Docker volume, so editing `schema.sql` alone does not change an existing production database unless the SQL is run or the server performs startup compatibility work.

## Deployment

Deployment is handled by:

```text
.github/workflows/deploy-vm.yml
```

On push to `main`, or manual workflow dispatch:

1. GitHub Actions checks out the repository.
2. It SSHes to the VM.
3. It syncs files to `/home/debian/OIS2/`.
4. It writes `/home/debian/OIS2/.env`.
5. It runs:

```bash
docker compose down || true
docker compose up -d --build
```

Production uses `docker-compose.yml`; there is no separate production compose file.

Required GitHub Secrets:

- `VM_HOST`
- `VM_USER`
- `VM_SSH_KEY`
- `POSTGRES_PASSWORD`
- `APP_PASSWORD`
- `ADMIN_PASSWORD`

Optional secret:

- `VM_PORT`

Supported GitHub Variables:

- `POSTGRES_USER`
- `POSTGRES_DB`
- `PORT`
- `APP_USERNAME`
- `ADMIN_USERNAME`
- `CLIENT_ORIGIN`
- `CLIENT_ORIGINS`
- `VITE_API_BASE`

More deployment detail is in `DEPLOYMENT.md`.

## Production Operations

SSH to the VM:

```bash
ssh debian@your-host
cd /home/debian/OIS2
```

Check status and logs:

```bash
docker compose ps
docker logs konvent-pos-server
docker logs konvent-pos-client
docker logs konvent-pos-db
docker compose logs -f server
```

Open database shell:

```bash
docker compose exec db psql -U konvent -d konvent_pos
```

Backup database:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U konvent konvent_pos > backups/konvent_pos_$(date +%Y%m%d_%H%M%S).sql
```

Restore into an empty database:

```bash
cat backup.sql | docker compose exec -T db psql -U konvent -d konvent_pos
```

## Troubleshooting

Client logs show Vite proxy `ECONNREFUSED`:

```text
http proxy error: /api/products/menu
Error: connect ECONNREFUSED server:3000
```

This usually means the server crashed or has not started. Check:

```bash
docker logs konvent-pos-server
docker compose ps
```

Common server startup problems:

- bad `.env`
- database connection failure
- production database schema is older than the code expects
- startup compatibility SQL failed

Rollback:

1. Revert the bad commit.
2. Push to `main`.
3. Let GitHub Actions redeploy.

Manual VM edits are overwritten by the next GitHub Actions deploy.

## Safety Notes

- do not commit `.env`
- do not commit private SSH keys
- keep production passwords in GitHub Secrets
- do not run `docker compose down -v` on production unless you intentionally want to delete the database
- use admin cancellation instead of deleting purchase history
