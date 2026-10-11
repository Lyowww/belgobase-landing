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
 test(`${name}: enddate FTE is labelled in KPI, chart and table`,()=>{const {c,nodes}=context({history:{years:[2024],series:{fte:[3.5]},facts:{fte:[{quality:'exact',status:'exact_1_einddatum'}]}}});c.renderYearFigures();c.drawChart();assert.match(nodes.get('#kpis').innerHTML,/Op boekjaareinde/);assert.match(nodes.get('#chart-area').innerHTML,/Op boekjaareinde/);assert.match(nodes.get('#year-table').innerHTML,/Op boekjaareinde/);c.i18n.language='fr';assert.equal(c.financialPeriodLabel({status:'exact_1_einddatum'}),'À la clôture');c.i18n.language='en';assert.equal(c.financialPeriodLabel({status:'exact_1_einddatum'}),'At financial year-end');});
 test(`${name}: quality labels translated and unknown quality not invented`,()=>{const {c}=context({});c.i18n.language='fr';assert.equal(c.financialQualityLabel('estimated'),'Estimé');c.i18n.language='en';assert.equal(c.financialQualityLabel('calculated'),'Calculated');assert.equal(c.financialQualityLabel('unspecified'),'');});
 test(`${name}: rejected mixed periods cannot reappear as an exact yearly KPI`,()=>{
  const {c,nodes}=context({metrics:[{key:'revenue',year:2024,value:120,quality:'exact'}],history:{years:[2023],ambiguous_years:[2024],series:{revenue:[180]},facts:{revenue:[{quality:'exact',period_end:'2023-12-31'}]}}});
  assert.deepEqual(Array.from(c.detailYears(c.state.detail)),['2023']);
  assert.equal(c.yearMetricValue(c.state.detail,'revenue',2024),null);
  assert.equal(c.yearMetricFact(c.state.detail,'revenue','2024').quality,'unavailable');
  c.state.detailYear='2024';c.renderYearFigures();c.drawChart();
  assert.equal(c.state.detailYear,'2023');assert.doesNotMatch(nodes.get('#year-buttons').innerHTML,/data-year="2024"/);
  assert.match(nodes.get('#kpis').innerHTML,/€ 180/);assert.doesNotMatch(nodes.get('#kpis').innerHTML,/€ 120/);
  assert.deepEqual(Array.from(c.financialChartData(c.state.detail).years),['2023']);
 });
 test(`${name}: ambiguous-only history leaves no selected year or invented amount`,()=>{
  const {c,nodes}=context({metrics:[{key:'revenue',year:2024,value:120,quality:'exact'}],history:{years:[],ambiguous_years:['2024'],series:{}}});
  c.state.detailYear='2024';c.renderYearFigures();c.drawChart();
  assert.equal(c.state.detailYear,null);assert.doesNotMatch(nodes.get('#year-buttons').innerHTML,/data-year=/);assert.doesNotMatch(nodes.get('#kpis').innerHTML,/€ 120/);
 });
 test(`${name}: resolved period, ordinary zero and loss remain available`,()=>{
  const {c}=context({});const resolved={metrics:[{key:'revenue',year:2024,value:120,quality:'exact'}],history:{years:[2024],ambiguous_years:[],series:{revenue:[65]},facts:{revenue:[{quality:'exact',period_end:'2024-06-30'}]}}};
  assert.equal(c.yearMetricFact(resolved,'revenue',2024).value,65);assert.equal(c.yearMetricFact(resolved,'revenue',2024).period_end,'2024-06-30');
  for(const value of [0,-5])assert.equal(c.yearMetricValue({metrics:[{key:'profit',year:2025,value,quality:'exact'}]},'profit',2025),value);
 });
}
