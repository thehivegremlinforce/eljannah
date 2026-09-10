import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_IDS, CURATED_CHANNEL_IDS, OPERATION_IDS, freshFrontlineStore, transitionFrontline, parseFrontline } from '../frontline-state.js';

function act(store, action, detail) {
  const result = transitionFrontline(store, action, detail);
  assert.equal(result.error, null);
  return result.store;
}
function blocked(store, action, detail) {
  const before = structuredClone(store);
  const result = transitionFrontline(store, action, detail);
  assert.equal(typeof result.error, 'string');
  assert.equal(result.store, store);
  assert.deepEqual(store, before);
}
const restore = store => parseFrontline(JSON.stringify({ bankstown: store }), ['bankstown']).bankstown;
const event = text => ({ stage: 'workflows', name: 'Store OS', initials: 'OS', text, role: 'Approved app' });

test('a full connected-store shift demonstrates all ten capabilities', () => {
  let store = freshFrontlineStore();
  for (const [action, detail] of [
    ['verify-demo-access'], ['select-channel', { channel: 'store' }], ['clip-seen'], ['canvas-read'], ['list-read'],
    ['clock-in'], ['submit-issue', { category: 'Equipment', text: 'Packing printer needs a check.' }],
    ['join-huddle'], ['ask-agent', { question: 'Where is the packing guide?' }], ['check-external'], ['clock-out'],
  ]) store = act(store, action, detail);
  assert.deepEqual(store.completed, FEATURE_IDS);
  assert.equal(store.clockedIn, false);
  assert.equal(store.checkedOut, true);
  assert.deepEqual(store.issue, { category: 'Equipment', text: 'Packing printer needs a check.', owner: 'Sarah', status: 'open' });
  assert.deepEqual(restore(store), store);
});

test('identity and shift prerequisites cannot be bypassed', () => {
  const fresh = freshFrontlineStore();
  blocked(fresh, 'clock-in');
  blocked(fresh, 'clock-out');
  blocked(fresh, 'submit-issue', { category: 'Equipment', text: 'Printer check' });
  blocked(fresh, 'join-huddle');
  const verified = act(fresh, 'verify-demo-access', { employeeId: 'ignored', password: 'ignored' });
  assert.equal('employeeId' in verified, false);
  assert.equal('password' in verified, false);
  blocked(verified, 'clock-out');
  const clockedIn = act(verified, 'clock-in');
  blocked(clockedIn, 'clock-out');
  const checkedOut = act(act(clockedIn, 'check-external'), 'clock-out');
  blocked(checkedOut, 'clock-out');
  const nextShift = act(checkedOut, 'clock-in');
  assert.equal(nextShift.checkedOut, false);
  assert.equal(nextShift.completed.includes('governance'), false);
  assert.deepEqual(restore(nextShift), nextShift);
});

test('reading and asking for help remain available without sign-in', () => {
  let store = freshFrontlineStore();
  for (const action of ['clip-seen', 'canvas-read', 'list-read', 'check-external']) store = act(store, action);
  store = act(store, 'ask-agent', { question: 'Who is leading the shift?' });
  assert.equal(store.verified, false);
  assert.equal(store.completed.includes('governance'), false);
  assert.deepEqual(restore(store), store);
});

test('channel focus is limited to exactly ten known choices', () => {
  assert.equal(CURATED_CHANNEL_IDS.length, 10);
  assert.equal(new Set(CURATED_CHANNEL_IDS).size, 10);
  for (const channel of CURATED_CHANNEL_IDS) {
    const store = act(freshFrontlineStore(), 'select-channel', { channel });
    assert.equal(store.selectedChannel, channel);
    assert.deepEqual(store.completed, ['channels']);
  }
  for (const channel of ['external', 'store-bankstown', '', null, '__proto__']) blocked(freshFrontlineStore(), 'select-channel', { channel });
});

test('workflow and agent inputs are bounded and reject blank or non-text values', () => {
  const verified = act(freshFrontlineStore(), 'verify-demo-access');
  for (const text of ['', '  \n ', null, 4, 'x'.repeat(501)]) blocked(verified, 'submit-issue', { category: 'Equipment', text });
  for (const category of ['', ' ', null, {}, 'x'.repeat(81)]) blocked(verified, 'submit-issue', { category, text: 'Check printer' });
  assert.equal(act(verified, 'submit-issue', { category: ' Equipment ', text: ' Check printer ' }).issue.text, 'Check printer');
  assert.equal(act(verified, 'submit-issue', { category: 'Equipment', text: 'x'.repeat(500) }).issue.text.length, 500);
  for (const question of ['', ' \t ', undefined, {}, 'x'.repeat(241)]) blocked(verified, 'ask-agent', { question });
  assert.equal(act(verified, 'ask-agent', { question: 'x'.repeat(240) }).agentAsked, true);
});

test('actions preserve previous state and completion markers are idempotent', () => {
  const initial = freshFrontlineStore();
  const verified = act(initial, 'verify-demo-access');
  assert.deepEqual(initial, freshFrontlineStore());
  assert.notEqual(initial.completed, verified.completed);
  assert.notEqual(initial.events, verified.events);
  assert.notEqual(initial.operations, verified.operations);
  for (const action of ['verify-demo-access', 'clip-seen', 'canvas-read', 'list-read', 'check-external']) {
    const once = act(verified, action);
    assert.deepEqual(act(once, action), once);
  }
  blocked(initial, 'unknown');
  blocked(initial, 'select-channel', null);
});

test('events retain bounded plain text fields and the most recent 60 entries', () => {
  let store = freshFrontlineStore();
  const detail = { ...event('First'), extra: 'not persisted' };
  store = act(store, 'log-event', detail);
  detail.text = 'Changed by caller';
  assert.deepEqual(store.events[0], event('First'));
  for (let i = 0; i < 65; i++) store = act(store, 'log-event', event(`Update ${i}`));
  assert.equal(store.events.length, 60);
  assert.equal(store.events[0].text, 'Update 5');
  assert.equal(store.events.at(-1).text, 'Update 64');
  for (const invalid of [{}, { ...event('Valid'), text: 42 }, { ...event('Valid'), text: 'x'.repeat(1501) }, { ...event('Valid'), stage: '' }]) blocked(store, 'log-event', invalid);
  assert.deepEqual(restore(store), store);
});

test('operation updates validate known IDs and merge sparse changes without aliasing', () => {
  assert.equal(OPERATION_IDS.length, 10);
  let store = freshFrontlineStore();
  const changes = { status: 'assigned', owner: 'Sarah' };
  store = act(store, 'update-operation', { id: 'complaints', changes });
  changes.status = 'resolved';
  const assigned = structuredClone(store);
  const updated = act(store, 'update-operation', { id: 'complaints', changes: { elapsedHours: 24, draft: 'Check the packing handover.', checked: true } });
  assert.deepEqual(store, assigned);
  assert.deepEqual(updated.operations.complaints, { status: 'assigned', owner: 'Sarah', elapsedHours: 24, draft: 'Check the packing handover.', checked: true });
  assert.deepEqual(updated.completed, []);
  assert.deepEqual(restore(updated), updated);
  for (const id of OPERATION_IDS) assert.equal(act(store, 'update-operation', { id, changes: { status: 'resolved' } }).operations[id].status, 'resolved');
  for (const status of ['assigned', 'resolved', 'escalated', 'draft', 'approved']) assert.equal(act(store, 'update-operation', { id: 'review', changes: { status } }).operations.review.status, status);
});

test('invalid operation changes are rejected atomically', () => {
  const store = act(freshFrontlineStore(), 'update-operation', { id: 'delivery', changes: { status: 'assigned' } });
  for (const changes of [null, {}, [], { unknown: true }, { status: 'closed' }, { owner: 'Amina' }, { elapsedHours: -1 }, { elapsedHours: 73 }, { elapsedHours: Infinity }, { elapsedHours: '24' }, { draft: 'x'.repeat(1501) }, { checked: 'yes' }, { status: 'resolved', elapsedHours: -1 }]) blocked(store, 'update-operation', { id: 'delivery', changes });
  for (const id of ['missing', '__proto__', null]) blocked(store, 'update-operation', { id, changes: { status: 'resolved' } });
});

test('restoration drops unknown stores and invalid fields while preserving independent valid progress', () => {
  const raw = {
    bankstown: { ...freshFrontlineStore(), verified: true, completed: ['access', 'access', 'unknown'], secret: 'not part of state', operations: { delivery: { status: 'assigned', owner: 'Sarah', elapsedHours: 999, draft: 'Useful note', extra: 'unknown' }, missing: { status: 'resolved' } }, events: [event('Valid'), { text: 'Incomplete' }] },
    granville: { ...freshFrontlineStore(), clipSeen: true, completed: ['clips'] },
    unknown: { verified: true },
  };
  const restored = parseFrontline(JSON.stringify(raw), ['bankstown', 'granville']);
  assert.deepEqual(Object.keys(restored), ['bankstown', 'granville']);
  assert.deepEqual(restored.bankstown.completed, ['access']);
  assert.equal('secret' in restored.bankstown, false);
  assert.deepEqual(restored.bankstown.operations, { delivery: { status: 'assigned', owner: 'Sarah', draft: 'Useful note' } });
  assert.deepEqual(restored.bankstown.events, [event('Valid')]);
  assert.deepEqual(restored.granville.completed, ['clips']);
  restored.bankstown.completed.push('canvas');
  assert.deepEqual(restored.granville.completed, ['clips']);
  assert.deepEqual(raw.bankstown.completed, ['access', 'access', 'unknown']);
});

test('restoration removes impossible completion and shift states', () => {
  const impossible = { ...freshFrontlineStore(), completed: FEATURE_IDS, verified: false, clockedIn: true, checkedOut: true, selectedChannel: 'external', huddleJoined: true, issue: { category: 'Equipment', text: 'Check printer', owner: 'Sarah', status: 'open' } };
  const store = restore(impossible);
  assert.deepEqual(store.completed, ['canvas', 'lists']);
  assert.equal(store.clockedIn, false);
  assert.equal(store.checkedOut, false);
  assert.equal(store.issue, null);
  assert.equal(store.huddleJoined, false);
  const doubleShift = restore({ ...impossible, verified: true, externalBlocked: true });
  assert.equal(doubleShift.clockedIn, true);
  assert.equal(doubleShift.checkedOut, false);
  assert.equal(doubleShift.completed.includes('governance'), false);
});

test('missing or corrupt saved data restores fresh known stores', () => {
  for (const raw of [undefined, null, '', '{', 'null', 'false', '[]', '42']) {
    assert.deepEqual(parseFrontline(raw, ['bankstown', 'granville']), { bankstown: freshFrontlineStore(), granville: freshFrontlineStore() });
  }
  const polluted = parseFrontline('{"__proto__":{"verified":true}}', ['bankstown', '__proto__']);
  assert.deepEqual(polluted, { bankstown: freshFrontlineStore() });
  assert.equal({}.verified, undefined);
});
