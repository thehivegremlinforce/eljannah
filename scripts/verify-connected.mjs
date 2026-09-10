// Optional browser regression suite. Uses only a fresh local demo browser context.
// PLAYWRIGHT_MODULE and DEMO_URL can point to another local installation/server.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { STORAGE_KEY, freshStore } from '../workflow.js';
import { FEATURE_IDS, OPERATION_IDS, freshFrontlineStore } from '../frontline-state.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:4175';
const FRONTLINE_KEY = 'el-jannah-connected-store-v2';
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const errors = [], passed = [], mediaRequests = [];
const watch = async page => {
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__recordDemoMediaAttempt', (_source, method) => mediaRequests.push(method));
  await page.addInitScript(() => {
    const blocked = method => () => {
      window.__recordDemoMediaAttempt(method);
      return Promise.reject(new DOMException('The local demo must not request real media.', 'NotAllowedError'));
    };
    if (navigator.mediaDevices) {
      for (const method of ['getUserMedia', 'getDisplayMedia']) {
        Object.defineProperty(navigator.mediaDevices, method, { configurable: true, value: blocked(method) });
      }
    }
    for (const method of ['getUserMedia', 'webkitGetUserMedia']) {
      Object.defineProperty(navigator, method, { configurable: true, value: blocked(method) });
    }
  });
};
let page = await context.newPage();
let diagnosticPage = page;
await watch(page);
page.setDefaultTimeout(7000);
async function assertNaturalSlackCopy(target) {
  const copy = await target.locator('.slack-panel').evaluate(panel => {
    const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const fields = [...panel.querySelectorAll('input, textarea, [title]')].filter(visible).flatMap(element => [element.value || '', element.getAttribute('placeholder') || '', element.getAttribute('title') || '']);
    return [panel.innerText, ...fields].join('\n');
  });
  const lines = copy.split('\n').filter(line => /\bdemo\b/i.test(line));
  assert.deepEqual(lines, [], 'Visible Slack copy uses natural employee language, including fields and tooltips');
}
async function assertEmployeeSignIn(target) {
  await assertClientDialog(target);
  assert.equal((await target.locator('#dialog-title').textContent()).trim(), 'Sign in to El Jannah');
  assert.equal(await target.locator('#dialog').evaluate(el => el.classList.contains('slack-signin-dialog')), true);
  assert.match(await target.locator('.login-identity').textContent(), /Omar Haddad/);
  const employeeId = target.locator('#dialog input[aria-label="Employee ID"]');
  assert.equal(await employeeId.inputValue(), 'EJ-014');
  assert.equal(await employeeId.evaluate(el => el.readOnly), true, 'The assigned employee ID cannot be accidentally changed');
  assert.equal((await target.locator('[data-access-next]').textContent()).trim(), 'Continue');
  assert.match(await target.locator('#click-coach').textContent(), /STEP 01 OF 10/);
  await recommended('[data-access-next]', target);
}
async function pauseInitialSignIn(target) {
  await target.locator('[data-flow-pause]').click();
  if (await target.locator('#dialog').isVisible()) await target.locator('#close-dialog').click();
}
async function assertClientDialog(target) {
  const dialog = target.locator('#dialog');
  assert.equal(await dialog.isVisible(), true, 'The Slack dialog is visible');
  assert.equal(await target.locator('.slack-panel .client-dialog-layer #dialog').count(), 1, 'Dialog belongs to the Slack client');
  assert.equal(await dialog.evaluate(el => el.matches(':modal')), false, 'No page-level modal is opened');
  const [box, layer, client] = await target.evaluate(() => ['#dialog', '.client-dialog-layer', '.slack-panel'].map(selector => document.querySelector(selector).getBoundingClientRect().toJSON()));
  for (const [name, bounds] of [['Dialog', box], ['Dialog layer', layer]]) {
    assert.ok(bounds && bounds.x >= client.x - 1 && bounds.y >= client.y - 1 && bounds.x + bounds.width <= client.x + client.width + 1 && bounds.y + bounds.height <= client.y + client.height + 1,
      `${name} remains inside Slack: ${JSON.stringify(bounds)}, client ${JSON.stringify(client)}`);
  }
  const scene = await target.locator('.scene-panel').evaluate(el => {
    const ancestors = []; for (let item = el; item; item = item.parentElement) ancestors.push(item);
    return { inert: ancestors.some(item => item.inert), dimmed: ancestors.some(item => Number(getComputedStyle(item).opacity) < 1), blurred: ancestors.some(item => getComputedStyle(item).filter !== 'none') };
  });
  assert.equal(scene.inert, false, 'The store scene is not made inert');
  assert.equal(scene.dimmed, false, 'The store scene and its ancestors are not dimmed');
  assert.equal(scene.blurred, false, 'The store scene and its ancestors are not blurred');
  await assertNaturalSlackCopy(target);
}
async function assertCompactFrame(target) {
  await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const width = target.viewportSize().width, height = target.viewportSize().height;
  assert.ok(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The compact frame never creates horizontal page overflow');
  await assertExternalGuidance(target);
  const selectors = width >= 1051 ? ['.experience-top', '.scene-panel', '.scene-toolbar', '.slack-panel', '#demo-assistant'] : ['#demo-assistant'];
  for (const selector of selectors) {
    const item = target.locator(selector);
    assert.equal(await item.isVisible(), true, `${selector} remains visible in the compact working frame`);
    const box = await item.boundingBox();
    assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${selector} fits the ${width}×${height} viewport: ${JSON.stringify(box)}`);
  }
  if (width >= 1051) {
    const grid = await target.locator('#demo-grid').boundingBox();
    assert.ok(grid.height <= height - 140, 'The working grid leaves room for its controls');
    assert.ok(await target.locator('#demo-grid').evaluate(el => el.getBoundingClientRect().top + scrollY <= 390), 'The compact introduction puts the working grid near the top of the page');
  }
}
async function assertExternalGuidance(target) {
  assert.equal(await target.locator('#demo-grid > #demo-assistant').count(), 1, 'The demonstration assistant is a sibling of the Slack client');
  assert.equal(await target.locator('.slack-panel #click-coach, .slack-panel #journey-dock').count(), 0, 'Demo tips and completion cards never appear inside Slack');
  assert.equal(await target.locator('#demo-assistant #click-coach').count(), 1);
  assert.equal(await target.locator('#demo-assistant #journey-dock').count(), 1);
  const rectangles = await target.evaluate(() => Object.fromEntries(['.slack-panel', '#demo-assistant', '#click-coach', '#journey-dock'].map(selector => {
    const element = document.querySelector(selector), rect = element.getBoundingClientRect();
    return [selector, rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden' ? rect.toJSON() : null];
  })));
  const client = rectangles['.slack-panel'], assistant = rectangles['#demo-assistant'];
  if (!client) return;
  for (const selector of ['#demo-assistant', '#click-coach', '#journey-dock']) {
    const box = rectangles[selector];
    if (!box) continue;
    if (selector !== '#demo-assistant') assert.ok(assistant && box.x >= assistant.x - 1 && box.y >= assistant.y - 1 && box.x + box.width <= assistant.x + assistant.width + 1 && box.y + box.height <= assistant.y + assistant.height + 1, `${selector} stays inside its separate assistant panel: ${JSON.stringify(box)}, assistant ${JSON.stringify(assistant)}`);
    const overlapWidth = Math.min(box.x + box.width, client.x + client.width) - Math.max(box.x, client.x);
    const overlapHeight = Math.min(box.y + box.height, client.y + client.height) - Math.max(box.y, client.y);
    assert.ok(overlapWidth <= 1 || overlapHeight <= 1, `${selector} does not overlap the Slack client: ${JSON.stringify(box)}, client ${JSON.stringify(client)}`);
  }
}
// Check before clicking: locator.click() would otherwise scroll an offscreen
// highlight into view and conceal an unusable instruction from this test.
async function assertRecommendedTarget(target, marker, expected) {
  await target.waitForFunction(({ marker, expected }) => {
    const matches = document.querySelectorAll(marker);
    return matches.length === 1 && matches[0].matches(expected);
  }, { marker, expected });
  // Allow the app's scheduled layout/reveal frames to settle without clicking
  // or scrolling the page from the test. Visibility is still checked first.
  await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const result = await target.locator(marker).evaluate(el => {
    const rect = el.getBoundingClientRect(), client = el.closest('.slack-panel')?.getBoundingClientRect(), assistant = el.closest('#demo-assistant')?.getBoundingClientRect();
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      rect: rect.toJSON(), client: client?.toJSON(), assistant: assistant?.toJSON(), clip: { left, top, right, bottom },
      visible: rect.width > 0 && rect.height > 0 && rect.left >= left - 1 && rect.right <= right + 1 && rect.top >= top - 1 && rect.bottom <= bottom + 1,
      hittable: Boolean(hit && (hit === el || el.contains(hit))),
      disabled: Boolean(el.disabled || el.closest('[inert]')),
    };
  });
  assert.ok(result.client || result.assistant, 'Recommended action belongs to Slack or its separate demonstration assistant');
  await assertExternalGuidance(target);
  assert.ok(result.visible, `Recommended action is fully visible before clicking: ${JSON.stringify(result)}`);
  assert.ok(result.hittable, 'No coach panel or other content covers the recommended action');
  assert.equal(result.disabled, false, 'The recommended action is enabled');
}
const personNames = { omar: 'Omar Haddad', sarah: 'Sarah Mansour', layla: 'Layla Darwish', karim: 'Karim Nasser' };
const personPhotos = new Map();
async function assertPeoplePhotos(target, selector, { minimum = 1, authors = false } = {}) {
  const photos = target.locator(selector);
  const visible = [];
  for (const photo of await photos.all()) if (await photo.isVisible()) visible.push(photo);
  assert.ok(visible.length >= minimum, `${selector} shows at least ${minimum} real photo avatars`);
  for (const photo of visible) {
    await photo.scrollIntoViewIfNeeded();
    await photo.evaluate(image => image.decode());
    const identity = await photo.evaluate(image => ({
      id: image.dataset.person || image.closest('[data-person]')?.dataset.person,
      alt: image.alt, title: image.closest('[data-person]')?.getAttribute('title') || '', source: image.currentSrc || image.src,
      loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      author: image.closest('.message')?.querySelector('.message-author b')?.textContent,
    }));
    const fullName = personNames[identity.id];
    assert.ok(fullName, `The photo belongs to a known demo teammate: ${JSON.stringify(identity)}`);
    assert.equal(identity.loaded, true, `${fullName}'s photo loads`);
    assert.ok(identity.alt.includes(fullName) || (identity.alt === '' && identity.title.includes(fullName)), `${fullName}'s avatar has a name and appropriate descriptive or decorative alt text`);
    if (authors) assert.ok(identity.author?.includes(fullName), `The message shows ${fullName}'s full name`);
    if (personPhotos.has(identity.id)) assert.equal(identity.source, personPhotos.get(identity.id), `${fullName} uses the same photo throughout the demo`);
    else personPhotos.set(identity.id, identity.source);
  }
}
async function assertOfficialSlackLogo(target) {
  const logo = target.locator('.site-header img.slack-brand-logo');
  assert.equal(await logo.getAttribute('alt'), 'Slack');
  await logo.evaluate(image => image.decode());
  const data = await logo.evaluate(image => ({ loaded: image.complete && image.naturalWidth === 200 && image.naturalHeight === 75, image: image.getBoundingClientRect().toJSON(), header: image.closest('.site-header').getBoundingClientRect().toJSON() }));
  assert.equal(data.loaded, true, 'The official Slack logo loads at its original200×75 dimensions');
  assert.ok(Math.abs(data.image.width / data.image.height - 200 / 75) < .02, 'The header preserves the official logo’s proportions');
  assert.ok(data.image.x >= data.header.x && data.image.y >= data.header.y && data.image.right <= data.header.right && data.image.bottom <= data.header.bottom, 'The Slack logo remains within the header');
}
async function assertMemberHeader(target, count, mobile = false) {
  const members = target.locator('.channel-member-summary');
  assert.equal(await members.isVisible(), true);
  assert.equal((await target.locator('.mobile-channel-members').textContent()).trim(), `${count} members`);
  assert.equal(await members.locator('.member-photo .identity-photo').count(), 3);
  assert.deepEqual(await members.locator('.member-photo').evaluateAll(items => items.map(item => item.dataset.person)), ['sarah', 'layla', 'omar']);
  await assertPeoplePhotos(target, '.channel-member-summary .identity-photo', { minimum: 3 });
  const [photos, label, header] = await target.evaluate(() => ['.channel-member-summary .avatar-stack', '.mobile-channel-members', '.channel-heading'].map(selector => document.querySelector(selector).getBoundingClientRect().toJSON()));
  assert.ok(photos.x + photos.width <= label.x + 1 && label.x - photos.x - photos.width <= 12, 'Member photos sit immediately beside their count');
  assert.ok(Math.abs(photos.y + photos.height / 2 - label.y - label.height / 2) < 6, 'Member photos and count align on one row');
  assert.ok(label.x + label.width <= header.x + header.width && photos.x >= header.x, 'Member summary stays inside the channel header');
  assert.equal(await target.locator('.channel-heading').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(74, 21, 75)');
  assert.equal(await target.locator('#channel-name').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
  if (mobile) assert.equal(await target.locator('.phone-status').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(74, 21, 75)');
}
async function assertMessageReactions(target) {
  for (const [id, emoji] of [['seen', '👀'], ['thanks', '🙌']]) {
    const reaction = target.locator(`[data-reaction="${id}"]`);
    assert.equal((await reaction.locator('.emoji').textContent()).trim(), emoji);
    assert.equal(await reaction.getAttribute('aria-pressed'), 'false');
    const count = Number(await reaction.locator('.reaction-count').textContent());
    const neutral = await reaction.evaluate(el => getComputedStyle(el).backgroundColor);
    const neutralChannels = neutral.match(/[\d.]+/g).slice(0, 3).map(Number);
    assert.ok(Math.max(...neutralChannels) - Math.min(...neutralChannels) <= 10, 'Unselected reactions use a neutral background');
    await reaction.click();
    assert.equal(await reaction.getAttribute('aria-pressed'), 'true');
    assert.equal(Number(await reaction.locator('.reaction-count').textContent()), count + 1);
    assert.match(await reaction.getAttribute('aria-label'), new RegExp(String(count + 1)));
    const selected = await reaction.evaluate(el => getComputedStyle(el).backgroundColor);
    const selectedChannels = selected.match(/[\d.]+/g).slice(0, 3).map(Number);
    assert.ok(selectedChannels[2] > selectedChannels[0] + 3, 'Selected reactions use a blue background');
    await reaction.click();
    assert.equal(await reaction.getAttribute('aria-pressed'), 'false');
    assert.equal(Number(await reaction.locator('.reaction-count').textContent()), count);
    const restoredChannels = (await reaction.evaluate(el => getComputedStyle(el).backgroundColor)).match(/[\d.]+/g).slice(0, 3).map(Number);
    assert.ok(Math.max(...restoredChannels) - Math.min(...restoredChannels) <= 10, 'The reaction returns to a neutral background, including its hover state');
  }
}
async function assertStorePhotos(target) {
  const photos = target.locator('.store-card img:not(.identity-logo)');
  assert.ok(await photos.count() > 0, 'The network includes store photography where it is available');
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await photo.evaluate(image => image.decode());
    const result = await photo.evaluate(image => ({ loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0, alt: image.alt, store: image.closest('.store-card')?.querySelector('h3')?.textContent.trim() }));
    assert.equal(result.loaded, true, 'Store photography loads');
    assert.ok(result.store && result.alt.includes(result.store), 'The store photo identifies its location in the alt text');
  }
}
const click = async selector => {
  await page.locator(selector).click();
  if (await page.locator('#dialog').isVisible()) await assertClientDialog(page);
  else await assertNaturalSlackCopy(page);
};
const recommended = (selector, target = page) => assertRecommendedTarget(target, '[data-recommended-target]', selector);
const presenterProblems = new Map();
async function assertPresenterStep(target, nativeTitle) {
  const title = nativeTitle || (await target.locator('#dialog-title').textContent()).trim();
  const label = (await target.locator('#presenter-step-label').textContent()).trim();
  const expected = title === 'Sign in to El Jannah' ? 'Email-free access' : title;
  assert.ok(label.toLowerCase().includes(expected.toLowerCase()), `Presenter step follows the open capability or playbook: ${label} / ${title}`);
  presenterProblems.set(title, (await target.locator('#presenter-problem').textContent()).trim());
  assert.ok((await target.locator('#frontline-guide .guide-problem').textContent()).trim().length > 20, 'The step explains the problem it solves');
  for (const selector of ['#presenter-problem', '#presenter-say', '#presenter-click']) {
    const content = (await target.locator(selector).textContent()).trim();
    assert.ok(content.length > 25, `${selector} explains the scenario and demonstration`);
    assert.doesNotMatch(content, /\u2014/, 'Presenter copy uses human English without em dashes');
  }
}

async function guidedClick(selector, target = page) {
  await recommended(selector, target);
  if (await target.locator('#dialog').isVisible()) {
    await assertPresenterStep(target);
    const coach = target.locator('#click-coach');
    assert.equal(await coach.isVisible(), true, 'Form instructions are visible in the separate demonstration assistant');
    assert.match(await coach.textContent(), /Click /);
  } else if (await target.locator(selector).evaluate(el => Boolean(el.closest('.slack-panel')))) {
    assert.equal(await target.locator('#click-coach').isVisible(), true, 'Native Slack navigation receives an outside prompt');
    await assertPresenterStep(target, (await target.locator('#frontline-guide .guide-copy h2').textContent()).trim());
  } else {
    assert.equal(await target.locator('#demo-assistant #journey-dock').isVisible(), true, 'Between-step instructions and actions appear in the separate completion card');
    assert.equal(await target.locator(selector).evaluate(el => Boolean(el.closest('#journey-dock'))), true);
  }
  await target.locator(selector).click();
  if (await target.locator('#dialog').isVisible()) await assertClientDialog(target);
  else await assertNaturalSlackCopy(target);
}
async function nativeChannelSelector(target, id = 'store') {
  const desktopListVisible = await target.locator('#desktop-channel-list').isVisible();
  return `${desktopListVisible ? '#desktop-channel-list' : '#mobile-channel-list'} [data-workspace-channel="${id}"]`;
}
async function assertPendingChannelFormats(target, finalDevice) {
  const before = { base: await base(target), frontline: await frontline(target) };
  const otherDevice = finalDevice === 'mobile' ? 'desktop' : 'mobile';
  for (const device of [otherDevice, finalDevice, otherDevice, finalDevice]) {
    await target.locator(`[data-device="${device}"]`).click();
    assert.equal(await target.locator('#dialog').isVisible(), false);
    await recommended(await nativeChannelSelector(target), target);
    assert.deepEqual({ base: await base(target), frontline: await frontline(target) }, before, 'Switching format does not choose a channel or advance work');
  }
}
async function chooseGuidedStoreChannel(target, storeId) {
  assert.equal(await target.locator('#dialog').isVisible(), false, 'The channels step uses the ordinary Slack navigation');
  assert.equal(await target.locator('[data-preview-channel], [data-confirm-channel]').count(), 0, 'There is no separate channel picker or confirmation screen');
  const selector = await nativeChannelSelector(target);
  const list = selector.split(' ')[0];
  assert.equal(await target.locator(`${list} [data-workspace-channel]`).count(), 10);
  assert.equal(await target.locator(list).isVisible(), true);
  await guidedClick(selector, target);
  assert.equal(await target.locator('#dialog').isVisible(), false);
  assert.equal((await target.locator('#channel-name').textContent()).trim(), `store-${storeId}`);
  assert.ok((await frontline(target))[storeId].completed.includes('channels'), 'One native store-channel click completes the channels step');
}
async function assertHuddleInvitation(target, storeId) {
  await assertClientDialog(target); await assertExternalGuidance(target);
  assert.equal(await target.locator('[data-huddle-invitation]').isVisible(), true);
  assert.equal(await target.locator('.huddle-invite-notification').isVisible(), true);
  assert.equal(await target.locator('.huddle-invite-sheet').isVisible(), true);
  assert.match(await target.locator('[data-huddle-invitation]').textContent(), /Sarah Mansour/);
  assert.ok((await target.locator('[data-huddle-invitation]').textContent()).includes(`store-${storeId}`));
  assert.equal(await target.locator('[data-huddle-dismiss]').isVisible(), true);
  assert.equal(await target.locator('.slack-huddle').count(), 0, 'The room does not open before the invitation is accepted');
  assert.equal((await frontline(target))[storeId].completed.includes('huddles'), false);
  await recommended('[data-huddle-join]', target);
  const inviteBounds = await target.evaluate(() => Object.fromEntries(['.slack-panel', '.huddle-invite-notification', '.huddle-invite-sheet'].map(selector => [selector, document.querySelector(selector).getBoundingClientRect().toJSON()])));
  const client = inviteBounds['.slack-panel'];
  for (const selector of ['.huddle-invite-notification', '.huddle-invite-sheet']) {
    const bounds = inviteBounds[selector];
    assert.ok(bounds.x >= client.x - 1 && bounds.y >= client.y - 1 && bounds.x + bounds.width <= client.x + client.width + 1 && bounds.y + bounds.height <= client.y + client.height + 1, `${selector} stays completely inside Slack: ${JSON.stringify(bounds)}`);
  }
}
async function exerciseHuddle(target, storeId) {
  await assertHuddleInvitation(target, storeId);
  const originalDevice = await target.locator('[data-device="mobile"]').getAttribute('aria-pressed') === 'true' ? 'mobile' : 'desktop';
  const otherDevice = originalDevice === 'mobile' ? 'desktop' : 'mobile';
  const beforeInvitation = await frontline(target);
  for (const device of [otherDevice, originalDevice]) {
    await target.locator(`[data-device="${device}"]`).click();
    await assertHuddleInvitation(target, storeId);
    assert.deepEqual(await frontline(target), beforeInvitation, 'Changing format preserves the unaccepted invitation');
  }
  await target.locator('[data-huddle-dismiss]').click();
  assert.equal(await target.locator('#dialog').isVisible(), false);
  assert.deepEqual(await frontline(target), beforeInvitation, 'Dismissing an invitation does not join or complete the huddle');
  await guidedClick('#journey-dock [data-guide-resume]', target);
  await assertHuddleInvitation(target, storeId);
  await guidedClick('[data-huddle-join]', target);
  const room = target.locator('.slack-huddle');
  assert.equal(await room.evaluate(el => el.classList.contains('is-joined')), true);
  assert.equal(await target.locator('[data-huddle-invitation]').count(), 0);
  assert.equal(await target.locator('[data-huddle-join]').isVisible(), false, 'There is no second Join action inside the room');
  assert.equal((await target.locator('[data-huddle-count]').textContent()).trim(), '3 people here');
  for (const device of [otherDevice, originalDevice]) {
    await target.locator(`[data-device="${device}"]`).click();
    assert.equal(await room.evaluate(el => el.classList.contains('is-joined')), true);
    assert.equal((await target.locator('[data-huddle-count]').textContent()).trim(), '3 people here');
    assert.equal(await target.locator('[data-huddle-join]').isVisible(), false);
    await assertClientDialog(target); await recommended('[data-huddle-finish]', target);
  }
  assert.equal((await frontline(target))[storeId].completed.includes('huddles'), false, 'Joining does not complete the agreed action');
  await assertPeoplePhotos(target, '.slack-huddle .identity-photo', { minimum: 3 });
  for (const name of ['Omar Haddad', 'Sarah Mansour', 'Layla Darwish']) assert.ok((await room.textContent()).includes(name), `The huddle identifies ${name}`);
  for (const [control, stateClass] of [['mic', 'is-muted'], ['camera', 'camera-off'], ['screen', 'is-sharing']]) {
    const button = target.locator(`[data-huddle-control="${control}"]`);
    const original = await button.getAttribute('aria-pressed');
    assert.ok(['true', 'false'].includes(original));
    const originalClass = await room.evaluate((el, name) => el.classList.contains(name), stateClass);
    const status = await target.locator('[data-huddle-preview-status]').textContent();
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), String(original !== 'true'));
    assert.equal(await room.evaluate((el, name) => el.classList.contains(name), stateClass), !originalClass);
    assert.notEqual(await target.locator('[data-huddle-preview-status]').textContent(), status);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), original);
    assert.equal(await room.evaluate((el, name) => el.classList.contains(name), stateClass), originalClass);
  }
  const threadButton = target.locator('[data-huddle-control="thread"]');
  if (await threadButton.getAttribute('aria-pressed') === 'true') await threadButton.click();
  assert.equal(await target.locator('[data-huddle-thread]').isVisible(), false);
  assert.equal(await target.locator('[data-huddle-finish]').isVisible(), true, 'The agreed action stays available when the thread is hidden');
  assert.equal(await target.locator('[data-huddle-thread] [data-huddle-finish]').count(), 0);
  await threadButton.click();
  assert.equal(await threadButton.getAttribute('aria-pressed'), 'true');
  assert.equal(await target.locator('[data-huddle-thread]').isVisible(), true);
  const threadReaction = target.locator('[data-huddle-thread-reaction]');
  assert.equal(await threadReaction.isDisabled(), false);
  assert.match(await threadReaction.textContent(), /👍/);
  const threadCount = Number(await target.locator('[data-huddle-thread-reaction-count]').textContent());
  await threadReaction.click();
  assert.equal(await threadReaction.getAttribute('aria-pressed'), 'true');
  assert.equal(Number(await target.locator('[data-huddle-thread-reaction-count]').textContent()), threadCount + 1);
  await threadReaction.click();
  assert.equal(await threadReaction.getAttribute('aria-pressed'), 'false');
  assert.equal(Number(await target.locator('[data-huddle-thread-reaction-count]').textContent()), threadCount);
  await target.locator('[data-huddle-control="notes"]').click();
  assert.equal(await target.locator('[data-huddle-control="notes"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await target.locator('[data-huddle-notes-preview]').isVisible(), true);
  assert.ok((await target.locator('[data-huddle-notes-preview]').textContent()).includes('Sarah'));
  await target.locator('[data-huddle-control="notes"]').click();
  assert.equal(await target.locator('[data-huddle-notes-preview]').isVisible(), false);
  const reply = 'Packing check confirmed for this sample huddle.';
  await target.locator('#huddle-reply').fill(reply);
  await target.locator('[data-huddle-reply-send]').click();
  assert.equal(await target.locator('#huddle-reply').inputValue(), '');
  assert.equal(await target.locator('.sh-own-reply p').textContent(), reply);
  assert.match(await target.locator('.sh-own-reply b').textContent(), /Omar Haddad/);
  await target.locator('[data-huddle-control="emoji"]').click();
  assert.equal(await target.locator('[data-huddle-emoji-picker]').isVisible(), true);
  await target.locator('[data-huddle-reaction="🎉"]').click();
  assert.match(await target.locator('[data-huddle-reaction-result]').textContent(), /🎉/);
  await target.locator('[data-huddle-control="settings"]').click();
  assert.equal(await target.locator('[data-huddle-settings]').isVisible(), true);
  const labels = target.locator('[data-huddle-role-labels]');
  const checked = await labels.isChecked();
  await labels.setChecked(!checked); assert.equal(await labels.isChecked(), !checked);
  assert.equal(await room.evaluate(el => el.classList.contains('show-roles')), !checked);
  await labels.setChecked(checked);
  assert.equal(await room.evaluate(el => el.classList.contains('show-roles')), checked);
  await target.locator('[data-huddle-control="settings"]').click();
  assert.equal(await target.locator('[data-huddle-settings]').isVisible(), false);
  await assertClientDialog(target); await assertExternalGuidance(target);
  assert.equal((await frontline(target))[storeId].completed.includes('huddles'), false);
  await target.locator('[data-huddle-control="leave"]').click();
  assert.equal(await target.locator('#dialog').isVisible(), false);
  assert.equal(await target.locator('#dialog').evaluate(el => el.classList.contains('slack-huddle-dialog')), false, 'Leaving removes the huddle-specific dialog state');
  assert.equal((await frontline(target))[storeId].completed.includes('huddles'), false, 'Leaving does not record an agreed action');
  await guidedClick('#journey-dock [data-guide-resume]', target);
  await assertHuddleInvitation(target, storeId);
  assert.equal(await target.locator('.sh-own-reply').count(), 0, 'Reopening clears the previous local preview reply');
  assert.equal(await target.locator('[data-huddle-reaction-result]').isVisible(), false);
  await recommended('[data-huddle-join]', target);
}
async function continueGuided(target = page) {
  assert.equal(await target.locator('#dialog').isVisible(), false, 'Completing the step returns to its outcome beside Slack');
  assert.equal(await target.locator('#demo-assistant #journey-dock').isVisible(), true);
  assert.match(await target.locator('#journey-dock').textContent(), /done/i);
  await guidedClick('#journey-dock #flow-next', target);
}
const text = selector => page.locator(selector).textContent();
const base = target => target.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const frontline = target => target.evaluate(key => JSON.parse(localStorage.getItem(key)), FRONTLINE_KEY);
const normaliseFrontline = records => Object.fromEntries(['bankstown','granville','punchbowl','ivanhoe'].map(id => [id, records?.[id] || freshFrontlineStore()]));
const selectedStage = target => target.locator('#journey [aria-current="step"]').getAttribute('data-stage');
const close = async () => { if (await page.locator('#dialog').isVisible()) await click('#close-dialog'); };
const verify = async (name, action) => { await action(); passed.push(name); console.log(`PASS ${passed.length}: ${name}`); };
const completed = async id => assert.ok((await frontline(page)).bankstown.completed.includes(id), `${id} is recorded`);
const snapshot = (target, name) => target.screenshot({ path: new URL(name, artifacts).pathname, fullPage: true });
try {
  for (const [width, height] of [[1440,900], [1920,1080], [1280,800], [390,844]]) {
    await verify(`Compact ${width}×${height} workspace keeps the guide and current work reachable through sign-in, format changes and reset`, async () => {
      const frame = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 500, hasTouch: width < 500 });
      await watch(frame); frame.setDefaultTimeout(7000); diagnosticPage = frame;
      await frame.goto(url, { waitUntil: 'networkidle' });
      if (width >= 1051) await assertOfficialSlackLogo(frame);
      await assertEmployeeSignIn(frame); await assertCompactFrame(frame);
      const before = normaliseFrontline(await frontline(frame));
      for (const device of ['desktop', 'mobile']) {
        await frame.locator(`[data-device="${device}"]`).click();
        await assertEmployeeSignIn(frame); await assertCompactFrame(frame);
        assert.deepEqual(normaliseFrontline(await frontline(frame)), before);
      }
      await guidedClick('[data-access-next]', frame); await guidedClick('[data-verify-access]', frame);
      await recommended('#journey-dock #flow-next', frame); await assertCompactFrame(frame);
      await continueGuided(frame); await assertPendingChannelFormats(frame, 'mobile');
      await chooseGuidedStoreChannel(frame, 'bankstown'); await assertCompactFrame(frame);
      await frame.locator('#reset-demo').click(); await frame.locator('#confirm-reset').click();
      await assertEmployeeSignIn(frame); await assertCompactFrame(frame);
      await frame.screenshot({ path: new URL(`compact-verified-${width}.png`, artifacts).pathname });
      await frame.locator('[data-flow-pause]').click(); await frame.locator('#close-dialog').click();
      await frame.locator('[data-role="manager"]').click();
      await frame.locator('#store-playbooks [data-operation="review"]').click();
      await recommended('#review-form button[type="submit"]', frame);
      await assertClientDialog(frame); await assertCompactFrame(frame);
      const scrolling = await frame.locator('#dialog-content').evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
      assert.ok(scrolling.content > scrolling.height, 'Long review content scrolls inside the compact client');
      if ([1440,1280].includes(width)) await frame.locator('.site-header').screenshot({ path: new URL(`compact-header-${width}.png`, artifacts).pathname });
      await frame.close(); diagnosticPage = page;
    });
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await verify('Fresh entry opens Omar’s employee sign-in in the Mobile preview', async () => {
    assert.equal(await page.locator('#scene canvas').count(), 1);
    assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await selectedStage(page), 'opening');
    assert.equal(await page.locator('[data-device="mobile"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.mobile-bottom-nav').isVisible(), true);
    assert.equal(await page.locator('#frontline-features [data-feature]').count(), 10);
    assert.equal(await page.locator('#store-playbooks [data-operation]').count(), 10);
    assert.match(await text('main'), /Slack is the work OS\s*for every connected store\./);
    await assertEmployeeSignIn(page);
    assert.equal((await frontline(page))?.bankstown?.verified || false, false);
    await snapshot(page, 'employee-first-overview.png');
  });
  await verify('The employee problem and optional downloadable presenter script are easy to find', async () => {
    assert.equal(await page.locator('#store-context').evaluate(el => el.open), false, 'Detailed context starts collapsed below the working area');
    await page.locator('#store-context > summary').click();
    assert.equal(await page.locator('#problem-title').isVisible(), true);
    assert.ok((await text('#problem-title')).trim().length > 15);
    await page.locator('#store-context > summary').click();
    assert.equal(await page.locator('#presenter-notes').evaluate(el => el.open), false, 'Presenter notes start collapsed');
    assert.equal(await page.locator('#presenter-notes').evaluate(el => Boolean(el.closest('.slack-panel'))), false, 'Presenter notes belong outside the simulated Slack client');
    assert.equal(await page.locator('a.presenter-download').getAttribute('href'), 'PRESENTER-SCRIPT.md');
    assert.notEqual(await page.locator('a.presenter-download').getAttribute('download'), null);
    const script = await page.request.get(new URL('PRESENTER-SCRIPT.md', url).href);
    assert.equal(script.status(), 200, 'The presenter script can be downloaded');
    const body = await script.text();
    assert.match(body, /Slack/i); assert.match(body, /El Jannah/i);
    assert.ok(body.length > 1000, 'The download contains the full presenter script');
  });
  await verify('Desktop Slack shell has its app rail, channel sidebar and conversation', async () => {
    await click('[data-device="desktop"]');
    await assertEmployeeSignIn(page);
    await pauseInitialSignIn(page);
    await assertMemberHeader(page, 14);
    assert.equal(await page.locator('.slack-topbar').isVisible(), true);
    assert.equal(await page.locator('.workspace-rail').isVisible(), true);
    assert.equal(await page.locator('.channel-sidebar').isVisible(), true);
    assert.equal(await page.locator('.mobile-bottom-nav').isVisible(), false);
    assert.equal(await page.locator('#desktop-channel-list [data-workspace-channel]').count(), 10);
    const rail = await page.locator('.workspace-rail').boundingBox();
    const sidebar = await page.locator('.channel-sidebar').boundingBox();
    const conversation = await page.locator('.slack-body > .channel').boundingBox();
    assert.ok(sidebar.width >= 150 && conversation.width >= 300, 'Desktop navigation and messages have usable room');
    assert.ok(rail.x + rail.width <= sidebar.x + 1 && sidebar.x + sidebar.width <= conversation.x + 1, 'Desktop columns do not overlap');
    await page.locator('.slack-panel').screenshot({ path: new URL('slack-shell-desktop.png', artifacts).pathname });
  });
  await verify('Message and profile photos use consistent named teammates', async () => {
    await assertPeoplePhotos(page, '#channel-content .identity-photo', { authors: true });
    await assertPeoplePhotos(page, '.profile-mini .identity-photo');
    assert.ok(personPhotos.has('omar'), 'The employee perspective uses Omar Haddad’s photo');
  });
  await verify('Message reactions show real emoji and toggle their count and selected colour', async () => {
    await assertMessageReactions(page);
  });
  await verify('The employee’s own message and opening checks use Omar’s actual name', async () => {
    const note = 'I have checked the packing station for my shift.';
    await page.locator('#message-input').fill(note); await click('#composer button[type="submit"]');
    const ownMessage = page.locator('.message').filter({ hasText: note });
    assert.equal((await ownMessage.locator('.message-author b').textContent()).trim(), 'Omar Haddad');
    assert.equal(await ownMessage.locator('.identity-avatar').getAttribute('data-person'), 'omar');
    await click('#tab-tasks');
    assert.equal((await text('#channel-content .hub-heading')).trim(), 'Omar Haddad’s opening checks');
    assert.equal(await page.locator('#channel-content [data-check]').count(), 4);
    await assertNaturalSlackCopy(page); await click('#tab-messages');
  });
  await verify('An independently opened crew capability receives tips beside the Slack client', async () => {
    const before = await frontline(page);
    await click('#frontline-features [data-feature="canvas"]');
    await recommended('[data-canvas-read]');
    assert.equal(await page.locator('#demo-assistant #click-coach').isVisible(), true);
    await assertClientDialog(page); await assertExternalGuidance(page);
    assert.deepEqual(await frontline(page), before, 'Opening a capability does not complete it');
    await close();
    assert.equal(await page.locator('#click-coach').isVisible(), false);
    assert.equal(await page.locator('[data-recommended-target]').count(), 0);
  });
  await verify('Dialogs remain inside Slack while the 3D store stays interactive', async () => {
    await click('#sources');
    const title = await text('#dialog-title');
    await click('#explode');
    assert.equal(await page.locator('#explode-range').inputValue(), '100');
    assert.equal(await text('#dialog-title'), title);
    assert.equal(await page.locator('.scene-panel').isVisible(), true);
    await click('#reset-view'); await close();
  });
  await verify('Escape closes client search and returns focus to its trigger', async () => {
    await click('#slack-search');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'search-input');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    await page.waitForFunction(() => document.activeElement.id === 'slack-search');
  });
  await verify('Long review content scrolls within the client and closes with usable focus', async () => {
    await click('[data-role="manager"]');
    await click('[data-device="mobile"]'); await click('#store-playbooks [data-operation="review"]');
    await recommended('#review-form button[type="submit"]');
    assert.equal(await page.locator('#demo-assistant #click-coach').isVisible(), true);
    const before = await page.locator('#dialog').boundingBox();
    const scroller = await page.locator('#dialog').evaluate(el => {
      const candidate = [el, ...el.querySelectorAll('*')].find(item => /auto|scroll/.test(getComputedStyle(item).overflowY) && item.scrollHeight > item.clientHeight + 1);
      if (!candidate) return null;
      candidate.scrollTop = candidate.scrollHeight;
      return { scrollTop: candidate.scrollTop, clientHeight: candidate.clientHeight, scrollHeight: candidate.scrollHeight };
    });
    assert.ok(scroller && scroller.scrollTop > 0, 'Long content has an internal scroll area');
    await assertClientDialog(page);
    const after = await page.locator('#dialog').boundingBox();
    assert.equal(after.y, before.y); assert.equal(after.height, before.height);
    await close();
    await page.waitForFunction(() => document.activeElement !== document.body && document.activeElement.getClientRects().length > 0 && !document.activeElement.closest('[inert]'));
    await click('[data-device="desktop"]');
  });
  await click('#tour');
  await verify('Guided access waits for the presenter while its dialog is open', async () => {
    await assertEmployeeSignIn(page);
    assert.equal((await base(page)).role, 'crew');
    const stage = await selectedStage(page), title = await text('#dialog-title');
    const idleState = { base: await base(page), frontline: await frontline(page) };
    await page.waitForTimeout(11200);
    assert.equal(await selectedStage(page), stage);
    assert.equal(await text('#dialog-title'), title);
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, idleState, 'The guide never performs actions or advances progress while idle');
    assert.equal(await page.locator('#scene').getAttribute('data-phone-feature'), 'access');
    assert.equal(await page.locator('#scene').getAttribute('data-phone-phase'), 'view');
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true');
    await page.locator('#demo-grid').screenshot({ path: new URL('contained-access-desktop.png', artifacts).pathname });
  });
  await verify('Closing a guided step offers one visible Resume action beside Slack', async () => {
    const before = { base: await base(page), frontline: await frontline(page) };
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    await guidedClick('#journey-dock [data-guide-resume]');
    await recommended('[data-access-next]');
    assert.match(await text('#click-coach'), /STEP 01 OF 10/);
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before, 'Closing and resuming does not complete the step');
  });
  await verify('Employee ID sign-in names Omar and uses a clear approval check', async () => {
    await guidedClick('[data-access-next]');
    assert.match(await text('#dialog-content'), /Confirm your sign-in/);
    assert.match(await text('#dialog-content'), /Omar Haddad · Employee EJ-014/);
    assert.equal((await text('[data-verify-access]')).trim(), 'Approve sign-in');
    await guidedClick('[data-verify-access]');
    await completed('access'); assert.equal((await frontline(page)).bankstown.verified, true);
  });
  await verify('Expanding Slack keeps the completed-step card outside the client and reachable', async () => {
    await click('#expand-slack');
    assert.equal(await page.locator('.scene-panel').isVisible(), false);
    await assertExternalGuidance(page); await recommended('#journey-dock #flow-next');
    await click('#expand-slack');
    assert.equal(await page.locator('.scene-panel').isVisible(), true);
    await assertExternalGuidance(page); await recommended('#journey-dock #flow-next');
  });
  await continueGuided();
  await verify('Ten native channels remain reachable across format changes and open the store in one click', async () => {
    await assertPendingChannelFormats(page, 'desktop');
    await chooseGuidedStoreChannel(page, 'bankstown'); await completed('channels');
  });
  await continueGuided();
  await verify('Briefing video loads and its transcript completes the clip step', async () => {
    await page.waitForFunction(() => {
      const video = document.querySelector('#briefing-video');
      return video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0;
    });
    const duration = await page.locator('#briefing-video').evaluate(video => video.duration);
    assert.ok(duration >= 10 && duration <= 15, `Expected a short briefing, received ${duration}s`);
    assert.equal(await page.locator('#briefing-video track[kind="captions"]').count(), 1);
    await recommended('[data-play-briefing]');
    assert.equal(await page.locator('#briefing-video').evaluate(video => video.paused), true, 'The guide never starts the clip automatically');
    await click('.clip-transcript summary'); await guidedClick('[data-clip-read]'); await completed('clips');
  });
  await continueGuided();
  await verify('Store Hub remains view only and links explain the source records', async () => {
    assert.match(await text('.canvas-preview'), /VIEW ONLY/);
    assert.equal(await page.locator('.canvas-preview input, .canvas-preview textarea, .canvas-preview [contenteditable="true"]').count(), 0);
    await click('[data-record-info="people"]'); assert.match(await text('.record-link-preview'), /Employment Hero/);
    await guidedClick('[data-canvas-read]'); await completed('canvas');
  });
  await continueGuided();
  await verify('Crew task list shows owners without editable cells', async () => {
    assert.match(await text('.list-preview'), /Layla/);
    assert.equal(await page.locator('.list-preview input, .list-preview [contenteditable="true"]').count(), 0);
    await guidedClick('[data-list-read]'); await completed('lists');
  });
  await continueGuided();
  await verify('Open-shift request waits for approval and clock-in persists', async () => {
    await click('[data-open-shifts]'); await click('[data-request-open-shift="Friday"]');
    assert.equal(await page.locator('[data-request-open-shift="Friday"]').isDisabled(), true);
    assert.match(await text('#dialog-content'), /awaiting approval/);
    await guidedClick('#dialog [data-feature="shifts"]'); await guidedClick('[data-clock-in]'); await completed('shifts');
    const reloadProbe = await context.newPage(); await watch(reloadProbe);
    await reloadProbe.goto(url, { waitUntil: 'networkidle' });
    assert.equal((await frontline(reloadProbe)).bankstown.clockedIn, true);
    assert.match(await reloadProbe.locator('#frontline-session').textContent(), /Clocked in/);
    await reloadProbe.close();
  });
  await continueGuided();
  const issueText = 'Two sample orders missed their garlic sauce. Please add a final packing check.';
  await verify('Presenter notes follow the issue step and toggle without replacing the form', async () => {
    await page.locator('#issue-form textarea').fill(issueText);
    const form = await page.locator('#issue-form textarea').elementHandle();
    const before = { base: await base(page), frontline: await frontline(page) };
    await assertPresenterStep(page);
    for (const open of [true, false]) {
      await page.locator('#presenter-notes > summary').click();
      assert.equal(await page.locator('#presenter-notes').evaluate(el => el.open), open);
      assert.equal(await form.evaluate(el => el === document.querySelector('#issue-form textarea')), true, 'The same form remains open');
      assert.equal(await page.locator('#issue-form textarea').inputValue(), issueText);
      assert.equal(await page.locator('[data-recommended-target]').evaluate(el => el.matches('#issue-form button[type="submit"]')), true);
      assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
    }
    await click('#frontline-guide [data-guide-focus]'); await recommended('#issue-form button[type="submit"]');
    await form.dispose();
  });
  await verify('Changing preview device preserves the guided form, progress and next click', async () => {
    await page.locator('#issue-form textarea').fill(issueText);
    const before = { base: await base(page), frontline: await frontline(page) };
    for (const device of ['mobile', 'desktop']) {
      await click(`[data-device="${device}"]`);
      assert.equal(await page.locator('#issue-form textarea').inputValue(), issueText);
      await recommended('#issue-form button[type="submit"]');
      assert.match(await text('#click-coach'), /STEP 07 OF 10/);
      assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
    }
  });
  await verify('One-tap issue workflow records the crew report and manager owner', async () => {
    await page.locator('#issue-form textarea').fill(issueText);
    assert.equal(await page.locator('#scene').getAttribute('data-phone-feature'), 'workflows');
    assert.equal(await page.locator('#scene').getAttribute('data-phone-phase'), 'typing');
    await guidedClick('#issue-form button[type="submit"]');
    await completed('workflows');
    assert.equal(await page.locator('#scene').getAttribute('data-phone-phase'), 'success');
    const issue = (await frontline(page)).bankstown.issue;
    assert.equal(issue.text, issueText); assert.equal(issue.owner, 'Sarah');
  });
  await continueGuided();
  await verify('Huddle photos and controls support a simulated call, leave and rejoin without completing the step', async () => {
    await exerciseHuddle(page, 'bankstown');
    assert.deepEqual(mediaRequests, [], 'The huddle controls do not request real media access');
  });
  await verify('Huddle joins the team and records the agreed next step', async () => {
    await guidedClick('[data-huddle-join]'); assert.match(await text('#huddle-status'), /joined|in the huddle/i);
    assert.equal((await frontline(page)).bankstown.completed.includes('huddles'), false, 'Joining alone does not record the agreed action');
    await guidedClick('[data-huddle-finish]'); await completed('huddles');
    assert.match(await text('#channel-content'), /Huddle action recorded/);
    assert.equal((await frontline(page)).bankstown.events.filter(event => event.text.includes('Huddle action recorded')).length, 1, 'Rejoining records exactly one final action');
    assert.equal(await page.locator('#dialog').evaluate(el => el.classList.contains('slack-huddle-dialog')), false);
  });
  await continueGuided();
  let agentAnswer;
  await verify('Approved agent answers in context and keeps the reply in the channel', async () => {
    await page.locator('#agent-form textarea').fill('Who is the manager on duty?');
    await guidedClick('#agent-form button[type="submit"]');
    agentAnswer = await text('#agent-answer .brief-answer p');
    assert.match(agentAnswer, /Sarah is the manager on duty/);
    await guidedClick('[data-agent-finish]'); await completed('agents');
    assert.ok((await text('#channel-content')).includes(agentAnswer));
  });
  await continueGuided();
  await verify('Governed access blocks external connections before clock-out', async () => {
    await click('[data-access-check="internal"]'); assert.match(await text('#access-result'), /Allowed/);
    await guidedClick('[data-access-check="external"]'); assert.match(await text('#access-result'), /Restricted/);
    await click('[data-access-check="connect"]'); assert.match(await text('#access-result'), /Slack Connect are unavailable/);
    await guidedClick('[data-clock-out]'); await completed('governance');
    const shift = (await frontline(page)).bankstown;
    assert.deepEqual([...shift.completed].sort(), [...FEATURE_IDS].sort());
    assert.equal(shift.checkedOut, true); assert.equal(shift.clockedIn, false);
    assert.match(await text('#frontline-progress'), /10 \/ 10/);
  });
  await continueGuided();
  await verify('Completed walkthrough leads into the manager perspective', async () => {
    assert.equal(await page.locator('#dialog').isVisible(), false, 'The crew summary does not open a Slack dialog');
    await assertExternalGuidance(page);
    assert.match(await text('#journey-dock'), /10 of 10 capabilities/);
    assert.equal(presenterProblems.size, 10, 'Presenter notes followed all ten crew capabilities');
    assert.equal(new Set(presenterProblems.values()).size, 10, 'Each crew capability explains its own problem');
    await guidedClick('[data-open-manager-playbooks]'); assert.equal((await base(page)).role, 'manager');
    assert.match(await text('#dialog-title'), /guest feedback/i);
    await recommended('[data-operation-assign="complaints"]');
  });
  const managerStartState = { base: await base(page), frontline: await frontline(page) };
  await verify('Manager handoff resumes beside Slack and free exploration keeps tips until the form closes', async () => {
    await close();
    await guidedClick('#journey-dock [data-guide-resume]');
    await recommended('[data-operation-assign="complaints"]');
    await click('[data-flow-pause]');
    assert.equal(await page.locator('#journey-dock').isVisible(), false);
    assert.equal(await page.locator('#dialog').isVisible(), true);
    assert.equal(await page.locator('#click-coach').isVisible(), true);
    await recommended('[data-operation-assign="complaints"]');
    await close();
    assert.equal(await page.locator('#click-coach').isVisible(), false);
    assert.equal(await page.locator('[data-recommended-target]').count(), 0);
    assert.equal((await base(page)).role, 'manager');
  });
  await verify('All ten guided manager playbooks lead through one visible next click to the store network', async () => {
    const manager = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    await watch(manager); manager.setDefaultTimeout(7000); diagnosticPage = manager;
    // Resume the real crew journey snapshot in an isolated browser so the manual
    // operation checks below remain independent of guided completion behaviour.
    await manager.addInitScript(({ snapshot, baseKey, frontlineKey }) => {
      localStorage.setItem(baseKey, JSON.stringify(snapshot.base));
      localStorage.setItem(frontlineKey, JSON.stringify(snapshot.frontline));
    }, { snapshot: managerStartState, baseKey: STORAGE_KEY, frontlineKey: FRONTLINE_KEY });
    await manager.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await manager.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await selectedStage(manager), 'opening');
    await manager.locator('[data-device="desktop"]').click();
    await manager.locator('#tour').click(); await guidedClick('[data-open-manager-playbooks]', manager);
    for (const [index, id] of OPERATION_IDS.entries()) {
      assert.match(await manager.locator('#click-coach').textContent(), new RegExp(`PLAYBOOK ${String(index + 1).padStart(2, '0')} OF 10`));
      if (id === 'follow-up') {
        await guidedClick('[data-operation-age]', manager);
        assert.equal((await frontline(manager)).bankstown.operations[id].elapsedHours, 48);
        await guidedClick('[data-operation-escalate="follow-up"]', manager);
        assert.equal((await frontline(manager)).bankstown.operations[id].status, 'escalated');
      } else if (id === 'review') {
        const draft = 'Thanks for flagging the missing sauce. Sarah will check the packing handover and follow up with the guest.';
        await manager.locator('#review-form textarea').fill(draft);
        await guidedClick('#review-form button[type="submit"]', manager);
        assert.equal((await frontline(manager)).bankstown.operations.review.draft, draft);
        assert.equal((await frontline(manager)).bankstown.operations.review.status, 'approved');
      } else {
        await guidedClick(`[data-operation-assign="${id}"]`, manager);
        assert.equal((await frontline(manager)).bankstown.operations[id].owner, 'Sarah');
        await guidedClick(`[data-operation-resolve="${id}"]`, manager);
        assert.equal((await frontline(manager)).bankstown.operations[id].status, 'resolved');
      }
      assert.equal(await manager.locator('#dialog').isVisible(), false, 'The completed playbook shows its outcome beside Slack');
      if (index === 0) await manager.locator('#demo-grid').screenshot({ path: new URL('guided-manager-next-step.png', artifacts).pathname });
      await guidedClick('#journey-dock [data-manager-next]', manager);
    }
    assert.equal(await manager.locator('#dialog').isVisible(), false, 'The manager summary does not open a Slack dialog');
    await assertExternalGuidance(manager);
    assert.match(await manager.locator('#journey-dock').textContent(), /All ten manager playbooks are complete/);
    await guidedClick('[data-guided-network]', manager);
    assert.equal(await manager.locator('#network-view').isVisible(), true);
    assert.equal(await manager.locator('[data-recommended-target]').count(), 0);
    await manager.close(); diagnosticPage = page;
  });
  await verify('Reload keeps clock-out, completed capabilities and the agent answer', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await text('#frontline-session'), /Shift complete/);
    assert.match(await text('#frontline-progress'), /10 \/ 10/);
    await click('[data-stage="people"]'); assert.ok((await text('#channel-content')).includes(agentAnswer));
  });
  await verify('Manager actions require an explicit perspective switch for crew', async () => {
    await click('[data-role="crew"]');
    await click('#store-playbooks [data-operation="complaints"]');
    assert.equal((await base(page)).role, 'crew');
    assert.equal(await page.locator('[data-operation-assign]').count(), 0);
    await click('#switch-manager-feature'); assert.equal((await base(page)).role, 'manager'); await close();
  });
  for (const id of OPERATION_IDS) {
    await verify(`Manager playbook: ${id}`, async () => {
      await click(`#store-playbooks [data-operation="${id}"]`);
      if (id === 'follow-up') {
        assert.equal(await page.locator('[data-operation-escalate]').isDisabled(), true);
        await click('[data-operation-age]');
        assert.equal((await frontline(page)).bankstown.operations[id].elapsedHours, 48);
        await click('[data-operation-escalate]');
        assert.equal((await frontline(page)).bankstown.operations[id].status, 'escalated');
        assert.match(await text('.feature-result'), /Karim/);
      } else if (id === 'review') {
        const draft = 'Thanks for telling us about the missing sauce. We are sorry your order was incomplete. Our store team will check the order details and follow up with you.';
        await page.locator('#review-form textarea').fill(draft); await click('#review-form button[type="submit"]');
        const op = (await frontline(page)).bankstown.operations[id];
        assert.equal(op.status, 'approved'); assert.equal(op.draft, draft);
        assert.equal(await page.locator('#review-form textarea').inputValue(), draft);
        assert.equal(await page.locator('#review-form textarea').getAttribute('readonly'), '');
        assert.equal(await page.locator('#review-form button').isDisabled(), true);
      } else {
        await click(`[data-operation-assign="${id}"]`);
        assert.equal((await frontline(page)).bankstown.operations[id].status, 'assigned');
        assert.equal((await frontline(page)).bankstown.operations[id].owner, 'Sarah');
        await click(`[data-operation-resolve="${id}"]`);
        assert.equal((await frontline(page)).bankstown.operations[id].status, 'resolved');
        assert.equal(await page.locator(`[data-operation-resolve="${id}"]`).isDisabled(), true);
      }
      await close();
    });
  }
  await verify('All ten manager playbooks are tracked and isolated by store', async () => {
    assert.match(await text('#playbook-count'), /10 \/ 10/);
    await page.locator('#store-select').selectOption('granville');
    assert.match(await text('#playbook-count'), /0 \/ 10/); assert.match(await text('#frontline-progress'), /0 \/ 10/);
    assert.doesNotMatch(await text('#channel-content'), /Two sample orders missed their garlic sauce/);
    await page.locator('#store-select').selectOption('bankstown');
    assert.match(await text('#playbook-count'), /10 \/ 10/); assert.match(await text('#frontline-progress'), /10 \/ 10/);
  });
  await verify('Desktop and Mobile previews preserve the current store, stage and progress', async () => {
    await click('[data-stage="people"]');
    const before = { base: await base(page), frontline: await frontline(page) };
    await click('[data-device="mobile"]');
    assert.equal(await page.locator('[data-device="mobile"]').getAttribute('aria-pressed'), 'true');
    const bounds = await page.locator('.slack-panel').boundingBox();
    assert.ok(bounds.width >= 280 && bounds.width <= 440, `Phone preview width ${bounds.width}`);
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1440);
    await snapshot(page, 'connected-phone-preview.png');
    await click('[data-device="desktop"]');
    assert.equal(await page.locator('[data-device="desktop"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
  });
  const shellDraft = 'Keep this packing note while I explore the workspace.';
  await verify('Desktop native channel navigation returns to the same workflow and draft', async () => {
    await click('[data-stage="people"]'); await page.locator('#message-input').fill(shellDraft);
    const before = { base: await base(page), frontline: await frontline(page) };
    await click('#desktop-channel-list [data-workspace-channel="announcements"]');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    assert.equal(await text('#channel-name'), 'announcements');
    assert.equal(await page.locator('.slack-body > .channel').isVisible(), true);
    assert.match(await text('#channel-content'), /service focus/);
    await click('#desktop-channel-list [data-workspace-channel="store"]');
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
  });
  await verify('Every assigned channel opens a normal conversation and preserves the store draft and outcomes', async () => {
    const before = { base: await base(page), frontline: await frontline(page) };
    const ids = await page.locator('#desktop-channel-list [data-workspace-channel]').evaluateAll(rows => rows.map(row => row.dataset.workspaceChannel));
    assert.equal(new Set(ids).size, 10);
    for (const id of ids.filter(id => id !== 'store')) {
      await click(`#desktop-channel-list [data-workspace-channel="${id}"]`);
      assert.equal(await page.locator('#dialog').isVisible(), false, `${id} uses the standard channel surface`);
      assert.equal((await text('#channel-name')).trim(), id);
      assert.equal(await page.locator('.slack-body > .channel').isVisible(), true);
      assert.ok((await text('#channel-content')).trim().length > 50, `${id} contains a useful conversation`);
      assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before, 'Browsing channels never completes store work');
    }
    await click('#desktop-channel-list [data-workspace-channel="store"]');
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
  });
  await verify('Desktop Threads, Drafts and Store Hub shortcuts have useful destinations', async () => {
    await click('.workspace-shortcuts [data-shell-shortcut="threads"]');
    assert.match(await text('#dialog-title'), /Threads/i); assert.ok((await text('#dialog-content')).length > 80); await close();
    await click('.workspace-shortcuts [data-shell-shortcut="drafts"]');
    assert.ok((await text('#dialog-content')).includes(shellDraft)); await close();
    await click('.workspace-shortcuts [data-shell-shortcut="hub"]');
    assert.equal(await page.locator('#tab-hub').getAttribute('aria-selected'), 'true');
    await click('#tab-messages'); assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
  });
  await verify('Desktop DMs, Activity, More and profile controls open useful views', async () => {
    await click('.workspace-rail [data-desktop-nav="dms"]');
    assert.equal(await text('#dialog-title'), 'Direct messages');
    assert.equal(await page.locator('.shell-teammate').count(), 3);
    await assertPeoplePhotos(page, '.shell-teammate .identity-photo', { minimum: 2 });
    const teammateName = (await page.locator('.shell-teammate b').first().textContent()).trim();
    assert.ok(Object.values(personNames).includes(teammateName));
    await page.locator('.shell-teammate').first().click();
    assert.equal(await text('#dialog-title'), teammateName);
    await assertPeoplePhotos(page, '.shell-sample-message .identity-photo');
    assert.match(await text('#dialog-content .feature-context'), /Direct message · Bankstown/); await close();
    await click('.workspace-rail [data-desktop-nav="activity"]');
    assert.equal(await text('#dialog-title'), 'Activity');
    assert.ok(await page.locator('.shell-activity-item').count() > 0, 'Completed crew and store work appears in Activity'); await close();
    await click('.workspace-rail .rail-button[data-desktop-nav="more"]');
    assert.equal(await page.locator('#dialog [data-shell-feature]').count(), 4); await close();
    await click('.workspace-rail [data-desktop-nav="you"]');
    assert.equal(await text('#dialog-title'), 'You'); assert.match(await text('.shell-profile'), /Sarah Mansour/);
    await assertPeoplePhotos(page, '.shell-profile .identity-photo'); await close();
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
  });
  await verify('iOS channel shell has a purple header and named member photos beside the count', async () => {
    await click('[data-device="mobile"]');
    assert.equal(await page.locator('.slack-topbar').isVisible(), false);
    assert.equal(await page.locator('.workspace-rail').isVisible(), false);
    assert.equal(await page.locator('.channel-sidebar').isVisible(), false);
    assert.equal(await page.locator('.slack-back').isVisible(), true);
    assert.equal(await page.locator('.mobile-bottom-nav').isVisible(), true);
    await assertMemberHeader(page, 14, true);
    await page.locator('.slack-panel').screenshot({ path: new URL('slack-shell-ios-channel.png', artifacts).pathname });
  });
  await verify('iOS Home shows ten channels and returns without losing the current draft', async () => {
    const before = { base: await base(page), frontline: await frontline(page) };
    await click('[data-slack-back]');
    assert.equal(await page.locator('#slack-home').isVisible(), true);
    assert.equal(await page.locator('.slack-body > .channel').isVisible(), false);
    assert.equal(await page.locator('#mobile-channel-list [data-workspace-channel]').count(), 10);
    assert.equal(await page.locator('#mobile-channel-list [data-workspace-channel="store"]').count(), 1);
    assert.equal(await page.locator('.mobile-workspace-heading').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(74, 21, 75)');
    await page.locator('.slack-panel').screenshot({ path: new URL('slack-shell-ios-home.png', artifacts).pathname });
    await click('#mobile-channel-list [data-workspace-channel="training"]');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    assert.equal(await text('#channel-name'), 'training');
    await click('[data-slack-back]'); await click('#mobile-channel-list [data-workspace-channel="store"]');
    assert.equal(await page.locator('.slack-body > .channel').isVisible(), true);
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
    assert.deepEqual({ base: await base(page), frontline: await frontline(page) }, before);
    await click('.mobile-bottom-nav [data-mobile-nav="home"]');
    await click('#mobile-channel-list [data-workspace-channel="store"]');
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
  });
  await verify('iOS bottom navigation and Home shortcuts remain functional', async () => {
    await click('.mobile-bottom-nav [data-mobile-nav="dms"]'); assert.equal(await text('#dialog-title'), 'Direct messages');
    await assertPeoplePhotos(page, '.shell-teammate .identity-photo', { minimum: 2 }); await close();
    await click('.mobile-bottom-nav [data-mobile-nav="activity"]');
    assert.equal(await text('#dialog-title'), 'Activity'); assert.ok(await page.locator('.shell-activity-item').count() > 0); await close();
    await click('.mobile-bottom-nav [data-mobile-nav="you"]'); assert.equal(await text('#dialog-title'), 'You');
    await assertPeoplePhotos(page, '.shell-profile .identity-photo'); await close();
    await click('.mobile-bottom-nav [data-mobile-nav="home"]');
    await click('.mobile-shortcuts [data-shell-shortcut="later"]'); assert.match(await text('#dialog-title'), /Later/i); await close();
    await click('[data-slack-search-mobile]'); assert.equal(await page.locator('#search-input').isVisible(), true); await close();
    await click('[data-device="desktop"]');
    assert.equal(await page.locator('.channel-sidebar').isVisible(), true);
    assert.equal(await page.locator('.slack-body > .channel').isVisible(), true, 'Switching away from iOS Home restores the desktop conversation');
    assert.equal(await page.locator('#message-input').inputValue(), shellDraft);
  });
  // Original workflows run in their own fresh context because linked manager
  // playbooks can already have completed the same store outcomes above.
  const connectedPage = page;
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  await watch(page); page.setDefaultTimeout(7000);
  await page.goto(url, { waitUntil: 'networkidle' });
  await assertEmployeeSignIn(page);
  await guidedClick('[data-access-next]'); await guidedClick('[data-verify-access]');
  await pauseInitialSignIn(page);
  await verify('An open form follows Desktop and Mobile previews without losing its text', async () => {
    await click('[data-device="desktop"]'); await click('[data-role="manager"]');
    await click('#store-playbooks [data-operation="review"]');
    await page.locator('#review-form textarea').fill('An unsent review draft for Bankstown.');
    const before = await base(page);
    await click('[data-device="mobile"]'); await assertClientDialog(page);
    assert.equal(await page.locator('#review-form textarea').inputValue(), 'An unsent review draft for Bankstown.');
    await click('[data-device="desktop"]'); await assertClientDialog(page);
    assert.equal(await page.locator('#review-form textarea').inputValue(), 'An unsent review draft for Bankstown.');
    assert.deepEqual(await base(page), before);
  });
  await verify('Changing stores dismisses the previous store form before it can be submitted', async () => {
    await page.locator('#store-select').selectOption('granville');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    assert.equal(await page.locator('#store-select').inputValue(), 'granville');
    const records = await frontline(page);
    assert.equal(records?.granville?.operations?.review, undefined);
    await page.locator('#store-select').selectOption('bankstown');
  });
  await verify('Changing perspective dismisses manager decisions and keeps crew access explicit', async () => {
    await click('#store-playbooks [data-operation="review"]');
    await click('[data-role="crew"]');
    assert.equal(await page.locator('#dialog').isVisible(), false);
    assert.equal((await base(page)).role, 'crew');
    assert.equal((await frontline(page))?.bankstown?.operations?.review, undefined);
    await click('[data-role="manager"]');
  });
  await verify('A network briefing brings its contained dialog back into the Slack client', async () => {
    await click('[data-view="network"]');
    assert.equal(await page.locator('#network-view').isVisible(), true);
    await click('#network-view [data-modal="brief"]');
    assert.match(await text('#dialog-title'), /Monday store briefing/);
    assert.equal(await page.locator('.slack-panel').isVisible(), true);
    assert.equal(await page.locator('.scene-panel').isVisible(), true);
    await assertClientDialog(page); await close();
  });
  await verify('Opening checks retain keyboard focus and completion has a stable next step', async () => {
    await click('[data-stage="opening"]'); await click('[data-action="primary"]');
    await click('[data-finish-opening]');
    assert.match(await text('#toast'), /four opening checks/);
    for (let i = 0; i < 4; i++) {
      await page.locator(`[data-check="${i}"]`).focus(); await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.check), String(i));
    }
    await click('[data-finish-opening]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-stage');
  });
  for (const stage of ['rush', 'prep', 'supply', 'people', 'close', 'network']) {
    await verify(`Original shift workflow: ${stage}`, async () => {
      await click(`[data-stage="${stage}"]`); await click('[data-action="primary"]');
      if (stage === 'rush') {
        assert.equal((await base(page)).stores.bankstown.owner, 'Sarah');
        await click('[data-action="primary"]');
      }
      await click(`[data-confirm-stage="${stage}"]`);
      assert.equal(await page.locator('[data-action="primary"]').isDisabled(), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'next-stage');
      if (stage === 'rush') assert.match(await text('#channel-content'), /4:06/);
    });
  }
  await verify('Saved manager work reloads into crew opening while notes and outcomes remain intact', async () => {
    await click('[data-stage="rush"]');
    await page.locator('#message-input').fill('Bring one extra packer to collection.');
    await click('#composer button[type="submit"]');
    const ownMessage = page.locator('.message').filter({ hasText: 'Bring one extra packer to collection.' });
    assert.match(await ownMessage.locator('.message-author b').textContent(), /Sarah Mansour/);
    assert.equal(await ownMessage.locator('.identity-avatar').getAttribute('data-person'), 'sarah', 'A manager’s own message uses the current manager identity');
    const savedStores = (await base(page)).stores;
    const savedFrontline = await frontline(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await selectedStage(page), 'opening');
    assert.equal(await page.locator('[data-device="desktop"]').getAttribute('aria-pressed'), 'true', 'An explicit Desktop choice survives reload');
    assert.deepEqual((await base(page)).stores, savedStores);
    assert.deepEqual(await frontline(page), savedFrontline);
    await click('[data-stage="rush"]');
    assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.match(await ownMessage.locator('.message-author b').textContent(), /Sarah Mansour/, 'A saved manager message keeps its author when an employee reads it');
    assert.equal(await ownMessage.locator('.identity-avatar').getAttribute('data-person'), 'sarah');
    await click('[data-role="manager"]');
    assert.match(await text('#channel-content'), /Bring one extra packer to collection/);
    assert.match(await text('#channel-content'), /4:06/);
    await page.locator('#message-input').fill('A draft for Bankstown.');
    await page.locator('#store-select').selectOption('granville');
    assert.doesNotMatch(await text('#channel-content'), /Bring one extra packer to collection/);
    assert.equal(await page.locator('#message-input').inputValue(), '');
    await page.locator('#store-select').selectOption('bankstown');
    assert.equal(await page.locator('#message-input').inputValue(), 'A draft for Bankstown.');
  });
  await verify('Network filters, store links and search find the right store', async () => {
    await click('[data-view="network"]'); assert.equal(await page.locator('.store-card').count(), 4);
    await assertStorePhotos(page);
    await click('[data-filter="VIC"]'); assert.equal(await page.locator('.store-card').count(), 1);
    assert.match(await text('.store-card'), /Ivanhoe/);
    await click('[data-filter="all"]'); await click('[data-open-store="punchbowl"]');
    assert.equal(await text('#channel-name'), 'store-punchbowl');
    await click('#slack-search'); await page.locator('#search-input').fill('Ivanhoe');
    await click('#search-results [data-open-store="ivanhoe"]');
    assert.equal(await text('#channel-name'), 'store-ivanhoe');
    await click('[data-stage="network"]'); await click('[data-action="secondary"]');
    await click('[data-evidence="delivery"]'); assert.match(await text('#dialog-content'), /84 paused minutes/);
    await click('[data-ask-diagnostic]'); await click('[data-open-diagnostic-stage]');
    assert.equal(await page.locator('#store-select').inputValue(), 'bankstown');
  });
  await verify('Slack expansion, keyboard tabs and reduced-motion controls remain usable', async () => {
    await click('#expand-slack'); assert.equal(await page.locator('.scene-panel').isVisible(), false);
    await click('#expand-slack'); assert.equal(await page.locator('.scene-panel').isVisible(), true);
    await click('#tab-hub'); assert.match(await text('#channel-content'), /Store Hub/);
    await page.locator('#tab-hub').press('ArrowRight');
    assert.equal(await page.locator('#tab-tasks').getAttribute('aria-selected'), 'true');
    await click('#tab-messages'); assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true');
  });
  await verify('Store rotation starts and stops explicitly and Pause or Reset always stops it', async () => {
    assert.equal(await page.locator('#rotate').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#rotate').getAttribute('aria-label'), 'Start rotation');
    await click('#rotate');
    assert.equal(await page.locator('#rotate').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#rotate').getAttribute('aria-label'), 'Stop rotation');
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'false', 'An explicit rotation request resumes the scene');
    await click('#motion');
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#rotate').getAttribute('aria-pressed'), 'false', 'Pause clears rotation');
    await click('#motion');
    assert.equal(await page.locator('#rotate').getAttribute('aria-pressed'), 'false', 'Resuming animation does not restart an orbit');
    await click('#rotate'); await click('#reset-view');
    assert.equal(await page.locator('#rotate').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#rotate').getAttribute('aria-label'), 'Start rotation');
    if (await page.locator('#motion').getAttribute('aria-pressed') === 'false') await click('#motion');
  });
  await verify('Store selection clears stale inspector context and reset clears scene controls', async () => {
    await click('[data-zone="grill"]'); await page.locator('#store-select').selectOption('granville');
    assert.equal(await page.locator('#zone-inspector').isVisible(), false);
    assert.equal(await page.locator('[data-zone].active').count(), 0);
    await click('[data-zone="grill"]'); assert.doesNotMatch(await text('#zone-inspector'), /bankstown/);
    await click('#explode'); await page.locator('canvas').focus(); await page.keyboard.press('Home');
    assert.equal(await page.locator('#explode-range').inputValue(), '0');
    assert.equal(await page.locator('#zone-inspector').isVisible(), false);
    assert.equal(await page.locator('[data-zone].active').count(), 0);
  });
  await verify('Crew stays in crew view when continuing after handover', async () => {
    await click('[data-role="crew"]'); await click('[data-stage="close"]'); await click('#next-stage');
    assert.equal((await base(page)).role, 'crew'); assert.equal(await selectedStage(page), 'opening');
  });
  await verify('A posted handover keeps its original outcomes after later work', async () => {
    await click('[data-role="manager"]'); await click('[data-stage="close"]');
    await click('[data-action="primary"]'); await click('[data-confirm-stage="close"]');
    const published = await page.locator('.message').filter({ hasText: 'Outcomes at publication:' }).textContent();
    const oldSnapshot = (await base(page)).stores.granville.recapSnapshot;
    await click('[data-stage="prep"]'); await click('[data-action="primary"]'); await click('[data-confirm-stage="prep"]');
    await click('[data-stage="close"]');
    assert.deepEqual((await base(page)).stores.granville.recapSnapshot, oldSnapshot);
    assert.equal(await page.locator('.message').filter({ hasText: 'Outcomes at publication:' }).textContent(), published);
  });
  await verify('Persisted page transitions retain the interactive WebGL canvas', async () => {
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    assert.equal(await page.locator('#scene canvas').count(), 1);
    await click('#explode'); assert.equal(await page.locator('#explode-range').inputValue(), '100');
    await click('#reset-view'); assert.equal(await page.locator('#explode-range').inputValue(), '0');
  });
  await snapshot(page, 'connected-original-workflows.png');
  await page.close(); page = connectedPage;
  await snapshot(page, 'connected-desktop.png');
  for (const width of [390, 320]) {
    await verify(`Real ${width}px viewport: all ten guided capabilities stay visible and usable`, async () => {
      const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await watch(mobile); mobile.setDefaultTimeout(7000); diagnosticPage = mobile;
      await mobile.goto(url, { waitUntil: 'networkidle' });
      const noOverflow = async () => assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`);
      await noOverflow(); await assertEmployeeSignIn(mobile);
      await pauseInitialSignIn(mobile);
      await assertMemberHeader(mobile, 14, true);
      for (const selector of ['#reset-demo', '#store-select', '[data-device="desktop"]', '[data-device="mobile"]']) {
        const control = await mobile.locator(selector).boundingBox();
        assert.ok(control.x >= 0 && control.x + control.width <= width + 1, `${selector} stays reachable at ${width}px`);
      }
      await mobile.locator('[data-device="mobile"]').click(); await noOverflow();
      const bounds = await mobile.locator('.slack-panel').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Phone stays inside the viewport');
      await mobile.locator('#store-select').selectOption('ivanhoe');
      await assertPeoplePhotos(mobile, '#channel-content .identity-photo', { authors: true });
      await assertPeoplePhotos(mobile, '.profile-mini .identity-photo');
      await assertMessageReactions(mobile);
      await mobile.locator('#message-input').fill('A mobile draft for Ivanhoe.');
      await mobile.locator('.mobile-bottom-nav [data-mobile-nav="home"]').click();
      assert.match(await mobile.locator('#mobile-channel-list [data-workspace-channel="store"]').textContent(), /store-ivanhoe/);
      assert.equal(await mobile.locator('#mobile-channel-list [data-workspace-channel]').count(), 10);
      await mobile.locator('#mobile-channel-list [data-workspace-channel="announcements"]').click();
      assert.equal(await mobile.locator('#dialog').isVisible(), false);
      assert.equal(await mobile.locator('#channel-name').textContent(), 'announcements');
      await mobile.locator('[data-slack-back]').click();
      await mobile.locator('#mobile-channel-list [data-workspace-channel="store"]').click();
      assert.equal(await mobile.locator('#message-input').inputValue(), 'A mobile draft for Ivanhoe.');
      await noOverflow();
      const stage = await selectedStage(mobile);
      await mobile.locator('[data-device="desktop"]').click();
      assert.equal(await mobile.locator('#store-select').inputValue(), 'ivanhoe');
      assert.equal(await selectedStage(mobile), stage); await noOverflow();
      await mobile.locator('[data-device="mobile"]').click();
      await mobile.locator('#tour').click(); await noOverflow(); await assertClientDialog(mobile);
      await guidedClick('[data-access-next]', mobile); await guidedClick('[data-verify-access]', mobile);
      await continueGuided(mobile);
      await assertPendingChannelFormats(mobile, 'mobile');
      await chooseGuidedStoreChannel(mobile, 'ivanhoe');
      await continueGuided(mobile); await recommended('[data-play-briefing]', mobile);
      await mobile.locator('.clip-transcript summary').click(); await guidedClick('[data-clip-read]', mobile);
      await continueGuided(mobile); await guidedClick('[data-canvas-read]', mobile);
      await continueGuided(mobile); await guidedClick('[data-list-read]', mobile);
      await continueGuided(mobile); await guidedClick('[data-clock-in]', mobile);
      await continueGuided(mobile);
      await mobile.locator('#issue-form textarea').fill(`A sample packing issue at Ivanhoe on a ${width}px phone.`);
      await guidedClick('#issue-form button[type="submit"]', mobile);
      await continueGuided(mobile); await exerciseHuddle(mobile, 'ivanhoe');
      await guidedClick('[data-huddle-join]', mobile); await guidedClick('[data-huddle-finish]', mobile);
      assert.equal((await frontline(mobile)).ivanhoe.events.filter(event => event.text.includes('Huddle action recorded')).length, 1);
      await continueGuided(mobile); await guidedClick('#agent-form button[type="submit"]', mobile); await guidedClick('[data-agent-finish]', mobile);
      await continueGuided(mobile); await guidedClick('[data-access-check="external"]', mobile); await guidedClick('[data-clock-out]', mobile);
      assert.match(await mobile.locator('#frontline-progress').textContent(), /10 \/ 10/);
      assert.deepEqual([...(await frontline(mobile)).ivanhoe.completed].sort(), [...FEATURE_IDS].sort());
      await continueGuided(mobile); await recommended('[data-open-manager-playbooks]', mobile);
      await noOverflow(); await snapshot(mobile, `connected-mobile-${width}.png`); await mobile.close(); diagnosticPage = page;
    });
  }
  await verify('An explicit Mobile preference survives reload while entry returns to the crew opening', async () => {
    await click('[data-device="mobile"]');
    await click('[data-role="manager"]'); await click('[data-stage="people"]');
    assert.equal(await page.evaluate(() => localStorage.getItem('el-jannah-preview-device')), 'mobile');
    const records = await frontline(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-device="mobile"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await selectedStage(page), 'opening');
    assert.deepEqual(await frontline(page), records);
    assert.equal(await page.locator('#dialog').isVisible(), false, 'An already verified employee returns to the opening channel');
  });
  await verify('Reset from completed manager Desktop work opens a clean employee sign-in immediately', async () => {
    await click('[data-role="manager"]'); await click('[data-device="desktop"]');
    assert.equal((await frontline(page)).bankstown.completed.length, 10);
    await page.locator('#message-input').fill('An unsent manager note to clear.');
    await click('#reset-demo'); await click('#confirm-reset');
    assert.equal(await page.locator('#store-select').inputValue(), 'bankstown');
    assert.match(await text('#frontline-progress'), /0 \/ 10/);
    assert.match(await text('#playbook-count'), /0 \/ 10/);
    assert.equal(await selectedStage(page), 'opening');
    assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-device="mobile"]').getAttribute('aria-pressed'), 'true');
    assert.match(await text('#scene-title'), /READY FOR.*A LEGENDARY DAY/);
    assert.doesNotMatch(await text('#channel-content'), /Bring one extra packer to collection/);
    assert.equal(await page.locator('#message-input').inputValue(), '');
    assert.deepEqual(await frontline(page), {}, 'Reset clears every store’s frontline progress');
    for (const store of Object.values((await base(page)).stores)) assert.deepEqual(store, freshStore(), 'Reset clears all original checks, notes and outcomes');
    await assertEmployeeSignIn(page);
    await guidedClick('[data-access-next]'); await guidedClick('[data-verify-access]');
    await continueGuided();
    await chooseGuidedStoreChannel(page, 'bankstown');
    assert.deepEqual((await frontline(page)).bankstown.completed, ['access', 'channels']);
  });
  await verify('Reset from Mobile during a shift and again during sign-in always returns to step one', async () => {
    for (const store of ['ivanhoe', 'bankstown']) {
      await page.locator('#store-select').selectOption(store);
      await click('[data-role="manager"]');
      await click('#reset-demo'); await click('#confirm-reset');
      assert.equal(await page.locator('#store-select').inputValue(), 'bankstown');
      assert.equal(await selectedStage(page), 'opening');
      assert.equal(await page.locator('[data-role="crew"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-device="mobile"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await frontline(page), {});
      await assertEmployeeSignIn(page);
    }
    await page.reload({ waitUntil: 'networkidle' });
    await assertEmployeeSignIn(page);
    assert.deepEqual(await frontline(page), {}, 'Reloading an unverified employee does not advance sign-in');
  });
  await verify('All browser sessions completed without application errors or media permission requests', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(mediaRequests, [], 'Huddle controls never request a microphone, camera or screen capture');
  });
  console.log(`Connected-store verification passed: ${passed.length} scenarios, all 10 frontline capabilities, all 10 manager playbooks, contained Slack dialogs, Desktop/iOS shell navigation, Desktop/Mobile previews and actual 390px/320px viewports.`);
} catch (error) {
  await snapshot(diagnosticPage.isClosed() ? page : diagnosticPage, 'connected-verification-failure.png').catch(() => {});
  console.error(`Connected-store verification stopped after ${passed.length} passed scenarios.`);
  throw error;
} finally {
  await browser.close();
}
