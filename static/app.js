'use strict';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => ((n || 0) / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const number = n => Number(n || 0).toLocaleString('pt-BR');
const date = v => v ? new Date(v).toLocaleString('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
const cents = value => { const s = String(value).trim().replace(',','.'); if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Informe um valor monetário válido, com até duas casas decimais.'); return Math.round(Number(s)*100); };
const decimal = n => ((n || 0)/100).toFixed(2);
const icons = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bag:'<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v10M7 5l9 4"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  cash:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 8h1M18 16h1"/>',
  chart:'<path d="M4 3v17h17M8 16v-5M13 16V7M18 16V4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  down:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
  exit:'<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  shirt:'<path d="m8 3-6 4 3 6 3-2v10h8V11l3 2 3-6-6-4a4 4 0 0 1-8 0Z"/>',
  ball:'<circle cx="12" cy="12" r="10"/><path d="m12 7 5 4-2 6H9l-2-6 5-4ZM12 7V2M17 11l5-1M15 17l3 4M9 17l-3 4M7 11l-5-1"/>',
  shoe:'<path d="M3 15V8l5 2 3 5h9l2 3v3H2v-6h1ZM3 17h18M12 15l2-3M15 15l2-3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
const icon = (name, size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
const art = p => icon(p.category === 'Chuteiras' ? 'shoe' : p.category === 'Bolas' ? 'ball' : ['Camisas','Infantil','Treino'].includes(p.category) ? 'shirt' : 'bag', 28);
const brand = () => `<div class="brand"><div class="brand-mark">S</div><div><b>SKINÃO</b><small>DO ESPORTE</small></div></div>`;
const btn = (text, action, cls='', symbol='', attrs='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${symbol ? icon(symbol,15) : ''}${text}</button>`;
const pill = (text, cls='') => `<span class="pill ${cls}">${esc(text)}</span>`;
const empty = (title, detail, symbol='box') => `<div class="empty">${icon(symbol,32)}<strong>${esc(title)}</strong>${esc(detail)}</div>`;
const field = (label,name,value='',type='text',attrs='',full=false) => `<label class="field ${full?'full':''}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const selectField = (label,name,opts,value,full=false) => `<label class="field ${full?'full':''}">${esc(label)}<select name="${name}">${opts.map(o=>`<option ${value===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
const table = (head,body) => `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
const settingDefault = {name:'Skinão do Esporte',location:'Feira Livre · Barreiras, BA',whatsapp:''};
let data, catalog, csrf='', tab='dashboard', catalogMode=location.pathname !== '/gestao';
let cart=[], publicCart=[], filter='', category='Todas', orderFilter='Todos';
let reportStart='',reportEnd='';
let toastTimer;

function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500); }
async function api(path, payload) {
  const r = await fetch(path, payload === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload)});
  const result=await r.json();
  if (!r.ok) { if(r.status===401 && !catalogMode && path!=='/api/login') renderLogin(); throw new Error(result.error || 'Não foi possível concluir.'); }
  return result;
}
async function refresh() { if(catalogMode) catalog=await api('/api/catalog'); else data=await api('/api/state'); render(); }
function options(categories,selected) {return categories.map(o=>`<option value="${esc(o)}" ${o===selected?'selected':''}>${esc(o)}</option>`).join('');}
function matches(p) {return (category==='Todas'||p.category===category) && `${p.name} ${p.sku} ${p.team} ${p.size} ${p.color} ${p.quality}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'));}
function searchBar(products,placeholder='Buscar produto, código, time ou tamanho…') {return `<div class="filters"><label class="search">${icon('search')}<input id="search" type="search" aria-label="Buscar produtos" placeholder="${placeholder}" value="${esc(filter)}"></label><select id="category" aria-label="Categoria">${options(['Todas',...new Set(products.map(p=>p.category))],category)}</select></div>`;}
function headings(title,subtitle,actions='') {return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`;}
function demoStrip(settings) {return settings.demo==='1'?'<div class="demo-strip">Ambiente de demonstração · Os produtos e preços são fictícios. Não representam o estoque real da loja.</div>':'';}
function render() { if(catalogMode) renderCatalog(); else renderAdmin(); }
const tabs=[['dashboard','dashboard','Visão geral'],['pos','bag','Frente de caixa'],['products','box','Produtos e estoque'],['sales','cash','Vendas'],['orders','globe','Pedidos online'],['clients','users','Clientes'],['cash','cash','Meu caixa'],['reports','chart','Relatórios']];
function renderAdmin() {
  const current=tabs.find(t=>t[0]===tab) || ['settings','settings','Configurações'];
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar">${brand()}<div class="workspace">${icon('pin',17)}<div>Loja de Barreiras<span>Gestão da minha loja</span></div></div><div class="nav-title">PRINCIPAL</div><nav class="nav" aria-label="Gestão">${tabs.map(([id,i,label])=>`<button data-action="tab" data-id="${id}" class="${tab===id?'active':''}">${icon(i)}${label}${id==='orders' && data.orders.some(o=>o.status==='Pendente')?`<span class="count">${data.orders.filter(o=>o.status==='Pendente').length}</span>`:''}</button>`).join('')}<button class="mobile-tool" data-action="tab" data-id="settings">${icon('settings')}Configurações</button><button class="mobile-tool" data-action="open-catalog">${icon('globe')}Catálogo</button><button class="mobile-tool" data-action="logout">${icon('exit')}Sair</button></nav><div class="sidebar-bottom"><a href="/catalogo" target="_blank" rel="noopener">${icon('globe')}Ver meu catálogo ${icon('arrow',13)}</a><button data-action="tab" data-id="settings">${icon('settings')}Configurações</button><button data-action="logout">${icon('exit')}Sair da conta</button></div><div class="side-label">SKINÃO DO ESPORTE<br>Seu negócio em movimento.</div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Minha loja &nbsp; / &nbsp; <b>${current[2]}</b></div><span class="mobile-brand">Skinão <span class="muted">Gestão</span></span><div class="top-right"><span class="date">${new Date().toLocaleDateString('pt-BR',{timeZone:'America/Bahia',day:'numeric',month:'long',year:'numeric'})}</span><span class="cash-status ${data.cash?'':'closed'}"><i class="dot"></i>Caixa ${data.cash?'aberto':'fechado'}</span><span class="avatar" title="Administrador">AD</span></div></header>${demoStrip(data.settings)}<div class="content" id="view"></div></main></div>`;
  const views={dashboard,products,sales,orders,clients,cash:cashView,reports,settings,pos};
  $('#view').innerHTML=views[tab]();
}
function stat(label,value,note,symbol='chart',accent=false) {return `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(symbol,16)}</span></div><div class="stat-value mono">${value}</div><div class="stat-note ${accent?'accent':''}">${note}</div></div>`;}
function salesTable(list,compact=false) {
  if(!list.length) return empty('Nenhuma venda por aqui','As vendas registradas aparecerão nesta lista.','bag');
  return table(['Venda / cliente','Data','Pagamento','Valor','Status',...(compact?[]:[''])],list.map(s=>`<tr><td><b>#${String(s.id).padStart(4,'0')}</b> · ${esc(s.customer)}</td><td class="muted">${date(s.created)}</td><td>${esc(s.payment)}</td><td class="mono"><b>${money(s.total)}</b></td><td>${pill(s.canceled?'Estornada':'Concluída',s.canceled?'gray':'')}</td>${compact?'':`<td>${btn('Recibo','receipt','small','',`data-id="${s.id}"`)} ${!s.canceled && data.cash?.id===s.cash_id?btn('Estornar','cancel-sale','small danger','',`data-id="${s.id}"`):''}</td>`}</tr>`).join(''));
}
function dashboard() {
  const today=data.sales.filter(s=>!s.canceled&&s.created.slice(0,10)===data.today);
  const total=today.reduce((a,s)=>a+s.total,0),margin=today.reduce((a,s)=>a+s.total-s.cost,0);
  const low=data.products.filter(p=>p.active&&p.stock<=p.minimum).sort((a,b)=>a.stock-b.stock);
  const pending=data.orders.filter(o=>o.status==='Pendente');
  const days=Array.from({length:7},(_,i)=>{const d=new Date(data.today+'T12:00:00');d.setDate(d.getDate()-6+i);const day=d.toISOString().slice(0,10);return {label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),total:data.sales.filter(s=>!s.canceled&&s.created.slice(0,10)===day).reduce((a,s)=>a+s.total,0)};});
  const max=Math.max(...days.map(d=>d.total),1);
  return headings('Sua loja em movimento','Tudo o que você precisa acompanhar para vender melhor.',btn('Atualizar','refresh','','clock')+btn('Nova venda','tab','primary','plus','data-id="pos"'))+
  `<section class="hero-panel"><div><span class="eyebrow">DENTRO E FORA DE CAMPO</span><h2>O próximo resultado começa<br>com uma boa gestão.</h2><p>${pending.length?`${pending.length} pedido(s) online aguardando sua confirmação.`:'Seu estoque, suas vendas e seus clientes no mesmo lugar.'}</p></div><div class="hero-number">${number(data.products.filter(p=>p.active).reduce((a,p)=>a+p.stock,0))}<small>unidades disponíveis em estoque</small></div></section>
  <div class="stats">${stat('Vendas de hoje',money(total),`${today.length} venda(s) concluída(s)`,'cash')}${stat('Ticket médio',money(today.length?Math.round(total/today.length):0),'Valor médio por venda de hoje','bag')}${stat('Margem bruta hoje',money(margin),'Vendas menos custo dos produtos','chart',true)}${stat('Atenção ao estoque',number(low.length),'Variações no mínimo ou abaixo','box')}</div>
  <div class="grid-two"><section class="panel"><div class="panel-header"><div><h2>O ritmo das vendas</h2><p>Faturamento nos últimos 7 dias</p></div>${pill('Esta semana','gray')}</div><div class="chart">${days.map(d=>`<div class="bar-column"><span class="bar-value">${d.total?money(d.total):'—'}</span><div class="bar-track"><div class="bar" style="height:${Math.max(1,Math.round(d.total/max*100))}%"></div></div><span class="bar-label">${d.label}</span></div>`).join('')}</div><div class="chart-foot"><span>Vendas concluídas · sem estornos</span><b>Total ${money(days.reduce((a,d)=>a+d.total,0))}</b></div></section><section class="panel"><div class="panel-header"><div><h2>Hora de repor</h2><p>Não deixe faltar o próximo gol</p></div><button class="text-link" data-action="tab" data-id="products">Ver estoque →</button></div>${low.length?low.slice(0,3).map(p=>`<div class="stock-row"><div class="mini-art">${art(p)}</div><div class="info"><b>${esc(p.name)}</b><small>${esc(p.size||'Único')} · ${esc(p.sku)}</small></div>${pill(p.stock+' un.',p.stock?'warn':'bad')}</div>`).join(''):empty('Estoque em dia','Nenhum produto abaixo do mínimo.','check')}</section></div>
  <section class="panel"><div class="panel-header"><div><h2>Últimas vendas</h2><p>Os movimentos mais recentes da loja</p></div><button class="text-link" data-action="tab" data-id="sales">Ver todas →</button></div>${salesTable(data.sales.slice(0,5),true)}</section>`;
}
function products() {
  return headings('Produtos e estoque','Cada tamanho, cor e modelo tem seu próprio código e estoque.',btn('Movimentações','stock-history','','clock')+btn('Novo produto','new-product','primary','plus'))+
  `<div class="toolbar">${searchBar(data.products)}<span class="muted"><small>${data.products.length} variações cadastradas</small></span></div><section class="panel" id="product-results">${productRows()}</section>`;
}
function productRows() {
  const list=data.products.filter(matches);
  if(!list.length) return empty('Nenhum produto encontrado','Cadastre um produto ou tente outra busca.');
  return table(['Produto / variação','Código','Preço','Margem bruta','Estoque',''],list.map(p=>{const margin=p.price?Math.round((p.price-p.cost)/p.price*100):0;return `<tr><td><div class="product-name"><div class="mini-art">${art(p)}</div><div><b>${esc(p.name)}</b><small>${esc([p.size,p.color,p.quality].filter(Boolean).join(' · '))}${p.active?'':' · Inativo'}</small></div></div></td><td class="muted">${esc(p.sku)}</td><td class="mono">${money(p.price)}<small>Custo ${money(p.cost)}</small></td><td>${margin}%</td><td><span class="stock-number">${p.stock}</span> ${pill(p.stock<=p.minimum?'Repor':'Em dia',p.stock<=p.minimum?'warn':'')}</td><td><div class="actions">${btn('Ajustar','adjust-stock','small','',`data-id="${p.id}"`)}<button class="icon-btn" data-action="edit-product" data-id="${p.id}" aria-label="Editar ${esc(p.name)}">${icon('edit',15)}</button></div></td></tr>`;}).join(''));
}
function sales() {
  return headings('Vendas','Histórico de vendas, recibos e estornos do caixa atual.',`<a class="btn" href="/api/export">${icon('down',15)}Exportar CSV</a>`+btn('Nova venda','tab','primary','plus','data-id="pos"'))+
    `<div class="notice info">Os recibos são comprovantes internos, sem valor fiscal. Estornos devolvem os produtos ao estoque e só podem ser feitos no caixa aberto da venda.</div><section class="panel">${salesTable(data.sales)}</section>`;
}
function orders() {
  const list=data.orders.filter(o=>orderFilter==='Todos'||o.status===orderFilter);
  return headings('Pedidos online','Pedidos reservam estoque. Confirme somente após combinar e receber o pagamento.',btn('Atualizar','refresh','','clock'))+
    `<div class="toolbar"><select id="order-filter" aria-label="Status do pedido">${options(['Todos','Pendente','Confirmado','Cancelado'],orderFilter)}</select><small class="muted">${data.orders.filter(o=>o.status==='Pendente').length} aguardando confirmação</small></div><div class="notice">Reservas não expiram automaticamente. Confira os pedidos pendentes e cancele os que não forem concluídos para liberar o estoque.</div><section class="panel">${list.length?list.map(o=>`<article class="order-card"><div class="order-top"><div><h3>Pedido #${String(o.id).padStart(4,'0')} · ${esc(o.customer)}</h3><small class="muted">${date(o.created)} · ${esc(o.phone)}</small></div>${pill(o.status,o.status==='Pendente'?'warn':o.status==='Cancelado'?'gray':'')}</div><ul>${data.order_items.filter(i=>i.order_id===o.id).map(i=>`<li>${i.quantity}× ${esc(i.name)} <span class="muted">(${esc(i.sku)})</span> · ${money(i.price*i.quantity)}</li>`).join('')}</ul>${o.note?`<p>Observação: ${esc(o.note)}</p>`:''}<div class="order-bottom"><b>${money(o.total)}</b><div class="actions">${data.settings.whatsapp?`<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${esc(o.phone.replace(/\D/g,'').length<=11?'55':'')}${esc(o.phone.replace(/\D/g,''))}">Falar com cliente</a>`:''}${o.status==='Pendente'?btn('Cancelar','cancel-order','small danger','',`data-id="${o.id}"`)+btn('Confirmar recebimento','confirm-order','small primary','check',`data-id="${o.id}"`):''}</div></div></article>`).join(''):empty('Nenhum pedido nesta lista','O catálogo pode receber pedidos assim que houver produtos ativos.','globe')}</section>`;
}
function clients() {
  return headings('Clientes','Contato e histórico de compras para manter o relacionamento.',btn('Novo cliente','new-client','primary','plus'))+
    `<section class="panel">${data.clients.length?table(['Cliente','Telefone','Compras vinculadas','Total comprado',''],data.clients.map(c=>{const purchases=data.sales.filter(s=>!s.canceled&&s.client_id===c.id);return `<tr><td><b>${esc(c.name)}</b></td><td class="muted">${esc(c.phone)||'—'}</td><td>${purchases.length}</td><td>${money(purchases.reduce((a,s)=>a+s.total,0))}</td><td>${btn('Histórico','client-history','small','',`data-id="${c.id}"`)}</td></tr>`;}).join('')):empty('Sua próxima venda pode começar aqui','Cadastre os clientes e selecione seus nomes no caixa.','users')}</section>`;
}
function cashView() {
  const cash=data.cash;
  return headings('Meu caixa','Acompanhe o dinheiro físico e os totais registrados por forma de pagamento.',cash?btn('Sangria ou suprimento','cash-move')+btn('Fechar caixa','cash-close','primary','check'):btn('Abrir caixa','cash-open','primary','plus'))+
    `<div class="grid-two"><section class="panel pad"><span class="eyebrow muted">SALDO ESPERADO EM DINHEIRO</span><div class="cash-big">${money(cash?.expected||0)}</div>${cash?`<p class="help-text">Aberto em ${date(cash.opened)} · Caixa #${cash.id}</p><div class="cash-summary"><span>Fundo de abertura</span><b>${money(cash.opening)}</b></div>${cash.payments.map(p=>`<div class="cash-summary"><span>Vendas · ${esc(p.payment)}</span><b>${money(p.total)}</b></div>`).join('')}`:empty('O caixa está fechado','Abra com o valor do fundo em dinheiro.','cash')}</section><section class="panel"><div class="panel-header"><div><h2>Movimentações de caixa</h2><p>Sangrias e suprimentos do caixa atual</p></div></div>${cash&&data.movements.some(m=>m.cash_id===cash.id)?table(['Tipo / motivo','Valor'],data.movements.filter(m=>m.cash_id===cash.id).map(m=>`<tr><td>${esc(m.kind)}<small>${esc(m.note)} · ${date(m.created)}</small></td><td class="${m.amount<0?'negative':'positive'}">${money(m.amount)}</td></tr>`).join('')):empty('Sem movimentações','Entradas e retiradas de dinheiro aparecem aqui.','cash')}</section></div><section class="panel"><div class="panel-header"><h2>Histórico de fechamento</h2></div>${data.cash_history.some(c=>c.closed)?table(['Caixa','Fechamento','Esperado','Contado','Diferença'],data.cash_history.filter(c=>c.closed).map(c=>`<tr><td>#${c.id}<small>${esc(c.note)}</small></td><td>${date(c.closed)}</td><td>${money(c.expected)}</td><td>${money(c.counted)}</td><td class="${c.counted-c.expected<0?'negative':'positive'}">${money(c.counted-c.expected)}</td></tr>`).join('')):empty('Nenhum caixa fechado','As conferências de caixa ficarão registradas.','clock')}</section>`;
}
function reports() {
  reportStart ||= data.today.slice(0,7)+'-01'; reportEnd ||= data.today;
  const list=data.sales.filter(s=>!s.canceled&&s.created.slice(0,10)>=reportStart&&s.created.slice(0,10)<=reportEnd);
  const ids=new Set(list.map(s=>s.id)), total=list.reduce((a,s)=>a+s.total,0), cost=list.reduce((a,s)=>a+s.cost,0);
  const ranking={};
  data.sale_items.filter(i=>ids.has(i.sale_id)).forEach(i=>{ranking[i.sku] ||= {name:i.name,quantity:0,total:0};ranking[i.sku].quantity+=i.quantity;ranking[i.sku].total+=i.quantity*i.price;});
  const ranked=Object.entries(ranking).sort((a,b)=>b[1].quantity-a[1].quantity).slice(0,10);
  return headings('Relatórios','Números para planejar as compras e acompanhar o resultado.',`<a class="btn" href="/api/export">${icon('down',15)}Exportar todas as vendas</a>`)+
    `<div class="report-filters">${field('De','report-start',reportStart,'date','id="report-start"')}${field('Até','report-end',reportEnd,'date','id="report-end"')}${btn('Aplicar período','report-filter','primary')}</div><div class="stats">${stat('Faturamento',money(total),`${list.length} vendas no período`,'cash')}${stat('Custo dos produtos',money(cost),'Custo gravado na data da venda','box')}${stat('Margem bruta',money(total-cost),'Antes de despesas, impostos e taxas','chart')}${stat('Margem sobre vendas',total?((total-cost)/total*100).toFixed(1)+'%':'0%','Não corresponde ao lucro líquido','chart')}</div><div class="grid-two"><section class="panel"><div class="panel-header"><h2>Produtos mais vendidos</h2></div>${ranked.length?table(['Produto','Quantidade','Valor antes do desconto'],ranked.map(([sku,p])=>`<tr><td><b>${esc(p.name)}</b><small>${esc(sku)}</small></td><td>${p.quantity}</td><td>${money(p.total)}</td></tr>`).join('')):empty('Nenhuma venda no período','Mude o período ou registre a primeira venda.','chart')}</section><section class="panel pad"><h2>Formas de pagamento</h2><p class="help-text">Registros de venda, sem conciliação bancária.</p><div style="margin-top:25px">${['Dinheiro','Pix','Débito','Crédito'].map(payment=>{const value=list.filter(s=>s.payment===payment).reduce((a,s)=>a+s.total,0);return `<div class="cash-summary"><span>${payment}</span><b>${money(value)}</b></div><div class="report-bar"><i style="width:${total?Math.round(value/total*100):0}%"></i></div>`;}).join('')}</div></section></div>`;
}
function settings() {
  const s=data.settings;
  return headings('Configurações','Identidade da loja, contato e cópia dos seus registros.')+
    `<section class="panel pad"><form id="settings-form" class="settings-form">${field('Nome da loja','name',s.name,'text','required maxlength="180"')}${field('Localização / endereço de retirada','location',s.location,'text','required maxlength="180"')}${field('WhatsApp da loja','whatsapp',s.whatsapp,'tel','placeholder="5577999999999" pattern="55[0-9]{10,11}" maxlength="13"')}<p class="help-text">Use 55 + DDD + número, sem espaços. O botão de contato será mostrado no catálogo quando este campo estiver preenchido.</p><div class="actions"><button class="btn primary" type="submit">Salvar configurações</button></div><div class="form-error" role="alert"></div></form></section><section class="panel pad" style="margin-top:22px"><h2>Seus dados, organizados</h2><p class="help-text" style="margin:14px 0">Baixe uma cópia completa do banco de dados. Ela inclui registros comerciais, dados dos clientes e a senha em formato protegido. Guarde-a em local seguro. A restauração é feita com o servidor desligado, conforme o manual.</p><div class="actions"><a class="btn" href="/api/backup">${icon('down',15)}Baixar backup SQLite</a><a class="btn" href="/api/export">${icon('down',15)}Exportar vendas CSV</a></div></section><div class="notice" style="margin-top:22px">Versão inicial: um administrador, retirada na loja e registro manual de pagamentos. Não há emissão fiscal, processamento bancário, cálculo de frete ou sincronização com o Nex.</div>`;
}
function productCards(list, publicView) {
  const source=publicView?publicCart:cart;
  return list.length?list.map(p=>{const chosen=source.find(c=>c.id===p.id)?.quantity||0;return `<article class="product-card"><div class="product-art"><span class="category">${esc(p.category)}</span>${art(p)}</div><div class="product-body"><h3>${esc(p.name)}</h3><div class="product-meta">${esc([p.size,p.color,p.quality].filter(Boolean).join(' · '))}<br>${p.stock?'Disponível para retirada':'Indisponível no momento'}</div><div class="product-price"><b>${money(p.price)}</b>${btn(chosen?'Adicionar +1':'Adicionar',publicView?'public-add':'pos-add','small '+(publicView?'primary':''),'plus',`data-id="${p.id}" ${p.stock<=chosen?'disabled':''}`)}</div></div></article>`;}).join(''):empty('Nenhum produto encontrado','Tente outra categoria ou busca.');
}
function cartItems(items,products,isPublic) {
  return items.length?items.map(i=>{const p=products.find(p=>p.id===i.id);if(!p)return '';return `<div class="cart-item"><div class="cart-item-top"><div><b>${esc(p.name)}</b><br><small>${esc(p.size)} · ${esc(p.sku)}</small></div><b>${money(p.price*i.quantity)}</b></div><div class="quantity"><button type="button" data-action="${isPublic?'public':'pos'}-minus" data-id="${i.id}" aria-label="Diminuir quantidade de ${esc(p.name)}">−</button><span>${i.quantity}</span><button type="button" data-action="${isPublic?'public':'pos'}-add" data-id="${i.id}" aria-label="Aumentar quantidade de ${esc(p.name)}" ${i.quantity>=p.stock?'disabled':''}>+</button><small>${p.stock} disponíveis</small></div></div>`;}).join(''):empty('Seu carrinho está vazio','Escolha um produto para começar.','bag');
}
function cartTotal(items,products) {return items.reduce((a,i)=>a+(products.find(p=>p.id===i.id)?.price||0)*i.quantity,0);}
function pos() {
  return headings('Frente de caixa','Busque o produto, selecione a variação e conclua a venda.',data.cash?pill('Caixa #'+data.cash.id+' aberto'):btn('Abrir caixa','cash-open','primary','plus'))+
    `${data.cash?'':'<div class="notice">Abra o caixa antes de finalizar vendas.</div>'}<div class="split"><section><div class="toolbar">${searchBar(data.products)}</div><div class="product-grid" id="product-results">${productCards(data.products.filter(p=>p.active&&matches(p)),false)}</div></section><aside class="panel cart-panel"><div class="panel-header"><h2>Venda atual</h2>${pill(cart.reduce((a,i)=>a+i.quantity,0)+' itens','gray')}</div><div class="cart-items">${cartItems(cart,data.products,false)}</div><form id="pos-form" class="cart-bottom"><label class="field">Cliente<select name="client_id"><option value="">Consumidor não identificado</option>${data.clients.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}</select></label>${selectField('Forma de pagamento','payment',['Dinheiro','Pix','Débito','Crédito'],'Pix')}${field('Desconto em R$','discount','0.00','number','min="0" step="0.01" required')}<div class="cart-total"><span>Subtotal</span><b>${money(cartTotal(cart,data.products))}</b></div><small class="muted">O desconto será aplicado na confirmação.</small><button class="btn primary" type="submit" style="margin-top:18px" ${!cart.length||!data.cash?'disabled':''}>${icon('check',16)}Revisar e finalizar</button><div class="form-error" role="alert"></div></form></aside></div>`;
}
function renderCatalog() {
  const s={...settingDefault,...catalog.settings};
  $('#app').innerHTML=`<header class="catalog-header">${brand()}<span class="catalog-nav">FUTEBOL &nbsp; / &nbsp; TREINO &nbsp; / &nbsp; SEU ESTILO</span><a class="btn small" href="/gestao">${icon('users',14)}Área da loja</a></header>${demoStrip(s)}<main class="catalog"><section class="catalog-hero"><div><span class="eyebrow" style="color:var(--lime)">DO SEU TIME. DO SEU JEITO.</span><h1>O esporte é sua paixão.<br><em>A nossa também.</em></h1><p>Camisas, chuteiras e acessórios para entrar em campo com atitude. Escolha seus favoritos e envie seu pedido à ${esc(s.name)}.</p><div class="catalog-subtitle"><span>${icon('pin',13)} ${esc(s.location)}</span><span>${icon('bag',13)} Retirada na loja</span></div></div><div class="hero-ball">${icon('ball',155)}</div></section><div class="page-heading"><div><h2>Encontre seu próximo jogo</h2><p>Selecione o tamanho e a cor desejados em cada produto.</p></div>${s.whatsapp?`<a class="btn" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">Falar com a loja ${icon('arrow',14)}</a>`:''}</div><div class="split"><section><div class="toolbar">${searchBar(catalog.products)}</div><div class="product-grid" id="product-results">${productCards(catalog.products.filter(matches),true)}</div><p class="help-text" style="margin-top:20px">Ilustrações de categoria. Confira fotos e detalhes do produto com a loja antes de comprar.</p></section><aside class="panel cart-panel"><div class="panel-header"><h2>Seu pedido</h2>${pill(publicCart.reduce((a,i)=>a+i.quantity,0)+' itens','gray')}</div><div class="cart-items">${cartItems(publicCart,catalog.products,true)}</div><div class="cart-bottom"><div class="cart-total"><span>Total dos produtos</span><b>${money(cartTotal(publicCart,catalog.products))}</b></div><button class="btn primary" type="button" data-action="checkout" ${!publicCart.length?'disabled':''}>Enviar pedido ${icon('arrow',15)}</button><p class="help-text" style="font-size:10px;margin-top:13px">Sem cobrança online. A loja combina o pagamento e a retirada com você. Não inclui entrega.</p></div></aside></div><footer class="catalog-footer"><span>© ${new Date().getFullYear()} ${esc(s.name)} · ${esc(s.location)}</span><span>Feito para quem vive o esporte.</span></footer></main>`;
}
function renderLogin() {
  $('#app').innerHTML=`<main class="login-page"><section class="login-aside">${brand()}<div><span class="eyebrow" style="color:var(--lime)">SEU NEGÓCIO EM MOVIMENTO</span><h1>Paixão pelo esporte.<br><em>Controle da sua loja.</em></h1><p>Vendas, estoque e clientes organizados para a Skinão continuar crescendo em Barreiras e região.</p></div><span class="login-footer">SKINÃO DO ESPORTE · FEIRA LIVRE DE BARREIRAS, BA</span></section><section class="login-form"><div class="login-box"><span class="eyebrow muted">ÁREA DE GESTÃO</span><h2 style="margin-top:16px">Bem-vindo à sua loja.</h2><p class="help-text">Entre para acompanhar o negócio.</p><form id="login-form">${field('Usuário','username','admin','text','required autocomplete="username"')}${field('Senha','password','','password','required autocomplete="current-password"')}<button class="btn primary" type="submit">Entrar na gestão ${icon('arrow',16)}</button><div class="form-error" role="alert"></div></form><a href="/catalogo">← Voltar para o catálogo de produtos</a><p class="help-text" style="font-size:10px;text-align:center;margin-top:24px">No primeiro acesso, a senha é exibida no terminal de quem iniciou o sistema.</p></div></section></main>`;
}
function modal(title,body,submitLabel='Salvar') {
  $('#modal-content').innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div><form id="modal-form">${body}<div class="form-error" role="alert"></div><div class="modal-actions">${btn('Voltar','close-modal')}<button class="btn primary" type="submit">${submitLabel}</button></div></form>`;
  $('#modal').showModal();
}
function infoModal(title,body) {
  $('#modal-content').innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>${body}`;
  $('#modal').showModal();
}
function modalSubmit(fn) { $('#modal-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]');b.disabled=true;try{await fn(Object.fromEntries(new FormData(f)));$('#modal').close();}catch(err){f.querySelector('.form-error').textContent=err.message;}finally{b.disabled=false;}}); }
function productForm(id) {
  const p=data.products.find(p=>p.id===id)||{stock:0,minimum:3,active:1};
  modal(id?'Editar produto':'Novo produto / variação',`<div class="notice info">Cadastre um código diferente para cada tamanho, cor ou padrão de qualidade.</div><div class="form-grid">${field('Nome do produto','name',p.name,'text','required maxlength="180"',true)}${field('Código / SKU','sku',p.sku,'text','required maxlength="180"')}${selectField('Categoria','category',['Camisas','Chuteiras','Infantil','Treino','Bolas','Acessórios','Outros'],p.category||'Camisas')}${field('Time / modalidade','team',p.team,'text','maxlength="180"')}${field('Tamanho / numeração','size',p.size,'text','maxlength="180"')}${field('Cor','color',p.color,'text','maxlength="180"')}${field('Padrão / qualidade','quality',p.quality,'text','maxlength="180"')}${field('Preço de venda (R$)','price',decimal(p.price),'number','required min="0" step="0.01"')}${field('Custo de compra (R$)','cost',decimal(p.cost),'number','required min="0" step="0.01"')}${id?'':field('Estoque inicial','stock',p.stock,'number','required min="0" step="1"')}${field('Estoque mínimo','minimum',p.minimum,'number','required min="0" step="1"')}${selectField('Disponibilidade','active',['Ativo','Inativo'],p.active?'Ativo':'Inativo')}</div>`);
  modalSubmit(async v=>{const payload={...v,price:cents(v.price),cost:cents(v.cost),minimum:Number(v.minimum),active:v.active==='Ativo'?1:0};if(id)payload.id=id;else payload.stock=Number(v.stock);await api('/api/products',payload);await refresh();toast('Produto salvo.');});
}
function receipt(id) {
  const s=data.sales.find(s=>s.id===id),items=data.sale_items.filter(i=>i.sale_id===id);
  infoModal('Recibo da venda',`<article class="receipt"><h3>${esc(data.settings.name)}</h3><p class="muted">${esc(data.settings.location)}<br>COMPROVANTE SEM VALOR FISCAL</p><p>Venda #${s.id} · ${date(s.created)}<br>Cliente: ${esc(s.customer)}<br>Pagamento registrado: ${esc(s.payment)}${s.canceled?'<br><b>VENDA ESTORNADA</b>':''}</p>${table(['Produto','Qtd.','Valor'],items.map(i=>`<tr><td>${esc(i.name)}<small>${esc(i.sku)}</small></td><td>${i.quantity}</td><td>${money(i.price*i.quantity)}</td></tr>`).join(''))}<p>Subtotal: ${money(s.subtotal)}<br>Desconto: ${money(s.discount)}</p><div class="receipt-total"><span>Total</span><span>${money(s.total)}</span></div><p class="muted">Obrigado por jogar com a Skinão!</p></article><div class="modal-actions">${btn('Fechar','close-modal')}${btn('Imprimir','print','primary')}</div>`);
}
async function perform(action,id) {
  if(action==='close-modal')return $('#modal').close();
  if(action==='print')return window.print();
  if(action==='open-catalog'){location.href='/catalogo';return;}
  if(action==='refresh')return refresh();
  if(action==='tab'){tab=id;filter='';category='Todas';render();return;}
  if(action==='logout'){await api('/api/logout',{});csrf='';renderLogin();return;}
  if(action==='new-product'||action==='edit-product')return productForm(action==='new-product'?null:Number(id));
  if(action==='receipt')return receipt(Number(id));
  if(action==='adjust-stock'){
    const p=data.products.find(p=>p.id===Number(id));
    modal('Ajustar estoque',`<p class="help-text" style="margin-bottom:20px">${esc(p.name)} · ${esc(p.sku)}<br>Saldo atual: <b>${p.stock} unidades</b>. Use valor positivo para entrada e negativo para saída.</p><div class="form-grid">${field('Quantidade a movimentar','delta','','number','required step="1" min="-1000000" max="1000000"',true)}${field('Motivo da movimentação','reason','','text','required maxlength="180" placeholder="Ex.: compra do fornecedor, perda, contagem"',true)}</div>`);
    modalSubmit(async v=>{await api('/api/stock',{id:p.id,delta:Number(v.delta),reason:v.reason});await refresh();toast('Estoque atualizado.');});return;
  }
  if(action==='stock-history'){infoModal('Movimentações de estoque',data.stock_log.length?table(['Produto / motivo','Data','Quantidade'],data.stock_log.map(l=>`<tr><td>${esc(l.name)}<small>${esc(l.reason)} · ${esc(l.sku)}</small></td><td>${date(l.created)}</td><td class="${l.delta<0?'negative':'positive'}">${l.delta>0?'+':''}${l.delta}</td></tr>`).join('')):empty('Nenhuma movimentação','O histórico aparecerá após o primeiro cadastro.'));return;}
  if(action==='new-client'){
    modal('Cadastrar cliente',`<div class="form-grid">${field('Nome completo','name','','text','required maxlength="180"',true)}${field('Telefone com DDD','phone','','tel','maxlength="40"',true)}</div>`);
    modalSubmit(async v=>{await api('/api/clients',v);await refresh();toast('Cliente cadastrado.');});return;
  }
  if(action==='client-history'){const c=data.clients.find(c=>c.id===Number(id));infoModal(esc(c.name),salesTable(data.sales.filter(s=>s.client_id===c.id),true));return;}
  if(action==='cash-open'){
    modal('Abrir caixa',field('Fundo inicial em dinheiro (R$)','amount','0.00','number','required min="0" step="0.01"'));
    modalSubmit(async v=>{await api('/api/cash/open',{amount:cents(v.amount)});await refresh();toast('Caixa aberto.');});return;
  }
  if(action==='cash-move'){
    modal('Movimentar dinheiro',`<div class="form-grid">${selectField('Tipo','kind',['Sangria','Suprimento'],'Sangria')}${field('Valor em dinheiro (R$)','amount','','number','required min="0.01" step="0.01"')}${field('Motivo','note','','text','required maxlength="180"',true)}</div>`);
    modalSubmit(async v=>{await api('/api/cash/move',{...v,amount:cents(v.amount)});await refresh();toast('Movimentação registrada.');});return;
  }
  if(action==='cash-close'){
    modal('Conferir e fechar caixa',`<div class="notice info">Dinheiro esperado na gaveta: <b>${money(data.cash.expected)}</b>. Conte somente o dinheiro físico. Pix e cartões não entram nessa contagem.</div><div class="form-grid">${field('Dinheiro contado (R$)','amount','','number','required min="0" step="0.01"',true)}${field('Observação / diferença','note','','text','maxlength="180"',true)}</div>`,'Fechar caixa');
    modalSubmit(async v=>{await api('/api/cash/close',{...v,amount:cents(v.amount)});await refresh();toast('Caixa fechado e conferência registrada.');});return;
  }
  if(action==='cancel-sale'){
    modal('Estornar venda #'+id,'<p class="help-text">Os produtos voltarão ao estoque e a venda será retirada do faturamento. Se houve pagamento, faça a devolução ao cliente separadamente. Esta ação não movimenta contas bancárias.</p>','Confirmar estorno');
    modalSubmit(async()=>{await api('/api/sales/cancel',{id:Number(id)});await refresh();toast('Venda estornada.');});return;
  }
  if(action==='cancel-order'){
    modal('Cancelar pedido #'+id,'<p class="help-text">A reserva será cancelada e os produtos voltarão ao estoque disponível.</p>','Cancelar pedido');
    modalSubmit(async()=>{await api('/api/orders/status',{id:Number(id),status:'Cancelado'});await refresh();toast('Pedido cancelado e estoque liberado.');});return;
  }
  if(action==='confirm-order'){
    modal('Confirmar pedido #'+id,`<div class="notice">Confirme somente depois de receber o pagamento. O sistema registra a venda, mas não verifica transferências nem cobra o cliente.</div>${selectField('Pagamento recebido','payment',['Dinheiro','Pix','Débito','Crédito'],'Pix')}`,'Registrar recebimento');
    modalSubmit(async v=>{await api('/api/orders/status',{id:Number(id),status:'Confirmado',payment:v.payment});await refresh();toast('Pedido convertido em venda.');});return;
  }
  if(['pos-add','pos-minus','public-add','public-minus'].includes(action)){
    const pub=action.startsWith('public'),items=pub?publicCart:cart, products=pub?catalog.products:data.products;
    const p=products.find(p=>p.id===Number(id)),i=items.find(i=>i.id===Number(id));
    if(!p)return;
    if(action.endsWith('minus')){if(i)i.quantity--;}
    else {if((i?.quantity||0)>=p.stock)return toast('Limite de estoque atingido.');if(i)i.quantity++;else items.push({id:p.id,quantity:1});}
    if(pub)publicCart=items.filter(i=>i.quantity>0);else cart=items.filter(i=>i.quantity>0);
    render();return;
  }
  if(action==='checkout'){
    modal('Enviar pedido à loja',`<div class="notice info">Total dos produtos: <b>${money(cartTotal(publicCart,catalog.products))}</b><br>Retirada em ${esc(catalog.settings.location)}. Nenhum pagamento será cobrado online.</div><div class="form-grid">${field('Seu nome','customer','','text','required maxlength="180" autocomplete="name"',true)}${field('Telefone / WhatsApp com DDD','phone','','tel','required maxlength="40" autocomplete="tel"',true)}<label class="field full">Observações (opcional)<textarea name="note" maxlength="500" placeholder="Conte o que a loja precisa saber para atender seu pedido."></textarea></label><label class="help-text field full"><span><input type="checkbox" required> Autorizo a loja a usar meu nome e telefone para atender este pedido.</span></label></div>`,'Confirmar pedido');
    modalSubmit(async v=>{const result=await api('/api/orders',{...v,items:publicCart});publicCart=[];await refresh();setTimeout(()=>infoModal('Pedido #'+String(result.id).padStart(4,'0')+' recebido',`<div class="empty">${icon('check',40)}<strong>Agora é com a Skinão!</strong>A loja vai combinar o pagamento e a retirada pelo telefone informado.<br>Total: <b>${money(result.total)}</b><br>Nenhum pagamento foi cobrado.</div><div class="modal-actions">${btn('Continuar no catálogo','close-modal','primary')}</div>`),0);});return;
  }
  if(action==='report-filter'){const start=$('#report-start').value,end=$('#report-end').value;if(!start||!end||start>end)return toast('Confira o período: a data inicial deve vir antes da final.');reportStart=start;reportEnd=end;render();return;}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)perform(b.dataset.action,b.dataset.id).catch(err=>toast(err.message));});
document.addEventListener('input',e=>{
  if(e.target.id==='search'){filter=e.target.value;updateResults();}
});
document.addEventListener('change',e=>{
  if(e.target.id==='category'){category=e.target.value;updateResults();}
  if(e.target.id==='order-filter'){orderFilter=e.target.value;render();}
});
function updateResults(){const dest=$('#product-results');if(!dest)return;if(catalogMode)dest.innerHTML=productCards(catalog.products.filter(matches),true);else if(tab==='products')dest.innerHTML=productRows();else if(tab==='pos')dest.innerHTML=productCards(data.products.filter(p=>p.active&&matches(p)),false);}
document.addEventListener('submit',async e=>{
  const form=e.target;if(!['login-form','settings-form','pos-form'].includes(form.id))return;
  e.preventDefault();const b=form.querySelector('[type="submit"]');b.disabled=true;const v=Object.fromEntries(new FormData(form));
  try{
    if(form.id==='login-form'){const session=await api('/api/login',v);csrf=session.csrf;await refresh();}
    if(form.id==='settings-form'){await api('/api/settings',v);await refresh();toast('Configurações salvas.');}
    if(form.id==='pos-form'){
      const discount=cents(v.discount),total=cartTotal(cart,data.products)-discount;
      if(total<0)throw new Error('O desconto não pode ultrapassar o subtotal.');
      modal('Revisar venda',`<p class="help-text">Cliente: ${esc(data.clients.find(c=>c.id===Number(v.client_id))?.name || 'Consumidor')}<br>Forma de pagamento: ${esc(v.payment)}<br>Desconto: ${money(discount)}</p><div class="cart-total"><span>Total a receber</span><b>${money(total)}</b></div><div class="notice info">Confirme depois de receber o pagamento. Pix e cartões são registros manuais, sem cobrança integrada.</div>`,'Pagamento recebido · concluir');
      const snapshot=cart.map(i=>({...i}));
      modalSubmit(async()=>{const result=await api('/api/sales',{items:snapshot,client_id:v.client_id?Number(v.client_id):null,payment:v.payment,discount});cart=[];await refresh();setTimeout(()=>receipt(result.id),0);});
    }
  }catch(err){form.querySelector('.form-error').textContent=err.message;}finally{b.disabled=false;}
});
async function boot(){try{if(catalogMode)await refresh();else{const session=await api('/api/session');csrf=session.csrf||'';if(session.authenticated)await refresh();else renderLogin();}}catch(err){$('#app').innerHTML=`<main class="empty"><strong>Não foi possível carregar o sistema</strong>${esc(err.message)}<p>Inicie o servidor e recarregue esta página.</p></main>`;}}
boot();
