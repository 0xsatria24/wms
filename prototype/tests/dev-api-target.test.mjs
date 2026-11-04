import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devApiTarget} from '../scripts/dev-api-target.mjs';
test('explicit backend wins over workspace config; missing config keeps standard startup',()=>{
 assert.equal(devApiTarget({WMS_API_TARGET:'http://127.0.0.1:5180'},()=> 'http://localhost:9999'),'http://127.0.0.1:5180');
 assert.equal(devApiTarget({},()=> 'http://127.0.0.1:5180\n'),'http://127.0.0.1:5180');
 assert.equal(devApiTarget({},()=>{throw {code:'ENOENT'};}),'');
 assert.throws(()=>devApiTarget({WMS_API_TARGET:'not a URL'},()=>''));
});
