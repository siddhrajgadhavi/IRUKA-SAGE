const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Fresh-install reset: this packaged build intentionally starts like a first login.
// It clears only this SAGE app's local browser state once; after that, new profile data persists normally.
const FRESH_INSTALL_KEY = 'irukaSageFreshInstall_20260911_GITHUB_CLEAN';
try {
  if (localStorage.getItem(FRESH_INSTALL_KEY) !== '1') {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(FRESH_INSTALL_KEY, '1');
  }
} catch (e) { console.warn('Fresh-install storage reset skipped:', e.message); }

// Step 1 account entry: one shared login page for students and hiring companies.
// This is intentionally email-only for now; email verification is the next step.
const AUTH_KEY = 'irukaSageAuth';
let auth = loadAuth();
let selectedRole = auth?.role || 'student';
function loadAuth(){ try { const v=JSON.parse(localStorage.getItem(AUTH_KEY)||'null'); return v && v.email && v.role ? v : null; } catch { return null; } }
function showLogin(){
  const screen=$('#loginScreen'), shell=$('#appShell');
  if(!screen||!shell) return;
  screen.style.display='flex'; shell.style.display='none';
  const input=$('#loginEmail'); if(input) input.value=auth?.email||'';
  $$('.role-card').forEach(b=>b.classList.toggle('selected',b.dataset.role===selectedRole));
}
function restoreStudentNav(){
  const nav=$('#nav'); if(!nav) return;
  nav.innerHTML=`<button class="nav-item active" data-view="dashboard"><span>⌂</span>Dashboard</button><button class="nav-item" data-view="internships"><span>◎</span>Internships</button><button class="nav-item" data-view="profile"><span>◌</span>Profile</button><button class="nav-item" data-view="skills"><span>◇</span>Skills</button><button class="nav-item" data-view="applications"><span>▣</span>Applications</button><button class="nav-item" data-view="offers"><span>↗</span>Internships Offered</button><button class="nav-item sage-nav" data-view="sage"><span>✦</span>SAGE</button>`;
  $$('.nav-item[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
}
function enterPortal(){
  const screen=$('#loginScreen'), shell=$('#appShell');
  if(screen) screen.style.display='none';
  if(shell) shell.style.display='flex';
  if(auth?.role==='company') showCompanyLanding();
  else { restoreStudentNav(); profile.email=auth.email; save(); render(); }
}
function companyNav(){
  const nav=$('#nav');
  if(!nav) return;
  const verified = companyIsFullyVerified();
  const postLabel = verified ? '＋ Post Internship' : '🔒 Post Internship';
  nav.innerHTML=`
    <button type="button" class="nav-item ${companyView==='dashboard'?'active':''}" data-company-view="dashboard"><span>⌂</span>Company Home</button>
    <button type="button" class="nav-item ${companyView==='candidates'?'active':''}" data-company-view="candidates"><span>◎</span>Preferred Interns</button>
    <button type="button" class="nav-item ${companyView==='applications'?'active':''}" data-company-view="applications"><span>▣</span>Applications</button>
    <button type="button" class="nav-item ${companyView==='postings'?'active':''} ${verified?'':'locked'}" data-company-view="postings"><span>${verified?'＋':'🔒'}</span>${postLabel.replace('＋ ','')}</button>
    <button type="button" class="nav-item ${companyView==='verification'?'active':''}" data-company-view="verification"><span>✓</span>Verification</button>`;
  nav.querySelectorAll('button[data-company-view]').forEach(btn=>{
    btn.onclick=(e)=>{
      e.preventDefault();
      const target=btn.dataset.companyView;
      if(target==='postings' && !companyIsFullyVerified()){
        companyView='verification';
        renderCompany();
        toast('Post Internship is locked — complete both verification layers');
        return;
      }
      companyView=target;
      renderCompany();
    };
  });
}
function companyIsFullyVerified(){
  const v=company.verification||{};
  return v.status==='verified' && v.checks && v.checks.domain===true && v.checks.evidence===true;
}
function companyHeader(title,eyebrow='ORGANISER PORTAL'){
  $('#pageTitle').textContent=title; $('#pageEyebrow').textContent=eyebrow;
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.companyView===companyView));
}
function companyAverage(){
  const vals=Object.values(matches).map(m=>m?.score).filter(v=>Number.isFinite(v));
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
}
function companyVerificationBadge(){
  const v=company.verification;
  if(v?.status==='verified') return `<span class="verify-badge verified">✓ Demo verified</span>`;
  if(v?.status==='needs-review') return `<span class="verify-badge needs-review">⚠ Needs review</span>`;
  return `<span class="verify-badge needs-review">○ Not verified</span>`;
}
function showCompanyLanding(){
  companyView='dashboard'; companyNav(); renderCompany();
}
function renderCompany(){
  if(auth?.role!=='company') return;
  companyNav();
  if(companyView==='dashboard') renderCompanyHome();
  if(companyView==='candidates') renderCompanyCandidates();
  if(companyView==='applications') renderCompanyApplications();
  if(companyView==='postings') renderCompanyPostings();
  if(companyView==='verification') renderCompanyVerification();
}
function renderCompanyHome(){
  companyHeader('Hiring Company');
  const verified=company.verification?.status==='verified';
  $('#avatar').textContent=initials(company.name||'HC');
  $('#view').innerHTML=`<div class="view-wrap">
    <section class="hero"><p class="eyebrow" style="color:#dcecff">IRUKA SAGE • ORGANISER</p><h2>Build the right internship team.</h2><p>Post opportunities, discover students with strong CV evidence, and proactively offer internships instead of waiting for applications.</p><div class="hero-actions"><button class="primary" data-company-view-btn="postings">Post an internship</button><button class="secondary" data-company-view-btn="candidates">Find preferred interns</button></div></section>
    <div class="grid grid-3"><div class="stat-card"><span>COMPANY STATUS</span><b>${verified?'Verified':'Demo setup'}</b><small>${verified?'Your organiser profile passed the demo verification flow.':'Complete demo verification before publishing a role.'}</small></div><div class="stat-card"><span>STUDENT DISCOVERY</span><b>CV-first</b><small>Review candidate evidence and match context before making an offer.</small></div><div class="stat-card"><span>DIRECT OFFERS</span><b>${company.offers?.length||0}</b><small>Internship offers sent from this organiser account.</small></div></div>
    <div class="section-head"><div><h3>Organiser workspace</h3><p>Everything you need for the demo company side.</p></div>${companyVerificationBadge()}</div>
    <div class="grid grid-3"><div class="card"><b>Preferred Interns</b><p class="muted">See demo students with strong CV profiles, match scores and skill gaps.</p><button class="secondary" data-company-view-btn="candidates">Review candidates</button></div><div class="card"><b>Applications</b><p class="muted">See who applied to your internships and open each applicant's CV.</p><button class="secondary" data-company-view-btn="applications">View applications</button></div><div class="card"><b>Company Verification</b><p class="muted">A demo authenticity screen helps prevent fake organiser accounts and trolling posts.</p><button class="secondary" data-company-view-btn="verification">Open verification</button></div></div>
  </div>`;
  $$('[data-company-view-btn]').forEach(b=>b.onclick=()=>{companyView=b.dataset.companyViewBtn;renderCompany();});
}
function renderCompanyCandidates(){
  companyHeader('Preferred Interns','CANDIDATE DISCOVERY');
  const demoCandidates=[
    {id:'demo-student-01',name:'Aarav Mehta',education:'B.Tech CSE • Cybersecurity',score:94,skills:['Python','Linux','Cybersecurity','Git'],gaps:['Networking'],cv:'Cybersecurity portfolio + Python automation CV',fit:'Excellent fit for security-focused internships.'},
    {id:'demo-student-02',name:'Diya Shah',education:'B.Tech CSE • Software Engineering',score:88,skills:['JavaScript','React','Node.js','Git'],gaps:['SQL'],cv:'Full-stack projects + frontend portfolio CV',fit:'Strong product engineering profile with low skill gaps.'},
    {id:'demo-student-03',name:'Kabir Patel',education:'B.Tech CSE • AI/ML',score:84,skills:['Python','Pandas','NumPy','Machine Learning'],gaps:['Git'],cv:'ML projects + data analysis portfolio CV',fit:'Good applied AI candidate with one clear gap.'}
  ];
  $('#view').innerHTML=`<div class="view-wrap"><div class="notice"><b>DEMO CANDIDATE DISCOVERY</b><br>These candidates are synthetic presentation data. In the production version this area can be populated from student CV/profile records with appropriate consent and access controls.</div><div class="section-head"><div><h3>Preferred interns</h3><p>Prioritize strong CVs, high internship fit and fewer skill gaps.</p></div><span class="status">${demoCandidates.length} demo candidates</span></div><div class="grid grid-3">${demoCandidates.map(c=>`<article class="card candidate-card"><div class="candidate-top"><div class="avatar mini">${esc(initials(c.name))}</div><div><b>${esc(c.name)}</b><div class="tiny muted">${esc(c.education)}</div></div><span class="score-pill">${c.score}%</span></div><p class="tiny muted" style="margin-top:12px"><b>CV:</b> ${esc(c.cv)}</p><div class="tag-row">${c.skills.map(x=>`<span class="tag matched">${esc(x)}</span>`).join('')}${c.gaps.map(x=>`<span class="tag gap">${esc(x)}</span>`).join('')}</div><p class="tiny" style="margin-top:11px">${esc(c.fit)}</p><div class="card-actions"><button class="secondary" data-cv="${c.id}">Review CV</button><button class="primary" data-offer-candidate="${c.id}">Offer internship</button></div></article>`).join('')}</div></div>`;
  $$('[data-cv]').forEach(b=>b.onclick=()=>{const c=demoCandidates.find(x=>x.id===b.dataset.cv); if(c) openCvPreview({name:c.name,email:'demo@candidate.example',education:c.education,skills:c.skills,interests:['Cybersecurity','Technology'],projects:[c.cv],goal:'Internship candidate'},'Demo CV — '+c.name);});
  $$('[data-offer-candidate]').forEach(b=>b.onclick=()=>{company.offers=Array.isArray(company.offers)?company.offers:[];if(!company.offers.some(x=>x.candidateId===b.dataset.offerCandidate)){company.offers.push({candidateId:b.dataset.offerCandidate,date:new Date().toLocaleDateString(),status:'demo-offer'});saveCompany();}toast('Demo internship offer prepared');renderCompany();});
}
function renderCompanyApplications(){
  companyHeader('Applications','CANDIDATE APPLICATIONS');
  const demoApplications=[
    {id:'demo-app-01',studentId:'demo-student-01',name:'Aarav Mehta',email:'aarav@example.com',role:'Cybersecurity Analyst Intern',organization:'Nexora Security Labs',date:'11 Sep 2026',score:94,status:'Under review',education:'B.Tech CSE • Cybersecurity',skills:['Python','Linux','Cybersecurity','Git'],interests:['Cybersecurity','Threat Detection'],projects:['Python automation toolkit','Cybersecurity lab portfolio'],goal:'Cybersecurity internship'},
    {id:'demo-app-02',studentId:'demo-student-02',name:'Diya Shah',email:'diya@example.com',role:'Software Engineering Intern',organization:'Nexora Security Labs',date:'11 Sep 2026',score:88,status:'Under review',education:'B.Tech CSE • Software Engineering',skills:['JavaScript','React','Node.js','Git'],interests:['Web Development','Product Engineering'],projects:['Full-stack internship portal','React dashboard'],goal:'Software engineering internship'},
    {id:'demo-app-03',studentId:'demo-student-03',name:'Kabir Patel',email:'kabir@example.com',role:'AI/ML Intern',organization:'Nexora Security Labs',date:'10 Sep 2026',score:84,status:'Shortlisted',education:'B.Tech CSE • AI/ML',skills:['Python','Pandas','NumPy','Machine Learning'],interests:['AI/ML','Data Science'],projects:['ML prediction project','Data analysis portfolio'],goal:'Applied AI internship'}
  ];
  const realApplications=applications.map(a=>({
    ...a,
    id:'student-'+a.id,
    name:profile.name||'Student applicant', email:profile.email||'student@example.com',
    role:(internships.find(i=>i.id===a.id)||{}).title||'Internship',
    organization:(internships.find(i=>i.id===a.id)||{}).organization||'Iruka SAGE employer',
    date:a.date||'Today', score:(matches[a.id]||{}).score||null,
    status:'New', education:profile.education||'Education not added', skills:profile.skills||[],
    interests:profile.interests||[], projects:profile.projects||[], goal:profile.goal||'Internship'
  }));
  const all=[...realApplications,...demoApplications];
  $('#view').innerHTML=`<div class="view-wrap"><div class="notice"><b>APPLICATIONS WORKSPACE</b><br>Recruiters can open a candidate CV from every application. Demo applications are synthetic presentation data.</div><div class="section-head"><div><h3>Internship applications</h3><p>Review applicants, match context and CV evidence in one place.</p></div><span class="status">${all.length} applications</span></div><div class="card">${all.map(a=>`<div class="app-row application-row"><div class="avatar mini">${esc(initials(a.name))}</div><div style="flex:1"><b>${esc(a.name)}</b><div class="tiny muted">${esc(a.role)} • ${esc(a.date)}</div><div class="tiny muted">${esc(a.education)}</div></div>${a.score!==null?`<span class="score-pill">${a.score}%</span>`:''}<span class="status">${esc(a.status)}</span><button class="secondary" data-app-cv="${esc(a.id)}">View CV</button></div>`).join('')}</div></div>`;
  $$('[data-app-cv]').forEach(b=>{const a=all.find(x=>x.id===b.dataset.appCv);if(a)b.onclick=()=>openCvPreview(a,'Applicant CV — '+a.name);});
}

function renderCompanyPostings(){
  if(!companyIsFullyVerified()){ companyView='verification'; renderCompany(); toast('Verify your company before posting an internship'); return; }
  companyHeader('Post Internship','INTERNSHIP MANAGEMENT');
  const posts=Array.isArray(company.postings)?company.postings:[];
  $('#view').innerHTML=`<div class="view-wrap"><section class="hero"><p class="eyebrow" style="color:#dcecff">CREATE AN OPPORTUNITY</p><h2>Tell students what you need.</h2><p>Add the role requirements SAGE will use when matching students to your internship.</p></section><div class="card"><div class="section-head" style="margin-top:0"><div><h3>New internship</h3><p>Demo posting flow — no public publishing yet.</p></div>${companyVerificationBadge()}</div><form id="companyPostForm" class="form-grid"><div class="field"><label>INTERNSHIP TITLE</label><input name="title" placeholder="e.g. Cybersecurity Analyst Intern" required></div><div class="field"><label>LOCATION / MODE</label><input name="location" placeholder="Remote / Ahmedabad / Hybrid"></div><div class="field full"><label>REQUIRED SKILLS <span class="muted">(comma separated)</span></label><input name="skills" placeholder="Python, Linux, Networking, Git" required></div><div class="field"><label>DURATION</label><input name="duration" placeholder="3 months"></div><div class="field"><label>STIPEND</label><input name="stipend" placeholder="₹15,000/mo"></div><div class="field full"><label>DESCRIPTION</label><textarea name="description" placeholder="What will the intern work on?" required></textarea></div><div class="field full"><button class="primary" type="submit">Save demo internship post</button></div></form></div><div class="section-head"><div><h3>Your posts</h3><p>${posts.length?'Saved demo roles ready for the next organiser steps.':'No posts yet.'}</p></div></div>${posts.map(p=>`<div class="card app-row"><div><b>${esc(p.title)}</b><div class="tiny muted">${esc(p.location||'Location flexible')} • ${esc(p.duration||'Duration TBD')}</div></div><span class="status">Demo post</span><div class="tiny">${esc(p.skills.join(', '))}</div></div>`).join('')}</div>`;
  $('#companyPostForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);company.postings.unshift({id:'company-'+Date.now(),title:fd.get('title').trim(),location:fd.get('location').trim(),skills:fd.get('skills').split(',').map(x=>x.trim()).filter(Boolean),duration:fd.get('duration').trim(),stipend:fd.get('stipend').trim(),description:fd.get('description').trim(),createdAt:new Date().toISOString(),demo:true});saveCompany();toast('Demo internship saved');renderCompany();});
}
function renderCompanyVerification(){
  companyHeader('Company Verification','TRUST & SAFETY');
  const v=company.verification||{};
  const checks=v.checks||{};
  const email=String(company.email||'').trim().toLowerCase();
  const website=String(company.website||'').trim();
  let websiteDomain=''; try{websiteDomain=new URL(website).hostname.replace(/^www\./,'').toLowerCase();}catch{}
  const emailDomain=email.split('@')[1]||'';
  const emailLooksCompany=!!emailDomain && !['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','proton.me','protonmail.com'].includes(emailDomain);
  $('#view').innerHTML=`<div class="view-wrap">
    <section class="hero"><p class="eyebrow" style="color:#dcecff">RECRUITER VERIFICATION</p><h2>Verify the person behind the internship.</h2><p>SAGE uses two simple layers before a company can publish an internship: a company-domain email and company employment evidence.</p></section>
    <div class="notice"><b>Why two layers?</b><br>The email layer helps establish control of a company-domain address. The evidence layer asks for either an employee ID card or a company letter showing the company name. Both are required to unlock <b>Post Internship</b>.</div>
    <div class="card">
      <div class="section-head" style="margin-top:0"><div><h3>Layer 1 · Company email</h3><p>Use an address belonging to your organisation's domain.</p></div><span class="status">${checks.domain?'✓ Passed':'1 / 2'}</span></div>
      <form id="companyVerifyForm" class="form-grid">
        <div class="field"><label>COMPANY NAME</label><input name="name" value="${esc(company.name||'')}" placeholder="e.g. Nexora Security Labs" required></div>
        <div class="field"><label>COMPANY EMAIL</label><input name="email" type="email" value="${esc(company.email||auth?.email||'')}" placeholder="recruiter@company.com" required></div>
        <div class="field"><label>COMPANY WEBSITE</label><input name="website" value="${esc(company.website||'')}" placeholder="https://company.com" required></div>
        <div class="field full"><div class="notice ${checks.domain?'':'warn'}"><b>${checks.domain?'✓ Company email accepted':'🔒 Posting remains locked'}</b><br>${checks.domain?'The email domain matches the company website domain.':'Use a company-domain email and a matching company website domain. Personal email providers do not unlock posting.'}</div></div>
        <div class="section-head full" style="margin-top:8px"><div><h3>Layer 2 · Company employment evidence</h3><p>Choose one: an employee ID card OR a company letter containing the company name.</p></div><span class="status">${checks.evidence?'✓ Passed':'2 / 2'}</span></div>
        <div class="field"><label>REPRESENTATIVE NAME</label><input name="representative" value="${esc(company.representative||'')}" placeholder="Full name" required></div>
        <div class="field"><label>DESIGNATION</label><input name="designation" value="${esc(company.designation||'')}" placeholder="Talent Acquisition / HR" required></div>
        <div class="field"><label>COMPANY NAME ON DOCUMENT</label><input name="evidenceCompany" value="${esc(company.evidenceCompany||company.name||'')}" placeholder="Company name printed on ID/letter" required></div>
        <div class="field full"><label>EMPLOYMENT EVIDENCE</label><div class="upload-box"><strong>Employee ID card OR company letter</strong><small>For this beta, the uploaded file is recorded as evidence. Production should inspect the document and confirm the company through authoritative channels.</small><input id="employeeEvidence" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></div></div>
        <div class="field full"><div class="notice ${checks.evidence?'':'warn'}"><b>${checks.evidence?'✓ Company evidence accepted':'Evidence required'}</b><br>${checks.evidence?'The representative and company name are consistent with the submitted evidence record.':'Enter the representative details and the company name shown on the ID card/letter, then attach the evidence file.'}</div></div>
        <div class="field"><button class="secondary" id="loadDemoRecruiter" type="button">Load demo recruiter</button></div>
        <div class="field"><button class="primary" type="submit">Run 2-layer verification</button></div>
      </form>
    </div>
    ${v.status?`<div class="card"><div class="section-head" style="margin-top:0"><div><h3>Verification result</h3><p>Both required layers are shown separately.</p></div>${companyVerificationBadge()}</div><div class="verify-result ${v.status}"><b>${v.status==='verified'?'✓ VERIFIED COMPANY REPRESENTATIVE — DEMO':'⚠ VERIFICATION INCOMPLETE'}</b><p class="muted">${esc(v.message||'')}</p></div><div class="verification-layers"><div class="verify-layer ${checks.domain?'passed':'failed'}"><b>${checks.domain?'✓':'○'} 1 · Company-domain email</b><span>${esc(v.details?.domain||'Not established')}</span></div><div class="verify-layer ${checks.evidence?'passed':'failed'}"><b>${checks.evidence?'✓':'○'} 2 · Company evidence</b><span>${esc(v.details?.evidence||'Not established')}</span></div></div>${companyIsFullyVerified()?'<div class="notice" style="margin-top:12px"><b>🔓 Post Internship unlocked.</b><br>You have completed both verification layers required by this beta.</div>':'<div class="notice warn" style="margin-top:12px"><b>🔒 Post Internship locked.</b><br>Complete both layers above to publish an internship.</div>'}<div class="notice" style="margin-top:12px"><b>Production note:</b> This SIH beta demonstrates the access-control workflow. Production deployment should additionally verify the uploaded evidence through authoritative company channels.</div></div>`:''}
  </div>`;
  $('#loadDemoRecruiter')?.addEventListener('click',()=>{
    const set=(n,val)=>{const el=document.querySelector(`[name="${n}"]`);if(el)el.value=val;};
    set('name','Nexora Security Labs'); set('email','recruiter@nexora.example'); set('website','https://nexora.example'); set('representative','Aarav Mehta'); set('designation','Talent Acquisition'); set('evidenceCompany','Nexora Security Labs');
    const f=$('#employeeEvidence'); if(f) f.dataset.demoEvidence='true';
    toast('Demo recruiter loaded — run verification');
  });
  $('#companyVerifyForm').addEventListener('submit',e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    company.name=String(fd.get('name')||'').trim(); company.email=String(fd.get('email')||'').trim().toLowerCase(); company.website=String(fd.get('website')||'').trim(); company.representative=String(fd.get('representative')||'').trim(); company.designation=String(fd.get('designation')||'').trim(); company.evidenceCompany=String(fd.get('evidenceCompany')||'').trim();
    let domain=''; try{domain=new URL(company.website).hostname.replace(/^www\./,'').toLowerCase();}catch{}
    const emailDomain=company.email.split('@')[1]||'';
    const domainPass=!!domain&&!!emailDomain&&emailDomain===domain&&emailLooksCompanyFor(emailDomain);
    const evidenceFile=$('#employeeEvidence');
    const demo=company.email==='recruiter@nexora.example' && domain==='nexora.example' && company.evidenceCompany==='Nexora Security Labs' && company.representative==='Aarav Mehta' && evidenceFile?.dataset.demoEvidence==='true';
    const evidencePass=!!company.representative&&!!company.designation&&!!company.evidenceCompany&&company.evidenceCompany.toLowerCase()===company.name.toLowerCase()&&(!!evidenceFile?.files?.length||demo);
    const good=domainPass&&evidencePass;
    company.verification={status:good?'verified':'needs-review',checks:{domain:domainPass,evidence:evidencePass},details:{domain:domainPass?`Email domain ${emailDomain} matches the company website.`:`Email domain ${emailDomain||'missing'} does not match the company website ${domain||'missing'}.`,evidence:evidencePass?`Company evidence supplied for ${company.evidenceCompany}; representative details recorded.`:'Provide an employee ID card or company letter and ensure the company name matches.'},message:good?'Both verification layers passed. Post Internship is now unlocked inside the SIH demo.':'One or more required verification layers failed. Complete the missing layer and try again.',verifiedAt:new Date().toISOString(),demo:true};
    saveCompany(); companyView=good?'postings':'verification'; toast(good?'Company verified — posting unlocked':'Verification incomplete'); renderCompany();
  });
}
function emailLooksCompanyFor(d){ return !!d && !['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','proton.me','protonmail.com'].includes(String(d).toLowerCase()); }
function saveCompany(){localStorage.setItem('irukaSageCompany',JSON.stringify(company));localStorage.setItem('irukaSageStudentOffers',JSON.stringify(studentOffers));}

const DEFAULT_PROFILE = {name:'',email:'',education:'',goal:'',skills:[],verifiedSkills:[],interests:[],projects:[],certificates:[],projectEvidence:[],identityVerification:null,nameParts:{first:'',middle:'',last:''}};
let profile = load('irukaSageProfile', DEFAULT_PROFILE);
let applications = load('irukaSageApplications', []);
let certificates = load('irukaSageCertificates', profile.certificates || []);
profile.certificates = certificates;
profile.verifiedSkills = Array.isArray(profile.verifiedSkills) ? profile.verifiedSkills : [];
profile.projectEvidence = Array.isArray(profile.projectEvidence) ? profile.projectEvidence : [];
profile.identityVerification = profile.identityVerification && typeof profile.identityVerification === 'object' ? profile.identityVerification : null;
// 4.1 migration: discard legacy QR/DigiLocker/Offline-eKYC identity state. The current flow is Aadhaar card photo -> local OCR -> government-name import.
if (profile.identityVerification && (profile.identityVerification.status==='qr-detected-needs-verification' || profile.identityVerification.qrDetected || profile.identityVerification.qrPayloadRecovered || /secure qr|digilocker|offline e-kyc|cryptographic uidai/i.test(String(profile.identityVerification.message||profile.identityVerification.error||'')))) { profile.identityVerification = null; save(); }
profile.nameParts = profile.nameParts && typeof profile.nameParts === 'object' ? profile.nameParts : {first:'',middle:'',last:''};
// Legacy migration: old manually-entered skills are not treated as verified.
profile.skills = [...new Set(profile.verifiedSkills)];
// Recover matchable verified skills from credential-backed certificates saved on this device.
try {
  (profile.certificates||[]).filter(c=>c && c.credentialBacked===true && c.claimedSkill).forEach(c=>{
    const label=labelForSkill(c.claimedSkill);
    if(label && !profile.verifiedSkills.includes(label)) profile.verifiedSkills.push(label);
  });
  profile.skills=[...new Set(profile.verifiedSkills)];
} catch(e) {}
let internships = [];
let matches = {};
let currentView = 'dashboard';
let companyView = 'dashboard';
let company = load('irukaSageCompany', {name:'',email:'',website:'',description:'',representative:'',designation:'',employeeId:'',authorization:'',verification:null,postings:[],offers:[]});
// Migrate older 3-layer demo data so it cannot break the new two-layer Verification page.
try { if(company?.verification?.checks && !Object.prototype.hasOwnProperty.call(company.verification.checks,'evidence')) company.verification=null; } catch(e) { company.verification=null; }
let studentOffers = load('irukaSageStudentOffers', []);
let history = load('irukaSageChat', [{from:'sage',text:'Hey 👋 I’m SAGE. Tell me the career problem you want to solve — matches, skills, projects, CV, or interview prep.'}]);
if (history.length && history[0]?.text === 'Hey — I’m SAGE. I can review your profile, explain internship matches, find real skill gaps, and help with CVs, projects, and interview prep.') { history[0].text = 'Hey 👋 I’m SAGE. Tell me the career problem you want to solve — matches, skills, projects, CV, or interview prep.'; }

const views = {
  dashboard:{title:'Dashboard',eyebrow:'OVERVIEW'},
  internships:{title:'Internships',eyebrow:'OPPORTUNITIES'},
  profile:{title:'Profile',eyebrow:'YOUR FOUNDATION'},
  skills:{title:'Skills',eyebrow:'SKILL INTELLIGENCE'},
  applications:{title:'Applications',eyebrow:'TRACKING'},
  offers:{title:'Internships Offered',eyebrow:'DIRECT OFFERS'},
  documents:{title:'Documents',eyebrow:'CERTIFICATE VERIFICATION'},
  sage:{title:'SAGE',eyebrow:'AI CAREER ASSISTANT'}
};

function load(k,fallback){try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback}}
function save(){localStorage.setItem('irukaSageProfile',JSON.stringify(profile));localStorage.setItem('irukaSageApplications',JSON.stringify(applications));localStorage.setItem('irukaSageChat',JSON.stringify(history.slice(-30)));
  localStorage.setItem('irukaSageCertificates',JSON.stringify(certificates));}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function initials(s=''){return s.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'IS'}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}
function certificateNameParts(){
  const parts = profile.nameParts && typeof profile.nameParts === 'object' ? profile.nameParts : {};
  let first = String(parts.first || '').trim();
  let middle = String(parts.middle || '').trim();
  let last = String(parts.last || '').trim();
  // Safe fallback for profiles created before nameParts existed.
  if(!first && !last && profile.name){
    const tokens = String(profile.name).trim().split(/\s+/).filter(Boolean);
    first = tokens.shift() || '';
    last = tokens.length ? tokens.pop() : '';
    middle = tokens.join(' ');
  }
  return {first, middle, last};
}

function profileCompletion(){let n=0,total=6;if(profile.name)n++;if(profile.education)n++;if(verifiedProfileSkills().length)n++;if(profile.interests.length)n++;if(profile.projects.length)n++;if(identityIsVerified())n++;return Math.round(n/total*100)}
function applied(id){return applications.some(a=>a.id===id)}

async function api(path, options={}){
  let r;
  try{
    r=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  }catch(e){ throw new Error(`Could not reach SAGE server: ${e.message||'network error'}`); }
  const text=await r.text();
  let data={};
  try{ data=text?JSON.parse(text):{}; }catch{ data={error:text||'Server returned an unreadable response'}; }
  if(!r.ok){
    const detail=data.detail?`\n${data.detail}`:'';
    throw new Error((data.error||`SAGE server returned HTTP ${r.status}`)+detail);
  }
  return data;
}
async function refreshMatches(){const d=await api('/api/matches',{method:'POST',body:JSON.stringify({profile})});matches=Object.fromEntries(d.matches.map(x=>[x.id,x.match]));}

function setView(view){currentView=view;const meta=views[view];$('#pageTitle').textContent=meta.title;$('#pageEyebrow').textContent=meta.eyebrow;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#sidebar').classList.remove('open');render();}

function render(){
  $('#avatar').textContent = profile.name ? initials(profile.name) : 'U';
  if(currentView==='dashboard') renderDashboard();
  if(currentView==='internships') renderInternships();
  if(currentView==='profile') renderProfile();
  if(currentView==='skills') renderSkills();
  if(currentView==='applications') renderApplications();
  if(currentView==='documents') renderDocuments();
  if(currentView==='sage') renderSagePage();
  if(currentView==='offers') renderOffers();
}

function topMatch(){return internships.map(i=>({i,m:matches[i.id]})).filter(x=>x.m&&x.m.score!==null).sort((a,b)=>b.m.score-a.m.score)[0]}

function renderDashboard(){
  const completion=profileCompletion(); const top=topMatch(); const scored=Object.values(matches).filter(m=>m.score!==null);
  const avg=scored.length?Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length):null;
  $('#view').innerHTML=`<div class="view-wrap">
    <section class="hero"><p class="eyebrow" style="color:#dcecff">IRUKA SAGE</p><h2>${profile.name?`Welcome back, ${esc(profile.name.split(' ')[0])}.`:'Build a profile that actually counts.'}</h2><p>SAGE uses your real profile to rank opportunities, explain skill gaps, and give practical career guidance. No fake percentages. No ignoring skills you already added.</p><div class="hero-actions"><button class="primary" data-go="sage">Talk to SAGE</button><button class="secondary" data-go="profile">${completion<100?'Complete profile':'Edit profile'}</button></div></section>
    <div class="grid grid-4 stats">
      <div class="stat-card"><span>PROFILE COMPLETION</span><strong>${completion}%</strong><div class="progress"><i style="width:${completion}%"></i></div></div>
      <div class="stat-card"><span>SKILLS ADDED</span><strong>${verifiedProfileSkills().length}</strong><small>${verifiedProfileSkills().length?'Verified skills used in matching':'Upload certificates to unlock matching'}</small></div>
      <div class="stat-card"><span>AVERAGE MATCH</span><strong>${avg===null?'—':avg+'%'}</strong><small>${avg===null?'No score until skills exist':'Across available demo roles'}</small></div>
      <div class="stat-card"><span>APPLICATIONS</span><strong>${applications.length}</strong><small>Saved on this device</small></div>
    </div>
    <div class="section-head"><div><h3>${verifiedProfileSkills().length?'Your strongest matches':'Matching is waiting on verified skills'}</h3><p>${verifiedProfileSkills().length?'Calculated from verified skills + profile context':'Upload at least one certificate and verify a skill to start scoring.'}</p></div><button class="ghost" data-go="internships">View all</button></div>
    ${verifiedProfileSkills().length?`<div class="grid grid-3">${internships.slice().sort((a,b)=>(matches[b.id]?.score||0)-(matches[a.id]?.score||0)).slice(0,3).map(internshipCard).join('')}</div>`:`<div class="card empty"><b>No meaningless 42% here.</b>Add your actual skills first. Iruka Sage only shows a numeric match once it has enough information to justify one.<div class="spacer"></div><button class="primary" data-go="skills">Add skills</button></div>`}
    <div class="section-head"><div><h3>SAGE recommendation</h3><p>A profile-aware next step</p></div></div>
    <div class="card">${top?`<b>Start with ${esc(top.i.title)}</b><p class="muted">You currently match ${top.m.matched.length} of ${top.i.skills.length} listed skills. ${top.m.gaps.length?`Best next gap to close: <b>${esc(top.m.gaps[0])}</b>.`:'You cover every listed skill — focus on project proof and interview depth.'}</p><button class="secondary" data-ask="Tell me why my best internship match is the best one">Ask SAGE why</button>`:`<b>Give SAGE something real to work with.</b><p class="muted">Add your skills and target role. SAGE will use them instead of treating you like a blank profile.</p><button class="secondary" data-go="profile">Build profile</button>`}</div>
  </div>`; const offerWrap=document.createElement('div'); offerWrap.innerHTML=renderStudentOfferSection(); $('#view').appendChild(offerWrap.firstElementChild); bindCommon();
}

function internshipCard(i){const m=matches[i.id]||{score:null,matched:[],gaps:i.skills};return `<article class="card internship-card">
  <div class="org-row"><div class="org-info"><div class="org-logo">${esc(initials(i.organization))}</div><div><h4>${esc(i.title)}</h4><p>${esc(i.organization)} · <span class="verified">✓ Demo verified</span></p></div></div>${m.score===null?`<div class="match-locked">Score locked<br><span class="tiny">add skills</span></div>`:`<div class="match-ring" style="--score:${m.score}"><b>${m.score}%</b></div>`}</div>
  <p class="muted tiny" style="line-height:1.55;margin:0">${esc(i.description)}</p>
  <div class="meta"><span>${esc(i.mode)}</span><span>${esc(i.duration)}</span><span>${esc(i.stipend)}</span></div>
  <div class="tags">${i.skills.map(s=>`<span class="tag ${m.matched?.includes(s)?'matched':m.score!==null&&m.gaps?.includes(s)?'gap':''}">${esc(s)}</span>`).join('')}</div>
  ${m.score!==null?`<div class="tiny muted"><b style="color:#087955">Matched:</b> ${m.matched.length?esc(m.matched.join(', ')):'none yet'}<br><b style="color:#9b650b">Gaps:</b> ${m.gaps.length?esc(m.gaps.join(', ')):'none'}</div>`:`<div class="notice warn">Complete your skills to unlock this match score.</div>`}
  <div class="card-actions">${m.score!==null&&m.gaps.length?`<button class="gap-btn" data-gap="${i.id}">✦ Close skill gap</button>`:''}<button class="primary" data-apply="${i.id}">${applied(i.id)?'Applied ✓':'Apply'}</button><button class="secondary" data-ask="Explain my match for ${esc(i.title)}">Ask SAGE</button></div>
</article>`}


function averageGapCount(){
  const vals=Object.values(matches).filter(m=>m&&m.score!==null);
  return vals.length?Math.round(vals.reduce((a,m)=>a+(m.gaps?.length||0),0)/vals.length):null;
}
function eligibleForDirectOffer(){
  const avg=companyAverage(); const gaps=averageGapCount();
  return avg!==null && avg>=80 && gaps!==null && gaps<=2;
}
function renderStudentOfferSection(){
  const eligible=eligibleForDirectOffer();
  const avg=companyAverage(); const gaps=averageGapCount();
  if(!eligible) return `<section class="card direct-offer-card"><div class="section-head" style="margin-top:0"><div><h3>Internships Offered</h3><p>Companies can proactively offer strong candidates an internship.</p></div><span class="status">Not unlocked</span></div><div class="notice">Direct-offer demo unlocks when your average internship match is at least <b>80%</b> and your average skill gaps are <b>2 or fewer</b>. Current: ${avg===null?'—':avg+'%'} average match · ${gaps===null?'—':gaps} average gaps.</div></section>`;
  const demoOffer=studentOffers.find(x=>x.demo&&x.studentEmail===profile.email) || {id:'demo-offer-01',demo:true,studentEmail:profile.email,title:'Cybersecurity Analyst Intern',organization:'Nexora Security Labs',location:'Hybrid',stipend:'₹12,000/mo',message:'Your profile is a strong match, so our hiring team would like to invite you to discuss this internship directly.'};
  return `<section class="card direct-offer-card"><div class="section-head" style="margin-top:0"><div><div class="demo-ribbon">● DEMO DIRECT OFFER</div><h3 style="margin-top:8px">Internships Offered</h3><p>A company found your profile and wants to invite you directly.</p></div><span class="verify-badge verified">✓ Offer unlocked</span></div><div class="offer-row"><div><b>${esc(demoOffer.title)}</b><div class="tiny muted">${esc(demoOffer.organization)} • ${esc(demoOffer.location)} • ${esc(demoOffer.stipend)}</div><p class="tiny">${esc(demoOffer.message)}</p></div><button class="primary" data-view-offers>View offer</button></div></section>`;
}
function renderOffers(){
  const eligible=eligibleForDirectOffer();
  $('#pageTitle').textContent='Internships Offered'; $('#pageEyebrow').textContent='DIRECT OFFERS';
  const avg=companyAverage(); const gaps=averageGapCount();
  $('#view').innerHTML=`<div class="view-wrap"><section class="hero"><p class="eyebrow" style="color:#dcecff">DIRECT OPPORTUNITIES</p><h2>Companies can find you too.</h2><p>Strong student profiles can receive an internship offer without submitting a traditional application first.</p></section>${eligible?`<div class="card"><div class="demo-ribbon">● DEMO OFFER</div><h3 style="margin-top:10px">Cybersecurity Analyst Intern</h3><p><b>Nexora Security Labs</b> • Hybrid • ₹12,000/mo</p><p class="muted">Your ${avg}% average match and ${gaps} average skill gaps meet the demo threshold. The hiring team reviewed your CV/profile and sent a direct invitation.</p><div class="card-actions"><button class="primary" data-accept-demo-offer>Accept / respond</button><button class="secondary" data-ask="Explain what I should prepare before responding to this direct internship offer">Ask SAGE what to prepare</button></div></div>`:`<div class="card"><h3 style="margin-top:0">No direct offers yet</h3><p class="muted">Reach an average match of at least 80% while keeping average skill gaps at 2 or fewer to unlock the demo offer.</p><div class="notice">Current: ${avg===null?'—':avg+'%'} average match · ${gaps===null?'—':gaps} average gaps.</div></div>`}</div>`;
  $('[data-accept-demo-offer]')?.addEventListener('click',()=>toast('Demo response recorded — recruiter follow-up would happen here.'));
  bindCommon();
}
function renderInternships(){
  $('#view').innerHTML=`<div class="view-wrap"><div class="section-head" style="margin-top:0"><div><div class="demo-ribbon">● DEMO INTERNSHIPS</div><h3 style="margin-top:8px">Internship opportunities</h3><p>Six built-in demo roles are ready for your presentation. Match scores come from your profile, not from SAGE guessing.</p></div></div>
    <div class="notice" style="margin-bottom:16px">Green skill tags are already in your profile. Orange tags are actual gaps. Equivalent names such as <b>Python</b> and <b>python3</b> are normalized before comparison.</div>
    <div class="grid grid-3">${internships.map(internshipCard).join('')}</div></div>`; bindCommon();
}

function identityIsVerified(){const st=String(profile.identityVerification?.status||'').toLowerCase();return !!profile.identityVerification && ['name-imported','verified'].includes(st);}
function identityDisplay(){
  const v=profile.identityVerification;
  if(identityIsVerified()) return `<div class="notice"><b>✓ Government identity document verified</b><br>Government name: ${esc(v.verifiedName)}<br><span class="tiny muted">Imported from the uploaded Aadhaar card photo using local image processing and OCR. The identity image stays local to SAGE.</span></div>`;
  if(v?.status==='needs-review') return `<div class="notice warn"><b>⚠ Identity document needs review</b><br>${esc(v.message||v.error||'The document could be read, but SAGE could not establish enough evidence for automatic verification.')}<br><span class="tiny muted">Upload a clear Aadhaar card photo with the full card visible.</span></div>`;
  if(v?.status==='name-mismatch') return `<div class="notice warn"><b>⚠ Government name does not match</b><br>Document name: ${esc(v.verifiedName||'Not detected')}<br><span class="tiny muted">Your profile name must be selected from the government document name.</span></div>`;
  return `<div class="notice warn"><b>No government identity document verified.</b><br>Upload a clear photo of the Aadhaar card. SAGE rectifies the image locally and reads the printed government name with OCR.</div>`;
}

function renderProfile(){
  const identity=profile.identityVerification;
  const nameStructure=identityIsVerified()?`<div class="card" style="padding:16px;margin-bottom:20px">
      <div class="section-head" style="margin-top:0"><div><h3>Choose your name structure</h3><p>All choices come only from the verified government document name. Certificates can match your first + last name or all three selected components.</p></div></div>
      <div class="form-grid">
        <div class="field"><label>FIRST NAME</label><select id="nameFirst"></select></div>
        <div class="field"><label>MIDDLE NAME</label><select id="nameMiddle"></select></div>
        <div class="field"><label>LAST NAME</label><select id="nameLast"></select></div>
      </div>
      <div id="profileNamePreview" class="notice" style="margin-top:12px"><b>Profile name:</b> ${esc(profile.name||'Select your name components')}</div>
    </div>`:'';
  $('#view').innerHTML=`<div class="view-wrap"><div class="card form-card">
    <div class="section-head" style="margin-top:0"><div><h3>Your profile</h3><p>This is the source of truth for matching and SAGE personalization.</p></div><span class="status">${profileCompletion()}% complete</span></div>
    <div class="section-head" style="margin-top:18px"><div><h3>Government identity</h3><p>Upload a clear photo of your Aadhaar card. SAGE rectifies the photo locally and reads the printed government name with OCR.</p></div><span class="status">${identityIsVerified()?'✓ Verified':'Not verified'}</span></div>
    ${identityDisplay()}
    <div class="card upload-card" style="margin:12px 0 20px">
      <div class="upload-box"><strong>Verify Aadhaar card</strong><small>Clear photo of the Aadhaar card · full card visible · maximum 5 MB</small><input id="aadhaarDocumentFile" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></div>
      <div id="identityProgress" class="verify-progress" hidden><div class="progress"><i id="identityBar" style="width:20%"></i></div><p id="identityText" class="tiny muted">Reading the document locally…</p></div>
      <div class="tiny muted" style="margin-top:10px">SAGE keeps the Aadhaar image local. A small DL model proposes the card corners, OpenCV provides a fallback, and local OCR extracts the printed name. This is a document/name consistency screen, not UIDAI cryptographic authentication.</div>
    </div>
    ${nameStructure}
    <form id="profileForm" class="form-grid">
      <div class="field"><label>NAME</label><input name="name" value="${esc(profile.name)}" readonly placeholder="Select your name components"></div>
      <div class="field"><label>EMAIL</label><input name="email" type="email" value="${esc(profile.email)}" placeholder="you@example.com"></div>
      <div class="field full"><label>EDUCATION</label><input name="education" value="${esc(profile.education)}" placeholder="e.g. B.Tech CSE — Cybersecurity"></div>
      <div class="field full"><label>TARGET ROLE</label><input name="goal" value="${esc(profile.goal)}" placeholder="e.g. Cybersecurity Analyst, AI/ML Engineer, Backend Developer"></div>
      <div class="field full"><label>INTERESTS <span class="muted">(comma separated)</span></label><input name="interests" value="${esc(profile.interests.join(', '))}" placeholder="Cybersecurity, Artificial Intelligence, Web Development"></div>
      <div class="field full"><label>PROJECTS <span class="muted">(one per line)</span></label><textarea name="projects" placeholder="Phishing URL detector using Python\nInternship matching platform">${esc(profile.projects.join('\n'))}</textarea></div>
      <div class="field full"><div class="notice">${identityIsVerified()?'Changing the verified identity name triggers identity re-verification and locks existing credential-backed certificates until they are revalidated.':'Verify your government identity document above to bind the profile name to the imported government record.'}</div></div>
      <div class="field full"><button class="primary" type="submit">Save profile</button></div>
    </form>
  </div></div>`;
  const offerWrap=document.createElement('div'); offerWrap.innerHTML=renderStudentOfferSection(); $('#view').appendChild(offerWrap.firstElementChild);

  const identityInput=$('#aadhaarDocumentFile');
  if(identityIsVerified()){
    const names=Array.isArray(identity.nameTokens)?identity.nameTokens:[];
    const fill=(id,selected,placeholder)=>{
      const el=$(id); if(!el)return;
      el.innerHTML=`<option value="">${placeholder}</option>`+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
      if(selected)el.value=selected;
    };
    fill('#nameFirst',profile.nameParts.first,'Choose first name');
    fill('#nameMiddle',profile.nameParts.middle,'No middle name');
    fill('#nameLast',profile.nameParts.last,'Choose last name');
    ['#nameFirst','#nameMiddle','#nameLast'].forEach(sel=>$(sel)?.addEventListener('change',()=>{
      profile.nameParts={first:$('#nameFirst')?.value||'',middle:$('#nameMiddle')?.value||'',last:$('#nameLast')?.value||''};
      profile.name=[profile.nameParts.first,profile.nameParts.middle,profile.nameParts.last].filter(Boolean).join(' ');
      const input=document.querySelector('#profileForm [name="name"]');if(input)input.value=profile.name;
      const preview=$('#profileNamePreview');if(preview)preview.innerHTML=`<b>Profile name:</b> ${esc(profile.name||'Select your name components')}`;
      save();
    }));
  }
  identityInput?.addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file)return;
    if(file.size>5*1024*1024){toast('The identity document is over the 5 MB limit');identityInput.value='';return;}
    const allowed=['image/png','image/jpeg','image/jpg','image/webp'];
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!allowed.includes(file.type.toLowerCase()) && !['png','jpg','jpeg','webp'].includes(ext)){toast('Upload a PNG, JPG or WEBP photo of the Aadhaar card');identityInput.value='';return;}
    const progress=$('#identityProgress'),bar=$('#identityBar'),txt=$('#identityText'); progress.hidden=false;bar.style.width='25%';txt.textContent='Reading the Aadhaar card locally…';
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      bar.style.width='65%';txt.textContent='Rectifying the card photo and reading the printed name locally…';
      const base64=dataUrl.split(',')[1];
      const d=await api('/api/verify-government-identity',{method:'POST',body:JSON.stringify({filename:file.name,mime:file.type||'application/octet-stream',base64})});
      bar.style.width='100%';
      if(!d.ok){progress.hidden=true;profile.identityVerification={...d.result,status:d.result?.status||'needs-review',error:d.error||d.result?.error};save();render();toast(d.error||'Identity document could not be verified');return;}
      profile.identityVerification={...d.result,verifiedAt:new Date().toISOString()};
      if(['verified','name-imported'].includes(String(d.result.status||'').toLowerCase())){
        profile.identityVerification.status='name-imported';
        profile.nameParts={first:'',middle:'',last:''}; profile.name='';
        save(); render(); toast('Aadhaar identity verified ✓ Choose the name structure');
      }else{
        save(); render(); toast(d.result.message||'Identity document needs review');
      }
    }catch(err){progress.hidden=true;toast(err.message||'Could not verify the identity document');}
  });

  $('#profileForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget); const nextName=fd.get('name').trim();
    const previousVerifiedName=profile.identityVerification?.verifiedName||'';
    const hasImportedIdentity=identityIsVerified() && !!previousVerifiedName;
    const nameChanged=hasImportedIdentity && !!nextName && normalizeLocalName(nextName)!==normalizeLocalName(previousVerifiedName);
    profile={...profile,name:nextName,email:fd.get('email').trim(),education:fd.get('education').trim(),goal:fd.get('goal').trim(),interests:fd.get('interests').split(',').map(x=>x.trim()).filter(Boolean),projects:fd.get('projects').split('\n').map(x=>x.trim()).filter(Boolean)};
    if(nameChanged){
      profile.identityVerification={status:'reverification-required',previousVerifiedName,reason:'Verified identity name changed'};
      profile.certificates=(Array.isArray(profile.certificates)?profile.certificates:[]).map(c=>({...c,credentialBacked:false,status:'needs-review',reverificationRequired:true,verificationNote:'Identity name changed. Re-verify government identity and revalidate this credential before treating it as credential-backed.'}));
      certificates=profile.certificates;
      profile.verifiedSkills=[]; profile.skills=[];
      toast('Name changed — identity and certificates require re-verification');
    }
    save();await refreshMatches();render(); if(!nameChanged) toast('Profile saved — matches updated');
  });
}
function normalizeLocalName(value=''){return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}

function renderSkills(){
  const catalog=['Python','JavaScript','React','Node.js','HTML','CSS','Java','C++','C#','SQL','Git','Linux','Docker','Pandas','NumPy','Machine Learning','Artificial Intelligence','Cybersecurity','Networking','REST APIs','Excel','Data Analysis','OOP'];
  const verified=new Set(verifiedProfileSkills());
  const detected=(profile.projectEvidence||[]).reduce((set,e)=>(e.skills||[]).forEach(x=>set.add(labelForSkill(x)))||set,new Set());
  const rows=catalog.map(skill=>{
    const v=verified.has(skill), evidence=detected.has(skill);
    return `<article class="skill-verification-card ${v?'is-verified':''}">
      <div class="skill-card-top"><div><h4>${esc(skill)}</h4><p>${v?'Credential-backed — proficiency is for the hiring company to judge':'Requires a credential-backed document'}</p></div><span class="skill-status ${v?'verified':'unverified'}">${v?'✓ Credential-backed':'○ Not credential-backed'}</span></div>
      ${evidence&&!v?`<div class="evidence-note">Project evidence detected for this skill. Upload a certificate to verify it.</div>`:''}
      <label class="skill-cert-upload"><span>${v?'Replace certificate':'Upload certificate'}</span><input type="file" data-skill-cert="${esc(skill)}" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"></label>
    </article>`;
  }).join('');
  const detectedProjects=(profile.projectEvidence||[]).map((e,i)=>`<div class="project-evidence-row"><div><b>${esc(e.filename||'Project file')}</b><div class="tiny muted">Detected: ${(e.skills||[]).map(esc).join(', ')||'No recognized skills'}</div></div><span class="status">Evidence only</span><button class="ghost" data-remove-evidence="${i}">Remove</button></div>`).join('');
  $('#view').innerHTML=`<div class="view-wrap">
    <section class="hero document-hero"><p class="eyebrow" style="color:#dcecff">SKILL VERIFICATION CENTER</p><h2>Authenticate the credential before it reaches a recruiter.</h2><p>SAGE does not decide whether a skill is basic, intermediate, or advanced. It checks whether the uploaded credential appears to belong to you, comes from a coherent issuer/course, and is actually a credential. The hiring company decides what that credential proves.</p></section>
    <div class="notice"><b>Credential filter:</b> SAGE checks identity, document type, issuer/course consistency, dates/IDs when available, and QR/verification evidence when detectable. It can flag suspicious documents, but it never claims a skill level. Hiring companies make the final credential decision.</div>
    <div class="section-head"><div><h3>Verify skills</h3><p>Upload the certificate directly under the skill it proves.</p></div><span class="status">${verified.size} verified</span></div>
    <div class="skill-verification-grid">${rows}</div>
    <div class="section-head"><div><h3>Project skill detection</h3><p>Upload a TXT, CSV, Markdown or JSON project export. Detected skills appear as evidence, not as verified credentials.</p></div></div>
    <div class="card upload-card"><div class="upload-box"><strong>Upload a project file</strong><small>.txt, .csv, .json or .md</small><input id="skillFile" type="file" accept=".txt,.csv,.json,.md,text/plain,application/json" /></div><p class="tiny muted">SAGE scans the content for recognizable skills and records the source file so you can later prove the skill with a certificate.</p></div>
    <div class="card"><div class="section-head" style="margin-top:0"><div><h3>Detected project evidence</h3><p>Useful evidence, but not a verification shortcut.</p></div></div>${detectedProjects||'<div class="empty"><b>No project evidence yet.</b> Upload a project file to detect skills automatically.</div>'}</div>
  </div>`;
  $('#skillFile')?.addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    const text=await file.text();
    try{
      const d=await api('/api/extract-skills',{method:'POST',body:JSON.stringify({text})});
      if(!d.skills.length){toast('No recognized skills found in that file');return;}
      profile.projectEvidence=Array.isArray(profile.projectEvidence)?profile.projectEvidence:[];
      profile.projectEvidence.unshift({filename:file.name,skills:d.skills,uploadedAt:new Date().toISOString()});
      profile.projects=Array.isArray(profile.projects)?profile.projects:[];
      if(!profile.projects.includes(file.name)) profile.projects.push(file.name);
      save();await refreshMatches();render();toast(`Detected ${d.skills.length} skill${d.skills.length===1?'':'s'} as project evidence`);
    }catch(err){toast(err.message||'Could not analyze project file');}
  });
  $$('[data-skill-cert]').forEach(input=>input.addEventListener('change',async e=>{
    const skill=e.target.dataset.skillCert,file=e.target.files[0];if(!file)return;
    if(file.size>5*1024*1024){toast('That certificate is over the 5 MB limit');e.target.value='';return;}
    const allowed=['application/pdf','image/png','image/jpeg','image/webp','image/jpg'];
    if(!allowed.includes(file.type)){toast('Use PDF, PNG, JPG or WEBP');e.target.value='';return;}
    toast(`Assessing ${skill} certificate…`);
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      const d=await api('/api/verify-certificate',{method:'POST',body:JSON.stringify({filename:file.name,mime:file.type,base64:dataUrl.split(',')[1],profileName:profile.name,profileNameParts:certificateNameParts(),claimedSkill:skill})});
      if(!d.ok)throw new Error(d.error||'Verification failed');
      const result={...d.result,uploadedAt:new Date().toISOString(),claimedSkill:skill};
      certificates=Array.isArray(certificates)?certificates:[];
      certificates.unshift(result);profile.certificates=certificates;
      if(result.status==='document-validated' && result.credentialBacked){
        profile.verifiedSkills=Array.isArray(profile.verifiedSkills)?profile.verifiedSkills:[];
        const verifiedLabel=labelForSkill(skill);
        if(verifiedLabel && !profile.verifiedSkills.includes(verifiedLabel))profile.verifiedSkills.push(verifiedLabel);
        toast(`${skill} is now credential-backed ✓`);
      }else if(result.status==='document-validated'){
        toast(`Credential passed the document check, but SAGE could not establish enough identity evidence for ${skill}.`);
      }else toast(`${skill} was not credential-backed — review the assessment`);
      save();await refreshMatches();render();
    }catch(err){toast(err.message||'Could not verify certificate');}
  }));
  $$('[data-remove-evidence]').forEach(b=>b.onclick=()=>{profile.projectEvidence.splice(Number(b.dataset.removeEvidence),1);save();render();});
  bindCommon();
}

function canonicalSkill(value=''){
  const s=String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  const aliases={
    'python3':'python','python 3':'python','js':'javascript','node':'node.js','nodejs':'node.js',
    'c plus plus':'c++','cpp':'c++','c sharp':'c#','csharp':'c#','rest api':'rest apis','restful api':'rest apis',
    'ai':'artificial intelligence','ml':'machine learning','data analytics':'data analysis'
  };
  return aliases[s]||s;
}
function labelSkill(s=''){
  const labels={'python':'Python','javascript':'JavaScript','react':'React','node.js':'Node.js','html':'HTML','css':'CSS','java':'Java','c++':'C++','c#':'C#','sql':'SQL','git':'Git','linux':'Linux','docker':'Docker','pandas':'Pandas','numpy':'NumPy','machine learning':'Machine Learning','artificial intelligence':'Artificial Intelligence','cybersecurity':'Cybersecurity','networking':'Networking','rest apis':'REST APIs','excel':'Excel','data analysis':'Data Analysis','oop':'OOP'};
  return labels[s] || String(s||'').replace(/\b\w/g,m=>m.toUpperCase());
}
function labelForSkill(s){return labelSkill(canonicalSkill(s));}
function verifiedProfileSkills(){
  const explicit=Array.isArray(profile.verifiedSkills)?profile.verifiedSkills:[];
  const certs=Array.isArray(profile.certificates)?profile.certificates:[];
  const out=new Set(explicit.map(labelForSkill));
  // Credential-backed means the document passed the authenticity filter for this profile.
  // It does NOT mean SAGE judged the student's proficiency level.
  certs.filter(c=>c&&c.credentialBacked===true&&c.claimedSkill).forEach(c=>out.add(labelForSkill(c.claimedSkill)));
  return [...out];
}

async function addSkills(raw){
  // Deliberately does NOT verify or add skills to the verified profile.
  // Kept for backward compatibility with older saved profiles.
  const detected=(Array.isArray(profile.projectEvidence)?profile.projectEvidence:[]);
  raw=(Array.isArray(raw)?raw:[]).map(labelForSkill).filter(Boolean);
  profile.projectEvidence=detected;
  toast('Skills can only become verified through certificate evidence.');
  save();await refreshMatches();
}

function verificationBadge(status){
  const labels={verified:'Verified', 'document-validated':'Document Validated','needs-review':'Needs Review',rejected:'Rejected'};
  return `<span class="verify-badge ${status}">${labels[status]||'Pending'}</span>`;
}
function renderDocuments(){
  const docs=certificates||[];
  const rows=docs.map((d,i)=>`<article class="card document-card">
    <div class="document-top"><div class="doc-icon">✓</div><div><h4>${esc(d.filename||'Certificate')}</h4><div class="tiny muted">${esc(d.title||d.documentType||'Certificate document')}</div></div>${verificationBadge(d.status)}</div>
    <div class="doc-grid">
      <div><span>RECIPIENT</span><b>${esc(d.name||'Not detected')} ${d.nameMatch===true?'✓':''}</b></div>
      <div><span>ISSUER</span><b>${esc(d.issuer||'Not detected')}</b></div>
      <div><span>COURSE / TITLE</span><b>${esc(d.title||'Not detected')}</b></div>
      <div><span>DATE</span><b>${esc(d.date||'Not detected')}</b></div>
      <div><span>CREDENTIAL ID</span><b>${esc(d.certificateId||'Not detected')}</b></div>
      <div><span>ISSUER ASSESSMENT</span><b>${esc(d.issuerAssessment||'Not independently confirmed')}</b></div>
    </div>
    ${d.claimedSkill?`<div class="notice"><b>Claimed skill:</b> ${esc(d.claimedSkill)} · <b>Credential-backed:</b> ${d.credentialBacked?'Yes':'No'}</div>`:''}
    ${d.qrCode?.detected?`<div class="notice"><b>QR code:</b> detected${d.qrCode.decodedValue?` · destination: ${esc(d.qrCode.destination||d.qrCode.decodedValue)}`:' · could not be decoded reliably'}${d.qrCode.useful?' · useful verification evidence':' · not treated as verification evidence'}</div>`:''}
    ${d.skillsMentioned?.length?`<div><div class="tiny muted" style="margin-bottom:6px">SKILLS MENTIONED BY THE DOCUMENT</div><div class="tags">${d.skillsMentioned.map(s=>`<span class="tag matched">${esc(s)}</span>`).join('')}</div></div>`:''}
    ${d.issuerEvidence?.length?`<div class="tiny muted" style="margin-top:10px"><b>Issuer evidence:</b> ${d.issuerEvidence.map(esc).join(' · ')}</div>`:''}
    ${d.issues?.length?`<div class="notice warn"><b>Review notes</b><ul>${d.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${d.debug?.checks?.length?`<details class="card" style="margin-top:12px;padding:14px" open><summary style="cursor:pointer;font-weight:800;color:#14233b">🔎 Verification debug — why did SAGE reach this result?</summary><div style="margin-top:12px;display:grid;gap:8px">${d.debug.checks.map(c=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border:1px solid #e0e8f2;border-radius:10px;background:#fbfdff"><span style="font-weight:900;min-width:22px">${c.passed?'✓':c.warning?'⚠':'✕'}</span><div><b>${esc(c.label)}</b><div class="tiny muted">${esc(c.detail||'')}</div></div></div>`).join('')}</div>${d.debug.hardGateReasons?.length?`<div class="notice warn" style="margin-top:10px"><b>Hard-gate reasons</b><ul>${d.debug.hardGateReasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:`<div class="notice" style="margin-top:10px"><b>No hard-gate failure detected.</b> The final result was ${esc(d.debug.finalStatus||d.status)} with issuer assessment ${esc(d.issuerAssessment||'unknown')}.</div>`}<div class="tiny muted" style="margin-top:8px">Engine: ${esc(d.debug.engine||d.source||'unknown')} · Model: ${esc(d.debug.model||'unknown')} · This diagnostic view does not expose the sanitized OCR or private document contents.</div></details>`:''}
    <div class="notice"><b>What this result means:</b> ${esc(d.verificationNote||'Automated credential assessment.')} </div>
    <div class="card-actions">
      <span class="tiny muted">To verify a specific skill, upload this certificate under that skill in Skill Verification Center.</span>
      <button class="ghost" data-remove-cert="${i}">Remove</button>
    </div>
  </article>`).join('');
  $('#view').innerHTML=`<div class="view-wrap">
    <section class="hero document-hero"><p class="eyebrow" style="color:#dcecff">DOCUMENT INTELLIGENCE</p><h2>Verify certificates before they reach a recruiter.</h2><p>Upload a certificate and Iruka screens whether it appears coherent, matches your selected profile name, and comes from a plausible issuer. It does not claim cryptographic issuer verification or assign skill level.</p></section>
    <div class="section-head"><div><h3>Certificate verification</h3><p>Automatic assessment with clear evidence — without pretending we contacted the issuer.</p></div></div>
    <div class="card upload-card">
      <div class="upload-box"><strong>Upload a certificate</strong><small>PDF, PNG, JPG or WEBP · maximum 5 MB</small>
        <input id="certificateFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp">
      </div>
      <div id="verifyProgress" class="verify-progress" hidden><div class="progress"><i id="verifyBar" style="width:10%"></i></div><p id="verifyText" class="tiny muted">Reading document…</p></div>
      <div class="notice" style="margin-top:12px"><b>Screening levels:</b> Credential-backed = the AI screening passed the hard checks. Needs Review = something is incomplete or uncertain. Rejected = clearly invalid/non-credential or suspicious. Open the verification debug panel after each upload to see exactly which checks passed, failed, or were optional.</div>
    </div>
    <div class="section-head"><div><h3>Your documents</h3><p>${docs.length?`${docs.length} certificate${docs.length===1?'':'s'} assessed on this device.`:'No certificates uploaded yet.'}</p></div></div>
    <div class="grid grid-2">${rows||'<div class="card empty"><b>No documents yet.</b> Upload your first certificate above and the verification result will appear here.</div>'}</div>
  </div>`;
  const input=$('#certificateFile');
  input?.addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file)return;
    if(file.size>5*1024*1024){toast('That file is over the 5 MB limit');input.value='';return;}
    const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
    if(!allowed.includes(file.type)){toast('Use PDF, PNG, JPG or WEBP');input.value='';return;}
    const progress=$('#verifyProgress'), bar=$('#verifyBar'), txt=$('#verifyText');
    progress.hidden=false; bar.style.width='20%'; txt.textContent='Reading document and checking its structure…';
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      bar.style.width='55%';txt.textContent='Extracting certificate details and checking consistency…';
      const base64=dataUrl.split(',')[1];
      const d=await api('/api/verify-certificate',{method:'POST',body:JSON.stringify({filename:file.name,mime:file.type,base64,profileName:profile.name,profileNameParts:certificateNameParts(),claimedSkill:skill})});
      if(!d.ok)throw new Error(d.error||'Verification failed');
      bar.style.width='100%';txt.textContent='Assessment complete.';
      const result={...d.result,uploadedAt:new Date().toISOString()};
      const duplicate=certificates.some(x=>x.sha256&&result.sha256&&x.sha256===result.sha256);
      if(duplicate){toast('This certificate is already in your documents');return;}
      certificates.unshift(result);profile.certificates=certificates;save();render();toast(result.credentialBacked?'Credential screened ✓':'Certificate assessed — review the result');
    }catch(err){toast(err.message||'Could not verify this document');progress.hidden=true;}
  });
  $$('[data-remove-cert]').forEach(b=>b.onclick=()=>{certificates.splice(Number(b.dataset.removeCert),1);profile.certificates=certificates;save();render();toast('Document removed')});
  bindCommon();
}

function openCvPreview(data={},title='CV Preview'){
  let modal=$('#cvModal');
  if(!modal){modal=document.createElement('div');modal.id='cvModal';modal.className='cv-modal';document.body.appendChild(modal);}
  const skills=Array.isArray(data.skills)?data.skills:[];
  const interests=Array.isArray(data.interests)?data.interests:[];
  const projects=Array.isArray(data.projects)?data.projects:[];
  modal.innerHTML=`<div class="cv-backdrop" data-close-cv></div><div class="cv-sheet"><div class="cv-head"><div><span class="eyebrow">IRUKA SAGE • CV VIEWER</span><h2>${esc(title)}</h2></div><button class="ghost" type="button" data-close-cv>×</button></div><div class="cv-paper"><div class="cv-name">${esc(data.name||'Student')}</div><div class="cv-contact">${esc(data.email||'')} ${data.education?'• '+esc(data.education):''}</div>${data.goal?`<section><h4>Career Objective</h4><p>${esc(data.goal)}</p></section>`:''}<section><h4>Skills</h4><div class="tag-row">${skills.length?skills.map(x=>`<span class="tag matched">${esc(x)}</span>`).join(''):'<span class="muted">No skills added yet</span>'}</div></section><section><h4>Projects</h4>${projects.length?projects.map(x=>`<p>• ${esc(x)}</p>`).join(''):'<p class="muted">No projects added yet</p>'}</section><section><h4>Interests</h4><p>${interests.length?esc(interests.join(' • ')):'Not specified'}</p></section><div class="cv-foot">CV generated from the student's Iruka SAGE profile. Recruiters see only information shared for the application.</div></div></div>`;
  modal.classList.add('open');
  $$('[data-close-cv]').forEach(x=>x.onclick=()=>modal.classList.remove('open'));
}

function renderApplications(){
  const rows=applications.map(a=>{const i=internships.find(x=>x.id===a.id);if(!i)return '';return `<div class="app-row application-row"><div><b>${esc(i.title)}</b><div class="tiny muted">${esc(i.organization)}</div><div class="tiny muted">Applied ${esc(a.date||'')}</div></div><span class="status">Applied</span><button class="secondary" data-my-cv="${esc(i.id)}">View my CV</button><button class="ghost" data-remove-app="${esc(i.id)}">Remove</button></div>`}).join('');
  $('#view').innerHTML=`<div class="view-wrap"><div class="notice"><b>YOUR APPLICATIONS</b><br>Open the exact CV/profile snapshot you are using for an application.</div><div class="card"><div class="section-head" style="margin-top:0"><div><h3>Application tracker</h3><p>See your submitted internships and review your CV before an employer does.</p></div></div>${rows||'<div class="empty"><b>No applications yet.</b>Open Internships and apply to a role to see it here.<div class="spacer"></div><button class="primary" data-go="internships">Browse internships</button></div>'}</div></div>`;
  $$('[data-my-cv]').forEach(b=>{const i=internships.find(x=>x.id===b.dataset.myCv);const a=applications.find(x=>x.id===b.dataset.myCv);if(i)b.onclick=()=>openCvPreview({...profile,submittedFor:i.title,submittedAt:a?.date||'Today'},'My CV — '+i.title);});
  $$('[data-remove-app]').forEach(b=>b.onclick=()=>{applications=applications.filter(a=>a.id!==b.dataset.removeApp);save();render();toast('Application removed')});bindCommon();
}


function renderSagePage(){
  $('#view').innerHTML=`<div class="view-wrap"><div class="sage-page">
    <div class="card sage-main"><div class="sage-page-head"><div class="sage-orb">✦</div><div><b>SAGE</b><div class="tiny muted">Career intelligence inside Iruka Sage</div></div></div><div class="sage-page-chat" id="sagePageChat">${history.map(bubbleHtml).join('')}</div><form class="sage-page-input" id="sagePageForm"><input id="sagePageInput" placeholder="Ask SAGE anything about your career path…"><button class="primary">Send</button></form></div>
    <aside class="card sage-side"><h4>Try asking</h4><div class="prompt-card" data-page-prompt="Review my profile">Review my profile</div><div class="prompt-card" data-page-prompt="What skills am I missing for cybersecurity?">Find my cybersecurity gaps</div><div class="prompt-card" data-page-prompt="Which internship should I choose?">Rank my internships</div><div class="prompt-card" data-page-prompt="Give me project ideas for my target role">Project ideas</div><div class="prompt-card" data-page-prompt="How can I improve my CV?">Improve my CV</div><div class="prompt-card" data-page-prompt="Explain how match scores work">Explain match scores</div><div class="notice" style="margin-top:16px">SAGE sees the same profile and deterministic matching data as the rest of the platform.</div></aside>
  </div></div>`;
  $('#sagePageForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#sagePageInput');const q=input.value.trim();if(!q)return;input.value='';await sendSage(q,true)});
  $$('[data-page-prompt]').forEach(x=>x.onclick=()=>sendSage(x.dataset.pagePrompt,true));scrollSagePage();
}

function formatSageText(text){
  if(!text)return '';
  let s=String(text).replace(/\r\n/g,'\n').trim();
  // Convert common Markdown-style formatting into clean SAGE UI.
  s=s.replace(/^\s{0,3}#{1,6}\s*/gm,'');
  s=s.replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1');
  s=s.replace(/^\s*[-*+]\s+/gm,'• ');
  s=s.replace(/^\s*\d+\.\s+/gm,(m)=>m);
  // Link bare http(s) URLs while escaping all other text.
  const parts=s.split(/(https?:\/\/[^\s<>"']+)/g);
  return parts.map((part,i)=>{
    if(i%2===1){
      const clean=part.replace(/[),.;!?]+$/,'');
      const trailing=part.slice(clean.length);
      return `<a class="sage-link" href="${esc(clean)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>${esc(trailing)}`;
    }
    return esc(part).replace(/\n/g,'<br>');
  }).join('');
}
function bubbleHtml(m){
  const typing=m.typing ? '<span class="typing-dots"><i></i><i></i><i></i></span>' : formatSageText(m.text||'');
  return `<div class="bubble ${m.from==='you'?'you':'sage'} ${m.typing?'is-typing':''}">${typing}</div>`;
}
function syncChat(){
  const m=$('#chatMessages');
  m.innerHTML=history.map(bubbleHtml).join('');
  m.scrollTop=m.scrollHeight;
  if(currentView==='sage'&&$('#sagePageChat')){$('#sagePageChat').innerHTML=history.map(bubbleHtml).join('');scrollSagePage();}
}
function scrollSagePage(){const e=$('#sagePageChat');if(e)e.scrollTop=e.scrollHeight}
function typeInto(el,text,done){
  if(!el){done&&done();return;}
  el.classList.add('is-typing');
  el.textContent='';
  let i=0;
  const step=()=>{
    if(i>=text.length){el.classList.remove('is-typing');el.innerHTML=formatSageText(text);done&&done();return;}
    const chunk=text.slice(i,i+Math.max(1, text.length>500?3:2));
    el.textContent+=chunk;i+=chunk.length;
    const box=el.parentElement; if(box) box.scrollIntoView({block:'nearest',behavior:'smooth'});
    setTimeout(step, text[i-1]==='.'||text[i-1]==='\n'?22:11);
  };
  step();
}
async function sendSage(q,fromPage=false){
  history.push({from:'you',text:q});
  const typing={from:'sage',typing:true,text:''};
  history.push(typing); save(); syncChat();
  try{
    const d=await api('/api/sage/chat',{method:'POST',body:JSON.stringify({message:q,profile,history:history.slice(-12)})});
    history.pop(); history.push({from:'sage',text:d.reply}); save(); syncChat();
    // Replace the freshly-rendered assistant bubble with a smooth typewriter.
    const containers=[];
    if($('#chatMessages')) containers.push($('#chatMessages'));
    if(currentView==='sage'&&$('#sagePageChat')) containers.push($('#sagePageChat'));
    containers.forEach(c=>{const el=c.querySelector('.bubble.sage:last-child'); if(el){el.textContent=''; typeInto(el,d.reply);}});
  }catch{
    history.pop();history.push({from:'sage',text:'I hit a local service error. Your profile is safe — try that again in a moment.'});save();syncChat();
  }
  if(!fromPage)$('#chatPanel').classList.add('open');
}

function bindCommon(){
  $$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
  $$('[data-ask]').forEach(b=>b.onclick=()=>{openChat();sendSage(b.dataset.ask)});
  $$('[data-gap]').forEach(b=>b.onclick=async()=>{
    const internship=internships.find(x=>x.id===b.dataset.gap);
    const match=internship ? matches[internship.id] : null;
    if(!internship||!match||!match.gaps.length){toast('No skill gap found for this internship');return;}
    const primaryGap=match.gaps[0];
    const prompt=`I want to close the skill gap for ${internship.title} at ${internship.organization}. My verified/profile skills are ${profile.skills.join(', ')||'none'}. My missing skills are ${match.gaps.join(', ')}. Start with ${primaryGap}. Act as my Skill Gap Coach. Give me: 1) why ${primaryGap} matters for THIS internship, 2) the 3-5 concepts I should learn first, 3) a tiny hands-on task I can do today, 4) a portfolio project that proves the skill, 5) exactly what evidence I should upload/show to make this skill credible, and 6) two high-quality learning resources with direct URLs. Keep it practical and beginner-friendly. Do not pretend I already know the skill. Finish with a 7-day mini-plan.`;
    b.disabled=true; const old=b.innerHTML; b.innerHTML='⏳ SAGE is building your plan…';
    openChat();
    await sendSage(prompt);
    b.disabled=false; b.innerHTML=old;
  });
  $$('[data-view-offers]').forEach(b=>b.onclick=()=>setView('offers'));
  $$('[data-apply]').forEach(b=>{const id=b.dataset.apply;if(!applied(id))applications.push({id,date:new Date().toLocaleDateString(),cvSnapshot:{name:profile.name,email:profile.email,education:profile.education,goal:profile.goal,skills:[...(profile.skills||[])],interests:[...(profile.interests||[])],projects:[...(profile.projects||[])]}});save();toast(applied(id)?'Application saved':'Saved');render()});
}
function openChat(){syncChat();$('#chatPanel').classList.add('open');$('#chatPanel').setAttribute('aria-hidden','false');setTimeout(()=>$('#chatInput').focus(),50)}

$$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#quickProfile').onclick=()=>setView('profile');
$('#sageFab').onclick=()=>$('#chatPanel').classList.contains('open')?$('#chatPanel').classList.remove('open'):openChat();
$('#closeChat').onclick=()=>$('#chatPanel').classList.remove('open');
if($('#clearChat')) $('#clearChat').onclick=()=>{history=[{from:'sage',text:'Fresh start. What do you want to work on?'}];save();syncChat();toast('SAGE conversation cleared')};
$('#chatForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#chatInput');const q=input.value.trim();if(!q)return;input.value='';await sendSage(q)});
const prompts=['Review my profile','What skills am I missing?','Which internship fits me?','Improve my CV'];
$('#chatSuggestions').innerHTML=prompts.map(p=>`<button class="chip">${esc(p)}</button>`).join('');$$('#chatSuggestions .chip').forEach((b,i)=>b.onclick=()=>sendSage(prompts[i]));

// Step 1 login bindings.
$$('.role-card').forEach(b=>b.addEventListener('click',()=>{selectedRole=b.dataset.role;$$('.role-card').forEach(x=>x.classList.toggle('selected',x===b));}));
$('#loginForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const email=String($('#loginEmail')?.value||'').trim().toLowerCase();
  if(!email) return;
  auth={email,role:selectedRole};
  localStorage.setItem(AUTH_KEY,JSON.stringify(auth));
  if(selectedRole==='student'){ profile.email=email; save(); }
  enterPortal();
  toast(selectedRole==='company'?'Hiring company portal opened':'Student portal opened');
});
$('#logoutBtn')?.addEventListener('click',()=>{ auth=null; localStorage.removeItem(AUTH_KEY); selectedRole='student'; showLogin(); });

(async function init(){
  try{
    const h=await api('/api/health');
    const status=$('#aiStatusText'), sub=$('#aiStatusSub');
    if(status){status.textContent=h.mode==='openai'?'AI online':'Local fallback online';}
    if(sub){sub.textContent=h.mode==='openai'?`Powered by ${h.model||'OpenAI'}`:'Add an API key for natural AI conversations';}
    const d=await api('/api/internships');internships=d.internships;
    if(auth){ if(auth.role==='student'){ try{ await refreshMatches(); }catch(e){} } enterPortal(); syncChat(); } else { showLogin(); }
  }
  catch(e){$('#view').innerHTML='<div class="view-wrap"><div class="card empty"><b>Iruka Sage could not connect to its local server.</b>Run START.bat again and keep the terminal window open.</div></div>'}
})();
