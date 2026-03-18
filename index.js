let isDark = DB_theme_get();
function DB_theme_get(){ return localStorage.getItem('ff_theme')==='dark'; }
function applyTheme(dark){
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = dark ? 'â˜€ï¸' : 'ðŸŒ™';
  const label = dark ? 'Light' : 'Dark';
  const ti = document.getElementById('topThemeIcon');
  const ai = document.getElementById('authThemeIcon');
  const al = document.getElementById('authThemeLabel');
  if(ti) ti.textContent = icon;
  if(ai) ai.textContent = icon;
  if(al) al.textContent = label;
}
  document.addEventListener("contextmenu", function(e) {
  e.preventDefault();
});

function toggleTheme(){
  isDark = !isDark;
  localStorage.setItem('ff_theme', isDark ? 'dark' : 'light');
  applyTheme(isDark);
}
applyTheme(isDark);

const DB = {
  get(k,d=null){ const v=localStorage.getItem('ff_'+k); return v?JSON.parse(v):d; },
  set(k,v){ localStorage.setItem('ff_'+k,JSON.stringify(v)); },
  del(k){ localStorage.removeItem('ff_'+k); }
};

let users = DB.get('users', {});
let sessions = DB.get('sessions', {});
let currentUser = DB.get('currentUser', null);
const ADMIN_CREDS = { username:'admin', password:'admin123' };
const ADMIN_SESSION_KEY = 'ff_admin_authenticated';

function switchTab(t) {
  document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',i===(t==='login'?0:1)));
  document.getElementById('loginForm').classList.toggle('active', t==='login');
  document.getElementById('registerForm').classList.toggle('active', t==='register');
}
function showErr(id,msg){const e=document.getElementById(id);e.textContent=msg;e.classList.add('show');}
function clearErr(id){document.getElementById(id).classList.remove('show');}
function openAdminAuth(){
  clearErr('adminError');
  document.getElementById('adminAuthScreen').classList.add('active');
  document.getElementById('adminUser').focus();
}
function closeAdminAuth(){
  document.getElementById('adminAuthScreen').classList.remove('active');
  document.getElementById('adminUser').value='';
  document.getElementById('adminPass').value='';
  clearErr('adminError');
}
function handleAdminLogin(){
  clearErr('adminError');
  const u=document.getElementById('adminUser').value.trim();
  const p=document.getElementById('adminPass').value;
  if(!u||!p){showErr('adminError','Please fill all fields.');return;}
  if(u!==ADMIN_CREDS.username||p!==ADMIN_CREDS.password){
    showErr('adminError','Invalid admin credentials.');
    document.getElementById('adminPass').value='';
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY,'true');
  window.location.href='admin.html';
}

function handleLogin(){
  clearErr('loginError');
  const u=document.getElementById('loginUser').value.trim();
  const p=document.getElementById('loginPass').value;
  if(!u||!p){showErr('loginError','Please fill all fields.');return;}
  if(!users[u]){showErr('loginError','User not found.');return;}
  if(users[u].pass!==btoa(p)){showErr('loginError','Incorrect password.');return;}
  loginAs(u);
}
function handleRegister(){
  clearErr('registerError');
  const u=document.getElementById('regUser').value.trim();
  const e=document.getElementById('regEmail').value.trim();
  const p=document.getElementById('regPass').value;
  const p2=document.getElementById('regPass2').value;
  if(!u||!e||!p||!p2){showErr('registerError','Please fill all fields.');return;}
  if(p!==p2){showErr('registerError','Passwords do not match.');return;}
  if(p.length<6){showErr('registerError','Password must be 6+ characters.');return;}
  if(users[u]){showErr('registerError','Username already taken.');return;}
  users[u]={email:e,pass:btoa(p),joined:new Date().toISOString()};
  sessions[u]=[];
  DB.set('users',users);DB.set('sessions',sessions);
  loginAs(u);
}
function loginAs(u){
  currentUser=u; DB.set('currentUser',u);
  if(!sessions[u])sessions[u]=[];
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  document.getElementById('topUser').textContent=u;
  document.getElementById('dashGreeting').textContent=u;
  renderAll();
  goPage('dashboard');
}
function handleLogout(){
  currentUser=null; DB.del('currentUser');
  clearTimer();
  document.getElementById('authScreen').classList.add('active');
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
  goPage('dashboard');
}

function goPage(name){
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pages=['dashboard','timer','history','streaks','chat'];
  document.querySelectorAll('.nav-tab')[pages.indexOf(name)]?.classList.add('active');
  document.getElementById(name+'Page').classList.add('active');
  if(name==='dashboard')renderDash();
  if(name==='history')renderHistory();
  if(name==='streaks')renderStreaks();
  if(name==='timer')renderTodayCount();
}

let tInterval=null, tSec=0, tTotal=0, tRunning=false, tDur=25;

function pickDur(m,el){
  if(tRunning)return;
  tDur=m; tSec=m*60; tTotal=m*60;
  document.querySelectorAll('.dur-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  updateDisplay(); setRing(1);
}
function startTimer(){
  if(tRunning)return;
  tRunning=true; tSec=tDur*60; tTotal=tSec;
  document.getElementById('startBtn').style.display='none';
  document.getElementById('stopBtn').style.display='';
  document.getElementById('durRow').style.opacity='.45';
  document.getElementById('ringPhase').textContent='focusing';
  setStatusPill('running');
  tInterval=setInterval(()=>{
    tSec--;
    updateDisplay();
    setRing(tSec/tTotal);
    if(tSec<=0) completeTimer();
  },1000);
}
function stopTimer(){
  clearInterval(tInterval); tRunning=false;
  const elapsed=Math.max(1,Math.floor((tTotal-tSec)/60));
  logSess(elapsed,'interrupted');
  resetTimerUI();
  showToast('Session interrupted. Keep at it! ðŸ’ª','danger');
}
function completeTimer(){
  clearInterval(tInterval); tRunning=false;
  logSess(tDur,'completed');
  resetTimerUI();
  showToast('Session complete! Great work! ðŸŽ‰','success');
}
function clearTimer(){
  clearInterval(tInterval); tRunning=false;
  tSec=tDur*60; tTotal=tSec; resetTimerUI();
}
function resetTimerUI(){
  tSec=tDur*60; tTotal=tSec;
  document.getElementById('startBtn').style.display='';
  document.getElementById('stopBtn').style.display='none';
  document.getElementById('durRow').style.opacity='1';
  document.getElementById('ringPhase').textContent='ready';
  setStatusPill('idle');
  updateDisplay(); setRing(1); renderTodayCount();
}
function updateDisplay(){
  const m=Math.floor(tSec/60).toString().padStart(2,'0');
  const s=(tSec%60).toString().padStart(2,'0');
  document.getElementById('ringTime').textContent=`${m}:${s}`;
}
function setRing(frac){
  const c=2*Math.PI*85;
  document.getElementById('ringFg').style.strokeDashoffset=c*(1-frac);
}
function setStatusPill(s){
  const el=document.getElementById('sessStatus');
  const map={running:'pill-running',idle:'pill-idle',completed:'pill-completed',interrupted:'pill-interrupted'};
  const labels={running:'RUNNING',idle:'IDLE',completed:'COMPLETED',interrupted:'INTERRUPTED'};
  el.className='pill '+map[s];
  el.innerHTML=`<span class="dot"></span> ${labels[s]}`;
}
function renderTodayCount(){
  const today=new Date().toDateString();
  const n=(sessions[currentUser]||[]).filter(x=>new Date(x.date).toDateString()===today&&x.status==='completed').length;
  document.getElementById('todayCount').textContent=n;
}

function logSess(dur,status){
  const sub=document.getElementById('sessSubject').value.trim()||'Untitled Session';
  const s={id:Date.now(),subject:sub,duration:dur,status,date:new Date().toISOString(),planned:tDur};
  if(!sessions[currentUser])sessions[currentUser]=[];
  sessions[currentUser].unshift(s);
  DB.set('sessions',sessions);
}

function renderAll(){ renderDash(); renderStreaks(); }

function renderDash(){
  if(!currentUser)return;
  const s=sessions[currentUser]||[];
  const done=s.filter(x=>x.status==='completed');
  const mins=done.reduce((a,x)=>a+x.duration,0);
  const rate=s.length?Math.round(done.length/s.length*100):0;
  const streak=calcStreak();
  document.getElementById('statStreak').textContent=streak;
  document.getElementById('statTotal').textContent=s.length;
  document.getElementById('statTime').textContent=mins;
  document.getElementById('statRate').textContent=rate+'%';
  document.getElementById('statRateSub').textContent=`${done.length} of ${s.length} sessions`;
  document.getElementById('rateFill').style.width=rate+'%';
  document.getElementById('dashGreeting').textContent=currentUser;
  const el=document.getElementById('recentList');
  const rec=s.slice(0,5);
  el.innerHTML=rec.length?rec.map(sessHTML).join(''):`<div class="empty-state"><div class="empty-icon">ðŸ“‚</div><p>No sessions yet â€” start your first focus timer!</p></div>`;
}

function renderHistory(){
  if(!currentUser)return;
  const s=sessions[currentUser]||[];
  const el=document.getElementById('historyList');
  el.innerHTML=s.length?s.map(sessHTML).join(''):`<div class="empty-state"><div class="empty-icon">ðŸ“‚</div><p>No sessions recorded yet.</p></div>`;
}

function sessHTML(x){
  const d=new Date(x.date);
  const dt=d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const tm=d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  const pillClass=x.status==='completed'?'pill-completed':x.status==='interrupted'?'pill-interrupted':'pill-idle';
  return`<div class="history-item">
    <div>
      <div class="h-subject">${x.subject}</div>
      <div class="h-meta">${dt} Â· ${tm}</div>
    </div>
    <div class="h-right">
      <div class="h-dur">${x.duration}m</div>
      <div class="pill ${pillClass}"><span class="dot"></span>${x.status.toUpperCase()}</div>
    </div>
  </div>`;
}

function renderStreaks(){
  if(!currentUser)return;
  const s=sessions[currentUser]||[];
  const cur=calcStreak(), best=calcBest();
  const active=new Set(s.filter(x=>x.status==='completed').map(x=>new Date(x.date).toDateString())).size;
  document.getElementById('strkCur').textContent=cur;
  document.getElementById('strkBest').textContent=best;
  document.getElementById('strkActive').textContent=active;
  const studyDays=new Set(s.filter(x=>x.status==='completed').map(x=>new Date(x.date).toDateString()));
  const today=new Date();
  const grid=document.getElementById('streakGrid');
  const days=[]; for(let i=59;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);days.push(d);}
  grid.innerHTML=days.map(d=>{
    const ds=d.toDateString();
    const isToday=ds===today.toDateString();
    const has=studyDays.has(ds);
    return`<div class="s-day${has?' studied strong':''}${isToday?' today':''}" title="${ds}"></div>`;
  }).join('');
}

function calcStreak(){
  const s=sessions[currentUser]||[];
  const days=new Set(s.filter(x=>x.status==='completed').map(x=>new Date(x.date).toDateString()));
  let n=0;
  for(let i=0;i<365;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    if(days.has(d.toDateString()))n++;
    else if(i>0)break;
  }
  return n;
}
function calcBest(){
  const s=sessions[currentUser]||[];
  const days=[...new Set(s.filter(x=>x.status==='completed').map(x=>new Date(x.date).toDateString()))]
    .map(d=>new Date(d)).sort((a,b)=>a-b);
  let best=0,cur=0,prev=null;
  for(const d of days){
    if(prev){const diff=(d-prev)/86400000; cur=diff===1?cur+1:1;}else cur=1;
    if(cur>best)best=cur; prev=d;
  }
  return best;
}

function sendChat(){
  const inp=document.getElementById('chatInput');
  const txt=inp.value.trim();
  if(!txt)return;
  inp.value=''; inp.style.height='';
  addMsg('user',txt);
  const typing=addTyping();
  setTimeout(()=>{
    removeEl(typing);
    addMsg('bot',buildChatReply(txt));
  },450);
}
function getStats(){
  if(!currentUser)return{sessions:0,completed:0,streak:0,focus:0};
  const s=sessions[currentUser]||[];
  const done=s.filter(x=>x.status==='completed');
  return{sessions:s.length,completed:done.length,streak:calcStreak(),focus:done.reduce((a,x)=>a+x.duration,0)};
}
function buildChatReply(text){
  const msg=text.toLowerCase();
  const stats=getStats();
  if(msg.includes('streak')||msg.includes('progress')||msg.includes('stats')){
    return `You're making progress. So far you have ${stats.sessions} total sessions, ${stats.completed} completed sessions, a ${stats.streak}-day streak, and ${stats.focus} focused minutes. Keep your next study block small and clear so it's easy to continue.`;
  }
  if(msg.includes('schedule')||msg.includes('plan')||msg.includes('routine')){
    return 'Try a simple study plan: 1. Pick one subject. 2. Study for 25 minutes. 3. Rest for 5 minutes. 4. Repeat 3 times, then take a longer break. Keep your hardest task in the first block.';
  }
  if(msg.includes('motivat')||msg.includes('tired')||msg.includes('burnout')||msg.includes('lazy')){
    return 'Start smaller than you think. Tell yourself you only need to work for 5 minutes. Once you begin, momentum usually follows. If you are drained, switch to review, flashcards, or note-cleanup instead of forcing heavy work.';
  }
  if(msg.includes('exam')||msg.includes('test')||msg.includes('quiz')){
    return 'For exam prep, focus on active recall: close your notes, answer from memory, then check mistakes. Spend most of your time on weak areas, and end with a short timed practice round.';
  }
  if(msg.includes('math')||msg.includes('problem')||msg.includes('solve')){
    return 'For problem-solving subjects, use this loop: read the example, cover it, solve a similar problem on your own, then explain each step out loud. If you get stuck, go back one step instead of restarting everything.';
  }
  if(msg.includes('memor')||msg.includes('remember')||msg.includes('flashcard')){
    return 'To remember better, break the topic into small chunks, quiz yourself without looking, and review the same material again later today and tomorrow. Retrieval beats rereading.';
  }
  return 'I can help with study plans, motivation, focus, exam prep, and habit building. Tell me what subject you are studying or what part feels hard right now, and I will give you a simple next step.';
}
function addMsg(role,text){
  const c=document.getElementById('chatMsgs');
  const d=document.createElement('div');
  d.className='msg '+role;
  const html=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  d.innerHTML=`<div class="msg-av">${role==='user'?'ðŸ‘¤':'ðŸ§ '}</div><div class="msg-bub">${html}</div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function addTyping(){
  const c=document.getElementById('chatMsgs');
  const d=document.createElement('div');
  d.className='msg bot'; d.id='typing';
  d.innerHTML=`<div class="msg-av">ðŸ§ </div><div class="msg-bub"><div class="typing-wrap"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight; return d;
}
function removeEl(el){el?.parentNode?.removeChild(el);}
function chatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}}
function autoResize(t){t.style.height='';t.style.height=Math.min(t.scrollHeight,100)+'px';}

function showToast(msg,type='success'){
  const t=document.createElement('div');
  t.className='toast '+type; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s';setTimeout(()=>t.remove(),300);},2800);
}

updateDisplay(); setRing(1);
const circ=2*Math.PI*85;
document.getElementById('ringFg').style.strokeDasharray=circ;
document.getElementById('ringFg').style.strokeDashoffset=0;
setRing(1);

if(currentUser&&users[currentUser]){
  loginAs(currentUser);
}
