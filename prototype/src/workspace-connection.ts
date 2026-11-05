interface Connection {
  on(name:string,handler:()=>void):void;
  onclose(handler:()=>void):void;
  onreconnected(handler:()=>Promise<void>):void;
  start():Promise<void>;
  stop():Promise<void>;
  invoke(method:string,warehouse:string):Promise<unknown>;
}
export function watchWorkspace(connection:Connection,warehouse:string,onChange:()=>void,clock={set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:any)=>clearTimeout(id)}) {
  let stopped=false,connecting=false;
  let retry:any,change:any;
  const schedule=()=>{if(!stopped&&retry===undefined)retry=clock.set(()=>{retry=undefined;void connect();},5000);};
  const join=async()=>{if(stopped)return;await connection.invoke('JoinWorkspace',warehouse);if(!stopped)onChange();};
  const recover=async()=>{await connection.stop().catch(()=>{});schedule();};
  const connect=async()=>{
    if(stopped||connecting)return;
    connecting=true;
    try{await connection.start();await join();}catch{await recover();}finally{connecting=false;}
  };
  connection.on('WorkspaceChanged',()=>{clock.clear(change);if(!stopped)change=clock.set(()=>{if(!stopped)onChange();},200);});
  connection.onclose(schedule);
  connection.onreconnected(async()=>{try{await join();}catch{await recover();}});
  void connect();
  return()=>{stopped=true;clock.clear(retry);clock.clear(change);retry=undefined;void connection.stop().catch(()=>{});};
}
