// ============================================================
// products.js — موديول المنتجات النهائية وأرصدتها
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.exportProducts = function() {
                const products = storage.get('products') || [];
                if (products.length === 0) { storage.showToast('لا توجد منتجات للتصدير', 'warning'); return; }
                const headers = ['الكود', 'الاسم', 'الباركود', 'سعر البيع (ر.س)', 'تكلفة المنتج (ر.س)', 'هامش الربح (%)', 'المخزون', 'الحجم (مل)'];
                const rows = products.map(p => [p.id, p.name, p.barcode, p.sellingPrice, p.costPrice, p.profitMargin, p.stock, p.volume || '']);
                this._makeXlsx([{ name: 'المنتجات', headers, rows, colWidths: [12, 22, 16, 16, 16, 14, 10, 10] }], 'المنتجات_النهائية.xlsx');
                storage.showToast('تم تصدير المنتجات بنجاح');
};

proto.importProducts = function() {
                this._openFilePicker('.xlsx,.xls,.csv', (buffer, fname) => {
                    try {
                        const wb2 = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                        const dataSheet = wb2.SheetNames.find(s => s.trim() === 'المنتجات') || wb2.SheetNames[0];
                        const rows = XLSX.utils.sheet_to_json(wb2.Sheets[dataSheet], { defval: '' });
                        if (rows.length === 0) { storage.showToast('الملف فارغ او لا يحتوي على بيانات', 'error'); return; }

                        const nk = k => String(k).replace(/[*]/g,'').trim();
                        const getVal = (row, ...keys) => {
                            const rk = Object.keys(row);
                            for (const k of keys) {
                                if (row[k] !== undefined && String(row[k]).trim() !== '') return row[k];
                                const m = rk.find(r => nk(r) === nk(k));
                                if (m !== undefined && String(row[m]).trim() !== '') return row[m];
                            }
                            return '';
                        };

                        let imported = 0, skipped = 0;
                        const skippedReasons = [];
                        const existing = storage.get('products') || [];
                        const existingBarcodes = new Set(existing.map(p => String(p.barcode)));
                        const newItems = [];

                        rows.forEach((row, i) => {
                            const name         = String(getVal(row, 'الاسم *','الاسم','name')).trim();
                            const sellingPrice = parseFloat(String(getVal(row, 'سعر البيع *','سعر البيع','sellingPrice','selling_price')).replace(/,/g,''));
                            const costPrice    = parseFloat(String(getVal(row, 'تكلفة المنتج *','تكلفة المنتج','costPrice','cost_price')).replace(/,/g,''));

                            const missing = [];
                            if (!name)              missing.push('الاسم');
                            if (isNaN(sellingPrice)) missing.push('سعر البيع');
                            if (isNaN(costPrice))    missing.push('تكلفة المنتج');
                            if (missing.length > 0) {
                                skipped++;
                                if (skippedReasons.length < 5) skippedReasons.push('صف ' + (i+2) + ': ناقص (' + missing.join('، ') + ')');
                                return;
                            }

                            let barcode = String(getVal(row, 'الباركود','barcode')).trim();
                            if (!barcode || existingBarcodes.has(barcode)) {
                                barcode = '628' + Math.floor(Math.random()*9000000000+1000000000);
                            }
                            existingBarcodes.add(barcode);

                            const stock      = parseInt(String(getVal(row, 'المخزون','stock')).replace(/,/g,''))     || 0;
                            const volume     = parseInt(String(getVal(row, 'الحجم (مل)','الحجم','volume')).replace(/,/g,'')) || 500;
                            const minStock   = parseInt(String(getVal(row, 'الحد الادنى للمخزون','الحد الادنى','minStock')).replace(/,/g,'')) || 50;
                            const profitMargin = sellingPrice > 0 ? parseFloat((((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(1)) : 0;

                            newItems.push({
                                id: crypto.randomUUID(),
                                name, barcode, sellingPrice, costPrice, profitMargin,
                                stock, volume, minStock, image: '', createdAt: new Date().toISOString()
                            });
                            imported++;
                        });

                        if (imported === 0) {
                            Swal.fire({ icon:'error', title:'لم يتم استيراد اي صف',
                                html: '<div style="text-align:right;line-height:2;">' +
                                    '<div>تاكد من وجود الاعمدة: <b>الاسم، سعر البيع، تكلفة المنتج</b></div>' +
                                    (skippedReasons.length ? '<div style="color:#dc2626;font-size:12px;margin-top:6px;">' + skippedReasons.join('<br>') + '</div>' : '') +
                                    '</div>', confirmButtonText:'حسنا' });
                            return;
                        }

                        Swal.fire({
                            title: 'تاكيد الاستيراد',
                            html: '<div style="text-align:right;line-height:2;">' +
                                '<div>سيتم اضافة <strong>' + imported + '</strong> منتج.</div>' +
                                (skipped > 0 ? '<div style="color:#dc3545;">تم تخطي ' + skipped + ' صف.' +
                                    (skippedReasons.length ? '<br><span style="font-size:12px;">' + skippedReasons.join('<br>') + '</span>' : '') + '</div>' : '') +
                                '<div style="margin-top:8px;">هل تريد الاضافة للبيانات الموجودة ام استبدالها؟</div></div>',
                            icon: 'question', showCancelButton: true, showDenyButton: true,
                            confirmButtonText: 'اضافة للموجود', denyButtonText: 'استبدال الكل', cancelButtonText: 'الغاء'
                        }).then(async (result) => {
                            if (result.isConfirmed || result.isDenied) {
                                const productsToImport = result.isConfirmed ? [...existing, ...newItems] : newItems;
                                storage.set('products', productsToImport);
                                for (const p of newItems) { await storage.crud('products', 'create', p); }
                                storage.showToast('تم إرسال طلب استيراد ' + imported + ' منتج للموافقة');
                                this.navigateTo('products');
                            }
                        });
                    } catch(e) {
                        Swal.fire({ icon:'error', title:'خطا في قراءة الملف',
                            html: '<div style="text-align:right;">' + e.message +
                                '<div style="margin-top:8px;font-size:12px;color:#64748b;">تاكد ان الملف بصيغة xlsx وغير محمي بكلمة مرور</div></div>',
                            confirmButtonText:'حسنا' });
                    }
                });
};

proto.renderProducts = function(container) {
                const products        = storage.get('products')        || [];
                const productCostings = storage.get('productCostings') || [];
                const gradients = [
                    'linear-gradient(135deg,#1e6f9f,#0f1f35)',
                    'linear-gradient(135deg,#059669,#047857)',
                    'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    'linear-gradient(135deg,#0891b2,#0e7490)',
                    'linear-gradient(135deg,#f97316,#ea580c)',
                    'linear-gradient(135deg,#dc2626,#b91c1c)',
                ];

                const buildSkuRows = (productId) => {
                    const skus = productCostings.filter(pc => pc.productId === productId);
                    if (skus.length === 0) return `
                        <div style="text-align:center;padding:0.6rem 0;color:var(--text-secondary);font-size:0.78rem;">
                            <i class="fas fa-info-circle"></i> لا توجد أحجام — أضف من <strong>تكلفة المنتجات</strong>
                        </div>`;
                    return skus.map(s => {
                        const unitCost   = s.totalUnitCost   || 0;
                        const cartonCost = s.totalCartonCost || 0;
                        return `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.42rem 0.65rem;border-radius:7px;background:var(--gray-50);border:1px solid var(--border-color);margin-bottom:0.35rem;gap:0.5rem;">
                            <div style="display:flex;align-items:center;gap:0.45rem;min-width:0;">
                                <span style="background:var(--primary);color:white;border-radius:5px;padding:1px 7px;font-size:0.72rem;font-weight:700;white-space:nowrap;">${s.skuSize||'—'}</span>
                                <span style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;">${s.skuSizeLiters||''}L × ${s.unitsPerCarton||''} عبوة</span>
                            </div>
                            <div style="display:flex;gap:0.5rem;align-items:center;flex-shrink:0;">
                                <div style="text-align:left;">
                                    <div style="font-size:0.65rem;color:var(--text-secondary);">تكلفة الوحدة</div>
                                    <div style="font-size:0.82rem;font-weight:800;color:var(--primary);">${unitCost.toFixed(2)} ر.س</div>
                                </div>
                                <div style="text-align:left;border-right:1px solid var(--border-color);padding-right:0.5rem;">
                                    <div style="font-size:0.65rem;color:var(--text-secondary);">تكلفة الكرتون</div>
                                    <div style="font-size:0.82rem;font-weight:800;color:#f97316;">${cartonCost.toFixed(2)} ر.س</div>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                };

                const cards = products.map((p, idx) => {
                    const grad        = gradients[idx % gradients.length];
                    const profitColor = p.profitMargin >= 30 ? 'var(--success)' : p.profitMargin >= 15 ? 'var(--warning)' : 'var(--danger)';
                    const skuCount    = productCostings.filter(pc => pc.productId === p.id).length;
                    return `
                    <div class="product-card" style="cursor:default;">
                        <!-- رأس الكارت -->
                        <div class="card-img" style="background:${grad};position:relative;cursor:pointer;" onclick="app.showProductModal('${p.id}')">
                            <i class="fas fa-box" style="font-size:2.2rem;"></i>
                            <span style="position:absolute;top:8px;left:8px;background:rgba(255,255,255,0.2);color:white;font-size:0.7rem;padding:2px 8px;border-radius:20px;font-weight:700;">${p.id}</span>
                            ${skuCount > 0
                                ? `<span style="position:absolute;top:8px;right:8px;background:rgba(5,150,105,0.85);color:white;font-size:0.68rem;padding:2px 8px;border-radius:20px;font-weight:700;"><i class="fas fa-layer-group"></i> ${skuCount} حجم</span>`
                                : `<span style="position:absolute;top:8px;right:8px;background:rgba(220,38,38,0.75);color:white;font-size:0.68rem;padding:2px 8px;border-radius:20px;font-weight:700;">لا أحجام</span>`}
                        </div>

                        <div class="card-body" style="padding-bottom:0.75rem;">
                            <!-- اسم المنتج + إجراءات -->
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.55rem;">
                                <h4 style="margin:0;font-size:1rem;cursor:pointer;" onclick="app.showProductModal('${p.id}')">${p.name}</h4>
                                <div style="display:flex;gap:0.3rem;">
                                    <button class="btn btn-info btn-sm" style="padding:3px 8px;" title="باركود" onclick="app.generateBarcode('${p.barcode}','${p.name}')"><i class="fas fa-barcode"></i></button>
                                    <button class="btn btn-success btn-sm" style="padding:3px 8px;" title="QR" onclick="app.generateQR('${p.id}','${p.name}')"><i class="fas fa-qrcode"></i></button>
                                    <button class="btn btn-danger btn-sm" style="padding:3px 8px;" title="حذف" onclick="app.deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>

                            <!-- سعر البيع + مخزون -->
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-bottom:0.55rem;">
                                <div style="background:var(--gray-50);border-radius:8px;padding:0.4rem 0.6rem;border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem;color:var(--text-secondary);">سعر البيع</div>
                                    <div style="font-weight:800;font-size:0.9rem;color:var(--primary);">${p.sellingPrice.toFixed(2)} ر.س</div>
                                </div>
                                <div style="background:var(--gray-50);border-radius:8px;padding:0.4rem 0.6rem;border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem;color:var(--text-secondary);">المخزون</div>
                                    <div style="font-weight:800;font-size:0.9rem;">${p.stock} وحدة</div>
                                </div>
                            </div>

                            <!-- هامش الربح -->
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
                                <span style="font-size:0.78rem;color:var(--text-secondary);">هامش الربح</span>
                                <span style="font-weight:800;color:${profitColor};font-size:0.88rem;">${p.profitMargin}%</span>
                            </div>
                            <div style="background:var(--gray-100);border-radius:4px;height:4px;margin-bottom:0.65rem;overflow:hidden;">
                                <div style="height:100%;width:${Math.min(p.profitMargin,100)}%;background:${profitColor};border-radius:4px;"></div>
                            </div>

                            <!-- الأحجام من تكلفة المنتجات -->
                            <div style="border-top:1px solid var(--border-color);padding-top:0.55rem;">
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
                                    <span style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);"><i class="fas fa-layer-group" style="color:var(--primary);margin-left:4px;"></i> الأحجام والتكاليف</span>
                                    <button class="btn btn-primary btn-sm" style="padding:2px 10px;font-size:0.72rem;" onclick="app.navigateTo('productCosting')" title="إضافة حجم جديد"><i class="fas fa-plus"></i> حجم</button>
                                </div>
                                <div id="skus_${p.id}">
                                    ${buildSkuRows(p.id)}
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('');

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-boxes"></i> المنتجات النهائية</h2>
                            <p>إدارة المنتجات والأحجام والتسعير</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-success" onclick="app.renderProductBalances(document.getElementById('pageContent'))"><i class="fas fa-balance-scale"></i> أرصدة المنتجات</button>
                            <button class="btn btn-primary" onclick="app.showProductModal()"><i class="fas fa-plus"></i> إضافة منتج</button>
                            <button class="btn btn-warning btn-sm" onclick="app.exportProducts()"><i class="fas fa-file-excel"></i> تصدير</button>
                            <button class="btn btn-success btn-sm" onclick="app.importProducts()"><i class="fas fa-file-import"></i> استيراد</button>
                            <button class="btn btn-info btn-sm" onclick="app.downloadTemplate('products')"><i class="fas fa-download"></i> قالب</button>
                        </div>
                    </div>
                    ${products.length === 0 ? `<div class="empty-state"><i class="fas fa-boxes"></i><h3>لا توجد منتجات</h3><p>أضف أول منتج للبدء</p></div>` : ''}
                    <div class="product-cards-grid">${cards}</div>
                `;
};

proto.showProductModal = async function(editId = null) {
                const products = storage.get('products') || [];
                const product = editId ? products.find(p => p.id === editId) : null;
                const isEdit = !!product;

                Swal.fire({
                    title: isEdit ? 'تعديل منتج' : 'إضافة منتج جديد',
                    html: `
                        <div class="form-group"><label>اسم المنتج *</label><input type="text" id="prdName" class="form-control" value="${product ? product.name : ''}"></div>
                        <div class="form-group"><label>الباركود</label><input type="text" id="prdBarcode" class="form-control" value="${product ? product.barcode : '628'+Math.floor(Math.random()*9000000000+1000000000)}"></div>
                        <div class="form-group">
                            <label>تكلفة المنتج <span style="color:#94a3b8;font-size:0.78rem;">(اختياري — يُجلب تلقائياً من تكلفة المنتجات)</span></label>
                            <input type="number" id="prdCost" class="form-control" step="0.01" value="${product ? (product.costPrice||'') : ''}" placeholder="اتركه فارغاً للحساب التلقائي">
                        </div>
                        <div class="form-group">
                            <label>الرصيد الافتتاحي <span style="color:#94a3b8;font-size:0.78rem;">(الكمية الابتدائية)</span></label>
                            <input type="number" id="prdStock" class="form-control" value="${product ? (product.openingStock ?? product.stock ?? 0) : '0'}">
                        </div>
                        <div class="form-group">
                            <label>حجم المنتج (مل) <span style="color:#94a3b8;font-size:0.78rem;">(اختياري — يُحدد من موديول الأحجام)</span></label>
                            <input type="number" id="prdVolume" class="form-control" value="${product ? (product.volume||'') : ''}" placeholder="مثال: 500">
                        </div>
                        <div style="background:#eff6ff;border-radius:8px;padding:0.75rem;margin-top:0.5rem;font-size:0.82rem;color:#1e40af;text-align:right;">
                            <i class="fas fa-info-circle"></i> سعر البيع يُحدد لكل حجم (SKU) بشكل منفصل من موديول <strong>تكلفة المنتجات</strong>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: isEdit ? 'تحديث' : 'إضافة',
                    cancelButtonText: 'إلغاء',
                    width: '600px',
                    preConfirm: () => {
                        const name = document.getElementById('prdName').value.trim();
                        if (!name) { Swal.showValidationMessage('اسم المنتج مطلوب'); return false; }
                        const costPrice    = parseFloat(document.getElementById('prdCost').value)  || null;
                        const openingStock = parseInt(document.getElementById('prdStock').value)   || 0;
                        const volume       = parseInt(document.getElementById('prdVolume').value)  || null;
                        return {
                            name,
                            barcode: document.getElementById('prdBarcode').value.trim(),
                            costPrice,
                            openingStock,
                            stock: openingStock,
                            volume
                        };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        if (isEdit) {
                            const index = products.findIndex(p => p.id === editId);
                            if (index !== -1) products[index] = { ...products[index], ...result.value };
                        } else {
                            products.push({ id: crypto.randomUUID(),
                                ...result.value, image: '', createdAt: new Date().toISOString() });
                        }
                        const pItem = isEdit
                            ? products.find(p => p.id === editId)
                            : products[products.length - 1];
                        const rP = await storage.crud('products', isEdit ? 'update' : 'create', pItem);
                        if (!rP.pending) { storage.showToast(isEdit ? 'تم تحديث المنتج' : 'تم إضافة المنتج'); this.navigateTo('products'); }
                    }
                });
};

proto.calcProfitMargin = function() {
                const price = parseFloat(document.getElementById('prdPrice')?.value) || 0;
                const cost = parseFloat(document.getElementById('prdCost')?.value) || 0;
                const marginInput = document.getElementById('prdMargin');
                if (marginInput && price > 0) marginInput.value = (((price - cost) / price) * 100).toFixed(1) + '%';
};

proto.deleteProduct = async function(id) {
                Swal.fire({ title: 'تأكيد الحذف', text: 'هل أنت متأكد من حذف هذا المنتج؟', icon: 'warning',
                    showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#dc3545' }).then(async (result) => {
                    if (result.isConfirmed) {
                        const r = await storage.crud('products', 'delete', { id });
                        if (r.pending) return;
                        if (!r.success) return;
                        storage.showToast('تم حذف المنتج');
                        this.navigateTo('products');
                    }
                });
};

proto.generateBarcode = function(barcode, name) {
                Swal.fire({
                    title: 'باركود: ' + name,
                    html: `<svg id="barcodeSvg"></svg>`,
                    width: '400px',
                    didOpen: () => { try { JsBarcode('#barcodeSvg', barcode, { format: 'EAN13', width: 2,
                                height: 60, displayValue: true, fontSize: 14, textMargin: 5 }); } catch (
                            e) { document.getElementById('barcodeSvg').innerHTML =
                            '<p>تعذر إنشاء الباركود</p>'; } }
                });
};

proto.generateQR = function(id, name) {
                Swal.fire({
                    title: 'QR Code: ' + name,
                    html: `<div id="qrcodeContainer" style="display:flex;justify-content:center;"></div>`,
                    width: '400px',
                    didOpen: () => { try { new QRCode(document.getElementById('qrcodeContainer'), { text: id +
                                ' - ' + name, width: 200, height: 200 }); } catch (e) { document
                            .getElementById('qrcodeContainer').innerHTML = '<p>تعذر إنشاء QR Code</p>'; } }
                });
            }

            // ============================================
            // RENDER RECIPES MODULE (التركيبات - محدث)
            // ============================================
proto.renderProductBalances = function(container) {
                const products       = storage.get('products')        || [];
                const productionOrds = storage.get('productionOrders')|| [];
                const salesOrders    = storage.get('salesOrders')     || [];

                const balances = products.map(prod => {
                    const opening = prod.openingStock ?? prod.stock ?? 0;

                    // الإنتاج بالكرتون: unitsProduced
                    const producedCarton = productionOrds
                        .filter(po => po.orderType === 'carton' && po.productId === prod.id && po.status === 'completed')
                        .reduce((s, po) => s + (po.unitsProduced || 0), 0);

                    // الإنتاج بالطن: subOrders[].quantity (كيلو → وحدات بنفس الوحدة)
                    const producedTon = productionOrds
                        .filter(po => po.orderType === 'ton' && po.status === 'completed')
                        .reduce((s, po) => {
                            const sub = (po.subOrders||[]).find(o => o.productId === prod.id);
                            return s + (sub ? sub.quantity : 0);
                        }, 0);

                    const totalProduced = producedCarton + producedTon;

                    // المبيعات: salesOrders items
                    const soldQty = salesOrders.reduce((s, so) => {
                        const item = (so.items||[]).find(i => i.productId === prod.id);
                        return s + (item ? (item.qty || 0) : 0);
                    }, 0);

                    const current = opening + totalProduced - soldQty;
                    const stockColor = current <= 0 ? '#dc3545' : current <= (prod.minStock||0) ? '#f97316' : '#10b981';
                    const stockStatus = current <= 0 ? 'نفد' : current <= (prod.minStock||0) ? 'منخفض' : 'كافي';

                    return { ...prod, opening, totalProduced, soldQty, current, stockColor, stockStatus };
                });

                const totalValue = balances.reduce((s,p) => s + p.current * (p.sellingPrice||0), 0);
                const lowStock   = balances.filter(p => p.current > 0 && p.current <= (p.minStock||0)).length;
                const outStock   = balances.filter(p => p.current <= 0).length;

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-balance-scale"></i> أرصدة المنتجات النهائية</h2>
                            <p>متابعة مخزون المنتجات — افتتاحي + إنتاج - مبيعات</p>
                        </div>
                        <button class="btn btn-secondary" onclick="app.navigateTo('products')"><i class="fas fa-arrow-right"></i> رجوع للمنتجات</button>
                    </div>

                    <div class="stats-row" style="margin-bottom:1.5rem;">
                        <div class="stat-card card-blue">
                            <div class="icon bg-blue"><i class="fas fa-boxes"></i></div>
                            <div class="info"><p>إجمالي المنتجات</p><h3>${balances.length}</h3><span class="trend">منتج</span></div>
                        </div>
                        <div class="stat-card card-purple">
                            <div class="icon bg-purple"><i class="fas fa-coins"></i></div>
                            <div class="info"><p>قيمة المخزون</p><h3 style="font-size:1.1rem;">${(totalValue/1000).toFixed(1)}k</h3><span class="trend trend-up">ريال</span></div>
                        </div>
                        <div class="stat-card card-orange">
                            <div class="icon bg-orange"><i class="fas fa-exclamation-triangle"></i></div>
                            <div class="info"><p>مخزون منخفض</p><h3>${lowStock}</h3><span class="trend">منتج</span></div>
                        </div>
                        <div class="stat-card" style="border-right:4px solid #dc3545;">
                            <div class="icon" style="background:#dc3545;"><i class="fas fa-times-circle" style="color:#fff;"></i></div>
                            <div class="info"><p>نفد المخزون</p><h3>${outStock}</h3><span class="trend">منتج</span></div>
                        </div>
                    </div>

                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> أرصدة المنتجات</h3>
                            <input type="text" class="form-control" style="max-width:200px;font-size:0.85rem;" placeholder="🔍 بحث..." oninput="app._filterTable('prodBalTable', this.value)">
                        </div>
                        <div class="table-wrapper">
                            <table id="prodBalTable">
                                <thead>
                                    <tr>
                                        <th>المنتج</th>
                                        <th>الوحدة</th>
                                        <th style="background:#dbeafe;color:#1e40af;">الرصيد الافتتاحي</th>
                                        <th style="background:#dcfce7;color:#166534;">+ الإنتاج</th>
                                        <th style="background:#fee2e2;color:#991b1b;">- المبيعات</th>
                                        <th style="background:#f0fdf4;color:#065f46;font-size:1rem;">= الرصيد الحالي</th>
                                        <th>الحالة</th>
                                        <th>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${balances.length === 0
                                        ? `<tr><td colspan="8"><div class="empty-state" style="padding:2rem;"><i class="fas fa-boxes"></i><h3>لا توجد منتجات</h3></div></td></tr>`
                                        : balances.map(p => `
                                        <tr data-search="${p.name.toLowerCase()}">
                                            <td>
                                                <span style="font-weight:700;color:var(--primary);cursor:pointer;text-decoration:underline dotted;"
                                                      onclick="app.showProductMovement('${p.id}')"
                                                      title="عرض حركة المنتج">
                                                    ${p.name}
                                                </span>
                                            </td>
                                            <td style="color:var(--text-secondary);">${p.unit||'وحدة'}</td>
                                            <td style="background:#eff6ff;text-align:center;font-weight:600;">${(p.opening||0).toLocaleString('ar-SA')}</td>
                                            <td style="background:#f0fdf4;text-align:center;font-weight:600;color:#166534;">+${p.totalProduced.toLocaleString('ar-SA')}</td>
                                            <td style="background:#fef2f2;text-align:center;font-weight:600;color:#991b1b;">-${p.soldQty.toLocaleString('ar-SA')}</td>
                                            <td style="background:#ecfdf5;text-align:center;">
                                                <strong style="font-size:1.05rem;color:${p.stockColor};">${p.current.toLocaleString('ar-SA')}</strong>
                                            </td>
                                            <td><span style="background:${p.stockColor};color:#fff;padding:2px 10px;border-radius:1rem;font-size:0.78rem;font-weight:700;">${p.stockStatus}</span></td>
                                            <td>
                                                <button class="btn btn-primary btn-sm" onclick="app.showSaleModal()" style="font-size:0.78rem;">
                                                    <i class="fas fa-file-invoice-dollar"></i> بيع
                                                </button>
                                            </td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
};

proto.showProductMovement = function(prodId) {
                const products       = storage.get('products')        || [];
                const productionOrds = storage.get('productionOrders')|| [];
                const salesOrders    = storage.get('salesOrders')     || [];
                const prod = products.find(p => p.id === prodId);
                if (!prod) return;

                const opening = prod.openingStock ?? prod.stock ?? 0;

                // حركات الإنتاج
                const productionMoves = [];
                productionOrds.filter(po => po.status === 'completed').forEach(po => {
                    if (po.orderType === 'carton' && po.productId === prodId && po.unitsProduced > 0) {
                        productionMoves.push({
                            date: po.date ? new Date(po.date).toISOString().split('T')[0] : '—',
                            ref:  po.id?.slice(0,8) || '—',
                            desc: `إنتاج بالكرتون (${po.cartonCount||0} كرتون)`,
                            qty:  po.unitsProduced || 0,
                            type: 'production'
                        });
                    } else if (po.orderType === 'ton') {
                        const sub = (po.subOrders||[]).find(o => o.productId === prodId);
                        if (sub && sub.quantity > 0) {
                            productionMoves.push({
                                date: po.date ? new Date(po.date).toISOString().split('T')[0] : '—',
                                ref:  po.id?.slice(0,8) || '—',
                                desc: `إنتاج بالطن (${sub.quantity} كيلو)`,
                                qty:  sub.quantity,
                                type: 'production'
                            });
                        }
                    }
                });

                // حركات المبيعات
                const salesMoves = [];
                salesOrders.forEach(so => {
                    const item = (so.items||[]).find(i => i.productId === prodId);
                    if (item && item.qty > 0) {
                        salesMoves.push({
                            date: so.orderDate || '—',
                            ref:  so.orderNumber,
                            desc: `مبيعات — ${so.customerName||'عميل'}`,
                            qty:  item.qty,
                            type: 'sale'
                        });
                    }
                });

                const totalProduced = productionMoves.reduce((s,m) => s + m.qty, 0);
                const totalSold     = salesMoves.reduce((s,m) => s + m.qty, 0);
                const current       = opening + totalProduced - totalSold;
                const stockColor    = current <= 0 ? '#dc3545' : current <= (prod.minStock||0) ? '#f97316' : '#10b981';

                const allMoves = [
                    { date: prod.createdAt ? new Date(prod.createdAt).toISOString().split('T')[0] : '—', ref: 'رصيد افتتاحي', desc: '—', qty: opening, type: 'opening' },
                    ...productionMoves,
                    ...salesMoves
                ].sort((a,b) => (a.date||'').localeCompare(b.date||''));

                let running = 0;
                const movesWithBalance = allMoves.map(m => {
                    if (m.type === 'opening' || m.type === 'production') running += m.qty;
                    if (m.type === 'sale') running -= m.qty;
                    return { ...m, balance: running };
                });

                const typeLabel = { opening:'افتتاحي', production:'وارد (إنتاج)', sale:'صادر (مبيعات)' };
                const typeColor = { opening:'#3b82f6', production:'#10b981', sale:'#ef4444' };
                const typeIcon  = { opening:'fas fa-play-circle', production:'fas fa-industry', sale:'fas fa-shopping-bag' };

                Swal.fire({
                    title: `<i class="fas fa-history"></i> حركة مخزون: ${prod.name}`,
                    width: '800px',
                    html: `
                        <div style="text-align:right;">
                            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-bottom:1rem;">
                                <div style="background:#eff6ff;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #3b82f6;">
                                    <div style="font-size:0.72rem;color:#1e40af;font-weight:700;">الرصيد الافتتاحي</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#1e40af;">${opening.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${prod.unit||'وحدة'}</div>
                                </div>
                                <div style="background:#f0fdf4;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #10b981;">
                                    <div style="font-size:0.72rem;color:#166534;font-weight:700;">+ الإنتاج</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#10b981;">+${totalProduced.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${prod.unit||'وحدة'}</div>
                                </div>
                                <div style="background:#fef2f2;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #ef4444;">
                                    <div style="font-size:0.72rem;color:#991b1b;font-weight:700;">- المبيعات</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#ef4444;">-${totalSold.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${prod.unit||'وحدة'}</div>
                                </div>
                                <div style="background:#ecfdf5;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid ${stockColor};">
                                    <div style="font-size:0.72rem;font-weight:700;color:${stockColor};">= الرصيد الحالي</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:${stockColor};">${current.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${prod.unit||'وحدة'}</div>
                                </div>
                            </div>
                            <div style="max-height:340px;overflow-y:auto;border-radius:8px;border:1px solid #e2e8f0;">
                                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                                    <thead style="position:sticky;top:0;background:#f8fafc;z-index:1;">
                                        <tr>
                                            <th style="padding:0.5rem 0.75rem;text-align:right;border-bottom:1px solid #e2e8f0;">التاريخ</th>
                                            <th style="padding:0.5rem;text-align:right;border-bottom:1px solid #e2e8f0;">نوع الحركة</th>
                                            <th style="padding:0.5rem;text-align:right;border-bottom:1px solid #e2e8f0;">المرجع</th>
                                            <th style="padding:0.5rem;text-align:right;border-bottom:1px solid #e2e8f0;">البيان</th>
                                            <th style="padding:0.5rem;text-align:center;border-bottom:1px solid #e2e8f0;">الكمية</th>
                                            <th style="padding:0.5rem;text-align:center;border-bottom:1px solid #e2e8f0;">الرصيد</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${movesWithBalance.length === 0
                                            ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#94a3b8;">لا توجد حركات</td></tr>`
                                            : movesWithBalance.map((m,i) => `
                                            <tr style="background:${i%2===0?'#fff':'#f8fafc'};">
                                                <td style="padding:0.45rem 0.75rem;color:#64748b;font-size:0.8rem;">${m.date}</td>
                                                <td style="padding:0.45rem 0.5rem;">
                                                    <span style="background:${typeColor[m.type]};color:#fff;padding:2px 8px;border-radius:1rem;font-size:0.72rem;font-weight:700;">
                                                        <i class="${typeIcon[m.type]}"></i> ${typeLabel[m.type]}
                                                    </span>
                                                </td>
                                                <td style="padding:0.45rem 0.5rem;font-family:monospace;color:var(--primary);font-weight:700;font-size:0.8rem;">${m.ref}</td>
                                                <td style="padding:0.45rem 0.5rem;font-size:0.82rem;">${m.desc}</td>
                                                <td style="padding:0.45rem 0.5rem;text-align:center;font-weight:700;color:${typeColor[m.type]};">
                                                    ${m.type==='sale'?'-':'+'}${m.qty.toLocaleString('ar-SA')} ${prod.unit||''}
                                                </td>
                                                <td style="padding:0.45rem 0.5rem;text-align:center;font-weight:800;color:${m.balance<=0?'#ef4444':m.balance<=(prod.minStock||0)?'#f97316':'#10b981'};">
                                                    ${m.balance.toLocaleString('ar-SA')}
                                                </td>
                                            </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-file-invoice-dollar"></i> إنشاء فاتورة مبيعات',
                    cancelButtonText: 'إغلاق',
                    confirmButtonColor: 'var(--primary)'
                }).then(result => {
                    if (result.isConfirmed) this.showSaleModal();
                });
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
