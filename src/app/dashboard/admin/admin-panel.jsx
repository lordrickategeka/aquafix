'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'permissions', label: 'Permissions' },
];

export default function AdminPanel({ initialUsers, initialRoles, initialPermissions }) {
  const router = useRouter();
  const [tab, setTab] = useState('users');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function request(url, options) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-black/[.08] dark:border-white/[.145]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50'
                : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tab === 'users' && (
        <UsersTab users={initialUsers} roles={initialRoles} busy={busy} request={request} />
      )}
      {tab === 'roles' && (
        <RolesTab
          roles={initialRoles}
          permissions={initialPermissions}
          busy={busy}
          request={request}
        />
      )}
      {tab === 'permissions' && (
        <PermissionsTab permissions={initialPermissions} busy={busy} request={request} />
      )}
    </div>
  );
}

function Chip({ label, onRemove, disabled }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-black/[.08] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-white/[.145] dark:text-zinc-300">
      {label}
      <button
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        className="text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      >
        &times;
      </button>
    </span>
  );
}

function AssignControl({ label, options, value, onChange, onAssign, busy }) {
  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={onChange}
        disabled={busy}
        className="rounded-lg border border-black/[.08] bg-transparent px-2 py-1 text-xs text-zinc-950 outline-none focus:border-zinc-950 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-zinc-50"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <button
        onClick={onAssign}
        disabled={busy || !value}
        className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        Add
      </button>
    </div>
  );
}

function UsersTab({ users, roles, busy, request }) {
  const [selected, setSelected] = useState({});

  async function handleAssign(userId) {
    const roleId = selected[userId];
    if (!roleId) return;
    const ok = await request(`/api/admin/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: Number(roleId) }),
    });
    if (ok) setSelected((prev) => ({ ...prev, [userId]: '' }));
  }

  async function handleRemove(userId, roleId) {
    await request(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map((user) => {
        const assignedIds = new Set(user.roles.map((role) => role.id));
        const available = roles.filter((role) => !assignedIds.has(role.id));

        return (
          <div
            key={user.id}
            className="flex flex-col gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145] sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{user.email}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {user.roles.length === 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">No roles</span>
              )}
              {user.roles.map((role) => (
                <Chip
                  key={role.id}
                  label={role.name}
                  disabled={busy}
                  onRemove={() => handleRemove(user.id, role.id)}
                />
              ))}
              <AssignControl
                label="Add role..."
                options={available}
                value={selected[user.id] || ''}
                onChange={(e) => setSelected((prev) => ({ ...prev, [user.id]: e.target.value }))}
                onAssign={() => handleAssign(user.id)}
                busy={busy}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RolesTab({ roles, permissions, busy, request }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState({});

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await request('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (ok) setName('');
  }

  async function handleDelete(roleId) {
    if (!window.confirm('Delete this role? Users assigned to it will lose it.')) return;
    await request(`/api/admin/roles/${roleId}`, { method: 'DELETE' });
  }

  async function handleAssign(roleId) {
    const permissionId = selected[roleId];
    if (!permissionId) return;
    const ok = await request(`/api/admin/roles/${roleId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionId: Number(permissionId) }),
    });
    if (ok) setSelected((prev) => ({ ...prev, [roleId]: '' }));
  }

  async function handleRemove(roleId, permissionId) {
    await request(`/api/admin/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New role name"
          disabled={busy}
          className="flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-zinc-50"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Create role
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {roles.map((role) => {
          const assignedIds = new Set(role.permissions.map((permission) => permission.id));
          const available = permissions.filter((permission) => !assignedIds.has(permission.id));

          return (
            <div
              key={role.id}
              className="flex flex-col gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{role.name}</p>
                <button
                  onClick={() => handleDelete(role.id)}
                  disabled={busy}
                  className="text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {role.permissions.length === 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">No permissions</span>
                )}
                {role.permissions.map((permission) => (
                  <Chip
                    key={permission.id}
                    label={permission.name}
                    disabled={busy}
                    onRemove={() => handleRemove(role.id, permission.id)}
                  />
                ))}
                <AssignControl
                  label="Add permission..."
                  options={available}
                  value={selected[role.id] || ''}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [role.id]: e.target.value }))
                  }
                  onAssign={() => handleAssign(role.id)}
                  busy={busy}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PermissionsTab({ permissions, busy, request }) {
  const [name, setName] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await request('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (ok) setName('');
  }

  async function handleDelete(permissionId) {
    if (!window.confirm('Delete this permission? It will be removed from all roles.')) return;
    await request(`/api/admin/permissions/${permissionId}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New permission name"
          disabled={busy}
          className="flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-zinc-50"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Create permission
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {permissions.map((permission) => (
          <div
            key={permission.id}
            className="flex items-center justify-between rounded-2xl border border-black/[.08] px-4 py-3 dark:border-white/[.145]"
          >
            <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {permission.name}
            </p>
            <button
              onClick={() => handleDelete(permission.id)}
              disabled={busy}
              className="text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
