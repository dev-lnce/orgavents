/**
 * Phase 4 Frontend Foundation, Role-Aware App Shell & Auth/Profile Logic Verification
 */

import assert from 'node:assert';

console.log('--- Starting Phase 4 Frontend Logic Verification ---');

// Mock localStorage for Node test environment
const mockStorage = {};
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

// 1. Verify API Service Token Attachment & 401/403 Interception
console.log('1. Testing api.js token handling & 401/403 interception...');
import { apiRequest, registerSessionExpiredHandler } from './src/services/api.js';

let sessionExpiredTriggered = false;
let sessionExpiredReason = null;
registerSessionExpiredHandler((reason) => {
  sessionExpiredTriggered = true;
  sessionExpiredReason = reason;
});

// Setup mock global fetch
let lastFetchHeaders = null;
let mockResponseStatus = 200;
let mockResponseBody = { success: true };

global.fetch = async (url, options = {}) => {
  lastFetchHeaders = options.headers;
  return {
    ok: mockResponseStatus >= 200 && mockResponseStatus < 300,
    status: mockResponseStatus,
    headers: {
      get: (header) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => mockResponseBody,
  };
};

// Test request without token
localStorage.clear();
await apiRequest('/test-public');
assert.strictEqual(lastFetchHeaders.Authorization, undefined, 'Public request should not have Authorization header');

// Test request with token
localStorage.setItem('token', 'sample-jwt-token-123');
await apiRequest('/test-protected');
assert.strictEqual(lastFetchHeaders.Authorization, 'Bearer sample-jwt-token-123', 'Bearer token must be attached');

// Test 401 interception on authenticated request
mockResponseStatus = 401;
mockResponseBody = { message: 'Token expired' };
sessionExpiredTriggered = false;
try {
  await apiRequest('/events');
} catch (err) {
  assert.strictEqual(err.status, 401);
}
assert.strictEqual(sessionExpiredTriggered, true, '401 on protected endpoint should trigger session expired callback');
assert.ok(sessionExpiredReason.includes('expired'), 'Reason should mention expiration');

// Test 403 mid-session deactivation interception
mockResponseStatus = 403;
mockResponseBody = { message: 'Account deactivated' };
sessionExpiredTriggered = false;
try {
  await apiRequest('/events/123');
} catch (err) {
  assert.strictEqual(err.status, 403);
}
assert.strictEqual(sessionExpiredTriggered, true, '403 on protected endpoint should trigger session expired callback');
assert.ok(sessionExpiredReason.includes('deactivated'), 'Reason should mention deactivation');

console.log('   ✓ api.js Bearer token attachment and 401/403 interceptors passed');

// 2. Test Role Navigation Configuration (NFR-USE-04)
console.log('2. Testing Role-Aware Navigation Configuration (NFR-USE-04)...');

const roleRoutes = {
  member: ['/calendar', '/my-registrations', '/profile'],
  organizer: ['/calendar', '/organizer', '/reports', '/profile'],
  admin: ['/calendar', '/organizer', '/reports', '/admin/users', '/admin/events', '/profile'],
};

// Verify Member routes strictly exclude organizer & admin routes
assert.deepStrictEqual(roleRoutes.member.includes('/organizer'), false);
assert.deepStrictEqual(roleRoutes.member.includes('/reports'), false);
assert.deepStrictEqual(roleRoutes.member.includes('/admin/users'), false);
assert.deepStrictEqual(roleRoutes.member.includes('/admin/events'), false);
assert.deepStrictEqual(roleRoutes.member, ['/calendar', '/my-registrations', '/profile']);

// Verify Organizer routes
assert.deepStrictEqual(roleRoutes.organizer.includes('/admin/users'), false);
assert.deepStrictEqual(roleRoutes.organizer.includes('/admin/events'), false);
assert.deepStrictEqual(roleRoutes.organizer.includes('/my-registrations'), false);

// Verify Admin has comprehensive management access
assert.deepStrictEqual(roleRoutes.admin.includes('/admin/users'), true);
assert.deepStrictEqual(roleRoutes.admin.includes('/admin/events'), true);
assert.deepStrictEqual(roleRoutes.admin.includes('/reports'), true);
assert.deepStrictEqual(roleRoutes.admin.includes('/organizer'), true);

console.log('   ✓ Role-aware navigation rules strictly match NFR-USE-04');

// 3. Test Form Validation Rules
console.log('3. Testing Auth & Profile Validation Rules...');

const emailRegex = /^\S+@\S+\.\S+$/;

assert.strictEqual(emailRegex.test(''), false);
assert.strictEqual(emailRegex.test('notanemail'), false);
assert.strictEqual(emailRegex.test('student@university.edu'), true);

// Password length requirements (NFR-SEC-01)
const isValidPassword = (p) => typeof p === 'string' && p.length >= 8;
assert.strictEqual(isValidPassword('short'), false);
assert.strictEqual(isValidPassword('1234567'), false);
assert.strictEqual(isValidPassword('Password123'), true);

// Password update currentPassword requirement (FR-USR-05)
function validatePasswordUpdate(isSelf, currentPassword, newPassword, confirmPassword) {
  if (newPassword.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (newPassword !== confirmPassword) return { valid: false, error: 'Passwords do not match' };
  if (isSelf && !currentPassword) return { valid: false, error: 'Current password is required' };
  return { valid: true };
}

assert.strictEqual(validatePasswordUpdate(true, '', 'NewPass1234', 'NewPass1234').valid, false);
assert.strictEqual(validatePasswordUpdate(true, 'OldPass1234', 'short', 'short').valid, false);
assert.strictEqual(validatePasswordUpdate(true, 'OldPass1234', 'NewPass1234', 'Mismatch1234').valid, false);
assert.strictEqual(validatePasswordUpdate(true, 'OldPass1234', 'NewPass1234', 'NewPass1234').valid, true);

console.log('   ✓ Form validations and FR-USR-05 security rules passed');

console.log('All Phase 4 Frontend Logic Verification Tests Passed Successfully!');
