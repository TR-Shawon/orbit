const http=require('http');
const fs=require('fs');
const path=require('path');
const {URL}=require('url');
const PORT=Number(process.env.PORT||8787), ROOT=__dirname, DATA=path.join(ROOT,'data');
const FEED=path.join(DATA,'feed.json'), EVENTS=path.join(DATA,'events.json');
const TZ='Asia/Dhaka', SCAN_INTERVAL_MS=2*60*60*1000, FRESH_MS=2*60*60*1000+15*60*1000, FETCH_TIMEOUT=6500, MAX_CONCURRENCY=10, DETAIL_CONCURRENCY=5, MAX_DETAIL_PAGES=24;
const DISCOVERY_FALLBACK_LIMIT=4, DETAIL_PER_SOURCE=8;
let scanRunning=false, lastScanStarted=null, lastScanFinished=null;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
if(!fs.existsSync(DATA))fs.mkdirSync(DATA,{recursive:true});
function now(){return new Date().toISOString()};
function read(f,d){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return d}}
function write(f,d){fs.writeFileSync(f,JSON.stringify(d,null,2))}
function dhakaToday(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`}
function strip(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x27;/gi,"'").replace(/\s+/g,' ').trim()}
function abs(base,h){try{return new URL(h,base).toString()}catch{return null}}
function links(html,base){const a=[],r=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=r.exec(html)))a.push({href:abs(base,m[1]),text:strip(m[2]),start:m.index,end:r.lastIndex});return a}
function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)}
function normalizeDigits(s){return String(s||'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[,،]/g,' ').trim()}
function parseDate(s){
  if(!s)return null;
  s=normalizeDigits(s).replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi,'$1').replace(/\s+/g,' ').trim();
  let m=s.match(/(?:^|\D)(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:\D|$)/);
  if(m){const y=Number(m[1]),a=Number(m[2]),b=Number(m[3]);if(a>=1&&a<=12&&b>=1&&b<=31)return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`}
  m=s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2})\b/);if(m){let a=Number(m[1]),b=Number(m[2]),y=2000+Number(m[3]);if(a>12&&b<=12)[a,b]=[b,a];if(a>=1&&a<=12&&b>=1&&b<=31)return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`}
  m=s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if(m){let a=Number(m[1]),b=Number(m[2]),y=Number(m[3]);if(a>12&&b<=12)[a,b]=[b,a];if(a>=1&&a<=12&&b>=1&&b<=31)return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`}
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  m=s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s+(\d{4})\b/i);
  if(m){const mo=months[m[2].slice(0,3).toLowerCase()];if(mo)return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`}
  m=s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s+(\d{2})\b/i);if(m){const mo=months[m[2].slice(0,3).toLowerCase()];if(mo)return `${2000+Number(m[3])}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`}
  m=s.match(/\b(Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s+(\d{4})\b/i);
  if(m){const mo=months[m[1].slice(0,3).toLowerCase()];if(mo)return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`}
  const bnMonths=[['জানুয়ারি','01'],['জানুয়ারি','01'],['ফেব্রুয়ারি','02'],['ফেব্রুয়ারি','02'],['মার্চ','03'],['এপ্রিল','04'],['মে','05'],['জুন','06'],['জুলাই','07'],['আগস্ট','08'],['সেপ্টেম্বর','09'],['অক্টোবর','10'],['নভেম্বর','11'],['ডিসেম্বর','12']];
  for(const [name,mo] of bnMonths){let r2=new RegExp(`\\b([0-9]{1,2})\\s*${name}\\s*([0-9]{2})\\b`);let z=s.match(r2);if(z)return `${2000+Number(z[2])}-${mo}-${String(z[1]).padStart(2,'0')}`;let r=new RegExp(`\\b([0-9]{1,2})\\s*${name}\\s*([0-9]{4})\\b`);let x=s.match(r);if(x)return `${x[2]}-${mo}-${String(x[1]).padStart(2,'0')}`;r=new RegExp(`\\b${name}\\s*([0-9]{1,2})\\s*([0-9]{4})\\b`);x=s.match(r);if(x)return `${x[2]}-${mo}-${String(x[1]).padStart(2,'0')}`}
  return null;
}
function structuredDates(raw){
  const out=[];
  const keyRe=/^(validThrough|applicationDeadline|applicationEndDate|closingDate|closingDateTime|deadline|deadlineDate|endDate|applicationEnd|applyBy|applyUntil)$/i;
  const visit=(v,key='')=>{if(v==null)return;if(typeof v==='string'){if(keyRe.test(key)){const d=parseDate(v);if(d)out.push(d)}return}if(Array.isArray(v)){for(const x of v)visit(x,key);return}if(typeof v==='object'){for(const [k,x] of Object.entries(v))visit(x,k)}};
  const scripts=String(raw||'').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const block of scripts){const body=block.replace(/^<script[^>]*>/i,'').replace(/<\/script>\s*$/i,'').trim();try{visit(JSON.parse(body))}catch{try{const cleaned=body.replace(/\/\*[\s\S]*?\*\//g,'').replace(/,\s*([}\]])/g,'$1');visit(JSON.parse(cleaned))}catch{}}}
  const times=String(raw||'').match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/gi)||[];for(const a of times){const m=a.match(/datetime=["']([^"']+)["']/i);const d=parseDate(m?.[1]);if(d)out.push(d)}
  const attrs=String(raw||'').match(/(?:data-(?:deadline|closing-date|application-deadline|end-date)|(?:validthrough|applicationdeadline|applicationenddate|closingdate|deadlinedate))\s*=\s*["']([^"']+)["']/gi)||[];
  for(const a of attrs){const m=a.match(/=["']([^"']+)["']/);const d=parseDate(m?.[1]);if(d)out.push(d)}
  return [...new Set(out)];
}
function deadline(t){
  const original=String(t||'');
  const structured=structuredDates(original);
  const raw=normalizeDigits(original);if(structured.length)return structured[0];
  const attrs=raw.match(/(?:data-deadline|data-closing-date|data-application-deadline|data-end-date)\s*=\s*["']([^"']+)["']/i);if(attrs){const d=parseDate(attrs[1]);if(d)return d}
  const label=/(?:application\s+(?:deadline|closing\s+date|last\s+date|end(?:s|ing)?|closes?)|last\s+date\s+(?:of\s+)?(?:application|to\s+apply)|last\s+day\s+(?:of\s+)?application|apply\s+(?:by|before)|applications?\s+close|submission\s+(?:deadline|closes?)|registration\s+deadline|closing\s+date|closing\s+on|deadline|valid\s+(?:through|until)|end\s+date|আবেদনের\s*শেষ\s*(?:তারিখ|সময়|সময়)?|আবেদন(?:ের)?\s*(?:শেষ|সমাপ্ত)\s*(?:তারিখ|সময়|সময়)?|আবেদন\s+করার\s+শেষ\s+তারিখ|আবেদন\s+করতে\s+হবে|আবেদনের\s*সময়(?:সীমা)?|আবেদনের\s*সময়(?:সীমা)?|শেষ\s*তারিখ)/i;
  const patterns=[
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2}\\b)`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\s+[0-9]{2}\\b)`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([A-Za-z]{3,9}\\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:,)?\\s+[0-9]{2}\\b)`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{1,2}[\\/.\\-][0-9]{1,2}[\\/.\\-][0-9]{4})`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{4}[\\/.\\-][0-9]{1,2}[\\/.\\-][0-9]{1,2})`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\s+[0-9]{4})`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([A-Za-z]{3,9}\\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:,)?\\s+[0-9]{4})`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}([0-9]{1,2}(?:st|nd|rd|th)?\\s+(?:জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)\\s+[0-9]{4})`,'i'),
    new RegExp(label.source+`[^0-9A-Za-z০-৯]{0,100}((?:জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)\\s*[0-9]{1,2}\\s*[0-9]{4})`,'i')
  ];
  for(const p of patterns){const m=raw.match(p);if(m){const d=parseDate(m[1]);if(d)return d}}
  const loose=raw.match(/(?:deadline|closing|last\s+date|শেষ\s*তারিখ)[^\n]{0,140}?([0-9]{1,2}[\\/.\\-][0-9]{1,2}[\\/.\\-][0-9]{4})/i);if(loose){const d=parseDate(loose[1]);if(d)return d}
  return null;
}

function open(d){return !!d&&d>=dhakaToday()}
function days(d){return Math.ceil((new Date(d+'T00:00:00+06:00')-new Date(dhakaToday()+'T00:00:00+06:00'))/86400000)}
function win(html,needle,b=1800,a=5200){const i=html.indexOf(needle);if(i<0)return strip(html.slice(0,7000));return strip(html.slice(Math.max(0,i-b),i+a))}
function candidateContext(html,l){const start=l?.start??html.indexOf(l?.text||'');const end=l?.end??(start+(l?.text||'').length);if(start<0)return strip(html.slice(0,9000));const candidates=[];for(const tag of ['tr','li','article']){const open=html.lastIndexOf('<'+tag,start);const close=html.indexOf('</'+tag+'>',end);if(open>=0&&close>=0&&close-open<10000)candidates.push(strip(html.slice(open,close+tag.length+3)))}candidates.push(strip(html.slice(Math.max(0,start-2200),Math.min(html.length,end+5200))));return candidates.sort((a,b)=>{const ad=a.toLowerCase().includes('deadline')||a.toLowerCase().includes('শেষ')?0:1;const bd=b.toLowerCase().includes('deadline')||b.toLowerCase().includes('শেষ')?0:1;return ad-bd||a.length-b.length})[0]||''}
function uniq(xs){const m=new Map();for(const x of xs)m.set(x.id,x);return [...m.values()]}
function expReq(t){let n=[],m,r=/(?:at\s+least|minimum|min\.?|\bof\s+)(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*years?/gi;while((m=r.exec(t||'')))n.push(Number(m[1]));return n.length?Math.min(...n):null}
function ageReq(t){let m=String(t||'').match(/(?:maximum\s+age|age\s+limit|বয়স)[^0-9]{0,40}(\d{2})/i);return m?Number(m[1]):null}
function bankNameFrom(url){try{return new URL(url).hostname.replace(/^www\./,'').split('.')[0]}catch{return ''}}

// Government / bank registry. Bank URLs are from Bangladesh government/official bank directories where available.
const PUBLIC_BANKS=[
 ['sonali','Sonali Bank PLC','https://www.sonalibank.com.bd/'],['janata','Janata Bank PLC','https://www.janatabank-bd.com/'],['agrani','Agrani Bank PLC','https://www.agranibank.org/'],['rupali','Rupali Bank PLC','https://www.rupalibank.org/'],['krishi','Bangladesh Krishi Bank','https://www.krishibank.org.bd/'],['rakub','Rajshahi Krishi Unnayan Bank','https://www.rakub.org.bd/'],['bdbl','Bangladesh Development Bank PLC','https://www.bdbl.com.bd/'],['basic','BASIC Bank PLC','https://www.basicbanklimited.com/'],['ansar','Ansar-VDP Unnayan Bank','http://ansarvdpbank.gov.bd/'],['karmasangsthan','Karmasangsthan Bank','https://www.karmasangsthanbank.gov.bd/'],['probashi','Probashi Kallyan Bank','https://pkb.gov.bd/']
];
const PRIVATE_BANKS=[
 ['ab','AB Bank PLC','http://www.abbl.com/'],['al-arafah','Al-Arafah Islami Bank PLC','http://www.al-arafahbank.com/'],['bcbl','Bangladesh Commerce Bank PLC','http://bcblbd.com/'],['bankasia','Bank Asia PLC','http://www.bankasia-bd.com/'],['brac','BRAC Bank PLC','http://www.bracbank.com/'],['dhaka','Dhaka Bank PLC','http://www.dhakabank.com.bd/'],['dbbl','Dutch-Bangla Bank PLC','http://www.dutchbanglabank.com/'],['ebl','Eastern Bank PLC','https://ebl.com.bd/'],['exim','EXIM Bank PLC','https://www.eximbankbd.com/'],['fsibl','First Security Islami Bank PLC','https://www.fsiblbd.com/'],['global-islami','Global Islami Bank PLC','https://www.globalislamibankbd.com/'],['icb','ICB Islamic Bank PLC','https://www.icbislamic-bd.com/'],['ific','IFIC Bank PLC','https://www.ificbank.com.bd/'],['islamibank','Islami Bank Bangladesh PLC','https://www.islamibankbd.com/'],['jamuna','Jamuna Bank PLC','https://www.jamunabankbd.com/'],['meghna','Meghna Bank PLC','https://www.meghnabank.com.bd/'],['mercantile','Mercantile Bank PLC','http://www.mblbd.com/'],['midland','Midland Bank PLC','https://www.midlandbankbd.net/'],['mtb','Mutual Trust Bank PLC','https://www.mutualtrustbank.com/'],['nbl','National Bank PLC','https://www.nblbd.com/'],['nrb','NRB Bank PLC','http://www.nrbbankbd.com/'],['ncc','NCC Bank PLC','https://www.nccbank.com.bd/'],['nrbcommercial','NRBC Bank PLC','https://www.nrbcommercialbank.com/'],['one','ONE Bank PLC','https://www.onebank.com.bd/'],['premier','The Premier Bank PLC','https://premierbankltd.com/'],['prime','Prime Bank PLC','https://www.primebank.com.bd/'],['pubali','Pubali Bank PLC','https://www.pubalibangla.com/'],['sjibl','Shahjalal Islami Bank PLC','https://www.sjiblbd.com/'],['sibl','Social Islami Bank PLC','https://www.siblbd.com/'],['sbac','South Bangla Agriculture and Commerce Bank PLC','http://www.sbacbank.com/'],['southeast','Southeast Bank PLC','https://www.southeastbank.com.bd/'],['standard','Standard Bank PLC','https://www.standardbankbd.com/'],['city','City Bank PLC','https://www.thecitybank.com/'],['trust','Trust Bank PLC','https://www.tblbd.com/'],['union','Union Bank PLC','https://www.unionbank.com.bd/'],['ucb','United Commercial Bank PLC','https://www.ucb.com.bd/'],['uttara','Uttara Bank PLC','https://www.uttarabank-bd.com/'],['modhumoti','Modhumoti Bank PLC','https://www.modhumotibankltd.com/'],['shimanto','Shimanto Bank PLC','https://www.shimantobank.com/'],['community','Community Bank Bangladesh PLC','https://www.communitybankbd.com/'],['citizens','Citizens Bank PLC','https://www.citizensbankbd.com/'],['bengal','Bengal Commercial Bank PLC','https://bgcb.com.bd/'],['padma','Padma Bank PLC','https://www.padmabankbd.com/'],['bankalfalah','Bank Alfalah','https://www.bankalfalah.com/bd/'],['citi','Citibank N.A. Bangladesh','https://www.citibank.com/'],['combank','Commercial Bank of Ceylon PLC Bangladesh','https://www.combank.net.bd/'],['hbl','Habib Bank Limited Bangladesh','http://globalhbl.com/Bangladesh/'],['nbp','National Bank of Pakistan Bangladesh','http://www.nbp-bd.com/'],['scb','Standard Chartered Bangladesh','https://www.sc.com/bd/'],['sbi','State Bank of India Bangladesh','https://sbibd.com/'],['hsbc','HSBC Bangladesh','https://www.hsbc.com.bd/'],['woori','Woori Bank Bangladesh','https://go.wooribank.com/bd/ib/main/IbMain.do']
];
const MNC=[
 ['unilever','Unilever Bangladesh','https://careers.unilever.com/'],['bat','British American Tobacco Bangladesh','https://careers.bat.com/en/location/bangladesh-jobs/'],['nestle','Nestlé Bangladesh','https://www.nestle.com.bd/jobs'],['pg','P&G Bangladesh','https://www.pgcareers.com/mea/en/locations/bangladesh'],['marico','Marico Bangladesh','https://marico.com/bangladesh'],['reckitt','Reckitt','https://careers.reckitt.com/'],['coca-cola','The Coca-Cola Company','https://www.coca-colacompany.com/careers'],['maersk','Maersk','https://www.maersk.com/careers'],['grameenphone','Grameenphone','https://career.grameenphone.com/'],['banglalink','Banglalink','https://banglalink.net/en/career'],['robi','Robi Axiata','https://www.robi.com.bd/en/career'],['standard-chartered','Standard Chartered Bangladesh','https://www.sc.com/bd/careers/'],['huawei','Huawei','https://career.huawei.com/'],['ericsson','Ericsson','https://www.ericsson.com/en/careers'],['dhl','DHL','https://careers.dhl.com/'],['loreal','L’Oréal','https://careers.loreal.com/']
];
const TECH=[['brainstation23','Brain Station 23','https://brainstation-23.com/career/'],['riseup','Riseup Labs','https://riseuplabs.com/jobs/'],['acmeai','Acme AI','https://www.acmeai.tech/career']];
const SOURCES={
 bpsc:{id:'bpsc',group:'government',name:'BPSC',url:'https://bpsc.gov.bd/pages/psc-exams',kind:'page'},
 alljobs:{id:'alljobs',group:'government',name:'Alljobs by Teletalk',url:'https://alljobs.teletalk.com.bd/',kind:'page'},
 bb:{id:'bb',group:'public-bank',name:'Bangladesh Bank',url:'https://www.bb.org.bd/en/index.php/mediaroom/noticeboard',kind:'page'},
 bdjobs:{id:'bdjobs',group:'private',name:'Bdjobs',url:'https://bdjobs.com/h/jobs/',kind:'page'},
 linkedin:{id:'linkedin',group:'private',name:'LinkedIn Jobs (discovery)',url:'https://www.linkedin.com/jobs/search/?keywords=business%20development%20marketing%20sales%20business%20analyst&location=Bangladesh',kind:'discovery'}
};
for(const [id,n,u] of PUBLIC_BANKS)SOURCES['bank-'+id]={id:'bank-'+id,group:'public-bank',name:n,url:u,kind:'bank'};
for(const [id,n,u] of PRIVATE_BANKS)SOURCES['bank-'+id]={id:'bank-'+id,group:'private-bank',name:n,url:u,kind:'bank'};
for(const [id,n,u] of MNC)SOURCES['mnc-'+id]={id:'mnc-'+id,group:'private',name:n,url:u,kind:'company'};
for(const [id,n,u] of TECH)SOURCES['tech-'+id]={id:'tech-'+id,group:'private',name:n,url:u,kind:'company'};

function roleScore(item,p){const text=(item.title+' '+item.snippet+' '+item.eligibility).toLowerCase();const title=item.title.toLowerCase();
 if(item.group==='public-bank'||item.group==='private-bank'){const b=bankFit(text,p);return {score:b.score,reasons:b.reasons,excluded:false};}
 const eng=/(^|\b)(software|civil|mechanical|electrical|electronics|network|devops|developer|programmer|qa engineer|quality engineer|maintenance engineer|site engineer|design engineer|system engineer|engineering manager|engineer)(\b|$)/i.test(title);
 if(eng)return {score:0,reasons:['Engineering/engineering-title role excluded by your preference.'],excluded:true};
 const allowed=[['business development',30],['business development manager',35],['business development executive',30],['sales manager',35],['sales',24],['marketing',28],['marketing manager',34],['business analyst',35],['business analysis',30],['growth',24],['partnership',24],['commercial',22],['account manager',20],['key account',22],['strategy',18],['product marketing',24],['market research',22],['customer success',18]];
 let score=0,reasons=[];for(const [k,w] of allowed)if(text.includes(k)){score+=w;if(reasons.length<4)reasons.push(`Role signal: ${k}.`)}
 if(/ai|iot|saas|software|technology|digital|automation/.test(text)){score+=12;reasons.push('Technology/AI/IoT domain alignment.')}
 if(/marketing|brand|go-to-market|campaign|customer acquisition/.test(text)&&/mba|business|marketing/.test(String(p.edu||'').toLowerCase()+' '+String(p.mba||'').toLowerCase())){score+=15;reasons.push('MBA/Marketing alignment.')}
 if(/quantitative|analytics|data analysis|business intelligence|forecasting|commercial analytics|market analytics/.test(text)){score+=14;reasons.push('Quantitative Business Analysis alignment.')}
 const ex=Number(String(p.exp||'').match(/\d+(?:\.\d+)?/)?.[0]||0), req=expReq(text);if(req!=null){if(ex>=req){score+=18;reasons.push(`Experience fit: ${ex} years vs ${req}+ required.`)}else score-=30}
 if(/engineering|engineer/.test(text)&&!/business|sales|marketing|commercial/.test(title))score-=20;
 return {score:Math.max(0,Math.min(100,score)),reasons:reasons.slice(0,5),excluded:false};
}
function bankFit(text,p){let s=20,r=[];const exp=Number(String(p.exp||'').match(/\d+(?:\.\d+)?/)?.[0]||0),req=expReq(text);if(req!=null&&exp>=req){s+=22;r.push(`Experience fit: ${exp} years vs ${req}+ required.`)}
 if(/business development|relationship manager|relationship|sales|marketing|branch sales|card|partnership|commercial|strategy|business analyst|analytics/.test(text)){s+=30;r.push('Commercial/business banking role signal.')}
 if(/mba|business administration|marketing|quantitative|statistics|analytics/.test(text)){s+=18;r.push('MBA/QBA-compatible academic signal.')}
 if(/officer|management trainee|senior officer|generalist/.test(text)){s+=8;r.push('Bank generalist/management-track signal.')}
 return {score:Math.max(0,Math.min(100,s)),reasons:r.slice(0,5)}}
function match(item,p){const fit=roleScore(item,p);if(fit.excluded)return {status:'excluded',score:0,reasons:fit.reasons,concerns:fit.reasons};let concerns=[];const req=expReq(item.eligibility+' '+item.snippet),ex=Number(String(p.exp||'').match(/\d+(?:\.\d+)?/)?.[0]||0);if(req!=null&&ex<req)concerns.push(`Minimum experience may be ${req}+ years.`);const age=ageReq(item.eligibility+' '+item.snippet);if(age&&p.dob){const a=(Date.now()-new Date(p.dob).getTime())/31557600000;if(a>age)concerns.push(`Age may exceed ${age} years.`)}let status=fit.score>=Number(p.threshold||60)?'matched':'below-threshold';if(concerns.length&&fit.score<Number(p.threshold||60))status='needs-review';return {status,score:fit.score,reasons:fit.reasons,concerns};}
function examMode(t){const x=String(t||'').toLowerCase();const explicit=/(written\s+(test|exam|examination)|written\s+assessment|aptitude\s+(test|exam)|assessment\s+test|recruitment\s+test|selection\s+test|mcq\s+(test|exam)|preliminary\s+(test|exam)|written\s+and\s+viva|written\s+then\s+interview|test\s+will\s+be\s+conducted|লিখিত\s*পরীক্ষা|লিখিত\s*টেস্ট|এমসিকিউ)/i.test(x);const entryLevel=/(management\s+trainee|trainee\s+officer|probationary\s+officer|trainee\s+assistant\s+officer|junior\s+officer|cash\s+officer)/i.test(x)&&!/(minimum|at\s+least|years?\s+of\s+experience|experience\s+required)/i.test(x);const written=explicit||entryLevel;const interview=/(interview|viva|panel\s+interview|assessment\s+centre)/i.test(x)||entryLevel;let topics=[];if(/english|communication|verbal/.test(x))topics.push('English & communication');if(/quantitative|math|numerical|arithmetic/.test(x))topics.push('Quantitative aptitude');if(/logical|analytical|reasoning/.test(x))topics.push('Analytical & logical reasoning');if(/general knowledge|current affairs|bangladesh affairs/.test(x))topics.push('General/Bangladesh affairs');if(/banking|finance|financial|credit|treasury|economics/.test(x))topics.push('Banking, finance & economics');if(!topics.length)topics=['English & communication','Quantitative aptitude','Analytical & logical reasoning','Banking & finance','General/Bangladesh affairs'];return {written,interview,topics,mode:written?'written-exam':interview?'interview':'application'};}
function prepPlan(daysLeft,capacity,topics){const d=Math.max(1,Number(daysLeft)||1),c=Math.max(30,Number(capacity)||60),blocks=topics.map((t,i)=>({topic:t,minutes:Math.max(10,Math.floor(c/topics.length/5)*5),priority:i<2?'High':'Normal'}));return {days:d,dailyMinutes:c,topics:blocks,phases:[{name:'Foundation',days:Math.max(1,Math.ceil(d*.4))},{name:'Timed practice',days:Math.max(1,Math.ceil(d*.35))},{name:'Revision & mocks',days:Math.max(1,d-Math.ceil(d*.4)-Math.ceil(d*.35))}]};}
function baseItem(source,title,detail,ctx,deadlineDate,group,org){if(!deadlineDate||!open(deadlineDate))return null;const exam=group==='private-bank'?examMode(title+' '+ctx):{written:false,interview:false,topics:[],mode:'application'};return {id:source.id+'-'+slug(title+'-'+(org||source.name)),group,type:group==='government'?'gov':group==='public-bank'?'public-bank':group==='private-bank'?'private-bank':'private',title:title.trim(),org:org||source.name,source:source.name,sourceUrl:source.url,detailUrl:detail||source.url,applyUrl:detail||source.url,deadline:deadlineDate,eligibility:ctx.slice(0,7000),snippet:ctx.slice(0,2600),daysLeft:days(deadlineDate),verifiedAt:now(),verification:'live-source-verified',recruitment:exam.mode,writtenExam:exam.written,interviewRequired:exam.interview,examTopics:exam.topics};}
function withStats(items,stats){items.stats=stats;return items}
function jobish(text){return /career|job|position|vacancy|apply|business|marketing|sales|growth|analyst|manager|officer|recruit|appointment|employment|join-us|work-with-us/i.test(text)}
function sameHost(a,b){try{return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'')}catch{return false}}
async function inspectDetailLinks(pending,s,stats,out){
  const detail=uniq(pending.map(l=>({id:l.href,...l}))).slice(0,DETAIL_PER_SOURCE);
  stats.detailChecked+=detail.length;
  const fetched=await mapLimit(detail,DETAIL_CONCURRENCY,async l=>{try{return {l,html:await fetchText(l.href)}}catch{return null}});
  for(const r of fetched){if(!r)continue;const ctx=candidateContext(r.html,r.l)||strip(r.html).slice(0,12000);const d=deadline(r.html)||deadline(ctx);if(!d)continue;stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,r.l.text,r.l.href,ctx,d,s.group,s.group==='government'?'Government of Bangladesh':s.name);if(x)out.push(x)}
}
async function parsePage(html,s){
  const out=[],ls=links(html,s.url),stats={candidates:0,deadlineFound:0,deadlineVerified:0,extracted:0,detailChecked:0},pending=[];
  for(const l of ls){
    if(!l.href||l.text.length<4||l.text.length>240)continue;
    if(s.group==='government'&&!/(psc|exam|circular|notice|recruit|job|vacancy|appointment|teletalk|officer|assistant)/i.test(l.text+' '+l.href))continue;
    if(s.id==='bb'&&!/(recruit|job|vacancy|appointment|officer|career|notice)/i.test(l.text+' '+l.href))continue;
    stats.candidates++;
    const ctx=candidateContext(html,l)||win(html,l.text),d=deadline(ctx)||deadline(l.text);
    if(d){stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,l.text,l.href,ctx,d,s.group,s.group==='government'?'Government of Bangladesh':s.name);if(x)out.push(x)}
    else if(jobish(l.text+' '+l.href))pending.push(l);
  }
  await inspectDetailLinks(pending,s,stats,out);
  stats.extracted=out.length;return withStats(uniq(out),stats)
}
async function parseCompany(html,s){
  const out=[],ls=links(html,s.url),stats={candidates:0,deadlineFound:0,deadlineVerified:0,extracted:0,detailChecked:0},pending=[];
  for(const l of ls){if(!l.href||l.text.length<4||l.text.length>220||!jobish(l.text+' '+l.href))continue;stats.candidates++;const ctx=candidateContext(html,l)||win(html,l.text),d=deadline(ctx)||deadline(l.text);if(d){stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,l.text,l.href,ctx,d,s.group,s.name);if(x)out.push(x)}else if(sameHost(l.href,s.url)||/\/job|\/career|\/vacan|\/recruit/i.test(l.href))pending.push(l)}
  await inspectDetailLinks(pending,s,stats,out);
  stats.extracted=out.length;return withStats(uniq(out),stats)
}
async function parseBdjobs(html,s){
  const candidates=links(html,s.url).filter(l=>l.href&&/bdjobs\.com\/h\/details\//i.test(l.href)&&l.text.length>=4&&l.text.length<=240);
  const unique=uniq(candidates.map(l=>({id:l.href,...l}))).slice(0,MAX_DETAIL_PAGES);
  const stats={candidates:candidates.length,deadlineFound:0,deadlineVerified:0,extracted:0,detailChecked:unique.length};
  const fetched=await mapLimit(unique,DETAIL_CONCURRENCY,async l=>{try{return {l,html:await fetchText(l.href)}}catch{return null}});const out=[];
  for(const r of fetched){if(!r)continue;const ctx=candidateContext(r.html,r.l)||win(r.html,r.l.text,4000,10000);const d=deadline(r.html)||deadline(ctx);if(!d)continue;stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,r.l.text,r.l.href,ctx,d,s.group,'');if(x)out.push(x)}
  stats.extracted=out.length;return withStats(uniq(out),stats)
}
async function parsePortal(html,s){
  const pages=[{url:s.url,html}],stats={candidates:0,deadlineFound:0,deadlineVerified:0,extracted:0,detailChecked:0},pending=[];
  const child=links(html,s.url).filter(l=>l.href&&/(career|careers|jobs|job-opportun|vacanc|recruit|employment|join-us|work-with-us|notice|circular)/i.test(l.text+' '+l.href)&&l.href!==s.url).slice(0,3);
  const fetched=await mapLimit(child,DETAIL_CONCURRENCY,async l=>{try{return {l,html:await fetchText(l.href)}}catch{return null}});stats.detailChecked=fetched.filter(Boolean).length;for(const r of fetched)if(r)pages.push({url:r.l.href,html:r.html});
  const out=[];
  for(const page of pages){for(const l of links(page.html,page.url)){if(!l.href||l.text.length<4||l.text.length>220||!jobish(l.text+' '+l.href))continue;stats.candidates++;const ctx=candidateContext(page.html,l)||win(page.html,l.text),d=deadline(ctx)||deadline(l.text);if(d){stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,l.text,l.href,ctx,d,s.group,s.name);if(x)out.push(x)}else if(/job|career|vacan|recruit|officer|manager|analyst|sales|marketing|business/i.test(l.text+' '+l.href))pending.push({...l,pageUrl:page.url})}}
  // Second pass: inspect a bounded set of same-domain/career detail links that had no deadline on the listing page.
  const detail=uniq(pending.map(l=>({id:l.href,...l}))).filter(l=>sameHost(l.href,s.url)||/\/job|\/career|\/vacan|\/recruit|\/position|\/opening/i.test(l.href)).slice(0,DETAIL_PER_SOURCE);
  stats.detailChecked+=detail.length;
  const fetched2=await mapLimit(detail,DETAIL_CONCURRENCY,async l=>{try{return {l,html:await fetchText(l.href)}}catch{return null}});
  for(const r of fetched2){if(!r)continue;const ctx=candidateContext(r.html,r.l)||strip(r.html).slice(0,12000);const d=deadline(r.html)||deadline(ctx);if(!d)continue;stats.deadlineFound++;if(!open(d))continue;stats.deadlineVerified++;const x=baseItem(s,r.l.text,r.l.href,ctx,d,s.group,s.name);if(x)out.push(x)}
  stats.extracted=out.length;return withStats(uniq(out),stats)
}

async function fetchText(url,attempt=0){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT);
  try{const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.8'},redirect:'follow',signal:controller.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text();}
  catch(e){if(attempt<1){await new Promise(r=>setTimeout(r,350));return fetchText(url,attempt+1)}throw new Error(e.name==='AbortError'?'timeout':String(e.message||e))}
  finally{clearTimeout(timer)}
}
async function searchOfficialLinks(s){try{const host=new URL(s.url).hostname.replace(/^www\./,'');const q=encodeURIComponent(`site:${host} (career OR jobs OR vacancy OR recruitment) (business OR marketing OR sales OR analyst OR officer OR manager)`);const html=await fetchText(`https://www.bing.com/search?q=${q}`);const found=links(html,'https://www.bing.com/').filter(x=>x.href&&x.href.includes(host)).slice(0,2);const out=[];for(const l of found){try{const h=await fetchText(l.href);out.push({url:l.href,html:h})}catch{}}return out}catch{return []}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){while(true){const i=next++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]={error:String(e.message||e)}}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

function sourceListForUI(){return Object.values(SOURCES).map(s=>({id:s.id,name:s.name,url:s.url,group:s.group,kind:s.kind}))}
function scanState(){const f=read(FEED,{syncedAt:null,sourceSummary:null});const last=f.syncedAt||lastScanFinished;const next=last?new Date(new Date(last).getTime()+SCAN_INTERVAL_MS).toISOString():new Date(Date.now()+SCAN_INTERVAL_MS).toISOString();return {running:scanRunning,lastScanStarted,lastScanFinished:last||null,nextScanAt:next,intervalMinutes:120,sourceCount:Object.keys(SOURCES).length};}
function profileFrom(p){p=p||{};return {name:String(p.name||'Orbit User'),dob:String(p.dob||''),edu:String(p.edu||'Business / Marketing / Quantitative / Technology'),mba:String(p.mba||'Marketing & Quantitative Business Analysis'),exp:String(p.exp||'4 years Business Development, Sales & Marketing'),target:String(p.target||'Business Development, Marketing, Sales, Business Analyst, Growth, Commercial'),capacity:Number(p.capacity||60),threshold:Number(p.threshold||60)}}
async function sync(profile){
 if(scanRunning)return {...read(FEED,{ok:false,items:[],sourceHealth:{}}),scanComplete:false,scanRunning:true,scanState:scanState()};
 scanRunning=true; lastScanStarted=now();
 try {
 const p=profileFrom(profile), health={}, all=[];
 const sources=Object.values(SOURCES);
 const results=await mapLimit(sources,MAX_CONCURRENCY,async s=>{
   const h={id:s.id,name:s.name,url:s.url,group:s.group,kind:s.kind,ok:false,checkedAt:now(),count:0,candidates:0,deadlineVerified:0,detailChecked:0};
   if(s.kind==='discovery'){h.ok=true;h.status='discovery';h.note='Public discovery link only; no credential scraping.';return {h,items:[]};}
   try{
     const html=await fetchText(s.url);
     const raw=s.id==='bdjobs'?await parseBdjobs(html,s):(s.kind==='page'||s.kind==='bank'?await parsePage(html,s):await parsePortal(html,s));
     h.candidates=raw.stats?.candidates||0; h.deadlineFound=raw.stats?.deadlineFound||0; h.deadlineVerified=raw.stats?.deadlineVerified||0; h.detailChecked=raw.stats?.detailChecked||0; h.extracted=raw.stats?.extracted||0;
     const ms=[];
     for(const it of uniq(raw)){const m=match(it,p);if(m.status==='matched'||(m.status==='needs-review'&&s.group.includes('bank'))){it.match=m;ms.push(it)}}
     h.ok=true;h.status='verified';h.count=ms.length;
     h.note=ms.length?'Current profile-matched listings extracted.':h.deadlineVerified?'Current listings were deadline-verified but none matched the active profile threshold.':h.deadlineFound?'Deadline dates were detected, but none were still open.':'Source reachable, but no listing with a verifiable deadline was extracted.';
     return {h,items:ms};
   }catch(e){
     h.status='unavailable';h.error=String(e.message||e).slice(0,180);return {h,items:[]};
   }
 });
 for(const r of results){health[r.h.id]=r.h;all.push(...(r.items||[]));}
 // Scheduled scans intentionally do not run search-engine discovery; this keeps the 87-source cycle bounded and auditable.
 const items=uniq(all).filter(x=>x.deadline&&open(x.deadline)).sort((a,b)=>a.group.localeCompare(b.group)||a.deadline.localeCompare(b.deadline)||b.match.score-a.match.score);
 const successful=Object.values(health).filter(x=>x.ok).length, reachable=Object.values(health).filter(x=>x.status==='verified').length, discovery=Object.values(health).filter(x=>x.status==='discovery').length, failed=Object.values(health).filter(x=>!x.ok&&x.status==='unavailable').length, candidates=Object.values(health).reduce((n,x)=>n+(x.candidates||0),0), deadlineFound=Object.values(health).reduce((n,x)=>n+(x.deadlineFound||0),0), deadlineVerified=Object.values(health).reduce((n,x)=>n+(x.deadlineVerified||0),0);
 const prev=read(FEED,{items:[]}).items||[],ids=new Set(prev.map(x=>x.id)),newMatches=items.filter(x=>!ids.has(x.id));
 const events=read(EVENTS,[]);for(const x of newMatches)events.push({id:'evt-'+x.id+'-'+Date.now(),type:'new-match',createdAt:now(),opportunity:x});write(EVENTS,events.slice(-500));
 const result={ok:reachable>0,version:'15.0',syncComplete:true,syncedAt:now(),freshUntil:new Date(Date.now()+FRESH_MS).toISOString(),todayDhaka:dhakaToday(),items,sourceHealth:health,sourceRegistry:sourceListForUI(),coverage:{publicBanks:PUBLIC_BANKS.length,privateBanks:PRIVATE_BANKS.length,mnc:MNC.length,tech:TECH.length,linkedin:'discovery-only',total:sources.length},sourceSummary:{total:sources.length,successful,reachable,discovery,failed,matched:items.length,candidates,deadlineFound,deadlineVerified,startedAt:lastScanStarted,finishedAt:now(),durationMs:lastScanStarted?Date.now()-new Date(lastScanStarted).getTime():null},profileSummary:{capacity:p.capacity,threshold:p.threshold},newMatches:newMatches.map(x=>x.id)};
 result.scanState={...scanState(),lastScanFinished:result.syncedAt};
 write(FEED,result); lastScanFinished=result.syncedAt; return result;
 } finally {scanRunning=false;}
}
function current(){const f=read(FEED,{ok:false,items:[],sourceHealth:{},syncedAt:null});if(!f.ok||!f.syncedAt||Date.now()-new Date(f.syncedAt).getTime()>FRESH_MS)return {...f,ok:false,items:[],stale:true,message:'Live verification required'};return f}
function send(res,st,d,type='application/json'){res.writeHead(st,{'content-type':type,'cache-control':'no-store'});res.end(type==='application/json'?JSON.stringify(d):d)}
function file(res,f){try{const ext=path.extname(f);const type=ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.json'?'application/json':ext==='.css'?'text/css':'text/plain';send(res,200,fs.readFileSync(f),type)}catch{send(res,404,'Not found','text/plain')}}
async function route(req,res){const u=new URL(req.url,'http://localhost');if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,version:'15.0',time:now(),scanState:scanState(),sources:Object.keys(SOURCES).length});if(req.method==='GET'&&u.pathname==='/api/opportunities')return send(res,200,current());if(req.method==='GET'&&u.pathname==='/api/sources')return send(res,200,{ok:true,sources:sourceListForUI(),coverage:{publicBanks:PUBLIC_BANKS.length,privateBanks:PRIVATE_BANKS.length,mnc:MNC.length,tech:TECH.length,total:Object.keys(SOURCES).length},scanState:scanState()});
if(req.method==='GET'&&u.pathname==='/api/scan-status')return send(res,200,{ok:true,scanState:scanState(),sourceSummary:read(FEED,{sourceSummary:null}).sourceSummary||null});if(req.method==='GET'&&u.pathname==='/api/events')return send(res,200,{ok:true,events:read(EVENTS,[]).slice(-100)});if(req.method==='POST'&&u.pathname==='/api/sync'){let b='';req.on('data',c=>b+=c);req.on('end',async()=>{try{send(res,200,await sync(b?JSON.parse(b).profile:{}))}catch(e){send(res,500,{ok:false,error:String(e.message||e),items:[]})}});return}if(req.method==='GET'&&u.pathname==='/api/sync'){try{return send(res,200,await sync(read(FEED,{}).profileSummary||{}))}catch(e){return send(res,500,{ok:false,error:String(e.message||e),items:[]})}}if(req.method==='GET'){const f=path.join(ROOT,u.pathname==='/'?'index.html':u.pathname.replace(/^\//,''));if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile())return file(res,f)}send(res,404,'Not found','text/plain')}
if(require.main===module){
 const srv=http.createServer(route);
 srv.listen(PORT,()=>{console.log(`Orbit V15 running at http://localhost:${PORT}`);if(process.env.ORBIT_SKIP_INITIAL_SCAN!=='1')setTimeout(()=>{const p=read(FEED,{profileSummary:{}}).profileSummary||{};sync(p).catch(()=>{})},1500)});
 setInterval(()=>{const p=read(FEED,{profileSummary:{}}).profileSummary||{};sync(p).catch(()=>{})},SCAN_INTERVAL_MS);
}
module.exports={sync,scanState,sourceListForUI,profileFrom,parseDate,deadline,candidateContext};
