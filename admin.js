let client=null,editingId=null;const $=id=>document.getElementById(id);const ready=()=>window.CPIR_CONFIG?.SUPABASE_URL?.startsWith('https://')&&!window.CPIR_CONFIG.SUPABASE_URL.includes('PASTE_')&&window.CPIR_CONFIG.SUPABASE_ANON_KEY&&!window.CPIR_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_');const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));function val(id){return $(id).value.trim()}function msg(id,t){$(id).textContent=t}
// Automatically sign administrators out after 30 minutes without activity.
const ADMIN_IDLE_LIMIT=30*60*1000;
let adminIdleTimer=null,adminLastActivity=0,adminSessionActive=false,adminLogoutInProgress=false,lastMouseActivity=0;
function stopAdminIdleTimer(){
 clearTimeout(adminIdleTimer);adminIdleTimer=null;adminSessionActive=false;adminLastActivity=0;
}
async function expireAdminSession(){
 if(!adminSessionActive||adminLogoutInProgress)return;
 adminLogoutInProgress=true;stopAdminIdleTimer();
 try{await client.auth.signOut();}
 finally{
  $('adminPanel').classList.add('hidden');$('signOutBtn').classList.add('hidden');$('loginPanel').classList.remove('hidden');
  msg('loginMessage','You have been signed out because there was no activity for 30 minutes. Please sign in again.');
  adminLogoutInProgress=false;
 }
}
function scheduleAdminIdleLogout(){
 clearTimeout(adminIdleTimer);
 adminIdleTimer=setTimeout(expireAdminSession,ADMIN_IDLE_LIMIT);
}
function checkAdminIdleTimeout(){
 if(!adminSessionActive||adminLogoutInProgress)return;
 const remaining=ADMIN_IDLE_LIMIT-(Date.now()-adminLastActivity);
 if(remaining<=0){expireAdminSession();return;}
 clearTimeout(adminIdleTimer);
 adminIdleTimer=setTimeout(checkAdminIdleTimeout,remaining);
}
function recordAdminActivity(){
 if(!adminSessionActive||adminLogoutInProgress)return;
 const now=Date.now();
 if(now-adminLastActivity>=ADMIN_IDLE_LIMIT){expireAdminSession();return;}
 adminLastActivity=now;checkAdminIdleTimeout();
}
function bindAdminActivityTracking(){
 const activityEvents=['pointerdown','keydown','click','scroll','touchstart','input','change'];
 activityEvents.forEach(type=>document.addEventListener(type,recordAdminActivity,{passive:true}));
 document.addEventListener('mousemove',()=>{
  const now=Date.now();
  if(now-lastMouseActivity>=1000){lastMouseActivity=now;recordAdminActivity();}
 },{passive:true});
 // Returning to a tab must check elapsed time, not count as fresh activity.
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')checkAdminIdleTimeout();
 });
 window.addEventListener('focus',checkAdminIdleTimeout);
}
function startAdminIdleTimer(){
 adminSessionActive=true;adminLastActivity=Date.now();checkAdminIdleTimeout();
}
function init(){if(!ready()||!window.supabase){$('setupWarning').classList.remove('hidden');$('setupWarning').textContent='Supabase is not configured. Open SETUP-V1.2.md and add your project URL and anon/public key to config.js.';$('loginPanel').classList.add('hidden');return;}client=window.supabase.createClient(CPIR_CONFIG.SUPABASE_URL,CPIR_CONFIG.SUPABASE_ANON_KEY);bindAdminActivityTracking();client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){stopAdminIdleTimer();$('adminRecoveryPanel').classList.remove('hidden');$('loginPanel').classList.add('hidden');$('adminPanel').classList.add('hidden');}else if(event!=='INITIAL_SESSION')setTimeout(checkSession,0);});$('adminResetPassword').addEventListener('click',sendAdminPasswordReset);$('adminRecoveryForm').addEventListener('submit',saveAdminNewPassword);checkSession();}
async function checkSession(){const {data:{session}}=await client.auth.getSession();$('loginPanel').classList.toggle('hidden',!!session);$('adminPanel').classList.add('hidden');$('signOutBtn').classList.toggle('hidden',!session);if(!session){stopAdminIdleTimer();return;}const {data:profile,error}=await client.from('admin_profiles').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!profile){stopAdminIdleTimer();msg('loginMessage','This account is signed in but has not been authorized as a portal administrator. Ask the project owner to grant admin access.');await client.auth.signOut();return;}$('adminPanel').classList.remove('hidden');startAdminIdleTimer();restoreAdminScrollPosition();await loadAdminJobs();await loadCollectorSources();await loadFetchedJobs();await loadContactSettings();await loadCandidateUsers();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMessage','Signing in…');try{const {error}=await client.auth.signInWithPassword({email:val('email'),password:$('password').value});msg('loginMessage',error?error.message:'Signed in.');if(!error)await checkSession();}catch(error){msg('loginMessage','Could not connect to the login service. Check your internet connection and try again. If it continues, contact the website administrator.');console.error('Admin sign-in connection error:',error);}});$('signOutBtn').addEventListener('click',async()=>{stopAdminIdleTimer();await client.auth.signOut();});$('clearFormBtn').addEventListener('click',clearForm);$('refreshBtn').addEventListener('click',loadAdminJobs);$('showAllJobs').addEventListener('click',()=>{$('adminJobs').classList.remove('hidden');$('expiredAdminJobs').classList.add('hidden');});$('showExpiredJobs').addEventListener('click',()=>{$('adminJobs').classList.add('hidden');$('expiredAdminJobs').classList.remove('hidden');});
function clearForm(){editingId=null;$('jobForm').reset();$('editId').value='';if($('fDescriptionEditor'))$('fDescriptionEditor').innerHTML='';msg('formMessage','');}
function normalizeDuplicateUrl(value){try{const u=new URL(String(value||'').trim());u.hash='';u.search='';return u.toString().replace(/\/$/,'').toLowerCase();}catch{return String(value||'').trim().replace(/\/$/,'').toLowerCase();}}
function normalizeDuplicateText(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
async function findExistingJobDuplicate(record,excludeId=null){
 const {data,error}=await client.from('jobs').select('id,title,organization,source_url,status');
 if(error)throw error;
 const url=normalizeDuplicateUrl(record.source_url);
 const title=normalizeDuplicateText(record.title),org=normalizeDuplicateText(record.organization);
 return (data||[]).find(job=>job.id!==excludeId&&(
  (url&&normalizeDuplicateUrl(job.source_url)===url)||
  (title&&org&&normalizeDuplicateText(job.title)===title&&normalizeDuplicateText(job.organization)===org)
 ))||null;
}
$('jobForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const record={title:val('fTitle'),organization:val('fOrg'),category:val('fCategory'),location_scope:val('fLocationScope'),city:val('fCity'),country:val('fCountry')||null,remote_eligibility:val('fRemoteEligibility')||null,work_arrangement:val('fWorkArrangement')||null,visa_work_authorization:val('fVisaInfo')||null,area:val('fArea')||null,qualification:val('fQualification'),experience:val('fExperience')||null,employment_type:val('fEmploymentType')||null,salary:val('fSalary')||null,deadline:val('fDeadline')||null,source:val('fSource')||null,source_url:val('fSourceUrl')||null,apply_url:val('fApplyUrl')||null,description:getJobDescriptionHtml()||null,status:val('fStatus')};const scope=record.location_scope;if(scope==='local'&&!['Islamabad','Rawalpindi'].includes(normalizeCity(record.city))){msg('formMessage','For Local jobs, city must be Islamabad or Rawalpindi. Choose International or Remote for other locations.');return;}if(scope==='international'&&!record.country){msg('formMessage','Please enter the country for an International / Overseas job.');return;}if(['remote_pakistan','remote_worldwide'].includes(scope)&&!record.remote_eligibility){msg('formMessage','Please state who is eligible to apply for this remote job.');return;}let result;if(editingId){result=await client.from('jobs').update(record).eq('id',editingId);}else{try{const duplicate=await findExistingJobDuplicate(record);if(duplicate){msg('formMessage','Possible duplicate found: "'+duplicate.title+'" at '+duplicate.organization+' already exists (status: '+duplicate.status+'). Review the existing listing before adding another.');if(confirm('A matching job already exists. Would you like to open that existing listing for review instead?'))editJob(duplicate);return;}}catch(error){msg('formMessage','Could not check for duplicates, so the job was not saved: '+error.message);return;}result=await client.from('jobs').insert(record);}if(result.error){msg('formMessage','Could not save: '+result.error.message);return;}msg('formMessage','Job saved to the online database.');clearForm();await loadAdminJobs();});
async function loadAdminJobs(){
 const box=$('adminJobs'),expiredBox=$('expiredAdminJobs');
 box.innerHTML='<p>Loading listings…</p>';expiredBox.innerHTML='<p>Loading expired listings…</p>';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());
 const {error:expiryError}=await client.from('jobs').update({status:'expired'}).eq('status','published').not('deadline','is',null).lt('deadline',today);
 const {data,error}=await client.from('jobs').select('*').order('created_at',{ascending:false});
 if(error){box.innerHTML='<div class="info-card"><p>Could not load jobs: '+esc(error.message)+'</p></div>';expiredBox.innerHTML='<div class="info-card"><p>Could not load expired jobs: '+esc(error.message)+'</p></div>';return;}
 const expired=(data||[]).filter(j=>j.status==='expired'||(j.status==='published'&&j.deadline&&j.deadline<today));
 const active=(data||[]).filter(j=>!expired.includes(j));
 const render=(items,target,isExpired)=>{
  if(!items.length){target.innerHTML='<div class="info-card"><p>'+(isExpired?'There are no expired jobs.':'No active, draft or archived jobs found.')+'</p></div>';return;}
  target.innerHTML=items.map(j=>'<div class="admin-row"><div><strong>'+esc(j.title)+'</strong><span>'+esc(j.organization)+' · '+esc(j.city)+' · '+esc(j.category)+'</span><span>Deadline: '+esc(j.deadline||'Not specified')+'</span><span class="status-pill">'+esc(j.status)+'</span></div><div class="admin-actions"><button class="secondary-btn" data-edit="'+j.id+'">Edit</button>'+(isExpired?'<button class="secondary-btn" data-restore="'+j.id+'">Restore</button>':'')+'<button class="danger-btn" data-delete="'+j.id+'">Delete</button></div></div>').join('');
  target.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editJob(items.find(j=>j.id===b.dataset.edit))));
  target.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteJob(b.dataset.delete)));
  target.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',()=>restoreJob(items.find(j=>j.id===b.dataset.restore))));
 };
 render(active,box,false);render(expired,expiredBox,true);
 if(expiryError)expiredBox.insertAdjacentHTML('afterbegin','<div class="info-card"><p>Some published jobs could not be automatically marked as expired: '+esc(expiryError.message)+'. Please check the jobs status migration and administrator permissions in Supabase.</p></div>');
}
async function restoreJob(job){
 if(!job)return;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());
 const suggested=job.deadline&&job.deadline>=today?job.deadline:'';
 const newDeadline=prompt('Enter the new application deadline (YYYY-MM-DD) to restore this job:',suggested);
 if(newDeadline===null)return;
 const deadline=newDeadline.trim();
 const parts=deadline.split('-').map(Number);
 const parsed=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(deadline)&&parts.length===3&&parsed.getUTCFullYear()===parts[0]&&parsed.getUTCMonth()===parts[1]-1&&parsed.getUTCDate()===parts[2];
 if(!validDate||deadline<today){
  alert('Please enter a valid deadline that is today or a future date, using YYYY-MM-DD.');
  return;
 }
 if(!confirm('Restore this job as Published with deadline '+deadline+'? It will become visible on the public website.'))return;
 const {error}=await client.from('jobs').update({status:'published',deadline}).eq('id',job.id);
 if(error){alert('Could not restore this job: '+error.message);return;}
 await loadAdminJobs();
}
function editJob(j){if(!j)return;editingId=j.id;const fields={fTitle:'title',fOrg:'organization',fCategory:'category',fLocationScope:'location_scope',fCity:'city',fCountry:'country',fRemoteEligibility:'remote_eligibility',fWorkArrangement:'work_arrangement',fVisaInfo:'visa_work_authorization',fArea:'area',fQualification:'qualification',fExperience:'experience',fEmploymentType:'employment_type',fSalary:'salary',fDeadline:'deadline',fSource:'source',fSourceUrl:'source_url',fApplyUrl:'apply_url',fDescription:'description',fStatus:'status'};Object.entries(fields).forEach(([id,key])=>{if(id==='fDescription'){$(id).value=j[key]??'';if($('fDescriptionEditor'))$('fDescriptionEditor').innerHTML=sanitizeJobDescription(j[key]??'');}else $(id).value=j[key]??'';});$('editId').value=j.id;msg('formMessage','Editing existing listing.');$('jobForm').scrollIntoView({behavior:'smooth',block:'start'});}
async function deleteJob(id){if(!confirm('Permanently delete this job listing?'))return;const {error}=await client.from('jobs').delete().eq('id',id);if(error)alert('Delete failed: '+error.message);else await loadAdminJobs();}
init();

// Contact details editor. Only authorized portal administrators can save changes.
const contactFields={cEmail:'email',cPhone:'phone',cAddress:'address',cFacebook:'facebook_url',cInstagram:'instagram_url',cWebsite:'website_url',cExtra:'extra'};
async function loadContactSettings(){
  const {data,error}=await client.from('portal_contact').select('*').eq('id',1).maybeSingle();
  if(error){msg('contactMessage','Could not load contact details. Please run portal-contact-setup.sql in Supabase first.');return;}
  Object.entries(contactFields).forEach(([id,key])=>$(id).value=data?.[key]||'');
  msg('contactMessage',data?'Saved contact details loaded.':'No contact details saved yet.');
}
$('contactForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const record={id:1};
  Object.entries(contactFields).forEach(([id,key])=>record[key]=val(id)||null);
  msg('contactMessage','Saving contact details…');
  const {error}=await client.from('portal_contact').upsert(record,{onConflict:'id'});
  msg('contactMessage',error?'Could not save: '+error.message:'Contact information saved. It will appear on the public website.');
});
$('refreshContactBtn')?.addEventListener('click',loadContactSettings);

// Candidate directory. RLS allows this read only to authorized portal administrators.
async function loadCandidateUsers(){
 const box=$('candidateUsers');if(!box||!client)return;
 box.innerHTML='<p>Loading registered candidates…</p>';
 const {data,error}=await client.from('profiles').select('user_id,full_name,email,phone,city,created_at').order('created_at',{ascending:false});
 if(error){box.textContent='Could not load users: '+error.message+' (Run candidate-setup.sql in Supabase first.)';return;}
 if(!data?.length){box.innerHTML='<p>No candidate accounts have registered yet.</p>';return;}
 box.innerHTML='<div class="admin-list">'+data.map(u=>`<div class="admin-row"><div><strong>${esc(u.full_name||'Name not provided')}</strong><span>${esc(u.email||'No email')} · ${esc(u.phone||'No phone')} · ${esc(u.city||'City not provided')}</span><span>Registered: ${u.created_at?new Date(u.created_at).toLocaleDateString():'—'}</span><span class="status-pill">Candidate</span></div><div class="admin-actions"><button class="secondary-btn" type="button" data-cv-user="${esc(u.user_id)}">View CV</button></div></div>`).join('')+'</div>';
 box.querySelectorAll('[data-cv-user]').forEach(btn=>btn.addEventListener('click',async()=>{
   const {data:cv,error}=await client.from('cv_profiles').select('*').eq('user_id',btn.dataset.cvUser).maybeSingle();
   if(error){alert('Could not load CV: '+error.message);return;}
   if(!cv){alert('This candidate has not created a CV yet.');return;}
   const w=window.open('','_blank');if(!w){alert('Allow pop-ups to view the CV.');return;}
   const esc2=v=>esc(v||'').replace(/\\n/g,'<br>');
   w.document.write('<!doctype html><html><head><title>Candidate CV</title><style>body{font:14px Arial;max-width:800px;margin:40px auto;line-height:1.5;color:#183650}h1{color:#082f55}h2{color:#0878c9;border-bottom:1px solid #ddd}</style></head><body><h1>'+esc2(cv.full_name)+'</h1><p>'+esc2(cv.email)+' · '+esc2(cv.phone)+' · '+esc2(cv.city)+'</p>'+[['Professional Profile','summary'],['Education','education'],['Work Experience','experience'],['Skills','skills'],['Languages','languages'],['Certifications','certifications'],['References','references_text']].map(([t,k])=>cv[k]?'<h2>'+t+'</h2><p>'+esc2(cv[k])+'</p>':'').join('')+'</body></html>');
   w.document.close();
 }));
}
if($('refreshUsersBtn'))$('refreshUsersBtn').addEventListener('click',loadCandidateUsers);


// Excel bulk import: preview and validate workbook rows before inserting as drafts.
let excelImportRows=[];
const excelHeaders=['title','organization','category','location_scope','city','country','remote_eligibility','work_arrangement','visa_work_authorization','area','qualification','experience','employment_type','salary','deadline','source','source_url','apply_url','description'];
const normalizeExcelHeader=s=>String(s??'').trim().toLowerCase().replace(/[ _-]+/g,'');
function excelDate(value){
 if(value===null||value===undefined||value==='')return null;
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 if(typeof value==='number'&&window.XLSX?.SSF)return XLSX.SSF.format('yyyy-mm-dd',value);
 const d=new Date(String(value));return isNaN(d)?null:d.toISOString().slice(0,10);
}
function excelCell(row,key){const found=Object.keys(row).find(k=>normalizeExcelHeader(k)===normalizeExcelHeader(key));return found===undefined?'':String(row[found]??'').trim();}
function normalizeCategory(v){
 const s=String(v||'').trim().toLowerCase();
 if(s.includes('government')||s.includes('govt'))return 'Government';
 if(s.includes('private'))return 'Private';
 if(s.includes('news')||s.includes('newspaper'))return 'Newspaper';
 if(s.includes('intern'))return 'Internship';
 if(s.includes('ngo')||s.includes('development'))return 'NGO / Development';
 return '';
}
function normalizeCity(v){
 const s=String(v||'').trim().toLowerCase();
 if(s.includes('islamabad'))return 'Islamabad';
 if(s.includes('rawalpindi')||s==='pindi')return 'Rawalpindi';
 return '';
}
function makeExcelTemplate(){
 const rows=[['title','organization','category','location_scope','city','country','remote_eligibility','work_arrangement','visa_work_authorization','area','qualification','experience','employment_type','salary','deadline','source','source_url','apply_url','description'],
 ['Assistant (BPS-15)','Example Department','Government','local','Islamabad','Pakistan','','On-site','','G-5',"Bachelor's",'2 Years','Full-time','','2026-12-31','National Jobs Portal','https://njp.gov.pk/jobs/','https://njp.gov.pk/jobs/','Paste the verified job description here'],
 ['Project Officer','Example International NGO','NGO / Development','international','Dubai','United Arab Emirates','','On-site','Employer to confirm visa sponsorship','','Bachelor’s','3 Years','Full-time','','2026-12-31','Employer careers page','https://example.org/jobs/','https://example.org/apply/','Example only — replace with a verified vacancy'],
 ['Remote Research Assistant','Example Employer','Private','remote_pakistan','Remote','Pakistan','Applicants residing in Pakistan','Remote','','','Bachelor’s','1 Year','Contract','','2026-12-31','Employer careers page','https://example.org/remote-role/','https://example.org/apply/','Example only — replace with a verified vacancy']];
 const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Jobs');XLSX.writeFile(wb,'Caritas-Jobs-Import-Template.xlsx');
}
$('downloadExcelTemplate')?.addEventListener('click',()=>{if(!window.XLSX){msg('excelImportMessage','Excel library is still loading. Refresh and try again.');return;}makeExcelTemplate();});
$('jobsExcelFile')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];excelImportRows=[];$('excelPreview').innerHTML='';$('importExcelJobs').classList.add('hidden');$('importExcelJobs').disabled=true;
 if(!file)return;
 if(!window.XLSX){msg('excelImportMessage','Excel reader could not load. Check your internet connection and refresh.');return;}
 try{
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
  const sheet=wb.Sheets.Jobs||wb.Sheets[wb.SheetNames[0]];
  if(!sheet)throw new Error('The workbook has no worksheet.');
  const raw=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});
  if(!raw.length)throw new Error('No job rows were found. Put column headings in the first row.');
  const seen=new Set();
  excelImportRows=raw.map((r,i)=>{
   const rec={};excelHeaders.forEach(k=>rec[k]=excelCell(r,k)||null);
   rec.category=normalizeCategory(rec.category);rec.location_scope=String(rec.location_scope||'local').trim().toLowerCase();rec.city=String(rec.city||'').trim();rec.country=String(rec.country||'').trim()||null;rec.remote_eligibility=String(rec.remote_eligibility||'').trim()||null;rec.work_arrangement=String(rec.work_arrangement||'').trim()||null;rec.visa_work_authorization=String(rec.visa_work_authorization||'').trim()||null;rec.employment_type=String(rec.employment_type||'').trim()||null;rec.deadline=excelDate(r[Object.keys(r).find(k=>normalizeExcelHeader(k)==='deadline')]);
   rec.status='draft';
   const errors=[];
   if(!rec.title)errors.push('Missing title');if(!rec.organization)errors.push('Missing organization');
   if(!rec.category)errors.push('Category must be Government, Private, Newspaper, Internship or NGO / Development');
   if(!rec.city)errors.push('Missing city/location');if(!['local','international','remote_pakistan','remote_worldwide'].includes(rec.location_scope))errors.push('Invalid location_scope');if(rec.location_scope==='local'&&!['Islamabad','Rawalpindi'].includes(normalizeCity(rec.city)))errors.push('Local city must be Islamabad or Rawalpindi');if(rec.location_scope==='international'&&!rec.country)errors.push('International jobs need a country');if(['remote_pakistan','remote_worldwide'].includes(rec.location_scope)&&!rec.remote_eligibility)errors.push('Remote jobs need explicit eligibility');if(!rec.qualification)errors.push('Missing qualification');
   if(rec.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(rec.deadline))errors.push('Invalid deadline');
   const key=rec.source_url||((rec.title||'').toLowerCase()+'|'+(rec.organization||'').toLowerCase());
   if(seen.has(key))errors.push('Duplicate row in this workbook');seen.add(key);
   return {record:rec,row:i+2,errors};
  });
  const good=excelImportRows.filter(x=>!x.errors.length).length;
  msg('excelImportMessage',`Read ${raw.length} rows: ${good} valid, ${raw.length-good} need correction. All imports will be Draft.`);
  $('excelPreview').innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr><th>Excel row</th><th>Job title</th><th>Organization</th><th>City</th><th>Check</th></tr></thead><tbody>'+excelImportRows.map(x=>'<tr><td>'+x.row+'</td><td>'+esc(x.record.title||'—')+'</td><td>'+esc(x.record.organization||'—')+'</td><td>'+esc(x.record.city||'—')+'</td><td style="color:'+(x.errors.length?'#b42318':'#16803c')+'">'+esc(x.errors.join('; ')||'Ready')+'</td></tr>').join('')+'</tbody></table></div>';
  $('importExcelJobs').classList.remove('hidden');$('importExcelJobs').disabled=good===0;
 }catch(err){msg('excelImportMessage','Could not read workbook: '+err.message);}
});
$('importExcelJobs')?.addEventListener('click',async()=>{
 if(!client)return;
 const valid=excelImportRows.filter(x=>!x.errors.length).map(x=>x.record);
 if(!valid.length)return;
 if(!confirm('Import '+valid.length+' valid job(s) as Draft? They will not appear publicly until you publish them.'))return;
 $('importExcelJobs').disabled=true;msg('excelImportMessage','Checking existing listings and importing…');
 let existing=[];
 const {data:existingJobs,error:duplicateCheckError}=await client.from('jobs').select('id,title,organization,source_url');
 if(duplicateCheckError){msg('excelImportMessage','Could not check existing jobs for duplicates: '+duplicateCheckError.message);$('importExcelJobs').disabled=false;return;}
 existing=existingJobs||[];
 const fresh=valid.filter(record=>!existing.some(job=>{
  const sameUrl=record.source_url&&normalizeDuplicateUrl(record.source_url)===normalizeDuplicateUrl(job.source_url);
  const sameTitleOrg=normalizeDuplicateText(record.title)===normalizeDuplicateText(job.title)&&normalizeDuplicateText(record.organization)===normalizeDuplicateText(job.organization);
  return sameUrl||sameTitleOrg;
 }));
 const skipped=valid.length-fresh.length;
 if(!fresh.length){msg('excelImportMessage','No new jobs imported: all valid rows match existing listings by source URL or job title and organization.');$('importExcelJobs').disabled=false;return;}
 const {error}=await client.from('jobs').insert(fresh);
 if(error){msg('excelImportMessage','Import failed: '+error.message);$('importExcelJobs').disabled=false;return;}
 msg('excelImportMessage',`Successfully imported ${fresh.length} job(s) as Draft. ${skipped} possible duplicate(s) were skipped based on source URL or job title and organization.`);
 $('jobsExcelFile').value='';$('excelPreview').innerHTML='';excelImportRows=[];await loadAdminJobs();
});

async function sendAdminPasswordReset(){const email=val('email');if(!email){msg('loginMessage','Enter your administrator email address first.');return;}msg('loginMessage','Requesting password reset…');try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/admin.html'});msg('loginMessage',error?error.message:'If this email belongs to an administrator account, a password reset link has been sent. Check your inbox and spam folder.');}catch(error){msg('loginMessage','Could not reach the password reset service. Check your internet connection and try again.');console.error(error);}}
async function saveAdminNewPassword(e){e.preventDefault();const password=$('adminNewPassword').value;if(password.length<8){msg('adminRecoveryMessage','Use at least 8 characters.');return;}msg('adminRecoveryMessage','Saving new password…');try{const {error}=await client.auth.updateUser({password});if(error){msg('adminRecoveryMessage',error.message);return;}msg('adminRecoveryMessage','Password updated. Signing you in…');$('adminRecoveryPanel').classList.add('hidden');await checkSession();}catch(error){msg('adminRecoveryMessage','Could not update the password. Please open the reset link again and retry.');console.error(error);}}


// Staff-assisted job-source collection helpers. These controls only prefill
// the source name; staff must paste the exact vacancy URL and verify the job.
document.querySelectorAll('[data-source-name]').forEach(button=>{
 button.addEventListener('click',()=>{
  const field=document.getElementById('fSource');
  if(field){field.value=button.dataset.sourceName||'';field.focus();}
  document.getElementById('jobForm')?.scrollIntoView({behavior:'smooth',block:'start'});
  const note=document.getElementById('formMessage');
  if(note)note.textContent='Source selected. Paste the exact vacancy page URL in Source URL after checking the original advertisement.';
 });
});
document.getElementById('sourceGoToJobForm')?.addEventListener('click',()=>{
 document.getElementById('jobForm')?.scrollIntoView({behavior:'smooth',block:'start'});
 document.getElementById('fTitle')?.focus({preventScroll:true});
});
document.getElementById('sourceGoToExcel')?.addEventListener('click',()=>{
 document.getElementById('excelImportPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
});


// Remember the administrator's position while the authenticated panel is in use.
// The position is scoped to this browser tab and never stores form contents or credentials.
const ADMIN_SCROLL_KEY='cpir_admin_scroll_y';
let adminScrollSaveFrame=0;
function saveAdminScrollPosition(){
 if(!$('adminPanel')||$('adminPanel').classList.contains('hidden'))return;
 if(adminScrollSaveFrame)return;
 adminScrollSaveFrame=requestAnimationFrame(()=>{
  adminScrollSaveFrame=0;
  try{sessionStorage.setItem(ADMIN_SCROLL_KEY,String(Math.max(0,window.scrollY||window.pageYOffset||0)));}catch{}
 });
}
function restoreAdminScrollPosition(){
 let saved=0;
 try{saved=Number(sessionStorage.getItem(ADMIN_SCROLL_KEY)||0);}catch{}
 if(!Number.isFinite(saved)||saved<0)return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:saved,behavior:'auto'})));
}
window.addEventListener('scroll',saveAdminScrollPosition,{passive:true});
window.addEventListener('pagehide',saveAdminScrollPosition);
window.addEventListener('pageshow',()=>{if($('adminPanel')&&!$('adminPanel').classList.contains('hidden'))restoreAdminScrollPosition();});


// Rich-text job description editor: preserve readable text and basic structure
// from external job pages while removing source-site styling and unsafe markup.
function sanitizeJobDescription(value){
 const source=String(value||'');
 if(!/[<][a-z][^>]*>/i.test(source))return escapeJobText(source).replace(/\r?\n/g,'<br>');
 const doc=new DOMParser().parseFromString(source,'text/html');
 const allowed=new Set(['B','STRONG','I','EM','BR','P','UL','OL','LI']);
 const blockTags=new Set(['DIV','SECTION','ARTICLE','HEADER','FOOTER','H1','H2','H3','H4','H5','H6','ADDRESS','BLOCKQUOTE']);
 const clean=node=>{
  let out='';
  node.childNodes.forEach(child=>{
   if(child.nodeType===3){out+=escapeJobText(child.nodeValue);}
   else if(child.nodeType===1){
    const tag=child.tagName;
    if(['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME','OBJECT'].includes(tag))return;
    if(tag==='TR'){
     const cells=Array.from(child.children).filter(cell=>['TD','TH'].includes(cell.tagName)).map(cell=>clean(cell)).filter(Boolean);
     if(cells.length)out+='<p>'+cells.join(' | ')+'</p>';
     return;
    }
    const inner=clean(child);
    if(allowed.has(tag))out+='<'+tag.toLowerCase()+'>'+inner+'</'+tag.toLowerCase()+'>';
    else if(blockTags.has(tag)&&inner.trim())out+='<p>'+inner+'</p>';
    else if(['TD','TH'].includes(tag))out+=inner+' | ';
    else out+=inner;
   }
  });
  return out;
 };
 return clean(doc.body).replace(/(?:<br>\s*){3,}/g,'<br><br>').replace(/<p>\s*<\/p>/g,'');
}
function escapeJobText(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function getJobDescriptionHtml(){const editor=$('fDescriptionEditor');if(!editor)return val('fDescription');const safe=sanitizeJobDescription(editor.innerHTML);$('fDescription').value=safe;return safe;}
function initJobDescriptionEditor(){
 const editor=$('fDescriptionEditor');if(!editor)return;
 let savedRange=null;
 const rememberSelection=()=>{
  const selection=window.getSelection();
  if(!selection||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);
  if(editor.contains(range.commonAncestorContainer))savedRange=range.cloneRange();
 };
 editor.addEventListener('keyup',rememberSelection);
 editor.addEventListener('mouseup',rememberSelection);
 editor.addEventListener('touchend',rememberSelection);
 editor.addEventListener('input',()=>{rememberSelection();getJobDescriptionHtml();});
 // Paste clean, readable job text instead of inheriting pale colours, highlights,
 // tiny fonts or layout styles from NJP and other source websites.
 editor.addEventListener('paste',event=>{
  const clipboard=event.clipboardData;
  if(!clipboard)return;
  const html=clipboard.getData('text/html');
  const plain=clipboard.getData('text/plain');
  const cleaned=html?sanitizeJobDescription(html):escapeJobText(plain).replace(/\r?\n/g,'<br>');
  if(!cleaned)return;
  event.preventDefault();
  editor.focus();
  const selection=window.getSelection();
  let range=null;
  if(selection&&selection.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer))range=selection.getRangeAt(0);
  if(!range){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
  range.deleteContents();
  const fragment=range.createContextualFragment(cleaned);
  const last=fragment.lastChild;
  range.insertNode(fragment);
  if(last){range.setStartAfter(last);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}
  rememberSelection();
  getJobDescriptionHtml();
 });
 document.addEventListener('selectionchange',rememberSelection);
 document.querySelectorAll('[data-format]').forEach(button=>{
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('click',()=>{
   editor.focus();
   const selection=window.getSelection();
   if(savedRange&&selection){
    selection.removeAllRanges();
    selection.addRange(savedRange);
   }
   document.execCommand(button.dataset.format,false,null);
   rememberSelection();
   getJobDescriptionHtml();
  });
 });
}
initJobDescriptionEditor();



 // Safe test fixtures: no external websites are contacted and demo rows cannot become live jobs.
 $('loadCollectorSamples')?.addEventListener('click',async()=>{
  if(!client)return;
  const button=$('loadCollectorSamples');button.disabled=true;
  msg('fetchedJobsMessage','Preparing sample vacancies…');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());
  const plusDays=n=>{const d=new Date(today+'T12:00:00+05:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const fixtures=[
   {source_name:'DEMO SAMPLE DATA',external_id:'CPIR-DEMO-001',title:'Junior Office Assistant (Sample)',organization:'Example Training Organization',category:'Private',city:'Islamabad',area:'Blue Area',qualification:'Intermediate',experience:'Fresh candidates may apply',employment_type:'Full-time',salary:'PKR 35,000–45,000 (sample only)',posted_date:today,deadline:plusDays(60),source_url:'https://example.com/demo-vacancy-001',apply_url:'https://example.com/demo-apply-001',description:'TEST DATA ONLY. Fictional vacancy to test the Smart Job Collector. Do not contact or pay this organization.',is_demo:true,review_status:'needs_review',review_notes:'Demo fixture: not a real vacancy. Must never be imported into live jobs.',raw_data:{demo:true,fixture_version:1}},
   {source_name:'DEMO SAMPLE DATA',external_id:'CPIR-DEMO-002',title:'Community Mobilizer (Sample)',organization:'Example Community Services',category:'NGO',city:'Rawalpindi',area:'Saddar',qualification:'Bachelor degree preferred',experience:'1 year (sample)',employment_type:'Contract',salary:'Sample only',posted_date:today,deadline:plusDays(75),source_url:'https://example.com/demo-vacancy-002',apply_url:'https://example.com/demo-apply-002',description:'TEST DATA ONLY. Fictional Rawalpindi vacancy for testing queue review and Excel export.',is_demo:true,review_status:'needs_review',review_notes:'Demo fixture: not a real vacancy. Must never be imported into live jobs.',raw_data:{demo:true,fixture_version:1}},
   {source_name:'DEMO SAMPLE DATA',external_id:'CPIR-DEMO-003',title:'Data Entry Operator (Out-of-region test)',organization:'Example Testing Company',category:'Private',city:'Lahore',area:'Test location',qualification:'Matriculation',experience:'Not required',employment_type:'Full-time',salary:'Sample only',posted_date:today,deadline:plusDays(90),source_url:'https://example.com/demo-vacancy-003',apply_url:'https://example.com/demo-apply-003',description:'TEST DATA ONLY. Fictional Lahore listing used to verify the region restriction.',is_demo:true,review_status:'rejected',review_notes:'Demo test: outside the portal region (Rawalpindi/Islamabad only).',raw_data:{demo:true,fixture_version:1}}
  ];
  try{
   const lookup=await client.from('fetched_jobs').select('external_id').eq('source_name','DEMO SAMPLE DATA');
   if(lookup.error)throw lookup.error;
   const known=new Set((lookup.data||[]).map(x=>x.external_id));
   const missing=fixtures.filter(x=>!known.has(x.external_id));
   if(missing.length){const result=await client.from('fetched_jobs').insert(missing);if(result.error)throw result.error;}
   const run=await client.from('collector_runs').insert({run_mode:'sample',status:'succeeded',items_seen:fixtures.length,items_inserted:missing.length,items_duplicates:fixtures.length-missing.length,items_out_of_region:1,summary:'Sample fixture load. No external websites were contacted.'});
   if(run.error)throw run.error;
   msg('fetchedJobsMessage',missing.length+' sample vacancy/vacancies added; '+(fixtures.length-missing.length)+' already existed. No external source was contacted. Demo records are blocked from Draft import.');
   await loadFetchedJobs();
  }catch(error){
   msg('fetchedJobsMessage','Could not load sample data. Apply supabase/migrations/smart-job-collector-engine-setup.sql first. Details: '+error.message);
  }finally{button.disabled=false;}
 });

// Admin-managed source registry. Approval is an explicit administrator action;
// sources remain disabled by default and no browser-side scraping is performed.
const collectorSourceLabels={
 njp:"National Jobs Portal",rozee:"ROZEE.PK",mustakbil:"Mustakbil",
 indeed:"Indeed Pakistan",newspapers:"Newspaper vacancy feeds",employers:"Employer career pages and feeds"
};
const collectorMethodLabels={not_configured:"Not configured",rss:"RSS feed",api:"Official API",partner_feed:"Approved partner feed",email_alert:"Authorized email alert",manual_test:"Manual test only"};
const collectorStatusLabels={permission_pending:"Permission pending",approved:"Approved",not_permitted:"Not permitted",testing:"Testing"};
async function loadCollectorSources(){
 const box=$("collectorSourcesList");if(!box||!client)return;
 box.innerHTML="<p>Loading source registry…</p>";
 const {data,error}=await client.from("collector_sources").select("*").order("display_name");
 if(error){box.innerHTML='<div class="source-notice">Source Registry could not load. Confirm that <strong>smart-job-collector-engine-setup.sql</strong> was run successfully. Details: '+esc(error.message)+'</div>';return;}
 if(!data||!data.length){box.innerHTML='<div class="source-notice">No source records found. Run the Smart Job Collector engine setup migration.</div>';return;}
 box.innerHTML=data.map(source=>{
  const methodOptions=Object.entries(collectorMethodLabels).map(([value,label])=>'<option value="'+value+'" '+(source.access_method===value?'selected':'')+'>'+label+'</option>').join("");
  const statusOptions=Object.entries(collectorStatusLabels).map(([value,label])=>'<option value="'+value+'" '+(source.access_status===value?'selected':'')+'>'+label+'</option>').join("");
  return '<article class="source-card" data-collector-source="'+esc(source.source_key)+'"><h3>'+esc(source.display_name)+'</h3><p>Access status: <span class="status-pill">'+esc(collectorStatusLabels[source.access_status]||source.access_status)+'</span> '+(source.enabled?'<span class="status-pill">Enabled</span>':'<span class="status-pill">Disabled</span>')+(source.schedule_enabled?' <span class="status-pill">Daily schedule requested</span>':'')+'</p>'+
   '<label>Connection method<select data-field="access_method">'+methodOptions+'</select></label>'+
   '<label>Permission status<select data-field="access_status">'+statusOptions+'</select></label>'+
   '<label>Approved feed / API URL<input data-field="feed_url" type="url" maxlength="1000" placeholder="https://… (only an authorized feed/API)" value="'+esc(source.feed_url||'')+'"></label>'+
   '<label>Admin notes<textarea data-field="notes" rows="2" maxlength="1200" placeholder="Permission reference, contact, restrictions…">'+esc(source.notes||'')+'</textarea></label>'+
   '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input data-field="enabled" type="checkbox" '+(source.enabled?'checked':'')+'> Enable this source for a future approved connector</label>'+
   '<label style="display:flex;gap:8px;align-items:center"><input data-field="schedule_enabled" type="checkbox" '+(source.schedule_enabled?'checked':'')+'> Include in daily schedule (after connector is deployed)</label>'+
   '<button type="button" class="secondary-btn" data-save-collector-source="'+esc(source.source_key)+'">Save source settings</button>'+
   '<p class="source-footnote">'+(source.last_checked_at?'Last checked: '+esc(new Date(source.last_checked_at).toLocaleString()):'Not checked yet')+(source.last_error?' · Last error: '+esc(source.last_error):'')+'</p></article>';
 }).join("");
 box.querySelectorAll("[data-save-collector-source]").forEach(button=>button.addEventListener("click",async()=>{
  const card=button.closest("[data-collector-source]");const read=name=>card.querySelector('[data-field="'+name+'"]');
  const method=read("access_method").value,status=read("access_status").value;
  const enabled=read("enabled").checked,schedule=read("schedule_enabled").checked;
  const feedUrl=read("feed_url").value.trim();
  if(enabled&&status!=="approved"){alert("This source cannot be enabled until its access status is Approved.");return;}
  if(schedule&&!enabled){alert("Enable the source before adding it to the daily schedule.");return;}
  if(enabled&&["rss","api","partner_feed","email_alert"].includes(method)&&!/^https:\/\//i.test(feedUrl)){alert("Enter the HTTPS URL of the approved feed/API before enabling this source.");return;}
  if(enabled&&method==="not_configured"){alert("Choose the approved connection method before enabling this source.");return;}
  button.disabled=true;button.textContent="Saving…";
  const payload={access_method:method,access_status:status,feed_url:feedUrl||null,notes:read("notes").value.trim()||null,enabled,schedule_enabled:schedule,updated_at:new Date().toISOString()};
  const {error:saveError}=await client.from("collector_sources").update(payload).eq("source_key",button.dataset.saveCollectorSource);
  button.disabled=false;button.textContent="Save source settings";
  if(saveError){alert("Could not save source settings: "+saveError.message);return;}
  await loadCollectorSources();
  msg("fetchedJobsMessage","Source settings saved. No external collection was started.");
 }));
}
// Smart Job Collector review queue. Source ingestion is server-side and is
// deliberately disabled until each provider's permitted feed/API is configured.
let fetchedJobsCache=[];
async function loadFetchedJobs(){
 const box=$('fetchedJobsList');if(!box||!client)return;
 box.innerHTML='<p>Loading fetched vacancies…</p>';
 const {data,error}=await client.from('fetched_jobs').select('*').order('fetched_at',{ascending:false}).limit(500);
 if(error){
  box.innerHTML='<div class="source-notice">The Smart Job Collector database is not ready yet. Run <strong>supabase/migrations/smart-job-collector-setup.sql</strong> in the Supabase SQL Editor, then refresh this panel. Details: '+esc(error.message)+'</div>';
  $('fetchedJobsMessage').textContent='Collector queue is waiting for its database setup.';
  return;
 }
 fetchedJobsCache=data||[];
 if(!fetchedJobsCache.length){box.innerHTML='<div class="source-workflow"><strong>No fetched vacancies yet.</strong><p>Once an approved source connector is configured and its daily schedule is enabled, matching vacancies will appear here.</p></div>';updateFetchedActions();return;}
 box.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr><th><input type="checkbox" id="selectAllFetched" aria-label="Select all fetched jobs"></th><th>Vacancy</th><th>Location</th><th>Deadline</th><th>Source</th><th>Review status</th></tr></thead><tbody>'+fetchedJobsCache.map(j=>'<tr><td><input type="checkbox" class="fetched-job-check" value="'+esc(j.id)+'" aria-label="Select '+esc(j.title)+'"></td><td><strong>'+esc(j.title||'Title needs checking')+'</strong><br>'+esc(j.organization||'Employer not identified')+'<br>'+(j.source_url?'<a href="'+esc(j.source_url)+'" target="_blank" rel="noopener noreferrer">Original vacancy ↗</a>':'<span>Source link missing</span>')+'</td><td>'+esc(j.city||'Unconfirmed')+'</td><td>'+esc(j.deadline||'Not verified')+'</td><td>'+esc(j.source_name||'Unknown')+(j.is_demo?'<br><span class="status-pill">DEMO — TEST ONLY</span>':'')+'</td><td><span class="status-pill">'+esc(j.review_status||'needs_review')+'</span></td></tr>').join('')+'</tbody></table></div>';
 $('selectAllFetched')?.addEventListener('change',e=>{box.querySelectorAll('.fetched-job-check').forEach(c=>c.checked=e.target.checked);updateFetchedActions();});
 box.querySelectorAll('.fetched-job-check').forEach(c=>c.addEventListener('change',updateFetchedActions));
 updateFetchedActions();
}
function selectedFetchedJobs(){const ids=[...document.querySelectorAll('.fetched-job-check:checked')].map(x=>x.value);return fetchedJobsCache.filter(j=>ids.includes(String(j.id)));}
function updateFetchedActions(){const n=selectedFetchedJobs().length;$('downloadFetchedSelected').disabled=!n;$('reviewFetchedSelected').disabled=!n;$('fetchedJobsMessage').textContent=n?n+' vacancy/vacancies selected.':'Select one or more fetched vacancies to export or move to Draft.';}
$('refreshFetchedJobs')?.addEventListener('click',loadFetchedJobs);
$('downloadFetchedSelected')?.addEventListener('click',()=>{
 const rows=selectedFetchedJobs();if(!rows.length||!window.XLSX)return;
 const headers=['title','organization','category','location_scope','city','country','remote_eligibility','work_arrangement','visa_work_authorization','area','qualification','experience','employment_type','salary','deadline','source','source_url','apply_url','description'];
 const values=[headers,...rows.map(j=>headers.map(k=>k==='source'?(j.source_name||''):j[k]??''))];
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(values),'Jobs');XLSX.writeFile(wb,'Caritas-Fetched-Jobs-Review.xlsx');
});
$('reviewFetchedSelected')?.addEventListener('click',async()=>{
 const rows=selectedFetchedJobs();if(!rows.length||!client)return;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());
 const ready=rows.filter(j=>{if(j.is_demo||!j.title||!j.organization||!j.city||!j.deadline||!/^\d{4}-\d{2}-\d{2}$/.test(j.deadline)||j.deadline<today||!j.source_url)return false;const scope=j.location_scope||'local';if(scope==='local')return ['Islamabad','Rawalpindi'].includes(normalizeCity(j.city));if(scope==='international')return !!j.country;if(scope==='remote_pakistan'||scope==='remote_worldwide')return !!j.remote_eligibility;return false;});
 const skipped=rows.length-ready.length;
 if(!ready.length){msg('fetchedJobsMessage','None selected can be moved to Draft. Demo fixtures are test-only; real vacancies must have a title, employer, Rawalpindi/Islamabad location, valid future deadline and original source URL.');return;}
 if(!confirm('Move '+ready.length+' eligible vacancy/vacancies into Caritas Jobs as Draft? '+skipped+' incomplete or expired item(s) will remain in the collector queue.'))return;
 const existing=await client.from('jobs').select('id,title,organization,source_url');
 if(existing.error){msg('fetchedJobsMessage','Could not check duplicates: '+existing.error.message);return;}
 const fresh=ready.filter(j=>!(existing.data||[]).some(x=>(j.source_url&&normalizeDuplicateUrl(j.source_url)===normalizeDuplicateUrl(x.source_url))||(normalizeDuplicateText(j.title)===normalizeDuplicateText(x.title)&&normalizeDuplicateText(j.organization)===normalizeDuplicateText(x.organization))));
 const records=fresh.map(j=>({title:j.title,organization:j.organization,category:normalizeCategory(j.category)||'Private',location_scope:j.location_scope||'local',city:j.city,country:j.country||null,remote_eligibility:j.remote_eligibility||null,work_arrangement:j.work_arrangement||null,visa_work_authorization:j.visa_work_authorization||null,area:j.area||null,qualification:j.qualification||'Not specified',experience:j.experience||null,employment_type:j.employment_type||null,salary:j.salary||null,deadline:j.deadline,source:j.source_name||null,source_url:j.source_url,apply_url:j.apply_url||j.source_url,description:j.description||null,status:'draft'}));
 if(records.length){const inserted=await client.from('jobs').insert(records);if(inserted.error){msg('fetchedJobsMessage','Could not create Draft jobs: '+inserted.error.message);return;}}
 const ids=ready.map(j=>j.id);if(ids.length){const updated=await client.from('fetched_jobs').update({review_status:'imported'}).in('id',ids);if(updated.error){msg('fetchedJobsMessage','Draft jobs created, but queue status could not be updated: '+updated.error.message);await loadAdminJobs();return;}}
 msg('fetchedJobsMessage',records.length+' new Draft job(s) created. '+(ready.length-records.length)+' duplicate(s) skipped; '+skipped+' incomplete/expired item(s) left for review.');
 await loadFetchedJobs();await loadAdminJobs();
});

// Admin dashboard tabs: keep navigation available while scrolling and show one workspace at a time.
(function bindAdminTabs(){
 const tabs=[...document.querySelectorAll('[data-admin-tab]')];
 const panels=[...document.querySelectorAll('[data-admin-panel]')];
 if(!tabs.length||!panels.length)return;
 function activateAdminTab(name){
  tabs.forEach(tab=>{const active=tab.dataset.adminTab===name;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
  panels.forEach(panel=>{const active=panel.dataset.adminPanel===name;panel.classList.toggle('active',active);});
  window.scrollTo({top:0,behavior:'smooth'});
 }
 tabs.forEach(tab=>tab.addEventListener('click',()=>activateAdminTab(tab.dataset.adminTab)));
})();
