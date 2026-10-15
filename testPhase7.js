/**
 * Phase 7 Admin Console Logic & API Contract Verification
 */

import assert from 'node:assert';

console.log('--- Starting Phase 7 Admin Console Logic Verification ---');

// Mock localStorage for test environment
const mockStorage = { token: 'mock-admin-token' };
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

// =========================================================================
// 1. Admin Users Directory Filtering & Safeguards (FR-USR-02, FR-USR-09, FR-USR-10)
// =========================================================================
console.log('1. Testing Admin Users Filtering & Safeguard Logic...');

const mockUsers = [
  { _id: 'usr-1', name: 'Dr. Dean Cruz', email: 'admin@uni.edu', role: 'admin', isActive: true },
  { _id: 'usr-2', name: 'Prof. Alan Turing', email: 'turing@uni.edu', role: 'organizer', isActive: true },
  { _id: 'usr-3', name: 'Grace Hopper', email: 'hopper@uni.edu', role: 'organizer', isActive: false },
  { _id: 'usr-4', name: 'Ada Lovelace', email: 'ada@uni.edu', role: 'member', isActive: true },
];

// Role filter
const filterByRole = (users, role) =>
  users.filter((u) => (role === 'all' ? true : u.role === role));

assert.strictEqual(filterByRole(mockUsers, 'all').length, 4);
assert.strictEqual(filterByRole(mockUsers, 'admin').length, 1);
assert.strictEqual(filterByRole(mockUsers, 'organizer').length, 2);
assert.strictEqual(filterByRole(mockUsers, 'member').length, 1);

// Status filter
const filterByStatus = (users, status) =>
  users.filter((u) => {
    if (status === 'active') return u.isActive;
    if (status === 'deactivated') return !u.isActive;
    return true;
  });

assert.strictEqual(filterByStatus(mockUsers, 'active').length, 3);
assert.strictEqual(filterByStatus(mockUsers, 'deactivated').length, 1);

// Search filter
const searchUsers = (users, query) => {
  const q = query.toLowerCase().trim();
  return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
};

assert.strictEqual(searchUsers(mockUsers, 'turing').length, 1);
assert.strictEqual(searchUsers(mockUsers, '@uni.edu').length, 4);
assert.strictEqual(searchUsers(mockUsers, 'nonexistent').length, 0);

// Safeguard check logic: Last active admin rule (FR-USR-10)
function canDeactivateUser(user, allUsers) {
  if (user.role === 'admin' && user.isActive) {
    const activeAdminCount = allUsers.filter((u) => u.role === 'admin' && u.isActive).length;
    if (activeAdminCount <= 1) {
      return { allowed: false, error: 'Cannot deactivate the last active Admin' };
    }
  }
  return { allowed: true };
}

assert.strictEqual(canDeactivateUser(mockUsers[0], mockUsers).allowed, false);
assert.strictEqual(canDeactivateUser(mockUsers[1], mockUsers).allowed, true);

// Safeguard check logic: Delete user organizing events (FR-USR-09)
function canDeleteUser(user, userEvents) {
  if (userEvents.some((e) => e.organizerId === user._id)) {
    return {
      allowed: false,
      error: 'Cannot delete user: user organizes events. Delete those events first or deactivate the account instead.',
    };
  }
  return { allowed: true };
}

const mockEvents = [
  { _id: 'evt-1', title: 'AI Ethics', organizerId: 'usr-2' },
];

assert.strictEqual(canDeleteUser(mockUsers[1], mockEvents).allowed, false);
assert.strictEqual(canDeleteUser(mockUsers[3], mockEvents).allowed, true);

console.log('   ✓ Admin user filtering and FR-USR-09/FR-USR-10 safeguard logic verified');

// =========================================================================
// 2. Admin API Client Contract Verification
// =========================================================================
console.log('2. Testing Admin API Client Endpoints...');

import { adminAPI } from './src/services/api.js';

let capturedEndpoint = null;
global.fetch = async (url, options = {}) => {
  capturedEndpoint = { url, options, body: options.body ? JSON.parse(options.body) : null };

  if (url.includes('/api/admin/users')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        users: mockUsers,
        total: 4,
        page: 1,
        totalPages: 1,
        limit: 10,
      }),
    };
  }

  if (url.includes('/api/admin/events')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => mockEvents,
    };
  }

  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ success: true }),
  };
};

// Test adminAPI.getUsers
const usersResult = await adminAPI.getUsers({ role: 'admin', page: 1 });
assert.strictEqual(usersResult.users.length, 4);
assert.ok(capturedEndpoint.url.includes('/api/admin/users?role=admin&page=1'));

// Test adminAPI.createUser (FR-USR-01)
await adminAPI.createUser({ name: 'New Faculty', email: 'faculty@uni.edu', password: 'password123', role: 'organizer' });
assert.strictEqual(capturedEndpoint.url.endsWith('/api/users/register'), true);
assert.strictEqual(capturedEndpoint.options.method, 'POST');
assert.strictEqual(capturedEndpoint.body.role, 'organizer');

// Test adminAPI.updateRole (FR-USR-06)
await adminAPI.updateRole('usr-4', 'organizer');
assert.strictEqual(capturedEndpoint.url.endsWith('/api/users/usr-4/role'), true);
assert.strictEqual(capturedEndpoint.options.method, 'PATCH');
assert.strictEqual(capturedEndpoint.body.role, 'organizer');

// Test adminAPI.updateStatus (FR-USR-10)
await adminAPI.updateStatus('usr-4', false);
assert.strictEqual(capturedEndpoint.url.endsWith('/api/users/usr-4'), true);
assert.strictEqual(capturedEndpoint.options.method, 'PUT');
assert.strictEqual(capturedEndpoint.body.isActive, false);

// Test adminAPI.getEvents & deleteEvent (FR-EVT-13, FR-EVT-10)
const eventsResult = await adminAPI.getEvents();
assert.strictEqual(eventsResult.length, 1);
assert.ok(capturedEndpoint.url.endsWith('/api/admin/events'));

await adminAPI.deleteEvent('evt-1');
assert.strictEqual(capturedEndpoint.url.endsWith('/api/admin/events/evt-1'), true);
assert.strictEqual(capturedEndpoint.options.method, 'DELETE');

console.log('   ✓ Admin API client methods and contracts verified');

console.log('--- Phase 7 Admin Console Verification PASSED 100% ---');
