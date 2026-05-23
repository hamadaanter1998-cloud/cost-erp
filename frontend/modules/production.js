// ============================================================
// production.js — موديول الإنتاج وأرصدة المنتجات
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.showProductionOrderModal = function() {
                const products = storage.get('products') || [];
                const recipes = storage.get('recipes') || [];
                // كل المنتجات النهائية - مع علامة إذا كان عنده تركيبة أم لا
                window._prodOrderOptions = products;
                window._prodOrderRecipes = recipes;

                Swal.fire({
                    title: 'أمر إنتاج جديد',
                    html: `
                        <style>
                            .prod-items-table { width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:0.5rem; }
                            .prod-items-table th { background:#f0f2f5; padding:0.4rem 0.5rem; text-align:right; }
                            .prod-items-table td { padding:0.3rem 0.4rem; border-bottom:1px solid #dee2e6; }
                            .prod-items-table input, .prod-items-table select { width:100%; padding:0.3rem; border:1px solid #dee2e6; border-radius:4px; font-size:0.82rem; }
                            #prodPreviewBox { background:#f8f9fa; border-radius:8px; padding:0.75rem; margin-top:0.75rem; font-size:0.85rem; }
                            #prodPreviewBox table { width:100%; border-collapse:collapse; margin-top:0.5rem; }
                            #prodPreviewBox th { background:#e9ecef; padding:0.35rem 0.5rem; text-align:right; }
                            #prodPreviewBox td { padding:0.3rem 0.5rem; border-bottom:1px solid #dee2e6; }
                            .cost-summary-box { background:linear-gradient(135deg,#0d6efd,#0b5ed7); color:white; border-radius:8px; padding:0.75rem 1rem; margin-top:0.5rem; display:flex; justify-content:space-between; align-items:center; }
                            .cost-summary-box .lbl { font-size:0.85rem; opacity:0.9; }
                            .cost-summary-box .val { font-size:1.2rem; font-weight:bold; }
                            .prod-search-wrap { position:relative; margin-bottom:0.4rem; }
                            .prod-search-wrap input { width:100%; padding:0.35rem 0.6rem 0.35rem 2rem; border:1px solid #dee2e6; border-radius:4px; font-size:0.82rem; }
                            .prod-search-wrap .icon { position:absolute; left:0.5rem; top:50%; transform:translateY(-50%); color:#6c757d; font-size:0.8rem; }
                            .prod-dropdown { position:absolute; z-index:9999; background:#fff; border:1px solid #dee2e6; border-radius:4px; width:100%; max-height:200px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.1); display:none; }
                            .prod-dropdown-item { padding:0.4rem 0.7rem; cursor:pointer; font-size:0.83rem; border-bottom:1px solid #f0f2f5; display:flex; justify-content:space-between; align-items:center; }
                            .prod-dropdown-item:hover { background:#e8f0fe; }
                            .prod-dropdown-item .no-recipe { font-size:0.72rem; color:#dc3545; background:#fde8ea; padding:1px 5px; border-radius:8px; }
                            .prod-dropdown-item .has-recipe { font-size:0.72rem; color:#198754; background:#d4edda; padding:1px 5px; border-radius:8px; }
                            .prod-selected-name { font-size:0.82rem; color:#0d6efd; font-weight:600; margin-top:2px; min-height:14px; }
                        </style>
                        <div style="margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                            <strong>🧾 أصناف الأمر</strong>
                            <button type="button" class="btn btn-success btn-sm" onclick="app.addProdOrderRow()"><i class="fas fa-plus"></i> إضافة صنف</button>
                        </div>
                        <table class="prod-items-table">
                            <thead><tr><th style="min-width:200px;">المنتج</th><th>الكمية</th><th>التكلفة</th><th></th></tr></thead>
                            <tbody id="prodOrderItemsBody"></tbody>
                        </table>
                        <div id="prodPreviewBox"><p style="color:#6c757d;text-align:center;">أضف صنفاً لعرض المواد الخام المطلوبة</p></div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'تنفيذ الأمر',
                    cancelButtonText: 'إلغاء',
                    width: '800px',
                    didOpen: () => {
                        app.addProdOrderRow();
                    },
                    preConfirm: () => {
                        const rawMaterials = storage.get('rawMaterials') || [];
                        const recipesData  = storage.get('recipes')      || [];
                        const rows = document.querySelectorAll('#prodOrderItemsBody tr');
                        if (rows.length === 0) { Swal.showValidationMessage('أضف صنفاً واحداً على الأقل'); return false; }
                        const items = [];
                        for (const row of rows) {
                            const productId = row.querySelector('.prod-item-product')?.value;
                            const qty = parseInt(row.querySelector('.prod-item-qty')?.value);
                            if (!productId) { Swal.showValidationMessage('يرجى اختيار المنتج لكل صنف'); return false; }
                            if (!qty || qty < 1) { Swal.showValidationMessage('يرجى إدخال كمية صحيحة'); return false; }
                            const recipe = recipesData.find(r => r.productId === productId);
                            if (!recipe) { Swal.showValidationMessage('لا توجد تركيبة للمنتج المختار — أضف تركيبة أولاً'); return false; }
                            if (!recipe.materials || recipe.materials.length === 0) { Swal.showValidationMessage('التركيبة فارغة — أضف مواد خام للتركيبة'); return false; }
                            items.push({ productId, qty, recipe });
                        }
                        // Aggregate required raw materials across all items
                        const aggregated = {};
                        const rawMats = storage.get('rawMaterials') || [];
                        items.forEach(item => {
                            item.recipe.materials.forEach(mat => {
                                const required = mat.quantity * (item.qty / 1000);
                                const rmRec = rawMats.find(m => m.id === mat.materialId);
                                const rName = (mat.materialName && mat.materialName.trim()) ? mat.materialName
                                            : (rmRec ? rmRec.name : mat.materialId);
                                if (!aggregated[mat.materialId]) {
                                    aggregated[mat.materialId] = { name: rName, required: 0, price: mat.price || (rmRec ? rmRec.costPrice : 0), unit: mat.unit || (rmRec ? rmRec.unit : '') };
                                }
                                aggregated[mat.materialId].required += required;
                            });
                        });
                        // Check stock — نستخدم نفس حساب الأرصدة
                        const purchaseOrders = storage.get('purchaseOrders') || [];
                        const productionOrds = storage.get('productionOrders') || [];
                        const insufficient = [];
                        Object.entries(aggregated).forEach(([matId, info]) => {
                            const material = rawMaterials.find(m => m.id === matId);
                            if (!material) {
                                insufficient.push({ name: info.name, required: info.required, available: 0 });
                                return;
                            }
                            // حساب الرصيد الحالي = افتتاحي + مشتريات مستلمة - منصرف
                            const opening = material.openingStock ?? material.quantity ?? 0;
                            const purchased = purchaseOrders
                                .filter(po => po.status === 'received')
                                .reduce((s, po) => {
                                    const it = (po.items||[]).find(i => i.materialId === matId);
                                    return s + (it ? it.qty||0 : 0);
                                }, 0);
                            const consumed = productionOrds.reduce((s, po) => {
                                const entry = (po.materials||[]).find(m => m.materialId === matId);
                                if (entry) return s + (entry.requiredQty||0);
                                return s + (po.subOrders||[]).reduce((ss, sub) => {
                                    const sm = (sub.materials||[]).find(m => m.materialId === matId);
                                    return ss + (sm ? sm.requiredQty||0 : 0);
                                }, 0);
                            }, 0);
                            const available = opening + purchased - consumed;
                            if (available < info.required) {
                                insufficient.push({ name: info.name, required: info.required, available });
                            }
                        });
                        if (insufficient.length > 0) {
                            Swal.showValidationMessage('المواد غير كافية:<br>' + insufficient.map(m =>
                                `${m.name}: مطلوب ${m.required.toFixed(2)}، متوفر ${m.available.toFixed(2)}`).join('<br>'));
                            return false;
                        }
                        return { items, aggregated };
                    }
                }).then((result) => {
                    if (result.isConfirmed) this.executeMultiProductionOrder(result.value.items, result.value.aggregated);
                });
};

proto.addProdOrderRow = function() {
                const allProducts = window._prodOrderOptions || [];
                const recipes = window._prodOrderRecipes || [];
                const tbody = document.getElementById('prodOrderItemsBody');
                if (!tbody) return;
                const rowId = 'prodrow_' + Date.now();
                const row = document.createElement('tr');
                row.id = rowId;
                row.dataset.selectedId = '';
                row.innerHTML = `
                    <td style="min-width:200px;">
                        <div class="prod-search-wrap">
                            <span class="icon"><i class="fas fa-search"></i></span>
                            <input type="text" placeholder="ابحث عن منتج..." autocomplete="off"
                                oninput="app.filterProdDropdown(this)"
                                onfocus="app.filterProdDropdown(this)"
                                onblur="setTimeout(()=>{ const d=document.getElementById('dd_${rowId}'); if(d) d.style.display='none'; },200)">
                            <div class="prod-dropdown" id="dd_${rowId}"></div>
                        </div>
                        <div class="prod-selected-name" id="sel_${rowId}"></div>
                        <input type="hidden" class="prod-item-product" value="">
                    </td>
                    <td><input type="number" class="prod-item-qty" min="1" value="100" oninput="app.updateMultiProductionPreview()"></td>
                    <td class="prod-item-cost" style="color:#198754;font-weight:bold;">-</td>
                    <td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove();app.updateMultiProductionPreview()"><i class="fas fa-times"></i></button></td>
                `;
                tbody.appendChild(row);
                // populate dropdown immediately
                app.filterProdDropdown(row.querySelector('input[type=text]'));
};

proto.filterProdDropdown = function(input) {
                const allProducts = window._prodOrderOptions || [];
                const recipes = window._prodOrderRecipes || [];
                const query = input.value.trim().toLowerCase();
                const row = input.closest('tr');
                if (!row) return;
                const rowId = row.id;
                const dd = document.getElementById('dd_' + rowId);
                if (!dd) return;
                const filtered = allProducts.filter(p =>
                    p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
                );
                if (filtered.length === 0) {
                    dd.innerHTML = '<div class="prod-dropdown-item" style="color:#6c757d;">لا توجد نتائج</div>';
                } else {
                    dd.innerHTML = filtered.map(p => {
                        const hasRecipe = recipes.some(r => r.productId === p.id);
                        return `<div class="prod-dropdown-item" onmousedown="app.selectProdItem('${rowId}','${p.id}',\`${p.name.replace(/`/g,"'")}\`)">
                            <span>${p.name} <small style="color:#6c757d;">(${p.id})</small></span>
                            <span class="${hasRecipe ? 'has-recipe' : 'no-recipe'}">${hasRecipe ? '✓ تركيبة' : '! بدون تركيبة'}</span>
                        </div>`;
                    }).join('');
                }
                dd.style.display = 'block';
};

proto.selectProdItem = function(rowId, productId, productName) {
                const row = document.getElementById(rowId);
                if (!row) return;
                row.querySelector('.prod-item-product').value = productId;
                row.querySelector('input[type=text]').value = productName;
                const selEl = document.getElementById('sel_' + rowId);
                if (selEl) selEl.textContent = '';
                const dd = document.getElementById('dd_' + rowId);
                if (dd) dd.style.display = 'none';
                app.updateMultiProductionPreview();
};

proto.updateMultiProductionPreview = function() {
                const recipes = storage.get('recipes') || [];
                const rawMaterials = storage.get('rawMaterials') || [];
                const preview = document.getElementById('prodPreviewBox');
                if (!preview) return;

                const rows = document.querySelectorAll('#prodOrderItemsBody tr');
                if (rows.length === 0) { preview.innerHTML = '<p style="color:#6c757d;text-align:center;">أضف صنفاً لعرض المواد الخام المطلوبة</p>'; return; }

                // Aggregate required materials
                const aggregated = {};
                let grandTotalCost = 0;
                let hasValidItem = false;

                rows.forEach(row => {
                    const productId = row.querySelector('.prod-item-product').value;
                    const qty = parseInt(row.querySelector('.prod-item-qty').value) || 0;
                    const costCell = row.querySelector('.prod-item-cost');
                    if (!productId || !qty) { if(costCell) costCell.textContent = '-'; return; }
                    const recipe = recipes.find(r => r.productId === productId);
                    if (!recipe) { if(costCell) costCell.textContent = 'لا تركيبة'; return; }
                    hasValidItem = true;
                    const itemCost = recipe.totalMaterialsCostPerTon * (qty / 1000);
                    grandTotalCost += itemCost;
                    if (costCell) costCell.textContent = itemCost.toFixed(2) + ' ر.س';
                    recipe.materials.forEach(mat => {
                        const required = mat.quantity * (qty / 1000);
                        const rmRecord = rawMaterials.find(m => m.id === mat.materialId);
                        const resolvedName = (mat.materialName && mat.materialName.trim()) ? mat.materialName
                                          : (rmRecord ? rmRecord.name : mat.materialId);
                        if (!aggregated[mat.materialId]) {
                            aggregated[mat.materialId] = { name: resolvedName, required: 0, price: mat.price || (rmRecord ? rmRecord.costPrice : 0), unit: mat.unit || (rmRecord ? rmRecord.unit : '') };
                        }
                        aggregated[mat.materialId].required += required;
                    });
                });

                if (!hasValidItem) { preview.innerHTML = '<p style="color:#6c757d;text-align:center;">اختر منتجاً وكمية لعرض المواد</p>'; return; }

                let rawMatRows = '';
                let totalRawCost = 0;
                const _purchaseOrders = storage.get('purchaseOrders') || [];
                const _productionOrds = storage.get('productionOrders') || [];
                Object.entries(aggregated).forEach(([matId, info]) => {
                    const material = rawMaterials.find(m => m.id === matId);
                    // حساب الرصيد الحقيقي = افتتاحي + مشتريات مستلمة - منصرف
                    let available = 0;
                    if (material) {
                        const opening = material.openingStock ?? material.quantity ?? 0;
                        const purchased = _purchaseOrders
                            .filter(po => po.status === 'received')
                            .reduce((s, po) => { const it = (po.items||[]).find(i => i.materialId === matId); return s + (it ? it.qty||0 : 0); }, 0);
                        const consumed = _productionOrds.reduce((s, po) => {
                            const entry = (po.materials||[]).find(m => m.materialId === matId);
                            if (entry) return s + (entry.requiredQty||0);
                            return s + (po.subOrders||[]).reduce((ss, sub) => {
                                const sm = (sub.materials||[]).find(m => m.materialId === matId);
                                return ss + (sm ? sm.requiredQty||0 : 0);
                            }, 0);
                        }, 0);
                        available = opening + purchased - consumed;
                    }
                    const ok = available >= info.required;
                    const lineCost = info.required * info.price;
                    totalRawCost += lineCost;
                    rawMatRows += `<tr>
                        <td>${info.name}</td>
                        <td>${info.required.toFixed(2)} ${info.unit||''}</td>
                        <td>${available.toFixed(2)} ${info.unit||''}</td>
                        <td>${lineCost.toFixed(2)} ر.س</td>
                        <td><span style="padding:2px 8px;border-radius:10px;font-size:0.78rem;background:${ok?'#d4edda':'#f8d7da'};color:${ok?'#155724':'#721c24'};font-weight:600;">${ok?'✓':'✗'}</span></td>
                    </tr>`;
                });

                preview.innerHTML = `
                    <strong>📦 المواد الخام الإجمالية المطلوبة</strong>
                    <table>
                        <thead><tr><th>المادة</th><th>الكمية المطلوبة</th><th>المتوفر</th><th>التكلفة</th><th>حالة</th></tr></thead>
                        <tbody>${rawMatRows}</tbody>
                    </table>
                    <div class="cost-summary-box">
                        <div><div class="lbl">إجمالي تكلفة المواد الخام</div><div class="val">${totalRawCost.toFixed(2)} ر.س</div></div>
                        <div style="text-align:left"><div class="lbl">إجمالي تكلفة الأمر</div><div class="val">${grandTotalCost.toFixed(2)} ر.س</div></div>
                    </div>
                `;
};

proto.updateProductionPreview = function() { this.updateMultiProductionPreview(); }

proto.executeMultiProductionOrder = async function(items, aggregated) {
                const products = storage.get('products') || [];
                const rawMaterials = storage.get('rawMaterials') || [];
                const productionOrders = storage.get('productionOrders') || [];

                // التحقق من كفاية المخزون قبل الخصم
                const purchaseOrders2 = storage.get('purchaseOrders') || [];
                const productionOrds2 = storage.get('productionOrders') || [];
                const stockShortages = [];
                Object.entries(aggregated).forEach(([matId, info]) => {
                    const mat = rawMaterials.find(m => m.id === matId);
                    if (!mat) { stockShortages.push(`${info.name}: المادة غير موجودة`); return; }
                    const opening = mat.openingStock ?? mat.quantity ?? 0;
                    const purchased = purchaseOrders2
                        .filter(po => po.status === 'received')
                        .reduce((s, po) => { const it = (po.items||[]).find(i => i.materialId === matId); return s + (it ? it.qty||0 : 0); }, 0);
                    const consumed = productionOrds2.reduce((s, po) => {
                        const entry = (po.materials||[]).find(m => m.materialId === matId);
                        if (entry) return s + (entry.requiredQty||0);
                        return s + (po.subOrders||[]).reduce((ss, sub) => {
                            const sm = (sub.materials||[]).find(m => m.materialId === matId);
                            return ss + (sm ? sm.requiredQty||0 : 0);
                        }, 0);
                    }, 0);
                    const available = opening + purchased - consumed;
                    if (available < info.required) {
                        stockShortages.push(`${info.name}: مطلوب ${info.required.toFixed(2)}، متوفر ${available.toFixed(2)}`);
                    }
                });
                if (stockShortages.length > 0) {
                    Swal.fire({ icon: 'error', title: 'مخزون غير كافٍ', html: stockShortages.join('<br>') });
                    return;
                }

                // خصم المواد دفعة واحدة بدون approval workflow
                const deductions = Object.entries(aggregated).map(([materialId, info]) => ({
                    materialId, qty: info.required
                }));
                // تحديث الـ cache المحلي فوراً
                Object.entries(aggregated).forEach(([matId, info]) => {
                    const idx = rawMaterials.findIndex(m => m.id === matId);
                    if (idx !== -1) {
                        rawMaterials[idx].quantity = Math.max(0, (rawMaterials[idx].quantity || 0) - info.required);
                        if (rawMaterials[idx].quantity <= (rawMaterials[idx].minStock || 0))
                            this.addNotification(`⚠️ مخزون منخفض: ${rawMaterials[idx].name}`, 'warning');
                    }
                });
                storage.set('rawMaterials', rawMaterials);
                // إرسال للسيرفر دفعة واحدة
                const affectedIds1 = Object.keys(aggregated);
                await api.post('/raw-materials/bulk-deduct', { deductions });

                // Increase stock and build sub-orders info
                let grandTotalCost = 0;
                const subOrders = items.map(item => {
                    // qty/1000: التكلفة والكميات كلاهما محسوبان على أساس الطن
                    const qtyFactor = item.qty / 1000;
                    const itemCost = item.recipe.totalMaterialsCostPerTon * qtyFactor;
                    grandTotalCost += itemCost;
                    return {
                        productId: item.productId,
                        productName: products.find(p => p.id === item.productId)?.name || item.productId,
                        quantity: item.qty,
                        cost: itemCost,
                        recipeId: item.recipe.id,
                        materials: item.recipe.materials.map(m => ({ ...m, requiredQty: m.quantity * qtyFactor }))
                    };
                });
                // أمر الطن لا يؤثر على مخزون المنتجات — فقط المواد الخام تتأثر

                const order = {
                    id: crypto.randomUUID(),
                    orderType: 'ton',
                    // For backward compat: use first product name if single, else "أمر متعدد"
                    productId: subOrders.length === 1 ? subOrders[0].productId : 'MULTI',
                    productName: subOrders.length === 1 ? subOrders[0].productName : `أمر متعدد (${subOrders.length} أصناف)`,
                    quantity: subOrders.reduce((s, o) => s + o.quantity, 0),
                    totalCost: grandTotalCost,
                    date: new Date().toISOString(),
                    status: 'completed',
                    isMulti: subOrders.length > 1,
                    subOrders,
                    materials: Object.entries(aggregated).map(([matId, info]) => ({
                        materialId: matId, materialName: info.name,
                        unit: info.unit, price: info.price,
                        requiredQty: info.required
                    }))
                };
                productionOrders.push(order);
                await storage.crud('productionOrders', 'create', order);
                storage.showToast('تم تنفيذ أمر الإنتاج! 🎉');
                this.addNotification('✅ اكتمل أمر الإنتاج: ' + order.id, 'success');
                this.navigateTo('production');
};

proto.executeProductionOrder = function(productId, qty, recipe) {
                // Legacy single-item wrapper
                this.executeMultiProductionOrder(
                    [{ productId, qty, recipe }],
                    (() => {
                        const rms = storage.get('rawMaterials') || [];
                        return Object.fromEntries(recipe.materials.map(m => {
                            const rm = rms.find(r => r.id === m.materialId);
                            const n = (m.materialName && m.materialName.trim()) ? m.materialName : (rm ? rm.name : m.materialId);
                            return [m.materialId, { name: n, required: m.quantity*(qty/1000), price: m.price||(rm?rm.costPrice:0), unit: m.unit||(rm?rm.unit:'') }];
                        }));
                    })()
                );
            }

            // ============================================
            // CARTON PRODUCTION ORDER - أمر إنتاج بالكرتون (متعدد المنتجات)
            // ============================================
proto.showCartonProductionModal = async function() {
                const products       = storage.get('products')        || [];
                const productCostings= storage.get('productCostings') || [];
                const recipes        = storage.get('recipes')         || [];
                const rawMaterials   = storage.get('rawMaterials')    || [];

                // فقط المنتجات التي عندها SKU واحد على الأقل
                const productsWithSku = products.filter(p => productCostings.some(pc => pc.productId === p.id));
                if (productsWithSku.length === 0) {
                    Swal.fire({ icon:'warning', title:'لا توجد أحجام معرّفة',
                        html:'يجب تعريف أحجام (SKU) للمنتجات أولاً من قسم <strong>تكلفة المنتجات</strong> قبل إنشاء أوامر الكرتون.',
                        confirmButtonText:'حسناً' });
                    return;
                }

                // بناء خيارات المنتجات مع أحجامها
                const buildSkuOptions = (productId, selectedSkuId) => {
                    const skus = productCostings.filter(pc => pc.productId === productId);
                    if (skus.length === 0) return '<option value="">— لا توجد أحجام لهذا المنتج —</option>';
                    return skus.map(s =>
                        `<option value="${s.id}" ${s.id===selectedSkuId?'selected':''} data-liters="${s.skuSizeLiters||0}" data-units="${s.unitsPerCarton||0}" data-carton-cost="${s.totalCartonCost||0}" data-unit-cost="${s.totalUnitCost||0}" data-packaging='${JSON.stringify(s.cartonItems||[])}' data-sku-size="${s.skuSize||''}">
                            ${s.skuSize} — ${s.skuSizeLiters}L × ${s.unitsPerCarton} عبوة — كلفة كرتون: ${(s.totalCartonCost||0).toFixed(2)} ر.س
                        </option>`
                    ).join('');
                };

                const productOptionsHtml = productsWithSku.map(p =>
                    `<option value="${p.id}">${p.name} (${p.id})</option>`
                ).join('');

                const buildLineHtml = (lineIdx, productId, skuOptionsHtml) => `
                    <div class="cpo-line-item" id="cpoLine_${lineIdx}" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.85rem 1rem;margin-bottom:0.6rem;position:relative;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;">
                            <span style="font-size:0.82rem;font-weight:700;color:#1e6f9f;"><i class="fas fa-cube"></i> منتج ${lineIdx+1}</span>
                            ${lineIdx > 0 ? `<button type="button" onclick="app._cpoRemoveLine(${lineIdx})" style="background:#fee2e2;border:none;border-radius:6px;color:#dc2626;padding:2px 8px;cursor:pointer;font-size:0.78rem;font-weight:700;">✕ حذف</button>` : ''}
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.5rem;align-items:end;">
                            <div>
                                <label style="font-size:0.78rem;font-weight:600;display:block;margin-bottom:3px;">المنتج</label>
                                <select class="form-control cpo-product-sel" data-line="${lineIdx}" onchange="app._cpoLineProductChange(${lineIdx},this.value)" style="font-size:0.82rem;padding:0.45rem 0.6rem;">
                                    ${productsWithSku.map(p=>`<option value="${p.id}" ${p.id===productId?'selected':''}>${p.name}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.78rem;font-weight:600;display:block;margin-bottom:3px;">الحجم (SKU)</label>
                                <select class="form-control cpo-sku-sel" data-line="${lineIdx}" onchange="app._cpoCalcAll()" style="font-size:0.82rem;padding:0.45rem 0.6rem;">
                                    ${skuOptionsHtml}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.78rem;font-weight:600;display:block;margin-bottom:3px;">الكراتين</label>
                                <input type="number" class="form-control cpo-cartons-inp" data-line="${lineIdx}" min="1" value="100" oninput="app._cpoCalcAll()" style="width:90px;font-size:0.82rem;padding:0.45rem 0.6rem;">
                            </div>
                        </div>
                    </div>`;

                const firstProduct = productsWithSku[0];

                Swal.fire({
                    title: '<i class="fas fa-boxes" style="color:#f97316;"></i> أمر إنتاج بالكرتون',
                    html: `
                    <style>
                        .cpo-section { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem 1rem; margin-bottom:0.75rem; }
                        .cpo-section h6 { margin:0 0 0.6rem; font-size:0.88rem; font-weight:700; color:#1e6f9f; }
                        .mat-table { width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.5rem; }
                        .mat-table th { background:#f1f5f9; padding:0.3rem 0.5rem; text-align:right; font-weight:600; }
                        .mat-table td { padding:0.28rem 0.5rem; border-bottom:1px solid #f1f5f9; }
                    </style>

                    <!-- قائمة المنتجات -->
                    <div id="cpoLinesContainer">
                        ${buildLineHtml(0, firstProduct.id, buildSkuOptions(firstProduct.id))}
                    </div>
                    <button type="button" onclick="app._cpoAddLine()" style="width:100%;background:#e8f4fb;border:2px dashed #1e6f9f;border-radius:8px;padding:0.5rem;color:#1e6f9f;font-weight:700;cursor:pointer;font-size:0.85rem;margin-bottom:0.75rem;">
                        <i class="fas fa-plus"></i> إضافة منتج آخر
                    </button>

                    <!-- ملخص المواد الخام -->
                    <div class="cpo-section" id="cpoRawSection">
                        <h6><i class="fas fa-flask"></i> المواد الخام المطلوبة (إجمالي)</h6>
                        <div id="cpoRawMatsBody"><p style="color:#94a3b8;font-size:0.82rem;text-align:center;">جارٍ الحساب...</p></div>
                    </div>

                    <!-- ملخص مواد التعبئة -->
                    <div class="cpo-section" id="cpoPackSection">
                        <h6><i class="fas fa-box-open"></i> مواد التعبئة المطلوبة (إجمالي)</h6>
                        <div id="cpoPackBody"><p style="color:#94a3b8;font-size:0.82rem;text-align:center;">جارٍ الحساب...</p></div>
                    </div>

                    <!-- التكلفة الإجمالية -->
                    <div id="cpoTotalSection"></div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-play"></i> تنفيذ الأمر',
                    cancelButtonText: 'إلغاء',
                    width: '860px',
                    didOpen: () => {
                        window._cpoBuildSkuOptions = buildSkuOptions;
                        window._cpoBuildLineHtml   = buildLineHtml;
                        window._cpoProductCostings = productCostings;
                        window._cpoRecipes         = recipes;
                        window._cpoRawMaterials    = rawMaterials;
                        window._cpoProducts        = productsWithSku;
                        window._cpoLineCount       = 1;
                        app._cpoCalcAll();
                    },
                    preConfirm: () => {
                        // جمع كل السطور
                        const lineItems = [];
                        const container = document.getElementById('cpoLinesContainer');
                        const lines = container ? container.querySelectorAll('.cpo-line-item') : [];
                        for (let li of lines) {
                            const lineIdx = parseInt(li.id.replace('cpoLine_',''));
                            const productSel = li.querySelector('.cpo-product-sel');
                            const skuSel     = li.querySelector('.cpo-sku-sel');
                            const cartonsInp = li.querySelector('.cpo-cartons-inp');
                            if (!productSel || !skuSel || !cartonsInp) continue;
                            const productId = productSel.value;
                            const skuId     = skuSel.value;
                            const cartons   = parseInt(cartonsInp.value) || 0;
                            if (!skuId) { Swal.showValidationMessage(`المنتج ${lineIdx+1}: يرجى اختيار الحجم`); return false; }
                            if (cartons < 1) { Swal.showValidationMessage(`المنتج ${lineIdx+1}: يرجى إدخال عدد الكراتين`); return false; }
                            const skuOpt = skuSel.options[skuSel.selectedIndex];
                            const packagingItems = JSON.parse(skuOpt.dataset.packaging || '[]');
                            lineItems.push({ productId, skuId, cartons, packagingItems, lineIdx });
                        }
                        if (lineItems.length === 0) { Swal.showValidationMessage('يرجى إضافة منتج واحد على الأقل'); return false; }

                        const productCostingsAll = window._cpoProductCostings || [];
                        const recipesAll         = window._cpoRecipes         || [];
                        const rms                = window._cpoRawMaterials    || [];

                        // --- بناء الإجماليات لكل سطر ---
                        const processedLines = [];
                        const globalAggRaw  = {};
                        const globalAggPack = {};

                        for (const li of lineItems) {
                            const sku    = productCostingsAll.find(pc => pc.id === li.skuId);
                            const recipe = recipesAll.find(r => r.productId === li.productId);
                            const totalLiters = (sku?.skuSizeLiters||0) * (sku?.unitsPerCarton||0) * li.cartons;
                            const aggRaw = {};
                            if (recipe && recipe.materials) {
                                const tonFactor = totalLiters / 1000;
                                recipe.materials.forEach(m => {
                                    const rm = rms.find(r => r.id === m.materialId);
                                    const name = (m.materialName && m.materialName.trim()) ? m.materialName : (rm ? rm.name : m.materialId);
                                    if (!aggRaw[m.materialId]) aggRaw[m.materialId] = { name, required:0, price: m.price||(rm?.costPrice||0), unit: m.unit||(rm?.unit||'') };
                                    aggRaw[m.materialId].required += m.quantity * tonFactor;
                                    if (!globalAggRaw[m.materialId]) globalAggRaw[m.materialId] = { name, required:0, price: m.price||(rm?.costPrice||0), unit: m.unit||(rm?.unit||'') };
                                    globalAggRaw[m.materialId].required += m.quantity * tonFactor;
                                });
                            }
                            const aggPack = {};
                            li.packagingItems.forEach(item => {
                                const key = item.materialId;
                                if (!aggPack[key]) aggPack[key] = { name: item.materialName||key, required:0, price: item.price||0 };
                                aggPack[key].required += item.quantity * li.cartons;
                                if (!globalAggPack[key]) globalAggPack[key] = { name: item.materialName||key, required:0, price: item.price||0 };
                                globalAggPack[key].required += item.quantity * li.cartons;
                            });
                            processedLines.push({ ...li, sku, recipe, aggRaw, aggPack, totalLiters });
                        }

                        // --- التحقق من المخزون (إجمالي) ---
                        const shortages = [];
                        const _po3 = storage.get('purchaseOrders') || [];
                        const _prd3 = storage.get('productionOrders') || [];
                        const _avail3 = (matId) => {
                            const mat = rms.find(m => m.id === matId);
                            if (!mat) return 0;
                            const opening = mat.openingStock ?? mat.quantity ?? 0;
                            const purchased = _po3.filter(po => po.status==='received').reduce((s,po) => { const it=(po.items||[]).find(i=>i.materialId===matId); return s+(it?it.qty||0:0); }, 0);
                            const consumed = _prd3.reduce((s,po) => { const e=(po.materials||[]).find(m=>m.materialId===matId); if(e) return s+(e.requiredQty||0); return s+(po.subOrders||[]).reduce((ss,sub)=>{ const sm=(sub.materials||[]).find(m=>m.materialId===matId); return ss+(sm?sm.requiredQty||0:0); },0); }, 0);
                            return opening + purchased - consumed;
                        };
                        Object.entries(globalAggRaw).forEach(([id, info]) => {
                            const avail = _avail3(id);
                            if (avail < info.required)
                                shortages.push(`[خام] ${info.name}: مطلوب ${info.required.toFixed(2)} — متوفر ${avail.toFixed(2)}`);
                        });
                        Object.entries(globalAggPack).forEach(([id, info]) => {
                            const avail = _avail3(id);
                            if (avail < info.required)
                                shortages.push(`[تعبئة] ${info.name}: مطلوب ${info.required.toFixed(0)} — متوفر ${avail.toFixed(0)}`);
                        });
                        if (shortages.length > 0) {
                            Swal.showValidationMessage('مخزون غير كافٍ:<br>' + shortages.join('<br>'));
                            return false;
                        }
                        return { processedLines, globalAggRaw, globalAggPack };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) await this._executeCartonOrderMulti(result.value);
                });
            }

            // إضافة سطر منتج جديد
proto._cpoAddLine = function() {
                const container = document.getElementById('cpoLinesContainer');
                if (!container) return;
                const idx = window._cpoLineCount || container.querySelectorAll('.cpo-line-item').length;
                window._cpoLineCount = idx + 1;
                const products = window._cpoProducts || [];
                const firstProd = products[0];
                const skuHtml = (window._cpoBuildSkuOptions||(() =>''))(firstProd?.id||'');
                const lineHtml = (window._cpoBuildLineHtml||(() =>''))(idx, firstProd?.id||'', skuHtml);
                const div = document.createElement('div');
                div.innerHTML = lineHtml;
                container.appendChild(div.firstElementChild);
                this._cpoCalcAll();
            }

            // حذف سطر
proto._cpoRemoveLine = function(lineIdx) {
                const el = document.getElementById('cpoLine_' + lineIdx);
                if (el) { el.remove(); this._cpoCalcAll(); }
            }

            // تغيير المنتج في سطر معين
proto._cpoLineProductChange = function(lineIdx, productId) {
                const lineEl = document.getElementById('cpoLine_' + lineIdx);
                if (!lineEl) return;
                const skuSel = lineEl.querySelector('.cpo-sku-sel');
                if (skuSel) skuSel.innerHTML = (window._cpoBuildSkuOptions||(() =>''))(productId);
                this._cpoCalcAll();
            }

            // حساب إجمالي كل السطور
proto._cpoCalcAll = function() {
                const container = document.getElementById('cpoLinesContainer');
                if (!container) return;
                const lines = container.querySelectorAll('.cpo-line-item');
                const productCostings = window._cpoProductCostings || [];
                const recipes         = window._cpoRecipes         || [];
                const rms             = window._cpoRawMaterials    || [];

                const globalAggRaw  = {};
                const globalAggPack = {};
                let grandTotal = 0;
                let totalCartons = 0;
                let linesSummary = [];

                for (let li of lines) {
                    const productSel = li.querySelector('.cpo-product-sel');
                    const skuSel     = li.querySelector('.cpo-sku-sel');
                    const cartonsInp = li.querySelector('.cpo-cartons-inp');
                    if (!productSel || !skuSel || !cartonsInp) continue;
                    const productId = productSel.value;
                    const skuId     = skuSel.value;
                    const cartons   = parseInt(cartonsInp.value) || 0;
                    if (!skuId || cartons < 1) continue;
                    const skuOpt     = skuSel.options[skuSel.selectedIndex];
                    const packItems  = JSON.parse(skuOpt?.dataset?.packaging || '[]');
                    const sku        = productCostings.find(pc => pc.id === skuId);
                    const recipe     = recipes.find(r => r.productId === productId);
                    const totalLiters = (sku?.skuSizeLiters||0) * (sku?.unitsPerCarton||0) * cartons;
                    let lineRaw = 0, linePack = 0;

                    if (recipe && recipe.materials) {
                        const tonFactor = totalLiters / 1000;
                        recipe.materials.forEach(m => {
                            const rm   = rms.find(r => r.id === m.materialId);
                            const name = (m.materialName && m.materialName.trim()) ? m.materialName : (rm ? rm.name : m.materialId);
                            const req  = m.quantity * tonFactor;
                            const pr   = m.price||(rm?.costPrice||0);
                            lineRaw += req * pr;
                            if (!globalAggRaw[m.materialId]) globalAggRaw[m.materialId] = { name, required:0, price:pr, unit: m.unit||(rm?.unit||'') };
                            globalAggRaw[m.materialId].required += req;
                        });
                    }
                    packItems.forEach(item => {
                        const needed = item.quantity * cartons;
                        linePack += needed * (item.price||0);
                        if (!globalAggPack[item.materialId]) globalAggPack[item.materialId] = { name: item.materialName||item.materialId, required:0, price: item.price||0 };
                        globalAggPack[item.materialId].required += needed;
                    });

                    const lineTotal = lineRaw + linePack;
                    grandTotal += lineTotal;
                    totalCartons += cartons;
                    linesSummary.push({
                        productName: productSel.options[productSel.selectedIndex]?.text||productId,
                        skuSize: skuOpt?.dataset?.skuSize||'',
                        cartons, units: (sku?.unitsPerCarton||0)*cartons, lineTotal
                    });
                }

                // --- عرض المواد الخام ---
                const rawDiv = document.getElementById('cpoRawMatsBody');
                const _po2 = storage.get('purchaseOrders') || [];
                const _prod2 = storage.get('productionOrders') || [];
                const _allRms = storage.get('rawMaterials') || [];
                const _calcAvail = (matId) => {
                    const mat = _allRms.find(m => m.id === matId);
                    if (!mat) return 0;
                    const opening = mat.openingStock ?? mat.quantity ?? 0;
                    const purchased = _po2.filter(po => po.status==='received').reduce((s,po) => { const it=(po.items||[]).find(i=>i.materialId===matId); return s+(it?it.qty||0:0); }, 0);
                    const consumed = _prod2.reduce((s,po) => { const e=(po.materials||[]).find(m=>m.materialId===matId); if(e) return s+(e.requiredQty||0); return s+(po.subOrders||[]).reduce((ss,sub)=>{ const sm=(sub.materials||[]).find(m=>m.materialId===matId); return ss+(sm?sm.requiredQty||0:0); },0); }, 0);
                    return opening + purchased - consumed;
                };
                if (rawDiv) {
                    if (Object.keys(globalAggRaw).length > 0) {
                        let rawRows = ''; let rawTotal = 0;
                        Object.entries(globalAggRaw).forEach(([matId, info]) => {
                            const avail = _calcAvail(matId);
                            const ok = avail >= info.required;
                            const cost = info.required * info.price;
                            rawTotal += cost;
                            rawRows += `<tr>
                                <td>${info.name}</td>
                                <td style="text-align:center;">${info.required.toFixed(2)} ${info.unit}</td>
                                <td style="text-align:center;color:${ok?'#059669':'#dc2626'};font-weight:600;">${avail.toFixed(2)}</td>
                                <td style="text-align:center;">${cost.toFixed(2)} ر.س</td>
                                <td style="text-align:center;"><span style="padding:2px 7px;border-radius:10px;font-size:0.75rem;background:${ok?'#d1fae5':'#fee2e2'};color:${ok?'#059669':'#dc2626'};font-weight:700;">${ok?'✓':'✗'}</span></td>
                            </tr>`;
                        });
                        rawDiv.innerHTML = `<table class="mat-table"><thead><tr><th>المادة</th><th>المطلوب</th><th>المتوفر</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>${rawRows}</tbody></table>
                            <div style="text-align:left;font-size:0.83rem;margin-top:6px;font-weight:700;color:#1e6f9f;">إجمالي المواد الخام: ${rawTotal.toFixed(2)} ر.س</div>`;
                    } else {
                        rawDiv.innerHTML = '<p style="color:#94a3b8;font-size:0.82rem;text-align:center;">أضف منتجاً لعرض المواد المطلوبة</p>';
                    }
                }

                // --- عرض مواد التعبئة ---
                const packDiv = document.getElementById('cpoPackBody');
                if (packDiv) {
                    if (Object.keys(globalAggPack).length > 0) {
                        let packRows = ''; let packTotal = 0;
                        Object.entries(globalAggPack).forEach(([id, info]) => {
                            const avail = _calcAvail(id);
                            const ok = avail >= info.required;
                            const cost = info.required * info.price;
                            packTotal += cost;
                            packRows += `<tr>
                                <td>${info.name}</td>
                                <td style="text-align:center;">${info.required.toFixed(0)}</td>
                                <td style="text-align:center;color:${ok?'#059669':'#dc2626'};font-weight:600;">${avail.toFixed(0)}</td>
                                <td style="text-align:center;">${cost.toFixed(2)} ر.س</td>
                                <td style="text-align:center;"><span style="padding:2px 7px;border-radius:10px;font-size:0.75rem;background:${ok?'#d1fae5':'#fee2e2'};color:${ok?'#059669':'#dc2626'};font-weight:700;">${ok?'✓':'✗'}</span></td>
                            </tr>`;
                        });
                        packDiv.innerHTML = `<table class="mat-table"><thead><tr><th>المادة</th><th>المطلوب</th><th>المتوفر</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>${packRows}</tbody></table>
                            <div style="text-align:left;font-size:0.83rem;margin-top:6px;font-weight:700;color:#f97316;">إجمالي مواد التعبئة: ${packTotal.toFixed(2)} ر.س</div>`;
                    } else {
                        packDiv.innerHTML = '<p style="color:#94a3b8;font-size:0.82rem;text-align:center;">لا توجد مواد تعبئة</p>';
                    }
                }

                // --- ملخص الأسطر والإجمالي ---
                const totalSec = document.getElementById('cpoTotalSection');
                if (totalSec) {
                    const lineRows = linesSummary.map(ls => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px dashed rgba(255,255,255,0.2);font-size:0.8rem;">
                            <span style="opacity:0.9;">${ls.productName} — ${ls.skuSize} × ${ls.cartons} كرتون (${ls.units} عبوة)</span>
                            <span style="font-weight:700;">${ls.lineTotal.toFixed(2)} ر.س</span>
                        </div>`).join('');
                    totalSec.innerHTML = `
                        <div style="background:linear-gradient(135deg,#1e6f9f,#155a82);color:white;border-radius:10px;padding:0.85rem 1.1rem;margin-top:0.25rem;">
                            ${linesSummary.length > 1 ? `<div style="margin-bottom:0.5rem;">${lineRows}</div>` : ''}
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;text-align:center;">
                                <div><div style="font-size:0.72rem;opacity:0.85;">إجمالي الكراتين</div><div style="font-size:1.2rem;font-weight:800;">${totalCartons}</div></div>
                                <div><div style="font-size:0.72rem;opacity:0.85;">إجمالي التكلفة</div><div style="font-size:1.2rem;font-weight:800;">${grandTotal.toFixed(2)} ر.س</div></div>
                                <div><div style="font-size:0.72rem;opacity:0.85;">عدد المنتجات</div><div style="font-size:1.2rem;font-weight:800;">${linesSummary.length}</div></div>
                            </div>
                        </div>`;
                }
};

proto._cpoOnProductChange = function(productId) {
                const skuSel = document.getElementById('cpoSku');
                if (skuSel) skuSel.innerHTML = (window._cpoBuildSkuOptions || (() => ''))(productId);
                this._cpoCalcAll();
};

proto._cpoOnSkuChange = function() { this._cpoCalcAll(); }

            // دالة قديمة للتوافق
proto._cpoCalc = function() { this._cpoCalcAll(); }

            // تنفيذ أمر كرتون متعدد المنتجات
proto._executeCartonOrderMulti = async function({ processedLines, globalAggRaw, globalAggPack }) {
                const products     = storage.get('products')     || [];
                const rawMaterials = storage.get('rawMaterials') || [];
                const orders       = storage.get('productionOrders') || [];

                // خصم المواد الخام (الإجمالي)
                Object.entries(globalAggRaw).forEach(([id, info]) => {
                    const idx = rawMaterials.findIndex(m => m.id === id);
                    if (idx !== -1) {
                        rawMaterials[idx].quantity = Math.max(0, rawMaterials[idx].quantity - info.required);
                        if (rawMaterials[idx].quantity <= rawMaterials[idx].minStock)
                            this.addNotification(`⚠️ مخزون منخفض: ${rawMaterials[idx].name}`, 'warning');
                    }
                });
                // خصم مواد التعبئة (الإجمالي)
                const allAgg = { ...globalAggRaw, ...globalAggPack };
                Object.entries(allAgg).forEach(([id, info]) => {
                    const idx = rawMaterials.findIndex(m => m.id === id);
                    if (idx !== -1) {
                        rawMaterials[idx].quantity = Math.max(0, rawMaterials[idx].quantity - info.required);
                        if (rawMaterials[idx].quantity <= (rawMaterials[idx].minStock || 0))
                            this.addNotification(`⚠️ مخزون منخفض: ${rawMaterials[idx].name}`, 'warning');
                    }
                });
                storage.set('rawMaterials', rawMaterials);
                const deductions2 = Object.entries(allAgg).map(([materialId, info]) => ({ materialId, qty: info.required }));
                await api.post('/raw-materials/bulk-deduct', { deductions: deductions2 });
                // زيادة مخزون كل منتج + إنشاء أمر مستقل لكل سطر
                const orderId = crypto.randomUUID();
                const orderIds = [];
                for (const li of processedLines) {
                    const prod      = products.find(p => p.id === li.productId);
                    const totalUnits = (li.sku?.unitsPerCarton||0) * li.cartons;
                    const pIdx = products.findIndex(p => p.id === li.productId);
                    if (pIdx !== -1) products[pIdx].stock = (products[pIdx].stock||0) + totalUnits;

                    const rawTotal  = Object.values(li.aggRaw).reduce((s,i)  => s + i.required * i.price, 0);
                    const packTotal = Object.values(li.aggPack).reduce((s,i) => s + i.required * i.price, 0);
                    const lineOrderId = processedLines.length === 1 ? orderId : orderId + '_' + (li.lineIdx+1);
                    orderIds.push(lineOrderId);
                    const newOrder = {
                        id: lineOrderId,
                        orderType: 'carton',
                        productId: li.productId,
                        productName: prod ? prod.name : li.productId,
                        skuId: li.skuId,
                        skuSize: li.sku?.skuSize || '',
                        cartonCount: li.cartons,
                        unitsProduced: totalUnits,
                        quantity: li.cartons,
                        totalLiters: parseFloat(li.totalLiters.toFixed(2)),
                        totalCost: parseFloat((rawTotal+packTotal).toFixed(2)),
                        rawMaterialCost: parseFloat(rawTotal.toFixed(2)),
                        packagingCost: parseFloat(packTotal.toFixed(2)),
                        date: new Date().toISOString(),
                        status: 'completed',
                        materials: [
                            ...Object.entries(li.aggRaw).map(([id,i])  => ({ materialId:id, materialName:i.name, unit:i.unit, price:i.price, requiredQty:i.required, category:'rawMaterial' })),
                            ...Object.entries(li.aggPack).map(([id,i]) => ({ materialId:id, materialName:i.name, unit:'', price:i.price, requiredQty:i.required, category:'packaging' }))
                        ]
                    };
                    await storage.crud('productionOrders', 'create', newOrder);
                }

                const prodNames = processedLines.map(l => {
                    const p = products.find(pp => pp.id === l.productId);
                    return `${p?.name||l.productId} (${l.cartons} كرتون)`;
                }).join('، ');
                const totalCartons = processedLines.reduce((s,l) => s+l.cartons, 0);
                storage.showToast(`✅ تم إنتاج ${totalCartons} كرتون — ${processedLines.length} منتج`);
                this.addNotification(`✅ أوامر كرتون مكتملة: ${orderIds.join(', ')}`, 'success');
                this.logActivity('تنفيذ أوامر كرتون: ' + orderIds.join(', '));
                this.navigateTo('production');
};

proto._executeCartonOrder = function({ productId, skuId, cartons, sku, recipe, aggRaw, aggPack, totalLiters }) {
                // للتوافق — تحويل إلى النسخة المتعددة
                this._executeCartonOrderMulti({
                    processedLines: [{ productId, skuId, cartons, sku, recipe, aggRaw, aggPack, totalLiters, lineIdx:0 }],
                    globalAggRaw: aggRaw,
                    globalAggPack: aggPack
                });
};

proto.viewProductionOrder = function(orderId) {
                const orders = storage.get('productionOrders') || [];
                const order = orders.find(o => o.id === orderId);
                if (!order) return;

                const tdStyle = 'padding:0.3rem 0.5rem;border-bottom:1px solid #dee2e6;';
                const thStyle = 'background:#f0f2f5;padding:0.35rem 0.5rem;text-align:right;';
                const matTable = (mats) => `
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.4rem;">
                        <thead><tr>
                            <th style="${thStyle}">المادة</th>
                            <th style="${thStyle}">الكمية</th>
                            <th style="${thStyle}">الوحدة</th>
                            <th style="${thStyle}">السعر</th>
                            <th style="${thStyle}">الإجمالي</th>
                        </tr></thead>
                        <tbody>${mats.map(m => `<tr>
                            <td style="${tdStyle}">${m.materialName||m.materialId}</td>
                            <td style="${tdStyle}">${(m.requiredQty||m.quantity||0).toFixed(2)}</td>
                            <td style="${tdStyle}">${m.unit||''}</td>
                            <td style="${tdStyle}">${(m.price||0).toFixed(2)}</td>
                            <td style="${tdStyle}">${((m.requiredQty||m.quantity||0)*(m.price||0)).toFixed(2)} ر.س</td>
                        </tr>`).join('')}</tbody>
                    </table>`;

                let bodyHtml = '';

                if (order.orderType === 'carton') {
                    // ===== عرض أمر الكرتون =====
                    const rawMats  = (order.materials||[]).filter(m => m.category !== 'packaging');
                    const packMats = (order.materials||[]).filter(m => m.category === 'packaging');
                    bodyHtml = `
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.75rem;">
                            <div style="background:#fff4ed;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;color:#f97316;font-weight:600;">عدد الكراتين</div>
                                <div style="font-size:1.3rem;font-weight:800;">${order.cartonCount||order.quantity}</div>
                                <div style="font-size:0.72rem;color:#64748b;">${order.skuSize||''}</div>
                            </div>
                            <div style="background:#d1fae5;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;color:#059669;font-weight:600;">عبوات منتجة</div>
                                <div style="font-size:1.3rem;font-weight:800;">${order.unitsProduced||0}</div>
                            </div>
                            <div style="background:#e0f2fe;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;color:#0891b2;font-weight:600;">إجمالي اللترات</div>
                                <div style="font-size:1.3rem;font-weight:800;">${order.totalLiters||0}</div>
                            </div>
                        </div>
                        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
                            <div style="flex:1;background:#1e6f9f;color:white;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;opacity:0.85;">تكلفة المواد الخام</div>
                                <div style="font-size:1rem;font-weight:800;">${(order.rawMaterialCost||0).toFixed(2)} ر.س</div>
                            </div>
                            <div style="flex:1;background:#f97316;color:white;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;opacity:0.85;">تكلفة التعبئة</div>
                                <div style="font-size:1rem;font-weight:800;">${(order.packagingCost||0).toFixed(2)} ر.س</div>
                            </div>
                            <div style="flex:1;background:#059669;color:white;border-radius:8px;padding:0.5rem 0.75rem;text-align:center;">
                                <div style="font-size:0.72rem;opacity:0.85;">إجمالي التكلفة</div>
                                <div style="font-size:1rem;font-weight:800;">${order.totalCost.toFixed(2)} ر.س</div>
                            </div>
                        </div>
                        ${rawMats.length > 0 ? `<strong>🧪 المواد الخام المستخدمة:</strong>${matTable(rawMats)}` : ''}
                        ${packMats.length > 0 ? `<strong style="display:block;margin-top:0.75rem;">📦 مواد التعبئة المستخدمة:</strong>${matTable(packMats)}` : ''}
                    `;
                } else {
                    // ===== عرض أمر الطن =====
                    let subOrdersHtml = '';
                    if (order.isMulti && order.subOrders) {
                        subOrdersHtml = `<div style="margin-bottom:0.75rem;"><strong>📋 الأصناف المنتجة:</strong>
                            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.4rem;">
                            <thead><tr style="background:#f0f2f5;">
                                <th style="${thStyle}">المنتج</th><th style="${thStyle}">الكمية</th><th style="${thStyle}">التكلفة</th>
                            </tr></thead>
                            <tbody>${order.subOrders.map(s=>`<tr>
                                <td style="${tdStyle}">${s.productName}</td>
                                <td style="${tdStyle}">${s.quantity} كيلو</td>
                                <td style="${tdStyle}">${s.cost.toFixed(2)} ر.س</td>
                            </tr>`).join('')}</tbody></table></div>`;
                    } else {
                        subOrdersHtml = `<p><strong>المنتج:</strong> ${order.productName}</p><p><strong>الكمية:</strong> ${order.quantity} كيلو</p>`;
                    }
                    bodyHtml = `
                        ${subOrdersHtml}
                        <p><strong>إجمالي التكلفة:</strong> <span style="color:#0d6efd;font-size:1.1rem;font-weight:bold;">${order.totalCost.toFixed(2)} ر.س</span></p>
                        <strong>📦 المواد الخام المستخدمة:</strong>
                        ${matTable(order.materials||[])}
                    `;
                }

                Swal.fire({
                    title: `تفاصيل الأمر: ${order.id} ${order.orderType==='carton'?'<span style="font-size:0.75rem;background:#fff4ed;color:#f97316;padding:2px 8px;border-radius:10px;margin-right:6px;">كرتون</span>':''}`,
                    html: bodyHtml,
                    width: '800px',
                    confirmButtonText: 'حسناً'
                });
};

proto.printProductionOrder = function(orderId) {
                const orders   = storage.get('productionOrders') || [];
                const products = storage.get('products') || [];
                const order = orders.find(o => o.id === orderId);
                if (!order) return;

                const isTon    = order.orderType === 'ton';
                const isCarton = order.orderType === 'carton';
                const prod     = products.find(p => p.id === order.productId);
                const orderDate = order.date ? new Date(order.date).toLocaleDateString('ar-SA') : '—';
                const company   = 'نظام ERP الصناعي';

                // بناء جدول المواد
                const mats = order.materials || [];
                const rawMats   = mats.filter(m => m.category === 'rawMaterial' || !m.category);
                const packMats  = mats.filter(m => m.category === 'packaging');

                const matRows = (arr) => arr.map((m, i) => `
                    <tr>
                        <td>${i+1}</td>
                        <td>${m.materialName || m.name || '—'}</td>
                        <td>${m.unit || '—'}</td>
                        <td>${(m.requiredQty || 0).toFixed(3)}</td>
                        <td>${(m.price || 0).toFixed(2)}</td>
                        <td>${((m.requiredQty||0) * (m.price||0)).toFixed(2)}</td>
                    </tr>`).join('');

                // بناء ملخص الكرتون لو كان carton
                const subOrderRows = isCarton ? '' : (order.subOrders || []).map(sub => `
                    <tr>
                        <td>${sub.productName || sub.productId}</td>
                        <td>${sub.quantity} كيلو</td>
                        <td>${sub.cost?.toFixed(2) || '0.00'} ر.س</td>
                    </tr>`).join('');

                const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>أمر إنتاج - ${order.id?.slice(0,8)}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 20px; direction: rtl; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
    .company { font-size: 20px; font-weight: 800; color: #1e40af; }
    .doc-title { font-size: 16px; font-weight: 700; color: #374151; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; }
    .meta-value { font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 800; color: #1e40af; border-right: 4px solid #1e40af; padding-right: 8px; margin: 14px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
    thead tr { background: #1e40af; color: #fff; }
    th { padding: 7px 8px; text-align: right; font-weight: 700; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals { background: #1e40af; color: #fff; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .totals .t-label { font-size: 12px; opacity: 0.85; }
    .totals .t-value { font-size: 16px; font-weight: 800; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge-carton { background: #dbeafe; color: #1e40af; }
    .badge-ton    { background: #d1fae5; color: #065f46; }
    .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    @media print {
        body { padding: 10px; }
        .no-print { display: none; }
    }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:16px;">
    <button onclick="window.print()" style="background:#1e40af;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;cursor:pointer;font-family:Arial;">
        🖨️ طباعة
    </button>
    <button onclick="window.close()" style="background:#6b7280;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:14px;cursor:pointer;margin-right:8px;font-family:Arial;">
        إغلاق
    </button>
</div>

<div class="header">
    <div>
        <div class="company">${company}</div>
        <div class="doc-title">أمر إنتاج ${isTon ? 'بالطن' : 'بالكرتون'}</div>
    </div>
    <div style="text-align:left;">
        <div style="font-size:11px;color:#6b7280;">رقم الأمر</div>
        <div style="font-size:14px;font-weight:700;font-family:monospace;">${order.id?.slice(0,8).toUpperCase()}</div>
        <div style="margin-top:4px;"><span class="badge ${isTon?'badge-ton':'badge-carton'}">${isTon?'طن':'كرتون'}</span></div>
    </div>
</div>

<div class="meta-grid">
    <div class="meta-item"><span class="meta-label">المنتج</span><span class="meta-value">${order.productName || prod?.name || '—'}</span></div>
    <div class="meta-item"><span class="meta-label">تاريخ الأمر</span><span class="meta-value">${orderDate}</span></div>
    ${isCarton ? `
    <div class="meta-item"><span class="meta-label">الحجم / SKU</span><span class="meta-value">${order.skuSize || '—'}</span></div>
    <div class="meta-item"><span class="meta-label">عدد الكراتين</span><span class="meta-value">${order.cartonCount || 0} كرتون</span></div>
    <div class="meta-item"><span class="meta-label">إجمالي الوحدات المنتجة</span><span class="meta-value">${order.unitsProduced || 0} وحدة</span></div>
    <div class="meta-item"><span class="meta-label">إجمالي اللترات</span><span class="meta-value">${(order.totalLiters||0).toFixed(2)} لتر</span></div>
    ` : `
    <div class="meta-item"><span class="meta-label">إجمالي الكميات</span><span class="meta-value">${(order.subOrders||[]).reduce((s,o)=>s+o.quantity,0).toFixed(1)} كيلو</span></div>
    <div class="meta-item"><span class="meta-label">عدد المنتجات</span><span class="meta-value">${(order.subOrders||[]).length} صنف</span></div>
    `}
    <div class="meta-item"><span class="meta-label">الحالة</span><span class="meta-value">${order.status==='completed'?'✅ مكتمل':'⏳ قيد التنفيذ'}</span></div>
    <div class="meta-item"><span class="meta-label">إجمالي التكلفة</span><span class="meta-value" style="color:#1e40af;">${(order.totalCost||0).toFixed(2)} ر.س</span></div>
</div>

${isCarton && (order.subOrders||[]).length > 0 ? `
<div class="section-title">📦 الأصناف المنتجة</div>
<table>
    <thead><tr><th>المنتج</th><th>الكمية</th><th>التكلفة</th></tr></thead>
    <tbody>${subOrderRows}</tbody>
</table>` : ''}

${rawMats.length > 0 ? `
<div class="section-title">🧪 المواد الخام المستخدمة</div>
<table>
    <thead><tr><th>#</th><th>المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${matRows(rawMats)}</tbody>
</table>` : ''}

${packMats.length > 0 ? `
<div class="section-title">📦 مواد التغليف</div>
<table>
    <thead><tr><th>#</th><th>المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${matRows(packMats)}</tbody>
</table>` : ''}

<div class="totals">
    <div>
        <div class="t-label">تكلفة المواد الخام</div>
        <div>${(order.rawMaterialCost||0).toFixed(2)} ر.س</div>
    </div>
    ${isCarton ? `<div>
        <div class="t-label">تكلفة التغليف</div>
        <div>${(order.packagingCost||0).toFixed(2)} ر.س</div>
    </div>` : ''}
    <div>
        <div class="t-label">إجمالي التكلفة</div>
        <div class="t-value">${(order.totalCost||0).toFixed(2)} ر.س</div>
    </div>
    ${isCarton ? `<div>
        <div class="t-label">تكلفة الوحدة</div>
        <div class="t-value">${order.cartonCount > 0 ? ((order.totalCost||0)/order.cartonCount).toFixed(2) : '—'} ر.س</div>
    </div>` : ''}
</div>

<div class="footer">
    <span>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</span>
    <span>معرّف الأمر: ${order.id}</span>
</div>
</body></html>`;

                const win = window.open('', '_blank', 'width=800,height=900');
                win.document.write(html);
                win.document.close();
};

proto.deleteProductionOrder = async function(orderId) {
                Swal.fire({ title: 'تأكيد الحذف', text: 'هل أنت متأكد؟ سيتم إعادة المواد الخام المنصرفة للمخزون.', icon: 'warning', showCancelButton: true,
                    confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', confirmButtonColor: '#dc3545' }).then(async (
                    result) => {
                    if (result.isConfirmed) {
                        // إعادة المواد الخام للمخزون عند حذف أمر الطن
                        const productionOrders = storage.get('productionOrders') || [];
                        const order = productionOrders.find(o => o.id === orderId);
                        if (order && order.orderType === 'ton' && order.materials?.length > 0) {
                            const reAdditions = order.materials.map(m => ({
                                materialId: m.materialId,
                                qty: -(m.requiredQty || 0) // سالب = إضافة للمخزون
                            }));
                            // نستخدم bulk-deduct بكمية سالبة = إعادة للمخزون
                            await api.post('/raw-materials/bulk-deduct', {
                                deductions: order.materials.map(m => ({
                                    materialId: m.materialId,
                                    qty: -(m.requiredQty || 0)
                                }))
                            });
                        }
                        const r = await storage.crud('productionOrders', 'delete', { id: orderId });
                        if (r.pending) return;
                        if (!r.success) return;
                        storage.showToast('تم حذف أمر الإنتاج وإعادة المواد للمخزون');
                        this.navigateTo('production');
                    }
                });
            }

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
