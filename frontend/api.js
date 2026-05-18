// ============================================================
// 🌐 api.js — Frontend API Client
// يستبدل جميع استدعاءات Supabase المباشرة بـ fetch إلى Backend
// ملاحظة: لا يحتوي على أي مفاتيح Supabase!
// ============================================================

const API_BASE = 'https://cost-erp.onrender.com/api'; // ← Backend اونلاين

// ─── Token Management (memory-first, storage optional) ────
// بعض المتصفحات (Edge/Safari) تمنع sessionStorage بسبب Tracking Prevention
// نختبر التخزين مرة واحدة فقط — إذا محجوب نعتمد على memory كلياً
const TokenManager = (() => {
    let _access  = null;
    let _refresh = null;

    // اختبر مرة واحدة إن كان sessionStorage متاح
    let _storageOK = false;
    try {
        sessionStorage.setItem('__erp_test__', '1');
        sessionStorage.removeItem('__erp_test__');
        _storageOK = true;
    } catch {}

    function _ssGet(k) {
        if (!_storageOK) return null;
        try { return sessionStorage.getItem(k); } catch { return null; }
    }
    function _ssSet(k, v) {
        if (!_storageOK) return;
        try { sessionStorage.setItem(k, v); } catch {}
    }
    function _ssDel(k) {
        if (!_storageOK) return;
        try { sessionStorage.removeItem(k); } catch {}
    }

    return {
        set(accessToken, refreshToken) {
            _access  = accessToken;
            _refresh = refreshToken;
            _ssSet('erp_access_token',  accessToken);
            _ssSet('erp_refresh_token', refreshToken);
        },
        getAccess() {
            return _access || _ssGet('erp_access_token');
        },
        getRefresh() {
            return _refresh || _ssGet('erp_refresh_token');
        },
        clear() {
            _access  = null;
            _refresh = null;
            _ssDel('erp_access_token');
            _ssDel('erp_refresh_token');
            try { localStorage.removeItem('erp_access_token');  } catch {}
            try { localStorage.removeItem('erp_refresh_token'); } catch {}
        },
        isValid() {
            return !!(_access || _ssGet('erp_access_token'));
        }
    };
})();

// ─── Request Helper ────────────────────────────────────────
async function apiRequest(method, path, body = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };

    if (TokenManager.isValid()) {
        headers['Authorization'] = `Bearer ${TokenManager.getAccess()}`;
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_BASE}${path}`, options);
        const data = await response.json();

        // Token منتهي → نجدده تلقائياً
        if (response.status === 401 && retry && TokenManager.getRefresh()) {
            const refreshed = await AuthAPI.refresh();
            if (refreshed) {
                return apiRequest(method, path, body, false);
            } else {
                TokenManager.clear();
                window.location.reload();
                return null;
            }
        }

        return data;

    } catch (err) {
        console.error(`API ${method} ${path} failed:`, err);
        return { success: false, error: 'تعذر الاتصال بالسيرفر' };
    }
}

// ─── Shorthand Methods ─────────────────────────────────────
const api = {
    get:    (path)         => apiRequest('GET',    path),
    post:   (path, body)   => apiRequest('POST',   path, body),
    put:    (path, body)   => apiRequest('PUT',    path, body),
    delete: (path)         => apiRequest('DELETE', path),
};

// ============================================================
// 🔐 AUTH API
// ============================================================
const AuthAPI = {

    async login(email, password) {
        const result = await api.post('/auth/login', { email, password });
        if (result?.success) {
            const accessToken  = result.session?.access_token  || result.token;
            const refreshToken = result.session?.refresh_token || result.refresh_token;
            TokenManager.set(accessToken, refreshToken);
        }
        return result;
    },

    async logout() {
        const result = await api.post('/auth/logout');
        TokenManager.clear();
        return result;
    },

    async getSession() {
        if (!TokenManager.isValid()) {
            return { success: false, user: null };
        }
        return await api.get('/auth/session');
    },

    async refresh() {
        const refreshToken = TokenManager.getRefresh();
        if (!refreshToken) return false;

        const result = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        }).then(r => r.json()).catch(() => null);

        if (result?.success) {
            const accessToken  = result.session?.access_token  || result.token;
            const refreshToken2 = result.session?.refresh_token || result.refresh_token;
            TokenManager.set(accessToken, refreshToken2);
            return true;
        }
        return false;
    }
};

// ============================================================
// 📊 DATA API
// ============================================================

function createDataAPI(route) {
    return {
        getAll() {
            return api.get(`/${route}`);
        },
        getById(id) {
            return api.get(`/${route}/${id}`);
        },
        create(item) {
            return api.post(`/${route}`, item);
        },
        update(id, item) {
            return api.put(`/${route}/${id}`, item);
        },
        remove(id) {
            return api.delete(`/${route}/${id}`);
        },
        bulkSave(items) {
            return api.post(`/${route}/bulk`, { items });
        },
        clearAll() {
            return api.delete(`/${route}/clear/all`);
        }
    };
}

const DataAPI = {
    rawMaterials:     createDataAPI('raw-materials'),
    products:         createDataAPI('products'),
    suppliers:        createDataAPI('suppliers'),
    recipes:          createDataAPI('recipes'),
    productCostings:  createDataAPI('product-costings'),
    productionOrders: createDataAPI('production-orders'),
    savedQuotations:  createDataAPI('saved-quotations'),
    units:            createDataAPI('units'),
    sizeTemplates:    createDataAPI('size-templates'),
    notifications:    createDataAPI('notifications'),
    activityLog:      createDataAPI('activity-log'),
    purchaseOrders:   createDataAPI('purchase-orders'),

    loadAll() {
        return api.get('/data/all');
    },

    resetAll() {
        return api.delete('/data/reset');
    }
};

// ============================================================
// 🔄 StorageManager API Bridge
// ============================================================

// ─── الجداول التي تستخدم نظام الموافقات ─────────────────────
// هذه الجداول عند المستخدم العادي ترجع status: 'pending_approval'
// بدلاً من التطبيق الفوري
const APPROVAL_TABLES = ['rawMaterials', 'products', 'suppliers', 'recipes', 'productCostings', 'productionOrders', 'savedQuotations', 'units', 'sizeTemplates'];

// ─── معالجة رد pending_approval ────────────────────────────
// يُستدعى تلقائياً من _syncToAPI عند اكتشاف طلب موافقة
function handleApprovalResponse(key, result) {
    if (result?.status === 'pending_approval') {
        // ارجع الـ cache للحالة القديمة (قبل التعديل المحلي)
        // لأن التغيير لم يُطبَّق — هو في انتظار موافقة المالك
        console.info(`[Approval] طلب ${key} أُرسل للمراجعة — request_id: ${result.request_id}`);

        // أطلق event عالمي لأي مكان في التطبيق يريد التفاعل
        window.dispatchEvent(new CustomEvent('approval:pending', {
            detail: {
                key,
                request_id: result.request_id,
                message: result.message
            }
        }));

        return true; // نعم، هذا طلب موافقة
    }
    return false; // لا، تم التطبيق مباشرة (أدمن)
}

// ─── استمع لـ approval:pending وأظهر toast للمستخدم ────────
window.addEventListener('approval:pending', (e) => {
    const msg = e.detail?.message || 'تم إرسال طلبك للمراجعة — في انتظار موافقة المسؤول';
    // نستخدم Toastify مباشرة (متاح عالمياً في الصفحة)
    if (typeof Toastify === 'function') {
        Toastify({
            text: '🕐 ' + msg,
            duration: 5000,
            gravity: 'top',
            position: 'center',
            style: { background: '#f0ad4e', color: '#000', fontWeight: 'bold', fontSize: '15px' }
        }).showToast();
    } else {
        // fallback لو Toastify مش محمّل بعد
        setTimeout(() => {
            if (typeof Toastify === 'function') {
                Toastify({
                    text: '🕐 ' + msg,
                    duration: 5000,
                    gravity: 'top',
                    position: 'center',
                    style: { background: '#f0ad4e', color: '#000', fontWeight: 'bold', fontSize: '15px' }
                }).showToast();
            }
        }, 500);
    }
});

class StorageManagerAPI {
    constructor() {
        this.prefix = 'erp_';
        this._cache = {};
        this._previousCache = {}; // نسخة احتياطية قبل كل تعديل
        this._ready = false;
        this._supabase = null;

        this.auth = AuthAPI;
        this.data = DataAPI;
    }

    async init() {
        // ⚠️ _ready يُفعَّل بعد تحميل البيانات لا قبلها
        // لو فُعِّل قبلها، أي set() أثناء التحميل سيرسل بيانات فارغة للـ API
        await this.loadAllFromSupabase();
        this._ready = true;
    }

    // ─── storage helper: فحص مرة واحدة فقط ─────────────────
    // Tracking Prevention في Edge/Safari يمنع الوصول للـ storage
    // نفحص مرة واحدة عند أول استخدام ونتجنب الـ errors المتكررة
    _getStorageAvailability() {
        if (this._ssOK !== undefined) return; // فحصنا قبل كده
        this._ssOK = false;
        this._lsOK = false;
        try { sessionStorage.setItem('__erp__', '1'); sessionStorage.removeItem('__erp__'); this._ssOK = true; } catch {}
        try { localStorage.setItem('__erp__', '1');   localStorage.removeItem('__erp__');   this._lsOK = true; } catch {}
    }
    _storageGet(k) {
        this._getStorageAvailability();
        if (this._ssOK) { try { const d = sessionStorage.getItem(k); if (d) return JSON.parse(d); } catch {} }
        if (this._lsOK) { try { const d = localStorage.getItem(k);   if (d) return JSON.parse(d); } catch {} }
        return null;
    }
    _storageSet(k, v) {
        this._getStorageAvailability();
        if (this._ssOK) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
        if (this._lsOK) { try { localStorage.setItem(k, JSON.stringify(v));   } catch {} }
    }
    _storageDel(k) {
        this._getStorageAvailability();
        if (this._ssOK) { try { sessionStorage.removeItem(k); } catch {} }
        if (this._lsOK) { try { localStorage.removeItem(k);   } catch {} }
    }

    get(key) {
        const LOCAL_ONLY = ['darkMode', 'currentUser', 'initialized'];
        if (LOCAL_ONLY.includes(key)) {
            return this._storageGet(this.prefix + key);
        }
        if (this._cache[key] !== undefined && this._cache[key] !== null) {
            // ✅ نرجع نسخة عميقة عشان الـ index.html لما يعمل push/filter
            // ما يعدّلش الـ _cache مباشرة ويخلي _previousCache و _cache متطابقين
            return JSON.parse(JSON.stringify(this._cache[key]));
        }
        const LOCAL_FALLBACK = ['units', 'sizeTemplates'];
        if (LOCAL_FALLBACK.includes(key)) {
            return this._storageGet(this.prefix + key);
        }
        return null;
    }

    set(key, value) {
        const LOCAL_ONLY = ['darkMode', 'currentUser', 'initialized'];
        if (LOCAL_ONLY.includes(key)) {
            this._storageSet(this.prefix + key, value);
            if (key === 'currentUser') {
                window.currentUser = value;
                if (typeof checkAdminAndShow === 'function') checkAdminAndShow();
            }
            return true;
        }
        // فقط حدّث الـ cache المحلي — التزامن يتم عبر crud() مباشرة
        this._cache[key] = value;
        return true;
    }

    // ─── crud() — التزامن المباشر مع API ──────────────────
    // استخدمه بدل storage.set() لأي عملية إضافة/تعديل/حذف
    // action: 'create' | 'update' | 'delete'
    // item: الكائن كامل (للإضافة والتعديل) أو { id } (للحذف)
    async crud(key, action, item) {
        const apiMap = {
            rawMaterials:     DataAPI.rawMaterials,
            products:         DataAPI.products,
            suppliers:        DataAPI.suppliers,
            recipes:          DataAPI.recipes,
            productCostings:  DataAPI.productCostings,
            productionOrders: DataAPI.productionOrders,
            savedQuotations:  DataAPI.savedQuotations,
            units:            DataAPI.units,
            sizeTemplates:    DataAPI.sizeTemplates,
            notifications:    DataAPI.notifications,
            activityLog:      DataAPI.activityLog,
            purchaseOrders:   DataAPI.purchaseOrders
        };
        if (!apiMap[key]) return { success: false, error: 'unknown key' };

        let r;
        if (action === 'create') {
            const body = this._isUUID(item.id) ? item : (({ id, ...rest }) => rest)(item);
            r = await apiMap[key].create(body);
        } else if (action === 'update') {
            r = await apiMap[key].update(item.id, item);
        } else if (action === 'delete') {
            r = await apiMap[key].remove(item.id);
        }

        if (r?.status === 'pending_approval') {
            await this.loadAllFromSupabase();
            window.dispatchEvent(new CustomEvent('approval:pending', {
                detail: { message: 'تم إرسال طلبك للأدمن — سيُطبَّق بعد الموافقة ✅' }
            }));
            return { success: true, pending: true };
        }

        if (r?.success) {
            // تحديث الـ cache محلياً فقط — بدون reload كامل من السيرفر
            if (!this._cache) this._cache = {};
            if (!this._cache[key]) this._cache[key] = [];
            if (action === 'create') {
                this._cache[key].push(r.data || item);
            } else if (action === 'update') {
                const idx = this._cache[key].findIndex(x => x.id === item.id);
                if (idx !== -1) this._cache[key][idx] = r.data || item;
                else this._cache[key].push(r.data || item);
            } else if (action === 'delete') {
                this._cache[key] = this._cache[key].filter(x => x.id !== item.id);
            }
            return { success: true, pending: false };
        }

        // فشل — أظهر الـ error
        const errMsg = r?.error || 'فشل الاتصال بالسيرفر';
        console.error('[crud] failed:', key, action, errMsg);
        if (typeof Toastify === 'function') {
            Toastify({
                text: '❌ ' + errMsg,
                duration: 4000, gravity: 'top', position: 'center',
                style: { background: '#dc3545', color: '#fff', fontWeight: 'bold' }
            }).showToast();
        }
        return { success: false, error: errMsg };
    }
    remove(key) {
        delete this._cache[key];
        this._storageDel(this.prefix + key);
    }

    // ─── UUID validator ─────────────────────────────────────
    _isUUID(id) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    }

    // ─── تحقق إن البيانات اتغيرت فعلاً عن الـ previousCache ──
    _hasChanged(key, newValue) {
        const prev = this._previousCache[key];
        if (!prev) return true; // مافيش قديم = جديد

        const prevIds  = new Set((Array.isArray(prev)     ? prev     : [prev]).map(i => i.id));
        const newIds   = new Set((Array.isArray(newValue) ? newValue : [newValue]).map(i => i.id));

        // لو في عنصر جديد UUID صحيح = تغيير حقيقي
        for (const id of newIds) {
            if (!prevIds.has(id) && this._isUUID(id)) return true;
        }
        // لو في عنصر محذوف = تغيير حقيقي
        for (const id of prevIds) {
            if (!newIds.has(id)) return true;
        }
        // لو المحتوى اتغير
        return JSON.stringify(newValue) !== JSON.stringify(prev);
    }

    // ─── المزامنة مع الـ API ────────────────────────────────
    async _syncToAPI(key, value, snapshot = []) {
        const apiMap = {
            rawMaterials:     DataAPI.rawMaterials,
            products:         DataAPI.products,
            suppliers:        DataAPI.suppliers,
            recipes:          DataAPI.recipes,
            productCostings:  DataAPI.productCostings,
            productionOrders: DataAPI.productionOrders,
            savedQuotations:  DataAPI.savedQuotations,
            units:            DataAPI.units,
            sizeTemplates:    DataAPI.sizeTemplates,
            notifications:    DataAPI.notifications,
            activityLog:      DataAPI.activityLog,
            purchaseOrders:   DataAPI.purchaseOrders
        };

        if (!apiMap[key]) return;

        try {
            const oldItems = Array.isArray(snapshot) ? snapshot : [];
            const newItems = Array.isArray(value) ? value : [];

            const oldMap = new Map(oldItems.map(i => [i.id, i]));
            const newMap = new Map(newItems.map(i => [i.id, i]));

            // العناصر المضافة
            const added   = newItems.filter(i => !oldMap.has(i.id));
            // العناصر المحذوفة (UUID فقط)
            const deleted = oldItems.filter(i => !newMap.has(i.id) && this._isUUID(i.id));
            // العناصر المعدّلة (UUID موجود في القديم والجديد والمحتوى اتغير)
            const updated = newItems.filter(i => {
                if (!oldMap.has(i.id) || !this._isUUID(i.id)) return false;
                return JSON.stringify(oldMap.get(i.id)) !== JSON.stringify(i);
            });

            let anyPending = false;

            // إضافة
            for (const item of added) {
                const body = this._isUUID(item.id) ? item : (({ id, ...rest }) => rest)(item);
                const r = await apiMap[key].create(body);
                if (r?.status === 'pending_approval') {
                    anyPending = true;
                    handleApprovalResponse(key, r);
                } else if (!r?.success) {
                    console.error('[sync] create error:', key, r?.error);
                }
            }

            // تعديل
            for (const item of updated) {
                const r = await apiMap[key].update(item.id, item);
                if (r?.status === 'pending_approval') {
                    anyPending = true;
                    handleApprovalResponse(key, r);
                } else if (!r?.success) {
                    console.error('[sync] update error:', key, r?.error);
                }
            }

            // حذف
            for (const item of deleted) {
                const r = await apiMap[key].remove(item.id);
                if (r?.status === 'pending_approval') {
                    anyPending = true;
                    handleApprovalResponse(key, r);
                } else if (!r?.success) {
                    console.error('[sync] delete error:', key, r?.error);
                }
            }

            if (anyPending) {
                // مستخدم عادي → ارجع الـ cache للقديم (التغيير لم يُطبَّق)
                this._cache[key] = JSON.parse(JSON.stringify(oldItems));
            } else {
                // أدمن أو بيانات نظام → حدّث الـ previousCache بالجديد
                this._previousCache[key] = JSON.parse(JSON.stringify(newItems));
            }

        } catch (e) {
            console.error('[sync] exception:', key, e);
        }
    }

    async loadAllFromSupabase() {
        try {
            const result = await DataAPI.loadAll();
            if (result?.success) {
                this._cache = result.data;
                this._previousCache = JSON.parse(JSON.stringify(result.data));
                console.log('✅ تم تحميل البيانات من API');
            }
        } catch (e) {
            console.error('Load all failed:', e);
        }
    }
    showToast(message, type = 'success') {
        Toastify({
            text: message, duration: 3000, gravity: 'top', position: 'left',
            style: {
                background: type === 'success' ? '#198754'
                    : type === 'error' ? '#dc3545'
                    : '#ffc107'
            }
        }).showToast();
    }

    backup() {
        const allData = {};
        Object.entries(this._cache).forEach(([k, v]) => {
            if (v) allData['erp_' + k] = JSON.stringify(v);
        });
        // اجمع من sessionStorage و localStorage بأمان
        const stores = [];
        try { stores.push(sessionStorage); } catch {}
        try { stores.push(localStorage);   } catch {}
        for (const store of stores) {
            try {
                for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    if (k?.startsWith(this.prefix)) allData[k] = store.getItem(k);
                }
            } catch {}
        }
        return allData;
    }

    restore(backupData) {
        for (const [key, value] of Object.entries(backupData)) {
            const cleanKey = key.replace(this.prefix, '');
            try { this.set(cleanKey, JSON.parse(value)); } catch {}
        }
    }
}

// ============================================================
// 🏭 APPROVAL WORKFLOW API
// ============================================================
const ApprovalAPI = {
    getRequests() {
        return api.get('/approval/requests');
    },
    getRequestById(id) {
        return api.get(`/approval/requests/${id}`);
    },
    createRequest(requestData) {
        return api.post('/approval/requests', requestData);
    },
    approveRequest(id) {
        return api.put(`/approval/requests/${id}/approve`);
    },
    rejectRequest(id, rejectionReason) {
        return api.put(`/approval/requests/${id}/reject`, { rejection_reason: rejectionReason });
    },
    getAuditLogs(limit = 100, offset = 0) {
        return api.get(`/approval/audit-logs?limit=${limit}&offset=${offset}`);
    },
    getRecipeVersions(recipeId) {
        return api.get(`/approval/recipe-versions/${recipeId}`);
    },
    createRecipeVersion(versionData) {
        return api.post('/approval/recipe-versions', versionData);
    },
    getUserRoles() {
        return api.get('/approval/user-roles');
    },
    assignUserRole(userId, role) {
        return api.put(`/approval/user-roles/${userId}`, { role });
    },
    getDashboardStats() {
        return api.get('/approval/dashboard-stats');
    },
    approveAll() {
        return api.put('/approval/requests/approve-all');
    }
};

// Export
window.StorageManagerAPI = StorageManagerAPI;
window.AuthAPI = AuthAPI;
window.DataAPI = DataAPI;
window.ApprovalAPI = ApprovalAPI;
