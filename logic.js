/* logic.js — منطق صرف بلا تخزين ولا واجهة: قراءة CSV/XLSX، كشف التكرار، الجغرافيا والتجميع، الاستحقاق والأولويات وبناء الخطة. قابل للاختبار وللنقل كما هو إلى أي بيئة. */
const rad=Math.PI/180,dist=(a,b)=>{const x=(b[1]-a[1])*rad*Math.cos((a[0]+b[0])/2*rad),y=(b[0]-a[0])*rad;return Math.hypot(x,y)*6371000};
const unx=s=>s.replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const normPhone=p=>{p=String(p??'').replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776).replace(/\D/g,'');if(/^9665\d{8}$/.test(p))p='0'+p.slice(3);else if(/^5\d{8}$/.test(p))p='0'+p;return p};
const nn=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]/gu,'');
function parseCSV(t){t=t.replace(/^\uFEFF/,'');const l=t.split(/\r?\n/)[0],cnt=c=>l.split(c).length-1,sep=[',',';','\t'].reduce((b,c)=>cnt(c)>cnt(b)?c:b);
 const rows=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"')q=true;else if(c===sep){r.push(f);f=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';if(r.some(x=>x.trim()))rows.push(r);r=[]}else f+=c}
 r.push(f);if(r.some(x=>x.trim()))rows.push(r);return rows}
async function xlsxRows(buf){const u=new Uint8Array(buf),dv=new DataView(buf),td=new TextDecoder();let e=u.length-22;
 while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw Error('ملف Excel غير صالح');
 const n=dv.getUint16(e+10,true),files={};let p=dv.getUint32(e+16,true);
 for(let i=0;i<n;i++){const nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true);
  files[td.decode(u.subarray(p+46,p+46+nl))]={m:dv.getUint16(p+10,true),cs:dv.getUint32(p+20,true),lo:dv.getUint32(p+42,true)};p+=46+nl+xl+cl}
 const read=async name=>{const f=files[name];if(!f)return null;const s=f.lo+30+dv.getUint16(f.lo+26,true)+dv.getUint16(f.lo+28,true),d=u.subarray(s,s+f.cs);
  if(f.m===0)return td.decode(d);const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(d);w.close();return td.decode(await new Response(ds.readable).arrayBuffer())};
 const ss=[],sx=await read('xl/sharedStrings.xml');
 if(sx)for(const m of sx.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g))ss.push(unx([...(m[1]||'').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
 const names=Object.keys(files).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a,b)=>parseInt(a.match(/\d+/g).pop())-parseInt(b.match(/\d+/g).pop()));
 if(!names.length)throw Error('لا توجد ورقة بيانات');const xml=await read(names[0]),rows=[];
 for(const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)){const row=[];
  for(const cm of(rm[1]||'').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const at=cm[1],ref=(at.match(/\br="([A-Z]+)\d+"/)||[])[1],t=(at.match(/\bt="(\w+)"/)||[])[1],b=cm[2]||'',vm=b.match(/<v>([\s\S]*?)<\/v>/);let v='';
   if(t==='s')v=ss[+vm[1]]??'';else if(t==='inlineStr')v=unx([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));else if(vm)v=unx(vm[1]);
   if(ref){let ci=0;for(const ch of ref)ci=ci*26+ch.charCodeAt(0)-64;row[ci-1]=v}else row.push(v)}
  const r=Array.from(row,x=>x==null?'':String(x));if(r.some(x=>x.trim()))rows.push(r)}
 return rows}
const COLS={name:['اسم المحل','المحل','اسم العميل','العميل','الاسم','name','shop','customer'],code:['رقم العميل','كود العميل','كود','الرقم','code','id','customer id'],phone:['الجوال','جوال','رقم الجوال','الهاتف','هاتف','رقم الهاتف','موبايل','phone','mobile','tel'],sector:['القطاع','المنطقة','sector','region'],district:['الحي','district','neighborhood'],address:['العنوان','address'],lat:['خط العرض','العرض','lat','latitude'],lng:['خط الطول','الطول','lng','lon','long','longitude'],link:['رابط الخريطة','رابط','الموقع','map','link','url','location'],class:['التصنيف','الفئة','class','category'],status:['الحالة','status'],notes:['ملاحظات','notes','note']};
const FN={name:'اسم المحل',code:'رقم العميل',phone:'الجوال',sector:'القطاع',district:'الحي',address:'العنوان',lat:'خط العرض',lng:'خط الطول',link:'رابط الخريطة',class:'التصنيف',status:'الحالة',notes:'ملاحظات'};
const nh=s=>String(s||'').trim().toLowerCase().replace(/[\s_]+/g,' ');
function mapCols(h){const m={},used=new Set();h=h.map(nh);
 for(const[f,al]of Object.entries(COLS)){const i=h.findIndex((x,j)=>!used.has(j)&&al.includes(x));if(i>=0){m[f]=i;used.add(i)}}
 for(const[f,al]of Object.entries(COLS)){if(m[f]!=null)continue;const i=h.findIndex((x,j)=>!used.has(j)&&x&&al.some(a=>a.length>3&&x.includes(a)));if(i>=0){m[f]=i;used.add(i)}}return m}
function linkLatLng(s){s=String(s||'').trim();const m=s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)||s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)||s.match(/^(-?\d+\.\d+)\s*[,،]\s*(-?\d+\.\d+)$/);return m?[+m[1],+m[2]]:null}
const IF=['name','code','phone','sector','district','address','lat','lng','class','status','notes'],emp=v=>v===''||v==null;
function buildRec(row,map){const g=f=>map[f]==null?'':String(row[map[f]]??'').trim(),r={name:g('name'),code:g('code'),phone:g('phone'),sector:g('sector'),district:g('district'),address:g('address'),class:g('class'),status:g('status'),notes:g('notes')};
 let lat=g('lat'),lng=g('lng');
 if(!lat&&!lng&&g('link')){const ll=linkLatLng(g('link'));if(ll){lat=ll[0];lng=ll[1]}else r.warn='رابط الخريطة بلا إحداثيات (الروابط المختصرة لا تُحلّ دون إنترنت)'}
 const fx=v=>String(v).replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[٫,]/g,'.');r.lat=lat===''?'':fx(lat);r.lng=lng===''?'':fx(lng);return r}
function analyze(rows,map,existing,validate){const ex={code:new Map(),phone:new Map(),name:new Map()},seen={code:new Map(),phone:new Map(),name:new Map()},items=[];
 for(const c of existing){if(c.code)ex.code.set(String(c.code).trim(),c);if(c.phone)ex.phone.set(c.phone,c);const k=nn(c.name);if(!ex.name.has(k))ex.name.set(k,[]);ex.name.get(k).push(c)}
 const near=(a,b)=>!a.lat||!b.lat||dist([a.lat,a.lng],[b.lat,b.lng])<200||(a.district&&a.district===b.district);
 rows.forEach((row,i)=>{const rec=buildRec(row,map),it={i:i+2,rec,kind:'new',action:'add'},e=validate(rec);
  if(e){it.kind='invalid';it.why=e;it.action='skip';items.push(it);return}
  let m=rec.code&&ex.code.get(rec.code),why='رقم العميل';if(!m&&rec.phone){m=ex.phone.get(rec.phone);why='الجوال'}
  if(m){it.kind='exact';it.match=m;it.why=why}
  else{const sim=(ex.name.get(nn(rec.name))||[]).find(c=>near(rec,c));if(sim){it.kind='similar';it.match=sim;it.why='الاسم'}}
  if(it.match){it.action='skip';it.diff={};for(const f of IF)if(!emp(rec[f])&&String(it.match[f]??'')!==String(rec[f]))it.diff[f]=[it.match[f],rec[f]]}
  else{const k=nn(rec.name),dup=[['code',rec.code],['phone',rec.phone]].find(([t,v])=>v&&seen[t].has(v)),nd=(seen.name.get(k)||[]).find(o=>near(rec,o.rec));
   if(dup||nd){it.kind='filedup';it.action='skip';it.why='مكرر داخل الملف (سطر '+(dup?seen[dup[0]].get(dup[1]):nd.i)+')'}}
  if(rec.code&&!seen.code.has(rec.code))seen.code.set(rec.code,it.i);if(rec.phone&&!seen.phone.has(rec.phone))seen.phone.set(rec.phone,it.i);
  const k=nn(rec.name);if(!seen.name.has(k))seen.name.set(k,[]);seen.name.get(k).push(it);items.push(it)});return items}
function sectorFor(lat,lng,c,mid){if(dist([lat,lng],c)<mid*1000)return'وسط';const dx=(lng-c[1])*Math.cos(c[0]*rad),dy=lat-c[0];return Math.abs(dy)>=Math.abs(dx)?(dy>0?'شمال':'جنوب'):(dx>0?'شرق':'غرب')}
const P2=c=>[c.lat,c.lng];
function order(list,start){const rest=[...list];if(!rest.length)return[];const cen=[rest.reduce((s,p)=>s+p.lat,0)/rest.length,rest.reduce((s,p)=>s+p.lng,0)/rest.length],
 cur=start?rest.reduce((b,p)=>dist(P2(p),start)<dist(P2(b),start)?p:b):rest.reduce((b,p)=>dist(P2(p),cen)>dist(P2(b),cen)?p:b),out=[cur];rest.splice(rest.indexOf(cur),1);
 let c=cur;while(rest.length){let bi=0;rest.forEach((p,i)=>{if(dist(P2(p),P2(c))<dist(P2(rest[bi]),P2(c)))bi=i});c=rest.splice(bi,1)[0];out.push(c)}return out}
const pathKm=l=>l.slice(1).reduce((s,p,i)=>s+dist(P2(l[i]),P2(p)),0)/1000;
function cluster(pts,per,start){const n=pts.length;if(!n)return[];const k=Math.ceil(n/per),P=pts.map(P2),cen=[P.reduce((s,p)=>s+p[0],0)/n,P.reduce((s,p)=>s+p[1],0)/n];
 let far=0;P.forEach((p,i)=>{if(dist(p,cen)>dist(P[far],cen))far=i});const seeds=[P[far]];
 while(seeds.length<k){let bi=0,bd=-1;P.forEach((p,i)=>{const d=Math.min(...seeds.map(s=>dist(p,s)));if(d>bd){bd=d;bi=i}});seeds.push(P[bi])}
 let cs=seeds,g;for(let it=0;it<12;it++){const pr=[];P.forEach((p,i)=>cs.forEach((c,j)=>pr.push([dist(p,c),i,j])));pr.sort((a,b)=>a[0]-b[0]);
  g=cs.map(()=>[]);const done=new Array(n).fill(false);for(const[,i,j]of pr)if(!done[i]&&g[j].length<per){g[j].push(i);done[i]=true}
  cs=g.map((m,j)=>m.length?[m.reduce((s,i)=>s+P[i][0],0)/m.length,m.reduce((s,i)=>s+P[i][1],0)/m.length]:cs[j])}
 return g.map((m,j)=>({m,a:Math.atan2(cs[j][0]-cen[0],cs[j][1]-cen[1])})).filter(x=>x.m.length).sort((x,y)=>x.a-y.a).map(x=>order(x.m.map(i=>pts[i]),start))}
function routeUrls(list){const out=[];for(let i=0;i<list.length;i+=10){const g=list.slice(i,i+10).map(c=>c.lat+','+c.lng),w=g.slice(0,-1);
 out.push('https://www.google.com/maps/dir/?api=1&travelmode=driving'+(i?'&origin='+list[i-1].lat+','+list[i-1].lng:'')+'&destination='+g[g.length-1]+(w.length?'&waypoints='+w.join('%7C'):''))}return out}
const gmUrl=c=>`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
const OUT0=[{name:'تمت الزيارة',done:1},{name:'طلبية جديدة',done:1,sale:1},{name:'يحتاج إلى متابعة',done:1,follow:1},{name:'العميل مغلق'},{name:'العميل غير موجود'},{name:'رفض الطلب',done:1},{name:'تأجيل الزيارة',post:1}];
const ymd=d=>{d=d instanceof Date?d:new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const dbt=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const okDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!isNaN(new Date(s+'T12:00:00'));
function vmap(visits){const m=new Map();for(const v of visits){if(v.cancelled||v.deletedAt)continue;if(!m.has(v.customerId))m.set(v.customerId,[]);m.get(v.customerId).push(v)}m.forEach(l=>l.sort((x,y)=>y.at.localeCompare(x.at)));return m}
const cadDays=(c,cad)=>c.freq>0?c.freq:((cad&&cad[c.class])||{days:28}).days;
function dueInfo(c,vs,cad,today){vs=vs||[];const days=cadDays(c,cad),done=vs.find(v=>v.done),last=vs[0];let due,kind;
 if(last&&last.nextDate){due=last.nextDate;kind='scheduled'}else if(done){due=addDays(done.date,days);kind='cycle'}else if(last){due=last.date;kind='retry'}else{due=today;kind='never'}
 return{due,kind,days,today,late:Math.max(0,dbt(due,today)),lastDone:done?done.date:null,sinceDone:done?dbt(done.date,today):null}}
const ordInfo=(l,today)=>{if(!l||!l.length)return null;const last=l.map(o=>o.date||ymd(o.createdAt)).sort().pop();return{last,count:l.length,days:dbt(last,today)}};
const DEFW={late:40,never:25,cls:1,sales:15,orderAge:15,outcomes:10,follow:40,near:3};
const ordVal=(l,date)=>(l||[]).reduce((s,o)=>{const d=o.date||ymd(o.createdAt);return d<=date&&d>=addDays(date,-180)?s+(+o.total||0):s},0);
function scoreOf(c,inf,vs,cad,oi,task,W,val,maxVal){W=W||DEFW;const R=[],cl=(cad&&cad[c.class])||{w:10};let s=cl.w*W.cls;if(c.class)R.push('تصنيف '+c.class);
 if(inf.kind==='never'){s+=W.never;R.push('لم تُزَر بعد')}
 else if(inf.late>0){s+=Math.min(1.5,inf.late/Math.max(1,inf.days))*W.late+W.late*.3;R.push('متأخر '+inf.late+' يوماً عن '+(inf.kind==='scheduled'?'موعد محدد':'دورية '+inf.days+' يوماً'))}
 else{s+=W.late*.3;R.push('موعده اليوم')}
 if(task){s+=W.follow;R.push('متابعة مستحقة')}
 const rc=vs.filter(v=>v.done).slice(0,5);if(rc.length){const n=rc.filter(v=>v.sale).length;s+=n/rc.length*W.outcomes;R.push('بيع في '+n+' من آخر '+rc.length+' زيارات')}
 if(inf.kind==='retry'){s+=W.outcomes*.5;R.push('زيارة سابقة لم تكتمل (مغلق/غير موجود)')}
 if(oi){s+=Math.min(1,oi.days/inf.days)*W.orderAge;R.push('آخر طلبية قبل '+oi.days+' يوماً')}
 if(val>0&&maxVal>0){s+=W.sales*val/maxVal;R.push('مشتريات 180 يوماً: '+Math.round(val))}
 if(inf.sinceDone!=null)R.push('آخر زيارة قبل '+inf.sinceDone+' يوماً');return{s,reason:R.join(' · ')}}
function candidates(ctx,date,taken){const out=[],tk=new Map(),W=ctx.W||DEFW;ctx.tasks.filter(t=>t.status==='open'&&t.due<=date).forEach(t=>tk.set(t.customerId,t));
 const vals=new Map();let mx=0;ctx.om.forEach((l,id)=>{const v=ordVal(l,date);vals.set(id,v);if(v>mx)mx=v});
 for(const c of ctx.custs){if(taken.has(c.id))continue;if(c.status==='متوقف'&&!ctx.inclStop&&!tk.has(c.id))continue;const vs=ctx.vm.get(c.id)||[];if(vs.some(v=>v.date===date&&v.done))continue;
  const inf=dueInfo(c,vs,ctx.cad,date);if(inf.due>date&&!tk.has(c.id))continue;const{s,reason}=scoreOf(c,inf,vs,ctx.cad,ordInfo(ctx.om.get(c.id),date),tk.get(c.id),W,vals.get(c.id),mx);
  out.push({c,score:s,reason,src:tk.has(c.id)?'followup':'auto'})}return out.sort((a,b)=>b.score-a.score)}
function pickDay(cands,cap,k){k=k??3;const pool=cands.slice(0,cap*4),first=pool.find(x=>x.c.lat!=null);if(!first)return pool.slice(0,cap);const sel=[first],rest=pool.filter(x=>x!==first);
 while(sel.length<cap&&rest.length){const L=sel.filter(x=>x.c.lat!=null),cen=[L.reduce((s,x)=>s+x.c.lat,0)/L.length,L.reduce((s,x)=>s+x.c.lng,0)/L.length];let bi=0,bv=-1e9;
  rest.forEach((x,i)=>{const km=x.c.lat!=null?dist([x.c.lat,x.c.lng],cen)/1000:15,v=x.score-k*km;if(v>bv){bv=v;bi=i}});sel.push(rest.splice(bi,1)[0])}return sel}
function buildDay(ctx,date,cap,taken,start){const sel=pickDay(candidates(ctx,date,taken),cap,(ctx.W||DEFW).near),loc=sel.filter(x=>x.c.lat!=null),no=sel.filter(x=>x.c.lat==null);
 const cen=loc.length?[loc.reduce((s,x)=>s+x.c.lat,0)/loc.length,loc.reduce((s,x)=>s+x.c.lng,0)/loc.length]:null;
 return[...order(loc.map(x=>({...x.c,_x:x})),start).map(p=>p._x),...no].map(x=>({customerId:x.c.id,source:x.src,reason:x.reason+(cen&&x.c.lat!=null?' · يبعد '+(dist([x.c.lat,x.c.lng],cen)/1000).toFixed(1)+' كم عن مركز مسار اليوم':(x.c.lat==null?' · بلا موقع':''))}))}
function dayStats(items,vm,date){let processed=0,done=0,sold=0,nb=0;for(const it of items){const v=(vm.get(it.customerId)||[]).find(v=>v.date===date);if(!v)continue;processed++;if(v.done){done++;v.sale?sold++:nb++}}
 const planned=items.length;return{planned,processed,done,sold,notBought:nb,remaining:planned-processed,pct:planned?Math.round(processed/planned*100):null}}
function avgDaily(visits,today){const from=addDays(today,-14),by={};visits.filter(v=>!v.cancelled&&v.done&&v.date>=from&&v.date<=today).forEach(v=>by[v.date]=(by[v.date]||0)+1);const k=Object.keys(by);return k.length?k.reduce((s,d)=>s+by[d],0)/k.length:null}

/* ---------- المرحلة 4: الطلبيات (منطق صرف) ---------- */
const STAGES=[{k:'registered',n:'سُجّلت في الرياض'},{k:'sent',n:'أُرسلت إلى مستودع جدة'},{k:'wh_confirmed',n:'استلام المستودع مؤكد'},{k:'preparing',n:'قيد التجهيز'},{k:'ready',n:'جاهزة للشحن'},{k:'shipped',n:'شُحنت من جدة'},{k:'arrived',n:'وصلت الرياض'},{k:'out',n:'خرجت للتسليم'},{k:'delivered',n:'سُلّمت للعميل'}];
const ACT=['','إرسال الطلبية إلى مستودع جدة','استلام المستودع للطلبية','بدء تجهيز الطلبية','جاهزية الطلبية للشحن','شحن الطلبية من جدة إلى الرياض','وصول الشحنة إلى الرياض','خروج الطلبية للتسليم','تسليم الطلبية للعميل'];
const TERMINAL=['delivered','cancelled','returned'],DEFOT={send:1,confirm:1,prep:3,transit:3,deliver:1};
const stIdx=k=>STAGES.findIndex(s=>s.k===k),stName=k=>({cancelled:'ملغاة',returned:'مرتجعة'}[k]||(STAGES[stIdx(k)]||{}).n||k||'—');
const round2=x=>Math.round(x*100)/100;
function calcTotals(items,discount){let sub=0,ld=0;for(const i of items){sub+=i.qty*i.price;ld+=i.discount||0}const od=Number(discount)||0;return{sub:round2(sub),lineDisc:round2(ld),discount:od,total:round2(sub-ld-od)}}
function checkItems(items,discount){if(!Array.isArray(items)||!items.length)return'أضف بنداً واحداً على الأقل';
 for(const i of items){if(!String(i.name||'').trim())return'اسم المنتج مطلوب في كل بند';if(!(i.qty>0))return'الكمية يجب أن تكون أكبر من صفر';if(!(i.price>=0))return'سعر الوحدة غير صالح';if(!((i.discount||0)>=0)||(i.discount||0)>i.qty*i.price)return'خصم البند غير صالح'}
 if(!((Number(discount)||0)>=0))return'الخصم غير صالح';if(calcTotals(items,discount).total<0)return'الخصم أكبر من إجمالي الطلبية';return null}
const normItems=items=>(items||[]).map(i=>({name:String(i.name||'').trim(),qty:Number(i.qty),price:Number(i.price),discount:Number(i.discount)||0}));
function orderAlerts(o,today,th){th={...DEFOT,...th};const out=[];if(TERMINAL.includes(o.status))return out;
 const last=k=>{const e=[...(o.timeline||[])].reverse().find(e=>e.to===k&&(e.kind==='stage'||e.kind==='rollback'));return e?ymd(e.at):null},age=k=>{const d=last(k);return d?dbt(d,today):0},i=stIdx(o.status),A=(key,text)=>out.push({key,text});
 if(o.status==='registered'&&age('registered')>th.send)A('notsent','لم تُرسل إلى مستودع جدة منذ '+age('registered')+' يوم');
 if(o.status==='sent'&&age('sent')>th.confirm)A('unconfirmed','لم يؤكد المستودع الاستلام منذ '+age('sent')+' يوم');
 if(i>=2&&i<=4&&age('wh_confirmed')>th.prep)A('prep_late','متأخرة في التجهيز: '+age('wh_confirmed')+' يوم منذ تأكيد المستودع');
 if(o.status==='shipped'){if(o.expectedArrival){if(today>o.expectedArrival)A('ship_late','تجاوزت موعد وصول الشحنة المتوقع ('+o.expectedArrival+')')}else if(age('shipped')>th.transit)A('ship_late','شُحنت منذ '+age('shipped')+' يوم ولم تصل (لا موعد وصول مسجّل)')}
 if((o.status==='arrived'||o.status==='out')&&age('arrived')>th.deliver)A('undelivered','وصلت إلى الرياض ولم تُسلّم منذ '+age('arrived')+' يوم');
 if(o.expectedDate&&today>o.expectedDate)A('overdue','تجاوزت موعد التسليم المتوقع ('+o.expectedDate+')');
 if(o.stalled)A('stalled','متعثرة: '+(o.stalledReason||''));return out}
