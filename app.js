
(()=>{
"use strict";
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
function h(tag,attrs,...kids){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==="class")el.className=v;else if(k==="style")el.style.cssText=v;else if(k==="text")el.textContent=v;else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);else if(k==="value")el.value=v;else el.setAttribute(k,v===true?"":v);}for(const c of kids.flat()){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)));}return el;}
const pad=n=>String(n).padStart(2,"0");
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clone=o=>JSON.parse(JSON.stringify(o));
const SYS_TZ=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
const DAY=86400000;
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmtCache={};
function partsIn(t,tz){const f=fmtCache[tz]||(fmtCache[tz]=new Intl.DateTimeFormat("en-GB",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}));const o={};for(const p of f.formatToParts(new Date(t)))o[p.type]=p.value;return{y:+o.year,mo:+o.month,d:+o.day,h:+o.hour%24,mi:+o.minute,s:+o.second};}
function tzOffset(t,tz){const p=partsIn(t,tz);return Date.UTC(p.y,p.mo-1,p.d,p.h,p.mi,p.s)-Math.floor(t/1000)*1000;}
function offLabel(t,tz){const m=Math.round(tzOffset(t,tz)/60000);const s=m<0?"-":"+";const a=Math.abs(m);return`UTC${s}${pad(Math.floor(a/60))}:${pad(a%60)}`;}
function validTz(tz){try{new Intl.DateTimeFormat("en",{timeZone:tz});return true}catch{return false}}
/* wall-clock time in a zone -> UTC ms */
function zonedToUtc(date,time,tz){const[y,mo,d]=date.split("-").map(Number);const[hh,mm]=time.split(":").map(Number);
  if(!tz||tz==="system")return new Date(y,mo-1,d,hh,mm).getTime();
  const guess=Date.UTC(y,mo-1,d,hh,mm);let t=guess-tzOffset(guess,tz);const o2=tzOffset(t,tz);if(guess-o2!==t)t=guess-o2;return t;}
function utcToZoned(t,tz){if(!tz||tz==="system"){const d=new Date(t);return{date:isoDate(d),time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};}
  const p=partsIn(t,tz);return{date:`${p.y}-${pad(p.mo)}-${pad(p.d)}`,time:`${pad(p.h)}:${pad(p.mi)}`};}
const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromIso=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const sow=d=>addDays(sod(d),-((d.getDay()+6)%7));
const hm=t=>{const d=new Date(t);return`${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-n+3);const f=new Date(Date.UTC(t.getUTCFullYear(),0,4));return 1+Math.round(((t-f)/DAY-3+((f.getUTCDay()+6)%7))/7);}
const longDate=d=>`${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const shortDate=d=>`${WD[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`;

/* ---------- state ---------- */
function defaults(){return{
  palettes:[{id:"p_"+uid(),name:"Everyday",colors:[
    {id:"c_work",name:"Work",hex:"#3346B8"},{id:"c_study",name:"Study",hex:"#0E8A7E"},{id:"c_personal",name:"Personal",hex:"#C2417A"},
    {id:"c_health",name:"Health",hex:"#D98A1F"},{id:"c_social",name:"Social",hex:"#7A4FD0"},{id:"c_admin",name:"Admin",hex:"#5E6B7F"}]}],
  activePaletteId:null,
  zones:[{id:"z_"+uid(),label:"London",tz:"Europe/London"},{id:"z_"+uid(),label:"New York",tz:"America/New_York"},{id:"z_"+uid(),label:"Tokyo",tz:"Asia/Tokyo"}],
  templates:[]};}
function normalise(s){s=s&&typeof s==="object"?clone(s):{};const d=defaults();
  if(!Array.isArray(s.palettes)||!s.palettes.length)s.palettes=d.palettes;
  s.palettes.forEach(p=>{if(!Array.isArray(p.colors))p.colors=[];});
  if(!s.palettes.find(p=>p.id===s.activePaletteId))s.activePaletteId=s.palettes[0].id;
  if(!Array.isArray(s.zones))s.zones=d.zones;
  if(!Array.isArray(s.templates))s.templates=[];
  return s;}
const LS="jsournal.v1",LS_SYNC="jsournal.sync",LS_DEV="jsournal.device";
const APP_VERSION="__VERSION__";
const IS_DEV=APP_VERSION.charAt(0)==="_";
const lsGet=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true;}catch{return false;}};
const DEVICE=lsGet(LS_DEV)||(()=>{const d="d_"+uid();lsSet(LS_DEV,d);return d;})();
function loadLocal(){const now=Date.now();
  try{const raw=lsGet(LS);if(raw){const o=JSON.parse(raw);
    const events=new Map((o.events||[]).map(e=>[e.id,{...e,at:e.at||now}]));
    return{settings:normalise(o.settings),settingsAt:o.settingsAt||0,events,tombs:o.tombs||{}};}}catch{}
  return{settings:normalise(null),settingsAt:0,events:new Map(),tombs:{}};}
const boot=loadLocal();
const S={settings:boot.settings,settingsAt:boot.settingsAt,events:boot.events,tombs:boot.tombs,view:"week",cursor:sod(new Date()),clip:null,selected:null,moving:null,
  sync:{cfg:null,state:"off",last:0,error:null}};
try{const c=JSON.parse(lsGet(LS_SYNC)||"null");if(c&&c.owner&&c.key){S.sync.cfg=c;S.sync.state="idle";}}catch{}
try{const v=lsGet(LS+".view");if(["day","week","month"].includes(v))S.view=v;}catch{}

/* ---------- persistence: this device first, then encrypted sync ---------- */
function saveLocal(){if(!lsSet(LS,JSON.stringify({settings:S.settings,settingsAt:S.settingsAt,events:[...S.events.values()],tombs:S.tombs})))toast("This device is out of storage space. Delete old activities or make room.");}
function changed(){saveLocal();scheduleSync(1500);}
function saveSettings(){S.settingsAt=Date.now();changed();}
function putEvent(ev){const e={...ev,at:Date.now(),by:DEVICE};S.events.set(e.id,e);changed();}
function dropEvent(id){S.events.delete(id);S.tombs[id]=Date.now();changed();}
const toDoc=()=>({events:Object.fromEntries(S.events),tombs:{...S.tombs},settings:{data:S.settings,at:S.settingsAt,by:DEVICE}});
function applyDoc(doc){
  const before=JSON.stringify(toDoc());
  S.events=new Map(Object.entries(doc.events).map(([id,e])=>[id,{...e,id}]));S.tombs={...doc.tombs};
  if(doc.settings&&doc.settings.data){S.settings=normalise(doc.settings.data);S.settingsAt=doc.settings.at||0;}
  saveLocal();
  if(JSON.stringify(toDoc())!==before)safeRender();}
function safeRender(){/* don't redraw under a drag; redraw the calendar behind an open sheet is fine */
  if(document.querySelector(".ev.moving,.ev.resizing,.col.dragging")){setTimeout(safeRender,800);return;}render();}

let syncTimer=null,syncing=false,syncAgain=false;
function scheduleSync(ms){if(!S.sync.cfg)return;clearTimeout(syncTimer);syncTimer=setTimeout(runSync,ms);}
async function runSync(){
  if(!S.sync.cfg||!window.JSync)return;
  if(syncing){syncAgain=true;return;}
  if(navigator.onLine===false){S.sync.state="offline";renderSyncChip();return;}
  syncing=true;S.sync.state="syncing";renderSyncChip();
  try{const doc=await JSync.syncOnce({...S.sync.cfg,deviceName:deviceName()},toDoc());
    applyDoc(doc);S.sync.state="idle";S.sync.error=null;S.sync.last=Date.now();}
  catch(e){S.sync.state="error";S.sync.error=e&&e.message?e.message:"Couldn't reach GitHub. Trying again shortly.";
    if(e&&e.code==="rate")scheduleSync(5*60000);}
  finally{syncing=false;renderSyncChip();if(syncAgain){syncAgain=false;scheduleSync(300);}}}
function deviceName(){const ua=navigator.userAgent;return /iPhone/.test(ua)?"iPhone":/iPad/.test(ua)?"iPad":/Android/.test(ua)?"Android":/Mac/.test(ua)?"Mac":/Windows/.test(ua)?"Windows PC":"a device";}
function setSyncCfg(cfg){S.sync.cfg=cfg;if(cfg){const{existing,...keep}=cfg;lsSet(LS_SYNC,JSON.stringify(keep));S.sync.state="idle";}
  else{try{localStorage.removeItem(LS_SYNC);}catch{}S.sync.state="off";S.sync.error=null;}renderSyncChip();}
const ago=t=>{const s=Math.round((Date.now()-t)/1000);return s<45?"just now":s<3600?`${Math.round(s/60)} min ago`:s<86400?`${Math.round(s/3600)} h ago`:new Date(t).toLocaleDateString("en-GB");};
function syncLabel(){const y=S.sync;if(y.state==="off")return["","On this device only"];if(y.state==="syncing")return["busy","Syncing…"];
  if(y.state==="offline")return["","Offline · will sync later"];if(y.state==="error")return["bad","Sync problem"];return["on",y.last?`Synced ${ago(y.last)}`:"Sync on"];}
function renderSyncChip(){const el=document.getElementById("syncChip");if(!el)return;const[cls,txt]=syncLabel();
  el.replaceChildren(h("span",{class:"dot "+cls}),txt);el.title=S.sync.error||"";}

/* ---------- palette & zones ---------- */
const activePalette=()=>S.settings.palettes.find(p=>p.id===S.settings.activePaletteId)||S.settings.palettes[0];
function colourOf(id){const a=activePalette().colors.find(c=>c.id===id);if(a)return a;for(const p of S.settings.palettes){const c=p.colors.find(c=>c.id===id);if(c)return c;}return{id:null,name:"No colour",hex:"#7D8496"};}
const zoneLabel=tz=>{if(!tz||tz==="system")return"Your time";const z=S.settings.zones.find(z=>z.tz===tz);return z?z.label:tz.split("/").pop().replace(/_/g," ");};
const keyName=n=>n.replace(/\s+/g,"").toLowerCase();

/* ---------- toast & sheet ---------- */
let toastTimer;
function toast(msg,label,fn){const t=$("#toast");t.replaceChildren(h("span",{text:msg}),label?h("button",{class:"btn",onclick:()=>{t.hidden=true;fn();}},label):null);t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,label?7000:3500);}
function openSheet({title,body,foot,wide,tabs}){const root=$("#sheetRoot");
  const close=()=>{root.replaceChildren();document.removeEventListener("keydown",esc);};
  const esc=e=>{if(e.key==="Escape")close();};document.addEventListener("keydown",esc);
  const sheet=h("div",{class:"sheet"+(wide?" wide":""),role:"dialog","aria-modal":"true","aria-label":title},
    h("header",{},h("h2",{text:title}),h("button",{class:"btn ghost icon","aria-label":"Close",onclick:close},"✕")),tabs||null,body,foot||null);
  const scrim=h("div",{class:"scrim",onclick:e=>{if(e.target===scrim)close();}},sheet);
  root.replaceChildren(scrim);setTimeout(()=>{const f=sheet.querySelector("input,textarea");if(f&&!f.dataset.nofocus)f.focus();},30);
  return close;}

/* ---------- clipboard (in-app) ---------- */
function toItems(evs,anchor){/* anchor = local midnight Date */
  return evs.map(e=>{const s=new Date(e.start);return{title:e.title,colorId:e.colorId,notes:e.notes||"",srcZone:e.srcZone||"system",
    dayOffset:Math.round((sod(s)-anchor)/DAY),startMin:s.getHours()*60+s.getMinutes(),durMin:Math.max(5,Math.round((e.end-e.start)/60000))};});}
function setClip(clip){S.clip=clip;S.moving=null;if(clip)S.selected=null;render();}
function select(id){S.selected=id;S.moving=null;render();}
function startMove(id){S.moving=id;S.clip=null;render();}
function moveTo(day,minute){const ev=S.events.get(S.moving);S.moving=null;if(!ev){render();return;}
  const s=new Date(ev.start);const sm=minute!=null?minute:s.getHours()*60+s.getMinutes();
  const start=new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,sm).getTime();
  commitMove(ev,start);}
function commitMove(ev,start){const old=clone(ev);const end=start+(ev.end-ev.start);
  if(start===ev.start){S.selected=ev.id;render();return;}
  putEvent({...ev,start,end});S.selected=ev.id;render();
  toast(`Moved to ${shortDate(new Date(start))}, ${hm(start)}.`,"Undo",()=>{putEvent(old);render();});}
function deleteSelected(){const ev=S.events.get(S.selected);if(!ev)return;const old=clone(ev);dropEvent(ev.id);S.selected=null;render();
  toast("Activity deleted.","Undo",()=>{putEvent(old);S.selected=old.id;render();});}
function copySelected(){const ev=S.events.get(S.selected);if(!ev)return;setClip({span:"event",label:`"${ev.title}"`,items:toItems([ev],sod(new Date(ev.start)))});}
function pasteAt(day,minute){const c=S.clip;if(!c)return;
  let anchor=sod(day);if(c.span==="week")anchor=sow(day);
  const made=[];
  c.items.forEach((it,i)=>{const d=addDays(anchor,it.dayOffset);const sm=(c.span==="event"&&minute!=null)?minute:it.startMin;
    const start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,sm).getTime();
    const ev={id:"e_"+uid(),title:it.title,colorId:it.colorId,notes:it.notes,srcZone:it.srcZone,start,end:start+it.durMin*60000};
    putEvent(ev);made.push(ev.id);});
  render();toast(`Pasted ${made.length} ${made.length===1?"activity":"activities"}.`,"Undo",()=>{made.forEach(dropEvent);render();});}
function renderPasteBar(){const bar=$("#pastebar");bar.className="pastebar";
  if(S.selected&&!S.events.has(S.selected))S.selected=null;
  if(S.moving){const ev=S.events.get(S.moving);if(!ev){S.moving=null;bar.hidden=true;return;}
    bar.replaceChildren(h("p",{},h("span",{},"Tap ",S.view==="month"?"a day":"a time"," to move ",h("b",{text:ev.title}),S.view==="month"?" (keeps its time).":".")),
      h("div",{class:"acts"},h("button",{class:"btn",onclick:()=>{S.moving=null;render();}},"Cancel")));bar.hidden=false;return;}
  if(!S.clip&&S.selected){const ev=S.events.get(S.selected);const c=colourOf(ev.colorId);
    const del=h("button",{class:"btn danger",onclick:()=>{if(!del.classList.contains("armed")){del.classList.add("armed");del.textContent="Tap again";return;}deleteSelected();}},"Delete");
    bar.replaceChildren(h("p",{},h("i",{class:"cdot",style:`--c:${c.hex}`}),h("span",{},h("b",{text:ev.title})," ",h("span",{class:"when",text:`${shortDate(new Date(ev.start))} ${hm(ev.start)}–${hm(ev.end)}`}))),
      h("div",{class:"acts"},h("button",{class:"btn",onclick:()=>editEvent(ev)},"Edit"),h("button",{class:"btn",onclick:()=>startMove(ev.id)},"Move"),
        h("button",{class:"btn",onclick:copySelected},"Copy"),del,h("button",{class:"btn","aria-label":"Deselect",onclick:()=>select(null)},"✕")));
    bar.hidden=false;return;}
  if(!S.clip){bar.hidden=true;return;}
  const c=S.clip;const what=c.span==="event"?"a time":c.span==="week"?"any day in the target week":"a day";
  bar.replaceChildren(h("p",{},h("b",{text:c.label})," copied. Tap "+what+" to paste. Paste as often as you like."),h("button",{class:"btn",onclick:()=>setClip(null)},"Done"));bar.hidden=false;}

/* ---------- event queries ---------- */
function eventsBetween(a,b){return[...S.events.values()].filter(e=>e.end>a&&e.start<b).sort((x,y)=>x.start-y.start||y.end-x.end);}

/* ---------- views ---------- */
const main=$("#main");
function render(){
  document.querySelectorAll(".seg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===S.view)));
  const c=S.cursor;let label;
  if(S.view==="day")label=h("span",{},longDate(c));
  else if(S.view==="week"){const a=sow(c),b=addDays(a,6);label=h("span",{},`${a.getDate()}${a.getMonth()!==b.getMonth()?" "+MONTHS[a.getMonth()].slice(0,3):""} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0,3)} ${b.getFullYear()}`,h("span",{text:"Week "+isoWeek(a)}));}
  else label=h("span",{},`${MONTHS[c.getMonth()]} ${c.getFullYear()}`);
  $("#period").replaceChildren(label);
  $("#tzline").textContent=`${SYS_TZ} · ${offLabel(Date.now(),SYS_TZ)}`;
  renderActions();
  const st=main.scrollTop,sl=main.scrollLeft;
  if(S.view==="month")renderMonth();else renderGrid(S.view==="day"?1:7);
  renderPasteBar();
  if(renderedView===S.view){main.scrollTop=st;main.scrollLeft=sl;}
  else{main.scrollLeft=0;main.scrollTop=S.view==="month"?0:Math.max(0,7*parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hour"))-4);renderedView=S.view;}
}
let renderedView=null;
let suppressClick=false;
const fmtMin=m=>m>=1440?"24:00":`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const durLabel=m=>{const H=Math.floor(m/60),M=m%60;return H&&M?`${H} h ${M} min`:H?`${H} h`:`${M} min`;};

function renderActions(){
  const span=S.view==="day"?"day":S.view==="week"?"week":"month";
  const status=h("div",{class:"status"},
    h("button",{class:"chipbtn",id:"syncChip",onclick:()=>openSettings("sync")}),
    h("i",{},"Palette: "+activePalette().name));
  $("#actions").replaceChildren(
    h("button",{class:"btn primary",onclick:()=>editEvent(null,{day:S.cursor,minute:9*60})},"+ New activity"),
    h("button",{class:"btn",onclick:openImport},"Paste plans"),
    h("span",{class:"sep"}),
    span!=="month"?h("button",{class:"btn",onclick:()=>copyRange(span)},`Copy ${span}`):null,
    h("button",{class:"btn",onclick:()=>copyAsText(span)},`Copy ${span} as text`),
    span==="day"?h("button",{class:"btn",onclick:saveDayTemplate},"Save day as template"):null,
    h("button",{class:"btn",onclick:()=>openSettings("templates")},"Templates"),
    h("span",{class:"sep"}),
    h("button",{class:"btn",onclick:()=>openSettings("palettes")},"Colours"),
    h("button",{class:"btn",onclick:()=>openSettings("zones")},"Time zones"),
    h("button",{class:"btn",onclick:()=>openSettings("sync")},"Devices & sync"),
    installBtn(),
    status);
  renderSyncChip();
}

function layoutDay(evs,ds,de){const segs=evs.map(e=>({e,s:Math.max(e.start,ds),en:Math.min(e.end,de)})).filter(x=>x.en>x.s);
  let lanes=[],cluster=[],cEnd=-1;const out=[];
  const flush=()=>{cluster.forEach(x=>x.cols=lanes.length);out.push(...cluster);cluster=[];lanes=[];};
  for(const x of segs){if(x.s>=cEnd&&cluster.length)flush();let i=lanes.findIndex(end=>end<=x.s);if(i<0){i=lanes.length;lanes.push(x.en);}else lanes[i]=x.en;x.lane=i;cluster.push(x);cEnd=Math.max(cEnd,x.en);}
  flush();return out;}

function renderGrid(n){
  const start=n===1?sod(S.cursor):sow(S.cursor);const today=sod(new Date());
  const HOUR=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hour"))||46;
  const grid=h("div",{class:"tgrid",style:`grid-template-columns:52px repeat(${n},minmax(${n===1?"0":"96px"},1fr))`});
  grid.append(h("div",{class:"corner"}));
  const days=[...Array(n)].map((_,i)=>addDays(start,i));
  days.forEach(d=>grid.append(h("div",{class:"hcell"+(sameDay(d,today)?" today":""),title:"Open day",onclick:()=>{S.cursor=d;setView("day");}},
    h("span",{class:"dn",text:d.getDate()}),h("span",{class:"dw",text:WD[(d.getDay()+6)%7]}))));
  grid.append(h("div",{class:"times"},[...Array(24)].map((_,i)=>h("div",{text:pad(i)+":00"}))));
  let any=false;
  days.forEach(d=>{const ds=d.getTime(),de=addDays(d,1).getTime();
    const ghost=h("div",{class:"ghost-slot"});
    const col=h("div",{class:"col"+(sameDay(d,today)?" today":"")+(S.clip?" pasting":""),role:"button","aria-label":"Add on "+shortDate(d)});
    col.append(ghost);
    col.addEventListener("mousemove",e=>{if(e.target.closest(".ev"))return;const y=e.clientY-col.getBoundingClientRect().top;ghost.style.top=(Math.floor(y/(HOUR/2))*(HOUR/2))+"px";});
    const yOf=e=>e.clientY-col.getBoundingClientRect().top;
    const slot30=e=>Math.min(23*60+30,Math.max(0,Math.floor(yOf(e)/(HOUR/2))*30));
    const q15=y=>Math.min(1440,Math.max(0,Math.round(y/(HOUR/4))*15));
    /* paste mode: a plain tap pastes */
    col.dataset.day=String(ds);
    col.addEventListener("click",e=>{if(e.target.closest(".ev"))return;if(S.moving)moveTo(d,slot30(e));else if(S.clip)pasteAt(d,slot30(e));});
    /* create: tap = 1 hour, drag (or long-press then drag on touch) = choose the length */
    const sel=h("div",{class:"dragsel",hidden:true});col.append(sel);
    let drag=null;
    const showSel=()=>{const a=Math.min(drag.a,drag.b),b=Math.max(drag.a,drag.b,Math.min(drag.a,drag.b)+15);
      sel.hidden=false;sel.style.top=a/60*HOUR+"px";sel.style.height=(b-a)/60*HOUR+"px";sel.textContent=`${fmtMin(a)}–${fmtMin(b)} · ${durLabel(b-a)}`;};
    const endDrag=()=>{if(drag&&drag.timer)clearTimeout(drag.timer);drag=null;sel.hidden=true;col.classList.remove("dragging");};
    col.addEventListener("pointerdown",e=>{if(S.clip||S.moving||e.button!==0||e.target.closest(".ev"))return;
      const y=yOf(e);const a=Math.min(1425,Math.floor(y/(HOUR/4))*15);
      drag={a,b:a+15,y0:e.clientY,x0:e.clientX,active:e.pointerType==="mouse",moved:false,slot:slot30(e)};
      if(drag.active){try{col.setPointerCapture(e.pointerId);}catch{}}
      else drag.timer=setTimeout(()=>{if(!drag)return;drag.active=true;col.classList.add("dragging");showSel();try{navigator.vibrate&&navigator.vibrate(8);}catch{}},320);});
    col.addEventListener("pointermove",e=>{if(!drag)return;
      const dist=Math.abs(e.clientY-drag.y0)+Math.abs(e.clientX-drag.x0);
      if(!drag.active){if(dist>8)endDrag();return;}/* touch moved before the hold: let the page scroll */
      if(Math.abs(e.clientY-drag.y0)>5)drag.moved=true;
      if(!drag.moved)return;
      col.classList.add("dragging");const m=q15(yOf(e));drag.b=m>drag.a?Math.max(m,drag.a+15):m;showSel();});
    col.addEventListener("pointerup",e=>{if(!drag)return;const g=drag;endDrag();
      if(g.active&&g.moved){const a=Math.min(g.a,g.b),b=Math.max(g.a+15,g.b,a+15);editEvent(null,{day:d,minute:a,endMinute:Math.min(b,1440)});}
      else if(S.selected)select(null);/* a tap on empty space clears the selection */
      else editEvent(null,{day:d,minute:g.slot});});
    col.addEventListener("pointercancel",endDrag);
    col.addEventListener("touchmove",e=>{if(drag&&drag.active)e.preventDefault();},{passive:false});
    const segs=layoutDay(eventsBetween(ds,de),ds,de);if(segs.length)any=true;
    segs.forEach(x=>{const e=x.e,c=colourOf(e.colorId);const top=(x.s-ds)/3600000*HOUR,ht=Math.max(20,(x.en-x.s)/3600000*HOUR-2);
      const w=100/x.cols;const tzNote=e.srcZone&&e.srcZone!=="system"?` · set in ${zoneLabel(e.srcZone)} ${utcToZoned(e.start,e.srcZone).time}`:"";
      const meta=h("span",{class:"m",text:`${hm(e.start)}–${hm(e.end)}${e.srcZone&&e.srcZone!=="system"?" · "+zoneLabel(e.srcZone):""}`});
      if(ht<=34)meta.hidden=true;
      const isSel=S.selected===e.id;
      const block=h("button",{class:"ev"+(isSel?" sel":"")+(S.moving===e.id?" moving":""),"aria-pressed":String(isSel),style:`--c:${c.hex};top:${top}px;height:${ht}px;left:calc(${x.lane*w}% + 2px);width:calc(${w}% - 4px)`,
        title:`${e.title}\n${hm(e.start)}–${hm(e.end)} · ${c.name}${tzNote}\n${isSel?"Drag to move · tap again to open":"Tap to select · double-click to open"}`,
        onclick:()=>{if(suppressClick){suppressClick=false;return;}if(S.moving||S.clip)return;if(isSel)editEvent(e);else select(e.id);}},h("span",{class:"t",text:e.title}),meta);
      if(isSel&&!S.clip&&!S.moving){/* drag a selected activity to a new time or day */
        let mv=null;const pv=h("div",{class:"dragsel"});
        block.addEventListener("pointerdown",ev=>{if(ev.button!==0||ev.target.closest(".rz"))return;
          const grab=Math.round((ev.clientY-col.getBoundingClientRect().top)/HOUR*60-(e.start-ds)/60000);
          mv={grab,x0:ev.clientX,y0:ev.clientY,moved:false,start:e.start,target:null};try{block.setPointerCapture(ev.pointerId);}catch{}});
        block.addEventListener("pointermove",ev=>{if(!mv)return;
          if(!mv.moved&&Math.abs(ev.clientX-mv.x0)+Math.abs(ev.clientY-mv.y0)<6)return;mv.moved=true;block.classList.add("moving");
          const tcol=document.elementsFromPoint(ev.clientX,ev.clientY).find(n=>n.classList&&n.classList.contains("col"));if(!tcol)return;
          const y=ev.clientY-tcol.getBoundingClientRect().top;const dur=(e.end-e.start)/60000;
          const sm=Math.min(1440-15,Math.max(0,Math.round((y/HOUR*60-mv.grab)/15)*15));
          const td=new Date(+tcol.dataset.day);mv.start=new Date(td.getFullYear(),td.getMonth(),td.getDate(),0,sm).getTime();
          if(pv.parentNode!==tcol)tcol.append(pv);pv.style.top=sm/60*HOUR+"px";pv.style.height=Math.max(20,Math.min(dur,1440-sm)/60*HOUR-2)+"px";
          pv.textContent=`${shortDate(td)} · ${hm(mv.start)}–${hm(mv.start+dur*60000)}`;});
        const drop=ev=>{if(!mv)return;const m=mv;mv=null;pv.remove();block.classList.remove("moving");
          if(!m.moved)return;suppressClick=true;setTimeout(()=>suppressClick=false,300);
          if(ev.type==="pointercancel"){render();return;}commitMove(e,m.start);};
        block.addEventListener("pointerup",drop);block.addEventListener("pointercancel",drop);
        block.addEventListener("touchmove",ev=>{if(mv)ev.preventDefault();},{passive:false});}
      if(x.en===e.end&&!S.clip){/* resize handle on the day the activity ends */
        const rz=h("span",{class:"rz","aria-hidden":"true"});let r=null;
        rz.addEventListener("pointerdown",ev=>{ev.stopPropagation();ev.preventDefault();try{rz.setPointerCapture(ev.pointerId);}catch{}
          r={startMin:(x.s-ds)/60000,end:(x.en-ds)/60000};block.classList.add("resizing");});
        rz.addEventListener("pointermove",ev=>{if(!r)return;const y=ev.clientY-col.getBoundingClientRect().top;
          r.end=Math.min(1440,Math.max(r.startMin+15,Math.round(y/(HOUR/4))*15));
          block.style.height=Math.max(20,(r.end-r.startMin)/60*HOUR-2)+"px";meta.hidden=false;
          meta.textContent=`${hm(e.start)}–${fmtMin(r.end)} · ${durLabel(Math.round((ds+r.end*60000-e.start)/60000))}`;});
        const finish=ev=>{if(!r)return;const res=r;r=null;block.classList.remove("resizing");suppressClick=true;setTimeout(()=>suppressClick=false,300);
          const newEnd=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,res.end).getTime();
          if(ev.type==="pointercancel"||newEnd===e.end){render();return;}
          const old=clone(e);putEvent({...e,end:newEnd});render();toast(`${e.title} now ends at ${hm(newEnd)}.`,"Undo",()=>{putEvent(old);render();});};
        rz.addEventListener("pointerup",finish);rz.addEventListener("pointercancel",finish);
        rz.addEventListener("click",ev=>ev.stopPropagation());
        block.append(rz);}
      col.append(block);});
    if(sameDay(d,today)){const now=new Date();col.append(h("div",{class:"nowline",style:`top:${(now.getHours()*60+now.getMinutes())/60*HOUR}px`}));}
    grid.append(col);});
  main.replaceChildren(grid);
  if(!any&&S.events.size===0)main.append(emptyNote());
}
function emptyNote(){return h("div",{class:"empty-note"},h("h3",{text:"Your journal is empty"}),
  h("p",{},"Drag down a day to block out an activity (on a phone, hold first, then drag). Or use ",h("b",{text:"Paste plans"})," to drop in a list like ",h("code",{text:"Mon 09:00-10:30 Team call #Work"}),"."));}

function renderMonth(){
  const c=S.cursor;const first=new Date(c.getFullYear(),c.getMonth(),1);const start=sow(first);const today=sod(new Date());
  const wrap=h("div",{class:"month"});WD.forEach(w=>wrap.append(h("div",{class:"mhead",text:w})));
  const weeks=Math.ceil(((first.getDay()+6)%7+new Date(c.getFullYear(),c.getMonth()+1,0).getDate())/7);
  for(let i=0;i<weeks*7;i++){const d=addDays(start,i);const evs=eventsBetween(d.getTime(),addDays(d,1).getTime());
    const cell=h("div",{class:"mcell"+(d.getMonth()!==c.getMonth()?" out":"")+(sameDay(d,today)?" today":""),tabindex:"0",
      onclick:e=>{if(e.target.closest(".chip,.madd"))return;if(S.moving)moveTo(d,null);else if(S.clip)pasteAt(d,null);else if(S.selected)select(null);else{S.cursor=d;setView("day");}},
      onkeydown:e=>{if(e.key==="Enter"&&e.target===cell){S.cursor=d;setView("day");}}},
      h("div",{class:"mtop"},h("span",{class:"mnum",text:d.getDate()}),h("button",{class:"madd","aria-label":"Add on "+shortDate(d),onclick:()=>editEvent(null,{day:d,minute:9*60})},"+")));
    evs.slice(0,3).forEach(e=>{const col=colourOf(e.colorId);const isSel=S.selected===e.id;cell.append(h("button",{class:"chip"+(isSel?" sel":""),"aria-pressed":String(isSel),style:`--c:${col.hex}`,title:`${e.title} · ${col.name}`,
      onclick:()=>{if(S.moving){moveTo(d,null);return;}if(S.clip){pasteAt(d,null);return;}if(isSel)editEvent(e);else select(e.id);}},h("b",{text:hm(Math.max(e.start,d.getTime()))}),h("span",{text:e.title})));});
    if(evs.length>3)cell.append(h("span",{class:"more",text:`+${evs.length-3} more`}));
    wrap.append(cell);}
  main.replaceChildren(wrap);if(S.events.size===0)main.append(emptyNote());
}

function setView(v){S.view=v;try{localStorage.setItem(LS+".view",v);}catch{}render();}
document.querySelectorAll(".seg button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$("#todayBtn").onclick=()=>{S.cursor=sod(new Date());render();};
function step(dir){const c=S.cursor;S.cursor=S.view==="day"?addDays(c,dir):S.view==="week"?addDays(c,7*dir):new Date(c.getFullYear(),c.getMonth()+dir,1);render();}
$("#prevBtn").onclick=()=>step(-1);$("#nextBtn").onclick=()=>step(1);
document.addEventListener("keydown",e=>{if($("#sheetRoot").childElementCount||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const mod=e.ctrlKey||e.metaKey;
  if(e.key==="Escape"&&S.moving){S.moving=null;render();}
  else if(e.key==="Escape"&&S.clip)setClip(null);
  else if(e.key==="Escape"&&S.selected)select(null);
  else if(S.selected&&(e.key==="Delete"||e.key==="Backspace")){e.preventDefault();deleteSelected();}
  else if(S.selected&&e.key==="Enter"){const ev=S.events.get(S.selected);if(ev)editEvent(ev);}
  else if(S.selected&&mod&&e.key.toLowerCase()==="c"){e.preventDefault();copySelected();}
  else if(mod)return;
  else if(e.key==="ArrowLeft")step(-1);else if(e.key==="ArrowRight")step(1);else if(e.key==="t")$("#todayBtn").click();
  else if(e.key==="d")setView("day");else if(e.key==="w")setView("week");else if(e.key==="m")setView("month");});

/* ---------- ranges ---------- */
function rangeOf(span){const c=S.cursor;if(span==="day")return[sod(c),addDays(sod(c),1)];if(span==="week")return[sow(c),addDays(sow(c),7)];
  return[new Date(c.getFullYear(),c.getMonth(),1),new Date(c.getFullYear(),c.getMonth()+1,1)];}
function copyRange(span){const[a,b]=rangeOf(span);const evs=eventsBetween(a.getTime(),b.getTime()).filter(e=>e.start>=a.getTime());
  if(!evs.length){toast(`Nothing to copy on this ${span}.`);return;}
  setClip({span,label:`${evs.length} ${evs.length===1?"activity":"activities"} from ${span==="day"?shortDate(a):"week "+isoWeek(a)}`,items:toItems(evs,a)});}
function exportText(evs){/* one line per activity, date repeated for clarity */
  return evs.map(e=>{const c=colourOf(e.colorId);return`${isoDate(new Date(e.start))} ${hm(e.start)}-${hm(e.end)} ${e.title}${c.id?" #"+c.name.replace(/\s+/g,""):""}`;}).join("\n");}
function copyAsText(span){const[a,b]=rangeOf(span);const evs=eventsBetween(a.getTime(),b.getTime()).filter(e=>e.start>=a.getTime());
  if(!evs.length){toast(`Nothing to copy on this ${span}.`);return;}
  const text=exportText(evs);
  const show=()=>{const ta=h("textarea",{class:"inp",rows:"10",readonly:true,"data-nofocus":"1"});ta.value=text;
    openSheet({title:"Plans as text",body:h("div",{class:"body"},h("p",{class:"hint",text:"Select and copy this. You can paste it back in with Paste plans, here or on another device."}),ta)});setTimeout(()=>ta.select(),40);};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>toast(`Copied ${evs.length} ${evs.length===1?"line":"lines"} to your clipboard.`),show);}else show();}

/* ---------- event editor ---------- */
function zoneOptions(sel){return[h("option",{value:"system",selected:sel==="system"},`Your time (${SYS_TZ})`),
  ...S.settings.zones.map(z=>h("option",{value:z.tz,selected:sel===z.tz},`${z.label} (${z.tz}, ${offLabel(Date.now(),z.tz)})`))];}
function editEvent(ev,{day,minute,endMinute}={}){
  const isNew=!ev;
  const srcZone=ev?.srcZone&&ev.srcZone!=="system"&&validTz(ev.srcZone)?ev.srcZone:"system";
  let date,st,en;
  if(ev){const a=utcToZoned(ev.start,srcZone),b=utcToZoned(ev.end,srcZone);date=a.date;st=a.time;en=b.time;}
  else{const d=day||S.cursor;date=isoDate(d);st=`${pad(Math.floor(minute/60))}:${pad(minute%60)}`;const em=Math.min(endMinute!=null?endMinute:minute+60,23*60+59);en=`${pad(Math.floor(em/60))}:${pad(em%60)}`;}
  let colorId=ev?.colorId||activePalette().colors[0]?.id||null;
  const fTitle=h("input",{class:"inp",id:"evTitle",value:ev?.title||"",placeholder:"What's happening?"});
  const fDate=h("input",{class:"inp",type:"date",id:"evDate",value:date});
  const fStart=h("input",{class:"inp",type:"time",id:"evStart",value:st});
  const fEnd=h("input",{class:"inp",type:"time",id:"evEnd",value:en});
  const fZone=h("select",{class:"inp",id:"evZone"},zoneOptions(srcZone));
  const fNotes=h("textarea",{class:"inp",id:"evNotes",rows:"2",placeholder:"Notes, links, who's coming…"});fNotes.value=ev?.notes||"";
  const conv=h("div",{class:"conv"});
  const sws=h("div",{class:"swatches",role:"radiogroup","aria-label":"Colour"});
  const drawSw=()=>{const pal=activePalette().colors.slice();if(colorId&&!pal.find(c=>c.id===colorId)){const c=colourOf(colorId);if(c.id)pal.push(c);}
    sws.replaceChildren(...pal.map(c=>h("button",{type:"button",class:"sw",role:"radio","aria-checked":String(c.id===colorId),style:`--c:${c.hex}`,onclick:()=>{colorId=c.id;drawSw();}},h("i"),c.name)));};
  drawSw();
  const times=()=>{const tz=fZone.value;if(!fDate.value||!fStart.value||!fEnd.value)return null;let s=zonedToUtc(fDate.value,fStart.value,tz),e=zonedToUtc(fDate.value,fEnd.value,tz);if(e<=s)e+=DAY;return{s,e,tz};};
  const upd=()=>{const t=times();if(!t){conv.textContent="Pick a date and times.";return;}
    const sd=new Date(t.s),ed=new Date(t.e);
    conv.replaceChildren(t.tz==="system"?"Shows in your calendar as ":`Entered in ${zoneLabel(t.tz)} time. Shows in your calendar as `,
      h("b",{text:`${shortDate(sd)}, ${hm(t.s)}–${hm(t.e)}${sameDay(sd,ed)?"":" ("+shortDate(ed)+")"}`})," · "+SYS_TZ+".");};
  [fDate,fStart,fEnd,fZone].forEach(f=>f.addEventListener("input",upd));upd();
  const body=h("div",{class:"body"},
    h("label",{class:"f"},"Title",fTitle),
    h("div",{class:"row"},h("label",{class:"f"},"Date",fDate),h("label",{class:"f"},"Starts",fStart),h("label",{class:"f"},"Ends",fEnd)),
    h("label",{class:"f"},"Time zone you're entering in",fZone),conv,
    h("div",{class:"f",style:"display:flex;flex-direction:column;gap:6px;font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"},"Colour · "+activePalette().name,sws),
    h("label",{class:"f"},"Notes",fNotes));
  let close;
  const save=()=>{const t=times();if(!t){toast("Add a date, a start and an end time.");return;}
    const next={id:ev?.id||"e_"+uid(),title:fTitle.value.trim()||"Untitled",start:t.s,end:t.e,srcZone:t.tz,colorId,notes:fNotes.value.trim()};
    putEvent(next);close();render();toast(isNew?"Activity added.":"Activity saved.");};
  const del=h("button",{class:"btn danger",onclick:()=>{if(!del.classList.contains("armed")){del.classList.add("armed");del.textContent="Tap again to delete";return;}
    const old=clone(ev);dropEvent(ev.id);close();render();toast("Activity deleted.","Undo",()=>{putEvent(old);render();});}},"Delete");
  const copy=h("button",{class:"btn",onclick:()=>{const src=ev||{title:fTitle.value||"Untitled",colorId,notes:fNotes.value,srcZone:fZone.value,...(()=>{const t=times();return{start:t.s,end:t.e};})()};
    close();setClip({span:"event",label:`"${src.title}"`,items:toItems([src],sod(new Date(src.start)))});}},"Copy");
  const foot=h("footer",{},h("div",{class:"left"},isNew?null:del,isNew?null:copy),h("button",{class:"btn",onclick:()=>close()},"Cancel"),h("button",{class:"btn primary",onclick:save},isNew?"Add activity":"Save"));
  body.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target===fTitle)save();});
  close=openSheet({title:isNew?"New activity":"Edit activity",body,foot});
}

/* ---------- paste plans (text import) ---------- */
const MON3=MONTHS.map(m=>m.slice(0,3).toLowerCase());
function parseTime(hh,mm,ap){let H=+hh,M=mm?+mm:0;if(ap){ap=ap.toLowerCase();if(H===12)H=0;if(ap==="pm")H+=12;}if(H>23||M>59)return null;return H*60+M;}
function parsePlans(text,base,tz){
  let cur=isoDate(base);const weekStart=sow(base);const out=[];
  const colours=S.settings.palettes.flatMap(p=>p.colors);
  for(const raw of text.split(/\r?\n/)){let line=raw.trim().replace(/^[-*•·]\s*/,"");if(!line)continue;const orig=line;let m,wd=null,dated=false;
    if((m=line.match(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*/i))){wd=["mon","tue","wed","thu","fri","sat","sun"].indexOf(m[1].toLowerCase());line=line.slice(m[0].length);}
    if((m=line.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b[,:]?\s*/))){cur=`${m[1]}-${pad(m[2])}-${pad(m[3])}`;line=line.slice(m[0].length);dated=true;}
    else if((m=line.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b[,:]?\s*/))){const y=m[3]?(m[3].length===2?2000+ +m[3]:+m[3]):+cur.slice(0,4);cur=`${y}-${pad(m[2])}-${pad(m[1])}`;line=line.slice(m[0].length);dated=true;}
    else if((m=line.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?\b[,:]?\s*/i))&&MON3.includes(m[2].toLowerCase())){const y=m[3]?+m[3]:+cur.slice(0,4);cur=`${y}-${pad(MON3.indexOf(m[2].toLowerCase())+1)}-${pad(m[1])}`;line=line.slice(m[0].length);dated=true;}
    if(!dated&&wd!=null)cur=isoDate(addDays(weekStart,wd));
    if(!line)continue;/* a date header line */
    m=line.match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?(?:\s*(?:-|–|—|to)\s*(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?)?\s+(.+)$/i);
    if(!m||(!m[2]&&!m[3])){out.push({bad:true,orig});continue;}
    const s=parseTime(m[1],m[2],m[3]||(m[6]&&!m[3]?m[6]:null));let e=m[4]?parseTime(m[4],m[5],m[6]):null;
    if(s==null||(m[4]&&e==null)){out.push({bad:true,orig});continue;}
    let title=m[7].trim();let colorId=activePalette().colors[0]?.id||null;
    const tag=title.match(/\s#([\p{L}\d_-]+)\s*$/u)||title.match(/^#([\p{L}\d_-]+)\s+/u);
    if(tag){const hit=activePalette().colors.find(c=>keyName(c.name)===tag[1].toLowerCase())||colours.find(c=>keyName(c.name)===tag[1].toLowerCase());if(hit){colorId=hit.id;title=title.replace(tag[0]," ").trim();}}
    const st=`${pad(Math.floor(s/60))}:${pad(s%60)}`;const em=e==null?s+60:e;const et=`${pad(Math.floor(em/60)%24)}:${pad(em%60)}`;
    let start=zonedToUtc(cur,st,tz),end=zonedToUtc(cur,et,tz);if(end<=start)end+=DAY;
    out.push({title,colorId,start,end,srcZone:tz,orig});}
  return out;}
function openImport(){
  const ta=h("textarea",{class:"inp",id:"importText",rows:"8",placeholder:"Mon 12/10\n09:00-10:30 Team call #Work\n13:00 Lunch with Ana #Social\nTue\n7pm-8pm Yoga #Health"});
  const base=h("input",{class:"inp",type:"date",id:"importBase",value:isoDate(S.cursor)});
  const zone=h("select",{class:"inp",id:"importZone"},zoneOptions("system"));
  const prev=h("div",{class:"preview"});let parsed=[];
  const upd=()=>{parsed=ta.value.trim()?parsePlans(ta.value,fromIso(base.value||isoDate(S.cursor)),zone.value):[];
    const ok=parsed.filter(p=>!p.bad).length;addBtn.textContent=ok?`Add ${ok} ${ok===1?"activity":"activities"}`:"Add activities";addBtn.disabled=!ok;
    prev.hidden=!parsed.length;prev.replaceChildren(...parsed.map(p=>p.bad?h("div",{class:"bad"},h("b",{text:"skipped"}),h("span",{text:p.orig+" — no time found"})):
      h("div",{},h("b",{text:`${shortDate(new Date(p.start))} ${hm(p.start)}–${hm(p.end)}`}),h("span",{style:`border-left:3px solid ${colourOf(p.colorId).hex};padding-left:6px`,text:p.title}))));};
  const addBtn=h("button",{class:"btn primary",disabled:true,onclick:()=>{const made=[];parsed.filter(p=>!p.bad).forEach(p=>{const ev={id:"e_"+uid(),title:p.title,colorId:p.colorId,start:p.start,end:p.end,srcZone:p.srcZone,notes:""};putEvent(ev);made.push(ev.id);});
    close();render();toast(`Added ${made.length} ${made.length===1?"activity":"activities"}.`,"Undo",()=>{made.forEach(dropEvent);render();});}},"Add activities");
  [ta,base,zone].forEach(f=>f.addEventListener("input",upd));
  const body=h("div",{class:"body"},
    h("p",{class:"hint"},"Paste one activity per line: a time or range, then the title. Start a line with a date (",h("code",{text:"2026-10-12"}),", ",h("code",{text:"12/10"}),", ",h("code",{text:"12 Oct"}),") or a weekday to move to that day. End with ",h("code",{text:"#Colour"})," to pick a colour by name. Preview shows in your time."),
    ta,h("div",{class:"row"},h("label",{class:"f"},"Lines without a date go on",base),h("label",{class:"f"},"Times are in",zone)),prev);
  prev.hidden=true;
  const close=openSheet({title:"Paste plans",body,foot:h("footer",{},h("button",{class:"btn",onclick:()=>close()},"Cancel"),addBtn),wide:true});
}

/* ---------- templates ---------- */
function saveDayTemplate(){const[a,b]=rangeOf("day");const evs=eventsBetween(a.getTime(),b.getTime()).filter(e=>e.start>=a.getTime());
  if(!evs.length){toast("Add some activities to this day first.");return;}
  const name=h("input",{class:"inp",id:"tplName",value:`${WD[(a.getDay()+6)%7]} routine`});
  const save=()=>{S.settings.templates.push({id:"t_"+uid(),name:name.value.trim()||"Untitled template",items:toItems(evs,a)});saveSettings();close();toast("Template saved. Find it under Templates.");};
  const close=openSheet({title:"Save day as template",body:h("div",{class:"body"},h("p",{class:"hint",text:`${evs.length} ${evs.length===1?"activity":"activities"} from ${shortDate(a)}. Use the template to drop the same plan onto any day.`}),h("label",{class:"f"},"Name",name)),
    foot:h("footer",{},h("button",{class:"btn",onclick:()=>close()},"Cancel"),h("button",{class:"btn primary",onclick:save},"Save template"))});}

/* ---------- settings: palettes, zones, templates ---------- */
function openSettings(tab){
  let current=tab;let editId=S.settings.activePaletteId;
  const body=h("div",{class:"body"});
  const TABS=["palettes","zones","templates","sync"];
  const tabBtns=TABS.map(t=>h("button",{role:"tab",onclick:()=>{current=t;draw();}},{palettes:"Colours",zones:"Time zones",templates:"Templates",sync:"Devices & sync"}[t]));
  const tabs=h("div",{class:"tabs",role:"tablist"},tabBtns);
  const draw=()=>{tabBtns.forEach((b,i)=>b.setAttribute("aria-selected",String(TABS[i]===current)));
    body.replaceChildren(...(current==="palettes"?drawPalettes():current==="zones"?drawZones():current==="templates"?drawTemplates():drawSync(draw)));};
  function drawPalettes(){const pals=S.settings.palettes;const p=pals.find(x=>x.id===editId)||pals[0];editId=p.id;
    const chips=h("div",{class:"pchips"},pals.map(x=>h("button",{class:"pchip","aria-pressed":String(x.id===p.id),onclick:()=>{editId=x.id;draw();}},
      h("span",{class:"mini"},x.colors.slice(0,5).map(c=>h("i",{style:`--c:${c.hex}`}))),x.name,x.id===S.settings.activePaletteId?h("span",{class:"badge",text:"In use"}):null)),
      h("button",{class:"btn",onclick:()=>{const np={id:"p_"+uid(),name:p.name+" copy",colors:clone(p.colors)};pals.push(np);editId=np.id;saveSettings();draw();}},"+ New palette"));
    const nameIn=h("input",{class:"inp",id:"palName",value:p.name,oninput:e=>{p.name=e.target.value;saveSettings();render();}});
    const rows=p.colors.map(c=>{const del=h("button",{class:"btn ghost icon danger","aria-label":"Remove "+c.name,onclick:()=>{p.colors=p.colors.filter(x=>x!==c);saveSettings();draw();render();}},"✕");
      return h("div",{class:"li"},h("input",{type:"color",value:c.hex,"aria-label":"Colour for "+c.name,oninput:e=>{c.hex=e.target.value;saveSettings();render();}}),
        h("input",{class:"inp grow",value:c.name,"aria-label":"Colour name",oninput:e=>{c.name=e.target.value;saveSettings();render();}}),h("span",{class:"mono",text:c.hex.toUpperCase()}),del);});
    const use=p.id===S.settings.activePaletteId?h("span",{class:"hint",text:"This palette is in use."}):h("button",{class:"btn primary",onclick:()=>{S.settings.activePaletteId=p.id;saveSettings();draw();render();}},"Use this palette");
    const delP=pals.length>1?h("button",{class:"btn danger",onclick:e=>{const b=e.currentTarget;if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Tap again to delete palette";return;}
      S.settings.palettes=pals.filter(x=>x!==p);if(S.settings.activePaletteId===p.id)S.settings.activePaletteId=S.settings.palettes[0].id;editId=S.settings.activePaletteId;saveSettings();draw();render();}},"Delete palette"):null;
    return[h("p",{class:"hint",text:"Name each colour after what it means to you. A new palette starts as a copy, so its colours stay linked to your activities: switch palettes and everything recolours."}),
      chips,h("label",{class:"f"},"Palette name",nameIn),h("div",{class:"list"},rows),
      h("div",{style:"display:flex;gap:8px;flex-wrap:wrap;align-items:center"},h("button",{class:"btn",onclick:()=>{p.colors.push({id:"c_"+uid(),name:"New colour",hex:"#"+Math.floor(Math.random()*0xAAAAAA+0x222222).toString(16).padStart(6,"0")});saveSettings();draw();}},"+ Add colour"),use,h("span",{style:"flex:1"}),delP)];}
  function drawZones(){let all=[];try{all=Intl.supportedValuesOf("timeZone");}catch{}
    const dl=h("datalist",{id:"tzlist"},all.map(z=>h("option",{value:z})));
    const tzIn=h("input",{class:"inp",id:"zoneTz",list:"tzlist",placeholder:"e.g. America/Mexico_City"});
    const lbIn=h("input",{class:"inp",id:"zoneLabel",placeholder:"e.g. Mum in Mexico"});
    const add=()=>{const tz=tzIn.value.trim();if(!validTz(tz)){toast("That time zone isn't recognised. Pick one from the list, like Europe/Paris.");return;}
      S.settings.zones.push({id:"z_"+uid(),tz,label:lbIn.value.trim()||tz.split("/").pop().replace(/_/g," ")});saveSettings();draw();};
    const now=Date.now();const sysOff=tzOffset(now,SYS_TZ);
    const rows=S.settings.zones.map(z=>{const diff=(tzOffset(now,z.tz)-sysOff)/3600000;const ds=diff===0?"same as you":(diff>0?"+":"")+(Math.round(diff*100)/100)+" h";
      return h("div",{class:"li"},h("input",{class:"inp grow",value:z.label,"aria-label":"Label for "+z.tz,oninput:e=>{z.label=e.target.value;saveSettings();}}),
        h("span",{class:"mono",text:`${z.tz} · ${utcToZoned(now,z.tz).time} now · ${ds}`}),
        h("button",{class:"btn ghost icon danger","aria-label":"Remove "+z.label,onclick:()=>{S.settings.zones=S.settings.zones.filter(x=>x!==z);saveSettings();draw();}},"✕"));});
    return[h("p",{class:"hint",text:`Save the zones you plan in. When adding an activity, type the time as it is there; it's converted to your time (${SYS_TZ}) when saved.`}),
      h("div",{class:"list"},rows.length?rows:h("p",{class:"hint",text:"No zones saved yet."})),
      h("div",{class:"row"},h("label",{class:"f"},"Time zone",tzIn),h("label",{class:"f"},"Label",lbIn)),dl,
      h("div",{},h("button",{class:"btn primary",onclick:add},"Add time zone"))];}
  function drawTemplates(){const ts=S.settings.templates;
    const rows=ts.map(t=>h("div",{class:"li"},h("input",{class:"inp grow",value:t.name,"aria-label":"Template name",oninput:e=>{t.name=e.target.value;saveSettings();}}),
      h("span",{class:"mono",text:t.items.map(i=>`${pad(Math.floor(i.startMin/60))}:${pad(i.startMin%60)} ${i.title}`).slice(0,3).join(" · ")+(t.items.length>3?" …":"")}),
      h("button",{class:"btn primary",onclick:()=>{close();setClip({span:"day",label:`Template "${t.name}"`,items:clone(t.items)});}},"Use"),
      h("button",{class:"btn ghost icon danger","aria-label":"Delete "+t.name,onclick:()=>{S.settings.templates=ts.filter(x=>x!==t);saveSettings();draw();}},"✕")));
    return[h("p",{class:"hint",text:"Templates are day plans you repeat. Open a day, choose Save day as template, then use it to paste the same plan onto any day."}),
      h("div",{class:"list"},rows.length?rows:h("p",{class:"hint",text:"No templates yet."}))];}
  const close=openSheet({title:"Your settings",body,tabs,wide:true});draw();
}


/* ---------- devices & sync ---------- */
function field(label,input){return h("label",{class:"f"},label,input);}
function drawSync(redraw){
  const out=[];
  if(S.sync.cfg){const c=S.sync.cfg;const[cls,txt]=syncLabel();
    out.push(h("div",{class:"syncstate "+cls},h("span",{class:"dot "+cls}),h("div",{},h("b",{text:txt}),h("p",{class:"hint",text:S.sync.error||`Encrypted copy kept in the private repository ${c.owner}/${c.repo}.`}))),
      h("div",{},h("button",{class:"btn",onclick:async e=>{e.currentTarget.disabled=true;await runSync();redraw();}},"Sync now")));
    const code=JSync.linkCode(c);const ta=h("textarea",{class:"inp mono-in",rows:"3",readonly:true,id:"linkCode","data-nofocus":"1"});ta.value=code;
    out.push(h("h3",{class:"sub",text:"Link another device"}),
      h("p",{class:"hint",text:"Install the app on the other device, open Devices & sync there and paste this code. Treat it like a password: anyone with it can read the calendar. Send it to yourself in a private way, such as AirDrop or a note you delete afterwards."}),
      ta,h("div",{},h("button",{class:"btn primary",onclick:()=>{const done=()=>toast("Link code copied.");
        if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(done,()=>{ta.focus();ta.select();});else{ta.focus();ta.select();}}},"Copy link code")));
    const tok=h("input",{class:"inp",type:"password",id:"newToken",autocomplete:"off",placeholder:"github_pat_…"});
    out.push(h("h3",{class:"sub",text:"Access token"}),h("p",{class:"hint",text:"If GitHub says the token expired, make a new one the same way and paste it here. Then copy the new link code to your other devices."}),
      h("div",{class:"inline"},tok,h("button",{class:"btn",onclick:async()=>{const t=tok.value.trim();if(!t)return;const next={...S.sync.cfg,token:t};
        try{await JSync.verify(next);setSyncCfg(next);toast("Token updated.");runSync();redraw();}catch(e){toast(e.message||"That token didn't work.");}}},"Replace token")));
    const un=h("button",{class:"btn danger",onclick:()=>{if(!un.classList.contains("armed")){un.classList.add("armed");un.textContent="Tap again to unlink";return;}
      setSyncCfg(null);toast("This device is unlinked. Its calendar stays here.");redraw();}},"Unlink this device");
    out.push(h("h3",{class:"sub",text:"This device"}),h("p",{class:"hint",text:"Unlinking stops syncing here. The calendar on this device and on your other devices is kept."}),h("div",{},un));
  }else{
    const code=h("textarea",{class:"inp mono-in",rows:"3",id:"pasteCode",placeholder:"JSOURNAL1:…","data-nofocus":"1"});
    const linkBtn=h("button",{class:"btn primary",onclick:async()=>{let cfg;try{cfg=JSync.parseLinkCode(code.value);}catch(e){toast(e.message);return;}
      linkBtn.disabled=true;linkBtn.textContent="Linking…";
      try{await JSync.verify(cfg);setSyncCfg(cfg);await runSync();toast("Linked. This device now syncs.");redraw();}
      catch(e){toast(e.message||"Couldn't link. Check your connection and try again.");linkBtn.disabled=false;linkBtn.textContent="Link this device";}}},"Link this device");
    out.push(h("div",{class:"syncstate"},h("span",{class:"dot"}),h("div",{},h("b",{text:"This calendar is only on this device"}),h("p",{class:"hint",text:"Link your devices so the same calendar shows on your phone and computer. Everything is encrypted before it leaves the device."}))),
      h("h3",{class:"sub",text:"Already set up on another device?"}),h("p",{class:"hint",text:"Paste the link code from that device's Devices & sync page."}),code,h("div",{},linkBtn));
    const owner=h("input",{class:"inp",id:"ghOwner",autocomplete:"off",autocapitalize:"off",placeholder:"your GitHub username"});
    const repo=h("input",{class:"inp",id:"ghRepo",autocomplete:"off",autocapitalize:"off",value:"jsournal-data"});
    const token=h("input",{class:"inp",type:"password",id:"ghToken",autocomplete:"off",placeholder:"github_pat_…"});
    const p1=h("input",{class:"inp",type:"password",id:"pass1",autocomplete:"new-password"});
    const p2=h("input",{class:"inp",type:"password",id:"pass2",autocomplete:"new-password"});
    const go=h("button",{class:"btn primary",onclick:async()=>{
      if(!owner.value.trim()||!repo.value.trim()||!token.value.trim()){toast("Fill in the username, repository and token.");return;}
      if(p1.value.length<10){toast("Use a passphrase of at least 10 characters, like three random words.");return;}
      if(p1.value!==p2.value){toast("The two passphrases don't match.");return;}
      go.disabled=true;go.textContent="Connecting… (takes a few seconds)";
      try{const cfg=await JSync.connect({owner:owner.value,repo:repo.value,token:token.value,passphrase:p1.value,deviceName:deviceName()});
        setSyncCfg(cfg);await runSync();toast(cfg.existing?"Connected to your existing calendar.":"Sync is on. Now link your other device.");redraw();}
      catch(e){toast(e.message||"Couldn't connect. Check the details and try again.");go.disabled=false;go.textContent="Start syncing";}}},"Start syncing");
    out.push(h("h3",{class:"sub",text:"First-time setup"}),
      h("p",{class:"hint"},"Do this once, on one device. You need a private GitHub repository and an access token for it; the setup guide walks through both. ",
        h("a",{href:"https://github.com/settings/personal-access-tokens/new",target:"_blank",rel:"noopener"},"Create a token on GitHub"),"."),
      h("div",{class:"row"},field("GitHub username",owner),field("Private repository",repo)),field("Access token",token),
      h("div",{class:"row"},field("Passphrase",p1),field("Passphrase again",p2)),
      h("p",{class:"hint",text:"The passphrase locks the calendar. It never leaves the device, and nobody can reset it, so write it down somewhere safe."}),h("div",{},go));
  }
  /* backups */
  const file=h("input",{type:"file",accept:"application/json,.json",id:"restoreFile",hidden:true,onchange:async e=>{const f=e.target.files[0];if(!f)return;
    try{const o=JSON.parse(await f.text());if(!o||o.app!=="jsournal-backup")throw 0;const{doc}=JSync.merge(o.doc,toDoc());applyDoc(doc);changed();toast("Backup restored and merged.");}
    catch{toast("That file isn't a J's Ournal backup.");}e.target.value="";}});
  out.push(h("h3",{class:"sub",text:"Backup"}),h("p",{class:"hint",text:"A backup file is not encrypted. Keep it somewhere private. Restoring merges it with what's already here."}),
    h("div",{class:"inline"},h("button",{class:"btn",onclick:downloadBackup},"Download backup"),h("button",{class:"btn",onclick:()=>file.click()},"Restore from backup"),file),
    h("p",{class:"hint ver",text:`App version ${IS_DEV?"dev":APP_VERSION} · device ${deviceName()}`}));
  return out;}
function downloadBackup(){const blob=new Blob([JSON.stringify({app:"jsournal-backup",saved:new Date().toISOString(),doc:toDoc()},null,1)],{type:"application/json"});
  const a=h("a",{href:URL.createObjectURL(blob),download:`jsournal-backup-${isoDate(new Date())}.json`});document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}

/* ---------- install & updates ---------- */
let swReg=null,installEvt=null;
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;renderActions();});
window.addEventListener("appinstalled",()=>{installEvt=null;renderActions();toast("Installed. Open J's Ournal from your apps.");});
function installBtn(){if(isStandalone())return null;
  if(installEvt)return h("button",{class:"btn",onclick:async()=>{installEvt.prompt();try{await installEvt.userChoice;}catch{}installEvt=null;renderActions();}},"Install app");
  if(isIOS())return h("button",{class:"btn",onclick:iosInstallHelp},"Install app");
  return null;}
function iosInstallHelp(){const close=openSheet({title:"Install on iPhone",body:h("div",{class:"body"},
  h("ol",{class:"steps"},h("li",{},"Open this page in ",h("b",{text:"Safari"}),"."),h("li",{},"Tap the ",h("b",{text:"Share"})," button (the square with an arrow)."),
    h("li",{},"Scroll down and tap ",h("b",{text:"Add to Home Screen"}),", then ",h("b",{text:"Add"}),"."),h("li",{},"Open J's Ournal from the home screen and link it in ",h("b",{text:"Devices & sync"}),".")),
  h("p",{class:"hint",text:"The home-screen app keeps its own storage, separate from Safari, so do the linking inside the installed app."})),
  foot:h("footer",{},h("button",{class:"btn primary",onclick:()=>close()},"Got it"))});}
let updateShown=false;
async function checkForUpdate(){if(IS_DEV||location.protocol==="file:")return;
  try{const r=await fetch("version.txt",{cache:"no-store"});if(!r.ok)return;const v=(await r.text()).trim();
    if(!v||v===APP_VERSION)return;if(swReg)swReg.update().catch(()=>{});
    const busy=$("#sheetRoot").childElementCount||S.clip||S.moving||document.querySelector(".ev.moving,.ev.resizing,.col.dragging");
    if(!busy&&document.visibilityState==="visible"){location.reload();return;}
    if(!updateShown){updateShown=true;toast("A new version of J's Ournal is ready.","Update now",()=>location.reload());}}catch{}}

/* ---------- go ---------- */
render();
setInterval(()=>{if(S.view!=="month"&&!$("#sheetRoot").childElementCount&&!document.querySelector(".ev.moving,.ev.resizing,.col.dragging"))render();},60000);
/* sync on open, when coming back to the app, when back online, and every 90 s while open */
runSync();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){runSync();checkForUpdate();}});
window.addEventListener("online",()=>runSync());
setInterval(()=>{if(document.visibilityState==="visible")runSync();},90000);
setInterval(()=>{if(document.visibilityState==="visible")checkForUpdate();},30*60000);
/* offline support + updates */
if("serviceWorker" in navigator&&location.protocol!=="file:"){navigator.serviceWorker.register("sw.js").then(r=>{swReg=r;}).catch(()=>{});}
setTimeout(checkForUpdate,4000);
})();
