// ============================================================
// 🚀 server.js — نقطة الدخول الرئيسية للـ Backend
// Industrial ERP — Node.js + Express + Supabase
// ============================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// استيراد الـ routes
const authRouter = require('./routes/auth');
const approvalRouter = require('./routes/approval');
const {
    rawMaterialsRouter,
    productsRouter,
    suppliersRouter,
    recipesRouter,
    productCostingsRouter,
    productionOrdersRouter,
    savedQuotationsRouter,
    unitsRouter,
    sizeTemplatesRouter,
    notificationsRouter,
    activityLogRouter,
    purchaseOrdersRouter
} = require('./routes/approvalData');

const authMiddleware = require('./middleware/auth');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ مطلوب على Render (وأي hosting بيستخدم reverse proxy)
app.set('trust proxy', 1);

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — السماح للـ Frontend فقط
app.use(cors({
    origin: '*', // مؤقتاً - نشوف المشكلة
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// JSON Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting — حماية من DDOS
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 500, // 500 طلب لكل IP
    message: { success: false, error: 'عدد كبير من الطلبات، انتظر قليلاً' }
});
app.use('/api/', limiter);

// Rate Limit مشدد على Auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'محاولات تسجيل دخول كثيرة، انتظر 15 دقيقة' }
});

// ============================================================
// ROUTES
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ─── Auth Routes ─────────────────────────────────────────
// POST   /api/auth/login
// POST   /api/auth/logout
// GET    /api/auth/session
// POST   /api/auth/refresh
app.use('/api/auth', authLimiter, authRouter);

// ─── Data Routes (تحتاج تسجيل دخول) ─────────────────────
// كل route يدعم: GET / GET /:id / POST / PUT /:id / DELETE /:id
//                POST /bulk (upsert مجموعة) / DELETE /clear/all

// المواد الخام
// GET    /api/raw-materials
// POST   /api/raw-materials
// PUT    /api/raw-materials/:id
// DELETE /api/raw-materials/:id
app.use('/api/raw-materials',     rawMaterialsRouter);

// المنتجات النهائية
// GET    /api/products
// POST   /api/products
// ...إلخ
app.use('/api/products',          productsRouter);

// الموردين
app.use('/api/suppliers',         suppliersRouter);

// التركيبات (وصفات المواد)
app.use('/api/recipes',           recipesRouter);

// تكاليف المنتجات
app.use('/api/product-costings',  productCostingsRouter);

// أوامر الإنتاج
app.use('/api/production-orders', productionOrdersRouter);

// عروض الأسعار المحفوظة
app.use('/api/saved-quotations',  savedQuotationsRouter);

// الوحدات
app.use('/api/units',             unitsRouter);

// قوالب الأحجام
app.use('/api/size-templates',    sizeTemplatesRouter);

// الإشعارات
app.use('/api/notifications',     notificationsRouter);

// سجل النشاط
app.use('/api/activity-log',      activityLogRouter);

// Approval Workflow Routes
app.use('/api/approval',          approvalRouter);

// أوامر الشراء
app.use('/api/purchase-orders',   purchaseOrdersRouter);

// ─── Load All Data (تحميل كل شيء دفعة واحدة عند بدء التطبيق) ──
// GET /api/data/all — بديل عن loadAllFromSupabase()
app.get('/api/data/all', authMiddleware, async (req, res) => {
    try {
        const tables = {
            rawMaterials:     { table: 'raw_materials',      fromRow: r => ({ id: r.id, name: r.name, materialType: r.material_type, subType: r.sub_type, unit: r.unit, costPrice: r.cost_price, invoiceNo: r.invoice_no, supplier: r.supplier, purchaseDate: r.purchase_date, quantity: r.quantity, minStock: r.min_stock, createdAt: r.created_at }) },
            products:         { table: 'products',            fromRow: r => ({ id: r.id, name: r.name, barcode: r.barcode, sellingPrice: r.selling_price, costPrice: r.cost_price, stock: r.stock, minStock: r.min_stock, volumeMl: r.volume_ml, volume: r.volume_ml, description: r.description, createdAt: r.created_at }) },
            suppliers:        { table: 'suppliers',           fromRow: r => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, address: r.address, totalPurchases: r.total_purchases, createdAt: r.created_at }) },
            recipes:          { table: 'recipes',             fromRow: r => ({ id: r.id, productId: r.product_id, productName: r.product_name, barcode: r.barcode, materials: r.materials || [], totalMaterialsCostPerTon: r.total_materials_cost_per_ton, costPerLiter: r.cost_per_liter, createdAt: r.created_at }) },
            productCostings:  { table: 'product_costings',    fromRow: r => ({ id: r.id, productId: r.product_id, productName: r.product_name, barcode: r.barcode, recipeId: r.recipe_id, skuSize: r.sku_size, skuSizeLiters: r.sku_size_liters, unitsPerCarton: r.units_per_carton, costPerLiter: r.cost_per_liter, rawMaterialCost: r.raw_material_cost, packagingCost: r.packaging_cost, totalCartonCost: r.total_carton_cost, totalUnitCost: r.total_unit_cost, cartonItems: r.carton_items || [], createdAt: r.created_at }) },
            productionOrders: { table: 'production_orders',   fromRow: r => ({ id: r.id, orderType: r.order_type, productId: r.product_id, productName: r.product_name, quantity: r.quantity, cartonCount: r.carton_count, skuSize: r.sku_size, totalCost: r.total_cost, rawMaterialCost: r.raw_material_cost, packagingCost: r.packaging_cost, totalLiters: r.total_liters, unitsProduced: r.units_produced, status: r.status, date: r.date, materials: r.materials || [], isMulti: r.is_multi, subOrders: r.sub_orders || [] }) },
            savedQuotations:  { table: 'saved_quotations',    fromRow: r => ({ id: r.id, name: r.name, date: r.date, itemCount: r.item_count, totalSelling: r.total_selling, items: r.items || [] }) },
            units:            { table: 'units',               fromRow: r => ({ id: r.id, name: r.name }) },
            sizeTemplates:    { table: 'size_templates',      fromRow: r => ({ id: r.id, name: r.name, sizeLiters: r.size_liters, unitsPerCarton: r.units_per_carton }) },
            notifications:    { table: 'notifications',       fromRow: r => ({ id: r.id, message: r.message, type: r.type, read: r.read, date: r.created_at }) },
            activityLog:      { table: 'activity_log',        fromRow: r => ({ action: r.action, user: r.user_name, type: r.type, timestamp: r.created_at }) },
            purchaseOrders:   { table: 'purchase_orders',     fromRow: r => ({ id: r.id, orderNumber: r.order_number, supplierId: r.supplier_id, supplierName: r.supplier_name, status: r.status, orderDate: r.order_date, expectedDate: r.expected_date, receivedDate: r.received_date, items: r.items || [], subtotal: r.subtotal, taxPercent: r.tax_percent, taxAmount: r.tax_amount, totalAmount: r.total_amount, notes: r.notes, createdBy: r.created_by, createdAt: r.created_at }) }
        };

        const result = {};
        await Promise.all(
            Object.entries(tables).map(async ([key, cfg]) => {
                try {
                    const orderCol = cfg.orderBy || 'created_at';
                    const { data, error } = await supabase
                        .from(cfg.table)
                        .select('*')
                        .order(orderCol, { ascending: true });
                    
                    if (error) {
                        console.error(`❌ Error loading ${key}:`, error.message);
                        result[key] = [];
                    } else {
                        console.log(`✅ Loaded ${key}: ${data?.length || 0} records`);
                        result[key] = (!error && data) ? data.map(r => cfg.fromRow(r)) : [];
                    }
                } catch (e) {
                    console.error(`❌ Exception loading ${key}:`, e.message);
                    result[key] = [];
                }
            })
        );

        res.json({ success: true, data: result });

    } catch (err) {
        console.error('Load all data error:', err);
        res.status(500).json({ success: false, error: 'خطأ في تحميل البيانات' });
    }
});

// ─── Reset All Data ──────────────────────────────────────
// DELETE /api/data/reset — مسح كل الجداول (مطابق لـ resetAllData)
app.delete('/api/data/reset', authMiddleware, async (req, res) => {
    try {
        const tables = [
            'raw_materials', 'products', 'suppliers', 'recipes',
            'product_costings', 'production_orders', 'saved_quotations',
            'activity_log', 'notifications', 'units', 'size_templates',
            'purchase_orders'
        ];

        await Promise.all(tables.map(t =>
            supabase.from(t).delete().neq('id', '____nonexistent____')
                .then(({ error }) => {
                    if (error) console.warn('Clear table error:', t, error);
                })
        ));

        res.json({ success: true, message: 'تم إعادة تعيين جميع البيانات' });

    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ success: false, error: 'خطأ في إعادة التعيين' });
    }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((req, res) => {
    res.status(404).json({ success: false, error: `المسار ${req.path} غير موجود` });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'خطأ داخلي في السيرفر' });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   🏭 Industrial ERP — Backend API Server   ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  🟢 Running on: http://localhost:${PORT}       ║`);
    console.log(`║  🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║`);
    console.log('╠════════════════════════════════════════════╣');
    console.log('║  📡 Available Routes:                      ║');
    console.log('║  POST   /api/auth/login                    ║');
    console.log('║  GET    /api/data/all                      ║');
    console.log('║  GET    /api/raw-materials                 ║');
    console.log('║  GET    /api/products                      ║');
    console.log('║  GET    /api/suppliers                     ║');
    console.log('║  GET    /api/recipes                       ║');
    console.log('║  GET    /api/product-costings              ║');
    console.log('║  GET    /api/production-orders             ║');
    console.log('║  GET    /api/saved-quotations              ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
