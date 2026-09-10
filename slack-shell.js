import { CURATED_CHANNEL_IDS } from './frontline-state.js';
import { people, personFor, avatar, brandAvatar } from './identities.js';

const channelDetails = {
  store: { name: 'Your store', description: 'The shift, its signals and the people who can help.' },
  announcements: { name: 'Store announcements', description: 'Updates the whole crew needs.', message: 'Today’s service focus is to check sauces and sides before each order leaves the packing bench.', action: 'Read the Store Hub', feature: 'canvas' },
  'shift-handover': { name: 'Shift handover', description: 'Owners, open items and the next useful step.', message: 'The next crew can find task owners and outstanding work in the shift list. Record changes through the approved workflow.', action: 'Read the shift list', feature: 'lists' },
  'food-safety': { name: 'Food safety', description: 'Approved procedures and links to source records.', message: 'Use the current approved procedure and record the check in the food safety system. The store channel keeps the status and a link.', action: 'See how the records connect', modal: 'procedure' },
  training: { name: 'Training', description: 'Short briefings and approved learning.', message: 'Layla’s captioned briefing is ready to watch before service. A transcript is available when reading is easier.', action: 'Watch the shift briefing', feature: 'clips' },
  stock: { name: 'Stock & supplies', description: 'Availability checks and supply follow-ups.', message: 'Need a stock check? Run the approved issue workflow, choose Stock & supplies and give Sarah the context.', action: 'Run the stock workflow', feature: 'workflows' },
  equipment: { name: 'Equipment support', description: 'Fault reports with an owner and a next step.', message: 'Report equipment problems through the approved workflow. Choose Equipment so the manager can coordinate the right support.', action: 'Report an equipment issue', feature: 'workflows' },
  'guest-experience': { name: 'Guest experience', description: 'Useful feedback themes and service improvements.', message: 'Keep a packing or collection issue close to the team. A short report gives the manager enough context to follow up.', action: 'Log a service issue', feature: 'workflows' },
  'people-help': { name: 'People help', description: 'Shift help and links to the workforce system.', message: 'View your schedule and request an open shift through the approved workforce app. Manager approval stays with the roster.', action: 'View my shift', feature: 'shifts' },
  'team-wins': { name: 'Team wins', description: 'Recognition and good ideas worth sharing.', message: 'Use the store channel to thank a teammate or share an idea that helped the shift.', action: 'Share in the store channel', channel: true },
};

/** Navigation around the existing channel. No workflow or account state is stored here. */
export function initialiseSlackShell(b) {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = b.escape;
  const icon = b.icon;
  const renderedLists = new WeakMap();
  let showingHome = false;
  let activeNavigation = 'home';
  let selectedChannel = 'store';
  let selectedStore = b.storeId();

  const currentChannel = () => selectedChannel;
  const channelName = id => id === 'store' ? `store-${b.storeId()}` : id;

  function channelRows() {
    return CURATED_CHANNEL_IDS.map(id => {
      const name = channelName(id);
      const selected = id === selectedChannel && b.stage() !== 'network';
      return `<button class="workspace-channel workspace-channel-row${selected ? ' selected' : ''}" data-workspace-channel="${id}"${selected ? ' aria-current="page"' : ''}><span class="workspace-channel-hash" aria-hidden="true">#</span><span class="workspace-channel-text"><b>${esc(name)}</b></span></button>`;
    }).join('');
  }

  function sync() {
    if (selectedStore !== b.storeId()) { selectedStore = b.storeId(); selectedChannel = 'store'; showingHome = false; }
    const markup = channelRows();
    for (const selector of ['#desktop-channel-list', '#mobile-channel-list']) {
      const list = $(selector);
      if (list && renderedLists.get(list) !== markup) {
        list.innerHTML = markup;
        renderedLists.set(list, markup);
      }
    }
    $('.slack-panel')?.classList.toggle('showing-home', showingHome);
    if ($('.slack-panel')) $('.slack-panel').dataset.currentChannel = selectedChannel;
    if ($('#slack-home')) $('#slack-home').hidden = !showingHome;
    if ($('.slack-body > .channel')) $('.slack-body > .channel').hidden = showingHome;
    if ($('#mobile-store-label')) $('#mobile-store-label').textContent = `store-${b.storeId()}`;
    if ($('.mobile-channel-members')) $('.mobile-channel-members').textContent = `${b.stage() === 'network' ? 9 : b.storeTeam()} members`;
    const memberPhotos = ['sarah','layla','omar'].map(id => avatar(id,'member-photo')).join('');
    if ($('.avatar-stack') && $('.avatar-stack').innerHTML !== memberPhotos) $('.avatar-stack').innerHTML = memberPhotos;
    if (selectedChannel !== 'store' && $('#channel-name')) $('#channel-name').textContent = selectedChannel;
    $$('[data-mobile-nav], [data-desktop-nav]').forEach(button => {
      const active = (button.dataset.mobileNav || button.dataset.desktopNav) === activeNavigation;
      button.classList.toggle('selected', active);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function showChannel() {
    const changedChannel = selectedChannel !== 'store';
    if (changedChannel) b.beforeChannelChange?.('store');
    selectedChannel = 'store';
    if (changedChannel) b.restoreDraft?.();
    showingHome = false;
    activeNavigation = 'home';
    sync();
  }

  function showHome() {
    showingHome = true;
    activeNavigation = 'home';
    sync();
    $('#mobile-channel-list button')?.focus();
  }

  function showChannels() {
    b.closeDialog();
    const sidebar = $('.channel-sidebar');
    if (sidebar && getComputedStyle(sidebar).display !== 'none' && sidebar.getClientRects().length) {
      showingHome = false;
      activeNavigation = 'home';
      sync();
      $('#desktop-channel-list [data-workspace-channel="store"]')?.focus();
    } else showHome();
  }

  function returnToStore({ compose = false } = {}) {
    openChannel('store');
    if (compose) {
      b.setTab('messages');
      $('#message-input')?.focus();
    }
  }

  function renderChannel() {
    if (selectedChannel === 'store') return false;
    const id = selectedChannel;
    const detail = channelDetails[id];
    const action = detail.feature ? `data-shell-feature="${detail.feature}"`
      : detail.modal ? `data-shell-modal="${detail.modal}"` : 'data-shell-compose';
    const sender = ['training','shift-handover','team-wins'].includes(id) ? people.layla : ['announcements','stock','equipment','guest-experience'].includes(id) ? people.sarah : null;
    const updates = b.getChannelMessages?.(id) || [];
    $('#channel-name').textContent = id;
    $$('.channel-tabs button').forEach(button => { const active = button.dataset.tab === 'messages'; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
    $('#channel-content').setAttribute('aria-labelledby','tab-messages');
    $('#channel-content').innerHTML = `<div class="channel-introduction"><h2>#${esc(id)}</h2><p>${esc(detail.description)}</p></div><div class="day-divider"><span>Today</span></div><article class="message">${sender ? avatar(sender) : brandAvatar()}<div class="message-content"><div class="message-author"><b>${esc(sender?.name || 'Store OS')}</b>${sender ? '' : '<span class="app-tag">APP</span>'}<time>09:30</time></div><p>${esc(detail.message)}</p><div class="workflow-actions"><button class="slack-button" ${action}>${esc(detail.action)} ${icon('arrow-right')}</button></div></div></article>${updates.map(note => b.message ? b.message(note) : `<article class="message">${avatar(note.name || note.author || 'omar')}<div class="message-content"><div class="message-author"><b>${esc(note.name || people[note.author]?.name || people.omar.name)}</b><time>${esc(note.time || 'Now')}</time></div><p>${esc(note.text)}</p></div></article>`).join('')}`;
    $('#composer').hidden = false;
    $('#message-input').placeholder = `Message #${id}`;
    sync();
    return true;
  }

  function openChannel(id, { notify = true } = {}) {
    if (!CURATED_CHANNEL_IDS.includes(id)) return false;
    b.beforeChannelChange?.(id);
    selectedChannel = id;
    selectedStore = b.storeId();
    b.restoreDraft?.();
    b.closeDialog();
    showingHome = false;
    activeNavigation = 'home';
    sync();
    if (id === 'store') { b.openStoreChannel?.(); b.setTab('messages'); }
    else { renderChannel(); $('#channel-content').scrollTop = 0; }
    if (notify) b.onChannelSelected?.(id);
    return true;
  }

  function showDirectMessages() {
    const teammates = (b.role() === 'crew' ? ['sarah','layla'] : ['layla','omar','karim']).map(id=>people[id]);
    b.showDialog('Direct messages', `<p class="feature-context">${esc(b.storeName())} · Your teammates</p><div class="shell-teammates">${teammates.map(person => `<button class="shell-teammate" data-shell-dm="${person.id}">${avatar(person)}<span><b>${esc(person.name)}</b><small>${esc(person.role)}</small></span>${icon('arrow-right')}</button>`).join('')}</div><p class="source-note">External DMs and Slack Connect are restricted for the frontline role.</p><button class="slack-button" data-shell-feature="governance">Explore the access boundaries</button>`);
  }

  function showTeammate(id) {
    const teammate = {
      sarah: ['Sarah', 'SA', 'If you need a hand, log the issue in our store channel so the team can see who owns the response.'],
      layla: ['Layla', 'LA', 'The shift briefing and Store Hub have today’s roles. Ask in the store channel if anything needs a hand.'],
      omar: ['Omar', 'OM', 'I’m on packing and collection for this shift. Keep the agreed check in the store channel so the next crew has it too.'],
      karim: ['Karim', 'KA', 'Keep the store’s next step and owner in the channel. I’ll follow up on the open items with Sarah.'],
    }[id];
    if (!teammate) return;
    const person=people[id];
    b.showDialog(person.name, `<p class="feature-context">Direct message · ${esc(b.storeName())}</p><div class="shell-sample-message">${avatar(person)}<div><b>${esc(person.name)}</b><p>${teammate[2]}</p></div></div><div class="dialog-actions"><button class="primary-button" data-shell-compose>Continue in the store channel ${icon('arrow-right')}</button><button class="slack-button" data-shell-dms>Back to direct messages</button></div><p class="source-note">Keep shared store decisions in the channel so the team has the context.</p>`);
  }

  function showActivity() {
    const events = b.getActivity?.();
    if (!Array.isArray(events)) { b.openModal('activity'); return; }
    const updates = events.filter(event => event && typeof event.text === 'string').slice(-12).reverse();
    b.showDialog('Activity', `<p class="feature-context">${esc(b.storeName())} · This shift</p>${updates.length ? updates.map(event => `<div class="shell-activity-item"><b>${esc(personFor(event.name)?.name || event.name || 'Store OS')}</b><p>${esc(event.text)}</p>${event.stage ? `<small>${esc(event.stage)}</small>` : ''}</div>`).join('') : '<div class="hub-card"><h3>A fresh shift</h3><p>Complete a workflow to see its update here.</p></div>'}<button class="slack-button" data-shell-return>Back to my store channel</button>`);
  }

  function showProfile() {
    const crew = b.role() === 'crew';
    const person=people[crew?'omar':'sarah'];
    b.showDialog('You', `<div class="shell-profile">${avatar(person)}<div><h3>${esc(person.name)}</h3><p>${crew ? 'Frontline crew · Packing & collection' : 'Store manager'}<br>${esc(b.storeName())}</p></div></div><p>Shift records and approvals stay in the connected workforce app.</p><div class="dialog-actions"><button class="primary-button" data-shell-feature="shifts">${crew ? 'View my shift' : 'View the crew shift'} ${icon('clock')}</button><button class="slack-button" data-shell-feature="governance">Review access and security</button><button class="slack-button" data-shell-return>Back to my store channel</button></div>`);
  }

  function showMore() {
    b.showDialog('More in your workspace', `<p>Find the store’s approved tools and information.</p><div class="detail-grid"><button class="detail-tile" data-shell-feature="canvas"><b>Canvases</b><span>Read the Store Hub and current brief.</span></button><button class="detail-tile" data-shell-feature="lists"><b>Lists</b><span>See task owners and status.</span></button><button class="detail-tile" data-shell-feature="workflows"><b>Workflows</b><span>Log an issue with the right context.</span></button><button class="detail-tile" data-shell-feature="agents"><b>Apps & agents</b><span>Ask the approved store guide.</span></button></div><p class="source-note">The business manages app installation, channel access and the approved workflows.</p>`);
  }

  function showShortcut(name) {
    if (name === 'hub') { returnToStore(); b.setTab('hub'); return; }
    if (name === 'drafts') {
      const draft = b.getDraft?.() ?? $('#message-input')?.value ?? '';
      b.showDialog('Drafts & sent', `<p class="feature-context">${esc(b.storeName())} · Current channel</p><h3>Your unsent draft</h3>${draft.trim() ? `<div class="brief-answer">${esc(draft)}</div><p>Your draft stays in the composer until you send it.</p>` : '<p>There is no unsent draft in the current channel. Start a message in the conversation whenever you need to leave a note.</p>'}<div class="dialog-actions"><button class="primary-button" data-shell-compose>${draft.trim() ? 'Continue writing' : 'Write a store note'} ${icon('arrow-right')}</button><button class="slack-button" data-shell-sent>View recorded activity</button></div>`);
    } else if (name === 'threads') {
      b.showDialog('Threads', `<p class="feature-context">${esc(b.storeName())} · Connected conversations</p><p>The store channel keeps the reported issue, owner and agreed next step in the store conversation. Return to it to follow the shift, or join the team’s huddle to work through the issue.</p><div class="detail-grid"><button class="detail-tile" data-shell-return><b>Store conversation</b><span>Read the current signal and its recorded responses.</span></button><button class="detail-tile" data-shell-feature="huddles"><b>The team huddle</b><span>Talk through the logged issue and keep the agreed action.</span></button></div><p class="source-note">Keep follow-up conversations connected to the original store issue.</p>`);
    } else if (name === 'later') {
      b.showDialog('Later', `<p class="feature-context">${esc(b.storeName())} · Useful shift references</p><p>Keep the information you need close by. Find the store brief and task list here.</p><div class="detail-grid"><button class="detail-tile" data-shell-feature="canvas"><b>Store Hub</b><span>Current contacts, briefings and source records.</span></button><button class="detail-tile" data-shell-feature="lists"><b>Shift task list</b><span>Task owners, status and the next useful step.</span></button></div><button class="slack-button" data-shell-return>Back to my store channel</button>`);
    }
  }

  function navigate(name, mobile) {
    if (name === 'home') { mobile ? showHome() : openChannel('store'); return; }
    const destinations = { dms: showDirectMessages, activity: showActivity, you: showProfile, more: showMore };
    if (!destinations[name]) return;
    activeNavigation = name;
    sync();
    destinations[name]();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.device === 'desktop' && getComputedStyle($('.channel-sidebar')).display !== 'none') { showingHome = false; sync(); }
    if (button.dataset.mobileNav) navigate(button.dataset.mobileNav, true);
    if (button.dataset.desktopNav) navigate(button.dataset.desktopNav, false);
    if (button.hasAttribute('data-slack-back')) showHome();
    if (button.hasAttribute('data-slack-search-mobile')) $('#slack-search')?.click();
    if (button.dataset.workspaceChannel) openChannel(button.dataset.workspaceChannel);
    if (button.dataset.shellFeature) { b.closeDialog(); b.openFeature(button.dataset.shellFeature); }
    if (button.dataset.shellModal) b.openModal(button.dataset.shellModal);
    if (button.hasAttribute('data-shell-return')) returnToStore();
    if (button.hasAttribute('data-shell-compose')) returnToStore({ compose: true });
    if (button.hasAttribute('data-shell-dms')) showDirectMessages();
    if (button.dataset.shellDm) showTeammate(button.dataset.shellDm);
    if (button.dataset.shellShortcut) showShortcut(button.dataset.shellShortcut);
    if (button.hasAttribute('data-shell-sent')) showActivity();
  });
  $('#dialog')?.addEventListener('close', () => { if($('#dialog').open)return;activeNavigation = 'home'; sync(); });
  sync();
  return { sync, showChannel, showChannels, openChannel, currentChannel, renderChannel };
}
