// Loopback-only UI fixtures. No database, real identity provider or operational grants.
import http from 'node:http';
let stage = 'activation';
let state = 'required';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5191');
  res.setHeader('Cache-Control', 'no-store');
  const json = (value, status = 200) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(value)); };
  if (url.pathname === '/api/session') return json({mode:'oidc',csrfToken:'ui-fixture',user:null});
  if (url.pathname === '/api/setup/status') return json({state,companyName:'Perusahaan uji UI'});
  if (url.pathname === '/api/setup/session') return json({stage,csrfToken:'ui-fixture',identity:stage==='review'?{name:'Admin uji UI',email:'admin@example.test'}:null});
  if (url.pathname === '/api/setup/activate') {
    let body=''; for await (const chunk of req) body+=chunk;
    if (JSON.parse(body).code !== 'preview-only') return json({code:'setup-code'},403);
    stage='identity'; res.writeHead(204); return res.end();
  }
  if (url.pathname === '/auth/setup-login') { stage='review';res.writeHead(302,{Location:'/'});return res.end(); }
  if (url.pathname === '/api/setup/complete') {state='completed';res.writeHead(204);return res.end();}
  if (url.pathname === '/qa/reset') {stage='activation';state='required';res.writeHead(302,{Location:'/'});return res.end();}
  try {
    const upstream=await fetch('http://127.0.0.1:5187'+req.url);
    res.writeHead(upstream.status, {'Content-Type':upstream.headers.get('content-type')||'text/plain'});
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {res.writeHead(502);res.end('Start the local Vite preview on port 5187.');}
});
server.listen(5191,'127.0.0.1',()=>console.log('UI fixture preview: http://127.0.0.1:5191 (not real SSO or provisioning)'));
