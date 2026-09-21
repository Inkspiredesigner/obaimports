// ==========================================
// 1. UTILITÁRIOS & FORMATAÇÃO
// ==========================================
function formatBRL(value) {
  const num = Number(value) || 0;
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  
  let str = String(val).trim();
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function extractPrice(f) {
  const keys = ['PrecoVarejo', 'Preço Varejo', 'Preco', 'Preço', 'Valor', 'valor', 'Price', 'price', 'Status'];
  for (let key of keys) {
    if (f[key] !== undefined && f[key] !== null) {
      let p = parsePrice(f[key]);
      if (p > 0) return p;
    }
  }
  return 0;
}

function clearCheckoutError() {
  const errEl = document.getElementById('checkout-error');
  if (errEl) {
    errEl.innerText = '';
    errEl.classList.add('hidden');
  }
}

function showCheckoutError(msg) {
  const errEl = document.getElementById('checkout-error');
  if (errEl) {
    errEl.innerText = msg;
    errEl.classList.remove('hidden');
  } else {
    alert(msg);
  }
}

// ==========================================
// 2. CONFIGURAÇÃO & INTEGRAÇÃO COM AIRTABLE
// ==========================================
let productsData = [];

async function fetchAllAirtableProducts(offset = '') {
  let url = `/api/products`;
  if (offset) {
    url += `?offset=${encodeURIComponent(offset)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erro na API: ${response.statusText}`);
  }

  const data = await response.json();
  let records = data.records || [];

  if (data.offset) {
    const nextRecords = await fetchAllAirtableProducts(data.offset);
    records = records.concat(nextRecords);
  }

  return records;
}

function mapAirtableRecordToProduct(record) {
  const f = record.fields || {};

  const rawNome = f.Nome || f.nome || f.Name || f.name || f.Produto || f.produto || Object.values(f)[0] || "Produto sem nome";
  const nomeProduto = String(rawNome).trim();

  let rawCat = f.categoria || f.Categoria || f.Category || f.category;
  if (Array.isArray(rawCat)) {
    rawCat = rawCat.length > 0 ? rawCat[0] : "50ml";
  }
  
  let categoriaTratada = String(rawCat || "50ml").trim();
  const catLower = categoriaTratada.toLowerCase().replace(/\s+/g, '');
  
  if (catLower.includes('wepink')) {
    categoriaTratada = 'Wepink';
  } else if (catLower.includes('150ml') || catLower.includes('infantil')) { 
    categoriaTratada = '150ml';
  } else if (catLower.includes('50ml')) {
    categoriaTratada = '50ml';
  } else if (catLower.includes('100ml')) {
    categoriaTratada = '100ml';
  } else if (catLower.includes('bodybrand') || catLower.includes('brand')) {
    categoriaTratada = 'bodybrand';
  } else if (catLower.includes('body') || catLower.includes('splash')) {
    categoriaTratada = 'bodysplash';
  } else if (catLower.includes('creme') || catLower.includes('hidratante')) {
    categoriaTratada = 'cremes';
  } else if (catLower.includes('mini')) {
    categoriaTratada = 'miniaturas';
  }

  let imageUrl = "https://via.placeholder.com/300";
  
  const imgObj = (Array.isArray(f.imagem) && f.imagem.length > 0) ? f.imagem[0]
               : (Array.isArray(f.Imagem) && f.Imagem.length > 0) ? f.Imagem[0]
               : null;

  if (imgObj) {
    imageUrl = imgObj.thumbnails?.full?.url || imgObj.thumbnails?.large?.url || imgObj.url || imageUrl;
  } else if (typeof f.imagem === 'string' && f.imagem.trim() !== '') {
    imageUrl = f.imagem;
  } else if (typeof f.Imagem === 'string' && f.Imagem.trim() !== '') {
    imageUrl = f.Imagem;
  }

  const preco = extractPrice(f);
  const status2 = f['Status 2'] || f.Status2 || f.Disponivel || f.disponivel;
  const isAvailable = status2 === 'Disponivel' || status2 === 'Disponível' || status2 === true || status2 === undefined;

  const safeId = String(record.id).replace(/[^a-zA-Z0-9_-]/g, '');

  return {
    id: safeId,
    name: nomeProduto,
    category: categoriaTratada,
    retailPrice: preco,
    image: imageUrl,
    badge: f.badge || f.Badge || "Destaque",
    badgeClass: f.badgeClass || f.BadgeClass || "badge-top",
    description: f.description || f.Description || f.Descricao || f.Descrição || "",
    available: isAvailable
  };
}

async function loadProductsFromAirtable() {
  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px; color: var(--accent-gold, #d4af37);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.2rem;"></i>
        <p style="margin-top: 15px; font-size: 1.05rem; font-weight: 500;">Carregando catálogo completo de perfumes...</p>
      </div>`;
  }

  try {
    const records = await fetchAllAirtableProducts();
    productsData = records.map(mapAirtableRecordToProduct);
    renderProducts();
  } catch (error) {
    console.error("Erro ao carregar produtos do Airtable:", error);
    if (grid) {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding: 40px; color: #ef4444;">Ops! Não foi possível carregar os produtos.</p>`;
    }
  }
}

// ==========================================
// 3. ESTADO GLOBAL & PERSISTÊNCIA
// ==========================================
let cart = [];
let currentCategory = "todos";
let searchQuery = "";

function saveCart() {
  try {
    localStorage.setItem('aliba_perfumes_cart', JSON.stringify(cart));
  } catch (e) {
    console.error("Erro ao salvar carrinho:", e);
  }
}

function loadCart() {
  try {
    const saved = localStorage.getItem('aliba_perfumes_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }
}

// ==========================================
// 4. TOAST FLUTUANTE
// ==========================================
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `✨ <span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ==========================================
// 5. PRECIFICAÇÃO DINÂMICA
// ==========================================
function getCategoryQuantities(cartState = cart) {
  const totals = {
    '50ml': 0, '100ml': 0, '150ml': 0,
    'bodysplash': 0, 'bodybrand': 0, 'cremes': 0,
    'miniaturas': 0, 'Wepink': 0, totalGeral: 0
  };

  for (let item of cartState) {
    const cat = item.category;
    const qty = item.qty || 0;
    if (totals[cat] !== undefined) totals[cat] += qty;
    else totals[cat] = qty;
    totals.totalGeral += qty;
  }
  return totals;
}

function getItemUnitPrice(item, cartState = cart, totals = null) {
  const q = totals || getCategoryQuantities(cartState);
  const totalGeral = q.totalGeral || 0;
  const catQty = q[item.category] || 0;

  if (item.category === 'bodybrand') {
    if (catQty >= 10 || totalGeral >= 10) return 48.00;
    return item.retailPrice;
  }

  if (item.category === '150ml') {
    if (catQty >= 100) return 18.99;
    if (catQty >= 10)  return 19.99;
    return item.retailPrice;
  }

  if (item.category === '50ml') {
    if (catQty >= 70)  return 15.00;
    if (catQty >= 50)  return 15.50;
    if (catQty >= 30)  return 16.00;
    if (catQty >= 20)  return 17.00;
    if (catQty >= 10 || totalGeral >= 10) return 17.50;
    if (catQty >= 6)   return 22.00;
    return item.retailPrice;
  }

  if (item.category === '100ml') {
    if (catQty >= 500) return 12.90;
    if (catQty >= 70)  return 15.00;
    if (catQty >= 50)  return 16.00;
    if (catQty >= 30)  return 17.00;
    if (catQty >= 10 || totalGeral >= 10) return 18.00;
    return item.retailPrice;
  }

  if (item.category === 'bodysplash') {
    if (catQty >= 70)  return 14.00;
    if (catQty >= 30)  return 15.00;
    if (catQty >= 10 || totalGeral >= 10) return 16.00;
    return item.retailPrice;
  }

  if (item.category === 'cremes') {
    if (catQty >= 50) return 14.00;
    if (catQty >= 30) return 15.00;
    if (catQty >= 10 || totalGeral >= 10) return 16.00;
    return item.retailPrice;
  }

  if (item.category === 'Wepink') {
    if (catQty >= 6 || totalGeral >= 10) return 22.00;
    return item.retailPrice;
  }

  if (item.category === 'miniaturas') {
    if (catQty >= 6 || totalGeral >= 10) return 12.00;
    return item.retailPrice;
  }

  return item.retailPrice;
}

function isWholesaleOrder(cartState = cart) {
  const q = getCategoryQuantities(cartState);
  return (
    q.totalGeral >= 10 ||
    q['50ml'] >= 6 ||
    q['100ml'] >= 10 ||
    q['150ml'] >= 10 ||
    q['bodysplash'] >= 10 ||
    q['bodybrand'] >= 10 ||
    q['cremes'] >= 10 ||
    q['Wepink'] >= 6 ||
    q['miniaturas'] >= 6
  );
}

// ==========================================
// 6. RENDERIZAÇÃO E ATUALIZAÇÃO DA VITRINE
// ==========================================
function handleSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    searchQuery = input.value.toLowerCase().trim();
    renderProducts();
  }
}

function renderCardPriceHTML(p, unitPrice, isAvailable) {
  if (!isAvailable) return `<div class="price-wholesale"><strong style="color: #ef4444;">Fora de estoque</strong></div>`;
  
  const isDiscounted = unitPrice < p.retailPrice;
  if (isDiscounted) {
    return `
      <div class="price-retail">De: <span class="price-old">${formatBRL(p.retailPrice)}</span></div>
      <div class="price-wholesale" style="color: var(--accent-gold, #d4af37); font-weight: bold; font-size: 1rem;">
        Por: ${formatBRL(unitPrice)} un
      </div>`;
  }
  return `
    <div class="price-retail">Valor unitário: <span>${formatBRL(p.retailPrice)}</span></div>
    <div class="price-wholesale" style="font-size: 0.8rem; opacity: 0.85;">Desconto progressivo no atacado</div>`;
}

function renderCardActionHTML(p, isAvailable) {
  const idSafe = p.id;
  if (!isAvailable) {
    return `<button type="button" class="add-btn" disabled style="background: #27272a; color: #71717a; border: 1px solid #3f3f46; cursor: not-allowed; box-shadow: none; width: 100%;">Esgotado</button>`;
  }
  
  const cartItem = cart.find(item => String(item.id) === String(idSafe));
  const currentQty = cartItem ? cartItem.qty : 0;

  if (currentQty > 0) {
    return `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
        <button type="button" class="add-btn" style="padding: 6px 12px; width: auto;" onclick="event.stopPropagation(); updateQty('${idSafe}', -1);">-</button>
        <span style="color: #000000; font-weight: bold; font-size: 0.95rem;">${currentQty}</span>
        <button type="button" class="add-btn" style="padding: 6px 12px; width: auto;" onclick="event.stopPropagation(); updateQty('${idSafe}', 1);">+</button>
      </div>`;
  }
  return `<button type="button" class="add-btn" style="width: 100%;" onclick="event.stopPropagation(); addToCart('${idSafe}', this);">+ Adicionar</button>`;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const filtered = productsData.filter(p => {
    const matchesCat = currentCategory.toLowerCase() === "todos" || p.category.toLowerCase() === currentCategory.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted, #777);">Nenhum item encontrado para a sua busca.</p>`;
    return;
  }

  const totalsCategory = getCategoryQuantities(cart);

  grid.innerHTML = filtered.map(p => {
    const nameSafe = escapeHTML(p.name);
    let badgeSafe = escapeHTML(p.badge);
    let badgeClassSafe = escapeHTML(p.badgeClass);
    const imageSafe = escapeHTML(p.image);
    const idSafe = p.id;
    const isAvailable = p.available !== false;

    if (!isAvailable) {
      badgeSafe = "ESGOTADO";
      badgeClassSafe = "badge-promocao";
    }

    const unitPrice = getItemUnitPrice(p, cart, totalsCategory);

    return `
      <div class="product-card" ${isAvailable ? '' : 'style="opacity: 0.75;"'}>
        <span class="badge ${badgeClassSafe}">${badgeSafe}</span>
        <img src="${imageSafe}" loading="lazy" class="product-img" alt="${nameSafe}" onclick="openProductModal('${idSafe}')">
        <h3 class="product-title" onclick="openProductModal('${idSafe}')">${nameSafe}</h3>
        
        <div class="price-box" id="card-price-${idSafe}">
          ${renderCardPriceHTML(p, unitPrice, isAvailable)}
        </div>
        
        <div class="card-actions">
          <div id="card-action-${idSafe}" style="width: 100%;">
            ${renderCardActionHTML(p, isAvailable)}
          </div>
          <button type="button" class="notice-btn" style="padding: 8px; font-size: 0.8rem;" onclick="openProductModal('${idSafe}')">Detalhes</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateCatalogUI() {
  const totalsCategory = getCategoryQuantities(cart);
  
  productsData.forEach(p => {
    const idSafe = p.id;
    const priceEl = document.getElementById(`card-price-${idSafe}`);
    const actionEl = document.getElementById(`card-action-${idSafe}`);
    const isAvailable = p.available !== false;
    const unitPrice = getItemUnitPrice(p, cart, totalsCategory);

    if (priceEl) priceEl.innerHTML = renderCardPriceHTML(p, unitPrice, isAvailable);
    if (actionEl) actionEl.innerHTML = renderCardActionHTML(p, isAvailable);
  });
}

function filterCategory(cat, btn = null) {
  currentCategory = cat;

  document.querySelectorAll('.cat-btn').forEach(b => {
    const attr = b.getAttribute('onclick') || '';
    if (b === btn || attr.includes(`'${cat}'`)) b.classList.add('active');
    else b.classList.remove('active');
  });

  document.querySelectorAll('.drawer-cat-btn').forEach(b => {
    const attr = b.getAttribute('onclick') || '';
    if (b === btn || attr.includes(`'${cat}'`)) b.classList.add('active');
    else b.classList.remove('active');
  });

  renderProducts();
}

// ==========================================
// 7. CONTROLE DA GAVETA LATERAL
// ==========================================
function toggleCategoryDrawer() {
  const drawer = document.getElementById('category-drawer');
  const overlay = document.getElementById('category-overlay');
  if (drawer && overlay) {
    drawer.classList.toggle('open');
    drawer.classList.toggle('active');
    overlay.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}

function selectDrawerCategory(category, btnElement) {
  filterCategory(category, btnElement);
  toggleCategoryDrawer();
}

// ==========================================
// 8. MODAL DE DETALHES DO PRODUTO
// ==========================================
function openProductModal(id) {
  const p = productsData.find(item => String(item.id) === String(id));
  if (!p) return;

  const modal = document.getElementById('product-modal');
  const body = document.getElementById('product-detail-body');
  if (!modal || !body) return;

  const nameSafe = escapeHTML(p.name);
  let badgeSafe = escapeHTML(p.badge);
  let badgeClassSafe = escapeHTML(p.badgeClass);
  const imageSafe = escapeHTML(p.image);
  const descSafe = escapeHTML(p.description);
  const idSafe = p.id;
  const isAvailable = p.available !== false;

  if (!isAvailable) {
    badgeSafe = "ESGOTADO";
    badgeClassSafe = "badge-promocao";
  }

  const modalButton = isAvailable
    ? `<button type="button" class="add-btn" style="width: 100%; margin-top: 15px; padding: 12px; font-size: 1rem;" onclick="addToCart('${idSafe}', this); closeProductModal();">+ Adicionar ao Carrinho</button>`
    : `<button type="button" class="add-btn" disabled style="width: 100%; margin-top: 15px; padding: 12px; font-size: 1rem; background: #27272a; color: #71717a; cursor: not-allowed;">Produto Esgotado</button>`;

  body.innerHTML = `
    <img src="${imageSafe}" loading="lazy" class="modal-img" alt="${nameSafe}" style="max-width: 100%; height: 180px; object-fit: contain;">
    <span class="badge ${badgeClassSafe}" style="margin-top: 10px; display: inline-block;">${badgeSafe}</span>
    <h2 class="modal-title" style="margin-top: 10px; color: #0f172a;">${nameSafe}</h2>
    <div class="price-wholesale" style="font-size: 1.15rem; margin: 8px 0; color: #d97706; font-weight: 800;">
      Valor base: ${formatBRL(p.retailPrice)}
    </div>
    <p class="modal-desc" style="color: #475569; font-size: 0.9rem; line-height: 1.5;">${descSafe}</p>
    ${modalButton}
  `;

  modal.classList.remove('hidden');
  modal.classList.add('open');
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('open');
  }
}

// ==========================================
// 9. GERENCIAMENTO DO CARRINHO
// ==========================================
function addToCart(id, btn) {
  const p = productsData.find(item => String(item.id) === String(id));
  if (!p || p.available === false) return;

  const existing = cart.find(item => String(item.id) === String(id));
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });

  if (btn) {
    const originalText = btn.innerText;
    btn.classList.add('added');
    btn.innerText = "✓ Adicionado";
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerText = originalText;
    }, 800);
  }

  clearCheckoutError();
  saveCart();
  updateCart();
}

function updateQty(id, delta) {
  const item = cart.find(i => String(i.id) === String(id));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => String(i.id) !== String(id));

  saveCart();
  updateCart();
}

function setQty(id, value) {
  const item = cart.find(i => String(i.id) === String(id));
  if (!item) return;

  const newQty = parseInt(value, 10);
  if (isNaN(newQty) || newQty <= 0) cart = cart.filter(i => String(i.id) !== String(id));
  else item.qty = newQty;

  saveCart();
  updateCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm("Deseja realmente esvaziar seu carrinho?")) {
    cart = [];
    showToast("Carrinho esvaziado.");
    saveCart();
    updateCart();
  }
}

function updateCart() {
  const totalsCategory = getCategoryQuantities(cart);
  const totalItems = totalsCategory.totalGeral;
  let totalValue = 0;
  let totalRetailValue = 0;

  const container = document.getElementById('cart-items');
  if (container) {
    container.innerHTML = cart.length === 0
      ? '<p style="text-align:center; color: #a1a1aa; margin: 30px 0;">Seu carrinho está vazio.</p>'
      : cart.map(item => {
          const unitPrice = getItemUnitPrice(item, cart, totalsCategory);
          const itemTotal = unitPrice * item.qty;
          
          totalValue += itemTotal;
          totalRetailValue += (item.retailPrice || unitPrice) * item.qty;

          const nameSafe = escapeHTML(item.name);
          const idSafe = item.id;
          const hasDiscount = unitPrice < (item.retailPrice || unitPrice);
          const discountTag = hasDiscount ? '(Desconto aplicado)' : '';

          return `
            <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #27272a;">
              <div class="cart-item-info">
                <h4 style="font-size:0.88rem; color:#ffffff; margin:0 0 4px 0;">${nameSafe}</h4>
                <small style="color:var(--accent-gold, #d4af37);">${formatBRL(unitPrice)} un ${discountTag}</small>
              </div>
              <div class="qty-controls" style="display: flex; align-items: center; gap: 4px;">
                <button type="button" onclick="event.preventDefault(); updateQty('${idSafe}', -1);">-</button>
                <input 
                  type="number" 
                  min="1" 
                  value="${item.qty}" 
                  onchange="setQty('${idSafe}', this.value)"
                  style="width: 45px; text-align: center; background: #ffffff; border: 1px solid #3f3f46; color: #000000; font-weight: 800; border-radius: 6px; padding: 4px; font-size: 0.85rem; outline: none;"
                />
                <button type="button" onclick="event.preventDefault(); updateQty('${idSafe}', 1);">+</button>
              </div>
            </div>
          `;
        }).join('');
  }

  const count = document.getElementById('cart-count');
  const totalBar = document.getElementById('cart-total');
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalTotal = document.getElementById('modal-total');
  const savingsBox = document.getElementById('cart-savings');

  const formattedTotal = formatBRL(totalValue);
  const formattedSubtotal = formatBRL(totalRetailValue);

  if (count) count.innerText = totalItems;
  if (totalBar) totalBar.innerText = formattedTotal;
  if (modalSubtotal) modalSubtotal.innerText = formattedSubtotal;
  if (modalTotal) modalTotal.innerText = formattedTotal;

  const savingsAmount = totalRetailValue - totalValue;

  if (savingsBox) {
    if (savingsAmount > 0) {
      savingsBox.innerHTML = `🔥 <strong>Economia no Atacado: ${formatBRL(savingsAmount)}!</strong>`;
      savingsBox.classList.remove('hidden');
    } else {
      savingsBox.classList.add('hidden');
    }
  }

  updateCatalogUI();
}

function toggleCart() {
  const modal = document.getElementById('cart-modal');
  if (modal) {
    modal.classList.toggle('open');
    modal.classList.toggle('active');
  }
}

function closeCart() {
  const modal = document.getElementById('cart-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('active');
  }
}

// ==========================================
// 10. MODAL TABELA DE PREÇOS
// ==========================================
function openPriceTableModal() {
  const modal = document.getElementById('price-table-modal');
  if (modal) modal.classList.add('open');
}

function closePriceTableModal() {
  const modal = document.getElementById('price-table-modal');
  if (modal) modal.classList.remove('open');
}

// ==========================================
// 11. MÁSCARAS E VALIDAÇÃO DE FORMULÁRIO
// ==========================================
function setupInputMasks() {
  const cpfInput = document.getElementById('client-cpf');
  const cepInput = document.getElementById('client-cep');

  if (cpfInput) {
    cpfInput.addEventListener('input', function(e) {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      e.target.value = v;
    });
  }

  if (cepInput) {
    cepInput.addEventListener('input', function(e) {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 8) v = v.slice(0, 8);
      v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      e.target.value = v;
    });
  }
}

function validateCPF(cpf) {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11 || /^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0, remainder;
  for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

// ==========================================
// 12. ENVIO PARA WHATSAPP & IMPRESSÃO EM PDF
// ==========================================
async function sendWhatsApp() {
  clearCheckoutError();

  if (typeof cart === 'undefined' || cart.length === 0) {
    showCheckoutError("⚠️ Seu carrinho está vazio!");
    return;
  }

  const name = (document.getElementById('client-name')?.value || '').trim();
  const city = (document.getElementById('client-city')?.value || '').trim();
  const address = (document.getElementById('client-address')?.value || '').trim();
  const cep = (document.getElementById('client-cep')?.value || '').trim();
  const cpf = (document.getElementById('client-cpf')?.value || '').trim();
  const payment = (document.getElementById('payment-method')?.value || '').trim() || "Não informado";
  const shipping = (document.getElementById('shipping-method')?.value || '').trim() || "Não informado";

  if (!name || !city || !address) {
    showCheckoutError("⚠️ Por favor, preencha os campos obrigatórios: Nome, Cidade e Endereço.");
    return;
  }

  let totalValue = 0;
  let totalRetailValue = 0;
  
  let msg = `📦 *NOVO PEDIDO - OBA PERFUMES*\n------------------------------------\n`;
  msg += `👤 *Cliente:* ${name}\n📍 *Cidade/UF:* ${city}\n`;
  if (cpf) msg += `🪪 *CPF:* ${cpf}\n`;
  msg += `🏠 *Endereço:* ${address}\n`;
  if (cep) msg += `📮 *CEP:* ${cep}\n`;
  msg += `💳 *Pagamento:* ${payment}\n🚚 *Forma de Envio:* ${shipping}\n------------------------------------\n`;

  msg += `🛒 *ITENS DO PEDIDO:*\n\n`;

  const orderItemsData = [];
  const totalsCategory = typeof getCategoryQuantities === 'function' ? getCategoryQuantities(cart) : null;

  cart.forEach(item => {
    const unitPrice = typeof getItemUnitPrice === 'function' ? getItemUnitPrice(item, cart, totalsCategory) : (item.retailPrice || 0);
    const itemTotal = unitPrice * item.qty;
    totalValue += itemTotal;
    totalRetailValue += (item.retailPrice || unitPrice) * item.qty;

    msg += `• ${item.qty}x ${item.name}\n  (${formatBRL(unitPrice)} un) = *${formatBRL(itemTotal)}*\n\n`;

    orderItemsData.push({
      name: item.name,
      qty: item.qty,
      unitPrice: unitPrice,
      subtotal: itemTotal
    });
  });

  const savings = totalRetailValue - totalValue;

  msg += `------------------------------------\n`;
  msg += `💵 *Valor Varejo:* ${formatBRL(totalRetailValue)}\n`;
  if (savings > 0) msg += `🔥 *Desconto Atacado:* - ${formatBRL(savings)}\n`;
  msg += `\n💰 *TOTAL DOS PRODUTOS: ${formatBRL(totalValue)}*\n`;

  try {
    const nameArray = name.split(' ');
    const safeName = nameArray.length > 1 ? `${nameArray[0]} ${nameArray[1][0]}.` : nameArray[0];

    const orderPayload = {
      client: safeName,
      city: city,
      payment: payment,
      shipping: shipping,
      items: orderItemsData,
      totalRetailValue, savings, totalValue,
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const encodedData = encodeURIComponent(JSON.stringify(orderPayload));
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const fullPdfLink = `${baseUrl}/comprovante.html?pedido=${encodedData}`;

    // Encurtador compatível com requisições do navegador (CORS Habilitado)
    let finalLink = fullPdfLink;
    try {
      const response = await fetch('https://spoo.me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({ url: fullPdfLink })
      });
      const data = await response.json();
      if (data && data.short_url) {
        finalLink = data.short_url;
      }
    } catch (err) {
      console.warn("Falha ao encurtar o link, utilizando o link padrão:", err);
    }

    msg += `\n📄 *Link do comprovante da compra de ${name}:*\n${finalLink}\n`;
  } catch (e) {
    console.error("Erro ao gerar o link do PDF:", e);
  }

  const rawPhone = "558592394428";
  window.location.href = `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`;
}

function printOrder() {
  clearCheckoutError();

  if (!cart || cart.length === 0) {
    showCheckoutError("⚠️ Seu carrinho está vazio para gerar o comprovante!");
    return;
  }

  const name = document.getElementById('client-name')?.value.trim() || "Cliente não identificado";
  const city = document.getElementById('client-city')?.value.trim() || "Não informada";
  const address = document.getElementById('client-address')?.value.trim() || "Não informado";
  const cep = document.getElementById('client-cep')?.value.trim() || "";
  const cpf = document.getElementById('client-cpf')?.value.trim() || "";
  const payment = document.getElementById('payment-method')?.value.trim() || "Não informado";
  const shipping = document.getElementById('shipping-method')?.value.trim() || "Não informado";

  const totalsCategory = getCategoryQuantities(cart);
  let totalValue = 0;
  let totalRetailValue = 0;

  let itemsHtml = '';
  cart.forEach(item => {
    const unitPrice = getItemUnitPrice(item, cart, totalsCategory);
    const itemTotal = unitPrice * item.qty;
    totalValue += itemTotal;
    totalRetailValue += (item.retailPrice || unitPrice) * item.qty;

    itemsHtml += `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHTML(item.name)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatBRL(unitPrice)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatBRL(itemTotal)}</td>
      </tr>
    `;
  });

  const savings = totalRetailValue - totalValue;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, permita pop-ups para visualizar o comprovante.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Comprovante de Pedido - ${escapeHTML(name)}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 25px; color: #1e293b; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
        .header p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th { background: #f1f5f9; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; }
        .totals { text-align: right; font-size: 14px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
        .total-final { font-size: 18px; color: #166534; font-weight: bold; margin-top: 5px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📦 RESUMO DO PEDIDO - OBA PERFUMES</h1>
        <p>Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
      </div>

      <div class="info-grid">
        <div>
          <strong>Cliente:</strong> ${escapeHTML(name)}<br>
          ${cpf ? `<strong>CPF:</strong> ${escapeHTML(cpf)}<br>` : ''}
          <strong>Endereço:</strong> ${escapeHTML(address)}<br>
          <strong>Cidade/UF:</strong> ${escapeHTML(city)} ${cep ? ` - CEP: ${escapeHTML(cep)}` : ''}
        </div>
        <div>
          <strong>Forma de Pagamento:</strong> ${escapeHTML(payment)}<br>
          <strong>Forma de Envio:</strong> ${escapeHTML(shipping)}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align: center;">Qtd</th>
            <th style="text-align: right;">Unitário</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals">
        <p><strong>Subtotal (Varejo):</strong> ${formatBRL(totalRetailValue)}</p>
        ${savings > 0 ? `<p style="color: #d97706;"><strong>Desconto Atacado:</strong> -${formatBRL(savings)}</p>` : ''}
        <div class="total-final">Total Final: ${formatBRL(totalValue)}</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// 13. CARROSSEL & EVENTOS
// ==========================================
function goToSlide(index) {
  const sliderTrack = document.getElementById('sliderTrack');
  if (!sliderTrack) return;
  sliderTrack.scrollTo({ left: sliderTrack.clientWidth * index, behavior: 'smooth' });
}

function setupSlider() {
  const sliderTrack = document.getElementById('sliderTrack');
  const sliderDots = document.querySelectorAll('#sliderDots .dot');
  if (!sliderTrack) return;

  sliderTrack.addEventListener('scroll', () => {
    const slideWidth = sliderTrack.clientWidth;
    if (slideWidth > 0) {
      const activeIndex = Math.round(sliderTrack.scrollLeft / slideWidth);
      sliderDots.forEach((dot, idx) => dot.classList.toggle('active', idx === activeIndex));
    }
  });
}

window.addEventListener('click', function(e) {
  const priceModal = document.getElementById('price-table-modal');
  const cartModal = document.getElementById('cart-modal');
  const productModal = document.getElementById('product-modal');

  if (e.target === priceModal) closePriceTableModal();
  if (e.target === cartModal) closeCart();
  if (e.target === productModal) closeProductModal();
});

document.addEventListener('DOMContentLoaded', function() {
  loadCart();
  loadProductsFromAirtable();
  updateCart();
  setupInputMasks();
  setupSlider();

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('keyup', handleSearch);
});