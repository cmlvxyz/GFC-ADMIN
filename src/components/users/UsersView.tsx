import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Shield, Phone, Mail, UserCheck, X, Edit2, Trash2 } from 'lucide-react';
import { User, Role } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { useToast } from '../common/Toast.tsx';

const ROLES: Role[] = ['Super Admin', 'Admin', 'Media Team', 'Pastor', 'Member'];

export const UsersView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Admin');
  const [phone, setPhone] = useState('');
  const [ministry, setMinistry] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast('error', 'Failed to load users', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openForm = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setPhone(user.phone || '');
      setMinistry(user.ministry || '');
      setStatus(user.status);
    } else {
      setEditingUser(null);
      setName('');
      setEmail('');
      setRole('Admin');
      setPhone('');
      setMinistry('Administration & Media');
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          phone: phone.trim(),
          ministry: ministry.trim(),
          status,
        });
        showToast('success', 'User Updated', `Updated profile for ${name}`);
      } else {
        await api.createUser({
          name: name.trim(),
          email: email.trim(),
          role,
          phone: phone.trim(),
          ministry: ministry.trim(),
          status,
          avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
        });
        showToast('success', 'User Created', `Created user account for ${name}`);
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      showToast('error', 'Operation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user account "${user.name}"?`)) return;
    try {
      await api.deleteUser(user.id);
      showToast('success', 'User Deleted', `Removed account for ${user.name}`);
      loadUsers();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.ministry?.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Accounts that can sign in to this admin panel.
          </p>
        </div>

        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add User / Staff
        </button>
      </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or ministry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading user records...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">No user profiles matched your search.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role & Access</th>
                <th className="py-3 px-4">Ministry / Department</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase border border-indigo-200">
                        {u.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        u.role === 'Super Admin'
                          ? 'purple'
                          : u.role === 'Admin'
                          ? 'primary'
                          : u.role === 'Pastor'
                          ? 'amber'
                          : 'neutral'
                      }
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{u.ministry || 'General'}</td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <Badge variant={u.status === 'active' ? 'success' : 'neutral'}>
                      {u.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => openForm(u)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="font-semibold text-sm">
                {editingUser ? 'Edit User Profile' : 'Add New Church User'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deacon Juan Dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. juan@gfc.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ministry / Dept</label>
                <input
                  type="text"
                  placeholder="e.g. Worship & Creative Media"
                  value={ministry}
                  onChange={(e) => setMinistry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+63 9..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingUser ? 'Update Profile' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
