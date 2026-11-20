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
  const details=[`${esc(i.quantity||1)} ${esc(i.unit||'pieces')}`,i.notes?esc(i.notes):'',i.alreadyHave?'Already have':'',i.addedBy&&i.addedBy!=='You'?'Added by '+esc(i.addedBy):''].filter(Boolean).join(' · ');
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
}
// Group tab in the bottom menu (was hidden under More > Household)
const gTab=document.createElement('button');
gTab.className='nav-link';gTab.dataset.page='household';gTab.innerHTML='<span>👥</span>Group';gTab.onclick=()=>showPage('household');
const nav=document.querySelector('.bottom-nav');nav.insertBefore(gTab,nav.querySelector('[data-page="settings"]'));

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

renderAll();
})();