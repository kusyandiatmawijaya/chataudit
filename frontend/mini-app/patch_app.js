const fs = require('fs');
let content = fs.readFileSync('/var/www/audit_wa/frontend/mini-app/app.js', 'utf8');

// Update loadListToday to show status correctly
content = content.replace(
  "Tipe: ${r.returnType} | Status: ${r.isPrinted ? 'Sudah Dicetak' : 'Belum Dicetak'}",
  "Tipe: ${r.returnType} | Status: ${r.status || 'DRAFT'}"
);

// Add state.status
content = content.replace(
  "returnId:       null,",
  "returnId:       null,\n  status:         'DRAFT',"
);

// Update selectReturn
const newSelectReturn = `
    const r = data.data;
    state.returnId = r.id;
    state.status = r.status || 'DRAFT';
    state.items = r.items ? r.items.map(it => ({
      ...it,
      _uoms: [{ label: it.uom, konversi: it.konversi }]
    })) : [];
    
    document.querySelector('.progress-header').style.display = 'none';
    
    $('btn-step2-back').onclick = () => {
      showScreen('screen-list');
      loadListToday();
    };
    
    const btnNext = $('btn-step2-next');
    const btnFinish = $('btn-step2-finish');
    const btnAdd = $('btn-add-item');
    
    if (state.status === 'SELESAI') {
      btnNext.style.display = 'none';
      btnFinish.style.display = 'none';
      btnAdd.style.display = 'none';
    } else {
      btnNext.style.display = '';
      btnFinish.style.display = '';
      btnAdd.style.display = '';
      
      btnNext.textContent = '✅ Simpan Detail';
      btnNext.onclick = async () => {
        if (state.items.length === 0) {
          alert('Minimal 1 barang harus dimasukkan.');
          return;
        }
        btnNext.disabled = true;
        btnNext.textContent = '⏳ Menyimpan...';
        try {
          await apiFetch(\`/retur/\${state.returnId}/items\`, {
            method: 'POST',
            body: JSON.stringify({ items: state.items }),
          });
          $('success-return-number').textContent = \`Detail berhasil disimpan\`;
          document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
          $('step-success').classList.add('active');
          if (tg) { tg.MainButton.hide(); tg.disableClosingConfirmation(); }
          $('btn-close').onclick = () => { if (tg) tg.close(); else window.location.reload(); };
        } catch (err) {
          alert('Gagal menyimpan: ' + err.message);
          btnNext.disabled = false;
          btnNext.textContent = '✅ Simpan Detail';
        }
      };
      
      btnFinish.onclick = async () => {
        if (!confirm('Akhiri pengeditan? Data tidak akan bisa diubah lagi.')) return;
        btnFinish.disabled = true;
        btnFinish.textContent = '⏳ Selesai...';
        try {
           await apiFetch(\`/retur/\${state.returnId}/finish\`, { method: 'POST' });
           alert('Retur berhasil dikunci.');
           selectReturn(state.returnId); // reload
        } catch (err) {
           alert('Gagal menyelesaikan: ' + err.message);
           btnFinish.disabled = false;
           btnFinish.textContent = '🔒 Selesai';
        }
      };
      
      btnAdd.onclick = () => openModal(-1);
    }
    
    renderItemList();
    showScreen('screen-app');
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    $('step-2').classList.add('active');
`;

content = content.replace(/const r = data\.data;[\s\S]*?\$\('step-2'\)\.classList\.add\('active'\);/, newSelectReturn.trim());

// Update item actions in renderItemList
content = content.replace(
  /<div class="item-actions">[\s\S]*?<\/div>/g,
  `<div class="item-actions">
        \${state.status === 'SELESAI' ? '' : \`<button class="icon-btn edit" onclick="openModal(\${i})">✏️</button><button class="icon-btn delete" onclick="deleteItem(\${i})">🗑️</button>\`}
      </div>`
);

// Modal logic replacement
const modalReplace = `
// ──────────────────────────────────────────────────
// MODAL — Input / Edit Item Barang
// ──────────────────────────────────────────────────
function openModal(editIndex) {
  modal.editIndex       = editIndex;
  modal.selectedProduct = null;
  modal.selectedAlasan  = '';

  const isEdit = editIndex >= 0;
  $('modal-title').textContent = isEdit ? 'Edit Barang' : 'Tambah Barang';

  if (isEdit) {
    const item = state.items[editIndex];
    // Find all items with the same productCode in state.items
    const productItems = state.items.filter(it => it.productCode === item.productCode);
    const uomsFromItems = productItems.map(it => ({ label: it.uom, konversi: it.konversi, qty: it.qty }));
    
    // Create a mock product containing uoms (either from existing items or actual product)
    modal.selectedProduct = {
      kdbrg: item.productCode,
      nmbrg: item.productName,
      uoms: item._uoms || uomsFromItems, // if not found, use whatever we have
    };
    // Need to pre-fill quantities later
    modal.selectedProduct.prefillUoms = uomsFromItems;
    modal.selectedAlasan = item.alasan || '';

    renderSelectedProduct(modal.selectedProduct);
    renderUomCounters();
    $('alasan-input').value = modal.selectedAlasan;
  } else {
    $('product-search-input').value = '';
    $('selected-product-display').classList.add('hidden');
    $('product-search-input').classList.remove('hidden');
    $('product-suggestions').classList.add('hidden');
    $('uom-counters-container').style.display = 'none';
    $('alasan-input').value = '';
  }

  renderAlasanPresets();
  $('modal-overlay').classList.remove('hidden');
  if (!isEdit) setTimeout(() => $('product-search-input').focus(), 100);
}

function renderUomCounters() {
  if (!modal.selectedProduct?.uoms?.length) return;
  $('uom-counters-container').style.display = '';

  const list = $('uom-counters-list');
  const prefill = modal.selectedProduct.prefillUoms || [];

  list.innerHTML = modal.selectedProduct.uoms.map((u, i) => {
    const p = prefill.find(pf => pf.label === u.label);
    const qty = p ? p.qty : 0;
    return \`
      <div class="uom-counter-row" data-label="\${escHtml(u.label)}" data-konversi="\${u.konversi || 1}">
        <span class="uom-counter-label">\${escHtml(u.label)}</span>
        <div class="qty-input-wrap" style="width: auto">
          <button class="qty-btn" onclick="updateQty(\${i}, -1)">−</button>
          <input type="number" id="qty-input-\${i}" class="form-input qty-input" value="\${qty}" min="0" step="1" />
          <button class="qty-btn" onclick="updateQty(\${i}, 1)">＋</button>
        </div>
      </div>
    \`;
  }).join('');
}

window.updateQty = (index, delta) => {
  const input = $(\`qty-input-\${index}\`);
  let v = parseInt(input.value) || 0;
  v += delta;
  if (v < 0) v = 0;
  input.value = v;
};
`;
// find where openModal starts and replace down to the end of QTY controls
const startModal = content.indexOf('function openModal');
const endModal = content.indexOf('// Alasan free-text sync');
content = content.slice(0, startModal) + modalReplace + content.slice(endModal);

// Modify product click to renderUomCounters
content = content.replace(/renderUomOptions\(\);/g, 'renderUomCounters();');

// Delete btn-clear-product qty groups clearing
content = content.replace("$('uom-group').style.display  = 'none';", "$('uom-counters-container').style.display = 'none';");
content = content.replace("$('qty-group').style.display  = 'none';", "");

// Modify btn-modal-save logic
const saveReplace = `
// Save modal
$('btn-modal-save').onclick = () => {
  if (!modal.selectedProduct) {
    alert('Pilih barang terlebih dahulu.');
    return;
  }
  const alasan = $('alasan-input').value.trim();
  if (!alasan) {
    alert('Alasan retur harus diisi.');
    return;
  }

  const rows = document.querySelectorAll('.uom-counter-row');
  let hasQty = false;
  const newItems = [];
  
  rows.forEach((row, i) => {
    const qty = parseInt($(\`qty-input-\${i}\`).value) || 0;
    if (qty > 0) {
      hasQty = true;
      newItems.push({
        id: Date.now().toString() + '-' + i,
        productCode: modal.selectedProduct.kdbrg,
        productName: modal.selectedProduct.nmbrg,
        uom: row.dataset.label,
        konversi: parseInt(row.dataset.konversi) || 1,
        qty: qty,
        alasan: alasan,
        _uoms: modal.selectedProduct.uoms // preserve for later edits
      });
    }
  });

  if (!hasQty) {
    alert('Minimal satu satuan (UOM) harus memiliki jumlah > 0.');
    return;
  }

  // Remove existing items with this productCode to prevent duplicates when editing
  state.items = state.items.filter(it => it.productCode !== modal.selectedProduct.kdbrg);
  
  // Add new items
  state.items.push(...newItems);
  
  closeModal();
  renderItemList();
};
`;
const startSave = content.indexOf("// Save modal");
const endSave = content.indexOf("$('btn-modal-cancel').onclick");
content = content.slice(0, startSave) + saveReplace + "\n" + content.slice(endSave);

fs.writeFileSync('/var/www/audit_wa/frontend/mini-app/app.js', content);
