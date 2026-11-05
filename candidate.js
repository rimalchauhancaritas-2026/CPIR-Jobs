let client=null,currentUser=null;
const $=id=>document.getElementById(id);
const say=(id,msg)=>{if($(id))$(id).textContent=msg;};
function initCandidate(){
 if(!window.supabase||!window.CPIR_CONFIG?.SUPABASE_URL||!window.CPIR_CONFIG?.SUPABASE_ANON_KEY){say('signupMessage','Supabase configuration is missing.');return;}
 client=window.supabase.createClient(CPIR_CONFIG.SUPABASE_URL,CPIR_CONFIG.SUPABASE_ANON_KEY);
 $('showSignup').onclick=()=>{ $('signupForm').classList.remove('hidden');$('loginForm').classList.add('hidden');$('showSignup').classList.add('selected');$('showLogin').classList.remove('selected');};
 $('showLogin').onclick=()=>{ $('loginForm').classList.remove('hidden');$('signupForm').classList.add('hidden');$('showLogin').classList.add('selected');$('showSignup').classList.remove('selected');};
 $('signupForm').addEventListener('submit',signup);
 $('loginForm').addEventListener('submit',login);
 $('candidateSignOut').onclick=async()=>{await client.auth.signOut();};
 $('resetPassword').onclick=resetPassword;
 $('cvForm').addEventListener('submit',saveCv);
 $('downloadCv').onclick=downloadCv; $('downloadWord').onclick=downloadWord;
 client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>showSession(session),0);});
 client.auth.getSession().then(({data})=>showSession(data.session));
}
async function signup(e){e.preventDefault();say('signupMessage','Creating account…');
 const name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),password=$('signupPassword').value;
 const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:'https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/candidate.html'}});
 if(error){say('signupMessage',error.message);return;}
 if(data.session){say('signupMessage','Account created. You are now signed in.');}
 else{say('signupMessage','Account created. Check your email for a confirmation link, then sign in.');}
}
async function login(e){e.preventDefault();say('loginMessage','Signing in…');
 const {error}=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
 say('loginMessage',error?error.message:'Signed in successfully.');
}
async function resetPassword(){const email=$('loginEmail').value.trim();if(!email){say('loginMessage','Enter your email address first.');return;}
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 say('loginMessage',error?error.message:'Password reset email requested. Check your inbox.');}
async function showSession(session){currentUser=session?.user||null;$('candidateDashboard').classList.toggle('hidden',!currentUser);$('signup').classList.toggle('hidden',!!currentUser);
 if(!currentUser)return;
 $('candidateEmail').textContent=currentUser.email||'';
 const {data,error}=await client.from('cv_profiles').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(error){say('cvMessage','Could not load saved CV: '+error.message);return;}
 if(data){const map={cvName:'full_name',cvEmail:'email',cvPhone:'phone',cvCity:'city',cvAddress:'address',cvWebsite:'website',cvSummary:'summary',cvEducation:'education',cvExperience:'experience',cvSkills:'skills',cvLanguages:'languages',cvCertifications:'certifications',cvReferences:'references_text'};
 Object.entries(map).forEach(([id,key])=>$(id).value=data[key]||'');}
 else{$('cvName').value=currentUser.user_metadata?.full_name||'';$('cvEmail').value=currentUser.email||'';}
}
async function saveCv(e){e.preventDefault();if(!currentUser)return;
 const record={user_id:currentUser.id,full_name:$('cvName').value.trim(),email:$('cvEmail').value.trim(),phone:$('cvPhone').value.trim(),city:$('cvCity').value.trim(),address:$('cvAddress').value.trim(),website:$('cvWebsite').value.trim(),summary:$('cvSummary').value.trim(),education:$('cvEducation').value.trim(),experience:$('cvExperience').value.trim(),skills:$('cvSkills').value.trim(),languages:$('cvLanguages').value.trim(),certifications:$('cvCertifications').value.trim(),references_text:$('cvReferences').value.trim(),updated_at:new Date().toISOString()};
 say('cvMessage','Saving your CV…');const {error}=await client.from('cv_profiles').upsert(record,{onConflict:'user_id'});
 if(error){say('cvMessage','Could not save CV: '+error.message);return;}
 const {error:profileError}=await client.from('profiles').upsert({user_id:currentUser.id,full_name:record.full_name,email:record.email,phone:record.phone,city:record.city,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 say('cvMessage',profileError?'CV saved, but profile details could not be updated: '+profileError.message:'Your CV has been saved securely.');
}
function downloadCv(){if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const fields=[['Professional Profile','cvSummary'],['Education','cvEducation'],['Work Experience','cvExperience'],['Skills','cvSkills'],['Languages','cvLanguages'],['Certifications & Training','cvCertifications'],['References','cvReferences']];
 const val=id=>$(id).value.trim();
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections=fields.map(([title,id])=>val(id)?`<h2>${title}</h2><p>${esc(val(id)).replace(/\n/g,'<br>')}</p>`:'').join('');
 const w=window.open('','_blank');if(!w){say('cvMessage','Allow pop-ups to print or save your CV.');return;}
 w.document.write(`<!doctype html><html><head><title>CV - ${esc(val('cvName'))}</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:40px auto;color:#183650;line-height:1.55}h1{color:#082f55;margin-bottom:4px}h2{font-size:17px;color:#0878c9;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:24px}p{white-space:normal}.contact{color:#526779}@media print{body{margin:18mm}}</style></head><body><h1>${esc(val('cvName'))}</h1><p class="contact">${esc(val('cvEmail'))} · ${esc(val('cvPhone'))} · ${esc(val('cvCity'))}<br>${esc(val('cvAddress'))}<br>${esc(val('cvWebsite'))}</p>${sections}<script>window.onload=()=>window.print()<\/script></body></html>`);
 w.document.close();
}
function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open');}
document.addEventListener('DOMContentLoaded',initCandidate);
function downloadWord(){
 if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const val=id=>$(id).value.trim(),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=[['Professional Profile','cvSummary'],['Education','cvEducation'],['Work Experience','cvExperience'],['Skills','cvSkills'],['Languages','cvLanguages'],['Certifications & Training','cvCertifications'],['References','cvReferences']];
 const body=fields.map(([t,id])=>val(id)?`<h2>${t}</h2><p>${esc(val(id)).replace(/\n/g,'<br>')}</p>`:'').join('');
 const doc=`<!doctype html><html><head><meta charset="utf-8"><title>CV - ${esc(val('cvName'))}</title><style>body{font:11pt Calibri,Arial;color:#183650}h1{color:#082f55}h2{color:#0878c9;border-bottom:1px solid #ccc}p{line-height:1.4}</style></head><body><h1>${esc(val('cvName'))}</h1><p>${esc(val('cvEmail'))} | ${esc(val('cvPhone'))} | ${esc(val('cvCity'))}<br>${esc(val('cvAddress'))}<br>${esc(val('cvWebsite'))}</p>${body}</body></html>`;
 const blob=new Blob(['\ufeff',doc],{type:'application/msword'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(val('cvName')||'My-CV').replace(/[^a-z0-9-_]/gi,'_')+'.doc';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
