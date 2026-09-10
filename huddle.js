import { avatar, people } from './identities.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const paths = {
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v2a7 7 0 0 0 14 0v-2M12 20v2M8 22h8"/>',
  camera: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
  screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4m-3-10 3-3 3 3m-3-3v7"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
  settings: '<path d="m10 3-1 3-3 1-3 3 2 2-2 2 3 3 3 1 1 3h4l1-3 3-1 3-3-2-2 2-2-3-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  thread: '<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/>',
  leave: '<path d="M3 14c4-5 14-5 18 0v4h-5v-4M3 14v4h5v-4"/>',
  notes: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  send: '<path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg class="sh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.thread}</svg>`;

function participant(key, waiting = false) {
  const person = people[key];
  return `<div class="sh-participant ${waiting ? 'is-waiting' : ''}" data-huddle-person="${key}" aria-label="${escape(person.name)}${waiting ? ', waiting to join' : ', in the huddle'}">${avatar(key, 'sh-photo')}<span class="sh-participant-shade"></span><span class="sh-tile-badge">${waiting ? 'Not joined' : key === 'sarah' ? 'Host' : 'In the huddle'}</span><span class="sh-person-caption"><b>${escape(person.name)}${key === 'omar' ? ' <small>(you)</small>' : ''}</b><span class="sh-role-label">${escape(person.role)}</span></span><span class="sh-tile-mic" aria-hidden="true">${icon('mic')}</span>${key === 'omar' ? '<span class="sh-reaction-result" data-huddle-reaction-result aria-live="polite" hidden></span>' : ''}</div>`;
}

/** Returns a static, local huddle preview. No call or device access is started. */
export function renderHuddle({ storeName = 'Bankstown', storeId = 'bankstown', issue = {}, note = '', role = 'crew' } = {}) {
  return `<section class="slack-huddle" data-huddle-root data-huddle-role="${escape(role)}" aria-label="Store huddle">
    <header class="sh-header"><div class="sh-channel">${icon('headphones')}<div><b>#store-${escape(storeId)}</b><span>${escape(storeName)} <span aria-hidden="true">·</span> Huddle</span></div></div><span class="sh-preview-badge">TEAM</span></header>
    <div class="sh-huddle-meta"><span class="sh-participants-count" data-huddle-count>2 people here</span><span class="sh-room-subtitle">Packing & collection team</span></div>
    <div class="sh-layout">
      <div class="sh-call-stage"><div class="sh-participant-grid">${participant('sarah')}${participant('layla')}${participant('omar', true)}<div class="sh-share-tile" data-huddle-share-tile><span class="sh-share-symbol">${icon('headphones')}</span><b>Talk it through.</b><span>Keep the issue and next step together.</span></div></div><p id="huddle-status" class="sh-status" role="status">Sarah and Layla are ready. Join when you are.</p><button type="button" class="primary-button sh-join" data-huddle-join>${icon('headphones')} Join the huddle</button></div>
      <aside class="sh-thread" data-huddle-thread aria-label="Huddle thread"><div class="sh-thread-heading"><b>Thread</b><span>Kept with the huddle</span></div><div class="sh-thread-messages" data-huddle-messages><article class="sh-thread-message">${avatar('sarah', 'sh-thread-avatar')}<div><b>${escape(people.sarah.name)} <small>18:42</small></b><p>Let’s work through this together and leave a clear next step for the team.</p></div></article><div class="sh-attached-issue"><span>${icon('notes')} Reported issue</span><b>${escape(issue.category || 'Packing & collection')}</b><p>${escape(issue.text || 'Review the reported store issue together.')}</p><small>Owner: ${escape(people.sarah.name)}</small><button type="button" class="sh-message-reaction" data-huddle-thread-reaction="👍" aria-pressed="false" aria-label="Add thumbs up to the thread, 2 reactions" disabled><span class="sh-native-emoji" aria-hidden="true">👍</span><span data-huddle-thread-reaction-count>2</span></button></div><div class="sh-thread-after-join" data-huddle-thread-note hidden><article class="sh-thread-message">${avatar('layla', 'sh-thread-avatar')}<div><b>${escape(people.layla.name)} <small>18:43</small></b><p>${escape(note)}</p></div></article></div><div class="sh-notes-preview" data-huddle-notes-preview hidden><b>Huddle notes</b><p>${escape(note)}</p><small>The agreed next step for the team.</small></div></div><form class="sh-thread-composer" data-huddle-thread-form><label class="sh-visually-hidden" for="huddle-reply">Reply in the huddle thread</label><textarea id="huddle-reply" name="reply" maxlength="240" rows="2" placeholder="Reply in thread" disabled></textarea><div><small>Keep the team in the loop.</small><button type="submit" data-huddle-reply-send aria-label="Reply to the thread" disabled>${icon('send')}</button></div></form></aside>
    </div>
    <div id="huddle-outcome" class="sh-outcome" data-huddle-note="${escape(note)}"></div>
    <div class="sh-tool-tray" data-huddle-emoji-picker hidden><b>Add a reaction</b><div>${[['👍','Thumbs up'],['👏','Applause'],['❤️','Heart'],['🎉','Celebrate']].map(([emoji,label]) => `<button type="button" data-huddle-reaction="${emoji}" aria-label="React with ${label.toLowerCase()}">${emoji}</button>`).join('')}</div></div>
    <div class="sh-tool-tray sh-settings" data-huddle-settings hidden><b>Huddle preferences</b><label><input type="checkbox" data-huddle-role-labels> Show participant roles</label><small>Choose what you see during the huddle.</small></div>
    <div class="sh-toolbar" role="group" aria-label="Huddle controls"><button type="button" class="sh-notes-toggle" data-huddle-control="notes" aria-pressed="false" disabled>${icon('notes')} Notes <span data-huddle-notes-label>off</span></button><div class="sh-device-controls"><button type="button" class="sh-control" data-huddle-control="mic" aria-label="Mute microphone" aria-pressed="false" title="Mute microphone">${icon('mic')}</button><button type="button" class="sh-control" data-huddle-control="camera" aria-label="Turn off camera" aria-pressed="true" title="Turn off camera">${icon('camera')}</button><button type="button" class="sh-control" data-huddle-control="screen" aria-label="Share the Store Hub" aria-pressed="false" title="Share the Store Hub" disabled>${icon('screen')}</button><button type="button" class="sh-control" data-huddle-control="emoji" aria-label="Add a reaction" aria-expanded="false" title="Add a reaction" disabled>${icon('smile')}</button><button type="button" class="sh-control" data-huddle-control="settings" aria-label="Huddle settings" aria-expanded="false" title="Huddle settings">${icon('settings')}</button></div><button type="button" class="sh-leave" data-huddle-control="leave">${icon('leave')} <span>Leave</span></button><button type="button" class="sh-control sh-thread-toggle" data-huddle-control="thread" aria-label="Hide huddle thread" aria-pressed="true" title="Hide huddle thread">${icon('thread')}</button></div>
    <p class="sh-preview-status" data-huddle-preview-status role="status">Talk through the issue and agree on the next step.</p>
  </section>`;
}

/** Mount after renderHuddle. Call destroy before replacing or closing the dialog. */
export function initialiseHuddle(root, { onJoin, onFinish, onLeave, joined: initialJoined = false, toast = () => {} } = {}) {
  const huddle = root?.matches?.('[data-huddle-root]') ? root : root?.querySelector?.('[data-huddle-root]');
  if (!huddle) return { destroy() {} };
  const dialog = huddle.closest('dialog');
  dialog?.classList.add('slack-huddle-dialog');
  const events = new AbortController();
  const $ = selector => huddle.querySelector(selector);
  const control = name => $(`[data-huddle-control="${name}"]`);
  let joined = false, finished = false, muted = false, camera = true, sharing = false, notes = false, destroyed = false;

  function updatePreviewStatus() {
    $('[data-huddle-preview-status]').textContent = `Microphone ${muted ? 'muted' : 'on'} · Camera ${camera ? 'on' : 'off'}${sharing ? ' · Store Hub shared' : ''}`;
  }
  function toggleThread(show) {
    $('[data-huddle-thread]').hidden = !show;
    huddle.classList.toggle('thread-hidden', !show);
    control('thread').setAttribute('aria-pressed', String(show));
    control('thread').setAttribute('aria-label', `${show ? 'Hide' : 'Show'} huddle thread`);
    control('thread').title = `${show ? 'Hide' : 'Show'} huddle thread`;
  }
  function toggleTray(name) {
    const tray = $(`[data-huddle-${name === 'emoji' ? 'emoji-picker' : 'settings'}]`);
    const open = tray.hidden;
    for (const id of ['emoji', 'settings']) {
      $(`[data-huddle-${id === 'emoji' ? 'emoji-picker' : 'settings'}]`).hidden = true;
      control(id).setAttribute('aria-expanded', 'false');
    }
    tray.hidden = !open;
    control(name).setAttribute('aria-expanded', String(open));
  }
  function join(notify = true) {
    if (joined) return;
    joined = true;
    huddle.classList.add('is-joined');
    $('[data-huddle-join]').hidden = true;
    const tile = $('[data-huddle-person="omar"]');
    tile.classList.remove('is-waiting');
    tile.setAttribute('aria-label', `${people.omar.name}, in the huddle`);
    tile.querySelector('.sh-tile-badge').textContent = 'In the huddle';
    $('[data-huddle-count]').textContent = '3 people here';
    $('#huddle-status').textContent = 'Omar has joined Sarah and Layla in the huddle.';
    $('[data-huddle-thread-note]').hidden = false;
    for (const element of huddle.querySelectorAll('[data-huddle-control="screen"], [data-huddle-control="emoji"], [data-huddle-control="notes"], [data-huddle-thread-reaction], #huddle-reply, [data-huddle-reply-send]')) element.disabled = false;
    $('#huddle-outcome').innerHTML = `<span>${icon('check')} The agreed next step is ready in the thread.</span><button type="button" class="primary-button sh-finish" data-huddle-finish>Keep the agreed action in the channel</button>`;
    toggleThread(true);
    if (notify) onJoin?.();
  }
  function finish(button) {
    if (!joined || finished) return;
    finished = true;
    button.disabled = true;
    try {
      if (onFinish?.() === false && !destroyed) { finished = false; button.disabled = false; }
    } catch {
      finished = false;
      if (!destroyed) button.disabled = false;
      toast('The action could not be recorded. Try again.');
    }
  }
  function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !huddle.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-huddle-join')) { join(); return; }
    if (button.hasAttribute('data-huddle-finish')) { finish(button); return; }
    if (button.hasAttribute('data-huddle-thread-reaction') && joined) {
      const selected = button.getAttribute('aria-pressed') !== 'true';
      const count = selected ? 3 : 2;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Remove' : 'Add'} thumbs up ${selected ? 'from' : 'to'} the thread, ${count} reactions`);
      $('[data-huddle-thread-reaction-count]').textContent = String(count);
      return;
    }
    const reaction = button.dataset.huddleReaction;
    if (reaction && joined) {
      const result = $('[data-huddle-reaction-result]');
      result.textContent = reaction;
      result.setAttribute('aria-label', `${people.omar.name} reacted ${reaction}`);
      result.hidden = false;
      $('[data-huddle-emoji-picker]').hidden = true;
      control('emoji').setAttribute('aria-expanded', 'false');
      control('emoji').focus({ preventScroll: true });
      return;
    }
    switch (button.dataset.huddleControl) {
      case 'mic':
        muted = !muted; huddle.classList.toggle('is-muted', muted);
        button.setAttribute('aria-pressed', String(muted));
        button.title = `${muted ? 'Unmute' : 'Mute'} microphone`; button.setAttribute('aria-label', button.title);
        updatePreviewStatus(); break;
      case 'camera':
        camera = !camera; huddle.classList.toggle('camera-off', !camera);
        button.setAttribute('aria-pressed', String(camera));
        button.title = `Turn ${camera ? 'off' : 'on'} camera`; button.setAttribute('aria-label', button.title);
        updatePreviewStatus(); break;
      case 'screen':
        if (!joined) break;
        sharing = !sharing; huddle.classList.toggle('is-sharing', sharing); button.setAttribute('aria-pressed', String(sharing));
        button.title = `${sharing ? 'Stop sharing the' : 'Share the'} Store Hub`; button.setAttribute('aria-label', button.title);
        $('[data-huddle-share-tile]').innerHTML = sharing ? `<div class="sh-screen-preview"><span>${icon('screen')} Shared Store Hub</span><b>Store Hub</b><p>Reported issue</p><div>Owner: ${escape(people.sarah.name)}</div><small>The source record stays with its app.</small></div>` : `<span class="sh-share-symbol">${icon('headphones')}</span><b>Talk it through.</b><span>Keep the issue and next step together.</span>`;
        updatePreviewStatus(); break;
      case 'emoji': if (joined) toggleTray('emoji'); break;
      case 'settings': toggleTray('settings'); break;
      case 'thread': toggleThread($('[data-huddle-thread]').hidden); break;
      case 'notes':
        if (!joined) break;
        notes = !notes; button.setAttribute('aria-pressed', String(notes)); $('[data-huddle-notes-label]').textContent = notes ? 'on' : 'off';
        $('[data-huddle-notes-preview]').hidden = !notes; if (notes) toggleThread(true); break;
      case 'leave': onLeave?.(); break;
    }
  }
  function onSubmit(event) {
    if (!event.target.matches('[data-huddle-thread-form]')) return;
    event.preventDefault();
    if (!joined) return;
    const input = $('#huddle-reply');
    const text = input.value.trim().slice(0, 240);
    if (!text) { input.focus(); return; }
    const message = document.createElement('article');
    message.className = 'sh-thread-message sh-own-reply';
    message.innerHTML = `${avatar('omar', 'sh-thread-avatar')}<div><b>${escape(people.omar.name)} <small>Now</small></b><p>${escape(text)}</p></div>`;
    const messages = $('[data-huddle-messages]');
    messages.append(message);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
  }
  huddle.addEventListener('click', onClick, { signal: events.signal });
  huddle.addEventListener('submit', onSubmit, { signal: events.signal });
  huddle.addEventListener('change', event => {
    if (event.target.matches('[data-huddle-role-labels]')) huddle.classList.toggle('show-roles', event.target.checked);
  }, { signal: events.signal });
  if (initialJoined) join(false);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      dialog?.classList.remove('slack-huddle-dialog');
    },
  };
}


const slackMark = '<svg class="huddle-invite-app-icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff"/><g fill="#36c5f0"><rect x="5" y="12" width="10" height="5" rx="2.5"/><circle cx="12.5" cy="7.5" r="2.5"/></g><g fill="#2eb67d"><rect x="16" y="5" width="5" height="10" rx="2.5"/><circle cx="24.5" cy="12.5" r="2.5"/></g><g fill="#ecb22e"><rect x="18" y="18" width="10" height="5" rx="2.5"/><circle cx="20.5" cy="26.5" r="2.5"/></g><g fill="#e01e5a"><rect x="10" y="19" width="5" height="10" rx="2.5"/><circle cx="6.5" cy="20.5" r="2.5"/></g></svg>';

/** The invitation stays inside the existing Slack client overlay. */
export function renderHuddleInvitation({ storeName = 'Bankstown', storeId = 'bankstown' } = {}) {
  return `<section class="huddle-invitation" data-huddle-invitation aria-label="Huddle invitation for ${escape(storeName)}">
    <div class="huddle-invite-notification" role="status"><div class="huddle-invite-app">${slackMark}<b>SLACK</b><span>now</span></div><div class="huddle-invite-notification-copy"><b>#store-${escape(storeId)}</b><p>${escape(people.sarah.name)} is inviting you to a huddle</p></div></div>
    <div class="huddle-invite-sheet"><span class="huddle-invite-handle" aria-hidden="true"></span><div class="huddle-invite-heading">${icon('headphones')}<h3>2 people are in a huddle</h3></div><p class="huddle-invite-channel">#store-${escape(storeId)}</p><div class="huddle-invite-people" aria-label="People in the huddle">${['sarah','layla'].map(key => `<div>${avatar(key, 'huddle-invite-avatar')}<span>${escape(people[key].name)}</span></div>`).join('')}</div><div class="huddle-invite-actions"><button type="button" data-huddle-dismiss>Dismiss</button><button type="button" class="primary-button" data-huddle-join>${icon('headphones')} Join</button></div></div>
  </section>`;
}

/** Accepting replaces the invitation; the parent owns the room and saved state. */
export function initialiseHuddleInvitation(root, { onJoin, onDismiss } = {}) {
  const invitation = root?.matches?.('[data-huddle-invitation]') ? root : root?.querySelector?.('[data-huddle-invitation]');
  if (!invitation) return { destroy() {} };
  const dialog = invitation.closest('dialog');
  dialog?.classList.add('slack-huddle-invitation');
  const events = new AbortController();
  let handled = false, destroyed = false;
  invitation.addEventListener('click', event => {
    const button = event.target.closest('[data-huddle-join], [data-huddle-dismiss]');
    if (!button || !invitation.contains(button) || handled || button.disabled) return;
    const callback = button.hasAttribute('data-huddle-join') ? onJoin : onDismiss;
    if (typeof callback !== 'function') return;
    handled = true;
    button.disabled = true;
    try {
      if (callback() === false && !destroyed) { handled = false; button.disabled = false; }
    } catch (error) {
      if (!destroyed) { handled = false; button.disabled = false; }
      throw error;
    }
  }, { signal: events.signal });
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      dialog?.classList.remove('slack-huddle-invitation');
    },
  };
}
