let client=null,editingId=null;const $=id=>document.getElementById(id);const ready=()=>window.CPIR_CONFIG?.SUPABASE_URL?.startsWith('https://')&&!window.CPIR_CONFIG.SUPABASE_URL.includes('PASTE_')&&window.CPIR_CONFIG.SUPABASE_ANON_KEY&&!window.CPIR_CONFIG.SUPABASE_ANON_KEY.includes('PASTE_');const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));function val(id){return $(id).value.trim()}function msg(id,t){$(id).textContent=t}
function init(){if(!ready()||!window.supabase){$('setupWarning').classList.remove('hidden');$('setupWarning').textContent='Supabase is not configured. Open SETUP-V1.2.md and add your project URL and anon/public key to config.js.';$('loginPanel').classList.add('hidden');return;}client=window.supabase.createClient(CPIR_CONFIG.SUPABASE_URL,CPIR_CONFIG.SUPABASE_ANON_KEY);client.auth.onAuthStateChange(()=>setTimeout(checkSession,0));checkSession();}
async function checkSession(){const {data:{session}}=await client.auth.getSession();$('loginPanel').classList.toggle('hidden',!!session);$('adminPanel').classList.add('hidden');$('signOutBtn').classList.toggle('hidden',!session);if(session){const {data:profile,error}=await client.from('admin_profiles').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!profile){msg('loginMessage','This account is signed in but has not been authorized as a portal administrator. Ask the project owner to grant admin access.');await client.auth.signOut();return;}$('adminPanel').classList.remove('hidden');await loadAdminJobs();await loadContactSettings();await loadCandidateUsers();}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMessage','Signing in…');const {error}=await client.auth.signInWithPassword({email:val('email'),password:$('password').value});msg('loginMessage',error?error.message:'Signed in.');if(!error)await checkSession();});$('signOutBtn').addEventListener('click',async()=>{await client.auth.signOut();});$('clearFormBtn').addEventListener('click',clearForm);$('refreshBtn').addEventListener('click',loadAdminJobs);
function clearForm(){editingId=null;$('jobForm').reset();$('editId').value='';msg('formMessage','');}
$('jobForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const record={title:val('fTitle'),organization:val('fOrg'),category:val('fCategory'),city:val('fCity'),area:val('fArea')||null,qualification:val('fQualification'),experience:val('fExperience')||null,salary:val('fSalary')||null,deadline:val('fDeadline')||null,source:val('fSource')||null,source_url:val('fSourceUrl')||null,apply_url:val('fApplyUrl')||null,description:val('fDescription')||null,status:val('fStatus')};let result;if(editingId)result=await client.from('jobs').update(record).eq('id',editingId);else result=await client.from('jobs').insert(record);if(result.error){msg('formMessage','Could not save: '+result.error.message);return;}msg('formMessage','Job saved to the online database.');clearForm();await loadAdminJobs();});
async function loadAdminJobs(){const box=$('adminJobs');box.innerHTML='<p>Loading listings…</p>';const {data,error}=await client.from('jobs').select('*').order('created_at',{ascending:false});if(error){box.textContent='Could not load jobs: '+error.message;return;}if(!data?.length){box.innerHTML='<div class="info-card"><p>No jobs in the database yet. Add one using the form above.</p></div>';return;}box.innerHTML=data.map(j=>`<div class="admin-row"><div><strong>${esc(j.title)}</strong><span>${esc(j.organization)} · ${esc(j.city)} · ${esc(j.category)}</span><span class="status-pill">${esc(j.status)}</span></div><div class="admin-actions"><button class="secondary-btn" data-edit="${j.id}">Edit</button><button class="danger-btn" data-delete="${j.id}">Delete</button></div></div>`).join('');box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editJob(data.find(j=>j.id===b.dataset.edit))));box.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteJob(b.dataset.delete)));}
function editJob(j){if(!j)return;editingId=j.id;const fields={fTitle:'title',fOrg:'organization',fCategory:'category',fCity:'city',fArea:'area',fQualification:'qualification',fExperience:'experience',fSalary:'salary',fDeadline:'deadline',fSource:'source',fSourceUrl:'source_url',fApplyUrl:'apply_url',fDescription:'description',fStatus:'status'};Object.entries(fields).forEach(([id,key])=>$(id).value=j[key]??'');$('editId').value=j.id;msg('formMessage','Editing existing listing.');window.scrollTo({top:0,behavior:'smooth'});}
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
