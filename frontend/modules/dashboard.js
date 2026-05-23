// ============================================================
// dashboard.js — موديول الداشبورد
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.renderDashboard = function(container) {
                const rawMaterials    = storage.get('rawMaterials')    || [];
                const products        = storage.get('products')         || [];
                const suppliers       = storage.get('suppliers')         || [];
                const customers       = storage.get('customers')         || [];
                const recipes         = storage.get('recipes')           || [];
                const productionOrds  = storage.get('productionOrders') || [];
                const purchaseOrders  = storage.get('purchaseOrders')   || [];
                const salesOrders     = storage.get('salesOrders')      || [];
                const productCostings = storage.get('productCostings')   || [];

                // ── حسابات الأرصدة ────────────────────────────────────
                const _po  = purchaseOrders.filter(p => p.status==='received');
                const calcRmBalance = m => {
                    const op = m.openingStock ?? m.quantity ?? 0;
                    const pur = _po.reduce((s,po) => { const it=(po.items||[]).find(i=>i.materialId===m.id); return s+(it?it.qty||0:0); },0);
                    const con = productionOrds.reduce((s,po) => { const e=(po.materials||[]).find(x=>x.materialId===m.id); if(e) return s+(e.requiredQty||0); return s+(po.subOrders||[]).reduce((ss,sub)=>{ const sm=(sub.materials||[]).find(x=>x.materialId===m.id); return ss+(sm?sm.requiredQty||0:0); },0); },0);
                    return op + pur - con;
                };
                const rmWithBal = rawMaterials.map(m => ({ ...m, balance: calcRmBalance(m) }));

                const totalRmValue   = rmWithBal.reduce((s,m) => s + m.balance*(m.costPrice||0), 0);
                const lowStockRm     = rmWithBal.filter(m => m.balance > 0 && m.balance <= (m.minStock||0));
                const outStockRm     = rmWithBal.filter(m => m.balance <= 0);
                const totalSales     = salesOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
                const totalPurchases = purchaseOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
                const totalProdCost  = productionOrds.filter(o=>o.status==='completed').reduce((s,o)=>s+(o.totalCost||0),0);
                const pendingSales   = salesOrders.filter(o=>o.status==='draft'||o.status==='confirmed').length;
                const pendingPurch   = purchaseOrders.filter(o=>o.status==='draft'||o.status==='pending'||o.status==='approved').length;

                // آخر 5 فواتير مبيعات
                const recentSales = salesOrders.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,5);
                // آخر 5 أوامر إنتاج
                const recentProd  = productionOrds.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,5);
                // مبيعات آخر 6 أشهر
                const monthlyMap = {};
                salesOrders.forEach(o => { if(!o.orderDate) return; const k=o.orderDate.slice(0,7); monthlyMap[k]=(monthlyMap[k]||0)+(o.totalAmount||0); });
                const mKeys = Object.keys(monthlyMap).sort().slice(-6);
                const mVals = mKeys.map(k => monthlyMap[k]);

                const fmt = v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0);
                const now = new Date().toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

                container.innerHTML = `
                    <div class="page-header" style="margin-bottom:1.5rem;">
                        <div>
                            <h2 style="font-size:1.6rem;"><i class="fas fa-tachometer-alt"></i> لوحة التحكم</h2>
                            <p style="color:var(--text-secondary);">${now}</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-primary btn-sm" onclick="app.navigateTo('purchases')"><i class="fas fa-shopping-cart"></i> أمر شراء</button>
                            <button class="btn btn-success btn-sm" onclick="app.navigateTo('production')"><i class="fas fa-industry"></i> أمر إنتاج</button>
                            <button class="btn btn-info btn-sm" onclick="app.navigateTo('sales')"><i class="fas fa-file-invoice-dollar"></i> فاتورة مبيعات</button>
                        </div>
                    </div>

                    <!-- KPI Row 1 -->
                    <div class="stats-row" style="margin-bottom:1rem;">
                        <div class="stat-card card-green" onclick="app.navigateTo('sales')" style="cursor:pointer;">
                            <div class="icon bg-green"><i class="fas fa-cash-register"></i></div>
                            <div class="info"><p>إجمالي المبيعات</p><h3 style="font-size:1.2rem;">${fmt(totalSales)}</h3><span class="trend trend-up">ريال · ${pendingSales} معلق</span></div>
                        </div>
                        <div class="stat-card card-blue" onclick="app.navigateTo('purchases')" style="cursor:pointer;">
                            <div class="icon bg-blue"><i class="fas fa-shopping-cart"></i></div>
                            <div class="info"><p>إجمالي المشتريات</p><h3 style="font-size:1.2rem;">${fmt(totalPurchases)}</h3><span class="trend">ريال · ${pendingPurch} معلق</span></div>
                        </div>
                        <div class="stat-card card-purple" onclick="app.navigateTo('production')" style="cursor:pointer;">
                            <div class="icon bg-purple"><i class="fas fa-industry"></i></div>
                            <div class="info"><p>تكلفة الإنتاج</p><h3 style="font-size:1.2rem;">${fmt(totalProdCost)}</h3><span class="trend">${productionOrds.filter(o=>o.status==='completed').length} أمر مكتمل</span></div>
                        </div>
                        <div class="stat-card card-orange" onclick="app.navigateTo('rawMaterials')" style="cursor:pointer;">
                            <div class="icon bg-orange"><i class="fas fa-boxes"></i></div>
                            <div class="info"><p>قيمة المخزون</p><h3 style="font-size:1.2rem;">${fmt(totalRmValue)}</h3><span class="trend ${lowStockRm.length>0?'trend-down':'trend-up'}">${lowStockRm.length} منخفض</span></div>
                        </div>
                    </div>

                    <!-- KPI Row 2 -->
                    <div class="stats-row" style="margin-bottom:1.5rem;">
                        <div class="stat-card" onclick="app.navigateTo('rawMaterials')" style="cursor:pointer;">
                            <div class="icon bg-blue"><i class="fas fa-flask"></i></div>
                            <div class="info"><p>المواد الخام</p><h3>${rawMaterials.length}</h3><span class="trend">${outStockRm.length} نفد مخزونها</span></div>
                        </div>
                        <div class="stat-card" onclick="app.navigateTo('products')" style="cursor:pointer;">
                            <div class="icon bg-green"><i class="fas fa-box-open"></i></div>
                            <div class="info"><p>المنتجات</p><h3>${products.length}</h3><span class="trend">${productCostings.length} حجم</span></div>
                        </div>
                        <div class="stat-card" onclick="app.navigateTo('customers')" style="cursor:pointer;">
                            <div class="icon bg-purple"><i class="fas fa-users"></i></div>
                            <div class="info"><p>العملاء</p><h3>${customers.length}</h3><span class="trend">${salesOrders.length} فاتورة</span></div>
                        </div>
                        <div class="stat-card" onclick="app.navigateTo('suppliers')" style="cursor:pointer;">
                            <div class="icon bg-orange"><i class="fas fa-truck"></i></div>
                            <div class="info"><p>الموردون</p><h3>${suppliers.length}</h3><span class="trend">${purchaseOrders.length} أمر شراء</span></div>
                        </div>
                        <div class="stat-card" onclick="app.navigateTo('recipes')" style="cursor:pointer;">
                            <div class="icon bg-blue"><i class="fas fa-vials"></i></div>
                            <div class="info"><p>التركيبات</p><h3>${recipes.length}</h3><span class="trend">تركيبة</span></div>
                        </div>
                    </div>

                    <!-- Charts + Tables -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem;">
                        <div class="chart-card">
                            <div class="chart-header"><h3><i class="fas fa-chart-line"></i> المبيعات الشهرية</h3></div>
                            <div class="chart-body"><canvas id="dbMonthlySales" height="140"></canvas></div>
                        </div>
                        <div class="chart-card">
                            <div class="chart-header"><h3><i class="fas fa-chart-pie"></i> توزيع المخزون حسب النوع</h3></div>
                            <div class="chart-body"><canvas id="dbInventoryPie" height="140"></canvas></div>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem;">
                        <!-- آخر المبيعات -->
                        <div class="table-container">
                            <div class="table-header">
                                <h3><i class="fas fa-file-invoice-dollar"></i> آخر فواتير المبيعات</h3>
                                <button class="btn btn-info btn-sm" onclick="app.navigateTo('sales')">عرض الكل</button>
                            </div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
                                    <tbody>
                                        ${recentSales.length===0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">لا توجد فواتير</td></tr>' :
                                        recentSales.map(o => {
                                            const sc={draft:'status-secondary',confirmed:'status-info',delivered:'status-success',cancelled:'status-danger'};
                                            const sl={draft:'مسودة',confirmed:'مؤكد',delivered:'مسلّم',cancelled:'ملغي'};
                                            return '<tr>' +
                                                '<td style="font-family:monospace;font-size:0.8rem;color:var(--primary);">' + o.orderNumber + '</td>' +
                                                '<td><strong>' + (o.customerName||'—') + '</strong></td>' +
                                                '<td style="color:var(--success);font-weight:700;">' + (o.totalAmount||0).toLocaleString('ar-SA',{maximumFractionDigits:0}) + ' ر.س</td>' +
                                                '<td><span class="status-badge ' + (sc[o.status]||'status-secondary') + '" style="font-size:0.72rem;">' + (sl[o.status]||o.status) + '</span></td>' +
                                            '</tr>';
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- آخر الإنتاج -->
                        <div class="table-container">
                            <div class="table-header">
                                <h3><i class="fas fa-industry"></i> آخر أوامر الإنتاج</h3>
                                <button class="btn btn-info btn-sm" onclick="app.navigateTo('production')">عرض الكل</button>
                            </div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>النوع</th><th>المنتج</th><th>الكمية</th><th>التكلفة</th></tr></thead>
                                    <tbody>
                                        ${recentProd.length===0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1rem;">لا توجد أوامر</td></tr>' :
                                        recentProd.map(o =>
                                            '<tr>' +
                                            '<td><span class="status-badge ' + (o.orderType==='ton'?'status-info':'status-warning') + '" style="font-size:0.72rem;">' + (o.orderType==='ton'?'طن':'كرتون') + '</span></td>' +
                                            '<td><strong>' + (o.productName||'—') + '</strong></td>' +
                                            '<td style="font-size:0.82rem;">' + (o.orderType==='carton'?(o.cartonCount||0)+' كرتون':(o.quantity||0)+' كيلو') + '</td>' +
                                            '<td style="color:var(--primary);font-weight:700;">' + (o.totalCost||0).toLocaleString('ar-SA',{maximumFractionDigits:0}) + ' ر.س</td>' +
                                            '</tr>'
                                        ).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- تنبيهات المخزون -->
                    ${(lowStockRm.length > 0 || outStockRm.length > 0) ? `
                    <div class="table-container">
                        <div class="table-header">
                            <h3><i class="fas fa-exclamation-triangle" style="color:#f97316;"></i> تنبيهات المخزون</h3>
                            <span class="status-badge status-danger">${lowStockRm.length + outStockRm.length} تنبيه</span>
                        </div>
                        <div class="table-wrapper">
                            <table>
                                <thead><tr><th>المادة</th><th>الرصيد الحالي</th><th>الحد الأدنى</th><th>الحالة</th><th>إجراء</th></tr></thead>
                                <tbody>
                                    ${[...outStockRm, ...lowStockRm].slice(0,8).map(m => `
                                    <tr>
                                        <td><strong>${m.name}</strong></td>
                                        <td style="font-weight:700;color:${m.balance<=0?'#dc3545':'#f97316'};">${m.balance.toLocaleString('ar-SA')} ${m.unit||''}</td>
                                        <td style="color:#64748b;">${(m.minStock||0)} ${m.unit||''}</td>
                                        <td><span style="background:${m.balance<=0?'#dc3545':'#f97316'};color:#fff;padding:2px 8px;border-radius:1rem;font-size:0.75rem;font-weight:700;">${m.balance<=0?'نفد':'منخفض'}</span></td>
                                        <td><button class="btn btn-primary btn-sm" onclick="app.navigateTo('purchases')" style="font-size:0.75rem;"><i class="fas fa-shopping-cart"></i> شراء</button></td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>` : `
                    <div style="background:#f0fdf4;border-radius:10px;padding:1rem 1.5rem;display:flex;align-items:center;gap:0.75rem;color:#065f46;">
                        <i class="fas fa-check-circle" style="font-size:1.5rem;color:#10b981;"></i>
                        <strong>جميع المواد الخام بمستوى مخزون آمن ✅</strong>
                    </div>`}
                `;

                // رسوم بيانية — نحفظ البيانات في window عشان نستخدمها بعد الـ render
                window._dbChartData = { mKeys, mVals,
                    rawCount: rawMaterials.filter(m=>m.materialType!=='packaging').length,
                    pkgCount: rawMaterials.filter(m=>m.materialType==='packaging').length,
                    prodCount: products.length
                };
                setTimeout(() => {
                    const d = window._dbChartData || {};
                    const ctx1 = document.getElementById('dbMonthlySales');
                    if (ctx1) new Chart(ctx1, {
                        type: 'line',
                        data: {
                            labels: d.mKeys || [],
                            datasets: [{
                                label: 'المبيعات (ر.س)',
                                data: d.mVals || [],
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                borderWidth: 2, fill: true, tension: 0.4,
                                pointRadius: 4, pointBackgroundColor: '#10b981'
                            }]
                        },
                        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                    });
                    const ctx2 = document.getElementById('dbInventoryPie');
                    if (ctx2) new Chart(ctx2, {
                        type: 'doughnut',
                        data: {
                            labels: ['مواد خام', 'مواد تعبئة', 'منتجات نهائية'],
                            datasets: [{ data: [d.rawCount||0, d.pkgCount||0, d.prodCount||0], backgroundColor: ['#3b82f6','#7c3aed','#10b981'], borderWidth: 0 }]
                        },
                        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
                    });
                }, 150);
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
