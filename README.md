# El Jannah Store OS

**Slack is the work OS for every connected store.**

An interactive El Jannah concept connecting crew, store managers and head office. Includes an animated 3D store with an exploded view, a guided crew shift, ten manager playbooks, seven operational scenarios and a simulated Slack workspace.

## Open the walkthrough

With Node.js installed:

```sh
npm start
```

Open [the local walkthrough](http://127.0.0.1:4175). The port can be changed with the `PORT` environment variable. No npm install is required to run or build the app. Three.js and the brand assets are included locally.

## Walk through a connected shift

The page opens as **Omar, the frontline employee**, including after a previous manager session. A fresh or unverified session automatically opens **Sign in to El Jannah** as the first guided step. It shows Omar Haddad with read-only **Employee ID EJ-014**. Choose **Continue**, then **Approve sign-in** on the security screen. No initial Start action is required. A returning verified employee lands at the store opening with saved work preserved. A fresh visit uses **Mobile**; an explicit device preference is retained on reload. **Reset walkthrough** clears saved work and opens employee sign-in again in Mobile.

1. Sign in using the already open employee screen. A separate **Walkthrough guide** shows the click tip while the action stays highlighted in Slack. Tips, completion cards and **Continue / Resume** controls sit outside the client, beside it where space allows and in a separate card on smaller screens. Advance at your own pace, use **Show me where to click** to focus the current action, or choose **Explore freely** to leave the guided sequence. Contextual tips remain available when exploring an individual feature. The hero’s **Start employee walkthrough** action can reopen the employee journey when needed.
2. Explore the ten capabilities: email-free access, a ten-channel workspace, clips, canvases, lists, shift management, approved workflows, huddles, in-channel agents and governance. The source slide groups Huddles & Clips and Canvases & Lists together; this demo gives each a separate step.
3. Use **Desktop** or **Mobile** in the top toolbar to switch the Slack preview. Both modes share the same store, workflow and progress. Desktop has Slack's app rail, workspace sidebar and conversation. Mobile uses a phone frame with a separate Home screen, channel navigation and bottom tabs. The device choice survives a refresh.
4. At the end of the crew shift, choose **Start the manager walkthrough**. It takes you through Bankstown’s ten playbooks, then opens the store network: complaints, drive-thru performance, paused delivery, refunds, intraday sales, store diagnostics, the weekly pack, leaderboard changes, overdue follow-up and review responses. You can also start it from the manager section.
5. Explore the seven store scenarios: opening, prep, dinner rush, delivery, crew cover, handover and the network briefing. Actions have prerequisites and visible outcomes. The network briefing requires the manager perspective.

Drag the 3D store to rotate it, or choose **Start rotation** for a continuous turn. The same button becomes **Stop rotation**. Pause and reset also stop the turn; resuming ambient animation leaves rotation off until you start it again. Try **Break it apart**, the separation slider, zoom, pause and reset. Select the grill, counter, stockroom, people, dining area or canopy for context. On touch screens, vertical swipes over the scene scroll the page and horizontal drags rotate the store.

## Presenter script and problem framing

Read [the full 8 to 12 minute presenter script](PRESENTER-SCRIPT.md), or open **Presenter script & the problem** above the workspace. The optional notes follow the current crew capability or manager playbook, with **The problem**, **What to say** and **Where to click**. They remain outside the simulated Slack client and do not replace its open form. The script can also be downloaded from the notes panel.

The opening frames the proposed coordination problem: scattered shift information, requests without a clear owner and context lost between shifts. Each guided step adds a short **What this solves** statement. The script starts with Omar, moves into Sarah’s ten sample manager situations and closes with the connected store network. Sample follow-ups demonstrate the proposed process, rather than measured trading improvements.

## The client and store interaction

Workflow panels open inside the Slack desktop or phone client, with the store visible alongside. On narrow screens, a compact store view sits above the client. A crew member holds a phone in the scene, reacts to typed details and confirms completed actions. The actor stays with the store in the exploded view and respects pause and reduced-motion settings.

Changing the sample store, perspective or shift moment dismisses an open panel so its form cannot act on a different context. Switching Desktop and Mobile keeps the same open form, draft and external click prompt. Escape or the panel's close button returns to the workspace with a **Resume** action in the separate Walkthrough guide. The guide skips completed steps, returns after prerequisites and resumes saved progress. Only the underlying Slack controls are blocked while a panel is open; the guide, page and store remain available.

The Store Hub and task list are view-only in the crew experience. Crew can run the approved opening workflow, join a simulated huddle, play a captioned briefing and ask an approved in-channel agent. The agent uses scripted demo answers. Shift actions illustrate an integrated workforce app. External DMs and Slack Connect are restricted in the frontline experience.

The ten assigned channels appear in Slack's standard desktop sidebar and mobile Home list. One click opens the conversation and completes the channel step. Every channel has its own conversation and draft; posted messages retain their channel across reloads. The workspace uses purple headers, with Sarah, Layla and Omar's photos beside the channel member count.

Huddles start with Sarah's Slack invitation. The notification names the store channel, and a white invitation sheet shows the two people already there, with **Dismiss** and **Join**. Dismiss leaves the step open; Resume shows the invitation again. One Join opens the active huddle with participant photo tiles, a light thread and a purple call toolbar. The invitation and its dimmed background remain inside Slack while the store stays visible. Microphone, camera, screen, notes and reaction controls change the local preview. Thread replies stay in that preview. Leaving allows a fresh rejoin; only **Keep the agreed action in the channel** completes the huddle step. No media permissions or live call are requested.

Omar Haddad, Sarah Mansour, Layla Darwish and Karim Nasser have consistent stock portraits across conversations, profiles, contacts and huddles. They are fictional demo characters. Saved messages retain their author's identity across perspective changes and reloads. Store cards use verified photos of Bankstown, Granville and Punchbowl; Ivanhoe uses the El Jannah logo because a verified branch photo was unavailable. Emoji reactions use native colour emoji with a count and Slack's blue selection treatment.

The compact introduction leads straight into the workspace. On laptop and desktop screens, the store, Slack client and external click guide share a height based on the viewport. Longer conversations and forms scroll inside Slack. The background explanation is available under **What we’re trying to solve**, and each guided step keeps its problem and presenter script close by. The stage navigation appears during free exploration. Rotation and store controls remain available on narrow screens.

Keyboard users can use native controls and arrow keys in channel tabs. The canvas supports keyboard rotation and zoom. Reduced-motion preferences pause ambient movement and remove transition smoothing; manual controls remain available. **Reset walkthrough** opens a fresh employee sign-in after confirmation.

## Scope

All operational figures, staff, messages, status and outcomes are sample data. The store model is a custom illustration, not an actual store plan. There is no connected Slack workspace, live store feed, live AI service or external write action.

Actions and messages are saved locally under `el-jannah-store-os-v1` and `el-jannah-connected-store-v2`, separately for each sample store. The preview preference uses `el-jannah-preview-device`. Storage is local to the browser origin. **Reset walkthrough** clears sample progress and notes after confirmation, then opens **Sign in to El Jannah**. If storage is unavailable, the current session remains usable. The store selector and role selector are presentation controls, not a simulation of access entitlements across every store.

Slack-style controls simulate the proposed workflows. The crew view uses approved workflow execution, read-only briefing content and approved in-channel apps. The source workforce and food safety systems retain their records and approvals. Product availability, entitlements and actual integrations need confirming before implementation.

## Validation

```sh
npm run check
npm test
npm run build
```

`npm test` runs 30 Node tests covering workflow prerequisites, ownership, per-store isolation, saved handover snapshots, access and shift gates, frontline transitions, operation status, message limits, persistent message authors and channels, and safe state restoration.

Optional browser verification uses Playwright:

```sh
node scripts/verify-connected.mjs
```

Install Playwright and its Chromium browser in your development environment, or set `PLAYWRIGHT_MODULE` to a local Playwright `index.mjs`. Run the local server first. The 79 browser scenarios cover all ten frontline capabilities in desktop and both phone widths, all ten guided and manually selected manager playbooks, and the seven original workflows. They also check employee-first entry and reset, saved-work reload, presenter script download and step content, form preservation when reading notes, visible and clickable recommended actions, external tips and Continue/Resume cards, external walkthrough summaries, expanded Slack, free exploration, dialog containment, phone interaction states, independent store controls, scrolling, focus restoration, Slack navigation, drafts, device switching, persistence, store isolation, role boundaries and clip playback. The external guide is checked for containment and non-overlap with Slack. Photo loading and full-name consistency, saved message authors, real emoji counts and selection colours, native channel navigation and format switching, adjacent member photos, invitation dismissal/resume, all huddle controls, thread replies, Leave/rejoin cleanup and completion gates are verified. The compact frame is checked at 1440 × 900, 1920 × 1080 and 1280 × 800, including initial entry, device changes and reset. Rotation Start/Stop, Pause/Resume and reset are exercised, and the official Slack header logo is checked for loading and original proportions. No media permission APIs are requested. Phone layouts use Chromium viewport emulation at 390 px and 320 px. Screenshots are written to ignored `artifacts/`. The older `verify-browser.mjs` entry point runs this same suite.

The presentation targets desktop on a normal office connection, with a responsive mobile layout. Accessibility aims for WCAG AA; this is not a certified audit. Initial targets are LCP below 2.5 seconds, INP below 200 ms and CLS below 0.1. The interface JavaScript budget is 100 KB gzip; the locally bundled 3D renderer has a separate 450 KB gzip budget. Target Lighthouse scores are accessibility 90 and desktop performance 80. These are targets, not measured field results. Codex performed the implementation checks; the delivery team should own any production accessibility sign-off.

## Build and hosting

`npm run build` writes a static site to `dist/`. The GitHub repository is [thehivegremlinforce/eljannah](https://github.com/thehivegremlinforce/eljannah), with the application on `main`.

To deploy manually in Vercel, choose **Add New → Project**, import this GitHub repository and use the settings below. If the private repository is missing from the import list, grant the Vercel GitHub integration access to this repository.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | Repository root, `./` |
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

`vercel.json` supplies the framework, build and output settings. Choose **Deploy** to build and publish the site. Vercel serves the generated static files; it does not need to run `server.mjs`. The application uses no server functions, database, paid API or runtime credentials. Progress is stored in each visitor’s browser. Future pushes to the connected production branch normally trigger another Vercel deployment.

Vercel’s [Hobby plan](https://vercel.com/docs/plans/hobby) is restricted to personal, non-commercial use. The static build has no paid runtime dependency, but a customer or sales presentation may require a commercial plan. Check the intended use against Vercel’s plan terms before deploying.

Build output, local Vercel settings, environment files, browser screenshots and source references are excluded from Git. The local Node server serves only app assets and does not expose source references or the `.git` directory.

## Source references and assets

- Supplied `El-Jannah-Slack-Operating-System-external.pptx`: customer story, scenarios and illustrative operating figures.
- [Supplied frontline presentation](https://docs.google.com/presentation/d/1wkpUVT4thGaEv5BrRXAkphtnR0SrWNIuQXds63l-aAg/edit): crew experience boundaries. Internal commercial details and release claims are not reproduced in the app.
- [El Jannah website](https://eljannah.com.au/): official green `#5CBF1A`, forest `#114734`, charcoal and white, plus the public logo and Vonder Rough headline font.
- [Slack for Windows](https://slack.com/intl/en-au/downloads/windows) and [Slack for iOS](https://slack.com/intl/en-au/downloads/ios): official visual references for the desktop workspace and mobile Home and conversation screens. The outer presentation keeps El Jannah's branding; the workspace uses Slack's purple, white and neutral interface treatment.
- [Airline operations demo](https://github.com/thehivegremlinforce/airlineopsdemo): interaction reference and the locally bundled Three.js renderer.

The El Jannah logo and font are included for this customer concept and remain subject to their owners’ rights. See `assets/PROVENANCE.md`. Three.js is distributed under its included MIT licence in `vendor/THREE-LICENSE.txt`.

The supplied huddle screenshot informs its participant, thread and toolbar layout. Photograph sources, licence information and the official Claude icon are recorded in `assets/PROVENANCE.md`. `identities.js` maps the named demo people and branches to local assets; `huddle.js` and `huddle.css` provide the simulated huddle; `slack-realism.css` styles photo labels, branch cards and emoji reactions.

## Files

`app.js` owns the main interface and original workflows; `connected-store.js` adds the guided journey, device preview and manager playbooks. `click-guidance.js` selects one recommended action, while `external-guidance.css` places tips and journey controls outside Slack. `presenter-content.js` and `presenter.css` provide the script and problem framing. `slack-shell.js` and `slack-shell.css` provide the desktop and mobile workspace navigation and visual treatment. `client-dialogs.css` keeps workflow forms inside the client. `data.js` and `operations.js` contain the illustrative scenarios. `workflow.js` and `frontline-state.js` hold validated state transitions. `scene.js` implements the Three.js store and its phone interaction. `style.css` and `connected-store.css` contain the surrounding brand treatment; `workspace-layout.css` provides the compact viewport layout and persistent store controls. `server.mjs` serves the local preview; `scripts/build.mjs` creates the static output.
