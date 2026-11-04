import {chromium} from 'file:///C:/Users/muham/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='qa/export-20261104';await mkdir(out,{recursive:true});
const server=await chromium.launchServer({headless:true,channel:'chrome'});const browser=await chromium.connect(server.wsEndpoint());
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({csrfToken:'fixture-only'})}));
await page.goto('http://127.0.0.1:4176/qa/export-ui.html');
await page.getByRole('button',{name:'Export',exact:true}).click();
await page.getByRole('dialog').waitFor();await page.screenshot({path:out+'/desktop.png',fullPage:true});
assert.equal(await page.getByRole('dialog').isVisible(),true);
await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
assert.equal(await page.getByRole('button',{name:'Export',exact:true}).evaluate(el=>document.activeElement===el),true);
await page.getByRole('button',{name:'Export',exact:true}).click();await page.evaluate(()=>window.changeExportContext());await page.getByRole('dialog').waitFor({state:'detached'});
await page.setViewportSize({width:360,height:800});await page.evaluate(()=>window.changeExportLocale());
await page.getByRole('button',{name:'Ekspor',exact:true}).click();await page.getByRole('dialog').waitFor();
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
await page.getByLabel('Format',{exact:true}).selectOption('csv');await page.getByText('Impor kolom kode sebagai teks',{exact:false}).waitFor();
await page.keyboard.press('Tab');assert.equal(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
await page.screenshot({path:out+'/phone-id.png',fullPage:true});await page.getByRole('button',{name:'Batal',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
assert.deepEqual(errors,[]);await writeFile(out+'/ui-smoke.json',JSON.stringify({evidence:'Local component fixture; no live backend or client UAT',checks:['desktop modal','Escape closes','focus restored','context change closes','360px no page overflow','Indonesian CSV guidance','keyboard focus within modal','cancel closes'],errors},null,2));console.log('PASS: 8 local browser UI checks; screenshots saved in '+out);
}finally{await browser.close();await server.kill();}
