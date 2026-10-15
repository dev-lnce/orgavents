import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  Edit,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import ConfirmModal from '../components/ui/ConfirmModal';
import { LoadingSkeleton, EmptyState, InlineBanner } from '../components/ui/StateViews';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all'); // 'all' | 'admin' | 'organizer' | 'member'
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'active' | 'deactivated'

  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [deletingUser, setDeletingUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create User Form State
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });
  const [createFormErrors, setCreateFormErrors] = useState({});

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedRole !== 'all') params.role = selectedRole;
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const data = await adminAPI.getUsers(params);
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to fetch users.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleFilterChange = (role) => {
    setSelectedRole(role);
    setPage(1);
  };

  const handleStatusFilterChange = (status) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const openCreateModal = () => {
    setCreateFormData({
      name: '',
      email: '',
      password: '',
      role: 'member',
    });
    setCreateFormErrors({});
    setIsCreateModalOpen(true);
  };

  const validateCreateForm = () => {
    const errors = {};
    if (!createFormData.name.trim()) errors.name = 'Full name is required';
    if (!createFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(createFormData.email.trim())) {
      errors.email = 'Invalid email address';
    }

    if (!createFormData.password) {
      errors.password = 'Password is required';
    } else if (createFormData.password.length < 8) {
      errors.password = 'Must be at least 8 characters';
    }

    setCreateFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    setIsSubmitting(true);
    setFeedbackNotice(null);
    try {
      await adminAPI.createUser({
        name: createFormData.name.trim(),
        email: createFormData.email.trim(),
        password: createFormData.password,
        role: createFormData.role,
      });
      setFeedbackNotice({
        type: 'success',
        message: `Created account for ${createFormData.name}.`,
      });
      setIsCreateModalOpen(false);
      await fetchUsers();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to create user.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Role Change
  const handleInlineRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    setFeedbackNotice(null);
    try {
      await adminAPI.updateRole(targetUser._id, newRole);
      setFeedbackNotice({
        type: 'success',
        message: `Updated ${targetUser.name}'s role to ${newRole}.`,
      });
      await fetchUsers();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to update user role.',
      });
    }
  };

  // Inline Active/Deactivated Toggle
  const handleToggleActive = async (targetUser) => {
    const newStatus = targetUser.isActive === false;
    setFeedbackNotice(null);
    try {
      await adminAPI.updateStatus(targetUser._id, newStatus);
      setFeedbackNotice({
        type: 'success',
        message: `${targetUser.name}'s account has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await fetchUsers();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to update account status.',
      });
    }
  };

  // Reset Password Modal Handlers
  const openResetPasswordModal = (targetUser) => {
    setResetPasswordUser(targetUser);
    setNewPassword('');
    setPasswordError('');
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsResettingPassword(true);
    setFeedbackNotice(null);
    try {
      await adminAPI.updateUser(resetPasswordUser._id, { password: newPassword });
      setFeedbackNotice({
        type: 'success',
        message: `Password reset successfully for ${resetPasswordUser.name}.`,
      });
      setResetPasswordUser(null);
    } catch (err) {
      setPasswordError(err.message || 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Delete User Confirmation Handler
  const handleDeleteConfirm = async () => {
    if (!deletingUser?._id) return;
    setIsDeleting(true);
    setFeedbackNotice(null);
    try {
      await adminAPI.deleteUser(deletingUser._id);
      setFeedbackNotice({
        type: 'success',
        message: `User ${deletingUser.name} deleted.`,
      });
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to delete user.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {feedbackNotice && (
        <InlineBanner
          type={feedbackNotice.type}
          message={feedbackNotice.message}
          onDismiss={() => setFeedbackNotice(null)}
        />
      )}

      {/* Header Row: Users on left, New User on right (no double-plus typo) */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Users
        </h1>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.99]"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New User</span>
        </button>
      </div>

      {/* Controls: Search input + Role filter pills + Status filter pills */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          {/* Status Filter Pills */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'active', label: 'Active' },
              { id: 'deactivated', label: 'Deactivated' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStatusFilterChange(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  selectedStatus === st.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Role Filter Pills */}
          <div className="inline-flex items-center bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            {['all', 'admin', 'organizer', 'member'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleFilterChange(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  selectedRole === r
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clean Single Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="No directory accounts match your filter."
            actionText="New User"
            onAction={openCreateModal}
          />
        ) : (
          <div>
            {/* Table Header: 5 columns including Joined Date */}
            <div className="px-6 py-3.5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-400 min-w-[700px]">
              <div className="col-span-4">User</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Joined Date</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {users.map((u) => {
                const isSelf = currentUser?._id?.toString() === u._id?.toString();
                const joinedDateStr = u.createdAt
                  ? new Date(u.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '--';

                return (
                  <div
                    key={u._id}
                    className="px-6 py-4 grid grid-cols-12 items-center text-xs hover:bg-slate-50/50 transition-colors min-w-[700px]"
                  >
                    {/* 1. Name & Email */}
                    <div className="col-span-4 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">
                          {u.name}
                        </span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-500 font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 truncate block mt-0.5">
                        {u.email}
                      </span>
                    </div>

                    {/* 2. Inline Role Selector dropdown (PATCH /api/users/:id/role) */}
                    <div className="col-span-2 pr-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleInlineRoleChange(u, e.target.value)}
                        className="h-8 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 capitalize focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                        title="Change user role"
                      >
                        <option value="member">Member</option>
                        <option value="organizer">Organizer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    {/* 3. Active / Deactivated toggle (PUT /api/users/:id) */}
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          u.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title={u.isActive !== false ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{u.isActive !== false ? 'Active' : 'Deactivated'}</span>
                      </button>
                    </div>

                    {/* 4. Joined Date (createdAt) */}
                    <div className="col-span-2 text-slate-600 font-medium truncate pr-2">
                      {joinedDateStr}
                    </div>

                    {/* 5. Labeled/tooltip actions: Reset Password + Delete */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openResetPasswordModal(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                        title="Reset user password"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingUser(u)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing Page {page} of {totalPages} ({totalUsers} users)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Create New User</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, name: e.target.value })
                  }
                  placeholder="e.g. John Doe"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {createFormErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{createFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={createFormData.email}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, email: e.target.value })
                  }
                  placeholder="name@university.edu"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {createFormErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{createFormErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={createFormData.password}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, password: e.target.value })
                  }
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {createFormErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{createFormErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={createFormData.role}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, role: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="member">Member</option>
                  <option value="organizer">Organizer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setResetPasswordUser(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-slate-900" />
                <h2 className="text-lg font-bold text-slate-900">
                  Reset Password
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Set a new password for <span className="font-semibold text-slate-800">{resetPasswordUser.name}</span> ({resetPasswordUser.email}).
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {passwordError && (
                  <p className="text-xs text-red-600 mt-1">{passwordError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isResettingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingUser)}
        title="Delete User"
        message={`Are you sure you want to permanently delete the account for "${deletingUser?.name}" (${deletingUser?.email})?`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingUser(null)}
      />
    </div>
  );
}
