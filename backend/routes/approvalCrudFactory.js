const express = require('express');
const supabase = require('../supabaseClient');
const authMiddleware = require('../middleware/auth');

const createApprovalCrudRouter = (tableName, tableConfig) => {
    const router = express.Router();

    // GET all
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ success: false, error: error.message });
            res.json({ success: true, data: data.map(tableConfig.fromRow) });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET by id
    router.get('/:id', authMiddleware, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from(tableName).select('*').eq('id', req.params.id).single();
            if (error) return res.status(404).json({ success: false, error: 'غير موجود' });
            res.json({ success: true, data: tableConfig.fromRow(data) });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST create
    router.post('/', authMiddleware, async (req, res) => {
        try {
            const userRole = req.user.role;
            const userId   = req.user.id;
            const userName = req.user.name;
            const rowData  = tableConfig.toRow(req.body);

            if (userRole === 'admin') {
                const { data, error } = await supabase
                    .from(tableName).insert(rowData).select().single();
                if (error) return res.status(500).json({ success: false, error: error.message });
                return res.json({ success: true, data: tableConfig.fromRow(data) });
            }

            // Non-admin → pending request
            const { data: request, error: requestError } = await supabase
                .from('pending_requests')
                .insert({
                    request_type: 'create',
                    table_name:   tableName,
                    old_data:     null,
                    new_data:     rowData,
                    requested_by: userId,
                    requested_by_name: userName,
                    status: 'pending'
                }).select().single();

            if (requestError) return res.status(500).json({ success: false, error: requestError.message });
            return res.json({ success: true, status: 'pending_approval', request });

        } catch (err) {
            console.error('POST error:', tableName, err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // PUT update
    router.put('/:id', authMiddleware, async (req, res) => {
        try {
            const { id }   = req.params;
            const userRole = req.user.role;
            const userId   = req.user.id;
            const userName = req.user.name;

            const { data: currentData, error: fetchError } = await supabase
                .from(tableName).select('*').eq('id', id).single();
            if (fetchError || !currentData)
                return res.status(404).json({ success: false, error: 'غير موجود' });

            const rowData = tableConfig.toRow(req.body);

            if (userRole === 'admin') {
                const { data, error } = await supabase
                    .from(tableName).update(rowData).eq('id', id).select().single();
                if (error) return res.status(500).json({ success: false, error: error.message });
                return res.json({ success: true, data: tableConfig.fromRow(data) });
            }

            // Non-admin → pending request
            const { data: request, error: requestError } = await supabase
                .from('pending_requests')
                .insert({
                    request_type: 'update',
                    table_name:   tableName,
                    record_id:    id,
                    old_data:     currentData,
                    new_data:     rowData,
                    requested_by: userId,
                    requested_by_name: userName,
                    status: 'pending'
                }).select().single();

            if (requestError) return res.status(500).json({ success: false, error: requestError.message });
            return res.json({ success: true, status: 'pending_approval', request });

        } catch (err) {
            console.error('PUT error:', tableName, err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // DELETE
    router.delete('/:id', authMiddleware, async (req, res) => {
        try {
            const { id }   = req.params;
            const userRole = req.user.role;
            const userId   = req.user.id;
            const userName = req.user.name;

            const { data: currentData, error: fetchError } = await supabase
                .from(tableName).select('*').eq('id', id).single();
            if (fetchError || !currentData) {
                console.error('DELETE fetch error:', tableName, id, fetchError?.message);
                return res.status(404).json({ success: false, error: fetchError?.message || 'غير موجود' });
            }

            if (userRole === 'admin') {
                const { error } = await supabase.from(tableName).delete().eq('id', id);
                if (error) {
                    console.error('DELETE error:', tableName, id, error.message);
                    return res.status(500).json({ success: false, error: error.message });
                }
                return res.json({ success: true, message: 'تم الحذف بنجاح' });
            }

            // Non-admin → pending request
            const { data: request, error: requestError } = await supabase
                .from('pending_requests')
                .insert({
                    request_type: 'delete',
                    table_name:   tableName,
                    record_id:    id,
                    old_data:     currentData,
                    new_data:     null,
                    requested_by: userId,
                    requested_by_name: userName,
                    status: 'pending'
                }).select().single();

            if (requestError) return res.status(500).json({ success: false, error: requestError.message });
            return res.json({ success: true, status: 'pending_approval', request });

        } catch (err) {
            console.error('DELETE error:', tableName, err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST bulk
    router.post('/bulk', authMiddleware, async (req, res) => {
        try {
            const { items } = req.body;
            if (!items || !Array.isArray(items))
                return res.status(400).json({ success: false, error: 'items array required' });
            const rows = items.map(tableConfig.toRow);
            const { data, error } = await supabase.from(tableName).insert(rows).select();
            if (error) return res.status(500).json({ success: false, error: error.message });
            res.json({ success: true, data: data.map(tableConfig.fromRow) });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // DELETE clear all (admin only)
    router.delete('/clear/all', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== 'admin')
                return res.status(403).json({ success: false, error: 'غير مصرح' });
            const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) return res.status(500).json({ success: false, error: error.message });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};

module.exports = createApprovalCrudRouter;
