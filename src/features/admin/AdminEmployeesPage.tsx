import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { PREVIEW_EMPLOYEES, PREVIEW_ORG, type PreviewEmployee } from '../../preview/fixtures/catalog';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

/** Permissions follow from role in this preview — a real directory API
 * would let permissions be picked individually per employee. */
const ROLE_PERMISSIONS: Record<PreviewEmployee['role'], string[]> = {
  staff: ['shift', 'sale', 'apply_reward'],
  admin: ['reports', 'catalogue', 'employees', 'terminals', 'audit', 'approve_variance'],
  dual: ['shift', 'sale', 'reports_branch'],
};

const BRANCH_NAMES = PREVIEW_ORG.branches.map((b) => b.name);
const DEFAULT_BRANCH = BRANCH_NAMES[0] ?? 'Main Café';

type FormState = {
  id: string | null;
  name: string;
  username: string;
  role: PreviewEmployee['role'];
  branch: string;
  isGlobalManager: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  username: '',
  role: 'staff',
  branch: DEFAULT_BRANCH,
  isGlobalManager: false,
};

export function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<PreviewEmployee[]>(PREVIEW_EMPLOYEES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(emp: PreviewEmployee) {
    setForm({
      id: emp.id,
      name: emp.name,
      username: emp.username,
      role: emp.role,
      branch: emp.branches[0] ?? DEFAULT_BRANCH,
      isGlobalManager: emp.isGlobalManager,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function toggleActive(id: string) {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e)));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = form.name.trim();
    const username = form.username.trim();
    if (!name || !username) return;

    if (form.id) {
      const id = form.id;
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id
            ? {
                ...emp,
                name,
                username,
                role: form.role,
                branches: [form.branch],
                isGlobalManager: form.isGlobalManager,
                permissions: ROLE_PERMISSIONS[form.role],
              }
            : emp,
        ),
      );
    } else {
      const newEmployee: PreviewEmployee = {
        id: `custom-${username}-${employees.length}`,
        name,
        username,
        role: form.role,
        branches: [form.branch],
        isGlobalManager: form.isGlobalManager,
        active: true,
        permissions: ROLE_PERMISSIONS[form.role],
      };
      setEmployees((prev) => [...prev, newEmployee]);
    }
    closeDialog();
  }

  return (
    <AdminPageShell
      pageId="admin-employees"
      title="Employees and access"
      hint="Credentials never displayed — permissions are illustrative."
      actions={
        <button type="button" className="btn-primary" onClick={openAdd}>
          <UserPlus size={16} aria-hidden="true" />
          Add employee
        </button>
      }
    >
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
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.username}</td>
              <td>{emp.role}</td>
              <td>{emp.branches.join(', ')}</td>
              <td>{emp.isGlobalManager ? 'Yes' : 'No'}</td>
              <td>
                <span className={`status-pill status-pill--${emp.active ? 'ok' : 'warn'}`}>
                  {emp.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="admin-permissions-cell">{emp.permissions.join(', ')}</td>
              <td>
                <div className="admin-row-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(emp)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(emp.id)}>
                    {emp.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dialogOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="employee-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="employee-dialog-title" className="admin-section-title">
              {form.id ? 'Edit employee' : 'Add employee'}
            </h2>
            <p className="form-hint">Session preview only — no directory API yet.</p>
            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Username
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PreviewEmployee['role'] }))}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="dual">Dual (staff + admin)</option>
                </select>
              </label>
              <label>
                Branch
                <select value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}>
                  {BRANCH_NAMES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.isGlobalManager}
                  onChange={(e) => setForm((f) => ({ ...f, isGlobalManager: e.target.checked }))}
                  disabled={form.role !== 'admin'}
                />
                Global manager
              </label>
              <p className="form-hint">
                Permissions follow from role: {ROLE_PERMISSIONS[form.role].join(', ')}
              </p>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {form.id ? 'Save changes' : 'Add employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
