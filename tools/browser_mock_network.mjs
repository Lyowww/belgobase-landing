// Loaded only in the local browser-test child process. No live services are used.
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const address=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(['localhost','127.0.0.1','[::1]'].includes(address.hostname))return originalFetch(input,options);
 throw new Error(`External network is disabled in the browser mock (${address.hostname})`);
};
