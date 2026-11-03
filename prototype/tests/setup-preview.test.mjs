import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('completed wizard and old SSO links leave fixtures for the real demo login', async () => {
  const child = spawn(process.execPath, ['qa/admin-setup-preview.mjs'], {env:{...process.env, WMS_PREVIEW_PORT:'5193'}, stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'), once(child,'exit').then(()=>{throw Error('Preview exited before startup');})]);
    const request = (path, body) => fetch('http://127.0.0.1:5193'+path, {redirect:'manual', ...(body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)} : {})});
    assert.equal((await request('/api/session').then(r=>r.json())).mode, 'oidc');
    assert.equal((await request('/api/setup/activate',{code:'preview-only'})).status,204);
    assert.equal((await request('/auth/setup-login')).status,302);
    assert.equal((await request('/api/setup/session').then(r=>r.json())).stage,'review');
    assert.equal((await request('/api/setup/complete',{})).status,204);
    for (const path of ['/', '/auth/login?rememberMe=false']) {
      const response = await request(path);
      assert.equal(response.status,302);
      assert.equal(response.headers.get('location'),'http://127.0.0.1:5187/');
    }
    await request('/qa/reset');
    assert.equal((await request('/api/setup/status').then(r=>r.json())).state,'required');
  } finally {child.kill(); await once(child,'exit');}
});
