/**
 * Preview-only employee session persistence.
 * Survives full page reloads for screenshot automation / SPA remounts.
 * NEVER used outside UI preview mode. Stores identity fields only — no passwords, PINs, or tokens.
 */
import type { EmployeeIdentity } from '../../auth/types';
import { PREVIEW_DEMO_ACCOUNTS } from '../demoAccounts';

const BRANCH_MAIN = 'preview-branch-main';
const STORAGE_KEY = 'aida.uiPreview.employeeIdentity';

/** Shared demo PIN for every roster entry below — same "one published code
 * for every demo login" pattern as the terminal enrolment sample code. */
export const PREVIEW_STAFF_PIN = '4821';

export interface PreviewStaffPickerEntry {
  username: string;
  fullName: string;
  role: 'staff' | 'admin' | 'dual';
}

/** Who shows up in the "tap your name" picker on Employee Access — a
 * shared-terminal PIN login (Square/Toast/Clover-style), not the older
 * username+password form. Sourced from the same four names Admin's
 * Employees page already uses. */
export const PREVIEW_STAFF_ROSTER: PreviewStaffPickerEntry[] = [
  { username: 'nadia', fullName: 'Nadia Rahman', role: 'staff' },
  { username: 'hafiz', fullName: 'Hafiz Ali', role: 'staff' },
  { username: 'siti', fullName: 'Siti Manager', role: 'admin' },
  { username: 'amir', fullName: 'Amir Dual', role: 'dual' },
];

function namedIdentity(entry: PreviewStaffPickerEntry): EmployeeIdentity {
  const base = {
    id: `preview-emp-${entry.username}`,
    username: entry.username,
    fullName: entry.fullName,
    assignedBranchIds: [BRANCH_MAIN],
    authMethod: 'pin',
  };
  if (entry.role === 'staff') {
    return {
      ...base,
      role: 'staff',
      isGlobalManager: false,
      dualRolePosEnabled: false,
      selectedProduct: 'pos',
    };
  }
  if (entry.role === 'admin') {
    return {
      ...base,
      role: 'admin',
      isGlobalManager: true,
      dualRolePosEnabled: false,
      selectedProduct: 'admin',
    };
  }
  return {
    ...base,
    role: 'admin',
    isGlobalManager: false,
    dualRolePosEnabled: true,
    selectedProduct: null,
    requiresProductSelection: true,
  };
}

function dualIdentity(selected: 'pos' | 'admin' | null): EmployeeIdentity {
  const amir = PREVIEW_STAFF_ROSTER.find((e) => e.username === 'amir')!;
  return { ...namedIdentity(amir), selectedProduct: selected, requiresProductSelection: !selected };
}

function readStored(): EmployeeIdentity | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EmployeeIdentity;
  } catch {
    return null;
  }
}

function writeStored(identity: EmployeeIdentity | null) {
  if (typeof sessionStorage === 'undefined') return;
  if (!identity) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

let previewSession: EmployeeIdentity | null = readStored();

export const previewAuthRepository = {
  getSession(): EmployeeIdentity | null {
    if (!previewSession) previewSession = readStored();
    return previewSession;
  },

  /** Legacy demo-account path — kept working for anything still exercising
   * it directly (e.g. idle-lock reauth for a session that predates the PIN
   * picker), not exposed as its own tab anymore. */
  loginWithPassword(username: string, password: string): EmployeeIdentity {
    const u = username.trim().toLowerCase();
    if (u === PREVIEW_DEMO_ACCOUNTS.staff.username && password === PREVIEW_DEMO_ACCOUNTS.staff.password) {
      previewSession = namedIdentity(PREVIEW_STAFF_ROSTER[0]!);
      writeStored(previewSession);
      return previewSession;
    }
    if (u === PREVIEW_DEMO_ACCOUNTS.admin.username && password === PREVIEW_DEMO_ACCOUNTS.admin.password) {
      previewSession = namedIdentity(PREVIEW_STAFF_ROSTER[2]!);
      writeStored(previewSession);
      return previewSession;
    }
    if (u === PREVIEW_DEMO_ACCOUNTS.dual.username && password === PREVIEW_DEMO_ACCOUNTS.dual.password) {
      previewSession = dualIdentity(null);
      writeStored(previewSession);
      return previewSession;
    }
    const err = new Error('Invalid demonstration credentials') as Error & { code?: string };
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  },

  /** Shared-terminal login: pick a name, enter the PIN. `badgeValue` here
   * is the roster username — same call the old physical-badge tab used,
   * just sourced from a tap instead of a badge scanner. */
  loginWithBadge(badgeValue: string, pin: string): EmployeeIdentity {
    const entry = PREVIEW_STAFF_ROSTER.find((e) => e.username === badgeValue.trim().toLowerCase());
    if (entry && pin === PREVIEW_STAFF_PIN) {
      previewSession = namedIdentity(entry);
      writeStored(previewSession);
      return previewSession;
    }
    const err = new Error('Invalid demonstration PIN') as Error & { code?: string };
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  },

  selectProduct(product: 'pos' | 'admin'): EmployeeIdentity {
    if (!previewSession?.dualRolePosEnabled) {
      const err = new Error('Product selection not allowed') as Error & { code?: string };
      err.code = 'FORBIDDEN';
      throw err;
    }
    previewSession = dualIdentity(product);
    writeStored(previewSession);
    return previewSession;
  },

  logout() {
    previewSession = null;
    writeStored(null);
  },
};
