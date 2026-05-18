// ============================================================
// 🔐 routes/auth.js — Login / Logout / Session
// ============================================================
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// ─── POST /api/auth/login ────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'يرجى إدخال الإيميل وكلمة المرور' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data?.session) {
            console.warn('Login failed:', error?.message);
            return res.status(401).json({ success: false, error: 'إيميل أو كلمة مرور غير صحيحة' });
        }

        const user = data.user;
        const session = data.session;

        // جلب دور المستخدم
        let userRole = 'user';
        try {
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            if (roleData?.role) userRole = roleData.role;
        } catch {}

        console.log(`✅ Login: ${user.email} → ${userRole}`);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.email,
                role: userRole
            },
            session: {
                access_token:  session.access_token,
                refresh_token: session.refresh_token,
                expires_at:    session.expires_at
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

// ─── POST /api/auth/logout ───────────────────────────────
router.post('/logout', async (req, res) => {
    try {
        await supabase.auth.signOut();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'خطأ في تسجيل الخروج' });
    }
});

// ─── POST /api/auth/refresh ──────────────────────────────
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ success: false, error: 'refresh_token مطلوب' });

        const { data, error } = await supabase.auth.refreshSession({ refresh_token });
        if (error || !data?.session) {
            return res.status(401).json({ success: false, error: 'فشل تجديد الجلسة' });
        }

        res.json({
            success: true,
            session: {
                access_token:  data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at:    data.session.expires_at
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

// ─── GET /api/auth/session ───────────────────────────────
router.get('/session', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ success: false, error: 'Token غير صالح' });

        let userRole = 'user';
        try {
            const { data: roleData } = await supabase
                .from('user_roles').select('role').eq('user_id', user.id).single();
            if (roleData?.role) userRole = roleData.role;
        } catch {}

        res.json({ success: true, user: { id: user.id, email: user.email, role: userRole } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

module.exports = router;
