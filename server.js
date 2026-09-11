const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

const PORT = process.env.PORT || 5173;
const PUBLIC = path.join(__dirname, 'public');

// Lightweight .env loader so the demo stays dependency-free.
function loadEnvFile(){
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed=line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx=trimmed.indexOf('=');
      if (idx<0) continue;
      const key=trimmed.slice(0,idx).trim();
      let value=trimmed.slice(idx+1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value=value.slice(1,-1);
      if (!process.env[key]) process.env[key]=value;
    }
  } catch(e) { console.warn('Could not read .env:', e.message); }
}
loadEnvFile();
// AIRouter is the primary SAGE counselor provider. It exposes an OpenAI-compatible Chat Completions API.
const AIROUTER_API_KEY = process.env.AIROUTER_API_KEY || '';
const AIROUTER_BASE_URL = process.env.AIROUTER_BASE_URL || 'https://api.airouter.in/v1';
const AIROUTER_MODEL = process.env.AIROUTER_MODEL || 'google/gemini-3.7-flash';


function normalizeIdentityName(value='') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}

function certificateNameMatch(documentName='', profileNameParts={}) {
  const docTokens=new Set(normalizeIdentityName(documentName).split(' ').filter(Boolean));
  const first=normalizeIdentityName(profileNameParts.first||'');
  const middle=normalizeIdentityName(profileNameParts.middle||'');
  const last=normalizeIdentityName(profileNameParts.last||'');
  const requiredAll=[first,middle,last].filter(Boolean);
  const firstLast=[first,last].filter(Boolean);
  if(firstLast.length<2) return false;
  return firstLast.every(t=>docTokens.has(t)) || (requiredAll.length===3 && requiredAll.every(t=>docTokens.has(t)));
}

const internships = [
  {
    id: 'cyber-01', title: 'Cybersecurity Analyst Intern', organization: 'Nexora Security Labs', location: 'Hybrid', mode: 'Hybrid', duration: '3 months', stipend: '₹12,000/mo',
    skills: ['Python', 'Linux', 'Networking', 'Cybersecurity', 'Git'], interests: ['Cybersecurity', 'Security'], education: ['CSE', 'IT', 'Cybersecurity'],
    description: 'Work with a security team on vulnerability analysis, log review, automation, and security reporting.', verified: true, demo: true
  },
  {
    id: 'web-01', title: 'Full-Stack Developer Intern', organization: 'BlueOrbit Technologies', location: 'Remote', mode: 'Remote', duration: '4 months', stipend: '₹15,000/mo',
    skills: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS', 'Git'], interests: ['Web Development', 'Software Engineering'], education: ['CSE', 'IT'],
    description: 'Build responsive product features, APIs, dashboards, and reusable frontend components.', verified: true, demo: true
  },
  {
    id: 'ai-01', title: 'AI / ML Intern', organization: 'VectorMind Research', location: 'Bengaluru', mode: 'On-site', duration: '6 months', stipend: '₹20,000/mo',
    skills: ['Python', 'Machine Learning', 'Pandas', 'NumPy', 'Git'], interests: ['Artificial Intelligence', 'Machine Learning', 'Data Science'], education: ['CSE', 'AI', 'Data Science'],
    description: 'Prototype ML pipelines, evaluate models, clean datasets, and collaborate on applied AI experiments.', verified: true, demo: true
  },
  {
    id: 'backend-01', title: 'Backend Engineering Intern', organization: 'CloudForge Systems', location: 'Remote', mode: 'Remote', duration: '3 months', stipend: '₹18,000/mo',
    skills: ['Python', 'REST APIs', 'SQL', 'Git', 'Docker'], interests: ['Backend Development', 'Cloud'], education: ['CSE', 'IT'],
    description: 'Build REST APIs, data services, authentication flows, and production-ready backend utilities.', verified: true, demo: true
  },
  {
    id: 'data-01', title: 'Data Science Intern', organization: 'QuantLeaf Analytics', location: 'Pune', mode: 'Hybrid', duration: '4 months', stipend: '₹16,000/mo',
    skills: ['Python', 'Pandas', 'SQL', 'Data Analysis', 'Excel'], interests: ['Data Science', 'Analytics'], education: ['CSE', 'Data Science', 'Statistics'],
    description: 'Explore datasets, build dashboards, prepare reports, and support predictive analytics projects.', verified: true, demo: true
  },
  {
    id: 'java-01', title: 'Java Software Intern', organization: 'StackRiver Solutions', location: 'Ahmedabad', mode: 'On-site', duration: '3 months', stipend: '₹10,000/mo',
    skills: ['Java', 'OOP', 'SQL', 'Git'], interests: ['Software Engineering', 'Backend Development'], education: ['CSE', 'IT'],
    description: 'Develop Java modules, fix bugs, write tests, and work with relational databases.', verified: true, demo: true
  }
];

const aliases = new Map(Object.entries({
  'py':'python','python3':'python','python 3':'python',
  'js':'javascript','javascript es6':'javascript','ecmascript':'javascript',
  'reactjs':'react','react.js':'react','react js':'react',
  'node':'nodejs','node.js':'nodejs','node js':'nodejs',
  'html5':'html','css3':'css','c plus plus':'c++','cpp':'c++',
  'c sharp':'c#','csharp':'c#','postgres':'postgresql','postgres sql':'postgresql',
  'rest':'rest apis','rest api':'rest apis','restful api':'rest apis','restful apis':'rest apis',
  'ml':'machine learning','ai':'artificial intelligence','data analytics':'data analysis',
  'cyber security':'cybersecurity','network security':'cybersecurity',
  'github':'git'
}));

function canonicalSkill(value='') {
  let s = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  s = s.replace(/[®™]/g, '');
  return aliases.get(s) || s;
}
function canonicalSet(items=[]) { return new Set((Array.isArray(items)?items:[]).map(canonicalSkill).filter(Boolean)); }
function labelSkill(s='') {
  const known = {'python':'Python','javascript':'JavaScript','nodejs':'Node.js','react':'React','html':'HTML','css':'CSS','git':'Git','sql':'SQL','docker':'Docker','linux':'Linux','c++':'C++','c#':'C#','rest apis':'REST APIs','oop':'OOP','machine learning':'Machine Learning','artificial intelligence':'Artificial Intelligence','pandas':'Pandas','numpy':'NumPy','excel':'Excel','data analysis':'Data Analysis','cybersecurity':'Cybersecurity','networking':'Networking','java':'Java'};
  return known[s] || s.replace(/\b\w/g, c => c.toUpperCase());
}

function scoreMatch(profile={}, internship) {
  const skills = canonicalSet(profile.skills || []);
  const required = (internship.skills || []).map(canonicalSkill);
  if (skills.size === 0) return { score: null, status: 'profile_required', matched: [], gaps: required.map(labelSkill), explanation: 'Add at least one skill to unlock a meaningful match score.' };

  const matchedCanonical = required.filter(s => skills.has(s));
  const gapsCanonical = required.filter(s => !skills.has(s));
  const skillScore = required.length ? matchedCanonical.length / required.length : 1;

  const profileInterests = new Set((profile.interests || []).map(x => String(x).toLowerCase().trim()));
  const targetInterests = (internship.interests || []).map(x => String(x).toLowerCase().trim());
  const interestHits = targetInterests.filter(x => profileInterests.has(x)).length;
  const interestScore = targetInterests.length ? interestHits / targetInterests.length : 0.5;

  const edu = String(profile.education || '').toLowerCase();
  const eduHit = internship.education.some(x => edu.includes(x.toLowerCase()));
  const educationScore = edu.trim() ? (eduHit ? 1 : 0.35) : 0.35;

  const projectText = (profile.projects || []).join(' ').toLowerCase();
  const projectHits = required.filter(s => projectText.includes(s)).length;
  const projectScore = profile.projects?.length ? Math.min(1, projectHits / Math.max(1, required.length * 0.5)) : 0.3;

  const raw = skillScore * 72 + interestScore * 12 + educationScore * 10 + projectScore * 6;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, status: 'scored', matched: matchedCanonical.map(labelSkill), gaps: gapsCanonical.map(labelSkill), explanation: `${matchedCanonical.length}/${required.length} required skills matched. Skills carry most of the score; interests, education, and projects add context.` };
}

function profileSummary(profile={}) {
  const skills = (profile.skills || []).map(s => labelSkill(canonicalSkill(s)));
  const interests = profile.interests || [];
  return {
    name: profile.name || 'there', education: profile.education || 'not added yet',
    skills, verifiedSkills: verifiedSkillList(profile), interests, projects: profile.projects || [], goal: profile.goal || ''
  };
}

function findRoleTarget(msg='') {
  const m = msg.toLowerCase();
  if (/cyber|security|soc|pentest/.test(m)) return 'Cybersecurity';
  if (/ai|machine learning|ml\b/.test(m)) return 'AI / ML';
  if (/data science|analytics|data analyst/.test(m)) return 'Data Science';
  if (/backend|api|server/.test(m)) return 'Backend Development';
  if (/frontend|react|web dev|full.?stack/.test(m)) return 'Web Development';
  if (/java/.test(m)) return 'Java Development';
  return null;
}

const roadmaps = {
  'Cybersecurity': ['Networking fundamentals', 'Linux command line', 'Python scripting', 'Web security basics', 'Hands-on labs / CTFs', 'Git + write-ups'],
  'AI / ML': ['Strong Python', 'NumPy + Pandas', 'Statistics basics', 'scikit-learn', 'Model evaluation', '2 end-to-end ML projects'],
  'Data Science': ['Python', 'Pandas + NumPy', 'SQL', 'Statistics', 'Data visualization', 'Portfolio analysis project'],
  'Backend Development': ['Python or Node.js', 'REST APIs', 'SQL', 'Authentication', 'Git', 'Docker + deployment basics'],
  'Web Development': ['HTML + CSS', 'JavaScript', 'React', 'APIs', 'Git', 'One polished full-stack project'],
  'Java Development': ['Java fundamentals', 'OOP', 'Collections', 'SQL', 'Spring Boot basics', 'REST API project']
};

function cleanWords(text='') {
  return String(text).toLowerCase().replace(/[^a-z0-9+#.\- ]/g,' ').split(/\s+/).filter(Boolean);
}

function inferTargetFromContext(message='', profile={}, history=[]) {
  const direct = findRoleTarget(message) || findRoleTarget(profile.goal || '');
  if (direct) return direct;
  const recent = (Array.isArray(history) ? history.slice(-6) : []).map(x => x && x.text || '').join(' ');
  return findRoleTarget(recent);
}

function bestMatches(profile={}, limit=3) {
  return internships
    .map(i => ({i, match: scoreMatch(profile, i)}))
    .filter(x => x.match.score !== null)
    .sort((a,b) => b.match.score - a.match.score)
    .slice(0, limit);
}

function findInternship(message='') {
  const q=String(message).toLowerCase();
  return internships.find(i => q.includes(i.title.toLowerCase()) || q.includes(i.organization.toLowerCase())) ||
    internships.find(i => i.title.toLowerCase().split(/\s+/).some(w => w.length>4 && q.includes(w)));
}

function conversationalOpening(name='there') {
  const first = name && name !== 'there' ? name.split(/\s+/)[0] : '';
  const options = first ? [
    `Hey ${first} 👋 What are we solving today?`,
    `Hey ${first}. SAGE is ready — tell me what you’re trying to figure out.`,
    `Good to see you, ${first}. Want to work on matches, skills, projects, CV, or interviews?`
  ] : [
    `Hey 👋 I’m SAGE. What are you trying to figure out?`,
    `Hey — SAGE here. Give me the career problem and I’ll work through it with you.`,
    `Hi. I can use your profile, matches, skills and goals to give you a practical answer. What’s up?`
  ];
  return options[Math.floor(Date.now()/60000) % options.length];
}


function detectSageIntent(message='', profile={}, history=[]) {
  const m=String(message).toLowerCase().trim();
  if(/\b(teach|learn|lesson|explain|help me understand|how does .* work|study)\b/.test(m)) return 'LEARNING';
  if(/\b(interview|interviewer|mock interview|hr round|technical round)\b/.test(m)) return 'INTERVIEW';
  if(/\b(resume|cv|curriculum vitae|profile)\b/.test(m)) return 'PROFILE';
  if(/\b(project|portfolio|build|what should i make|project idea)\b/.test(m)) return 'PROJECTS';
  if(/\b(skill gap|missing skill|skills? (am|are) i missing|what skills.*missing|what.*skills.*need|skills.*need to learn)\b/.test(m)) return 'SKILL_ANALYSIS';
  if(/\b(internship|intern|apply|application|match|matching|eligib|which role|which opportunity)\b/.test(m)) return 'INTERNSHIP';
  if(/\b(career|career path|what should i do|what next|next step|roadmap|job|future|profession)\b/.test(m)) return 'CAREER';
  return 'GENERAL';
}

function verifiedSkillList(profile={}) {
  const verified=new Set((Array.isArray(profile.verifiedSkills)?profile.verifiedSkills:[]).map(s=>labelSkill(canonicalSkill(s))));
  const certs=Array.isArray(profile.certificates)?profile.certificates:[];
  certs.filter(c=>c && c.status==='document-validated' && c.claimedSkill && Array.isArray(c.skills) && c.skills.map(s=>canonicalSkill(s)).includes(canonicalSkill(c.claimedSkill)))
    .forEach(c=>verified.add(labelSkill(canonicalSkill(c.claimedSkill))));
  return [...verified];
}


const skillResources = {
  Python:[
    {name:'Python Official Tutorial',url:'https://docs.python.org/3/tutorial/'},
    {name:'Practice Python',url:'https://www.practicepython.org/'}
  ],
  JavaScript:[
    {name:'MDN JavaScript Guide',url:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'},
    {name:'JavaScript.info',url:'https://javascript.info/'}
  ],
  Linux:[
    {name:'Linux Command Line for Beginners',url:'https://ubuntu.com/tutorials/command-line-for-beginners'},
    {name:'Linux Journey',url:'https://linuxjourney.com/'}
  ],
  Networking:[
    {name:'Cloudflare Learning Center',url:'https://www.cloudflare.com/learning/network-layer/what-is-a-computer-network/'},
    {name:'Cisco Networking Basics',url:'https://www.cisco.com/c/en/us/solutions/small-business/resource-center/networking/networking-basics.html'}
  ],
  Cybersecurity:[
    {name:'OWASP Top 10',url:'https://owasp.org/www-project-top-ten/'},
    {name:'PortSwigger Web Security Academy',url:'https://portswigger.net/web-security'}
  ],
  Git:[
    {name:'Git Documentation',url:'https://git-scm.com/doc'},
    {name:'GitHub Skills',url:'https://skills.github.com/'}
  ],
  React:[
    {name:'React Learn',url:'https://react.dev/learn'},
    {name:'React Tutorial',url:'https://react.dev/learn/tutorial-tic-tac-toe'}
  ],
  'Node.js':[
    {name:'Node.js Learn',url:'https://nodejs.org/en/learn'},
    {name:'Node.js API Docs',url:'https://nodejs.org/docs/latest/api/'}
  ],
  SQL:[
    {name:'SQLBolt',url:'https://sqlbolt.com/'},
    {name:'PostgreSQL Tutorial',url:'https://www.postgresql.org/docs/current/tutorial.html'}
  ],
  Docker:[
    {name:'Docker Get Started',url:'https://docs.docker.com/get-started/'},
    {name:'Dockerfile Reference',url:'https://docs.docker.com/reference/dockerfile/'}
  ],
  Pandas:[
    {name:'Pandas Getting Started',url:'https://pandas.pydata.org/docs/getting_started/index.html'},
    {name:'Pandas User Guide',url:'https://pandas.pydata.org/docs/user_guide/index.html'}
  ],
  NumPy:[
    {name:'NumPy Learn',url:'https://numpy.org/learn/'},
    {name:'NumPy Quickstart',url:'https://numpy.org/doc/stable/user/quickstart.html'}
  ],
  'Machine Learning':[
    {name:'Google Machine Learning Crash Course',url:'https://developers.google.com/machine-learning/crash-course'},
    {name:'scikit-learn Getting Started',url:'https://scikit-learn.org/stable/getting_started.html'}
  ],
  Java:[
    {name:'Dev.java Learn',url:'https://dev.java/learn/'},
    {name:'Oracle Java Tutorials',url:'https://docs.oracle.com/javase/tutorial/'}
  ]
};

function resourcesForSkills(skills=[]){
  const out=[];
  for(const skill of skills){
    const key=Object.keys(skillResources).find(k=>canonicalSkill(k)===canonicalSkill(skill)||k.toLowerCase()===String(skill).toLowerCase());
    if(key) out.push({skill:key,resources:skillResources[key]});
  }
  return out;
}

function buildSageContext(intent, message, profile={}, history=[]) {
  const p=profileSummary(profile);
  const verified=verifiedSkillList(profile);
  const base={name:p.name,education:p.education,targetRole:p.goal||null,skills:p.skills,verifiedSkills:verified,interests:p.interests,projects:p.projects};
  if(intent==='INTERNSHIP') {
    const mentioned=findInternship(message);
    const top=bestMatches(profile,5).map(x=>({title:x.i.title,organization:x.i.organization,score:x.match.score,requiredSkills:x.i.skills,matched:x.match.matched,gaps:x.match.gaps}));
    return {...base,requestedInternship:mentioned?{title:mentioned.title,organization:mentioned.organization,skills:mentioned.skills,description:mentioned.description}:null,matches:top};
  }
  if(intent==='SKILL_ANALYSIS' || intent==='CAREER' || intent==='LEARNING' || intent==='PROJECTS' || intent==='PROFILE' || intent==='INTERVIEW') {
    const target=findRoleTarget(message)||findRoleTarget(profile.goal||'');
    const roadmap=target&&roadmaps[target]?roadmaps[target]:null;
    const canonical=canonicalSet(profile.skills||[]);
    const roadmapGaps=roadmap?roadmap.filter(x=>!roadmapSkillCovered(x,canonical)):[];
    const resourceSkills=[...new Set([...roadmapGaps,...(p.skills||[])])];
    return {...base,inferredDirection:target||null,skillRoadmap:roadmap||null,likelyGaps:roadmapGaps,learningResources:resourcesForSkills(resourceSkills)};
  }
  // GENERAL intentionally gets no internship ranking data.
  return base;
}

function roadmapSkillCovered(item, skills) {
  const probes={
    'Networking fundamentals':['networking'], 'Linux command line':['linux'], 'Python scripting':['python'], 'Web security basics':['cybersecurity'], 'Hands-on labs / CTFs':['cybersecurity'], 'Git + write-ups':['git'],
    'Strong Python':['python'], 'NumPy + Pandas':['numpy','pandas'], 'Statistics basics':[], 'scikit-learn':['machine learning'], 'Model evaluation':['machine learning'], '2 end-to-end ML projects':['machine learning'],
    'Python':['python'], 'Pandas + NumPy':['pandas','numpy'], 'SQL':['sql'], 'Statistics':[], 'Data visualization':[], 'Portfolio analysis project':[],
    'Python or Node.js':['python','nodejs'], 'REST APIs':['rest apis'], 'Authentication':[], 'Git':['git'], 'Docker + deployment basics':['docker'],
    'HTML + CSS':['html','css'], 'JavaScript':['javascript'], 'React':['react'], 'APIs':['rest apis'], 'One polished full-stack project':[],
    'Java fundamentals':['java'], 'OOP':['oop'], 'Collections':['java'], 'Spring Boot basics':[], 'REST API project':['rest apis']
  };
  const ps=probes[item];
  return ps ? ps.length>0 ? ps.some(x=>skills.has(x)) : false : false;
}

function sageReply(message, profile={}, history=[]) {
  const msg = String(message || '').trim();
  const lower = msg.toLowerCase();
  const p = profileSummary(profile);
  const target = inferTargetFromContext(msg, profile, history);
  const top = bestMatches(profile, 5);
  const mentioned = findInternship(msg);
  const previousUser = (Array.isArray(history) ? history.filter(x=>x && x.from==='you').slice(-2) : []).map(x=>x.text).join(' ');

  if (!msg) return `I’m here. Ask me something specific — for example, “Why is my cybersecurity match low?” or “What should I learn next?”`;

  // Greetings should never dump the same product pitch every time.
  if (/^(hi|hey|hello|yo|sup|hiya|hey sage|hi sage|good morning|good evening|good afternoon)[!. ,]*$/i.test(lower)) {
    return conversationalOpening(p.name);
  }

  if (/who are you|what are you|about sage|what can you do/.test(lower)) {
    return `I’m SAGE — the career intelligence layer of Iruka. I’m profile-aware, not just a generic chatbot: I can inspect your skills, target role, projects, internship matches, gaps, CV strategy and interview prep. I also use the platform’s actual match engine, so I won’t invent a percentage just to sound confident.`;
  }

  if (/^(thanks|thank you|thx|ty|cheers)[!. ]*$/i.test(lower)) {
    return `Anytime${p.name && p.name !== 'there' ? `, ${p.name.split(/\s+/)[0]}` : ''}. Send me the next thing you want to improve.`;
  }

  if (/clear chat|reset chat|forget conversation/.test(lower)) {
    return `You can clear the visible conversation from your browser by removing the SAGE chat history. Your profile and applications are stored separately.`;
  }

  if (/my profile|review.*profile|profile review|analyse.*profile|analyze.*profile|how.*profile/.test(lower)) {
    if (!p.skills.length && !p.education && !p.interests.length && !p.projects.length) {
      return `Your profile is basically a blank canvas right now. Add your education, target role, skills, interests and at least one project. Once you do, I can give you a real profile review instead of generic advice.`;
    }
    const strengths = p.skills.length ? `Your current skill base is ${p.skills.join(', ')}.` : `You haven’t added skills yet.`;
    const proof = p.projects.length ? `${p.projects.length} project${p.projects.length===1?'':'s'} give you some proof-of-work.` : `The biggest missing piece is project proof.`;
    const goalLine = target ? `Your current direction looks like ${target}.` : `Your target role is not clear yet, so I’d add one.`;
    const missing = !p.interests.length ? `Add a few interests so role ranking has more context.` : `Your interests are ${p.interests.slice(0,5).join(', ')}.`;
    return `${strengths} ${proof} ${goalLine} ${missing} Overall, I’d improve depth and proof before simply adding more technologies.`;
  }

  if (/which internship|best internship|recommend.*internship|internships for me|my matches|where should i apply|what should i apply/.test(lower)) {
    if (!p.skills.length) return `I can rank the internships, but you haven’t given me any skills yet. Add even your current basics first — then the scores will be calculated from them.`;
    if (!top.length) return `I don’t have enough profile data to rank these yet.`;
    const lines=top.slice(0,3).map((x,i)=>`${i+1}. ${x.i.title} — ${x.match.score}% (${x.match.matched.length}/${x.i.skills.length} listed skills matched)`).join('\n');
    return `Here’s the current ranking from your profile:\n${lines}\n\nMy pick: start with #1, then look at its gaps. A high percentage is useful, but the role should also fit the direction you actually want.`;
  }

  if (/why.*(match|score|percent)|explain.*match|match.*calculated|how.*match|score.*work/.test(lower)) {
    const item = mentioned || (top[0] && top[0].i);
    if (!p.skills.length) return `There’s no numeric match yet because you have zero skills in the profile. That is intentional — an empty profile cannot produce a meaningful percentage.`;
    if (item) {
      const m=scoreMatch(profile,item);
      return `${item.title} is ${m.score}% because ${m.matched.length} of ${item.skills.length} listed skills match after normalization. Matched: ${m.matched.join(', ') || 'none'}. Gaps: ${m.gaps.join(', ') || 'none'}. The engine weights required skills at 72%, interests at 12%, education at 10%, and projects at 6%.`;
    }
    return `The engine weights required skills 72%, interests 12%, education 10%, and projects 6%. Skills are normalized first, so Python/python3/PYTHON count as the same skill. No skills means no fake score.`;
  }

  if (/close.*skill gap|fix.*skill gap|improve.*skill gap|brief practical tutorial|tutorial.*skill gap/.test(lower)) {
    const item = mentioned || (top[0] && top[0].i);
    if (!item) return `Tell me which internship you want to target and I’ll turn its missing skills into a short learning plan.`;
    const m = scoreMatch(profile, item);
    if (!m.gaps.length) return `${item.title} already has no listed skill gaps for your profile. Nice — the next move is strengthening project proof and interview depth.`;
    const gap = m.gaps[0];
    const guides = {
      'Python': ['Learn variables, conditionals, loops, functions and basic data structures.', 'Practice by reading a small CSV or JSON file and printing useful summaries.', 'Build a tiny automation script related to the internship.', 'Prove it with a GitHub project, README and a short demo.'],
      'Linux': ['Learn the terminal, files/directories, permissions, processes and basic networking commands.', 'Practice navigating a project folder and inspecting a running process from the terminal.', 'Build a small Linux-based log investigation or system-monitoring exercise.', 'Prove it with a documented terminal walkthrough and Git repository.'],
      'Networking': ['Learn IP addresses, DNS, ports, TCP/UDP, HTTP and basic routing.', 'Practice identifying what DNS, HTTP and a TCP connection are doing in a simple request.', 'Build a safe local network-monitoring or packet-analysis learning project.', 'Prove it with diagrams, notes and a reproducible demo.'],
      'Cybersecurity': ['Learn the CIA triad, authentication, common vulnerabilities and basic defensive security.', 'Practice identifying security risks in a deliberately safe local demo application.', 'Build a defensive security dashboard or log-analysis project.', 'Prove it with a threat summary, mitigations and a clear README.'],
      'Git': ['Learn repositories, commits, branches, merges, pull/push and basic collaboration.', 'Create a repository and make several small commits with meaningful messages.', 'Use Git properly while building your next internship project.', 'Prove it through a clean public repository and commit history.'],
      'JavaScript': ['Learn variables, functions, arrays/objects, DOM events and async basics.', 'Build a tiny interactive page that reads input and updates the UI.', 'Extend it into a small internship-relevant web feature.', 'Prove it with a live demo and readable source code.'],
      'React': ['Learn components, props, state, events, effects and basic component structure.', 'Build one small component that accepts data and updates from user interaction.', 'Turn it into a dashboard feature relevant to the internship.', 'Prove it with a deployed demo and concise README.'],
      'Node.js': ['Learn the Node runtime, modules, HTTP, routing and async programming.', 'Create a tiny local API with one GET endpoint and one POST endpoint.', 'Build a small backend feature for the internship domain.', 'Prove it with API examples, tests and a README.'],
      'SQL': ['Learn SELECT, WHERE, JOIN, GROUP BY, ORDER BY and basic INSERT/UPDATE operations.', 'Create two related tables and write queries that answer five practical questions.', 'Build a small database-backed feature for your portfolio project.', 'Prove it with schema diagrams and example queries.'],
      'Docker': ['Learn images, containers, Dockerfiles, ports, volumes and basic Compose concepts.', 'Containerize a tiny local app and expose one port.', 'Use Docker to package your internship project consistently.', 'Prove it with a Dockerfile, run instructions and a short demo.'],
      'Pandas': ['Learn Series/DataFrames, loading data, filtering, grouping and handling missing values.', 'Load a small CSV and produce three useful summaries.', 'Use Pandas inside a data or ML project.', 'Prove it with a notebook, clean dataset workflow and README.'],
      'NumPy': ['Learn arrays, shapes, indexing, vectorized operations and basic numerical functions.', 'Create an array and perform a few vectorized calculations without Python loops.', 'Use NumPy in a small data/ML preprocessing project.', 'Prove it in a notebook with explanations of why the operations matter.'],
      'Machine Learning': ['Learn supervised vs unsupervised learning, train/test splits, features, labels and evaluation metrics.', 'Train one simple model on a small public dataset and compare two evaluation metrics.', 'Build one end-to-end prediction project with a clear problem statement.', 'Prove it with evaluation results, limitations and a reproducible notebook.'],
      'REST APIs': ['Learn HTTP methods, status codes, JSON, endpoints and request/response design.', 'Create a tiny API with GET, POST and one validation rule.', 'Build an API around a real feature in your portfolio project.', 'Prove it with endpoint examples and a README.'],
      'Excel': ['Learn formulas, sorting/filtering, pivot tables and basic charts.', 'Take a small dataset and create a summary table plus two useful charts.', 'Build an internship-style analytics report.', 'Prove it with a clean workbook and screenshots or exported report.'],
      'Data Analysis': ['Learn cleaning, descriptive statistics, trends and communicating findings.', 'Take a small dataset and write five evidence-based observations.', 'Turn those observations into a dashboard or analysis report.', 'Prove it with the dataset, notebook/report and conclusions.'],
      'Java': ['Learn syntax, classes, methods, collections, exceptions and basic input/output.', 'Build a small console program using classes and collections.', 'Turn it into a small internship-relevant application.', 'Prove it with clean code, tests and a README.'],
      'OOP': ['Learn classes, objects, encapsulation, inheritance and polymorphism.', 'Model a small real-world system with 3-4 classes and explain each responsibility.', 'Use the design in a Java portfolio project.', 'Prove it with a class diagram and readable code.']
    };
    const g = guides[gap] || [`Learn the fundamentals of ${gap} and the vocabulary used in this internship.`, `Do one small hands-on exercise using ${gap}.`, `Apply ${gap} to a small project connected to this internship.`, `Prove the skill with a documented project, demo or other concrete work.`];
    return `Let’s close **${gap}** for ${item.title}.

1. Learn first: ${g[0]}
2. Practice: ${g[1]}
3. Apply: ${g[2]}
4. Proof: ${g[3]}

You also have these gaps: ${m.gaps.join(', ')}. Start with ${gap}, then we can tackle the next one.`;
  }

  if (/skill gap|skills.*missing|missing skills|what.*learn|need to learn|learn next|next skill/.test(lower)) {
    if (!p.skills.length) return `Start by entering the skills you already know. I need that baseline to distinguish “missing” from “already have”.`;
    if (target && roadmaps[target]) {
      const have=canonicalSet(p.skills);
      const needed=roadmaps[target].filter(x=>!have.has(canonicalSkill(x)));
      const priority=needed.slice(0,5);
      return priority.length
        ? `For ${target}, I’d prioritize: ${priority.join(' → ')}. You already have ${p.skills.slice(0,6).join(', ')}${p.skills.length>6?' and more':''}, so don’t restart from zero. Build one project after the first 2–3 gaps instead of collecting certificates endlessly.`
        : `For ${target}, your listed roadmap skills are already covered. Your next gap is proof: build a serious project, document it, and prepare to explain your decisions in an interview.`;
    }
    const b=top[0];
    if (b) return `For your strongest current match, ${b.i.title}, the actual gaps are ${b.match.gaps.join(', ') || 'none'}. If you want a different career direction, tell me the role and I’ll switch the roadmap.`;
    return `Tell me the role you want — cybersecurity, AI/ML, backend, web development, data science, or Java — and I’ll order the skills instead of giving you a random list.`;
  }

  if (/project idea|project ideas|what project|projects should|portfolio project/.test(lower)) {
    const t=target || 'Web Development';
    const ideas={
      'Cybersecurity':['Phishing URL detector with explainable risk flags','Security log anomaly dashboard','Web vulnerability learning lab with a safe local target'],
      'AI / ML':['Internship recommendation model','Spam/phishing classifier with model evaluation','Student performance predictor with an explainable report'],
      'Data Science':['Job-market skills dashboard','Internship dataset exploration dashboard','Skills-vs-requirements analytics report'],
      'Backend Development':['Internship API with authentication and search','Rate-limited task API with SQL','Application analytics backend'],
      'Web Development':['Internship tracker dashboard','Portfolio with project case studies','Real-time application board'],
      'Java Development':['Student management REST API','Inventory system with SQL','Internship application backend']
    };
    const list=ideas[t] || ['One polished end-to-end project tied to your target role'];
    return `For ${t}, three strong directions are:\n• ${list[0]}\n• ${list[1]}\n• ${list[2]}\n\nPick the one you can finish and defend technically. One complete project with a clear README and demo is stronger than a pile of unfinished tutorials.`;
  }

  if (/cv|resume|resume.*improve|improve.*cv|cv.*improve/.test(lower)) {
    const skillLine=p.skills.length ? `Put your strongest relevant skills first: ${p.skills.slice(0,6).join(', ')}.` : `Add your actual skills before tailoring the CV.`;
    const proof=p.projects.length ? `You have ${p.projects.length} project${p.projects.length===1?'':'s'} to turn into proof-based bullet points.` : `You need 1–2 solid projects to give the CV evidence.`;
    return `For a student CV, optimize for evidence rather than a huge skills wall. ${skillLine} ${proof} For each project, show what you built, the technologies used, your specific contribution, and a measurable result where you genuinely have one. Keep unrelated technologies out of the spotlight.`;
  }

  if (/interview|interview prep|prepare.*interview|questions.*ask/.test(lower)) {
    const t=target;
    const basics=t && roadmaps[t] ? roadmaps[t].slice(0,4).join(', ') : 'your core fundamentals, projects, and the role requirements';
    return `Prepare in three layers: 1) fundamentals, 2) your projects, 3) role-specific questions. For every skill on your CV, be ready to explain where you used it and why you chose it. ${t ? `For ${t}, drill ${basics}.` : `Start with ${basics}.`} I’d also practice a 60-second explanation of your strongest project.`;
  }

  if (/roadmap|learning plan|study plan|plan.*career|next.*steps/.test(lower)) {
    if (target && roadmaps[target]) return `Your ${target} roadmap is: ${roadmaps[target].map((x,i)=>`${i+1}. ${x}`).join(' → ')}. The rule I’d use is simple: learn a layer, build something with it, then move forward. Don’t try to master the whole roadmap simultaneously.`;
    return `Give me the target role and I’ll build the roadmap around it. I can make it skill-first, project-first, or interview-first depending on what you need.`;
  }

  if (/compare|difference between|which is better/.test(lower) && top.length>=2) {
    const a=top[0], b=top[1];
    return `Between your top two current matches, ${a.i.title} is ${a.match.score}% and ${b.i.title} is ${b.match.score}%. ${a.i.title} currently wins because it has stronger overlap with your profile. If you tell me what matters more — career direction, skill growth, or getting the easiest realistic entry point — I can make the comparison more useful.`;
  }

  // Specific internship questions should beat the generic fallback.
  if (mentioned) {
    if (!p.skills.length) return `${mentioned.title} needs ${mentioned.skills.join(', ')}. Add your current skills and I’ll calculate exactly which of those you already cover.`;
    const m=scoreMatch(profile,mentioned);
    return `${mentioned.title} at ${mentioned.organization} is currently ${m.score}% for you. You match ${m.matched.join(', ') || 'none'} and are missing ${m.gaps.join(', ') || 'none of the listed skills'}. ${m.gaps.length ? `Your highest-value next step is closing ${m.gaps[0]}.` : 'Your next advantage would be stronger project proof and interview depth.'}`;
  }

  // Contextual follow-up: use the previous user turn instead of pretending the new message is standalone.
  if (/^(why|how|what about|and then|then what|really|okay|ok|yes|yeah|sure|go on|tell me more|explain)$/.test(lower) && previousUser) {
    return `Sure — continuing from “${previousUser.slice(0,120)}${previousUser.length>120?'…':''}”: ${target ? `I’d keep the focus on ${target}.` : 'I’d keep the focus on your target role.'} Tell me whether you want the next step, the reasoning, or a concrete project/learning plan.`;
  }

  if (target && roadmaps[target]) {
    const known=p.skills.length ? `You already have ${p.skills.slice(0,5).join(', ')}.` : `You haven’t added your current skills yet.`;
    return `For ${target}, I’d start with ${roadmaps[target].slice(0,3).join(', ')}. ${known} If you tell me what outcome you want — internship, project, CV, or interview — I’ll make that more specific.`;
  }

  const profileHint=p.skills.length ? `I can already see ${p.skills.length} skills, so I’ll use those rather than treating you like a blank slate.` : `Your profile has no skills yet, so matching will stay locked until you add some.`;
  return `I can help, but I want to answer the actual problem rather than throw a generic career speech at you. Try something like “review my profile”, “why is my top match ${top[0]?.i.title || 'low'}?”, “what should I learn for cybersecurity?”, “give me a project”, or “fix my CV”. ${profileHint}`;
}


function normalizeName(value='') {
  return String(value).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
function decodePdfText(buffer) {
  // Lightweight extraction for text-based PDFs. Scanned PDFs are intentionally sent to review.
  const raw=buffer.toString('latin1');
  const chunks=[];
  const rx=/BT([\s\S]*?)ET/g;
  let m;
  while((m=rx.exec(raw))){
    const block=m[1];
    const strings=[...block.matchAll(/\(([^()]*)\)\s*T[Jj]/g)].map(x=>x[1]);
    if(strings.length) chunks.push(strings.join(' '));
  }
  return chunks.join(' ').replace(/\\([\\()])/g,'$1').replace(/\s+/g,' ').trim();
}
function extractCertificateFields(text='') {
  const clean=String(text).replace(/\s+/g,' ').trim();
  const lower=clean.toLowerCase();
  const fields={name:null,title:null,issuer:null,date:null,certificateId:null,skills:[]};
  const nameMatch=clean.match(/(?:awarded to|presented to|this is to certify that|certify that)\s*[:\-]?\s*([A-Z][A-Za-z .'-]{2,80}?)(?=\s+(?:has|for|successfully|who|is hereby|completed|in recognition|for successfully)|[,.]|$)/i);
  if(nameMatch) fields.name=nameMatch[1].trim();
  const titlePatterns=[
    /(?:certificate|course|program|certification)\s+(?:of|in|for)\s+([A-Za-z0-9 &+.#/()_-]{3,100}?)(?=\s+(?:from|issued|awarded|dated|on)\b|$)/i,
    /(?:successfully completed|completed)\s+(?:the\s+)?([A-Za-z0-9 &+.#/()_-]{3,100}?)(?=\s+(?:from|issued|awarded|dated|on)\b|$)/i
  ];
  for(const rx of titlePatterns){const m=clean.match(rx);if(m){fields.title=m[1].replace(/\s+(?:from|at|on)\s+.*$/i,'').trim();break;}}
  const issuerMatch=clean.match(/(?:issued by|offered by|provided by|from)\s*[:\-]?\s*([A-Z][A-Za-z0-9 &.,'()-]{2,100}?)(?=\s+(?:on|dated|certificate|credential|date|issued|awarded)\b|$)/i);
  if(issuerMatch) fields.issuer=issuerMatch[1].trim();
  const dateMatch=clean.match(/(?:date|issued|awarded|completed|completion)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i);
  if(dateMatch) fields.date=dateMatch[1];
  const idMatch=clean.match(/(?:certificate|credential|verification)\s*(?:id|no|number|#)\s*[:\-]?\s*([A-Z0-9-]{5,40})/i);
  if(idMatch) fields.certificateId=idMatch[1];
  const candidates=['Python','JavaScript','React','Node.js','HTML','CSS','Java','C++','C','C#','SQL','Git','Linux','Docker','Pandas','NumPy','Machine Learning','Artificial Intelligence','Cybersecurity','Networking','REST APIs','Excel','Data Analysis','OOP'];
  fields.skills=candidates.filter(s=>new RegExp(`(^|[^a-z0-9+#])${s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/node\.js/i,'node[ .-]?js')}([^a-z0-9+#]|$)`,'i').test(lower));
  return fields;
}

async function sanitizeCredentialForAI({base64, mime, filename, profileName}) {
  // Render-safe credential privacy path: no Python/OpenCV/Tesseract executable required.
  // The original credential is never sent to AIRouter. We extract/OCR text locally,
  // redact the profile name and obvious personal identifiers, then send text only.
  const buffer = Buffer.from(base64, 'base64');
  let ocrText = '';
  let method = '';

  if (mime === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    ocrText = String(parsed.text || '').trim();
    method = 'node-pdf-text-extraction';
    if (!ocrText) {
      throw new Error('This PDF appears to be scanned/image-only. Please upload a text-based PDF or JPG/PNG certificate.');
    }
  } else {
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(buffer);
      ocrText = String(result?.data?.text || '').trim();
      method = 'node-tesseract-local-ocr';
    } finally {
      await worker.terminate();
    }
    if (!ocrText) throw new Error('Could not read text from the uploaded certificate image.');
  }

  const before = ocrText;
  const profile = String(profileName || '').trim();
  if (profile) {
    const escaped = profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ocrText = ocrText.replace(new RegExp(escaped, 'ig'), '[REDACTED]');
  }
  // Redact common personal identifiers before AIRouter receives the text.
  ocrText = ocrText
    .replace(/(?:email|e-mail)\s*[:\-]?\s*\S+@\S+/ig, 'Email: [REDACTED]')
    .replace(/(?:phone|mobile|contact|tel(?:ephone)?)\s*[:\-]?\s*[+\d][\d\s().-]{7,}/ig, 'Phone: [REDACTED]')
    .replace(/(?:student|application|registration|enrol(?:l)?ment|candidate)\s*(?:id|no|number|#)\s*[:\-]?\s*[A-Z0-9-]{4,}/ig, 'ID: [REDACTED]');

  const normalizedProfile = normalizeIdentityName(profile);
  const normalizedOriginal = normalizeIdentityName(before);
  const profileNameMatched = !!normalizedProfile && normalizedOriginal.includes(normalizedProfile);

  return {
    dataUrl: null,
    mime: 'text/plain',
    meta: {
      ocrText,
      profileNameMatched,
      redactions: (before.length - ocrText.length > 0 ? 1 : 0),
      pages: mime === 'application/pdf' ? 1 : 1,
      qrDecoded: [],
      method,
      privacyMode: 'local-text-only'
    }
  };
}
async function airouterCredentialReview({ocrText, profileName, filename, claimedSkill, localNameMatch=false, privacyMeta=null}) {
  if(!AIROUTER_API_KEY) return null;
  const schema = {
    type:"object",
    properties:{
      status:{type:"string",enum:["document-validated","needs-review","rejected"]},
      confidence:{type:"number"}, documentType:{type:"string"}, name:{type:"string"}, nameMatch:{type:"boolean"},
      title:{type:"string"}, issuer:{type:"string"}, issuerAssessment:{type:"string",enum:["recognized","appears-legitimate","unknown","suspicious"]},
      issuerEvidence:{type:"array",items:{type:"string"}}, date:{type:"string"}, certificateId:{type:"string"},
      qrCode:{type:"object",properties:{detected:{type:"boolean"},decodedValue:{type:"string"},destination:{type:"string"},useful:{type:"boolean"}},required:["detected","decodedValue","destination","useful"]},
      skillsMentioned:{type:"array",items:{type:"string"}}, issues:{type:"array",items:{type:"string"}}, checks:{type:"array",items:{type:"string"}}, hiringReviewNote:{type:"string"}
    },
    required:["status","confidence","documentType","name","nameMatch","title","issuer","issuerAssessment","issuerEvidence","date","certificateId","qrCode","skillsMentioned","issues","checks","hiringReviewNote"]
  };
  const prompt=`You are Iruka SAGE's credential-authentication engine. Assess ONE privacy-sanitized credential using only the OCR text and locally decoded QR evidence supplied below. You are verifying the document, NOT measuring skill proficiency.

Rules:
- Reject unrelated documents such as bills, invoices, resumes, IDs, or random screenshots.
- Do not require the claimed skill to literally appear on the credential.
- Never infer beginner/intermediate/advanced proficiency. The hiring company decides that.
- The recipient name was locally checked. Treat localNameMatch as authoritative and do not try to reconstruct redacted PII.
- Do not treat logos, signatures, seals, certificate IDs, or QR presence alone as proof of authenticity.
- Do not claim that you contacted or independently verified the issuer.
- If the issuer is a recognizable institution and the credential is internally coherent, you may use issuerAssessment=recognized or appears-legitimate based on the document evidence.
- Missing certificate IDs or QR codes are not automatic rejection reasons.
- If a QR URL is supplied, record it as evidence only if it clearly belongs to the issuer or a credential-verification service. Do not invent a destination.
- Keep evidence concise. Return only JSON.

Profile name: [REDACTED]
Claimed skill: ${claimedSkill || 'not provided'}
Local profile-name match: ${localNameMatch ? 'true' : 'false'}
Locally decoded safe QR URL(s): ${JSON.stringify(privacyMeta?.qrDecoded || [])}
Sanitized OCR text:
${String(ocrText||'').slice(0,16000)}`;
  const payload={
    model:AIROUTER_MODEL,
    messages:[
      {role:'system',content:'Return only valid JSON matching the supplied schema. Be conservative and evidence-based.'},
      {role:'user',content:prompt}
    ],
    temperature:0.1,
    max_tokens:1800,
  };
  try{
    const r=await fetch(`${AIROUTER_BASE_URL.replace(/\/+$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${AIROUTER_API_KEY}`},body:JSON.stringify(payload)});
    const raw=await r.text();
    if(!r.ok){console.error('AIRouter credential error',r.status,raw.slice(0,1200));return null;}
    const data=JSON.parse(raw);
    const out=data?.choices?.[0]?.message?.content || '';
    const match=String(out).match(/\{[\s\S]*\}/); if(!match)return null;
    const result=JSON.parse(match[0]);
    result.confidence=Math.max(0,Math.min(1,Number(result.confidence)||0));
    result.skillsMentioned=Array.isArray(result.skillsMentioned)?result.skillsMentioned:[];
    result.issues=Array.isArray(result.issues)?result.issues:[];
    result.checks=Array.isArray(result.checks)?result.checks:[];
    result.issuerEvidence=Array.isArray(result.issuerEvidence)?result.issuerEvidence:[];
    result.qrCode=result.qrCode&&typeof result.qrCode==='object'?result.qrCode:{detected:false,decodedValue:null,destination:null,useful:false};
    result.source='airouter-credential-engine'; result.name='[REDACTED]'; result.nameMatch=!!localNameMatch;
    result.privacy={sanitized:true,redactions:privacyMeta?.redactions||0,pages:privacyMeta?.pages||1,qrPreserved:privacyMeta?.qrDecoded||[]};
    return result;
  }catch(e){console.error('AIRouter credential request failed:',e.message);return null;}
}

function localCertificateReview(body) {
  const mime=String(body.mime||'').toLowerCase(), name=String(body.filename||'');
  const allowed=['application/pdf','image/png','image/jpeg','image/jpg','image/webp'];
  if(!allowed.includes(mime)) return {status:'rejected',confidence:0,documentType:'unsupported',issues:['Unsupported file type. Use PDF, PNG, JPG, or WEBP.'],checks:['File type check']};
  let text=String(body.text||'').trim();
  if(mime==='application/pdf' && body.base64){
    try{text=decodePdfText(Buffer.from(String(body.base64),'base64'));}catch{}
  }
  if(!text) return {status:'needs-review',confidence:0.25,documentType:'certificate',issues:['The file is readable as an upload, but no selectable certificate text could be extracted. A human/issuer check is still needed for scanned PDFs or unclear images.'],checks:['File type check','Readability check'],name:null,title:null,issuer:null,date:null,certificateId:null,skills:[]};
  const fields=extractCertificateFields(text);
  if(body.profileName && normalizeName(text).includes(normalizeName(body.profileName))) fields.name=body.profileName;
  const certWords=['certificate','certification','credential','completion','completed','achievement','awarded','course'];
  const looksLikeCertificate=certWords.some(x=>text.toLowerCase().includes(x));
  const issues=[];
  if(!looksLikeCertificate) issues.push('The document does not contain enough certificate-related wording.');
  if(body.profileName && fields.name && !normalizeName(fields.name).includes(normalizeName(body.profileName)) && !normalizeName(body.profileName).includes(normalizeName(fields.name))) issues.push('The detected recipient name does not clearly match the profile name.');
  if(!fields.title) issues.push('Certificate title/course could not be confidently detected.');
  if(!fields.issuer) issues.push('Issuer/institution could not be confidently detected.');
  if(!fields.date) issues.push('Issue/completion date could not be confidently detected.');
  const status=!looksLikeCertificate?'rejected':issues.some(x=>x.includes('does not clearly'))||issues.length>=3?'needs-review':'document-validated';
  const localNameMatch=!!body.profileName && !!fields.name && (normalizeName(fields.name)===normalizeName(body.profileName) || normalizeName(fields.name).includes(normalizeName(body.profileName)) || normalizeName(body.profileName).includes(normalizeName(fields.name)));
  return {status,confidence:status==='document-validated'?0.88:status==='needs-review'?0.58:0.2,documentType:looksLikeCertificate?'certificate':'unknown',...fields,nameMatch:localNameMatch,issuerAssessment:fields.issuer?'unknown':'unknown',issuerEvidence:[],qrCode:{detected:false,decodedValue:null,destination:null,useful:false},skillsMentioned:fields.skills,issues,checks:['File type check','Text extraction check','Certificate keyword check','Recipient-name consistency check','Issuer/title/date field checks','Skill-level decision deferred to hiring company'],source:'local-text-validation'};
}


async function callAirouterSage({system, message}) {
  if (!AIROUTER_API_KEY) return null;
  const payload = {
    model: AIROUTER_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: message }
    ],
    max_tokens: 1100
  };
  try {
    const r = await fetch(`${AIROUTER_BASE_URL.replace(/\/+$/,'')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIROUTER_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const raw = await r.text();
    if (!r.ok) {
      console.error('AIRouter error', r.status, raw);
      return null;
    }
    const data = JSON.parse(raw);
    const reply = data?.choices?.[0]?.message?.content;
    return typeof reply === 'string' && reply.trim() ? reply.trim() : null;
  } catch (e) {
    console.error('AIRouter request failed', e.message);
    return null;
  }
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});
  res.end(data);
}
function readBody(req) { return new Promise((resolve,reject)=>{ let body=''; req.on('data',c=>{body+=c; if(body.length>8e6){reject(new Error('too large'));req.destroy();}}); req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch(e){reject(e);}}); req.on('error',reject); }); }
function serveStatic(req,res,pathname) {
  let filePath = pathname === '/' ? path.join(PUBLIC,'index.html') : path.join(PUBLIC, pathname);
  if (!filePath.startsWith(PUBLIC)) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(PUBLIC,'index.html');
  const ext = path.extname(filePath).toLowerCase();
  const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
  res.writeHead(200, {'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(filePath).pipe(res); return true;
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,{ok:true,name:'SAGE',app:'Iruka Sage',mode:AIROUTER_API_KEY?'airouter-ai':'local-fallback',model:AIROUTER_API_KEY?AIROUTER_MODEL:null});
    if (req.method === 'GET' && url.pathname === '/api/internships') return json(res,200,{internships});
    if (req.method === 'POST' && url.pathname === '/api/matches') { const body=await readBody(req); return json(res,200,{matches: internships.map(i=>({id:i.id, match:scoreMatch(body.profile||{},i)}))}); }
    if (req.method === 'POST' && url.pathname === '/api/sage/chat') {
      const body=await readBody(req);
      const message=String(body.message||'').trim();
      const rawProfile=body.profile||{};
      const history=Array.isArray(body.history)?body.history:[];
      if(!message) return json(res,400,{error:'Message is required.'});

      const intent=detectSageIntent(message, rawProfile, history);
      const context=buildSageContext(intent, message, rawProfile, history);

      if (!AIROUTER_API_KEY) {
        const reply=sageReply(message,rawProfile,history);
        return json(res,200,{reply,assistant:'SAGE',mode:'local-fallback',intent});
      }

      const system=`You are SAGE, Iruka's personal career intelligence counselor and learning companion.

Your job is to help the student think clearly, make decisions, learn skills, and improve their career profile. You are a general conversational AI first. Career and internship context is available when relevant, but it must NEVER hijack an unrelated question.

CORE BEHAVIOR:
- Answer the user's actual question first.
- Do not force every question into internships, AIML, cybersecurity, or any single career path.
- Treat the student's profile as context, not as a script you must mention every time.
- Be warm, direct, encouraging and honest. Sound like a highly competent human career counselor, not a customer-support bot.
- Never repeat your introduction or product pitch unless asked.
- Never invent skills, certificates, projects, experience, match scores, or achievements.
- Distinguish clearly between skills the profile lists and skills that have verified evidence.
- If the student asks what they are missing, analyze gaps independently from their target and the information available. Do not choose a random internship as the basis unless explicitly requested.
- If their target is unclear, say what you can infer and give a useful general recommendation rather than inventing one.
- Give practical next actions. Prefer a short diagnosis followed by prioritized actions.
- When teaching, teach interactively: explain one concept, give a small example, then give the student something to try. Do not dump an entire textbook.
- When recommending a skill, explain why it matters and how the student can prove it with a project or evidence.
- If learningResources are provided, use them. For skill-learning questions, give at least one direct resource link from the supplied resources when available. Never tell the student to "search for it" when SAGE has a suitable direct resource.
- For internship skill-gap questions, provide direct learning links for the missing skills whenever available in learningResources.
- If a question is unrelated to careers, answer it normally without dragging career context into it.
- Use recent conversation for continuity, but do not let an old internship context override the current question.

OUTPUT STYLE:
- Write like a polished modern AI counselor.
- Do NOT use Markdown headings beginning with #.
- Do NOT use asterisks for bold or bullets.
- Do NOT use Markdown tables.
- Use short paragraphs and simple labeled lines when useful, such as "My take:", "Priority:", or "Next step:".
- For lists, use the • character.
- Keep most answers scannable: usually 3–8 short paragraphs or bullets unless the student asks for depth.
- Put links on their own line with a clear label, for example: "Learn Python: https://docs.python.org/3/tutorial/".
- Never output fake URLs.

CURRENT SAGE MODE: ${intent}

STUDENT CONTEXT (only the context selected for this question):
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION:
${JSON.stringify(history.slice(-10), null, 2)}
`

      // Primary counselor provider: AIRouter (OpenAI-compatible Chat Completions).
      const airouterReply = await callAirouterSage({system, message});
      if (airouterReply) {
        return json(res,200,{reply:airouterReply,assistant:'SAGE',mode:'airouter',model:AIROUTER_MODEL,intent});
      }

      const fallback=sageReply(message,rawProfile,history);
      return json(res,200,{reply:fallback,assistant:'SAGE',mode:'local-fallback',warning:'AI providers unavailable',intent});
    }

    if (req.method === 'POST' && url.pathname === '/api/verify-certificate') {
      const body=await readBody(req);
      const filename=String(body.filename||'certificate');
      const mime=String(body.mime||'').toLowerCase();
      const base64=String(body.base64||'');
      if(!base64 || base64.length>7_000_000) return json(res,400,{error:'File is missing or too large. Maximum supported upload is about 5 MB.'});
      const allowed=['application/pdf','image/png','image/jpeg','image/jpg','image/webp'];
      if(!allowed.includes(mime)) return json(res,400,{error:'Unsupported file type.'});
      const profileName=String(body.profileName||'').trim();
      const profileNameParts=body.profileNameParts && typeof body.profileNameParts==='object' ? body.profileNameParts : {};
      const claimedSkill=String(body.claimedSkill||'').trim();
      let sanitized=null;
      let localNameMatch=false;
      try{
        const sanitizerName=[String(profileNameParts.first||'').trim(),String(profileNameParts.last||'').trim()].filter(Boolean).join(' ') || profileName;
        sanitized=await sanitizeCredentialForAI({base64,mime,filename,profileName:sanitizerName});
        localNameMatch=certificateNameMatch(profileName,profileNameParts) || !!sanitized.meta.profileNameMatched;
      }catch(e){
        console.warn('Credential privacy sanitizer failed:',e.message);
        return json(res,503,{error:'Privacy sanitizer unavailable. The original credential was NOT sent to the AI provider.',privacySafe:false});
      }
      let result=await airouterCredentialReview({ocrText:sanitized.meta.ocrText||'',profileName:'[REDACTED]',filename:'credential-upload.pdf',claimedSkill,localNameMatch,privacyMeta:sanitized.meta});
      if(!result) result=localCertificateReview(body);

      // SAGE QA DEMO FIXTURE
      // Explicitly isolated from normal credential screening. This accepts ONLY
      // the synthetic SAGE-DEMO-* fixture when DEMO MODE is enabled.
      const demoMode = String(process.env.SAGE_DEMO_MODE || '').toLowerCase() === 'true';
      const demoText = String(sanitized.meta.ocrText || body.text || '');
      const demoCredential = /SAGE[- ]DEMO[- ]001/i.test(demoText);
      if (demoMode && demoCredential) {
        result = {
          ...result,
          status: 'document-validated',
          confidence: 1,
          documentType: 'synthetic-demo-credential',
          name: '[REDACTED]',
          nameMatch: true,
          title: result.title || 'Synthetic SAGE Demo Credential',
          issuer: 'C-DAC (SIMULATED DEMO PROVIDER — NOT C-DAC)',
          issuerAssessment: 'recognized',
          issuerEvidence: ['SAGE synthetic QA fixture'],
          issues: [],
          checks: [...(Array.isArray(result.checks) ? result.checks : []), 'SAGE DEMO fixture recognized'],
          source: 'sage-demo-fixture',
          demoCredential: true
        };
      }

      // Privacy-safe identity handling:
      // The AI receives [REDACTED] instead of the student's real name, so never
      // compare result.name ([REDACTED]) with profileName here. The local OCR
      // sanitizer is the authoritative name-match check.
      if(result.source==='airouter-credential-engine') {
        result.nameMatch=localNameMatch;
      } else {
        const normalizedProfile=normalizeName(profileName);
        const normalizedDoc=normalizeName(result.name||'');
        const exactOrContained=!!normalizedProfile && !!normalizedDoc && (normalizedProfile===normalizedDoc || normalizedProfile.includes(normalizedDoc) || normalizedDoc.includes(normalizedProfile));
        const structuredMatch=certificateNameMatch(result.name||'',profileNameParts);
        const nameMatch=structuredMatch || exactOrContained;
        result.nameMatch=(result.nameMatch===undefined || result.nameMatch===null) ? nameMatch : (!!result.nameMatch && nameMatch);
      }

      // AI-assisted credential screening gate. This is deliberately NOT a cryptographic
      // or issuer-verification claim. It checks identity consistency + document structure
      // and lets Gemini assess whether the credential appears coherent and legitimate.
      const hasCredentialType=['certificate','certification','credential','training','course','completion','award'].some(x=>String(result.documentType||'').toLowerCase().includes(x));
      const hasIssuer=!!String(result.issuer||'').trim();
      const hasTitle=!!String(result.title||'').trim();
      const hasDate=!!String(result.date||'').trim();
      const hasCertificateId=!!String(result.certificateId||'').trim();
      const qrDetected=!!result.qrCode?.detected;
      const qrUseful=!!result.qrCode?.useful;
      const issuerAssessment=String(result.issuerAssessment||'unknown').toLowerCase();
      const issuerSupported=(issuerAssessment==='recognized' || issuerAssessment==='appears-legitimate');

      // Build an explicit, human-readable audit trail. Optional evidence (ID/QR) is
      // never a hard failure. This is intentionally exposed to the UI so we can test
      // false rejections instead of guessing why a document failed.
      const debugChecks=[
        {key:'file',label:'File accepted',passed:true,detail:`${mime} · ${Math.round(Buffer.from(base64,'base64').length/1024)} KB`},
        {key:'privacy',label:'Privacy sanitizer',passed:true,detail:`Sanitized before AI · ${sanitized.meta.redactions||0} redaction(s)`},
        {key:'name',label:'Profile-name match',passed:!!result.nameMatch,detail:result.nameMatch?'Name evidence matched the selected profile name.':'The extracted recipient name did not clearly match the selected profile name.'},
        {key:'type',label:'Credential type detected',passed:hasCredentialType,detail:hasCredentialType?`Detected as ${result.documentType}.`:'The AI did not classify this as a clear credential.'},
        {key:'title',label:'Course / title detected',passed:hasTitle,detail:hasTitle?String(result.title):'No clear course or credential title was extracted.'},
        {key:'issuer',label:'Issuer detected',passed:hasIssuer,detail:hasIssuer?String(result.issuer):'No clear issuer/institution was extracted.'},
        {key:'issuer-plausibility',label:'Issuer plausibility',passed:issuerSupported,warning:issuerAssessment==='unknown',detail:`AI assessment: ${issuerAssessment}`},
        {key:'date',label:'Issue / completion date',passed:hasDate,optional:true,detail:hasDate?String(result.date):'Not detected (not a hard failure).'},
        {key:'certificate-id',label:'Credential ID',passed:hasCertificateId,optional:true,detail:hasCertificateId?'Credential ID detected.':'No credential ID detected (not a hard failure).'},
        {key:'qr',label:'QR / verification evidence',passed:qrUseful,optional:true,warning:qrDetected&&!qrUseful,detail:qrDetected?(qrUseful?'Useful issuer/verification URL detected.':'QR detected but not treated as verification evidence.'):'No QR code detected (not a hard failure).'},
        {key:'ai-status',label:'AI document assessment',passed:result.status==='document-validated',detail:`AI returned ${result.status}. Confidence ${(Number(result.confidence)||0)*100|0}%`}
      ];

      if(!result.nameMatch || !hasCredentialType || !hasIssuer || !hasTitle){
        result.status='needs-review';
      } else if(issuerAssessment==='suspicious'){
        result.status='rejected';
      }
      result.filename=filename;
      result.claimedSkill=claimedSkill||null;
      result.issuerVerified=false;
      result.credentialBacked = result.demoCredential
        ? true
        : (result.status==='document-validated' && issuerSupported);
      result.verificationNote=result.demoCredential
        ? 'DEMO CREDENTIAL ACCEPTED — synthetic SAGE QA fixture. This result is only valid in DEMO MODE and has no real credential value.'
        : result.credentialBacked
        ? 'AI-screened credential: the document appears coherent, matches the profile name, and is associated with a plausible issuer. SAGE does not claim cryptographic issuer verification or assign a skill level; the hiring company reviews what the credential demonstrates.'
        : 'AI-assisted credential screening result. Review the highlighted issue(s) before treating this document as credential-backed.';
      result.checks=Array.isArray(result.checks)?result.checks:[];
      result.checks.push(result.nameMatch?'Profile-name match':'Profile-name match failed or could not be established');
      result.checks.push(hasCredentialType?'Credential-type check passed':'Credential-type check failed');
      result.checks.push(hasIssuer?'Issuer/course consistency check':'Issuer detection failed');
      result.checks.push(hasDate?'Date detected':'Date not detected (optional)');
      result.checks.push(hasCertificateId?'Credential ID detected':'Credential ID not detected (optional)');
      result.checks.push(qrUseful?'Useful QR evidence detected':qrDetected?'QR detected but not used as proof':'No QR evidence (optional)');
      result.checks.push('Skill-level decision deferred to hiring company');
      result.debug={
        mode:'credential-screening-debug',
        model:AIROUTER_MODEL,
        engine:result.source||'unknown',
        finalStatus:result.status,
        credentialBacked:!!result.credentialBacked,
        hardGateReasons:[
          !result.nameMatch?'Profile-name match failed':null,
          !hasCredentialType?'Credential type not confidently detected':null,
          !hasIssuer?'Issuer not detected':null,
          !hasTitle?'Course/title not detected':null,
          issuerAssessment==='suspicious'?'Issuer marked suspicious':null,
          (!issuerSupported && result.status==='document-validated')?'Issuer assessment is not recognized/appears-legitimate':null
        ].filter(Boolean),
        checks:debugChecks
      };
      result.sha256=crypto.createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
      result.privacy=result.privacy || {sanitized:true,redactions:sanitized.meta.redactions||0,pages:sanitized.meta.pages||1,qrPreserved:sanitized.meta.qrDecoded||[]};
      return json(res,200,{ok:true,result,privacySafe:true});
    }
    if (req.method === 'POST' && url.pathname === '/api/extract-skills') {
      const body=await readBody(req); const text=String(body.text||'').toLowerCase();
      const candidates=['Python','JavaScript','React','Node.js','HTML','CSS','Java','C++','C','C#','SQL','Git','Linux','Docker','Pandas','NumPy','Machine Learning','Artificial Intelligence','Cybersecurity','Networking','REST APIs','Excel','Data Analysis'];
      const found=candidates.filter(s=>{const c=canonicalSkill(s); const probes=[c,s.toLowerCase(),...Array.from(aliases.entries()).filter(([,v])=>v===c).map(([k])=>k)]; return probes.some(p=>new RegExp(`(^|[^a-z0-9+#])${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9+#]|$)`,'i').test(text));});
      return json(res,200,{skills:[...new Map(found.map(s=>[canonicalSkill(s),labelSkill(canonicalSkill(s))])).values()]});
    }
    if (req.method === 'GET') return serveStatic(req,res,url.pathname);
    json(res,404,{error:'Not found'});
  } catch (e) { console.error(e); json(res,500,{error:'Something went wrong'}); }
});
server.listen(PORT,()=>console.log(`\nIruka Sage running at http://localhost:${PORT}\n`));
