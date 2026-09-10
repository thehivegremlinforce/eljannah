import * as THREE from './vendor/three.module.js';

const BRAND = { green: 0x5cbf1a, dark: 0x3e8a0f, charcoal: 0x171e17, cream: 0xfaf8ef };
const ZONES = {
  grill: { name: 'Charcoal kitchen', description: 'Prep, food safety and the next batch of charcoal chicken.' },
  counter: { name: 'Front counter', description: 'Orders, handovers and a clear view of the lunch rush.' },
  stock: { name: 'Stock and supply', description: 'Spot a shortage early and get the right stock to the right store.' },
  crew: { name: 'The crew', description: 'One place for the shift brief, help and a proper handover.' },
  dining: { name: 'Guest experience', description: 'Turn customer feedback into something the team can act on.' },
  roof: { name: 'Store network', description: 'Keep every store connected to the people who can help.' },
};
const STAGE_ZONES = {
  opening: ['crew', 'counter'], prep: ['grill'], rush: ['counter', 'grill'],
  supply: ['stock'], people: ['crew'], close: ['grill', 'crew'], network: ['roof', 'stock', 'counter'],
};

/** A self-contained, animated, cutaway store. Values passed to setExplode are 0..1. */
export class StoreDiorama {
  constructor(container, { onSelect = () => {}, onReady = () => {}, onRotationChange = () => {} } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onReady = onReady;
    this.onRotationChange = onRotationChange;
    this.explode = 0;
    this.explodeTarget = 0;
    this.stage = 'opening';
    this.paused = false;
    this.autoRotate = false;
    this.dragging = false;
    this.selected = null;
    this.disposed = false;
    this.groups = {};
    this.people = [];
    this.chickens = [];
    this.particles = [];
    this.beacons = [];
    this.geometryCache = new Map();
    this.needsRender = true;
    this.isVisible = true;
    this.time = 0;
    this.interaction = { feature: null, phase: 'view', startedAt: 0 };
    this.angle = Math.PI * .255;
    this.elevation = .74;
    this.zoomLevel = 1;
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.listeners = [];
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (error) {
      this.fallback();
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-label', 'Interactive cutaway of an El Jannah store. Drag to rotate. Use the arrow keys to turn and plus or minus to zoom. Select a store area to explore.');
    this.canvas.setAttribute('role', 'img');
    this.canvas.tabIndex = 0;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;outline-offset:-4px;touch-action:pan-y;cursor:grab;';
    container.appendChild(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-13, 13, 10, -10, .1, 150);
    this.materials = this.makeMaterials();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8f967b, 2.5));
    const sun = new THREE.DirectionalLight(0xfff7df, 4.6);
    sun.position.set(-8, 18, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 65 });
    sun.shadow.bias = -.0006;
    sun.shadow.normalBias = .035;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd5ecff, 1.5);
    fill.position.set(8, 8, -10);
    this.scene.add(fill);
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.buildSite();
    this.buildShell();
    this.buildKitchen();
    this.buildCounter();
    this.buildStock();
    this.buildDining();
    this.buildCrew();
    this.buildPhoneCrew();
    this.buildVan();
    this.buildBeacons();
    this.attachEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(entries => {
        this.isVisible = entries[0].isIntersecting;
        this.lastFrame = performance.now();
        this.needsRender = true;
      });
      this.visibilityObserver.observe(container);
    }
    this.resize();
    this.lastFrame = performance.now();
    this.tick = this.tick.bind(this);
    this.frameId = requestAnimationFrame(this.tick);
    requestAnimationFrame(() => !this.disposed && onReady({ webgl: true }));
  }

  fallback() {
    const panel = document.createElement('div');
    panel.className = 'store-scene-fallback';
    panel.style.cssText = 'height:100%;min-height:380px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:32px;box-sizing:border-box;text-align:center;color:#fff;background:radial-gradient(circle at 50% 40%,#22452b,#101c15);border-radius:20px;';
    const title = document.createElement('strong');
    title.style.cssText = 'font-size:clamp(30px,6vw,64px);letter-spacing:-.05em;color:#80dc40';
    title.textContent = 'A whole store. One team.';
    const description = document.createElement('p');
    description.textContent = 'Explore the store areas below. The interactive 3D view needs WebGL in your browser.';
    panel.append(title, description);
    const links = document.createElement('div');
    links.style.cssText = 'display:flex;justify-content:center;gap:8px;flex-wrap:wrap;max-width:430px;';
    for (const [id, data] of Object.entries(ZONES)) {
      const button = document.createElement('button');
      button.textContent = data.name;
      button.style.cssText = 'border:1px solid #659552;color:#fff;border-radius:30px;background:#254c26;padding:12px 16px;cursor:pointer;font:inherit;';
      button.addEventListener('click', () => this.onSelect({ id, ...data }));
      links.appendChild(button);
    }
    panel.appendChild(links);
    this.container.appendChild(panel);
    this.fallbackElement = panel;
    this.onReady({ webgl: false });
  }

  makeMaterials() {
    const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .74, ...extra });
    return {
      cream: standard(BRAND.cream), white: standard(0xffffff), green: standard(BRAND.green),
      dark: standard(BRAND.dark), charcoal: standard(BRAND.charcoal), concrete: standard(0xcdcec0),
      tile: standard(0xe6e9de), grout: standard(0xacb2a1), pavement: standard(0x9aab99),
      steel: standard(0xbdc6c0, { metalness: .62, roughness: .32 }),
      steelDark: standard(0x697971, { metalness: .65, roughness: .45 }),
      wood: standard(0xc29155), woodDark: standard(0x805632), cardboard: standard(0xbb9861),
      chicken: standard(0xc67c29), chickenDark: standard(0x905321), lettuce: standard(0x61a439),
      tomato: standard(0xea5038), hummus: standard(0xe9d6a1), toum: standard(0xfffcdf),
      coal: standard(0x3b2720), ember: standard(0xe45d13, { emissive: 0xff5712, emissiveIntensity: 1.5 }),
      skin: standard(0xbb835a), skinLight: standard(0xe4b48b), skinDark: standard(0x77513d),
      black: standard(0x202a22), glass: standard(0x9ccfba, { transparent: true, opacity: .38, metalness: .2, roughness: .12 }),
      screen: standard(0x122b20, { emissive: 0x244d30, emissiveIntensity: .6 }),
      light: standard(0xe5ffd1, { emissive: 0xc7ff9a, emissiveIntensity: 1.2 }),
    };
  }

  box(parent, w, h, d, material, x = 0, y = 0, z = 0, radius = 0) {
    const key = `box:${w}:${h}:${d}`;
    if (!this.geometryCache.has(key)) this.geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(this.geometryCache.get(key), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cylinder(parent, top, bottom, height, material, x = 0, y = 0, z = 0, segments = 16) {
    const key = `cylinder:${top}:${bottom}:${height}:${segments}`;
    if (!this.geometryCache.has(key)) this.geometryCache.set(key, new THREE.CylinderGeometry(top, bottom, height, segments));
    const mesh = new THREE.Mesh(this.geometryCache.get(key), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  sphere(parent, radius, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const key = `sphere:${radius}`;
    if (!this.geometryCache.has(key)) this.geometryCache.set(key, new THREE.SphereGeometry(radius, 14, 10));
    const mesh = new THREE.Mesh(this.geometryCache.get(key), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  group(id, position, spread) {
    const group = new THREE.Group();
    group.position.copy(new THREE.Vector3(...position));
    group.userData.zone = id;
    group.userData.home = group.position.clone();
    group.userData.spread = new THREE.Vector3(...spread);
    this.model.add(group);
    this.groups[id] = group;
    return group;
  }

  textPlane(parent, text, w, h, background = '#171e17', color = '#ffffff', x = 0, y = 0, z = 0, fontSize = 75) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(100, Math.round(1024 * h / w));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(fontSize, canvas.height * .68)}px Arial, sans-serif`;
    ctx.fillText(text, 512, canvas.height / 2, 960);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: .85, side: THREE.DoubleSide }));
    plane.position.set(x, y, z);
    parent.add(plane);
    return plane;
  }

  buildSite() {
    const m = this.materials;
    const site = new THREE.Group();
    this.model.add(site);
    this.box(site, 21, .45, 16.2, m.charcoal, 0, -.55, .65);
    this.box(site, 20.9, .12, 16.1, m.pavement, 0, -.29, .65);
    this.box(site, 16, .26, 10.8, m.concrete, -.8, -.11, -.85);
    this.box(site, 16, .06, 10.8, m.grout, -.8, .04, -.85);
    const floorTiles = [[], []];
    for (let x = 0; x < 20; x++) for (let z = 0; z < 13; z++) {
      floorTiles[(x + z) % 6 === 0 ? 0 : 1].push([-8.39 + x * .8, .09, -5.83 + z * .825]);
    }
    const tileGeometry = new THREE.BoxGeometry(.778, .025, .802);
    for (let type = 0; type < 2; type++) {
      const tiles = new THREE.InstancedMesh(tileGeometry, type === 0 ? m.cream : m.tile, floorTiles[type].length);
      floorTiles[type].forEach((position, index) => tiles.setMatrixAt(index, new THREE.Matrix4().makeTranslation(...position)));
      tiles.receiveShadow = true;
      tiles.instanceMatrix.needsUpdate = true;
      site.add(tiles);
    }
    this.box(site, 20.6, .02, 2.6, m.charcoal, 0, -.2, 7.24);
    for (let i = -8; i <= 7; i += 3) this.box(site, .075, .025, 1.3, m.cream, i, -.18, 7.3);
    this.box(site, 15.7, .2, .16, m.cream, -.8, -.12, 5.03);
    this.box(site, 2.15, .08, 2.45, m.dark, -8.9, -.14, 6.55);
    this.plant(site, -8.9, -.1, 6.45, 1.1);
    this.plant(site, 8.9, -.1, -5.8, 1.1);
    for (let i = 0; i < 3; i++) {
      this.cylinder(site, .055, .07, .8, m.steelDark, -6.7 + i * 1.8, .19, 5.8);
      this.cylinder(site, .063, .063, .12, m.green, -6.7 + i * 1.8, .55, 5.8);
    }
    this.textPlane(site, 'EL JANNAH  /  STORE 001', 4.3, .38, '#171e17', '#d7e4ce', -.6, -.47, 8.766, 68);
  }

  buildShell() {
    const m = this.materials;
    const shell = new THREE.Group();
    this.model.add(shell);
    this.box(shell, 16, 2.5, .17, m.cream, -.8, 1.34, -6.16);
    this.box(shell, .17, 1.75, 10.7, m.cream, -8.7, .96, -.8);
    this.box(shell, 15.8, .5, .19, m.green, -.8, .48, -6.04);
    this.box(shell, .19, .5, 10.6, m.green, -8.59, .48, -.8);
    for (let i = 0; i < 16; i++) this.box(shell, .021, 1.75, .025, m.grout, -8.3 + i, 1.52, -6.065);
    this.textPlane(shell, 'GOOD FOOD. GOOD PEOPLE.', 4.2, .36, '#faf8ef', '#3e8a0f', -5.4, 2.18, -6.058, 75);
    this.box(shell, 2, .045, 1, m.black, 1.75, .14, 4.3);
    const roof = this.group('roof', [0, 0, 0], [0, 4.65, -1.8]);
    // The deep rear canopy lifts away. The open front keeps the working store visible.
    this.box(roof, 16.3, .19, 1.52, m.charcoal, -.8, 3.12, -5.5);
    this.box(roof, 16.3, .72, .21, m.green, -.8, 3.43, -4.72);
    this.box(roof, 16.3, .075, .27, m.dark, -.8, 3.82, -4.72);
    this.box(roof, 16.3, .065, .25, m.cream, -.8, 3.02, -4.72);
    this.textPlane(roof, 'EL JANNAH', 6.2, .6, '#5cbf1a', '#ffffff', -.8, 3.44, -4.606, 106);
    this.textPlane(roof, 'CHARCOAL CHICKEN', 3.3, .3, '#5cbf1a', '#ffffff', 4.78, 3.4, -4.60, 72);
    this.textPlane(roof, 'EST. 1998', 1.7, .3, '#5cbf1a', '#173713', -7.05, 3.4, -4.60, 70);
    for (let i = 0; i < 7; i++) this.box(roof, .1, .075, 1.45, m.steelDark, -7.8 + i * 2.4, 3.26, -5.5);
    for (const x of [-7.4, -3.1, 1.2, 5.5]) {
      this.box(roof, 1.3, .05, .13, m.light, x, 3.0, -5.05);
    }
    this.box(roof, 1.45, .64, .9, m.steel, 4.5, 3.52, -5.53);
    for (let i = 0; i < 6; i++) this.box(roof, 1.18, .025, .045, m.steelDark, 4.5, 3.76, -5.87 + i * .13);
  }

  buildKitchen() {
    const m = this.materials;
    const grill = this.group('grill', [-4.8, 0, -3.5], [-3.3, 1.0, -1.65]);
    this.box(grill, 5.05, .1, 3.6, m.grout, 0, .18, 0);
    this.box(grill, 4.2, 1.1, 1.15, m.charcoal, -.05, .78, -.42);
    this.box(grill, 4.3, .13, 1.28, m.steel, -.05, 1.34, -.42);
    this.box(grill, 3.85, .08, .99, m.black, -.05, 1.42, -.42);
    for (let i = 0; i < 27; i++) {
      const x = -1.8 + (i % 9) * .44;
      const z = -.73 + Math.floor(i / 9) * .3;
      this.sphere(grill, .16, i % 3 ? m.coal : m.ember, x, 1.5, z, 1.1, .65, 1);
    }
    for (let i = 0; i < 21; i++) this.box(grill, .035, .04, 1.13, m.steelDark, -1.98 + i * .194, 1.67, -.42);
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      bird.position.set(-1.61 + (i % 3) * 1.07, 1.84, -.73 + Math.floor(i / 3) * .62);
      this.sphere(bird, .26, m.chicken, 0, 0, 0, 1.35, .62, 1);
      this.sphere(bird, .13, m.chickenDark, -.29, -.01, .17, 1.3, .75, .8);
      this.sphere(bird, .13, m.chickenDark, .29, -.01, .17, 1.3, .75, .8);
      for (let j = 0; j < 3; j++) this.box(bird, .025, .008, .29, m.chickenDark, -.12 + j * .12, .157, 0);
      grill.add(bird);
      this.chickens.push(bird);
    }
    this.box(grill, 4.35, .45, .88, m.steel, -.05, 2.83, -.65);
    this.box(grill, 4.02, .06, .8, m.steelDark, -.05, 2.57, -.63);
    for (let i = 0; i < 11; i++) this.box(grill, .19, .035, .57, m.black, -1.65 + i * .32, 2.529, -.63);
    this.box(grill, .67, .5, .53, m.steel, -.05, 3.16, -.65);
    for (const x of [-1.7, -1.0, -.3, .4, 1.1, 1.8]) {
      const knob = this.cylinder(grill, .067, .067, .07, m.steelDark, x, 1.19, .265);
      knob.rotation.x = Math.PI / 2;
      this.box(grill, .018, .04, .015, m.cream, x, 1.22, .308);
    }
    this.textPlane(grill, 'CHARCOAL • SLOW COOKED', 2.5, .18, '#171e17', '#dedcc3', 0, .7, .167, 58);
    const warmth = new THREE.PointLight(0xff8e30, 7, 5, 2);
    warmth.position.set(0, 1.8, -.4);
    grill.add(warmth);
    this.grillLight = warmth;
    // Preparation bench, condiment tubs and a proper chopping board.
    this.box(grill, 3.7, .11, 1.02, m.steel, .06, 1.15, 1.26);
    for (const x of [-1.65, 1.75]) for (const z of [.85, 1.67]) this.cylinder(grill, .045, .045, .95, m.steelDark, x, .63, z);
    this.box(grill, 3.4, .045, .72, m.steel, .05, .44, 1.28);
    this.box(grill, 1.0, .055, .62, m.wood, -.91, 1.23, 1.3);
    this.box(grill, .55, .018, .04, m.steel, -.93, 1.28, 1.33).rotation.y = -.45;
    for (let i = 0; i < 3; i++) {
      this.cylinder(grill, .23, .16, .19, m.cream, .06 + i * .59, 1.3, 1.23);
      this.cylinder(grill, .21, .21, .012, [m.toum, m.lettuce, m.tomato][i], .06 + i * .59, 1.403, 1.23);
    }
    for (let i = 0; i < 4; i++) this.box(grill, .48, .25, .49, m.cream, -.8 + i * .59, .61, 1.2);
    // Transparent steam and bright embers rise from the grill in a loop.
    for (let i = 0; i < 26; i++) {
      const ember = i % 4 === 0;
      const material = new THREE.MeshBasicMaterial({ color: ember ? 0xffbe61 : 0xe2ead9, transparent: true, opacity: ember ? .8 : .12, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(ember ? .029 : .095, 7, 5), material);
      mesh.userData.seed = i * .39;
      mesh.userData.ember = ember;
      grill.add(mesh);
      this.particles.push(mesh);
    }
  }

  buildCounter() {
    const m = this.materials;
    const counter = this.group('counter', [3.28, 0, 2.29], [3.55, .75, 2.1]);
    this.box(counter, 5.85, 1.2, 1.28, m.dark, 0, .75, 0);
    this.box(counter, 5.91, .11, 1.43, m.cream, 0, 1.4, 0);
    for (let i = 0; i < 29; i++) this.box(counter, .11, 1.02, .04, m.green, -2.8 + i * .2, .78, .66);
    this.box(counter, 5.75, .07, .04, m.charcoal, 0, .23, .7);
    this.textPlane(counter, 'EL JANNAH', 2.38, .35, '#3e8a0f', '#ffffff', -.15, .88, .713, 107);
    this.box(counter, .6, .035, .48, m.black, 1.77, 1.485, -.09);
    this.box(counter, .095, .36, .085, m.steelDark, 1.77, 1.65, -.13);
    const screen = this.box(counter, .77, .52, .075, m.black, 1.77, 1.99, -.13);
    screen.rotation.x = -.17;
    const face = this.box(counter, .68, .43, .009, m.screen, 1.77, 2.005, -.081);
    face.rotation.x = -.17;
    this.textPlane(counter, 'READY TO ORDER', .57, .09, '#122b20', '#a2ed6c', 1.77, 2.08, -.027, 77).rotation.x = -.17;
    for (let i = 0; i < 3; i++) this.box(counter, .14, .045, .015, m.green, 1.54 + i * .22, 1.96, -.04);
    this.box(counter, .24, .045, .34, m.black, 2.43, 1.49, .24).rotation.x = .13;
    for (let i = 0; i < 3; i++) this.bag(counter, -2.2 + i * .57, 1.47, 0, .8 + i * .1);
    this.box(counter, 1.15, .3, .58, m.glass, -.08, 1.62, -.16);
    for (let i = 0; i < 3; i++) {
      this.cylinder(counter, .125, .09, .21, m.cream, -.39 + i * .3, 1.57, -.13);
      this.cylinder(counter, .13, .13, .03, m.green, -.39 + i * .3, 1.69, -.13);
    }
    this.box(counter, 5.5, .96, .57, m.steel, -.05, .73, -2.08);
    this.box(counter, 5.63, .09, .71, m.steel, -.05, 1.25, -2.08);
    for (let i = 0; i < 3; i++) {
      this.box(counter, .9, .58, .39, m.charcoal, -1.77 + i * 1.69, 1.58, -2.08);
      this.textPlane(counter, ['THE ORIGINAL', 'FAMILY FEAST', 'EXTRA TOUM'][i], 1.39, .38, '#171e17', '#a0e168', -1.77 + i * 1.69, 2.3, -2.335, 65);
    }
    this.textPlane(counter, 'PICK UP', 1.0, .23, '#faf8ef', '#3e8a0f', -1.7, 1.245, .731, 98);
    this.textPlane(counter, 'ORDER HERE', 1.16, .23, '#faf8ef', '#3e8a0f', 1.85, 1.245, .731, 89);
  }

  bag(parent, x, y, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    this.box(group, .39, .49, .25, this.materials.cardboard, 0, .245, 0);
    this.box(group, .4, .055, .27, this.materials.cardboard, 0, .51, 0);
    this.textPlane(group, 'EJ', .22, .2, '#bb9861', '#3e8a0f', 0, .26, .13, 160);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 6, 12, Math.PI), this.materials.woodDark);
    handle.position.set(0, .54, .01);
    group.add(handle);
    parent.add(group);
    return group;
  }

  buildStock() {
    const m = this.materials;
    const stock = this.group('stock', [4.92, 0, -4.2], [4.45, 1.8, -2.7]);
    this.box(stock, 3.77, .07, 2.83, m.grout, 0, .17, 0);
    this.box(stock, 1.35, 2.28, 1.08, m.steel, .94, 1.33, -.49);
    this.box(stock, 1.21, 2.13, .08, m.glass, .94, 1.34, .097);
    for (let i = 0; i < 4; i++) this.box(stock, 1.17, .037, .86, m.steel, .94, .53 + i * .45, -.36);
    this.box(stock, .055, .65, .065, m.charcoal, 1.39, 1.41, .176);
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
      this.box(stock, .29, .24, .37, y % 2 ? m.cream : m.cardboard, .58 + x * .37, .68 + y * .45, -.04);
    }
    this.textPlane(stock, 'COLD STORE', 1.16, .18, '#bdc6c0', '#223126', .94, 2.35, .151, 88);
    this.box(stock, 1.13, .06, .99, m.wood, -.82, .25, -.09);
    for (let i = 0; i < 3; i++) this.box(stock, 1.13, .055, .13, m.woodDark, -.82, .2, -.43 + i * .35);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) {
      const posX = -1.16 + x * .61;
      this.box(stock, .56, .45, .73, m.cardboard, posX, .51 + y * .47, -.04);
      this.box(stock, .07, .018, .74, m.woodDark, posX, .744 + y * .47, -.04);
      this.textPlane(stock, y === 2 ? 'FRESH' : 'EJ', .32, .17, '#bb9861', '#3e8a0f', posX, .5 + y * .47, .331, 122);
    }
    this.box(stock, .82, .05, .7, m.steelDark, -.4, .29, 1.12);
    for (const x of [-.71, -.1]) this.cylinder(stock, .048, .048, .94, m.steelDark, x, .76, 1.4);
    this.box(stock, .67, .045, .045, m.steelDark, -.4, 1.22, 1.4);
    for (const x of [-.7, -.1]) {
      const wheel = this.cylinder(stock, .13, .13, .09, m.black, x, .21, 1.2);
      wheel.rotation.z = Math.PI / 2;
    }
    this.box(stock, .62, .44, .52, m.cardboard, -.4, .53, 1.1);
  }

  buildDining() {
    const m = this.materials;
    const dining = this.group('dining', [-5.35, 0, 1.97], [-3.7, .35, 3.15]);
    this.box(dining, 4.4, .085, 4.45, m.cream, 0, .16, .05);
    for (const [x, z] of [[-.9, -.8], [1.05, 1.18]]) {
      this.cylinder(dining, .68, .68, .085, m.wood, x, 1.05, z, 32);
      this.cylinder(dining, .07, .08, .79, m.charcoal, x, .61, z);
      this.cylinder(dining, .34, .34, .04, m.charcoal, x, .24, z);
      this.chair(dining, x - 1.03, z, Math.PI / 2);
      this.chair(dining, x + 1.03, z, -Math.PI / 2);
      this.cylinder(dining, .21, .21, .018, m.cream, x, 1.11, z);
      this.sphere(dining, .12, m.chicken, x, 1.15, z, 1.1, .45, .9);
      this.cylinder(dining, .075, .061, .19, m.green, x + .35, 1.18, z + .2);
      this.box(dining, .15, .15, .12, m.cream, x - .22, 1.18, z - .34);
    }
    this.plant(dining, -1.71, .2, 1.68, .7);
    this.plant(dining, 1.62, .2, -1.74, .8);
    this.box(dining, .55, .7, .55, m.charcoal, 1.89, .55, -.67);
    this.box(dining, .6, .06, .6, m.green, 1.89, .93, -.67);
    this.box(dining, .34, .025, .22, m.black, 1.89, .97, -.67);
  }

  chair(parent, x, z, rotation) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = rotation;
    this.box(chair, .58, .08, .57, this.materials.green, 0, .65, 0);
    this.box(chair, .58, .51, .065, this.materials.green, 0, .94, -.255);
    for (const a of [-.23, .23]) for (const b of [-.21, .21]) this.cylinder(chair, .026, .03, .44, this.materials.charcoal, a, .41, b, 8);
    parent.add(chair);
  }

  plant(parent, x, y, z, scale = 1) {
    const m = this.materials;
    const plant = new THREE.Group();
    plant.position.set(x, y, z);
    plant.scale.setScalar(scale);
    this.cylinder(plant, .34, .26, .5, m.cream, 0, .25, 0);
    this.cylinder(plant, .29, .29, .025, m.woodDark, 0, .51, 0);
    this.cylinder(plant, .04, .05, .9, m.woodDark, 0, .85, 0, 8);
    for (let i = 0; i < 9; i++) {
      const theta = i * 2.4;
      const leaf = this.sphere(plant, .21, i % 2 ? m.dark : m.lettuce, Math.cos(theta) * .25, .75 + (i % 3) * .23, Math.sin(theta) * .25, .7, 1.65, .35);
      leaf.rotation.z = Math.cos(theta) * .75;
      leaf.rotation.y = theta;
    }
    parent.add(plant);
  }

  person(parent, { x, z, rotation = 0, uniform = true, skin = 'skin', walking = false, phase = 0, shirt = null }) {
    const m = this.materials;
    const person = new THREE.Group();
    person.position.set(x, .17, z);
    person.rotation.y = rotation;
    const torso = this.cylinder(person, .18, .21, .45, shirt || (uniform ? m.green : m.wood), 0, .84, 0, 12);
    this.sphere(person, .19, m[skin], 0, 1.28, .018, .88, 1.09, .9);
    this.cylinder(person, .063, .065, .09, m[skin], 0, 1.085, 0, 10);
    this.sphere(person, .053, m[skin], 0, 1.275, .17, .7, .9, .8);
    if (uniform) {
      this.sphere(person, .192, m.charcoal, 0, 1.397, .004, 1, .48, 1.02);
      this.box(person, .24, .04, .17, m.charcoal, 0, 1.41, .16);
      this.box(person, .23, .32, .042, m.charcoal, 0, .82, .178);
      this.textPlane(person, 'EJ', .095, .08, '#171e17', '#baff8c', 0, .88, .202, 110);
      for (const side of [-1, 1]) this.box(person, .035, .2, .027, m.charcoal, side * .087, 1.01, .17);
    } else {
      this.sphere(person, .196, m.woodDark, 0, 1.377, -.015, 1, .52, 1.03);
    }
    const limbs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * .235, .99, 0);
      this.cylinder(arm, .065, .056, .21, shirt || (uniform ? m.green : m.wood), 0, -.075, 0, 10);
      this.cylinder(arm, .05, .044, .2, m[skin], 0, -.26, .02, 10);
      this.sphere(arm, .057, m[skin], 0, -.36, .02);
      person.add(arm);
      const leg = new THREE.Group();
      leg.position.set(side * .096, .65, 0);
      this.cylinder(leg, .075, .061, .47, m.charcoal, 0, -.235, 0, 10);
      this.box(leg, .145, .1, .24, m.black, 0, -.48, .045);
      person.add(leg);
      limbs.push({ arm, leg, side });
    }
    parent.add(person);
    this.people.push({ mesh: person, torso, limbs, base: person.position.clone(), rotation, walking, phase, uniform });
    return person;
  }

  buildCrew() {
    const m = this.materials;
    const crew = this.group('crew', [0, 0, 0], [0, 2.1, 2.7]);
    this.person(crew, { x: -4.8, z: -3.04, rotation: Math.PI, phase: .2 });
    this.person(crew, { x: -2.39, z: -1.86, rotation: -Math.PI / 2, skin: 'skinDark', phase: 1.4 });
    this.person(crew, { x: 4.5, z: 1.35, rotation: .18, skin: 'skinLight', phase: 2.2 });
    this.person(crew, { x: .43, z: -1.17, rotation: .5, walking: true, phase: 1.1 });
    const customer = this.person(crew, { x: 3.65, z: 4.1, rotation: Math.PI, uniform: false, phase: .5, shirt: m.cream });
    this.bag(customer, .32, .55, .02, .58);
    this.person(crew, { x: .4, z: 5.6, rotation: Math.PI / 2, uniform: false, skin: 'skinDark', walking: true, phase: 3.1, shirt: m.steelDark });
    // A small shift tablet by the team entry.
    this.box(crew, .1, 1.1, .1, m.steelDark, -.28, .71, 1.22);
    this.box(crew, .52, .72, .08, m.charcoal, -.28, 1.52, 1.22);
    this.textPlane(crew, 'SHIFT BRIEF', .43, .11, '#171e17', '#a0e168', -.28, 1.73, 1.266, 88);
    for (let i = 0; i < 3; i++) {
      this.box(crew, .044, .044, .008, m.green, -.41, 1.58 - i * .12, 1.267);
      this.box(crew, .23, .022, .009, m.cream, -.22, 1.58 - i * .12, 1.267);
    }
  }

  buildPhoneCrew() {
    const m = this.materials;
    // This crew member stays on the forecourt while the working store separates.
    // A larger portrait phone makes the connection to the Slack panel visible.
    const actor = new THREE.Group();
    actor.name = 'frontline-phone-crew';
    actor.position.set(-1.9, -.41, 5.25);
    actor.rotation.y = this.angle;
    actor.scale.setScalar(1.5);
    actor.userData.zone = 'crew';
    actor.visible = false;
    this.model.add(actor);
    const body = new THREE.Group();
    actor.add(body);
    this.cylinder(body, .18, .21, .45, m.green, 0, .84, 0, 12);
    this.box(body, .24, .33, .044, m.charcoal, 0, .81, .178);
    this.textPlane(body, 'EJ', .1, .085, '#171e17', '#baff8c', 0, .9, .203, 110);
    for (const side of [-1, 1]) {
      this.box(body, .035, .2, .027, m.charcoal, side * .087, 1.01, .17);
      this.cylinder(body, .075, .061, .47, m.charcoal, side * .096, .415, 0, 10);
      this.box(body, .145, .1, .24, m.black, side * .096, .17, .045);
    }
    this.cylinder(body, .063, .065, .09, m.skin, 0, 1.085, 0, 10);
    const head = new THREE.Group();
    head.position.set(0, 1.16, .012);
    head.rotation.x = .35;
    body.add(head);
    this.sphere(head, .19, m.skin, 0, .12, .006, .88, 1.09, .9);
    this.sphere(head, .053, m.skin, 0, .115, .158, .7, .9, .8);
    this.sphere(head, .192, m.charcoal, 0, .237, -.008, 1, .48, 1.02);
    this.box(head, .24, .04, .17, m.charcoal, 0, .25, .148);
    // Arms are built in a holding pose, rather than borrowing the walking loop.
    const up = new THREE.Vector3(0, 1, 0);
    const segment = (start, end, radius, material) => {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
      const direction = b.clone().sub(a);
      const part = this.cylinder(body, radius, radius * .88, direction.length(), material, 0, 0, 0, 10);
      part.position.copy(a).add(b).multiplyScalar(.5);
      part.quaternion.setFromUnitVectors(up, direction.normalize());
      return part;
    };
    for (const side of [-1, 1]) {
      segment([side * .23, 1.0, 0], [side * .29, .79, .14], .069, m.green);
      segment([side * .29, .79, .14], [side * .205, .96, .48], .05, m.skin);
      this.sphere(body, .065, m.skin, side * .205, .97, .485, .9, 1.2, .8);
    }
    const phone = new THREE.Group();
    phone.name = 'crew-handheld-phone';
    phone.position.set(0, 1.055, .53);
    phone.rotation.set(-.62, 0, -.035);
    body.add(phone);
    this.box(phone, .4, .65, .075, m.charcoal);
    this.box(phone, .411, .07, .046, m.steelDark, 0, -.25, -.014);
    this.box(phone, .017, .095, .024, m.steelDark, .207, .09, 0);
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 400;
    screenCanvas.height = 650;
    const texture = new THREE.CanvasTexture(screenCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    this.box(phone, .352, .563, .008, screenMaterial, 0, -.005, .042);
    this.box(phone, .09, .012, .012, m.steel, 0, .302, .044);
    this.box(phone, .115, .009, .01, m.cream, 0, -.31, .044);
    const thumb = new THREE.Group();
    thumb.position.set(.16, -.1, .083);
    phone.add(thumb);
    const thumbTip = this.sphere(thumb, .034, m.skin, -.033, .012, 0, 1.65, .8, .7);
    thumbTip.rotation.z = -.55;
    const light = new THREE.PointLight(0xc9e9ff, .6, 1.15, 2);
    light.position.set(0, 0, .22);
    phone.add(light);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: BRAND.green, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.RingGeometry(.46, .53, 48), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, .13, 0);
    actor.add(halo);
    this.phoneCrew = { actor, body, head, phone, thumb, halo, light, screenCanvas, screenTexture: texture };
    this.paintPhoneScreen();
  }

  paintPhoneScreen() {
    if (!this.phoneCrew) return;
    const { screenCanvas, screenTexture } = this.phoneCrew;
    const ctx = screenCanvas.getContext('2d');
    const phase = this.interaction.phase;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 650);
    ctx.fillStyle = '#4a154b';
    ctx.fillRect(0, 0, 400, 112);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.fillText('# store', 25, 73);
    const colours = ['#36c5f0', '#2eb67d', '#e01e5a'];
    for (let i = 0; i < 3; i++) {
      const y = 156 + i * 100;
      ctx.fillStyle = colours[i];
      ctx.fillRect(23, y, 45, 45);
      ctx.fillStyle = '#4d4650';
      ctx.fillRect(87, y + 1, 166, 15);
      ctx.fillStyle = '#d8d2da';
      ctx.fillRect(87, y + 29, 272, 13);
      ctx.fillRect(87, y + 54, i === 1 ? 179 : 222, 13);
    }
    ctx.fillStyle = phase === 'success' ? '#007a5a' : phase === 'error' ? '#b42338' : '#eee5f0';
    ctx.fillRect(23, 470, 354, 100);
    if (phase === 'success') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(144, 515);ctx.lineTo(180, 541);ctx.lineTo(252, 491);ctx.stroke();
    } else {
      ctx.fillStyle = '#75417d';
      ctx.font = 'bold 31px Arial, sans-serif';
      ctx.fillText(phase === 'typing' ? 'Typing...' : phase === 'error' ? 'Review' : 'Open in Slack', 44, 532);
    }
    ctx.fillStyle = '#c0b5c3';
    ctx.fillRect(35, 607, 254, 8);
    ctx.fillStyle = '#007a5a';
    ctx.fillRect(323, 594, 39, 34);
    screenTexture.needsUpdate = true;
  }

  updatePhoneCrew(t, animated) {
    const crew = this.phoneCrew;
    if (!crew || !crew.actor.visible) return;
    const typing = this.interaction.phase === 'typing';
    const elapsed = Math.max(0, t - this.interaction.startedAt);
    const nod = animated && this.interaction.phase === 'success' && elapsed < 1.3 ? Math.sin(elapsed / 1.3 * Math.PI * 2) * .14 : 0;
    // Follow the camera's horizontal bearing so the phone remains identifiable
    // when a presenter rotates the store. No camera controls are changed.
    crew.actor.rotation.y = this.angle - .15;
    crew.body.position.y = animated ? Math.sin(t * 1.6) * .009 : 0;
    crew.head.rotation.x = .35 + nod + (animated && typing ? Math.sin(t * 2.2) * .018 : 0);
    crew.thumb.rotation.z = typing && animated ? Math.sin(t * 13) * .35 : -.15;
    crew.thumb.position.x = .16 + (typing && animated ? Math.sin(t * 11) * .022 : 0);
    crew.thumb.position.z = .083 + (typing && animated ? Math.abs(Math.sin(t * 13)) * .017 : 0);
    crew.phone.rotation.z = -.035 + (typing && animated ? Math.sin(t * 7) * .014 : 0);
    crew.halo.scale.setScalar(1 + (animated && typing ? Math.sin(t * 3) * .055 : 0));
    crew.halo.material.opacity = this.interaction.phase === 'success' ? .8 : .43;
    crew.light.intensity = .65 + (animated && typing ? Math.sin(t * 6) * .12 : 0);
  }

  buildVan() {
    const m = this.materials;
    const van = new THREE.Group();
    van.position.set(7.95, .03, 4.35);
    van.rotation.y = -.13;
    van.userData.zone = 'stock';
    this.model.add(van);
    this.box(van, 1.64, 1.42, 2.61, m.cream, 0, 1.16, -.56);
    this.box(van, 1.64, .76, 1.12, m.cream, 0, .85, 1.18);
    this.box(van, 1.52, .79, .93, m.cream, 0, 1.51, .85);
    const windscreen = this.box(van, 1.35, .52, .035, m.glass, 0, 1.61, 1.328);
    windscreen.rotation.x = -.12;
    for (const side of [-1, 1]) {
      this.box(van, .035, .5, .68, m.glass, side * .777, 1.62, .91);
      this.box(van, .04, .43, 2.2, m.green, side * .839, 1.11, -.65);
      for (const z of [-1.15, 1.07]) {
        const tyre = this.cylinder(van, .35, .35, .19, m.black, side * .83, .43, z, 20);
        tyre.rotation.z = Math.PI / 2;
        const hub = this.cylinder(van, .16, .16, .2, m.steel, side * .84, .43, z, 16);
        hub.rotation.z = Math.PI / 2;
      }
      this.box(van, .15, .17, .17, m.charcoal, side * .88, 1.38, 1.15);
    }
    this.box(van, 1.51, .17, .08, m.charcoal, 0, .52, 1.766);
    for (const x of [-.56, .56]) this.box(van, .32, .18, .075, m.light, x, .88, 1.769);
    this.box(van, .55, .24, .028, m.black, 0, .79, 1.787);
    const branding = this.textPlane(van, 'EL JANNAH', 1.91, .32, '#5cbf1a', '#ffffff', .863, 1.12, -.59, 118);
    branding.rotation.y = Math.PI / 2;
    this.textPlane(van, 'FRESH TO YOUR STORE', 1.4, .19, '#faf8ef', '#3e8a0f', 0, 1.57, -1.88, 68).rotation.y = Math.PI;
    this.van = van;
  }

  buildBeacons() {
    const positions = { grill: [0, 3.6, .3], counter: [0, 2.68, .3], stock: [0, 3.13, .1], crew: [.25, 2.48, .1], dining: [-.3, 1.9, -.1], roof: [-5.8, 4.42, -4.65] };
    for (const [id, position] of Object.entries(positions)) {
      const beacon = new THREE.Group();
      beacon.position.set(...position);
      beacon.userData.zone = id;
      const material = new THREE.MeshBasicMaterial({ color: BRAND.green, transparent: true, opacity: .95, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.RingGeometry(.13, .19, 32), material);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(.074, 20), new THREE.MeshBasicMaterial({ color: 0xe9ffdf, transparent: true, opacity: 1, depthWrite: false }));
      beacon.add(halo, dot);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      beacon.add(hit);
      this.groups[id].add(beacon);
      this.beacons.push({ id, mesh: beacon, halo, dot, phase: this.beacons.length * .8 });
    }
  }

  attachEvents() {
    const listen = (target, type, callback, options) => {
      target.addEventListener(type, callback, options);
      this.listeners.push(() => target.removeEventListener(type, callback, options));
    };
    listen(this.motionQuery, 'change', event => {
      this.reducedMotion = event.matches;
      if (event.matches) this.setAutoRotate(false);
      this.needsRender = true;
    });
    listen(document, 'visibilitychange', () => { this.lastFrame = performance.now(); this.needsRender = true; });
    let drag = null;
    listen(this.canvas, 'pointerdown', event => {
      if (event.button !== 0) return;
      const touch = event.pointerType === 'touch';
      drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, distance: 0, touch, orbit: !touch };
      this.dragging = !touch;
      if (!touch) {
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.style.cursor = 'grabbing';
      }
    });
    listen(this.canvas, 'pointermove', event => {
      if (drag) {
        if (drag.touch && !drag.orbit) {
          const horizontal = Math.abs(event.clientX - drag.x);
          const vertical = Math.abs(event.clientY - drag.y);
          if (Math.max(horizontal, vertical) < 8) return;
          // A vertical swipe belongs to the page. Wait for a deliberate
          // horizontal gesture before taking control of the store.
          if (vertical >= horizontal) {
            drag = null;
            this.dragging = false;
            return;
          }
          drag.orbit = true;
          this.dragging = true;
          this.canvas.setPointerCapture(event.pointerId);
          this.canvas.style.cursor = 'grabbing';
        }
        const dx = event.clientX - drag.lastX;
        const dy = event.clientY - drag.lastY;
        drag.distance += Math.abs(dx) + Math.abs(dy);
        this.angle -= dx * .006;
        if (!drag.touch) this.elevation = THREE.MathUtils.clamp(this.elevation + dy * .004, .3, 1.14);
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        this.updateCamera();
      } else {
        this.canvas.style.cursor = this.zoneAt(event.clientX, event.clientY) ? 'pointer' : 'grab';
      }
    });
    listen(this.canvas, 'pointerup', event => {
      if (drag && drag.distance < 8) {
        const id = this.zoneAt(event.clientX, event.clientY);
        if (id) {
          this.selectZone(id);
          this.onSelect({ id, ...ZONES[id] });
        }
      }
      drag = null;
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    });
    const cancelDrag = () => { drag = null; this.dragging = false; this.canvas.style.cursor = 'grab'; };
    listen(this.canvas, 'pointercancel', cancelDrag);
    listen(this.canvas, 'lostpointercapture', cancelDrag);
    listen(this.canvas, 'wheel', event => {
      event.preventDefault();
      this.zoom(-event.deltaY * .001);
    }, { passive: false });
    listen(this.canvas, 'keydown', event => {
      if (['ArrowLeft', 'ArrowRight', '+', '=', '-', '_', 'Home'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft') this.rotate(-.15);
      if (event.key === 'ArrowRight') this.rotate(.15);
      if (event.key === '+' || event.key === '=') this.zoom(.12);
      if (event.key === '-' || event.key === '_') this.zoom(-.12);
      if (event.key === 'Home') this.reset();
    });
  }

  zoneAt(clientX, clientY) {
    if (!this.renderer) return null;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.model.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && node !== this.model) {
        if (node.userData.zone) return node.userData.zone;
        node = node.parent;
      }
    }
    return null;
  }

  setExplode(value) {
    this.explodeTarget = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    if (this.reducedMotion) {
      this.explode = this.explodeTarget;
      this.updateCamera();
    }
    this.needsRender = true;
  }

  setStage(stage) {
    this.stage = Object.hasOwn(STAGE_ZONES, stage) ? stage : 'opening';
    this.needsRender = true;
  }

  /** Show the crew using Slack. Null clears it; input/typing and success/complete
   *  animate the interaction while view is a calm reading pose. */
  setInteraction(feature, phase = 'view') {
    const nextFeature = typeof feature === 'string' && feature ? feature : null;
    const nextPhase = ['input', 'typing'].includes(phase) ? 'typing'
      : ['success', 'complete', 'confirm', 'confirmed'].includes(phase) ? 'success'
      : phase === 'error' ? 'error' : 'view';
    const changed = nextFeature !== this.interaction.feature || nextPhase !== this.interaction.phase;
    this.interaction.feature = nextFeature;
    this.interaction.phase = nextPhase;
    if (changed) this.interaction.startedAt = this.time;
    if (this.phoneCrew) {
      this.phoneCrew.actor.visible = Boolean(nextFeature);
      if (changed) this.paintPhoneScreen();
    }
    this.container.dataset.phoneFeature = nextFeature || '';
    this.container.dataset.phonePhase = nextFeature ? nextPhase : '';
    this.needsRender = true;
  }

  selectZone(id) {
    this.selected = Object.hasOwn(ZONES, id) ? id : null;
    this.needsRender = true;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) this.setAutoRotate(false);
    this.needsRender = true;
  }

  /** Explicit rotation shares the existing frame loop. Pause never restarts it. */
  setAutoRotate(enabled) {
    const next = Boolean(enabled) && Boolean(this.renderer) && !this.disposed && !this.paused;
    if (next === this.autoRotate) return this.autoRotate;
    this.autoRotate = next;
    this.lastFrame = performance.now();
    this.needsRender = true;
    this.onRotationChange(next);
    return next;
  }

  rotate(delta) {
    this.angle += Number(delta) || 0;
    this.updateCamera();
  }

  zoom(delta) {
    this.zoomLevel = THREE.MathUtils.clamp(this.zoomLevel + (Number(delta) || 0), .62, 1.72);
    this.updateCamera();
  }

  reset() {
    this.setAutoRotate(false);
    this.angle = Math.PI * .255;
    this.elevation = .74;
    this.zoomLevel = 1;
    this.selected = null;
    this.setExplode(0);
    this.updateCamera();
  }

  resize() {
    if (!this.renderer || this.disposed) return;
    const { width, height } = this.container.getBoundingClientRect();
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.updateCamera();
  }

  updateCamera() {
    if (!this.camera) return;
    this.needsRender = true;
    const aspect = (this.width || 1000) / (this.height || 700);
    // Leave enough vertical room for the entire site through a full orbit.
    const halfHeight = Math.max(11.2, 14.5 / aspect) * (1 + this.explode * .28);
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.zoom = this.zoomLevel;
    const distance = 36;
    const target = new THREE.Vector3(0, 1.1 + this.explode * 1.25, .5);
    this.camera.position.set(
      Math.sin(this.angle) * Math.cos(this.elevation) * distance,
      Math.sin(this.elevation) * distance,
      Math.cos(this.angle) * Math.cos(this.elevation) * distance,
    ).add(target);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }

  tick(now) {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.tick);
    const dt = Math.max(0, Math.min((now - this.lastFrame) / 1000, .05));
    this.lastFrame = now;
    if (!this.isVisible || document.hidden || this.width <= 1 || this.height <= 1) return;
    const animated = !this.paused && !this.reducedMotion;
    // Starting rotation is an explicit opt-in, including with reduced motion.
    // A later preference change stops it until the user chooses Start again.
    const rotating = this.autoRotate && !this.paused && !this.dragging;
    if (!animated && !rotating && this.explode === this.explodeTarget && !this.needsRender) return;
    if (animated) this.time += dt;
    if (rotating) {
      this.angle = (this.angle + dt * .2) % (Math.PI * 2);
      this.updateCamera();
    }
    const previousExplode = this.explode;
    this.explode += (this.explodeTarget - this.explode) * (this.reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(this.explodeTarget - this.explode) < .0001) this.explode = this.explodeTarget;
    if (Math.abs(previousExplode - this.explode) > .00001) this.updateCamera();
    for (const group of Object.values(this.groups)) group.position.copy(group.userData.home).addScaledVector(group.userData.spread, this.explode);
    const t = this.time;
    const pace = this.stage === 'rush' ? 1.8 : this.stage === 'close' ? .5 : 1;
    for (const person of this.people) {
      const p = t * pace * (person.walking ? 3 : 1.8) + person.phase;
      person.mesh.position.copy(person.base);
      if (person.walking) {
        person.mesh.position.x += Math.sin(t * .6 * pace + person.phase) * (person.uniform ? .62 : 1.5);
        person.mesh.position.z += Math.sin(t * .8 * pace + person.phase) * .2;
        person.mesh.position.y += Math.abs(Math.sin(p)) * .034;
        person.mesh.rotation.y = person.rotation + Math.cos(t * .6 * pace + person.phase) * .35;
      } else {
        person.mesh.rotation.y = person.rotation + Math.sin(p * .4) * .055;
        person.torso.rotation.z = Math.sin(p * .5) * .025;
      }
      for (const { arm, leg, side } of person.limbs) {
        arm.rotation.x = person.walking ? Math.sin(p) * .35 * side : -.19 + Math.sin(p + side) * .19;
        leg.rotation.x = person.walking ? -Math.sin(p) * .23 * side : 0;
      }
    }
    this.updatePhoneCrew(t, animated);
    for (let i = 0; i < this.chickens.length; i++) this.chickens[i].rotation.z = Math.sin(t * .55 + i * .85) * .055;
    for (const particle of this.particles) {
      const life = (t * (particle.userData.ember ? .65 : .23) + particle.userData.seed) % 1;
      const seed = particle.userData.seed;
      particle.position.set(Math.sin(seed * 8.3) * 1.7 + Math.sin(t + seed) * life * .22, 1.76 + life * 1.07, -.43 + Math.cos(seed * 6.1) * .35);
      particle.scale.setScalar(particle.userData.ember ? 1 - life * .6 : .4 + life * 1.65);
      particle.material.opacity = Math.sin(life * Math.PI) * (particle.userData.ember ? .88 : .14);
      particle.visible = this.stage !== 'close';
    }
    if (this.grillLight) this.grillLight.intensity = this.stage === 'close' ? 1 : 6.5 + Math.sin(t * 3.2) * .7;
    const activeZones = STAGE_ZONES[this.stage];
    for (const beacon of this.beacons) {
      const active = this.selected === beacon.id || activeZones.includes(beacon.id);
      beacon.mesh.quaternion.copy(this.camera.quaternion);
      const pulse = animated ? Math.sin(t * 2.2 + beacon.phase) : 0;
      beacon.halo.scale.setScalar(active ? 1.35 + pulse * .15 : 1);
      beacon.halo.material.opacity = active ? .88 : .37;
      beacon.halo.material.color.setHex(this.selected === beacon.id ? 0xf5f5d7 : BRAND.green);
      beacon.dot.material.opacity = active ? 1 : .55;
      beacon.mesh.scale.setScalar(active ? 1.4 : 1);
    }
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }

  dispose() {
    this.setAutoRotate(false);
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    for (const remove of this.listeners) remove();
    if (this.scene) {
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      this.scene.traverse(object => {
        if (object.shadow) object.shadow.dispose();
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if (material.map) textures.add(material.map);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
    }
    this.geometryCache.clear();
    this.renderer?.dispose();
    this.canvas?.remove();
    this.fallbackElement?.remove();
  }
}
