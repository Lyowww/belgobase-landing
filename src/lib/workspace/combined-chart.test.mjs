import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const paths=[['web',new URL('./assets/frozen-ui.html',import.meta.url)],['PC1','C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html']];
for(const [name,path] of paths){
 const html=await readFile(path,'utf8');
 const helper=html.slice(html.indexOf('function detailYears('),html.indexOf('function renderYearFigures('));
 const code=html.slice(html.indexOf('function financialChartData('),html.indexOf('let resizeTimer'));
 function harness(detail){
  const nodes=new Map([['#chart-area',{clientWidth:340}],['#dossier-view',{hidden:false}],['#chart-note',{}],['#year-table',{}],['#chart-legend',{}]]);
  const c=vm.createContext({state:{detail,tab:'finance'},i18n:{language:'nl'},$:key=>nodes.get(key),$$:()=>[],number:v=>typeof v==='number'&&Number.isFinite(v),
   metricLabel:k=>k,esc:v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),negativeClass:v=>v<0?' negative':'',t:(_,text)=>text,
   fmt:v=>typeof v==='number'?String(v):'—',money:v=>typeof v==='number'?'€ '+v:'—',short:String});
  vm.runInContext(helper+'\n'+code,c);c.renderChartLegend();c.drawChart();return {c,nodes,svg:()=>nodes.get('#chart-area').innerHTML};
 }
 test(`${name}: all financial lines start visible and turning large series off rescales remaining euros`,()=>{
  const h=harness({history:{years:[2022,2023,2024],series:{revenue:[1000000,2000000,3000000],profit:[100,200,300],fte:[2,3,4]}}});
  assert.match(h.svg(),/data-chart-series="revenue"/);assert.match(h.svg(),/data-chart-series="profit"/);assert.match(h.svg(),/data-chart-series="fte"/);
  const max=()=>Number(h.svg().match(/data-left-max="([^"]+)"/)[1]);const large=max();
  h.c.toggleChartMetric('revenue');assert.doesNotMatch(h.svg(),/data-chart-series="revenue"/);assert.ok(max()<large/100);
  h.c.toggleChartMetric('revenue');assert.equal(max(),large);
  assert.match(h.svg(),/data-right-max="4"/);assert.match(h.nodes.get('#chart-note').textContent,/rechteras/);
 });
 test(`${name}: zero and negatives are data, null and a missing calendar year break the line`,()=>{
  const h=harness({history:{years:[2025,2021,2022,2023],series:{profit:[-20,0,null,50]}}});
  assert.deepEqual(Array.from(h.c.financialChartData(h.c.state.detail).years),['2021','2022','2023','2025']);
  const path=h.svg().match(/<path d="([^"]*)"/)[1];assert.equal((path.match(/ M/g)||[]).length,3);assert.doesNotMatch(path,/ L/);
  assert.match(h.svg(),/2021: € 0/);assert.match(h.svg(),/data-left-min="-/);assert.doesNotMatch(h.svg(),/NaN|Infinity/);
 });
 test(`${name}: single current equity fact uses its own year and does not fill missing history`,()=>{
  const h=harness({history:{years:[2023,2024],series:{revenue:[null,200]}},metrics:[{key:'equity',year:2022,value:400},{key:'revenue',year:2023,value:999}]});
  const data=h.c.financialChartData(h.c.state.detail),equity=data.series.find(s=>s.key==='equity');
  assert.equal(equity.points.filter(p=>typeof p.value==='number').length,1);assert.equal(equity.points[0].year,'2022');
  assert.equal(data.series.find(s=>s.key==='revenue').points.find(p=>p.year==='2023').value,null);
  assert.match(h.svg(),/data-chart-series="equity"/);assert.match(h.nodes.get('#chart-note').textContent,/Eén bronjaar/);
 });
 test(`${name}: all off remains recoverable; missing series disabled; table unaffected`,()=>{
  const h=harness({history:{years:[2024],series:{revenue:[0],profit:[null]}}});const table=h.nodes.get('#year-table').innerHTML;
  assert.match(h.nodes.get('#chart-legend').innerHTML,/disabled title="Geen beschikbare cijfers"/);
  h.c.toggleChartMetric('revenue');assert.match(h.svg(),/Kies hierboven/);assert.equal(h.nodes.get('#year-table').innerHTML,table);
  h.c.toggleChartMetric('profit');assert.match(h.svg(),/Kies hierboven/);h.c.toggleChartMetric('revenue');assert.match(h.svg(),/<svg/);
  h.c.i18n.language='fr';h.c.toggleChartMetric('revenue');assert.match(h.svg(),/Choisissez/);
  h.c.i18n.language='en';h.c.drawChart();assert.match(h.svg(),/Choose a series/);
 });
 test(`${name}: empty company and lone FTE axis have truthful empty and unit states`,()=>{
  const empty=harness({history:{years:[],series:{revenue:[]}}});assert.match(empty.svg(),/Geen beschikbare cijfers/);
  const fte=harness({history:{years:[2023,2024],series:{fte:[1.2,1.8]}}});assert.match(fte.svg(),/>VTE<\/text>/);assert.doesNotMatch(fte.svg(),/data-right-max|>€<\/text>/);
  assert.match(fte.svg(),/tabindex="0"/);assert.doesNotMatch(html,/#chart-area svg path\{stroke:[^}]+!important/);
  assert.match(html,/state\.chartMetrics=null;renderDetail\(\)/);
 });
}
