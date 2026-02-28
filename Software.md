# 🏍️ Ridermate — Next.js Recreation Specification

> **Purpose:** This document describes how to recreate the full Ridermate mobile app as a **Next.js web application**, using the **exact same Supabase database**, the same input fields, and producing the same output data. Every screen, table, business rule, and calculation is documented here.

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Supabase Database Schema](#3-supabase-database-schema)
4. [Design System & Colors](#4-design-system--colors)
5. [Pages & Routes](#5-pages--routes)
6. [Page 1 — Dashboard](#6-page-1--dashboard)
7. [Page 2 — Income](#7-page-2--income)
8. [Page 3 — Expenses](#8-page-3--expenses)
9. [Page 4 — Banking](#9-page-4--banking)
10. [Page 5 — Liabilities](#10-page-5--liabilities)
11. [Page 6 — Preferences](#11-page-6--preferences)
12. [Shared Components](#12-shared-components)
13. [Business Logic & Calculations](#13-business-logic--calculations)
14. [Supabase Realtime](#14-supabase-realtime)
15. [Environment Variables](#15-environment-variables)
16. [Migration SQL Scripts](#16-migration-sql-scripts)
17. [Folder Structure](#17-folder-structure)

---

## 1. Project Overview

**Ridermate** is a personal finance and operations tracker specifically built for **ride-hailing drivers** (Uber / PickMe) in Sri Lanka. The currency is Sri Lankan Rupees (Rs.).

### Core Features
| Feature | Description |
|---|---|
| **Income Tracking** | Log daily ride-app earnings, km driven, fuel, wallet & cash balances |
| **Side Hustle Tracking** | Log freelance income (Graphics Design, Video Editing, Web Design) |
| **Expense Tracking** | Log daily expenses by category, linked to bank accounts |
| **Expense Budgets** | Set monthly spending limits per category |
| **Recurring Expenses** | Define repeating bills that auto-generate expense entries |
| **Banking** | Manage multiple bank/wallet accounts, inter-account transfers |
| **Liabilities** | Track loans, pawning (ring), bike finance, with interest calculations |
| **Fuel Tank** | Visual live gauge showing current fuel level and km range |
| **Service Reminder** | KM countdown until next bike service |
| **Smart Allocation** | Auto-split today's income into Savings / Fuel Reserve / Service / Daily Spend |
| **Summary Charts** | Bar chart — Income vs Expenses over Daily / Weekly / Monthly views |
| **Preferences** | Configure petrol price, fuel efficiency, service cost, income targets |

---

## 2. Tech Stack

```
Framework    : Next.js 14+ (App Router)
Language     : TypeScript
Database     : Supabase (PostgreSQL) — SAME project as mobile app
Auth         : None (single-user, no auth required — RLS is open)
Styling      : Tailwind CSS (or Vanilla CSS — dark theme)
Charts       : Recharts (bar chart, donut chart)
Icons        : Lucide React (replaces Ionicons)
Realtime     : Supabase Realtime (postgres_changes)
HTTP Client  : @supabase/supabase-js
```

### Install Commands
```bash
npx create-next-app@latest ridermate-web --typescript --app --tailwind
cd ridermate-web
npm install @supabase/supabase-js recharts lucide-react
```

---

## 3. Supabase Database Schema

> **Connection:** Use the same Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

---

### Table: `income_records`

```sql
CREATE TABLE IF NOT EXISTS income_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  income_type   TEXT NOT NULL CHECK (income_type IN ('main', 'side')),

  -- Main Income fields (Uber / PickMe)
  app             TEXT,           -- 'Uber' or 'PickMe'
  start_km        NUMERIC,        -- Odometer start KM
  end_km          NUMERIC,        -- Odometer end KM
  total_distance  NUMERIC,        -- Derived: end_km - start_km
  daily_earning   NUMERIC,        -- Total app earnings (Rs.)
  cash_on_hand    NUMERIC,        -- Cash + tips physically held (Rs.)
  wallet_balance  NUMERIC,        -- Uber/PickMe wallet balance (Rs.)
  fuel_expense    NUMERIC,        -- Fuel cost paid today (Rs.)

  -- Side Hustle fields
  side_category   TEXT,           -- e.g. 'Graphics Design'
  client          TEXT,           -- Client name
  note            TEXT,
  amount          NUMERIC,        -- Side hustle payment amount (Rs.)

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_income_records_date ON income_records(date);
```

**Key rules:**
- One row per day per `income_type='main'` (upsert by `date + income_type`)
- Multiple rows allowed per day for `income_type='side'` (one per client/job)
- `start_km` auto-populates from yesterday's `end_km`

---

### Table: `daily_expenses`

```sql
CREATE TABLE IF NOT EXISTS daily_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  category    TEXT NOT NULL,     -- see EXPENSE_CATEGORIES below
  amount      NUMERIC NOT NULL,
  note        TEXT,
  bank_id     UUID REFERENCES banks(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Expense Categories (hard-coded):**
| key | label | color |
|---|---|---|
| `fuel` | Fuel | `#E8854A` |
| `food` | Food | `#1DB98A` |
| `maintenance` | Maintenance | `#D4A843` |
| `parking` | Parking | `#4A9FD4` |
| `tolls` | Tolls | `#7B74FF` |
| `other` | Other | `#E05577` |

Plus custom categories from `expense_categories` table.

**Bank balance deduction rule:** When an expense is saved for today or past date, deduct `amount` from `banks.current_balance` for the selected `bank_id`. Future-dated expenses do NOT deduct immediately.

---

### Table: `expense_categories`

```sql
CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'pricetag-outline',
  color      TEXT NOT NULL DEFAULT '#7B74FF',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Table: `expense_budgets`

```sql
CREATE TABLE IF NOT EXISTS expense_budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL UNIQUE,
  monthly_limit NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Table: `recurring_expenses`

```sql
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  frequency  TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  next_date  DATE NOT NULL,
  note       TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Table: `banks`

```sql
CREATE TABLE IF NOT EXISTS banks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  account_type     TEXT NOT NULL CHECK (account_type IN (
                     'daily_use','savings','liability','emergency','wallet','cash')),
  starting_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance  NUMERIC NOT NULL DEFAULT 0,
  logo_url         TEXT,
  color            TEXT,
  is_system        BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 5 system accounts
INSERT INTO banks (name, account_type, starting_balance, current_balance, color, is_system, sort_order)
VALUES
  ('ComBank',      'daily_use', 0, 0, '#4A9FD4', true, 1),
  ('FriMi',        'liability', 0, 0, '#7B74FF', true, 2),
  ('Sampath',      'savings',   0, 0, '#1DB98A', true, 3),
  ('Uber Wallet',  'wallet',    0, 0, '#E8854A', true, 4),
  ('Cash on Hand', 'cash',      0, 0, '#D4A843', true, 5)
ON CONFLICT DO NOTHING;
```

**Account Types:**
| type | label | color |
|---|---|---|
| `daily_use` | Daily Use | `#4A9FD4` |
| `savings` | Savings | `#1DB98A` |
| `liability` | Liability | `#E05577` |
| `emergency` | Emergency | `#E05555` |
| `wallet` | Wallet | `#E8854A` |
| `cash` | Cash | `#D4A843` |

---

### Table: `bank_transfers`

```sql
CREATE TABLE IF NOT EXISTS bank_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bank_id   UUID REFERENCES banks(id) ON DELETE SET NULL,
  to_bank_id     UUID REFERENCES banks(id) ON DELETE SET NULL,
  amount         NUMERIC NOT NULL,
  service_charge NUMERIC NOT NULL DEFAULT 0,
  note           TEXT,
  transfer_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Table: `liabilities`

```sql
CREATE TABLE IF NOT EXISTS liabilities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  liability_type   TEXT NOT NULL DEFAULT 'loan'
                   CHECK (liability_type IN ('pawning','finance','loan','credit_card','other')),
  interest_method  TEXT NOT NULL DEFAULT 'flat'
                   CHECK (interest_method IN ('flat','reducing_balance','interest_only','none')),
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_rate    NUMERIC NOT NULL DEFAULT 0,  -- % per month
  monthly_payment  NUMERIC NOT NULL DEFAULT 0,
  arrears_amount   NUMERIC DEFAULT 0,           -- starting overdue amount
  payment_day      INTEGER,                     -- day of month (1-31)
  start_date       DATE,
  end_date         DATE,
  priority_percent NUMERIC DEFAULT 0,           -- % of income allocated
  priority_level   TEXT CHECK (priority_level IN ('high','medium','low')),
  note             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Liability Types:**
| type | label | default method |
|---|---|---|
| `pawning` | Ring (Pawning) | `interest_only` |
| `finance` | Bike (Finance) | `reducing_balance` |
| `loan` | Loan | `flat` |
| `credit_card` | Mobile Phone | `flat` |
| `other` | Other | `none` |

---

### Table: `liability_payments`

```sql
CREATE TABLE IF NOT EXISTS liability_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_id  UUID REFERENCES liabilities(id) ON DELETE CASCADE,
  amount        NUMERIC NOT NULL,
  payment_date  DATE NOT NULL,
  note          TEXT,
  bank_id       UUID REFERENCES banks(id) ON DELETE SET NULL,
  is_future     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Table: `preferences`

```sql
CREATE TABLE IF NOT EXISTS preferences (
  id                          TEXT PRIMARY KEY DEFAULT 'default',
  petrol_price_per_liter      NUMERIC DEFAULT 370,
  fuel_efficiency_km_per_liter NUMERIC DEFAULT 30,
  current_fuel_range_km       NUMERIC DEFAULT 0,    -- auto-derived
  bike_service_cost_monthly   NUMERIC DEFAULT 3000,
  bike_service_interval_km    NUMERIC DEFAULT 3000,
  distance_to_next_service_km NUMERIC DEFAULT 0,
  other_monthly_expenses      NUMERIC DEFAULT 0,
  currency                    TEXT DEFAULT 'Rs.',
  daily_income_target         NUMERIC DEFAULT 5000,
  monthly_income_target       NUMERIC DEFAULT 100000,
  fuel_tank_capacity_liters   NUMERIC DEFAULT 10.5,
  fuel_liters_current         NUMERIC DEFAULT 0,    -- updates on fuel expense
  last_service_odometer_km    NUMERIC DEFAULT 0,
  rider_name                  TEXT DEFAULT 'Rider',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert one default row (singleton pattern)
INSERT INTO preferences (id) VALUES ('default') ON CONFLICT DO NOTHING;
```

---

### Table: `side_hustle_categories`

```sql
CREATE TABLE IF NOT EXISTS side_hustle_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default seed
INSERT INTO side_hustle_categories (name) VALUES
  ('Graphics Design'), ('Video Editing'), ('Web Design')
ON CONFLICT DO NOTHING;
```

---

## 4. Design System & Colors

Use these exact color values throughout the Next.js app. Apply a **deep dark navy background** with glass-morphism card effects.

```typescript
// theme.ts — use CSS variables or a constants file
export const C = {
  bg:           '#09090F',      // Page background
  surface:      'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.07)',
  accent:       '#7B74FF',      // Purple — primary accent, buttons, Income tab
  accentGreen:  '#1DB98A',      // Savings, positive amounts, income bars
  accentOrange: '#E8854A',      // Fuel, Expenses tab, warning states
  accentYellow: '#D4A843',      // Service reminder, cash/wallet
  accentPink:   '#E05577',      // Liability accounts
  accentBlue:   '#4A9FD4',      // Banking, daily use accounts, chart
  accentRed:    '#E05555',      // Errors, deficits, debt
  text:         'rgba(255,255,255,0.90)',
  muted:        'rgba(255,255,255,0.35)',
  error:        '#E05555',
  card:         'rgba(255,255,255,0.04)',
};
```

### Glass Card Style
```css
.glass-card {
  background: rgba(255,255,255,0.04);
  border: 0.5px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(12px);
}
```

### Typography
- Font: **Inter** (Google Fonts)
- Numbers/amounts: `font-weight: 700`, slightly larger than labels
- Labels: `font-weight: 400`, muted color
- Section titles: `font-weight: 600`

---

## 5. Pages & Routes

The app has 6 main pages accessible via a persistent bottom navigation bar (or sidebar on desktop).

| Route | Page | Mobile Tab Icon |
|---|---|---|
| `/` | Dashboard | Home / grid |
| `/income` | Income | Trending-up |
| `/expenses` | Expenses | Receipt |
| `/banking` | Banking | Bank / credit card |
| `/liabilities` | Liabilities | Swap / debt |
| `/preferences` | Preferences | Settings / gear |

---

## 6. Page 1 — Dashboard (`/`)

### Data Fetched on Load
```typescript
// 1. Preferences
supabase.from('preferences').select('*').eq('id', 'default').single()

// 2. Active Banks
supabase.from('banks')
  .select('id, name, account_type, current_balance')
  .eq('is_active', true)
  .order('sort_order')

// 3. Today's Income
supabase.from('income_records')
  .select('start_km, end_km, daily_earning, amount')
  .eq('date', today)
  .order('income_type')
```

### Derived Values (computed client-side)
```typescript
totalBalance    = banks.reduce((s, b) => s + b.current_balance, 0)
fuelL           = prefs.fuel_liters_current
tankCap         = prefs.fuel_tank_capacity_liters       // default 10.5
efficiency      = prefs.fuel_efficiency_km_per_liter    // default 30
fuelKmLeft      = fuelL * efficiency
kmLeftService   = prefs.distance_to_next_service_km
serviceIntervalKm = prefs.bike_service_interval_km      // default 3000
serviceUrgency  = kmLeftService < 100 ? 'CRITICAL' : kmLeftService < 300 ? 'SOON' : 'OK'

// Today's totals
todayKm         = max(end_km - start_km) across income records
todayEarnings   = sum(daily_earning) + sum(amount) for today

// Service date estimate
avgDailyKm      = todayKm > 0 ? todayKm : 50
daysLeftService = kmLeftService / avgDailyKm  // rounded
nextServiceDate = today + daysLeftService days
```

### Sections to Render

#### A. Header / Profile Card
- Greeting: "GOOD MORNING/AFTERNOON/EVENING"
- Rider name from `prefs.rider_name`
- Today's date
- Avatar with first letter of rider name (gradient purple→blue)
- Badges: "X.X km today" (green) and "Earned Rs. X" (blue) if > 0

#### B. Summary Charts Card
- **Inputs:** Tab switcher — `Daily` | `Weekly` | `Monthly`
- **Output:** Bar chart (Income vs Expenses) with green bars (income) and red bars (expenses)

**Data queries per tab:**

*Daily (last 7 days):*
```typescript
// For each of last 7 days:
income = SUM(income_records.daily_earning WHERE income_type='main' AND date=day)
       + SUM(income_records.amount WHERE income_type='side' AND date=day)
expense = SUM(daily_expenses.amount WHERE date=day)
```

*Weekly (last 4 weeks):*
```typescript
// Week N = days [today - N*7 - 6 .. today - N*7]
// Same SUM queries with date BETWEEN start AND end
```

*Monthly (last 6 months):*
```typescript
// Month N = first to last day of that calendar month
```

#### C. All Accounts Card
- Lists every bank account with icon, name, balance
- Total balance shown as header (green)
- Negative balance shown in red
- Account type determines icon:
  - `cash` → 💵 cash icon, green
  - `wallet` → 👝 wallet icon, purple
  - `savings` → 💾 save icon, blue
  - `liability` → 💳 card icon, red
  - default → 🏢 business icon, yellow

#### D. Smart Allocation Card
- Only shows data if `todayEarnings > 0`
- Splits today's income into 4 buckets:

| Allocation | % | Color |
|---|---|---|
| Savings | 20% | Green |
| Fuel Reserve | 15% | Orange |
| Service Reserve | 10% | Yellow |
| Daily Spend | 55% | Blue |

- Each row: icon + label + Rs. amount + % + progress bar filled to that %

#### E. Fuel Tank Card
- Visual animated progress bar (orange/yellow/red depending on level)
- Shows: `X.XL` / `~X km range` / `X km/L efficiency` / `Rs. X/L price`
- Warning banner if `fuelL < 2`: "Fuel critically low!"
- Tick marks: 0L, 25%, 50%, 75%, 100% of tank capacity

#### F. Service Reminder Card
- Progress bar showing km traveled vs service interval
- Color: green (> 40%), yellow (15–40%), red (< 15%)
- Stats: km remaining, urgency badge (OK / SOON / CRITICAL)
- Estimated next service date
- **Quick Service Pay form:**
  - Text input: service cost (pre-filled from preferences)
  - Bank selector (dropdown, excludes liability accounts)
  - "Log Bike Service" button → on confirm:
    1. Insert into `daily_expenses` (category: 'Bike Service')
    2. Deduct from selected bank balance
    3. Reset `preferences.distance_to_next_service_km` = `serviceIntervalKm`

---

## 7. Page 2 — Income (`/income`)

### Layout
- **Header:** date navigator (← prev day | date display | next day →)
- **Mini calendar** (monthly view, click day to select)
- **Two sub-tabs:** `Main Income` | `Side Hustle`

### Date Navigation
```typescript
selectedDate: string  // 'YYYY-MM-DD'
// Left arrow: selectedDate - 1 day
// Right arrow: selectedDate + 1 day (max: today)
// Calendar: click any past/today day
```

### Data Fetched
```typescript
// All income records in current displayed month
supabase.from('income_records')
  .select('*')
  .gte('date', firstDayOfMonth)
  .lte('date', lastDayOfMonth)
  .order('created_at', { ascending: false })
```

Calendar marks (dot indicator) on days that have records.

---

### Sub-Tab A: Main Income

**Input Fields:**
| Field | Type | DB Column | Notes |
|---|---|---|---|
| Ride App | Toggle button: `Uber` / `PickMe` | `app` | |
| Start KM | Number | `start_km` | Auto-filled from yesterday's `end_km` |
| End KM | Number | `end_km` | |
| Daily Earning (Rs.) | Number | `daily_earning` | Total shown in app |
| Cash On Hand (Rs.) | Number | `cash_on_hand` | Physical cash + tips |
| Wallet Balance (Rs.) | Number | `wallet_balance` | Uber or PickMe wallet |
| Fuel Expense (Rs.) | Number | `fuel_expense` | Quick chips: Rs.500 / Rs.1,000 / Rs.1,500 / Custom |
| Fuel Account | Bank selector | `bank_id` (for expense) | Deducts from chosen bank |

**Calculations shown in Daily Report:**
```typescript
totalDistance    = (parseFloat(endKm) || 0) - (parseFloat(startKm) || 0)
expectedEarning  = parseFloat(dailyEarning) || 0
todayWalletChange = wallet - previousWallet   // previousWallet from yesterday's record
actualAccounted  = cashOnHand + todayWalletChange
balanceDiff      = actualAccounted - expectedEarning  // Cash Tip (+) or Short (-)
fuel             = parseFloat(fuelExpense) || 0
netEarnings      = actualAccounted - fuel
earningPerKm     = totalDistance > 0 ? actualAccounted / totalDistance : 0

// From preferences:
prefFuelPerKm    = petrolPrice / Math.max(fuelEfficiency, 1)
autoFuelCost     = totalDistance > 0 ? totalDistance * prefFuelPerKm : 0
effectiveFuelCost = fuel > 0 ? fuel : autoFuelCost    // manual overrides auto
serviceCostPerDay = bike_service_cost_monthly / 30
otherCostPerDay  = other_monthly_expenses / 30
totalDailyExpenses = effectiveFuelCost + serviceCostPerDay + otherCostPerDay
trueNetIncome    = actualAccounted - totalDailyExpenses
goalProgress     = (actualAccounted / daily_income_target) * 100  // capped 100
```

**Daily Report displayed rows:**
- Distance Traveled
- App Total Earning
- Previous Wallet (yesterday's wallet_balance)
- ──────── divider
- Cash Tip / Short: colored badge (green = surplus, red = deficit)
- ──────── divider
- EXPENSES FROM PREFERENCES section:
  - Fuel (auto or manual entry)
  - Bike Service (monthly ÷ 30)
  - Other Expenses (monthly ÷ 30)
- ──────── divider
- **True Net Income** (bold, green or red)
- Daily Target Progress bar (% of `daily_income_target`)
- ──────── divider
- Earning per KM
- Fuel Cost per KM (prefs)
- Fuel Efficiency note

**Save logic:**
```typescript
// 1. Upsert income_records row
if (existing record for date + 'main') → UPDATE
else → INSERT

// 2. If fuel > 0:
//    a. Check if daily_expenses row exists for this date + category='fuel' + bank_id
//    b. If yes: UPDATE amount, compute delta → adjust bank balance by delta
//    c. If no: INSERT new expense → deduct from bank balance

// 3. Update preferences.fuel_liters_current:
litersAdded = fuelExpense / petrolPrice
newLiters = min(currentLiters + litersAdded, tankCapacity)
UPDATE preferences SET fuel_liters_current = newLiters,
                       current_fuel_range_km = newLiters * fuelEfficiency
```

**Delete logic:** DELETE record by `id`. Fuel expense and bank balance must be reversed if fuel was entered.

---

### Sub-Tab B: Side Hustle

**Input Fields:**
| Field | Type | DB Column |
|---|---|---|
| Category | Chip selector (from `side_hustle_categories`) | `side_category` |
| Client Name | Text autocomplete (past clients from DB) | `client` |
| Note | Textarea | `note` |
| Amount (Rs.) | Number | `amount` |
| Credit to Account | Bank selector | `bank_id` |

**Save logic:**
```typescript
// INSERT new income_records row (income_type='side')
// If bank selected: ADD amount to bank's current_balance (it's income, so +)
// If editing: reverse old bank credit, apply new credit
```

**Listed records** for the selected date (can have multiple side hustle entries per day). Each shows: category chip, client, note, amount, Edit / Delete buttons.

**Category Management:**
- Button: "Manage Categories" → modal with list
- Add new category: text input + Save
- Delete category button on each row
- CRUD on `side_hustle_categories` table

---

## 8. Page 3 — Expenses (`/expenses`)

### Four Sub-Tabs
`Log` | `Analytics` | `Budgets` | `Recurring`

---

### Sub-Tab: Log

**Date selector:** Calendar icon → inline calendar picker (past dates only). Shows "Today" or "Yesterday" or formatted date.

**Bank selector (horizontal scrollable pills):**
- Shows all active banks (excluding liabilities)
- Each pill: dot color, bank name, balance
- Required field — no save without selecting bank

**Category horizontal scroll chips:**
- Default: Fuel, Food, Maintenance, Parking, Tolls, Other
- Plus custom categories from `expense_categories` table
- Each chip has icon + label, highlights on select

**Quick amount chips:** Rs.100 / Rs.200 / Rs.500 / Rs.1,000 / Rs.1,500

**Fields:**
| Field | Type | DB Column |
|---|---|---|
| Date | Calendar picker | `date` |
| Pay From Account | Bank pills | `bank_id` |
| Category | Category chips | `category` |
| Amount (Rs.) | Number | `amount` |
| Note (optional) | Text | `note` |

**Save / balance deduction logic:**
```typescript
isFutureDate = selectedDate > today

// New expense:
INSERT daily_expenses row
if (!isFutureDate) {
  bank.current_balance -= amount
  UPDATE banks SET current_balance = newBalance
}

// Edit expense:
// 1. Reverse old bank deduction (if old date was not future)
// 2. UPDATE daily_expenses row
// 3. Apply new deduction (if new date is not future)

// Delete expense:
// 1. If date was not future: bank.current_balance += amount
// 2. DELETE daily_expenses row

// Special: if category = 'fuel':
// Update preferences.fuel_liters_current automatically:
netRupees = (editing) ? (newAmt - oldAmt) : newAmt
litersAdded = netRupees / petrolPrice
newLiters = clamp(currentLiters + litersAdded, 0, tankCapacity)
UPDATE preferences SET fuel_liters_current = newLiters,
                       current_fuel_range_km = newLiters * efficiency
```

**Listed entries** for selected date with Edit/Delete buttons.

**Future date warning banner** shown when date > today: "Balance will NOT be deducted immediately."

---

### Sub-Tab: Analytics

**Data fetched:** All `daily_expenses` for current calendar month.

**Donut / Pie Chart:**
- Each slice = one category
- Center: Total Rs. spent this month + "This Month" label
- Legend: category color dot + name + %

**Highest Expense Category card** (trophy icon, colored by that category)

**Monthly Trends Bar Chart (last 6 months):**
- X-axis: month abbreviation (Jan, Feb, etc.)
- Y-axis: total spending in Rs.
- Data query: for each of last 6 months, SUM(`daily_expenses.amount`) for that month

**Summary Row (3 stats):**
- Total Spent | Daily Average (total / day of month) | Entry Count

---

### Sub-Tab: Budgets

**Data fetched:**
```typescript
supabase.from('expense_budgets').select('*')
supabase.from('daily_expenses')
  .select('category, amount')
  .gte('date', firstOfMonth)
  .lte('date', lastOfMonth)
```

**Per category row:**
- Icon + label
- Budget progress bar:
  - Green: spent < 80% of limit
  - Orange: spent ≥ 80%
  - Red: spent ≥ 100% (exceeds budget)
- Number input to set/edit the monthly limit

**Save:** Upsert `expense_budgets` row for each changed category (update if exists, insert if new).

---

### Sub-Tab: Recurring

**Form fields:**
| Field | Input Type | DB Column |
|---|---|---|
| Name | Text | `name` |
| Category | Category chip selector | `category` |
| Amount (Rs.) | Number | `amount` |
| Frequency | Tabs: Daily / Weekly / Monthly / Yearly | `frequency` |
| Next Date | Date input | `next_date` |
| Note | Text | `note` |
| Icon | Icon palette (20 options) | stored in category |
| Color | Color palette (12 options) | stored in category |

**Listed recurring entries:**
- Card per entry: name, frequency badge, next date, amount, active toggle, Edit / Delete
- "Post Now" button → inserts expense into `daily_expenses` immediately and advances `next_date`:
  ```typescript
  next_date = calculateNextDate(current_next_date, frequency)
  // daily: +1 day, weekly: +7 days, monthly: +1 month, yearly: +1 year
  ```

---

## 9. Page 4 — Banking (`/banking`)

### Three Sub-Tabs
`Accounts` | `Transfers` | `Settings`

---

### Sub-Tab: Accounts

**Header bar:**
- Total Assets (sum of non-liability accounts)
- Net Worth (assets − liabilities)
- Total Liabilities (sum of liability accounts)

**Bank account cards** (one per active bank):
- Gradient background (account type color)
- Account type badge
- Balance (red if negative)
- System badge for non-deletable accounts
- Click → opens Account Statement view

**Account Statement View (replaces main view on card click):**
- Back button to return
- Shows bank name, current balance, starting balance
- All transactions affecting this account:
  - Income credits (from `income_records` for wallet/cash banks)
  - Expense debits (from `daily_expenses` WHERE `bank_id = this_bank`)
  - Liability payments (from `liability_payments` WHERE `bank_id = this_bank`)
  - Transfers (from `bank_transfers` WHERE `from_bank_id` or `to_bank_id`)
- Each row: date, description/note, type badge, amount (+ green or − red)
- Filter by date range (this month / last month / custom)

**Add Account button** (top-right or floating):
- Opens AddBankModal with fields: Name, Account Type, Starting Balance, Logo URL (Cloudinary)
- Saves to `banks` table, sets `current_balance = starting_balance`

---

### Uber Wallet & Cash on Hand — Auto-Sync Logic

Every time the Banking page loads or refreshes:
```typescript
// Fetch today's main income record
const { data: todayIncome } = await supabase
  .from('income_records')
  .select('cash_on_hand, wallet_balance')
  .eq('income_type', 'main')
  .eq('date', today)
  .single()

const uberBank = banks.find(b => b.name === 'Uber Wallet')
const cashBank = banks.find(b => b.name === 'Cash on Hand')

// Sync Uber Wallet
if (uberBank && todayIncome?.wallet_balance != null) {
  const newBal = parseFloat(todayIncome.wallet_balance)
  const diff = newBal - uberBank.current_balance
  if (Math.abs(diff) > 0.01) {
    // Idempotency: check for existing sync transfer today
    // If none: INSERT bank_transfers row (audit trail), then UPDATE banks balance
  }
}

// Sync Cash on Hand
if (cashBank && todayIncome?.cash_on_hand != null) {
  const newCashBal = cashBank.starting_balance + todayIncome.cash_on_hand
  // Same sync logic
}

// If no income today and balance is 0 but starting_balance > 0:
// Reset to starting_balance (avoid showing Rs. 0.00 incorrectly)
```

---

### Sub-Tab: Transfers

**Transfer Modal fields:**
| Field | Input | Notes |
|---|---|---|
| From Account | Horizontal scrollable pills | Active banks only |
| To Account | Horizontal scrollable pills | Excluding From selection |
| Amount (Rs.) | Number | |
| Service Charge (Rs.) | Number | e.g. bank transfer fee |
| Note | Text | optional |

**Transfer logic:**
```typescript
// Validation:
fromBank !== toBank
amount > 0
fromBank.current_balance >= amount + serviceCharge

// Execute:
INSERT bank_transfers(from, to, amount, service_charge, note, transfer_date=today)
UPDATE banks SET current_balance = fromBalance - (amount + serviceCharge) WHERE id=from
UPDATE banks SET current_balance = toBalance + amount WHERE id=to
```

**Transfer history list:**
- One row per transfer (last 50)
- Shows: from → to, date, note, fee, amount

---

### Sub-Tab: Settings (Bank Management)

- List of all active banks with Edit and Remove (soft delete) buttons
- **Edit Bank Modal** fields:
  - Account Name
  - Account Type (chip selector)
  - Starting Balance — Note: for `Uber Wallet` and `Cash on Hand` (system accounts), editing starting_balance does NOT override `current_balance` (because those are synced from income)
  - Logo URL (Cloudinary)
- **Remove**: sets `is_active = false` (soft delete, keeps transaction history)
- System accounts cannot be deleted

---

## 10. Page 5 — Liabilities (`/liabilities`)

### Three Sub-Tabs
`Active Liabilities` | `Payment History` | `Net Worth Summary`

---

### Sub-Tab: Active Liabilities

**Liability Card** per record shows:
- Type badge (color + icon)
- Priority badge (High / Medium / Low)
- Name + Interest method
- **Remaining amount** (large, colored by type)
- Progress bar: % paid
- Grid of stats: Principal, Interest Rate, Monthly Payment
- Conditional: Overdue (Arrears), 25+ Day Penalty, Advance Payment, Next Payment day, End Date
- Note if present
- Buttons: **Pay**, **Edit**, **Delete**

**Add Liability — 4-Step Modal Form:**

**Step 1: Type**
- Name field (text)
- Type picker (5 options: Ring/Pawning, Bike/Finance, Loan, Mobile Phone, Other)

**Step 2: Details**
- Interest Method picker (4 options with description)
- Principal Amount (Rs.)
- Interest Rate (% per month)
- Monthly Payment (Rs.) — auto-calculated for flat rate
- Arrears Amount (Rs.) — starting overdue

**Step 3: Terms**
- Payment Day of Month (1-31)
- Start Date (YYYY-MM-DD)
- End Date (YYYY-MM-DD)
- Shows duration in months
- Note/Remark

**Step 4: Priority**
- Priority Level (High / Medium / Low)
- Budget Allocation % (e.g. "20% of income goes here")

---

### Liability Status Calculations

These are the core business logic computations — must be replicated exactly.

```typescript
function computeLiabilityStatus(item, payments) {
  const validPayments = payments
    .filter(p => !p.is_future && p.liability_id === item.id)
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))
  const totalPaid = validPayments.reduce((s, p) => s + p.amount, 0)

  const isRing = item.liability_type === 'pawning'
  const isBike = item.liability_type === 'finance'

  if (item.interest_method === 'interest_only' || isRing) {
    // === Amortization / Declining Base ===
    // Performs ledger simulation through each payment:
    let currentPrincipal = item.principal_amount
    const ratePerMonth = item.interest_rate / 100
    let totalInterestAccrued = item.arrears_amount || 0
    let totalInterestPaid = 0
    let lastDate = new Date(item.start_date)

    for (const payment of validPayments) {
      const pDate = new Date(payment.payment_date)
      const monthsPassed = (pDate - lastDate) / (1000*60*60*24*30.44)
      totalInterestAccrued += currentPrincipal * ratePerMonth * monthsPassed
      lastDate = pDate
      const unpaidInterest = totalInterestAccrued - totalInterestPaid
      const interestPayment = Math.min(payment.amount, unpaidInterest > 0 ? unpaidInterest : 0)
      totalInterestPaid += interestPayment
      const principalPayment = payment.amount - interestPayment
      if (principalPayment > 0) currentPrincipal -= principalPayment
    }
    // Accrue interest up to today
    const monthsToNow = (new Date() - lastDate) / (1000*60*60*24*30.44)
    totalInterestAccrued += currentPrincipal * ratePerMonth * monthsToNow

    return {
      remaining: max(0, currentPrincipal) + max(0, totalInterestAccrued - totalInterestPaid),
      arrears: max(0, totalInterestAccrued - totalInterestPaid),      // unpaid interest
      advance: max(0, item.principal_amount - currentPrincipal),      // principal paid down
      currentPrincipal: max(0, currentPrincipal),
      displayMonthly: max(0, currentPrincipal * ratePerMonth),
      progressPct: ((item.principal_amount - currentPrincipal) / item.principal_amount) * 100,
      // ...
    }
  } else {
    // === Flat / Reducing Balance ===
    const monthsTotal = calcMonthsRemaining(item.start_date, item.end_date)
    const totalInterest = calcTotalInterest(item.principal_amount, item.interest_rate, item.interest_method, monthsTotal)
    const totalLiability = item.principal_amount + totalInterest + (item.arrears_amount || 0)

    // Calculate how many months of payments should have been made by now
    const start = new Date(item.start_date)
    const payDay = item.payment_day || start.getDate()
    const now = new Date()
    let monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    if (now.getDate() < payDay) monthsPassed -= 1  // haven't hit this month's payment day yet
    monthsPassed = clamp(monthsPassed, 0, monthsTotal)

    const totalExpectedByNow = (item.arrears_amount || 0) + (monthsPassed * item.monthly_payment)
    const arrears = max(0, totalExpectedByNow - totalPaid)
    const advance = totalPaid > totalExpectedByNow ? totalPaid - totalExpectedByNow : 0

    // Bike Finance 25+ day penalty:
    let penalty = 0
    if (isBike && arrears > 0) {
      const paidInstallments = max(0, totalPaid - (item.arrears_amount || 0))
      const unpaidMonthIdx = Math.floor(paidInstallments / (item.monthly_payment || 1))
      const oldestDue = new Date(start.getFullYear(), start.getMonth() + unpaidMonthIdx, payDay)
      const daysOver = (now - oldestDue) / (1000*60*60*24)
      if (daysOver > 25) penalty = (arrears + item.monthly_payment) * 0.05
    }

    return {
      remaining: max(0, totalLiability + penalty - totalPaid),
      arrears, advance, penalty,
      displayMonthly: item.monthly_payment,
      progressPct: (totalLiability + penalty) > 0 ? (totalPaid / (totalLiability + penalty)) * 100 : 0,
      totalPaid, totalLiability,
      currentPrincipal: item.principal_amount,
      daysUntilPayment: /* days from today to next payment_day */,
    }
  }
}

function calcTotalInterest(principal, rate, method, months) {
  if (method === 'none' || method === 'interest_only' || rate === 0) return 0
  if (method === 'flat') return (principal * rate / 100) * months
  // Reducing balance EMI:
  const r = rate / 100 / 12
  const totalPaid = principal * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1) * months
  return totalPaid - principal
}
```

---

### Payment Modal

**Fields:**
| Field | Input | Notes |
|---|---|---|
| Amount (Rs.) | Number | Pre-filled: monthly_payment (or current monthly interest for `interest_only`) |
| Date | Date picker | Default: today |
| Note | Text | |
| Pay From | Bank pills | Required |
| Is Future | Auto-detect from date | |

**Payment save logic:**
```typescript
// Check balance (if date not future)
if (!isFuture && bank.current_balance < amount) → error

// Insert liability_payments row
// If not future: deduct amount from bank.current_balance

// Edit payment:
// 1. Reverse old bank deduction (if old payment wasn't future)
// 2. UPDATE liability_payments
// 3. Apply new deduction (if new date not future)
```

**Payment history list** per liability: date, amount, bank, note, future badge, Edit/Delete.

---

### Sub-Tab: Payment History

All `liability_payments` across all liabilities, sorted by date descending. Filterable by liability.

---

### Sub-Tab: Net Worth Summary

- Total Assets (sum of non-liability bank balances) 
- Total Liabilities (sum of `remaining` across all liabilities)
- Net Worth = Assets − Liabilities
- Color: green if positive, red if negative
- List of liabilities with priority bars (% of income allocated)

---

## 11. Page 6 — Preferences (`/preferences`)

### Data Fetched
```typescript
supabase.from('preferences').select('*').eq('id', 'default').single()
```

### Input Fields (all numeric unless noted)

#### Rider Profile Section
| Field | DB Column | Default |
|---|---|---|
| Your Name | `rider_name` | `'Rider'` |

#### Petrol Cost Section
| Field | DB Column | Default | Suffix |
|---|---|---|---|
| Petrol Price per Liter | `petrol_price_per_liter` | 370 | Rs./L |
| Bike Fuel Efficiency | `fuel_efficiency_km_per_liter` | 30 | km/L |
| Tank Capacity | `fuel_tank_capacity_liters` | 10.5 | L |
| Current Fuel Level | `fuel_liters_current` | 0 | L |

Live calculation preview box:
```
Rs. X.XX/km  ·  X.XL → ~X km range
```

#### Bike Service Cost Section
| Field | DB Column | Default | Suffix |
|---|---|---|---|
| Monthly Service Cost | `bike_service_cost_monthly` | 3000 | Rs./mo |
| Service Interval | `bike_service_interval_km` | 3000 | km |
| Distance to Next Service | `distance_to_next_service_km` | 0 | km |

Live preview:
```
Service: Rs. X.X/day  ·  Next: ~X km away
```

#### Income Targets Section
| Field | DB Column | Default |
|---|---|---|
| Daily Income Target | `daily_income_target` | 5000 |
| Monthly Income Target | `monthly_income_target` | 100000 |

#### Estimated Daily Cost Summary Card (read-only, live preview)
```typescript
fuelCostPerKm   = petrolPrice / fuelEfficiency
serviceCostPDay = serviceMonthly / 30
totalDailyCost  = (100 * fuelCostPerKm) + serviceCostPDay  // assumes 100 km/day

// Display:
"Fuel (100 km): Rs. X"
"Service /day: Rs. X"
"────────────────────"
"Total Expenses/day: Rs. X"
"Net at Daily Target: Rs. X"  ← green if positive, red if negative
```

### Save Logic
```typescript
// Derive current_fuel_range_km automatically:
current_fuel_range_km = fuel_liters_current * fuel_efficiency_km_per_liter

UPDATE preferences SET
  petrol_price_per_liter      = X,
  fuel_efficiency_km_per_liter = X,
  current_fuel_range_km       = X,  // derived
  bike_service_cost_monthly   = X,
  bike_service_interval_km    = X,
  distance_to_next_service_km = X,
  daily_income_target         = X,
  monthly_income_target       = X,
  fuel_tank_capacity_liters   = X,
  fuel_liters_current         = X,
  last_service_odometer_km    = X,
  rider_name                  = X,
  updated_at                  = now()
WHERE id = 'default'
```

"Saved!" badge appears for 2.5 seconds after successful save.

---

## 12. Shared Components

### `GlassCard`
```tsx
// Dark frosted glass card with optional accent color border
<GlassCard accentColor="#6C63FF">
  {children}
</GlassCard>
// border: accentColor + '50', background: accentColor + '0D'
```

### `Field`
```tsx
// Labeled input field
<Field label="Start KM" value={val} onChange={setVal} type="number" />
// Dark background, subtle border, white text
```

### `ReportRow`
```tsx
// Two-column label + value row
<ReportRow label="Distance" value="45.2 km" color="#1DB98A" bold />
```

### `BankPicker`
```tsx
// Horizontal scrollable bank pills (click to select)
<BankPicker
  banks={banks}
  selectedId={bankId}
  onSelect={setBankId}
  accentColor="#E8854A"
/>
// Each pill: color dot, bank name, Rs. balance
```

### `MiniCalendar`
```tsx
// Monthly calendar view (compact)
// Props: selectedDate, onSelect, markedDates: Set<string>, allowFuture
// Marked dates show a small dot below the day number
// Today has a colored border ring
// Future dates are disabled (unless allowFuture=true)
```

### `FuelGauge`
```tsx
// Animated horizontal progress bar for fuel level
// Color: green (>50%), yellow (>25%), red (<25%)
// Tick labels: 0L, 2.6L, 5.3L, 7.9L, 10.5L
```

### `DonutChart` (Recharts)
```tsx
// SVG donut chart for expense category breakdown
// Center text: total Rs. + "This Month"
// Legend: color dot + category name + %
```

### `BarChart` (Recharts)
```tsx
// Side-by-side bars per time period
// Green bars = income, Red bars = expenses
// X-axis: period labels, Y-axis: Rs. amounts
```

---

## 13. Business Logic & Calculations

### Currency Format
```typescript
const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
```

### Date Utilities
```typescript
const toISO = (d: Date) => d.toISOString().split('T')[0]  // 'YYYY-MM-DD'
const today = () => toISO(new Date())

// Previous day's end_km auto-fill:
const { data } = await supabase
  .from('income_records')
  .select('end_km, wallet_balance')
  .eq('income_type', 'main')
  .lt('date', selectedDate)
  .order('date', { ascending: false })
  .limit(1)
  .single()
previousEndKm = data?.end_km
previousWallet = data?.wallet_balance
```

### Fuel Tank Update (triggered by any fuel expense save/delete)
```typescript
// On save with category='fuel':
const prefsRow = await getPreferences()
const litersAdded = expenseAmount / prefsRow.petrol_price_per_liter
const newLiters = Math.min(
  Math.max(0, prefsRow.fuel_liters_current + litersAdded),
  prefsRow.fuel_tank_capacity_liters
)
await supabase.from('preferences').update({
  fuel_liters_current: Math.round(newLiters * 100) / 100,
  current_fuel_range_km: Math.round(newLiters * prefs.fuel_efficiency_km_per_liter),
}).eq('id', 'default')

// On delete of fuel expense: subtract liters instead of add
```

### Smart Allocation Rules
```typescript
const ALLOCATION_RULES = [
  { label: 'Savings',          pct: 0.20, color: '#1DB98A' },
  { label: 'Fuel Reserve',     pct: 0.15, color: '#E8854A' },
  { label: 'Service Reserve',  pct: 0.10, color: '#D4A843' },
  { label: 'Daily Spend',      pct: 0.55, color: '#4A9FD4' },
]
// Each amount = todayEarnings * pct
```

### Bank Balance Rules Summary
| Action | Effect on Bank |
|---|---|
| Add expense (past/today date) | `current_balance -= amount` |
| Add expense (future date) | No balance change |
| Delete expense (past/today) | `current_balance += amount` (restore) |
| Edit expense | Reverse old, apply new |
| Add liability payment (past/today) | `current_balance -= amount` |
| Add liability payment (future) | No balance change |
| Transfer out | `current_balance -= (amount + serviceCharge)` |
| Transfer in | `current_balance += amount` |
| Income sync — Uber Wallet | Set to `income_records.wallet_balance` |
| Income sync — Cash on Hand | Set to `starting_balance + income_records.cash_on_hand` |
| Side hustle credit | `current_balance += amount` |

---

## 14. Supabase Realtime

Subscribe to changes on these tables to auto-refresh the relevant page without manual reload:

```typescript
// Dashboard page:
supabase.channel('dashboard-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, fetchBanks)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'preferences' }, fetchPrefs)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' }, () => { fetchData(); fetchChart() })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'income_records' }, () => { fetchData(); fetchChart() })
  .subscribe()

// Banking page:
supabase.channel('banking-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, fetchBanks)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transfers' }, fetchTransfers)
  .subscribe()

// Always: unsubscribe on component unmount
return () => supabase.removeChannel(channel)
```

---

## 15. Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://pqvcgarxlgpjhtfmzioo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,   // No auth needed — single user app
  },
})
```

> ⚠️ **Note:** The Supabase project is `pqvcgarxlgpjhtfmzioo`. All tables already exist. Do NOT run migrations again — just connect and query.

---

## 16. Migration SQL Scripts

> All tables already exist. These scripts are reference only if recreating from scratch.

### Run Order:
1. `20260226_create_income_records.sql` — `income_records`, `side_hustle_categories`
2. `20260227_create_bank_management.sql` — `banks`, `bank_transfers` (seeds 5 system accounts)
3. `20260227_add_bank_id_to_payments_expenses.sql` — Adds `bank_id` to `daily_expenses` and `liability_payments`
4. `20260227_preferences_fuel_service_range.sql` — Adds `fuel_tank_capacity_liters`, `fuel_liters_current`, `rider_name` columns to `preferences`
5. `supabase/liabilities_migration.sql` — `liabilities`, `liability_payments`, `expense_budgets`, `expense_categories`, `recurring_expenses`

### RLS (Row Level Security)
All tables have `POLICY "allow_all" FOR ALL USING (true) WITH CHECK (true)` — open access, no auth required.

---

## 17. Folder Structure

```
ridermate-web/
├── app/
│   ├── layout.tsx              ← Root layout with nav bar + dark theme
│   ├── page.tsx                ← Dashboard
│   ├── income/
│   │   └── page.tsx            ← Income page
│   ├── expenses/
│   │   └── page.tsx            ← Expenses page
│   ├── banking/
│   │   └── page.tsx            ← Banking page
│   ├── liabilities/
│   │   └── page.tsx            ← Liabilities page
│   └── preferences/
│       └── page.tsx            ← Preferences page
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx          ← Bottom (mobile) / Side (desktop) nav
│   │   └── PageHeader.tsx      ← Consistent page title + subtitle
│   ├── ui/
│   │   ├── GlassCard.tsx
│   │   ├── Field.tsx
│   │   ├── ReportRow.tsx
│   │   ├── BankPicker.tsx
│   │   ├── MiniCalendar.tsx
│   │   ├── FuelGauge.tsx
│   │   ├── ServiceBar.tsx
│   │   ├── DonutChart.tsx
│   │   └── BarChart.tsx
│   ├── dashboard/
│   │   ├── SmartAllocation.tsx
│   │   ├── SummaryCharts.tsx
│   │   └── ServicePayCard.tsx
│   ├── income/
│   │   ├── MainIncomeTab.tsx
│   │   └── SideHustleTab.tsx
│   ├── expenses/
│   │   ├── LogTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   ├── BudgetsTab.tsx
│   │   └── RecurringTab.tsx
│   ├── banking/
│   │   ├── BankCard.tsx
│   │   ├── TransferModal.tsx
│   │   ├── AddBankModal.tsx
│   │   ├── EditBankModal.tsx
│   │   └── AccountStatement.tsx
│   └── liabilities/
│       ├── LiabilityCard.tsx
│       ├── LiabilityModal.tsx
│       └── PaymentModal.tsx
│
├── lib/
│   ├── supabase.ts             ← Supabase client
│   ├── theme.ts                ← Color constants
│   ├── calculations.ts         ← All business logic (liability, fuel, smart allocation)
│   ├── database.types.ts       ← TypeScript types (copy from mobile app)
│   └── utils.ts                ← Date helpers, fmt() etc.
│
├── .env.local                  ← Supabase credentials
└── package.json
```

---

## Key Differences: Mobile (Expo) vs Web (Next.js)

| Mobile Feature | Web Equivalent |
|---|---|
| `Alert.alert()` | `window.confirm()` / toast notifications |
| `BlurView` | CSS `backdrop-filter: blur()` |
| `LinearGradient` | CSS `linear-gradient()` |
| `Modal` + bottom sheet | `<dialog>` element or modal overlay div |
| `ScrollView` horizontal | overflow-x: auto + flex row |
| `TouchableOpacity` | `<button>` with hover styles |
| `Animated.Value` | CSS transitions / Framer Motion |
| `Ionicons` | Lucide React icons |
| `expo-notifications` | Web Push API (or omit — not critical) |
| `Platform.OS === 'web'` | All code runs in browser — remove checks |
| Drum-scroll picker | `<select>` dropdown or custom listbox |
| `RefreshControl` | Pull-to-refresh library or refresh button |
| Native keyboard types | `<input type="number">` |

---

*Last updated: 2026-02-28 | Ridermate Mobile App → Next.js Web Specification*
