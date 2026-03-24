// ══════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════
let accounts = {
  nequi:{name:'Nequi',color:'nequi',balance:0,transactions:[]},
  bancolombia:{name:'Bancolombia',color:'bancolombia',balance:0,transactions:[]},
  daviplata:{name:'Daviplata',color:'daviplata',balance:0,transactions:[]},
  efectivo:{name:'Efectivo',color:'efectivo',balance:0,transactions:[]}
};
let fixedExpenses=[], gastos=[], creditos=[], pendientes=[];
let isEditing=false, currentEditId=null;
let isEditingFE=false, currentEditFEId=null;
let currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let showAllTx=false;
let ordenActual=[], selPayMethod='efectivo';
let editingProdId=null, editingGastoId=null;
let cobroEsPendiente=false, cobroPendienteId=null;

const defaultProds=[
  {id:1,nombre:'Café',precio:1500,emoji:'☕'},
  {id:2,nombre:'Aromática',precio:1500,emoji:'🫖'},
  {id:3,nombre:'Agua Botella',precio:2000,emoji:'💧'},
  {id:4,nombre:'Batido',precio:9000,emoji:'🥤'},
  {id:5,nombre:'Creatina',precio:2000,emoji:'💪'},
  {id:6,nombre:'Bocadillo',precio:500,emoji:'🍬'},
];

// ══ STORAGE ══
function load(){
  try{
    const sa=localStorage.getItem('ms_accounts'); if(sa) accounts=JSON.parse(sa);
    const sf=localStorage.getItem('ms_fe'); if(sf) fixedExpenses=JSON.parse(sf);
    const sg=localStorage.getItem('ms_gastos'); if(sg) gastos=JSON.parse(sg);
    const sc=localStorage.getItem('ms_creditos'); if(sc) creditos=JSON.parse(sc);
    const sp=localStorage.getItem('ms_pendientes'); if(sp) pendientes=JSON.parse(sp);
  }catch(e){}
}
function saveAccounts(){ localStorage.setItem('ms_accounts',JSON.stringify(accounts)); }
function saveFE(){ localStorage.setItem('ms_fe',JSON.stringify(fixedExpenses)); }
function saveGastos(){ localStorage.setItem('ms_gastos',JSON.stringify(gastos)); }
function saveCreditos(){ localStorage.setItem('ms_creditos',JSON.stringify(creditos)); }
function savePendientes(){ localStorage.setItem('ms_pendientes',JSON.stringify(pendientes)); }
function getProds(){ try{ const s=localStorage.getItem('ms_prods'); return s?JSON.parse(s):defaultProds; }catch(e){return defaultProds;} }
function saveProds(p){ localStorage.setItem('ms_prods',JSON.stringify(p)); }

// ══ INIT ══
document.addEventListener('DOMContentLoaded',function(){
  load(); setTodayDate(); updateUI();
  loadTransactions(); loadAccountsTab(); loadFE(); loadProdGrid(); loadProdsManager();
  setupEvents(); setupBackupFile(); updateMonthDisplay();
  updateCajaHdr(); updateVentasList(); updatePendientesList(); updateCreditosList(); updateGastosList();
  checkReminders();
  document.getElementById('cajaDate').textContent=new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  updateClienteSuggestions();
});

// ══════════════════════════════════════════════════
// CAJA
// ══════════════════════════════════════════════════
function loadProdGrid(){
  const grid=document.getElementById('prodGrid');
  grid.innerHTML='';
  getProds().forEach(p=>{
    const b=document.createElement('div');
    b.className='prod-btn';
    b.innerHTML=`<div class="pe">${p.emoji||'☕'}</div><div class="pn">${p.nombre}</div><div class="pp">$ ${fmt(p.precio)}</div>`;
    b.onclick=()=>addToOrden(p);
    grid.appendChild(b);
  });
}

function addToOrden(p){
  const ex=ordenActual.find(i=>i.id===p.id);
  if(ex) ex.qty++; else ordenActual.push({...p,qty:1});
  renderOrden();
}

function renderOrden(){
  const c=document.getElementById('ordenItems'), t=document.getElementById('ordenTotal');
  if(!ordenActual.length){
    c.innerHTML=`<div class="empty" style="padding:18px"><i class="fas fa-coffee" style="font-size:1.6rem;color:var(--cw)"></i><p style="color:#bbb;margin-top:6px;font-size:.82rem">Selecciona productos</p></div>`;
    t.textContent='$ 0'; return;
  }
  let total=0; c.innerHTML='';
  ordenActual.forEach((it,i)=>{
    total+=it.precio*it.qty;
    const d=document.createElement('div'); d.className='oi';
    d.innerHTML=`<div style="flex:1"><div class="oi-name">${it.emoji} ${it.nombre}</div><div class="oi-price">$${fmt(it.precio)} c/u</div></div>
    <div class="qty-ctrl"><button class="qbtn qm" onclick="chgQty(${i},-1)">−</button><span class="qn">${it.qty}</span><button class="qbtn qp" onclick="chgQty(${i},1)">+</button>
    <span style="min-width:74px;text-align:right;font-weight:600;font-size:.82rem">$ ${fmt(it.precio*it.qty)}</span></div>`;
    c.appendChild(d);
  });
  t.textContent=`$ ${fmt(total)}`;
}

function chgQty(i,d){ ordenActual[i].qty+=d; if(ordenActual[i].qty<=0) ordenActual.splice(i,1); renderOrden(); }
function limpiarOrden(){ ordenActual=[]; document.getElementById('ordenCliente').value=''; renderOrden(); }

// Venta manual rápida
function ventaManualRapida(){
  const desc=document.getElementById('vmDesc').value.trim();
  const monto=parseFloat(document.getElementById('vmMonto').value);
  const cliente=document.getElementById('ordenCliente').value.trim();
  if(!desc||!monto){ notify('Ingresa descripción y monto','warning'); return; }
  
  const concepto=cliente?`[${cliente}] ${desc}`:desc;
  const tx={id:Date.now(),date:fmtDateInput(new Date()),concept:concepto,amount:monto,type:'ingreso',esventa:true,cliente:cliente||null};
  accounts['efectivo'].transactions.push(tx);
  saveAccounts(); updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
  document.getElementById('vmDesc').value=''; document.getElementById('vmMonto').value='';
  document.getElementById('ordenCliente').value='';
  notify(`✅ Venta de $${fmt(monto)} registrada`,'success');
}

function abrirCobro(esPendiente=false, pendId=null){
  cobroEsPendiente=esPendiente; cobroPendienteId=pendId;
  let total=0;
  if(esPendiente){
    const p=pendientes.find(x=>x.id===pendId);
    if(!p) return;
    total=p.total;
    document.getElementById('cobroTotal').textContent=`$ ${fmt(total)}`;
  } else {
    if(!ordenActual.length && !document.getElementById('vmDesc').value){ notify('Agrega productos o usa venta manual','warning'); return; }
    total=ordenActual.reduce((s,i)=>s+i.precio*i.qty,0);
    document.getElementById('cobroTotal').textContent=`$ ${fmt(total)}`;
  }
  document.getElementById('cobroNota').value='';
  document.querySelectorAll('.pmb').forEach(b=>b.classList.remove('sel'));
  document.querySelector('.pmb[data-cuenta="efectivo"]').classList.add('sel');
  selPayMethod='efectivo';
  document.getElementById('cobroModal').classList.add('active');
}

function selPay(btn){ document.querySelectorAll('.pmb').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); selPayMethod=btn.getAttribute('data-cuenta'); }

function confirmarCobro(){
  const nota=document.getElementById('cobroNota').value;
  let total=0, concepto='', cliente='';
  
  if(cobroEsPendiente){
    const p=pendientes.find(x=>x.id===cobroPendienteId);
    if(!p) return;
    total=p.total; concepto=p.concepto; cliente=p.cliente||'';
    pendientes=pendientes.filter(x=>x.id!==cobroPendienteId);
    savePendientes(); updatePendientesList(); updatePendBadge();
  } else {
    cliente=document.getElementById('ordenCliente').value.trim();
    concepto=ordenActual.length?ordenActual.map(i=>`${i.qty}x ${i.nombre}`).join(', '):'Venta manual';
    if(cliente) concepto=`[${cliente}] ${concepto}`;
    if(nota) concepto+=` (${nota})`;
    total=ordenActual.reduce((s,i)=>s+i.precio*i.qty,0);
    if(!total){ notify('Sin monto a cobrar','warning'); return; }
  }
  
  const tx={id:Date.now(),date:fmtDateInput(new Date()),concept:concepto,amount:total,type:'ingreso',esventa:true,cliente:cliente||null};
  accounts[selPayMethod].transactions.push(tx);
  saveAccounts(); updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
  document.getElementById('cobroModal').classList.remove('active');
  limpiarOrden();
  notify(`✅ $${fmt(total)} cobrado en ${accounts[selPayMethod].name}`,'success');
}

// Temp storage for pending order waiting for a name
let _pendingOrdenSnapshot = null;

function guardarPendiente(){
  if(!ordenActual.length){ notify('Agrega productos al pedido','warning'); return; }
  const cliente=document.getElementById('ordenCliente').value.trim();
  if(!cliente){
    // Snapshot current order and open name modal
    _pendingOrdenSnapshot=[...ordenActual];
    document.getElementById('pendNombreInput').value='';
    // Populate suggestions
    const dl2=document.getElementById('clientesSuggestions2'); dl2.innerHTML='';
    const names=new Set();
    creditos.forEach(c=>names.add(c.cliente));
    for(const k in accounts) accounts[k].transactions.forEach(tx=>{ if(tx.cliente) names.add(tx.cliente); });
    pendientes.forEach(p=>{ if(p.cliente&&p.cliente!=='Sin nombre') names.add(p.cliente); });
    names.forEach(n=>{ const o=document.createElement('option'); o.value=n; dl2.appendChild(o); });
    document.getElementById('pedirNombreModal').classList.add('active');
    setTimeout(()=>document.getElementById('pendNombreInput').focus(),200);
    return;
  }
  _guardarPendienteConCliente(cliente);
}

function confirmarGuardarPendienteConNombre(){
  const nombre=document.getElementById('pendNombreInput').value.trim();
  if(!nombre){ notify('Ingresa un nombre','warning'); return; }
  document.getElementById('pedirNombreModal').classList.remove('active');
  // Restore snapshot to ordenActual if needed
  if(_pendingOrdenSnapshot){ ordenActual=[..._pendingOrdenSnapshot]; _pendingOrdenSnapshot=null; }
  // Save as client if not already registered
  const yaExiste=creditos.some(c=>c.cliente.toLowerCase()===nombre.toLowerCase());
  if(!yaExiste){
    // Register with 0 debt just to keep in client list
    creditos.push({id:Date.now(),cliente:nombre,deuda:0,desc:'Cliente registrado al guardar pendiente',fecha:fmtDateInput(new Date()),pagos:[]});
    saveCreditos(); updateCreditosList();
  }
  _guardarPendienteConCliente(nombre);
}

function _guardarPendienteConCliente(cliente){
  const total=ordenActual.reduce((s,i)=>s+i.precio*i.qty,0);
  const concepto=ordenActual.map(i=>`${i.qty}x ${i.nombre}`).join(', ');
  const p={
    id:Date.now(),
    cliente:cliente,
    concepto, total,
    items:[...ordenActual],
    fecha:fmtDateInput(new Date()),
    hora:new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})
  };
  pendientes.push(p);
  savePendientes(); limpiarOrden(); updatePendientesList(); updatePendBadge(); updateClienteSuggestions();
  notify(`⏳ Pedido de ${p.cliente} guardado como pendiente`,'info');
  switchTab('pendientes');
}

function updateCajaHdr(){
  const today=fmtDateInput(new Date());
  let v=0, cnt=0;
  for(const k in accounts){
    accounts[k].transactions.forEach(tx=>{if(tx.date===today&&tx.amount>0&&tx.esventa){v+=tx.amount;cnt++;}});
  }
  document.getElementById('ventasHoy').textContent=`$ ${fmt(v)}`;
  document.getElementById('txHoy').textContent=cnt;
}

function updateVentasList(){
  const list=document.getElementById('ventasList');
  const today=fmtDateInput(new Date());
  let vs=[];
  for(const k in accounts){
    accounts[k].transactions.forEach(tx=>{ if(tx.date===today&&tx.esventa) vs.push({...tx,accKey:k}); });
  }
  vs.sort((a,b)=>b.id-a.id);
  if(!vs.length){ list.innerHTML=`<div class="empty"><i class="fas fa-coffee"></i><h3>Sin ventas hoy</h3></div>`; return; }
  list.innerHTML='';
  vs.forEach(v=>{
    const d=document.createElement('div'); d.className='vi';
    d.innerHTML=`
      <div style="flex:1"><div class="vi-concept">${v.concept}</div><div class="vi-meta">${accounts[v.accKey].name}</div></div>
      <div class="vi-amount positive">$ ${fmt(v.amount)}</div>
      <div class="vi-actions"><button class="btn btn-sm btn-d" onclick="eliminarTx('${v.accKey}',${v.id})"><i class="fas fa-trash"></i></button></div>`;
    list.appendChild(d);
  });
}

// ══════════════════════════════════════════════════
// PENDIENTES
// ══════════════════════════════════════════════════
function updatePendientesList(){
  const list=document.getElementById('pendientesList');
  if(!pendientes.length){
    list.innerHTML=`<div class="empty"><i class="fas fa-clock"></i><h3>Sin ventas pendientes</h3><p>Los pedidos guardados aparecerán aquí</p></div>`;
    return;
  }
  list.innerHTML='';
  pendientes.forEach(p=>{
    const d=document.createElement('div'); d.className='pending-card';
    d.innerHTML=`
      <div class="pc-hdr">
        <div>
          <div class="pc-name"><i class="fas fa-user" style="color:var(--cw);margin-right:5px"></i>${p.cliente}</div>
          <div class="pc-time">${p.fecha} ${p.hora||''}</div>
        </div>
        <div class="pc-total">$ ${fmt(p.total)}</div>
      </div>
      <div class="pc-items">${p.concepto}</div>
      <div class="pc-actions">
        <button class="btn btn-ok btn-sm" onclick="cobrarPendiente(${p.id})"><i class="fas fa-money-bill-wave"></i> Cobrar</button>
        <button class="btn btn-warn btn-sm" onclick="moverACreditoPendiente(${p.id})"><i class="fas fa-user-clock"></i> A Crédito</button>
        <button class="btn btn-d btn-sm" onclick="eliminarPendiente(${p.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function updatePendBadge(){
  const b=document.getElementById('pendBadge');
  if(pendientes.length>0){ b.textContent=pendientes.length; b.style.display='inline'; }
  else b.style.display='none';
}

function cobrarPendiente(id){ abrirCobro(true,id); }

function moverACreditoPendiente(id){
  const p=pendientes.find(x=>x.id===id);
  if(!p) return;
  const c={id:Date.now(),cliente:p.cliente,deuda:p.total,desc:p.concepto,fecha:p.fecha,pagos:[]};
  creditos.push(c);
  pendientes=pendientes.filter(x=>x.id!==id);
  saveCreditos(); savePendientes();
  updatePendientesList(); updatePendBadge(); updateCreditosList();
  notify(`💳 Pedido de ${p.cliente} movido a crédito`,'info');
}

function eliminarPendiente(id){
  if(!confirm('¿Eliminar este pendiente?')) return;
  pendientes=pendientes.filter(x=>x.id!==id);
  savePendientes(); updatePendientesList(); updatePendBadge();
  notify('Pendiente eliminado','info');
}

// ══════════════════════════════════════════════════
// CRÉDITOS
// ══════════════════════════════════════════════════
function updateCreditosList(){
  const list=document.getElementById('creditosList'), sum=document.getElementById('creditoSummary');

  // Group creditos by client name (case-insensitive)
  const groups={};
  creditos.forEach(c=>{
    const key=c.cliente.trim().toLowerCase();
    if(!groups[key]) groups[key]={nombre:c.cliente.trim(), ids:[], deudaTotal:0, pagosTotal:0, items:[], allPagos:[]};
    groups[key].ids.push(c.id);
    groups[key].items.push(c);
    groups[key].deudaTotal+=c.deuda;
    groups[key].pagosTotal+=c.pagos.reduce((s,p)=>s+p.monto,0);
    c.pagos.forEach(p=>groups[key].allPagos.push(p));
  });

  const groupList=Object.values(groups).map(g=>({...g, restante:g.deudaTotal-g.pagosTotal}));
  const totalDeuda=groupList.reduce((s,g)=>s+(g.restante>0?g.restante:0),0);
  const activosCount=groupList.filter(g=>g.restante>0).length;

  if(totalDeuda>0){
    sum.innerHTML=`<div class="credito-summary"><div style="display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-size:.75rem;opacity:.8;text-transform:uppercase;letter-spacing:.5px">Total en Crédito</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700">$ ${fmt(totalDeuda)}</div>
      <div style="font-size:.8rem;opacity:.8">${activosCount} cliente(s) con deuda</div></div>
      <i class="fas fa-exclamation-triangle" style="font-size:2rem;opacity:.4"></i>
    </div></div>`;
  } else sum.innerHTML='';

  if(!creditos.length){ list.innerHTML=`<div class="empty"><i class="fas fa-user-clock"></i><h3>Sin créditos registrados</h3><p>Los clientes fiados aparecerán aquí</p></div>`; return; }

  const sorted=groupList.sort((a,b)=>b.restante-a.restante);
  list.innerHTML='';
  sorted.forEach(g=>{
    const dr=g.restante;
    const d=document.createElement('div'); d.className='credito-card';
    if(dr<=0) d.style.borderLeftColor='var(--ok)';

    // Show all debts (items) for this client
    const itemsHtml=g.items.length>1
      ? `<div style="margin-bottom:6px;border-bottom:1px solid var(--cream);padding-bottom:6px">
          ${g.items.map(c=>{const r=deudaRestante(c);return`<div style="display:flex;justify-content:space-between;font-size:.78rem;padding:2px 0"><span style="color:#888">${c.desc||'Sin desc.'} <span style="font-size:.72rem;color:#bbb">(${c.fecha})</span></span><span style="${r>0?'color:var(--err)':'color:var(--ok)'}">$ ${fmt(c.deuda)}${r<=0?' ✅':''}</span></div>`}).join('')}
        </div>`
      : `<div style="margin-bottom:4px;font-size:.78rem;color:#888"><strong>Deuda original:</strong> $ ${fmt(g.deudaTotal)} — ${g.items[0].desc||''}</div>`;

    // Last 3 payments across all records
    const allPagosSort=[...g.allPagos].sort((a,b)=>b.fecha>a.fecha?1:-1);
    const histHtml=allPagosSort.length?allPagosSort.slice(0,3).map(p=>`<div>${p.fecha}: +$${fmt(p.monto)} (${p.cuenta||'efectivo'})</div>`).join(''):'Sin pagos aún';

    // Use first active credit id for abono actions
    const activeId=(g.items.find(c=>deudaRestante(c)>0)||g.items[0]).id;

    d.innerHTML=`
      <div class="cc-hdr">
        <div class="cc-name"><i class="fas fa-user" style="color:${dr>0?'var(--err)':'var(--ok)'};margin-right:5px"></i>${g.nombre}${g.items.length>1?` <span class="badge bi">${g.items.length} registros</span>`:''}</div>
        <div class="cc-debt" style="color:${dr>0?'var(--err)':'var(--ok)'}">${dr>0?`$ ${fmt(dr)}`:'✅ Saldado'}</div>
      </div>
      <div class="cc-history">
        ${itemsHtml}
        <div style="margin-bottom:4px;font-size:.78rem"><strong>Últimos pagos:</strong></div>
        <div style="color:#aaa;font-size:.78rem">${histHtml}</div>
      </div>
      <div class="cc-actions">
        ${dr>0?`<button class="btn btn-ok btn-sm" onclick="abrirAbono('${activeId}')"><i class="fas fa-plus"></i> Registrar Abono</button>`:'<span class="badge bs">Saldado</span>'}
        ${dr>0?`<button class="btn btn-warn btn-sm" onclick="abrirCobrarCredito('${activeId}')"><i class="fas fa-money-bill-wave"></i> Cobrar Total</button>`:''}
        ${g.ids.map(id=>`<button class="btn btn-s btn-sm" onclick="eliminarCredito('${id}')" title="Eliminar registro"><i class="fas fa-trash"></i></button>`).join('')}
      </div>`;
    list.appendChild(d);
  });
}

function deudaRestante(c){ return c.deuda-c.pagos.reduce((s,p)=>s+p.monto,0); }

function abrirNuevoCredito(){
  document.getElementById('creditoId').value='';
  document.getElementById('creditoCliente').value='';
  document.getElementById('creditoMonto').value='';
  document.getElementById('creditoDesc').value='';
  document.getElementById('creditoFecha').value=fmtDateInput(new Date());
  document.getElementById('creditoModal').classList.add('active');
}

function abrirAbono(cid){
  const c=creditos.find(x=>x.id==cid);
  if(!c) return;
  document.getElementById('abonoCreditoId').value=cid;
  document.getElementById('abonoMonto').value='';
  document.getElementById('abonoNota').value='';
  const dr=deudaRestante(c);
  document.getElementById('abonoClienteInfo').innerHTML=`<strong>${c.cliente}</strong><br><span style="color:var(--err)">Deuda restante: $ ${fmt(dr)}</span>`;
  document.getElementById('abonoModal').classList.add('active');
}

function abrirCobrarCredito(cid){
  const c=creditos.find(x=>x.id==cid);
  if(!c) return;
  abrirAbono(cid);
  setTimeout(()=>{ document.getElementById('abonoMonto').value=deudaRestante(c); },50);
}

function confirmarAbono(){
  const cid=document.getElementById('abonoCreditoId').value;
  const monto=parseFloat(document.getElementById('abonoMonto').value);
  const cuenta=document.getElementById('abonoCuenta').value;
  const nota=document.getElementById('abonoNota').value;
  if(!monto){ notify('Ingresa el monto del abono','warning'); return; }
  
  const idx=creditos.findIndex(x=>x.id==cid);
  if(idx===-1) return;
  const c=creditos[idx];
  creditos[idx].pagos.push({monto,cuenta,fecha:fmtDateInput(new Date()),nota});
  
  // Registrar ingreso en cuenta
  const tx={id:Date.now(),date:fmtDateInput(new Date()),concept:`Abono crédito - ${c.cliente}${nota?' ('+nota+')':''}`,amount:monto,type:'ingreso',esventa:false};
  accounts[cuenta].transactions.push(tx);
  saveCreditos(); saveAccounts(); updateUI(); updateCreditosList(); loadTransactions(); updateCajaHdr();
  document.getElementById('abonoModal').classList.remove('active');
  notify(`✅ Abono de $${fmt(monto)} registrado`,'success');
}

function eliminarCredito(cid){
  if(!confirm('¿Eliminar este registro de crédito?')) return;
  creditos=creditos.filter(x=>x.id!=cid);
  saveCreditos(); updateCreditosList();
  notify('Crédito eliminado','info');
}

function updateClienteSuggestions(){
  const dl=document.getElementById('clientesSuggestions'); dl.innerHTML='';
  const names=new Set();
  creditos.forEach(c=>names.add(c.cliente));
  for(const k in accounts) accounts[k].transactions.forEach(tx=>{ if(tx.cliente) names.add(tx.cliente); });
  pendientes.forEach(p=>{ if(p.cliente&&p.cliente!=='Sin nombre') names.add(p.cliente); });
  names.forEach(n=>{ const o=document.createElement('option'); o.value=n; dl.appendChild(o); });
}

// ══════════════════════════════════════════════════
// GASTOS NO FIJOS
// ══════════════════════════════════════════════════
function abrirGastoModal(g=null){
  editingGastoId=g?g.id:null;
  document.getElementById('gastoModalTitle').textContent=g?'Editar Gasto':'Nuevo Gasto';
  document.getElementById('gastoId').value=g?g.id:'';
  document.getElementById('gastoConcepto').value=g?g.concepto:'';
  document.getElementById('gastoMonto').value=g?g.monto:'';
  document.getElementById('gastoCategoria').value=g?g.categoria:'Insumos';
  document.getElementById('gastoCuenta').value=g?g.cuenta:'efectivo';
  document.getElementById('gastoFecha').value=g?g.fecha:fmtDateInput(new Date());
  document.getElementById('gastoNota').value=g?g.nota||'':'';
  document.getElementById('deleteGastoBtn').style.display=g?'inline-flex':'none';
  document.getElementById('gastoModal').classList.add('active');
}

function updateGastosList(){
  const list=document.getElementById('gastosList');
  const today=fmtDateInput(new Date());
  const thisMonth=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  
  let totalHoy=0, totalMes=0;
  gastos.forEach(g=>{
    if(g.fecha===today) totalHoy+=g.monto;
    if(g.fecha.startsWith(thisMonth)) totalMes+=g.monto;
  });
  
  document.getElementById('gastosTotalHoy').textContent=`$ ${fmt(totalHoy)}`;
  document.getElementById('gastosTotalMes').textContent=`$ ${fmt(totalMes)}`;
  document.getElementById('gastosCount').textContent=gastos.length;
  
  const sorted=[...gastos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  if(!sorted.length){ list.innerHTML=`<div class="empty"><i class="fas fa-receipt"></i><h3>Sin gastos registrados</h3><p>Usa el botón + para agregar</p></div>`; return; }
  list.innerHTML='';
  sorted.forEach(g=>{
    const d=document.createElement('div'); d.className='gasto-item';
    d.innerHTML=`
      <div class="gi-info"><div class="gi-concept">${g.concepto}</div><div class="gi-meta">${fmtDate(g.fecha)} · ${g.categoria} · ${accounts[g.cuenta]?.name||g.cuenta}${g.nota?' · '+g.nota:''}</div></div>
      <div class="gi-amount">-$ ${fmt(g.monto)}</div>
      <div class="gi-actions">
        <button class="btn btn-sm btn-s" onclick='abrirGastoModal(${JSON.stringify(g)})' ><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarGasto('${g.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function eliminarGasto(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  const g=gastos.find(x=>x.id==id);
  if(g){
    gastos=gastos.filter(x=>x.id!=id);
    // Remove tx from account
    const idx=accounts[g.cuenta]?.transactions.findIndex(t=>t.gastoId===id);
    if(idx>-1) accounts[g.cuenta].transactions.splice(idx,1);
    saveGastos(); saveAccounts(); updateUI(); updateGastosList(); loadTransactions();
  }
  notify('Gasto eliminado','info');
}

// ══════════════════════════════════════════════════
// ACCOUNTS
// ══════════════════════════════════════════════════
function updateUI(){
  let total=0;
  for(const k in accounts){
    let bal=accounts[k].transactions.reduce((s,t)=>s+t.amount,0);
    accounts[k].balance=bal; total+=bal;
    const el=document.getElementById(k+'Balance');
    if(el){ el.textContent=`$ ${fmt(bal)}`; el.className='acc-bal '+(bal>=0?'positive':'negative'); }
  }
  document.getElementById('totalGeneral').textContent=`$ ${fmt(total)}`;
}

function loadAccountsTab(){
  const list=document.getElementById('accountsList'); list.innerHTML='';
  const icons={nequi:'<i class="fas fa-mobile-alt" style="color:#7c3aed"></i>',bancolombia:'<i class="fas fa-university" style="color:#0284c7"></i>',daviplata:'<i class="fas fa-wallet" style="color:#059669"></i>',efectivo:'<i class="fas fa-money-bill-wave" style="color:#d97706"></i>'};
  const ibg={nequi:'#ede9fe',bancolombia:'#e0f2fe',daviplata:'#d1fae5',efectivo:'#fef3c7'};
  for(const k in accounts){
    const a=accounts[k]; let inc=0,exp=0;
    a.transactions.forEach(t=>{if(t.amount>0)inc+=t.amount;else exp+=Math.abs(t.amount);});
    const c=document.createElement('div'); c.className=`account-card ${a.color}`; c.style.marginBottom='11px';
    c.innerHTML=`<div class="acc-icon" style="background:${ibg[k]}">${icons[k]}</div><div class="acc-name">${a.name}</div>
    <div class="acc-bal ${a.balance>=0?'positive':'negative'}" style="font-family:'Playfair Display',serif;font-size:1.2rem">$ ${fmt(a.balance)}</div>
    <div style="margin-top:9px;font-size:.78rem;color:#888">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>Ingresos:</span><span class="positive">$ ${fmt(inc)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>Egresos:</span><span class="negative">$ ${fmt(exp)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Movim.:</span><span>${a.transactions.length}</span></div>
    </div>`;
    c.onclick=()=>openAcctDetail(k); list.appendChild(c);
  }
}

function openAcctDetail(k){
  const a=accounts[k]; let inc=0,exp=0,bal=0;
  a.transactions.forEach(t=>{bal+=t.amount;if(t.amount>0)inc+=t.amount;else exp+=Math.abs(t.amount);});
  document.getElementById('adName').textContent=a.name;
  document.getElementById('adBalance').textContent=`$ ${fmt(bal)}`;
  document.getElementById('adBalance').className='asval '+(bal>=0?'positive':'negative');
  document.getElementById('adIncome').textContent=`$ ${fmt(inc)}`;
  document.getElementById('adExpense').textContent=`$ ${fmt(exp)}`;
  document.getElementById('adCount').textContent=a.transactions.length;
  const dt=document.getElementById('adTransactions');
  const sorted=[...a.transactions].sort((x,y)=>parseDateStr(y.date)-parseDateStr(x.date));
  if(sorted.length){
    dt.innerHTML='';
    sorted.slice(0,12).forEach(tx=>{
      const d=document.createElement('div'); d.className='vi';
      d.innerHTML=`<div style="flex:1"><div class="vi-concept">${tx.concept}</div><div class="vi-meta">${fmtDate(tx.date)}</div></div>
      <div class="vi-amount ${tx.amount>=0?'positive':'negative'}">${tx.amount>=0?'+':''}$ ${fmt(tx.amount)}</div>`;
      dt.appendChild(d);
    });
  } else dt.innerHTML=`<div class="empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div>`;
  document.getElementById('acctDetailModal').classList.add('active');
}

// ══════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════
function setTodayDate(){ document.getElementById('date').value=fmtDateInput(new Date()); }

function updateMonthDisplay(){
  const ms=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('currentMonthDisplay').textContent=`${ms[currentMonth]} ${currentYear}`;
}

function loadFEForPayment(){
  const sel=document.getElementById('fixedExpenseForPayment'); sel.innerHTML='<option value="">Seleccionar gasto fijo</option>';
  const today=new Date(), cmy=`${today.getFullYear()}-${today.getMonth()+1}`;
  fixedExpenses.forEach(e=>{
    if(e.active){
      const lmy=e.lastPaid?`${new Date(e.lastPaid).getFullYear()}-${new Date(e.lastPaid).getMonth()+1}`:'';
      if(lmy!==cmy){ const o=document.createElement('option'); o.value=e.id; o.textContent=`${e.name} - $${fmt(e.amount)}`; sel.appendChild(o); }
    }
  });
}

function loadTransactions(){
  const list=document.getElementById('transactionsList'), rems=document.getElementById('fixedExpenseReminders');
  let allTx=[],mInc=0,mExp=0;
  rems.innerHTML=''; rems.style.display='none';
  const today=new Date(), cd=today.getDate(), cmy=`${today.getFullYear()}-${today.getMonth()+1}`;
  let remHtml='', hasR=false;
  fixedExpenses.forEach(e=>{
    if(e.active){
      const rd=parseInt(e.day), lmy=e.lastPaid?`${new Date(e.lastPaid).getFullYear()}-${new Date(e.lastPaid).getMonth()+1}`:'';
      if(lmy!==cmy&&cd>=rd){
        hasR=true;
        remHtml+=`<div class="rem-box"><div style="flex:1"><div style="font-weight:600;margin-bottom:2px">${e.name}</div><div style="font-size:.78rem;color:#888">Día ${e.day} — $ ${fmt(e.amount)}</div></div><button class="btn btn-sm btn-i" onclick="payFE(${e.id})"><i class="fas fa-money-bill-wave"></i> Pagar</button></div>`;
      }
    }
  });
  if(hasR){ rems.innerHTML=`<div style="margin-bottom:9px;font-weight:600;color:var(--cr)"><i class="fas fa-bell"></i> Recordatorios</div>${remHtml}`; rems.style.display='block'; }
  
  for(const k in accounts){
    accounts[k].transactions.forEach(tx=>{
      const d=parseDateStr(tx.date);
      if(showAllTx||(d.getMonth()===currentMonth&&d.getFullYear()===currentYear)){
        allTx.push({...tx,accKey:k,accName:accounts[k].name});
        if(d.getMonth()===currentMonth&&d.getFullYear()===currentYear){
          if(tx.amount>0)mInc+=tx.amount; else mExp+=Math.abs(tx.amount);
        }
      }
    });
  }
  
  const ms=document.getElementById('monthSummary');
  if(!showAllTx){
    ms.style.display='grid';
    const net=mInc-mExp;
    document.getElementById('monthTotal').textContent=`$ ${fmt(net)}`;
    document.getElementById('monthTotal').className='sval '+(net>=0?'positive':'negative');
    document.getElementById('monthIncome').textContent=`$ ${fmt(mInc)}`;
    document.getElementById('monthExpense').textContent=`$ ${fmt(mExp)}`;
  } else ms.style.display='none';
  
  allTx.sort((a,b)=>parseDateStr(b.date)-parseDateStr(a.date));
  if(allTx.length){
    list.innerHTML='';
    allTx.forEach(tx=>{
      const d=document.createElement('div'); d.className='vi';
      const feBadge=tx.fixedExpenseId?`<span class="badge bi">${(fixedExpenses.find(e=>e.id===tx.fixedExpenseId)||{}).name||''}</span>`:'';
      d.innerHTML=`
        <div style="flex:1"><div class="vi-concept">${tx.concept}${feBadge}</div><div class="vi-meta">${fmtDate(tx.date)} · ${tx.accName}</div></div>
        <div class="vi-amount ${tx.amount>=0?'positive':'negative'}">${tx.amount>=0?'+':''}$ ${fmt(tx.amount)}</div>
        <div class="vi-actions">
          <button class="btn btn-sm btn-s" onclick="editTx('${tx.accKey}',${tx.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-d" onclick="delTx('${tx.accKey}',${tx.id})"><i class="fas fa-trash"></i></button>
        </div>`;
      list.appendChild(d);
    });
  } else list.innerHTML=`<div class="empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div>`;
}

function loadFE(){
  const el=document.getElementById('fixedExpensesList'), pe=document.getElementById('pendingFixedExpenses');
  el.innerHTML=''; pe.innerHTML='';
  const today=new Date(), cmy=`${today.getFullYear()}-${today.getMonth()+1}`;
  let pend=[],paid=[],inact=[];
  fixedExpenses.forEach(e=>{
    const lmy=e.lastPaid?`${new Date(e.lastPaid).getFullYear()}-${new Date(e.lastPaid).getMonth()+1}`:'';
    if(!e.active)inact.push(e); else if(lmy===cmy)paid.push(e); else pend.push(e);
  });
  [...pend,...paid,...inact].forEach(e=>el.appendChild(createFECard(e,paid.includes(e)?'paid':inact.includes(e)?'inactive':'pending')));
  if(!fixedExpenses.length) el.innerHTML=`<div class="empty"><i class="fas fa-calendar-alt"></i><h3>Sin gastos fijos</h3><p>Usa el botón 📅 para agregar</p></div>`;
  if(pend.length){
    const tot=pend.reduce((s,e)=>s+e.amount,0);
    pe.innerHTML=`<div class="warn-box"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:9px">
      <div><strong><i class="fas fa-exclamation-triangle"></i> ${pend.length} pendiente(s)</strong><div style="margin-top:3px;font-size:.83rem">Total: <span class="negative">$ ${fmt(tot)}</span></div></div>
      <button class="btn btn-p btn-sm" onclick="payAllFE()"><i class="fas fa-money-bill-wave"></i> Pagar Todos</button>
    </div></div>`;
  }
}

function createFECard(e,status){
  const today=new Date(), cd=today.getDate();
  let sc='sp', st='';
  let cls='fe-card';
  if(status==='paid'){ sc='sk'; st=`Pagado ${fmtDate(e.lastPaid)}`; cls+=' paid'; }
  else if(status==='inactive'){ sc=''; st='Inactivo'; cls+=' paid'; }
  else{
    const rem=parseInt(e.day)-cd;
    if(rem<0){ st=`Vencido hace ${Math.abs(rem)}d`; cls+=' overdue'; }
    else if(rem===0) st='Vence hoy';
    else st=`Vence en ${rem}d`;
  }
  const c=document.createElement('div'); c.className=cls;
  c.innerHTML=`
    <div class="fe-hdr"><div class="fe-title">${e.name}</div><div class="fe-amount">$ ${fmt(e.amount)}</div></div>
    <div class="fe-det"><div><i class="fas fa-calendar-day"></i> Día ${e.day}${e.category?' · '+e.category:''}</div><span class="fe-status ${sc}">${st}</span></div>
    <div class="fe-actions">
      <button class="btn btn-s btn-sm" onclick="editFE(${e.id})"><i class="fas fa-edit"></i> Editar</button>
      <button class="btn ${status==='paid'?'btn-s':'btn-ok'} btn-sm" onclick="payFE(${e.id})" ${status==='paid'?'disabled':''}><i class="fas fa-check-circle"></i> ${status==='paid'?'Pagado':'Pagar'}</button>
      <button class="btn btn-d btn-sm" onclick="if(confirm('¿Eliminar?'))delFE(${e.id})"><i class="fas fa-trash"></i></button>
    </div>`;
  return c;
}

// ══════════════════════════════════════════════════
// PRODUCTS MANAGER
// ══════════════════════════════════════════════════
function loadProdsManager(){
  const list=document.getElementById('productsList');
  const ps=getProds();
  if(!ps.length){ list.innerHTML=`<div class="empty"><i class="fas fa-coffee"></i><h3>Sin productos</h3></div>`; return; }
  list.innerHTML='';
  ps.forEach(p=>{
    const d=document.createElement('div'); d.className='pmcard';
    d.innerHTML=`<div><div class="pmname">${p.emoji||'☕'} ${p.nombre}</div><div class="pmprice">$ ${fmt(p.precio)}</div></div>
    <div style="display:flex;gap:7px"><button class="btn btn-sm btn-s" onclick="editProd(${p.id})"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-d" onclick="if(confirm('¿Eliminar?'))delProd(${p.id})"><i class="fas fa-trash"></i></button></div>`;
    list.appendChild(d);
  });
}

function abrirProdModal(p=null){
  editingProdId=p?p.id:null;
  document.getElementById('prodModalTitle').textContent=p?'Editar Producto':'Nuevo Producto';
  document.getElementById('prodId').value=p?p.id:'';
  document.getElementById('prodNombre').value=p?p.nombre:'';
  document.getElementById('prodPrecio').value=p?p.precio:'';
  document.getElementById('prodEmoji').value=p?p.emoji||'':'';
  document.getElementById('deleteProdBtn').style.display=p?'inline-flex':'none';
  document.getElementById('prodModal').classList.add('active');
}

function editProd(id){ const p=getProds().find(x=>x.id===id); if(p) abrirProdModal(p); }
function delProd(id){ let ps=getProds().filter(p=>p.id!==id); saveProds(ps); loadProdGrid(); loadProdsManager(); notify('Producto eliminado','info'); }
function eliminarProd(){ if(editingProdId) delProd(editingProdId); document.getElementById('prodModal').classList.remove('active'); }

// ══════════════════════════════════════════════════
// EVENTS SETUP
// ══════════════════════════════════════════════════
function setupEvents(){
  // Tab switching
  document.querySelectorAll('.nav-tab').forEach(tab=>{
    tab.addEventListener('click',function(){
      switchTab(this.getAttribute('data-tab'));
    });
  });
  
  // FABs
  document.getElementById('addTransactionBtn').addEventListener('click',openTxModal);
  document.getElementById('addFixedExpenseBtn').addEventListener('click',openFEModal);
  
  // Close modals
  document.querySelectorAll('.close-modal').forEach(b=>b.addEventListener('click',()=>{document.getElementById('transactionModal').classList.remove('active');resetTxForm();}));
  document.querySelectorAll('.close-fe-modal').forEach(b=>b.addEventListener('click',()=>{document.getElementById('fixedExpenseModal').classList.remove('active');resetFEForm();}));
  document.getElementById('closeAcctDetail').addEventListener('click',()=>document.getElementById('acctDetailModal').classList.remove('active'));
  document.getElementById('closeGastoModal').addEventListener('click',()=>document.getElementById('gastoModal').classList.remove('active'));
  
  // Resumen cards
  document.querySelectorAll('.account-card[data-account]').forEach(c=>c.addEventListener('click',function(){openAcctDetail(this.getAttribute('data-account'));}));
  
  // Month nav
  document.getElementById('prevMonthBtn').addEventListener('click',()=>{currentMonth--;if(currentMonth<0){currentMonth=11;currentYear--;}updateMonthDisplay();loadTransactions();});
  document.getElementById('nextMonthBtn').addEventListener('click',()=>{currentMonth++;if(currentMonth>11){currentMonth=0;currentYear++;}updateMonthDisplay();loadTransactions();});
  
  // Filter btns
  document.querySelectorAll('.fbtn').forEach(b=>{
    b.addEventListener('click',function(){
      document.querySelectorAll('.fbtn').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');
      showAllTx=this.getAttribute('data-filter')==='all';
      if(showAllTx){const n=new Date();currentMonth=n.getMonth();currentYear=n.getFullYear();updateMonthDisplay();}
      loadTransactions();
    });
  });
  
  // Type change
  document.getElementById('type').addEventListener('change',function(){
    if(this.value==='egreso'){document.getElementById('fixedExpensePaymentGroup').style.display='block';loadFEForPayment();}
    else document.getElementById('fixedExpensePaymentGroup').style.display='none';
  });
  document.getElementById('markAsFixedExpensePayment').addEventListener('change',function(){
    document.getElementById('fixedExpenseForPayment').style.display=this.checked?'block':'none';
  });
  
  // Forms
  document.getElementById('transactionForm').addEventListener('submit',function(e){e.preventDefault();isEditing?updateTx():addTx();});
  document.getElementById('fixedExpenseForm').addEventListener('submit',function(e){e.preventDefault();isEditingFE?updateFE():addFE();});
  document.getElementById('deleteTransactionBtn').addEventListener('click',deleteTx);
  document.getElementById('deleteFEBtn').addEventListener('click',()=>{if(confirm('¿Eliminar?')){delFE(currentEditFEId);document.getElementById('fixedExpenseModal').classList.remove('active');}});
  document.getElementById('cancelGastoBtn').addEventListener('click',()=>document.getElementById('gastoModal').classList.remove('active'));
  document.getElementById('deleteGastoBtn').addEventListener('click',()=>{if(editingGastoId){eliminarGasto(editingGastoId);document.getElementById('gastoModal').classList.remove('active');}});
  
  // Gasto form
  document.getElementById('gastoForm').addEventListener('submit',function(e){
    e.preventDefault();
    const id=document.getElementById('gastoId').value;
    const concepto=document.getElementById('gastoConcepto').value;
    const monto=parseFloat(document.getElementById('gastoMonto').value);
    const categoria=document.getElementById('gastoCategoria').value;
    const cuenta=document.getElementById('gastoCuenta').value;
    const fecha=document.getElementById('gastoFecha').value;
    const nota=document.getElementById('gastoNota').value;
    
    if(id){
      // Update
      const gi=gastos.findIndex(x=>x.id==id);
      if(gi>-1){
        const old=gastos[gi];
        // Remove old tx
        const ti=accounts[old.cuenta]?.transactions.findIndex(t=>t.gastoId==id);
        if(ti>-1) accounts[old.cuenta].transactions.splice(ti,1);
        gastos[gi]={id:old.id,concepto,monto,categoria,cuenta,fecha,nota};
      }
    } else {
      const newId=Date.now();
      gastos.push({id:newId,concepto,monto,categoria,cuenta,fecha,nota});
      // Add tx to account
      accounts[cuenta].transactions.push({id:Date.now()+1,date:fecha,concept:`[Gasto] ${concepto}${nota?' - '+nota:''}`,amount:-monto,type:'egreso',gastoId:newId});
    }
    saveGastos(); saveAccounts(); updateUI(); updateGastosList(); loadTransactions();
    document.getElementById('gastoModal').classList.remove('active');
    notify(id?'✅ Gasto actualizado':'✅ Gasto registrado','success');
  });
  
  // Credito form
  document.getElementById('creditoForm').addEventListener('submit',function(e){
    e.preventDefault();
    const nombre=document.getElementById('creditoCliente').value;
    const monto=parseFloat(document.getElementById('creditoMonto').value);
    const desc=document.getElementById('creditoDesc').value;
    const fecha=document.getElementById('creditoFecha').value;
    creditos.push({id:Date.now(),cliente:nombre,deuda:monto,desc,fecha,pagos:[]});
    saveCreditos(); updateCreditosList(); updateClienteSuggestions();
    document.getElementById('creditoModal').classList.remove('active');
    notify(`💳 Crédito de $${fmt(monto)} registrado para ${nombre}`,'info');
  });
  
  // Prod form
  document.getElementById('prodForm').addEventListener('submit',function(e){
    e.preventDefault();
    const nombre=document.getElementById('prodNombre').value;
    const precio=parseFloat(document.getElementById('prodPrecio').value);
    const emoji=document.getElementById('prodEmoji').value||'☕';
    let ps=getProds();
    if(editingProdId){const i=ps.findIndex(p=>p.id===editingProdId);if(i>-1)ps[i]={...ps[i],nombre,precio,emoji};}
    else ps.push({id:Date.now(),nombre,precio,emoji});
    saveProds(ps); loadProdGrid(); loadProdsManager();
    document.getElementById('prodModal').classList.remove('active');
    notify(editingProdId?'✅ Producto actualizado':'✅ Producto añadido','success');
  });
  
  updatePendBadge();
}

function switchTab(tab){
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  const el=document.getElementById(tab); if(el) el.classList.add('active');
  if(tab==='transacciones'){loadTransactions();updateMonthDisplay();}
  else if(tab==='gastos-fijos') loadFE();
  else if(tab==='cuentas') loadAccountsTab();
  else if(tab==='productos'){loadProdGrid();loadProdsManager();}
  else if(tab==='creditos') updateCreditosList();
  else if(tab==='gastos') updateGastosList();
  else if(tab==='pendientes') updatePendientesList();
}

function setupBackupFile(){
  document.getElementById('backupFile').addEventListener('change',function(){
    if(this.files.length>0){document.getElementById('fileName').textContent=this.files[0].name;document.getElementById('fileInfo').style.display='block';document.getElementById('importBtn').disabled=false;}
    else{document.getElementById('fileInfo').style.display='none';document.getElementById('importBtn').disabled=true;}
  });
}

// ══ TRANSACTION CRUD ══
function openTxModal(){
  isEditing=false;currentEditId=null;
  document.getElementById('modalTitle').textContent='Nueva Transacción';
  document.getElementById('submitTransactionBtn').textContent='Guardar';
  document.getElementById('deleteTransactionBtn').style.display='none';
  document.getElementById('transactionForm').reset(); setTodayDate();
  document.getElementById('transactionId').value=''; document.getElementById('originalAccount').value='';
  document.getElementById('fixedExpensePaymentGroup').style.display='none';
  document.getElementById('markAsFixedExpensePayment').checked=false;
  document.getElementById('fixedExpenseForPayment').style.display='none';
  document.getElementById('transactionModal').classList.add('active');
}

function openFEModal(){
  isEditingFE=false;currentEditFEId=null;
  document.getElementById('feModalTitle').textContent='Nuevo Gasto Fijo';
  document.getElementById('submitFEBtn').textContent='Guardar';
  document.getElementById('deleteFEBtn').style.display='none';
  document.getElementById('fixedExpenseForm').reset();
  document.getElementById('feId').value='';document.getElementById('feActive').value='true';document.getElementById('feActiveSelect').value='true';
  document.getElementById('fixedExpenseModal').classList.add('active');
}

function editTx(k,id){
  const a=accounts[k], tx=a.transactions.find(t=>t.id===id); if(!tx) return;
  isEditing=true;currentEditId=id;
  document.getElementById('modalTitle').textContent='Editar Transacción';
  document.getElementById('submitTransactionBtn').textContent='Actualizar';
  document.getElementById('deleteTransactionBtn').style.display='inline-flex';
  document.getElementById('transactionId').value=id;document.getElementById('originalAccount').value=k;
  document.getElementById('account').value=k;document.getElementById('type').value=tx.type;
  document.getElementById('amount').value=Math.abs(tx.amount);document.getElementById('concept').value=tx.concept;
  document.getElementById('date').value=tx.date;
  if(tx.fixedExpenseId){document.getElementById('fixedExpensePaymentGroup').style.display='block';document.getElementById('markAsFixedExpensePayment').checked=true;document.getElementById('fixedExpenseForPayment').style.display='block';loadFEForPayment();setTimeout(()=>document.getElementById('fixedExpenseForPayment').value=tx.fixedExpenseId,50);}
  else if(tx.type==='egreso') document.getElementById('fixedExpensePaymentGroup').style.display='block';
  document.getElementById('transactionModal').classList.add('active');
}

function editFE(id){
  const e=fixedExpenses.find(x=>x.id===id); if(!e) return;
  isEditingFE=true;currentEditFEId=id;
  document.getElementById('feModalTitle').textContent='Editar Gasto Fijo';
  document.getElementById('submitFEBtn').textContent='Actualizar';
  document.getElementById('deleteFEBtn').style.display='inline-flex';
  document.getElementById('feId').value=id;document.getElementById('feName').value=e.name;
  document.getElementById('feAmount').value=e.amount;document.getElementById('feDay').value=e.day;
  document.getElementById('feAccount').value=e.account||'';document.getElementById('feCategory').value=e.category||'';
  document.getElementById('feActive').value=e.active.toString();document.getElementById('feActiveSelect').value=e.active.toString();
  document.getElementById('fixedExpenseModal').classList.add('active');
}

function addTx(){
  const acc=document.getElementById('account').value,type=document.getElementById('type').value;
  const amount=parseFloat(document.getElementById('amount').value),concept=document.getElementById('concept').value,date=document.getElementById('date').value;
  const isFE=document.getElementById('markAsFixedExpensePayment').checked;
  const feId=isFE?parseInt(document.getElementById('fixedExpenseForPayment').value):null;
  if(!acc||!type||!amount||!concept||!date){notify('Completa todos los campos','warning');return;}
  const tx={id:Date.now(),date,concept,amount:type==='egreso'?-amount:amount,type};
  if(isFE&&feId){tx.fixedExpenseId=feId;const i=fixedExpenses.findIndex(e=>e.id===feId);if(i>-1){fixedExpenses[i].lastPaid=date;saveFE();}}
  accounts[acc].transactions.push(tx);saveAccounts();updateUI();loadTransactions();loadAccountsTab();loadFE();
  document.getElementById('transactionModal').classList.remove('active');resetTxForm();
  notify(`✅ Transacción añadida en ${accounts[acc].name}`,'success');
}

function updateTx(){
  const txId=parseInt(document.getElementById('transactionId').value),origAcc=document.getElementById('originalAccount').value;
  const newAcc=document.getElementById('account').value,type=document.getElementById('type').value;
  const amount=parseFloat(document.getElementById('amount').value),concept=document.getElementById('concept').value,date=document.getElementById('date').value;
  const isFE=document.getElementById('markAsFixedExpensePayment').checked;
  const feId=isFE?parseInt(document.getElementById('fixedExpenseForPayment').value):null;
  if(!newAcc||!type||!amount||!concept||!date){notify('Completa todos los campos','warning');return;}
  const updated={id:txId,date,concept,amount:type==='egreso'?-amount:amount,type};
  if(isFE&&feId){updated.fixedExpenseId=feId;const i=fixedExpenses.findIndex(e=>e.id===feId);if(i>-1){fixedExpenses[i].lastPaid=date;saveFE();}}
  if(origAcc!==newAcc){accounts[origAcc].transactions=accounts[origAcc].transactions.filter(t=>t.id!==txId);accounts[newAcc].transactions.push(updated);}
  else{const i=accounts[origAcc].transactions.findIndex(t=>t.id===txId);if(i>-1)accounts[origAcc].transactions[i]=updated;}
  saveAccounts();updateUI();loadTransactions();loadAccountsTab();loadFE();
  document.getElementById('transactionModal').classList.remove('active');resetTxForm();
  notify('✅ Transacción actualizada','success');
}

function addFE(){
  const name=document.getElementById('feName').value,amount=parseFloat(document.getElementById('feAmount').value);
  const day=document.getElementById('feDay').value,account=document.getElementById('feAccount').value;
  const cat=document.getElementById('feCategory').value,active=document.getElementById('feActive').value==='true';
  if(!name||!amount||!day){notify('Completa los campos obligatorios','warning');return;}
  fixedExpenses.push({id:Date.now(),name,amount,day,account:account||null,category:cat||'',active,lastPaid:null,createdAt:new Date().toISOString().split('T')[0]});
  saveFE();loadFE();document.getElementById('fixedExpenseModal').classList.remove('active');resetFEForm();
  notify(`📅 Gasto fijo "${name}" añadido`,'success');
}

function updateFE(){
  const id=parseInt(document.getElementById('feId').value);
  const i=fixedExpenses.findIndex(e=>e.id===id); if(i===-1) return;
  fixedExpenses[i]={...fixedExpenses[i],name:document.getElementById('feName').value,amount:parseFloat(document.getElementById('feAmount').value),day:document.getElementById('feDay').value,account:document.getElementById('feAccount').value||null,category:document.getElementById('feCategory').value||'',active:document.getElementById('feActive').value==='true'};
  saveFE();loadFE();document.getElementById('fixedExpenseModal').classList.remove('active');resetFEForm();
  notify('✅ Gasto fijo actualizado','success');
}

function payFE(id){
  const e=fixedExpenses.find(x=>x.id===id); if(!e) return;
  isEditing=false;currentEditId=null;
  document.getElementById('modalTitle').textContent='Pagar Gasto Fijo';
  document.getElementById('submitTransactionBtn').textContent='Pagar';
  document.getElementById('deleteTransactionBtn').style.display='none';
  document.getElementById('account').value=e.account||'efectivo';
  document.getElementById('type').value='egreso';document.getElementById('amount').value=e.amount;
  document.getElementById('concept').value=e.name;setTodayDate();
  document.getElementById('fixedExpensePaymentGroup').style.display='block';
  document.getElementById('markAsFixedExpensePayment').checked=true;
  document.getElementById('fixedExpenseForPayment').style.display='block';
  loadFEForPayment();
  setTimeout(()=>document.getElementById('fixedExpenseForPayment').value=id,50);
  document.getElementById('transactionModal').classList.add('active');
}

function payAllFE(){
  const today=new Date(),ts=fmtDateInput(today),cmy=`${today.getFullYear()}-${today.getMonth()+1}`;
  let cnt=0,tot=0;
  fixedExpenses.forEach(e=>{
    if(e.active){const lmy=e.lastPaid?`${new Date(e.lastPaid).getFullYear()}-${new Date(e.lastPaid).getMonth()+1}`:'';if(lmy!==cmy){const acc=e.account||'efectivo';accounts[acc].transactions.push({id:Date.now()+Math.random(),date:ts,concept:e.name,amount:-e.amount,type:'egreso',fixedExpenseId:e.id});e.lastPaid=ts;cnt++;tot+=e.amount;}}
  });
  if(cnt>0){saveAccounts();saveFE();updateUI();loadTransactions();loadAccountsTab();loadFE();notify(`✅ ${cnt} gastos pagados — $${fmt(tot)}`,'success');}
  else notify('Sin gastos pendientes','info');
}

function delFE(id){ fixedExpenses=fixedExpenses.filter(e=>e.id!==id);saveFE();loadFE();notify('Gasto fijo eliminado','info'); }

function deleteTx(){
  const id=parseInt(document.getElementById('transactionId').value),k=document.getElementById('originalAccount').value;
  eliminarTx(k,id);
  document.getElementById('transactionModal').classList.remove('active');resetTxForm();
}

function delTx(k,id){
  if(!confirm('¿Eliminar este movimiento?')) return;
  eliminarTx(k,id);
}

function eliminarTx(k,id){
  const idx=accounts[k]?.transactions.findIndex(t=>t.id===id);
  if(idx>-1){
    const tx=accounts[k].transactions[idx];
    if(tx.fixedExpenseId){const ei=fixedExpenses.findIndex(e=>e.id===tx.fixedExpenseId);if(ei>-1){fixedExpenses[ei].lastPaid=null;saveFE();}}
    accounts[k].transactions.splice(idx,1);
    saveAccounts();updateUI();loadTransactions();loadAccountsTab();loadFE();updateCajaHdr();updateVentasList();updateGastosList();
    notify('Movimiento eliminado','info');
  }
}

function resetTxForm(){
  isEditing=false;currentEditId=null;document.getElementById('transactionForm').reset();setTodayDate();
  document.getElementById('transactionId').value='';document.getElementById('originalAccount').value='';
  document.getElementById('fixedExpensePaymentGroup').style.display='none';
  document.getElementById('markAsFixedExpensePayment').checked=false;
  document.getElementById('fixedExpenseForPayment').style.display='none';
  document.getElementById('deleteTransactionBtn').style.display='none';
}

function resetFEForm(){
  isEditingFE=false;currentEditFEId=null;document.getElementById('fixedExpenseForm').reset();
  document.getElementById('feId').value='';document.getElementById('feActive').value='true';document.getElementById('deleteFEBtn').style.display='none';
}

function checkReminders(){
  const today=new Date(),cd=today.getDate(),cmy=`${today.getFullYear()}-${today.getMonth()+1}`;
  let pend=[];
  fixedExpenses.forEach(e=>{if(e.active){const rd=parseInt(e.day),lmy=e.lastPaid?`${new Date(e.lastPaid).getFullYear()}-${new Date(e.lastPaid).getMonth()+1}`:'';if(lmy!==cmy&&cd===rd)pend.push(e);}});
  if(pend.length) notify(`🔔 ${pend.length} gasto(s) fijo(s) vencen hoy`,'warn',6000);
}

function cerrarCaja(){
  const today=fmtDateInput(new Date()); let tv=0,cv=0; const pc={};
  for(const k in accounts){ accounts[k].transactions.forEach(tx=>{ if(tx.date===today&&tx.esventa){tv+=tx.amount;cv++;pc[accounts[k].name]=(pc[accounts[k].name]||0)+tx.amount;} }); }
  const credPend=pendientes.length, totCred=creditos.reduce((s,c)=>s+deudaRestante(c),0);
  const todayGastos=gastos.filter(g=>g.fecha===today).reduce((s,g)=>s+g.monto,0);
  const desglose=Object.entries(pc).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>${k}</span><strong>$ ${fmt(v)}</strong></div>`).join('');
  document.getElementById('cierreCajaContent').innerHTML=`
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888">${new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      <div style="font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;color:var(--cw);margin:8px 0">$ ${fmt(tv)}</div>
      <div style="font-size:.85rem;color:#888">${cv} ventas realizadas</div>
    </div>
    <div class="stitle" style="font-size:.86rem"><i class="fas fa-wallet"></i> Por método de pago</div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:14px">${desglose||'<p style="color:#bbb;text-align:center;padding:8px">Sin ventas hoy</p>'}</div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Gastos del día</span><span class="negative">- $ ${fmt(todayGastos)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Neto del día</span><strong>${tv-todayGastos>=0?'+':''}<span class="${(tv-todayGastos)>=0?'positive':'negative'}">$ ${fmt(tv-todayGastos)}</span></strong></div>
      ${credPend>0?`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Ventas pendientes</span><span class="negative">${credPend} pend.</span></div>`:''}
      ${totCred>0?`<div style="display:flex;justify-content:space-between;padding:7px 0"><span>Total créditos</span><span class="negative">$ ${fmt(totCred)}</span></div>`:''}
    </div>
    <button class="btn btn-p btn-full" onclick="document.getElementById('cierreCajaModal').classList.remove('active')"><i class="fas fa-check"></i> Listo</button>`;
  document.getElementById('cierreCajaModal').classList.add('active');
}

// ══ BACKUP ══
function downloadBackup(){
  let csv="Cuenta,Fecha,Concepto,Monto,Tipo,GastoFijoID\n";
  for(const k in accounts){accounts[k].transactions.forEach(tx=>{csv+=`"${accounts[k].name}","${tx.date}","${tx.concept}",${tx.amount},"${tx.amount>=0?'Ingreso':'Egreso'}","${tx.fixedExpenseId||''}"\n`;});}
  dlFile(csv,`antologia_cuentas_${new Date().toISOString().slice(0,10)}.csv`);
  let csv2="ID,Nombre,Monto,Dia,Cuenta,Categoria,Activo,UltimoPago,Creado\n";
  fixedExpenses.forEach(e=>{csv2+=`"${e.id}","${e.name}",${e.amount},${e.day},"${e.account||''}","${e.category}","${e.active}","${e.lastPaid||''}","${e.createdAt}"\n`;});
  dlFile(csv2,`antologia_gastos_${new Date().toISOString().slice(0,10)}.csv`);
  notify('📥 Archivos descargados','success');
}
function sendBackupByEmail(){ downloadBackup(); notify('Adjunta el archivo a tu email','info',4000); }
function dlFile(content,filename){const b=new Blob([content],{type:'text/csv;charset=utf-8;'});const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=filename;document.body.appendChild(l);l.click();document.body.removeChild(l);}
function importFromFile(){const f=document.getElementById('backupFile').files[0];if(!f)return;if(!confirm('¿Importar? Reemplazará datos actuales.'))return;const r=new FileReader();r.onload=function(e){try{const lines=e.target.result.split('\n');for(const k in accounts)accounts[k].transactions=[];let s=lines[0].toLowerCase().includes('cuenta')?1:0;for(let i=s;i<lines.length;i++){const line=lines[i].trim();if(!line)continue;const c=parseCSV(line);if(c.length>=4){let cu=c[0].trim(),fe=fixDate(c[1].trim()),co=c[2].trim(),mo=parseFloat(c[3].trim()),ty=c.length>4?c[4].trim():(mo>=0?'Ingreso':'Egreso'),fid=c.length>5?c[5].trim():null;let k='efectivo';if(cu.toLowerCase().includes('nequi'))k='nequi';else if(cu.toLowerCase().includes('bancolombia'))k='bancolombia';else if(cu.toLowerCase().includes('daviplata'))k='daviplata';const tx={id:Date.now()+i,date:fe,concept:co,amount:mo,type:ty.toLowerCase().includes('ingreso')?'ingreso':'egreso'};if(fid&&fid!=='')tx.fixedExpenseId=parseInt(fid);accounts[k].transactions.push(tx);}}saveAccounts();updateUI();loadTransactions();loadAccountsTab();clearFileInput();notify('✅ Datos importados','success');}catch(er){notify('Error al importar','danger');}};r.readAsText(f);}
function parseCSV(line){const r=[];let c='',iq=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"')iq=!iq;else if(ch===','&&!iq){r.push(c);c='';}else c+=ch;}r.push(c);return r;}
function fixDate(d){if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d;if(d.includes('/')){const p=d.split('/');if(p.length===3)return`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}return fmtDateInput(new Date());}
function clearFileInput(){document.getElementById('backupFile').value='';document.getElementById('fileInfo').style.display='none';document.getElementById('importBtn').disabled=true;}

// ══ UTILS ══
function fmt(n){return Math.abs(n).toLocaleString('es-CO');}
function parseDateStr(ds){if(!ds)return new Date();if(ds instanceof Date)return ds;if(/^\d{4}-\d{2}-\d{2}$/.test(ds)){const p=ds.split('-');return new Date(p[0],p[1]-1,p[2]);}const d=new Date(ds);return isNaN(d.getTime())?new Date():d;}
function fmtDateInput(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function fmtDate(ds){if(!ds)return'';const d=parseDateStr(ds);if(isNaN(d.getTime()))return ds;return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;}
function notify(msg,type='info',dur=3000){document.querySelectorAll('.notif').forEach(n=>n.remove());const n=document.createElement('div');n.className='notif';const c={success:'#2e7d32',warning:'var(--warn)',danger:'#c62828',warn:'#e65100',info:'var(--cr)'};n.style.background=c[type]||c.info;n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),dur);}