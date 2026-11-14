# HanuJai High School ERP — Developer / System Administrator Provisioning & Security Guide

This document specifies the authoritative security architecture and the administrative procedures for provisioning Developer (System Administrator) accounts in the HanuJai High School ERP.

---

## 1. Security Architecture & Threat Model

The HanuJai ERP follows a **zero-trust, server-authoritative role verification** model. Ordinary users, Principals, and Admin Officers cannot access or elevate themselves to Developer status.

### Security Layers

1. **Database-Level Protection (Cloud Firestore Security Rules):**
   - Rules strictly evaluate the user's authoritative record in `/staff/$(request.auth.uid)`:
     ```javascript
     function hasRole(role) {
       return isAuthenticated() && getUserData().role == role && getUserData().status == 'active';
     }
     function isAdmin() {
       return hasRole('admin') || hasRole('developer');
     }
     ```
   - Privileged developer endpoints such as `/classes/{classId}` write operations, `/staff/{staffId}` role updates, and `/developerSnapshots/{snapshotId}` require `hasRole('developer')`.
   - Client-side token tampering or local state mutation cannot bypass these server-side security checks.

2. **Serverless API Function Guards:**
   - Serverless functions (`/api/documents/upload`, `/api/documents/file`, `/api/documents/delete`) verify Firebase Authentication ID tokens directly against Google Identity Toolkit and check the Firestore `/staff` document for `role === 'developer'`.
   - Unauthorized callers receive HTTP `403 Forbidden`.

3. **Frontend Route Protection (`RoleGuard`):**
   - The `/developer` and `/developer/*` route hierarchy is wrapped with `<RoleGuard allowedRoles={['developer']}>`.
   - Principal and Admin Office accounts attempting to access `/developer` are immediately redirected to `/access-denied`.

4. **Last Developer Safeguard:**
   - The ERP prevents accidental removal, demotion, or deactivation of the last active Developer account. At least one active Developer must always exist to maintain system operations.

5. **No Public Sign-Up Endpoint:**
   - There is no unauthenticated registration API or public developer creation route. Developer accounts can only be provisioned via the secure administrative methods described below.

---

## 2. Initial Developer Account Provisioning

### Method A: Automated Administrative Script (Recommended)

Run the automated provisioning script locally or in a secure administrative shell:

```bash
cd c:\Projects\School\hanujai-erp

# Option 1: Using interactive command-line arguments
node scripts/provision_developer.cjs your.email@hanujai.edu.in "YourStrongPasswordHere"

# Option 2: Using environment variables
DEVELOPER_EMAIL="your.email@hanujai.edu.in" DEVELOPER_PASSWORD="YourStrongPasswordHere" node scripts/provision_developer.cjs
```

The script will:
1. Check or create the account in Firebase Authentication.
2. Retrieve the user's authenticated `UID`.
3. Create/update the canonical `/staff/staff-dev` record with `role: "developer"` and `status: "active"`.
4. Create/update the linked `/staff/{UID}` record so Firestore security rules resolve permissions instantly upon login.
5. Verify the written record.

---

### Method B: Manual Administrative Provisioning via Firebase Console

If running without Node CLI access, provision directly through the official Google Firebase Console:

#### Step 1: Create Account in Firebase Authentication
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select the **`hanujai-erp-demo`** project.
3. In the left navigation, go to **Build** → **Authentication** → **Users** tab.
4. Click **Add user**.
5. Enter the developer institutional email (e.g., `developer@hanujai.edu.in`) and a secure password.
6. Click **Add user**.
7. Copy the generated **User UID** (e.g. `Xk987AbC...`).

#### Step 2: Authorize in Cloud Firestore
1. In the left navigation, go to **Build** → **Firestore Database**.
2. Select the **`staff`** collection.
3. Click **Add document**:
   - **Document ID**: Paste the **User UID** copied from Step 1.
   - **Fields**:
     - `id`: (string) `"staff-dev"`
     - `email`: (string) `"developer@hanujai.edu.in"`
     - `name`: (string) `"System Administrator"`
     - `displayName`: (string) `"System Administrator (Developer)"`
     - `fullName`: (string) `"System Administrator (Developer)"`
     - `role`: (string) `"developer"`
     - `status`: (string) `"active"`
     - `employeeCode`: (string) `"DEV-ROOT-01"`
     - `department`: (string) `"Systems & Infrastructure"`
     - `designation`: (string) `"ERP System Administrator"`
     - `phone`: (string) `"+91 98290 11000"`
     - `createdAt`: (string) `2026-11-14T00:00:00.000Z`
     - `updatedAt`: (string) `2026-11-14T00:00:00.000Z`
4. Also create a duplicate document with Document ID **`staff-dev`** with the exact same fields, and include `authUid: "{User UID}"`.

---

## 3. Signing In to the Developer Console

1. Navigate to the HanuJai ERP website:
   `https://hanujai-erp.vercel.app/login` (or `http://localhost:5173/login`)
2. Enter your provisioned Developer email and password.
3. Upon authentication, you will be automatically redirected to the **Developer Console**:
   `/developer`
4. The sidebar will display the **Developer Console** link with the active system administrator badge.

---

## 4. Verification Checklist

| Check | Expected Result | Verified |
|---|---|---|
| Sign in with Developer credentials | Redirects to `/developer` | Yes |
| Principal attempts `/developer` | Redirects to `/access-denied` (HTTP 403 equivalent) | Yes |
| Admin Office attempts `/developer` | Redirects to `/access-denied` (HTTP 403 equivalent) | Yes |
| Attempt to demote/deactivate only developer | Safeguard throws error and blocks change | Yes |
| Excel import validation | Auto-maps 7 columns, verifies names, phones & classes | Yes |
| Snapshot creation | Pre-import state saved before committing updates | Yes |
| Rollback workflow | Requires explicit `"RESTORE"` confirmation | Yes |

