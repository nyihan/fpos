// -----------------------------
// FIX: Icon Preview Updater
// -----------------------------
function updateIconPreview() {
  const preview = document.getElementById('iconPreview');
  if (!preview) return; // no preview element in this page

  const theme = (SETTINGS && SETTINGS.theme) ? SETTINGS.theme : 'green';

  // If hosted on GitHub Pages: change to '/fpos/assets/icons/...'
  // If hosted locally: './assets/icons/...'
  preview.src = `./assets/icons/${theme}-192.png`;
}

/* =====================================================================
   SMART POS - app.js (Full)
   - Settings (localStorage)
   - Theme manager
   - Item loading (from Apps Script backend)
   - Scanner (html5-qrcode)
   - Cart engine, checkout, receipt save jpg
   - Drag-sort for Items management
   - PWA update hook
   ===================================================================== */

/* -------------------------
   Global state
---------------------------*/
let ITEMS = [];          // Array of item objects
let CART = {};           // Cart map id -> {id,name,price,qty}
let SETTINGS = {
  theme: 'green',
  sound: true,
  vibration: true,
  autoScan: true,
  shopName: 'Smart POS',
  shopPhone: '',
  shopThanks: 'Thank you!'
};

/* -------------------------
   Helpers
---------------------------*/
function getApiBase() {
  // read from localStorage key (Settings stores API URL)
  const v = localStorage.getItem('smartpos_api') || '';
  return v.trim();
}

function money(n){
  return "Ks " + Number(n||0).toLocaleString();
}

function showToast(msg, time=1600){
  const t = document.getElementById('toast');
  if(!t) return;
  t.innerText = msg;
  t.classList.add('show');
  t.classList.remove('hidden');
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.classList.add('hidden'),220); }, time);
}

/* -------------------------
   Settings Persistence
---------------------------*/
function loadSettings(){
  try {
    const raw = localStorage.getItem('smartpos_settings');
    if(raw) SETTINGS = Object.assign(SETTINGS, JSON.parse(raw));
  } catch(e){}
  applyTheme(SETTINGS.theme);
  applyBusinessInfoToReceipt();
}

function saveSettings(){
  localStorage.setItem('smartpos_settings', JSON.stringify(SETTINGS));
}

/* -------------------------
   Theme Manager
---------------------------*/
function applyTheme(name){
  const root = document.documentElement;
  root.classList.remove('blue-theme','orange-theme','black-theme');
  SETTINGS.theme = name;
  if(name === 'blue') root.classList.add('blue-theme');
  if(name === 'orange') root.classList.add('orange-theme');
  if(name === 'black') root.classList.add('black-theme');
  saveSettings();
  updateIconPreview();
}

/* -------------------------
   Business info to receipt
---------------------------*/
function applyBusinessInfoToReceipt(){
  const elName = document.getElementById('receiptShopName');
  const elPhone = document.getElementById('receiptPhone');
  const elThanks = document.getElementById('receiptThanks');
  if(elName) elName.innerText = SETTINGS.shopName || 'Smart POS';
  if(elPhone) elPhone.innerText = SETTINGS.shopPhone || '';
  if(elThanks) elThanks.innerText = SETTINGS.shopThanks || 'Thank you!';
}

/* -------------------------
   Settings bottom sheet
---------------------------*/
function initSettingsSheet(){
  const sheet = document.getElementById('settingsSheet');
  const backdrop = document.getElementById('settingsSheetBackdrop');

  function open(){
    sheet.classList.add('visible');
    backdrop.classList.add('visible');
    backdrop.style.display = 'block';

    // populate fields
    document.getElementById('shopNameInput').value = SETTINGS.shopName || '';
    document.getElementById('shopPhoneInput').value = SETTINGS.shopPhone || '';
    document.getElementById('shopThanksInput').value = SETTINGS.shopThanks || '';
    document.getElementById('toggleSound').checked = !!SETTINGS.sound;
    document.getElementById('toggleVibration').checked = !!SETTINGS.vibration;
    document.getElementById('toggleAutoScan').checked = !!SETTINGS.autoScan;

    // API link UI
    setApiLinkInput();

    updateIconPreview();
  }
  function close(){
    sheet.classList.remove('visible');
    backdrop.classList.remove('visible');
    backdrop.style.display = 'none';
  }

  document.getElementById('openSettingsBtn').onclick = open;
  document.getElementById('closeSettingsSheet').onclick = close;
  backdrop.onclick = close;

  // inputs change binding
  document.getElementById('shopNameInput').oninput = e=>{ SETTINGS.shopName = e.target.value; applyBusinessInfoToReceipt(); saveSettings(); };
  document.getElementById('shopPhoneInput').oninput = e=>{ SETTINGS.shopPhone = e.target.value; applyBusinessInfoToReceipt(); saveSettings(); };
  document.getElementById('shopThanksInput').oninput = e=>{ SETTINGS.shopThanks = e.target.value; applyBusinessInfoToReceipt(); saveSettings(); };

  document.getElementById('toggleSound').onchange = e=>{ SETTINGS.sound = e.target.checked; saveSettings(); };
  document.getElementById('toggleVibration').onchange = e=>{ SETTINGS.vibration = e.target.checked; saveSettings(); };
  document.getElementById('toggleAutoScan').onchange = e=>{ SETTINGS.autoScan = e.target.checked; saveSettings(); };

  // theme tiles
  document.querySelectorAll('.theme-tile').forEach(tile=>{
    tile.onclick = ()=>{
      const t = tile.dataset.theme;
      applyTheme(t);
      showToast('Theme set: '+t);
    };
  });

  // icon preview apply
  document.getElementById('applyIconUpdate').onclick = ()=>{
    showToast('Updating app icon cache...');
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(regs=>{
        for(const r of regs) r.update();
      });
    }
  };

  // API link editing helpers (from index.html small helpers)
  document.getElementById('copyApiLinkBtn').onclick = ()=>{
    const v = document.getElementById('apiLinkInput').value || location.href;
    copyToClipboard(v);
  };
  document.getElementById('copyPageUrlBtn').onclick = ()=> copyToClipboard(location.href);
  document.getElementById('openShareBtn').onclick = async ()=>{
    if(navigator.share){
      try{ await navigator.share({ title: document.title, text: 'Smart POS', url: location.href }); showToast('Shared'); } catch(e){ showToast('Share cancelled'); }
    } else copyToClipboard(location.href);
  };

  document.getElementById('editApiBtn').onclick = ()=>{
    const row = document.getElementById('apiEditRow');
    row.style.display = row.style.display === 'flex' ? 'none' : 'flex';
    document.getElementById('apiEditInput').value = localStorage.getItem('smartpos_api') || '';
  };
  document.getElementById('saveApiBtn').onclick = ()=>{
    const v = document.getElementById('apiEditInput').value.trim();
    if(!v){ showToast('API URL empty'); return; }
    localStorage.setItem('smartpos_api', v);
    setApiLinkInput();
    showToast('API saved');
    // reload items automatically
    loadItems();
  };

  // initial set
  setApiLinkInput();
}

/* -------------------------
   Copy helpers used in settings
---------------------------*/
function setApiLinkInput(){
  const input = document.getElementById('apiLinkInput');
  if(!input) return;
  input.value = getApiBase() || '';
}

async function copyToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('Copied to clipboard');
    return true;
  } catch(e){
    console.error('copy failed', e);
    showToast('Copy failed');
    return false;
  }
}

/* -------------------------
   Items rendering & loading
---------------------------*/
function renderHomeItems(){
  const list = document.getElementById('itemList');
  if(!list) return;
  list.innerHTML = '';
  const searchText = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const category = document.getElementById('categoryFilter')?.value || '';

  ITEMS.forEach(it=>{
    if(searchText && !it.name.toLowerCase().includes(searchText)) return;
    if(category && category !== it.category) return;

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-meta">
        <div class="item-name">${escapeHtml(it.name || '')}</div>
        <div class="item-price">${money(it.price)}</div>
      </div>
      <button class="item-add-btn" data-id="${it.id}">＋</button>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll('.item-add-btn').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.id;
      const it = ITEMS.find(x=>x.id==id);
      if(!it) { showToast('Item not found'); return; }
      addToCart(it.id,it.name,it.price);
    };
  });
}

function populateCategoryFilter(){
  const sel = document.getElementById('categoryFilter');
  if(!sel) return;
  sel.innerHTML = '<option value="">All</option>';
  const cats = [...new Set(ITEMS.map(i=>i.category).filter(Boolean))];
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.innerText = c;
    sel.appendChild(o);
  });
}

/* -------------------------
   Load items from backend
---------------------------*/
async function loadItems(){
  const api = getApiBase();
  if(!api){
    showToast('API not set. Open Settings to set Apps Script URL.');
    ITEMS = [];
    renderHomeItems();
    populateCategoryFilter();
    return;
  }
  try {
    const url = api + '?action=getItems';
    const res = await fetch(url);
    const data = await res.json();
    ITEMS = data.items || [];
    populateCategoryFilter();
    renderHomeItems();
    initSortable(); // refresh management list
  } catch(e){
    console.error('loadItems error', e);
    showToast('Failed loading items');
  }
}

/* -------------------------
   Search binding
---------------------------*/
function initSearch(){
  const sb = document.getElementById('searchBox');
  if(sb) sb.oninput = ()=> renderHomeItems();
  const cf = document.getElementById('categoryFilter');
  if(cf) cf.onchange = ()=> renderHomeItems();
}

/* -------------------------
   Cart: add / render / update
---------------------------*/
function addToCart(id,name,price){
  if(!CART[id]) CART[id] = { id, name, price: Number(price||0), qty: 1 };
  else CART[id].qty++;
  renderCart();
  updateHeaderTotal();
  playBeepSuccess();
}

function renderCart(){
  const wrap = document.getElementById('cartItems');
  if(!wrap) return;
  wrap.innerHTML = '';
  let totalItems = 0;
  Object.values(CART).forEach(it=>{
    totalItems += it.qty;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-left">
        <div><strong>${escapeHtml(it.name)}</strong></div>
        <div>${money(it.price)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" data-id="${it.id}" data-act="minus">-</button>
        <span>${it.qty}</span>
        <button class="qty-btn" data-id="${it.id}" data-act="plus">+</button>
      </div>
    `;
    wrap.appendChild(row);
  });

  document.getElementById('cartCount').innerText = totalItems + ' items';

  document.querySelectorAll('.qty-btn').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.id; const act = b.dataset.act;
      if(!CART[id]) return;
      if(act==='plus') CART[id].qty++;
      if(act==='minus') CART[id].qty--;
      if(CART[id].qty <= 0) delete CART[id];
      renderCart();
      updateHeaderTotal();
    };
  });

  updateHeaderTotal();
}

function updateHeaderTotal(){
  const total = Object.values(CART).reduce((t,i)=> t + (i.price * i.qty), 0);
  const h = document.getElementById('headerTotal');
  const c = document.getElementById('cartTotalDisplay');
  if(h) h.innerText = money(total);
  if(c) c.innerText = money(total);
}

/* -------------------------
   Beep + vibration
---------------------------*/
function playBeepSuccess(){
  if(SETTINGS.sound){
    const a = document.getElementById('beepAudio');
    try{ a.currentTime = 0; a.play(); }catch(e){}
  }
  if(SETTINGS.vibration && navigator.vibrate) navigator.vibrate(60);
}
function playBeepError(){
  if(SETTINGS.sound){
    const a = document.getElementById('errorAudio');
    try{ a.currentTime = 0; a.play(); }catch(e){}
  }
  if(SETTINGS.vibration && navigator.vibrate) navigator.vibrate([60,40,60]);
}

/* -------------------------
   Scanner (html5-qrcode)
---------------------------*/
let html5Scanner = null;
let scannerRunning = false;

function openScannerModal(){
  const m = document.getElementById('scannerModal');
  if(m) m.classList.remove('hidden');
  if(!html5Scanner) html5Scanner = new Html5Qrcode("qrReader");
  const constraints = { facingMode: "environment" };
  html5Scanner.start(constraints, { fps: 10, qrbox: 240 },
    decodedText => { onScanSuccess(decodedText); },
    errorMsg => { /* ignore minor failures */ }
  ).then(()=> scannerRunning = true).catch(err=>{
    console.warn('Scanner start failed', err);
    showToast('Scanner start failed');
  });
}

function closeScannerModal(){
  const m = document.getElementById('scannerModal');
  if(m) m.classList.add('hidden');
  if(html5Scanner && scannerRunning){
    html5Scanner.stop().then(()=> scannerRunning = false).catch(()=>{ scannerRunning = false; });
  }
}

function pauseScan(){ if(html5Scanner && scannerRunning) { html5Scanner.pause(); scannerRunning=false; } }
function resumeScan(){ if(html5Scanner && !scannerRunning) { html5Scanner.resume(); scannerRunning=true; } }

async function onScanSuccess(decoded){
  playBeepSuccess();
  logScan(decoded);
  // find matching item by SKU
  const found = ITEMS.find(i => (i.sku && String(i.sku) === String(decoded)));
  if(found){ addToCart(found.id, found.name, found.price); return; }
  // if not found open quick add modal prefilled
  openQuickAdd(decoded);
}

/* -------------------------
   Log scan to backend
---------------------------*/
async function logScan(code){
  const api = getApiBase();
  if(!api) return;
  try{
    await fetch(api, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action:'logScan', barcode: code, datetime: new Date().toISOString() })
    });
  }catch(e){}
}

/* -------------------------
   Quick Add
---------------------------*/
function openQuickAdd(barcode=''){
  const m = document.getElementById('quickAddModal'); if(m) m.classList.remove('hidden');
  document.getElementById('quickSku').value = barcode || '';
}
function closeQuickAdd(){ const m=document.getElementById('quickAddModal'); if(m) m.classList.add('hidden'); }

async function quickAddSave(){
  const name = document.getElementById('quickName').value.trim();
  const price = Number(document.getElementById('quickPrice').value || 0);
  const sku = document.getElementById('quickSku').value.trim();
  const cat = document.getElementById('quickCategory').value.trim();
  if(!name){ showToast('Item name required'); return; }
  const api = getApiBase();
  if(!api){ showToast('API not set'); return; }
  try{
    const res = await fetch(api, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'addItem', name, price, sku, category: cat }) });
    const data = await res.json();
    const newItem = data.item;
    if(newItem){
      ITEMS.push(newItem);
      renderHomeItems();
      addToCart(newItem.id,newItem.name,newItem.price);
    }
  }catch(e){ showToast('Add item failed'); console.error(e); }
  closeQuickAdd();
}

/* -------------------------
   Checkout -> createInvoice
---------------------------*/
async function checkout(){
  if(Object.keys(CART).length === 0){ showToast('Cart empty'); return; }
  const itemsSend = Object.values(CART).map(i=>({ item_id:i.id, name:i.name, qty:i.qty, price_each:i.price }));
  const api = getApiBase();
  if(!api){ showToast('API not set'); return; }
  try{
    const res = await fetch(api, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'createInvoice', cashier: 'SmartPOS', items: itemsSend }) });
    const data = await res.json();
    if(data && data.status === 'success'){
      openReceipt(data.invoice.invoice_id);
      CART = {};
      renderCart();
    } else showToast('Checkout failed');
  }catch(e){ showToast('Checkout error'); console.error(e); }
}

/* -------------------------
   Receipt view / save jpg
---------------------------*/
async function openReceipt(id){
  const m = document.getElementById('receiptModal'); if(m) m.classList.remove('hidden');
  const api = getApiBase();
  if(!api) return;
  try{
    const res = await fetch(api + '?action=getInvoice&invoice_id=' + encodeURIComponent(id));
    const data = await res.json();
    const inv = data.invoice;
    const items = data.items || [];
    document.getElementById('receiptInvoiceId').innerText = inv.invoice_id;
    document.getElementById('receiptDate').innerText = inv.created_at;
    document.getElementById('receiptTotal').innerText = money(inv.total);
    const wrap = document.getElementById('receiptItems'); wrap.innerHTML = '';
    items.forEach(i=>{
      const div = document.createElement('div');
      div.innerHTML = `<span>${escapeHtml(i.name)} x${i.qty}</span><span>${money(i.subtotal || (i.price_each * i.qty))}</span>`;
      wrap.appendChild(div);
    });
  }catch(e){ console.error(e); showToast('Receipt load failed'); }
}

function saveReceiptJpg(){
  const box = document.querySelector('.receipt-panel');
  if(!box) return;
  html2canvas(box, { scale: 2 }).then(canvas=>{
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.download = 'receipt.jpg';
    a.click();
  });
}

/* -------------------------
   Sortable management
---------------------------*/
function initSortable(){
  const container = document.getElementById('sortableItems');
  if(!container) return;
  container.innerHTML = '';
  ITEMS.forEach(i=>{
    const row = document.createElement('div');
    row.className = 'edit-row';
    row.dataset.id = i.id;
    row.innerHTML = `<div><strong>${escapeHtml(i.name)}</strong><br><span>${money(i.price)}</span></div>
      <div class="row-controls"><button data-act="up" data-id="${i.id}">↑</button><button data-act="down" data-id="${i.id}">↓</button></div>`;
    container.appendChild(row);
  });
  new Sortable(container, { animation:150 });
  container.querySelectorAll('button').forEach(btn=>{
    btn.onclick = ()=> {
      const act = btn.dataset.act; const id = btn.dataset.id;
      moveItem(id, act === 'up');
    };
  });
}

function moveItem(id,isUp){
  const idx = ITEMS.findIndex(i=>i.id==id);
  if(idx < 0) return;
  if(isUp && idx>0) [ITEMS[idx-1], ITEMS[idx]] = [ITEMS[idx], ITEMS[idx-1]];
  if(!isUp && idx < ITEMS.length-1) [ITEMS[idx], ITEMS[idx+1]] = [ITEMS[idx+1], ITEMS[idx]];
  initSortable();
}

async function saveOrder(){
  const api = getApiBase();
  if(!api){ showToast('API not set'); return; }
  const order = ITEMS.map(i=>i.id);
  try{
    await fetch(api, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'saveOrder', order }) });
    showToast('Order saved');
  }catch(e){ showToast('Save failed'); console.error(e); }
}

/* -------------------------
   Utilities
---------------------------*/
function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

/* -------------------------
   PWA update handler
---------------------------*/
document.addEventListener('swUpdated', ()=> {
  showToast('New version available — reload to update');
});

/* -------------------------
   Init & event wiring
---------------------------*/
function initApp(){
  loadSettings();
  initSettingsSheet();
  initSearch();

  // basic nav
  document.querySelectorAll('#bottomNav .nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.dataset.tab;
      document.querySelectorAll('#bottomNav .nav-btn').forEach(n=>n.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      const el = document.getElementById('tab-'+target);
      if(el) el.classList.add('active');
      if(target === 'items') initSortable();
    });
  });

  // button bindings
  document.getElementById('scanBtn').onclick = openScannerModal;
  document.getElementById('closeScannerBtn').onclick = closeScannerModal;
  document.getElementById('pauseScanBtn').onclick = pauseScan;
  document.getElementById('resumeScanBtn').onclick = resumeScan;
  document.getElementById('checkoutBtn').onclick = checkout;
  document.getElementById('saveReceiptJpg').onclick = saveReceiptJpg;
  document.getElementById('closeReceiptBtn').onclick = ()=> document.getElementById('receiptModal').classList.add('hidden');
  document.getElementById('quickAddFloating').onclick = ()=> openQuickAdd('');
  document.getElementById('quickAddSave').onclick = quickAddSave;
  document.getElementById('closeQuickAdd').onclick = closeQuickAdd;
  document.getElementById('saveOrderBtn').onclick = saveOrder;
  document.getElementById('addItemBtn').onclick = ()=> openQuickAdd('');

  // init copy / api UI
  setApiLinkInput();

  // load items
  loadItems();

  // initial render
  renderCart();
}

document.addEventListener('DOMContentLoaded', initApp);

/* EOF */
