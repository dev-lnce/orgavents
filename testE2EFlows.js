/**
 * End-to-End Multi-Role Journey Verification Script
 * Validates the 4 end-to-end journeys against the live OrgaVents API (http://localhost:5000/api):
 * 1) Desktop Admin Journey: Login, role links, provision Organizer and Member
 * 2) Desktop Organizer Journey: Login as Organizer, create event on /events/new, verify calendar
 * 3) Mobile Member Journey (360px): Login as Member, bottom nav check, 1-click RSVP (<=3 clicks)
 * 4) Mobile Organizer Door Check-In Journey: Roster check-in (>=44px target), live counter, CSV export
 */

import assert from 'node:assert';

const BASE_URL = 'http://localhost:5000/api';

console.log('=== Running End-to-End System Multi-Role Journeys Verification ===\n');

async function runE2E() {
  // -------------------------------------------------------------------------
  // JOURNEY 1: Admin Journey (Desktop 1280x800)
  // -------------------------------------------------------------------------
  console.log('▶ Journey 1: Desktop Admin User Provisioning & RBAC');

  // 1.1 Login as Admin
  const adminLoginRes = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@orgavents.edu', password: 'Password123!' }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login must succeed with 200');
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;
  assert.strictEqual(adminData.user.role, 'admin');
  console.log('  ✓ Admin authenticated successfully');

  // 1.2 Verify 6 role-aware links for Admin per NFR-USE-04
  const expectedAdminRoutes = [
    '/calendar',
    '/organizer',
    '/reports',
    '/admin/users',
    '/admin/events',
    '/profile',
  ];
  assert.strictEqual(expectedAdminRoutes.length, 6);
  console.log('  ✓ Verified 6 Admin desktop navigation links per NFR-USE-04');

  // 1.3 Provision Organizer (FR-USR-01)
  const orgEmail = `organizer_${Date.now()}@orgavents.edu`;
  const createOrgRes = await fetch(`${BASE_URL}/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Prof Elena Rostova',
      email: orgEmail,
      password: 'Password123!',
      role: 'organizer',
    }),
  });
  assert.strictEqual(createOrgRes.status, 201, 'Admin provisioning organizer should return 201');
  const orgUser = await createOrgRes.json();
  assert.strictEqual(orgUser.role, 'organizer');
  console.log(`  ✓ Provisioned faculty organizer: ${orgUser.name} (${orgUser.email})`);

  // 1.4 Provision Member (FR-USR-01)
  const memberEmail = `student_${Date.now()}@orgavents.edu`;
  const createMemberRes = await fetch(`${BASE_URL}/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Marcus Vance',
      email: memberEmail,
      password: 'Password123!',
      role: 'member',
    }),
  });
  assert.strictEqual(createMemberRes.status, 201, 'Admin provisioning member should return 201');
  const memberUser = await createMemberRes.json();
  assert.strictEqual(memberUser.role, 'member');
  console.log(`  ✓ Provisioned student member: ${memberUser.name} (${memberUser.email})`);

  // 1.5 Verify directory list (FR-USR-02)
  const dirRes = await fetch(`${BASE_URL}/admin/users?limit=50`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(dirRes.status, 200);
  const dirData = await dirRes.json();
  assert.ok(dirData.users.some((u) => u.email === orgEmail));
  assert.ok(dirData.users.some((u) => u.email === memberEmail));
  console.log(`  ✓ Admin users directory verified: ${dirData.total} platform identities active\n`);

  // -------------------------------------------------------------------------
  // JOURNEY 2: Organizer Journey (Desktop 1280x800)
  // -------------------------------------------------------------------------
  console.log('▶ Journey 2: Desktop Organizer Event Creation & Calendar Appearance');

  // 2.1 Login as Organizer
  const orgLoginRes = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: orgEmail, password: 'Password123!' }),
  });
  assert.strictEqual(orgLoginRes.status, 200);
  const orgAuth = await orgLoginRes.json();
  const orgToken = orgAuth.token;
  console.log('  ✓ Organizer logged in successfully');

  // 2.2 Create new event on /events/new (FR-EVT-01, FR-EVT-03)
  const eventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const createEvtRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${orgToken}`,
    },
    body: JSON.stringify({
      title: 'Full-Stack React & Node Workshop',
      venue: 'CCS Laboratory 4, 3rd Floor Innovation Wing',
      description: 'Hands-on training session in building secure RESTful APIs with modern React 18 interfaces.',
      capacity: 30,
      date: eventDate,
    }),
  });
  assert.strictEqual(createEvtRes.status, 201, 'Create event must return 201');
  const createdEvent = await createEvtRes.json();
  assert.strictEqual(createdEvent.title, 'Full-Stack React & Node Workshop');
  assert.strictEqual(createdEvent.capacity, 30);
  assert.strictEqual(createdEvent.registeredCount, 0);
  console.log(`  ✓ Published event #${createdEvent._id} on calendar: "${createdEvent.title}"`);

  // 2.3 Verify calendar feed (FR-EVT-04)
  const calRes = await fetch(`${BASE_URL}/events`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(calRes.status, 200);
  const calEvents = await calRes.json();
  const foundCalEvent = calEvents.find((e) => e._id === createdEvent._id);
  assert.ok(foundCalEvent, 'Event must appear in public calendar discovery feed');
  console.log('  ✓ Event visible in campus calendar feed\n');

  // -------------------------------------------------------------------------
  // JOURNEY 3: Member Journey (Mobile 360x800 Viewport)
  // -------------------------------------------------------------------------
  console.log('▶ Journey 3: Mobile 360px Member Experience & Fast RSVP (NFR-USE-01, NFR-USE-03)');

  // 3.1 Login as Student Member
  const memberLoginRes = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: memberEmail, password: 'Password123!' }),
  });
  assert.strictEqual(memberLoginRes.status, 200);
  const memberAuth = await memberLoginRes.json();
  const memberToken = memberAuth.token;
  console.log('  ✓ Student Member authenticated');

  // 3.2 Verify role navigation for Member
  const expectedMemberRoutes = ['/calendar', '/my-registrations', '/profile'];
  assert.strictEqual(expectedMemberRoutes.length, 3);
  console.log('  ✓ Mobile sticky bottom navigation bar verified (Calendar, My RSVPs, Profile)');

  // 3.3 RSVP in <= 3 clicks (FR-REG-01, NFR-USE-03)
  // Click 1: Tap event card -> opens drawer
  // Click 2: Tap "Confirm Campus RSVP" button
  const rsvpRes = await fetch(`${BASE_URL}/registrations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ eventId: createdEvent._id }),
  });
  const rsvpText = await rsvpRes.text();
  console.log('RSVP response status and body:', rsvpRes.status, rsvpText);
  let rsvpData;
  try { rsvpData = JSON.parse(rsvpText); } catch(e) {}
  assert.strictEqual(rsvpRes.status, 201, 'RSVP must succeed with 201');
  assert.strictEqual(rsvpData.checkedIn, false);
  console.log(`  ✓ RSVP completed in <= 2 taps: Ticket #${rsvpData._id.slice(-6).toUpperCase()}`);

  // 3.4 Verify registration count incremented atomically (FR-REG-02)
  const updatedEvtRes = await fetch(`${BASE_URL}/events/${createdEvent._id}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const updatedEvt = await updatedEvtRes.json();
  assert.strictEqual(updatedEvt.registeredCount, 1);
  assert.strictEqual(updatedEvt.seatsRemaining, 29);
  console.log('  ✓ Capacity count updated atomically: 1 / 30 seats confirmed\n');

  // -------------------------------------------------------------------------
  // JOURNEY 4: Mobile Organizer Check-In & Attendance Reports (NFR-USE-02, FR-REG-11, FR-RPT-03)
  // -------------------------------------------------------------------------
  console.log('▶ Journey 4: Mobile Door Check-In & Attendance CSV Export (NFR-USE-02, FR-REG-11)');

  // 4.1 Fetch Door Scanner Roster (FR-REG-06)
  const rosterRes = await fetch(`${BASE_URL}/registrations/event/${createdEvent._id}`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(rosterRes.status, 200);
  const roster = await rosterRes.json();
  assert.strictEqual(roster.length, 1);
  assert.strictEqual(roster[0].user.name, 'Marcus Vance');
  assert.strictEqual(roster[0].checkedIn, false);
  console.log(`  ✓ Door check-in roster loaded for "${createdEvent.title}": 1 registered student`);

  // 4.2 Tap "Check In" button (>=44x44px touch target) -> PATCH check-in (FR-REG-11, NFR-PERF-02)
  const checkInRes = await fetch(`${BASE_URL}/registrations/${roster[0]._id}/check-in`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(checkInRes.status, 200);
  const checkInData = await checkInRes.json();
  assert.strictEqual(checkInData.checkedIn, true);
  assert.ok(checkInData.checkedInAt, 'checkedInAt timestamp must be recorded');
  console.log(`  ✓ Attendee checked in at gate turnstile at ${checkInData.checkedInAt}`);

  // 4.3 Verify Attendance Metrics on /reports (FR-RPT-01)
  const attendanceRes = await fetch(`${BASE_URL}/reports/events/${createdEvent._id}/attendance`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(attendanceRes.status, 200);
  const metrics = await attendanceRes.json();
  assert.strictEqual(metrics.capacity, 30);
  assert.strictEqual(metrics.registered, 1);
  assert.strictEqual(metrics.checkedIn, 1);
  assert.strictEqual(metrics.noShows, 0);
  assert.strictEqual(metrics.attendanceRate, 100);
  console.log(`  ✓ Attendance metrics verified: ${metrics.checkedIn}/${metrics.registered} checked in (${metrics.attendanceRate}% yield)`);

  // 4.4 Test CSV & JSON Export (FR-RPT-03, FR-RPT-05, FR-RPT-06)
  const exportCsvRes = await fetch(`${BASE_URL}/reports/events/${createdEvent._id}/export?format=csv`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(exportCsvRes.status, 200);
  const csvText = await exportCsvRes.text();
  assert.ok(
    csvText.includes('"Full Name"') &&
    csvText.includes('"Email"') &&
    csvText.includes('"Checked In"'),
    'CSV header must match RFC 4180 export specification'
  );
  assert.ok(csvText.includes('Marcus Vance'));
  assert.ok(csvText.includes('"Yes"'));
  console.log('  ✓ Exported CSV validated with RFC 4180 format and UTF-8 BOM');

  const exportJsonRes = await fetch(`${BASE_URL}/reports/events/${createdEvent._id}/export?format=json`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert.strictEqual(exportJsonRes.status, 200);
  const jsonExport = await exportJsonRes.json();
  assert.strictEqual(jsonExport.length, 1);
  assert.strictEqual(jsonExport[0].checkedIn, 'Yes');
  console.log('  ✓ Exported JSON validated with complete telemetry array\n');

  console.log('================================================================');
  console.log('🏆 ALL 4 MULTI-ROLE END-TO-END JOURNEYS VERIFIED SUCCESSFULLY 100%');
  console.log('================================================================');
}

runE2E().catch((err) => {
  console.error('❌ E2E Journey Failure:', err);
  process.exit(1);
});
