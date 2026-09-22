import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const walletSource=html.slice(html.indexOf('  function euro('),html.indexOf("  walletPanel.onclick"));
function harness(){
 const nodes=new Map();
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',href:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];if(k==='href')this.href='';},focus(){},select(){}});return nodes.get(selector);};
 const context=vm.createContext({$:node,walletPanel:node('#wallet-panel'),work:{wallet:null,usage:null},state:{busy:false},assistantUi:{tab:'wallet',walletRequest:0,walletLoading:false},nf:new Intl.NumberFormat('nl-BE'),esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),t:(key,fallback,vars={})=>fallback.replace(/\{(\w+)\}/g,(_,name)=>String(vars[name]??'')),navigator:{},document:{},accountPublicLabel:row=>row.label,action:async()=>null});
 vm.runInContext(walletSource,context);
 return {context,node,run:source=>vm.runInContext(source,context)};
}
test('missing money stays absent, genuine zero remains zero, subcent usage keeps precision',()=>{
 const h=harness();
 for(const input of ['undefined','null','""','" "'])assert.equal(h.run(`euro(${input})`),'—');
 assert.equal(h.run('euro(0)'),'€ 0');
 assert.match(h.run('walletMoney("0.00004")'),/0.00004/);
 assert.match(h.run('walletMoney("0.00004")'),/&lt; €0,01/);
});
test('a top-up is not confused with latest AI spend',()=>{
 const h=harness();
 assert.equal(h.run('latestWalletCharge({entries:[{type:"topup",amount_eur:10}]})'),undefined);
 assert.equal(h.run('latestWalletCharge({entries:[{type:"topup",amount_eur:10},{type:"usage",amount_eur:"0.004"}]})'),'0.004');
});
test('top-up draft contains amount and public reference, never claims sent',()=>{
 const h=harness();
 h.run('walletTopup.amount="20,50";walletTopup.reference=[{label:"Klantnummer",value:"KL-TEST"},{label:"Licentie-ID",value:"LIC-TEST"}];refreshWalletContact()');
 const link=new URL(h.node('#wallet-topup-mail').href);
 assert.equal(link.pathname,'david@belgobase.be');
 assert.match(link.searchParams.get('body'),/20.50[\s\S]*KL-TEST[\s\S]*LIC-TEST/);
 for(const invalid of ['0','-1','NaN','1e9','1.234','']){
   h.context.invalid=invalid;h.run('walletTopup.amount=invalid;refreshWalletContact()');
   assert.equal(h.node('#wallet-topup-mail').href,'');
 }
});
test('failed reload preserves last snapshot with stale warning; success restores it',async()=>{
 const h=harness();
 h.run('work.wallet={available_eur:10};');
 await h.run('loadWallet()');
 assert.equal(h.run('work.wallet.available_eur'),10);
 assert.equal(h.run('assistantUi.walletStale'),true);
 assert.match(h.node('#wallet-panel').innerHTML,/vorige controle/);
 h.context.action=async()=>({ok:true,wallet:{available_eur:20}});
 await h.run('loadWallet()');
 assert.equal(h.run('work.wallet.available_eur'),20);
 assert.equal(h.run('assistantUi.walletStale'),false);
});
