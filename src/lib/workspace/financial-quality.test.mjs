import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
for(const name of ['web']){
 const html=await readFile(new URL(`./assets/frozen-ui.html`,import.meta.url),'utf8');
 const helpers=html.slice(html.indexOf('function detailYears('),html.indexOf('function renderDetail('));
 const chart=html.slice(html.indexOf('function financialChartData('),html.indexOf('let resizeTimer'));
 function context(detail){const nodes=new Map(['#chart-area','#dossier-view','#chart-note','#year-table','#chart-legend','#year-buttons','#kpis'].map(k=>[k,{clientWidth:390,hidden:false}]));const c=vm.createContext({state:{detail,tab:'finance'},i18n:{language:'nl'},$:k=>nodes.get(k),$$:()=>[],number:v=>typeof v==='number'&&Number.isFinite(v),metricLabel:String,esc:String,negativeClass:()=>'',t:(_,s)=>s,fmt:v=>v??'—',money:v=>v===null?'—':'€ '+v,short:String,display:v=>v??'—',profileText:String});vm.runInContext(helpers+'\n'+chart,c);return {c,nodes};}
 test(`${name}: historical EBITDA card uses chosen year and calculation quality`,()=>{const {c,nodes}=context({history:{years:[2023,2024],series:{ebitda:[100,150]},facts:{ebitda:[{quality:'calculated',status:'berekend'},{quality:'estimated',status:'geschat'}]}}});c.state.detailYear='2023';c.renderYearFigures();assert.match(nodes.get('#kpis').innerHTML,/ebitda/);assert.match(nodes.get('#kpis').innerHTML,/Berekend/);assert.doesNotMatch(nodes.get('#kpis').innerHTML,/Geschat/);c.state.detailYear='2024';c.renderYearFigures();assert.match(nodes.get('#kpis').innerHTML,/Geschat/);});
 test(`${name}: estimation remains visible in graph points and annual table`,()=>{const {c,nodes}=context({history:{years:[2024],series:{ebitda:[80]},facts:{ebitda:[{quality:'estimated'}]}}});c.drawChart();assert.match(nodes.get('#chart-area').innerHTML,/€ 80 · Geschat/);assert.match(nodes.get('#year-table').innerHTML,/Geschat/);assert.match(nodes.get('#chart-note').textContent,/Geschatte/);});
 test(`${name}: missing historical value cannot be replaced by mismatched latest`,()=>{const {c}=context({history:{years:[2024],series:{ebitda:[null]},facts:{ebitda:[{quality:'unavailable'}]}},metrics:[{key:'ebitda',year:2024,value:999,quality:'calculated'}]});assert.equal(c.yearMetricFact(c.state.detail,'ebitda','2024').value,null);assert.equal(c.yearMetricFact(c.state.detail,'ebitda','2024').quality,'unavailable');});
 test(`${name}: quality labels translated and unknown quality not invented`,()=>{const {c}=context({});c.i18n.language='fr';assert.equal(c.financialQualityLabel('estimated'),'Estimé');c.i18n.language='en';assert.equal(c.financialQualityLabel('calculated'),'Calculated');assert.equal(c.financialQualityLabel('unspecified'),'');});
}
