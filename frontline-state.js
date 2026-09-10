export const FEATURE_IDS = ['access', 'channels', 'clips', 'canvas', 'lists', 'shifts', 'workflows', 'huddles', 'agents', 'governance'];
export const CURATED_CHANNEL_IDS = ['store', 'announcements', 'shift-handover', 'food-safety', 'training', 'stock', 'equipment', 'guest-experience', 'people-help', 'team-wins'];
export const OPERATION_IDS = ['complaints', 'drive-thru', 'delivery', 'refunds', 'sales', 'diagnostics', 'weekly-pack', 'leaderboard', 'follow-up', 'review'];

const OPERATION_STATUSES = ['assigned', 'resolved', 'escalated', 'draft', 'approved'];
const EVENT_LIMIT = 60;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const boundedText = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);

export function freshFrontlineStore() {
  return {
    completed: [], verified: false, clockedIn: false, checkedOut: false,
    selectedChannel: null, clipSeen: false, issue: null, huddleJoined: false,
    agentAsked: false, externalBlocked: false, events: [], operations: {},
  };
}

function eventFrom(value) {
  if (!isRecord(value)) return null;
  const limits = { stage: 80, name: 80, initials: 12, text: 1500, role: 80 };
  if (!Object.entries(limits).every(([key, max]) => boundedText(value[key], max, true))) return null;
  return Object.fromEntries(Object.keys(limits).map(key => [key, value[key].trim()]));
}

function operationChanges(value, { strict = true } = {}) {
  if (!isRecord(value)) return null;
  const validators = {
    status: status => OPERATION_STATUSES.includes(status),
    owner: owner => owner === 'Sarah',
    elapsedHours: hours => Number.isFinite(hours) && hours >= 0 && hours <= 72,
    draft: draft => boundedText(draft, 1500),
    checked: checked => typeof checked === 'boolean',
  };
  const changes = {};
  for (const [key, valueForKey] of Object.entries(value)) {
    if (!hasOwn(validators, key) || !validators[key](valueForKey)) {
      if (strict) return null;
      continue;
    }
    changes[key] = valueForKey;
  }
  return Object.keys(changes).length ? changes : null;
}

/** Every action returns a new state, or the unchanged input with a useful error. */
export function transitionFrontline(store, action, detail = {}) {
  if (!isRecord(detail)) return { store, error: 'Choose a valid action.' };
  const next = structuredClone(store);
  const fail = error => ({ store, error });
  const complete = id => { if (!next.completed.includes(id)) next.completed.push(id); };
  switch (action) {
    case 'verify-demo-access':
      next.verified = true;
      complete('access');
      break;
    case 'select-channel':
      if (!CURATED_CHANNEL_IDS.includes(detail.channel)) return fail('Choose one of the ten store channels.');
      next.selectedChannel = detail.channel;
      complete('channels');
      break;
    case 'clip-seen':
      next.clipSeen = true;
      complete('clips');
      break;
    case 'canvas-read':
      complete('canvas');
      break;
    case 'list-read':
      complete('lists');
      break;
    case 'clock-in':
      if (!next.verified) return fail('Sign in before clocking in.');
      next.clockedIn = true;
      next.checkedOut = false;
      next.completed = next.completed.filter(id => id !== 'governance');
      complete('shifts');
      break;
    case 'submit-issue':
      if (!next.verified) return fail('Sign in before logging an issue.');
      if (!boundedText(detail.text, 500, true)) return fail('Describe the issue in 1 to 500 characters.');
      if (!boundedText(detail.category, 80, true)) return fail('Choose a valid issue category.');
      next.issue = { category: detail.category.trim(), text: detail.text.trim(), owner: 'Sarah', status: 'open' };
      complete('workflows');
      break;
    case 'join-huddle':
      if (!next.issue) return fail('Log an issue first so the huddle has the right context.');
      next.huddleJoined = true;
      complete('huddles');
      break;
    case 'ask-agent':
      if (!boundedText(detail.question, 240, true)) return fail('Ask a question in 1 to 240 characters.');
      next.agentAsked = true;
      complete('agents');
      break;
    case 'check-external':
      next.externalBlocked = true;
      break;
    case 'clock-out':
      if (!next.verified) return fail('Sign in before clocking out.');
      if (!next.clockedIn) return fail('Clock in before finishing your shift.');
      if (!next.externalBlocked) return fail('Check the external access restriction before finishing your shift.');
      next.checkedOut = true;
      next.clockedIn = false;
      complete('governance');
      break;
    case 'log-event': {
      const event = eventFrom(detail);
      if (!event) return fail('Add a complete shift update with plain text fields.');
      next.events = [...next.events, event].slice(-EVENT_LIMIT);
      break;
    }
    case 'update-operation': {
      if (!OPERATION_IDS.includes(detail.id)) return fail('Choose a valid store operation.');
      const changes = operationChanges(detail.changes);
      if (!changes) return fail('Choose valid operation changes.');
      next.operations[detail.id] = { ...next.operations[detail.id], ...changes };
      break;
    }
    default:
      return fail('Choose a valid action.');
  }
  return { store: next, error: null };
}

function restoreStore(value) {
  const next = freshFrontlineStore();
  if (!isRecord(value)) return next;
  next.verified = value.verified === true;
  next.selectedChannel = CURATED_CHANNEL_IDS.includes(value.selectedChannel) ? value.selectedChannel : null;
  next.clipSeen = value.clipSeen === true;
  next.agentAsked = value.agentAsked === true;
  next.externalBlocked = value.externalBlocked === true;
  next.clockedIn = next.verified && value.clockedIn === true;
  next.checkedOut = next.verified && next.externalBlocked && !next.clockedIn && value.checkedOut === true;
  if (next.verified && isRecord(value.issue) && boundedText(value.issue.category, 80, true)
    && boundedText(value.issue.text, 500, true) && value.issue.owner === 'Sarah' && value.issue.status === 'open') {
    next.issue = { category: value.issue.category.trim(), text: value.issue.text.trim(), owner: 'Sarah', status: 'open' };
  }
  next.huddleJoined = Boolean(next.issue) && value.huddleJoined === true;
  const gates = {
    access: next.verified, channels: Boolean(next.selectedChannel), clips: next.clipSeen,
    canvas: true, lists: true, shifts: next.clockedIn || next.checkedOut, workflows: Boolean(next.issue),
    huddles: next.huddleJoined, agents: next.agentAsked, governance: next.checkedOut,
  };
  next.completed = Array.isArray(value.completed)
    ? [...new Set(value.completed.filter(id => FEATURE_IDS.includes(id) && gates[id]))] : [];
  next.events = Array.isArray(value.events) ? value.events.map(eventFrom).filter(Boolean).slice(-EVENT_LIMIT) : [];
  if (isRecord(value.operations)) {
    for (const id of OPERATION_IDS) {
      if (!hasOwn(value.operations, id)) continue;
      const changes = operationChanges(value.operations[id], { strict: false });
      if (changes) next.operations[id] = changes;
    }
  }
  return next;
}

/** Restore only recognised stores and fields. Corrupt progress becomes a fresh demo. */
export function parseFrontline(raw, storeIds) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { value = null; }
  const result = {};
  for (const id of storeIds) {
    if (typeof id !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
    result[id] = restoreStore(isRecord(value) && hasOwn(value, id) ? value[id] : null);
  }
  return result;
}
