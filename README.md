# Sales and Inventory Management System with Automated Stock Deduction for Papa Es

> **IMPORTANT NOTES ON THE INGREDIENTS:**  
> The ingredient lists and measurements in this project are basic estimates from the internet used to demonstrate automated stock deduction. The diner's actual culinary recipes are confidential commercial secrets.

A complete Node.js + Express.js + EJS + Tailwind + MySQL capstone web application for Papa Es.

## Tech Stack
- **Backend:** Node.js (v18+), Express.js
- **Templating:** EJS
- **Frontend:** Tailwind CSS, vanilla JavaScript, Chart.js
- **Database:** MySQL via `mysql2` prepared statements
- **Security & Session:** bcryptjs, express-session, role-based access control (RBAC), Manager PIN authorization
- **Printing Engine:** Browser-native print API (`window.print()`) with dynamic CSS `@page` media queries (58mm / 80mm thermal receipt & kitchen slip formatting)

## Development Methodology – Prototyping Model
This project used the **Prototyping Model** so the system could be built, tested, and improved step-by-step. Instead of planning everything on paper all at once, an early working version of the POS screen, menu, and receipt layout was created right away. Testing this prototype made it easy to spot issues early and make improvements based on practical use.

## Project Structure
```
papa-es-pos/
├── config/
│   ├── db.js
│   ├── imageFile.js
│   ├── imageRelink.js
│   └── schemaSync.js
├── controllers/
│   ├── auditController.js
│   ├── authController.js
│   ├── inventoryController.js
│   ├── menuController.js
│   ├── receiptController.js
│   ├── reportController.js
│   ├── salesController.js
│   ├── userController.js
│   └── voidController.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   ├── auditModel.js
│   ├── inventoryModel.js
│   ├── menuModel.js
│   ├── salesModel.js
│   ├── userModel.js
│   └── voidModel.js
├── public/
│   ├── css/
│   │   └── style.css
│   ├── img/
│   │   └── qr/
│   │       ├── gcash.png
│   │       └── maya.png
│   │   └── PapaEs_Logo.png
│   ├── js/
│   │   ├── pos.js
│   │   ├── price.js
│   │   ├── quick-jump.js
│   │   └── smart-search.js
│   └── uploads/
│       └── menu/
├── routes/
│   ├── appRoutes.js
│   └── authRoutes.js
├── views/
│   ├── partials/
│   │   └── header.ejs
│   ├── about.ejs
│   ├── audit.ejs
│   ├── dashboard.ejs
│   ├── error.ejs
│   ├── inventory.ejs
│   ├── login.ejs
│   ├── menu.ejs
│   ├── pos.ejs
│   ├── receipt.ejs
│   ├── reports.ejs
│   └── users.ejs
├── .env.example
├── database.sql
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

## Key System Features & Core Workflows

### 1. Tablet & Mobile POS Layout
* **Tablet View:** On tablets and laptops, the menu and cart stay side-by-side so cashiers can tap items and check out without scrolling up and down.
* **Mobile View:** On phones, the menu fills the screen, and a bottom bar shows the total. Tapping the bar slides up the cart and checkout panel.

### 2. Table Tabs & Kitchen Slips (Hold Tab)
* Staff can choose a table number (`Table 1` to `Table 20`) for Dine In orders.
* Clicking **Hold Tab** sends a **Kitchen Prep Slip** showing only the items and special instructions, without showing prices.
* Orders stay saved under the **Tables** button so staff can reopen the table, add more items, and settle payment later.

### 3. Automatic Inventory Deduction
* When an order is completed, the system automatically subtracts raw ingredients from the inventory based on recipe estimates.
* Low-stock items are flagged in the Inventory tab, and daily usage is recorded in Reports.

### 4. Payment Options & Discounts
* **Cash:** Quick-cash buttons, on-screen numpad, and automatic change computation.
* **GCash & Maya:** Shows QR codes for scanning and lets the cashier enter the customer's reference number.
* **Card:** Counter card terminal flow where the cashier swipes/taps the card on a terminal, types the approval code, and clicks **Mark as Paid**.
* **Discounts:** Buttons for Senior Citizen (20%), PWD (20%), Employee, and custom discounts, with fields for cardholder name and ID number.

### 5. Thermal Receipt Printing
* Prints clean receipts and kitchen slips on standard **58mm** and **80mm** thermal roll printers.
* Uses the browser print system so it works on tablets, phones, and PCs without special printer drivers or extra software setup.
* Paper cutting is handled automatically by the printer hardware when printing finishes.

### 6. Manager PIN & Void Audits
* Cashiers cannot cancel items or orders by themselves; a Manager or Owner must choose their name and type their PIN to approve any void.
* Every void, stock adjustment, and login is saved in the **Audit Trail** with staff names, dates, and reasons.

---

## Installation and Run (XAMPP / MySQL)
1. Install **Node.js 18+** and **XAMPP**.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Open phpMyAdmin (`http://localhost/phpmyadmin`), create a database, and import `database.sql`.
4. Open your terminal in the project directory:
   ```bash
   cd papa-es-pos
   npm ci
   npm start
5. Open: `http://localhost:3000`

---

## Default Accounts

| Role | Username | Password | Void Authorization PIN | Access Level |
| --- | --- | --- | --- | --- |
| **Owner** | `admin` | `papaes2026` | Set upon first login / Account settings | Full access (Dashboard, Reports, Audit Trail, Users, Menu, POS, Voids) |
| **Manager** | `manager` | `papaes2026` | Set upon first login / Account settings | Inventory, Reports, POS, Void Authorizations |
| **Cashier** | `cashier` | `papaes2026` | Not required | POS Order Entry, Holding Tabs, Settle Bill |
| **Kitchen** | `kitchen` | `papaes2026` | Not required | Kitchen Prep View & Kitchen Slip Access |

> **Note on Manager PINs:** Newly created Manager and Owner accounts must set their 4-to-6-digit security PIN in the **Accounts** panel before they can authorize item cancellations or voids.

