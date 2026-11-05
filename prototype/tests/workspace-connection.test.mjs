import assert from 'node:assert/strict';
import {test} from 'node:test';
import {watchWorkspace} from '../src/workspace-connection.ts';
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
  const timers=new Map();let sequence=0,starts=0,joins=0,refreshes=0;const events={};let failJoin=false,failStart=false;
  const connection={on:(name,fn)=>events[name]=fn,onclose:fn=>events.close=fn,onreconnected:fn=>events.reconnected=fn,start:async()=>{starts++;if(failStart)throw Error('offline');},invoke:async(method,warehouse)=>{assert.equal(method,'JoinWorkspace');assert.equal(warehouse,'main');joins++;if(failJoin)throw Error('join failed');},stop:async()=>{events.close?.();}};
  const stop=watchWorkspace(connection,'main',()=>refreshes++,{set:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},clear:id=>timers.delete(id)});
  return {events,stop,timers,failJoin:v=>failJoin=v,failStart:v=>failStart=v,counts:()=>({starts,joins,refreshes}),run:async()=>{const entry=timers.entries().next().value;assert.ok(entry);timers.delete(entry[0]);entry[1].fn();await settle();}};
}
test('connection resumes after automatic reconnect has exhausted its attempts',async()=>{const f=fixture();await settle();f.events.close();await f.run();assert.deepEqual(f.counts(),{starts:2,joins:2,refreshes:2});f.stop();});
test('failed rejoin stops the old connection and retries without unhandled rejection',async()=>{const f=fixture();await settle();f.failJoin(true);await f.events.reconnected();assert.equal(f.timers.size,1);f.failJoin(false);await f.run();assert.equal(f.counts().refreshes,2);f.stop();});
test('cleanup cancels retries and in-flight start never joins an obsolete warehouse',async()=>{const f=fixture();f.stop();await settle();assert.equal(f.counts().joins,0);assert.equal(f.timers.size,0);});
test('extended downtime retains one retry and no business command is replayed',async()=>{const f=fixture();await settle();f.failStart(true);f.events.close();await f.run();await f.run();assert.equal(f.timers.size,1);f.failStart(false);await f.run();assert.equal(f.counts().joins,2);f.stop();});
