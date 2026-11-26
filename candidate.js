let client=null,currentUser=null,cropper=null,photoDataUrl=null,photoPath=null,removePhotoRequested=false;
let accountPhotoCropper=null,accountPhotoBlob=null,accountPhotoObjectUrl=null;
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
 $('cvForm').addEventListener('submit',saveCv); $('cvForm').addEventListener('input',()=>{updateProfileProgress();renderCvPreview();});
 $('cvForm').addEventListener('click',e=>{const add=e.target.closest('[data-add]');if(add){const id=add.dataset.add;renderRepeater(id,[...repeatValues(id),'']);updateProfileProgress();renderCvPreview();return;}const del=e.target.closest('[data-remove-entry]');if(del){const id=del.dataset.removeEntry,values=[...($(id)?.querySelectorAll('textarea')||[])].map(x=>x.value);values.splice(Number(del.dataset.index),1);renderRepeater(id,values);updateProfileProgress();renderCvPreview();}});
 Object.keys(repeatConfig).forEach(id=>renderRepeater(id));
 $('downloadCv').onclick=downloadCv; $('downloadWord').onclick=downloadWord;
 initAccountPhotoControls();
 $('uploadResumeButton').addEventListener('click',uploadCandidateResume);
 $('resumeLibraryList').addEventListener('click',handleResumeLibraryAction);
 $('photoInput').addEventListener('change',openPhotoCrop);
 $('removePhoto').addEventListener('click',removePhoto);
 $('zoomIn').onclick=()=>cropper?.zoom(0.1);
 $('zoomOut').onclick=()=>cropper?.zoom(-0.1);
 $('cancelCrop').onclick=closeCrop;
 $('applyCrop').onclick=applyCrop;
 client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){$('candidateRecoveryPanel').classList.remove('hidden');$('signup').classList.add('hidden');$('candidateDashboard').classList.add('hidden');}else if(event!=='INITIAL_SESSION')setTimeout(()=>showSession(session),0);});$('candidateRecoveryForm').addEventListener('submit',saveCandidateNewPassword);
 client.auth.getSession().then(({data})=>showSession(data.session));
}
async function signup(e){e.preventDefault();say('signupMessage','Creating account…');
 const name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),password=$('signupPassword').value;
 const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:'https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/candidate.html'}});
 if(error){say('signupMessage',error.message);return;}
 if(data.session){say('signupMessage','Account created. You are now signed in.');}
 else{say('signupMessage','Account created. Check your email for a confirmation link, then sign in.');}
}
async function login(e){e.preventDefault();say('loginMessage','Signing in…');try{
 const {error}=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
 say('loginMessage',error?error.message:'Signed in successfully.');
 }catch(error){say('loginMessage','Could not connect to the login service. Check your internet connection and try again. If it continues, contact the website administrator.');console.error('Candidate sign-in connection error:',error);}}

async function resetPassword(){const email=$('loginEmail').value.trim();if(!email){say('loginMessage','Enter your email address first.');return;}say('loginMessage','Requesting password reset…');try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/candidate.html'});say('loginMessage',error?error.message:'If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.');}catch(error){say('loginMessage','Could not reach the password reset service. Check your internet connection and try again.');console.error(error);}}
async function saveCandidateNewPassword(e){e.preventDefault();const password=$('candidateNewPassword').value;if(password.length<8){say('candidateRecoveryMessage','Use at least 8 characters.');return;}say('candidateRecoveryMessage','Saving new password…');try{const {error}=await client.auth.updateUser({password});if(error){say('candidateRecoveryMessage',error.message);return;}say('candidateRecoveryMessage','Password updated successfully.');$('candidateRecoveryPanel').classList.add('hidden');const {data}=await client.auth.getSession();await showSession(data.session);}catch(error){say('candidateRecoveryMessage','Could not update the password. Please open the reset link again and retry.');console.error(error);}}
async function showSession(session){currentUser=session?.user||null;$('candidateDashboard').classList.toggle('hidden',!currentUser);$('signup').classList.toggle('hidden',!!currentUser);setCandidateNavPhoto(null);
 if(!currentUser){photoPath=null;photoDataUrl=null;setAccountPhotoPreview(null);return;}
 await loadAccountPhoto(currentUser);
 await loadResumeLibrary();
 $('candidateEmail').textContent=currentUser.email||'';
 await loadAlertPreferences();
 const {data,error}=await client.from('cv_profiles').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(error){say('cvMessage','Could not load saved CV: '+error.message);return;}
 if(data){const map={cvName:'full_name',cvEmail:'email',cvPhone:'phone',cvCnic:'cnic',cvCity:'city',cvAddress:'address',cvWebsite:'website',cvSummary:'summary'};
 Object.entries(map).forEach(([id,key])=>$(id).value=data[key]||'');
 loadRepeaters(data);
 photoPath=data.photo_path||null;
 if(photoPath)await loadSavedPhoto(photoPath);else setPhotoPreview(null);
 }else{$('cvName').value=currentUser.user_metadata?.full_name||'';$('cvEmail').value=currentUser.email||'';loadRepeaters({});setPhotoPreview(null);}
 updateProfileProgress();renderCvPreview();
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

function initAccountPhotoControls(){
 $('accountPhotoInput').addEventListener('change',openAccountPhotoCrop);
 $('saveAccountPhoto').addEventListener('click',saveAccountPhoto);
 $('removeAccountPhoto').addEventListener('click',removeAccountPhoto);
 $('accountApplyCrop').addEventListener('click',applyAccountPhotoCrop);
 $('accountCancelCrop').addEventListener('click',()=>{closeAccountPhotoCrop();$('accountPhotoInput').value='';});
 $('accountZoomIn').addEventListener('click',()=>accountPhotoCropper?.zoom(.1));
 $('accountZoomOut').addEventListener('click',()=>accountPhotoCropper?.zoom(-.1));
}
function openAccountPhotoCrop(e){
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){say('accountPhotoMessage','Please choose a JPG, PNG or WebP image.');$('accountPhotoInput').value='';return;}
 if(file.size>3*1024*1024){say('accountPhotoMessage','The photograph must be smaller than 3 MB.');$('accountPhotoInput').value='';return;}
 if(!window.Cropper){say('accountPhotoMessage','The photo editor could not load. Please refresh and try again.');$('accountPhotoInput').value='';return;}
 if(accountPhotoObjectUrl)URL.revokeObjectURL(accountPhotoObjectUrl);
 accountPhotoObjectUrl=URL.createObjectURL(file);
 $('accountCropImage').src=accountPhotoObjectUrl;
 if(accountPhotoCropper){accountPhotoCropper.destroy();accountPhotoCropper=null;}
 try{
  $('accountCropModal').classList.remove('hidden');
  accountPhotoCropper=new Cropper($('accountCropImage'),{aspectRatio:NaN,viewMode:1,dragMode:'crop',autoCropArea:.9,responsive:true,background:false,zoomOnWheel:true,movable:true,zoomable:true,cropBoxResizable:true,rotatable:false,scalable:false});
  say('accountPhotoMessage','Adjust the crop box freely, move your face and zoom as needed. Choose Use this photo when ready.');
 }catch(error){closeAccountPhotoCrop();$('accountPhotoInput').value='';say('accountPhotoMessage','The photo editor could not start. Please refresh and try again.');console.error('Account photo crop editor error:',error);}
}
function closeAccountPhotoCrop(){$('accountCropModal').classList.add('hidden');if(accountPhotoCropper){accountPhotoCropper.destroy();accountPhotoCropper=null;}if(accountPhotoObjectUrl){URL.revokeObjectURL(accountPhotoObjectUrl);accountPhotoObjectUrl=null;}}
function applyAccountPhotoCrop(){
 if(!accountPhotoCropper)return;
 const canvas=accountPhotoCropper.getCroppedCanvas({maxWidth:2400,maxHeight:2400,imageSmoothingEnabled:true,imageSmoothingQuality:'high'});
 if(!canvas){say('accountPhotoMessage','Could not crop this photograph. Please try again.');return;}
 canvas.toBlob(blob=>{if(!blob){say('accountPhotoMessage','Could not prepare this photograph.');return;}accountPhotoBlob=blob;setAccountPhotoPreview(URL.createObjectURL(blob));$('saveAccountPhoto').disabled=false;closeAccountPhotoCrop();say('accountPhotoMessage','Photo crop ready. Review it and click Save profile photograph.');},'image/jpeg',.92);
}
function setAccountPhotoPreview(src){const img=$('accountPhotoPreview'),placeholder=$('accountPhotoPlaceholder');if(!img||!placeholder)return;if(src){img.src=src;img.classList.remove('hidden');placeholder.classList.add('hidden');}else{img.removeAttribute('src');img.classList.add('hidden');placeholder.classList.remove('hidden');}if($('removeAccountPhoto'))$('removeAccountPhoto').disabled=!src;setCandidateNavPhoto(src);}
async function loadAccountPhoto(user){const path=user?.user_metadata?.account_photo_path;if(!path){setAccountPhotoPreview(null);return;}const {data,error}=await client.storage.from('candidate-photos').createSignedUrl(path,3600);if(error){say('accountPhotoMessage','Saved account photograph could not be loaded.');setAccountPhotoPreview(null);return;}setAccountPhotoPreview(data.signedUrl);}
async function saveAccountPhoto(){if(!currentUser)return;if(!accountPhotoBlob){say('accountPhotoMessage','Choose a photograph and confirm its crop first.');return;}const path=currentUser.id+'/account-profile.jpg';say('accountPhotoMessage','Uploading account photograph…');$('saveAccountPhoto').disabled=true;const {error:uploadError}=await client.storage.from('candidate-photos').upload(path,accountPhotoBlob,{contentType:'image/jpeg',upsert:true});if(uploadError){say('accountPhotoMessage','Could not upload photograph: '+uploadError.message);$('saveAccountPhoto').disabled=false;return;}const {data,error}=await client.auth.updateUser({data:{account_photo_path:path}});$('saveAccountPhoto').disabled=false;if(error){say('accountPhotoMessage','Photo uploaded, but account profile could not be updated: '+error.message);return;}currentUser=data.user;accountPhotoBlob=null;const {data:signed}=await client.storage.from('candidate-photos').createSignedUrl(path,3600);setAccountPhotoPreview(signed?.signedUrl||$('accountPhotoPreview').src);$('accountPhotoInput').value='';say('accountPhotoMessage','Your account profile photograph has been saved.');}
async function removeAccountPhoto(){if(!currentUser)return;const path=currentUser.user_metadata?.account_photo_path;if(!path)return;say('accountPhotoMessage','Removing account photograph…');$('removeAccountPhoto').disabled=true;const {error:removeError}=await client.storage.from('candidate-photos').remove([path]);if(removeError){say('accountPhotoMessage','Could not remove photograph: '+removeError.message);$('removeAccountPhoto').disabled=false;return;}const {data,error}=await client.auth.updateUser({data:{account_photo_path:null}});if(error){say('accountPhotoMessage','Photo removed from storage, but account could not be updated: '+error.message);return;}currentUser=data.user;setAccountPhotoPreview(null);say('accountPhotoMessage','Account profile photograph removed.');}
async function loadSavedPhoto(path){
 const {data,error}=await client.storage.from('candidate-photos').createSignedUrl(path,3600);
 if(error){say('photoMessage','Your saved photograph could not be loaded. You can upload it again.');return;}
 try{const response=await fetch(data.signedUrl);if(!response.ok)throw new Error('Image unavailable');const blob=await response.blob();photoDataUrl=await blobToDataUrl(blob);setPhotoPreview(photoDataUrl);}catch(_){say('photoMessage','Your saved photograph could not be previewed. You can upload it again.');}
}
function setCandidateNavPhoto(src){const link=$('authNavLink'),img=$('authNavAvatar'),placeholder=$('authNavPlaceholder'),label=$('authNavText');if(!link)return;link.href=currentUser?'candidate.html#candidateDashboard':'candidate.html#signup';if(label)label.textContent=currentUser?'Profile':'Sign Up / Login';if(src){img.src=src;img.classList.remove('hidden');placeholder?.classList.add('hidden');}else{img?.removeAttribute('src');img?.classList.add('hidden');placeholder?.classList.remove('hidden');}}
function setPhotoPreview(src){const img=$('photoPreview'),placeholder=$('photoPlaceholder');if(src){img.src=src;img.classList.remove('hidden');placeholder.classList.add('hidden');$('removePhoto').disabled=false;}else{img.removeAttribute('src');img.classList.add('hidden');placeholder.classList.remove('hidden');$('removePhoto').disabled=true;}}
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
 const record={user_id:currentUser.id,full_name:$('cvName').value.trim(),email:$('cvEmail').value.trim(),phone:$('cvPhone').value.trim(),cnic:$('cvCnic').value.trim(),city:$('cvCity').value.trim(),address:$('cvAddress').value.trim(),website:$('cvWebsite').value.trim(),summary:$('cvSummary').value.trim(),education:repeated.educationEntries,experience:repeated.experienceEntries,skills:repeated.skillsEntries,languages:repeated.languageEntries,certifications:repeated.trainingEntries,references_text:repeated.referenceEntries,photo_path:nextPhotoPath,updated_at:new Date().toISOString()}
 const {error}=await client.from('cv_profiles').upsert(record,{onConflict:'user_id'});
 if(error){say('cvMessage','Could not save CV: '+error.message);return;}
 photoPath=nextPhotoPath;removePhotoRequested=false;
 const {error:profileError}=await client.from('profiles').upsert({user_id:currentUser.id,full_name:record.full_name,email:record.email,phone:record.phone,city:record.city,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 say('cvMessage',profileError?'CV saved, but profile details could not be updated: '+profileError.message:'Your CV and photograph have been saved securely.');updateProfileProgress();
}
function cvHeaderHtml(esc,val){return (photoDataUrl?'<img class="cv-photo" src="'+photoDataUrl+'" alt="Profile photograph">':'')+'<h1>'+esc(val('cvName'))+'</h1><p class="contact">'+esc(val('cvEmail'))+' · '+esc(val('cvPhone'))+' · '+esc(val('cvCity'))+(val('cvCnic')?'<br>CNIC: '+esc(val('cvCnic')):'')+'<br>'+esc(val('cvAddress'))+'<br>'+esc(val('cvWebsite'))+'</p>';}
function cvSections(esc,val){
 const lineBreaks=value=>esc(value).replace(/\r?\n/g,'<br>');
 const profile=val('cvSummary')?'<h2>Professional Profile</h2><p>'+lineBreaks(val('cvSummary'))+'</p>':'';
 const bulletGroups=[['Education','educationEntries'],['Skills','skillsEntries'],['Languages','languageEntries'],['Certifications & Training','trainingEntries'],['References','referenceEntries']];
 const bullets=bulletGroups.map(([title,id])=>{const items=repeatValues(id);return items.length?'<h2>'+title+'</h2><ul class="cv-bullet-list">'+items.map(item=>'<li>'+lineBreaks(item)+'</li>').join('')+'</ul>':'';}).join('');
 const experience=repeatValues('experienceEntries');
 const work=experience.length?'<h2>Work Experience</h2>'+experience.map(item=>'<div class="cv-entry"><p>'+lineBreaks(item)+'</p></div>').join(''):'';
 return profile+bullets+work;
}
function renderCvPreview(){
 const target=$('cvLivePreview');if(!target)return;
 const val=id=>$(id)?.value.trim()||'';
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 target.innerHTML=cvHeaderHtml(esc,val)+cvSections(esc,val);
}
function downloadCv(){if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const val=id=>$(id).value.trim(),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections=cvSections(esc,val),header=cvHeaderHtml(esc,val);
 const w=window.open('','_blank');if(!w){say('cvMessage','Allow pop-ups to print or save your CV.');return;}
 w.document.write('<!doctype html><html><head><title>CV - '+esc(val('cvName'))+'</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:40px auto;color:#183650;line-height:1.55}h1{color:#082f55;margin-bottom:4px}h2{font-size:17px;color:#0878c9;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:24px}p{white-space:normal}.cv-bullet-list{padding-left:22px;margin:8px 0 14px}.cv-bullet-list li{margin:4px 0;padding-left:3px}.cv-entry{margin:8px 0}.contact{color:#526779}.cv-photo{width:115px;height:115px;object-fit:cover;float:right;border-radius:5px}@media print{body{margin:18mm}}</style></head><body>'+header+sections+'<script>window.onload=()=>window.print()<\/script></body></html>');
 w.document.close();
}
function downloadWord(){if(!currentUser){say('cvMessage','Please sign in first.');return;}
 const val=id=>$(id).value.trim(),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const body=cvSections(esc,val),header=cvHeaderHtml(esc,val);
 const doc='<!doctype html><html><head><meta charset="utf-8"><title>CV - '+esc(val('cvName'))+'</title><style>body{font:11pt Calibri,Arial;color:#183650}h1{color:#082f55}h2{color:#0878c9;border-bottom:1px solid #ccc}p{line-height:1.4}.cv-bullet-list{padding-left:22px;margin:8px 0 14px}.cv-bullet-list li{margin:4px 0}.cv-entry{margin:8px 0}.cv-photo{width:115px;height:115px;object-fit:cover;float:right}</style></head><body>'+header+body+'</body></html>';
 const blob=new Blob(['\ufeff',doc],{type:'application/msword'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(val('cvName')||'My-CV').replace(/[^a-z0-9-_]/gi,'_')+'.doc';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

const RESUME_BUCKET='candidate-resumes';
const RESUME_MAX_BYTES=10*1024*1024;
const RESUME_TYPES={pdf:{mime:'application/pdf',signature:'pdf'},doc:{mime:'application/msword',signature:'doc'},docx:{mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',signature:'zip'}};
function resumeFileType(file){const ext=(file.name.split('.').pop()||'').toLowerCase();return RESUME_TYPES[ext]?{ext,...RESUME_TYPES[ext]}:null;}
async function resumeSignatureMatches(file,type){const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());if(type.signature==='pdf')return bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';if(type.signature==='doc')return [0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1].every((v,i)=>bytes[i]===v);if(type.signature==='zip')return bytes[0]===0x50&&bytes[1]===0x4B&&(bytes[2]===0x03||bytes[2]===0x05||bytes[2]===0x07);return false;}
function formatResumeSize(bytes){return bytes<1024*1024?Math.max(1,Math.round(bytes/1024))+' KB':(bytes/1024/1024).toFixed(1)+' MB';}
function renderResumeLibrary(rows){const list=$('resumeLibraryList');if(!list)return;list.innerHTML='';if(!rows?.length){const empty=document.createElement('p');empty.className='resume-empty';empty.textContent='No resumes uploaded yet. Choose a PDF, DOC or DOCX file above to add your first resume.';list.appendChild(empty);return;}rows.forEach(resume=>{const card=document.createElement('article');card.className='resume-file-card';const details=document.createElement('div');details.className='resume-file-details';const name=document.createElement('strong');name.className='resume-file-name';name.textContent=resume.file_name;const meta=document.createElement('small');meta.textContent=resume.file_type.toUpperCase()+' · '+formatResumeSize(Number(resume.file_size))+' · Uploaded '+new Date(resume.created_at).toLocaleDateString();details.append(name,meta);if(resume.is_default){const tag=document.createElement('span');tag.className='resume-default-tag';tag.textContent='Default resume';details.appendChild(tag);}const actions=document.createElement('div');actions.className='resume-file-actions';const addAction=(label,action,cls='secondary-btn')=>{const button=document.createElement('button');button.type='button';button.className=cls;button.textContent=label;button.dataset.resumeAction=action;button.dataset.resumeId=resume.id;actions.appendChild(button);};addAction('Import into CV Manager','import','secondary-btn');addAction('Download','download');if(!resume.is_default)addAction('Set as default','default');addAction('Delete','delete','danger-btn');card.append(details,actions);list.appendChild(card);});}
async function loadResumeLibrary(){if(!currentUser)return;say('resumeLibraryMessage','Loading your private resume library…');const {data,error}=await client.from('candidate_resumes').select('id,file_name,file_type,file_size,is_default,created_at').eq('user_id',currentUser.id).order('is_default',{ascending:false}).order('created_at',{ascending:false});if(error){say('resumeLibraryMessage','Could not load your resume library: '+error.message);return;}renderResumeLibrary(data||[]);say('resumeLibraryMessage','Your original uploaded resumes are kept separately from your editable Caritas CV.');}
async function uploadCandidateResume(){if(!currentUser){say('resumeLibraryMessage','Please sign in to upload a resume.');return;}const input=$('resumeUploadInput'),file=input.files?.[0];if(!file){say('resumeLibraryMessage','Choose a PDF, DOC or DOCX file first.');return;}const type=resumeFileType(file);if(!type){say('resumeLibraryMessage','Please choose a PDF, DOC or DOCX file.');return;}if(file.size<=0||file.size>RESUME_MAX_BYTES){say('resumeLibraryMessage','The file must be larger than 0 bytes and no bigger than 10 MB.');return;}say('resumeLibraryMessage','Checking file and uploading securely…');$('uploadResumeButton').disabled=true;try{if(!await resumeSignatureMatches(file,type)){say('resumeLibraryMessage','The file contents do not match its extension. Please choose a valid PDF, DOC or DOCX document.');return;}const id=crypto.randomUUID(),path=currentUser.id+'/'+id+'.'+type.ext;const {error:uploadError}=await client.storage.from(RESUME_BUCKET).upload(path,file,{contentType:type.mime,upsert:false});if(uploadError){say('resumeLibraryMessage','Upload failed: '+uploadError.message);return;}const {data:existingDefault,error:defaultError}=await client.from('candidate_resumes').select('id').eq('user_id',currentUser.id).eq('is_default',true).maybeSingle();if(defaultError){await client.storage.from(RESUME_BUCKET).remove([path]);say('resumeLibraryMessage','Could not check your default resume: '+defaultError.message);return;}const {error:insertError}=await client.from('candidate_resumes').insert({id,user_id:currentUser.id,file_name:file.name,file_type:type.ext,file_size:file.size,storage_path:path,is_default:!existingDefault});if(insertError){await client.storage.from(RESUME_BUCKET).remove([path]);say('resumeLibraryMessage','Could not save resume details: '+insertError.message);return;}input.value='';say('resumeLibraryMessage','Your original resume has been uploaded and saved privately.');await loadResumeLibrary();}catch(error){say('resumeLibraryMessage','The resume could not be uploaded. Please check your connection and try again.');console.error('Resume upload error:',error);}finally{$('uploadResumeButton').disabled=false;}}

function loadResumeParserScript(src,globalName){
 return new Promise((resolve,reject)=>{
  if(window[globalName]){resolve();return;}
  const existing=[...document.scripts].find(s=>s.src===src);
  if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',reject,{once:true});return;}
  const script=document.createElement('script');script.src=src;script.async=true;
  script.onload=()=>window[globalName]?resolve():reject(new Error('Parser library did not initialise.'));
  script.onerror=()=>reject(new Error('Could not load the resume-reading library. Check your internet connection.'));
  document.head.appendChild(script);
 });
}
function cleanExtractedLines(text){
 return String(text||'').replace(/\u0000/g,' ').replace(/\r/g,'\n').split('\n').map(x=>x.replace(/[•▪●◦]/g,'').trim()).filter(x=>x&&x.length<1200);
}
function sectionLines(lines,headingPatterns){
 const result={};let active='other';
 for(const line of lines){
  const normalized=line.toLowerCase().replace(/[:：]/g,'').trim();
  let found=Object.entries(headingPatterns).find(([,patterns])=>patterns.some(p=>normalized===p||normalized.startsWith(p+' ')));
  if(found){active=found[0];if(!result[active])result[active]=[];continue;}
  (result[active]||(result[active]=[])).push(line);
 }
 return result;
}
function guessResumeFields(rawText){
 const lines=cleanExtractedLines(rawText),joined=lines.join('\n');
 const email=joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
 const phone=joined.match(/(?:\+?92|0)\s?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/)?.[0]||'';
 const cnic=joined.match(/\b\d{5}-\d{7}-\d\b/)?.[0]||'';
 const url=joined.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s,]+|[a-z0-9-]+\.(?:com|pk|org)(?:\/[^\s,]*)?)/i)?.[0]||'';
 const headings={
  education:['education','academic qualification','academic qualifications','qualification','qualifications','educational background'],
  experience:['work experience','professional experience','employment history','experience','career history'],
  skills:['skills','key skills','core competencies','technical skills','competencies'],
  languages:['languages','language'],
  certifications:['certifications','certificates','training','courses','professional development'],
  references_text:['references','referees']
 };
 const sections=sectionLines(lines,headings);
 const personalStop=/^(resume|curriculum vitae|cv)$/i;
 const nameCandidate=lines.slice(0,6).find(x=>x.split(/\s+/).length>=2&&x.split(/\s+/).length<=5&&!/@|\d{3}/.test(x)&&!personalStop.test(x)&&!/^(profile|objective|summary|contact|personal details)/i.test(x))||'';
 const summary=sections.other?.filter(x=>x.length>45).slice(0,4).join(' ')||'';
 const list=(key)=> (sections[key]||[]).filter(x=>x.length>2&&!/^(email|phone|mobile|address|location)\s*:/i.test(x)).slice(0,12);
 return {cvName:nameCandidate,cvEmail:email,cvPhone:phone,cvCnic:cnic,cvWebsite:url?(/^https?:\/\//i.test(url)?url:'https://'+url):'',cvSummary:summary,
  educationEntries:list('education'),experienceEntries:list('experience'),skillsEntries:list('skills'),languageEntries:list('languages'),trainingEntries:list('certifications'),referenceEntries:list('references_text')};
}
async function extractResumeText(file,resume){
 if(resume.file_type==='doc')throw new Error('This is an older Word (.doc) file. It is safely stored, but automatic text extraction currently supports PDF and DOCX. Please open it in Word and save a copy as .docx, then upload that copy.');
 const {data,error}=await client.storage.from(RESUME_BUCKET).createSignedUrl(resume.storage_path,120);
 if(error)throw new Error('Could not access the original resume securely: '+error.message);
 const response=await fetch(data.signedUrl);if(!response.ok)throw new Error('Could not download the resume for reading. Please try again.');
 const buffer=await response.arrayBuffer();
 if(resume.file_type==='pdf'){
  await loadResumeParserScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(buffer)}).promise;
  const pages=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){const page=await pdf.getPage(pageNo),content=await page.getTextContent();pages.push(content.items.map(item=>item.str).join(' '));}
  return pages.join('\n');
 }
 if(resume.file_type==='docx'){
  await loadResumeParserScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.0/mammoth.browser.min.js','mammoth');
  const result=await window.mammoth.extractRawText({arrayBuffer:buffer});
  return result.value||'';
 }
 throw new Error('This file type cannot currently be imported into the CV Manager.');
}
async function importResumeToCv(resume){
 const button=document.querySelector('[data-resume-action="import"][data-resume-id="'+resume.id+'"]');
 if(button)button.disabled=true;
 say('resumeLibraryMessage','Reading your resume privately in this browser…');
 try{
  const text=await extractResumeText(null,resume);
  if(!text.trim())throw new Error('No selectable text was found. If this is a scanned image PDF, please use a text-based PDF or enter the details manually.');
  const fields=guessResumeFields(text);
  const controls=['cvName','cvEmail','cvPhone','cvCnic','cvCity','cvAddress','cvWebsite','cvSummary'];
  const existing=controls.some(id=>$(id)?.value.trim())||Object.keys(repeatConfig).some(id=>repeatValues(id).length);
  if(existing&&!window.confirm('Importing will replace the current entries in your CV form with information detected in this resume. Your saved CV and original uploaded file will not be changed until you review and click Save profile & CV. Continue?')){say('resumeLibraryMessage','Import cancelled. Your CV has not been changed.');return;}
  Object.entries({cvName:'cvName',cvEmail:'cvEmail',cvPhone:'cvPhone',cvCnic:'cvCnic',cvWebsite:'cvWebsite',cvSummary:'cvSummary'}).forEach(([id,key])=>{if(fields[key])$(id).value=fields[key];});
  if(fields.cvName&&!$('cvName').value.trim())$('cvName').value=fields.cvName;
  if(fields.cvEmail)$('cvEmail').value=fields.cvEmail;
  if(fields.cvPhone)$('cvPhone').value=fields.cvPhone;
  if(fields.cvCnic)$('cvCnic').value=fields.cvCnic;
  if(fields.cvWebsite)$('cvWebsite').value=fields.cvWebsite;
  if(fields.cvSummary)$('cvSummary').value=fields.cvSummary;
  const map={educationEntries:'educationEntries',experienceEntries:'experienceEntries',skillsEntries:'skillsEntries',languageEntries:'languageEntries',trainingEntries:'trainingEntries',referenceEntries:'referenceEntries'};
  Object.entries(map).forEach(([id,key])=>{if(fields[key]?.length)renderRepeater(id,fields[key]);});
  updateProfileProgress();renderCvPreview();
  document.getElementById('personalSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  const found=Object.values(fields).filter(v=>Array.isArray(v)?v.length>0:!!v).length;
  say('resumeLibraryMessage','Resume text extracted. '+found+' types of details were detected. Please review every field, correct anything inaccurate, add missing information, then click Save profile & CV. Your original file remains unchanged.');
  say('cvMessage','Imported details are ready for your review. Nothing has been saved yet.');
 }catch(error){say('resumeLibraryMessage',error.message||'Could not extract this resume. You can still keep and download the original file.');}
 finally{if(button?.isConnected)button.disabled=false;}
}

async function handleResumeLibraryAction(event){const button=event.target.closest('[data-resume-action]');if(!button||!currentUser)return;const id=button.dataset.resumeId,action=button.dataset.resumeAction;button.disabled=true;try{const {data:resume,error}=await client.from('candidate_resumes').select('*').eq('id',id).eq('user_id',currentUser.id).single();if(error||!resume){say('resumeLibraryMessage','Could not find that resume in your account.');return;}if(action==='import'){await importResumeToCv(resume);}else if(action==='download'){const {data,error:linkError}=await client.storage.from(RESUME_BUCKET).createSignedUrl(resume.storage_path,60,{download:resume.file_name});if(linkError){say('resumeLibraryMessage','Could not create a secure download link: '+linkError.message);return;}const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener';link.download=resume.file_name;document.body.appendChild(link);link.click();link.remove();say('resumeLibraryMessage','Your secure download link is ready.');}else if(action==='default'){const {error:clearError}=await client.from('candidate_resumes').update({is_default:false}).eq('user_id',currentUser.id).eq('is_default',true);if(clearError){say('resumeLibraryMessage','Could not update your default resume: '+clearError.message);return;}const {error:setError}=await client.from('candidate_resumes').update({is_default:true}).eq('id',id).eq('user_id',currentUser.id);if(setError){say('resumeLibraryMessage','Could not set this as your default resume: '+setError.message);return;}say('resumeLibraryMessage','Your default resume has been updated.');await loadResumeLibrary();}else if(action==='delete'){if(!window.confirm('Delete "'+resume.file_name+'" from your Resume Library? This cannot be undone.'))return;const {error:removeError}=await client.storage.from(RESUME_BUCKET).remove([resume.storage_path]);if(removeError){say('resumeLibraryMessage','Could not delete the stored file: '+removeError.message);return;}const {error:deleteError}=await client.from('candidate_resumes').delete().eq('id',id).eq('user_id',currentUser.id);if(deleteError){say('resumeLibraryMessage','The file was removed, but its library record could not be deleted: '+deleteError.message);return;}say('resumeLibraryMessage','Resume deleted from your library.');await loadResumeLibrary();}}catch(error){say('resumeLibraryMessage','That resume action could not be completed. Please try again.');console.error('Resume library action error:',error);}finally{if(button.isConnected)button.disabled=false;}}

function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open');}
document.addEventListener('DOMContentLoaded',initCandidate);
