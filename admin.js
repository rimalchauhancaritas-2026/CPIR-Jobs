let client=null,editingId=null;const $=id=>document.getElementById(id);const ready=()=>window.CPIR_CONFIG?.SUPABASE_URL?.startsWith('https://')&&!window.CPIR_CONFIG.SUPABASE_URL.includes('PASTE_')&&window.CPIR_CONFIG.SUPABASE_ANON_KEY&&!window.CPIR_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_');const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));function val(id){return $(id).value.trim()}function msg(id,t){$(id).textContent=t}
function init(){if(!ready()||!window.supabase){$('setupWarning').classList.remove('hidden');$('setupWarning').textContent='Supabase is not configured. Open SETUP-V1.2.md and add your project URL and anon/public key to config.js.';$('loginPanel').classList.add('hidden');return;}client=window.supabase.createClient(CPIR_CONFIG.SUPABASE_URL,CPIR_CONFIG.SUPABASE_ANON_KEY);client.auth.onAuthStateChange(()=>setTimeout(checkSession,0));checkSession();}
async function checkSession(){const {data:{session}}=await client.auth.getSession();$('loginPanel').classList.toggle('hidden',!!session);$('adminPanel').classList.add('hidden');$('signOutBtn').classList.toggle('hidden',!session);if(session){const {data:profile,error}=await client.from('admin_profiles').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!profile){msg('loginMessage','This account is signed in but has not been authorized as a portal administrator. Ask the project owner to grant admin access.');await client.auth.signOut();return;}$('adminPanel').classList.remove('hidden');await loadAdminJobs();await loadContactSettings();await loadCandidateUsers();}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMessage','Signing in…');const {error}=await client.auth.signInWithPassword({email:val('email'),password:$('password').value});msg('loginMessage',error?error.message:'Signed in.');if(!error)await checkSession();});$('signOutBtn').addEventListener('click',async()=>{await client.auth.signOut();});$('clearFormBtn').addEventListener('click',clearForm);$('refreshBtn').addEventListener('click',loadAdminJobs);
function clearForm(){editingId=null;$('jobForm').reset();$('editId').value='';msg('formMessage','');}
$('jobForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const record={title:val('fTitle'),organization:val('fOrg'),category:val('fCategory'),city:val('fCity'),area:val('fArea')||null,qualification:val('fQualification'),experience:val('fExperience')||null,employment_type:val('fEmploymentType')||null,salary:val('fSalary')||null,deadline:val('fDeadline')||null,source:val('fSource')||null,source_url:val('fSourceUrl')||null,apply_url:val('fApplyUrl')||null,description:val('fDescription')||null,status:val('fStatus')};let result;if(editingId)result=await client.from('jobs').update(record).eq('id',editingId);else result=await client.from('jobs').insert(record);if(result.error){msg('formMessage','Could not save: '+result.error.message);return;}msg('formMessage','Job saved to the online database.');clearForm();await loadAdminJobs();});
async function loadAdminJobs(){const box=$('adminJobs');box.innerHTML='<p>Loading listings…</p>';const {data,error}=await client.from('jobs').select('*').order('created_at',{ascending:false});if(error){box.textContent='Could not load jobs: '+error.message;return;}if(!data?.length){box.innerHTML='<div class="info-card"><p>No jobs in the database yet. Add one using the form above.</p></div>';return;}box.innerHTML=data.map(j=>`<div class="admin-row"><div><strong>${esc(j.title)}</strong><span>${esc(j.organization)} · ${esc(j.city)} · ${esc(j.category)}</span><span class="status-pill">${esc(j.status)}</span></div><div class="admin-actions"><button class="secondary-btn" data-edit="${j.id}">Edit</button><button class="danger-btn" data-delete="${j.id}">Delete</button></div></div>`).join('');box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editJob(data.find(j=>j.id===b.dataset.edit))));box.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteJob(b.dataset.delete)));}
function editJob(j){if(!j)return;editingId=j.id;const fields={fTitle:'title',fOrg:'organization',fCategory:'category',fCity:'city',fArea:'area',fQualification:'qualification',fExperience:'experience',fEmploymentType:'employment_type',fSalary:'salary',fDeadline:'deadline',fSource:'source',fSourceUrl:'source_url',fApplyUrl:'apply_url',fDescription:'description',fStatus:'status'};Object.entries(fields).forEach(([id,key])=>$(id).value=j[key]??'');$('editId').value=j.id;msg('formMessage','Editing existing listing.');window.scrollTo({top:0,behavior:'smooth'});}
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
const excelHeaders=['title','organization','category','city','area','qualification','experience','employment_type','salary','deadline','source','source_url','apply_url','description'];
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
 const rows=[['title','organization','category','city','area','qualification','experience','employment_type','salary','deadline','source','source_url','apply_url','description'],
 ['Assistant (BPS-15)','Example Department','Government','Islamabad','G-5',"Bachelor's",'2 Years','Full-time','','2026-12-31','National Jobs Portal','https://njp.gov.pk/jobs/','https://njp.gov.pk/jobs/','Paste the verified job description here']];
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
   rec.category=normalizeCategory(rec.category);rec.city=normalizeCity(rec.city);rec.employment_type=String(rec.employment_type||'').trim()||null;rec.deadline=excelDate(r[Object.keys(r).find(k=>normalizeExcelHeader(k)==='deadline')]);
   rec.status='draft';
   const errors=[];
   if(!rec.title)errors.push('Missing title');if(!rec.organization)errors.push('Missing organization');
   if(!rec.category)errors.push('Category must be Government, Private, Newspaper, Internship or NGO / Development');
   if(!rec.city)errors.push('City must be Islamabad or Rawalpindi');if(!rec.qualification)errors.push('Missing qualification');
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
 const urls=valid.map(x=>x.source_url).filter(Boolean);
 let existing=[];
 if(urls.length){const {data,error}=await client.from('jobs').select('source_url').in('source_url',urls);if(error){msg('excelImportMessage','Could not check duplicates: '+error.message);$('importExcelJobs').disabled=false;return;}existing=(data||[]).map(x=>x.source_url);}
 const fresh=valid.filter(x=>!x.source_url||!existing.includes(x.source_url));
 if(!fresh.length){msg('excelImportMessage','No new jobs imported: all valid source links already exist in the portal.');return;}
 const {error}=await client.from('jobs').insert(fresh);
 if(error){msg('excelImportMessage','Import failed: '+error.message);$('importExcelJobs').disabled=false;return;}
 msg('excelImportMessage',`Successfully imported ${fresh.length} job(s) as Draft. ${valid.length-fresh.length} existing source link(s) were skipped.`);
 $('jobsExcelFile').value='';$('excelPreview').innerHTML='';excelImportRows=[];await loadAdminJobs();
});
