const CREW_STEPS = new Set(['access', 'channels', 'clips', 'canvas', 'lists', 'shifts', 'workflows', 'huddles', 'agents', 'governance']);
const OPERATION_STEPS = new Set(['complaints', 'drive-thru', 'delivery', 'refunds', 'sales', 'diagnostics', 'weekly-pack', 'leaderboard', 'follow-up', 'review']);

/** A visual next-click cue. It never clicks, submits, plays media or advances a step. */
export function initialiseClickGuidance() {
  const $ = selector => document.querySelector(selector);
  let model = { active: false, exploring: false, intro: false, mode: 'crew', step: 0, total: 10, id: '', done: false };
  let target = null;
  let queued = false;
  let cueSignature = '';
  let ensureVisibility = false;
  const checkedAccessResults = new WeakSet();
  let revealGeneration = 0;

  function actionable(element) {
    return element instanceof HTMLElement && element.matches('button')
      && !element.matches(':disabled, [aria-disabled="true"]')
      && !element.closest('[hidden], [inert]')
      && getComputedStyle(element).visibility !== 'hidden'
      && element.getClientRects().length > 0;
  }

  function first(root, ...selectors) {
    if (!root) return null;
    for (const selector of selectors) {
      const match = [...root.querySelectorAll(selector)].find(actionable);
      if (match) return match;
    }
    return null;
  }

  function buttonLabel(button) {
    if (button?.matches('[data-workspace-channel]')) {
      const name = button.querySelector('b')?.textContent.trim();
      if (name) return `#${name.replace(/^#/, '')}`;
    }
    const text = button?.textContent?.trim();
    return (text || button?.getAttribute('aria-label') || 'Continue')
      .replace(/\s+/g, ' ').replace(/[→↗✓]+\s*$/, '').trim();
  }

  function recommendation(button, detail = '') {
    return { button, title: button ? `Click ${buttonLabel(button)}.` : '', detail };
  }

  function dockRecommendation() {
    const button = first($('#journey-dock'), '#flow-next', '[data-guide-resume]', '[data-guide-next]', '[data-manager-next]', 'button.primary-button');
    return recommendation(button, model.done ? 'Your update is recorded. Continue when you are ready.' : 'Pick up this step where you left it.');
  }

  function crewRecommendation(dialog) {
    const id = model.id;
    const agentFinish = first(dialog, '[data-agent-finish]');
    if (agentFinish) return recommendation(agentFinish, 'The reply is saved in the store channel.');
    if (id === 'shifts' && dialog.querySelector('[data-request-open-shift]')) {
      const requested = [...dialog.querySelectorAll('[data-request-open-shift]')].some(button => button.disabled);
      return requested
        ? recommendation(first(dialog, '[data-feature="shifts"]'), 'Your request is awaiting manager approval. Return to your shift.')
        : recommendation(first(dialog, '[data-request-open-shift]', '[data-feature="shifts"]'), 'Request an open shift, or return to your shift.');
    }
    if (id === 'access') return recommendation(first(dialog, '[data-verify-access]', '[data-access-next]'), 'Sign in with Omar’s Employee ID EJ-014 and approve the security check.');
    if (id === 'clips') {
      const watched = first(dialog, '#clip-complete [data-clip-read]');
      if (watched) return recommendation(watched, 'Confirm you have watched the shift briefing.');
      const transcript = first(dialog, '.clip-transcript[open] [data-clip-read]');
      if (transcript) return recommendation(transcript, 'Confirm you have read the briefing.');
      const video = dialog.querySelector('#briefing-video');
      if (video && !video.paused && !video.ended) return { button: null, title: 'The briefing is playing.', detail: 'Watch it through, or read the transcript below.' };
      if (video?.error) return { button: null, title: 'Read the transcript below.', detail: 'The clip is unavailable. Reading the transcript completes the same step.' };
      return recommendation(first(dialog, '[data-play-briefing]'), 'Watch the short clip, or open its transcript.');
    }
    if (id === 'canvas') return recommendation(first(dialog, '[data-canvas-read]'), 'Read the shift contacts, current brief and source links.');
    if (id === 'lists') return recommendation(first(dialog, '[data-list-read]'), 'Check the task owners and status. The full check workflow is optional.');
    if (id === 'shifts') {
      return recommendation(first(dialog, '[data-clock-in]', '[data-feature="access"]'), 'Check Omar’s schedule, then clock in for the shift.');
    }
    if (id === 'workflows') {
      const text = dialog.querySelector('#issue-form textarea')?.value.trim();
      return recommendation(first(dialog, '#issue-form button[type="submit"]'), text ? 'Review the report, or edit it before sending it to Sarah.' : 'Add a short issue description before submitting it.');
    }
    if (id === 'huddles') return recommendation(first(dialog, '[data-huddle-finish]', '[data-huddle-join]'), dialog.querySelector('[data-huddle-finish]') ? 'Keep the agreed next step with the reported issue.' : 'Join Sarah and Layla to work through the reported issue.');
    if (id === 'agents') {
      const question = dialog.querySelector('#agent-form textarea')?.value.trim();
      return recommendation(first(dialog, '#agent-form button[type="submit"]'), question ? 'Send the question, or write your own.' : 'Write a question for the approved store guide first.');
    }
    if (id === 'governance') {
      const clockIn = first(dialog, '[data-feature="shifts"]');
      if (clockIn) return recommendation(clockIn, 'Clock in before finishing the shift.');
      const accessResult = dialog.querySelector('#access-result');
      if (accessResult && /restricted|restrictions checked/i.test(accessResult.textContent || '')) checkedAccessResults.add(accessResult);
      const checked = Boolean(accessResult && checkedAccessResults.has(accessResult));
      return checked
        ? recommendation(first(dialog, '[data-clock-out]'), 'The access boundary is clear. Finish Omar’s shift.')
        : recommendation(first(dialog, '[data-access-check="external"]', '[data-access-check="connect"]'), 'Try an external connection to see the frontline restriction.');
    }
    return { button: null, title: 'Explore this step.', detail: 'Choose the action you would like to try.' };
  }

  function managerRecommendation(dialog) {
    const id = CSS.escape(model.id);
    if (model.id === 'review') return recommendation(first(dialog, '#review-form button[type="submit"]'), 'Read the response and make any edits before approving it.');
    if (model.id === 'follow-up') {
      const age = first(dialog, '[data-operation-age]');
      return age
        ? recommendation(age, 'Show the reminder for an unresolved action.')
        : recommendation(first(dialog, '[data-operation-escalate="follow-up"]', '[data-operation-resolve="follow-up"]'), 'Escalate the open action with its owner and history attached.');
    }
    return recommendation(first(dialog, `[data-operation-assign="${id}"]`, `[data-operation-resolve="${id}"]`), 'Review the evidence, give the action an owner and record its follow-up.');
  }

  function inferRecommendation() {
    const dialog = $('#dialog');
    if ((model.active || model.exploring) && dialog?.open) {
      const gate = first(dialog, '#switch-manager-feature', '[data-explicit-manager]');
      if (gate) return recommendation(gate, 'This decision belongs to the manager perspective.');
      // The open screen owns the next click, even if an earlier action completed the step.
      const access = first(dialog, '[data-verify-access]', '[data-access-next]');
      if (access && model.id !== 'access') return recommendation(access, 'Sign in as Omar first.');
      if (dialog.querySelector('#issue-form')) {
        const text = dialog.querySelector('#issue-form textarea')?.value.trim();
        return recommendation(first(dialog, '#issue-form button[type="submit"]'), model.id === 'huddles' ? 'Log an issue first so the huddle has the right context.' : text ? 'Review the report, or edit it before sending it to Sarah.' : 'Add a short issue description before submitting it.');
      }
      const result = model.mode === 'manager' && OPERATION_STEPS.has(model.id)
        ? managerRecommendation(dialog) : CREW_STEPS.has(model.id) ? crewRecommendation(dialog) : null;
      if (result?.button || result?.title) return result;
      const action = first(dialog, 'button[type="submit"]', 'button.primary-button');
      if (action) return recommendation(action, 'Review the example in Slack, then choose this action when you are ready.');
      const close = first(dialog, '#close-dialog', '[data-dismiss]');
      if (close) return recommendation(close, model.active ? 'Return to the walkthrough when you have finished exploring this preview.' : 'Return to the store channel when you have finished exploring this preview.');
      return { button: null, title: 'Explore this step.', detail: 'Read the example and choose an available action in Slack.' };
    }
    if (dialog?.open) {
      const action = first($('#dialog-content'), 'button.primary-button', 'button[type="submit"]') || first(dialog, '#close-dialog', '[data-dismiss]');
      return recommendation(action, 'Review the details, then use the highlighted action.');
    }
    if (model.active && model.id === 'summary') {
      const next = first($('#journey-dock'), '[data-open-manager-playbooks]', '[data-guided-network]');
      return recommendation(next, next?.hasAttribute('data-guided-network') ? 'The manager playbooks are complete. See how the work connects across stores.' : 'The crew shift is complete. Follow the same work into the manager’s next step.');
    }
    if((model.active||model.exploring)&&model.id==='channels'&&!model.done){
      const row=first($('.slack-panel'),'#mobile-channel-list [data-workspace-channel="store"]','#desktop-channel-list [data-workspace-channel="store"]');
      return row?recommendation(row,'Your ten assigned channels are in Slack. Open your store conversation.'):recommendation(first($('.slack-panel'),'[data-slack-back]','[data-mobile-nav="home"]'),'Open Home to see your assigned channels.');
    }
    if (model.active) return dockRecommendation();
    if (model.intro && !dialog?.open) return recommendation(actionable($('#tour')) ? $('#tour') : null, 'Follow one connected shift, at your own pace.');
    return { button: null, title: '', detail: '' };
  }

  function scrollInsideContent(button) {
    if(!button?.closest('.slack-panel'))return;
    for(let content=button.parentElement;content&&content.closest('.slack-panel');content=content.parentElement){
      if(!/auto|scroll/.test(getComputedStyle(content).overflowY)||!content.clientHeight)continue;
      const viewport=content.getBoundingClientRect(),bounds=button.getBoundingClientRect(),margin=12;
      if(bounds.top<viewport.top+margin)content.scrollTop-=viewport.top+margin-bounds.top;
      else if(bounds.bottom>viewport.bottom-margin)content.scrollTop+=bounds.bottom-viewport.bottom+margin;
    }
  }

  function renderCue(result) {
    const coach = $('#click-coach');
    const dock = $('#journey-dock');
    const dialogOpen = Boolean($('#dialog')?.open);
    const nativeChannels=!dialogOpen&&(model.active||model.exploring)&&model.id==='channels'&&!model.done;
    if (dock) dock.style.display = dialogOpen||nativeChannels ? 'none' : '';
    const show = Boolean((dialogOpen||nativeChannels) && (result === undefined || result.title));
    if (coach) coach.hidden = !show;
    const hasDock = Boolean(dock && !dock.hidden && !dialogOpen && !nativeChannels && dock.children.length);
    const assistant = $('#demo-assistant');
    if (assistant) assistant.hidden = !(show || hasDock);
    $('#demo-grid')?.classList.toggle('has-demo-guide', show || hasDock);
    if (!coach || !show || result === undefined) return;
    const signature = JSON.stringify([model.active, model.exploring, model.id, model.mode, model.step, model.total, result.title, result.detail]);
    if (cueSignature === signature && coach.querySelector('.coach-copy')) return;
    cueSignature = signature;
    const progress = document.createElement('span');
    progress.className = 'coach-progress';
    progress.textContent = !model.active ? 'NEXT STEP' : model.id === 'summary' ? 'WALKTHROUGH COMPLETE' : `${model.mode === 'manager' ? 'PLAYBOOK' : 'STEP'} ${String(model.step + 1).padStart(2, '0')} OF ${model.total}`;
    const dot = document.createElement('span');
    dot.className = 'coach-dot';
    dot.textContent = '↓';
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'coach-copy';
    const title = document.createElement('b');
    title.textContent = result.title;
    const description = document.createElement('span');
    description.textContent = result.detail || '';
    copy.append(title, description);
    coach.replaceChildren(progress, dot, copy);
  }

  function render() {
    queued = false;
    const checkVisibility = ensureVisibility;
    ensureVisibility = false;
    // Reveal the external assistant before checking whether its dock button is actionable.
    renderCue();
    const result = inferRecommendation();
    renderCue(result);
    const next = actionable(result.button) ? result.button : null;
    const changed = target !== next;
    if (changed && target) {
      target.classList.remove('guided-target');
      target.removeAttribute('data-recommended-target');
    }
    target = next;
    if (target) {
      target.classList.add('guided-target');
      target.setAttribute('data-recommended-target', 'true');
    }
    if (changed || checkVisibility) scrollInsideContent(target);
    if (changed && target && ($('#dialog')?.open || (model.active && $('#journey-dock')?.contains(target)) || model.id==='channels')) revealCurrentAction();
  }

  function refresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(render);
  }

  function refreshViewport() { ensureVisibility = true; refresh(); }
  window.addEventListener('resize', refreshViewport);
  function revealCurrentAction() {
    const generation = ++revealGeneration;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (generation !== revealGeneration || !target) return;
      const activeDock = model.active && $('#journey-dock')?.contains(target);
      if (!$('#dialog')?.open && !activeDock && model.id!=='channels') return;
      scrollInsideContent(target);
      const viewportHeight = window.visualViewport?.height || innerHeight;
      const margin = 12;
      let bounds = target.getBoundingClientRect();
      const context = activeDock ? $('#demo-assistant') : $('#click-coach');
      if (context && !context.hidden && context.getClientRects().length) {
        const contextBounds = context.getBoundingClientRect();
        const top = Math.min(bounds.top, contextBounds.top);
        const bottom = Math.max(bounds.bottom, contextBounds.bottom);
        // Keep the external instruction and its action together when they fit.
        if (bottom - top <= viewportHeight - margin * 2) bounds = { ...bounds, top, bottom };
      }
      const delta = bounds.top < margin ? bounds.top - margin : bounds.bottom > viewportHeight - margin ? bounds.bottom - viewportHeight + margin : 0;
      if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
      const finalBounds = target.getBoundingClientRect();
      if (finalBounds.left < 0 || finalBounds.right > innerWidth || finalBounds.top < 0 || finalBounds.bottom > viewportHeight) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
    }));
  }
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-device], [data-flow-pause], #expand-slack')) {
      refreshViewport();
      revealCurrentAction();
    }
  });
  if (typeof ResizeObserver !== 'undefined' && $('#dialog-content')) {
    const viewportObserver = new ResizeObserver(refreshViewport);
    viewportObserver.observe($('#dialog-content'));
  }
  const observer = new MutationObserver(refresh);
  if ($('#dialog-content')) observer.observe($('#dialog-content'), { childList: true, subtree: true });
  if ($('#journey-dock')) observer.observe($('#journey-dock'), { childList: true, subtree: true });
  if ($('#dialog')) observer.observe($('#dialog'), { attributes: true, attributeFilter: ['open'] });
  for (const event of ['input', 'change', 'toggle', 'play', 'playing', 'pause', 'ended', 'loadedmetadata', 'error']) {
    document.addEventListener(event, refresh, true);
  }

  return {
    update(value = {}) {
      const total = Number.isInteger(value.total) && value.total > 0 ? value.total : 10;
      model = { active: value.active === true, exploring: value.exploring === true, intro: value.intro === true, mode: value.mode === 'manager' ? 'manager' : 'crew', step: Math.max(0, Math.min(total - 1, Number.isInteger(value.step) ? value.step : 0)), total, id: typeof value.id === 'string' ? value.id : '', done: value.done === true };
      refresh();
    },
    refresh,
    focusTarget() {
      render();
      if (!target) return false;
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      target.focus({ preventScroll: true });
      return true;
    },
  };
}
