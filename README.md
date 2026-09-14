# El Jannah Store OS

👋 Built by **Brian D'Souza**, Field CTO @Slack ANZ.

**Slack is the work OS for every connected store.**

🍗 Follow a shift at El Jannah and see how Slack brings the crew, store managers and head office together. Explore the animated 3D store, try the frontline workflows and follow each issue through to its next step.

## Less chasing. A clearer shift.

On a busy shift, the team needs to know what matters, who can help and what happens next. This walkthrough brings those everyday moments together:

- Find the shift brief, tasks and answers in one place.
- Give each request an owner who can follow it through.
- Leave the next crew a useful handover.
- Help managers see what needs attention across their stores.

## 🚀 Run it on your computer

Clone or download this repository. With Node.js installed, open a terminal in the project folder and run:

```sh
npm start
```

Then open [the walkthrough](http://127.0.0.1:4175/) in your browser. Everything needed to run it is included, so there’s no `npm install` step.

## 👟 Start with Omar

You start as **Omar Haddad**, a crew member at El Jannah. On your first visit, his sign-in screen opens automatically in Mobile view.

1. Use the employee ID already shown, **EJ-014**. Click **Continue**, then **Approve sign-in**.
2. Follow the highlighted action in Slack. The **Walkthrough guide** beside it explains your next click.
3. Move through the shift at your own pace. If you lose your place, choose **Show me where to click**. If you close a step, choose **Resume** to reopen it.
4. Switch between **Desktop** and **Mobile** whenever you like. Your progress, open form and draft stay with you.
5. When Omar’s shift is complete, choose **Start the manager walkthrough** to see Sarah’s side of the story.

Want to look around first? Choose **Explore freely**. You can try individual features or use **Start employee walkthrough** to return to the guided shift.

Your browser remembers completed work and your chosen view. When you return, the page starts with the employee perspective. Choose **Reset walkthrough** and confirm to clear the saved work for all four stores and return to Omar’s sign-in in Mobile view.

## 🧩 Ten ways to connect the crew

| Feature | Try it in the walkthrough |
| --- | --- |
| Email-free access | Sign in with an employee ID and approve the security check. |
| Ten-channel focus | Open a conversation from Slack’s normal channel list. |
| Clips | Watch the captioned shift briefing or read the transcript. |
| Canvases | Find the brief, contacts and procedures in the Store Hub. |
| Lists | See the shift tasks, their owners and their status. |
| Shift management | Check your shift, clock in and clock out through the workforce app. |
| Workflows | Report a packing issue and see it assigned to Sarah. |
| Huddles | Join the team, talk through the issue and keep the agreed action in the channel. |
| In-channel agents | Ask the store guide a question without leaving the conversation. |
| Governed access | See the crew workspace’s limits on external messages and Slack Connect. |

The frontline pack groups Huddles & Clips and Canvases & Lists together. Here, each gets its own step so you can try it properly.

Sarah’s huddle invitation has **Join** and **Dismiss** buttons. Join takes you straight into the huddle. To finish that step, choose **Keep the agreed action in the channel**. If you dismiss the invitation or leave early, you can come back and join again. Thread replies stay in the open huddle; saving the agreed action adds the outcome to the store channel.

## See the manager’s side

Choose **Store manager** to follow **Sarah Mansour** through ten situations at Bankstown: customer complaints, drive-thru delays, paused delivery, refunds, daily sales, store performance, the weekly pack, leaderboard changes, overdue follow-ups and review responses.

Each playbook brings the details, an owner and the next action into the same conversation. The manager walkthrough finishes with a view across the stores.

You can also explore seven moments in a store’s week: opening, prep and quality, dinner rush, delivery, crew cover, handover and the network briefing. Some actions need an earlier step completed first. The network briefing is available in the manager view.

## 🏪 Explore the store

Drag the store to turn it, or click **Start rotation** to let it turn continuously. Click **Stop rotation** when you’ve found the angle you want. Pause and Reset also stop the rotation; it stays off until you start it again.

Try **Break it apart** to see the store’s different areas. Use the slider to adjust the separation and the zoom controls to look closer. Select the kitchen, counter, stockroom or another area to see how it connects to the work in Slack. On a touch screen, drag sideways to turn the store and swipe vertically to scroll the page.

The person holding a phone reacts as you enter details and complete actions. Forms and huddles open inside Slack, while the click tips stay outside it. On a phone-sized screen, the store sits above the workspace.

## 🎤 Present the story

Use the [8 to 12 minute presenter script](PRESENTER-SCRIPT.md), or open **Presenter script & the problem** above the workspace. The notes follow your current step and give you three things: the problem, what to say and where to click.

Start with Omar on the floor, move to Sarah’s next steps and finish with the wider store network. You can open the notes without losing your place in a form, or download the full script to keep beside you.

## A few useful things to know

- **Your work stays in your browser.** Each store keeps its own progress and messages. Each channel has its own conversation and draft. If browser storage is unavailable, you can still use the walkthrough for that session.
- **Changing context closes the current form.** Choosing another store, person or shift moment closes an open form. Switching Desktop and Mobile keeps it open.
- **The Store Hub and task list are view-only.** Crew use approved workflows to record work.
- **Keyboard controls are available.** Use the arrow keys to move between channel tabs, and the store canvas supports turning and zooming from the keyboard. Reduced-motion settings pause the background animation.

This is an interactive concept using example people, messages and figures. It isn’t connected to a live Slack workspace, store system or AI service. Agent replies are scripted, and the huddle controls don’t start a real call or request access to your microphone or camera.

The people in the story are fictional, with stock portraits used consistently throughout. Branch images show Bankstown, Granville and Punchbowl; Ivanhoe uses the El Jannah logo. The 3D store is an illustration, not a floor plan of an actual restaurant.

The examples show how the work could flow. A live rollout would need the right Slack plan, approved integrations and access settings. Workforce and food safety records would stay in their existing systems. The figures shown are examples, not measured business results.

## ☁️ Put it on Vercel

In Vercel, choose **Add New → Project** and import [thehivegremlinforce/eljannah](https://github.com/thehivegremlinforce/eljannah). If the private repository doesn’t appear, give the Vercel GitHub integration access to it.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | `./` |
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

The build settings are already in `vercel.json`. Check them, then choose **Deploy**. Vercel serves the files in `dist`; you don’t need to run the local Node server there. The site needs no database, paid API or runtime credentials. Later pushes to `main` normally trigger a new deployment once the repository is connected.

Vercel’s [Hobby plan](https://vercel.com/docs/plans/hobby) is for personal, non-commercial use. A customer or sales presentation may need a commercial plan, even though this site has no paid runtime dependencies.

## 🛠️ Working on the project

Run these checks before pushing a change:

```sh
npm run check
npm test
npm run build
```

The 30 state tests check things such as sign-in, task ownership, saved messages and keeping each store’s work separate. The build writes the website to `dist/`.

For browser checks, install Playwright and its Chromium browser, start the local server, then run:

```sh
node scripts/verify-connected.mjs
```

The browser suite covers 79 scenarios, including the crew and manager journeys, desktop and mobile views, huddles, rotation, saved work and reset. It also checks that forms stay inside Slack and that the click guide remains outside it. Browser screenshots are saved in `artifacts/`, which is excluded from Git.

<details>
<summary>Where to find things in the code</summary>

| Files | What they do |
| --- | --- |
| `app.js`, `connected-store.js` | Run the store experience and guided walkthroughs. |
| `scene.js` | Draw and animate the 3D store. |
| `slack-shell.js`, `slack-shell.css` | Provide the desktop and mobile Slack views. |
| `huddle.js`, `huddle.css` | Handle the huddle invitation, room and controls. |
| `click-guidance.js`, `external-guidance.css` | Show the next-click prompt outside Slack. |
| `presenter-content.js`, `presenter.css` | Provide the presenter notes. |
| `workflow.js`, `frontline-state.js` | Track progress and check which actions are ready. |
| `data.js`, `operations.js`, `identities.js` | Hold the example scenarios, people and store details. |
| `style.css`, `connected-store.css`, `workspace-layout.css` | Style the page and fit it to the screen. |
| `client-dialogs.css`, `shell-refinements.css`, `slack-realism.css`, `identities.css` | Style the forms, workspace details and photos. |
| `server.mjs`, `scripts/build.mjs` | Run the local server and create the static build. |

Browser storage uses `el-jannah-store-os-v1` and `el-jannah-connected-store-v2` for work, and `el-jannah-preview-device` for the chosen view. These records belong to the browser and site address where you opened the walkthrough.

Set `PORT` if you need a different local port. If Playwright is installed elsewhere, point `PLAYWRIGHT_MODULE` to its `index.mjs`. The older `scripts/verify-browser.mjs` command runs the same browser suite.

Build output, local Vercel settings, environment files, screenshots and source references are excluded from Git. The local server only serves the application files and assets.

</details>

## Sources and credits

The supplied El Jannah strategy deck and [frontline pack](https://docs.google.com/presentation/d/1wkpUVT4thGaEv5BrRXAkphtnR0SrWNIuQXds63l-aAg/edit) shaped the story and example scenarios.

- [El Jannah’s website](https://eljannah.com.au/) provided the colours, logo, font and branch photographs.
- [Slack for Windows](https://slack.com/intl/en-au/downloads/windows), [Slack for iOS](https://slack.com/intl/en-au/downloads/ios) and the supplied huddle screenshots guided the workspace design.
- The [airline operations project](https://github.com/thehivegremlinforce/airlineopsdemo) inspired the store animation and interaction.

Photo sources, logos and asset details are recorded in [the asset credits](assets/PROVENANCE.md). Brand assets remain the property of their owners. Three.js is included under its [MIT licence](vendor/THREE-LICENSE.txt).
