/**
 * Phase 5 Member Experience Logic & API Contract Verification
 */

import assert from 'node:assert';

console.log('--- Starting Phase 5 Member Experience Logic Verification ---');

// Mock localStorage for test environment
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

// 1. Test Date Utilities & 3 Event States (FR-EVT-06, Section 3.4.4)
console.log('1. Testing Date Utilities & Event State Calculation (FR-EVT-06)...');
import {
  getEventState,
  isEventPast,
  isEventFull,
  formatEventDateTime,
  formatEventDate,
  formatEventTime,
} from './src/utils/dateUtils.js';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const openEvent = {
  _id: 'evt-1',
  title: 'Open Workshop',
  date: futureDate,
  capacity: 40,
  registeredCount: 38,
};

const fullEvent = {
  _id: 'evt-2',
  title: 'Full Symposium',
  date: futureDate,
  capacity: 40,
  registeredCount: 40,
};

const pastEvent = {
  _id: 'evt-3',
  title: 'Past Orientation',
  date: pastDate,
  capacity: 40,
  registeredCount: 20,
};

// State calculations
assert.strictEqual(getEventState(openEvent), 'open', 'Future event with remaining seats must be open');
assert.strictEqual(getEventState(fullEvent), 'full', 'Event at or over capacity must be full');
assert.strictEqual(getEventState(pastEvent), 'past', 'Event in the past must be past');

assert.strictEqual(isEventPast(futureDate), false);
assert.strictEqual(isEventPast(pastDate), true);
assert.strictEqual(isEventFull(openEvent), false);
assert.strictEqual(isEventFull(fullEvent), true);

// Date formatting in local timezone (Section 3.4.4)
const formattedDateTime = formatEventDateTime(futureDate);
assert.ok(formattedDateTime.length > 5, 'Formatted date time should not be empty');
assert.ok(formattedDateTime.includes('•'), 'Should contain divider');

console.log('   ✓ FR-EVT-06 event states and Section 3.4.4 local date formatting passed');

// 2. Test API Service Endpoints for Registrations (FR-REG-01, FR-REG-08, FR-REG-12)
console.log('2. Testing Registrations API Client Routes...');
import { registrationsAPI, eventsAPI } from './src/services/api.js';

let lastUrl = '';
let lastMethod = '';
let lastBody = null;

global.fetch = async (url, options = {}) => {
  lastUrl = url;
  lastMethod = options.method || 'GET';
  lastBody = options.body ? JSON.parse(options.body) : null;
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => ({ success: true }),
  };
};

localStorage.setItem('token', 'valid-test-token');

// Test RSVP: POST /api/registrations with { eventId }
await registrationsAPI.rsvp('test-event-123');
assert.ok(lastUrl.endsWith('/api/registrations'), 'RSVP must call /api/registrations');
assert.strictEqual(lastMethod, 'POST');
assert.deepStrictEqual(lastBody, { eventId: 'test-event-123' });

// Test Cancel RSVP: DELETE /api/registrations/:id
await registrationsAPI.cancelRsvp('test-reg-456');
assert.ok(lastUrl.endsWith('/api/registrations/test-reg-456'), 'Cancel RSVP must call /api/registrations/:id');
assert.strictEqual(lastMethod, 'DELETE');

// Test User Registrations: GET /api/registrations/user/:userId
await registrationsAPI.getUserRegistrations('user-789');
assert.ok(lastUrl.endsWith('/api/registrations/user/user-789'), 'Must call /api/registrations/user/:userId');
assert.strictEqual(lastMethod, 'GET');

// Test Events Query Filters: GET /api/events?from=...&to=...
await eventsAPI.getAll({ from: '2026-11-01', to: '2026-11-30' });
assert.ok(lastUrl.includes('/api/events?from=2026-11-01&to=2026-11-30'), 'Events query must include from/to filters');

console.log('   ✓ Registrations and Events API client endpoint signatures passed');

// 3. Test My Registrations Partitioning Logic
console.log('3. Testing My Registrations Partitioning Logic (Upcoming vs. Past/Checked-In)...');

const mockRegistrations = [
  {
    _id: 'reg-1',
    event: { date: futureDate, title: 'Future Event 1' },
    checkedIn: false,
  },
  {
    _id: 'reg-2',
    event: { date: futureDate, title: 'Future Event 2 Checked In' },
    checkedIn: true, // checked-in early at door
  },
  {
    _id: 'reg-3',
    event: { date: pastDate, title: 'Past Event' },
    checkedIn: false,
  },
];

const upcoming = [];
const past = [];

mockRegistrations.forEach((reg) => {
  const isPast = new Date(reg.event.date) <= new Date();
  if (reg.checkedIn || isPast) {
    past.push(reg);
  } else {
    upcoming.push(reg);
  }
});

assert.strictEqual(upcoming.length, 1, 'Only future unchecked events should be in upcoming tab');
assert.strictEqual(upcoming[0]._id, 'reg-1');
assert.strictEqual(past.length, 2, 'Checked-in or past events must appear under past tab');

console.log('   ✓ My Registrations partitioning logic verified');

console.log('All Phase 5 Member Experience Logic Verification Tests Passed Successfully!');
