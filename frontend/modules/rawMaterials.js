// ============================================================
// rawMaterials.js — موديول المواد الخام
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.renderRawMaterials = function(container) {
                const rawMaterials = storage.get('rawMaterials') || [];

                // حساب الإحصائيات حسب النوع
                const countRM   = rawMaterials.filter(m => (m.materialType||'raw') === 'raw').length;
                const countPkg  = rawMaterials.filter(m => m.materialType === 'packaging').length;

                // دوال مساعدة لعرض الشارات
                const typeLabel = t => {
                    const map = { raw:'مادة خام', packaging:'مواد تعبئة' };
                    return map[t] || 'مادة خام';
                };
                const subLabel = s => {
                    const map = { chemical:'كيماوية', fragrance:'عطور', carton:'كرتون', bottle:'عبوة', spray:'بخاخ', aerosol:'ضاغط', sticker:'استيكر' };
                    return map[s] || s || '';
                };
                const typeBadgeColor = t => t === 'packaging' ? '#7c3aed' : '#1e6f9f';
                const subBadgeColor  = s => {
                    const map = { chemical:'#0891b2', fragrance:'#db2777', carton:'#92400e', bottle:'#065f46', spray:'#1d4ed8', aerosol:'#b45309', sticker:'#7f1d1d' };
                    return map[s] || '#64748b';
                };

                let html = `
                    <style>
                        .rm-type-tabs { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
                        .rm-type-tab {
                            padding:0.45rem 1.1rem; border-radius:2rem; font-size:0.85rem; font-weight:700;
                            cursor:pointer; border:2px solid transparent; transition:all 0.2s;
                            display:inline-flex; align-items:center; gap:0.4rem;
                        }
                        .rm-type-tab.active   { color:#fff; border-color:transparent; }
                        .rm-type-tab:not(.active) { background:var(--gray-100); color:var(--gray-600); border-color:var(--gray-200); }
                        .rm-type-tab:not(.active):hover { background:var(--gray-200); }
                        .rm-sub-tabs { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.75rem; padding:0.75rem 1rem; background:var(--gray-50); border-radius:var(--radius); border:1px solid var(--border-color); }
                        .rm-sub-tab {
                            padding:0.3rem 0.85rem; border-radius:2rem; font-size:0.8rem; font-weight:600;
                            cursor:pointer; border:2px solid transparent; transition:all 0.2s;
                        }
                        .rm-sub-tab.active { color:#fff; }
                        .rm-sub-tab:not(.active) { background:var(--white); color:var(--gray-600); border-color:var(--gray-200); }
                        .rm-sub-tab:not(.active):hover { background:var(--gray-100); }
                        .type-badge-rm { display:inline-block; padding:0.15rem 0.5rem; border-radius:1rem; font-size:0.7rem; font-weight:700; color:#fff; margin-right:4px; }
                        .sub-badge-rm  { display:inline-block; padding:0.1rem 0.45rem; border-radius:1rem; font-size:0.68rem; font-weight:600; color:#fff; margin-right:2px; }
                    </style>
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-cubes"></i> إدارة المواد الخام</h2>
                            <p>إدارة وتتبع جميع المواد الخام والمخزون</p>
                        </div>
                        <button class="btn btn-primary" onclick="app.showRawMaterialModal()"><i class="fas fa-plus"></i> إضافة مادة خام</button>
                    </div>

                    <!-- تبويبات النوع الرئيسي -->\n                    <div class=\"rm-type-tabs\" id=\"rmTypeTabs\">\n                        <span class=\"rm-type-tab active\" data-type=\"all\"   style=\"background:var(--primary);color:#fff;border-color:var(--primary);\" onclick=\"app.setRmTypeFilter('all')\">\n                            <i class=\"fas fa-layer-group\"></i> الكل <span style=\"background:rgba(255,255,255,0.25);border-radius:1rem;padding:0 6px;font-size:0.75rem;\">${rawMaterials.length}</span>\n                        </span>\n                        <span class=\"rm-type-tab\" data-type=\"raw\"         style=\"\"  onclick=\"app.setRmTypeFilter('raw')\">\n                            <i class=\"fas fa-flask\"></i> مواد خام <span style=\"background:rgba(0,0,0,0.08);border-radius:1rem;padding:0 6px;font-size:0.75rem;\">${countRM}</span>\n                        </span>\n                        <span class=\"rm-type-tab\" data-type=\"packaging\"   style=\"\"  onclick=\"app.setRmTypeFilter('packaging')\">\n                            <i class=\"fas fa-box-open\"></i> مواد تعبئة <span style=\"background:rgba(0,0,0,0.08);border-radius:1rem;padding:0 6px;font-size:0.75rem;\">${countPkg}</span>\n                        </span>\n                        <span class=\"rm-type-tab\" data-type=\"balances\" style=\"background:#10b981;color:#fff;border-color:#10b981;\" onclick=\"app.setRmTypeFilter('balances')\">\n                            <i class=\"fas fa-balance-scale\"></i> أرصدة المواد\n                        </span>\n                    </div>

                    <!-- تبويبات الفلترة الفرعية -->
                    <div id="rmSubTabsContainer"></div>

                    <div class="card" id="rmSearchCard" style="margin-bottom:1.25rem;">
                        <div class="card-body" style="padding:1rem 1.5rem;">
                        <div class="d-flex gap-2 flex-wrap align-center">
                        <input type="text" class="form-control" style="max-width:300px;" placeholder="🔍 بحث باسم المادة..." oninput="app.filterRawMaterials(this.value)">
                        <select class="form-control" style="max-width:180px;" onchange="app.filterRawMaterialsByUnit(this.value)">
                            <option value="">كل الوحدات</option>
                            ${(storage.get('units')||[]).map(u=>`<option value="${u.name}">${u.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-warning btn-sm" onclick="app.exportRawMaterials()"><i class="fas fa-file-excel"></i> تصدير Excel</button>
                        <button class="btn btn-success btn-sm" onclick="app.importRawMaterials()"><i class="fas fa-file-import"></i> استيراد Excel</button>
                        <button class="btn btn-info btn-sm" onclick="app.downloadTemplate('rawMaterials')"><i class="fas fa-download"></i> قالب الاستيراد</button>
                        </div>
                        </div>
                    </div>
                    <div class="table-container" id="rmTableArea">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> قائمة المواد الخام</h3>
                            <span class="status-badge status-info" id="rmCountBadge">${rawMaterials.length} مادة</span>
                        </div>
                        <div class="table-wrapper">
                        <table id="rawMaterialsTable">
                            <thead><tr><th>الكود</th><th>الاسم</th><th>النوع</th><th>الوحدة</th><th>سعر التكلفة</th><th>رقم الفاتورة</th><th>المورد</th><th>تاريخ الشراء</th><th>الكمية</th><th>الحد الأدنى</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${rawMaterials.map(m => {
                                    const t = m.materialType || 'raw';
                                    const s = m.subType || '';
                                    return `<tr class="${m.quantity <= m.minStock ? 'low-stock' : ''}" data-mtype="${t}" data-msub="${s}">
                                        <td><span style="font-family:monospace;font-weight:700;color:var(--primary);font-size:0.8rem;">${m.id}</span></td>
                                        <td><strong>${m.name}</strong>${m.quantity <= m.minStock ? ' <span class="status-badge status-danger" style="font-size:0.65rem;padding:0.1rem 0.4rem;">منخفض</span>' : ''}</td>
                                        <td>
                                            <span class="type-badge-rm" style="background:${typeBadgeColor(t)}">${typeLabel(t)}</span>
                                            ${s ? `<span class="sub-badge-rm" style="background:${subBadgeColor(s)}">${subLabel(s)}</span>` : ''}
                                        </td>
                                        <td><span style="background:var(--gray-100);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.8rem;">${m.unit}</span></td>
                                        <td><strong>${m.costPrice.toFixed(2)}</strong> ر.س</td>
                                        <td style="color:var(--text-secondary);font-size:0.82rem;">${m.invoiceNo}</td>
                                        <td>${m.supplier}</td>
                                        <td style="color:var(--text-secondary);font-size:0.82rem;">${m.purchaseDate}</td>
                                        <td>${m.quantity <= m.minStock ? '<span class="low-stock">' + m.quantity + '</span>' : m.quantity}</td>
                                        <td style="color:var(--text-secondary);">${m.minStock}</td>
                                        <td class="actions-btn">
                                            <button class="btn btn-info btn-sm" onclick="app.showRawMaterialModal('${m.id}')"><i class="fas fa-edit"></i></button>
                                            <button class="btn btn-danger btn-sm" onclick="app.deleteRawMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>`;
                                }).join('')}
                                ${rawMaterials.length === 0 ? '<tr><td colspan="11"><div class="empty-state"><i class="fas fa-cubes"></i><h3>لا توجد مواد خام</h3><p>أضف أول مادة خام للبدء</p></div></td></tr>' : ''}
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <p class="text-muted">إجمالي المواد: <strong style="color:var(--text-primary);">${rawMaterials.length}</strong></p>
                `;
                container.innerHTML = html;
                // تهيئة الفلاتر
                this._rmActiveType = 'all';
                this._rmActiveSub  = 'all';
                this._renderRmSubTabs('all');
};

proto.showRawMaterialModal = async function(editId = null) {
                const rawMaterials = storage.get('rawMaterials') || [];
                const material = editId ? rawMaterials.find(m => m.id === editId) : null;
                const isEdit = !!material;
                const suppliers = storage.get('suppliers') || [];

                const curType = material ? (material.materialType || 'raw') : 'raw';
                const curSub  = material ? (material.subType || '') : '';

                const rawSubOpts = [
                    { v:'',         l:'-- اختر --' },
                    { v:'chemical', l:'مواد كيماوية' },
                    { v:'fragrance',l:'عطور' }
                ];
                const pkgSubOpts = [
                    { v:'',        l:'-- اختر --' },
                    { v:'carton',  l:'كرتون' },
                    { v:'bottle',  l:'عبوة' },
                    { v:'spray',   l:'بخاخ' },
                    { v:'aerosol', l:'ضاغط' },
                    { v:'sticker', l:'استيكر' }
                ];

                const buildSubOpts = (typeVal, selectedSub) => {
                    const opts = typeVal === 'packaging' ? pkgSubOpts : rawSubOpts;
                    return opts.map(o => `<option value="${o.v}" ${selectedSub===o.v?'selected':''}>${o.l}</option>`).join('');
                };

                Swal.fire({
                    title: isEdit ? 'تعديل مادة خام' : 'إضافة مادة خام جديدة',
                    html: `
                        <div class="form-group"><label>اسم المادة</label><input type="text" id="rmName" class="form-control" value="${material ? material.name : ''}"></div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                        <div class="form-group">
                            <label>النوع الرئيسي</label>
                            <select id="rmMaterialType" class="form-control" onchange="
                                const s=document.getElementById('rmSubType');
                                s.innerHTML = this.value==='packaging'
                                    ? '<option value=\\'\\'>-- اختر --</option><option value=\\'carton\\'>كرتون</option><option value=\\'bottle\\'>عبوة</option><option value=\\'spray\\'>بخاخ</option><option value=\\'aerosol\\'>ضاغط</option><option value=\\'sticker\\'>استيكر</option>'
                                    : '<option value=\\'\\'>-- اختر --</option><option value=\\'chemical\\'>مواد كيماوية</option><option value=\\'fragrance\\'>عطور</option>';
                            ">
                                <option value="raw"       ${curType==='raw'       ?'selected':''}>مادة خام</option>
                                <option value="packaging" ${curType==='packaging' ?'selected':''}>مواد تعبئة</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>النوع الفرعي</label>
                            <select id="rmSubType" class="form-control">
                                ${buildSubOpts(curType, curSub)}
                            </select>
                        </div>
                        </div>

                        <div class="form-group"><label>الوحدة</label><select id="rmUnit" class="form-control">
                            ${this.getUnitsOptions(material ? material.unit : '')}
                        </select></div>
                        <div class="form-group"><label>سعر التكلفة</label><input type="number" id="rmCost" class="form-control" step="0.01" value="${material ? material.costPrice : ''}"></div>
                        <div class="form-group"><label>الرصيد الافتتاحي</label><input type="number" id="rmQty" class="form-control" step="0.01" value="${material ? (material.openingStock ?? material.quantity) : ''}" placeholder="الكمية عند الإضافة"></div>
                        <div class="form-group"><label>الحد الأدنى</label><input type="number" id="rmMinStock" class="form-control" step="0.01" value="${material ? material.minStock : '50'}"></div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: isEdit ? 'تحديث' : 'إضافة',
                    cancelButtonText: 'إلغاء',
                    width: '640px',
                    preConfirm: () => {
                        const name = document.getElementById('rmName').value.trim();
                        const costPrice = parseFloat(document.getElementById('rmCost').value);
                        const quantity = parseFloat(document.getElementById('rmQty').value);
                        if (!name || !costPrice || !quantity) { Swal.showValidationMessage(
                                'يرجى ملء جميع الحقول'); return false; }
                        return {
                            name,
                            materialType: document.getElementById('rmMaterialType').value,
                            subType:      document.getElementById('rmSubType').value,
                            unit: document.getElementById('rmUnit').value,
                            costPrice,
                            quantity,
                            openingStock: quantity,
                            minStock: parseFloat(document.getElementById('rmMinStock').value)
                        };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        if (isEdit) {
                            const index = rawMaterials.findIndex(m => m.id === editId);
                            if (index !== -1) rawMaterials[index] = { ...rawMaterials[index], ...result
                                .value };
                        } else {
                            rawMaterials.push({ id: crypto.randomUUID(),
                                ...result.value, createdAt: new Date().toISOString() });
                        }
                        const rmItem = isEdit
                            ? rawMaterials.find(m => m.id === editId)
                            : rawMaterials[rawMaterials.length - 1];
                        const rRM = await storage.crud('rawMaterials', isEdit ? 'update' : 'create', rmItem);
                        if (!rRM.pending) { storage.showToast(isEdit ? 'تم تحديث المادة' : 'تم إضافة المادة'); this.navigateTo('rawMaterials'); }
                    }
                });
};

proto.deleteRawMaterial = async function(id) {
                const recipes = storage.get('recipes') || [];
                const usingRecipes = recipes.filter(r => r.materials && r.materials.some(m => m.materialId === id));
                if (usingRecipes.length > 0) {
                    Swal.fire({
                        icon: 'error',
                        title: 'لا يمكن الحذف',
                        html: `هذه المادة مستخدمة في ${usingRecipes.length} تركيبة:<br><strong>${usingRecipes.map(r => r.productName).join('، ')}</strong><br><br>احذف التركيبات أولاً أو أزل المادة منها.`
                    });
                    return;
                }
                Swal.fire({ title: 'تأكيد الحذف', text: 'هل أنت متأكد من حذف هذه المادة؟', icon: 'warning',
                    showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#dc3545' }).then(async (result) => {
                    if (result.isConfirmed) {
                        const r = await storage.crud('rawMaterials', 'delete', { id });
                        if (r.pending) return;
                        if (!r.success) return;
                        storage.showToast('تم حذف المادة');
                        this.navigateTo('rawMaterials');
                    }
                });
};

proto.filterRawMaterials = function(query) {
                document.querySelectorAll('#rawMaterialsTable tbody tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? '' :
                        'none';
                });
};

proto.filterRawMaterialsByUnit = function(unit) {
                document.querySelectorAll('#rawMaterialsTable tbody tr').forEach(row => {
                    if (!unit) { row.style.display = ''; return; }
                    // عمود الوحدة الآن هو العمود رقم 3 (بعد إضافة عمود النوع)
                    row.style.display = row.cells[3]?.textContent.trim() === unit ? '' : 'none';
                });
            }

            // [purchases.js] — setRmTypeFilter + _renderRmBalances + showMatMovement + ... مُحمَّلة من modules/purchases.js


            // ============================================
            // EXCEL HELPER - توليد ملف Excel بتنسيق احترافي
            // ============================================

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
