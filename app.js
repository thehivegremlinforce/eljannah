import { StoreDiorama } from './scene.js';
import { stores, stages, zoneDetails } from './data.js';
import { STORAGE_KEY, checkLabels, freshState, getStore, applyAction, parseState } from './workflow.js';
import { initialiseConnectedStore } from './connected-store.js';
import { initialiseSlackShell } from './slack-shell.js';
import { people, personFor, avatar, brandAvatar, appAvatar, storePhotos } from './identities.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const iconPaths = {
  'chevron-left':'m15 5-7 7 7 7', bookmark:'M6 3h12v18l-6-4-6 4Z', headphones:'M4 13v-2a8 8 0 0 1 16 0v2M4 12h3v9H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Zm16 0h-3v9h3a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2Z', video:'M3 5h12v14H3Zm12 5 6-4v12l-6-4', mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4M8 22h8',
  'arrow-right':'M4 12h16m-6-6 6 6-6 6', 'arrow-up-right':'M6 18 18 6M6 6h12v12', play:'m8 5 11 7-11 7Z', pause:'M8 5v14M16 5v14',
  reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6', rotate:'M4 9a8 8 0 1 1 0 6M4 3v6h6', layers:'m12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 15l10 6 10-6',
  plus:'M12 5v14M5 12h14',minus:'M5 12h14',close:'m6 6 12 12M18 6 6 18', search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  home:'m3 10 9-7 9 7v11h-6v-7H9v7H3Z', bell:'M18 8a6 6 0 0 0-12 0v8l-2 2h16l-2-2Zm-8 14h4',grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  document:'M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6',chat:'M3 3h18v14H9l-6 4Z', 'check-square':'M20 12v8H4V4h11M8 10l4 4L21 3',
  expand:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',send:'m3 3 19 9-19 9 4-9Zm4 9h15', activity:'M2 12h5l3-8 4 16 3-8h5',
  hand:'M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 7-7 7-3 0-4-2-6-4l-4-5a2 2 0 0 1 3-2l2 2',
  phone:'M7 2h10v20H7Zm3 17h4M10 5h4',connections:'M10 3H3v7h7Zm11 11h-7v7h7ZM7 10v7h7M10 7h7v7',store:'M3 10h18l-2-7H5ZM5 10v11h14V10M9 21v-7h6v7',
  sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  flame:'M12 2s2 5-2 8c-1-2-3-2-3-2s-5 5-3 10c3 6 12 5 15 0 2-5-1-10-3-12 0 4-2 5-2 5s2-6-2-9Z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2',truck:'M3 5h11v12H3Zm11 5h4l3 4v3h-7M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  people:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 21v-3a7 7 0 0 1 14 0v3M18 3a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5M6 3a3 3 0 0 0 0 6M4 13a5 5 0 0 0-3 5',
  moon:'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z',check:'m5 12 4 4L19 6', info:'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.activity}"/></svg>`;
function icons(root=document) { root.querySelectorAll('[data-icon]').forEach(el => { const holder=document.createElement('span');holder.innerHTML=icon(el.dataset.icon,el.className);el.replaceWith(holder.firstElementChild); }); }
icons();
let state;
try { state = parseState(localStorage.getItem(STORAGE_KEY), stores.map(s=>s.id), stages.map(s=>s.id)); } catch { state = freshState(); }
// Each presentation starts with the employee. Saved store work remains available.
state.role='crew';state.stage='opening';
let view = 'store', tab = 'messages', networkFilter = 'all', exploded = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let connected, slackShell;
const drafts = new Map();
const draftKey=()=>`${state.store}:${state.stage}:${slackShell?.currentChannel()||'store'}`;
const stashDraft=()=>drafts.set(draftKey(),$('#message-input').value);
if(state.role==='crew'&&state.stage==='network')state.stage='opening';
let toastTimer, returnFocus, returnFocusSelector, lastDialogTrigger, dialogGeneration=0, interactionFeature=null, interactionTimer;
const storeInfo = () => stores.find(s=>s.id === state.store) || stores[0];
const stageInfo = () => stages.find(s=>s.id === state.stage) || stages[2];
const current = () => getStore(state);
const stageIcons = ['sun','flame','activity','truck','people','moon','connections'];
const shortLabels = ['Opening','Prep & quality','Dinner rush','Delivery','The crew','Handover','The network'];
const titleMap = {opening:'READY FOR<br>A LEGENDARY DAY.',prep:'GOOD FOOD.<br>GREAT TEAMWORK.',rush:'A BUSY SHIFT.<br>A CLEAR NEXT STEP.',supply:'KEEP THE<br>GOOD FOOD MOVING.',people:'A LITTLE HELP.<br>A STRONGER SHIFT.',close:'LEAVE THE NEXT<br>SHIFT IN THE KNOW.',network:'EVERY STORE.<br>CONNECTED.'};
function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { toast('Browser storage is unavailable. You can still explore this session.'); } }
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
function commit(action, detail={}) {
  const result=applyAction(current(),action,detail);
  if(result.error){toast(result.error);return false;}
  state.stores[state.store]=result.store;save();setSceneInteraction(state.stage,'success');return true;
}
let diorama;
try {
  diorama=new StoreDiorama($('#scene'), {onSelect: zone=>inspectZone(zone.id), onRotationChange:()=>renderMotionControls(), onReady:({webgl})=>{if(!webgl) $('#scene').dataset.fallback='true';}});
  diorama.setStage(state.stage);diorama.setPaused(paused);
} catch {
  $('#scene').innerHTML='<div class="fallback-scene">The 3D store could not load on this device.<br>You can still select the store areas below and explore every Slack workflow.</div>';
}

$('#store-select').innerHTML=stores.map(s=>`<option value="${s.id}">${s.name}, ${s.state}</option>`).join('');
$('#store-select').value=state.store;
function renderJourney() {
  $('#journey').innerHTML=stages.map((s,i)=>`<button class="journey-step ${s.id===state.stage?'active':''}" data-stage="${s.id}" ${s.id===state.stage?'aria-current="step"':''}><span class="step-icon">${icon(current().actions.includes(s.actions[0].id)?'check':stageIcons[i])}</span><span><b>${shortLabels[i]}</b><small>${escape(s.time)}</small></span></button>`).join('');
}
function renderMotionControls() {
  const rotating=Boolean(diorama?.autoRotate), label=rotating?'Stop rotation':'Start rotation';
  $('#rotate').innerHTML=`${icon('rotate')} <span>${label}</span>`;$('#rotate').setAttribute('aria-label',label);$('#rotate').setAttribute('aria-pressed',String(rotating));$('#rotate').disabled=!diorama?.renderer;
  $('#motion').innerHTML=icon(paused?'play':'pause');$('#motion').setAttribute('aria-label',paused?'Resume animation':'Pause animation');$('#motion').setAttribute('aria-pressed',String(paused));
}
function renderHeader() {
  const stage=stageInfo();
  $('#view-title').textContent=view==='network'?'A clear view across the stores':state.role==='crew'?'Omar’s view · Frontline employee':'Sarah’s view · Store manager';
  $('#scene-time').textContent=`${stage.time} · ${shortLabels[stages.indexOf(stage)].toUpperCase()}`;
  $('.phone-status > b').textContent=stage.time.replace(/^0/,'');
  $('#scene-title').innerHTML=titleMap[stage.id];
  $('#signal-label').textContent=current().actions.includes(stage.actions[0].id)?'The next step is in motion':({rush:'A queue that needs a hand',supply:'Delivery needs attention',opening:'Ready to open together',people:'Support for the late shift',prep:'The right check, at the right time',close:'A useful handover',network:'See the pattern across stores'}[stage.id]);
  $('#signal-detail').textContent=current().actions.includes(stage.actions[0].id)?'Owner, action and follow-up stay together.':({rush:'Fingermark flags a change in ticket time.',supply:'A delivery pause reaches the right person.',opening:'Opening checks find the team in Slack.',people:'An approved workflow connects the crew.',prep:'The source record stays in the food safety app.',close:'Open items keep their owner for tomorrow.',network:'Store data becomes a clear next step.'}[stage.id]);
  $('#channel-name').textContent=stage.id==='network'?'am-southwest':`store-${state.store}`;
  $('#message-input').placeholder=`Message #${stage.id==='network'?'am-southwest':`store-${state.store}`}`;
  $$('.role-switch button').forEach(b=>{b.classList.toggle('active',b.dataset.role===state.role);b.setAttribute('aria-pressed',String(b.dataset.role===state.role));});
  $('#perspective-description').textContent=state.role==='crew'?'You are Omar, on packing and collection. Find the brief, ask for help and keep the team updated.':'You are Sarah, the store manager. Give work an owner and keep the follow-up visible.';
  renderMotionControls();
  const identity=people[state.role==='crew'?'omar':'sarah'];
  $$('.profile-mini').forEach(el=>{el.innerHTML=avatar(identity,'profile-photo');el.title=identity.name;});
  $$('.workspace-avatar,.sidebar-app .app-avatar').forEach(el=>{el.innerHTML=brandAvatar('workspace-logo');});
  $('#message-input').value=drafts.get(draftKey())||'';
  slackShell?.sync();
  connected?.refreshPresenter();
}
function message({name='Store OS',text='',role='',initials='EJ',time=stageInfo().time},body='',index=0) {
  const app=role.includes('app')||role.includes('integration')||name==='Store OS';
  const person=app?null:personFor(name==='You'?(state.role==='crew'?'omar':'sarah'):name)||personFor(initials);
  const picture=app?appAvatar(name):person?avatar(person):brandAvatar();
  return `<article class="message">${picture}<div class="message-content"><div class="message-author"><b>${escape(person?.name||name)}</b>${app?'<span class="app-tag">APP</span>':''}<time>${escape(time)}</time></div><p>${escape(text)}</p>${body}</div></article>`;
}
function currentSummary() {
  const s=current(); const done=stages.filter(stage=>!['close','network'].includes(stage.id)&&s.actions.includes(stage.actions[0].id));
  return done.length?done.map(stage=>stage.label).join(', '):'No shift updates have been recorded yet.';
}
function renderMessages() {
  const stage=stageInfo(),done=current().actions.includes(stage.actions[0].id);
  let metric=stage.metric.value,metricLabel=stage.metric.label,baseline=stage.metric.baseline;
  if(stage.id==='opening'){metric=`${current().checks.length} / 4`;metricLabel='opening checks complete';baseline='Team, equipment, food safety and packing';}
  if(stage.id==='rush' && done){metric='4:06';baseline='After the playbook · Follow-up check';}
  if(stage.id==='supply' && done){metric='Online';metricLabel='delivery status';baseline='Availability confirmed by the manager';}
  if(stage.id==='people' && done){metric='Covered';metricLabel='late-shift packing role';baseline='Approved in the workforce app';}
  if(stage.id==='prep' && done){metric='Reviewed';metricLabel='check status';}
  const first={...stage.messages[0]};
  if(stage.id==='opening')first.text=`Morning, Omar. Here are your opening checks for ${storeInfo().name}. ${current().checks.length} of 4 are complete.`;
  if(stage.id==='close')first.text='Let’s leave the morning crew a useful handover. The recap will include the shift updates you have recorded and a packaging delivery follow-up.';
  if(stage.id==='network')first.text=`Morning, Karim. The sample pack for four stores is ready. Review the exceptions and give each store one useful next step.`;
  if(done)first.text=`Original alert: ${first.text}`;
  let actionLabel=done?'Completed':stage.actions[0].label;
  if(stage.id==='rush'&&!done) actionLabel=current().owner?'Apply the playbook':'Assign to me';
  if(state.role==='crew'&&stage.id!=='opening')actionLabel=({prep:'Log a check or issue',rush:'Join the team huddle',supply:'Request store support',people:'View my shift',close:'Finish my shift',network:'View manager briefing'})[stage.id];
  const controls=`<div class="workflow-actions"><button class="slack-button primary" data-action="primary" ${done&&state.role==='manager'?'disabled':''}>${done&&state.role==='manager'?icon('check'):''}${escape(actionLabel)}</button><button class="slack-button" data-action="secondary">${escape(stage.actions[1].label)}</button></div>`;
  const card=`<div class="workflow-card ${done?'complete':''}"><div class="card-kicker">${icon(done?'check':'activity')} ${done?'UPDATE RECORDED':'A SIGNAL WORTH ACTING ON'}</div><h3>${escape(stage.title)}</h3><p>${escape(done?stage.outcome:stage.signal)}</p><div class="metric-row"><div><strong>${escape(metric)}</strong><small>${escape(metricLabel)}</small></div><div><strong>${stage.id==='rush'?'4:10':stage.id==='network'?'One place':stage.id==='supply'?'Stock checked':stage.id==='people'?'With approval':'Clear ownership'}</strong><small>${escape(baseline)}</small></div></div>${controls}<div class="message-source">${escape(stage.source)}${stage.id==='rush'&&current().owner?' · Owner: Sarah':''}</div></div><div class="message-reactions"><button class="reaction" data-reaction="seen" aria-label="Eyes, 3 reactions" aria-pressed="false"><span class="emoji" aria-hidden="true">👀</span><span class="reaction-count">3</span></button><button class="reaction" data-reaction="thanks" aria-label="Raised hands, 2 reactions" aria-pressed="false"><span class="emoji" aria-hidden="true">🙌</span><span class="reaction-count">2</span></button></div>`;
  let html=`<div class="date-divider"><span>${stage.id==='network'?'Monday briefing':'Today'}</span></div>`;
  if(state.role==='crew')html+=`<div class="hub-card" style="margin:0 0 15px"><h3>${icon('phone')} Omar Haddad · Your shift</h3><p>Today 16:00 to 22:30 · Packing & collection<br>Team briefing and approved workflows, all in your store channel.</p><div class="workflow-actions"><button class="slack-button" data-modal="roster">View my shift</button><button class="slack-button" data-modal="crew-question">Ask the team</button></div></div>`;
  html+=message(first,card);
  if(done) {
    const recapSummary=(current().recapSnapshot||[]).map(id=>stages.find(s=>s.id===id)?.label).filter(Boolean).join(', ')||'No workflow outcomes had been recorded when this handover was posted.';
    html+=message({name:'Sarah',initials:'SA',role:'Store manager',text:stage.id==='close'?`Handover recorded. Outcomes at publication: ${recapSummary} Packaging delivery is with Sarah for the morning.`:stage.actions[0].result},'',1);
    html+=message({name:'Store OS',role:'Approved app',text:stage.outcome,initials:'EJ'},'<div class="message-source">Shift update</div>');
  } else if(stage.id==='rush' && current().owner) {
    html+=message({name:'Sarah',initials:'SA',text:'I’ve taken the alert. I’ll check the playbook and move the team where we need them.',role:'Store manager'},'',1);
  } else {
    const contextual={rush:'I’m on packing. Give me a nudge if you need a hand on the second window.',opening:'The promotion and the shift brief are in the Store Hub. I’m ready to help with the checks.',prep:'The record is ready for review in the food safety app.',supply:'Chicken packs and garlic sauce are available. The packing bench is ready for the stock check.',people:'I’ve put the cover request into the approved workflow. The workforce app will handle availability and approval.',close:'One for tomorrow: please confirm the packaging delivery before lunch prep.',network:'Let’s start with delivery availability and guest feedback. We can open the store channel from the briefing.'}[stage.id];
    html+=message({name:stage.id==='network'?'Karim':'Omar',initials:stage.id==='network'?'KA':'OM',text:contextual,role:'Team member'},'',1);
  }
  current().notes.filter(n=>n.stage===state.stage&&(!n.channel||n.channel==='store')).forEach(n=>{html+=message({name:people[n.author||'omar'].name,initials:'YO',text:n.text,time:n.time,role:'Team member'},'',2);});
  html+=connected?.additionalMessages(state.stage)||'';
  if(state.role==='manager')html+=connected?.operationsForStage(state.stage)||'';
  return html;
}
function renderHub() {
  return `<p class="eyebrow">PINNED IN #STORE-${escape(state.store.toUpperCase())}</p><h2 class="hub-heading">${escape(storeInfo().name)} Store Hub</h2><p class="hub-intro">Everything the shift needs, in one place. This canvas is a read-only briefing. Record checks through the approved workflow.</p><div class="hub-card"><h3>${icon('sun')} Today’s shift</h3><p>Shift leader: Layla<br>Manager on duty: Sarah<br>Dinner service: packing, collection and drive-thru</p><button class="slack-button" data-modal="roster">View the roster</button></div><div class="hub-card"><h3>${icon('check-square')} Opening & closing</h3><p>Work through the shift checks and keep the result with the right owner.</p><button class="slack-button primary" data-open-tasks>Run opening workflow</button></div><div class="hub-card"><h3>${icon('flame')} The prep brief</h3><p>Current food safety procedure, check records and promotion brief. Open the approved source before making a decision.</p><button class="slack-button" data-modal="procedure">See how the records connect</button></div><div class="hub-card"><h3>${icon('people')} Need a hand?</h3><p>Store support · Area manager · Training library<br>Roster, contracts and people records stay in the workforce system.</p><button class="slack-button" data-modal="support">Find the right support</button></div>`;
}
function renderTasks() {
  const s=current();
  return `<p class="eyebrow">APPROVED OPENING WORKFLOW</p><h2 class="hub-heading">${state.role==='crew'?'Omar Haddad':'Sarah Mansour'}’s opening checks</h2><p class="hub-intro">Work through your checks and confirm each one when it is complete.</p><div class="progress-track"><span style="width:${s.checks.length/4*100}%"></span></div><p class="task-status">${s.checks.length} of 4 checks complete</p>${checkLabels.map((label,i)=>`<label class="check-row"><input type="checkbox" data-check="${i}" ${s.checks.includes(i)?'checked':''}><span>${escape(label)}</span></label>`).join('')}<div class="workflow-actions"><button class="slack-button primary" data-finish-opening ${s.actions.includes('opening-complete')?'disabled':''}>${s.actions.includes('opening-complete')?'Opening confirmed':'Confirm the store is ready'}</button></div><div class="hub-card"><h3>What follows the shift?</h3><p>Completed actions: ${stages.filter(s=>current().actions.includes(s.actions[0].id)).length} of 7<br>Updates stay with the store and its team.</p><button class="slack-button" data-modal="activity">View this store’s activity</button></div>`;
}
function renderChannel() {
  $('#message-input').value=drafts.get(draftKey())||'';
  if(slackShell?.renderChannel())return;
  $('.channel-tabs').hidden=false;
  $$('.channel-tabs button').forEach(button=>{const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  $('#channel-content').setAttribute('aria-labelledby',`tab-${tab}`);
  $('#channel-content').innerHTML=tab==='hub'?renderHub():tab==='tasks'?renderTasks():renderMessages();
  $('#composer').hidden=tab!=='messages';$('#channel-content').scrollTop=0;
  slackShell?.sync();
}
function setTab(next) {stashDraft();tab=next;if(next!=='messages'||slackShell?.currentChannel()==='store')slackShell?.showChannel();renderChannel();}
function setStage(id,{scroll=false}={}) {
  if(!stages.some(s=>s.id===id))return;
  if(state.role==='crew'&&id==='network'){showManagerSwitch('network');return;}
  if(id!==state.stage)closeDialog({restoreFocus:false});
  stashDraft();
  slackShell?.showChannel();
  state.stage=id;tab='messages';save();renderJourney();renderHeader();renderChannel();diorama?.setStage(id);diorama?.selectZone(null);$('#zone-inspector').hidden=true;$$('[data-zone]').forEach(b=>b.classList.remove('active'));
  if(scroll)$('#experience').scrollIntoView({behavior:paused?'instant':'smooth',block:'start'});
}
function setStore(id) {if(!stores.some(s=>s.id===id))return;if(id!==state.store)closeDialog({restoreFocus:false});stashDraft();state.store=id;if(state.stage==='network'&&id!=='bankstown'){state.stage='rush';diorama?.setStage('rush');}save();$('#store-select').value=id;$('#zone-inspector').hidden=true;diorama?.selectZone(null);$$('[data-zone]').forEach(el=>el.classList.remove('active'));connected?.storeChanged();renderJourney();renderHeader();renderChannel();if(view==='network')renderNetwork();}
function showManagerSwitch(destination) {showDialog('Explore the manager perspective?',`<p>The crew keeps its assigned workspace. Network information and manager decisions are demonstrated in a separate manager perspective.</p><button class="primary-button" data-explicit-manager="${destination}">Switch to manager perspective ${icon('arrow-right')}</button>`);}
function applyPerspective(role) {if(role!==state.role)closeDialog({restoreFocus:false});stashDraft();state.role=role;if(role==='crew'&&state.stage==='network')state.stage='opening';if(role==='crew'&&view==='network')setView('store');save();renderJourney();renderHeader();renderChannel();diorama?.setStage(state.stage);}
function setView(next) {
  if(next==='network'&&state.role==='crew'){showManagerSwitch('view');return;}
  if(next==='network')closeDialog({restoreFocus:false});
  view=next;$('#demo-grid').hidden=next==='network';$('#network-view').hidden=next!=='network';$('#journey').hidden=next==='network';
  $$('.main-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.view===next);b.setAttribute('aria-pressed',String(b.dataset.view===next));});
  $('#view-title').textContent=next==='network'?'A clear view across the stores':'A shift at El Jannah';
  if(next==='network')renderNetwork();else requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  renderHeader();
}
function setExplode(value) {exploded=Math.max(0,Math.min(100,Number(value)||0));$('#explode-range').value=exploded;$('#explode-output').textContent=`${Math.round(exploded)}%`;$('#explode').setAttribute('aria-pressed',String(exploded>0));$('#explode').innerHTML=`${icon('layers')} ${exploded>0?'Bring it together':'Break it apart'}`;diorama?.setExplode(exploded/100);}
function inspectZone(id) {
  const detail=zoneDetails[id];if(!detail)return;
  diorama?.selectZone(id);
  const inspector=$('#zone-inspector');inspector.hidden=false;
  inspector.innerHTML=`<button class="icon-button" data-close-inspector aria-label="Close store area details">${icon('close')}</button><b>${escape(detail.title)}</b><p>${escape(detail.description)}</p><small>${escape(detail.channel.replace('bankstown',state.store))} · ${escape(detail.systems.join(' · '))}</small><div class="workflow-actions"><button class="slack-button" data-zone-stage="${({grill:'prep',counter:'rush',stock:'supply',crew:'people',dining:'close',roof:'network'})[id]}">Explore this workflow ${icon('arrow-right')}</button></div>`;
  $$('[data-zone]').forEach(b=>b.classList.toggle('active',b.dataset.zone===id));
}
const interactionLabels={access:'Signing in for the shift',channels:'Finding the right store channel',clips:'Watching the shift briefing',canvas:'Reading the Store Hub',lists:'Checking the shift task list',shifts:'Checking the roster and shift',workflows:'Reporting an issue on the phone',huddles:'Talking it through with the team',agents:'Asking the approved store guide',governance:'Checking access and finishing the shift',opening:'Working through the opening checks',prep:'Reviewing the prep check',rush:'Coordinating the dinner rush',supply:'Following up the delivery signal',people:'Checking shift cover',close:'Preparing the next shift’s handover',network:'Reviewing the store briefing'};
function setSceneInteraction(feature,phase='view') {
  clearTimeout(interactionTimer);interactionFeature=feature;
  diorama?.setInteraction?.(feature,phase);
  $('#scene-activity').hidden=!feature;
  $('#scene').dataset.interaction=feature||'';$('#scene').dataset.interactionPhase=phase;
  if(!feature)return;
  const crew=['access','channels','clips','canvas','lists','shifts','workflows','huddles','agents','governance'].includes(feature)||state.role==='crew';
  const identity=people[crew?'omar':'sarah'];
  const person=`${identity.name} · ${storeInfo().name}`;
  const activityPhoto=$('#scene-activity > :first-child');
  if(activityPhoto.dataset.person!==identity.id){const photo=document.createElement('span');photo.innerHTML=avatar(identity,'scene-person-photo');activityPhoto.replaceWith(photo.firstElementChild);}
  const action=phase==='input'?'Entering the details on the phone':phase==='success'?'Done. The update is with the team.':interactionLabels[feature]||'Reviewing the next store action';
  if($('#scene-person').textContent!==person)$('#scene-person').textContent=person;
  if($('#scene-person-action').textContent!==action)$('#scene-person-action').textContent=action;
  $('#scene-activity').classList.toggle('is-typing',phase==='input');
  if(phase==='input'||phase==='success')interactionTimer=setTimeout(()=>setSceneInteraction($('#dialog').open?feature:null),phase==='input'?1700:2400);
}
function setClientBlocked(blocked) {
  for(const child of $('.slack-panel').children)if(!child.classList.contains('client-dialog-layer'))child.inert=blocked;
  $('.slack-panel').classList.toggle('dialog-open',blocked);$('#experience').classList.toggle('client-dialog-open',blocked);
  $('.client-dialog-layer').hidden=!blocked;
}
function focusSelector(element) {
  if(!element?.matches)return null;
  if(element.id)return `#${CSS.escape(element.id)}`;
  const scope=element.closest('#frontline-features,#store-playbooks,#desktop-channel-list,#mobile-channel-list,.mobile-bottom-nav,.workspace-rail,.channel-sidebar');
  const prefix=scope?(scope.id?`#${scope.id} `:`.${scope.classList[0]} `):'';
  for(const attr of ['data-feature','data-operation','data-action','data-mobile-nav','data-desktop-nav','data-shell-shortcut','data-workspace-channel'])if(element.hasAttribute(attr))return `${prefix}button[${attr}="${CSS.escape(element.getAttribute(attr))}"]`;
  return null;
}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&!$('#dialog').contains(button))lastDialogTrigger=button;},true);
function showDialog(title,body,{feature=state.stage}={}) {
  const dialog=$('#dialog'),wasOpen=dialog.open;
  if(!wasOpen&&!dialog.contains(document.activeElement)){const active=document.activeElement;returnFocus=active&&active!==document.body&&active!==document.documentElement?active:lastDialogTrigger;returnFocusSelector=focusSelector(returnFocus);}
  if(view!=='store')setView('store');
  $('#experience').classList.remove('expanded');$('#expand-slack').setAttribute('aria-label','Expand Slack channel');
  ++dialogGeneration;dialog.classList.add('slack-dialog');
  connected?.disposeDialog();
  dialog.classList.toggle('slack-signin-dialog',feature==='access');
  $('#briefing-video')?.pause();$('#dialog-title').textContent=title;$('#dialog-content').innerHTML=body;
  setClientBlocked(true);if(!dialog.open)dialog.show();
  dialog.scrollTop=0;$('#dialog-content').scrollTop=0;$('#dialog-title').focus({preventScroll:true});
  setSceneInteraction(feature);
  if(!wasOpen){
    const grid=$('#demo-grid'),client=$('.slack-panel').getBoundingClientRect();
    if(matchMedia('(min-width:1051px)').matches){
      const top=$('#experience').getBoundingClientRect().top,bottom=grid.getBoundingClientRect().bottom;
      const viewport=window.visualViewport?.height||innerHeight,margin=12;
      if(bottom-top<=viewport-margin*2){
        const delta=top<margin?top-margin:bottom>viewport-margin?bottom-viewport+margin:0;
        if(delta)window.scrollBy({top:delta,behavior:'instant'});
      }else if(client.top<0||client.bottom>viewport)grid.scrollIntoView({block:'start',behavior:'instant'});
    }else if(client.top<0||client.top>innerHeight*.3||client.bottom>innerHeight)grid.scrollIntoView({block:'start',behavior:'instant'});
  }
  requestAnimationFrame(()=>diorama?.resize());
}
function closeDialog({restoreFocus=true}={}) {
  const dialog=$('#dialog');if(!dialog.open)return;
  const generation=++dialogGeneration;
  connected?.disposeDialog();
  $('#briefing-video')?.pause();dialog.close();setClientBlocked(false);setSceneInteraction(null);
  $('#dialog-content').replaceChildren();
  if(restoreFocus)requestAnimationFrame(()=>{
    if(dialog.open||generation!==dialogGeneration)return;
    const active=document.activeElement;if(active&&active!==document.body&&active.isConnected&&!dialog.contains(active)&&active.getClientRects().length&&!active.closest('[inert]'))return;
    const candidates=[returnFocus,...(returnFocusSelector?$$(returnFocusSelector):[]),$('#next-stage')];
    const target=candidates.find(el=>el?.isConnected&&el!==document.body&&el!==document.documentElement&&el.getClientRects().length&&!el.closest('[inert]')&&!el.disabled);target?.focus({preventScroll:true});
  });
}
$('#dialog').addEventListener('close',()=>{if($('#dialog').open)return;setClientBlocked(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&!event.defaultPrevented&&$('#dialog').open){event.preventDefault();closeDialog();}});
$('#dialog').addEventListener('input',()=>{if(interactionFeature)setSceneInteraction(interactionFeature,'input');});
$('#dialog').addEventListener('click',event=>{if(event.target.closest('button:not(#close-dialog)')&&interactionFeature)setSceneInteraction(interactionFeature,'input');},true);
function completeStage(stageId=state.stage) {
  const stage=stages.find(s=>s.id===stageId);if(!stage)return;
  if(state.role==='crew'&&stageId!=='opening'){toast('This decision belongs to the manager perspective.');return;}
  if(stageId==='network'&&state.store!=='bankstown'){toast('Open the Bankstown diagnostic before assigning its focus.');return;}
  if(stageId==='opening' && !commit('opening-ready'))return;
  if(stageId==='rush' && !current().owner){toast('Assign the rush alert before applying the playbook.');return;}
  if(stageId==='rush')commit('resolve-issue');
  if(stageId==='people')commit('request-cover');
  if(stageId==='close')commit('create-recap',{outcomes:stages.filter(s=>!['close','network'].includes(s.id)&&current().actions.includes(s.actions[0].id)).map(s=>s.id)});
  if(!commit(stage.actions[0].id))return;
  connected?.synchroniseStage(stageId);
  closeDialog();renderJourney();renderHeader();renderChannel();
  setSceneInteraction(stageId,'success');
  $('#channel-content').classList.remove('completion-flash');requestAnimationFrame(()=>$('#channel-content').classList.add('completion-flash'));
  toast(stage.outcome);
  $('#next-stage').focus();
}
function primaryAction() {
  const stage=stageInfo();
  if(state.role==='crew'&&stage.id!=='opening'){connected.openFeature(({prep:'workflows',rush:'huddles',supply:'workflows',people:'shifts',close:'governance'})[stage.id]);return;}
  if(stage.id==='network'&&state.store!=='bankstown'){setStore('bankstown');toast('Assigning the focus from Bankstown’s sample diagnostic.');}
  if(current().actions.includes(stage.actions[0].id))return;
  if(stage.id==='opening'){setTab('tasks');return;}
  if(stage.id==='rush'&&!current().owner){commit('assign-issue');renderChannel();toast('Sarah owns the alert. The playbook is ready to review.');return;}
  const doneLabels={rush:'Apply the playbook',prep:'Confirm review',supply:'Resume delivery',people:state.role==='crew'?'Request manager approval':'Approve shift cover',close:'Post handover',network:'Assign store focus'};
  let detail=stage.description;
  if(stage.id==='close')detail=`Your completed shift updates: ${currentSummary()} The handover will also include the packaging delivery follow-up for Sarah.`;
  showDialog(stage.id==='rush'?'Give the rush a clear next step.':stage.title,`<p>${escape(detail)}</p><ol class="step-list">${stage.steps.map(s=>`<li><div><b>${escape(s.label)}</b><span>${escape(s.detail)}</span></div></li>`).join('')}</ol>${stage.id==='close'?'<p class="source-note">The handover includes completed work and the open items for the next shift.</p>':''}<div class="dialog-actions"><button class="primary-button" data-confirm-stage="${stage.id}">${escape(doneLabels[stage.id])} ${icon('check')}</button><button class="slack-button" data-dismiss>Keep exploring</button></div>`);
}
function secondaryAction() {
  const stage=stageInfo();
  if(stage.id==='opening'){setTab('hub');return;}
  if(stage.id==='network'){showEvidence();return;}
  if(stage.id==='close'){const published=current().recap;const summary=published?((current().recapSnapshot||[]).map(id=>stages.find(s=>s.id===id)?.label).filter(Boolean).join(', ')||'No workflow outcomes had been recorded when this handover was posted.'):currentSummary();showDialog('The next shift starts in the know.',`<p class="feature-context">${published?'Published handover':'Draft handover'}</p><p>${escape(summary)}</p><div class="detail-tile"><b>For the morning crew</b><span>Confirm the packaging delivery before lunch prep.</span><small>Owner: Sarah · Sample handover item</small></div>`);return;}
  showDialog(stage.actions[1].label,`<p>${escape(stage.actions[1].result)}</p><div class="detail-grid"><div class="detail-tile"><b>${escape(stage.source)}</b><span>The signal reaches the store channel with context attached.</span></div><div class="detail-tile"><b>One owner. A clear follow-up.</b><span>${escape(stage.outcome)}</span></div></div><ol class="step-list">${stage.steps.map(s=>`<li><div><b>${escape(s.label)}</b><span>${escape(s.detail)}</span></div></li>`).join('')}</ol>`);
}
function decorateStoreCards() {
  $$('[data-open-store].store-card').forEach(card=>{
    const photo=storePhotos[card.dataset.openStore];
    const image=document.createElement('img');
    image.className=photo?'identity-store-photo':'identity-store-logo';
    image.src=photo?.photo||'assets/ej-logo.svg';
    image.alt=photo?.alt||`El Jannah ${stores.find(s=>s.id===card.dataset.openStore)?.name||''} · Brand logo`;
    image.loading='lazy';image.decoding='async';
    card.prepend(image);
  });
}
function renderNetwork() {
  const filtered=stores.filter(s=>networkFilter==='all'||(networkFilter==='attention'?s.status==='attention'&&!getStore(state,s.id).resolved:s.state===networkFilter));
  $('#network-view').innerHTML=`<div class="network-top"><div><p class="eyebrow">THE VIEW FROM HEAD OFFICE</p><h2>BIG PICTURE.<br>LOCAL KNOW-HOW.</h2><p>See where a store needs a hand. Bring the next step back to the team.</p></div><div class="network-filter" aria-label="Filter stores">${[['all','All stores'],['NSW','NSW'],['VIC','VIC'],['attention','Needs a hand']].map(([id,label])=>`<button data-filter="${id}" class="${networkFilter===id?'active':''}" aria-pressed="${networkFilter===id}">${label}</button>`).join('')}</div></div><div class="network-layout"><div class="network-map"><span class="map-title">FOUR STORES. ONE CONNECTED TEAM.</span><svg viewBox="0 0 540 360" role="img" aria-label="Illustrative Australian store network with Sydney and Melbourne connected to head office"><path class="map-shape" d="M74 131 100 124 122 108 139 84 159 77 166 95 186 82 202 69 225 66 233 45 245 70 273 74 290 93 303 112 317 91 332 55 344 68 344 90 366 113 370 133 387 158 392 184 379 213 362 231 346 246 326 265 300 268 279 252 256 235 238 223 212 215 190 222 170 231 149 223 126 234 98 240 79 226 74 198 63 178 62 151Z"/><path class="map-shape" d="m309 283 22 2 2 14-12 11-11-10Z"/><path class="map-line" d="M369 208Q370 115 264 131M369 208Q334 220 321 262M321 262Q225 215 264 131"/><g class="map-store"><circle cx="264" cy="131" r="9"/><text x="277" y="130">Head office</text><text x="277" y="143" style="font-size:8px;font-weight:400">Connected through Slack</text></g><g class="map-store attention"><circle cx="370" cy="208" r="8"/><text x="386" y="205">Sydney</text><text x="386" y="219" style="font-size:8px;font-weight:400">3 stores</text></g><g class="map-store"><circle cx="322" cy="259" r="8"/><text x="342" y="269">Melbourne</text><text x="342" y="283" style="font-size:8px;font-weight:400">1 store</text></g></svg><div class="map-legend"><span><i class="zone-dot"></i>Connected</span><span><i class="zone-dot orange"></i>Needs a hand</span><span>Illustrative locations</span></div></div><div class="store-grid">${filtered.length?filtered.map(s=>{const resolved=getStore(state,s.id).resolved;const attention=s.status==='attention'&&!resolved;return `<button class="store-card ${attention?'attention':''}" data-open-store="${s.id}"><small>${s.state} · ${escape(s.area)}</small><h3>${escape(s.name)} ${icon('arrow-up-right')}</h3><span class="store-status"><i class="zone-dot ${attention?'orange':''}"></i>${attention?'Dinner rush needs a hand':'Team connected'}</span><div class="store-stat"><span><b>${s.orders}</b><br>Orders</span><span><b>${s.team}</b><br>Team members</span></div></button>`;}).join(''):'<div class="hub-card"><h3>All clear.</h3><p>No stores match this filter.</p></div>'}</div></div><div class="manager-brief"><div><p class="eyebrow">MONDAY · 7 AM · #AM-SOUTHWEST</p><h3>Your patch. The useful bits.</h3><p>A short briefing with store exceptions, unfinished actions and the evidence behind them.</p></div><button class="primary-button" data-modal="brief">Open the weekly briefing ${icon('arrow-right')}</button></div>`;
  decorateStoreCards();
}
function showEvidence() {
  showDialog('Why is Bankstown down this week?',`<p>An example answer from an approved diagnostics app, using the strategy deck’s sample figures.</p><div class="brief-answer"><b>Start with delivery availability and packing checks.</b><br>Net sales are down 6.4% in the sample week. Uber Eats orders are down 19%, while in-store transactions are flat. The pattern suggests delivery is a useful place to investigate.</div><div class="detail-grid"><button class="detail-tile" data-evidence="sales"><b>−6.4% net sales</b><span>POS / Snowflake sample comparison</span><small>View the sales evidence ↗</small></button><button class="detail-tile" data-evidence="delivery"><b>84 minutes paused</b><span>Saturday delivery availability</span><small>View the availability evidence ↗</small></button><button class="detail-tile" data-evidence="orders"><b>−19% delivery orders</b><span>In-store transactions remained flat</span><small>View the order mix ↗</small></button><button class="detail-tile" data-evidence="feedback"><b>4.6 to 4.4 rating</b><span>Guest feedback in the sample week</span><small>View the feedback theme ↗</small></button></div><p class="source-note">Illustrative figures from the customer strategy deck. This is a scripted demonstration of a proposed approved app, not a live AI answer.</p><div class="dialog-actions"><button class="primary-button" data-open-diagnostic-stage>Take the next step in Slack ${icon('arrow-right')}</button></div>`);
}
const modalContent = {
  about:()=>({title:'Every store. Every shift. One place.',body:`<p>This interactive concept shows how El Jannah could use Slack to connect stores, crew, area managers and head office.</p><p>The store, people, figures, messages and outcomes are illustrative. Progress is kept in this browser. Integrations shown here are proposed workflows.</p><h3>Built from your references</h3><p><a href="https://eljannah.com.au/" target="_blank" rel="noopener">El Jannah’s website</a> provides the brand colours, logo and headline font. The supplied customer strategy deck informs the store scenarios. The <a href="https://github.com/thehivegremlinforce/airlineopsdemo" target="_blank" rel="noopener">airline operations reference</a> informs the 3D and interaction approach.</p><p>The supplied frontline presentation informs the crew experience: a curated set of channels, approved workflows, read-only briefs and approved apps in channels. Product scope and connected apps need confirming for an implementation.</p><p class="source-note">Your progress is stored locally in this browser. Reset walkthrough clears progress for all four stores. The model is an illustrative store layout.</p>`}),
  frontline:()=>({title:'Made for people on their feet.',body:`<p>The crew gets the essentials for the shift: a short briefing, the right channel and quick actions through approved workflows.</p><div class="detail-grid"><div class="detail-tile"><b>A focused space</b><span>A curated channel set brings the team together without a wall of noise.</span></div><div class="detail-tile"><b>One-tap workflows</b><span>Run a check, ask for cover or log an issue using a workflow the business has approved.</span></div><div class="detail-tile"><b>Knowledge close at hand</b><span>Read the Store Hub and find the current procedure or training link.</span></div><div class="detail-tile"><b>Help in the channel</b><span>Talk to the team or invoke an approved app. Managers keep the wider operational view.</span></div></div><div class="dialog-actions"><button class="primary-button" data-switch-crew>Try the crew view ${icon('arrow-right')}</button></div>`}),
  systems:()=>({title:'Your systems. A clearer next step.',body:`<p>Slack brings the signal and the people together. The original records stay with the systems that own them.</p><div class="detail-grid">${[['POS & Snowflake','Store trading signals, comparisons and weekly briefings.'],['Fingermark','Ticket times and drive-thru changes with a response playbook.'],['Delivery platforms','Availability signals from Uber Eats and DoorDash.'],['Tattle & guest feedback','Related complaints grouped into one useful follow-up.'],['Workforce apps','Shift availability and approvals. Employment Hero retains people records.'],['Food safety & store tools','Approved procedures, records and check status, with links from the Store Hub.']].map(([name,desc])=>`<div class="detail-tile"><b>${name}</b><span>${desc}</span><small>Illustrative integration</small></div>`).join('')}</div>`}),
  procedure:()=>({title:'The check stays with its record.',body:'<p>A team member opens the approved food safety workflow, follows the store’s current procedure and records the result in the food safety system. The shift leader reviews it there.</p><p>Slack receives the status and a link. Open the source record to follow the current approved food safety procedure.</p>'}),
  roster:()=>({title:'Your shift, in one place.',body:`<p>A sample view of an integrated workforce app. The roster and approval stay in that system.</p><div class="detail-grid"><div class="detail-tile"><b>Today · 16:00 to 22:30</b><span>Packing & collection<br>${escape(storeInfo().name)} store</span><small>Shift leader: Layla</small></div><div class="detail-tile"><b>Need cover?</b><span>Run the approved request. The workforce app checks availability and asks the manager to approve.</span><small>Sample roster</small></div></div><button class="primary-button" data-go-people>Try the cover workflow ${icon('arrow-right')}</button>`}),
  support:()=>({title:'The right person, close by.',body:'<div class="detail-grid"><div class="detail-tile"><b>Store support</b><span>#store-support<br>Equipment, stock and day-to-day questions.</span></div><div class="detail-tile"><b>Area manager</b><span>#am-southwest<br>Escalations and support across the patch.</span></div><div class="detail-tile"><b>Food safety</b><span>#food-safety<br>Approved procedure links and the right escalation path.</span></div><div class="detail-tile"><b>People & training</b><span>Store Hub<br>Links to the approved training and workforce systems.</span></div></div>'}),
  activity:()=>({title:`${storeInfo().name}: the shift so far.`,body:`<p>Completed workflows for this shift.</p>${stages.filter(s=>current().actions.includes(s.actions[0].id)).map(s=>`<div class="hub-card"><h3>${icon('check')} ${escape(s.label)}</h3><p>${escape(s.outcome)}</p></div>`).join('')||'<div class="hub-card"><h3>A fresh shift</h3><p>Try a workflow in the store channel. Its outcome will appear here.</p></div>'}<p class="source-note">${current().notes.length} notes recorded for this store.</p>`}),
  brief:()=>({title:'Your Monday store briefing.',body:`<p>Four sample stores. A few useful priorities, with the evidence one step away.</p><div class="detail-grid">${stores.map(s=>`<div class="detail-tile"><b>${s.name}</b><span>${s.id==='bankstown'?'Review delivery availability and packing checks.':s.id==='granville'?'Carry the weekend’s useful packing practice into the shift brief.':s.id==='punchbowl'?'Confirm the packaging follow-up before lunch prep.':'Keep the new crew connected to training and the shift leader.'}</span><small>Sample manager focus</small></div>`).join('')}</div><button class="primary-button" data-ask-diagnostic>Ask why Bankstown is down ${icon('arrow-right')}</button>`}),
  'crew-question':()=>({title:'Ask in your store channel.',body:'<p>Ask a teammate or invoke an approved in-channel app. Choose a question to ask the team.</p><div class="search-results"><button class="search-result" data-quick-question="Where is the opening checklist?">Where is the opening checklist? <span>↗</span></button><button class="search-result" data-quick-question="Who is leading tonight’s shift?">Who is leading tonight’s shift? <span>↗</span></button><button class="search-result" data-quick-question="How do I ask for shift cover?">How do I ask for shift cover? <span>↗</span></button></div>'}),
};
function openModal(name) {if(name==='network'){setView('network');$('#experience').scrollIntoView({behavior:'smooth'});return;}const content=modalContent[name]?.();if(content)showDialog(content.title,content.body);}
function startTour() {$('#experience').classList.remove('expanded');connected.start();}
function stopTour() {connected?.pause();}

document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.stage){stopTour();setView('store');setStage(b.dataset.stage);}
  if(b.dataset.view){stopTour();setView(b.dataset.view);}
  if(b.dataset.zone)inspectZone(b.dataset.zone);
  if(b.hasAttribute('data-close-inspector')){$('#zone-inspector').hidden=true;diorama?.selectZone(null);$$('[data-zone]').forEach(el=>el.classList.remove('active'));}
  if(b.dataset.zoneStage){setStage(b.dataset.zoneStage);}
  if(b.dataset.tab)setTab(b.dataset.tab);
  if(b.dataset.slack==='channel')setTab('messages');
  if(b.dataset.slack==='hub')setTab('hub');
  if(b.dataset.slack==='activity')openModal('activity');
  if(b.dataset.role){stopTour();applyPerspective(b.dataset.role);}
  if(b.dataset.explicitManager){closeDialog();applyPerspective('manager');if(b.dataset.explicitManager==='view')setView('network');else setStage('network');}
  if(b.dataset.action==='primary')primaryAction();
  if(b.dataset.action==='secondary')secondaryAction();
  if(b.dataset.confirmStage)completeStage(b.dataset.confirmStage);
  if(b.hasAttribute('data-dismiss'))closeDialog();
  if(b.hasAttribute('data-open-tasks'))setTab('tasks');
  if(b.hasAttribute('data-finish-opening'))completeStage('opening');
  if(b.dataset.modal)openModal(b.dataset.modal);
  if(b.dataset.detail)openModal(b.dataset.detail);
  if(b.dataset.reaction){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));const count=b.querySelector('.reaction-count');count.textContent=String(Number(count.textContent)+(on?1:-1));b.setAttribute('aria-label',`${b.dataset.reaction==='seen'?'Eyes':'Raised hands'}, ${count.textContent} reactions${on?', including you':''}`);}
  if(b.dataset.filter){networkFilter=b.dataset.filter;renderNetwork();}
  if(b.dataset.openStore){closeDialog();setStore(b.dataset.openStore);setView('store');setStage('rush');}
  if(b.hasAttribute('data-ask-diagnostic'))showEvidence();
  if(b.hasAttribute('data-open-diagnostic-stage')){closeDialog();setStore('bankstown');setView('store');setStage('network');}
  if(b.hasAttribute('data-switch-crew')){closeDialog();connected.start();}
  if(b.hasAttribute('data-go-people')){closeDialog();setView('store');setStage('people');}
  if(b.dataset.quickQuestion){const question=b.dataset.quickQuestion;closeDialog();setTab('messages');commit('note',{text:question,stage:state.stage,time:'Now',author:state.role==='crew'?'omar':'sarah'});const answer=question.includes('checklist')?'The opening checklist is in the Store Hub. Use the approved workflow to record your checks.':question.includes('leading')?'Layla is the shift leader in this sample roster. Sarah is the manager on duty.':'Open the approved cover workflow. The workforce app checks availability and asks your manager to approve.';connected.recordEvent(answer,{name:'Store guide',initials:'EJ',role:'Approved app',stage:state.stage});renderChannel();$('#channel-content').scrollTop=$('#channel-content').scrollHeight;}
  if(b.dataset.evidence){const detail={sales:['Sales comparison','The strategy deck’s sample diagnostic shows net sales down 6.4% week on week. In-store transactions are flat. This comparison does not establish the cause on its own.'],delivery:['Delivery availability','The sample feed records 84 paused minutes on Saturday. Check the availability incident and its owner before drawing conclusions.'],orders:['Order mix','Uber Eats orders are down 19% in the sample period. Compare delivery availability, order mix and in-store trade before choosing a response.'],feedback:['Guest feedback','The sample rating moves from 4.6 to 4.4. The deck proposes looking for missing-item themes and assigning a packing check.']}[b.dataset.evidence];showDialog(detail[0],`<p>${detail[1]}</p><p class="source-note">Source: supplied El Jannah strategy deck, illustrative diagnostic example. No live store data is connected.</p><button class="slack-button" data-ask-diagnostic>Back to the diagnosis</button>`);}
});
document.addEventListener('change',event=>{
  if(event.target.id==='store-select'){stopTour();setStore(event.target.value);}
  if(event.target.hasAttribute('data-check')){
    commit('check',{index:Number(event.target.dataset.check)});
    state.stores[state.store].actions=state.stores[state.store].actions.filter(x=>x!=='opening-complete');save();renderJourney();renderHeader();renderChannel();$(`[data-check="${event.target.dataset.check}"]`)?.focus();
  }
});
$('.channel-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
  const options=['messages','hub','tasks'];let i=options.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setTab(options[i]);$(`#tab-${options[i]}`).focus();
});
$('#explode').addEventListener('click',()=>setExplode(exploded>0?0:100));
$('#explode-range').addEventListener('input',event=>setExplode(event.target.value));
$('#rotate').addEventListener('click',()=>{if(!diorama?.renderer)return;const start=!diorama.autoRotate;if(start){paused=false;diorama.setPaused(false);}diorama.setAutoRotate(start);renderMotionControls();});
$('#zoom-in').addEventListener('click',()=>diorama?.zoom(.12));
$('#zoom-out').addEventListener('click',()=>diorama?.zoom(-.12));
$('#motion').addEventListener('click',()=>{paused=!paused;diorama?.setPaused(paused);renderMotionControls();});
function resetSceneView(){diorama?.reset();renderMotionControls();setExplode(0);$('#zone-inspector').hidden=true;$$('[data-zone]').forEach(el=>el.classList.remove('active'));}
$('#reset-view').addEventListener('click',resetSceneView);
$('#scene').addEventListener('keydown',event=>{if(event.key==='Home')resetSceneView();});
$('#expand-slack').addEventListener('click',()=>{const expanded=$('#experience').classList.toggle('expanded');$('#expand-slack').setAttribute('aria-label',expanded?'Restore split view':'Expand Slack channel');});
$('#about').addEventListener('click',()=>openModal('about'));$('#sources').addEventListener('click',()=>openModal('about'));
$('#close-dialog').addEventListener('click',closeDialog);
$('.client-dialog-layer').addEventListener('click',event=>{if(event.target===$('.client-dialog-layer'))closeDialog();});
$('#tour').addEventListener('click',startTour);
$('#next-stage').addEventListener('click',()=>{stopTour();setView('store');const available=stages.filter(s=>state.role==='manager'||s.id!=='network');setStage(available[(available.findIndex(s=>s.id===state.stage)+1)%available.length].id);});
$('#reset-demo').addEventListener('click',()=>showDialog('Start again?',`<p>This clears progress and messages for all four stores, then returns to Omar’s sign-in.</p><div class="dialog-actions"><button class="primary-button" id="confirm-reset">Reset walkthrough</button><button class="slack-button" data-dismiss>Keep my progress</button></div>`));
document.addEventListener('click',event=>{if(event.target.closest('#confirm-reset')){stopTour();state=freshState();drafts.clear();$('#message-input').value='';connected.reset();save();closeDialog();$('#store-select').value=state.store;$('#experience').classList.remove('expanded');$('#expand-slack').setAttribute('aria-label','Expand Slack channel');networkFilter='all';resetSceneView();setView('store');setStage('opening');connected.start();toast('Ready for a fresh shift. Sign in as Omar Haddad.');}});
$('#composer').addEventListener('submit',event=>{event.preventDefault();const text=$('#message-input').value;if(commit('note',{text,stage:state.stage,time:'Now',author:state.role==='crew'?'omar':'sarah',channel:slackShell.currentChannel()})){$('#message-input').value='';drafts.delete(draftKey());renderChannel();$('#channel-content').scrollTop=$('#channel-content').scrollHeight;$('#message-input').focus();}});
$('#message-input').addEventListener('input',()=>setSceneInteraction(state.stage,'input'));
$('#slack-search').addEventListener('click',()=>{
  showDialog('Find a store or a workflow.',`<label class="sr-only" for="search-input">Search stores and workflows</label><input id="search-input" class="search-input" placeholder="Try Bankstown, delivery or opening…" autocomplete="off"><div class="search-results" id="search-results"></div>`);
  const input=$('#search-input');
  const update=()=>{const q=input.value.toLowerCase().trim();const results=[...stores.filter(s=>s.name.toLowerCase().includes(q)).map(s=>`<button class="search-result" data-open-store="${s.id}">#store-${s.id}<small>${s.state} · Store</small></button>`),...stages.filter(s=>(s.label+' '+s.title+' '+s.description).toLowerCase().includes(q)).map(s=>`<button class="search-result" data-search-stage="${s.id}">${escape(s.label)}<small>Workflow</small></button>`)];$('#search-results').innerHTML=results.length?results.join(''):'<p>No matches. Try a store name or a shift moment.</p>';};
  input.addEventListener('input',update);update();input.focus();
});
document.addEventListener('click',event=>{const result=event.target.closest('[data-search-stage]');if(result){closeDialog();setView('store');setStage(result.dataset.searchStage);}});
window.addEventListener('pagehide',event=>{if(!event.persisted)diorama?.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)diorama?.resize();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches){paused=true;diorama?.setPaused(true);renderMotionControls();}});
connected=initialiseConnectedStore({
  storeIds:stores.map(s=>s.id),storeId:()=>state.store,storeName:()=>storeInfo().name,role:()=>state.role,stage:()=>state.stage,currentView:()=>view,
  escape,icon,message,toast,showDialog,closeDialog,interaction:setSceneInteraction,setRole:applyPerspective,setView,setStore,navigate:id=>setStage(id),
  showChannels:()=>slackShell?.showChannels(),
  openingDone:()=>current().checks.length===4,openTasks:()=>{setStage('opening');setTab('tasks');},
  refresh:()=>{renderJourney();renderHeader();renderChannel();},resize:()=>diorama?.resize(),
  synchroniseOperation:(id,status)=>{if(state.role!=='manager')return;if(id==='drive-thru'){commit('assign-issue');if(status==='resolved'){commit('resolve-issue');commit('rush-run-playbook');}}if(id==='delivery'&&status==='resolved')commit('supply-resume-delivery');if(id==='diagnostics'&&state.store==='bankstown')commit('network-assign-focus');},
});
slackShell=initialiseSlackShell({
  escape,icon,message,storeId:()=>state.store,storeName:()=>storeInfo().name,storeTeam:()=>storeInfo().team,role:()=>state.role,stage:()=>state.stage,
  beforeChannelChange:()=>stashDraft(),
  restoreDraft:()=>{$('#message-input').value=drafts.get(draftKey())||'';},
  onChannelSelected:id=>{renderHeader();renderChannel();connected.channelSelected(id);},
  getChannelMessages:id=>current().notes.filter(n=>(n.channel||'store')===id).map(n=>({name:people[n.author||'omar'].name,role:'Team member',text:n.text,time:n.time})),
  showDialog,closeDialog,openFeature:id=>connected.openFeature(id),openModal,setTab,
  openStoreChannel:()=>{if(state.stage==='network')setStage('rush');},
  getDraft:()=>$('#message-input').value,
  getActivity:()=>[...stages.filter(s=>current().actions.includes(s.actions[0].id)).map(s=>({name:s.label,text:s.outcome,stage:s.id})),...connected.activity()],
});
renderJourney();renderHeader();renderChannel();save();
if(connected.needsSignIn())connected.start();
