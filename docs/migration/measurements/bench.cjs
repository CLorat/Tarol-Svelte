const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const out = {};
  for (const n of [100, 500, 1000, 2000, 5000, 10000]) { const r = [], u = [];
    for (let k = 0; k < 5; k++) { const p = await b.newPage(); await p.setContent('<body></body>'); await p.addScriptTag({ content: fs.readFileSync('dist/m_List.js', 'utf8'), type: 'module' });
      await p.waitForFunction(() => window.__render); r.push(await p.evaluate((n) => window.__render(n), n)); u.push(await p.evaluate(() => window.__update())); await p.close(); }
    out[n] = { renderMinMs: Math.min(...r).toFixed(1), renderMedMs: r.sort((a,b)=>a-b)[2].toFixed(1), update10pctMinMs: Math.min(...u).toFixed(1) }; }
  console.table(out); await b.close(); })();
