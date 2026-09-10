import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, checkLabels, freshState, freshStore, getStore, parseState } from '../workflow.js';

const storeIds = ['bankstown', 'granville', 'preston'];
const stageIds = ['opening', 'delivery', 'prep', 'rush', 'issue', 'handover', 'closing'];
const restore = value => parseState(JSON.stringify(value), storeIds, stageIds);
const saved = stores => ({ ...freshState(), stores });

function act(store, action, detail) {
  const result = applyAction(store, action, detail);
  assert.equal(result.error, null);
  return result.store;
}

function completeChecks(store = freshStore()) {
  return checkLabels.reduce((current, _, index) => act(current, 'check', { index }), store);
}

test('opening remains blocked until every opening check is complete', () => {
  let store = freshStore();
  for (let index = 0; index < checkLabels.length; index++) {
    const blocked = applyAction(store, 'opening-ready');
    assert.ok(blocked.error);
    assert.equal(blocked.store, store);
    assert.equal(store.actions.includes('opening-ready'), false);
    store = act(store, 'check', { index });
  }
  const ready = act(store, 'opening-ready');
  assert.equal(ready.actions.includes('opening-ready'), true);
  assert.equal(store.actions.includes('opening-ready'), false, 'actions must not mutate the previous state');
});

test('reopening a check invalidates opening completion until it is confirmed again', () => {
  const ready = act(completeChecks(), 'opening-ready');
  const reopened = act(ready, 'check', { index: 2 });
  assert.equal(reopened.checks.includes(2), false);
  assert.equal(reopened.actions.includes('opening-ready'), false);
  assert.ok(applyAction(reopened, 'opening-ready').error);
  const rechecked = act(reopened, 'check', { index: 2 });
  assert.equal(rechecked.actions.includes('opening-ready'), false);
  assert.equal(act(rechecked, 'opening-ready').actions.includes('opening-ready'), true);
  assert.equal(ready.checks.length, checkLabels.length);
});

test('invalid check indexes do not change the store', () => {
  const store = completeChecks();
  for (const index of [-1, checkLabels.length, 1.5, '1', null, undefined]) {
    const result = applyAction(store, 'check', { index });
    assert.ok(result.error);
    assert.equal(result.store, store);
  }
});

test('an issue needs an owner before it can be resolved', () => {
  const initial = freshStore();
  const blocked = applyAction(initial, 'resolve-issue');
  assert.ok(blocked.error);
  assert.equal(blocked.store.resolved, false);
  assert.equal(blocked.store.actions.includes('resolve-issue'), false);
  const assigned = act(initial, 'assign-issue');
  assert.equal(assigned.owner, 'Sarah');
  assert.equal(assigned.resolved, false);
  const resolved = act(assigned, 'resolve-issue');
  assert.equal(resolved.resolved, true);
  assert.equal(initial.owner, null);
});

test('store progress and messages remain separate when switching stores', () => {
  const state = freshState();
  state.stores.bankstown = act(getStore(state), 'request-cover');
  state.stores.bankstown = act(getStore(state), 'note', { text: 'Cover confirmed', stage: 'rush', time: '12:10' });
  state.store = 'preston';
  const preston = getStore(state);
  assert.equal(preston.cover, false);
  assert.deepEqual(preston.notes, []);
  state.stores.preston = act(preston, 'assign-issue');
  state.store = 'bankstown';
  assert.equal(getStore(state).cover, true);
  assert.equal(getStore(state).owner, null);
  assert.equal(getStore(state).notes[0].text, 'Cover confirmed');
  assert.equal(state.stores.preston.owner, 'Sarah');
  assert.deepEqual(state.stores.preston.notes, []);
  assert.notEqual(state.stores.bankstown.actions, state.stores.preston.actions);
});

test('repeating completed actions is idempotent', () => {
  let store = completeChecks();
  for (const action of ['opening-ready', 'assign-issue', 'resolve-issue', 'request-cover', 'create-recap']) {
    store = act(store, action);
    assert.deepEqual(act(store, action), store);
    assert.equal(store.actions.filter(value => value === action).length, 1);
  }
});

test('messages reject blank text and limit message length', () => {
  const initial = freshStore();
  for (const text of ['', '  \n\t ', undefined]) {
    const result = applyAction(initial, 'note', { text });
    assert.ok(result.error);
    assert.equal(result.store, initial);
  }
  const short = act(initial, 'note', { text: '  Ready for lunch  ', stage: 'rush', time: '12:05' });
  assert.deepEqual(short.notes, [{ text: 'Ready for lunch', stage: 'rush', time: '12:05', author: 'omar' }]);
  const long = act(short, 'note', { text: 'x'.repeat(1200) });
  assert.equal(long.notes[1].text.length, 1000);
  assert.deepEqual(initial.notes, []);
});

test('message history retains the latest 30 messages', () => {
  let store = freshStore();
  for (let index = 0; index < 35; index++) store = act(store, 'note', { text: `Message ${index}` });
  assert.equal(store.notes.length, 30);
  assert.equal(store.notes[0].text, 'Message 5');
  assert.equal(store.notes.at(-1).text, 'Message 34');
});

test('messages keep their assigned Slack channel across reloads', () => {
  let store=act(freshStore(),'note',{text:'The store is ready',stage:'opening',channel:'store'});
  store=act(store,'note',{text:'Briefing watched',stage:'opening',channel:'training',author:'omar'});
  const restored=getStore(restore(saved({bankstown:store})));
  assert.deepEqual(restored.notes,store.notes);
  assert.equal(restored.notes[0].channel,undefined,'Legacy and store messages retain the original shape');
  assert.equal(restored.notes[1].channel,'training');
  for(const channel of ['unknown','__proto__',null,42]){
    assert.equal(act(freshStore(),'note',{text:'Shift update',channel}).notes[0].channel,undefined);
    assert.equal(getStore(restore(saved({bankstown:{...freshStore(),notes:[{text:'Old note',stage:'opening',channel}]}}))).notes[0].channel,undefined);
  }
});

test('messages retain their original authors when another persona restores the store', () => {
  const initial = freshStore();
  const crewNote = { text: 'Packing station ready', stage: 'rush', time: '12:05', author: 'omar' };
  const managerNote = { text: 'Cover is confirmed', stage: 'rush', time: '12:10', author: 'sarah' };
  const crewStore = act(initial, 'note', crewNote);
  const mixedStore = act(crewStore, 'note', managerNote);
  assert.deepEqual(initial.notes, []);
  assert.deepEqual(crewStore.notes, [crewNote]);
  assert.deepEqual(mixedStore.notes, [crewNote, managerNote]);
  for (const role of ['crew', 'manager']) {
    const restored = restore({ ...saved({ bankstown: mixedStore }), role });
    assert.equal(restored.role, role);
    assert.deepEqual(getStore(restored).notes, [crewNote, managerNote], 'viewing as another persona must not relabel saved messages');
  }
});

test('legacy notes and unsupported author values safely default to Omar', () => {
  const legacy = { text: 'A saved shift update', stage: 'rush', time: '12:15' };
  const invalidAuthors = [undefined, null, '', 'manager', 'Sarah', 'layla', '__proto__', 42, ['sarah'], { id: 'sarah' }];
  const restored = restore({ ...saved({ bankstown: { ...freshStore(), notes: [legacy, ...invalidAuthors.map(author => ({ ...legacy, author }))] } }), role: 'manager' });
  assert.equal(getStore(restored).notes.length, invalidAuthors.length + 1);
  for (const note of getStore(restored).notes) assert.deepEqual(note, { ...legacy, author: 'omar' });
  for (const author of invalidAuthors) {
    assert.deepEqual(act(freshStore(), 'note', { ...legacy, author }).notes, [{ ...legacy, author: 'omar' }]);
  }
});

test('missing, corrupt or incompatible stored data falls back to a fresh state', () => {
  for (const raw of [undefined, null, '', '{', 'null', '[]', 'false', '{"version":99}', JSON.stringify({ ...freshState(), store: 'missing' }), JSON.stringify({ ...freshState(), stage: 'missing' })]) {
    assert.deepEqual(parseState(raw, storeIds, stageIds), freshState());
  }
});

test('restored checks, actions and notes are bounded and sanitised', () => {
  const notes = [null, { text: 42 }, ...Array.from({ length: 35 }, (_, index) => ({ text: `Note ${index}`, stage: 'opening', time: '09:00' })), { text: 'x'.repeat(1400), stage: 'missing', time: 't'.repeat(60) }];
  const restored = restore({ ...saved({ bankstown: { actions: ['request-cover', 'request-cover', null, 3, 'x'.repeat(80)], checks: [0, 0, 1, 3, -1, 4, 2.5, '2', null], notes, owner: 'unrecognised', resolved: true, cover: 'yes', recap: true }, missing: freshStore() }), role: 'unrecognised' });
  const store = getStore(restored);
  assert.deepEqual(store.checks, [0, 1, 3]);
  assert.deepEqual(store.actions, ['request-cover']);
  assert.equal(store.notes.length, 30);
  assert.equal(store.notes[0].text, 'Note 6');
  assert.equal(store.notes.at(-1).text.length, 1000);
  assert.equal(store.notes.at(-1).stage, 'rush');
  assert.equal(store.notes.at(-1).time.length, 30);
  assert.equal(store.owner, null);
  assert.equal(store.resolved, false);
  assert.equal(store.cover, false);
  assert.equal(store.recap, true);
  assert.equal(restored.role, 'manager');
  assert.equal('missing' in restored.stores, false);
});

test('restoring incomplete checks cannot retain an opening completion marker', () => {
  const restored = restore(saved({ bankstown: { ...freshStore(), checks: [0, 0, 1, 99], actions: ['opening-ready'] } }));
  const store = getStore(restored);
  assert.equal(store.actions.includes('opening-ready'), false);
  assert.ok(applyAction(store, 'opening-ready').error);
});

test('restoring an issue without a valid owner cannot retain a resolution marker', () => {
  const restored = restore(saved({ bankstown: { ...freshStore(), owner: 'missing', resolved: true, actions: ['resolve-issue'] } }));
  const store = getStore(restored);
  assert.equal(store.resolved, false);
  assert.equal(store.actions.includes('resolve-issue'), false);
});

test('valid completed store state survives storage and reload', () => {
  let store = act(completeChecks(), 'opening-ready');
  for (const action of ['assign-issue', 'resolve-issue', 'request-cover', 'create-recap']) store = act(store, action);
  store = act(store, 'note', { text: 'Team ready', stage: 'rush', time: '12:00' });
  const state = { ...saved({ bankstown: store, preston: freshStore() }), role: 'crew' };
  assert.deepEqual(restore(state), state);
});


test('a posted recap keeps its original outcomes when later shift actions change', () => {
  const original = act(completeChecks(), 'opening-complete');
  const outcomes = ['opening'];
  const posted = act(original, 'create-recap', { outcomes });
  outcomes.push('rush');
  assert.deepEqual(posted.recapSnapshot, ['opening'], 'the posted recap must not share the caller’s array');
  assert.equal(original.recapSnapshot, null);

  let later = act(posted, 'assign-issue');
  later = act(later, 'resolve-issue');
  later = act(later, 'rush-run-playbook');
  later = act(later, 'check', { index: 0 });
  assert.equal(later.actions.includes('opening-complete'), false);
  assert.equal(later.actions.includes('rush-run-playbook'), true);
  assert.deepEqual(later.recapSnapshot, ['opening'], 'later completion and reopened checks must not rewrite history');
  assert.deepEqual(getStore(restore(saved({ bankstown: later }))).recapSnapshot, ['opening']);
  assert.notEqual(later.recapSnapshot, posted.recapSnapshot);
  assert.deepEqual(posted.recapSnapshot, ['opening']);
});

test('recap restoration preserves empty history and discards unknown snapshot values', () => {
  const empty = act(freshStore(), 'create-recap', { outcomes: [] });
  const later = act(empty, 'prep-review-check');
  assert.deepEqual(getStore(restore(saved({ bankstown: later }))).recapSnapshot, []);

  const legacy = { ...later };
  delete legacy.recapSnapshot;
  assert.deepEqual(getStore(restore(saved({ bankstown: legacy }))).recapSnapshot, [], 'legacy recaps must not infer outcomes from current progress');

  const restored = getStore(restore(saved({ bankstown: { ...empty, recapSnapshot: ['opening', 'opening', 'close', 'network', 'rush', null, { id: 'prep' }] } })));
  assert.deepEqual(restored.recapSnapshot, ['opening', 'rush']);
  const unpublished = getStore(restore(saved({ bankstown: { ...freshStore(), recapSnapshot: ['rush'] } })));
  assert.equal(unpublished.recapSnapshot, null);
});
