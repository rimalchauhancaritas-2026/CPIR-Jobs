let client=null,currentUser=null,cropper=null,photoDataUrl=null,photoPath=null,removePhotoRequested=false;
const $=id=>document.getElementById(id);
const say=(id,msg)=>{if($(id))$(id).textContent=msg;};
const repeatConfig={educationEntries:{label:'Qualification',min:3,placeholder:'Degree | Institution | Year | Grade'},experienceEntries:{label:'Experience',min:3,placeholder:'Job title | Organization | Dates | Responsibilities'},skillsEntries:{label:'Skill',min:3,placeholder:'Communication, MS Office, teamwork'},languageEntries:{label:'Language',min:2,placeholder:'Urdu — Fluent'},trainingEntries:{label:'Certificate / Training',min:2,placeholder:'Course | Institute | Year'},referenceEntries:{label:'Reference',min:1,placeholder:'Name | Designation | Organization | Contact'}};
function parseEntries(value){if(!value)return [];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(v=>String(v||''));}catch(e){}return String(value).trim()?[String(value)]:[];}
function repeatValues(id){return [...($(id)?.querySelectorAll('textarea')||[])].map(x=>x.value.trim()).filter(Boolean);}
function renderRepeater(id,values=[]){const box=$(id),cfg=repeatConfig[id];if(!box||!cfg)return;const items=[...values];while(items.length<cfg.min)items.push('');box.innerHTML='';items.forEach((value,index)=>{const card=document.createElement('div');card.className='repeatable-entry';const head=document.createElement('div');head.className='entry-heading';const title=document.createElement('span');title.textContent=cfg.label+' '+(index+1);head.appendChild(title);if(items.length>cfg.min){const del=document.createElement('button');del.type='button';del.className='entry-remove';del.textContent='Remove';del.dataset.removeEntry=id;del.dataset.index=index;head.appendChild(del);}const label=document.createElement('label');label.textContent=cfg.label+' details';const area=document.createElement('textarea');area.rows=3;area.maxLength=2500;area.placeholder=cfg.placeholder;area.value=value;label.appendChild(area);card.append(head,label);box.appendChild(card);});}
function collectRepeaters(){return Object.fromEntries(Object.keys(repeatConfig).map(id=>[id,JSON.stringify(repeatValues(id))]));}
function loadRepeaters(data){const keys={educationEntries:'education',experienceEntries:'experience',skillsEntries:'skills',languageEntries:'languages',trainingEntries:'certifications',referenceEntries:'references_text'};Object.entries(keys).forEach(([id,key])=>renderRepeater(id,parseEntries(data?.[key]||'')));}
function updateProfileProgress(){const ids=['cvName','cvEmail','cvPhone','cvSummary'];const done=ids.filter(id=>$(id)?.value.trim()).length+(repeatValues('educationEntries').length?1:0)+(repeatValues('skillsEntries').length?1:0);const total=ids.length+2;const pct=Math.round(done/total*100);if($('profileProgressValue'))$('profileProgressValue').textContent=pct+'%';if($('profileProgressBar'))$('profileProgressBar').style.width=pct+'%';if($('profileProgressText'))$('profileProgressText').textContent=pct===100?'Your core CV profile is complete. You can still add optional details to strengthen it.':done+' of '+total+' required profile items completed. Complete the remaining sections to finish your CV.';}
function initCandidate(){
 if(!window.supabase||!window.CPIR_CONFIG?.SUPABASE_URL||!window.CPIR_CONFIG?.SUPABASE_ANON_KEY){say('signupMessage','Supabase configuration is missing.');return;}
 client=window.supabase.createClient(CPIR_CONFIG.SUPABASE_URL,CPIR_CONFIG.SUPABASE_ANON_KEY);
 $('showSignup').onclick=()=>{ $('signupForm').classList.remove('hidden');$('loginForm').classList.add('hidden');$('showSignup').classList.add('selected');$('showLogin').classList.remove('selected');};
 $('showLogin').onclick=()=>{ $('loginForm').classList.remove('hidden');$('signupForm').classList.add('hidden');$('showLogin').classList.add('selected');$('showSignup').classList.remove('selected');};
 $('signupForm').addEventListener('submit',signup);
 $('loginForm').addEventListener('submit',login);
 $('candidateSignOut').onclick=async()=>{await client.auth.signOut();};
 $('resetPassword').onclick=resetPassword;
 $('saveAlertPreferences').onclick=saveAlertPreferences;
 $('cvForm').addEventListener('submit',saveCv); $('cvForm').addEventListener('input',updateProfileProgress);
 $('cvForm').addEventListener('click',e=>{const add=e.target.closest('[data-add]');if(add){const id=add.dataset.add;renderRepeater(id,[...repeatValues(id),'']);updateProfileProgress();return;}const del=e.target.closest('[data-remove-entry]');if(del){const id=del.dataset.removeEntry,values=[...($(id)?.querySelectorAll('textarea')||[])].map(x=>x.value);values.splice(Number(del.dataset.index),1);renderRepeater(id,values);updateProfileProgress();}});
 Object.keys(repeatConfig).forEach(id=>renderRepeater(id));
 $('downloadCv').onclick=downloadCv; $('downloadWord').onclick=downloadWord;
 $('photoInput').addEventListener('change',openPhotoCrop);
 $('removePhoto').addEventListener('click',removePhoto);
 $('zoomIn').onclick=()=>cropper?.zoom(0.1);
 $('zoomOut').onclick=()=>cropper?.zoom(-0.1);
 $('cancelCrop').onclick=closeCrop;
 $('applyCrop').onclick=applyCrop;
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
 if(!currentUser){photoPath=null;photoDataUrl=null;return;}
 $('candidateEmail').textContent=currentUser.email||'';
 await loadAlertPreferences();
 const {data,error}=await client.from('cv_profiles').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(error){say('cvMessage','Could not load saved CV: '+error.message);return;}
 if(data){const map={cvName:'full_name',cvEmail:'email',cvPhone:'phone',cvCity:'city',cvAddress:'address',cvWebsite:'website',cvSummary:'summary'};
 Object.entries(map).forEach(([id,key])=>$(id).value=data[key]||'');
 loadRepeaters(data);
 photoPath=data.photo_path||null;
 if(photoPath)await loadSavedPhoto(photoPath);
 }else{$('cvName').value=currentUser.user_metadata?.full_name||'';$('cvEmail').value=currentUser.email||'';loadRepeaters({});setPhotoPreview(null);}
 updateProfileProgress();
}

async function loadAlertPreferences(){
 const {data,error}=await client.from('job_alert_preferences').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(error){say('alertPreferencesMessage','Could not load alert preferences: '+error.message);return;}
 const p=data||{enabled:false,categories:[],cities:[],employment_types:[]};
 $('alertsEnabled').checked=!!p.enabled;
 document.querySelectorAll('[name="alertCategory"]').forEach(x=>x.checked=(p.categories||[]).includes(x.value));
 document.querySelectorAll('[name="alertCity"]').forEach(x=>x.checked=(p.cities||[]).includes(x.value));
 document.querySelectorAll('[name="alertEmployment"]').forEach(x=>x.checked=(p.employment_types||[]).includes(x.value));
}
async function saveAlertPreferences(){
 if(!currentUser)return;
 const record={user_id:currentUser.id,enabled:$('alertsEnabled').checked,categories:[...document.querySelectorAll('[name="alertCategory"]:checked')].map(x=>x.value),cities:[...document.querySelectorAll('[name="alertCity"]:checked')].map(x=>x.value),employment_types:[...document.querySelectorAll('[name="alertEmployment"]:checked')].map(x=>x.value),updated_at:new Date().toISOString()};
 if(record.enabled&&(!record.categories.length||!record.cities.length||!record.employment_types.length)){say('alertPreferencesMessage','To enable alerts, choose at least one category, one city and one employment type.');return;}
 say('alertPreferencesMessage','Saving preferences…');
 const {error}=await client.from('job_alert_preferences').upsert(record,{onConflict:'user_id'});
 say('alertPreferencesMessage',error?'Could not save preferences: '+error.message:'Your job alert preferences have been saved.');
}

async function loadSavedPhoto(path){
 const {data,error}=await client.storage.from('candidate-photos').createSignedUrl(path,3600);
 if(error){say('photoMessage','Your saved photograph could not be loaded. You can upload it again.');return;}
 try{const response=await fetch(data.signedUrl);if(!response.ok)throw new Error('Image unavailable');const blob=await response.blob();photoDataUrl=await blobToDataUrl(blob);setPhotoPreview(photoDataUrl);}catch(_){say('photoMessage','Your saved photograph could not be previewed. You can upload it again.');}
}
function setCandidateNavPhoto(src){const link=$('authNavLink'),img=$('authNavAvatar'),placeholder=$('authNavPlaceholder'),label=$('authNavText');if(!link)return;link.href=currentUser?'candidate.html#candidateDashboard':'candidate.html#signup';if(label)label.textContent=currentUser?'Profile':'Sign Up / Login';if(src){img.src=src;img.classList.remove('hidden');placeholder?.classList.add('hidden');}else{img?.removeAttribute('src');img?.classList.add('hidden');placeholder?.classList.remove('hidden');}}\nfunction setPhotoPreview(src){const img=$('photoPreview'),placeholder=$('photoPlaceholder');if(src){img.src=src;img.classList.remove('hidden');placeholder.classList.add('hidden');$('removePhoto').disabled=false;}else{img.removeAttribute('src');img.classList.add('hidden');placeholder.classList.remove('hidden');$('removePhoto').disabled=true;}setCandidateNavPhoto(src);}
function openPhotoCrop(e){
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(!['image/jpeg','image/png'].includes(file.type)){say('photoMessage','Please choose a JPG or PNG photograph.');return;}
 if(file.size>3*1024*1024){say('photoMessage','The photograph must be smaller than 3 MB.');return;}
 if(!window.Cropper){say('photoMessage','The photo editor could not load. Please refresh and try again.');return;}
 const reader=new FileReader();reader.onload=()=>{$('cropImage').src=reader.result;$('cropModal').classList.remove('hidden');if(cropper){cropper.destroy();cropper=null;}
 cropper=new Cropper($('cropImage'),{aspectRatio:NaN,viewMode:1,dragMode:'move',autoCropArea:.88, responsive:true,background:false,zoomOnWheel:true, movable:true,rotatable:false,scalable:false});};reader.readAsDataURL(file);
}
function closeCrop(){$('cropModal').classList.add('hidden');if(cropper){cropper.destroy();cropper=null;}}
function applyCrop(){if(!cropper)return;const canvas=cropper.getCroppedCanvas({maxWidth:1200,maxHeight:1200,fillColor:'#ffffff',imageSmoothingEnabled:true,imageSmoothingQuality:'high'});if(!canvas){say('photoMessage','Could not crop this image. Please try another photograph.');return;}
 photoDataUrl=canvas.toDataURL('image/jpeg',.88);removePhotoRequested=false;setPhotoPreview(photoDataUrl);say('photoMessage','Photograph cropped. Save your CV to keep the changes.');closeCrop();}
function removePhoto(){photoDataUrl=null;removePhotoRequested=true;setPhotoPreview(null);say('photoMessage','Photograph will be removed when you save your CV.');}
function dataUrlToBlob(dataUrl){const parts=dataUrl.split(','),mime=parts[0].match(/:(.*?);/)[1],binary=atob(parts[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:mime});}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
async function saveCv(e){e.preventDefault();if(!currentUser)return;
 if(!repeatValues('educationEntries').length){say('cvMessage','Please add at least one education qualification before saving.');return;}
 if(!repeatValues('skillsEntries').length){say('cvMessage','Please add at least one skill before saving.');return;}
 say('cvMessage','Saving your CV…');
 let nextPhotoPath=photoPath;
 if(photoDataUrl){const blob=dataUrlToBlob(photoDataUrl),path=currentUser.id+'/profile.jpg';const {error:uploadError}=await client.storage.from('candidate-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true});
 if(uploadError){say('cvMessage','Could not upload photograph: '+uploadError.message);return;}nextPhotoPath=path;
 }else if(removePhotoRequested&&photoPath){const {error:removeError}=await client.storage.from('candidate-photos').remove([photoPath]);if(removeError){say('cvMessage','Could not remove photograph: '+removeError.message);return;}nextPhotoPath=null;}
 const repeated=collectRepeaters();
 const record={user_id:currentUser.id,full_name:$('cvName').value.trim(),email:$('cvEmail').value.trim(),phone:$('cvPhone').value.trim(),city:$('cvCity').value.trim(),address:$('cvAddress').value.trim(),website:$('cvWebsite').value.trim(),summary:$('cvSummary').value.trim(),education:repeated.educationEntries,experience:repeated.experienceEntries,skills:repeated.skillsEntries,languages:repeated.languageEntries,certifications:repeated.trainingEntries,references_text:repeated.referenceEntries,photo_path:nextPhotoPath,updated_at:new Date().toISOString()}
 const {error}=await client.from('cv_profiles').upsert(record,{onConflict:'user_id'});
 if(error){say('cvMessage','Could not save CV: '+error.message);return;}
 photoPath=nextPhotoPath;removePhotoRequested=false;
 const {error:profileError}=await client.from('profiles').upsert({user_id:currentUser.id,full_name:record.full_name,email:record.email,phone:record.phone,city:record.city,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 say('cvMessage',profileError?'CV saved, but profile details could not be updated: '+profileError.message:'Your CV and photograph have been saved securely.');updateProfileProgress();
}
function cvHeaderHtml(esc,val){return (photoDataUrl?'<img class="cv-photo" src="'+photoDataUrl+'" alt="Profile photograph">':'')+'<h1>'+esc(val('cvName'))+'</h1><p class="contact">'+esc(val('cvEmail'))+' · '+esc(val('cvPhone'))+' · '+esc(val('cvCity'))+'<br>'+esc(val('cvAddress'))+'<br>'+esc(val('cvWebsite'))+'</p>';}
function cvSections(esc,val){
 const profile=val('cvSummary')?'<h2>Professional Profile</h2><p>'+esc(val('cvSummary')).replace(/\\n/g,'<br>')+'</p>':'';
 const groups=[['Education','educationEntries'],['Work Experience','experienceEntries'],['Skills','skillsEntries'],['Languages','languageEntries'],['Certifications & Training','trainingEntries'],['References','referenceEntries']];
 return profile+groups.map(([title,id])=>{const items=repeatValues(id);return items.length?'<h2>'+title+'</h2>'+items.map(item=>'<p>'+esc(item).replace(/\\n/g,'<br>')+'</p>').join(''):'';}).join('');
}
function downloadCv(){if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const val=id=>$(id).value.trim(),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections=cvSections(esc,val),header=cvHeaderHtml(esc,val);
 const w=window.open('','_blank');if(!w){say('cvMessage','Allow pop-ups to print or save your CV.');return;}
 w.document.write('<!doctype html><html><head><title>CV - '+esc(val('cvName'))+'</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:40px auto;color:#183650;line-height:1.55}h1{color:#082f55;margin-bottom:4px}h2{font-size:17px;color:#0878c9;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:24px}p{white-space:normal}.contact{color:#526779}.cv-photo{width:115px;height:115px;object-fit:cover;float:right;border-radius:5px}@media print{body{margin:18mm}}</style></head><body>'+header+sections+'<script>window.onload=()=>window.print()<\/script></body></html>');
 w.document.close();
}
function downloadWord(){if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const val=id=>$(id).value.trim(),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const body=cvSections(esc,val),header=cvHeaderHtml(esc,val);
 const doc='<!doctype html><html><head><meta charset="utf-8"><title>CV - '+esc(val('cvName'))+'</title><style>body{font:11pt Calibri,Arial;color:#183650}h1{color:#082f55}h2{color:#0878c9;border-bottom:1px solid #ccc}p{line-height:1.4}.cv-photo{width:115px;height:115px;object-fit:cover;float:right}</style></head><body>'+header+body+'</body></html>';
 const blob=new Blob(['\ufeff',doc],{type:'application/msword'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(val('cvName')||'My-CV').replace(/[^a-z0-9-_]/gi,'_')+'.doc';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open');}
document.addEventListener('DOMContentLoaded',initCandidate);
