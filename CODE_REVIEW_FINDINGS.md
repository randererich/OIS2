# Konvent POS - Comprehensive Code Review Findings

**Date:** May 4, 2026  
**Review Scope:** Full codebase analysis (backend & frontend)  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 1. SQL INJECTION VULNERABILITIES & UNSAFE QUERY PATTERNS

### ✅ Status: SAFE - Parameterized Queries Used Correctly

The codebase properly uses parameterized queries throughout with `$1`, `$2` placeholders:

**Examples of safe patterns:**
- [purchases.controller.js](purchases.controller.js#L27) - Safe ILIKE with parameter placeholders
- [db.js](db.js#L5) - Using `pool.query(text, params)`

**However, watch for:**

#### 🟡 **ISSUE 1.1: Dynamic SQL with String Interpolation** (MEDIUM)
**Files:**
- [people.controller.js](people.controller.js#L82-91)
- [products.controller.js](products.controller.js#L16-40)
- [inventory.controller.js](inventory.controller.js#L56-87)
- [stats.controller.js](stats.controller.js#L26-50)

**Problem:** While not strictly SQL injection since parameters are used, the dynamic SQL building with string interpolation for `unitSql` and `unitGroupBy` is fragile:

```javascript
// Line 16-17 in products.controller.js
const unitSql = hasProductUnit ? "p.unit" : "'tk'::TEXT AS unit";
// Then interpolated: `SELECT ... ${unitSql} ...`
```

**Risk:** If `hasTableColumn` logic breaks or returns unexpected values, could expose database schema details or cause errors.

**Recommendation:** Use safer abstractions or comment the intended behavior clearly.

---

## 2. MISSING ERROR HANDLING & VALIDATION

### 🟠 **ISSUE 2.1: Weak Error Handler Middleware** (HIGH)
**File:** [errorHandler.js](server/src/middleware/errorHandler.js#L1-5)

**Problem:** The error handler exposes too much information and doesn't categorize errors:

```javascript
export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: message }); // ⚠️ Exposes full error messages
}
```

**Issues:**
- Sensitive stack traces logged to console without rotation
- No error classification (database, validation, auth, etc.)
- No request/response logging context
- Raw error messages sent to client (could expose implementation details)

**Recommendation:**
```javascript
export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';
  const status = err.status || 500;
  
  // Don't expose internal details
  const message = isDev ? err.message : 
    (status === 500 ? 'Internal Server Error' : err.message);
  
  // Log with context
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);
  }
  
  res.status(status).json({ error: message });
}
```

---

### 🟠 **ISSUE 2.2: Incomplete Input Validation** (HIGH)
**Files:**
- [purchases.controller.js](purchases.controller.js#L69-77)
- [payments.controller.js](payments.controller.js#L8)
- [inventory.controller.js](inventory.controller.js#L47)

**Problems:**

1. **Purchase creation - missing product existence check before use:**
   ```javascript
   // Line 69-77 in purchases.controller.js
   if (!person_id || !product_id || !Number.isInteger(Number(quantity)) || Number(quantity) === 0) {
     return res.status(400).json({ error: "..." });
   }
   // ❌ No validation that quantity is not too large
   ```

2. **Inventory service assumes valid data:**
   ```javascript
   // Line 56 in inventory.service.js
   for (const count of counts) {
     const productId = Number(count.product_id);
     const countedQuantity = Number(count.counted_quantity);
     
     if (!Number.isInteger(productId) || !Number.isInteger(countedQuantity)) {
       // ❌ Doesn't validate if quantity is negative or unreasonably large
     }
   }
   ```

**Recommendation:** Add validation for:
- Maximum quantity limits
- Negative number constraints where appropriate
- Decimal place precision (for currency)

---

### 🟡 **ISSUE 2.3: Missing Frontend Form Validation** (MEDIUM)
**Files:**
- [Products.vue](Products.vue#L45-56)
- [POSQuantity.vue](POSQuantity.vue#L94-118)

**Problem:** HTML5 `required` attributes alone are insufficient:

```vue
<!-- Line 45-56 in Products.vue -->
<label>
  Hind
  <input v-model="form.price" type="number" step="0.01" required />
</label>
```

**Missing checks:**
- Price cannot be zero
- Stock quantity shouldn't be negative in initial creation
- No max-length validation on text fields
- Checkbox values not validated in form submission

**Recommendation:**
```vue
<script setup>
function validateProductForm() {
  if (!form.name || form.name.trim().length === 0) {
    error.value = "Nimi on kohustuslik";
    return false;
  }
  if (Number(form.price) <= 0) {
    error.value = "Hind peab olema suurem kui 0";
    return false;
  }
  if (Number(form.stock_quantity) < 0) {
    error.value = "Laos ei saa olla negatiivne";
    return false;
  }
  return true;
}

async function saveProduct() {
  error.value = "";
  if (!validateProductForm()) return;
  // ... rest
}
</script>
```

---

### 🟡 **ISSUE 2.4: Plaintext Password Storage** (MEDIUM - SECURITY)
**File:** [adminAuth.controller.js](server/src/controllers/adminAuth.controller.js#L29-58)

**Problem:** Admin password is stored in plaintext in `.env` file:

```javascript
// Line 51-58 in adminAuth.controller.js
await writeFile(envFilePath, updated, "utf8");
process.env.ADMIN_PASSWORD = String(new_password);
```

**Risk:** Anyone with file system access can read the password. `.env` files are often not properly secured.

**Recommendation:**
- Use bcrypt for password hashing
- Store hashed version in `.env`
- Compare with bcrypt.compare()
- Consider using a secrets management system for production

---

## 3. TYPE COERCION ISSUES & INCONSISTENT TYPE HANDLING

### 🟡 **ISSUE 3.1: Unsafe Number Conversions** (MEDIUM)
**Files:**
- [people.controller.js](people.controller.js#L28-30)
- [products.controller.js](products.controller.js#L71-80)
- [inventory.controller.js](inventory.controller.js#L47-52)

**Problems:**

```javascript
// Line 28-30 in people.controller.js
const personId = Number(req.params.id);
if (!personId) {  // ❌ BUG: Number(0) is falsy!
  return res.status(400).json({ error: "valid person id is required" });
}
```

This fails when ID is `0`. Better check:

```javascript
const personId = Number(req.params.id);
if (!Number.isInteger(personId) || personId <= 0) {
  return res.status(400).json({ error: "valid person id is required" });
}
```

**Other locations with this issue:**
- [products.controller.js](products.controller.js#L71) - `const id = Number(req.params.id);`
- [categories.controller.js](categories.controller.js#L46) - `const id = Number(req.params.id);`
- [inventory.controller.js](inventory.controller.js#L109) - `const reportId = Number(req.params.id);`

---

### 🟡 **ISSUE 3.2: String-to-Boolean Coercion Issues** (MEDIUM)
**File:** [purchases.controller.js](purchases.controller.js#L8)

**Problem:**
```javascript
const includeCancelled = String(req.query.include_cancelled || "false") === "true";
```

This only works if the string is exactly `"true"`. Other truthy values like `"1"`, `"yes"`, or just `"cancelled"` won't work.

**Recommendation:**
```javascript
function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

const includeCancelled = parseBoolean(req.query.include_cancelled);
```

---

### 🟡 **ISSUE 3.3: Numeric Precision Issues** (MEDIUM)
**File:** [POSQuantity.vue](POSQuantity.vue#L54-88)

**Problem:** Floating-point arithmetic in JavaScript can lose precision:

```javascript
// Line 54-88 in POSQuantity.vue
function sanitizeRawInput(raw) {
  const normalized = String(Number(sanitized)); // ⚠️ Float precision issue
  return negative ? `-${normalized}` : normalized;
}
```

When dealing with prices/quantities, should use fixed decimal places:

```javascript
function sanitizeRawInput(raw) {
  let num = Number(sanitized);
  num = Math.round(num * 100) / 100; // For 2 decimal places
  return negative ? `-${num.toFixed(2)}` : num.toFixed(2);
}
```

---

## 4. RACE CONDITIONS & CONCURRENCY ISSUES

### ✅ Status: MOSTLY SAFE - Transaction Locking Used

The codebase uses `FOR UPDATE` row locks in transactions, which is good:

```javascript
// [purchase.service.js](purchase.service.js#L12-18)
const productResult = await client.query(
  `SELECT id, name, price, stock_quantity, is_inventory_tracked
   FROM products
   WHERE id = $1
   FOR UPDATE`,  // ✅ Row lock prevents race conditions
  [productId]
);
```

**However:**

### 🟡 **ISSUE 4.1: Potential Race Condition in Stock Check** (MEDIUM)
**File:** [purchase.service.js](purchase.service.js#L11-48)

**Problem:** No check if stock_quantity goes negative:

```javascript
// Line 43-47 in purchase.service.js
if (product.is_inventory_tracked) {
  await client.query(
    `UPDATE products
     SET stock_quantity = stock_quantity - $1
     WHERE id = $2`,
    [quantity, productId]
  );
  // ❌ No validation that stock_quantity doesn't go below 0
}
```

**Scenario:** If you have 5 units and two concurrent purchases of 3 units each, stock could go to -1.

**Recommendation:**
```javascript
if (product.is_inventory_tracked) {
  const result = await client.query(
    `UPDATE products
     SET stock_quantity = GREATEST(0, stock_quantity - $1)
     WHERE id = $2
     RETURNING stock_quantity`,
    [quantity, productId]
  );
  
  if (result.rows[0].stock_quantity === 0 && quantity > 0) {
    // Warn about insufficient stock
  }
}
```

Or better, warn before completing purchase if stock is insufficient.

---

### 🟡 **ISSUE 4.2: Missing Deadlock Handling** (MEDIUM)
**File:** [db.js](db.js#L28-39)

**Problem:** Transaction doesn't retry on deadlock:

```javascript
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;  // ❌ No retry logic for deadlocks
  }
}
```

**Recommendation:** Add exponential backoff retry:
```javascript
export async function transaction(callback, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === '40P01' && attempt < maxRetries) { // Deadlock
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
```

---

## 5. POTENTIAL NULL/UNDEFINED REFERENCE ERRORS

### 🟡 **ISSUE 5.1: Missing Optional Chaining** (MEDIUM)
**File:** [POSConfirm.vue](POSConfirm.vue#L12-28)

**Problem:**
```vue
<!-- Line 12-28 in POSConfirm.vue -->
<p class="inline-summary">
  <template v-if="isCorrection">
    <strong>Parandus:</strong>
  </template>
  {{ posStore.quantity }} {{ posStore.product?.unit || 'tk' }} x {{ posStore.product?.name }} = {{ money(posStore.total) }},
  {{ posStore.person?.first_name }} {{ posStore.person?.last_name }}.
</p>
```

Issues:
- `posStore.quantity` not checked (could be 0)
- `posStore.product` accessed without full null safety in interpolation
- `posStore.person?.first_name` could still be undefined

**Recommendation:**
```vue
<p v-if="posStore.product && posStore.person" class="inline-summary">
  <template v-if="isCorrection">
    <strong>Parandus:</strong>
  </template>
  {{ posStore.quantity ?? 0 }} {{ posStore.product.unit || 'tk' }} x 
  {{ posStore.product.name }} = {{ money(posStore.total) }},
  {{ posStore.person.first_name || '?' }} {{ posStore.person.last_name || '?' }}.
</p>
```

---

### 🟡 **ISSUE 5.2: Unsafe Array/Object Access** (MEDIUM)
**File:** [people.controller.js](people.controller.js#L131-138)

**Problem:**
```javascript
// Line 131-138 in people.controller.js
const summaryResult = await query(`SELECT ... ORDER BY ...`, params);

const hasProductUnit = await hasTableColumn("products", "unit");
const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";

const purchasesResult = await query(`SELECT ... ${unitSql} ...`, params);
// ❌ What if purchasesResult.rows is empty?
res.json({
  person: personResult.rows[0],  // Could be undefined if no person
  month,
  summary_by_product: summaryResult.rows,
  purchases: purchasesResult.rows
});
```

---

### 🟡 **ISSUE 5.3: Unhandled Promise Rejections** (MEDIUM)
**File:** [POSProductSelect.vue](POSProductSelect.vue#L20-23)

**Problem:**
```javascript
// Line 20-23 in POSProductSelect.vue
async function loadMenu() {
  loading.value = true;
  error.value = "";
  try {
    categories.value = await apiFetch("/products/menu");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
```

This is actually good, but many other places don't have this pattern:

**Missing try-catch in:**
- [POSPersonSelect.vue](POSPersonSelect.vue) - `loadPeople()` inside `onMounted`
- Frontend API client doesn't validate JSON responses

---

## 6. HARDCODED VALUES THAT SHOULD BE CONSTANTS

### 🟡 **ISSUE 6.1: Magic Numbers Throughout Codebase** (MEDIUM)

**File:** [purchases.controller.js](purchases.controller.js#L14-16)
```javascript
const requestedLimit = Number.parseInt(String(req.query.limit || "100"), 10);
const requestedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 500) : 100;
// ❌ Hardcoded: 100, 500, 0
```

**Other locations:**
- [people.controller.js](people.controller.js#L80) - `LIMIT 200`
- [stats.controller.js](stats.controller.js#L74) - `Math.min(requestedLimit, 100)`
- [payments.controller.js](payments.controller.js#L49) - `LIMIT 300`
- [inventory.controller.js](inventory.controller.js#L102) - `Math.min(requestedLimit, 100)`
- [client/src/api/client.js](client/src/api/client.js#L4) - `const REGULAR_AUTH_TTL_SECONDS = 30 * 60;`

**Recommendation:** Create a config file:
```javascript
// config.js
export const API_LIMITS = {
  PURCHASES_DEFAULT: 100,
  PURCHASES_MAX: 500,
  PEOPLE_MAX: 200,
  DEBTS_MAX: 300,
  STATS_MAX: 100,
  INVENTORY_MAX: 100,
};

export const AUTH = {
  REGULAR_TTL_SECONDS: 30 * 60,
  RECENT_BUYERS_MINUTES: 20,
};

// Then import and use
import { API_LIMITS } from '../config.js';
const limit = Math.min(requestedLimit, API_LIMITS.PURCHASES_MAX);
```

---

## 7. DUPLICATE CODE THAT COULD BE REFACTORED

### 🟡 **ISSUE 7.1: Repeated Date Filter Building** (MEDIUM)
**Files:**
- [stats.controller.js](stats.controller.js#L21-42) - `buildDateFilter()`
- [purchases.controller.js](purchases.controller.js#L9-48) - inline date filter
- [inventory.controller.js](inventory.controller.js#L124-134) - inline date filter

These should all use the same utility function.

**Recommendation:** Create shared utility:
```javascript
// utils/queryBuilder.js
export function buildDateFilter(req, paramStartIndex = 1) {
  const params = [];
  const clauses = [];
  const dateFrom = (req.query.date_from || "").trim();
  const dateTo = (req.query.date_to || "").trim();

  if (dateFrom) {
    params.push(dateFrom);
    clauses.push(`pu.created_at >= $${paramStartIndex + params.length - 1}::timestamptz`);
  }

  if (dateTo) {
    params.push(dateTo);
    clauses.push(`pu.created_at < ($${paramStartIndex + params.length - 1}::date + INTERVAL '1 day')`);
  }

  return {
    params,
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : ""
  };
}
```

---

### 🟡 **ISSUE 7.2: Repeated `hasTableColumn()` Calls** (MEDIUM)
**Files:**
- [products.controller.js](products.controller.js#L14)
- [purchases.controller.js](purchases.controller.js#L6)
- [stats.controller.js](stats.controller.js#L51-52)
- Multiple other files

Each controller calls this repeatedly. Consider caching at app startup:

```javascript
// Initialize once at app startup
export async function initializeSchemaCache() {
  const TRACKED_COLUMNS = [
    ['products', 'unit'],
    ['inventory_count_reports', 'valvevarv']
  ];
  
  for (const [table, column] of TRACKED_COLUMNS) {
    await hasTableColumn(table, column);
  }
}

// In app.js - call on startup
await initializeSchemaCache();
```

---

### 🟡 **ISSUE 7.3: Duplicate Money Formatter Functions** (MEDIUM)
**Files:**
- [POSProductSelect.vue](POSProductSelect.vue) - has `money()` function
- [POSConfirm.vue](POSConfirm.vue#L39-45) - has `money()` function
- [POSPersonSelect.vue](POSPersonSelect.vue) - has `money()` function
- [Purchases.vue](Purchases.vue) - has `money()` function
- [Products.vue](Products.vue) - has `money()` function

**Recommendation:** Create shared utility:
```javascript
// utils/formatters.js
export function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

// Import in components
import { money } from '../utils/formatters.js';
```

---

### 🟡 **ISSUE 7.4: Duplicate People Parsing Logic** (MEDIUM)
**Files:**
- [POSPersonSelect.vue](POSPersonSelect.vue#L50-66) - `parseCoetusParts()` + `compareCoetusDesc()`
- [people.controller.js](people.controller.js#L2-6) - `COETUS_SORT_SQL` with regex

The sorting logic is duplicated across frontend and backend.

---

## 8. INCONSISTENT NAMING CONVENTIONS

### 🟡 **ISSUE 8.1: Snake_case vs camelCase Inconsistency** (MEDIUM)

**API Parameters:**
- `person_id` (snake_case) vs `personId` (camelCase)
- `stock_quantity` vs internal JavaScript uses camelCase
- `product_id`, `unit_price`, `total_price` (snake_case)

**Database columns:**
- All snake_case (correct for SQL)

**JavaScript variables:**
- Mostly camelCase (correct for JS)

**Frontend Vue props:**
- Mixed: `category_id`, `sort_order` from API; internally `isVisible`, `isInventoryTracked`

**Issue:** Creates confusion when mapping between API and frontend.

**Recommendation:**
1. Use snake_case consistently in API requests/responses
2. Transform to camelCase immediately on frontend:
```javascript
function transformApiResponse(data) {
  return {
    categoryId: data.category_id,
    sortOrder: data.sort_order,
    // ... etc
  };
}
```

Or use a library like `snake-case-to-camelcase`.

---

### 🟡 **ISSUE 8.2: Query Parameter Name Inconsistency** (MEDIUM)

**Files:**
- [purchases.controller.js](purchases.controller.js#L8) - uses `search`
- [people.controller.js](people.controller.js#L28) - uses `q`
- [payments.controller.js](payments.controller.js#L35) - uses `q`

Both `search` and `q` are used for the same purpose.

**Recommendation:** Use one consistently, probably `q` for brevity or `search` for clarity. Pick one and stick with it.

---

## 9. MISSING INPUT VALIDATION

### 🟡 **ISSUE 9.1: No Validation for Maximum Text Lengths** (MEDIUM)

**Files:**
- [Products.vue](Products.vue) - No max-length on product name, category name
- [people.controller.js](people.controller.js#L215) - Accepts any length `first_name`, `last_name`
- [categories.controller.js](categories.controller.js#L14) - No max-length for category name
- [database/schema.sql](database/schema.sql) - TEXT fields with no constraints

**Problem:** Could cause UI display issues or database performance problems.

**Recommendation:** Add constraints:
```sql
ALTER TABLE people 
  ADD CONSTRAINT first_name_length CHECK (length(first_name) <= 100),
  ADD CONSTRAINT last_name_length CHECK (length(last_name) <= 100),
  ADD CONSTRAINT coetus_length CHECK (length(coetus) <= 20),
  ADD CONSTRAINT konvent_length CHECK (length(konvent) <= 100);
```

---

### 🟡 **ISSUE 9.2: No Validation for Emoji Field** (MEDIUM)
**File:** [categories.controller.js](categories.controller.js#L14-31)

```javascript
const result = await query(
  `INSERT INTO categories (name, emoji, sort_order, is_visible)
   VALUES ($1, $2, $3, $4)`,
  [name, emoji || null, resolvedSortOrder, Boolean(is_visible)]
);
// ❌ No validation that emoji is actually an emoji
```

Could insert any string. Should validate:
```javascript
function isValidEmoji(str) {
  if (!str) return true; // Optional
  // Check if it's a single emoji or reasonable length
  return /^(?:[\u2700-\u27bf]|(?:\ud83c[\udf00-\udfff])|(?:\ud83d[\udc00-\ude4f])|(?:\ud83d[\ude80-\udeff])|(?:\ud83e[\udd00-\uddff]))+$/.test(str);
}

if (emoji && !isValidEmoji(emoji)) {
  return res.status(400).json({ error: "Invalid emoji" });
}
```

---

## 10. PERFORMANCE ISSUES

### 🟠 **ISSUE 10.1: Potential N+1 Query Problem** (HIGH)
**File:** [stats.controller.js](stats.controller.js) - Multiple stats endpoints

Each endpoint might be called independently, causing multiple queries:

```javascript
// 5 separate API calls from frontend = 5 SQL queries
await apiFetchAdmin("/admin/stats/top-spenders");
await apiFetchAdmin("/admin/stats/top-products-quantity");
await apiFetchAdmin("/admin/stats/top-products-revenue");
// etc.
```

**Recommendation:** Create a combined stats endpoint:
```javascript
router.get("/admin/stats/dashboard", async (req, res) => {
  const results = await Promise.all([
    getTopSpendersData(req),
    getTopProductsData(req),
    // ... etc
  ]);
  res.json({
    topSpenders: results[0],
    topProducts: results[1],
    // ...
  });
});
```

---

### 🟡 **ISSUE 10.2: Missing Query Result Pagination Defaults** (MEDIUM)
**File:** [getInventoryReports](server/src/controllers/inventory.controller.js#L95-102)

```javascript
const defaultLimit = req.baseUrl.startsWith("/api/admin") ? 14 : 50;
// ⚠️ Different defaults based on URL path
```

This works but is fragile. Better approach:
```javascript
const DEFAULT_LIMITS = {
  admin: 14,
  public: 50
};

const isAdmin = req.baseUrl.startsWith("/api/admin");
const defaultLimit = DEFAULT_LIMITS[isAdmin ? 'admin' : 'public'];
```

---

### 🟡 **ISSUE 10.3: Multiple API Calls Could Be Batched** (MEDIUM)
**File:** [Products.vue](Products.vue#L53-57)

```javascript
async function loadData() {
  error.value = "";
  try {
    const [productsData, categoriesData] = await Promise.all([
      apiFetchAdmin("/admin/products"),
      apiFetchAdmin("/admin/categories")
    ]);
    // ✅ Good: Uses Promise.all
```

But other components load data sequentially:

**File:** [POSPersonSelect.vue](POSPersonSelect.vue#L109-116)
```javascript
async function loadPeople() {
  loading.value = true;
  error.value = "";
  try {
    const [peopleData, recentData] = await Promise.all([
      apiFetch("/people/visible"),
      apiFetch("/people/recent-buyers?minutes=20")
    ]);
    // ✅ Already using Promise.all - good!
```

---

### 🟡 **ISSUE 10.4: Frontend Doesn't Cache API Responses** (MEDIUM)
**Files:** All Vue components

Every time a component mounts, it refetches data:

```javascript
// onMounted(() => {
//   loadPeople(); // Fetches even if already loaded
// });
```

**Recommendation:** Implement caching in the store or API client:
```javascript
// utils/apiCache.js
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCachedData(key, data) {
  cache.set(key, { data, time: Date.now() });
}
```

---

### 🟡 **ISSUE 10.5: Missing Database Indexes for Common Queries** (MEDIUM)
**File:** [schema.sql](database/schema.sql#L148-155)

**Existing indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_people_visible_sort ON people (is_visible, sort_order, last_name, first_name);
```

**Missing useful indexes:**
- `idx_purchases_person_created` for filtering by person + date
- `idx_products_name` for product search
- `idx_people_name` for people search
- `idx_categories_name` for category search

**Recommendation:** Add:
```sql
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_people_name ON people (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_purchases_person_created ON purchases (person_id, created_at) WHERE is_cancelled = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at);
```

---

## 11. OTHER ISSUES

### 🟡 **ISSUE 11.1: CORS Configuration Too Permissive** (MEDIUM)
**File:** [app.js](server/src/app.js#L18-26)

```javascript
const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) {  // ❌ !origin allows any request
        return callback(null, true);
      }
```

**Problem:** `!origin` returns true for same-origin requests, which bypasses CORS check for direct browser requests.

**Recommendation:**
```javascript
origin(origin, callback) {
  if (!origin) {
    // For same-origin requests, you may want to block or allow depending on policy
    // return callback(new Error('Origin required'));
    return callback(null, true); // Allow same-origin
  }
  if (clientOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS origin not allowed: ${origin}`));
}
```

---

### 🟡 **ISSUE 11.2: Missing Request ID/Correlation ID** (MEDIUM)
**File:** [errorHandler.js](server/src/middleware/errorHandler.js)

No way to track requests across logs. Should add correlation ID:

```javascript
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.set('X-Request-ID', req.id);
  next();
});
```

---

### 🟡 **ISSUE 11.3: Missing API Rate Limiting** (MEDIUM)
**File:** [app.js](server/src/app.js)

No rate limiting, could be vulnerable to brute force or DoS attacks.

**Recommendation:** Add express-rate-limit:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

### 🟡 **ISSUE 11.4: Weak Basic Auth Implementation** (MEDIUM)
**Files:** [basicAuth.js](server/src/middleware/basicAuth.js), [adminAuth.js](server/src/middleware/adminAuth.js)

Basic auth transmits credentials in Base64 (easily reversible). Should:
1. Use HTTPS only (not enforced)
2. Consider JWT tokens for API
3. Add rate limiting to prevent brute force

---

### 🟡 **ISSUE 11.5: No API Documentation** (MEDIUM)
No OpenAPI/Swagger documentation for the API. Should add auto-generated docs.

---

### 🟢 **ISSUE 11.6: Missing Unit Tests** (LOW)
No test files in repository. Would help catch many of these issues.

---

## SUMMARY TABLE

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| SQL/Security | 1 | 0 | 0 | 1 | 0 |
| Error Handling | 4 | 0 | 2 | 2 | 0 |
| Type Handling | 3 | 0 | 0 | 3 | 0 |
| Concurrency | 2 | 0 | 0 | 2 | 0 |
| Null Safety | 3 | 0 | 0 | 3 | 0 |
| Code Quality | 10 | 0 | 0 | 9 | 1 |
| Validation | 2 | 0 | 1 | 1 | 0 |
| Performance | 5 | 1 | 0 | 5 | 0 |
| Security | 3 | 0 | 0 | 3 | 0 |
| Documentation | 1 | 0 | 0 | 0 | 1 |
| **TOTAL** | **34** | **0** | **3** | **29** | **2** |

---

## PRIORITY RECOMMENDATIONS

### Immediate (Next Sprint)
1. 🟠 **FIX ISSUE 2.1**: Improve error handler to not expose sensitive details
2. 🟠 **FIX ISSUE 2.4**: Hash admin passwords with bcrypt instead of plaintext
3. 🟠 **FIX ISSUE 3.1**: Fix falsy check bug in ID validation (affects 5+ endpoints)
4. 🟠 **FIX ISSUE 10.1**: Add combined dashboard endpoint to reduce N+1 queries

### Short Term (Next 2 Sprints)
1. 🟡 **FIX ISSUE 2.2**: Add comprehensive input validation
2. 🟡 **FIX ISSUE 3.2**: Standardize boolean parsing
3. 🟡 **FIX ISSUE 4.1**: Add stock availability checks
4. 🟡 **FIX ISSUE 7.1-7.4**: Refactor duplicate code

### Medium Term (Next Month)
1. 🟡 **ADD TESTS**: Create unit and integration tests
2. 🟡 **ADD API DOCS**: Generate OpenAPI/Swagger documentation
3. 🟡 **ADD RATE LIMITING**: Implement express-rate-limit
4. 🟡 **ADD LOGGING**: Implement proper structured logging with correlation IDs

---

## FILES TO REVIEW FIRST
Priority order for fixes:
1. [db.js](db.js) - Transaction handling
2. [middleware/errorHandler.js](server/src/middleware/errorHandler.js) - Error handling
3. [controllers/adminAuth.controller.js](server/src/controllers/adminAuth.controller.js) - Password hashing
4. [people.controller.js](people.controller.js), [products.controller.js](products.controller.js), [categories.controller.js](categories.controller.js) - ID validation
5. [config.js] - Create for constants
6. [utils/queryBuilder.js] - Create for shared utilities
7. [utils/formatters.js] - Create for shared formatters
