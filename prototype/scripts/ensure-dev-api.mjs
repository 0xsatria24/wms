import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {devApiTarget} from './dev-api-target.mjs';
try {
 const target=devApiTarget();
 if(target){
   const response=await fetch(`${target}/api/session`,{signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('Configured development API is not ready. Start it before running npm run dev.');
   console.log('Configured development API is ready.');
 }else{
   const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../../scripts/start-local.ps1',import.meta.url)),'-BackendOnly'],{stdio:'inherit',windowsHide:true});
   if(result.error)throw result.error;
   process.exitCode=result.status??1;
 }
}catch{console.error('Development API startup failed. Check WMS_API_TARGET / .runtime/dev-api-target.txt, or the standard .runtime/development.env configuration. No frontend was started.');process.exitCode=1;}
