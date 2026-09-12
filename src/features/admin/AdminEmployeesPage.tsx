import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import {
  PREVIEW_EMPLOYEES,
  PREVIEW_ORG,
  type PreviewEmployee,
} from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  fetchAdminEmployees,
  fetchOperationalLocations,
  saveEmployeeBranchAssignments,
  type AdminEmployee,
  type OperationalBranch,
} from '../locations/operationalLocationClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const ROLE_PERMISSIONS: Record<PreviewEmployee['role'], string[]> = {
  staff: ['shift', 'sale', 'apply_reward'],
  admin: ['reports', 'catalogue', 'employees', 'terminals', 'audit', 'approve_variance'],
  dual: ['shift', 'sale', 'reports_branch'],
};

const BRANCH_NAMES = PREVIEW_ORG.branches.map((branch) => branch.name);
const DEFAULT_BRANCH = BRANCH_NAMES[0] ?? 'Main Café';

type PreviewFormState = {
  id: string | null;
  name: string;
  username: string;
  role: PreviewEmployee['role'];
  branch: string;
  isGlobalManager: boolean;
};

const EMPTY_PREVIEW_FORM: PreviewFormState = {
  id: null,
  name: '',
  username: '',
  role: 'staff',
  branch: DEFAULT_BRANCH,
  isGlobalManager: false,
};

type LiveFormState = {
  userId: string;
  branchIds: string[];
};

export function AdminEmployeesPage() {
  const preview = isUiPreviewMode();
  const [previewEmployees, setPreviewEmployees] = useState<PreviewEmployee[]>(PREVIEW_EMPLOYEES);
  const [liveEmployees, setLiveEmployees] = useState<AdminEmployee[]>([]);
  const [branches, setBranches] = useState<OperationalBranch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState<PreviewFormState>(EMPTY_PREVIEW_FORM);
  const [liveForm, setLiveForm] = useState<LiveFormState>({ userId: '', branchIds: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  async function loadLive() {
    if (preview) return;
    setError('');
    try {
      const [employees, locations] = await Promise.all([
        fetchAdminEmployees(),
        fetchOperationalLocations(),
      ]);
      setLiveEmployees(employees);
      setBranches(locations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load employee access');
    }
  }

  useEffect(() => {
    void loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  function openAddPreview() {
    if (!preview) return;
    setPreviewForm(EMPTY_PREVIEW_FORM);
    setDialogOpen(true);
  }

  function openEditPreview(employee: PreviewEmployee) {
    setPreviewForm({
      id: employee.id,
      name: employee.name,
      username: employee.username,
      role: employee.role,
      branch: employee.branches[0] ?? DEFAULT_BRANCH,
      isGlobalManager: employee.isGlobalManager,
    });
    setDialogOpen(true);
  }

  function openEditLive(employee: AdminEmployee) {
    setLiveForm({
      userId: employee.userId,
      branchIds: employee.branchIds,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function togglePreviewActive(id: string) {
    setPreviewEmployees((previous) =>
      previous.map((employee) =>
        employee.id === id ? { ...employee, active: !employee.active } : employee,
      ),
    );
  }

  function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = previewForm.name.trim();
    const username = previewForm.username.trim();
    if (!name || !username) return;

    if (previewForm.id) {
      const id = previewForm.id;
      setPreviewEmployees((previous) =>
        previous.map((employee) =>
          employee.id === id
            ? {
                ...employee,
                name,
                username,
                role: previewForm.role,
                branches: [previewForm.branch],
                isGlobalManager: previewForm.isGlobalManager,
                permissions: ROLE_PERMISSIONS[previewForm.role],
              }
            : employee,
        ),
      );
    } else {
      setPreviewEmployees((previous) => [
        ...previous,
        {
          id: `custom-${username}-${previous.length}`,
          name,
          username,
          role: previewForm.role,
          branches: [previewForm.branch],
          isGlobalManager: previewForm.isGlobalManager,
          active: true,
          permissions: ROLE_PERMISSIONS[previewForm.role],
        },
      ]);
    }
    closeDialog();
  }

  function toggleLiveBranch(branchId: string) {
    setLiveForm((form) => ({
      ...form,
      branchIds: form.branchIds.includes(branchId)
        ? form.branchIds.filter((id) => id !== branchId)
        : [...form.branchIds, branchId],
    }));
  }

  async function handleLiveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const employee = liveEmployees.find((item) => item.userId === liveForm.userId);
    if (!employee) return;
    if (employee.appRole === 'staff' && liveForm.branchIds.length === 0) {
      setError('Staff must remain assigned to at least one branch.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await saveEmployeeBranchAssignments(liveForm.userId, liveForm.branchIds);
      closeDialog();
      await loadLive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update branch assignments');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-employees"
      title="Employees and access"
      hint={
        preview
          ? 'Credentials never displayed — permissions are illustrative.'
          : 'Trusted employee roles and branch scope. Account creation, role mutation and credential lifecycle are not implemented in Phase 1.'
      }
      actions={
        preview ? (
          <button type="button" className="btn-primary" onClick={openAddPreview}>
            <UserPlus size={16} aria-hidden="true" />
            Add employee
          </button>
        ) : undefined
      }
    >
      {error && <p className="form-hint" role="alert">{error}</p>}

      {preview ? (
        <table className="data-table admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Branches</th>
              <th>Global manager</th>
              <th>Status</th>
              <th>Permissions</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {previewEmployees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td>{employee.username}</td>
                <td>{employee.role}</td>
                <td>{employee.branches.join(', ')}</td>
                <td>{employee.isGlobalManager ? 'Yes' : 'No'}</td>
                <td>
                  <span className={`status-pill status-pill--${employee.active ? 'ok' : 'warn'}`}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-permissions-cell">{employee.permissions.join(', ')}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openEditPreview(employee)}>
                      Edit
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => togglePreviewActive(employee.id)}>
                      {employee.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branches</th>
                <th>Scope</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liveEmployees.map((employee) => (
                <tr key={employee.userId}>
                  <td>{employee.displayName || '—'}</td>
                  <td>{employee.email}</td>
                  <td>{employee.appRole}</td>
                  <td>
                    {employee.branchIds.length
                      ? employee.branchIds
                          .map((id) => branchNameById.get(id) || id)
                          .join(', ')
                      : '—'}
                  </td>
                  <td>{employee.appRole === 'staff' ? 'Assigned branches' : 'Global'}</td>
                  <td>
                    <span className={`status-pill status-pill--${employee.disabledAt ? 'warn' : 'ok'}`}>
                      {employee.disabledAt ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => openEditLive(employee)}
                      disabled={busy}
                    >
                      Branch access
                    </button>
                  </td>
                </tr>
              ))}
              {liveEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">No employee profiles found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="form-hint" role="note">
            Phase 1 does not create Auth users, change trusted roles or manage employee passwords/PINs.
          </p>
        </>
      )}

      {dialogOpen && preview && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="employee-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="employee-dialog-title" className="admin-section-title">
              {previewForm.id ? 'Edit employee' : 'Add employee'}
            </h2>
            <p className="form-hint">Session preview only.</p>
            <form className="admin-form" onSubmit={handlePreviewSubmit}>
              <label>
                Full name
                <input
                  value={previewForm.name}
                  onChange={(event) => setPreviewForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Username
                <input
                  value={previewForm.username}
                  onChange={(event) => setPreviewForm((form) => ({ ...form, username: event.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={previewForm.role}
                  onChange={(event) =>
                    setPreviewForm((form) => ({
                      ...form,
                      role: event.target.value as PreviewEmployee['role'],
                    }))
                  }
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="dual">Dual (staff + admin)</option>
                </select>
              </label>
              <label>
                Branch
                <select
                  value={previewForm.branch}
                  onChange={(event) => setPreviewForm((form) => ({ ...form, branch: event.target.value }))}
                >
                  {BRANCH_NAMES.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={previewForm.isGlobalManager}
                  onChange={(event) =>
                    setPreviewForm((form) => ({ ...form, isGlobalManager: event.target.checked }))
                  }
                  disabled={previewForm.role !== 'admin'}
                />
                Global manager
              </label>
              <p className="form-hint">
                Permissions follow from role: {ROLE_PERMISSIONS[previewForm.role].join(', ')}
              </p>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeDialog}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {previewForm.id ? 'Save changes' : 'Add employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialogOpen && !preview && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="employee-branch-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="employee-branch-dialog-title" className="admin-section-title">
              Branch access
            </h2>
            <form className="admin-form" onSubmit={handleLiveSubmit}>
              <div>
                <span className="form-hint" id="employee-branches-label">Allowed branches</span>
                <div className="admin-row-actions" role="group" aria-labelledby="employee-branches-label">
                  {branches.filter((branch) => branch.isActive).map((branch) => (
                    <label key={branch.id} className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={liveForm.branchIds.includes(branch.id)}
                        onChange={() => toggleLiveBranch(branch.id)}
                      />
                      {branch.name} ({branch.code})
                    </label>
                  ))}
                </div>
              </div>
              <p className="form-hint">
                Staff are restricted to these branches. Admin and Owner remain global in the current authority model.
              </p>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeDialog}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>Save branch access</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
