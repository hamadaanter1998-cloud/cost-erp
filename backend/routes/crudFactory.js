// ============================================================
// 🏭 routes/crudFactory.js — مصنع Routes العامة
// يُنشئ GET / POST / PUT / DELETE لأي جدول
// ============================================================
const express = require('express');
const supabase = require('../supabaseClient');
const authMiddleware = require('../middleware/auth');

/**
 * إنشاء router كامل لجدول معين
 * @param {string} tableName - اسم الجدول في Supabase
 * @param {Object} options - خيارات إضافية
 * @param {Function} options.toRow - تحويل بيانات Frontend → DB
 * @param {Function} options.fromRow - تحويل DB → Frontend
 * @param {string} options.orderBy - عمود الترتيب (افتراضي: created_at)
 */
function createCrudRouter(tableName, options = {}) {
    const router = express.Router();

    const {
        toRow = (item) => item,
        fromRow = (row) => row,
        orderBy = 'created_at'
    } = options;

    // ─── GET / — جلب كل السجلات ───────────────────────────
    // مثال: GET /api/raw-materials
    router.get('/', authMiddleware, async (req, res) => {
        try {
            let query = supabase.from(tableName).select('*');

            // دعم الفلترة عبر query params مثل ?name=test
            const { page, limit, search, ...filters } = req.query;

            // Pagination اختياري
            if (page && limit) {
                const from = (parseInt(page) - 1) * parseInt(limit);
                const to = from + parseInt(limit) - 1;
                query = query.range(from, to);
            }

            // ترتيب
            if (orderBy) {
                query = query.order(orderBy, { ascending: true });
            }

            const { data, error, count } = await query;

            if (error) {
                console.error(`GET ${tableName} error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

            res.json({
                success: true,
                data: data.map(row => fromRow(row)),
                count: data.length
            });

        } catch (err) {
            console.error(`GET ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في جلب البيانات' });
        }
    });

    // ─── GET /:id — جلب سجل واحد ──────────────────────────
    // مثال: GET /api/raw-materials/RM0001
    router.get('/:id', authMiddleware, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', req.params.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({
                        success: false,
                        error: 'السجل غير موجود'
                    });
                }
                return res.status(500).json({ success: false, error: error.message });
            }

            res.json({ success: true, data: fromRow(data) });

        } catch (err) {
            console.error(`GET /:id ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في جلب السجل' });
        }
    });

    // ─── POST / — إضافة سجل جديد ─────────────────────────
    // مثال: POST /api/raw-materials  body: { ...materialData }
    router.post('/', authMiddleware, async (req, res) => {
        try {
            const rowData = toRow(req.body);

            if (!rowData.id) {
                return res.status(400).json({
                    success: false,
                    error: 'حقل id مطلوب'
                });
            }

            const { data, error } = await supabase
                .from(tableName)
                .insert([rowData])
                .select()
                .single();

            if (error) {
                console.error(`POST ${tableName} error:`, error);
                // خطأ تكرار المفتاح
                if (error.code === '23505') {
                    return res.status(409).json({
                        success: false,
                        error: 'هذا السجل موجود بالفعل'
                    });
                }
                return res.status(500).json({ success: false, error: error.message });
            }

            res.status(201).json({ success: true, data: fromRow(data) });

        } catch (err) {
            console.error(`POST ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في إضافة السجل' });
        }
    });

    // ─── PUT /:id — تعديل سجل موجود ──────────────────────
    // مثال: PUT /api/raw-materials/RM0001  body: { ...updatedData }
    router.put('/:id', authMiddleware, async (req, res) => {
        try {
            const rowData = toRow(req.body);

            // إزالة created_at لعدم الكتابة فوقه
            delete rowData.created_at;

            const { data, error } = await supabase
                .from(tableName)
                .update(rowData)
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) {
                console.error(`PUT ${tableName} error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'السجل غير موجود'
                });
            }

            res.json({ success: true, data: fromRow(data) });

        } catch (err) {
            console.error(`PUT ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في تعديل السجل' });
        }
    });

    // ─── DELETE /:id — حذف سجل ────────────────────────────
    // مثال: DELETE /api/raw-materials/RM0001
    router.delete('/:id', authMiddleware, async (req, res) => {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', req.params.id);

            if (error) {
                console.error(`DELETE ${tableName} error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

            res.json({ success: true, message: 'تم الحذف بنجاح' });

        } catch (err) {
            console.error(`DELETE ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في الحذف' });
        }
    });

    // ─── POST /bulk — حفظ مجموعة (upsert كامل) ───────────
    // الاستخدام: عند حفظ كل البيانات دفعة واحدة كما كان في الكود الأصلي
    // مثال: POST /api/raw-materials/bulk  body: { items: [...] }
    router.post('/bulk', authMiddleware, async (req, res) => {
        try {
            const items = req.body.items;

            if (!Array.isArray(items)) {
                return res.status(400).json({
                    success: false,
                    error: 'items يجب أن يكون array'
                });
            }

            const rowsData = items.map(item => toRow(item));

            const { data, error } = await supabase
                .from(tableName)
                .upsert(rowsData, { onConflict: 'id' })
                .select();

            if (error) {
                console.error(`BULK ${tableName} error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

            res.json({
                success: true,
                data: data.map(row => fromRow(row)),
                count: data.length
            });

        } catch (err) {
            console.error(`BULK ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في الحفظ الجماعي' });
        }
    });

    // ─── DELETE /clear — مسح كل الجدول ───────────────────
    // الاستخدام: resetAllData
    router.delete('/clear/all', authMiddleware, async (req, res) => {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .neq('id', '____nonexistent____');

            if (error) {
                return res.status(500).json({ success: false, error: error.message });
            }

            res.json({ success: true, message: `تم مسح جدول ${tableName} بالكامل` });

        } catch (err) {
            console.error(`CLEAR ${tableName} exception:`, err);
            res.status(500).json({ success: false, error: 'خطأ في المسح' });
        }
    });

    return router;
}

module.exports = createCrudRouter;
