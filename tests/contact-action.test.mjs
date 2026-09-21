import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as templates from '../src/lib/email/templates.ts';
import * as validation from '../src/lib/validations/contact.ts';
import * as delivery from '../src/lib/contact-state.ts';

const source = await readFile(new URL('../src/app/actions/contact.ts', import.meta.url), 'utf8');
function action(result) {
  const calls = [], module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
    exports:module.exports, module, console:{error(){}},
    require(id) {
      if(id==='@/lib/email/resend') return {sendDemoRequestEmail:async input=>{calls.push(input);return result;}};
      if(id==='@/lib/email/templates') return templates;
      if(id==='@/lib/validations/contact') return validation;
      if(id==='@/lib/contact-state') return delivery;
      throw new Error('Unexpected dependency '+id);
    },
  });
  return {submit:module.exports.submitContactForm,calls};
}
function form(overrides={}) {
  const data=new FormData();
  for(const [key,value] of Object.entries({name:'Test User',email:'test@example.test',company:'Example Company',phone:'',gdprConfirm:'on',requestType:'sample',website:'',...overrides})) data.set(key,value);
  return data;
}
test('contact action rejects invalid consent and phone before delivery',async()=>{
  for(const overrides of [{gdprConfirm:''},{phone:'1'.repeat(51)},{website:'spam.example'}]) {
    const {submit,calls}=action({ok:true,delivered:true});
    const result=await submit({},form(overrides));
    assert.equal(result.success,false); assert.equal(calls.length,0);
  }
});
test('contact action reports actual delivery outcome without disclosing provider errors',async()=>{
  for(const ok of [false,true]) {
    const {submit,calls}=action(ok?{ok:true,delivered:true}:{ok:false,errorDetail:'PRIVATE_PROVIDER_DETAIL'});
    const result=await submit({},form());
    assert.equal(result.success,ok);assert.equal(calls.length,1);
    assert.equal(calls[0].customerEmail,'test@example.test');
    assert.equal(result.message,ok?'successMessage':'errorMessage');
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PROVIDER_DETAIL/);
  }
});
