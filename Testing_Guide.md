# 🚀 RFID Gate Pass: End-to-End Testing Guide (Hardware-Less)

To test the entire logistics flow without physical RFID readers, follow these 4 professional steps.

### 1️⃣ Step 1: Employee Clearance Request
*   **Action**: Log in as a **Staff/Employee** (e.g., Saood or Huzaifa).
*   **Location**: Go to the **Gate Pass** tab.
*   **Task**: 
    1. Select your assigned laptop (e.g., `LPT-0001`).
    2. Enter a **Reason** (e.g., "Working from Client Site").
    3. Set a **Return Time** (Valid Till).
    4. Click **Submit Clearance Request**.
*   **Result**: The request is now indexed in the "Pending Queue".

### 2️⃣ Step 2: Managerial Authorization
*   **Action**: Log in as a **Divisional Manager** (e.g., Shamroz) or **SuperAdmin**.
*   **Location**: Go to the **Gate Pass** -> **Approvals** tab.
*   **Task**:
    1. Locate the employee's request in the breakdown list.
    2. Review the **Purpose** (Reason).
    3. Click **Approve**.
*   **Result**: The RFID tag is now authorized for the exit cycle.

### 3️⃣ Step 3: Simulation of Automatic Gate Detection
*   **Action**: Log in as **Admin** or **Security Admin**.
*   **Location**: Go to **Gate Pass** -> **Gate Control (Automation)** tab.
*   **Task (EXIT Cycle)**:
    1. Select the **Asset Tag** from the dropdown (Simulation of RFID Antenna detection).
    2. Click **TRIGGER EXIT SCAN**.
    *   *Result*: System validates the manager's approval. The log will show "✅ Authorized Exit".
*   **Task (ENTRY Cycle)**:
    1. Select the same **Asset Tag**.
    2. Click **TRIGGER ENTRY SCAN**.
    *   *Result*: The system **automatically closes** the digital gate pass and updates the hardware status to "Inside" without any manual stamping.

### 4️⃣ Step 4: Strategic Dashboard Audit
*   **Action**: View the **Dashboard** (Security Operations Center).
*   **Task**:
    1. Observe the **"Outside Premises"** count increase during Step 3.
    2. Click the **"Outside"** widget to see the drilldown (shows who has the laptop and when it's due).
    3. Observe the **"Inside Facility"** count increase once the Entry Scan is finished.
    4. Check the **"Unauthorized Alerts"** by attempting an Exit scan *without* manager approval.

---

### 🛡️ Simulation Logic Explained:
*   **Exit Logic**: Scans `GatePasses` table for `Status == 'Approved'` AND `CurrentTime < ValidTill`.
*   **Entry Logic**: Automatically finds any open `Approved` pass for that RFID tag, marks it as `Closed`, and resets the asset status in one atomic operation.
*   **Alert Logic**: If a scan is triggered for a tag that has no `Approved` pass, a **Red Alert** is broadcasted to the Live Feed.
