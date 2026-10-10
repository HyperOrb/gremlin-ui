import http from 'node:http';
import { pathToFileURL } from 'node:url';

export function demoHTML(fixed, guide = false) {
  const base = fixed ? '/fixed' : '/broken';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fieldnotes · ${fixed ? 'Fixed' : 'Broken'} Gremlin demo</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f5ef;color:#17221b;font:16px/1.6 system-ui,sans-serif}a{color:#286342;text-decoration:none}header{border-bottom:1px solid #d1d9ca;background:#fff;padding:18px 32px;display:flex;justify-content:space-between;align-items:center;gap:24px}header strong{font-size:22px;letter-spacing:-.04em}nav{display:flex;gap:20px;${fixed ? 'flex-wrap:wrap' : 'min-width:480px'}}main{max-width:900px;margin:40px auto;padding:0 24px}.eyebrow{font:12px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em;color:#53634e}.hero{padding:20px 0}h1{font-size:clamp(32px,6vw,52px);letter-spacing:-.045em;line-height:1.12;margin:16px 0}p{color:#5a6658}section{background:#fff;border:1px solid #d1d9ca;padding:24px;margin:20px 0;border-radius:6px}label{display:block;font-size:13px;margin:16px 0 8px}input{width:100%;padding:12px;border:1px solid #a7b39f;border-radius:3px;font:inherit;background:#fff}button,.card{cursor:pointer}button{border:1px solid #24573c;background:#24573c;color:white;padding:12px 18px;font:600 14px system-ui;border-radius:3px;margin:12px 8px 0 0}button:disabled{opacity:.7;cursor:wait}.quiet{background:white;color:#24573c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:#eef2e9;border:1px solid #cdd8c4;padding:20px;margin:20px 0}.preview{border-top:1px solid #d1d9ca;padding-top:16px;margin-top:16px}#echo{${fixed ? 'overflow-wrap:anywhere' : 'white-space:nowrap'}}.badge{display:inline-block;padding:3px 9px;border:1px solid #ccd7c4;font:12px ui-monospace,monospace}footer{font-size:13px;max-width:900px;margin:30px auto;padding:0 24px;color:#62705b}${fixed ? ':focus-visible{outline:3px solid #316d4c;outline-offset:4px}@media(max-width:600px){header{padding:16px;align-items:flex-start;flex-direction:column;gap:12px}.grid{grid-template-columns:1fr}main{margin:20px auto;padding:0 16px}}' : '*:focus{outline:none;box-shadow:none}header{min-width:720px}'}
</style></head><body><header><strong>Fieldnotes<span style="color:#788f66">.</span></strong><nav><a id="home" href="${base}">Workspace</a><a id="guide" href="${base}/guide">Guide</a><a id="help" href="${fixed ? base + '/guide' : base + '/missing?from=help'}">Help</a><a href="${fixed ? '/broken' : '/fixed'}">${fixed ? 'Broken version' : 'Fixed version'}</a></nav></header><main><div class="eyebrow">A disposable local demo / Gremlin ${fixed ? 'after fixes' : 'before fixes'}</div><div class="hero"><span class="badge">${fixed ? 'FIXED' : 'DELIBERATELY BROKEN'}</span><h1>${guide ? 'A little room for better ideas.' : 'Your next idea starts here.'}</h1><p>${guide ? 'Write a note, generate a preview, and make something worth sharing.' : 'An uncomplicated workspace for collecting notes and preparing a preview.'}</p></div>${guide ? `<section><h2>How Fieldnotes works</h2><p>Use the workspace to try an email draft and generate a local preview.</p><a href="${base}">Return to workspace →</a></section>` : `<div class="grid"><section><h2>Start a draft</h2><p>Enter your email to associate it with a local draft.</p><form id="draft-form" ${fixed ? '' : 'novalidate'}><label for="email">Email (required)</label><input id="email" name="email" type="email" aria-required="true" ${fixed ? 'required maxlength="254"' : ''} autocomplete="off"><div id="echo"></div><button id="continue" type="submit">Continue</button><div id="draft-result" role="status"></div></form></section><section><h2>Preview workspace</h2><p>Generate a disposable local preview. Nothing here contacts an external service.</p><button id="preview" type="button">Generate preview</button><div id="preview-result" class="preview" role="status">No preview yet.</div><button id="details" type="button" class="quiet" aria-expanded="false">Show details</button><p id="detail-content" hidden>Draft previews are isolated and expire when you close this demo.</p></section></div><${fixed ? 'button' : 'div'} id="template" class="card" ${fixed ? 'type="button"' : 'role="button" onclick="void 0"'}>${fixed ? 'Explore templates' : 'Explore templates →'}</${fixed ? 'button' : 'div'}><p id="template-result" hidden>Templates: Meeting notes · Launch checklist · Weekly review</p><section><h2>Account controls</h2><p>These actions are deliberately present to verify Gremlin skips dangerous controls.</p><button id="delete-account" type="button" class="quiet">Delete account</button><button id="purchase" type="button">Purchase</button></section>`}</main><footer>Local-only fixture. Fictional product. No personal data required. <a href="${base}">Workspace</a></footer><script>
const fixed=${fixed};const form=document.querySelector('#draft-form');
if(form){const email=document.querySelector('#email');email.addEventListener('input',()=>document.querySelector('#echo').textContent=email.value);form.addEventListener('submit',e=>{e.preventDefault();if(fixed&&!email.value.trim()){email.setCustomValidity('Enter a valid email.');email.reportValidity();return}email.setCustomValidity('');document.querySelector('#draft-result').textContent='Local draft created for '+(email.value||'(empty email)')});let count=0;const preview=document.querySelector('#preview');preview.addEventListener('click',()=>{if(fixed){preview.disabled=true;preview.setAttribute('aria-busy','true');preview.textContent='Preparing preview…'}fetch('${base}/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template:'notes'})}).then(r=>r.json()).then(data=>{document.querySelector('#preview-result').textContent=data.gremlinBlocked?'Preview request blocked by the Gremlin safety guard.':'Preview '+(++count)+' ready.'}).finally(()=>setTimeout(()=>{if(fixed){preview.disabled=false;preview.removeAttribute('aria-busy');preview.textContent='Generate preview'}},450))});document.querySelector('#details').addEventListener('click',e=>{const content=document.querySelector('#detail-content');content.hidden=!content.hidden;e.currentTarget.setAttribute('aria-expanded',String(!content.hidden));e.currentTarget.textContent=content.hidden?'Show details':'Hide details'});if(fixed)document.querySelector('#template').addEventListener('click',()=>document.querySelector('#template-result').hidden=false);document.querySelector('#delete-account').addEventListener('click',()=>fetch('${base}/api/delete',{method:'DELETE'}));document.querySelector('#purchase').addEventListener('click',()=>fetch('${base}/api/purchase',{method:'POST'}))}
</script></body></html>`;
}
export async function startDemo(port = 4173) {
  const stats = { writes: 0, dangerous: 0 };
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    const path = requestUrl.pathname;
    if (path === '/redirect-test') {
      res.writeHead(302, {
        location: requestUrl.searchParams.get('to') || '/fixed',
      });
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      stats.writes++;
      if (/delete|purchase/.test(path)) stats.dangerous++;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sequence: stats.writes }));
      return;
    }
    if (
      [
        '/broken',
        '/broken/',
        '/fixed',
        '/fixed/',
        '/broken/guide',
        '/fixed/guide',
      ].includes(path)
    ) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(demoHTML(path.startsWith('/fixed'), path.endsWith('/guide')));
      return;
    }
    if (path === '/') {
      res.writeHead(302, { location: '/broken' });
      res.end();
      return;
    }
    if (path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(
      '<!doctype html><title>Not found</title><h1>404 · This page wandered off.</h1>',
    );
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  return {
    server,
    stats,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((ok, fail) => server.close((e) => (e ? fail(e) : ok()))),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const demo = await startDemo(Number(process.env.PORT || 4177));
  console.log(
    `Fieldnotes demo: ${demo.url}/broken\nFixed version:   ${demo.url}/fixed\nCtrl+C stops the server.`,
  );
}
