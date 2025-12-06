# Menu Screen & Enhanced Flow Summary

## **Menu Screen (Tab)**

**Purpose:** Daily menu configuration by manager

**Structure:**
- **3 Sections with 2 options each:**
  - **STARTER:** Option A | Option B
  - **MAIN MEAL:** Option A | Option B  
  - **DESSERT:** Option A | Option B
- **DRINKS Section:** Multiple items (add/remove/edit)

**Manager Actions:**
- Morning setup: Select TODAY's 2 starters, 2 mains, 2 desserts
- Toggle availability (sold out)
- Edit prices
- Add/remove drinks

**UI:** Simple form with dropdowns/cards to pick from master menu library

---

## **Enhanced Table & Guest Flow**

### **1. Morning Setup (Manager)**
- **Create tables:** "Table 1 (4 seats)", "Table 5 (6 seats)"
- **Set today's menu:** Pick 2 options per category

### **2. Guest Arrives**
**Seating Process:**
```
Staff taps "Table 5" → Shows seat layout:
┌─────────────────────┐
│   Seat at Table 5   │
│   (6 seats total)   │
│                     │
│ Select seats:       │
│ [✓] Seat 1 - John   │
│ [✓] Seat 2 - Sarah  │
│ [ ] Seat 3 - Empty  │
│ [ ] Seat 4 - Empty  │
│                     │
│ Waiter: [Alex ▼]    │
│ [Confirm Seating]   │
└─────────────────────┘
```
**Result:** Table status: `available` → `occupied`, Guest records created

### **3. Taking Orders (Per Guest)**
```
Order Screen shows:
┌─────────────────────────┐
│ Table 5 - Guests (2/6)  │
├─────────────────────────┤
│ Seat 1: John ⏱️ Pending  │  ← Tap to order
│ Seat 2: Sarah ✓ Ordered │
│                         │
└─────────────────────────┘

Tap "John" → Select meals:
- Starter: Russian Salad
- Main: Chicken Curry Combo
- Dessert: Mousse
- Drink: Soda ×2

Confirm → John's status: Pending → Ordered
Kitchen screen updates in real-time
```

### **4. Order Status Flow (Per Guest)**
```
Pending → Ordered → Served → Cleared → Pending Payment → Paid
  ⏱️       ✓         🍽️        ✓          💳              ✅
```

**Waiter actions:**
- Meal brought → Update to `Served`
- Guest finished → Update to `Cleared`  
- Guest ready to pay → Update to `Pending Payment`
- Payment done → `Paid`

**When ALL guests paid:** Table status: `occupied` → `available`

### **5. Analytics Screen**
**Shows:**
- **Active Tables:** Live status of all tables
- **Guest List:** All guests today with:
  - Name
  - Table/Seat
  - Waiter assigned
  - Meals ordered
  - Status
  - Total amount
  - Payment status

---

## **Updated Database Schema**

```sql
-- Tables with seat capacity
tables (
  id, name, seat_count, status
)

-- Individual guests (not orders)
guests (
  id, 
  table_id, 
  seat_number,
  guest_name,
  waiter_id,
  status: pending | ordered | served | cleared | pending_payment | paid,
  created_at
)

-- Guest orders (many items per guest)
guest_orders (
  id,
  guest_id,
  menu_item_id,
  menu_item_name,
  price_snapshot,
  quantity
)

-- Daily menu (manager sets at start of day)
daily_menu (
  id,
  date,
  category: starter | main_meal | dessert,
  option_label: "Option A" | "Option B",
  menu_item_id
)

-- Payments (per guest)
payments (
  id,
  guest_id,
  phone_number,
  amount,
  status
)
```

---

## **Key Screens**

1. **Tables Tab:** Grid of tables with seat occupancy (2/6 seats)
2. **Menu Tab:** Manager sets daily menu (2 starters, 2 mains, 2 desserts, drinks)
3. **Guests Tab:** List of ALL guests today (name, waiter, meals, status, total)
4. **Kitchen Screen:** Real-time orders as they come in (grouped by table)

---

**This approach:**
- Tracks individual guests (not just tables)
- Links each guest to waiter
- Shows meal progression per guest
- Enables per-guest payment
- Provides detailed analytics

**Much better for:** Multi-guest tables, split payments, waiter accountability, kitchen workflow

Ready to implement this enhanced structure?