import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantity, balance, sumQuantity, allocationPlan, relocationSources, resolveItem, canLeaveDraft, acceptsDraftSave, receiptIdentity, initialWorkspaceRoute } from '../src/workflow-model.ts';

test('decimal input preserves locale fractions and rejects ambiguous grouping/precision', () => {
  assert.equal(quantity('0,5'), '0.5'); assert.equal(quantity('12.000001'), '12.000001');
  for (const v of ['', '-1', '1,000.5', '1e3', '1.0000001', 'NaN']) assert.equal(quantity(v), null);
  assert.equal(quantity('0'), null); assert.equal(quantity('0', true), '0');
});
test('QC requires exact classification of the entire remainder including zero category', () => {
  assert.equal(balance('30', '20', '5'), '5'); assert.equal(balance('30', '24', '6'), '0');
  assert.equal(balance('0.3', '0.1', '0.2'), '0'); assert.equal(balance('30', '0', '30'), '0');
});
test('fractional staged and allocated amounts remain exact across several rows',()=>{
  assert.equal(sumQuantity(['0.1','0.2']),'0.3');
  assert.equal(balance('0.3','0.1','0'),'0.2');
});
const positions = [
  { id:'a', location:'A-01', available:'6', version:1, condition:'good', hold:'', pickable:true, frozen:false },
  { id:'b', location:'A-02', available:'4', version:2, condition:'good', hold:'', pickable:true, frozen:false },
];
test('full allocation can span bins without enabling partial order policy', () => {
  const p = allocationPlan('10', positions, false); assert.equal(p.shortage, '0'); assert.equal(p.allowed,true);
  assert.deepEqual(p.allocations.map(a => a.qty), ['6','4']);
  const short = allocationPlan('12', positions,false); assert.equal(short.shortage,'2'); assert.equal(short.allowed,false);
});
test('relocation does not choose a parent SKU source implicitly or expose held stock', () => {
  assert.equal(relocationSources(positions).length,2);
  assert.equal(relocationSources([...positions,{...positions[0],hold:'qc',id:'c'}, {...positions[0],frozen:true,id:'d'}, {...positions[0],location:'Receiving',id:'e'}]).length,2);
});
test('unknown and ambiguous codes remain unresolved', () => {
  const items=[{sku:'A',barcode:'000A',active:true},{sku:'B',barcode:'000A',active:true}];
  assert.equal(resolveItem('missing',items).status,'unknown'); assert.equal(resolveItem('000A',items).status,'ambiguous');
  assert.equal(resolveItem('A',items).item.sku,'A');
});
test('dirty drafts require deliberate save or discard before a context change', () => {
  assert.equal(canLeaveDraft(true,false),false); assert.equal(canLeaveDraft(true,true),true); assert.equal(canLeaveDraft(false,false),true);
});
test('a late draft save cannot mark a newer form or another document as saved',()=>{
  const sent={id:'draft-a',scope:'admin|main',snapshot:'qty:30'};
  assert.equal(acceptsDraftSave(sent,{...sent}),true);
  assert.equal(acceptsDraftSave(sent,{...sent,snapshot:'qty:40'}),false);
  assert.equal(acceptsDraftSave(sent,{...sent,id:'draft-b'}),false);
  assert.equal(acceptsDraftSave(sent,{...sent,scope:'other|main'}),false);
});
test('receipt identity stops cross-field SKU/barcode ambiguity',()=>{
  const items=[{sku:'X',barcode:'000X',active:true},{sku:'Y',barcode:'X',active:true}];
  assert.equal(receiptIdentity('X',items),null);
  assert.equal(receiptIdentity('Y',items).sku,'Y');
});
test('a signed-in reload preserves valid legacy bookmarks and still enforces setup',()=>{
  const routes=['stock','quality','putaway','pending','settings'];
  assert.equal(initialWorkspaceRoute('#quality','stock',routes,false),'quality');
  assert.equal(initialWorkspaceRoute('#signin','stock',routes,false),'stock');
  assert.equal(initialWorkspaceRoute('#pending','stock',routes,true),'settings');
});
