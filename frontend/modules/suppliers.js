// ============================================================
// suppliers.js — موديول الموردين
// ============================================================

(function(proto) {

proto.exportSuppliers = function() {
                const suppliers = storage.get('suppliers') || [];
                if (suppliers.length === 0) { storage.showToast('لا يوجد موردون للتصدير', 'warning'); return; }
                const headers = ['الكود', 'الاسم', 'الهاتف', 'البريد الإلكتروني', 'العنوان', 'إجمالي المشتريات (ر.س)'];
                const rows = suppliers.map(s => [s.id, s.name, s.phone, s.email, s.address, s.totalPurchases]);
                this._makeXlsx([{ name: 'الموردون', headers, rows, colWidths: [12, 22, 14, 26, 28, 20] }], 'الموردون.xlsx');
                storage.showToast('تم تصدير الموردين بنجاح');
};


proto.importSuppliers = function() {
                this._openFilePicker('.xlsx,.xls,.csv', (buffer, fname) => {
                    try {
                        const wb2 = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                        const dataSheet = wb2.SheetNames.find(s => s.trim() === 'الموردون') || wb2.SheetNames[0];
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
                        const existing = storage.get('suppliers') || [];
                        const existingNames = new Set(existing.map(s => s.name.trim()));
                        const newItems = [];

                        rows.forEach((row, i) => {
                            const name = String(getVal(row, 'الاسم *','الاسم','name')).trim();
                            if (!name || name.startsWith('لا يوجد') || name.startsWith('حقل')) {
                                skipped++;
                                if (name && skippedReasons.length < 5) skippedReasons.push('صف ' + (i+2) + ': الاسم فارغ');
                                return;
                            }

                            // تحذير تكرار بدون رفض
                            const isDuplicate = existingNames.has(name);

                            newItems.push({
                                id: crypto.randomUUID(),
                                name,
                                phone:          String(getVal(row, 'الهاتف','phone')).trim() || '',
                                email:          String(getVal(row, 'البريد الإلكتروني','البريد','email')).trim() || '',
                                address:        String(getVal(row, 'العنوان','address')).trim() || '',
                                region:         String(getVal(row, 'المنطقة','region')).trim() || '',
                                specialty:      String(getVal(row, 'تخصص المورد','specialty')).trim() || '',
                                notes:          String(getVal(row, 'ملاحظات','notes')).trim() || '',
                                totalPurchases: parseFloat(String(getVal(row, 'إجمالي المشتريات (ر.س)','إجمالي المشتريات','totalPurchases')).replace(/,/g,'')) || 0,
                                _duplicate: isDuplicate,
                                createdAt: new Date().toISOString()
                            });
                            existingNames.add(name);
                            imported++;
                        });

                        if (imported === 0) {
                            Swal.fire({ icon:'error', title:'لم يتم استيراد اي صف',
                                html: '<div style="text-align:right;">تاكد من وجود عمود <b>الاسم *</b> وانه غير فارغ</div>',
                                confirmButtonText:'حسنا' });
                            return;
                        }

                        const duplicates = newItems.filter(x => x._duplicate);
                        Swal.fire({
                            title: 'تاكيد الاستيراد',
                            html: '<div style="text-align:right;line-height:2;">' +
                                '<div>سيتم اضافة <strong>' + imported + '</strong> مورد.</div>' +
                                (skipped > 0 ? '<div style="color:#dc3545;">تم تخطي ' + skipped + ' صف (اسم فارغ)</div>' : '') +
                                (duplicates.length > 0 ? '<div style="color:#d97706;font-size:13px;">تحذير: ' + duplicates.length + ' مورد يبدو مكررا: ' + duplicates.map(x=>x.name).join('، ') + '</div>' : '') +
                                '<div style="margin-top:8px;">هل تريد الاضافة للموجود ام استبدال الكل؟</div></div>',
                            icon: 'question', showCancelButton: true, showDenyButton: true,
                            confirmButtonText: 'اضافة للموجود', denyButtonText: 'استبدال الكل', cancelButtonText: 'الغاء'
                        }).then(async (result) => {
                            if (result.isConfirmed || result.isDenied) {
                                const cleaned = newItems.map(x => { const {_duplicate, ...rest} = x; return rest; });
                                const suppliersToImport = result.isConfirmed ? [...existing, ...cleaned] : cleaned;
                                storage.set('suppliers', suppliersToImport);
                                for (const s of cleaned) { await storage.crud('suppliers', 'create', s); }
                                storage.showToast('تم إرسال طلب استيراد ' + imported + ' مورد للموافقة');
                                this.navigateTo('suppliers');
                            }
                        });
                    } catch(e) {
                        Swal.fire({ icon:'error', title:'خطا في قراءة الملف',
                            html: '<div style="text-align:right;">' + e.message +
                                '<div style="margin-top:8px;font-size:12px;color:#64748b;">تاكد ان الملف بصيغة xlsx وغير محمي بكلمة مرور</div></div>',
                            confirmButtonText:'حسنا' });
                    }
                });
            }



            // ============================================
            // RENDER PRODUCTS MODULE
            // ============================================

proto.renderSuppliers = function(container) {
                const suppliers = storage.get('suppliers') || [];
                const rawMaterials = storage.get('rawMaterials') || [];
                let html = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-truck"></i> الموردين</h2>
                            <p>إدارة بيانات الموردين وعلاقاتهم بالمواد الخام</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-primary" onclick="app.showSupplierModal()"><i class="fas fa-plus"></i> إضافة مورد</button>
                            <button class="btn btn-warning btn-sm" onclick="app.exportSuppliers()"><i class="fas fa-file-excel"></i> تصدير</button>
                            <button class="btn btn-success btn-sm" onclick="app.importSuppliers()"><i class="fas fa-file-import"></i> استيراد</button>
                            <button class="btn btn-info btn-sm" onclick="app.downloadTemplate('suppliers')"><i class="fas fa-download"></i> قالب</button>
                        </div>
                    </div>
                    <div class="product-cards-grid">
                        ${suppliers.map(s => {
                            const related = rawMaterials.filter(m => m.supplier === s.name);
                            const totalSpend = s.totalPurchases || 0;
                            return `<div class="product-card">
                                <div class="card-img" style="background:linear-gradient(135deg,#f97316,#ea580c);position:relative;">
                                    <i class="fas fa-truck" style="font-size:2rem;"></i>
                                    <span style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.2);color:white;font-size:0.68rem;padding:2px 8px;border-radius:20px;">${s.id}</span>
                                </div>
                                <div class="card-body">
                                    <h4 style="margin-bottom:0.75rem;">${s.name}</h4>
                                    <div style="display:flex;flex-direction:column;gap:0.35rem;margin-bottom:0.75rem;">
                                        <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.83rem;">
                                            <i class="fas fa-phone" style="color:var(--success);width:14px;"></i>
                                            <span>${s.phone || 'غير محدد'}</span>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.83rem;">
                                            <i class="fas fa-envelope" style="color:var(--info);width:14px;"></i>
                                            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.email || 'غير محدد'}</span>
                                        </div>
                                    </div>
                                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-bottom:0.75rem;">
                                        <div style="background:var(--primary-ultra-light);border-radius:8px;padding:0.4rem 0.6rem;text-align:center;">
                                            <div style="font-size:0.68rem;color:var(--primary);font-weight:600;">المواد</div>
                                            <div style="font-weight:800;font-size:1rem;">${related.length}</div>
                                        </div>
                                        <div style="background:#fff4ed;border-radius:8px;padding:0.4rem 0.6rem;text-align:center;">
                                            <div style="font-size:0.68rem;color:#f97316;font-weight:600;">المشتريات</div>
                                            <div style="font-weight:800;font-size:0.8rem;">${totalSpend.toLocaleString('ar-SA')}</div>
                                        </div>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-info btn-sm" style="flex:1;" onclick="app.showSupplierModal('${s.id}')"><i class="fas fa-edit"></i> تعديل</button>
                                        <button class="btn btn-danger btn-sm" onclick="app.deleteSupplier('${s.id}')"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                        ${suppliers.length === 0 ? `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-truck"></i><h3>لا يوجد موردون</h3><p>أضف أول مورد للبدء</p></div>` : ''}
                    </div>
                `;
                container.innerHTML = html;
};


proto.showSupplierModal = async function(editId = null) {
                const suppliers = storage.get('suppliers') || [];
                const supplier = editId ? suppliers.find(s => s.id === editId) : null;
                Swal.fire({
                    title: supplier ? 'تعديل مورد' : 'إضافة مورد',
                    html: `
                        <div class="form-group"><label>الاسم</label><input type="text" id="supName" class="form-control" value="${supplier?supplier.name:''}"></div>
                        <div class="form-group"><label>الهاتف</label><input type="text" id="supPhone" class="form-control" value="${supplier?supplier.phone:''}"></div>
                        <div class="form-group"><label>الإيميل</label><input type="email" id="supEmail" class="form-control" value="${supplier?supplier.email:''}"></div>
                        <div class="form-group"><label>العنوان</label><input type="text" id="supAddress" class="form-control" value="${supplier?supplier.address:''}"></div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: supplier ? 'تحديث' : 'إضافة',
                    cancelButtonText: 'إلغاء',
                    preConfirm: () => {
                        const name = document.getElementById('supName').value.trim();
                        if (!name) { Swal.showValidationMessage('يرجى إدخال الاسم'); return false; }
                        return { name, phone: document.getElementById('supPhone').value.trim(), email: document
                                .getElementById('supEmail').value.trim(), address: document.getElementById(
                                    'supAddress').value.trim() };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        if (supplier) {
                            const idx = suppliers.findIndex(s => s.id === editId);
                            if (idx !== -1) suppliers[idx] = { ...suppliers[idx], ...result.value };
                        } else {
                            suppliers.push({ id: crypto.randomUUID(),
                                ...result.value, totalPurchases: 0, createdAt: new Date()
                                .toISOString() });
                        }
                        const sItem = supplier
                            ? { ...suppliers.find(s => s.id === editId) }
                            : suppliers[suppliers.length - 1];
                        const rSup = await storage.crud('suppliers', supplier ? 'update' : 'create', sItem);
                        if (!rSup.pending) { storage.showToast(supplier ? 'تم تحديث المورد' : 'تم إضافة المورد'); this.navigateTo('suppliers'); }
                    }
                });
};


proto.deleteSupplier = async function(id) {
                Swal.fire({ title: 'تأكيد الحذف', text: 'هل أنت متأكد؟', icon: 'warning', showCancelButton: true,
                    confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', confirmButtonColor: '#dc3545' }).then(async (result) => {
                    if (result.isConfirmed) {
                        const r = await storage.crud('suppliers', 'delete', { id });
                        if (r.pending) return;
                        if (!r.success) return;
                        storage.showToast('تم حذف المورد');
                        this.navigateTo('suppliers');
                    }
                });
            }

            // ============================================
            // RENDER PURCHASES MODULE — موديول المشتريات
            // ============================================
            // [purchases.js] — renderPurchases + showPurchaseModal + ... مُحمَّلة من modules/purchases.js

            // ============================================
            // RENDER PRODUCT BALANCES — أرصدة المنتجات النهائية
            // ============================================

            // ============================================
            // RENDER CUSTOMERS MODULE — موديول العملاء
            // ============================================
            // [sales.js] — renderCustomers + renderSales + showCustomerModal + showSaleModal + ... مُحمَّلة من modules/sales.js
            // ============================================
            // RENDER REPORTS MODULE
            // ============================================
            // [reports.js] — renderReports + _reportTab + _initReportCharts + _drawRmChart + exportReportExcel مُحمَّلة من modules/reports.js

            // ============================================
            // RENDER SIZE TEMPLATES PAGE
            // ============================================

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
