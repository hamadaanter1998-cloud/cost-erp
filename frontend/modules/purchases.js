// ============================================================
// purchases.js — موديول المشتريات وأرصدة المواد الخام
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

            // فلترة النوع الرئيسي (مادة خام / مواد تعبئة)
proto.setRmTypeFilter = function(type) {
                this._rmActiveType = type;
                this._rmActiveSub  = 'all';
                document.querySelectorAll('#rmTypeTabs .rm-type-tab').forEach(tab => {
                    const t = tab.dataset.type;
                    const colors = { all:'var(--primary)', raw:'#1e6f9f', packaging:'#7c3aed', balances:'#10b981' };
                    if (t === type) {
                        tab.classList.add('active');
                        tab.style.background = colors[t]||'var(--primary)';
                        tab.style.color = '#fff';
                        tab.style.borderColor = colors[t]||'var(--primary)';
                    } else {
                        tab.classList.remove('active');
                        tab.style.background = '';
                        tab.style.color = '';
                        tab.style.borderColor = '';
                    }
                });

                if (type === 'balances') {
                    this._renderRmBalances();
                    return;
                }

                // إخفاء تبويب الأرصدة وإظهار الجدول الأصلي
                const balDiv = document.getElementById('rmBalancesView');
                if (balDiv) balDiv.style.display = 'none';
                const tableArea = document.getElementById('rmTableArea');
                if (tableArea) tableArea.style.display = '';
                const subContainer = document.getElementById('rmSubTabsContainer');
                if (subContainer) subContainer.style.display = '';
                const searchCard = document.getElementById('rmSearchCard');
                if (searchCard) searchCard.style.display = '';

                this._renderRmSubTabs(type);
                this._applyRmFilters();
};

proto._renderRmBalances = function() {
                const tableArea = document.getElementById('rmTableArea');
                if (tableArea) tableArea.style.display = 'none';
                const subContainer = document.getElementById('rmSubTabsContainer');
                if (subContainer) subContainer.style.display = 'none';
                const searchCard = document.getElementById('rmSearchCard');
                if (searchCard) searchCard.style.display = 'none';

                const rawMaterials   = storage.get('rawMaterials')   || [];
                const purchaseOrders = storage.get('purchaseOrders') || [];
                const productionOrds = storage.get('productionOrders') || [];

                const balances = rawMaterials.map(mat => {
                    // الرصيد الافتتاحي
                    const opening = mat.openingStock ?? mat.quantity ?? 0;

                    // المشتريات: كل أوامر الشراء المستلمة التي تحتوي على هذه المادة
                    const purchasedQty = purchaseOrders
                        .filter(po => po.status === 'received')
                        .reduce((sum, po) => {
                            const item = (po.items||[]).find(i => i.materialId === mat.id);
                            return sum + (item ? (item.qty||0) : 0);
                        }, 0);

                    // المنصرف: من أوامر الإنتاج (materials array داخل كل أمر)
                    const consumedQty = productionOrds.reduce((sum, po) => {
                        const mats = po.materials || [];
                        const entry = mats.find(m => m.materialId === mat.id);
                        if (entry) return sum + (entry.requiredQty||0);
                        // fallback: subOrders
                        const fromSubs = (po.subOrders||[]).reduce((s, sub) => {
                            const sm = (sub.materials||[]).find(m => m.materialId === mat.id || m.id === mat.id);
                            return s + (sm ? (sm.requiredQty||0) : 0);
                        }, 0);
                        return sum + fromSubs;
                    }, 0);

                    // الحالي = افتتاحي + مشتريات - منصرف
                    const current = opening + purchasedQty - consumedQty;

                    const stockStatus = current <= 0 ? 'نفد' : current <= (mat.minStock||0) ? 'منخفض' : 'كافي';
                    const stockColor  = current <= 0 ? '#dc3545' : current <= (mat.minStock||0) ? '#f97316' : '#10b981';

                    // أوامر الشراء المرتبطة
                    const relatedOrders = purchaseOrders.filter(po =>
                        (po.items||[]).some(i => i.materialId === mat.id)
                    );

                    return { ...mat, opening, purchasedQty, consumedQty, current, stockStatus, stockColor, relatedOrders };
                });

                const totalValue = balances.reduce((s,m) => s + m.current * (m.costPrice||0), 0);
                const lowStock   = balances.filter(m => m.current > 0 && m.current <= (m.minStock||0)).length;
                const outStock   = balances.filter(m => m.current <= 0).length;

                const html = `
                    <div id="rmBalancesView">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-blue">
                                <div class="icon bg-blue"><i class="fas fa-boxes"></i></div>
                                <div class="info"><p>إجمالي المواد</p><h3>${balances.length}</h3><span class="trend">مادة</span></div>
                            </div>
                            <div class="stat-card card-purple">
                                <div class="icon bg-purple"><i class="fas fa-coins"></i></div>
                                <div class="info"><p>قيمة المخزون الحالي</p><h3 style="font-size:1.1rem;">${(totalValue/1000).toFixed(1)}k</h3><span class="trend trend-up">ريال</span></div>
                            </div>
                            <div class="stat-card card-orange">
                                <div class="icon bg-orange"><i class="fas fa-exclamation-triangle"></i></div>
                                <div class="info"><p>مخزون منخفض</p><h3>${lowStock}</h3><span class="trend">مادة</span></div>
                            </div>
                            <div class="stat-card" style="border-right:4px solid #dc3545;">
                                <div class="icon" style="background:#dc3545;"><i class="fas fa-times-circle" style="color:#fff;"></i></div>
                                <div class="info"><p>نفد المخزون</p><h3>${outStock}</h3><span class="trend">مادة</span></div>
                            </div>
                        </div>

                        <div class="table-container">
                            <div class="table-header">
                                <h3><i class="fas fa-balance-scale"></i> أرصدة المواد الخام</h3>
                                <div class="d-flex gap-2 align-center">
                                    <small style="color:var(--text-secondary);"><i class="fas fa-info-circle"></i> اضغط على اسم المادة لعرض حركتها</small>
                                    <input type="text" class="form-control" style="max-width:200px;font-size:0.85rem;" placeholder="🔍 بحث..." oninput="app._filterRmBalances(this.value)">
                                </div>
                            </div>
                            <div class="table-wrapper">
                                <table id="rmBalancesTable">
                                    <thead>
                                        <tr>
                                            <th>المادة</th>
                                            <th>الوحدة</th>
                                            <th style="background:#dbeafe;color:#1e40af;">الرصيد الافتتاحي</th>
                                            <th style="background:#dcfce7;color:#166534;">+ المشتريات</th>
                                            <th style="background:#fee2e2;color:#991b1b;">- المنصرف</th>
                                            <th style="background:#f0fdf4;color:#065f46;font-size:1rem;">= الرصيد الحالي</th>
                                            <th>الحالة</th>
                                            <th>أوامر الشراء</th>
                                            <th>إجراء</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${balances.length === 0
                                            ? `<tr><td colspan="9"><div class="empty-state" style="padding:2rem;"><i class="fas fa-boxes"></i><h3>لا توجد مواد خام</h3></div></td></tr>`
                                            : balances.map(mat => `
                                            <tr data-matname="${mat.name.toLowerCase()}">
                                                <td>
                                                    <span style="font-weight:700;color:var(--primary);cursor:pointer;text-decoration:underline dotted;"
                                                          onclick="app.showMatMovement('${mat.id}')"
                                                          title="عرض حركة المادة">
                                                        ${mat.name}
                                                    </span>
                                                </td>
                                                <td style="color:var(--text-secondary);">${mat.unit||''}</td>
                                                <td style="background:#eff6ff;text-align:center;font-weight:600;">
                                                    ${mat.opening.toLocaleString('ar-SA')}
                                                </td>
                                                <td style="background:#f0fdf4;text-align:center;font-weight:600;color:#166534;">
                                                    ${mat.purchasedQty > 0 ? '+' : ''}${mat.purchasedQty.toLocaleString('ar-SA')}
                                                </td>
                                                <td style="background:#fef2f2;text-align:center;font-weight:600;color:#991b1b;">
                                                    ${mat.consumedQty > 0 ? '-' : ''}${mat.consumedQty.toLocaleString('ar-SA')}
                                                </td>
                                                <td style="background:#ecfdf5;text-align:center;">
                                                    <strong style="font-size:1.05rem;color:${mat.stockColor};">${mat.current.toLocaleString('ar-SA')}</strong>
                                                </td>
                                                <td>
                                                    <span style="background:${mat.stockColor};color:#fff;padding:2px 10px;border-radius:1rem;font-size:0.78rem;font-weight:700;">
                                                        ${mat.stockStatus}
                                                    </span>
                                                </td>
                                                <td style="text-align:center;">
                                                    ${mat.relatedOrders.length === 0
                                                        ? '<span style="color:var(--text-secondary);font-size:0.8rem;">—</span>'
                                                        : `<span class="status-badge status-info" style="cursor:pointer;" onclick="app.showMatMovement('${mat.id}')">${mat.relatedOrders.length} أمر</span>`
                                                    }
                                                </td>
                                                <td>
                                                    <button class="btn btn-primary btn-sm" onclick="app.showPurchaseModal()" style="font-size:0.78rem;">
                                                        <i class="fas fa-shopping-cart"></i> شراء
                                                    </button>
                                                </td>
                                            </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                let balDiv = document.getElementById('rmBalancesView');
                if (balDiv) {
                    balDiv.outerHTML = html;
                } else {
                    const rmTableArea = document.getElementById('rmTableArea');
                    if (rmTableArea) rmTableArea.insertAdjacentHTML('afterend', html);
                }
};

proto.showMatMovement = function(matId) {
                const rawMaterials   = storage.get('rawMaterials')   || [];
                const purchaseOrders = storage.get('purchaseOrders') || [];
                const productionOrds = storage.get('productionOrders') || [];
                const mat = rawMaterials.find(m => m.id === matId);
                if (!mat) return;

                const opening = mat.openingStock ?? mat.quantity ?? 0;

                // المشتريات المستلمة
                const purchaseMovements = [];
                purchaseOrders
                    .filter(po => po.status === 'received')
                    .forEach(po => {
                        const item = (po.items||[]).find(i => i.materialId === matId);
                        if (item) purchaseMovements.push({
                            date:  po.receivedDate || po.orderDate,
                            ref:   po.orderNumber,
                            from:  po.supplierName,
                            qty:   item.qty || 0,
                            type:  'purchase'
                        });
                    });

                // المنصرف من أوامر الإنتاج
                const consumeMovements = [];
                productionOrds.forEach(po => {
                    // materials array مباشرة
                    const entry = (po.materials||[]).find(m => m.materialId === matId);
                    if (entry && entry.requiredQty > 0) {
                        consumeMovements.push({
                            date: po.date ? new Date(po.date).toISOString().split('T')[0] : '—',
                            ref:  po.id?.slice(0,8) || '—',
                            from: po.productName || 'أمر إنتاج',
                            qty:  entry.requiredQty,
                            type: 'consume'
                        });
                    } else {
                        // fallback subOrders
                        (po.subOrders||[]).forEach(sub => {
                            const sm = (sub.materials||[]).find(m => m.materialId === matId || m.id === matId);
                            if (sm && sm.requiredQty > 0) {
                                consumeMovements.push({
                                    date: po.date ? new Date(po.date).toISOString().split('T')[0] : '—',
                                    ref:  po.id?.slice(0,8) || '—',
                                    from: sub.productName || po.productName || 'أمر إنتاج',
                                    qty:  sm.requiredQty,
                                    type: 'consume'
                                });
                            }
                        });
                    }
                });

                const totalPurchased = purchaseMovements.reduce((s,m) => s + m.qty, 0);
                const totalConsumed  = consumeMovements.reduce((s,m)  => s + m.qty, 0);
                const current        = opening + totalPurchased - totalConsumed;
                const stockColor     = current <= 0 ? '#dc3545' : current <= (mat.minStock||0) ? '#f97316' : '#10b981';

                // دمج الحركات مرتبة بالتاريخ
                const allMoves = [
                    { date: mat.createdAt ? new Date(mat.createdAt).toISOString().split('T')[0] : '—', ref: 'رصيد افتتاحي', from: '—', qty: opening, type: 'opening' },
                    ...purchaseMovements,
                    ...consumeMovements
                ].sort((a,b) => (a.date||'').localeCompare(b.date||''));

                // حساب رصيد متراكم
                let running = 0;
                const movesWithBalance = allMoves.map(m => {
                    if (m.type === 'opening')  running += m.qty;
                    if (m.type === 'purchase') running += m.qty;
                    if (m.type === 'consume')  running -= m.qty;
                    return { ...m, balance: running };
                });

                const typeLabel = { opening:'افتتاحي', purchase:'وارد (مشتريات)', consume:'صادر (إنتاج)' };
                const typeColor = { opening:'#3b82f6', purchase:'#10b981', consume:'#ef4444' };
                const typeIcon  = { opening:'fas fa-play-circle', purchase:'fas fa-arrow-down', consume:'fas fa-arrow-up' };

                Swal.fire({
                    title: `<i class="fas fa-history"></i> حركة مخزون: ${mat.name}`,
                    width: '820px',
                    html: `
                        <div style="text-align:right;">
                            <!-- ملخص الأرصدة -->
                            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-bottom:1rem;">
                                <div style="background:#eff6ff;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #3b82f6;">
                                    <div style="font-size:0.72rem;color:#1e40af;font-weight:700;">الرصيد الافتتاحي</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#1e40af;">${opening.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${mat.unit||''}</div>
                                </div>
                                <div style="background:#f0fdf4;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #10b981;">
                                    <div style="font-size:0.72rem;color:#166534;font-weight:700;">+ المشتريات</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#10b981;">+${totalPurchased.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${mat.unit||''}</div>
                                </div>
                                <div style="background:#fef2f2;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid #ef4444;">
                                    <div style="font-size:0.72rem;color:#991b1b;font-weight:700;">- المنصرف</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:#ef4444;">-${totalConsumed.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${mat.unit||''}</div>
                                </div>
                                <div style="background:#ecfdf5;border-radius:10px;padding:0.65rem;text-align:center;border-top:3px solid ${stockColor};">
                                    <div style="font-size:0.72rem;font-weight:700;color:${stockColor};">= الرصيد الحالي</div>
                                    <div style="font-size:1.2rem;font-weight:800;color:${stockColor};">${current.toLocaleString('ar-SA')}</div>
                                    <div style="font-size:0.7rem;color:#64748b;">${mat.unit||''}</div>
                                </div>
                            </div>

                            <!-- جدول الحركات -->
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
                                                <td style="padding:0.45rem 0.75rem;color:#64748b;font-size:0.8rem;">${m.date||'—'}</td>
                                                <td style="padding:0.45rem 0.5rem;">
                                                    <span style="background:${typeColor[m.type]};color:#fff;padding:2px 8px;border-radius:1rem;font-size:0.72rem;font-weight:700;">
                                                        <i class="${typeIcon[m.type]}"></i> ${typeLabel[m.type]}
                                                    </span>
                                                </td>
                                                <td style="padding:0.45rem 0.5rem;font-family:monospace;color:var(--primary);font-weight:700;font-size:0.8rem;">${m.ref}</td>
                                                <td style="padding:0.45rem 0.5rem;">${m.from}</td>
                                                <td style="padding:0.45rem 0.5rem;text-align:center;font-weight:700;color:${m.type==='consume'?'#ef4444':m.type==='purchase'?'#10b981':'#3b82f6'};">
                                                    ${m.type==='consume'?'-':'+'}${m.qty.toLocaleString('ar-SA')} ${mat.unit||''}
                                                </td>
                                                <td style="padding:0.45rem 0.5rem;text-align:center;font-weight:800;color:${m.balance<=0?'#ef4444':m.balance<=(mat.minStock||0)?'#f97316':'#10b981'};">
                                                    ${m.balance.toLocaleString('ar-SA')}
                                                </td>
                                            </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-shopping-cart"></i> إنشاء أمر شراء',
                    cancelButtonText: 'إغلاق',
                    confirmButtonColor: 'var(--primary)'
                }).then(result => {
                    if (result.isConfirmed) this.showPurchaseModal();
                });
};

proto._filterRmBalances = function(query) {
                const q = query.toLowerCase();
                document.querySelectorAll('#rmBalancesTable tbody tr').forEach(row => {
                    const name = row.dataset.matname || '';
                    row.style.display = name.includes(q) ? '' : 'none';
                });
            }

            // رسم الفلاتر الفرعية
proto._renderRmSubTabs = function(type) {
                const container = document.getElementById('rmSubTabsContainer');
                if (!container) return;
                if (type === 'all') { container.innerHTML = ''; return; }
                const rawSubs = [
                    { key:'all',       label:'الكل',    icon:'fas fa-list',              color:'#1e6f9f' },
                    { key:'chemical',  label:'كيماوية', icon:'fas fa-atom',               color:'#0891b2' },
                    { key:'fragrance', label:'عطور',    icon:'fas fa-spray-can',          color:'#db2777' }
                ];
                const pkgSubs = [
                    { key:'all',     label:'الكل',   icon:'fas fa-list',                  color:'#7c3aed' },
                    { key:'carton',  label:'كرتون',  icon:'fas fa-box',                   color:'#92400e' },
                    { key:'bottle',  label:'عبوة',   icon:'fas fa-wine-bottle',           color:'#065f46' },
                    { key:'spray',   label:'بخاخ',   icon:'fas fa-compress-arrows-alt',   color:'#1d4ed8' },
                    { key:'aerosol', label:'ضاغط',   icon:'fas fa-wind',                  color:'#b45309' },
                    { key:'sticker', label:'استيكر', icon:'fas fa-tag',                   color:'#7f1d1d' }
                ];
                const subs = type === 'raw' ? rawSubs : pkgSubs;
                const activeSub = this._rmActiveSub || 'all';
                let html = '<div class="rm-sub-tabs" id="rmSubTabs">';
                subs.forEach(s => {
                    const isAct = s.key === activeSub;
                    html += `<span class="rm-sub-tab ${isAct?'active':''}" data-sub="${s.key}"
                        style="${isAct?'background:'+s.color+';border-color:'+s.color+';color:#fff;':''}"
                        onclick="app.setRmSubFilter('${s.key}','${s.color}')">
                        <i class="${s.icon}" style="font-size:0.75rem;margin-left:3px;"></i> ${s.label}
                    </span>`;
                });
                html += '</div>';
                container.innerHTML = html;
};

proto.setRmSubFilter = function(sub, color) {
                this._rmActiveSub = sub;
                document.querySelectorAll('#rmSubTabs .rm-sub-tab').forEach(tab => {
                    if (tab.dataset.sub === sub) {
                        tab.classList.add('active');
                        tab.style.background = color;
                        tab.style.borderColor = color;
                        tab.style.color = '#fff';
                    } else {
                        tab.classList.remove('active');
                        tab.style.background = '';
                        tab.style.borderColor = '';
                        tab.style.color = '';
                    }
                });
                this._applyRmFilters();
};

proto._applyRmFilters = function() {
                const type = this._rmActiveType || 'all';
                const sub  = this._rmActiveSub  || 'all';
                let visible = 0;
                document.querySelectorAll('#rawMaterialsTable tbody tr').forEach(row => {
                    const rType = row.dataset.mtype || 'raw';
                    const rSub  = row.dataset.msub  || '';
                    let show = true;
                    if (type !== 'all' && rType !== type) show = false;
                    if (show && sub !== 'all' && rSub !== sub) show = false;
                    row.style.display = show ? '' : 'none';
                    if (show) visible++;
                });
                const badge = document.getElementById('rmCountBadge');
                if (badge) badge.textContent = visible + ' مادة';
};

proto.renderPurchases = function(container) {
                const orders = storage.get('purchaseOrders') || [];
                const suppliers = storage.get('suppliers') || [];

                const totalOrders   = orders.length;
                const totalValue    = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
                const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'approved').length;
                const receivedOrders= orders.filter(o => o.status === 'received').length;

                const statusLabel = { draft:'مسودة', pending:'بانتظار الموافقة', approved:'معتمد', received:'مستلم', cancelled:'ملغي' };
                const statusClass = { draft:'status-secondary', pending:'status-warning', approved:'status-info', received:'status-success', cancelled:'status-danger' };

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-shopping-cart"></i> أوامر الشراء</h2>
                            <p>إنشاء وإدارة طلبات الشراء من الموردين</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-primary" onclick="app.showPurchaseModal()"><i class="fas fa-plus"></i> أمر شراء جديد</button>
                            <button class="btn btn-warning btn-sm" onclick="app.exportPurchases()"><i class="fas fa-file-excel"></i> تصدير</button>
                        </div>
                    </div>

                    <div class="stats-row" style="margin-bottom:1.5rem;">
                        <div class="stat-card card-blue">
                            <div class="icon bg-blue"><i class="fas fa-file-invoice"></i></div>
                            <div class="info"><p>إجمالي الأوامر</p><h3>${totalOrders}</h3><span class="trend trend-up">أمر شراء</span></div>
                        </div>
                        <div class="stat-card card-orange">
                            <div class="icon bg-orange"><i class="fas fa-clock"></i></div>
                            <div class="info"><p>قيد التنفيذ</p><h3>${pendingOrders}</h3><span class="trend">أمر</span></div>
                        </div>
                        <div class="stat-card card-green">
                            <div class="icon bg-green"><i class="fas fa-check-circle"></i></div>
                            <div class="info"><p>مستلمة</p><h3>${receivedOrders}</h3><span class="trend trend-up">أمر</span></div>
                        </div>
                        <div class="stat-card card-purple">
                            <div class="icon bg-purple"><i class="fas fa-coins"></i></div>
                            <div class="info"><p>إجمالي القيمة</p><h3 style="font-size:1.2rem;">${(totalValue/1000).toFixed(1)}k</h3><span class="trend trend-up">ريال</span></div>
                        </div>
                    </div>

                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-list"></i> قائمة أوامر الشراء</h3>
                            <span class="status-badge status-info">${totalOrders} أمر</span>
                        </div>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>رقم الأمر</th>
                                        <th>المورد</th>
                                        <th>تاريخ الأمر</th>
                                        <th>تاريخ الاستلام</th>
                                        <th>الأصناف</th>
                                        <th>الإجمالي</th>
                                        <th>الحالة</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.length === 0 ? `<tr><td colspan="8"><div class="empty-state" style="padding:2rem;"><i class="fas fa-shopping-cart"></i><h3>لا توجد أوامر شراء</h3><p>أضف أول أمر شراء للبدء</p></div></td></tr>` :
                                    orders.slice().sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)).map(o => `
                                        <tr>
                                            <td><span style="font-family:monospace;font-weight:700;color:var(--primary);font-size:0.85rem;">${o.orderNumber}</span></td>
                                            <td><strong>${o.supplierName}</strong></td>
                                            <td style="color:var(--text-secondary);font-size:0.82rem;">${o.orderDate ? new Date(o.orderDate).toLocaleDateString('ar-SA') : '-'}</td>
                                            <td style="color:var(--text-secondary);font-size:0.82rem;">${o.expectedDate ? new Date(o.expectedDate).toLocaleDateString('ar-SA') : '-'}</td>
                                            <td><span class="status-badge status-info">${(o.items||[]).length} صنف</span></td>
                                            <td><strong style="color:var(--success);">${(o.totalAmount||0).toLocaleString('ar-SA',{minimumFractionDigits:2})} ر.س</strong></td>
                                            <td><span class="status-badge ${statusClass[o.status]||'status-secondary'}">${statusLabel[o.status]||o.status}</span></td>
                                            <td>
                                                <div class="d-flex gap-1">
                                                    <button class="btn btn-info btn-sm" onclick="app.showPurchaseModal('${o.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                                                    ${o.status === 'approved' ? `<button class="btn btn-success btn-sm" onclick="app.receivePurchaseOrder('${o.id}')" title="تأكيد الاستلام"><i class="fas fa-check"></i></button>` : ''}
                                                    <button class="btn btn-danger btn-sm" onclick="app.deletePurchaseOrder('${o.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
};

proto.showPurchaseModal = async function(editId = null) {
                const orders    = storage.get('purchaseOrders') || [];
                const suppliers = storage.get('suppliers')      || [];
                const rawMats   = storage.get('rawMaterials')   || [];
                const order     = editId ? orders.find(o => o.id === editId) : null;

                const supplierOptions = suppliers.map(s =>
                    `<option value="${s.id}" data-name="${s.name}" ${order && order.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`
                ).join('');

                const existingItems = order ? JSON.parse(JSON.stringify(order.items || [])) : [];
                // حفظ الأصناف مباشرة في window قبل فتح الـ modal
                window._poItems = existingItems;
                window._poRawMats = rawMats;

                const statusOpts = ['draft','pending','approved','received','cancelled'];
                const statusAr = { draft:'مسودة', pending:'بانتظار الموافقة', approved:'معتمد', received:'مستلم', cancelled:'ملغي' };
                const statusSelect = statusOpts.map(s =>
                    `<option value="${s}" ${order && order.status === s ? 'selected' : (s === 'draft' && !order ? 'selected' : '')}>${statusAr[s]}</option>`
                ).join('');

                Swal.fire({
                    title: order ? 'تعديل أمر الشراء' : 'إنشاء أمر شراء جديد',
                    width: '800px',
                    html: `
                        <style>
                            #purchaseForm .form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;}
                            #purchaseForm .form-group{display:flex;flex-direction:column;text-align:right;margin-bottom:0.5rem;}
                            #purchaseForm label{font-size:0.82rem;font-weight:600;margin-bottom:0.25rem;color:#555;}
                            #purchaseForm .form-control{border:1px solid #ddd;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.9rem;width:100%;}
                            #purchaseItems{border:1px solid #ddd;border-radius:8px;overflow:hidden;margin-top:0.5rem;}
                            #purchaseItems table{width:100%;border-collapse:collapse;font-size:0.82rem;}
                            #purchaseItems th{background:#f5f5f5;padding:0.4rem 0.5rem;text-align:right;border-bottom:1px solid #ddd;}
                            #purchaseItems td{padding:0.3rem 0.4rem;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
                            #purchaseItems input,#purchaseItems select{border:1px solid #ddd;border-radius:4px;padding:0.2rem 0.4rem;font-size:0.82rem;width:100%;}
                            .po-totals{background:#f8f9fa;border-radius:8px;padding:0.75rem;margin-top:0.75rem;text-align:right;}
                            .po-totals div{display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.88rem;}
                            .po-totals .total-row{font-weight:800;font-size:1rem;color:var(--primary);border-top:1px solid #ddd;padding-top:0.5rem;margin-top:0.25rem;}
                            #poSearchResults{position:absolute;background:#fff;border:1px solid #ddd;border-radius:6px;max-height:180px;overflow-y:auto;z-index:9999;width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.15);}
                            #poSearchResults div{padding:0.4rem 0.75rem;cursor:pointer;font-size:0.82rem;text-align:right;}
                            #poSearchResults div:hover{background:#f0f4ff;}
                            .po-search-wrap{position:relative;display:inline-block;}
                        </style>
                        <div id="purchaseForm" style="text-align:right;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>رقم الأمر</label>
                                    <input type="text" id="poNumber" class="form-control" value="${order ? order.orderNumber : 'PO-' + Date.now().toString().slice(-6)}" placeholder="PO-000001">
                                </div>
                                <div class="form-group">
                                    <label>الحالة</label>
                                    <select id="poStatus" class="form-control">${statusSelect}</select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>المورد *</label>
                                    <select id="poSupplier" class="form-control">
                                        <option value="">-- اختر مورد --</option>
                                        ${suppliers.map(s => `<option value="${s.id}" data-name="${s.name}" ${order && order.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>نسبة الضريبة %</label>
                                    <input type="number" id="poTax" class="form-control" value="${order ? order.taxPercent : 15}" min="0" max="100" step="0.5">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>تاريخ الأمر</label>
                                    <input type="date" id="poOrderDate" class="form-control" value="${order ? order.orderDate : new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="form-group">
                                    <label>تاريخ الاستلام المتوقع</label>
                                    <input type="date" id="poExpectedDate" class="form-control" value="${order ? (order.expectedDate||'') : ''}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>ملاحظات</label>
                                <input type="text" id="poNotes" class="form-control" value="${order ? (order.notes||'') : ''}" placeholder="ملاحظات إضافية...">
                            </div>

                            <div style="margin-top:1rem;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                                    <strong style="font-size:0.9rem;"><i class="fas fa-list"></i> الأصناف</strong>
                                    <div style="display:flex;gap:0.5rem;align-items:center;">
                                        <div class="po-search-wrap">
                                            <input type="text" id="poMatSearch" class="form-control"
                                                style="width:220px;font-size:0.8rem;"
                                                placeholder="🔍 ابحث عن مادة خام..."
                                                oninput="app._poSearchMat(this.value)"
                                                autocomplete="off">
                                            <div id="poSearchResults" style="display:none;"></div>
                                        </div>
                                        <button type="button" onclick="app._poAddCustomItem()" style="background:#6c757d;color:white;border:none;border-radius:6px;padding:0.3rem 0.75rem;cursor:pointer;font-size:0.82rem;">صنف مخصص</button>
                                    </div>
                                </div>
                                <div id="purchaseItems">
                                    <table>
                                        <thead><tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th></th></tr></thead>
                                        <tbody id="poItemsBody"></tbody>
                                    </table>
                                </div>
                                <div class="po-totals" id="poTotals">
                                    <div><span>المجموع قبل الضريبة:</span><span id="poSubtotalDisplay">0.00 ر.س</span></div>
                                    <div><span>ضريبة القيمة المضافة (<span id="poTaxPct">15</span>%):</span><span id="poTaxDisplay">0.00 ر.س</span></div>
                                    <div class="total-row"><span>الإجمالي الكلي:</span><span id="poTotalDisplay">0.00 ر.س</span></div>
                                </div>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: order ? 'تحديث' : 'حفظ',
                    cancelButtonText: 'إلغاء',
                    didOpen: () => {
                        app._poRenderItems();
                        document.getElementById('poTax')?.addEventListener('input', () => app._poCalcTotals());
                    },
                    preConfirm: () => {
                        const suppEl = document.getElementById('poSupplier');
                        const suppId = suppEl.value;
                        const suppName = suppEl.options[suppEl.selectedIndex]?.getAttribute('data-name') || '';
                        if (!suppId) { Swal.showValidationMessage('يرجى اختيار المورد'); return false; }
                        if (!window._poItems || window._poItems.length === 0) { Swal.showValidationMessage('يرجى إضافة صنف واحد على الأقل'); return false; }
                        const tax = parseFloat(document.getElementById('poTax').value) || 0;
                        const subtotal = window._poItems.reduce((s,i) => s + (i.qty * i.unitPrice), 0);
                        const taxAmount = subtotal * tax / 100;
                        return {
                            orderNumber:  document.getElementById('poNumber').value.trim(),
                            supplierId:   suppId,
                            supplierName: suppName,
                            status:       document.getElementById('poStatus').value,
                            orderDate:    document.getElementById('poOrderDate').value,
                            expectedDate: document.getElementById('poExpectedDate').value || null,
                            notes:        document.getElementById('poNotes').value.trim(),
                            items:        window._poItems,
                            subtotal:     subtotal,
                            taxPercent:   tax,
                            taxAmount:    taxAmount,
                            totalAmount:  subtotal + taxAmount
                        };
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        let po;
                        if (order) {
                            po = { ...order, ...result.value };
                            const idx = orders.findIndex(o => o.id === editId);
                            if (idx !== -1) orders[idx] = po;
                        } else {
                            po = { id: crypto.randomUUID(), ...result.value, createdAt: new Date().toISOString() };
                        }
                        const r = await storage.crud('purchaseOrders', order ? 'update' : 'create', po);
                        if (!r.pending) {
                            storage.showToast(order ? 'تم تحديث أمر الشراء' : 'تم إنشاء أمر الشراء');
                            this.navigateTo('purchases');
                        }
                    }
                });
};

proto._poSearchMat = function(query) {
                const results = document.getElementById('poSearchResults');
                if (!results) return;
                const q = query.trim().toLowerCase();
                if (!q) { results.style.display = 'none'; return; }

                const mats = (window._poRawMats || storage.get('rawMaterials') || [])
                    .filter(m => m.name.toLowerCase().includes(q))
                    .slice(0, 8);

                if (!mats.length) { results.style.display = 'none'; return; }

                results.innerHTML = mats.map(m => `
                    <div onclick="app._poAddItemById('${m.id}','${m.name.replace(/'/g,"\\'")}','${m.unit||''}',${m.costPrice||0})">
                        <strong>${m.name}</strong>
                        <span style="color:#64748b;font-size:0.75rem;margin-right:0.5rem;">${m.unit||''}</span>
                        <span style="color:#10b981;font-size:0.75rem;">${(m.costPrice||0).toLocaleString('ar-SA')} ر.س</span>
                    </div>`).join('');
                results.style.display = 'block';
};

proto._poAddItemById = function(id, name, unit, price) {
                if (!window._poItems) window._poItems = [];
                if (window._poItems.find(i => i.materialId === id)) {
                    const input = document.getElementById('poMatSearch');
                    if (input) { input.value = ''; }
                    const results = document.getElementById('poSearchResults');
                    if (results) results.style.display = 'none';
                    return;
                }
                window._poItems.push({ materialId: id, name, unit, qty: 1, unitPrice: price });
                this._poRenderItems();
                const input = document.getElementById('poMatSearch');
                if (input) input.value = '';
                const results = document.getElementById('poSearchResults');
                if (results) results.style.display = 'none';
};

proto._poAddCustomItem = function() {
                if (!window._poItems) window._poItems = [];
                window._poItems.push({ materialId: 'custom-' + Date.now(), name: 'صنف جديد', unit: 'قطعة', qty: 1, unitPrice: 0 });
                this._poRenderItems();
};

proto._poRenderItems = function() {
                const tbody = document.getElementById('poItemsBody');
                if (!tbody) return;
                if (!window._poItems) window._poItems = [];
                tbody.innerHTML = window._poItems.map((item, idx) => `
                    <tr>
                        <td><input type="text" value="${item.name}" onchange="window._poItems[${idx}].name=this.value;app._poCalcTotals();" style="min-width:120px;"></td>
                        <td><input type="text" value="${item.unit}" onchange="window._poItems[${idx}].unit=this.value;" style="width:70px;"></td>
                        <td><input type="number" value="${item.qty}" min="0.01" step="0.01" onchange="window._poItems[${idx}].qty=parseFloat(this.value)||0;app._poCalcTotals();" style="width:80px;"></td>
                        <td><input type="number" value="${item.unitPrice}" min="0" step="0.01" onchange="window._poItems[${idx}].unitPrice=parseFloat(this.value)||0;app._poCalcTotals();" style="width:100px;"></td>
                        <td style="font-weight:700;color:var(--success);">${((item.qty||0)*(item.unitPrice||0)).toFixed(2)}</td>
                        <td><button type="button" onclick="window._poItems.splice(${idx},1);app._poRenderItems();" style="background:none;border:none;color:#dc3545;cursor:pointer;font-size:1rem;">✕</button></td>
                    </tr>
                `).join('') || '<tr><td colspan="6" style="text-align:center;color:#999;padding:1rem;">لا توجد أصناف</td></tr>';
                this._poCalcTotals();
};

proto._poCalcTotals = function() {
                if (!window._poItems) return;
                const tax = parseFloat(document.getElementById('poTax')?.value) || 0;
                const subtotal = window._poItems.reduce((s,i) => s + (i.qty||0)*(i.unitPrice||0), 0);
                const taxAmt = subtotal * tax / 100;
                const total = subtotal + taxAmt;
                const fmt = v => v.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س';
                if (document.getElementById('poSubtotalDisplay')) document.getElementById('poSubtotalDisplay').textContent = fmt(subtotal);
                if (document.getElementById('poTaxDisplay'))      document.getElementById('poTaxDisplay').textContent = fmt(taxAmt);
                if (document.getElementById('poTotalDisplay'))    document.getElementById('poTotalDisplay').textContent = fmt(total);
                if (document.getElementById('poTaxPct'))          document.getElementById('poTaxPct').textContent = tax;
};

proto.receivePurchaseOrder = async function(id) {
                const result = await Swal.fire({
                    title: 'تأكيد استلام الأمر',
                    text: 'هل تم استلام البضاعة فعلاً؟ سيتم تحديث مخزون المواد الخام تلقائياً.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، مستلم',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#28a745'
                });
                if (!result.isConfirmed) return;

                const orders = storage.get('purchaseOrders') || [];
                const idx = orders.findIndex(o => o.id === id);
                if (idx === -1) return;
                const order = orders[idx];
                orders[idx] = { ...order, status: 'received', receivedDate: new Date().toISOString().split('T')[0] };
                storage.set('purchaseOrders', orders);

                // تحديث كميات المواد الخام
                const rawMats = storage.get('rawMaterials') || [];
                (order.items || []).forEach(item => {
                    const matIdx = rawMats.findIndex(m => m.id === item.materialId);
                    if (matIdx !== -1) {
                        rawMats[matIdx].quantity = (rawMats[matIdx].quantity || 0) + (item.qty || 0);
                        storage.crud('rawMaterials', 'update', rawMats[matIdx]);
                    }
                });
                storage.set('rawMaterials', rawMats);

                const r = await storage.crud('purchaseOrders', 'update', orders[idx]);
                if (!r.pending) {
                    storage.showToast('✅ تم تأكيد الاستلام وتحديث المخزون');
                    this.navigateTo('purchases');
                }
};

proto.deletePurchaseOrder = async function(id) {
                const result = await Swal.fire({
                    title: 'حذف أمر الشراء',
                    text: 'هل أنت متأكد من الحذف؟',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، احذف',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#dc3545'
                });
                if (!result.isConfirmed) return;
                const orders = storage.get('purchaseOrders') || [];
                const filtered = orders.filter(o => o.id !== id);
                storage.set('purchaseOrders', filtered);
                const r = await storage.crud('purchaseOrders', 'delete', { id });
                if (!r.pending) {
                    storage.showToast('تم حذف أمر الشراء');
                    this.navigateTo('purchases');
                }
};

proto.exportPurchases = function() {
                const orders = storage.get('purchaseOrders') || [];
                if (!orders.length) { storage.showToast('لا توجد بيانات للتصدير', 'warning'); return; }
                const rows = [['رقم الأمر','المورد','تاريخ الأمر','عدد الأصناف','المجموع قبل الضريبة','الضريبة','الإجمالي','الحالة']];
                orders.forEach(o => rows.push([o.orderNumber, o.supplierName, o.orderDate, (o.items||[]).length, o.subtotal, o.taxAmount, o.totalAmount, o.status]));
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'purchase-orders.csv'; a.click();
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
