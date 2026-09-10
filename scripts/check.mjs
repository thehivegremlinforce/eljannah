import { execFileSync } from 'node:child_process';
for (const file of ['app.js','scene.js','data.js','workflow.js','connected-store.js','frontline-state.js','operations.js','slack-shell.js','identities.js','huddle.js','click-guidance.js','presenter-content.js','server.mjs','scripts/build.mjs']) execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('All JavaScript syntax checks passed');
