# 🛡️ RFID Laptop Movement Control System (SOC)
**System Version:** v4.0 (Enterprise SOC Edition)

## 📖 System Overview
The RFID Laptop Movement Control System is a mission-critical, enterprise-grade logistics and security application used to track, monitor, and audit the physical movement of IT Assets (Laptops) across facility gates. By leveraging RFID verification, strict Role-Based Access Control (RBAC) authorization arrays, and persistent security workflows, the system enables the Security Operations Center (SOC) to monitor hardware endpoints dynamically in real-time.

---

## 🛠️ Technology Stack & Frameworks

### **Frontend Desktop/Web Client**
- **Core Framework:** React 18
- **Build Tool:** Vite (Ultra-fast Hot Module Replacement)
- **Styling Architecture:** Custom component-scoped Glassmorphism & High-Density UI Data Grids (Vanilla CSS)
- **Real-time Engine:** `@microsoft/signalr` (Client-side WebSockets for 0-latency SOC alerts)
- **HTTP/REST Client:** `axios` (v1.x)
- **Logistics Export Engine:** Native HTML5 `window.print()` PDF generation and robust MS Excel `.csv` payload compilation.

### **Backend Command Server**
- **Core Framework:** .NET 8.0 `ASP.NET Core Web API`
- **Language:** C# 12
- **ORM (Database Communication):** Entity Framework Core (`Microsoft.EntityFrameworkCore.Sqlite`)
- **Real-Time Hub:** ASP.NET Core SignalR
- **Cross-Origin Configuration:** Global CORS configured for strict port syncing.

### **Database Architecture**
- **Engine:** SQLite 3 (`RFID_LaptopDB_v4.db`)
- **Storage Strategy:** Disk-persistent relational DB enabling robust FK constraints between:
  - `Employees` (Users/Staff)
  - `Assets` (Logical Hardware Nodes)
  - `GatePasses` (Time-boxed valid transit tickets)
  - `Roles & Permissions` (Granular RBAC)
  - `MovementLogs` & `Notifications` (Immutable audit data loops)

---

## 🔥 Key Security Features & Logistics Modules

### 1. Dynamic RBAC (Role-Based Access Control)
- Multi-tier routing and authorization.
- Custom Roles (`SuperAdmin`, `Division Manager`, `Gate Security`, `Employee`) dynamically mapped to raw system nodes (`ASSETS_VIEW`, `GATEPASS_APPROVE`, etc.).
- UI self-mutates strictly based on cached `localStorage` permission keys securely validated against the node map.

### 2. High-Frequency Real-Time SOC Dashboard 
- Live tracking metrics with 4 distinct Logistic Drilldowns:
  - 🏢 **Inside Facility:** Filterable grid showing physically present active hardware limits.
  - 📦 **Out of Premises:** Maps hardware out of boundaries with remaining valid time loops dynamically decaying in real-time.
  - ⏳ **Overdue Returns:** Escalates `Medium Risk` and `Critical Risk` warnings utilizing server decay logic for out-of-bounds metrics.
  - 🚨 **Unauthorized Attempts:** Triggers permanent warnings for unassigned tags, invalid/stale gate passes, and brute-force exits without approvals.
- Built-in PDF generation strictly scoped inside dynamic memory constraints via robust DOM-snapshotting.

### 3. Automated Gate Pass Escalation Workflow
- **Creation:** Initiated by standard Employees.
- **Approval Tree:** Requests automatically jump to Division Managers, locking into strict date-time arrays.
- **Enforcement:** The specific Gate nodes continuously poll Active Gatepasses; denying physical passage and sparking SignalR warning flags the millisecond logic shifts.

### 4. Zero-Latency Event Hooking (Notification Hub)
- Persistent SQLite table mapped to frontend persistent listening via WebSockets.
- Security actions immediately flush updates to any active SOC clients regardless of geographical segmentation.
- Forced-Sync state hooks ensure that alerts like "Expired Return Time" strictly enforce communication without manual data reloads.

### 5. Infinite Data Density Filters
All major command-center grids employ custom JSON filter architectures allowing cross-dimensional checks (i.e. finding overlapping boundaries between `Date Ranges`, specific `Gates`, `Division Data`, and literal `RFID Tag UUIDs`) simultaneously without heavy server overhead.
