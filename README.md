# 🏭 Industrial ERP — Full Stack Architecture

## 📁 هيكل المشروع

```
erp-project/
├── frontend/
│   ├── index.html          ← الواجهة الأمامية (معدّلة - بدون مفاتيح Supabase)
│   └── api.js              ← طبقة التواصل مع Backend (يستبدل Supabase مباشرة)
│
└── backend/
    ├── server.js           ← نقطة الدخول الرئيسية
    ├── supabaseClient.js   ← Service Role Client (سري - Backend فقط)
    ├── package.json
    ├── .env.example        ← نموذج متغيرات البيئة
    ├── middleware/
    │   └── auth.js         ← التحقق من JWT Token
    └── routes/
        ├── auth.js         ← login / logout / session / refresh
        ├── crudFactory.js  ← مصنع GET/POST/PUT/DELETE لكل جدول
        └── data.js         ← تعريف جميع الـ routes (11 جدول)
```

## 🚀 التشغيل

### Backend
```bash
cd backend
cp .env.example .env
# عدّل .env وأضف بياناتك
npm install
npm run dev
```

### Frontend
افتح `frontend/index.html` في المتصفح، أو استخدم:
```bash
npx serve frontend
```

## 🔐 متغيرات البيئة (.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # من Supabase Dashboard → Settings → API
PORT=3001
FRONTEND_URL=http://localhost:5500
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## 📡 API Routes

| Method | Route | الوظيفة |
|--------|-------|---------|
| POST | /api/auth/login | تسجيل الدخول |
| POST | /api/auth/logout | تسجيل الخروج |
| GET | /api/auth/session | التحقق من الجلسة |
| POST | /api/auth/refresh | تجديد الـ Token |
| GET | /api/data/all | جلب كل البيانات دفعة واحدة |
| DELETE | /api/data/reset | مسح كل البيانات |
| GET/POST/PUT/DELETE | /api/raw-materials | المواد الخام |
| GET/POST/PUT/DELETE | /api/products | المنتجات |
| GET/POST/PUT/DELETE | /api/suppliers | الموردين |
| GET/POST/PUT/DELETE | /api/recipes | التركيبات |
| GET/POST/PUT/DELETE | /api/product-costings | تكاليف المنتجات |
| GET/POST/PUT/DELETE | /api/production-orders | أوامر الإنتاج |
| GET/POST/PUT/DELETE | /api/saved-quotations | عروض الأسعار |
| GET/POST/PUT/DELETE | /api/units | الوحدات |
| GET/POST/PUT/DELETE | /api/size-templates | قوالب الأحجام |
| GET/POST/PUT/DELETE | /api/notifications | الإشعارات |
| GET/POST/PUT/DELETE | /api/activity-log | سجل النشاط |

كل route يدعم أيضاً:
- `POST /api/{route}/bulk` — حفظ مجموعة (upsert)
- `DELETE /api/{route}/clear/all` — مسح الجدول

## 🔄 ما تغيّر في الكود

| قديم (Frontend مباشر) | جديد (عبر Backend) |
|----------------------|-------------------|
| `supabase.createClient(URL, KEY)` | `AuthAPI` + `DataAPI` في `api.js` |
| `supabase.auth.signInWithPassword(...)` | `AuthAPI.login(email, password)` |
| `supabase.auth.getSession()` | `AuthAPI.getSession()` |
| `supabase.auth.signOut()` | `AuthAPI.logout()` |
| `supabase.from(table).select(*)` | `DataAPI.rawMaterials.getAll()` |
| `supabase.from(table).upsert(data)` | `DataAPI.rawMaterials.bulkSave(items)` |
| `supabase.from(table).delete()` | `DataAPI.rawMaterials.remove(id)` |
| `SUPABASE_ANON_KEY` في Frontend | ❌ مُزال نهائياً |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ في Backend `.env` فقط |

## 🛡️ الأمان

- ✅ **لا مفاتيح Supabase في Frontend**
- ✅ **SUPABASE_SERVICE_ROLE_KEY في Backend فقط**
- ✅ **JWT Authentication على كل route**
- ✅ **Rate Limiting** على جميع الطلبات
- ✅ **CORS** مُقيّد بـ Frontend URL فقط
- ✅ **Token في الذاكرة** — لا localStorage
