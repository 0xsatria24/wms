import {readFileSync} from 'node:fs';
export function devApiTarget(env=process.env,read=()=>readFileSync(new URL('../../.runtime/dev-api-target.txt',import.meta.url),'utf8')) {
 let target=env.WMS_API_TARGET?.trim();
 if(!target){try{target=read().trim();}catch(error){if(error.code!=='ENOENT')throw error;}}
 if(!target)return '';
 const url=new URL(target);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid development API target. Use an HTTP(S) URL without credentials.');
 return target.replace(/\/$/,'');
}
