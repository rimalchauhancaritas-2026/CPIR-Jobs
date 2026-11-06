let jobsCache=[];
const configReady=()=>window.CPIR_CONFIG && window.CPIR_CONFIG.SUPABASE_URL.startsWith('https://') && !window.CPIR_CONFIG.SUPABASE_URL.includes('PASTE_') && window.CPIR_CONFIG.SUPABASE_ANON_KEY && !window.CPIR_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_');
let supabaseClient=null;
function getClient(){ if(!configReady()||!window.supabase)return null; if(!supabaseClient)supabaseClient=window.supabase.createClient(window.CPIR_CONFIG.SUPABASE_URL,window.CPIR_CONFIG.SUPABASE_ANON_KEY); return supabaseClient; }
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fromDb(j){return {id:j.id,title:j.title,org:j.organization,category:j.category,city:j.city,area:j.area||'',qualification:j.qualification||'Not specified',experience:j.experience||'Not specified',employmentType:j.employment_type||'Not specified',salary:j.salary||'Not specified',deadline:j.deadline||'',source:j.source||'',applyUrl:j.apply_url||'',posted:j.posted_at||'',description:j.description||''}}
async function fetchJobs(){const c=getClient(); if(!c)return {data:[],error:{message:'Website database is not configured yet. Follow SETUP-V1.2.md to connect Supabase.'}}; return await c.from('jobs').select('*').eq('status','published').order('created_at',{ascending:false});}
function renderJobs(list){const grid=document.getElementById('jobsGrid');if(!grid)return;const empty=document.getElementById('emptyState'),count=document.getElementById('resultCount');count.textContent=`${list.length} published job${list.length===1?'':'s'} found.`;grid.innerHTML='';if(!list.length){empty.classList.remove('hidden');return}empty.classList.add('hidden');list.forEach(j=>{const card=document.createElement('article');card.className='job-card';card.innerHTML=`<div class="job-top"><span class="badge">${escapeHtml(j.category)}</span><span>📍</span></div><h3>${escapeHtml(j.title)}</h3><div class="org">${escapeHtml(j.org)}</div><div class="meta"><span>📍 ${escapeHtml(j.city)}</span><span>🎓 ${escapeHtml(j.qualification)}</span><span>💼 ${escapeHtml(j.experience||'Not specified')}</span></div><div class="deadline">🗓 Last Date: ${escapeHtml(j.deadline||'Not specified')}</div><a class="primary-btn" href="job.html?id=${encodeURIComponent(j.id)}">View Details →</a>`;grid.appendChild(card);});}
function filterJobs(){const keyword=(document.getElementById('keyword')?.value||'').trim().toLowerCase(),category=document.getElementById('category')?.value||'',city=document.getElementById('city')?.value||'',qualification=document.getElementById('qualification')?.value||'';const filtered=jobsCache.filter(j=>{const hay=`${j.title} ${j.org} ${j.category} ${j.city} ${j.area} ${j.qualification} ${j.description}`.toLowerCase();return(!keyword||hay.includes(keyword))&&(!category||j.category===category)&&(!city||j.city===city)&&(!qualification||j.qualification===qualification)});renderJobs(filtered);}
function quickFilter(c){document.getElementById('category').value=c;filterJobs();document.getElementById('jobs').scrollIntoView({behavior:'smooth'});}function quickCity(c){document.getElementById('city').value=c;filterJobs();document.getElementById('jobs').scrollIntoView({behavior:'smooth'});}function resetFilters(){['keyword','category','city','qualification'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});renderJobs(jobsCache)}function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open')}
async function renderJobDetail(){const params=new URLSearchParams(location.search),id=params.get('id'),title=document.getElementById('detailTitle'),box=document.getElementById('jobDetail');const c=getClient();if(!c){title.innerHTML='<h1>Database not configured</h1>';box.innerHTML='<div class="info-card"><p>Complete the Supabase setup in SETUP-V1.2.md to load live job details.</p><a class="primary-btn" href="index.html#jobs">Browse jobs</a></div>';return;}const {data,error}=await c.from('jobs').select('*').eq('id',id).eq('status','published').maybeSingle();const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());if(error||!data||(data.deadline&&data.deadline<localToday)){title.innerHTML='<h1>Job not found</h1>';box.innerHTML='<div class="info-card"><p>This job may have expired or been removed.</p><a class="primary-btn" href="index.html#jobs">Browse jobs</a></div>';return;}const j=fromDb(data);title.innerHTML=`<span class="detail-badge">${escapeHtml(j.category)}</span><h1>${escapeHtml(j.title)}</h1><p>${escapeHtml(j.org)} · ${escapeHtml(j.city)}</p>`;const apply=j.applyUrl?`<a class="primary-btn" href="${escapeHtml(j.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply Now ↗</a>`:'<span>Application link not provided; check the source.</span>';box.innerHTML=`<article class="detail-card"><div class="detail-actions">${apply}<button class="secondary-btn" onclick="shareJob()">Share Job</button></div><h2>Job overview</h2><div class="overview-grid"><div><span>Location</span><strong>${escapeHtml(j.city)}</strong></div><div><span>Area</span><strong>${escapeHtml(j.area||'Not specified')}</strong></div><div><span>Qualification</span><strong>${escapeHtml(j.qualification)}</strong></div><div><span>Experience</span><strong>${escapeHtml(j.experience||'Not specified')}</strong></div><div><span>Salary</span><strong>${escapeHtml(j.salary||'Not specified')}</strong></div><div><span>Deadline</span><strong>${escapeHtml(j.deadline||'Not specified')}</strong></div></div><h2>Job description</h2><p>${escapeHtml(j.description||'Details will be added by the administrator.')}</p><h2>Source</h2><p>${j.sourceUrl?`<a href="${escapeHtml(j.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(j.source||'Original source')}</a>`:escapeHtml(j.source||'Not specified')}</p></article>`;}
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
