'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Pencil, Trash2,
  Search, X, Loader2, CheckCircle2, AlertTriangle, UserPlus,
  Shield, ShieldAlert, AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleBadge } from '@/components/auth/RoleBadge';

interface UserRecord {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  role_priority?: number;
  module_access?: string[];
  is_developer?: boolean;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleRecord {
  id: number;
  name: string;
  priority: number;
  is_system: boolean;
  is_developer: boolean;
  description: string | null;
  permissions: string[];
}

interface CreateUserForm {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role: string;
  module_access: string[];
}

interface EditUserForm {
  email?: string;
  full_name?: string;
  role?: string;
  module_access?: string[];
  is_active?: boolean;
}

interface UsersResponse {
  users: UserRecord[];
  total: number;
}

const MODULE_OPTIONS = [
  { key: 'dashboard', label: 'Overview' },
  { key: 'reports', label: 'Reports' },
  { key: 'garments', label: 'Garments' },
  { key: 'sales', label: 'Sales' },
  { key: 'financial', label: 'Financial' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'manufacturing', label: 'Manufacturing' },
];

const ALL_MODULE_KEYS = MODULE_OPTIONS.map((m) => m.key);

function defaultModulesForRole(role: string): string[] {
  return role === 'admin' ? [...ALL_MODULE_KEYS] : ['dashboard'];
}

async function fetchUsers(): Promise<UsersResponse> {
  const res = await apiClient.get('/auth/users');
  return res.data;
}

async function fetchRoles(): Promise<RoleRecord[]> {
  const res = await apiClient.get('/auth/roles');
  return res.data;
}

function roleIcon(roleName: string) {
  const role = roleName.toLowerCase();
  if (role === 'developer') return ShieldAlert;
  if (role === 'admin') return ShieldAlert;
  return Shield;
}

function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="p-5">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function AdminUsersContent() {
  const { user: me, isDeveloper } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    username: '',
    full_name: '',
    password: '',
    role: 'user',
    module_access: ['dashboard'],
  });

  const [editForm, setEditForm] = useState<EditUserForm>({});

  const flash = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: fetchRoles,
    staleTime: 60_000,
  });

  const roleMap = useMemo(() => {
    const map = new Map<string, RoleRecord>();
    roles.forEach((role) => map.set(role.name.toLowerCase(), role));
    return map;
  }, [roles]);

  const mePriority = useMemo(() => {
    if (!me) return 0;
    if (typeof me.role_priority === 'number') return me.role_priority;
    return roleMap.get((me.role || '').toLowerCase())?.priority ?? 10;
  }, [me, roleMap]);

  const assignableRoles = useMemo(() => {
    const allowedRoleNames = isDeveloper ? ['admin', 'user'] : ['user'];
    return allowedRoleNames
      .map((name) => roles.find((role) => role.name.toLowerCase() === name))
      .filter((role): role is RoleRecord => Boolean(role));
  }, [roles, isDeveloper]);

  useEffect(() => {
    if (!assignableRoles.length) return;
    if (!assignableRoles.some((r) => r.name === createForm.role)) {
      const nextRole = assignableRoles[0].name;
      setCreateForm((prev) => ({
        ...prev,
        role: nextRole,
        module_access: defaultModulesForRole(nextRole),
      }));
    }
  }, [assignableRoles, createForm.role]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    staleTime: 30_000,
  });

  const users = useMemo(() => {
    if (!data?.users) return [];
    const sortedUsers = [...data.users].sort((a, b) => b.id - a.id);
    if (!search.trim()) return sortedUsers;
    const q = search.toLowerCase();
    return sortedUsers.filter((u) =>
      u.username.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.full_name || '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const canManageTarget = useCallback((target: UserRecord) => {
    if (!me) return false;

    if (isDeveloper) {
      return me.id !== String(target.id);
    }

    const targetPriority = target.role_priority ?? roleMap.get((target.role || '').toLowerCase())?.priority ?? 10;
    if (target.role?.toLowerCase() === 'developer') return false;
    if (target.role?.toLowerCase() === 'admin') return false;
    if (me.id === String(target.id)) return false;

    return targetPriority < mePriority;
  }, [me, isDeveloper, roleMap, mePriority]);

  const createMutation = useMutation({
    mutationFn: async (form: CreateUserForm) => {
      const res = await apiClient.post('/auth/users', form);
      return res.data;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData<UsersResponse>(['admin-users'], (previous) => {
        if (!previous) {
          return { users: [newUser], total: 1 };
        }

        const alreadyExists = previous.users.some((u) => u.id === newUser.id);
        const nextUsers = [newUser, ...previous.users.filter((u) => u.id !== newUser.id)];

        return {
          users: nextUsers,
          total: alreadyExists ? previous.total : previous.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateOpen(false);
      const resetRole = assignableRoles[0]?.name || 'user';
      setCreateForm({
        email: '',
        username: '',
        full_name: '',
        password: '',
        role: resetRole,
        module_access: defaultModulesForRole(resetRole),
      });
      flash('success', `User ${newUser.username} created`);
    },
    onError: (err: any) => {
      flash('error', err.response?.data?.detail || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: number; form: EditUserForm }) => {
      const res = await apiClient.put(`/auth/users/${id}`, form);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<UsersResponse>(['admin-users'], (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          users: previous.users.map((u) => (u.id === updated.id ? updated : u)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
      flash('success', `User ${updated.username} updated`);
    },
    onError: (err: any) => {
      flash('error', err.response?.data?.detail || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/auth/users/${id}`);
      return res.data;
    },
    onSuccess: (_response, deletedUserId) => {
      queryClient.setQueryData<UsersResponse>(['admin-users'], (previous) => {
        if (!previous) return previous;
        const nextUsers = previous.users.filter((u) => u.id !== deletedUserId);
        return {
          users: nextUsers,
          total: Math.max(0, previous.total - 1),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteUser(null);
      flash('success', 'User deleted');
    },
    onError: (err: any) => {
      flash('error', err.response?.data?.detail || 'Failed to delete user');
    },
  });

  const handleCreate = () => {
    if (!createForm.email || !createForm.username || !createForm.password) {
      flash('error', 'Email, username and password are required');
      return;
    }
    if (!createForm.role) {
      flash('error', 'Please select a role');
      return;
    }
    if (!createForm.module_access.length) {
      flash('error', 'Please select at least one module for access');
      return;
    }
    createMutation.mutate(createForm);
  };

  const toggleCreateModule = (moduleKey: string) => {
    setCreateForm((prev) => ({
      ...prev,
      module_access: prev.module_access.includes(moduleKey)
        ? prev.module_access.filter((m) => m !== moduleKey)
        : [...prev.module_access, moduleKey],
    }));
  };

  const toggleEditModule = (moduleKey: string) => {
    setEditForm((prev) => {
      const current = prev.module_access || [];
      return {
        ...prev,
        module_access: current.includes(moduleKey)
          ? current.filter((m) => m !== moduleKey)
          : [...current, moduleKey],
      };
    });
  };

  const handleOpenCreateModal = () => {
    if (rolesLoading) {
      flash('error', 'Role catalog is still loading. Please try again in a moment.');
      return;
    }

    if (assignableRoles.length === 0) {
      const detail = (rolesError as any)?.response?.data?.detail || 'No assignable roles available for your account.';
      flash('error', `Cannot add user: ${detail}`);
      return;
    }

    setCreateOpen(true);
  };

  const openEdit = (target: UserRecord) => {
    if (!canManageTarget(target)) return;
    setEditUser(target);
    setEditForm({
      email: target.email,
      full_name: target.full_name || '',
      role: target.role,
      module_access: target.module_access?.length ? [...target.module_access] : defaultModulesForRole(target.role),
      is_active: target.is_active,
    });
  };

  const handleEdit = () => {
    if (!editUser) return;
    if (!editForm.module_access || editForm.module_access.length === 0) {
      flash('error', 'Please select at least one module for access');
      return;
    }
    updateMutation.mutate({ id: editUser.id, form: editForm });
  };

  const handleDelete = () => {
    if (!deleteUser) return;
    deleteMutation.mutate(deleteUser.id);
  };

  const fmtDate = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const fmtDateTime = (value: string | null) => {
    if (!value) return 'Never';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary-600" />
            User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {data?.total ?? 0} users total
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          disabled={rolesLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                     bg-primary-600 text-white hover:bg-primary-700
                     disabled:opacity-60 disabled:cursor-not-allowed
                     shadow-sm shadow-primary-600/20 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {!isDeveloper && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>
            Hierarchy protection is active. Admin can manage only lower roles and cannot view or manage Developer accounts.
          </span>
        </div>
      )}

      {!rolesLoading && assignableRoles.length === 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>
            Add User is unavailable because no assignable roles were returned. If this persists, verify RBAC roles are seeded and your account has admin/developer access.
          </span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900
                     border border-slate-200 dark:border-slate-700
                     focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                     dark:focus:border-primary-500 outline-none transition-all"
        />
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5" />
        <span>
          Status controls account access. <strong>Active</strong> users can sign in and use assigned modules, while <strong>Inactive</strong> users are blocked from login but kept in records.
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Created</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((target) => {
                  const RoleIcon = roleIcon(target.role);
                  const isSelf = me?.id === String(target.id);
                  const canManage = canManageTarget(target);

                  return (
                    <tr key={target.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(target.username[0] || 'U').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                              {target.full_name || target.username}
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 font-medium">
                                  you
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{target.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="w-3.5 h-3.5 text-slate-400" />
                          <RoleBadge role={target.role} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          target.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${target.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {target.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {fmtDateTime(target.last_login)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {fmtDate(target.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(target)}
                            title={canManage ? 'Edit user' : 'Not allowed by hierarchy'}
                            disabled={!canManage}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => canManage && setDeleteUser(target)}
                            title={canManage ? 'Delete user' : 'Not allowed by hierarchy'}
                            disabled={!canManage}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      {search ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New User">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Username *</label>
            <input
              type="text"
              value={createForm.username}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              placeholder="e.g., john_doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email *</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              placeholder="john@anthrilo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={createForm.full_name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Password *</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              placeholder="Strong password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Role *</label>
            <select
              value={createForm.role}
              onChange={(e) => {
                const nextRole = e.target.value;
                setCreateForm((prev) => ({
                  ...prev,
                  role: nextRole,
                  module_access: defaultModulesForRole(nextRole),
                }));
              }}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Developer role is reserved and cannot be assigned.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Module Access *</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
              {MODULE_OPTIONS.map((module) => {
                const checked = createForm.module_access.includes(module.key);
                return (
                  <label key={module.key} className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCreateModule(module.key)}
                      className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500/30"
                    />
                    <span>{module.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create User
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit ${editUser?.username || 'User'}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={editForm.email || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={editForm.full_name || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Role</label>
            <select
              value={editForm.role || ''}
              onChange={(e) => {
                const nextRole = e.target.value;
                setEditForm((prev) => ({
                  ...prev,
                  role: nextRole,
                  module_access: defaultModulesForRole(nextRole),
                }));
              }}
              className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Module Access</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
              {MODULE_OPTIONS.map((module) => {
                const checked = (editForm.module_access || []).includes(module.key);
                return (
                  <label key={module.key} className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEditModule(module.key)}
                      className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500/30"
                    />
                    <span>{module.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Active</label>
            <button
              type="button"
              onClick={() => setEditForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              className={`w-10 h-5 rounded-full relative transition-colors outline-none border-0 ring-0 appearance-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                editForm.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`absolute left-[2px] top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                editForm.is_active ? 'translate-x-[20px]' : 'translate-x-0'
              }`} />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditUser(null)}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteUser?.username}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteUser(null)}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={['developer', 'admin']}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}
