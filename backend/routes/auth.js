// ============================================================
// 🔐 middleware/auth.js — التحقق من JWT Token
// يتحقق من صحة الـ token المرسل مع كل طلب
// ============================================================
const supabase = require('../supabaseClient');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'غير مصرح — يرجى تسجيل الدخول أولاً'
            });
        }

        const token = authHeader.split(' ')[1];

        // التحقق من الـ token عبر Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                error: 'Token غير صالح أو منتهي الصلاحية'
            });
        }

        // جلب دور المستخدم من جدول user_roles
        let userRole = 'user'; // Default role
        try {
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            if (roleData?.role) {
                userRole = roleData.role;
                console.log(`✅ User ${user.email} → role: ${userRole}`);
            } else {
                console.warn(`⚠️ No role found for ${user.email}, error: ${roleError?.message}, defaulting to user`);
            }
        } catch (roleError) {
            console.warn('User role fetch failed:', roleError.message);
        }

        // إضافة بيانات المستخدم للـ request
        req.user = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            role: userRole
        };

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({
            success: false,
            error: 'خطأ في التحقق من الهوية'
        });
    }
};

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'غير مصرح - هذا الإجراء يتطلب صلاحية المسؤول'
        });
    }
    next();
};

// Middleware to check if user can modify data (admin or chemical_engineer)
const canModify = (req, res, next) => {
    if (!['admin', 'chemical_engineer'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: 'غير مصرح - هذا الإجراء يتطلب صلاحية التعديل'
        });
    }
    next();
};

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
module.exports.canModify = canModify;
