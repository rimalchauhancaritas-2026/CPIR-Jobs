let jobsCache=[];let activeJobLocationTab='local';
const configReady=()=>window.CPIR_CONFIG && window.CPIR_CONFIG.SUPABASE_URL.startsWith('https://') && !window.CPIR_CONFIG.SUPABASE_URL.includes('PASTE_') && window.CPIR_CONFIG.SUPABASE_ANON_KEY && !window.CPIR_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_');
let supabaseClient=null;
function getClient(){ if(!configReady()||!window.supabase)return null; if(!supabaseClient)supabaseClient=window.supabase.createClient(window.CPIR_CONFIG.SUPABASE_URL,window.CPIR_CONFIG.SUPABASE_ANON_KEY); return supabaseClient; }
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fromDb(j){return {id:j.id,title:j.title,org:j.organization,category:j.category,locationScope:j.location_scope||'',city:j.city,recruitmentRegion:j.recruitment_region||'city_specific',applicationEligibility:j.application_eligibility||'',applicationInstructions:j.application_instructions||'', country:j.country||'',remoteEligibility:j.remote_eligibility||'',workArrangement:j.work_arrangement||'',visaInfo:j.visa_work_authorization||'',area:j.area||'',qualification:j.qualification||'',experience:j.experience||'',employmentType:j.employment_type||'',salary:j.salary||'',deadline:j.deadline||'',source:j.source||'',sourceUrl:j.source_url||'',applyUrl:j.apply_url||'',posted:j.posted_at||'',description:j.description||''}}
async function fetchJobs(){const c=getClient(); if(!c)return {data:[],error:{message:'Website database is not configured yet. Follow SETUP-V1.2.md to connect Supabase.'}}; return await c.from('jobs').select('*').eq('status','published').order('created_at',{ascending:false});}
function renderJobs(list){const grid=document.getElementById('jobsGrid');if(!grid)return;const empty=document.getElementById('emptyState'),count=document.getElementById('resultCount');count.textContent=`${list.length} published job${list.length===1?'':'s'} found.`;grid.innerHTML='';if(!list.length){empty.classList.remove('hidden');return}empty.classList.add('hidden');list.forEach(j=>{const card=document.createElement('article');card.className='job-card';card.innerHTML=`<div class="job-top"><span class="badge">${escapeHtml(j.category)}</span><span>📍</span></div><h3>${escapeHtml(j.title)}</h3><div class="org">${escapeHtml(j.org)}</div><div class="meta"><span>📍 ${escapeHtml(j.city)}</span><span>🌐 ${escapeHtml(({city_specific:'City-specific',punjab:'Punjab-wide',sindh:'Sindh-wide',khyber_pakhtunkhwa:'Khyber Pakhtunkhwa-wide',balochistan:'Balochistan-wide',nationwide:'Nationwide – Pakistan',international:'International'})[j.recruitmentRegion]||'Region under review')}</span><span>🎓 ${escapeHtml(j.qualification)}</span><span>💼 ${escapeHtml(j.experience||'Not specified')}</span></div><div class="deadline">🗓 Last Date: ${escapeHtml(j.deadline||'Not specified')}</div><a class="primary-btn" href="job.html?id=${encodeURIComponent(j.id)}">View Details →</a>`;grid.appendChild(card);});}
function jobLocationGroup(j){const scope=String(j.locationScope||'').trim().toLowerCase(),region=String(j.recruitmentRegion||'city_specific').trim().toLowerCase(),city=String(j.city||'').trim().toLowerCase();if(scope==='international'||region==='international')return 'international';if(['rawalpindi','islamabad'].includes(scope)||['rawalpindi','islamabad'].includes(city))return 'local';if(['punjab','nationwide'].includes(region))return 'local';if(scope==='local'&&['rawalpindi','islamabad'].includes(city))return 'local';return 'other';}
function setJobLocationTab(tab){activeJobLocationTab=tab==='international'?'international':'local';const local=document.getElementById('localJobsTab'),international=document.getElementById('internationalJobsTab');if(local){local.classList.toggle('active',activeJobLocationTab==='local');local.setAttribute('aria-selected',String(activeJobLocationTab==='local'));}if(international){international.classList.toggle('active',activeJobLocationTab==='international');international.setAttribute('aria-selected',String(activeJobLocationTab==='international'));}filterJobs();}
function filterJobs(){const keyword=(document.getElementById('keyword')?.value||'').trim().toLowerCase(),category=document.getElementById('category')?.value||'',city=document.getElementById('city')?.value||'',qualification=document.getElementById('qualification')?.value||'';const filtered=jobsCache.filter(j=>{const hay=`${j.title} ${j.org} ${j.category} ${j.city} ${j.area} ${j.qualification} ${j.description}`.toLowerCase();return jobLocationGroup(j)===activeJobLocationTab&&(!keyword||hay.includes(keyword))&&(!category||j.category===category)&&(!city||j.city===city)&&(!qualification||j.qualification===qualification)});renderJobs(filtered);}
function quickFilter(c){document.getElementById('category').value=c;filterJobs();document.getElementById('jobs').scrollIntoView({behavior:'smooth'});}function quickCity(c){document.getElementById('city').value=c;filterJobs();document.getElementById('jobs').scrollIntoView({behavior:'smooth'});}function resetFilters(){['keyword','category','city','qualification'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});filterJobs()}function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open')}
async function renderJobDetail(){const params=new URLSearchParams(location.search),id=params.get('id'),title=document.getElementById('detailTitle'),box=document.getElementById('jobDetail');const c=getClient();if(!c){title.innerHTML='<h1>Database not configured</h1>';box.innerHTML='<div class="info-card"><p>Complete the Supabase setup in SETUP-V1.2.md to load live job details.</p><a class="primary-btn" href="index.html#jobs">Browse jobs</a></div>';return;}const {data,error}=await c.from('jobs').select('*').eq('id',id).eq('status','published').maybeSingle();const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());if(error||!data||(data.deadline&&data.deadline<localToday)){title.innerHTML='<h1>Job not found</h1>';box.innerHTML='<div class="info-card"><p>This job may have expired or been removed.</p><a class="primary-btn" href="index.html#jobs">Browse jobs</a></div>';return;}const j=fromDb(data);title.innerHTML=`<span class="detail-badge">${escapeHtml(j.category)}</span><h1>${escapeHtml(j.title)}</h1><p>${escapeHtml(j.org)} · ${escapeHtml(j.city)}</p>`;const field=(label,value)=>String(value??'').trim()?`<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`:'';const scopeLabels={rawalpindi:'Rawalpindi',islamabad:'Islamabad',pakistan:'Pakistan-wide',international:'International',local:'Local'};const regionLabels={city_specific:'City-specific',punjab:'Punjab-wide',sindh:'Sindh-wide',khyber_pakhtunkhwa:'Khyber Pakhtunkhwa-wide',balochistan:'Balochistan-wide',nationwide:'Nationwide – Pakistan',international:'International',needs_review:'Needs region review'};const overview=[field('Portal Listing Group',scopeLabels[String(j.locationScope||'').toLowerCase()]||j.locationScope),field('City / Location',j.city),field('Recruitment Region',regionLabels[j.recruitmentRegion]||j.recruitmentRegion),field('Domicile / District Eligibility',j.applicationEligibility),field('Application Instructions',j.applicationInstructions),field('Country',j.country),field('Remote Eligibility',j.remoteEligibility),field('Work Arrangement',j.workArrangement),field('Visa / Work Authorisation',j.visaInfo),field('Area / Sector',j.area),field('Qualification',j.qualification),field('Experience',j.experience),field('Employment Type',j.employmentType),field('Salary',j.salary),field('Job Posted Date',j.posted),field('Deadline',j.deadline)].filter(Boolean).join('');const apply=j.applyUrl?`<a class="primary-btn" href="${escapeHtml(j.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply Now ↗</a>`:'';const description=String(j.description||'').trim();const source=j.sourceUrl?'<a class="job-source-link" href="'+escapeHtml(j.sourceUrl)+'" target="_blank" rel="noopener noreferrer">View Original Job Source ↗</a>':escapeHtml(j.source||'');box.innerHTML=`<article class="detail-card"><div class="detail-actions">${apply}<button class="secondary-btn" onclick="shareJob()">Share Job</button></div>${overview?`<h2>Job overview</h2><div class="overview-grid">${overview}</div>`:''}${description?`<h2>Job description</h2><div class="job-description-content">${renderJobDescription(description)}</div>`:''}${source?`<h2>Source</h2><div class="job-source-content">${source}</div>`:''}</article>`;}
function shareJob(){if(navigator.share)navigator.share({title:document.title,url:location.href}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(()=>alert('Job link copied.'));}
async function loadPublicJobs(){const status=document.getElementById('resultCount');const result=await fetchJobs();if(result.error){jobsCache=[];renderJobs([]);if(status)status.textContent=result.error.message;return;}const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());jobsCache=(result.data||[]).filter(j=>!j.deadline||j.deadline>=today).map(fromDb);renderJobs(jobsCache);}
window.filterJobs=filterJobs;window.quickFilter=quickFilter;window.quickCity=quickCity;window.resetFilters=resetFilters;window.toggleMenu=toggleMenu;window.renderJobDetail=renderJobDetail;window.shareJob=shareJob;
if(document.getElementById('jobsGrid'))loadPublicJobs();


// Show administrator-managed Contact Us details in the public footer.
async function loadPortalContact(){
  const c=getClient(); if(!c)return;
  const column=document.querySelector('footer .footer-grid > div:last-child');
  if(!column)return;
  column.innerHTML='<h4>Contact Us</h4><div id="publicContactDetails"><p>Contact details will be updated by the portal administrator.</p></div>';
  const {data,error}=await c.from('portal_contact').select('*').eq('id',1).maybeSingle();
  if(error||!data)return;
  const box=document.getElementById('publicContactDetails'); if(!box)return;
  const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const line=(label,value)=>value?'<p><strong>'+escapeHtml(value)+'</strong></p>':'';
  const link=(label,value)=>{const url=safeUrl(value);return url?'<p><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a></p>':'';};
  box.innerHTML=line('Email',data.email)+line('Phone',data.phone)+line('Address',data.address)+line('Information',data.extra)+link('Facebook',data.facebook_url)+link('Instagram',data.instagram_url)+link('Website',data.website_url);
}
loadPortalContact();

async function updateHomeAuthNav(session){
 const link=document.getElementById('authNavLink'),label=document.getElementById('authNavText'),img=document.getElementById('authNavAvatar'),placeholder=document.getElementById('authNavPlaceholder');
 if(!link)return;
 link.href=session?.user?'candidate.html#candidateDashboard':'candidate.html#signup';
 if(label)label.textContent=session?.user?'Profile':'Sign Up / Login';
 if(img){img.removeAttribute('src');img.classList.add('hidden');}
 placeholder?.classList.remove('hidden');
 if(!session?.user)return;
 const c=getClient();if(!c)return;
 const {data}=await c.from('cv_profiles').select('photo_path').eq('user_id',session.user.id).maybeSingle();
 if(!data?.photo_path)return;
 const {data:signed}=await c.storage.from('candidate-photos').createSignedUrl(data.photo_path,3600);
 if(signed?.signedUrl&&img){img.src=signed.signedUrl;img.classList.remove('hidden');placeholder?.classList.add('hidden');}
}
function initHomeAuthNav(){
 const c=getClient();if(!c)return;
 c.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>updateHomeAuthNav(session),0);});
 c.auth.getSession().then(({data})=>updateHomeAuthNav(data.session));
}
initHomeAuthNav();


// Render a compact, safe description even when pasted source HTML contains
// nested paragraphs or empty editor lines.
function renderJobDescription(value){
 const source=String(value||'');
 if(!/[<][a-z][^>]*>/i.test(source))return escapeHtml(source).replace(/(?:\r?\n){3,}/g,'\n\n').replace(/\r?\n/g,'<br>');
 const parsed=new DOMParser().parseFromString(source,'text/html');
 const allowed=new Set(['B','STRONG','I','EM','BR','P','UL','OL','LI']);
 const clean=node=>{
  let out='';
  node.childNodes.forEach(child=>{
   if(child.nodeType===3){out+=escapeHtml(child.nodeValue);}
   else if(child.nodeType===1){
    const tag=child.tagName,inner=clean(child);
    if(tag==='P'){
     if(!inner.replace(/&nbsp;|\s|<br\s*\/>/gi,'').trim())return;
     // Invalid nested block markup is flattened rather than creating large gaps.
     if(child.querySelector('p,ul,ol'))out+=inner;
     else out+='<p>'+inner+'</p>';
    }else if(['UL','OL'].includes(tag)){
     if(inner.trim())out+='<'+tag.toLowerCase()+'>'+inner+'</'+tag.toLowerCase()+'>';
    }else if(allowed.has(tag)){
     if(tag==='BR')out+='<br>';
     else out+='<'+tag.toLowerCase()+'>'+inner+'</'+tag.toLowerCase()+'>';
    }else out+=inner;
   }
  });
  return out;
 };
 return clean(parsed.body)
  .replace(/(?:<br>\s*){3,}/gi,'<br><br>')
  .replace(/(?:<\/p>\s*){2,}/gi,'</p>');
}


// Show the visitor disclaimer once per browser, on the first homepage visit.
function initFirstVisitDisclaimer(){
  const popup=document.getElementById('firstVisitDisclaimer');
  const accept=document.getElementById('acceptDisclaimer');
  if(!popup||!accept)return;
  const storageKey='cpirJobsDisclaimerAcknowledged_v1';
  let acknowledged=false;
  try{acknowledged=localStorage.getItem(storageKey)==='yes';}catch(_error){}
  if(acknowledged)return;
  popup.hidden=false;
  document.body.classList.add('disclaimer-open');
  accept.focus();
  accept.addEventListener('click',()=>{
    try{localStorage.setItem(storageKey,'yes');}catch(_error){}
    popup.hidden=true;
    document.body.classList.remove('disclaimer-open');
  });
  document.getElementById('popupFullDisclaimerLink')?.addEventListener('click',()=>{
    popup.hidden=true;
    document.body.classList.remove('disclaimer-open');
    // Keep the notice acknowledged only after the visitor presses Continue.
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFirstVisitDisclaimer);
else initFirstVisitDisclaimer();
