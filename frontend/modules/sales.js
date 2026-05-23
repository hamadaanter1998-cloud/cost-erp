// ============================================================
// sales.js — موديول المبيعات والعملاء
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.renderCustomers = function(container) {
                const customers = storage.get('customers') || [];
                const salesOrders = storage.get('salesOrders') || [];

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-users"></i> العملاء</h2>
                            <p>إدارة بيانات العملاء وسجل مبيعاتهم</p>
                        </div>
                        <button class="btn btn-primary" onclick="app.showCustomerModal()"><i class="fas fa-plus"></i> عميل جديد</button>
                    </div>

                    <div class="stats-row" style="margin-bottom:1.5rem;">
                        <div class="stat-card card-blue">
                            <div class="icon bg-blue"><i class="fas fa-users"></i></div>
                            <div class="info"><p>إجمالي العملاء</p><h3>${customers.length}</h3><span class="trend">عميل</span></div>
                        </div>
                        <div class="stat-card card-green">
                            <div class="icon bg-green"><i class="fas fa-file-invoice-dollar"></i></div>
                            <div class="info"><p>إجمالي الفواتير</p><h3>${salesOrders.length}</h3><span class="trend">فاتورة</span></div>
                        </div>
                        <div class="stat-card card-purple">
                            <div class="icon bg-purple"><i class="fas fa-coins"></i></div>
                            <div class="info"><p>إجمالي المبيعات</p><h3 style="font-size:1.1rem;">${(salesOrders.reduce((s,o)=>s+(o.totalAmount||0),0)/1000).toFixed(1)}k</h3><span class="trend trend-up">ريال</span></div>
                        </div>
                    </div>

                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> قائمة العملاء</h3>
                            <input type="text" class="form-control" style="max-width:220px;font-size:0.85rem;" placeholder="🔍 بحث..." oninput="app._filterTable('customersTable', this.value)">
                        </div>
                        <div class="table-wrapper">
                            <table id="customersTable">
                                <thead><tr><th>الاسم</th><th>التليفون</th><th>الإيميل</th><th>العنوان</th><th>الفواتير</th><th>إجمالي المشتريات</th><th>إجراءات</th></tr></thead>
                                <tbody>
                                    ${customers.length === 0
                                        ? `<tr><td colspan="7"><div class="empty-state" style="padding:2rem;"><i class="fas fa-users"></i><h3>لا يوجد عملاء</h3><p>أضف أول عميل للبدء</p></div></td></tr>`
                                        : customers.map(c => {
                                            const cOrders = salesOrders.filter(o => o.customerId === c.id);
                                            const total = cOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
                                            return `<tr data-search="${c.name.toLowerCase()} ${c.phone||''} ${c.email||''}">
                                                <td><strong>${c.name}</strong></td>
                                                <td>${c.phone||'—'}</td>
                                                <td style="color:var(--text-secondary);font-size:0.85rem;">${c.email||'—'}</td>
                                                <td style="color:var(--text-secondary);font-size:0.85rem;">${c.address||'—'}</td>
                                                <td><span class="status-badge status-info">${cOrders.length} فاتورة</span></td>
                                                <td><strong style="color:var(--success);">${total.toLocaleString('ar-SA',{minimumFractionDigits:2})} ر.س</strong></td>
                                                <td>
                                                    <div class="d-flex gap-1">
                                                        <button class="btn btn-info btn-sm" onclick="app.showCustomerModal('${c.id}')"><i class="fas fa-edit"></i></button>
                                                        <button class="btn btn-primary btn-sm" onclick="app.showSaleModal(null,'${c.id}')" title="فاتورة جديدة"><i class="fas fa-file-invoice-dollar"></i></button>
                                                        <button class="btn btn-danger btn-sm" onclick="app.deleteCustomer('${c.id}')"><i class="fas fa-trash"></i></button>
                                                    </div>
                                                </td>
                                            </tr>`;}).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
};

proto.showCustomerModal = async function(editId = null) {
                const customers = storage.get('customers') || [];
                const c = editId ? customers.find(x => x.id === editId) : null;
                const { value } = await Swal.fire({
                    title: c ? 'تعديل بيانات العميل' : 'إضافة عميل جديد',
                    html: `
                        <div style="text-align:right;">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
                                <div><label style="font-size:0.82rem;font-weight:600;">الاسم *</label><input id="cName" class="swal2-input" style="margin:0;width:100%;" value="${c?.name||''}"></div>
                                <div><label style="font-size:0.82rem;font-weight:600;">التليفون</label><input id="cPhone" class="swal2-input" style="margin:0;width:100%;" value="${c?.phone||''}"></div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
                                <div><label style="font-size:0.82rem;font-weight:600;">الإيميل</label><input id="cEmail" class="swal2-input" style="margin:0;width:100%;" value="${c?.email||''}"></div>
                                <div><label style="font-size:0.82rem;font-weight:600;">العنوان</label><input id="cAddress" class="swal2-input" style="margin:0;width:100%;" value="${c?.address||''}"></div>
                            </div>
                            <div><label style="font-size:0.82rem;font-weight:600;">ملاحظات</label><input id="cNotes" class="swal2-input" style="margin:0;width:100%;" value="${c?.notes||''}"></div>
                        </div>`,
                    showCancelButton: true,
                    confirmButtonText: c ? 'تحديث' : 'حفظ',
                    cancelButtonText: 'إلغاء',
                    preConfirm: () => {
                        const name = document.getElementById('cName').value.trim();
                        if (!name) { Swal.showValidationMessage('الاسم مطلوب'); return false; }
                        return { name, phone: document.getElementById('cPhone').value.trim(), email: document.getElementById('cEmail').value.trim(), address: document.getElementById('cAddress').value.trim(), notes: document.getElementById('cNotes').value.trim() };
                    }
                });
                if (!value) return;
                const customer = c ? { ...c, ...value } : { id: crypto.randomUUID(), ...value, createdAt: new Date().toISOString() };
                await storage.crud('customers', c ? 'update' : 'create', customer);
                storage.showToast(c ? 'تم تحديث بيانات العميل' : 'تم إضافة العميل');
                this.navigateTo('customers');
};

proto.deleteCustomer = async function(id) {
                const result = await Swal.fire({ title: 'حذف العميل', text: 'هل أنت متأكد؟', icon: 'warning', showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#dc3545' });
                if (!result.isConfirmed) return;
                await storage.crud('customers', 'delete', { id });
                storage.showToast('تم حذف العميل');
                this.navigateTo('customers');
            }

            // ============================================
            // RENDER SALES MODULE — موديول المبيعات
            // ============================================
proto.renderSales = function(container) {
                const orders = storage.get('salesOrders') || [];
                const totalRevenue = orders.reduce((s,o) => s+(o.totalAmount||0), 0);
                const pending = orders.filter(o => o.status==='draft'||o.status==='confirmed').length;
                const delivered = orders.filter(o => o.status==='delivered').length;

                const statusLabel = { draft:'مسودة', confirmed:'مؤكد', delivered:'تم التسليم', cancelled:'ملغي' };
                const statusClass = { draft:'status-secondary', confirmed:'status-info', delivered:'status-success', cancelled:'status-danger' };

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-file-invoice-dollar"></i> المبيعات</h2>
                            <p>إنشاء وإدارة فواتير المبيعات للعملاء</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-primary" onclick="app.showSaleModal()"><i class="fas fa-plus"></i> فاتورة جديدة</button>
                            <button class="btn btn-warning btn-sm" onclick="app.exportSales()"><i class="fas fa-file-excel"></i> تصدير</button>
                        </div>
                    </div>

                    <div class="stats-row" style="margin-bottom:1.5rem;">
                        <div class="stat-card card-blue">
                            <div class="icon bg-blue"><i class="fas fa-file-invoice"></i></div>
                            <div class="info"><p>إجمالي الفواتير</p><h3>${orders.length}</h3><span class="trend">فاتورة</span></div>
                        </div>
                        <div class="stat-card card-orange">
                            <div class="icon bg-orange"><i class="fas fa-clock"></i></div>
                            <div class="info"><p>قيد التنفيذ</p><h3>${pending}</h3><span class="trend">فاتورة</span></div>
                        </div>
                        <div class="stat-card card-green">
                            <div class="icon bg-green"><i class="fas fa-check-circle"></i></div>
                            <div class="info"><p>تم التسليم</p><h3>${delivered}</h3><span class="trend trend-up">فاتورة</span></div>
                        </div>
                        <div class="stat-card card-purple">
                            <div class="icon bg-purple"><i class="fas fa-coins"></i></div>
                            <div class="info"><p>إجمالي الإيرادات</p><h3 style="font-size:1.2rem;">${(totalRevenue/1000).toFixed(1)}k</h3><span class="trend trend-up">ريال</span></div>
                        </div>
                    </div>

                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> قائمة فواتير المبيعات</h3>
                            <input type="text" class="form-control" style="max-width:220px;font-size:0.85rem;" placeholder="🔍 بحث..." oninput="app._filterTable('salesTable', this.value)">
                        </div>
                        <div class="table-wrapper">
                            <table id="salesTable">
                                <thead>
                                    <tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الأصناف</th><th>الخصم</th><th>الإجمالي</th><th>الحالة</th><th>إجراءات</th></tr>
                                </thead>
                                <tbody>
                                    ${orders.length === 0
                                        ? `<tr><td colspan="8"><div class="empty-state" style="padding:2rem;"><i class="fas fa-file-invoice-dollar"></i><h3>لا توجد فواتير</h3><p>أنشئ أول فاتورة مبيعات</p></div></td></tr>`
                                        : orders.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).map(o => `
                                        <tr data-search="${o.orderNumber} ${o.customerName||''}">
                                            <td><span style="font-family:monospace;font-weight:700;color:var(--primary);font-size:0.85rem;">${o.orderNumber}</span></td>
                                            <td><strong>${o.customerName||'—'}</strong></td>
                                            <td style="color:var(--text-secondary);font-size:0.82rem;">${o.orderDate ? new Date(o.orderDate).toLocaleDateString('ar-SA') : '—'}</td>
                                            <td><span class="status-badge status-info">${(o.items||[]).length} صنف</span></td>
                                            <td style="color:#f97316;">${o.discountAmt > 0 ? (o.discountAmt.toLocaleString('ar-SA',{minimumFractionDigits:2})+' ر.س') : '—'}</td>
                                            <td><strong style="color:var(--success);">${(o.totalAmount||0).toLocaleString('ar-SA',{minimumFractionDigits:2})} ر.س</strong></td>
                                            <td><span class="status-badge ${statusClass[o.status]||'status-secondary'}">${statusLabel[o.status]||o.status}</span></td>
                                            <td>
                                                <div class="d-flex gap-1">
                                                    <button class="btn btn-info btn-sm" onclick="app.showSaleModal('${o.id}')"><i class="fas fa-edit"></i></button>
                                                    ${o.status==='confirmed' ? `<button class="btn btn-success btn-sm" onclick="app.deliverSaleOrder('${o.id}')" title="تسليم"><i class="fas fa-check"></i></button>` : ''}
                                                    <button class="btn btn-danger btn-sm" onclick="app.deleteSaleOrder('${o.id}')"><i class="fas fa-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
};

proto.showSaleModal = async function(editId = null, preCustomerId = null) {
                const orders   = storage.get('salesOrders') || [];
                const customers = storage.get('customers')  || [];
                const products  = storage.get('products')   || [];
                const order = editId ? orders.find(o => o.id === editId) : null;

                window._soItems = order ? JSON.parse(JSON.stringify(order.items || [])) : [];
                window._soProducts = products;

                const statusOpts = ['draft','confirmed','delivered','cancelled'];
                const statusAr = { draft:'مسودة', confirmed:'مؤكد', delivered:'تم التسليم', cancelled:'ملغي' };

                Swal.fire({
                    title: order ? 'تعديل فاتورة مبيعات' : 'فاتورة مبيعات جديدة',
                    width: '820px',
                    html: `
                        <style>
                            #saleForm .form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;}
                            #saleForm .form-group{display:flex;flex-direction:column;text-align:right;margin-bottom:0.5rem;}
                            #saleForm label{font-size:0.82rem;font-weight:600;margin-bottom:0.25rem;color:#555;}
                            #saleForm .form-control{border:1px solid #ddd;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.9rem;width:100%;}
                            #saleItems table{width:100%;border-collapse:collapse;font-size:0.82rem;border:1px solid #ddd;border-radius:8px;overflow:hidden;}
                            #saleItems th{background:#f5f5f5;padding:0.4rem 0.5rem;text-align:right;border-bottom:1px solid #ddd;}
                            #saleItems td{padding:0.3rem 0.4rem;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
                            #saleItems input,#saleItems select{border:1px solid #ddd;border-radius:4px;padding:0.2rem 0.4rem;font-size:0.82rem;width:100%;}
                            .so-totals{background:#f8f9fa;border-radius:8px;padding:0.75rem;margin-top:0.75rem;text-align:right;}
                            .so-totals div{display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.88rem;}
                            .so-totals .total-row{font-weight:800;font-size:1rem;color:var(--primary);border-top:1px solid #ddd;padding-top:0.5rem;margin-top:0.25rem;}
                            #soSearchResults{position:absolute;background:#fff;border:1px solid #ddd;border-radius:6px;max-height:180px;overflow-y:auto;z-index:9999;width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.15);}
                            #soSearchResults div{padding:0.4rem 0.75rem;cursor:pointer;font-size:0.82rem;text-align:right;}
                            #soSearchResults div:hover{background:#f0f4ff;}
                            .so-search-wrap{position:relative;display:inline-block;}
                        </style>
                        <div id="saleForm" style="text-align:right;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>رقم الفاتورة</label>
                                    <input type="text" id="soNumber" class="form-control" value="${order ? order.orderNumber : 'INV-' + Date.now().toString().slice(-6)}">
                                </div>
                                <div class="form-group">
                                    <label>الحالة</label>
                                    <select id="soStatus" class="form-control">
                                        ${statusOpts.map(s => `<option value="${s}" ${(order?.status||'draft')===s?'selected':''}>${statusAr[s]}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>العميل *</label>
                                    <select id="soCustomer" class="form-control">
                                        <option value="">-- اختر عميل --</option>
                                        ${customers.map(c => `<option value="${c.id}" data-name="${c.name}" ${(order?.customerId||preCustomerId)===c.id?'selected':''}>${c.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>تاريخ الفاتورة</label>
                                    <input type="date" id="soDate" class="form-control" value="${order?.orderDate||new Date().toISOString().split('T')[0]}">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>نسبة الضريبة %</label>
                                    <input type="number" id="soTax" class="form-control" value="${order?.taxPercent??15}" min="0" max="100" step="0.5">
                                </div>
                                <div class="form-group">
                                    <label>نسبة الخصم %</label>
                                    <input type="number" id="soDiscount" class="form-control" value="${order?.discountPct||0}" min="0" max="100" step="0.5">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>ملاحظات</label>
                                <input type="text" id="soNotes" class="form-control" value="${order?.notes||''}" placeholder="ملاحظات...">
                            </div>

                            <div style="margin-top:1rem;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                                    <strong style="font-size:0.9rem;"><i class="fas fa-list"></i> الأصناف</strong>
                                    <div style="display:flex;gap:0.5rem;align-items:center;">
                                        <div class="so-search-wrap">
                                            <input type="text" id="soProductSearch" class="form-control" style="width:220px;font-size:0.8rem;" placeholder="🔍 ابحث عن منتج..." oninput="app._soSearchProduct(this.value)" autocomplete="off">
                                            <div id="soSearchResults" style="display:none;"></div>
                                        </div>
                                        <button type="button" onclick="app._soAddCustomItem()" style="background:#6c757d;color:white;border:none;border-radius:6px;padding:0.3rem 0.75rem;cursor:pointer;font-size:0.82rem;">صنف مخصص</button>
                                    </div>
                                </div>
                                <div id="saleItems">
                                    <table>
                                        <thead><tr><th>المنتج</th><th>الوحدة</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th></th></tr></thead>
                                        <tbody id="soItemsBody"></tbody>
                                    </table>
                                </div>
                                <div class="so-totals">
                                    <div><span>المجموع قبل الخصم:</span><span id="soSubtotalDisplay">0.00 ر.س</span></div>
                                    <div><span>الخصم (<span id="soDiscountPctDisplay">0</span>%):</span><span id="soDiscountDisplay">0.00 ر.س</span></div>
                                    <div><span>بعد الخصم:</span><span id="soAfterDiscDisplay">0.00 ر.س</span></div>
                                    <div><span>ضريبة القيمة المضافة (<span id="soTaxPctDisplay">15</span>%):</span><span id="soTaxDisplay">0.00 ر.س</span></div>
                                    <div class="total-row"><span>الإجمالي الكلي:</span><span id="soTotalDisplay">0.00 ر.س</span></div>
                                </div>
                            </div>
                        </div>
                    `,
                    didOpen: () => {
                        app._soRenderItems();
                        document.getElementById('soTax')?.addEventListener('input', () => app._soCalcTotals());
                        document.getElementById('soDiscount')?.addEventListener('input', () => app._soCalcTotals());
                    },
                    showCancelButton: true,
                    confirmButtonText: order ? 'تحديث' : 'حفظ',
                    cancelButtonText: 'إلغاء',
                    preConfirm: () => {
                        const custEl = document.getElementById('soCustomer');
                        const custId = custEl.value;
                        const custName = custEl.options[custEl.selectedIndex]?.getAttribute('data-name') || '';
                        if (!custId) { Swal.showValidationMessage('يرجى اختيار العميل'); return false; }
                        if (!window._soItems || window._soItems.length === 0) { Swal.showValidationMessage('يرجى إضافة صنف واحد على الأقل'); return false; }
                        const tax = parseFloat(document.getElementById('soTax').value) || 0;
                        const discPct = parseFloat(document.getElementById('soDiscount').value) || 0;
                        const subtotal = window._soItems.reduce((s,i) => s+(i.qty*i.unitPrice), 0);
                        const discAmt  = subtotal * discPct / 100;
                        const afterDisc = subtotal - discAmt;
                        const taxAmt   = afterDisc * tax / 100;
                        return {
                            orderNumber:  document.getElementById('soNumber').value.trim(),
                            customerId:   custId,
                            customerName: custName,
                            status:       document.getElementById('soStatus').value,
                            orderDate:    document.getElementById('soDate').value,
                            notes:        document.getElementById('soNotes').value.trim(),
                            items:        window._soItems,
                            subtotal,
                            discountPct:  discPct,
                            discountAmt:  discAmt,
                            taxPercent:   tax,
                            taxAmount:    taxAmt,
                            totalAmount:  afterDisc + taxAmt
                        };
                    }
                }).then(async result => {
                    if (!result.isConfirmed) return;
                    const so = order
                        ? { ...order, ...result.value }
                        : { id: crypto.randomUUID(), ...result.value, createdAt: new Date().toISOString() };
                    await storage.crud('salesOrders', order ? 'update' : 'create', so);
                    storage.showToast(order ? 'تم تحديث الفاتورة' : 'تم إنشاء الفاتورة');
                    this.navigateTo('sales');
                });
};

proto._soSearchProduct = function(query) {
                const results = document.getElementById('soSearchResults');
                if (!results) return;
                const q = query.trim().toLowerCase();
                if (!q) { results.style.display = 'none'; return; }
                const prods = (window._soProducts || storage.get('products') || []).filter(p => p.name.toLowerCase().includes(q)).slice(0,8);
                const costings = storage.get('productCostings') || [];
                if (!prods.length) { results.style.display = 'none'; return; }
                results.innerHTML = prods.map(p => {
                    const skus = costings.filter(c => c.productId === p.id && c.sellingPrice);
                    if (skus.length > 0) {
                        return skus.map(sku => `
                            <div onclick="app._soAddProductById('${p.id}','${(p.name+(sku.skuSize?' '+sku.skuSize:'')).replace(/'/g,"\\'")}','${sku.skuSize||p.unit||'كرتون'}',${sku.sellingPrice||0},'${sku.id}')"
                                 style="padding:0.4rem 0.75rem;cursor:pointer;font-size:0.82rem;text-align:right;border-bottom:1px solid #f0f0f0;">
                                <strong>${p.name}</strong>
                                ${sku.skuSize ? `<span style="background:#e0e7ff;color:#3730a3;padding:1px 6px;border-radius:8px;font-size:0.72rem;margin-right:4px;">${sku.skuSize}</span>` : ''}
                                <span style="color:#10b981;font-size:0.75rem;float:left;">${sku.sellingPrice.toFixed(2)} ر.س</span>
                            </div>`).join('');
                    }
                    const price = p.sellingPrice || p.price || 0;
                    return `
                        <div onclick="app._soAddProductById('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.unit||'كرتون'}',${price},'')"
                             style="padding:0.4rem 0.75rem;cursor:pointer;font-size:0.82rem;text-align:right;border-bottom:1px solid #f0f0f0;">
                            <strong>${p.name}</strong>
                            <span style="color:#10b981;font-size:0.75rem;float:left;">${price > 0 ? price.toFixed(2)+' ر.س' : 'بدون سعر'}</span>
                        </div>`;
                }).join('');
                results.style.display = 'block';
};

proto._soAddProductById = function(id, name, unit, price, skuId) {
                if (!window._soItems) window._soItems = [];
                window._soItems.push({ productId: id, skuId: skuId||'', name, unit, qty: 1, unitPrice: price });
                this._soRenderItems();
                const input = document.getElementById('soProductSearch');
                if (input) input.value = '';
                const results = document.getElementById('soSearchResults');
                if (results) results.style.display = 'none';
};

proto._soAddCustomItem = function() {
                if (!window._soItems) window._soItems = [];
                window._soItems.push({ productId: 'custom-' + Date.now(), name: 'صنف جديد', unit: 'قطعة', qty: 1, unitPrice: 0 });
                this._soRenderItems();
};

proto._soRenderItems = function() {
                const tbody = document.getElementById('soItemsBody');
                if (!tbody) return;
                if (!window._soItems) window._soItems = [];
                tbody.innerHTML = window._soItems.map((item, idx) => `
                    <tr>
                        <td><input type="text" value="${item.name}" onchange="window._soItems[${idx}].name=this.value;app._soCalcTotals();" style="min-width:120px;"></td>
                        <td><input type="text" value="${item.unit||''}" onchange="window._soItems[${idx}].unit=this.value;" style="width:70px;"></td>
                        <td><input type="number" value="${item.qty}" min="1" step="1" onchange="window._soItems[${idx}].qty=parseFloat(this.value)||1;app._soCalcTotals();" style="width:80px;"></td>
                        <td><input type="number" value="${item.unitPrice}" min="0" step="0.01" onchange="window._soItems[${idx}].unitPrice=parseFloat(this.value)||0;app._soCalcTotals();" style="width:100px;"></td>
                        <td style="font-weight:700;color:var(--success);">${((item.qty||0)*(item.unitPrice||0)).toFixed(2)}</td>
                        <td><button type="button" onclick="window._soItems.splice(${idx},1);app._soRenderItems();" style="background:none;border:none;color:#dc3545;cursor:pointer;font-size:1rem;">✕</button></td>
                    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#999;padding:1rem;">لا توجد أصناف</td></tr>';
                this._soCalcTotals();
};

proto._soCalcTotals = function() {
                if (!window._soItems) return;
                const tax = parseFloat(document.getElementById('soTax')?.value) || 0;
                const discPct = parseFloat(document.getElementById('soDiscount')?.value) || 0;
                const subtotal = window._soItems.reduce((s,i) => s+(i.qty||0)*(i.unitPrice||0), 0);
                const discAmt  = subtotal * discPct / 100;
                const afterDisc = subtotal - discAmt;
                const taxAmt   = afterDisc * tax / 100;
                const total    = afterDisc + taxAmt;
                const fmt = v => v.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س';
                if (document.getElementById('soSubtotalDisplay'))    document.getElementById('soSubtotalDisplay').textContent = fmt(subtotal);
                if (document.getElementById('soDiscountDisplay'))    document.getElementById('soDiscountDisplay').textContent = fmt(discAmt);
                if (document.getElementById('soAfterDiscDisplay'))   document.getElementById('soAfterDiscDisplay').textContent = fmt(afterDisc);
                if (document.getElementById('soTaxDisplay'))         document.getElementById('soTaxDisplay').textContent = fmt(taxAmt);
                if (document.getElementById('soTotalDisplay'))       document.getElementById('soTotalDisplay').textContent = fmt(total);
                if (document.getElementById('soTaxPctDisplay'))      document.getElementById('soTaxPctDisplay').textContent = tax;
                if (document.getElementById('soDiscountPctDisplay')) document.getElementById('soDiscountPctDisplay').textContent = discPct;
};

proto.deliverSaleOrder = async function(id) {
                const result = await Swal.fire({ title: 'تأكيد التسليم', text: 'هل تم تسليم الطلب للعميل؟', icon: 'question', showCancelButton: true, confirmButtonText: 'نعم، تم التسليم', cancelButtonText: 'إلغاء', confirmButtonColor: '#28a745' });
                if (!result.isConfirmed) return;
                const orders = storage.get('salesOrders') || [];
                const idx = orders.findIndex(o => o.id === id);
                if (idx === -1) return;
                orders[idx] = { ...orders[idx], status: 'delivered', deliveryDate: new Date().toISOString().split('T')[0] };
                await storage.crud('salesOrders', 'update', orders[idx]);
                storage.showToast('✅ تم تأكيد التسليم');
                this.navigateTo('sales');
};

proto.deleteSaleOrder = async function(id) {
                const result = await Swal.fire({ title: 'حذف الفاتورة', text: 'هل أنت متأكد؟', icon: 'warning', showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#dc3545' });
                if (!result.isConfirmed) return;
                await storage.crud('salesOrders', 'delete', { id });
                storage.showToast('تم حذف الفاتورة');
                this.navigateTo('sales');
};

proto.exportSales = function() {
                const orders = storage.get('salesOrders') || [];
                if (!orders.length) { storage.showToast('لا توجد بيانات للتصدير', 'warning'); return; }
                const rows = [['رقم الفاتورة','العميل','التاريخ','عدد الأصناف','قبل الخصم','الخصم','الضريبة','الإجمالي','الحالة']];
                orders.forEach(o => rows.push([o.orderNumber, o.customerName, o.orderDate, (o.items||[]).length, o.subtotal, o.discountAmt, o.taxAmount, o.totalAmount, o.status]));
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'sales-orders.csv'; a.click();
};

proto._filterTable = function(tableId, query) {
                const q = query.toLowerCase();
                document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
                    const search = (row.dataset.search || row.textContent).toLowerCase();
                    row.style.display = search.includes(q) ? '' : 'none';
                });
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
