/** 初始化与编辑器共享的原生外置模板；无楼层身份、无加载时写入。 */
export function getEraExternalStatusbarHtml() {
  return String.raw`<style>
*{box-sizing:border-box}body{margin:0;padding:10px;font:13px system-ui,sans-serif;color:#e8f3f4;background:#15252e;color-scheme:dark}
.dashboard{border:1px solid #37535d;border-radius:12px;padding:12px;background:linear-gradient(120deg,#203842,#172830)}
header{display:flex;align-items:center;gap:10px;margin-bottom:10px}header strong{font-size:17px}small{color:#99b7c1}.badge{margin-left:auto;color:#79dec1;font-size:11px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.tile{padding:9px;border-radius:8px;background:#ffffff08;min-width:0}.tile label{display:block;color:#9fb9c1;font-size:11px;margin-bottom:5px}.value{overflow-wrap:anywhere}.health{grid-column:span 2}progress{width:100%;height:7px;accent-color:#63d9b5;border:0}progress::-webkit-progress-bar{background:#102129;border-radius:8px}progress::-webkit-progress-value{background:#63d9b5;border-radius:8px}
@media(max-width:520px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:280px){.grid{grid-template-columns:1fr}.health{grid-column:auto}}
</style>
<section class="dashboard" data-era-external-demo="v1">
<header><strong data-field="name">等待 ERA</strong><small>Lv. <span data-field="level">—</span></small><span class="badge" data-field="status">连接中</span></header>
<div class="grid">
<div class="tile health"><label>生命 / HP</label><div class="value"><span data-field="hp">—</span> / <span data-field="max_hp">—</span></div><progress aria-label="生命值" max="1" value="0"></progress></div>
<div class="tile"><label>金币</label><div class="value" data-field="gold">—</div></div><div class="tile"><label>声望</label><div class="value" data-field="reputation">—</div></div>
<div class="tile"><label>所在地</label><div class="value" data-field="location">—</div></div><div class="tile"><label>任务</label><div class="value" data-field="quest">—</div></div>
<div class="tile"><label>背包</label><div class="value" data-field="inventory">—</div></div><div class="tile"><label>危险度</label><div class="value" data-field="danger">—</div></div>
</div></section>
<script>
(()=>{
const text=value=>value===undefined||value===null?'未设置':typeof value==='object'?JSON.stringify(value):String(value);
const put=(name,value)=>{document.querySelector('[data-field="'+name+'"]').textContent=text(value)};
const show=state=>{
 const demo=state.statWithoutMeta?.era_demo||{},player=demo.player||{},rpg=demo.rpg||{};
 for(const name of ['name','level','hp','max_hp','inventory'])put(name,player[name]);
 for(const name of ['gold','reputation','location','quest'])put(name,rpg[name]);
 put('danger',rpg.world?.danger);
 put('status',state.status==='ready'?'实时状态':'等待 ERA');
 const bar=document.querySelector('progress'),max=Number(player.max_hp),hp=Number(player.hp);
 bar.max=Number.isFinite(max)&&max>0?max:1;bar.value=Number.isFinite(hp)?Math.max(0,Math.min(hp,bar.max)):0;
};
let unsubscribe=()=>{};
void ERA.ready().then(state=>{show(state);unsubscribe=ERA.subscribe(show)}).catch(error=>put('status',String(error)));
addEventListener('pagehide',()=>unsubscribe(),{once:true});
})();
</script>`;
}
