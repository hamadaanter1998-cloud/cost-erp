const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجودة في .env');
    process.exit(1);
}

// إنشاء الـ Client ببساطة وبشكل مباشر للـ Backend
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false, // لا نحتاجه في السيرفر
        persistSession: false    // لا يوجد LocalStorage في السيرفر
    },
    global: {
        // الـ SDK لوحده هيضيف الـ Service Role في الـ Headers طالما بعته كـ Key ثانٍ
        headers: { 'x-my-custom-header': 'industrial-erp-api' } 
    }
});

console.log('✅ Supabase Admin Client initialized successfully');

module.exports = supabase;