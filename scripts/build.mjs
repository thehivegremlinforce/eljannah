import { mkdir, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const out = new URL('dist/', root);
await mkdir(out, {recursive:true});
for (const name of ['index.html','style.css','app.js','scene.js','workflow.js','data.js','connected-store.js','connected-store.css','frontline-state.js','operations.js','slack-shell.js','slack-shell.css','client-dialogs.css','click-guidance.js','click-guidance.css','presenter-content.js','presenter.css','external-guidance.css','identities.js','identities.css','slack-realism.css','shell-refinements.css','workspace-layout.css','huddle.js','huddle.css','PRESENTER-SCRIPT.md']) await copyFile(new URL(name,root),new URL(name,out));
for (const name of ['assets','vendor']) await cp(new URL(name,root),new URL(name,out),{recursive:true});
console.log('Built static site in dist');
