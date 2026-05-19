// ============================================================
// 🏭 routes/approval.js — Approval Workflow Routes
// Industrial ERP - Professional Approval System
// ============================================================
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const authMiddleware = require('../middleware/auth');

// ============================================================
// 1. PENDING REQUESTS ROUTES
// ============================================================

// GET /api/approval/requests - Get all pending requests (Admin: all, User: own)
router.get('/requests', authMiddleware, async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;

        let query = supabase
            .from('pending_requests')
            .select('*')
            .order('created_at', { ascending: false });

        // Non-admin users can only see their own requests
        if (userRole !== 'admin') {
            query = query.eq('requested_by', userId);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Get requests error:', err);
        res.status(500).json({ success: false, error: 'خطأ في جلب الطلبات' });
    }
});

// GET /api/approval/requests/:id - Get single request details
router.get('/requests/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('pending_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        // Check permission
        if (userRole !== 'admin' && data.requested_by !== userId) {
            return res.status(403).json({ success: false, error: 'غير مصرح' });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Get request error:', err);
        res.status(500).json({ success: false, error: 'خطأ في جلب الطلب' });
    }
});

// POST /api/approval/requests - Create a new pending request
router.post('/requests', authMiddleware, async (req, res) => {
    try {
        const { request_type, table_name, record_id, old_data, new_data, priority, change_reason } = req.body;
        const userId = req.user.id;
        const userName = req.user.name;

        // Validate required fields
        if (!request_type || !table_name || !new_data) {
            return res.status(400).json({ 
                success: false, 
                error: 'request_type, table_name, and new_data are required' 
            });
        }

        // Validate request_type
        if (!['create', 'update', 'delete', 'reset_all'].includes(request_type)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid request_type. Must be create, update, or delete' 
            });
        }

        // Calculate impact analysis for recipe changes
        let impactAnalysis = null;
        if (table_name === 'recipes' && request_type === 'update') {
            const { data: impactData } = await supabase.rpc('calculate_recipe_cost_impact', {
                old_recipe: old_data,
                new_recipe: new_data
            });
            impactAnalysis = impactData;
        }

        // Create pending request
        const { data, error } = await supabase
            .from('pending_requests')
            .insert({
                request_type,
                table_name,
                record_id,
                old_data,
                new_data,
                requested_by: userId,
                requested_by_name: userName,
                status: 'pending',
                priority: priority || 'normal',
                impact_analysis: impactAnalysis
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }


        res.json({ success: true, data });
    } catch (err) {
        console.error('Create request error:', err);
        res.status(500).json({ success: false, error: 'خطأ في إنشاء الطلب' });
    }
});

// PUT /api/approval/requests/:id/approve - Approve a request (Admin only)
router.put('/requests/:id/approve', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        const userName = req.user.name;

        // Check if user is admin
        if (userRole !== 'admin') {
            return res.status(403).json({ success: false, error: 'غير مصرح - فقط المسؤول يمكنه الموافقة' });
        }

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('pending_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !request) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: 'تمت معالجة هذا الطلب بالفعل' 
            });
        }

        // Apply the change based on request type
        let applyResult;
        const tableMap = {
            'raw_materials':      'raw_materials',
            'products':           'products',
            'recipes':            'recipes',
            'product_costings':   'product_costings',
            'suppliers':          'suppliers',
            'production_orders':  'production_orders',
            'saved_quotations':   'saved_quotations',
            'units':              'units',
            'size_templates':     'size_templates',
            'purchase_orders':    'purchase_orders',
            'customers':          'customers',
            'sales_orders':       'sales_orders',
            'notifications':      'notifications',
            'activity_log':       'activity_log'
        };

        // ─── معالجة reset_all بشكل مستقل ──────────────────────
        if (request.request_type === 'reset_all') {
            const tables = [
                'raw_materials', 'products', 'suppliers', 'recipes',
                'product_costings', 'production_orders', 'saved_quotations',
                'activity_log', 'notifications', 'units', 'size_templates',
                'purchase_orders', 'customers', 'sales_orders'
            ];
            await Promise.all(tables.map(t =>
                supabase.from(t).delete().neq('id', '____nonexistent____')
                    .then(({ error }) => { if (error) console.warn('Clear table error:', t, error); })
            ));
            // تحديث حالة الطلب إلى موافق عليه
            await supabase.from('pending_requests').update({
                status: 'approved',
                reviewed_by: userId,
                reviewed_by_name: userName,
                reviewed_at: new Date().toISOString()
            }).eq('id', id);
            return res.json({ success: true, message: 'تمت الموافقة على إعادة التعيين وتطبيقها بنجاح' });
        }

        const tableName = tableMap[request.table_name];
        if (!tableName) {
            console.error('Unknown table_name:', request.table_name);
            return res.status(400).json({ 
                success: false, 
                error: `اسم الجدول غير مدعوم: ${request.table_name}` 
            });
        }

        // الـ new_data محفوظ كـ snake_case من approvalCrudFactory مباشرة
        switch (request.request_type) {
            case 'create':
                applyResult = await supabase
                    .from(tableName)
                    .insert(request.new_data)
                    .select()
                    .single();
                break;

            case 'update':
                applyResult = await supabase
                    .from(tableName)
                    .update(request.new_data)
                    .eq('id', request.record_id)
                    .select()
                    .single();
                break;

            case 'delete':
                applyResult = await supabase
                    .from(tableName)
                    .delete()
                    .eq('id', request.record_id);
                applyResult = applyResult.error ? applyResult : { error: null };
                break;
        }

        if (applyResult.error) {
            return res.status(500).json({ 
                success: false, 
                error: 'فشل تطبيق التغيير: ' + applyResult.error.message 
            });
        }

                // Create recipe version (skip if recipe_versions table doesn't exist)
        if (request.table_name === 'recipes' && request.request_type === 'update') {
            try {
                const { data: oldRecipe } = await supabase.from('recipes').select('*').eq('id', request.record_id).single();
                if (oldRecipe) {
                    const { data: vData } = await supabase.from('recipe_versions').select('version_number').eq('recipe_id', request.record_id).order('version_number', { ascending: false }).limit(1);
                    await supabase.from('recipe_versions').insert({ recipe_id: request.record_id, version_number: (vData?.[0]?.version_number || 0) + 1, product_id: oldRecipe.product_id, is_active: false });
                }
            } catch(e) { console.warn('recipe_versions skipped:', e.message); }
        }

        // Update request status
        const { data: updatedRequest, error: updateError } = await supabase
            .from('pending_requests')
            .update({
                status: 'approved',
                reviewed_by: userId,
                reviewed_by_name: userName,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ success: false, error: updateError.message });
        }

        // Create approval record (skip if approvals table doesn't exist)
        try {
            await supabase.from('approvals').insert({
                request_id: id, approved_by: userId, approved_by_name: userName, approval_level: 1
            });
        } catch(e) { console.warn('approvals table skipped:', e.message); }

        return res.json({ success: true, message: 'تمت الموافقة بنجاح' });

    } catch (err) {
        console.error('Approve error:', err);
        return res.status(500).json({ success: false, error: 'خطأ في الموافقة: ' + err.message });
    }
});

// PUT /api/approval/requests/:id/reject
router.put('/requests/:id/reject', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.role !== 'admin')
            return res.status(403).json({ success: false, error: 'غير مصرح' });

        const { data: request, error: fetchError } = await supabase
            .from('pending_requests').select('*').eq('id', id).single();
        if (fetchError || !request)
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        if (request.status !== 'pending')
            return res.status(400).json({ success: false, error: 'تمت معالجة هذا الطلب بالفعل' });

        const { error } = await supabase.from('pending_requests')
            .update({ status: 'rejected', reviewed_by: req.user.id, reviewed_by_name: req.user.name, reviewed_at: new Date().toISOString() })
            .eq('id', id);
        if (error) return res.status(500).json({ success: false, error: error.message });

        return res.json({ success: true, message: 'تم رفض الطلب' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/approval/requests/approve-all
router.put('/requests/approve-all', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin')
            return res.status(403).json({ success: false, error: 'غير مصرح' });

        const { data: requests, error: fetchError } = await supabase
            .from('pending_requests').select('*').eq('status', 'pending');
        if (fetchError) return res.status(500).json({ success: false, error: fetchError.message });
        if (!requests || requests.length === 0)
            return res.json({ success: true, approved: 0, message: 'لا توجد طلبات معلقة' });

        const tableMap = {
            'raw_materials': 'raw_materials', 'products': 'products',
            'recipes': 'recipes', 'product_costings': 'product_costings',
            'suppliers': 'suppliers', 'production_orders': 'production_orders',
            'saved_quotations': 'saved_quotations', 'units': 'units',
            'size_templates': 'size_templates'
        };

        let approved = 0, failed = 0;
        for (const request of requests) {
            try {
                const tableName = tableMap[request.table_name];
                if (!tableName) { failed++; continue; }

                let result;
                if (request.request_type === 'create')
                    result = await supabase.from(tableName).insert(request.new_data);
                else if (request.request_type === 'update')
                    result = await supabase.from(tableName).update(request.new_data).eq('id', request.record_id);
                else if (request.request_type === 'delete')
                    result = await supabase.from(tableName).delete().eq('id', request.record_id);

                if (result?.error) { failed++; continue; }

                await supabase.from('pending_requests').update({
                    status: 'approved', reviewed_by: req.user.id,
                    reviewed_by_name: req.user.name, reviewed_at: new Date().toISOString()
                }).eq('id', request.id);
                approved++;
            } catch(e) { failed++; }
        }
        res.json({ success: true, approved, failed, total: requests.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/approval/user-roles - قائمة المستخدمين وأدوارهم
router.get('/user-roles', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin')
            return res.status(403).json({ success: false, error: 'غير مصرح' });

        const { data: roles, error } = await supabase
            .from('user_roles').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ success: false, error: error.message });

        // جلب emails من auth.users
        let emailMap = {};
        try {
            const { data: usersData } = await supabase.auth.admin.listUsers();
            if (usersData?.users)
                usersData.users.forEach(u => { emailMap[u.id] = u.email; });
        } catch(e) {}

        const data = (roles || []).map(r => ({ ...r, email: emailMap[r.user_id] || null }));
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/approval/user-roles/:userId - تغيير دور مستخدم
router.put('/user-roles/:userId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin')
            return res.status(403).json({ success: false, error: 'غير مصرح' });

        const { userId } = req.params;
        const { role } = req.body;
        if (!['admin', 'user'].includes(role))
            return res.status(400).json({ success: false, error: 'دور غير صحيح' });

        const { error } = await supabase.from('user_roles')
            .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
        if (error) return res.status(500).json({ success: false, error: error.message });

        res.json({ success: true, message: 'تم تحديث الدور' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
