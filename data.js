/* data.js — طبقة البيانات: عقد المحوّل {getAll,put,del,clear} بتنفيذين (IndexedDB محلي، وذاكرة للاختبار) + خدمات Core (CRUD، سلة، نسخ احتياطي، زيارات، خطط). الواجهة لا تصل للتخزين إلا عبر Core. استبدال المصدر بسحابي = محوّل جديد بنفس العقد (انظر ARCHITECTURE.md). */

const STORES=['customers','visits','plans','orders','tasks','settings','fields','audit','autobackups'];
const BK=STORES.filter(s=>s!=='autobackups'),SCHEMA=1;
function MemAdapter(){const d={};STORES.forEach(s=>d[s]=new Map());const cp=x=>JSON.parse(JSON.stringify(x));return{
 async getAll(s){return[...d[s].values()].map(cp)},async put(s,o){d[s].set(o.id,cp(o))},async del(s,id){d[s].delete(id)},async clear(s){d[s].clear()}}}
function IdbAdapter(){let p;const open=()=>p||(p=new Promise((res,rej)=>{const r=indexedDB.open('fieldsales',1);
 r.onupgradeneeded=()=>STORES.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})});
 r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
 const tx=async(s,m,f)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction(s,m);const rq=f(t.objectStore(s));
  t.oncomplete=()=>res(rq&&rq.result);t.onerror=t.onabort=()=>rej(t.error)})};
 return{getAll:s=>tx(s,'readonly',o=>o.getAll()),put:(s,x)=>tx(s,'readwrite',o=>o.put(x)),del:(s,id)=>tx(s,'readwrite',o=>o.delete(id)),clear:s=>tx(s,'readwrite',o=>o.clear())}}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const DEF={sectors:['شمال','جنوب','شرق','غرب','وسط'],districts:[],classes:['A','B','C','D'],statuses:['نشط','غير نشط','محتمل','متوقف'],company:'',rep:'',title:'مندوب مبيعات',backupDays:7,lastBackup:null,perDay:12,center:[24.7136,46.6753],midR:4,outcomes:OUT0,cadence:{A:{days:7,w:30},B:{days:14,w:20},C:{days:28,w:10},D:{days:30,w:15}},workdays:[0,1,2,3,4],dayCap:12,inclStop:false,weights:DEFW,orderTh:DEFOT,userName:'المدير',orderSeq:0,reactDays:90};
const dig=s=>String(s??'').replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776);
function Core(a){
 const uid=()=>(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
 const now=()=>new Date().toISOString(),C={};
 C.log=(action,store,rid,note)=>a.put('audit',{id:uid(),at:now(),action,store,rid,note:note||''});
 C.list=async(s,del)=>(await a.getAll(s)).filter(r=>!!r.deletedAt===!!del);
 C.get=async(s,id)=>(await a.getAll(s)).find(r=>r.id===id);
 C.validate=d=>{d.name=String(d.name??'').trim();if(!d.name)return'اسم المحل مطلوب';
  if(d.phone!=null&&d.phone!==''){d.phone=normPhone(d.phone);if(d.phone.length<7||d.phone.length>15)return'رقم الجوال غير صحيح'}
  const lat=d.lat==null||d.lat===''?null:Number(dig(d.lat)),lng=d.lng==null||d.lng===''?null:Number(dig(d.lng));
  if((lat===null)!==(lng===null))return'أدخل خط العرض والطول معاً';
  if(lat!==null&&(!(Math.abs(lat)<=90)||!(Math.abs(lng)<=180)))return'الإحداثيات غير صحيحة';
  d.lat=lat;d.lng=lng;return null};
 C.create=async(s,d,force)=>{d={...d};const e=s==='customers'?C.validate(d):null;if(e)return{err:e};
  if(s==='customers'&&!force&&d.phone){const dup=(await C.list(s)).find(r=>r.phone===d.phone);if(dup)return{err:'duplicate',dup}}
  const r={...d,...(s==='customers'?{source:d.source||'manual'}:{}),id:uid(),createdAt:now(),updatedAt:now()};await a.put(s,r);await C.log('create',s,r.id);return{ok:r}};
 C.update=async(s,id,patch)=>{const o=await C.get(s,id);if(!o)return{err:'السجل غير موجود'};const n={...o,...patch,id,updatedAt:now()};
  const e=s==='customers'?C.validate(n):null;if(e)return{err:e};await a.put(s,n);await C.log('update',s,id);return{ok:n}};
 C.bulk=async(s,ids,patch)=>{for(const id of ids)await C.update(s,id,patch)};
 C.remove=async(s,ids)=>{ids=[].concat(ids);if(ids.length>1)await C.autoBackup('قبل حذف جماعي');
  for(const id of ids){const o=await C.get(s,id);if(o){await a.put(s,{...o,deletedAt:now()});await C.log('delete',s,id)}}return ids.length};
 C.restore=async(s,id)=>{const o=await C.get(s,id);if(!o)return;delete o.deletedAt;o.updatedAt=now();await a.put(s,o);await C.log('restore',s,id)};
 C.purge=async(s,ids)=>{await C.autoBackup('قبل حذف نهائي');for(const id of[].concat(ids)){await a.del(s,id);await C.log('purge',s,id)}};
 C.delField=async id=>{await C.autoBackup('قبل حذف حقل مخصص');await a.del('fields',id);await C.log('delete','fields',id)};
 C.getS=async k=>{const r=await C.get('settings',k);return r?r.value:JSON.parse(JSON.stringify(DEF[k]??null))};
 C.setS=(k,v)=>a.put('settings',{id:k,value:v});
 C.snapshot=async()=>{const data={},counts={};for(const s of BK){data[s]=await a.getAll(s);counts[s]=data[s].length}
  return{app:'fieldsales',schema:SCHEMA,createdAt:now(),counts,checksum:hash(JSON.stringify(data)),data}};
 C.autoBackup=async why=>{const sn=await C.snapshot();await a.put('autobackups',{id:'ab'+Date.now()+Math.random().toString(36).slice(2,5),at:sn.createdAt,why,snap:sn});
  const all=(await a.getAll('autobackups')).sort((x,y)=>y.at.localeCompare(x.at));for(const o of all.slice(3))await a.del('autobackups',o.id);return sn};
 C.exportBackup=async()=>{const sn=await C.snapshot();await C.setS('lastBackup',sn.createdAt);return sn};
 C.check=o=>{if(!o||o.app!=='fieldsales'||!o.data)return'الملف ليس نسخة احتياطية لهذا النظام';
  if(!(o.schema<=SCHEMA))return'النسخة من إصدار أحدث من إصدار النظام';
  for(const s of BK){if(!Array.isArray(o.data[s]))return'بيانات ناقصة: '+s;if(o.counts&&o.counts[s]!==o.data[s].length)return'عدد السجلات غير مطابق: '+s}
  if(hash(JSON.stringify(o.data))!==o.checksum)return'فشل فحص السلامة: الملف تالف أو معدّل';return null};
 C.restoreBackup=async o=>{const e=C.check(o);if(e)return{err:e};const before=await C.autoBackup('قبل الاستعادة');
  try{for(const s of BK){await a.clear(s);for(const r of o.data[s])await a.put(s,r)}}
  catch(x){for(const s of BK){await a.clear(s);for(const r of before.data[s])await a.put(s,r)}return{err:'فشلت الاستعادة وأُعيدت بياناتك كما كانت'}}
  await C.log('restore-backup','all',null,o.createdAt);return{ok:o.counts}};
 C.backupStatus=async()=>{const last=await C.getS('lastBackup'),days=await C.getS('backupDays'),n=(await C.list('customers')).length;
  const age=last?(Date.now()-Date.parse(last))/864e5:null,ch=(await a.getAll('audit')).filter(x=>!last||x.at>last).length;return{last,days,age,changes:ch,due:n>0&&(age===null||age>days||ch>=25)}};
 const FLD={sectors:'sector',districts:'district',classes:'class',statuses:'status'};
 C.usage=async(k,v)=>(await a.getAll('customers')).filter(c=>c[FLD[k]]===v).length;
 C.ensure=async(k,vals)=>{const l=await C.getS(k);let n=0;for(const v of vals)if(v&&!l.includes(v)){l.push(v);n++}if(n)await C.setS(k,l);return n};
 C.removeItem=async(k,v,rep)=>{const n=await C.usage(k,v);if(n&&rep===undefined)return{count:n};
  if(n){if(rep===v)return{err:'البديل يجب أن يختلف'};await C.autoBackup('قبل نقل سجلات بسبب حذف عنصر');for(const c of await a.getAll('customers'))if(c[FLD[k]]===v)await a.put('customers',{...c,[FLD[k]]:rep,updatedAt:now()})}
  await C.setS(k,(await C.getS(k)).filter(x=>x!==v));await C.log('delete-item','settings',k,v+'→'+(rep??''));return{moved:n}};
 C.patchMany=async(list,why)=>{await C.autoBackup(why);const all=new Map((await a.getAll('customers')).map(c=>[c.id,c]));let n=0;
  for(const{id,patch}of list){const c=all.get(id);if(c){await a.put('customers',{...c,...patch,updatedAt:now()});n++}}await C.log('patch-many','customers',null,why+': '+n);return n};
 C.applyImport=async items=>{await C.autoBackup('قبل الاستيراد');const all=new Map((await a.getAll('customers')).map(c=>[c.id,c])),o={added:0,updated:0,skipped:0},V={sectors:new Set(),districts:new Set(),classes:new Set(),statuses:new Set()};
  for(const it of items){const r=it.rec;let n;if(it.kind==='invalid'||it.action==='skip'){o.skipped++;continue}
   if(it.action==='add'){n={...r,id:uid(),createdAt:now(),updatedAt:now(),source:'import'};delete n.warn;o.added++}
   else{const m=all.get(it.match&&it.match.id);if(!m){o.skipped++;continue}n={...m};for(const f of IF)if(!emp(r[f])&&(it.action==='over'||emp(m[f])))n[f]=r[f];n.updatedAt=now();o.updated++}
   for(const[k,f]of Object.entries(FLD))if(n[f])V[k].add(n[f]);all.set(n.id,n);await a.put('customers',n)}
  for(const k in V)await C.ensure(k,[...V[k]]);await C.log('import','customers',null,JSON.stringify(o));return o};
 const chk=(d,oc,date)=>{if(d.nextDate&&(!okDate(d.nextDate)||d.nextDate<date))return'موعد الزيارة القادمة غير صالح أو يسبق تاريخ الزيارة';
  if(oc.post&&!d.nextDate)return'حدد موعد التأجيل في «موعد الزيارة القادمة»';if(oc.follow&&(!okDate(d.followDate)||d.followDate<date))return'حدد موعد المتابعة (لا يسبق تاريخ الزيارة)';return null};
 const mkTask=v=>a.put('tasks',{id:uid(),customerId:v.customerId,visitId:v.id,title:'متابعة بعد زيارة '+v.date,due:v.followDate,status:'open',createdAt:now()});
 const vtasks=async id=>(await a.getAll('tasks')).filter(t=>t.visitId===id);
 C.addVisit=async d=>{const c=await C.get('customers',d.customerId);if(!c||c.deletedAt)return{err:'العميل غير موجود'};const oc=(await C.getS('outcomes')).find(o=>o.name===d.outcome);if(!oc)return{err:'اختر نتيجة الزيارة'};
  const at=d.at||now();if(isNaN(Date.parse(at)))return{err:'وقت غير صالح'};const date=ymd(at),e=chk(d,oc,date);if(e)return{err:e};
  const v={id:uid(),customerId:c.id,at,date,outcome:oc.name,done:!!oc.done,sale:!!oc.sale,follow:!!oc.follow,notes:(d.notes||'').trim(),nextDate:d.nextDate||'',followDate:oc.follow?d.followDate:'',unplanned:!!d.unplanned,planId:d.planId||'',createdAt:now(),updatedAt:now(),history:[]};
  await a.put('visits',v);if(oc.follow)await mkTask(v);await C.log('visit-add','visits',v.id,c.name);return{ok:v}};
 C.editVisit=async(id,p)=>{const v=await C.get('visits',id);if(!v)return{err:'الزيارة غير موجودة'};if(v.cancelled)return{err:'الزيارة ملغاة: استعدها أولاً'};
  const oc=(await C.getS('outcomes')).find(o=>o.name===p.outcome)||(p.outcome===v.outcome?{name:v.outcome,done:v.done,sale:v.sale,follow:v.follow}:null);if(!oc)return{err:'اختر نتيجة الزيارة'};
  const n={...v,outcome:oc.name,done:!!oc.done,sale:!!oc.sale,follow:!!oc.follow,notes:(p.notes??v.notes).trim(),nextDate:p.nextDate??v.nextDate,followDate:oc.follow?(p.followDate??v.followDate):'',at:p.at||v.at};
  if(isNaN(Date.parse(n.at)))return{err:'وقت غير صالح'};n.date=ymd(n.at);const e=chk(n,oc,n.date);if(e)return{err:e};
  const ch={};for(const f of['outcome','notes','nextDate','followDate','at'])if(v[f]!==n[f])ch[f]=[v[f],n[f]];if(!Object.keys(ch).length)return{ok:v};
  n.history=[...(v.history||[]),{at:now(),action:'edit',changes:ch}];n.updatedAt=now();await a.put('visits',n);
  const ts=await vtasks(id),open=ts.find(t=>t.status==='open');
  if(oc.follow){if(open)await a.put('tasks',{...open,due:n.followDate});else if(!ts.some(t=>t.status==='done'))await mkTask(n)}
  else if(open)await a.put('tasks',{...open,status:'cancelled',note:'أُلغيت بتعديل الزيارة'});
  await C.log('visit-edit','visits',id,Object.keys(ch).join());return{ok:n}};
 C.cancelVisit=async(id,reason)=>{const v=await C.get('visits',id);reason=String(reason||'').trim();if(!v||v.cancelled)return{err:'غير ممكن'};if(!reason)return{err:'اكتب سبب الإلغاء'};
  await a.put('visits',{...v,cancelled:true,cancelReason:reason,updatedAt:now(),history:[...(v.history||[]),{at:now(),action:'cancel',changes:{reason:[null,reason]}}]});
  for(const t of await vtasks(id))if(t.status==='open')await a.put('tasks',{...t,status:'cancelled',note:'أُلغيت بإلغاء الزيارة'});await C.log('visit-cancel','visits',id,reason);return{ok:1}};
 C.restoreVisit=async id=>{const v=await C.get('visits',id);if(!v||!v.cancelled)return{err:'غير ممكن'};const r={...v,cancelled:false,updatedAt:now(),history:[...(v.history||[]),{at:now(),action:'restore',changes:{}}]};delete r.cancelReason;await a.put('visits',r);
  for(const t of await vtasks(id))if(t.status==='cancelled'&&t.note==='أُلغيت بإلغاء الزيارة')await a.put('tasks',{...t,status:'open',note:''});await C.log('visit-restore','visits',id);return{ok:1}};
 C.completeTask=async(id,result)=>{const t=await C.get('tasks',id);if(!t||t.status!=='open')return{err:'المهمة غير مفتوحة'};await a.put('tasks',{...t,status:'done',result:String(result||'').trim(),doneAt:now()});if(t.orderId){const o=await C.get('orders',t.orderId);if(o){await tl(o,{kind:'task',note:'إنجاز المتابعة: '+(String(result||'').trim()||'—')});await a.put('orders',o)}}await C.log('task-done','tasks',id);return{ok:1}};
 C.allVisits=()=>a.getAll('visits');C.visitsOf=async id=>(await a.getAll('visits')).filter(v=>v.customerId===id).sort((x,y)=>y.at.localeCompare(x.at));
 C.ctx=async()=>{const[custs,vis,tasks,orders,cad,inclStop,wt]=await Promise.all([C.list('customers'),a.getAll('visits'),a.getAll('tasks'),a.getAll('orders'),C.getS('cadence'),C.getS('inclStop'),C.getS('weights')]),om=new Map();
  orders.filter(o=>!o.deletedAt&&o.status!=='cancelled'&&o.status!=='returned').forEach(o=>{if(!om.has(o.customerId))om.set(o.customerId,[]);om.get(o.customerId).push(o)});return{custs,vm:vmap(vis),vis,tasks,cad,om,inclStop:!!inclStop,W:{...DEFW,...wt}}};
 const keep=(p,ctx,date)=>(p?p.items:[]).filter(it=>it.source==='manual'||(ctx.vm.get(it.customerId)||[]).some(v=>v.date===date));
 C.getPlan=date=>C.get('plans','p'+date);
 C.savePlan=async(date,items,cap)=>{const o=await C.get('plans','p'+date),p={...(o||{id:'p'+date,date,createdAt:now()}),items,cap,updatedAt:now()};delete p.deletedAt;await a.put('plans',p);return p};
 C.planDay=async(date,cap)=>{const ctx=await C.ctx(),kept=keep(await C.getPlan(date),ctx,date),n=cap-kept.length;return C.savePlan(date,[...kept,...(n>0?buildDay(ctx,date,n,new Set(kept.map(i=>i.customerId))):[])],cap)};
 C.planWeek=async(start,cap,wd)=>{const ctx=await C.ctx(),taken=new Set(),rows=[],out=[];
  for(let i=0;i<7;i++){const d=addDays(start,i),old=await C.getPlan(d),kept=keep(old,ctx,d);kept.forEach(x=>taken.add(x.customerId));rows.push({d,old,kept})}
  for(const{d,old,kept}of rows){const on=wd.includes(new Date(d+'T12:00:00').getDay()),n=on?cap-kept.length:0,nw=n>0?buildDay(ctx,d,n,taken):[];nw.forEach(x=>taken.add(x.customerId));
   if(kept.length||nw.length||old)out.push(await C.savePlan(d,[...kept,...nw],cap))}return out};
 C.planAdd=async(date,cid,reason)=>{const p=await C.getPlan(date),items=p?p.items:[];if(items.some(i=>i.customerId===cid))return{err:'العميل في الخطة مسبقاً'};
  items.push({customerId:cid,reason:reason||'أضفته يدوياً',source:'manual'});await C.savePlan(date,items,p?p.cap:await C.getS('dayCap'));return{ok:1}};
 C.planRemove=async(date,cid)=>{const p=await C.getPlan(date);if(!p)return{err:'لا خطة'};if((await a.getAll('visits')).some(v=>!v.cancelled&&v.customerId===cid&&v.date===date))return{err:'سُجلت زيارة لهذا العميل: لا يمكن إزالته من الخطة'};
  await C.savePlan(date,p.items.filter(i=>i.customerId!==cid),p.cap);return{ok:1}};
 C.planMove=async(date,cid,dir)=>{const p=await C.getPlan(date),it=p.items,i=it.findIndex(x=>x.customerId===cid),j=i+dir;if(i<0||j<0||j>=it.length)return;[it[i],it[j]]=[it[j],it[i]];await C.savePlan(date,it,p.cap)};
 const TERM=TERMINAL,byU=async()=>(await C.getS('userName'))||'المدير';
 const tl=async(o,e)=>{o.timeline=[...(o.timeline||[]),{at:now(),loggedAt:now(),by:await byU(),src:'يدوي',...e}];o.updatedAt=now()};
 const closeOT=async(oid,note)=>{for(const t of await a.getAll('tasks'))if(t.orderId===oid&&t.status==='open')await a.put('tasks',{...t,status:'cancelled',note})};
 const lastEv=o=>{const r=[...(o.timeline||[])].reverse();return r.find(e=>e.kind==='stage'&&e.to===o.status)||r.find(e=>e.kind==='stage')};
 C.allOrders=()=>a.getAll('orders');C.allTasks=()=>a.getAll('tasks');
 C.ordersOf=async id=>(await a.getAll('orders')).filter(o=>o.customerId===id).sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
 C.nextOrderNo=async()=>{const all=new Set((await a.getAll('orders')).map(o=>o.no)),p='ORD-'+ymd(new Date()).slice(0,7).replace('-','');let n=await C.getS('orderSeq'),no;do{n++;no=p+'-'+String(n).padStart(4,'0')}while(all.has(no));await C.setS('orderSeq',n);return no};
 C.createOrder=async d=>{const c=await C.get('customers',d.customerId);if(!c||c.deletedAt)return{err:'العميل غير موجود'};const items=normItems(d.items),e=checkItems(items,d.discount);if(e)return{err:e};
  const at=d.at||now();if(isNaN(Date.parse(at)))return{err:'وقت غير صالح'};const date=ymd(at);
  if(d.expectedDate&&(!okDate(d.expectedDate)||d.expectedDate<date))return{err:'تاريخ التسليم المتوقع غير صالح أو يسبق التسجيل'};
  let vid='';if(d.visitId){const v=await C.get('visits',d.visitId);if(!v||v.cancelled||v.customerId!==c.id)return{err:'الزيارة غير صالحة لهذا العميل'};
   if((await a.getAll('orders')).some(o=>o.visitId===v.id&&o.status!=='cancelled'))return{err:'توجد طلبية مرتبطة بهذه الزيارة مسبقاً'};vid=v.id}
  const o={id:uid(),no:await C.nextOrderNo(),customerId:c.id,visitId:vid,date,createdAt:at,items,discount:Number(d.discount)||0,total:calcTotals(items,d.discount).total,notes:String(d.notes||'').trim(),expectedDate:d.expectedDate||'',status:'registered',stalled:false,stalledReason:'',carrier:'',tracking:'',shipDate:'',expectedArrival:'',deliveredAt:'',timeline:[],updatedAt:now()};
  await tl(o,{at,kind:'stage',from:null,to:'registered',note:'تسجيل الطلبية في الرياض'+(vid?' (من نتيجة زيارة)':'')});await a.put('orders',o);await C.log('order-add','orders',o.id,o.no);return{ok:o}};
 C.advanceOrder=async(id,d)=>{const o=await C.get('orders',id);if(!o)return{err:'الطلبية غير موجودة'};if(TERM.includes(o.status))return{err:'الطلبية منتهية ('+stName(o.status)+')'};
  if(d.confirm!==true)return{err:'يلزم تأكيد فعلي لتغيير المرحلة'};const i=stIdx(o.status),nx=STAGES[i+1];if(!nx)return{err:'لا توجد مرحلة تالية'};
  if(d.to&&d.to!==nx.k)return{err:'لا يمكن تخطي المراحل: المرحلة التالية هي «'+nx.n+'»'};
  const at=d.at||now();if(isNaN(Date.parse(at)))return{err:'وقت غير صالح'};if(Date.parse(at)>Date.now()+3e5)return{err:'لا يمكن تسجيل مرحلة بوقت مستقبلي'};
  if(Math.floor(Date.parse(at)/6e4)<Math.floor(Date.parse(lastEv(o).at)/6e4))return{err:'وقت المرحلة يسبق وقت المرحلة السابقة'};
  const n={...o},ex={};if(nx.k==='shipped'){const car=String(d.carrier||'').trim();if(!car)return{err:'اكتب شركة الشحن'};if(d.expectedArrival&&(!okDate(d.expectedArrival)||d.expectedArrival<ymd(at)))return{err:'موعد الوصول المتوقع غير صالح'};
   n.carrier=car;n.tracking=String(d.tracking||'').trim();n.shipDate=ymd(at);n.expectedArrival=d.expectedArrival||'';ex.extra={carrier:car,tracking:n.tracking,expectedArrival:n.expectedArrival}}
  n.status=nx.k;if(nx.k==='delivered'){n.deliveredAt=at;n.stalled=false;n.stalledReason=''}
  await tl(n,{at,kind:'stage',from:o.status,to:nx.k,note:String(d.note||'').trim(),confirmedBy:String(d.confirmedBy||'').trim(),...ex});await a.put('orders',n);
  if(nx.k==='delivered')await closeOT(id,'أُغلقت: سُلّمت الطلبية');await C.log('order-stage','orders',id,o.status+'→'+nx.k);return{ok:n}};
 const endOrder=(kind,st,ok)=>async(id,reason)=>{const o=await C.get('orders',id);reason=String(reason||'').trim();if(!o)return{err:'الطلبية غير موجودة'};if(!ok(o))return{err:kind==='cancel'?'لا يمكن إلغاء طلبية منتهية':'الإرجاع ممكن بعد شحن الطلبية فقط'};if(!reason)return{err:'اكتب السبب'};
  const n={...o,status:st};await tl(n,{kind,from:o.status,to:st,reason,note:kind==='cancel'?'إلغاء الطلبية':'إرجاع الطلبية'});await a.put('orders',n);await closeOT(id,'أُغلقت لانتهاء الطلبية ('+stName(st)+')');await C.log('order-'+kind,'orders',id,reason);return{ok:n}};
 C.cancelOrder=endOrder('cancel','cancelled',o=>!TERM.includes(o.status));
 C.returnOrder=endOrder('return','returned',o=>o.status!=='cancelled'&&o.status!=='returned'&&stIdx(o.status)>=5);
 C.rollbackOrder=async(id,reason)=>{const o=await C.get('orders',id);reason=String(reason||'').trim();if(!o)return{err:'الطلبية غير موجودة'};if(TERM.includes(o.status)||stIdx(o.status)<=0)return{err:'لا يمكن التراجع'};if(!reason)return{err:'اكتب سبب التصحيح'};
  const to=STAGES[stIdx(o.status)-1].k,n={...o,status:to};await tl(n,{kind:'rollback',from:o.status,to,reason,note:'تصحيح: عودة إلى «'+stName(to)+'»'});await a.put('orders',n);await C.log('order-rollback','orders',id,reason);return{ok:n}};
 C.setStalled=async(id,on,reason)=>{const o=await C.get('orders',id);reason=String(reason||'').trim();if(!o||TERM.includes(o.status))return{err:'غير ممكن'};if(on&&!reason)return{err:'اكتب سبب التعثر'};
  const n={...o,stalled:!!on,stalledReason:on?reason:''};await tl(n,{kind:'flag',note:on?'تعليم الطلبية متعثرة':'رفع التعثر'+(reason?': '+reason:''),reason:on?reason:''});await a.put('orders',n);return{ok:n}};
 C.addOrderNote=async(id,note)=>{const o=await C.get('orders',id);note=String(note||'').trim();if(!o)return{err:'الطلبية غير موجودة'};if(!note)return{err:'اكتب الملاحظة'};await tl(o,{kind:'note',note});await a.put('orders',o);return{ok:o}};
 C.editOrder=async(id,p)=>{const o=await C.get('orders',id);if(!o)return{err:'الطلبية غير موجودة'};if(TERM.includes(o.status))return{err:'الطلبية منتهية: أضف ملاحظة فقط'};const n={...o},ch={};
  if(p.items!==undefined||p.discount!==undefined){if(stIdx(o.status)>=5)return{err:'لا يمكن تعديل المنتجات بعد الشحن: أضف ملاحظة'};const items=normItems(p.items??o.items),disc=p.discount===undefined?o.discount:Number(p.discount)||0,e=checkItems(items,disc);if(e)return{err:e};
   if(JSON.stringify(items)!==JSON.stringify(o.items)||disc!==o.discount){ch.items={prev:{items:o.items,discount:o.discount}};n.items=items;n.discount=disc;n.total=calcTotals(items,disc).total;ch.total=[o.total,n.total]}}
  if(p.notes!==undefined&&String(p.notes).trim()!==o.notes){n.notes=String(p.notes).trim();ch.notes=[o.notes,n.notes]}
  if(p.expectedDate!==undefined&&p.expectedDate!==o.expectedDate){if(p.expectedDate&&(!okDate(p.expectedDate)||p.expectedDate<o.date))return{err:'تاريخ التسليم المتوقع غير صالح'};n.expectedDate=p.expectedDate;ch.expectedDate=[o.expectedDate,p.expectedDate]}
  if(!Object.keys(ch).length)return{ok:o};await tl(n,{kind:'edit',note:String(p.note||'').trim(),changes:ch});await a.put('orders',n);await C.log('order-edit','orders',id);return{ok:n}};
 C.addOrderTask=async(oid,d)=>{const o=await C.get('orders',oid),title=String(d.title||'').trim();if(!o)return{err:'الطلبية غير موجودة'};if(TERM.includes(o.status))return{err:'الطلبية منتهية'};if(!okDate(d.due))return{err:'حدد موعد المتابعة'};if(!title)return{err:'اكتب عنوان المهمة'};
  if(d.key&&(await a.getAll('tasks')).some(t=>t.orderId===oid&&t.key===d.key&&t.status==='open'))return{err:'توجد مهمة متابعة مفتوحة لهذا التنبيه'};
  const t={id:uid(),customerId:o.customerId,orderId:oid,key:d.key||'',title,due:d.due,status:'open',createdAt:now()};await a.put('tasks',t);await tl(o,{kind:'task',note:'مهمة متابعة: '+title+' (موعد '+d.due+')'});await a.put('orders',o);return{ok:t}};
 C.orderAlerts=async()=>{const th=await C.getS('orderTh'),t=ymd(new Date());return(await a.getAll('orders')).map(o=>({o,al:orderAlerts(o,t,th)})).filter(x=>x.al.length)};
 C.salesWithoutOrder=async()=>{const os=await a.getAll('orders'),has=new Set(os.filter(o=>o.status!=='cancelled').map(o=>o.visitId));return(await a.getAll('visits')).filter(v=>v.sale&&!v.cancelled&&!has.has(v.id)).sort((x,y)=>y.at.localeCompare(x.at))};
 C.reportRaw=async()=>{const[custs,visits,orders,tasks,cad,th,rd]=await Promise.all([C.list('customers'),a.getAll('visits'),a.getAll('orders'),a.getAll('tasks'),C.getS('cadence'),C.getS('orderTh'),C.getS('reactDays')]);return{custs,visits,orders,tasks,cad,th:{...DEFOT,...th},reactDays:rd||90}};
 C.autoList=async()=>(await a.getAll('autobackups')).sort((x,y)=>y.at.localeCompare(x.at));
 return C}
