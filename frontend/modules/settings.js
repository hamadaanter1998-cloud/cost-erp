// ============================================================
// settings.js — موديول الإعدادات
// ============================================================

(function(proto) {

proto.logActivity = function(action, type = 'info') {
                const log = storage.get('activityLog') || [];
                log.unshift({ action, user: currentUser?.username || 'system', timestamp: new Date().toISOString(),
                    type });
                if (log.length > 100) log.length = 100;
                storage.set('activityLog', log);
};


proto.addNotification = function(message, type = 'info') {
                const notifications = storage.get('notifications') || [];
                notifications.unshift({ id: crypto.randomUUID(), message, type, read: false, date: new Date().toISOString() });
                if (notifications.length > 50) notifications.length = 50;
                storage.set('notifications', notifications);
                document.getElementById('notifBadge').textContent = notifications.filter(n => !n.read).length;
            }

            // ============================================
            // RENDER DASHBOARD
            // ============================================
            // [dashboard.js] — renderDashboard مُحمَّل من modules/dashboard.js


            // ============================================
            // RENDER PRODUCT SUMMARY MODULE
            // ============================================
            // [productCosting.js] — renderProductSummary + renderProductCosting + showSkuCostingModal + calcSkuTotal + ... مُحمَّلة من modules/productCosting.js

proto.renderSettings = async function(container) {
                // لو الكاش فاضي، اجلب من السيرفر أولاً
                if (!storage.get('units') || storage.get('units').length === 0) {
                    try {
                        const result = await DataAPI.units.getAll();
                        if (result?.success && result.data?.length > 0) {
                            storage._cache['units'] = result.data;
                            try { localStorage.setItem('erp_units', JSON.stringify(result.data)); } catch(e) {}
                        }
                    } catch(e) {}
                }
                const units = storage.get('units') || [];
                let html = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-cog"></i> الإعدادات</h2>
                            <p>إدارة الوحدات والنسخ الاحتياطية وإعدادات النظام</p>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;align-items:start;">

                        <!-- عمود الوحدات -->
                        <div class="table-container">
                            <div class="table-header">
                                <h3><i class="fas fa-ruler-combined"></i> إدارة الوحدات</h3>
                                <button class="btn btn-success btn-sm" onclick="app.addUnitModal()"><i class="fas fa-plus"></i> إضافة</button>
                            </div>
                            <table>
                                <thead><tr><th>#</th><th>اسم الوحدة</th><th>إجراءات</th></tr></thead>
                                <tbody id="unitsTableBody">
                                    ${units.length === 0
                                        ? '<tr><td colspan="3" class="text-center">لا توجد وحدات</td></tr>'
                                        : units.map((u, i) => `<tr>
                                            <td><span style="background:var(--gray-100);width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700;">${i + 1}</span></td>
                                            <td><strong>${u.name}</strong></td>
                                            <td class="actions-btn"><button class="btn btn-danger btn-sm" onclick="app.deleteUnit('${u.id}')"><i class="fas fa-trash"></i></button></td>
                                          </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- عمود الإعدادات العامة -->
                        <div class="card">
                            <div class="card-header">
                                <h3><i class="fas fa-sliders-h"></i> الإعدادات العامة</h3>
                            </div>
                            <div class="card-body" style="display:flex;flex-direction:column;gap:1rem;">
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--border-color);">
                                    <div><div style="font-weight:600;font-size:0.9rem;">الوضع الليلي</div><div style="font-size:0.78rem;color:var(--text-secondary);">تغيير مظهر النظام</div></div>
                                    <input type="checkbox" id="darkModeSetting" ${darkMode?'checked':''} onchange="app.toggleDarkMode()" style="width:18px;height:18px;cursor:pointer;">
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="app.backupData()"><i class="fas fa-download"></i> تحميل نسخة احتياطية</button>
                                <div>
                                    <label style="font-size:0.85rem;font-weight:600;color:var(--gray-700);display:block;margin-bottom:0.4rem;">استعادة نسخة احتياطية</label>
                                    <input type="file" id="restoreFile" accept=".json" class="form-control" onchange="app.restoreData(this)">
                                </div>
                                <button class="btn btn-warning btn-sm w-full" onclick="app.navigateTo('sizeTemplates')"><i class="fas fa-ruler-combined"></i> إدارة قوالب الأحجام</button>
                                <button class="btn btn-danger btn-sm" onclick="app.resetAllData()"><i class="fas fa-trash"></i> إعادة تعيين جميع البيانات</button>
                                <div style="padding:0.75rem 1rem;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--border-color);font-size:0.82rem;color:var(--text-secondary);">
                                    <i class="fas fa-info-circle" style="color:var(--info);margin-left:4px;"></i>
                                    الإصدار: 2.0.0 | المستخدم: <strong style="color:var(--text-primary);">${currentUser?.name||'غير معروف'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML = html;
};


proto.renderSizeTemplates = async function(container) {
                // لو الكاش فاضي، اجلب من السيرفر أولاً
                if (!storage.get('sizeTemplates') || storage.get('sizeTemplates').length === 0) {
                    try {
                        const result = await DataAPI.sizeTemplates.getAll();
                        if (result?.success && result.data?.length > 0) {
                            storage._cache['sizeTemplates'] = result.data;
                            try { localStorage.setItem('erp_sizeTemplates', JSON.stringify(result.data)); } catch(e) {}
                        }
                    } catch(e) {}
                }
                const templates = storage.get('sizeTemplates') || [];
                let html = `
                    <div class="page-header">
                        <div style="display:flex;align-items:center;gap:1rem;">
                            <button class="btn btn-outline-primary btn-sm" onclick="app.navigateTo('settings')"><i class="fas fa-arrow-right"></i> رجوع</button>
                            <div>
                                <h2><i class="fas fa-ruler-combined"></i> قوالب الأحجام</h2>
                                <p>إدارة أحجام العبوات والكراتين المستخدمة في حساب التكاليف</p>
                            </div>
                        </div>
                        <button class="btn btn-success" onclick="app.showSizeTemplateModal()"><i class="fas fa-plus"></i> إضافة قالب</button>
                    </div>
                    <div class="card" style="margin-bottom:1.25rem;">
                        <div class="card-body" style="padding:0.9rem 1.25rem;">
                            <div style="display:flex;align-items:flex-start;gap:0.75rem;">
                                <i class="fas fa-lightbulb" style="color:var(--warning);margin-top:2px;font-size:1rem;flex-shrink:0;"></i>
                                <p style="margin:0;font-size:0.875rem;color:var(--text-secondary);line-height:1.6;">كل قالب يحفظ: <strong style="color:var(--text-primary);">اسم الحجم</strong> + <strong style="color:var(--text-primary);">السعة (لتر)</strong> + <strong style="color:var(--text-primary);">عدد العبوات في الكرتون</strong>. عند إنشاء SKU اختر القالب وتُملأ الحقول الثلاثة تلقائياً.</p>
                            </div>
                        </div>
                    </div>
                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> قائمة القوالب</h3>
                            <span class="status-badge status-info">${templates.length} قالب</span>
                        </div>
                        <div class="table-wrapper">
                        <table>
                            <thead><tr><th>#</th><th>اسم القالب</th><th>السعة (لتر)</th><th>عبوات/كرتون</th><th>لترات/كرتون</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${templates.length === 0
                                    ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-ruler-combined"></i><h3>لا توجد قوالب</h3><p>أضف قالباً جديداً للبدء</p></div></td></tr>`
                                    : templates.map((t, i) => `<tr>
                                        <td><span style="background:var(--gray-100);width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700;">${i + 1}</span></td>
                                        <td><strong>${t.name}</strong></td>
                                        <td><span style="background:var(--primary-ultra-light);color:var(--primary);padding:0.2rem 0.6rem;border-radius:20px;font-weight:700;">${t.sizeLiters} ل</span></td>
                                        <td>${t.unitsPerCarton}</td>
                                        <td><strong style="color:var(--success);">${(t.sizeLiters * t.unitsPerCarton).toFixed(3)} ل</strong></td>
                                        <td class="actions-btn">
                                            <button class="btn btn-info btn-sm" onclick="app.showSizeTemplateModal('${t.id}')"><i class="fas fa-edit"></i></button>
                                            <button class="btn btn-danger btn-sm" onclick="app.deleteSizeTemplate('${t.id}')"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                        </div>
                    </div>
                `;
                container.innerHTML = html;
};


proto.showSizeTemplateModal = async function(templateId = null) {
                const templates = storage.get('sizeTemplates') || [];
                const tmpl = templateId ? templates.find(t => t.id === templateId) : null;
                const isEdit = !!tmpl;

                Swal.fire({
                    title: isEdit ? `تعديل قالب: ${tmpl.name}` : 'إضافة قالب حجم جديد',
                    html: `
                        <div class="form-group">
                            <label>اسم القالب *</label>
                            <input type="text" id="stName" class="form-control" placeholder="مثال: 500مل عادي، 500مل بخاخ، 1لتر..." value="${tmpl?.name || ''}">
                            <small style="color:var(--text-secondary);">سمِّه بشكل مميز — نفس الحجم يمكن أن يكون له أكثر من قالب</small>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.75rem;">
                            <div class="form-group">
                                <label>سعة العبوة (لتر) *</label>
                                <input type="number" id="stSizeLiters" class="form-control" step="0.001" min="0.001" placeholder="مثال: 0.5" value="${tmpl?.sizeLiters || ''}" oninput="app.calcStPreview()">
                            </div>
                            <div class="form-group">
                                <label>عدد العبوات في الكرتون *</label>
                                <input type="number" id="stUnitsPerCarton" class="form-control" step="1" min="1" placeholder="مثال: 24" value="${tmpl?.unitsPerCarton || ''}" oninput="app.calcStPreview()">
                            </div>
                        </div>
                        <div id="stPreview" style="background:linear-gradient(135deg,#198754,#157347);color:white;border-radius:8px;padding:0.65rem 1rem;margin-top:0.75rem;display:flex;justify-content:space-between;align-items:center;font-size:0.9rem;">
                            <span>📦 إجمالي لترات الكرتون</span>
                            <strong id="stPreviewVal">${tmpl ? (tmpl.sizeLiters * tmpl.unitsPerCarton).toFixed(3) + ' لتر' : '—'}</strong>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: isEdit ? 'تحديث' : 'حفظ',
                    cancelButtonText: 'إلغاء',
                    width: '500px',
                    didOpen: () => { app.calcStPreview(); },
                    preConfirm: () => {
                        const name = document.getElementById('stName').value.trim();
                        const sizeLiters = parseFloat(document.getElementById('stSizeLiters').value);
                        const unitsPerCarton = parseInt(document.getElementById('stUnitsPerCarton').value);
                        if (!name) { Swal.showValidationMessage('يرجى إدخال اسم القالب'); return false; }
                        if (!sizeLiters || sizeLiters <= 0) { Swal.showValidationMessage('يرجى إدخال سعة العبوة'); return false; }
                        if (!unitsPerCarton || unitsPerCarton <= 0) { Swal.showValidationMessage('يرجى إدخال عدد العبوات'); return false; }
                        return { name, sizeLiters, unitsPerCarton };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const templates = storage.get('sizeTemplates') || [];
                        if (isEdit) {
                            const idx = templates.findIndex(t => t.id === templateId);
                            if (idx !== -1) templates[idx] = { ...templates[idx], ...result.value };
                        } else {
                            templates.push({ id: crypto.randomUUID(), ...result.value });
                        }
                        const tItem = isEdit
                            ? templates.find(t => t.id === templateId)
                            : templates[templates.length-1];
                        const rT = await storage.crud('sizeTemplates', isEdit ? 'update' : 'create', tItem);
                        if (!rT.pending) { storage.showToast(isEdit ? 'تم تحديث القالب' : 'تم إضافة القالب'); this.navigateTo('sizeTemplates'); }
                    }
                });
};


proto.deleteSizeTemplate = async function(templateId) {
                const templates = storage.get('sizeTemplates') || [];
                const tmpl = templates.find(t => t.id === templateId);
                if (!tmpl) return;
                Swal.fire({
                    title: 'حذف القالب',
                    text: `هل تريد حذف قالب "${tmpl.name}"؟`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'حذف',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#dc3545'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const r = await storage.crud('sizeTemplates', 'delete', { id: templateId });
                        if (!r.pending && r.success) {
                            storage.showToast('تم حذف القالب');
                            this.navigateTo('sizeTemplates');
                        }
                    }
                });
};


proto.applySkuSizeTemplate = function(templateId) {
                if (!templateId) return;
                const templates = storage.get('sizeTemplates') || [];
                const tmpl = templates.find(t => t.id === templateId);
                if (!tmpl) return;
                const nameEl  = document.getElementById('skuSizeName');
                const litreEl = document.getElementById('skuSizeLiters');
                const unitsEl = document.getElementById('skuUnitsPerCarton');
                if (nameEl)  nameEl.value  = tmpl.name;
                if (litreEl) litreEl.value = tmpl.sizeLiters;
                if (unitsEl) unitsEl.value = tmpl.unitsPerCarton;
                this.calcSkuTotal();
                storage.showToast(`✅ "${tmpl.name}" — ${tmpl.unitsPerCarton} عبوة × ${tmpl.sizeLiters}ل`);
            }

                        async addUnitModal() {
                Swal.fire({
                    title: 'إضافة وحدة جديدة',
                    html: `<div class="form-group"><label>اسم الوحدة</label><input type="text" id="newUnitName" class="form-control" placeholder="مثال: حبة، كرتون، متر..."></div>`,
                    showCancelButton: true,
                    confirmButtonText: 'إضافة',
                    cancelButtonText: 'إلغاء',
                    preConfirm: () => {
                        const name = document.getElementById('newUnitName').value.trim();
                        if (!name) { Swal.showValidationMessage('يرجى إدخال اسم الوحدة'); return false; }
                        const units = storage.get('units') || [];
                        if (units.some(u => u.name === name)) { Swal.showValidationMessage('هذه الوحدة موجودة مسبقاً'); return false; }
                        return name;
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const units = storage.get('units') || [];
                        units.push({ id: crypto.randomUUID(), name: result.value });
                        const uItem = units[units.length-1];
                        const rU = await storage.crud('units', 'create', uItem);
                        if (!rU.pending) { storage.showToast('تمت إضافة الوحدة: ' + result.value); this.navigateTo('settings'); }
                    }
                });
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
