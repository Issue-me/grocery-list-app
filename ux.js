/* ux.js - load AFTER app.js. Replaces the list rendering; app.js sync logic is untouched. */
(()=>{
let usualEditing=false;
const list=document.querySelector('#shopping-list');
list.insertAdjacentHTML('beforebegin','<div class="progress" id="list-progress"></div>');
list.insertAdjacentHTML('afterend','<div class="total-bar" id="total-bar" hidden></div>');
document.body.insertAdjacentHTML('beforeend','<dialog class="sheet" id="item-sheet" aria-label="Item options"></dialog>');
const sheet=document.querySelector('#item-sheet');
const hasPrice=i=>i.price!==''&&i.price!=null;

const row=i=>{
  const price=finalPrice(i),old=(Number(i.price)||0)*(Number(i.quantity)||1),saving=old-price;
  const priceHtml=i.alreadyHave?'At home':hasPrice(i)?money(price)+(saving>0?`<span class="old-price">${money(old)}</span>`:''):'';
  const details=[(Number(i.quantity)!==1||i.unit!=='pieces')?`${esc(i.quantity||1)} ${esc(i.unit||'pieces')}`:'',i.notes?esc(i.notes):'',i.alreadyHave?'Already have':'',i.addedBy&&i.addedBy!=='You'?'Added by '+esc(i.addedBy):''].filter(Boolean).join(' · ');
  return `<article class="g-item ${i.bought?'is-bought':''} ${i.alreadyHave?'is-already-have':''}" data-row="${i.id}">
    <input class="check-box" type="checkbox" data-toggle="${i.id}" ${i.bought?'checked':''} aria-label="Mark ${esc(i.name)} as bought">
    <div class="g-main"><div class="item-name">${esc(i.name)}</div><div class="item-details">${details}</div></div>
    <div class="item-price">${priceHtml}</div>
    <button class="more-btn" data-menu="${i.id}" aria-label="Options for ${esc(i.name)}">⋯</button></article>`;
};

window.renderHome=function(){
  const items=data.items,todo=items.filter(i=>!i.bought),done=items.filter(i=>i.bought);
  const need=items.filter(i=>!i.alreadyHave),doneN=need.filter(i=>i.bought).length;
  const t=totals();
  let html='';
  if(!items.length){
    html='<div class="empty-state">Your list is empty.<br>Type an item above, or tap one of your usual items.</div>';
  }else{
    html=CATEGORIES.map(cat=>{
      const rows=todo.filter(i=>i.category===cat);
      return rows.length?`<div class="aisle"><h3 class="aisle-title"><span>${EMOJI[cat]}</span>${cat}</h3>${rows.map(row).join('')}</div>`:'';
    }).join('');
    if(!todo.length)html=`<div class="all-done"><strong>🎉 Everything is in the trolley!</strong><button class="button primary" data-goto="budget">Save this trip</button></div>`;
    if(done.length)html+=`<div class="aisle"><h3 class="aisle-title"><span>🛒</span>In the trolley (${done.length})</h3>${done.map(row).join('')}</div>`;
  }
  list.innerHTML=html;

  document.querySelector('#list-progress').innerHTML=need.length?`<div class="progress-text"><span>${doneN} of ${need.length} in the trolley</span><span>${Math.round(doneN/need.length*100)}%</span></div><div class="progress-bar"><i style="width:${doneN/need.length*100}%"></i></div>`:'';

  const bar=document.querySelector('#total-bar'),left=(Number(data.budget)||0)-t.after;
  bar.hidden=!items.length;bar.classList.toggle('over',!!data.budget&&left<0);
  bar.innerHTML=`<div><small>Estimated total</small><strong>${money(t.after)}</strong></div><div class="left"><small>${data.budget?(left<0?'Over budget by':'Budget left'):'Items to buy'}</small><strong>${data.budget?money(Math.abs(left)):need.filter(i=>!i.bought).length}</strong></div>`;

  document.querySelector('#total-before').textContent=money(t.before);
  document.querySelector('#total-savings').textContent=money(t.saved);
  document.querySelector('#total-final').textContent=money(t.after);
  document.querySelector('#item-count').textContent=`${items.length} ${items.length===1?'item':'items'}`;
  document.querySelector('#budget-summary').textContent=data.budget?`${money(Math.max(0,data.budget-t.after))} left from your ${money(data.budget)} budget.`:'Set a budget on the Budget page to see what is left.';

  renderGroupBanner();
  // Usual items: hide ones already on the list; "Edit" shows remove buttons instead of prompt()
  const onList=new Set(todo.map(i=>i.name.toLowerCase()));
  const chips=usualEditing?data.usual:data.usual.filter(x=>!onList.has(x.toLowerCase()));
  document.querySelector('#usual-items').innerHTML=chips.length
    ?chips.map(x=>usualEditing?`<button class="usual-chip editing" data-unusual="${esc(x)}"><span>×</span>${esc(x)}</button>`:`<button class="usual-chip" data-usual="${esc(x)}"><span>+</span>${esc(x)}</button>`).join('')
    :`<span class="hint">${data.usual.length?'All your usual items are on the list ✓':'Items you add will show up here for next time.'}</span>`;
};

const um=document.querySelector('#usual-manage');
um.onclick=()=>{usualEditing=!usualEditing;um.textContent=usualEditing?'Done':'Edit';renderHome()};

function openSheet(id){
  const i=data.items.find(x=>x.id===id);if(!i)return;
  sheet.innerHTML=`<div class="sheet-in"><h3>${esc(i.name)}</h3><p>${esc(i.quantity||1)} ${esc(i.unit||'pieces')}${hasPrice(i)?' · '+money(finalPrice(i)):''}</p>
  <button class="sheet-btn" data-edit="${i.id}">✏️ Edit item</button>
  <button class="sheet-btn" data-price="${i.id}">💲 ${hasPrice(i)?'Edit price':'Add price'}</button>
  <button class="sheet-btn" data-have="${i.id}">🏠 ${i.alreadyHave?'I need to buy this':'I already have this'}</button>
  <label class="sheet-move">Move to aisle<select data-move="${i.id}" aria-label="Move ${esc(i.name)} to another aisle">${CATEGORIES.map(c=>`<option ${i.category===c?'selected':''}>${c}</option>`).join('')}</select></label>
  <button class="sheet-btn danger-text" data-delete="${i.id}">🗑 Delete from list</button>
  <button class="sheet-btn center">Close</button></div>`;
  sheet.showModal();
}
// Close the sheet on any button or backdrop tap. This runs before app.js's own handlers.
sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('button'))sheet.close()});
sheet.addEventListener('change',()=>sheet.close());

document.addEventListener('click',e=>{
  const m=e.target.closest('[data-menu]');if(m){openSheet(m.dataset.menu);return}
  const u=e.target.closest('[data-unusual]');
  if(u){data.usual=data.usual.filter(x=>x!==u.dataset.unusual);save();return}
  // Tap anywhere on a row (not a button/checkbox) to tick it
  const r=e.target.closest('.g-item');
  if(r&&!e.target.closest('input,button,select')){
    const i=data.items.find(x=>x.id===r.dataset.row);
    if(i){i.bought=!i.bought;i.updatedAt=Date.now();save()}
  }
});

/* ---------- Group / invite visibility ---------- */
document.querySelector('#page-home').insertAdjacentHTML('afterbegin','<div class="group-banner" id="group-banner"></div>');
function renderGroupBanner(){
  let html;
  if(!signedInUser)html='<div><strong>Shopping with family?</strong><span>Sign in to share this list.</span></div><button class="button primary" data-goto="household">Set up sharing</button>';
  else if(!activeHousehold)html='<div><strong>No group yet</strong><span>Create one, or join with an invite code.</span></div><button class="button primary" data-goto="household">Set up group</button>';
  else{const n=memberNames.size||1;html=`<div><strong>${esc(activeHousehold.name)}</strong><span>${n} member${n===1?'':'s'} · Invite code <code>${esc(activeHousehold.invite_code)}</code></span></div><button class="button secondary" data-copy-invite="${esc(activeHousehold.invite_code)}">Copy code</button>`}
  document.querySelector('#group-banner').innerHTML=html;
  const lg=document.querySelector('#leave-group'),sw=document.querySelector('#household-switch');
  if(lg)lg.hidden=!activeHousehold;
  if(sw)sw.hidden=!activeHousehold;
}
// Bottom menu: 5 tabs, current tab clearly highlighted
const nav=document.querySelector('.bottom-nav');
nav.innerHTML=[['home','🛒','List'],['pantry','🏠','Pantry'],['categories','🗂️','Aisles'],['household','👥','Group'],['budget','💰','Budget'],['settings','⚙️','More']]
  .map(([p,i,l])=>`<button class="nav-link" data-page="${p}"><span aria-hidden="true">${i}</span>${l}</button>`).join('');
nav.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
const TAB={home:'home',pantry:'pantry',household:'household',budget:'budget',settings:'settings',categories:'categories',privacy:'settings'};
window.showPage=name=>{
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+name));
  document.querySelector('#voice-button').hidden=name!=='home';
  nav.hidden=name==='welcome';
  nav.querySelectorAll('.nav-link').forEach(b=>{const on=b.dataset.page===TAB[name];b.classList.toggle('selected',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  localStorage.setItem('fiji-last-page',name);
  window.scrollTo(0,0);
};
showPage(document.querySelector('.page.active').id.replace('page-',''));
// Household and Budget are tabs now, so drop them from "More tools"; add Back links to sub-pages
document.querySelectorAll('.tool-links [data-goto="household"],.tool-links [data-goto="budget"],.tool-links [data-goto="categories"]').forEach(b=>b.remove());
['privacy'].forEach(p=>document.querySelector('#page-'+p+' .page-head').insertAdjacentHTML('afterbegin','<button class="text-button back-link" data-goto="settings">‹ Back</button>'));

/* ---------- Undo instead of confirm() ---------- */
let toastTimer;
document.body.insertAdjacentHTML('beforeend','<div class="toast" id="toast" hidden role="status"></div>');
function toast(msg,undo){
  const t=document.querySelector('#toast');
  t.innerHTML=`<span>${esc(msg)}</span>`+(undo?'<button type="button">Undo</button>':'');
  t.hidden=false;clearTimeout(toastTimer);
  if(undo)t.querySelector('button').onclick=()=>{undo();t.hidden=true};
  toastTimer=setTimeout(()=>{t.hidden=true},6000);
}
window.deleteListItem=function(id){
  const item=data.items.find(i=>i.id===id);if(!item)return;
  data.items=data.items.filter(i=>i.id!==id);
  document.querySelector('#item-dialog').close();save();
  toast(`Deleted ${item.name}`,()=>{data.items.push({...item,updatedAt:Date.now()});save()});
};

/* ---------- Show / hide password ---------- */
['#auth-password','#new-password','#new-password-confirm'].forEach(sel=>{
  const input=document.querySelector(sel);if(!input)return;
  const wrap=document.createElement('span');wrap.className='pw-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const btn=document.createElement('button');
  btn.type='button';btn.className='pw-toggle';btn.textContent='Show';
  btn.setAttribute('aria-label','Show password');btn.setAttribute('aria-pressed','false');
  btn.onclick=e=>{
    e.preventDefault();
    const show=input.type==='password';
    input.type=show?'text':'password';
    btn.textContent=show?'Hide':'Show';
    btn.setAttribute('aria-label',show?'Hide password':'Show password');
    btn.setAttribute('aria-pressed',String(show));
  };
  wrap.appendChild(btn);
});
// Always go back to hidden when a dialog closes
document.querySelectorAll('#auth-dialog,#password-reset-dialog').forEach(d=>d.addEventListener('close',()=>{
  d.querySelectorAll('.pw-wrap input').forEach(i=>{i.type='password'});
  d.querySelectorAll('.pw-toggle').forEach(b=>{b.textContent='Show';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Show password')});
}));

/* ---------- Simpler list screen ---------- */
{
  const acts=document.createElement('div');acts.className='list-actions';
  const rep=document.querySelector('#repeat-button'),sh=document.querySelector('#share-button'),clr=document.querySelector('#clear-bought');
  rep.textContent='↻ Repeat';sh.textContent='↗ Share';clr.textContent='Clear bought';
  acts.append(rep,sh,clr);document.querySelector('.list-heading').append(acts);
  document.querySelector('.action-row')?.remove();
  document.querySelector('.estimate-note')?.remove();
  document.querySelector('#open-add-item').textContent='Add with price or notes';
  const q=document.querySelector('#quick-name');q.setAttribute('enterkeyhint','done');q.setAttribute('autocapitalize','sentences');
  document.querySelector('#quick-form').addEventListener('submit',()=>setTimeout(()=>q.focus(),0)); // keep typing items
}
// Tap the total bar for the full breakdown
document.querySelector('#total-bar').onclick=()=>{
  const t=totals();
  sheet.innerHTML=`<div class="sheet-in"><h3>Trip total</h3><p>Prices are estimates and may change.</p>
  <div class="sheet-row"><span>Before discounts</span><strong>${money(t.before)}</strong></div>
  <div class="sheet-row"><span>You save</span><strong>${money(t.saved)}</strong></div>
  <div class="sheet-row big"><span>Estimated total</span><strong>${money(t.after)}</strong></div>
  <div class="sheet-row"><span>Budget</span><strong>${data.budget?money(data.budget):'Not set'}</strong></div>
  <button class="sheet-btn" data-goto="budget">💰 ${data.budget?'Change budget':'Set a budget'}</button>
  <button class="sheet-btn center">Close</button></div>`;
  sheet.showModal();
};

/* ---------- Leave a group ---------- */
const lg=document.createElement('button');
lg.className='button danger full';lg.id='leave-group';lg.textContent='Leave this group';lg.hidden=true;
document.querySelector('#current-households').insertAdjacentElement('afterend',lg);
lg.onclick=async()=>{
  if(!activeHousehold||!signedInUser)return;
  const h=activeHousehold,uid=signedInUser.id;
  if(!confirm(`Leave "${h.name}"? You will lose access to its shared list. If you own it, ownership passes to another member (or the group is deleted if you are the last one).`))return;
  lg.disabled=true;
  const {error}=await authClient.rpc('leave_household',{p_household_id:h.id});
  lg.disabled=false;
  if(error){showMessage('Could not leave group',authErrorText(error));return}
  if(syncChannel)authClient.removeChannel(syncChannel);
  if(stateChannel)authClient.removeChannel(stateChannel);
  syncChannel=null;stateChannel=null;syncReady=false;stateReady=false;statePending=false;
  pendingChanges.clear();lastServerItems.clear();
  [`fiji-active-${uid}`,`fiji-list-${uid}-${h.id}`,`${KEY}-${uid}-${h.id}`,`fiji-sync-${uid}-${h.id}`,`fiji-server-${uid}-${h.id}`,`fiji-state-${uid}-${h.id}`].forEach(k=>localStorage.removeItem(k));
  activeHousehold=null;activeListId=null;data=blank();
  await loadHouseholds();
  showMessage('You left the group',`You are no longer in ${h.name}.`);
};

/* ---------- PIN lock (keypad + optional fingerprint) ---------- */
const LK='fiji-lock-pin',BK='fiji-lock-bio';
const lockEl=document.createElement('div');lockEl.id='lock-screen';lockEl.hidden=true;
lockEl.innerHTML=`<div class="lock-in"><button class="lock-cancel" id="lock-cancel" aria-label="Cancel" hidden>×</button>
<span class="landing-mark" aria-hidden="true">F</span><h2 id="lock-title">Enter PIN</h2><p id="lock-msg" role="alert"></p>
<div class="lock-dots" id="lock-dots"><i></i><i></i><i></i><i></i></div>
<div class="lock-pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-k="${n}">${n}</button>`).join('')}<span></span><button type="button" data-k="0">0</button><button type="button" class="ghost" data-k="back" aria-label="Delete">⌫</button></div>
<button type="button" class="button secondary" id="lock-bio" hidden>☝ Use fingerprint</button>
<button type="button" class="text-button" id="lock-forgot" hidden>Forgot PIN?</button></div>`;
document.body.appendChild(lockEl);
let buf='',handler=null,fails=0,until=0,hiddenAt=0;
const dots=()=>lockEl.querySelectorAll('#lock-dots i').forEach((d,i)=>d.classList.toggle('on',i<buf.length));
function askPin(title,opt,cb){
  buf='';handler=cb;dots();
  lockEl.querySelector('#lock-title').textContent=title;
  lockEl.querySelector('#lock-msg').textContent=opt.msg||'';
  lockEl.querySelector('#lock-cancel').hidden=!opt.cancel;
  lockEl.querySelector('#lock-bio').hidden=!opt.bio;
  lockEl.querySelector('#lock-forgot').hidden=!opt.forgot;
  lockEl.hidden=false;document.documentElement.classList.add('locked');
}
const hideLock=()=>{lockEl.hidden=true;buf='';handler=null;document.documentElement.classList.remove('locked')};
function wrong(msg){
  lockEl.querySelector('#lock-msg').textContent=msg;
  const d=lockEl.querySelector('#lock-dots');d.classList.add('shake');setTimeout(()=>d.classList.remove('shake'),400);
  buf='';dots();navigator.vibrate?.(120);
}
lockEl.addEventListener('click',e=>{
  const k=e.target.closest('[data-k]')?.dataset.k;if(!k||!handler)return;
  if(k==='back'){buf=buf.slice(0,-1);dots();return}
  if(buf.length>=4)return;
  buf+=k;dots();
  if(buf.length===4){const p=buf,h=handler;setTimeout(()=>h(p),120)}
});
async function hashPin(pin,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+pin));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const getLock=()=>{try{return JSON.parse(localStorage.getItem(LK)||'null')}catch{return null}};
const checkPin=async pin=>{const l=getLock();return !!l&&await hashPin(pin,l.salt)===l.hash};
const savePin=async pin=>{const salt=crypto.randomUUID();localStorage.setItem(LK,JSON.stringify({salt,hash:await hashPin(pin,salt)}))};
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function enableBio(){
  if(!window.PublicKeyCredential){toast('Fingerprint is not available on this device');return false}
  try{
    const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Fiji Grocery List'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'grocery-user',displayName:'Grocery list'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});
    localStorage.setItem(BK,b64(c.rawId));return true;
  }catch{toast('Could not set up fingerprint');return false}
}
async function bioUnlock(){
  const id=localStorage.getItem(BK);if(!id)return;
  try{await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:unb64(id),transports:['internal']}],userVerification:'required',timeout:60000}});hideLock()}catch{}
}
function showUnlock(){
  askPin('Enter PIN',{bio:!!localStorage.getItem(BK),forgot:true},async pin=>{
    if(Date.now()<until)return wrong('Too many tries. Wait a moment.');
    if(await checkPin(pin)){fails=0;hideLock();return}
    if(++fails>=5){fails=0;until=Date.now()+30000;wrong('Too many tries. Wait 30 seconds.')}else wrong('Wrong PIN. Try again.');
  });
  if(localStorage.getItem(BK))setTimeout(bioUnlock,300);
}
function setPinFlow(msg=''){
  askPin('Choose a 4-digit PIN',{cancel:true,msg},p1=>askPin('Enter it again',{cancel:true},async p2=>{
    if(p1!==p2)return setPinFlow('PINs did not match. Try again.');
    await savePin(p1);hideLock();renderLockPanel();toast('PIN is on');
  }));
}
lockEl.querySelector('#lock-cancel').onclick=hideLock;
lockEl.querySelector('#lock-bio').onclick=bioUnlock;
lockEl.querySelector('#lock-forgot').onclick=async()=>{
  if(!confirm('Remove the PIN and sign out on this device? You can sign in again with your email and password.'))return;
  localStorage.removeItem(LK);localStorage.removeItem(BK);
  try{await authClient?.auth.signOut({scope:'local'})}catch{}
  hideLock();renderLockPanel();
};
const lp=document.createElement('div');lp.className='panel';lp.id='lock-panel';
document.querySelector('#page-settings .page-head').insertAdjacentElement('afterend',lp);
function renderLockPanel(){
  lp.hidden=!signedInUser;
  if(!signedInUser){lp.innerHTML='<h2>App lock</h2><p class="subtle">Sign in first to set up a PIN or fingerprint for this device.</p>';return}
  const on=!!getLock(),bio=!!localStorage.getItem(BK);
  lp.innerHTML=`<h2>App lock</h2><p class="subtle">${on?'A PIN is needed to open the app on this device.':'Add a PIN so only you can open your list on this phone.'}</p>`+
  (on?`<button class="button secondary full" data-lock="change">Change PIN</button><button class="button secondary full" data-lock="bio">${bio?'Turn off fingerprint':'Use fingerprint to unlock'}</button><button class="button danger full" data-lock="off">Turn off PIN</button>`
     :`<button class="button primary full" data-lock="set">Set a PIN</button>`);
}
window.renderLockPanel=renderLockPanel;
lp.addEventListener('click',async e=>{
  const a=e.target.closest('[data-lock]')?.dataset.lock;if(!a)return;
  if(a==='set')setPinFlow();
  if(a==='change')askPin('Enter current PIN',{cancel:true},async p=>{if(await checkPin(p))setPinFlow();else wrong('Wrong PIN.')});
  if(a==='off')askPin('Enter your PIN',{cancel:true},async p=>{if(await checkPin(p)){localStorage.removeItem(LK);localStorage.removeItem(BK);hideLock();renderLockPanel();toast('PIN turned off')}else wrong('Wrong PIN.')});
  if(a==='bio'){if(localStorage.getItem(BK)){localStorage.removeItem(BK);toast('Fingerprint turned off')}else if(await enableBio())toast('Fingerprint is on');renderLockPanel()}
});
// Lock again after the app has been in the background for 30 seconds
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)hiddenAt=Date.now();
  else if(getLock()&&hiddenAt&&Date.now()-hiddenAt>30000&&lockEl.hidden)showUnlock();
});
renderLockPanel();
// Keep the saved Supabase session across refreshes, but require local unlock
// before showing the app when this browser already has a signed-in session.
if(getLock()&&storedSession()?.user)showUnlock();

/* ---------- Dark mode ---------- */
const THEME_KEY='fiji-theme',mq=matchMedia('(prefers-color-scheme: dark)');
const themePref=()=>localStorage.getItem(THEME_KEY)||'auto';
const topActions=document.createElement('div');topActions.className='top-actions';
const themeBtn=document.createElement('button');themeBtn.className='icon-button';themeBtn.id='theme-button';themeBtn.type='button';
const voiceBtn=document.querySelector('#voice-button');
voiceBtn.parentNode.insertBefore(topActions,voiceBtn);topActions.append(themeBtn,voiceBtn);
function applyTheme(){
  const dark=themePref()==='dark'||(themePref()==='auto'&&mq.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#0f1713':'#126b52');
  themeBtn.textContent=dark?'☀️':'🌙';
  themeBtn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
}
const tp=document.createElement('div');tp.className='panel';tp.id='theme-panel';
document.querySelector('#page-settings .page-head').insertAdjacentElement('afterend',tp);
function renderThemePanel(){
  const p=themePref();
  tp.innerHTML='<h2>Appearance</h2><div class="seg">'+[['auto','Auto'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button type="button" class="${p===v?'on':''}" data-theme-set="${v}">${l}</button>`).join('')+'</div>';
}
function setTheme(v){localStorage.setItem(THEME_KEY,v);applyTheme();renderThemePanel()}
tp.onclick=e=>{const v=e.target.closest('[data-theme-set]')?.dataset.themeSet;if(v)setTheme(v)};
themeBtn.onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
mq.addEventListener('change',()=>{if(themePref()==='auto')applyTheme()});
applyTheme();renderThemePanel();

/* ---------- Stay signed in, and keep working offline ---------- */
// Supabase keeps the session in localStorage. If it cannot be read over the network
// (offline, or the SDK failed to load) fall back to the saved session instead of "signed out".
function storedSession(){
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
    if(/^sb-.+-auth-token$/.test(k)){const s=JSON.parse(localStorage.getItem(k)||'null');if(s?.user)return s}}}catch{}
  return null;
}
const origPaint=paintAuth;
window.paintAuth=user=>{
  const u=user||storedSession()?.user||null;
  const guest=localStorage.getItem('fiji-guest')==='1';
  if(u)localStorage.removeItem('fiji-guest');
  origPaint(u,false);                       // never send a signed-in user to the landing page
  const last=localStorage.getItem('fiji-last-page');
  if((u||guest)&&last&&last!=='welcome'&&document.querySelector('#page-'+last))showPage(last);
  else if(!u&&guest)showPage('home');
};
document.querySelector('.landing-actions [data-goto="home"]')?.addEventListener('click',()=>localStorage.setItem('fiji-guest','1'));
const origErr=authErrorText;
window.authErrorText=e=>(!navigator.onLine||/fetch|network|connection|failed to/i.test(String(e?.message||'')))
  ?"You're offline. Connect to the internet to sign in. If you were already signed in, you stay signed in."
  :origErr(e);
const origLoad=loadHouseholds;
window.loadHouseholds=()=>navigator.onLine?origLoad():Promise.resolve();
window.addEventListener('online',()=>{if(signedInUser)loadHouseholds()});
if(!authClient)window.paintAuth(null);      // Supabase SDK not available (offline first load)

renderAll();
})();
