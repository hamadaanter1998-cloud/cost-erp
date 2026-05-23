// ============================================================
// reports.js — موديول التقارير
// يُضاف تلقائياً لـ AppController.prototype عند تحميل الصفحة
// ============================================================

(function(proto) {

proto.renderReports = function(container) {
                const rawMaterials    = storage.get('rawMaterials')    || [];
                const products        = storage.get('products')         || [];
                const productionOrds  = storage.get('productionOrders') || [];
                const purchaseOrders  = storage.get('purchaseOrders')   || [];
                const salesOrders     = storage.get('salesOrders')      || [];
                const suppliers       = storage.get('suppliers')         || [];
                const customers       = storage.get('customers')         || [];
                const productCostings = storage.get('productCostings')   || [];

                // ── حسابات شاملة ─────────────────────────────────────────
                // مخزون المواد الخام
                const _po   = purchaseOrders.filter(p => p.status==='received');
                const _prds = productionOrds;
                const calcRmBalance = (mat) => {
                    const opening = mat.openingStock ?? mat.quantity ?? 0;
                    const purchased = _po.reduce((s,po) => { const it=(po.items||[]).find(i=>i.materialId===mat.id); return s+(it?it.qty||0:0); },0);
                    const consumed  = _prds.reduce((s,po) => { const e=(po.materials||[]).find(m=>m.materialId===mat.id); if(e) return s+(e.requiredQty||0); return s+(po.subOrders||[]).reduce((ss,sub)=>{ const sm=(sub.materials||[]).find(m=>m.materialId===mat.id); return ss+(sm?sm.requiredQty||0:0); },0); },0);
                    return opening + purchased - consumed;
                };
                const rmWithBalance = rawMaterials.map(m => ({ ...m, balance: calcRmBalance(m) }));
                const totalRmValue  = rmWithBalance.reduce((s,m) => s + m.balance*(m.costPrice||0), 0);
                const lowStockRm    = rmWithBalance.filter(m => m.balance <= (m.minStock||0)).length;

                // مبيعات
                const totalSales    = salesOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
                const totalOrders   = salesOrders.length;
                const deliveredSales= salesOrders.filter(o=>o.status==='delivered').reduce((s,o)=>s+(o.totalAmount||0),0);

                // مشتريات
                const totalPurchases = purchaseOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
                const receivedPurch  = purchaseOrders.filter(o=>o.status==='received').reduce((s,o)=>s+(o.totalAmount||0),0);

                // إنتاج
                const totalProdCost  = productionOrds.filter(o=>o.status==='completed').reduce((s,o)=>s+(o.totalCost||0),0);
                const tonOrders      = productionOrds.filter(o=>o.orderType==='ton').length;
                const cartonOrders   = productionOrds.filter(o=>o.orderType==='carton').length;

                // أعلى عملاء
                const customerSales = customers.map(c => ({
                    ...c,
                    total: salesOrders.filter(o=>o.customerId===c.id).reduce((s,o)=>s+(o.totalAmount||0),0),
                    count: salesOrders.filter(o=>o.customerId===c.id).length
                })).sort((a,b)=>b.total-a.total).slice(0,5);

                // أعلى موردين
                const supplierPurch = suppliers.map(s => ({
                    ...s,
                    total: purchaseOrders.filter(o=>o.supplierId===s.id).reduce((s2,o)=>s2+(o.totalAmount||0),0),
                    count: purchaseOrders.filter(o=>o.supplierId===s.id).length
                })).sort((a,b)=>b.total-a.total).slice(0,5);

                // أعلى مواد خام استهلاكاً
                const rmConsumption = rmWithBalance.map(m => {
                    const consumed = _prds.reduce((s,po) => { const e=(po.materials||[]).find(x=>x.materialId===m.id); if(e) return s+(e.requiredQty||0); return s+(po.subOrders||[]).reduce((ss,sub)=>{ const sm=(sub.materials||[]).find(x=>x.materialId===m.id); return ss+(sm?sm.requiredQty||0:0); },0); },0);
                    return { ...m, consumed, consumedValue: consumed*(m.costPrice||0) };
                }).sort((a,b)=>b.consumedValue-a.consumedValue).slice(0,8);

                // مبيعات شهرية
                const monthlyData = {};
                salesOrders.forEach(o => {
                    if (!o.orderDate) return;
                    const key = o.orderDate.slice(0,7);
                    if (!monthlyData[key]) monthlyData[key] = { sales:0, orders:0 };
                    monthlyData[key].sales  += o.totalAmount||0;
                    monthlyData[key].orders += 1;
                });
                const monthlyLabels = Object.keys(monthlyData).sort().slice(-6);
                const monthlySales  = monthlyLabels.map(k => monthlyData[k].sales);

                // مشتريات شهرية
                const purchMonthly = {};
                purchaseOrders.forEach(o => {
                    if (!o.orderDate) return;
                    const key = o.orderDate.slice(0,7);
                    if (!purchMonthly[key]) purchMonthly[key] = 0;
                    purchMonthly[key] += o.totalAmount||0;
                });
                const purchLabels = Object.keys(purchMonthly).sort().slice(-6);
                const purchValues = purchLabels.map(k => purchMonthly[k]);

                const fmt = v => v.toLocaleString('ar-SA', { minimumFractionDigits:0, maximumFractionDigits:0 });

                container.innerHTML = `
                    <div class="page-header">
                        <div>
                            <h2><i class="fas fa-chart-bar"></i> التقارير والإحصائيات</h2>
                            <p>لوحة تحليلية شاملة لأداء النظام</p>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button class="btn btn-secondary btn-sm" onclick="app._reportTab('overview')" id="rtab-overview"><i class="fas fa-home"></i> نظرة عامة</button>
                            <button class="btn btn-secondary btn-sm" onclick="app._reportTab('sales')" id="rtab-sales"><i class="fas fa-shopping-bag"></i> المبيعات</button>
                            <button class="btn btn-secondary btn-sm" onclick="app._reportTab('purchases')" id="rtab-purchases"><i class="fas fa-shopping-cart"></i> المشتريات</button>
                            <button class="btn btn-secondary btn-sm" onclick="app._reportTab('production')" id="rtab-production"><i class="fas fa-industry"></i> الإنتاج</button>
                            <button class="btn btn-secondary btn-sm" onclick="app._reportTab('inventory')" id="rtab-inventory"><i class="fas fa-boxes"></i> المخزون</button>
                            <button class="btn btn-warning btn-sm" onclick="app.exportReportExcel()"><i class="fas fa-file-excel"></i> تصدير</button>
                        </div>
                    </div>

                    <!-- نظرة عامة -->
                    <div id="report-overview">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-green">
                                <div class="icon bg-green"><i class="fas fa-cash-register"></i></div>
                                <div class="info"><p>إجمالي المبيعات</p><h3 style="font-size:1.1rem;">${fmt(totalSales)}</h3><span class="trend trend-up">ريال</span></div>
                            </div>
                            <div class="stat-card card-blue">
                                <div class="icon bg-blue"><i class="fas fa-shopping-cart"></i></div>
                                <div class="info"><p>إجمالي المشتريات</p><h3 style="font-size:1.1rem;">${fmt(totalPurchases)}</h3><span class="trend">ريال</span></div>
                            </div>
                            <div class="stat-card card-purple">
                                <div class="icon bg-purple"><i class="fas fa-industry"></i></div>
                                <div class="info"><p>تكلفة الإنتاج</p><h3 style="font-size:1.1rem;">${fmt(totalProdCost)}</h3><span class="trend">ريال</span></div>
                            </div>
                            <div class="stat-card card-orange">
                                <div class="icon bg-orange"><i class="fas fa-boxes"></i></div>
                                <div class="info"><p>قيمة مخزون المواد</p><h3 style="font-size:1.1rem;">${fmt(totalRmValue)}</h3><span class="trend">ريال</span></div>
                            </div>
                        </div>

                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card"><div class="icon bg-blue"><i class="fas fa-users"></i></div><div class="info"><p>العملاء</p><h3>${customers.length}</h3></div></div>
                            <div class="stat-card"><div class="icon bg-green"><i class="fas fa-truck"></i></div><div class="info"><p>الموردون</p><h3>${suppliers.length}</h3></div></div>
                            <div class="stat-card"><div class="icon bg-purple"><i class="fas fa-file-invoice-dollar"></i></div><div class="info"><p>فواتير المبيعات</p><h3>${salesOrders.length}</h3></div></div>
                            <div class="stat-card ${lowStockRm>0?'card-orange':''}"><div class="icon bg-orange"><i class="fas fa-exclamation-triangle"></i></div><div class="info"><p>مواد منخفضة</p><h3>${lowStockRm}</h3></div></div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem;">
                            <div class="table-container">
                                <div class="table-header"><h3><i class="fas fa-trophy"></i> أعلى العملاء مبيعاً</h3></div>
                                <div class="table-wrapper">
                                    <table>
                                        <thead><tr><th>العميل</th><th>الفواتير</th><th>الإجمالي</th></tr></thead>
                                        <tbody>
                                            ${customerSales.length === 0 ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;">لا يوجد</td></tr>` :
                                            customerSales.map(c => `<tr>
                                                <td><strong>${c.name}</strong></td>
                                                <td><span class="status-badge status-info">${c.count}</span></td>
                                                <td><strong style="color:var(--success);">${fmt(c.total)} ر.س</strong></td>
                                            </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="table-container">
                                <div class="table-header"><h3><i class="fas fa-medal"></i> أعلى الموردين مشتريات</h3></div>
                                <div class="table-wrapper">
                                    <table>
                                        <thead><tr><th>المورد</th><th>الأوامر</th><th>الإجمالي</th></tr></thead>
                                        <tbody>
                                            ${supplierPurch.length === 0 ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;">لا يوجد</td></tr>` :
                                            supplierPurch.map(s => `<tr>
                                                <td><strong>${s.name}</strong></td>
                                                <td><span class="status-badge status-info">${s.count}</span></td>
                                                <td><strong style="color:var(--primary);">${fmt(s.total)} ر.س</strong></td>
                                            </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="chart-card" style="margin-bottom:1.25rem;">
                            <div class="chart-header"><h3><i class="fas fa-chart-line"></i> المبيعات والمشتريات الشهرية</h3></div>
                            <div class="chart-body"><canvas id="rptMonthlyChart" height="120"></canvas></div>
                        </div>
                    </div>

                    <!-- تقرير المبيعات -->
                    <div id="report-sales" style="display:none;">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-green"><div class="icon bg-green"><i class="fas fa-cash-register"></i></div><div class="info"><p>إجمالي المبيعات</p><h3 style="font-size:1.1rem;">${fmt(totalSales)} ر.س</h3></div></div>
                            <div class="stat-card card-blue"><div class="icon bg-blue"><i class="fas fa-check-circle"></i></div><div class="info"><p>مبيعات مسلّمة</p><h3 style="font-size:1.1rem;">${fmt(deliveredSales)} ر.س</h3></div></div>
                            <div class="stat-card card-orange"><div class="icon bg-orange"><i class="fas fa-file-invoice"></i></div><div class="info"><p>عدد الفواتير</p><h3>${totalOrders}</h3></div></div>
                            <div class="stat-card card-purple"><div class="icon bg-purple"><i class="fas fa-users"></i></div><div class="info"><p>العملاء النشطون</p><h3>${new Set(salesOrders.map(o=>o.customerId)).size}</h3></div></div>
                        </div>
                        <div class="table-container">
                            <div class="table-header"><h3><i class="fas fa-list"></i> تفاصيل فواتير المبيعات</h3></div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الأصناف</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
                                    <tbody>
                                        ${salesOrders.length===0 ? `<tr><td colspan="8" style="text-align:center;color:#94a3b8;">لا توجد فواتير</td></tr>` :
                                        salesOrders.slice().sort((a,b)=>new Date(b.orderDate||0)-new Date(a.orderDate||0)).map(o=>`<tr>
                                            <td style="font-family:monospace;font-size:0.82rem;color:var(--primary);font-weight:700;">${o.orderNumber}</td>
                                            <td><strong>${o.customerName||'—'}</strong></td>
                                            <td style="font-size:0.82rem;color:#64748b;">${o.orderDate||'—'}</td>
                                            <td><span class="status-badge status-info">${(o.items||[]).length}</span></td>
                                            <td style="color:#f97316;">${o.discountAmt>0?fmt(o.discountAmt)+' ر.س':'—'}</td>
                                            <td style="color:#64748b;">${fmt(o.taxAmount||0)} ر.س</td>
                                            <td><strong style="color:var(--success);">${fmt(o.totalAmount||0)} ر.س</strong></td>
                                            <td><span class="status-badge ${o.status==='delivered'?'status-success':o.status==='confirmed'?'status-info':'status-secondary'}">${o.status==='delivered'?'مسلّم':o.status==='confirmed'?'مؤكد':'مسودة'}</span></td>
                                        </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- تقرير المشتريات -->
                    <div id="report-purchases" style="display:none;">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-blue"><div class="icon bg-blue"><i class="fas fa-shopping-cart"></i></div><div class="info"><p>إجمالي المشتريات</p><h3 style="font-size:1.1rem;">${fmt(totalPurchases)} ر.س</h3></div></div>
                            <div class="stat-card card-green"><div class="icon bg-green"><i class="fas fa-check"></i></div><div class="info"><p>مشتريات مستلمة</p><h3 style="font-size:1.1rem;">${fmt(receivedPurch)} ر.س</h3></div></div>
                            <div class="stat-card card-orange"><div class="icon bg-orange"><i class="fas fa-file-invoice"></i></div><div class="info"><p>عدد الأوامر</p><h3>${purchaseOrders.length}</h3></div></div>
                            <div class="stat-card card-purple"><div class="icon bg-purple"><i class="fas fa-truck"></i></div><div class="info"><p>الموردون</p><h3>${suppliers.length}</h3></div></div>
                        </div>
                        <div class="table-container">
                            <div class="table-header"><h3><i class="fas fa-list"></i> تفاصيل أوامر الشراء</h3></div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>الأمر</th><th>المورد</th><th>التاريخ</th><th>الأصناف</th><th>الضريبة</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
                                    <tbody>
                                        ${purchaseOrders.length===0 ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;">لا توجد أوامر</td></tr>` :
                                        purchaseOrders.slice().sort((a,b)=>new Date(b.orderDate||0)-new Date(a.orderDate||0)).map(o=>{
                                            const sc={draft:'status-secondary',pending:'status-warning',approved:'status-info',received:'status-success',cancelled:'status-danger'};
                                            const sl={draft:'مسودة',pending:'بانتظار',approved:'معتمد',received:'مستلم',cancelled:'ملغي'};
                                            return `<tr>
                                                <td style="font-family:monospace;font-size:0.82rem;color:var(--primary);font-weight:700;">${o.orderNumber}</td>
                                                <td><strong>${o.supplierName||'—'}</strong></td>
                                                <td style="font-size:0.82rem;color:#64748b;">${o.orderDate||'—'}</td>
                                                <td><span class="status-badge status-info">${(o.items||[]).length}</span></td>
                                                <td style="color:#64748b;">${fmt(o.taxAmount||0)} ر.س</td>
                                                <td><strong style="color:var(--primary);">${fmt(o.totalAmount||0)} ر.س</strong></td>
                                                <td><span class="status-badge ${sc[o.status]||'status-secondary'}">${sl[o.status]||o.status}</span></td>
                                            </tr>`;}).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- تقرير الإنتاج -->
                    <div id="report-production" style="display:none;">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-blue"><div class="icon bg-blue"><i class="fas fa-industry"></i></div><div class="info"><p>إجمالي أوامر الإنتاج</p><h3>${productionOrds.length}</h3></div></div>
                            <div class="stat-card card-green"><div class="icon bg-green"><i class="fas fa-weight-hanging"></i></div><div class="info"><p>أوامر بالطن</p><h3>${tonOrders}</h3></div></div>
                            <div class="stat-card card-purple"><div class="icon bg-purple"><i class="fas fa-box"></i></div><div class="info"><p>أوامر بالكرتون</p><h3>${cartonOrders}</h3></div></div>
                            <div class="stat-card card-orange"><div class="icon bg-orange"><i class="fas fa-coins"></i></div><div class="info"><p>إجمالي تكلفة الإنتاج</p><h3 style="font-size:1.1rem;">${fmt(totalProdCost)} ر.س</h3></div></div>
                        </div>

                        <div class="chart-card" style="margin-bottom:1.25rem;">
                            <div class="chart-header"><h3><i class="fas fa-chart-bar"></i> أعلى المواد الخام استهلاكاً</h3></div>
                            <div class="chart-body"><canvas id="rptRmChart" height="120"></canvas></div>
                        </div>

                        <div class="table-container">
                            <div class="table-header"><h3><i class="fas fa-list"></i> سجل أوامر الإنتاج</h3></div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>رقم</th><th>النوع</th><th>المنتج</th><th>الكمية</th><th>التكلفة</th><th>التاريخ</th><th>الحالة</th></tr></thead>
                                    <tbody>
                                        ${productionOrds.length===0 ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;">لا توجد أوامر</td></tr>` :
                                        productionOrds.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(o=>`<tr>
                                            <td style="font-family:monospace;font-size:0.75rem;color:#64748b;">${o.id?.slice(0,8)}</td>
                                            <td><span class="status-badge ${o.orderType==='ton'?'status-info':'status-warning'}">${o.orderType==='ton'?'طن':'كرتون'}</span></td>
                                            <td><strong>${o.productName||'—'}</strong></td>
                                            <td>${o.orderType==='carton'?(o.cartonCount||0)+' كرتون':(o.quantity||0)+' كيلو'}</td>
                                            <td><strong style="color:var(--success);">${fmt(o.totalCost||0)} ر.س</strong></td>
                                            <td style="font-size:0.82rem;color:#64748b;">${o.date?new Date(o.date).toLocaleDateString('ar-SA'):'—'}</td>
                                            <td><span class="status-badge ${o.status==='completed'?'status-success':'status-warning'}">${o.status==='completed'?'مكتمل':'جاري'}</span></td>
                                        </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- تقرير المخزون -->
                    <div id="report-inventory" style="display:none;">
                        <div class="stats-row" style="margin-bottom:1.25rem;">
                            <div class="stat-card card-blue"><div class="icon bg-blue"><i class="fas fa-flask"></i></div><div class="info"><p>إجمالي المواد الخام</p><h3>${rawMaterials.length}</h3></div></div>
                            <div class="stat-card card-purple"><div class="icon bg-purple"><i class="fas fa-coins"></i></div><div class="info"><p>قيمة المخزون</p><h3 style="font-size:1.1rem;">${fmt(totalRmValue)} ر.س</h3></div></div>
                            <div class="stat-card card-orange"><div class="icon bg-orange"><i class="fas fa-exclamation-triangle"></i></div><div class="info"><p>مواد منخفضة</p><h3>${lowStockRm}</h3></div></div>
                            <div class="stat-card ${rmWithBalance.filter(m=>m.balance<=0).length>0?'card-red':'card-green'}" style="${rmWithBalance.filter(m=>m.balance<=0).length>0?'border-right:4px solid #dc3545;':''}"><div class="icon" style="background:${rmWithBalance.filter(m=>m.balance<=0).length>0?'#dc3545':'#10b981'};"><i class="fas fa-times-circle" style="color:#fff;"></i></div><div class="info"><p>نفد مخزونها</p><h3>${rmWithBalance.filter(m=>m.balance<=0).length}</h3></div></div>
                        </div>
                        <div class="table-container">
                            <div class="table-header"><h3><i class="fas fa-list"></i> أرصدة المواد الخام</h3></div>
                            <div class="table-wrapper">
                                <table>
                                    <thead><tr><th>المادة</th><th>النوع</th><th>الرصيد الحالي</th><th>الحد الأدنى</th><th>سعر التكلفة</th><th>قيمة المخزون</th><th>الحالة</th></tr></thead>
                                    <tbody>
                                        ${rmWithBalance.sort((a,b)=>(b.balance*(b.costPrice||0))-(a.balance*(a.costPrice||0))).map(m=>{
                                            const sc = m.balance<=0?'#dc3545':m.balance<=(m.minStock||0)?'#f97316':'#10b981';
                                            const ss = m.balance<=0?'نفد':m.balance<=(m.minStock||0)?'منخفض':'كافي';
                                            return `<tr>
                                                <td><strong>${m.name}</strong></td>
                                                <td><span style="background:${m.materialType==='packaging'?'#7c3aed':'#1e6f9f'};color:#fff;padding:2px 7px;border-radius:1rem;font-size:0.72rem;">${m.materialType==='packaging'?'تعبئة':'خام'}</span></td>
                                                <td><strong>${m.balance.toLocaleString('ar-SA')}</strong> ${m.unit||''}</td>
                                                <td>${(m.minStock||0)} ${m.unit||''}</td>
                                                <td>${(m.costPrice||0).toFixed(2)} ر.س</td>
                                                <td><strong style="color:var(--success);">${fmt(m.balance*(m.costPrice||0))} ر.س</strong></td>
                                                <td><span style="background:${sc};color:#fff;padding:2px 8px;border-radius:1rem;font-size:0.75rem;font-weight:700;">${ss}</span></td>
                                            </tr>`;}).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                // تفعيل أول تبويب
                setTimeout(() => {
                    this._reportTab('overview');
                    this._initReportCharts(monthlyLabels, monthlySales, purchLabels, purchValues, rmConsumption);
                }, 100);
};

proto._reportTab = function(tab) {
                ['overview','sales','purchases','production','inventory'].forEach(t => {
                    const el = document.getElementById('report-' + t);
                    const btn = document.getElementById('rtab-' + t);
                    if (el) el.style.display = t === tab ? '' : 'none';
                    if (btn) {
                        btn.style.background = t === tab ? 'var(--primary)' : '';
                        btn.style.color = t === tab ? '#fff' : '';
                    }
                });
                // إعادة رسم الـ chart لو محتاج
                if (tab === 'production') {
                    const c = document.getElementById('rptRmChart');
                    if (c && !c.dataset.drawn) { c.dataset.drawn = '1'; this._drawRmChart(); }
                }
};

proto._initReportCharts = function(monthlyLabels, monthlySales, purchLabels, purchValues, rmConsumption) {
                window._rptRmConsumption = rmConsumption;
                // الرسم البياني الشهري
                const ctx = document.getElementById('rptMonthlyChart');
                if (!ctx) return;
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: monthlyLabels,
                        datasets: [
                            { label: 'المبيعات', data: monthlySales, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
                            { label: 'المشتريات', data: purchLabels.map((l,i) => purchValues[i]), backgroundColor: 'rgba(30,64,175,0.7)', borderColor: '#1e40af', borderWidth: 2, borderRadius: 6 }
                        ]
                    },
                    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
                });
};

proto._drawRmChart = function() {
                const rm = window._rptRmConsumption || [];
                const ctx = document.getElementById('rptRmChart');
                if (!ctx || !rm.length) return;
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: rm.map(m => m.name.slice(0,15)),
                        datasets: [{ label: 'قيمة الاستهلاك (ر.س)', data: rm.map(m => m.consumedValue), backgroundColor: rm.map((_,i) => `hsla(${200+i*15},70%,45%,0.8)`), borderRadius: 6 }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
};

proto.exportReportExcel = function() {
    const rawMaterials   = storage.get('rawMaterials')    || [];
    const salesOrders    = storage.get('salesOrders')     || [];
    const purchaseOrders = storage.get('purchaseOrders')  || [];
    const productionOrds = storage.get('productionOrders')|| [];
    let csv = '\uFEFF';
    csv += 'تقرير المواد الخام\nالاسم,النوع,الرصيد الحالي,الوحدة,سعر التكلفة,قيمة المخزون\n';
    rawMaterials.forEach(m => { const bal=m.openingStock??m.quantity??0; csv+=`${m.name},${m.materialType==='packaging'?'تعبئة':'خام'},${bal},${m.unit||''},${m.costPrice||0},${(bal*(m.costPrice||0)).toFixed(2)}\n`; });
    csv += '\nتقرير المبيعات\nرقم الفاتورة,العميل,التاريخ,الخصم,الضريبة,الإجمالي,الحالة\n';
    salesOrders.forEach(o => csv+=`${o.orderNumber},${o.customerName||''},${o.orderDate||''},${o.discountAmt||0},${o.taxAmount||0},${o.totalAmount||0},${o.status}\n`);
    csv += '\nتقرير المشتريات\nرقم الأمر,المورد,التاريخ,الضريبة,الإجمالي,الحالة\n';
    purchaseOrders.forEach(o => csv+=`${o.orderNumber},${o.supplierName||''},${o.orderDate||''},${o.taxAmount||0},${o.totalAmount||0},${o.status}\n`);
    csv += '\nتقرير الإنتاج\nرقم الأمر,النوع,المنتج,الكمية,التكلفة,التاريخ,الحالة\n';
    productionOrds.forEach(o => csv+=`${o.id?.slice(0,8)||''},${o.orderType==='ton'?'طن':'كرتون'},${o.productName||''},${o.orderType==='carton'?(o.cartonCount||0)+' كرتون':(o.quantity||0)+' كيلو'},${o.totalCost||0},${o.date?new Date(o.date).toLocaleDateString('ar-SA'):''},${o.status}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `تقرير_ERP_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    storage.showToast('✅ تم تصدير التقرير');
};

})(typeof AppController !== 'undefined' ? AppController.prototype : window);
