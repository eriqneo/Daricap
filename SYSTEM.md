# SYSTEM.md: DariCap Network

## Project Overview
DariCap Network is a specialized Kenyan microfinance Progressive Web App (PWA) designed to streamline operations for field officers and administrators. The system manages the entire micro-landing lifecycle—from field-based client registration to centralized loan approval and automated repayment tracking.

## Technical Core
- **Frontend**: Lightweight Vanilla JavaScript / CSS (Tailwind) / HTML5. Built as a high-performance Single Page Application (SPA).
- **Backend**: [PocketBase](https://pocketbase.io/) (Open Source Backend) providing Real-time Database, Auth, and File Hosting.
- **Offline Support**: PWA integration with Service Workers and IndexedDB (`idb-keyval`) for reliable field operations in low-connectivity areas.
- **Intelligence**: Integrated with Google Gemini AI for smart insights, automated risk assessment, and data analysis.
- **Safety**: Robust role-based access control (Admin vs. Officer) and secure file upload for sensitive KYC documents.

## Key Modules

### 1. Smart Dashboard
- Dual-role interface (Administrator vs. Field Officer).
- Real-time performance metrics (Total Portfolio, Collection Efficiency, Pending Approvals).
- Interactive activity charts and "Overdue Alerts" for proactive debt management.

### 2. Client & KYC Management
- **Digital Registration**: Direct capture of client photos and ID documents via device camera.
- **Client Profiles**: 360-degree view of client financial history, collateral, and household details.
- **Migration Ready**: Includes scripts for seamless data import from legacy systems.

### 3. Loan Management
- **Workflow-Driven Applications**: Multi-step forms for Loan Products, Guarantors, and Collateral items.
- **Two-Tier Approval**: Field officers submit, while administrators review, cross-verify, and approve.
- **Disbursement Engine**: Tracks funding dates and initiates automated schedules.

### 4. Repayments & Collections
- **Automated Schedules**: Dynamic generation of weekly/monthly installment plans based on product parameters.
- **Field Collections**: "Record Payment" interface optimized for mobile use during field visits.
- **History Tracking**: Full audit trail of all transactions and schedule adjustments.

### 5. Advanced Reports
- **Portfolio Analysis**: Detailed breakdowns of "Portfolio at Risk" (PAR) and disbursement volumes.
- **Staff Activity**: Monitoring field officer visit frequency and registration targets.

## Environment & Configuration
The system requires two primary external services:
1. **PocketBase Instance**: Houses the application data and handles auth.
2. **Gemini API Key**: Powers the AI decision-support features.

Configuration is managed via `.env` variables as defined in `.env.example`.

## Architecture Principles
1. **Mobile-First**: Every UI component is tested for responsive performance on low-end mobile devices used in the field.
2. **Latency Resistant**: UI actions are optimistic where possible, syncing with the cloud backend when available.
3. **Vanilla Purity**: Avoids heavy frameworks like React or Vue to ensure maximum performance and minimal bundle size for PWA users.

## Recent System Updates (May 2026)

- **Enhanced Repayment Module**:
  - Implemented a **Premium Print Schedule** feature with professional branding, signature blocks for both client and officer, and a clean portrait layout for official documentation.
  - Refined "Record Payment" workflow by removing redundant UI elements and centralizing the transaction logic.
- **Improved Client UX**:
  - **Dynamic Processing Fee Management**: The processing fee card now automatically retires from the profile view upon successful collection, improving interface clarity for funded clients.
  - **Fixed Navigation**: Resolved routing issues in the client list to ensure direct access to detailed profiles.
- **Reporting & Data Accuracy**:
  - Unified the "Total Paid" calculation engine across the Repayments and Reports modules to ensure the payment schedule remains the absolute source of truth for recovered capital.
  - Integrated enhanced toast notifications for real-time feedback on critical database operations.

---
*Created for DariCap Network Microfinance Solutions.*
