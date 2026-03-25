# RBAC — Role-Based Access Control Rules

> Last updated: March 25, 2026
> Files: `apps/admin/app/api/users/route.ts`, `apps/admin/app/settings/page.tsx`, `apps/admin/lib/auth.ts`

## Role Hierarchy

```
super_admin (4) > admin (3) > hiring_manager (2) > recruiter (1) > viewer (0)
```

## Protected Accounts

| Email | Protection Level | Who Can Change Role | Who Can Delete |
|-------|-----------------|--------------------:|---------------:|
| `superadmin@company.com` | **Fully immutable** | Nobody (not even super_admin) | Nobody |
| `admin@company.com` | **Root admin protected** | super_admin only | Nobody |

## Role Change Rules (PUT /api/users)

### Who Can Change Roles

All **admin-level users** (`admin`, `super_admin`) can manage roles. Non-admin users cannot change anyone's role.

### What Roles Can Be Assigned

| Actor | Can assign viewer/recruiter/hiring_manager | Can assign admin | Can assign super_admin |
|-------|:------------------------------------------:|:----------------:|:---------------------:|
| `super_admin` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ❌ | ❌ |
| `hiring_manager` / `recruiter` / `viewer` | ❌ | ❌ | ❌ |

### Target-Specific Restrictions

| Actor | Target | Allowed? | Reason |
|-------|--------|:--------:|--------|
| Any admin | `superadmin@company.com` | ❌ | Role is completely immutable |
| admin (non-super) | `admin@company.com` | ❌ | Only super_admin can change root admin |
| super_admin | `admin@company.com` | ✅ | Super_admin has full control |
| admin | Other admin user | ✅ (to lower roles) | Admins can demote other admins |
| admin | Self (self-demotion) | ✅ (with confirmation) | Frontend confirms, backend allows |
| admin | Any viewer/recruiter/hiring_manager | ✅ (to non-admin roles) | Standard role management |

### Self-Demotion Safety

When an admin changes **their own role** to a non-admin role:
1. Frontend shows a confirmation dialog: _"You will lose admin access and won't be able to undo this yourself."_
2. On confirmation → API updates the role → local `user` state updates immediately → UI redirects to `/editor` after 1.5s
3. This prevents stale admin UI from persisting after demotion

## User Creation Rules (POST /api/users)

| Actor | Can create viewer/recruiter/hiring_manager | Can create admin | Can create super_admin |
|-------|:------------------------------------------:|:----------------:|:---------------------:|
| `super_admin` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ❌ | ❌ |

## User Deletion Rules (DELETE /api/users)

| Actor | Target | Allowed? |
|-------|--------|:--------:|
| Any user | Themselves | ❌ (cannot delete yourself) |
| admin | `admin@company.com` or `superadmin@company.com` | ❌ (protected accounts) |
| admin | Other admin-level user | ❌ (super_admin required) |
| admin | Lower-level user | ✅ |
| super_admin | `admin@company.com` or `superadmin@company.com` | ❌ (protected accounts) |
| super_admin | Any other user | ✅ |

## Password Rules

| Actor | Target | Allowed? |
|-------|--------|:--------:|
| Any user | Themselves (Profile tab) | ✅ |
| admin/super_admin | Non-admin user | ✅ (via Reset Password) |
| admin/super_admin | Another admin/super_admin | ❌ (admins manage their own passwords) |

## Session Sync

When a user's role is changed by another admin:
- `getSession()` (mutation paths) syncs the role from DB on every call — the updated role takes effect on the next API request
- `getSessionReadOnly()` (read paths) always returns the DB role, not the stale cookie role
- Password changes invalidate all sessions issued before the change (via `passwordChangedAt` comparison)

## Backend Enforcement Flow (PUT /api/users — role change)

```
1. Session check (getSession)
2. CSRF validation
3. Zod schema validation (updateUserSchema)
4. Non-admin trying to update others? → 403
5. Password change for admin by non-self? → 403
6. Role change requested?
   a. Is actor admin-level? (canManageRoles) → No: 403
   b. Is target in ROLE_IMMUTABLE_ACCOUNTS? (superadmin@company.com) → 403
   c. Is target admin@company.com and actor is not super_admin? → 403
   d. Is new role super_admin and actor is not super_admin? → 403
   e. Is new role admin and actor is not super_admin? → 403
7. Apply update → audit log → return success
```

## Frontend Enforcement (settings/page.tsx)

The frontend mirrors backend rules for UX (disabled dropdowns, hidden options) but **never trusts the frontend** — all rules are enforced server-side.

- Role dropdown **disabled** for: immutable superadmin, locked root admin (non-super_admin viewer), non-admin users
- `admin` and `super_admin` options in dropdown **hidden** unless: actor is super_admin, or user already has that role (to display current value)
- Self-demotion triggers a confirmation dialog before proceeding
- New user form only shows `admin`/`super_admin` role options to super_admin users
