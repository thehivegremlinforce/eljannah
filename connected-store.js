import { frontlineFeatures, operationCases } from './operations.js';
import { freshFrontlineStore, transitionFrontline, parseFrontline } from './frontline-state.js';
import { initialiseClickGuidance } from './click-guidance.js';
import { presenterOpening, crewPresenter, managerPresenter, presenterClosing } from './presenter-content.js';
import { avatar, brandAvatar, personLabel } from './identities.js';
import { renderHuddle, initialiseHuddle, renderHuddleInvitation, initialiseHuddleInvitation } from './huddle.js';

const KEY = 'el-jannah-connected-store-v2';
const prompts = {
  access:['Start with the person.','Sign in with your employee ID, then approve the security check.','Try email-free access'],
  channels:['Give the crew a focused space.','Explore the ten assigned channels. Admins keep this set relevant to the shift.','Explore the channels'],
  clips:['Catch up before the coals are hot.','Watch the short captioned briefing, or read its transcript.','Play the shift briefing'],
  canvas:['Put the essentials within reach.','Read the Store Hub, with the promotion, contacts and procedure links together.','Open the Store Hub'],
  lists:['See who is doing what.','Read the task list. The crew can see status; approved workflows record changes.','Open the shift list'],
  shifts:['Start the shift in the right place.','View your schedule and clock in through the workforce app.','View my shift'],
  workflows:['Ask for help without the runaround.','Submit a packing issue through an approved workflow. The request gets an owner.','Run the issue workflow'],
  huddles:['Talk it through with the team.','Join a short huddle about the issue, then capture the agreed next step.','Join the huddle'],
  agents:['Get help where the work happens.','Ask the approved store guide a question. Its reply stays in the channel.','Ask the store guide'],
  governance:['Finish the shift with clear boundaries.','Try the workspace access checks, then clock out. The next shift keeps the context.','Review access and clock out'],
};

export function initialiseConnectedStore(b) {
  const $=s=>document.querySelector(s), esc=b.escape, icon=b.icon;
  let records;try{records=parseFrontline(localStorage.getItem(KEY),b.storeIds);}catch{records={};}
  let guided=false, step=0, device='mobile', lastFeature=null, managerGuided=false, managerStep=0, journeySummary=false, intro=true, presenterSelection=null;
  const returnSteps=[];
  let huddleController=null;
  function disposeDialog(){huddleController?.destroy();huddleController=null;}
  const guidance=initialiseClickGuidance();
  try{const savedDevice=localStorage.getItem('el-jannah-preview-device');if(['mobile','desktop'].includes(savedDevice))device=savedDevice;}catch{}
  const state=()=>records[b.storeId()] ||= freshFrontlineStore();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(records));localStorage.setItem('el-jannah-preview-device',device);}catch{b.toast('Progress is available for this session. Browser storage is unavailable.');}};
  function commit(action,detail={}) {
    const result=transitionFrontline(state(),action,detail);
    if(result.error){b.toast(result.error);return false;}
    records[b.storeId()]=result.store;save();render();return true;
  }
  function recordEvent(text,{name='Store OS',initials='EJ',role='Approved app',stage=b.stage()}={}) {
    commit('log-event',{stage,name,initials,role,text});
  }
  function finish(action,feature,text,detail={}) {
    if(!commit(action,detail))return false;
    recordEvent(text);b.closeDialog();b.refresh();render();
    b.interaction(feature,'success');b.toast(text);
    if(!guided&&!managerGuided&&returnSteps.length){const destination=returnSteps.pop();openFeature(destination);}else requestAnimationFrame(()=>$('#flow-next')?.focus());
    return true;
  }
  const progress=()=>frontlineFeatures.filter(f=>state().completed.includes(f.id)).length;
  const operationDone=id=>id==='review'?state().operations[id]?.status==='approved':id==='follow-up'?['escalated','resolved'].includes(state().operations[id]?.status):state().operations[id]?.status==='resolved';
  const nextUnfinished=(items,isDone,after)=>{for(let offset=1;offset<=items.length;offset++){const index=(after+offset)%items.length;if(!isDone(items[index].id))return index;}return -1;};
  function nextCrewIndex(){while(returnSteps.length&&state().completed.includes(returnSteps.at(-1)))returnSteps.pop();return returnSteps.length?frontlineFeatures.findIndex(f=>f.id===returnSteps.at(-1)):nextUnfinished(frontlineFeatures,id=>state().completed.includes(id),step);}
  const stepOutcomes={access:'Omar is signed in. His assigned workspace is ready.',channels:'The crew has ten relevant channels for the shift.',clips:'Omar has caught up with the shift briefing.',canvas:'Today’s brief, contacts and records are close at hand.',lists:'The crew can see the task owners and what comes next.',shifts:'Omar is clocked in through the workforce app.',workflows:'Sarah owns the reported issue and has the details.',huddles:'The agreed action is recorded for the whole team.',agents:'The question and the answer stay in the store channel.',governance:'Omar is clocked out. The next shift keeps the context.'};
  function presenterNote(){
    if(journeySummary==='crew')return {label:'From employee to manager',problem:'A request from the floor needs a clear owner and a visible follow-up.',say:'We have followed Omar through a connected shift. Now let’s look at Sarah’s side: how a manager sees the evidence, takes ownership and follows the work through. The next ten playbooks are separate sample situations at Bankstown.',click:'Click Start the manager walkthrough.'};
    if(journeySummary==='manager'||b.currentView?.()==='network')return {label:'The connected store network',...presenterClosing};
    const mode=managerGuided?'manager':guided?'crew':presenterSelection?.mode;
    const id=managerGuided?operationCases[managerStep].id:guided?frontlineFeatures[step].id:presenterSelection?.id;
    if(mode==='manager'&&b.role()==='manager'&&managerPresenter[id])return {label:operationCases.find(c=>c.id===id).title,...managerPresenter[id]};
    if(mode==='crew'&&b.role()==='crew'&&crewPresenter[id])return {label:frontlineFeatures.find(f=>f.id===id).title,...crewPresenter[id]};
    if(b.role()==='manager')return {label:'Manager view',problem:'Store signals need to reach someone who can act on them.',say:'Now we are with Sarah, the store manager. Each playbook brings the evidence, an owner and the follow-up into one conversation.',click:'Choose Start the manager walkthrough in the manager section, or open a playbook.'};
    return {label:'Start with Omar · Frontline employee',...presenterOpening,click:presenterOpening.click||'Sign in as Omar, then follow the highlighted action inside Slack.'};
  }
  function renderPresenter(){
    const note=presenterNote();
    for(const [selector,value] of [['#presenter-step-label',note.label],['#presenter-problem',note.problem],['#presenter-say',note.say],['#presenter-click',note.click]]){const el=$(selector),copy=String(value||'').replaceAll('#store-bankstown',`#store-${b.storeId()}`);if(el&&el.textContent!==copy)el.textContent=copy;}
    $('#presenter-notes [data-guide-focus]').hidden=!(guided||managerGuided||journeySummary||intro);
  }
  function renderGuidance(){
    const active=guided||managerGuided, item=managerGuided?operationCases[managerStep]:frontlineFeatures[step], index=managerGuided?managerStep:step;
    const done=managerGuided?operationDone(item.id):state().completed.includes(item.id);
    $('#experience').classList.toggle('guided-mode',active||Boolean(journeySummary));
    $('#frontline-guide').hidden=!active;
    $('#frontline-guide').innerHTML=active?`<div class="guide-count"><b>${String(index+1).padStart(2,'0')}</b><span>OF 10</span></div><div class="guide-copy"><p class="eyebrow">${managerGuided?'THE MANAGER WALKTHROUGH':'THE CONNECTED CREW SHIFT'}</p><h2>${esc(item.title)}</h2><p class="guide-problem"><b>What this solves:</b> ${esc((managerGuided?managerPresenter:crewPresenter)[item.id]?.problem||'Keep the work and its next step together.')}</p></div><div class="guide-actions"><button class="primary-button" data-guide-focus>Show me where to click ${icon('arrow-right')}</button><div><button class="text-button" ${managerGuided?'data-manager-back':'data-flow-back'} ${index===0?'disabled':''}>Back</button><span>·</span><button class="text-button" data-flow-pause>Explore freely</button></div></div>`:'';
    $('#journey-dock').hidden=!active&&!journeySummary;
    if(journeySummary){
      const crew=journeySummary==='crew';
      $('#journey-dock').innerHTML=`<div class="journey-dock-copy"><small>${crew?'CREW SHIFT':'MANAGER WALKTHROUGH'} COMPLETE</small><b>${crew?'One connected shift, from start to finish.':'Every store has a clear next step.'}</b><p>${crew?`${progress()} of 10 capabilities explored for ${esc(b.storeName())}. Omar’s work stays with the team.`:'All ten manager playbooks are complete for Bankstown.'}</p><p>${crew?'Next, follow Bankstown’s ten sample manager playbooks.':'Open the network to see how the same approach connects stores.'}</p></div><button class="journey-dock-action primary-button" ${crew?'data-open-manager-playbooks':'data-guided-network'}>${crew?'Start the manager walkthrough':'Open the store network'} ${icon('arrow-right')}</button>`;
    }else if(active){
      const nextIndex=managerGuided?nextUnfinished(operationCases,operationDone,managerStep):nextCrewIndex();
      const nextItem=nextIndex<0?null:(managerGuided?operationCases:frontlineFeatures)[nextIndex];
      const title=done?`${item.title}: done`:'Your next click';
      const detail=done?(managerGuided?'The owner and outcome are recorded in this store.':stepOutcomes[item.id]):'Open this step in Slack and follow the highlighted button.';
      const action=done?(nextItem?`Continue: ${nextItem.title}`:managerGuided?'Finish the manager walkthrough':'Finish the crew walkthrough'):`Resume: ${item.title}`;
      const attr=done?(managerGuided?'data-manager-next':'id="flow-next" data-flow-next'):'data-guide-resume';
      $('#journey-dock').innerHTML=`<div class="journey-dock-copy"><small>${managerGuided?'MANAGER':'CREW'} · ${index+1} OF 10</small><b>${esc(title)}</b><p>${esc(detail)}</p></div><button class="journey-dock-action primary-button" ${attr}>${esc(action)} ${icon('arrow-right')}</button>`;
    }else $('#journey-dock').replaceChildren();
    const selection=!active&&!journeySummary?presenterSelection:null;
    guidance.update({active:active||Boolean(journeySummary),exploring:Boolean(selection),intro:intro&&!active&&!journeySummary,mode:managerGuided?'manager':selection?.mode||'crew',step:selection?(selection.mode==='manager'?operationCases:frontlineFeatures).findIndex(f=>f.id===selection.id):index,total:10,id:journeySummary?'summary':selection?.id||item.id,done:selection?(selection.mode==='manager'?operationDone(selection.id):state().completed.includes(selection.id)):done});
    renderPresenter();
  }
  const huddleNote=()=>state().issue?.category==='Equipment'?'Sarah assigns the equipment report to store support. Layla reviews the available station and coordinates the team using the approved procedure.':state().issue?.category==='Stock & supplies'?'Sarah checks availability with supply support. Layla confirms the packing plan and Omar updates the collection team.':'Layla reviews the reported packing issue with Omar and adds the agreed final check. Sarah follows up after the next service window.';
  function render() {
    const feature=frontlineFeatures[step],done=state().completed.includes(feature.id),next=frontlineFeatures[step+1];
    $('#frontline-progress').textContent=`${progress()} / 10 explored`;
    $('#frontline-features').innerHTML=frontlineFeatures.map((f,i)=>`<button class="feature-choice ${state().completed.includes(f.id)?'done':''}" data-feature="${f.id}"><span class="feature-number">${state().completed.includes(f.id)?icon('check'):String(i+1).padStart(2,'0')}</span><span><b>${esc(f.title)}</b><small>${esc(f.description)}</small></span>${icon('arrow-up-right')}</button>`).join('');
    $('#playbook-count').textContent=`${Object.keys(state().operations).length} / 10 tried`;
    $('#store-playbooks').innerHTML=operationCases.map(c=>`<button class="playbook-choice" data-operation="${c.id}"><span>${String(c.number).padStart(2,'0')}</span><b>${esc(c.title)}</b><small>${state().operations[c.id]?esc(state().operations[c.id].status):'Try the playbook'} ${icon('arrow-up-right')}</small></button>`).join('');
    $('#tour').innerHTML=`${icon('play')} ${progress()===10?'Review the completed shift':progress()?'Continue the employee walkthrough':'Start employee walkthrough'} ${icon('arrow-right')}`;
    $('.tour-caption').textContent='Start with Omar. Follow the highlighted button at each step.';
    document.querySelectorAll('[data-device]').forEach(el=>{el.classList.toggle('active',el.dataset.device===device);el.setAttribute('aria-pressed',String(el.dataset.device===device));});
    $('#experience').classList.toggle('mobile-preview',device==='mobile');
    $('#frontline-session').innerHTML=`${icon(state().verified?'check':'phone')} ${state().checkedOut?'Shift complete':state().clockedIn?'Clocked in':state().verified?'Signed in':'Employee access'}${state().verified?' · Omar':''}`;
    renderGuidance();
  }
  function selectStep(index,{open=false}={}) {
    step=Math.max(0,Math.min(9,index));
    b.navigate(frontlineFeatures[step].stage);render();
    if(open)openFeature(frontlineFeatures[step].id);
  }
  function showCompletion() {
    b.closeDialog();guided=false;managerGuided=false;journeySummary='crew';intro=false;b.setView('store');render();requestAnimationFrame(()=>guidance.focusTarget());
  }
  function start() {
    b.setRole('crew');
    const first=frontlineFeatures.findIndex(f=>!state().completed.includes(f.id));
    if(first<0){showCompletion();return;}
    guided=true;managerGuided=false;journeySummary=false;intro=false;returnSteps.length=0;b.setRole('crew');b.setView('store');
    selectStep(first);
    openFeature(frontlineFeatures[step].id);
  }
  function next() {
    if(!state().completed.includes(frontlineFeatures[step].id)){b.toast('Try this step first, or choose Explore freely.');return;}
    b.closeDialog();
    const nextIndex=nextCrewIndex();if(nextIndex<0){showCompletion();return;}
    if(returnSteps.at(-1)===frontlineFeatures[nextIndex].id)returnSteps.pop();
    selectStep(nextIndex,{open:true});
  }
  function startManagerGuide(){
    b.closeDialog();guided=false;managerGuided=false;journeySummary=false;intro=false;returnSteps.length=0;b.setRole('manager');
    if(b.storeId()!=='bankstown')b.setStore('bankstown');
    const first=operationCases.findIndex(c=>!operationDone(c.id));
    if(first<0){showManagerCompletion();return;}
    managerStep=first;managerGuided=true;openOperation(operationCases[first].id);render();
  }
  function showManagerCompletion(){
    b.closeDialog();managerGuided=false;journeySummary='manager';b.setView('store');render();requestAnimationFrame(()=>guidance.focusTarget());
  }
  function nextManager(){
    if(!operationDone(operationCases[managerStep].id))return;
    b.closeDialog();const nextIndex=nextUnfinished(operationCases,operationDone,managerStep);
    if(nextIndex<0){showManagerCompletion();return;}managerStep=nextIndex;openOperation(operationCases[nextIndex].id);render();
  }
  function featureShell(id,body) {
    lastFeature=id;const f=frontlineFeatures.find(f=>f.id===id);
    b.showDialog(id==='access'?'Sign in to El Jannah':f.title,`<p class="feature-context">${esc(b.storeName())} · ${id==='access'?'Employee sign-in':'Store team'}</p>${body}`,{feature:id});
  }
  function openActiveHuddle(){
    featureShell('huddles',renderHuddle({storeName:b.storeName(),storeId:b.storeId(),issue:state().issue,note:huddleNote(),role:b.role()}));
    huddleController=initialiseHuddle($('#dialog-content'),{joined:true,onFinish:()=>finish('join-huddle','huddles',`Huddle action recorded by the team: ${huddleNote()}`),onLeave:()=>b.closeDialog(),toast:b.toast});
    b.interaction('huddles');
  }
  function needAccess(id) {
    if(state().verified)return false;
    if(returnSteps.at(-1)!==id)returnSteps.push(id);
    b.toast('Sign in with your employee ID first.');openFeature('access');return true;
  }
  function openFeature(id) {
    const f=frontlineFeatures.find(f=>f.id===id);if(!f)return;
    presenterSelection={mode:'crew',id};
    intro=false;journeySummary=false;
    if(guided)step=frontlineFeatures.indexOf(f);
    b.setView('store');b.navigate(f.stage);render();
    if(guided&&state().completed.includes(id)){b.closeDialog();render();guidance.focusTarget();return;}
    if(id==='access') {
      featureShell(id,`<p>Welcome back. Sign in with your employee ID to start your shift.</p><div class="demo-login"><div class="login-identity">${avatar('omar')}<div><b>Omar Haddad</b><small>Crew member · ${esc(b.storeName())}</small></div></div><label>Employee ID<input value="EJ-014" readonly aria-label="Employee ID"></label><button class="primary-button" data-access-next>Continue ${icon('arrow-right')}</button></div><p class="signin-help">No corporate email needed.</p>`);
    } else if(id==='channels') {
      lastFeature=id;b.closeDialog();b.showChannels();renderGuidance();
    } else if(id==='clips') {
      featureShell(id,`<p>Catch the key points from Layla’s briefing before service.</p><button class="primary-button" data-play-briefing>Play the 12-second briefing ${icon('play')}</button><video id="briefing-video" controls playsinline preload="metadata" aria-label="Captioned shift briefing"><source src="assets/shift-briefing-indexed.webm" type="video/webm"><track kind="captions" src="assets/shift-briefing.vtt" srclang="en" label="English captions" default>Your browser cannot play this clip. Read the transcript below.</video><p class="media-caption">12-second shift briefing · Captioned · No audio</p><details class="clip-transcript"><summary>Or read the briefing transcript</summary><p>Welcome to the shift. Check the Store Hub for today’s roles and opening brief.</p><p>Keep an eye on packing and collection. Log an issue through the approved workflow.</p><p>Need a hand? Ask in the store channel. Leave a clear handover for the next crew.</p><button class="primary-button" data-clip-read>I’ve read the briefing ${icon('check')}</button></details><div id="clip-complete"></div>`);
      const video=$('#briefing-video');
      video.addEventListener('ended',()=>{if(video.isConnected){$('#clip-complete').innerHTML='<button class="primary-button" data-clip-read>Briefing watched. Continue</button>';guidance.refresh();}},{once:true});
      for(const event of ['play','pause'])video.addEventListener(event,()=>{if(!video.isConnected)return;const button=$('[data-play-briefing]');button.hidden=!video.paused;button.innerHTML=`${video.currentTime?'Resume':'Play'} the briefing ${icon('play')}`;guidance.refresh();});
    } else if(id==='canvas') {
      featureShell(id,`<div class="canvas-preview"><div class="readonly-label">${icon('document')} STORE HUB CANVAS · VIEW ONLY</div><h3>${esc(b.storeName())}: today’s essentials</h3><div class="detail-grid"><div class="detail-tile"><b>Who is on?</b><div class="store-contacts">${['sarah','layla','omar'].map(key=>personLabel(key,{detail:true})).join('')}</div></div><div class="detail-tile"><b>Today’s focus</b><span>Check sauces and sides before each order leaves the packing bench.</span></div><div class="detail-tile"><b>People records</b><span>Contracts, policies requiring acknowledgement and training records stay in Employment Hero.</span><button class="text-button" data-record-info="people">Preview the record link</button></div><div class="detail-tile"><b>Food safety & WHS</b><span>Follow the approved procedure. Notices that must be visible in store stay on the WHS board.</span><button class="text-button" data-record-info="safety">Preview the record link</button></div></div><p>Updates and links are maintained by the business. Crew read the current version here.</p></div><button class="primary-button" data-canvas-read>Store brief read ${icon('check')}</button>`);
    } else if(id==='lists') {
      featureShell(id,`<p>The shift list makes owners and status easy to see. Crew read the list; an approved workflow records changes.</p><div class="readonly-label">${icon('check-square')} SHIFT LIST · VIEW ONLY</div><div class="list-preview"><div class="list-row list-head"><b>Task</b><b>Owner</b><b>Status</b></div><div class="list-row"><span>Opening checks</span>${personLabel('layla')}<span>${b.openingDone()?'Complete':'To confirm'}</span></div><div class="list-row"><span>Collection area</span>${personLabel('omar')}<span>Ready</span></div><div class="list-row"><span>Packaging delivery</span>${personLabel('sarah')}<span>Tomorrow</span></div></div><p class="source-note">There are no editable cells here. To change a check, use the approved opening workflow.</p><div class="dialog-actions"><button class="primary-button" data-list-read>I’ve read the task list ${icon('check')}</button><button class="slack-button" data-list-workflow>Open the check workflow</button></div>`);
    } else if(id==='shifts') {
      if(needAccess(id))return;
      featureShell(id,`<p>Your schedule, clock-in and open shifts are connected through a workforce app.</p><div class="workforce-card"><span class="eyebrow">MY SHIFT</span><h3>Omar’s shift</h3>${personLabel('omar')}<strong>16:00 to 22:30</strong><p>${esc(b.storeName())} · Packing & collection<br>Shift leader: Layla Darwish</p><span class="status-chip">${state().checkedOut?'Shift finished':state().clockedIn?'Clocked in':'Ready to clock in'}</span></div><div class="dialog-actions"><button class="primary-button" data-clock-in ${state().checkedOut?'disabled':''}>${state().clockedIn?'Continue with my shift':'Clock in'} ${icon('clock')}</button><button class="slack-button" data-open-shifts>View open shifts</button></div><p class="source-note">Your roster and approvals stay in the workforce app.</p>`);
    } else if(id==='workflows') {
      if(needAccess(id))return;
      featureShell(id,`<p>Omar spots a packing problem. One approved form gives Sarah the context and creates a visible next step in the store channel.</p><form id="issue-form" class="feature-form"><label>What needs a hand?<select name="category"><option>Packing & collection</option><option>Equipment</option><option>Stock & supplies</option></select></label><label>What did you notice?<textarea name="issue" maxlength="500" required>Garlic sauce tubs are being missed at the packing bench. Can we add a final check?</textarea></label><span class="form-note">Assigned to ${personLabel('sarah',{detail:true})}</span><button class="primary-button" type="submit">Submit issue ${icon('send')}</button></form>`);
    } else if(id==='huddles') {
      if(!state().issue){if(returnSteps.at(-1)!=='huddles')returnSteps.push('huddles');b.toast('Log the packing issue first so the team has the details.');openFeature('workflows');return;}
      featureShell(id,renderHuddleInvitation({storeName:b.storeName(),storeId:b.storeId()}));
      huddleController=initialiseHuddleInvitation($('#dialog-content'),{onJoin:openActiveHuddle,onDismiss:()=>b.closeDialog()});
    } else if(id==='agents') {
      featureShell(id,`<p>Ask the approved store guide in #store-${esc(b.storeId())}. It can point to the right briefing or workflow without leaving the conversation.</p><div class="agent-channel"><span class="readonly-label"># STORE-${esc(b.storeId().toUpperCase())}</span><div class="agent-greeting">${brandAvatar()}<p><b>Store guide <small>APP</small></b><br>I can help with the Store Hub, shift contacts and the cover workflow.</p></div><form id="agent-form" class="feature-form"><label>Your question<textarea name="question" maxlength="240" required>How do I ask for shift cover?</textarea></label><button class="primary-button" type="submit">Ask the approved agent ${icon('send')}</button></form><div id="agent-answer"></div></div><p class="source-note">The business manages approved apps and their access.</p>`);
    } else if(id==='governance') {
      if(needAccess(id))return;
      featureShell(id,`<p>Omar’s access stays inside the assigned frontline workspace. Try each connection to see the boundary, then finish the shift.</p><div class="governance-checks"><button class="slack-button" data-access-check="internal">Assigned store channel</button><button class="slack-button" data-access-check="external">External direct message</button><button class="slack-button" data-access-check="connect">Slack Connect</button></div><div id="access-result" class="access-result">${state().externalBlocked?'External access restrictions checked.':'Choose an access check.'}</div><div class="workforce-card compact"><b>${state().checkedOut?'Shift finished':state().clockedIn?'Your shift is clocked in':'Clock in before trying the end of shift'}</b><p>The approved workforce app retains the time record. The store keeps its messages, issue and agreed action for the next shift.</p></div><div class="dialog-actions"><button class="primary-button" data-clock-out ${state().checkedOut?'disabled':''}>Clock out ${icon('check')}</button>${!state().clockedIn&&!state().checkedOut?'<button class="slack-button" data-feature="shifts">Go to clock-in</button>':''}</div><p class="source-note">Your assigned workspace keeps store information with the right team.</p>`);
    }
  }
  function additionalMessages(stage) {
    return state().events.filter(event=>event.stage===stage).map(event=>b.message({...event,time:'Now'},'<div class="message-source">Connected shift</div>')).join('');
  }
  function managerGate(callback) {
    if(b.role()==='manager'){callback();return;}
    b.showDialog('This decision belongs to a manager.',`<p>Crew can raise issues and ask for help. Store managers review approvals and the wider store view.</p><button class="primary-button" id="switch-manager-feature">Switch to manager perspective ${icon('arrow-right')}</button>`);
    $('#switch-manager-feature').addEventListener('click',()=>{b.setRole('manager');callback();},{once:true});
  }
  function openOperation(id) {
    const c=operationCases.find(item=>item.id===id);if(!c)return;
    presenterSelection={mode:'manager',id};renderGuidance();
    managerGate(()=>{
      intro=false;journeySummary=false;guided=false;presenterSelection={mode:'manager',id};if(managerGuided)managerStep=operationCases.indexOf(c);if(c.id==='diagnostics'&&b.storeId()!=='bankstown')b.setStore('bankstown');b.setView('store');b.navigate(c.stage);render();
      const op=state().operations[id]||{},text=c.outcome.replaceAll('{store}',b.storeName());
      let actions=`<button class="primary-button" data-operation-assign="${id}" ${op.status?'disabled':''}>${op.status?'Action assigned':esc(c.actionLabel)}</button>`;
      if(id==='follow-up')actions=`<button class="primary-button" data-operation-age ${op.elapsedHours>=48?'disabled':''}>${op.elapsedHours>=48?'48-hour reminder recorded':'Send the 48-hour reminder'}</button><button class="slack-button" data-operation-escalate="${id}" ${op.elapsedHours>=48&&op.status==='assigned'?'':'disabled'}>Escalate to Karim</button>`;
      if(id==='review')actions=`<form id="review-form" class="feature-form"><label>Response draft<textarea name="draft" maxlength="1500" required ${op.status==='approved'?'readonly':''}>${esc(op.draft||'Thanks for letting us know about the missing item. We’re sorry your order was incomplete. Please contact our store support team with your order details so we can look into it. We’ve also asked the shift leader to check the packing handover.')}</textarea></label><p class="form-note">Sarah reviews the wording before approval. The approved wording stays with the review.</p><button class="primary-button" type="submit" ${op.status==='approved'?'disabled':''}>${op.status==='approved'?'Draft approved':'Approve this draft'}</button></form>`;
      if(op.status&&id!=='review')actions+=`<button class="slack-button" data-operation-resolve="${id}" ${op.status==='resolved'?'disabled':''}>${op.status==='resolved'?'Resolved':'Record a resolved follow-up'}</button>`;
      b.showDialog(c.title,`<p class="feature-context">PLAYBOOK ${String(c.number).padStart(2,'0')} OF 10 · ${esc(b.storeName())} · MANAGER VIEW</p><p>${esc(c.trigger)}</p><div class="evidence-grid">${c.evidence.map(e=>`<div><small>${esc(e.label)}</small><b>${esc(e.value)}</b></div>`).join('')}</div><ol class="step-list">${c.playbook.map(p=>`<li><span>${esc(p)}</span></li>`).join('')}</ol>${op.status?`<div class="feature-result">${icon('check')} ${esc(op.status==='resolved'?'The follow-up is resolved.':op.status==='escalated'?'The open action is with Karim. Its original owner and context remain attached.':id==='follow-up'?'A reminder has been recorded. The complaint is still open.':id==='review'?'The response is approved.':text)}<small>Owner: Sarah · Store: ${esc(b.storeName())}${op.elapsedHours?` · Open for: ${op.elapsedHours} hours`:''}</small></div>`:''}<div class="dialog-actions">${actions}</div><p class="source-note">${esc(c.source)} · Signals use store baselines; escalation follows the original action. Quiet hours and volume caps keep unnecessary alerts out of the channel.</p>`);
    });
  }
  function updateOperation(id,changes,text) {
    if(b.role()!=='manager'){b.toast('Switch to the manager perspective to make this decision.');return;}
    if(id==='follow-up'&&changes.status==='escalated'&&(!(state().operations[id]?.elapsedHours>=48)||state().operations[id]?.status!=='assigned')){b.toast('Only an open complaint with its 48-hour reminder can be escalated.');return;}
    if(!commit('update-operation',{id,changes}))return;
    b.synchroniseOperation(id,changes.status);
    const c=operationCases.find(x=>x.id===id);recordEvent(text,{stage:c.stage});b.refresh();
    if(managerGuided&&operationDone(id)){b.closeDialog();render();requestAnimationFrame(()=>$('#journey-dock .journey-dock-action')?.focus());}else openOperation(id);
    b.interaction(c.stage,'success');
  }
  function operationsForStage(stage) {
    const items=operationCases.filter(c=>c.stage===stage);
    return items.length?`<div class="related-playbooks"><b>Related store playbooks</b>${items.map(c=>`<button data-operation="${c.id}">${esc(c.title)} ${icon('arrow-right')}</button>`).join('')}</div>`:'';
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.hasAttribute('data-presenter-open')){const notes=$('#presenter-notes');notes.open=true;notes.scrollIntoView({block:'nearest',behavior:'instant'});notes.querySelector('summary').focus({preventScroll:true});}
    if(el.dataset.feature){
      if(!guided&&!el.closest('#dialog'))returnSteps.length=0;
      if(el.dataset.feature==='shifts'&&el.closest('#dialog')&&$('#dialog [data-clock-out]')&&returnSteps.at(-1)!=='governance')returnSteps.push('governance');
      openFeature(el.dataset.feature);
    }
    if(el.hasAttribute('data-flow-next'))next();
    if(el.hasAttribute('data-flow-back')){b.closeDialog();selectStep(step-1,{open:true});}
    if(el.hasAttribute('data-flow-pause')){guided=false;managerGuided=false;journeySummary=false;intro=false;render();}
    if(el.hasAttribute('data-guide-focus'))guidance.focusTarget();
    if(el.hasAttribute('data-guide-resume')){if(managerGuided)openOperation(operationCases[managerStep].id);else openFeature(frontlineFeatures[step].id);}
    if(el.hasAttribute('data-manager-next'))nextManager();
    if(el.hasAttribute('data-manager-back')){b.closeDialog();managerStep=Math.max(0,managerStep-1);openOperation(operationCases[managerStep].id);render();}
    if(el.hasAttribute('data-start-manager-guide'))startManagerGuide();
    if(el.hasAttribute('data-guided-network')){b.closeDialog();guided=false;managerGuided=false;journeySummary=false;render();b.setView('network');}
    if(el.dataset.device){
      device=el.dataset.device;save();render();
      const choosingChannels=(guided&&frontlineFeatures[step].id==='channels')||(!guided&&presenterSelection?.id==='channels');
      if(choosingChannels&&!state().completed.includes('channels')&&!$('#dialog').open)b.showChannels();
      renderGuidance();b.resize();
    }
    if(el.hasAttribute('data-access-next'))featureShell('access',`<p>One more step to keep your account secure.</p><div class="mfa-card"><span>${icon('phone')}</span><b>Confirm your sign-in</b><p>Omar Haddad · Employee EJ-014<br>${esc(b.storeName())}</p><button class="primary-button" data-verify-access>Approve sign-in ${icon('check')}</button></div>`);
    if(el.hasAttribute('data-verify-access'))finish('verify-demo-access','access',`Omar Haddad is signed in at ${b.storeName()}. The team’s channels, briefing and shift checks are ready.`);
    if(el.hasAttribute('data-clip-read'))finish('clip-seen','clips','Omar caught up with the pre-shift briefing. The clip and transcript remain available to the next crew.');
    if(el.hasAttribute('data-play-briefing')){$('#briefing-video')?.play().catch(()=>b.toast('Open the transcript below to read the briefing.'));}
    if(el.hasAttribute('data-canvas-read'))finish('canvas-read','canvas','Omar has read the Store Hub. Shift contacts, current procedures and people record links are close at hand.');
    if(el.hasAttribute('data-list-read'))finish('list-read','lists','Omar reviewed the view-only shift list. Owners and task status are visible to the crew.');
    if(el.hasAttribute('data-list-workflow')){commit('list-read');recordEvent('Omar opened the approved check workflow from the view-only shift list.');b.closeDialog();b.openTasks();render();}
    if(el.hasAttribute('data-clock-in'))finish('clock-in','shifts','Omar clocked in through the workforce app. The time record stays with that app.');
    if(el.hasAttribute('data-open-shifts'))featureShell('shifts',`<p>Two open shifts in the integrated workforce app.</p><div class="detail-grid"><div class="detail-tile"><b>Friday · 17:00 to 22:30</b><span>Packing & collection</span><button class="slack-button" data-request-open-shift="Friday">Request this shift</button></div><div class="detail-tile"><b>Saturday · 12:00 to 17:00</b><span>Counter support</span><button class="slack-button" data-request-open-shift="Saturday">Request this shift</button></div></div><p class="source-note">A request does not change the roster. Sarah approves it in the workforce app.</p><button class="slack-button" data-feature="shifts">Back to my shift</button>`);
    if(el.dataset.requestOpenShift){recordEvent(`Omar requested the ${el.dataset.requestOpenShift} open shift. It is awaiting Sarah’s approval in the workforce app.`);el.disabled=true;el.textContent='Requested · awaiting approval';b.refresh();b.interaction('shifts','success');}
    if(el.hasAttribute('data-agent-finish')){b.closeDialog();b.refresh();render();$('#flow-next')?.focus();}
    if(el.dataset.accessCheck){const internal=el.dataset.accessCheck==='internal';if(!internal)commit('check-external');$('#access-result').innerHTML=`<b>${internal?'Allowed in the assigned workspace':'Restricted for this frontline role'}</b><p>${internal?'Omar can read and post in the channels assigned to this store.':'External DMs and Slack Connect are unavailable to this frontline role. Raise the request in #store-support so an authorised manager can help.'}</p>`;}
    if(el.hasAttribute('data-clock-out'))finish('clock-out','governance','Omar clocked out in the workforce app. Store work and the next shift’s handover remain in the governed workspace.');
    if(el.dataset.recordInfo){const people=el.dataset.recordInfo==='people';$('#dialog-content').insertAdjacentHTML('beforeend',`<div class="record-link-preview" role="status"><b>${people?'Employment Hero record link':'Approved safety record link'}</b><p>${people?'This would open the approved people record for acknowledgement or signature. Slack announces the change and links to it.':'This would open the current source procedure. Required physical notices remain visible on the store’s WHS board.'}</p><small>Source destination preview. No external system is opened.</small></div>`);}
    if(el.dataset.operation)openOperation(el.dataset.operation);
    if(el.dataset.operationAssign){const c=operationCases.find(c=>c.id===el.dataset.operationAssign);updateOperation(c.id,{status:'assigned',owner:'Sarah'},c.outcome.replaceAll('{store}',b.storeName()));}
    if(el.hasAttribute('data-operation-age'))updateOperation('follow-up',{status:'assigned',owner:'Sarah',elapsedHours:48},'The complaint reached 48 hours unresolved. Sarah received a reminder on the existing action.');
    if(el.dataset.operationEscalate)updateOperation(el.dataset.operationEscalate,{status:'escalated',owner:'Sarah'},'The unresolved complaint was escalated to Karim with its original owner and history attached.');
    if(el.dataset.operationResolve)updateOperation(el.dataset.operationResolve,{status:'resolved',owner:'Sarah'},'Sarah recorded a resolved follow-up for the store action.');
    if(el.hasAttribute('data-open-manager-playbooks'))startManagerGuide();
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='issue-form'){event.preventDefault();const data=new FormData(event.target);const text=String(data.get('issue')||'').trim();finish('submit-issue','workflows',`Omar reported: ${text} Sarah owns the response in the store channel.`,{text,category:data.get('category')});}
    if(event.target.id==='agent-form'){
      event.preventDefault();const question=String(new FormData(event.target).get('question')||'').trim();if(!commit('ask-agent',{question}))return;
      const answer=/who|leading|leader|on duty|contact/i.test(question)?'Layla is your shift leader. Sarah is the manager on duty in this store. Ask in the channel so the team has the context.':/cover|roster|swap|open shift/i.test(question)?'Use the approved cover workflow from your store channel. The workforce app checks availability and asks Sarah to approve. The roster stays in that app.':/check|canvas|hub|procedure/i.test(question)?'The Store Hub contains the current briefing and approved procedure links. Crew can read the canvas and task list. Record a check through the approved opening workflow.':/time|schedule|when/i.test(question)?'Your shift is 16:00 to 22:30, on packing and collection. View My shift in the approved workforce app for its schedule and clock controls.':'The store guide can help with the Store Hub, shift contacts and the cover workflow. For that question, ask Sarah in the store channel.';
      recordEvent(question,{name:'Omar',initials:'OM',role:'Team member'});recordEvent(answer,{name:'Store guide',initials:'EJ',role:'Approved app'});
      $('#agent-answer').innerHTML=`<div class="brief-answer"><b>Store guide · Approved app</b><p>${esc(answer)}</p><small>Source: Store Hub and approved workflow brief</small></div><button class="primary-button" data-agent-finish>Keep the answer in the channel ${icon('check')}</button>`;b.refresh();b.interaction('agents','success');$('#agent-answer').scrollIntoView({block:'nearest',behavior:'instant'});
    }
    if(event.target.id==='review-form'){event.preventDefault();const draft=String(new FormData(event.target).get('draft')||'').trim();if(!draft){b.toast('Write a response before approving it.');return;}updateOperation('review',{status:'approved',owner:'Sarah',draft},'Sarah reviewed and approved the guest response. The exact approved wording is saved with the review playbook.');}
  });
  $('#briefing-video')?.pause();
  $('#dialog').addEventListener('close',()=>{if(!$('#dialog').open){$('#briefing-video')?.pause();if(!guided)returnSteps.length=0;}});
  render();
  return {
    start,openFeature,openOperation,additionalMessages,operationsForStage,recordEvent,disposeDialog,
    needsSignIn:()=>!state().verified,
    channelSelected(id){
      if((guided&&frontlineFeatures[step].id==='channels')||(!guided&&presenterSelection?.id==='channels')){
        if(!state().completed.includes('channels'))finish('select-channel','channels',`Omar opened #${id==='store'?`store-${b.storeId()}`:id}. The team’s ten assigned channels are available in Slack.`,{channel:id});
        else guidance.refresh();
      }
    },
    activity:()=>state().events.map(event=>({...event})),
    refresh:render,refreshPresenter:renderPresenter,
    synchroniseStage(id){const map={rush:'drive-thru',supply:'delivery',network:'diagnostics'};if(map[id])commit('update-operation',{id:map[id],changes:{status:id==='network'?'assigned':'resolved',owner:'Sarah'}});},
    pause(){guided=false;managerGuided=false;journeySummary=false;intro=false;presenterSelection=null;render();},
    storeChanged(){guided=false;managerGuided=false;journeySummary=false;presenterSelection=null;returnSteps.length=0;render();},
    reset(){records={};guided=false;managerGuided=false;journeySummary=false;intro=true;presenterSelection=null;step=0;device='mobile';returnSteps.length=0;$('#presenter-notes').open=false;save();render();},
    crewSummary(){return state().checkedOut?'Shift complete':state().clockedIn?'Clocked in':state().verified?'Verified':'Explore the crew shift';},
  };
}
