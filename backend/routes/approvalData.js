// ============================================================
// 📊 routes/approvalData.js — Approval Workflow Data Routes
// Uses approval workflow for critical tables (recipes, products, etc.)
// ============================================================
const createCrudRouter = require('./crudFactory');
const createApprovalCrudRouter = require('./approvalCrudFactory');

// ─── خريطة التحويل (مطابقة للكود الأصلي بالكامل) ─────────

const TABLE_MAP = {
    rawMaterials: {
        table: 'raw_materials',
        toRow: m => ({
            id: m.id,
            name: m.name,
            material_type: m.materialType || 'raw',
            sub_type: m.subType || '',
            unit: m.unit,
            cost_price: m.costPrice,
            invoice_no: m.invoiceNo || '',
            supplier: m.supplier || '',
            purchase_date: m.purchaseDate || '',
            quantity: m.quantity,
            min_stock: m.minStock || 0
        }),
        fromRow: r => ({
            id: r.id,
            name: r.name,
            materialType: r.material_type,
            subType: r.sub_type,
            unit: r.unit,
            costPrice: r.cost_price,
            invoiceNo: r.invoice_no,
            supplier: r.supplier,
            purchaseDate: r.purchase_date,
            quantity: r.quantity,
            minStock: r.min_stock,
            createdAt: r.created_at
        })
    },

    products: {
        table: 'products',
        toRow: p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode || '',
            selling_price: p.sellingPrice || 0,
            cost_price: p.costPrice || 0,
            stock: p.stock || 0,
            min_stock: p.minStock || 0,
            volume_ml: p.volumeMl || p.volume || 0,
            description: p.description || ''
        }),
        fromRow: r => ({
            id: r.id,
            name: r.name,
            barcode: r.barcode,
            sellingPrice: r.selling_price,
            costPrice: r.cost_price,
            stock: r.stock,
            minStock: r.min_stock,
            volumeMl: r.volume_ml,
            volume: r.volume_ml,
            description: r.description,
            createdAt: r.created_at
        })
    },

    suppliers: {
        table: 'suppliers',
        toRow: s => ({
            id: s.id,
            name: s.name,
            phone: s.phone || '',
            email: s.email || '',
            address: s.address || '',
            total_purchases: s.totalPurchases || 0
        }),
        fromRow: r => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            email: r.email,
            address: r.address,
            totalPurchases: r.total_purchases,
            createdAt: r.created_at
        })
    },

    recipes: {
        table: 'recipes',
        toRow: r => ({
            id: r.id,
            product_id: r.productId,
            product_name: r.productName || '',
            barcode: r.barcode || '',
            materials: r.materials || [],
            total_materials_cost_per_ton: r.totalMaterialsCostPerTon || 0,
            cost_per_liter: r.costPerLiter || 0
        }),
        fromRow: r => ({
            id: r.id,
            productId: r.product_id,
            productName: r.product_name,
            barcode: r.barcode,
            materials: r.materials || [],
            totalMaterialsCostPerTon: r.total_materials_cost_per_ton,
            costPerLiter: r.cost_per_liter,
            createdAt: r.created_at
        })
    },

    productCostings: {
        table: 'product_costings',
        toRow: p => ({
            id: p.id,
            product_id: p.productId,
            product_name: p.productName || '',
            barcode: p.barcode || '',
            recipe_id: p.recipeId || '',
            sku_size: p.skuSize || '',
            sku_size_liters: p.skuSizeLiters || 0,
            units_per_carton: p.unitsPerCarton || 0,
            cost_per_liter: p.costPerLiter || 0,
            raw_material_cost: p.rawMaterialCost || 0,
            packaging_cost: p.packagingCost || 0,
            total_carton_cost: p.totalCartonCost || 0,
            total_unit_cost: p.totalUnitCost || 0,
            carton_items: p.cartonItems || []
        }),
        fromRow: r => ({
            id: r.id,
            productId: r.product_id,
            productName: r.product_name,
            barcode: r.barcode,
            recipeId: r.recipe_id,
            skuSize: r.sku_size,
            skuSizeLiters: r.sku_size_liters,
            unitsPerCarton: r.units_per_carton,
            costPerLiter: r.cost_per_liter,
            rawMaterialCost: r.raw_material_cost,
            packagingCost: r.packaging_cost,
            totalCartonCost: r.total_carton_cost,
            totalUnitCost: r.total_unit_cost,
            cartonItems: r.carton_items || [],
            createdAt: r.created_at
        })
    },

    productionOrders: {
        table: 'production_orders',
        toRow: o => ({
            id: o.id,
            order_type: o.orderType || 'ton',
            product_id: o.productId || '',
            product_name: o.productName || '',
            quantity: o.quantity || 0,
            carton_count: o.cartonCount || 0,
            sku_size: o.skuSize || '',
            total_cost: o.totalCost || 0,
            raw_material_cost: o.rawMaterialCost || 0,
            packaging_cost: o.packagingCost || 0,
            total_liters: o.totalLiters || 0,
            units_produced: o.unitsProduced || 0,
            status: o.status || 'pending',
            date: o.date || new Date().toISOString(),
            materials: o.materials || [],
            is_multi: o.isMulti || false,
            sub_orders: o.subOrders || []
        }),
        fromRow: r => ({
            id: r.id,
            orderType: r.order_type,
            productId: r.product_id,
            productName: r.product_name,
            quantity: r.quantity,
            cartonCount: r.carton_count,
            skuSize: r.sku_size,
            totalCost: r.total_cost,
            rawMaterialCost: r.raw_material_cost,
            packagingCost: r.packaging_cost,
            totalLiters: r.total_liters,
            unitsProduced: r.units_produced,
            status: r.status,
            date: r.date,
            materials: r.materials || [],
            isMulti: r.is_multi,
            subOrders: r.sub_orders || []
        })
    },

    savedQuotations: {
        table: 'saved_quotations',
        toRow: q => ({
            id: q.id,
            name: q.name,
            date: q.date || '',
            item_count: q.itemCount || 0,
            total_selling: q.totalSelling || 0,
            items: q.items || []
        }),
        fromRow: r => ({
            id: r.id,
            name: r.name,
            date: r.date,
            itemCount: r.item_count,
            totalSelling: r.total_selling,
            items: r.items || []
        })
    },

    units: {
        table: 'units',
        toRow: u => ({ id: u.id, name: u.name }),
        fromRow: r => ({ id: r.id, name: r.name })
    },

    sizeTemplates: {
        table: 'size_templates',
        toRow: t => ({
            id: t.id,
            name: t.name,
            size_liters: t.sizeLiters,
            units_per_carton: t.unitsPerCarton
        }),
        fromRow: r => ({
            id: r.id,
            name: r.name,
            sizeLiters: r.size_liters,
            unitsPerCarton: r.units_per_carton
        })
    },

    notifications: {
        table: 'notifications',
        toRow: n => ({
            id: n.id,
            message: n.message,
            type: n.type || 'info',
            read: n.read || false
        }),
        fromRow: r => ({
            id: r.id,
            message: r.message,
            type: r.type,
            read: r.read,
            date: r.created_at
        })
    },

    activityLog: {
        table: 'activity_log',
        toRow: l => ({
            action: l.action,
            user_name: l.user || 'admin',
            type: l.type || 'info'
        }),
        fromRow: r => ({
            action: r.action,
            user: r.user_name,
            type: r.type,
            timestamp: r.created_at
        }),
        orderBy: 'created_at'
    },

    purchaseOrders: {
        table: 'purchase_orders',
        toRow: o => ({
            id:            o.id,
            order_number:  o.orderNumber || '',
            supplier_id:   o.supplierId  || '',
            supplier_name: o.supplierName || '',
            status:        o.status       || 'draft',
            order_date:    o.orderDate    || new Date().toISOString().split('T')[0],
            expected_date: o.expectedDate || null,
            received_date: o.receivedDate || null,
            items:         o.items        || [],
            subtotal:      o.subtotal     || 0,
            tax_percent:   o.taxPercent   ?? 15,
            tax_amount:    o.taxAmount    || 0,
            total_amount:  o.totalAmount  || 0,
            notes:         o.notes        || '',
            created_by:    o.createdBy    || 'admin'
        }),
        fromRow: r => ({
            id:           r.id,
            orderNumber:  r.order_number,
            supplierId:   r.supplier_id,
            supplierName: r.supplier_name,
            status:       r.status,
            orderDate:    r.order_date,
            expectedDate: r.expected_date,
            receivedDate: r.received_date,
            items:        r.items || [],
            subtotal:     r.subtotal,
            taxPercent:   r.tax_percent,
            taxAmount:    r.tax_amount,
            totalAmount:  r.total_amount,
            notes:        r.notes,
            createdBy:    r.created_by,
            createdAt:    r.created_at
        })
    }
};

// ─── تصدير الـ routers ──────────────────────────────────────
// جميع العمليات (إضافة / تعديل / حذف) تتطلب موافقة الأدمن
// ما عدا الإشعارات وسجل النشاط لأنها بيانات نظام داخلية
module.exports = {
    // ✅ Approval workflow مفعّل لجميع جداول البيانات الرئيسية
    rawMaterialsRouter:    createApprovalCrudRouter(TABLE_MAP.rawMaterials.table,    TABLE_MAP.rawMaterials),
    productsRouter:        createApprovalCrudRouter(TABLE_MAP.products.table,        TABLE_MAP.products),
    suppliersRouter:       createApprovalCrudRouter(TABLE_MAP.suppliers.table,       TABLE_MAP.suppliers),
    recipesRouter:         createApprovalCrudRouter(TABLE_MAP.recipes.table,         TABLE_MAP.recipes),
    productCostingsRouter: createApprovalCrudRouter(TABLE_MAP.productCostings.table, TABLE_MAP.productCostings),
    productionOrdersRouter:createApprovalCrudRouter(TABLE_MAP.productionOrders.table,TABLE_MAP.productionOrders),
    savedQuotationsRouter: createApprovalCrudRouter(TABLE_MAP.savedQuotations.table, TABLE_MAP.savedQuotations),
    unitsRouter:           createApprovalCrudRouter(TABLE_MAP.units.table,           TABLE_MAP.units),
    sizeTemplatesRouter:   createApprovalCrudRouter(TABLE_MAP.sizeTemplates.table,   TABLE_MAP.sizeTemplates),

    // بيانات نظام داخلية — لا تحتاج موافقة
    notificationsRouter:   createCrudRouter(TABLE_MAP.notifications.table,   TABLE_MAP.notifications),
    activityLogRouter:     createCrudRouter(TABLE_MAP.activityLog.table,     TABLE_MAP.activityLog),

    // ✅ أوامر الشراء — مع Approval workflow
    purchaseOrdersRouter:  createApprovalCrudRouter(TABLE_MAP.purchaseOrders.table, TABLE_MAP.purchaseOrders)
};
