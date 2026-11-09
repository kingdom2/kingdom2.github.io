/* xlsx.js — كاتب ملفات Excel (XLSX) حقيقية بلا مكتبات: أرقام وتواريخ فعلية وصيغ مجاميع وفلتر وتجميد وRTL. */
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zipStore(files){const te=new TextEncoder(),parts=[],cd=[];let off=0;const dt=0x58A1,dd=0x5821;
 const u16=n=>[n&255,(n>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
 for(const f of files){const nm=te.encode(f.name),d=typeof f.data==='string'?te.encode(f.data):f.data,c=crc32(d);
  const lh=new Uint8Array([0x50,0x4b,3,4,20,0,0,8,0,0,...u16(dt),...u16(dd),...u32(c),...u32(d.length),...u32(d.length),...u16(nm.length),0,0]);
  parts.push(lh,nm,d);cd.push({nm,c,len:d.length,off});off+=lh.length+nm.length+d.length}
 const cstart=off;for(const e of cd){const h=new Uint8Array([0x50,0x4b,1,2,20,0,20,0,0,8,0,0,...u16(dt),...u16(dd),...u32(e.c),...u32(e.len),...u32(e.len),...u16(e.nm.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(e.off)]);parts.push(h,e.nm);off+=h.length+e.nm.length}
 const end=new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(cd.length),...u16(cd.length),...u32(off-cstart),...u32(cstart),0,0]);parts.push(end);
 const out=new Uint8Array(off+end.length);let p=0;for(const x of parts){out.set(x,p);p+=x.length}return out}
const xe=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const colL=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
const ST={def:0,head:1,title:2,money:3,int:4,pct:5,date:6,dec1:7,text:8,bold:9,gray:10,moneyT:11,intT:12,dec:13};
const FMTST={money:ST.money,int:ST.int,pct:ST.pct,date:ST.date,dec1:ST.dec1,dec:ST.dec,num:ST.dec,text:ST.text};
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s),serial=s=>Math.round((Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))-Date.UTC(1899,11,30))/864e5);
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00&quot; ر.س&quot;"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/><numFmt numFmtId="166" formatCode="#,##0.0"/><numFmt numFmtId="167" formatCode="yyyy\\-mm\\-dd"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF5B6B66"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC5D0CC"/></left><right style="thin"><color rgb="FFC5D0CC"/></right><top style="thin"><color rgb="FFC5D0CC"/></top><bottom style="thin"><color rgb="FFC5D0CC"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="3" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function cellXml(r,c,v,s,f){const ref=colL(c)+r;if(f!=null)return`<c r="${ref}" s="${s}"><f>${xe(f)}</f><v>${v??0}</v></c>`;
 if(v==null||v==='')return`<c r="${ref}" s="${s}"/>`;
 if(typeof v==='number'&&isFinite(v))return`<c r="${ref}" s="${s}"><v>${v}</v></c>`;
 return`<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xe(v)}</t></is></c>`}
function sheetXml(sh,meta){const rows=[],W=[];let r=1;const put=(c,w)=>{W[c]=Math.max(W[c]||8,Math.min(60,w))};
 const addRow=cells=>{rows.push(`<row r="${r}">${cells.join('')}</row>`);r++};
 addRow([cellXml(r,0,meta.title||sh.name,ST.title)]);
 addRow([cellXml(r,0,['الشركة: '+(meta.company||'—'),'المندوب: '+(meta.rep||'—'),meta.job&&'المسمى: '+meta.job,'الفترة: '+meta.period,'القطاع: '+meta.sector,'العميل: '+meta.customer,'أُعدّ: '+meta.date,'العملة: '+meta.currency].filter(Boolean).join(' · '),ST.gray)]);addRow([]);
 let freeze=0,filt=null;const tables=sh.blocks.filter(b=>b.type==='table').length;
 for(const b of sh.blocks){if(b.title)addRow([cellXml(r,0,b.title,ST.bold)]);
  if(b.type==='kv'){for(const x of b.rows){const st=x.v==null?ST.text:FMTST[x.f]||ST.dec;put(0,String(x.k).length*1.1);put(1,18);put(2,String(x.note||'').length);
    addRow([cellXml(r,0,x.k,ST.text),cellXml(r,1,x.v==null?'بيانات غير كافية':x.v,st),cellXml(r,2,x.note||'',ST.gray)])}}
  else{const hr=r;b.cols.forEach((c,i)=>put(i,c.w||(String(c.h).length*1.3)));addRow(b.cols.map((c,i)=>cellXml(r,i,c.h,ST.head)));const first=r;
   for(const row of b.rows){addRow(row.map((c,i)=>{const f=b.cols[i].f,ob=c&&typeof c==='object'?c:null,v=ob?ob.v:c,ff=ob?ob.f:f;
     if(v==null||v==='')return cellXml(r,i,'',ST.text);if(typeof v==='string'){if(ff==='date'&&isDate(v))return cellXml(r,i,serial(v),ST.date);return cellXml(r,i,v,ST.text)}
     return cellXml(r,i,v,FMTST[ff]||ST.dec)}))}
   const last=r-1;if(b.totals&&b.rows.length){addRow(b.cols.map((c,i)=>{if(i===0)return cellXml(r,0,'الإجمالي (للصفوف المعروضة)',ST.bold);if(!b.totals.includes(i))return cellXml(r,i,'',ST.text);
     const tv=round2(b.rows.reduce((a,x)=>a+(typeof x[i]==='number'?x[i]:0),0));return cellXml(r,i,tv,c.f==='money'?ST.moneyT:ST.intT,`SUBTOTAL(109,${colL(i)}${first}:${colL(i)}${last})`)}))}
   if(tables===1&&sh.blocks.length===1&&b.rows.length){freeze=hr;filt=`A${hr}:${colL(b.cols.length-1)}${last}`}}
  addRow([])}
 const cols=W.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1">${freeze?`<pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData>${filt?`<autoFilter ref="${filt}"/>`:''}<pageSetup orientation="landscape" paperSize="9" fitToHeight="0"/></worksheet>`}
function toXlsx(rep){const names=rep.sheets.map((s,i)=>s.name.replace(/[\[\]:*?\/\\]/g,' ').slice(0,31)||'Sheet'+(i+1)),n=rep.sheets.length,H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const files=[{name:'[Content_Types].xml',data:H+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${rep.sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`},
 {name:'_rels/.rels',data:H+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`},
 {name:'docProps/core.xml',data:H+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(rep.meta.title)}</dc:title><dc:creator>${xe(rep.meta.rep||rep.meta.company||'')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`},
 {name:'xl/workbook.xml',data:H+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((x,i)=>`<sheet name="${xe(x)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
 {name:'xl/_rels/workbook.xml.rels',data:H+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rep.sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${n+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
 {name:'xl/styles.xml',data:STYLES},...rep.sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s,rep.meta)}))];
 return zipStore(files)}
