// Fictional demo personas. Portraits are licensed stock photos, not El Jannah staff.
// Sources, licence and branch-photo verification are recorded in assets/PROVENANCE.md.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export const people = Object.freeze({
  omar: Object.freeze({id:'omar',name:'Omar Haddad',firstName:'Omar',role:'Packing crew',photo:'assets/photos-omar.jpg'}),
  sarah: Object.freeze({id:'sarah',name:'Sarah Mansour',firstName:'Sarah',role:'Store manager',photo:'assets/photos-sarah.jpg'}),
  layla: Object.freeze({id:'layla',name:'Layla Darwish',firstName:'Layla',role:'Shift leader',photo:'assets/photos-layla.jpg'}),
  karim: Object.freeze({id:'karim',name:'Karim Nasser',firstName:'Karim',role:'Area manager',photo:'assets/photos-karim.jpg'})
});

const aliases = Object.freeze({omar:'omar',om:'omar',oh:'omar',you:'omar',sarah:'sarah',sa:'sarah',sm:'sarah',layla:'layla',la:'layla',ld:'layla',karim:'karim',ka:'karim',kn:'karim'});

export function personFor(nameOrInitials) {
  if (nameOrInitials && typeof nameOrInitials === 'object' && people[nameOrInitials.id]) return people[nameOrInitials.id];
  const name = String(nameOrInitials ?? '').trim().toLowerCase();
  const key = aliases[name] || aliases[name.split(/[\s·(]/)[0]];
  return key ? people[key] : null;
}

export function avatar(nameOrInitials, className = 'message-avatar') {
  const options = typeof className === 'object' && className !== null ? className : {className};
  const person = personFor(nameOrInitials);
  const classes = escapeHTML(options.className ?? 'message-avatar');
  if (!person) return `<span class="${classes} identity-fallback" aria-hidden="true">${escapeHTML(String(nameOrInitials ?? '').trim().slice(0,2))}</span>`;
  return `<span class="${classes} identity-avatar" data-person="${person.id}" title="${escapeHTML(person.name)} · Fictional character, stock portrait"><img class="identity-photo" src="${person.photo}" alt="${escapeHTML(options.alt ?? '')}" width="640" height="640" loading="lazy" decoding="async"></span>`;
}

export function brandAvatar(className = 'message-avatar') {
  return `<span class="${escapeHTML(className)} identity-brand" title="El Jannah"><img class="identity-logo" src="assets/ej-logo.svg" alt="El Jannah" loading="lazy" decoding="async"></span>`;
}

export function personLabel(name, {detail = false} = {}) {
  const person=personFor(name);
  if(!person)return escapeHTML(name);
  return `<span class="person-label">${avatar(person,'person-label-photo')}<span><b>${escapeHTML(person.name)}</b>${detail?`<small>${escapeHTML(person.role)}</small>`:''}</span></span>`;
}

export const claudeIcon = 'assets/photos-claude-icon.svg';
export function appAvatar(name, className = 'message-avatar') {
  if (/claude|^cl$/i.test(String(name))) return `<span class="${escapeHTML(className)} identity-app identity-claude" title="Claude"><img class="identity-logo" src="${claudeIcon}" alt="Claude" loading="lazy" decoding="async"></span>`;
  return brandAvatar(className);
}

const branchPhoto = (name, filename, source) => Object.freeze({name,photo:`assets/${filename}`,src:`assets/${filename}`,alt:`El Jannah ${name} restaurant exterior`,source});
export const storePhotos = Object.freeze({
  bankstown: branchPhoto('Bankstown','photos-bankstown.webp','https://eljannah.com.au/locations/nsw/bankstown/'),
  granville: branchPhoto('Granville','photos-granville.webp','https://eljannah.com.au/locations/nsw/granville/'),
  punchbowl: branchPhoto('Punchbowl','photos-punchbowl.webp','https://eljannah.com.au/locations/nsw/punchbowl/'),
  // The official Ivanhoe page has no verified branch photo. Show its name and brand logo.
  ivanhoe: null
});
