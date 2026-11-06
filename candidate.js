let client=null,currentUser=null,cropper=null,photoDataUrl=null,photoPath=null,removePhotoRequested=false;
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
 const {data,error}=await client.from('cv_profiles').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(error){say('cvMessage','Could not load saved CV: '+error.message);return;}
 if(data){const map={cvName:'full_name',cvEmail:'email',cvPhone:'phone',cvCity:'city',cvAddress:'address',cvWebsite:'website',cvSummary:'summary',cvEducation:'education',cvExperience:'experience',cvSkills:'skills',cvLanguages:'languages',cvCertifications:'certifications',cvReferences:'references_text'};
 Object.entries(map).forEach(([id,key])=>$(id).value=data[key]||'');
 photoPath=data.photo_path||null;
 if(photoPath)await loadSavedPhoto(photoPath);
 }else{$('cvName').value=currentUser.user_metadata?.full_name||'';$('cvEmail').value=currentUser.email||'';setPhotoPreview(null);}
}
async function loadSavedPhoto(path){
 const {data,error}=await client.storage.from('candidate-photos').createSignedUrl(path,3600);
 if(error){say('photoMessage','Your saved photograph could not be loaded. You can upload it again.');return;}
 try{const response=await fetch(data.signedUrl);if(!response.ok)throw new Error('Image unavailable');const blob=await response.blob();photoDataUrl=await blobToDataUrl(blob);setPhotoPreview(photoDataUrl);}catch(_){say('photoMessage','Your saved photograph could not be previewed. You can upload it again.');}
}
function setPhotoPreview(src){const img=$('photoPreview'),placeholder=$('photoPlaceholder');if(src){img.src=src;img.classList.remove('hidden');placeholder.classList.add('hidden');$('removePhoto').disabled=false;}else{img.removeAttribute('src');img.classList.add('hidden');placeholder.classList.remove('hidden');$('removePhoto').disabled=true;}}
function openPhotoCrop(e){
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(!['image/jpeg','image/png'].includes(file.type)){say('photoMessage','Please choose a JPG or PNG photograph.');return;}
 if(file.size>3*1024*1024){say('photoMessage','The photograph must be smaller than 3 MB.');return;}
 if(!window.Cropper){say('photoMessage','The photo editor could not load. Please refresh and try again.');return;}
 const reader=new FileReader();reader.onload=()=>{$('cropImage').src=reader.result;$('cropModal').classList.remove('hidden');if(cropper){cropper.destroy();cropper=null;}
 cropper=new Cropper($('cropImage'),{aspectRatio:1,viewMode:1,dragMode:'move',autoCropArea:.88, responsive:true,background:false,zoomOnWheel:true, movable:true,rotatable:false,scalable:false});};reader.readAsDataURL(file);
}
function closeCrop(){$('cropModal').classList.add('hidden');if(cropper){cropper.destroy();cropper=null;}}
function applyCrop(){if(!cropper)return;const canvas=cropper.getCroppedCanvas({width:600,height:600,fillColor:'#ffffff',imageSmoothingEnabled:true,imageSmoothingQuality:'high'});if(!canvas){say('photoMessage','Could not crop this image. Please try another photograph.');return;}
 photoDataUrl=canvas.toDataURL('image/jpeg',.88);removePhotoRequested=false;setPhotoPreview(photoDataUrl);say('photoMessage','Photograph cropped. Save your CV to keep the changes.');closeCrop();}
function removePhoto(){photoDataUrl=null;removePhotoRequested=true;setPhotoPreview(null);say('photoMessage','Photograph will be removed when you save your CV.');}
function dataUrlToBlob(dataUrl){const parts=dataUrl.split(','),mime=parts[0].match(/:(.*?);/)[1],binary=atob(parts[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:mime});}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
async function saveCv(e){e.preventDefault();if(!currentUser)return;
 say('cvMessage','Saving your CV…');
 let nextPhotoPath=photoPath;
 if(photoDataUrl){const blob=dataUrlToBlob(photoDataUrl),path=currentUser.id+'/profile.jpg';const {error:uploadError}=await client.storage.from('candidate-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true});
 if(uploadError){say('cvMessage','Could not upload photograph: '+uploadError.message);return;}nextPhotoPath=path;
 }else if(removePhotoRequested&&photoPath){const {error:removeError}=await client.storage.from('candidate-photos').remove([photoPath]);if(removeError){say('cvMessage','Could not remove photograph: '+removeError.message);return;}nextPhotoPath=null;}
 const record={user_id:currentUser.id,full_name:$('cvName').value.trim(),email:$('cvEmail').value.trim(),phone:$('cvPhone').value.trim(),city:$('cvCity').value.trim(),address:$('cvAddress').value.trim(),website:$('cvWebsite').value.trim(),summary:$('cvSummary').value.trim(),education:$('cvEducation').value.trim(),experience:$('cvExperience').value.trim(),skills:$('cvSkills').value.trim(),languages:$('cvLanguages').value.trim(),certifications:$('cvCertifications').value.trim(),references_text:$('cvReferences').value.trim(),photo_path:nextPhotoPath,updated_at:new Date().toISOString()};
 const {error}=await client.from('cv_profiles').upsert(record,{onConflict:'user_id'});
 if(error){say('cvMessage','Could not save CV: '+error.message);return;}
 photoPath=nextPhotoPath;removePhotoRequested=false;
 const {error:profileError}=await client.from('profiles').upsert({user_id:currentUser.id,full_name:record.full_name,email:record.email,phone:record.phone,city:record.city,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 say('cvMessage',profileError?'CV saved, but profile details could not be updated: '+profileError.message:'Your CV and photograph have been saved securely.');
}
function cvHeaderHtml(esc,val){return (photoDataUrl?'<img class="cv-photo" src="'+photoDataUrl+'" alt="Profile photograph">':'')+'<h1>'+esc(val('cvName'))+'</h1><p class="contact">'+esc(val('cvEmail'))+' · '+esc(val('cvPhone'))+' · '+esc(val('cvCity'))+'<br>'+esc(val('cvAddress'))+'<br>'+esc(val('cvWebsite'))+'</p>';}
function cvSections(esc,val){const fields=[['Professional Profile','cvSummary'],['Education','cvEducation'],['Work Experience','cvExperience'],['Skills','cvSkills'],['Languages','cvLanguages'],['Certifications & Training','cvCertifications'],['References','cvReferences']];return fields.map(([title,id])=>val(id)?'<h2>'+title+'</h2><p>'+esc(val(id)).replace(/\n/g,'<br>')+'</p>':'').join('');}
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
