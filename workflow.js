import { CURATED_CHANNEL_IDS } from './frontline-state.js';
export const STORAGE_KEY = 'el-jannah-store-os-v1';
export const checkLabels = ['Team brief completed', 'Equipment checked', 'Food safety records reviewed', 'Counter and packing station ready'];
const noteAuthor = author => author === 'sarah' ? 'sarah' : 'omar';
const noteChannel = channel => channel!=='store'&&CURATED_CHANNEL_IDS.includes(channel)?{channel}:{};
export function freshStore() { return { actions: [], checks: [], notes: [], owner: null, resolved: false, cover: false, recap: false, recapSnapshot: null }; }
export function freshState() { return { version: 1, store: 'bankstown', stage: 'opening', role: 'crew', stores: {} }; }
export function getStore(state, id = state.store) { return state.stores[id] ||= freshStore(); }
export function applyAction(store, action, detail = {}) {
  const next = structuredClone(store);
  if (action === 'check') {
    if (!Number.isInteger(detail.index) || detail.index < 0 || detail.index >= checkLabels.length) return {store, error:'Choose a valid opening check.'};
    next.checks = next.checks.includes(detail.index) ? next.checks.filter(x => x !== detail.index) : [...next.checks, detail.index];
    next.actions = next.actions.filter(x => !['opening-ready','opening-complete'].includes(x));
  } else if (['opening-ready','opening-complete'].includes(action) && next.checks.length !== checkLabels.length) {
    return {store, error:'Complete the four opening checks first.'};
  } else if (action === 'resolve-issue' && !next.owner) {
    return {store, error:'Assign an owner before resolving this issue.'};
  } else if (action === 'assign-issue') next.owner = 'Sarah';
  else if (action === 'resolve-issue') next.resolved = true;
  else if (action === 'request-cover') next.cover = true;
  else if (action === 'create-recap') { next.recap = true; next.recapSnapshot = Array.isArray(detail.outcomes) ? [...new Set(detail.outcomes.filter(id=>['opening','prep','rush','supply','people'].includes(id)))] : []; }
  else if (action === 'note') {
    const text = String(detail.text || '').trim().slice(0,1000);
    if (!text) return {store, error:'Write a message first.'};
    next.notes = [...next.notes, {text, stage:detail.stage || 'rush', time:detail.time || 'Now', author:noteAuthor(detail.author),...noteChannel(detail.channel)}].slice(-30);
  }
  if (!['note','check'].includes(action) && !next.actions.includes(action)) next.actions.push(action);
  return {store:next, error:null};
}
export function parseState(raw, storeIds, stageIds) {
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !storeIds.includes(value.store) || !stageIds.includes(value.stage)) return freshState();
    const result = freshState(); result.store = value.store; result.stage = value.stage;
    result.role = value.role === 'crew' ? 'crew' : 'manager';
    for (const id of storeIds) {
      const s = value.stores?.[id]; if (!s || typeof s !== 'object') continue;
      const actions = Array.isArray(s.actions) ? [...new Set(s.actions.filter(x=>typeof x==='string' && x.length<80))] : [];
      result.stores[id] = {actions, checks: Array.isArray(s.checks) ? [...new Set(s.checks.filter(x=>Number.isInteger(x)&&x>=0&&x<4))] : [], notes:Array.isArray(s.notes) ? s.notes.filter(x=>x && typeof x.text==='string').slice(-30).map(x=>({text:x.text.slice(0,1000),stage:stageIds.includes(x.stage)?x.stage:'rush',time:typeof x.time==='string'?x.time.slice(0,30):'Now',author:noteAuthor(x.author),...noteChannel(x.channel)})) : [], owner:s.owner==='Sarah'?'Sarah':null, resolved:s.resolved===true && s.owner==='Sarah', cover:s.cover===true, recap:s.recap===true};
    }
    for (const [id, store] of Object.entries(result.stores)) {
      const snapshot=value.stores[id].recapSnapshot;
      store.recapSnapshot=store.recap?(Array.isArray(snapshot)?[...new Set(snapshot.filter(id=>['opening','prep','rush','supply','people'].includes(id)))]:[]):null;
      if (store.checks.length !== checkLabels.length) store.actions = store.actions.filter(x => !['opening-ready','opening-complete'].includes(x));
      if (!store.owner || !store.resolved) store.actions = store.actions.filter(x => !['resolve-issue','rush-run-playbook'].includes(x));
    }
    return result;
  } catch {return freshState();}
}
