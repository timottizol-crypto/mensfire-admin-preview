/* =========================================
   ЧАСТЬ 1: БАЗА, АВТОРИЗАЦИЯ И НАВИГАЦИЯ
   ========================================= */

// Раздельные пространства данных для демо и рабочей базы.
let mensfireDataMode = 'demo';
try { localStorage.setItem('mensfire_data_mode', 'demo'); } catch (error) { console.warn('Не удалось закрепить демо-режим:', error); }
function appStorageKey(key) { return 'mensfire_preview_demo_' + key.replace(/^mensfire_/, ''); }
function updateDataModeUI() {
 const demoButton = document.querySelector('.data-mode-switch button[onclick*="demo"]');
 const liveButton = document.querySelector('.data-mode-switch button[onclick*="live"]');
 if (demoButton) {
  demoButton.classList.toggle('is-active', mensfireDataMode === 'demo');
  demoButton.setAttribute('aria-pressed', String(mensfireDataMode === 'demo'));
 }
 if (liveButton) {
  liveButton.classList.toggle('is-active', mensfireDataMode === 'live');
  liveButton.setAttribute('aria-pressed', String(mensfireDataMode === 'live'));
 }
 const caption = document.querySelector('.data-mode-caption');
 if (caption) caption.textContent = mensfireDataMode === 'demo'
  ? 'Тестовые записи изолированы и не затрагивают рабочую базу'
  : 'Рабочие записи хранятся отдельно от демо-данных';
}
function setMensfireDataMode(mode) {
 if (mode !== 'demo') {
  showToast('Рабочая база пока отключена. Используются только демо-данные.', 'info');
  return;
 }
 if (mensfireDataMode !== 'demo') {
  mensfireDataMode = 'demo';
  localStorage.setItem('mensfire_data_mode', 'demo');
  location.reload();
 }
}

// --- МОК-ДАННЫЕ (В будущем заменятся на YCLIENTS API) ---
let mockStaff = [
    { id: 'b_al', name: 'Али', role: 'admin', pin: '1111', type: 'top' },
    { id: 'b_ben', name: 'Бенджо', role: 'barber', pin: '2222', type: 'barber' },
    { id: 'b_ism', name: 'Исмаил', role: 'barber', pin: '3333', type: 'barber' }
];

const defaultServicesData = {
    top: [
        { id: 't1', title: 'Мужская стрижка', price: 1500, duration: 45, type: 'top', active: true },
        { id: 't4', title: 'Стрижка + борода', price: 2500, duration: 45, type: 'top', active: true },
        { id: 't3', title: 'Оформление бороды', price: 1200, duration: 45, type: 'top', active: true }
    ],
    barber: [
        { id: 'b1', title: 'Мужская стрижка', price: 1300, duration: 45, type: 'barber', active: true },
        { id: 'b2', title: 'Стрижка + борода', price: 2300, duration: 45, type: 'barber', active: true },
        { id: 'b6', title: 'Оформление бороды', price: 1000, duration: 45, type: 'barber', active: true }
    ]
};
let servicesData = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_services')) || 'null');
        if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(defaultServicesData));
        const normalize = (items, fallback, type) => (Array.isArray(items) ? items : fallback).map((item,index) => ({
            id: String(item.id || 'svc_' + type + '_' + index),
            title: String(item.title || 'Новая услуга'),
            price: Math.max(0, Number(item.price) || 0),
            duration: Math.max(5, Number(item.duration) || 45),
            type,
            active: item.active !== false
        }));
        return {
            top: normalize(saved.top, defaultServicesData.top, 'top'),
            barber: normalize(saved.barber, defaultServicesData.barber, 'barber')
        };
    } catch (error) {
        console.error('Не удалось загрузить каталог услуг:', error);
        return JSON.parse(JSON.stringify(defaultServicesData));
    }
})();
let editingServiceId = null;
let editingServiceType = 'top';

let currentFinanceTab = 'expenses'; // По умолчанию Расходы
let dashboardPeriodMode = 'day';
let dashboardSelectedDate = new Date().toLocaleDateString('ru-RU');
let dashboardRangeStart = dashboardSelectedDate;
let dashboardRangeEnd = dashboardSelectedDate;
let selectedBlockDate = "";
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth(); // 0-11
let editingBlockId = null;
let confirmCallback = null;
let staffToResetPin = null;
let staffToEditId = null;

let currentUser = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem('mensfire_admin_user') || 'null');
        return saved && typeof saved === 'object' ? {
            id: saved.id,
            name: saved.name,
            role: saved.role,
            type: saved.type
        } : null;
    } catch (error) {
        console.error('Не удалось прочитать текущую сессию:', error);
        localStorage.removeItem('mensfire_admin_user');
        return null;
    }
})();

function isAdminUser() {
    return Boolean(currentUser && currentUser.role === 'admin');
}

function requireAdminAction(message = 'Это действие доступно только администратору Али') {
    if (isAdminUser()) return true;
    showToast(message, 'error');
    return false;
}
// --- ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ ---
// Демоданные больше не генерируются автоматически: это предотвращает перезапись данных салона.

let selectedBookingId = null;
let editingBookingId = null;
let viewOrder = []; // Заполнится в зависимости от роли

// --- ИНИЦИАЛИЗАЦИЯ ---
window.addEventListener('DOMContentLoaded', () => {
    updateDataModeUI();
    initTheme();
        // --- ПРИВЕТСТВИЕ НА ЭКРАНЕ ЗАГРУЗКИ ---
    const hour = new Date().getHours();
    let greetingText = "Доброй ночи";
    if (hour >= 5 && hour < 12) greetingText = "Доброе утро";
    else if (hour >= 12 && hour < 18) greetingText = "Добрый день";
    else if (hour >= 18 && hour < 23) greetingText = "Добрый вечер";

    const splashGreeting = document.getElementById('splashGreeting');
    if (splashGreeting) {
        if (currentUser) {
            // Если пользователь вошел, пишем "Добрый вечер, Али"
            splashGreeting.innerHTML = `${greetingText}, <span>${escapeBookingHtml(currentUser.name)}</span>`;
        } else {
            // Если не вошел, пишем "Добро пожаловать"
            splashGreeting.innerHTML = `Добро пожаловать в <span>MENSFIRE</span>`;
        }
    }
    // ---------------------------------------
    
    // Имитация загрузки (как в клиенте)
    setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hidden');
        const appContainer = document.getElementById('appContainer');
        appContainer.classList.add('visible');
        
        setTimeout(() => appContainer.classList.add('animate-in'), 50);
        setTimeout(() => appContainer.classList.remove('animate-in'), 1500);

        if (currentUser) {
            initAppForUser();
        } else {
            switchView('viewLogin', null);
        }
    }, 3500);
});

// --- АВТОРИЗАЦИЯ ---
function handleLogin() {
    const pin = document.getElementById('loginPin').value;
    const user = mockStaff.find(s => s.pin === pin);

    if (user) {
        // Не сохраняем PIN в браузерной сессии.
        currentUser = { id: user.id, name: user.name, role: user.role, type: user.type };
        localStorage.setItem('mensfire_admin_user', JSON.stringify(currentUser));
        document.getElementById('loginPin').value = '';
        
        // Определяем время суток
        const hour = new Date().getHours();
        let greeting = "Добро пожаловать";
        if (hour >= 5 && hour < 12) greeting = "Доброе утро";
        else if (hour >= 12 && hour < 18) greeting = "Добрый день";
        else if (hour >= 18 && hour < 23) greeting = "Добрый вечер";
        else greeting = "Доброй ночи";

        showToast(`${greeting}, ${user.name}!`, 'success');
        initAppForUser();
    } else {
        showToast('Неверный PIN-код', 'error');
    }
}

function initAppForUser() {

    document.body.classList.remove('role-admin', 'role-barber');
    document.body.classList.add(currentUser.role === 'admin' ? 'role-admin' : 'role-barber');
    // Настраиваем профиль
    document.getElementById('profileName').innerText = currentUser.name;
    document.getElementById('profileRole').innerText = currentUser.role === 'admin' ? 'Главный мастер' : 'Барбер';
    
    document.getElementById('barberRevenueCard').style.display = 'block';
    const backupCard = document.getElementById('profileBackupCard');
    if (backupCard) backupCard.style.display = isAdminUser() ? 'block' : 'none';
    if (isAdminUser()) {
        document.getElementById('profileRevenueTitle').innerText = 'Прибыль барбершопа';
    } else {
        document.getElementById('profileRevenueTitle').innerText = 'Моя выручка за сегодня';
    }

    buildBottomNav();
    
        // Открываем первый экран по умолчанию
    const defaultView = 'viewDashboard';
    const defaultNav = document.querySelector(`.nav-item[data-view="${defaultView}"]`);
    switchView(defaultView, defaultNav);
    
    // Инициализируем данные (рендер расписания и т.д. - будет в части 2)
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof renderBarberRevenue === 'function') renderBarberRevenue();
    if (typeof renderProfileOverview === 'function') renderProfileOverview();
}

function logout() {
    localStorage.removeItem('mensfire_admin_user');
    currentUser = null;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('viewLogin').classList.add('active');
    document.getElementById('headerTitle').innerText = 'Вход';
    showToast('Вы вышли из системы', 'info');
}



function persistServicesData() {
    localStorage.setItem(appStorageKey('mensfire_admin_services'), JSON.stringify(servicesData));
}
function renderServices() {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const container = document.getElementById('servicesCatalog');
    if (!container) return;
    const groups = [{type:'top',title:'Услуги Али',note:'Прайс главного мастера'},{type:'barber',title:'Услуги барберов',note:'Прайс команды'}];
    const all = groups.flatMap(group => servicesData[group.type]);
    const active = all.filter(item => item.active !== false);
    const summary = document.getElementById('servicesOverview');
    if (summary) summary.innerHTML = '<div class="service-overview-card"><span>Всего услуг</span><strong>' + all.length + '</strong></div><div class="service-overview-card"><span>Доступно для записи</span><strong>' + active.length + '</strong></div><div class="service-overview-card"><span>Средняя длительность</span><strong>' + Math.round(active.reduce((sum,item)=>sum+getServiceDurationMinutes(item),0)/Math.max(1,active.length)) + ' мин.</strong></div>';
    container.innerHTML = groups.map(group => '<section class="service-group"><div class="service-group-heading"><div><h3>' + group.title + '</h3><p>' + group.note + '</p></div><button class="finance-text-action" onclick="openServiceEditor(\'' + group.type + '\')">＋ Добавить</button></div><div class="service-card-grid">' +
        (servicesData[group.type].map(service => '<article class="service-card ' + (service.active === false ? 'is-inactive' : '') + '"><div class="service-card-top"><span class="service-status">' + (service.active === false ? 'Скрыта' : 'Активна') + '</span><span class="service-duration">' + getServiceDurationMinutes(service) + ' мин.</span></div><h4>' + escapeBookingHtml(service.title) + '</h4><strong class="service-price">' + Math.round(Number(service.price)||0).toLocaleString('ru-RU') + ' ₽</strong><div class="service-card-actions"><button type="button" onclick="openServiceEditor(\'' + group.type + '\',\'' + escapeBookingHtml(service.id) + '\')">Изменить</button><button type="button" onclick="toggleServiceActive(\'' + group.type + '\',\'' + escapeBookingHtml(service.id) + '\')">' + (service.active === false ? 'Вернуть' : 'Скрыть') + '</button></div></article>').join('') || '<div class="finance-empty">Пока нет услуг в этой категории</div>') + '</div></section>').join('');
}
function openServiceEditor(type, id = '') {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    editingServiceType = type === 'top' ? 'top' : 'barber';
    editingServiceId = id || null;
    const service = id ? servicesData[editingServiceType].find(item => String(item.id) === String(id)) : null;
    document.getElementById('serviceEditorTitle').textContent = service ? 'Изменить услугу' : 'Новая услуга';
    document.getElementById('serviceEditorName').value = service?.title || '';
    document.getElementById('serviceEditorPrice').value = service ? service.price : '';
    document.getElementById('serviceEditorDuration').value = service ? getServiceDurationMinutes(service) : 45;
    document.getElementById('serviceEditorCategory').value = editingServiceType;
    openModal('serviceEditorModal');
}
function saveService() {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const title = document.getElementById('serviceEditorName').value.trim();
    const price = Number(document.getElementById('serviceEditorPrice').value);
    const duration = Number(document.getElementById('serviceEditorDuration').value);
    const type = document.getElementById('serviceEditorCategory').value === 'top' ? 'top' : 'barber';
    if (!title || !Number.isFinite(price) || price <= 0 || !Number.isInteger(duration) || duration < 5 || duration > 360) return showToast('Проверьте название, цену и длительность услуги', 'error');
    const source = servicesData[editingServiceType];
    const oldIndex = editingServiceId ? source.findIndex(item => String(item.id) === String(editingServiceId)) : -1;
    let existing = oldIndex >= 0 ? source[oldIndex] : null;
    if (existing && type !== editingServiceType) {
        source.splice(oldIndex,1);
        existing = null;
    }
    if (existing) Object.assign(existing,{title,price,duration,type});
    else servicesData[type].push({id:'svc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),title,price,duration,type,active:true});
    persistServicesData();
    closeModal('serviceEditorModal');
    renderServices();
    showToast(editingServiceId ? 'Услуга обновлена' : 'Услуга добавлена','success');
}
function toggleServiceActive(type,id) {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const service = servicesData[type]?.find(item => String(item.id) === String(id));
    if (!service) return;
    service.active = service.active === false;
    persistServicesData();
    renderServices();
    showToast(service.active ? 'Услуга снова доступна для записи' : 'Услуга скрыта из новых записей','success');
}

function buildBottomNav() {
    const nav = document.getElementById('bottomNav');
    nav.innerHTML = '<div class="nav-bubble" id="navBubble"></div>';

    let navItems = [];
    viewOrder = [];

    const calendarIcon = '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>';
    const financeIcon = '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>';
    const teamIcon = '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>';
    const servicesIcon = '<path d="M12 2 4 6v12l8 4 8-4V6l-8-4z"/>';
    const clientsIcon = '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>';

    const dashboardIcon = '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>';
    if (currentUser.role === 'admin') {
        navItems = [
            { id: 'viewDashboard', title: 'Обзор', icon: dashboardIcon },
            { id: 'viewSchedule', title: 'Расписание', icon: calendarIcon },
            { id: 'viewFinance', title: 'Финансы', icon: financeIcon },
            { id: 'viewTeam', title: 'Команда', icon: teamIcon },
            { id: 'viewServices', title: 'Услуги', icon: servicesIcon },
            { id: 'viewClients', title: window.innerWidth >= 768 ? 'CRM' : 'Клиенты', icon: clientsIcon }
        ];
        if (window.innerWidth >= 768) {
            navItems.push(
                { id: 'viewClientDirectory', title: 'Клиенты', icon: clientsIcon },
                { id: 'viewInventory', title: 'Склад', icon: '<path d="M3 7 12 3l9 4-9 4-9-4zm0 5 9 4 9-4M3 17l9 4 9-4"/>' },
                { id: 'viewSales', title: 'Продажи', icon: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>' },
                { id: 'viewInventoryAnalytics', title: 'Аналитика', icon: '<path d="M3 3v18h18M8 16v-5m5 5V6m5 10V9"/>' },
                { id: 'viewPurchases', title: 'Закупки', icon: '<path d="M3 7h18l-2 13H5L3 7zm4 0 2-4h6l2 4M9 11v5m6-5v5"/>' },
                { id: 'viewProfile', title: 'Профиль', icon: clientsIcon }
            );
        } else {
            navItems.push({ id: 'viewProfile', title: 'Профиль', icon: clientsIcon });
        }
    } else {
        navItems = [
            { id: 'viewDashboard', title: 'Обзор', icon: dashboardIcon },
            { id: 'viewSchedule', title: 'Расписание', icon: calendarIcon },
            { id: 'viewClients', title: 'Клиенты', icon: clientsIcon },
            { id: 'viewProfile', title: 'Профиль', icon: clientsIcon }
        ];
    }

    viewOrder = navItems.map(item => item.id);

    navItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `nav-item ${index === 0 ? 'active' : ''}`;
        div.setAttribute('data-view', item.id);
        div.innerHTML = `<svg viewBox="0 0 24 24">${item.icon}</svg><span class="nav-item-label">${item.title}</span>`;
        div.onclick = () => switchView(item.id, div);
        nav.appendChild(div);

    });

    initDesktopNav();
    initNavBubble();
}


function initDesktopNav() {
    const nav = document.getElementById('bottomNav');
    const app = document.getElementById('appContainer');

    if (!nav || !app) return;

    // На ПК меню всегда компактное; расширение происходит наведением.
    const isDesktop = window.innerWidth >= 768;
    nav.classList.toggle('desktop-collapsed', isDesktop);
    app.classList.toggle('desktop-nav-collapsed', isDesktop);
}

function toggleDesktopNav() {
    if (window.innerWidth < 768) return;

    const nav = document.getElementById('bottomNav');
    const app = document.getElementById('appContainer');

    if (!nav || !app) return;

    const isCollapsed = !nav.classList.contains('desktop-collapsed');

    nav.classList.toggle('desktop-collapsed', isCollapsed);
    app.classList.toggle('desktop-nav-collapsed', isCollapsed);

    localStorage.setItem(
        'mensfire_desktop_nav',
        isCollapsed ? 'collapsed' : 'expanded'
    );

    updateDesktopNavToggle();
}


function updateDesktopNavToggle() {
    const nav = document.getElementById('bottomNav');
    const toggle = document.getElementById('desktopNavToggle');

    if (!nav || !toggle) return;

    const isCollapsed = nav.classList.contains('desktop-collapsed');
    const icon = toggle.querySelector('.nav-toggle-icon');
    const label = toggle.querySelector('.nav-toggle-label');

    if (icon) icon.textContent = isCollapsed ? '›' : '‹';
    if (label) label.textContent = isCollapsed ? 'Развернуть меню' : 'Свернуть меню';
}


function switchView(viewId, navElement) {
    const currentView = document.querySelector('.view.active');
    if (currentView && currentView.id === viewId) return;

    let animationClass = 'slide-from-right';
    if (currentView) {
        const currentIndex = viewOrder.indexOf(currentView.id);
        const targetIndex = viewOrder.indexOf(viewId);
        if (currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex) {
            animationClass = 'slide-from-left';
        }
    }

    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active', 'slide-from-right', 'slide-from-left');
    });

    const newView = document.getElementById(viewId);
    if (newView) newView.classList.add('active', animationClass);

    setTimeout(() => {
        if (newView) newView.classList.remove('slide-from-right', 'slide-from-left');
    }, 400);

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        let targetNav = navElement;
        if (!targetNav) {
            targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`); 
        }

    if (targetNav) {
        targetNav.classList.add('active');
        updateNavBubble(targetNav);
    }

    const titles = {
        'viewLogin': 'Вход',
        'viewDashboard': 'Обзор',
        'viewSchedule': 'Расписание',
        'viewFinance': 'Финансы',
        'viewTeam': 'Команда',
        'viewServices': 'Услуги',
        'viewClients': window.innerWidth >= 768 ? 'CRM' : 'Клиенты',
        'viewClientDirectory': 'База клиентов',
        'viewInventory': 'Склад',
        'viewSales': 'Продажи',
        'viewInventoryAnalytics': 'Аналитика склада',
        'viewPurchases': 'Закупки',
        'viewProfile': 'Профиль'
    };
    if (titles[viewId]) {
        const titleEl = document.getElementById('headerTitle');
        titleEl.innerText = titles[viewId];
        titleEl.classList.remove('animate-title');
        void titleEl.offsetWidth;
        titleEl.classList.add('animate-title');
    }

    if (viewId === 'viewLogin' || viewId === 'viewProfile') {
        document.body.classList.remove('header-hidden');
    } else {
        document.body.classList.add('header-hidden');
    }
    if (viewId === 'viewDashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (viewId === 'viewFinance' && typeof renderFinance === 'function') renderFinance();
    if (viewId === 'viewTeam' && typeof renderTeam === 'function') renderTeam();
    if ((viewId === 'viewClients' || viewId === 'viewClientDirectory') && typeof renderClients === 'function') renderClients(currentClientsTab);
    if (viewId === 'viewServices' && typeof renderServices === 'function') renderServices();
    if (viewId === 'viewSales' && typeof renderRetailSales === 'function') renderRetailSales();
    if (viewId === 'viewPurchases' && typeof renderPurchaseOrders === 'function') renderPurchaseOrders();

    if (viewId === 'viewProfile') {
        if (typeof renderBarberRevenue === 'function') renderBarberRevenue();
        if (typeof renderProfileOverview === 'function') renderProfileOverview();
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UI) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = document.createElement('span');
    icon.textContent = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    const text = document.createElement('span');
    text.textContent = String(message ?? '');
    toast.append(icon, text);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, text, yesText, callback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    const yesBtn = document.getElementById('confirmModalYesBtn');
    yesBtn.innerText = yesText;
    
    // Сбрасываем старый обработчик, чтобы не было багов
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    newYesBtn.onclick = () => {
        closeModal('confirmModal');
        callback();
    };
    
    openModal('confirmModal');
}


function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    const drawerIds = [
        'actionModal',
        'newBookingModal',
        'blockTimeModal',
        'blockActionModal',
        'clientDetailsModal',
        'barberStatsModal'
    ];

    const isDesktopDrawer = window.innerWidth >= 768 &&
        drawerIds.includes(id);

    if (isDesktopDrawer) {
        modal.classList.add('drawer-modal');
        document.body.classList.add('mensfire-drawer-open');

        const schedule = document.getElementById('viewSchedule');
        if (schedule) schedule.classList.add('drawer-space');
    } else {
        modal.classList.remove('drawer-modal');
    }

    modal.classList.add('active');

    if (!isDesktopDrawer) {
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('active', 'drawer-modal');

    document.body.classList.remove('mensfire-drawer-open');

    const schedule = document.getElementById('viewSchedule');
    if (schedule) schedule.classList.remove('drawer-space');

    document.body.style.overflow = '';
}


function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('light-theme');
    const isLight = html.classList.contains('light-theme');
    localStorage.setItem('mensfire_admin_theme', isLight ? 'light' : 'dark');
    document.getElementById('themeIcon').innerText = isLight ? '🌙' : '☀️';
    showToast(isLight ? 'Светлая тема' : 'Тёмная тема', 'info');
}

function initTheme() {
    const saved = localStorage.getItem('mensfire_admin_theme');
    if (saved === 'light') {
        document.documentElement.classList.add('light-theme');
        document.getElementById('themeIcon').innerText = '🌙';
    }
}

function goHomeFromHeader() {
    if (!currentUser) return;
    const firstNav = document.querySelector('.nav-item');
    if (firstNav) firstNav.click();
}

// --- АНИМАЦИЯ НИЖНЕГО МЕНЮ (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
function updateNavBubble(el, isInit = false) {
    if (window.innerWidth >= 768) return;
    const bubble = document.getElementById('navBubble');
    const nav = document.getElementById('bottomNav');
    if (!bubble || !nav || !el) return;
    
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    
    if (isInit) {
        bubble.style.width = elRect.width + 'px';
        bubble.style.height = elRect.height + 'px';
        bubble.style.left = (elRect.left - navRect.left) + 'px';
        bubble.style.top = (elRect.top - navRect.top) + 'px';
        return;
    }

    clearTimeout(window.bubbleTimer1);
    clearTimeout(window.bubbleTimer2);

    bubble.classList.remove('squashing');
    bubble.classList.add('expanding');

    window.bubbleTimer1 = setTimeout(() => {
        bubble.style.width = elRect.width + 'px';
        bubble.style.height = elRect.height + 'px';
        bubble.style.left = (elRect.left - navRect.left) + 'px';
        bubble.style.top = (elRect.top - navRect.top) + 'px';

        const currentActive = document.querySelector('.nav-item.active');
        if (currentActive) {
            const svg = currentActive.querySelector('svg');
            if (svg) {
                svg.classList.remove('bounce');
                void svg.offsetWidth; 
                svg.classList.add('bounce');
                setTimeout(() => svg.classList.remove('bounce'), 300);
            }
        }
    }, 100);

    window.bubbleTimer2 = setTimeout(() => {
        bubble.classList.remove('expanding');
        bubble.classList.add('squashing');
        setTimeout(() => bubble.classList.remove('squashing'), 150);
    }, 350); 
}

function initNavBubble() {
    const bubble = document.getElementById('navBubble');
    const activeNav = document.querySelector('.nav-item.active');
    if (!bubble || !activeNav) return;
    bubble.classList.remove('expanding', 'squashing');
    bubble.style.transition = 'none';
    updateNavBubble(activeNav, true);
    void bubble.offsetWidth; 
    bubble.style.transition = '';
}

window.addEventListener('resize', () => {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) updateNavBubble(activeNav, true);
});

// --- СВАЙПЫ (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
    if (document.querySelector('.modal.active') || document.querySelector('.drawer.active')) return;
    
    // ИГНОРИРУЕМ СВАЙП, ЕСЛИ ТРОГАЕМ СПИСКИ, ДАТЫ ИЛИ ТАБЫ
    if (e.target.closest('.home-scroll-area') || 
        e.target.closest('.profile-history-scroll') ||
        e.target.closest('.date-selector') || 
        e.target.closest('.category-tabs')) return; 
        
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
    if (document.querySelector('.modal.active') || document.querySelector('.drawer.active')) return;
    
    // ТУТ ТОЖЕ САМОЕ
    if (e.target.closest('.home-scroll-area') || 
        e.target.closest('.profile-history-scroll') ||
        e.target.closest('.date-selector') || 
        e.target.closest('.category-tabs')) return; 
        
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, { passive: true });

function handleSwipe(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 60) {
        const currentView = document.querySelector('.view.active');
        if (!currentView) return;
        
        const currentIndex = viewOrder.indexOf(currentView.id);
        if (currentIndex === -1) return; 

        if (deltaX < 0) {
            if (currentIndex < viewOrder.length - 1) switchView(viewOrder[currentIndex + 1], null);
        } else {
            if (currentIndex > 0) switchView(viewOrder[currentIndex - 1], null);
        }
    }
}

// --- ТАКТИЛЬНЫЙ ОТКЛИК (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
(function() {
     const PRESSABLE = 'button, .nav-item, .home-cta-btn, .header-pill, .action-modal-btn, .checkout-btn, .logout-btn, [onclick]';
    let holdTimer = null;
    let pressedEl = null;
    let longPressFired = false;

    document.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const el = e.target.closest(PRESSABLE);
        if (!el || el.disabled || el.classList.contains('disabled')) return;
        if (el.classList.contains('home-booking-item') || el.classList.contains('client-card')) return;

        clearTimeout(holdTimer);
        if (pressedEl) pressedEl.classList.remove('is-pressing');
        pressedEl = el;
        longPressFired = false;
        el.classList.add('is-pressing');

        holdTimer = setTimeout(() => {
            longPressFired = true;
            el.classList.remove('is-pressing');
            el.classList.add('is-cancelled');
            setTimeout(() => el.classList.remove('is-cancelled'), 450);
            if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
        }, 2000);
    }, { passive: true });

    const endPress = () => {
        clearTimeout(holdTimer);
        holdTimer = null;
        if (pressedEl) pressedEl.classList.remove('is-pressing');
    };

    document.addEventListener('pointerup', endPress, { passive: true });
    document.addEventListener('pointercancel', endPress, { passive: true });
    document.addEventListener('pointerleave', endPress, { passive: true });

    document.addEventListener('click', (e) => {
        if (longPressFired) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            longPressFired = false;
        }
    }, true);
})();

/* =========================================
   ЧАСТЬ 2: ЛОГИКА ЭКРАНОВ (РАСПИСАНИЕ, ФИНАНСЫ, КОМАНДА, КЛИЕНТЫ)
   ========================================= */

// Подгружаем обновленный список мастеров из localStorage (если добавляли новых)
try {
    const savedStaff = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_staff')) || 'null');
    if (Array.isArray(savedStaff)) mockStaff = savedStaff;
} catch (error) {
    console.error('Не удалось прочитать список мастеров:', error);
}

// Проверяем сохранённую сессию по актуальному списку мастеров и не храним PIN.
if (currentUser) {
    const sessionStaff = mockStaff.find(staff => staff.id === currentUser.id);
    if (sessionStaff) {
        currentUser = {
            id: sessionStaff.id,
            name: sessionStaff.name,
            role: sessionStaff.role,
            type: sessionStaff.type
        };
        localStorage.setItem('mensfire_admin_user', JSON.stringify(currentUser));
    } else {
        currentUser = null;
        localStorage.removeItem('mensfire_admin_user');
    }
}

// Финансовые данные и карточки клиентов также загружаются безопасно.
let expenses = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_expenses')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать расходы:', error);
        return [];
    }
})();

// Отдельный реестр розничных продаж. Визиты не считаются покупками товаров.
// Схема поддерживает будущую связь продажи с визитом, товаром и движением склада.
let clientRetailSales = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_client_retail_sales')) || '[]');
        if (!Array.isArray(saved)) return [];
        return saved.filter(sale => sale && typeof sale === 'object' && sale.id).map(sale => ({
            id: String(sale.id), clientProfileKey: String(sale.clientProfileKey || ''),
            clientPhone: String(sale.clientPhone || ''), clientNameSnapshot: String(sale.clientNameSnapshot || ''),
            soldAt: String(sale.soldAt || sale.createdAt || ''), bookingId: sale.bookingId == null ? '' : String(sale.bookingId),
            staffId: sale.staffId == null ? '' : String(sale.staffId),
            paymentStatus: ['paid','partial','refunded','unpaid'].includes(sale.paymentStatus) ? sale.paymentStatus : 'paid',
            paymentMethod: String(sale.paymentMethod || ''), total: Math.max(0, Number(sale.total) || 0),
            paidAmount: Math.max(0, Number(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.total : 0)) || 0),
            netTotal: sale.netTotal != null && Number.isFinite(Number(sale.netTotal))
                ? Math.max(0, Number(sale.netTotal))
                : Math.max(0, (Number(sale.total) || 0) - (Array.isArray(sale.refunds)
                    ? sale.refunds.reduce((sum, refund) => sum + Math.max(0, Number(refund?.value) || 0), 0)
                    : 0)),
            grossPaidAmount: Math.min(Math.max(0,Number(sale.total)||0),Math.max(0,Number(sale.grossPaidAmount ?? ((Number(sale.paidAmount ?? (sale.paymentStatus==='paid'?sale.total:0))||0)+(Array.isArray(sale.refunds)?sale.refunds.reduce((sum,refund)=>sum+Math.max(0,Number(refund?.paidAmount)||0),0):0)))||0)),
            refunds: (Array.isArray(sale.refunds)?sale.refunds:[]).filter(refund=>refund&&typeof refund==='object').map(refund=>({
                id:String(refund.id||''),createdAt:String(refund.createdAt||''),value:Math.max(0,Number(refund.value)||0),
                paidAmount:Math.max(0,Number(refund.paidAmount)||0),paymentMethod:String(refund.paymentMethod||sale.paymentMethod||'other'),
                debtReduction:Math.max(0,Number(refund.debtReduction)||0),note:String(refund.note||''),
                items:(Array.isArray(refund.items)?refund.items:[]).map(item=>({productId:String(item.productId||''),titleSnapshot:String(item.titleSnapshot||'Товар'),quantity:Math.max(0,Number(item.quantity)||0),unitPrice:Math.max(0,Number(item.unitPrice)||0),unitCostSnapshot:item.unitCostSnapshot==null?null:Math.max(0,Number(item.unitCostSnapshot)||0)}))
            })),
            items: (Array.isArray(sale.items) ? sale.items : []).filter(item => item && typeof item === 'object').map(item => ({
                productId: String(item.productId || ''), sku: String(item.sku || ''),
                titleSnapshot: String(item.titleSnapshot || item.title || 'Товар'),
                quantity: Math.max(0, Number(item.quantity) || 0), unitPrice: Math.max(0, Number(item.unitPrice) || 0),
                lineTotal: Math.max(0, Number(item.lineTotal) || 0), stockMovementId: String(item.stockMovementId || ''),
                unitCostSnapshot:item.unitCostSnapshot==null?null:Math.max(0,Number(item.unitCostSnapshot)||0),
                refundedQuantity:Math.max(0,Number(item.refundedQuantity)||0)
            })),
            notes: String(sale.notes || ''), source: String(sale.source || 'retail'), createdAt: String(sale.createdAt || sale.soldAt || '')
        }));
    } catch (error) { console.error('Не удалось прочитать историю продаж товаров:', error); return []; }
})();

function persistClientRetailSales() {
    localStorage.setItem(appStorageKey('mensfire_client_retail_sales'), JSON.stringify(clientRetailSales));
}

let clientProfiles = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_client_profiles')) || '{}');
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
        console.error('Не удалось прочитать карточки клиентов:', error);
        return {};
    }
})();

// Основные данные расписания. Без этой инициализации календарь обращается
// к неопределённой переменной bookings и полностью прекращает отрисовку.
let bookings = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_bookings')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать сохранённые записи:', error);
        return [];
    }
})();

// Дополнительные данные для блокировок
let timeBlocks = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_blocks')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать блокировки времени:', error);
        return [];
    }
})();

let barberWorkSchedules = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_work_schedules')) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch (error) { return {}; }
})();
const workWeekDays = [{label:'Понедельник',short:'Пн'},{label:'Вторник',short:'Вт'},{label:'Среда',short:'Ср'},{label:'Четверг',short:'Чт'},{label:'Пятница',short:'Пт'},{label:'Суббота',short:'Сб'},{label:'Воскресенье',short:'Вс'}];
function getBarberWorkDay(barberId, dateValue) {
    const date = parseReportDate(dateValue);
    if (!date) return { enabled:true, start:'08:00', end:'22:00' };
    const dayIndex = (date.getDay()+6)%7;
    const custom = barberWorkSchedules[String(barberId)]?.[dayIndex];
    return custom ? {enabled:custom.enabled!==false,start:custom.start||'08:00',end:custom.end||'22:00'} : {enabled:true,start:'08:00',end:'22:00'};
}
function isWithinBarberWorkSchedule(barberId,dateValue,start,end) {
    const day = getBarberWorkDay(barberId,dateValue);
    if (!day.enabled) return false;
    const workStart=parseScheduleTimeMinutes(day.start),workEnd=parseScheduleTimeMinutes(day.end);
    return workStart!==null&&workEnd!==null&&start>=workStart&&end<=workEnd;
}
function openWorkScheduleModal() {
    if (!requireAdminAction('Настраивать график может только администратор')) return;
    const select=document.getElementById('workScheduleBarber');
    select.innerHTML=mockStaff.map(person=>'<option value="'+escapeBookingHtml(person.id)+'">'+escapeBookingHtml(person.name)+'</option>').join('');
    renderWorkScheduleEditor();
    openModal('workScheduleModal');
}
function renderWorkScheduleEditor() {
    const select=document.getElementById('workScheduleBarber'),host=document.getElementById('workScheduleDays');
    if(!select||!host)return;
    const schedule=barberWorkSchedules[String(select.value)]||{};
    host.innerHTML=workWeekDays.map((day,index)=>{
        const item=schedule[index]||{enabled:true,start:'08:00',end:'22:00'};
        return '<div class="work-schedule-day"><label class="work-schedule-day-toggle"><input type="checkbox" id="workDayEnabled_'+index+'" '+(item.enabled!==false?'checked':'')+'><span>'+day.label+'</span></label><div class="work-schedule-times"><input type="text" id="workDayStart_'+index+'" readonly inputmode="none" value="'+escapeBookingHtml(item.start||'08:00')+'" onclick="openTimePicker(\'workDayStart_'+index+'\')"><span>—</span><input type="text" id="workDayEnd_'+index+'" readonly inputmode="none" value="'+escapeBookingHtml(item.end||'22:00')+'" onclick="openTimePicker(\'workDayEnd_'+index+'\')"></div></div>';
    }).join('');
}
function saveWorkSchedule() {
    if (!requireAdminAction('Настраивать график может только администратор')) return;
    const barberId=document.getElementById('workScheduleBarber')?.value;
    if(!barberId)return;
    const schedule={};
    for(let index=0;index<7;index++){
        const enabled=document.getElementById('workDayEnabled_'+index).checked;
        const start=document.getElementById('workDayStart_'+index).value;
        const end=document.getElementById('workDayEnd_'+index).value;
        const a=parseScheduleTimeMinutes(start),b=parseScheduleTimeMinutes(end);
        if(enabled&&(a===null||b===null||a>=b||a<480||b>1320))return showToast(workWeekDays[index].label+': проверьте рабочие часы (08:00–22:00)','error');
        schedule[index]={enabled,start,end};
    }
    const conflicts=bookings.filter(booking=>String(booking.barberId)===String(barberId)&&isBookingBlockingSchedule(booking)).filter(booking=>{
        const start=parseScheduleTimeMinutes(booking.time);return start!==null&&!isWithinBarberWorkSchedule(barberId,booking.date,start,start+getBookingDurationMinutes(booking));
    });
    if(conflicts.length)return showToast('Есть записи вне нового графика: '+conflicts.slice(0,2).map(item=>item.date+' '+item.time).join(', '),'error');
    barberWorkSchedules[String(barberId)]=schedule;
    localStorage.setItem(appStorageKey('mensfire_work_schedules'),JSON.stringify(barberWorkSchedules));
    closeModal('workScheduleModal');
    renderSchedule();
    showToast('Рабочий график сохранён','success');
}

let waitlistEntries = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_waitlist')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось загрузить лист ожидания:', error);
        return [];
    }
})();
let editingWaitlistId = null;

function persistWaitlist() {
    localStorage.setItem(appStorageKey('mensfire_waitlist'), JSON.stringify(waitlistEntries));
}
function openWaitlistDatePicker() {
    calendarTargetInputId = 'waitlistDate';
    reportDatePickerTarget = null;
    const value = document.getElementById('waitlistDate')?.value;
    const date = parseReportDate(value) || parseReportDate(selectedScheduleDate) || new Date();
    selectedBlockDate = formatReportDate(date);
    pickerYear = date.getFullYear();
    pickerMonth = date.getMonth();
    renderCalendar();
    openModal('calendarModal');
}
function renderWaitlist() {
    const host=document.getElementById('waitlistList'); if(!host)return;
    const barber=document.getElementById('waitlistBarber'),service=document.getElementById('waitlistService');
    if(barber&&!barber.options.length)barber.innerHTML='<option value="">Любой мастер</option>'+mockStaff.map(p=>`<option value="${escapeBookingHtml(p.id)}">${escapeBookingHtml(p.name)}</option>`).join('');
    if(service&&!service.options.length){const options=Object.values(servicesData).flat().filter(x=>x.active!==false);service.innerHTML='<option value="">Любая услуга</option>'+options.map(x=>`<option value="${escapeBookingHtml(x.id)}">${escapeBookingHtml(x.title)}</option>`).join('')}
    const active=waitlistEntries.filter(x=>(x.status||'waiting')!=='closed');const count=document.getElementById('waitlistCount');if(count)count.textContent=String(active.length);
    const q=(document.getElementById('waitlistSearch')?.value||'').trim().toLowerCase(),sf=document.getElementById('waitlistStatusFilter')?.value||'active',pf=document.getElementById('waitlistPriorityFilter')?.value||'all';
    const rank={urgent:0,high:1,normal:2},pl={urgent:'Срочно',high:'Высокий',normal:'Обычный'},sl={waiting:'Ожидает',contacted:'Связались',offered:'Предложено время',closed:'Закрыт'};
    const rows=waitlistEntries.filter(x=>{const st=x.status||'waiting';if(sf==='active'&&st==='closed')return false;if(sf!=='active'&&sf!=='all'&&st!==sf)return false;if(pf!=='all'&&(x.priority||'normal')!==pf)return false;return !q||[x.clientName,x.phone,x.serviceTitle].join(' ').toLowerCase().includes(q)}).sort((x,y)=>(rank[x.priority||'normal']??2)-(rank[y.priority||'normal']??2)||new Date(x.createdAt||0)-new Date(y.createdAt||0));
    if(!rows.length){host.innerHTML=`<div class="waitlist-empty">${waitlistEntries.length?'По выбранным фильтрам клиентов нет':'Пока нет клиентов в листе ожидания'}</div>`;return}
    host.innerHTML=rows.map(x=>{const staff=mockStaff.find(p=>String(p.id)===String(x.barberId)),priority=x.priority||'normal',status=x.status||'waiting',phone=String(x.phone||'').replace(/[^+\\d]/g,'');return `<article class="waitlist-row waitlist-row-enhanced"><div class="waitlist-person"><strong>${escapeBookingHtml(x.clientName)}</strong><span>${escapeBookingHtml(x.phone||'Телефон не указан')}</span><small>${escapeBookingHtml(x.date||'Любая дата')} · ${escapeBookingHtml(x.time||'Любое время')} · ${escapeBookingHtml(staff?.name||'Любой мастер')}</small><small>${escapeBookingHtml(x.serviceTitle||'Любая услуга')}</small><div class="waitlist-tags"><span class="waitlist-priority priority-${priority}">${pl[priority]||pl.normal}</span><span class="waitlist-status">${sl[status]||sl.waiting}</span></div></div><div class="waitlist-actions"><select aria-label="Приоритет" onchange="updateWaitlistEntry('${escapeBookingHtml(x.id)}','priority',this.value)"><option value="normal" ${priority==='normal'?'selected':''}>Обычный</option><option value="high" ${priority==='high'?'selected':''}>Высокий</option><option value="urgent" ${priority==='urgent'?'selected':''}>Срочно</option></select><select aria-label="Статус" onchange="updateWaitlistEntry('${escapeBookingHtml(x.id)}','status',this.value)"><option value="waiting" ${status==='waiting'?'selected':''}>Ожидает</option><option value="contacted" ${status==='contacted'?'selected':''}>Связались</option><option value="offered" ${status==='offered'?'selected':''}>Предложено время</option><option value="closed" ${status==='closed'?'selected':''}>Закрыть</option></select>${phone?`<a class="waitlist-contact-link" href="tel:${escapeBookingHtml(phone)}">Позвонить</a>`:''}<button type="button" onclick="promoteWaitlistEntry('${escapeBookingHtml(x.id)}')">Создать запись</button><button type="button" class="waitlist-remove" onclick="removeWaitlistEntry('${escapeBookingHtml(x.id)}')">Убрать</button></div></article>`}).join('');
}
function updateWaitlistEntry(id,field,value){if(!requireAdminAction('Управлять листом ожидания может только администратор'))return;const x=waitlistEntries.find(e=>String(e.id)===String(id));if(!x||!['priority','status'].includes(field))return;const allowed=field==='priority'?['normal','high','urgent']:['waiting','contacted','offered','closed'];if(!allowed.includes(value))return;x[field]=value;x.updatedAt=new Date().toISOString();persistWaitlist();renderWaitlist();showToast('Карточка ожидания обновлена','success')}

function addWaitlistEntry() {
    if (!requireAdminAction('Управлять листом ожидания может только администратор')) return;
    const clientName = document.getElementById('waitlistClient')?.value.trim();
    const phone = document.getElementById('waitlistPhone')?.value.trim() || '';
    const date = document.getElementById('waitlistDate')?.value || '';
    const time = document.getElementById('waitlistTime')?.value || '';
    const barberId = document.getElementById('waitlistBarber')?.value || '';
    const serviceId = document.getElementById('waitlistService')?.value || '';
    if (!clientName) return showToast('Укажите имя клиента', 'error');
    if (date && !parseReportDate(date)) return showToast('Проверьте желаемую дату', 'error');
    if (time && parseScheduleTimeMinutes(time) === null) return showToast('Проверьте желаемое время', 'error');
    const service = Object.values(servicesData).flat().find(item => String(item.id) === String(serviceId));
    waitlistEntries.push({ id:'wait-' + Date.now(), clientName, phone, date, time, barberId, serviceId, serviceTitle:service?.title || '', priority:document.getElementById('waitlistPriority')?.value || 'normal', status:'waiting', createdAt:new Date().toISOString() });
    persistWaitlist();
    ['waitlistClient','waitlistPhone','waitlistDate','waitlistTime'].forEach(id => { const input=document.getElementById(id); if(input) input.value=''; });
    renderWaitlist();
    showToast('Клиент добавлен в лист ожидания','success');
}
function removeWaitlistEntry(id) {
    if (!requireAdminAction('Управлять листом ожидания может только администратор')) return;
    waitlistEntries = waitlistEntries.filter(item => String(item.id) !== String(id));
    persistWaitlist();
    renderWaitlist();
}
function promoteWaitlistEntry(id) {
    if (!requireAdminAction('Создавать записи может только администратор')) return;
    const item = waitlistEntries.find(entry => String(entry.id) === String(id));
    if (!item) return;
    const barberId = item.barberId || currentUser.id;
    const date = item.date || selectedScheduleDate;
    openNewBookingModal(barberId, item.time || '', date);
    const client = document.getElementById('newBookingClient');
    if (client) client.value = item.clientName;
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = item.phone || '';
    const barberSelect = document.getElementById('newBookingBarber');
    if (barberSelect && item.barberId) barberSelect.value = item.barberId;
    renderBookingBarberChoices();
    updateNewBookingServices();
    if (item.serviceId) {
        const option = document.querySelector('#newBookingServicesList input[value="' + CSS.escape(String(item.serviceId)) + '"]');
        if (option) { option.checked = true; updateNewBookingSummary(); }
    }
    editingWaitlistId = item.id;
    showToast('Проверьте дату и время, затем сохраните запись','info');
}


function ensureDemoSampleData() {
 if (mensfireDataMode !== 'demo') return;
 const today = new Date();
 const dateFor = offset => { const d = new Date(today); d.setDate(d.getDate()+offset); return d.toLocaleDateString('ru-RU'); };
 const cut = { title: 'Мужская стрижка', price: 1300 };
 const beard = { title: 'Оформление бороды', price: 1000 };
 if (!bookings.length) {
  bookings = [
   { id:'demo-1',clientName:'Александр',barberId:'b_ben',date:dateFor(0),time:'10:00',services:[cut],status:'confirmed',paidAmount:1300,paymentMethod:'card' },
   { id:'demo-2',clientName:'Михаил',barberId:'b_ism',date:dateFor(0),time:'11:00',services:[cut,beard],status:'confirmed',paidAmount:1000,paymentMethod:'cash' },
   { id:'demo-3',clientName:'Даниил',barberId:'b_al',date:dateFor(0),time:'13:00',services:[cut],status:'pending',paidAmount:0,paymentMethod:'' },
   { id:'demo-4',clientName:'Илья',barberId:'b_ben',date:dateFor(1),time:'12:00',services:[beard],status:'completed',paidAmount:1000,paymentMethod:'transfer' },
   { id:'demo-5',clientName:'Максим',barberId:'b_ism',date:dateFor(1),time:'15:00',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'' }
  ];
  localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
 }
 // Расширенная витрина CRM: клиенты с разными каналами записи и историей визитов.
 const extraDemoBookings = [
  { id:'demo-extra-1',clientName:'Артём',barberId:'b_ben',date:dateFor(-34),time:'12:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'website' },
  { id:'demo-extra-2',clientName:'Артём',barberId:'b_ben',date:dateFor(-5),time:'12:30',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'card',bookingSource:'client_app' },
  { id:'demo-extra-3',clientName:'Роман',barberId:'b_ism',date:dateFor(-22),time:'14:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'pwa' },
  { id:'demo-extra-4',clientName:'Егор',barberId:'b_al',date:dateFor(-12),time:'16:00',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'transfer',bookingSource:'barber_app' },
  { id:'demo-extra-5',clientName:'Никита',barberId:'b_ben',date:dateFor(-2),time:'11:00',services:[beard],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'phone' },
  { id:'demo-extra-6',clientName:'Владислав',barberId:'b_ism',date:dateFor(-48),time:'13:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'website' },
  { id:'demo-extra-7',clientName:'Владислав',barberId:'b_ism',date:dateFor(-18),time:'13:30',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'mobile_app' },
  { id:'demo-extra-8',clientName:'Тимур',barberId:'b_ben',date:dateFor(-9),time:'17:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'barber_phone' },
  { id:'demo-extra-9',clientName:'Глеб',barberId:'b_al',date:dateFor(-1),time:'18:00',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'website' },
  { id:'demo-extra-10',clientName:'Кирилл',barberId:'b_ism',date:dateFor(-65),time:'10:30',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'transfer',bookingSource:'pwa' },
  { id:'demo-extra-11',clientName:'Кирилл',barberId:'b_ism',date:dateFor(-20),time:'10:30',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'client_app' },
  { id:'demo-extra-12',clientName:'Матвей',barberId:'b_al',date:dateFor(3),time:'15:30',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'barber_app' }
 ];
 const extraIds = new Set(bookings.map(item => String(item.id)));
 extraDemoBookings.forEach(item => { if (!extraIds.has(String(item.id))) bookings.push(item); });
 localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
 const demoProfiles = [
  ['Артём','b_ben','+7 900 111-22-33','regular'],
  ['Роман','b_ism','+7 900 222-33-44','new'],
  ['Егор','b_al','+7 900 333-44-55','new'],
  ['Никита','b_ben','+7 900 444-55-66','new'],
  ['Владислав','b_ism','+7 900 555-66-77','regular'],
  ['Тимур','b_ben','+7 900 666-77-88','new'],
  ['Глеб','b_al','+7 900 777-88-99','new'],
  ['Кирилл','b_ism','+7 900 888-99-00','regular'],
  ['Матвей','b_al','+7 900 999-00-11','new']
 ];
 demoProfiles.forEach(([name,barberId,phone,tag]) => {
  const key = JSON.stringify([name,barberId]);
  if (!clientProfiles[key]) clientProfiles[key] = { clientName:name, barberId, phone, tag, notes:'Демо-профиль клиента' };
 });
 localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
 if (!expenses.length) {
  expenses = [
   { id:'demo-exp-1', title:'Расходные материалы', amount:850, date:dateFor(0) },
   { id:'demo-exp-2', title:'Уборка', amount:500, date:dateFor(-1) }
  ];
  localStorage.setItem(appStorageKey('mensfire_admin_expenses'), JSON.stringify(expenses));
 }
 if (!timeBlocks.length) {
  timeBlocks = [{ id:'demo-block-1', barberId:'b_ben', date:dateFor(2), startTime:'14:00', endTime:'15:00' }];
  localStorage.setItem(appStorageKey('mensfire_admin_blocks'), JSON.stringify(timeBlocks));
 }
 localStorage.setItem('mensfire_demo_seeded', '1');
}
ensureDemoSampleData();
// Выбранная дата в расписании (по умолчанию — сегодня)
let selectedScheduleDate = new Date().toLocaleDateString('ru-RU');
let currentScheduleTab = 'bookings'; // 'bookings' или 'breaks'
let selectedScheduleBarberFilter = 'all';
let selectedFinanceDate = new Date().toLocaleDateString('ru-RU');
let financePeriodMode = 'day';
let financeRangeStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('ru-RU');
let financeRangeEnd = new Date().toLocaleDateString('ru-RU');
let reportDatePickerTarget = null;
let clientsPeriodMode = 'sixMonths';
let clientsRangeStart = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toLocaleDateString('ru-RU');
let clientsRangeEnd = new Date().toLocaleDateString('ru-RU');
let teamPeriodMode = 'month';
let teamRangeStart = new Date(new Date().getFullYear(),new Date().getMonth(),1).toLocaleDateString('ru-RU');
let teamRangeEnd = new Date().toLocaleDateString('ru-RU');

// Массив фраз для пустого расписания
const emptyPhrases = [
    "Можно отдохнуть и выпить кофе ☕",
    "Отличное время, чтобы поправить инструменты ✂️",
    "Пока тихо... Но клиенты уже в пути! 🚀",
    "Свободное время для отдыха 😌",
    "Пора протереть зеркала 🪞",
    "Ни одной записи. Может, чайку? 🍵",
    "Идеальный момент, чтобы размяться 🏋️‍♂️",
    "Затишье перед бурей ⛈️",
    "Время навести порядок на рабочем месте 🧹",
    "Кто-то явно заслужил перерыв 🍔",
    "Скучаем по клиентам... 🥺",
    "Отличный день, чтобы обновить прическу самому себе 💈",
    "Тишина... наслаждаемся моментом 🧘‍♂️",
    "Может, посмотреть пару обучающих видео? 📺",
    "Время проверить расходники 🧴",
    "Пора заварить свежий кофе ☕",
    "Никаких записей. Пока что! 😉",
    "Идеальное время для небольшого перерыва 💤",
    "Отдыхаем, пока есть возможность 🛋️",
    "Скоро здесь будет жарко! 🔥"
];
let emptyPhrasesTimer = null;

function renderSchedule() {
    const list = document.getElementById('scheduleList');
    if (!list) return;

    list.style.opacity = '0';

    setTimeout(() => {
        renderDateSelector();
        const scheduleDate = selectedScheduleDate;
        const staffFilterHost = document.getElementById('scheduleBarberFilterMobile');
        if (staffFilterHost) staffFilterHost.innerHTML = renderScheduleBarberFilter(mockStaff).replace('schedule-barber-filter','schedule-barber-filter-mobile');
        const visibleBookings = bookings.filter(item => item.date === scheduleDate &&
            item.status !== 'cancelled' &&
            (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)) &&
            (selectedScheduleBarberFilter === 'all' || String(item.barberId) === String(selectedScheduleBarberFilter)));
        const visibleBlocks = timeBlocks.filter(item => item.date === scheduleDate &&
            (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)) &&
            (selectedScheduleBarberFilter === 'all' || String(item.barberId) === String(selectedScheduleBarberFilter)));
        const completedCount = visibleBookings.filter(item => item.status === 'completed').length;
        const collected = visibleBookings.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        const planned = visibleBookings.reduce((sum,item) => sum + (item.services || []).reduce((n,service) => n + Number(service.price || 0),0),0);
        const outstanding = visibleBookings.reduce((sum,item) => {
            const total = (item.services || []).reduce((n,service) => n + Number(service.price || 0),0);
            return sum + Math.max(0,total-getBookingPaymentState(item,total).paid);
        },0);
        const overview = document.getElementById('scheduleOverview');
        if (overview) overview.innerHTML = `
            <div class="schedule-overview-card"><span>Записей</span><strong>${visibleBookings.length}</strong><small>${completedCount} завершено</small></div>
            <div class="schedule-overview-card"><span>Получено</span><strong>${Math.round(collected).toLocaleString('ru-RU')} ₽</strong><small>Фактические оплаты</small></div>
            <div class="schedule-overview-card"><span>К оплате</span><strong>${Math.round(outstanding).toLocaleString('ru-RU')} ₽</strong><small>По записям дня</small></div>
            <div class="schedule-overview-card"><span>Перерывов</span><strong>${visibleBlocks.length}</strong><small>Заблокированные интервалы</small></div>`;

        const greetEl = document.getElementById('scheduleGreeting');
        if (greetEl) greetEl.innerText = 'Расписание';

        const isPC = window.innerWidth >= 768;
        if (isPC) {
            try {
                renderDesktopSchedule();
            } catch (error) {
                console.error('Mensfire desktop calendar render error:', error);
                const view = document.getElementById('viewSchedule');
                let calendar = document.getElementById('desktopSchedule');
                if (!calendar && view) {
                    calendar = document.createElement('div');
                    calendar.id = 'desktopSchedule';
                    view.appendChild(calendar);
                }
                if (calendar) {
                    calendar.innerHTML = '<div class="calendar-render-error">Не удалось загрузить календарь. Обнови страницу; подробности доступны в консоли браузера.</div>';
                }
            }
            list.style.opacity = '1';
            return;
        }
        if (emptyPhrasesTimer) clearInterval(emptyPhrasesTimer);

        // Функция создания карточки
        const createCard = (b, isBlock) => {
            if (isBlock) {
                return `
                    <div class="home-booking-item" onclick="openBlockActionModal('${escapeBookingHtml(String(b.id))}')" style="cursor: pointer; border-left-style: dashed; border-left-color: #888; background: rgba(255,255,255,0.02); margin-bottom: 0; padding: 12px; display: flex; justify-content: space-between; align-items: flex-start; opacity: 0.8; width: 100%; box-sizing: border-box;">
                        <div class="hb-info" style="flex: 1; min-width: 0;">
                            <div class="hb-date" style="color: #888; font-size: 14px;">${escapeBookingHtml(b.startTime)} - ${escapeBookingHtml(b.endTime)}</div>
                            <div class="hb-services" style="font-size: 12px; white-space: normal;">Перерыв / Личные дела</div>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 10px;">
                            <div class="status-badge completed" style="margin:0; background: rgba(255,255,255,0.05); color: #888; border-color: transparent;">Блок</div>
                        </div>
                    </div>
                `;
            } else {
                const servicesText = (b.services || []).map(s => escapeBookingHtml(s.title || 'Услуга')).join(', ');
                const bookingTotal = (b.services || []).reduce((sum, service) => sum + Number(service.price || 0), 0);
                const payState = getBookingPaymentState(b, bookingTotal);
                const bookingDuration = getBookingDurationMinutes(b);
                const startMinutes = parseScheduleTimeMinutes(b.time);
                const endMinutes = startMinutes === null ? null : startMinutes + bookingDuration;
                const endLabel = endMinutes === null ? '' : String(Math.floor(endMinutes / 60)).padStart(2, '0') + ':' + String(endMinutes % 60).padStart(2, '0');
                const remaining = Math.max(0, bookingTotal - payState.paid);
                const safeStatus = ['active', 'pending', 'confirmed', 'completed', 'cancelled'].includes(b.status) ? b.status : 'active';
                let itemClass = safeStatus === 'completed' ? 'completed' : (safeStatus === 'cancelled' ? 'cancelled' : '');
                let statusBadge = '';
                if (safeStatus === 'completed') statusBadge = `<div class="status-badge completed" style="margin:0;">Завершена</div>`;
                else if (safeStatus === 'cancelled') statusBadge = `<div class="status-badge cancelled" style="margin:0;">Отменена</div>`;
                else statusBadge = `<div class="status-badge active" style="margin:0;">Активная</div>`;

                return `
                    <div class="home-booking-item ${itemClass}" onclick="openActionModal('${escapeBookingHtml(String(b.id))}')" style="cursor: pointer; margin-bottom: 0; padding: 12px; display: flex; justify-content: space-between; align-items: flex-start; width: 100%; box-sizing: border-box;">
                        <div class="hb-info" style="flex: 1; min-width: 0;">
                            <div class="mobile-booking-time"><strong>${escapeBookingHtml(b.time || '—')}</strong><span>${endLabel ? 'до ' + endLabel : ''} · ${bookingDuration} мин.</span></div>
                            <div class="hb-master" style="font-size: 12px;">${currentUser.role === 'admin' ? escapeBookingHtml((mockStaff.find(s=>s.id === b.barberId)?.name || 'Мастер') + ' · ') : ''}${escapeBookingHtml(b.clientName || 'Клиент')}</div>
                            <div class="booking-card-badges"><i class="booking-origin origin-${getBookingSourceMeta(b).className}">${getBookingSourceMeta(b).label}</i><i class="booking-client-type type-${getBookingClientTypeMeta(b).className}">${getBookingClientTypeMeta(b).label}</i></div>
                            <div class="hb-services" style="font-size: 11px; white-space: normal;">${servicesText}</div>
                            <div class="mobile-booking-finance"><strong>${bookingTotal.toLocaleString('ru-RU')} ₽</strong><span>${payState.paid.toLocaleString('ru-RU')} ₽ получено</span><span>${remaining.toLocaleString('ru-RU')} ₽ остаток</span></div>
                            <span class="calendar-payment-label payment-${payState.status}">${payState.label}</span>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 10px;">
                            ${statusBadge}
                        </div>
                    </div>
                `;
            }
        };

        // Разделители
        const yellowDivider = `<div style="width: 100%; height: 2px; background: var(--gold); opacity: 0.6; margin: 12px 0; border-radius: 2px; box-shadow: 0 0 6px rgba(212,175,55,0.4); flex-shrink: 0;"></div>`;
        const grayDivider = `<div style="width: 100%; height: 1px; background: rgba(255,255,255,0.1); margin: 12px 0; flex-shrink: 0;"></div>`;

        if (isPC) {
            list.style.display = 'flex';
            list.style.flexDirection = 'row';
            list.style.overflowX = 'auto';
            list.style.gap = '15px';
            list.style.paddingBottom = '15px';
            list.style.alignItems = 'flex-start';

            let html = '';
            
            for (let i = 0; i < 10; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const dateStr = d.toLocaleDateString('ru-RU');
                let dayName = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : d.toLocaleDateString('ru-RU', { weekday: 'short' });

                let filteredBookings = bookings.filter(b => b.date === dateStr && b.barberId === currentUser.id);
                let filteredBlocks = timeBlocks.filter(tb => tb.date === dateStr && tb.barberId === currentUser.id);

                let cardsHtml = '';

                // РЕНДЕР В ЗАВИСИМОСТИ ОТ ВКЛАДКИ
                if (currentScheduleTab === 'bookings') {
                    filteredBookings.sort((a, b) => a.time.localeCompare(b.time));
                    filteredBookings.forEach((b, index) => {
                        cardsHtml += createCard(b, false);
                        if (index < filteredBookings.length - 1) cardsHtml += yellowDivider;
                    });
                    if (filteredBookings.length === 0) cardsHtml = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">Нет записей</div>`;
                } else {
                    filteredBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
                    filteredBlocks.forEach((tb, index) => {
                        cardsHtml += createCard(tb, true);
                        if (index < filteredBlocks.length - 1) cardsHtml += grayDivider;
                    });
                    if (filteredBlocks.length === 0) cardsHtml = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">Нет перерывов</div>`;
                }

                html += `
                    <div style="flex: 0 0 300px; background: rgba(255,255,255,0.02); border-radius: 16px; padding: 15px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column;">
                        <div style="font-size: 13px; font-weight: 800; color: var(--gold); text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: flex; justify-content: space-between; flex-shrink: 0;">
                            <span>${dayName}</span>
                            <span>${d.getDate()}.${(d.getMonth()+1).toString().padStart(2, '0')}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; overflow-y: auto; padding-right: 5px; width: 100%;">
                            ${cardsHtml}
                        </div>
                    </div>
                `;
            }
            list.innerHTML = html;
        } else {
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gridTemplateColumns = 'none';

            const targetDate = selectedScheduleDate;
            
            const canSeeAllStaff = currentUser.role === 'admin';
            let filteredBookings = bookings.filter(b => b.date === targetDate && (canSeeAllStaff || b.barberId === currentUser.id));
            let filteredBlocks = timeBlocks.filter(tb => tb.date === targetDate && (canSeeAllStaff || tb.barberId === currentUser.id));

            let html = '';

            // РЕНДЕР В ЗАВИСИМОСТИ ОТ ВКЛАДКИ
            if (currentScheduleTab === 'bookings') {
                filteredBookings.sort((a, b) => a.time.localeCompare(b.time));
                filteredBookings.forEach((b, index) => {
                    html += createCard(b, false);
                    if (index < filteredBookings.length - 1) html += yellowDivider;
                });
                if (filteredBookings.length === 0) {
                    const emptyText = "На этот день записей нет";
                    html = `<div class="empty-bookings-msg" id="emptyMsg" style="font-size: 16px; font-weight: 600; padding: 20px 0;">${emptyText}</div>`;
                    emptyPhrasesTimer = setInterval(() => {
                        const msgDiv = document.getElementById('emptyMsg');
                        if (!msgDiv) { clearInterval(emptyPhrasesTimer); return; }
                        msgDiv.style.opacity = '0';
                        setTimeout(() => {
                            msgDiv.innerText = emptyPhrases[Math.floor(Math.random() * emptyPhrases.length)];
                            msgDiv.style.opacity = '1';
                        }, 300);
                    }, 15000);
                }
            } else {
                filteredBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
                filteredBlocks.forEach((tb, index) => {
                    html += createCard(tb, true);
                    if (index < filteredBlocks.length - 1) html += grayDivider;
                });
                if (filteredBlocks.length === 0) {
                    html = `<div class="empty-bookings-msg" style="font-size: 16px; font-weight: 600; padding: 20px 0;">На этот день перерывов нет</div>`;
                }
            }

            list.innerHTML = html;
        }
        
        list.style.opacity = '1';
    }, 200);
}



function renderScheduleBarberFilter(staff) {
    if (!currentUser || currentUser.role !== 'admin') return '';
    const options = [{ id: 'all', name: 'Все мастера' }, ...staff];
    return `<div class="schedule-barber-filter" role="group" aria-label="Фильтр по мастерам">${options.map(person => `<button type="button" class="${String(selectedScheduleBarberFilter)===String(person.id)?'active':''}" aria-pressed="${String(selectedScheduleBarberFilter)===String(person.id)}" onclick="setScheduleBarberFilter('${escapeBookingHtml(String(person.id))}')">${escapeBookingHtml(person.name)}</button>`).join('')}</div>`;
}
function setScheduleBarberFilter(barberId) {
    const allowed = currentUser?.role === 'admin' ? ['all', ...mockStaff.map(person => String(person.id))] : [String(currentUser?.id || '')];
    if (!allowed.includes(String(barberId))) return;
    selectedScheduleBarberFilter = String(barberId);
    renderSchedule();
}

function renderDesktopSchedule() {
    const view = document.getElementById('viewSchedule');
    if (!view) return;

    let calendar = document.getElementById('desktopSchedule');
    if (!calendar) {
        calendar = document.createElement('div');
        calendar.id = 'desktopSchedule';
    }
    // Календарь должен находиться сразу после основной карточки расписания,
    // а не в самом конце вкладки под блокировками и листом ожидания.
    const scheduleCard = view.querySelector(':scope > .schedule-main-card');
    if (scheduleCard && calendar.previousElementSibling !== scheduleCard) {
        scheduleCard.insertAdjacentElement('afterend', calendar);
    } else if (!scheduleCard && calendar.parentElement !== view) {
        view.appendChild(calendar);
    }

    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    if (Number.isNaN(selectedDate.getTime())) return;

    const availableStaff = currentUser.role === 'admin'
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);
    const staff = selectedScheduleBarberFilter === 'all'
        ? availableStaff
        : availableStaff.filter(person => String(person.id) === String(selectedScheduleBarberFilter));
    const viewMode = ['week', 'month'].includes(window.desktopCalendarMode) ? window.desktopCalendarMode : 'day';
    if (viewMode === 'month') {
        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
        const monthDays = Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            return d;
        });
        const monthLabel = selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const html = `
            <div class="desktop-calendar-toolbar">
                <div class="desktop-calendar-date-controls">
                    <button type="button" class="calendar-date-arrow" onclick="shiftScheduleMonth(-1)" aria-label="Предыдущий месяц">‹</button>
                    <button type="button" class="calendar-today-btn" onclick="goToScheduleToday()">Сегодня</button>
                    <strong>${monthLabel}</strong>
                    <button type="button" class="calendar-date-arrow" onclick="shiftScheduleMonth(1)" aria-label="Следующий месяц">›</button>
                    <span>${staff.length} маст.</span>
                </div>
                <div class="desktop-calendar-tabs">
                    <button onclick="setDesktopCalendarMode('day')">День</button>
                    <button onclick="setDesktopCalendarMode('week')">Неделя</button>
                    <button class="active" onclick="setDesktopCalendarMode('month')">Месяц</button>
                    <button class="${currentScheduleTab === 'bookings' ? 'active' : ''}" onclick="switchScheduleTab('bookings')">Записи</button>
                    <button class="${currentScheduleTab === 'breaks' ? 'active' : ''}" onclick="switchScheduleTab('breaks')">Перерывы</button>
                    <span class="desktop-calendar-action-divider" aria-hidden="true"></span>
                    <button type="button" class="desktop-calendar-action" onclick="openBlockTimeModal()">Заблокировать время</button>
                    <button type="button" class="desktop-calendar-action" onclick="openWorkScheduleModal()">Рабочий график</button>
                    <button type="button" class="desktop-calendar-action desktop-calendar-action-primary" onclick="openNewBookingModal()">＋ Новая запись</button>
                </div>
            </div>
            ${renderScheduleBarberFilter(availableStaff)}
            <div class="desktop-month-grid">
                ${weekDays.map(dayName => `<div class="desktop-month-weekday">${dayName}</div>`).join('')}
                ${monthDays.map(date => {
                    const dateKey = date.toLocaleDateString('ru-RU');
                    const inMonth = date.getMonth() === selectedDate.getMonth();
                    const dayBookings = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled' && staff.some(member => String(member.id) === String(b.barberId)));
                    const dayBlocks = timeBlocks.filter(b => b.date === dateKey && staff.some(member => String(member.id) === String(b.barberId)));
                    const count = currentScheduleTab === 'bookings' ? dayBookings.length : dayBlocks.length;
                    const active = dateKey === selectedScheduleDate;
                    const preview = (currentScheduleTab === 'bookings' ? dayBookings : dayBlocks).slice(0, 3);
                    return `
                        <button type="button" class="desktop-month-day ${inMonth ? '' : 'outside-month'} ${active ? 'selected' : ''}"
                            onclick="selectCalendarDate('${dateKey}')">
                            <strong>${date.getDate()}</strong>
                            <span class="desktop-month-count">${count ? (currentScheduleTab === 'bookings' ? count + ' запис.' : count + ' пер.') : '—'}</span>
                            <span class="desktop-month-preview">${preview.map(item => currentScheduleTab === 'bookings' ? `${escapeBookingHtml(item.time)} · ${escapeBookingHtml(item.clientName)}` : `${escapeBookingHtml(item.startTime)}–${escapeBookingHtml(item.endTime)} · перерыв`).join('<br>')}</span>
                            ${count > 3 ? `<small>ещё ${count - 3}</small>` : ''}
                        </button>`;
                }).join('')}
            </div>`;
        calendar.innerHTML = html;
        return;
    }

    const START_HOUR = 8;
    const END_HOUR = 22;
    const SLOT_HEIGHT = 30;
    const HOUR_HEIGHT = SLOT_HEIGHT * 4;
    const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
    const toMinutes = time => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };
    const toDateKey = date => date.toLocaleDateString('ru-RU');
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const dates = viewMode === 'week'
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        })
        : [selectedDate];
    const columns = dates.flatMap(date => staff.map(barber => ({ date, barber })));
    const rangeLabel = viewMode === 'week'
        ? dates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
          ' — ' + dates[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
        : selectedScheduleDate;

    let html = `
        <div class="desktop-calendar-toolbar">
            <div class="desktop-calendar-date-controls">
                <button type="button" class="calendar-date-arrow" onclick="shiftScheduleDate(-${viewMode === 'week' ? 7 : 1})" aria-label="Назад">‹</button>
                <button type="button" class="calendar-today-btn" onclick="goToScheduleToday()">Сегодня</button>
                <strong>${rangeLabel}</strong>
                <button type="button" class="calendar-date-arrow" onclick="shiftScheduleDate(${viewMode === 'week' ? 7 : 1})" aria-label="Вперёд">›</button>
                <span>${staff.length} маст.</span>
            </div>
            <div class="desktop-calendar-tabs">
                <button class="${viewMode === 'day' ? 'active' : ''}" onclick="setDesktopCalendarMode('day')">День</button>
                <button class="${viewMode === 'week' ? 'active' : ''}" onclick="setDesktopCalendarMode('week')">Неделя</button>
                <button class="${currentScheduleTab === 'bookings' ? 'active' : ''}" onclick="switchScheduleTab('bookings')">Записи</button>
                <button class="${currentScheduleTab === 'breaks' ? 'active' : ''}" onclick="switchScheduleTab('breaks')">Перерывы</button>
                <span class="desktop-calendar-action-divider" aria-hidden="true"></span>
                    <button type="button" class="desktop-calendar-action" onclick="openBlockTimeModal()">Заблокировать время</button>
                    <button type="button" class="desktop-calendar-action" onclick="openWorkScheduleModal()">Рабочий график</button>
                    <button type="button" class="desktop-calendar-action desktop-calendar-action-primary" onclick="openNewBookingModal()">＋ Новая запись</button>
            </div>
        </div>
        ${renderScheduleBarberFilter(availableStaff)}
        <div class="desktop-calendar-scroll ${viewMode === 'week' ? 'is-week-view' : ''}">
            <div class="desktop-calendar-grid" style="--calendar-column-count:${Math.max(columns.length, 1)}">
                <div class="desktop-time-column">
                    <div class="desktop-staff-heading">Время</div>
                    <div class="desktop-time-track" style="height:${totalHeight}px">
                        ${Array.from({length: END_HOUR - START_HOUR + 1}, (_, i) =>
                            `<div class="desktop-time-label" style="top:${i * HOUR_HEIGHT}px">${String(START_HOUR + i).padStart(2, '0')}:00</div>`
                        ).join('')}
                    </div>
                </div>
    `;

    columns.forEach(({ date, barber }) => {
        const dateKey = toDateKey(date);
        const barberBookings = bookings.filter(b => b.date === dateKey && String(b.barberId) === String(barber.id) && b.status !== 'cancelled');
        const barberBlocks = timeBlocks.filter(b => b.date === dateKey && String(b.barberId) === String(barber.id));
        const dayHeading = viewMode === 'week'
            ? date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })
            : barber.name;
        const subHeading = viewMode === 'week' ? barber.name : (barber.role === 'admin' ? 'Администратор' : 'Барбер');

        html += `
            <div class="desktop-staff-column">
                <button class="desktop-staff-heading" onclick="showBarberStats('${escapeBookingHtml(String(barber.id))}')">
                    <strong>${escapeBookingHtml(dayHeading)}</strong><span>${escapeBookingHtml(subHeading)}</span>
                </button>
                <div class="desktop-staff-track"
                    style="height:${totalHeight}px"
                    ondragover="if(event.dataTransfer.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='move';this.classList.add('is-drop-target')}" ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('is-drop-target')"
                    ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('is-drop-target'); moveBookingToSlot(event, '${escapeBookingHtml(String(barber.id))}', '${escapeBookingHtml(dateKey)}')"
                    >
        `;

        for (let i = 0; i < (END_HOUR - START_HOUR) * 4; i++) {
            const slotMinutes = START_HOUR * 60 + i * 15;
            const slotTime = String(Math.floor(slotMinutes / 60)).padStart(2, '0') + ':' + String(slotMinutes % 60).padStart(2, '0');
            html += '<button type="button" class="desktop-slot-hitbox" data-time="' + slotTime + '" aria-label="Создать запись на ' + slotTime + '" style="top:' + (i * SLOT_HEIGHT) + 'px;height:' + SLOT_HEIGHT + 'px" onclick="openNewBookingAtExactSlot(event, \'' + escapeBookingHtml(String(barber.id)) + '\', \'' + escapeBookingHtml(dateKey) + '\', \'' + slotTime + '\')"></button>';
        }
        for (let i = 0; i <= (END_HOUR - START_HOUR) * 4; i++) {
            html += `<div class="desktop-time-line ${i % 4 === 0 ? 'hour' : ''}" style="top:${i * SLOT_HEIGHT}px"></div>`;
        }

        // Тонкая линия текущего времени помогает быстро ориентироваться в сегодняшнем дне.
        const now = new Date();
        if (dateKey === now.toLocaleDateString('ru-RU')) {
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60) {
                const nowTop = (nowMinutes - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                html += `<div class="desktop-current-time" style="top:${nowTop}px"><span>${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
            }
        }

        if (currentScheduleTab === 'bookings') {
            // Раскладываем пересекающиеся записи по соседним дорожкам,
            // чтобы старые/импортированные конфликты не скрывали карточки.
            const layoutItems = barberBookings.map(booking => {
                const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(booking.time || ''));
                if (!match) return null;
                const startMinutes = toMinutes(booking.time);
                const duration = getBookingDurationMinutes(booking);
                const endMinutes = startMinutes + duration;
                const top = (startMinutes - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                if (top < 0 || top >= totalHeight || endMinutes <= startMinutes) return null;
                return { booking, startMinutes, endMinutes, top, duration };
            }).filter(Boolean).sort((a, b) =>
                a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
            );

            let cluster = [];
            let clusterEnd = -1;
            const renderCluster = items => {
                if (!items.length) return;
                const laneEnds = [];
                items.forEach(item => {
                    let lane = laneEnds.findIndex(laneEnd => laneEnd <= item.startMinutes);
                    if (lane < 0) lane = laneEnds.length;
                    laneEnds[lane] = item.endMinutes;
                    item.lane = lane;
                });
                const laneCount = Math.max(laneEnds.length, 1);

                items.forEach(item => {
                    const booking = item.booking;
                    const height = Math.min(item.duration / 15 * SLOT_HEIGHT, totalHeight - item.top);
                    const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(service => escapeBookingHtml(service?.title || 'Услуга')).join(', ');
                    const bookingTotal = (Array.isArray(booking.services) ? booking.services : []).reduce((sum, service) => sum + Number(service?.price || 0), 0);
                    const payState = getBookingPaymentState(booking, bookingTotal);
                    const bookingStatus = ['active', 'pending', 'confirmed', 'completed', 'cancelled'].includes(booking.status) ? booking.status : 'active';
                    const bookingStatusLabel = bookingStatus === 'completed' ? 'Завершена' : bookingStatus === 'cancelled' ? 'Отменена' : bookingStatus === 'confirmed' ? 'Подтверждена' : bookingStatus === 'pending' ? 'Ожидает' : 'Активная';
                    const laneWidth = 100 / laneCount;
                    const left = item.lane * laneWidth;
                    html += `
                        <button type="button" draggable="true" class="desktop-booking-card ${height < 96 ? 'is-compact' : ''} ${height < 66 ? 'is-short' : ''} ${bookingStatus} payment-border-${payState.status}"
                            style="top:${item.top}px;height:${height}px;left:calc(${left}% + 3px);width:calc(${laneWidth}% - 6px);right:auto"
                            ondragstart="event.stopPropagation(); event.dataTransfer.setData('text/plain','${escapeBookingHtml(String(booking.id))}'); event.dataTransfer.effectAllowed='move'; this.classList.add('is-dragging')" ondragend="this.classList.remove('is-dragging'); document.querySelectorAll('.desktop-staff-track.is-drop-target').forEach(track=>track.classList.remove('is-drop-target'))"
                            onclick="event.stopPropagation(); openActionModal('${escapeBookingHtml(String(booking.id))}')">
                            <strong class="booking-card-client">${escapeBookingHtml(booking.clientName || 'Клиент')}</strong>
                            <span class="booking-card-badges"><i class="booking-origin origin-${getBookingSourceMeta(booking).className}">${getBookingSourceMeta(booking).label}</i><i class="booking-client-type type-${getBookingClientTypeMeta(booking).className}">${getBookingClientTypeMeta(booking).label}</i></span>
                            <span class="booking-card-service">${serviceNames || 'Услуга не указана'}</span>
                            <small class="booking-card-meta"><b>${escapeBookingHtml(booking.time || '—')}</b> · ${item.duration} мин. · ${bookingStatusLabel}</small><span class="calendar-payment-label payment-${payState.status}">${payState.label} · ${payState.paid.toLocaleString('ru-RU')} ₽</span>
                        </button>`;
                });
            };

            layoutItems.forEach(item => {
                if (cluster.length && item.startMinutes >= clusterEnd) {
                    renderCluster(cluster);
                    cluster = [];
                    clusterEnd = -1;
                }
                cluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.endMinutes);
            });
            renderCluster(cluster);
        } else {
            barberBlocks.forEach(block => {
                const blockStart = parseScheduleTimeMinutes(block.startTime);
                const blockEnd = parseScheduleTimeMinutes(block.endTime);
                if (blockStart === null || blockEnd === null || blockStart >= blockEnd) return;
                const top = (blockStart - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                const height = (blockEnd - blockStart) / 15 * SLOT_HEIGHT;
                if (top < 0 || top >= totalHeight || height <= 0) return;
                html += `
                    <button type="button" class="desktop-break-card" style="top:${top}px;height:${Math.min(height, totalHeight - top)}px"
                        onclick="event.stopPropagation(); openBlockActionModal('${escapeBookingHtml(String(block.id))}')">
                        <strong>${escapeBookingHtml(block.startTime)}–${escapeBookingHtml(block.endTime)}</strong><span>Перерыв</span>
                    </button>`;
            });
        }
        html += '</div></div>';
    });

    html += '</div></div>';
    calendar.innerHTML = html;
}

function setDesktopCalendarMode(mode) {
    window.desktopCalendarMode = ['day', 'week', 'month'].includes(mode) ? mode : 'day';
    renderDesktopSchedule();
}

function shiftScheduleMonth(offset) {
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const current = new Date(year, month - 1, day);
    if (Number.isNaN(current.getTime())) return;
    const targetDay = current.getDate();
    const target = new Date(current.getFullYear(), current.getMonth() + Number(offset || 0), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(targetDay, lastDay));
    selectedScheduleDate = target.toLocaleDateString('ru-RU');
    renderSchedule();
}

function selectCalendarDate(dateKey) {
    selectedScheduleDate = dateKey;
    window.desktopCalendarMode = 'day';
    renderSchedule();
}


function renderDateSelector() {
    const container = document.getElementById('scheduleDateSelector');
    if (!container) return;
    container.innerHTML = '';
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const selected = new Date(year, month - 1, day);
    if (Number.isNaN(selected.getTime())) return;

    for (let i = -14; i <= 15; i++) {
        const d = new Date(selected);
        d.setDate(selected.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        const todayStr = new Date().toLocaleDateString('ru-RU');
        const dayName = dateStr === todayStr ? 'Сегодня' : days[d.getDay()];
        
        const div = document.createElement('div');
        div.className = `date-selector-item ${selectedScheduleDate === dateStr ? 'selected' : ''}`;
        const canSeeAllStaff = currentUser && currentUser.role === 'admin';
        const dayBookings = bookings.filter(item => item.date === dateStr && item.status !== 'cancelled' && (canSeeAllStaff || String(item.barberId) === String(currentUser?.id)));
        const dayBlocks = timeBlocks.filter(item => item.date === dateStr && (canSeeAllStaff || String(item.barberId) === String(currentUser?.id)));
        div.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${d.getDate()}</div>
            <div class="date-selector-meta">
                <span class="date-booking-count">${dayBookings.length ? dayBookings.length + ' запис.' : '—'}</span>
                ${dayBlocks.length ? '<i class="date-block-indicator" title="Есть перерывы"></i>' : ''}
            </div>
        `;
        div.onclick = () => {
            selectedScheduleDate = dateStr;
            renderSchedule();
        };
        container.appendChild(div);
    }

    const activeDate = container.querySelector('.date-selector-item.selected');
    if (activeDate && window.innerWidth < 768) {
        activeDate.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
}
function shiftScheduleDate(offset) {
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return;
    date.setDate(date.getDate() + Number(offset || 0));
    selectedScheduleDate = date.toLocaleDateString('ru-RU');
    renderSchedule();
}

function goToScheduleToday() {
    selectedScheduleDate = new Date().toLocaleDateString('ru-RU');
    renderSchedule();
}

function switchScheduleTab(tab) {
    if (!['bookings', 'breaks'].includes(tab)) return;
    currentScheduleTab = tab;
    document.querySelectorAll('#desktopScheduleSubnav button').forEach((button, index) => {
        button.classList.toggle('active', (index === 0 && tab === 'bookings') || (index === 1 && tab === 'breaks'));
    });
    document.getElementById('tabBookings').classList.toggle('active', tab === 'bookings');
    document.getElementById('tabBreaks').classList.toggle('active', tab === 'breaks');
    renderSchedule();
}


function escapeBookingHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}


const PAYMENT_METHOD_LABELS = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', online: 'Онлайн', mixed: 'Смешанная оплата' };
function getBookingSourceMeta(booking) {
    const source = String(booking?.bookingSource || booking?.source || 'admin_panel').toLowerCase();
    const map = {
        admin_panel: { label: 'Панель', className: 'admin' },
        barber_app: { label: 'Приложение барбера', className: 'barber' },
        barber_mobile: { label: 'Приложение барбера', className: 'barber' },
        barber_phone: { label: 'Телефон барбера', className: 'phone' },
        phone_call: { label: 'Телефон', className: 'phone' },
        website: { label: 'Сайт', className: 'web' },
        site: { label: 'Сайт', className: 'web' },
        web: { label: 'Сайт', className: 'web' },
        pwa: { label: 'PWA', className: 'pwa' },
        client_pwa: { label: 'PWA клиента', className: 'pwa' },
        pwa_client: { label: 'PWA клиента', className: 'pwa' },
        client_app: { label: 'Приложение клиента', className: 'app' },
        mobile_app: { label: 'Мобильное приложение', className: 'app' },
        phone: { label: 'Телефон', className: 'phone' }
    };
    return map[source] || { label: 'Другой канал', className: 'other' };
}
function getBookingClientType(booking) {
    const currentTime = parseClientDateTime(booking);
    const profile = findClientProfile(booking?.clientName || '', booking?.barberId || '').profile;
    const phone = normalizeClientPhone(profile.phone);
    const name = String(booking?.clientName || '').trim().toLocaleLowerCase('ru-RU');
    const hadEarlierVisit = bookings.some(previous => {
        if (String(previous.id) === String(booking?.id) || previous.status !== 'completed') return false;
        const previousTime = parseClientDateTime(previous);
        if (!previousTime || (currentTime && previousTime >= currentTime)) return false;
        if (phone.length >= 7) {
            const previousProfile = findClientProfile(previous.clientName || '', previous.barberId || '').profile;
            return normalizeClientPhone(previousProfile.phone) === phone;
        }
        return String(previous.clientName || '').trim().toLocaleLowerCase('ru-RU') === name;
    });
    return hadEarlierVisit ? 'regular' : 'new';
}
function getBookingClientTypeMeta(booking) {
    return getBookingClientType(booking) === 'new'
        ? { label: 'Новый клиент', className: 'new' }
        : { label: 'Повторный клиент', className: 'returning' };
}

function getBookingServiceTotal(booking) {
    return (Array.isArray(booking?.services) ? booking.services : []).reduce((sum, service) => {
        const amount = Number(service?.price);
        return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    }, 0);
}

function getBookingCollectedAmount(booking) {
    const serviceTotal = getBookingServiceTotal(booking);
    const transactions = Array.isArray(booking?.payments) ? booking.payments : [];
    if (transactions.length) {
        const collected = transactions.reduce((sum, payment) => {
            const amount = Number(payment?.amount);
            return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
        }, 0);
        return Math.min(serviceTotal, collected);
    }
    if (Object.prototype.hasOwnProperty.call(booking || {}, 'paidAmount')) {
        const legacyPaid = Number(booking.paidAmount);
        return Math.min(serviceTotal, Number.isFinite(legacyPaid) ? Math.max(0, legacyPaid) : 0);
    }
    // Для старых записей сохраняем выручку только по завершённым визитам.
    // Будущие и незавершённые записи без отметки оплаты не считаем оплаченными.
    return booking?.status === 'completed' ? serviceTotal : 0;
}
function getBookingPaymentState(booking, total) {
    const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
    const transactions = Array.isArray(booking?.payments) ? booking.payments : [];
    const transactionTotal = transactions.reduce((sum, item) => {
        const amount = Number(item?.amount);
        return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    }, 0);
    const hasLegacyPaidAmount = Object.prototype.hasOwnProperty.call(booking || {}, 'paidAmount');
    const legacyPaidValue = Number(booking?.paidAmount || 0);
    const legacyPaid = Number.isFinite(legacyPaidValue) ? Math.max(0, legacyPaidValue) : 0;
    // Синхронизируем статус оплаты с общей функцией суммы: старые завершённые
    // записи без отдельной истории платежей считаются полностью оплаченными.
    const fallbackPaid = !transactions.length && !hasLegacyPaidAmount && booking?.status === 'completed'
        ? safeTotal
        : legacyPaid;
    const paid = Math.min(safeTotal, transactions.length ? transactionTotal : fallbackPaid);
    const status = paid <= 0 || safeTotal <= 0 ? 'unpaid' : paid >= safeTotal ? 'paid' : 'partial';
    const methods = [...new Set(transactions
        .filter(item => Number.isFinite(Number(item?.amount)) && Number(item.amount) > 0)
        .map(item => item?.method)
        .filter(Boolean))];
    const method = methods.length > 1 ? 'mixed' : (methods[0] || booking?.paymentMethod);
    return {
        paid,
        status,
        label: status === 'paid' ? 'Оплачено' : status === 'partial' ? 'Частично оплачено' : 'Не оплачено',
        method,
        methodLabel: PAYMENT_METHOD_LABELS[method] || 'Не указан',
        transactions
    };
}
let selectedPaymentBookingId = null;

function openBookingPaymentEditor(id) {
    if (!currentUser) return showToast('Войдите в приложение, чтобы изменить оплату', 'error');
    const booking = bookings.find(item => String(item.id) === String(id));
    if (!booking) return;
    if (booking.status === 'cancelled') {
        return showToast('Нельзя добавлять оплату к отменённой записи', 'error');
    }
    const total = getBookingServiceTotal(booking);
    const paymentState = getBookingPaymentState(booking, total);
    const balance = Math.max(0, total - paymentState.paid);
    if (balance <= 0) return showToast('Запись уже оплачена полностью', 'info');

    selectedPaymentBookingId = booking.id;
    const amountInput = document.getElementById('bookingPaymentAmount');
    const methodInput = document.getElementById('bookingPaymentMethod');
    const balanceLabel = document.getElementById('bookingPaymentBalance');
    if (!amountInput || !methodInput || !balanceLabel) {
        return showToast('Форма оплаты недоступна', 'error');
    }
    amountInput.value = balance.toFixed(2).replace(/\\.00$/, '');
    amountInput.max = String(balance);
    balanceLabel.textContent = 'К оплате осталось: ' + balance.toLocaleString('ru-RU') + ' ₽';
    methodInput.value = 'cash';
    setBookingPaymentMethod('cash');
    openModal('bookingPaymentModal');
}

function saveBookingPayment() {
    if (!currentUser) return showToast('Войдите в приложение, чтобы изменить оплату', 'error');
    const booking = bookings.find(item => String(item.id) === String(selectedPaymentBookingId));
    if (!booking) {
        closeModal('bookingPaymentModal');
        return showToast('Запись не найдена', 'error');
    }

    const total = getBookingServiceTotal(booking);
    const paymentState = getBookingPaymentState(booking, total);
    const balance = Math.max(0, total - paymentState.paid);
    const amountInput = document.getElementById('bookingPaymentAmount');
    const methodInput = document.getElementById('bookingPaymentMethod');
    const amount = Number(String(amountInput?.value || '').replace(',', '.'));
    const method = methodInput?.value || '';

    const amountCents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountCents) ||
        Math.abs(amount * 100 - amountCents) > 0.001 || amount > balance) {
        return showToast('Введите сумму больше 0, с точностью до копеек и не больше остатка ' + balance + ' ₽', 'error');
    }
    if (!['cash', 'card', 'transfer', 'online'].includes(method)) {
        return showToast('Выберите корректный способ оплаты', 'error');
    }

    if (!Array.isArray(booking.payments) || booking.payments.length === 0) {
        // Переносим старую оплаченную сумму в историю транзакций до добавления нового платежа.
        // Иначе пустой legacy-массив payments мог обнулить уже полученные деньги.
        booking.payments = paymentState.paid > 0
            ? [{
                amount: paymentState.paid,
                method: ['cash', 'card', 'transfer', 'online'].includes(booking.paymentMethod) ? booking.paymentMethod : 'other',
                createdAt: booking.paymentUpdatedAt || ''
            }]
            : [];
    }
    const paymentTime = new Date().toISOString();
    booking.payments.push({
        amount,
        method,
        createdAt: paymentTime,
        by: currentUser.name || ''
    });
    booking.paidAmount = booking.payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const methods = [...new Set(booking.payments.map(item => item.method).filter(Boolean))];
    booking.paymentMethod = methods.length > 1 ? 'mixed' : (methods[0] || method);
    booking.paymentUpdatedAt = paymentTime;
    addBookingHistoryEntry(booking, 'Добавлена оплата', amount.toLocaleString('ru-RU') + ' ₽ · ' + (PAYMENT_METHOD_LABELS[method] || method));

    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    selectedPaymentBookingId = null;
    closeModal('bookingPaymentModal');
    openActionModal(booking.id);
    showToast('Платёж добавлен', 'success');
}


function addBookingHistoryEntry(booking, action, details = '') {
    if (!booking) return;
    if (!Array.isArray(booking.history)) booking.history = [];
    booking.history.push({action:String(action || 'Изменение'),details:String(details || ''),at:new Date().toISOString(),by:String(currentUser?.name || 'Система')});
}
function renderBookingHistory(booking) {
    const history = Array.isArray(booking.history) ? booking.history.slice().reverse() : [];
    if (!history.length) return '<div class="booking-history-empty">История изменений начнёт заполняться с новых действий по записи</div>';
    return '<div class="booking-history-list">' + history.map(item => {
        const date = item.at ? new Date(item.at) : null;
        const stamp = date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Дата не указана';
        return '<div class="booking-history-item"><span class="booking-history-dot"></span><div><strong>' + escapeBookingHtml(item.action || 'Изменение') + '</strong>' + (item.details ? '<p>' + escapeBookingHtml(item.details) + '</p>' : '') + '<small>' + escapeBookingHtml(stamp) + ' · ' + escapeBookingHtml(item.by || 'Система') + '</small></div></div>';
    }).join('') + '</div>';
}

function openActionModal(id) {
    const booking = bookings.find(b => String(b.id) === String(id));
    if (!booking) {
        showToast('Запись не найдена', 'error');
        return;
    }

    selectedBookingId = booking.id;

    const details = document.getElementById('actionBookingDetails');
    const editBtn = document.getElementById('editBookingBtn');
    const completeBtn = document.getElementById('completeBookingBtn');
    const cancelBtn = document.getElementById('cancelBookingBtn');

    const barber = mockStaff.find(s => s.id === booking.barberId);
    const services = Array.isArray(booking.services) ? booking.services : [];
    const total = getBookingServiceTotal(booking);
    const duration = getBookingDurationMinutes(booking);
    const [startHour = 0, startMinute = 0] = String(booking.time || '00:00').split(':').map(Number);
    const endMinutes = startHour * 60 + startMinute + duration;
    const endTime = duration
        ? `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        : booking.time || '—';

    const statusLabels = {
        active: 'Активная',
        pending: 'Ожидает подтверждения',
        confirmed: 'Подтверждена',
        completed: 'Завершена',
        cancelled: 'Отменена'
    };
    const statusKey = booking.status || 'active';
    const status = statusLabels[statusKey] || statusKey;
    const payment = getBookingPaymentState(booking, total);
    const canManage = isAdminUser();
    const canChangeStatus = isBookingBlockingSchedule(booking);

    details.innerHTML = `
        <div class="booking-detail-status ${escapeBookingHtml(statusKey)}">
            ${escapeBookingHtml(status)}
        </div>
        <div class="booking-detail-main">
            <div class="booking-detail-client">${escapeBookingHtml(booking.clientName || 'Клиент')}</div>
            <div class="booking-detail-date">${escapeBookingHtml(booking.date || 'Дата не указана')} · ${escapeBookingHtml(booking.time || '—')}–${escapeBookingHtml(endTime)}</div>
            <div class="booking-card-badges">
                <i class="booking-origin origin-${getBookingSourceMeta(booking).className}">${getBookingSourceMeta(booking).label}</i>
                <i class="booking-client-type type-${getBookingClientTypeMeta(booking).className}">${getBookingClientTypeMeta(booking).label}</i>
            </div>
        </div>
        <div class="booking-detail-row">
            <span>Мастер</span>
            <strong>${escapeBookingHtml(barber?.name || '—')}</strong>
        </div>
        <div class="booking-detail-services">
            <span class="booking-detail-section-label">Состав записи</span>
            ${services.length
                ? services.map(service => `<div class="booking-detail-service"><span>${escapeBookingHtml(service.title || 'Услуга')}</span><strong>${(Number(service.price) || 0).toLocaleString('ru-RU')} ₽</strong></div>`).join('')
                : '<div class="booking-detail-service"><span>Услуги не указаны</span></div>'}
        </div>
        <div class="booking-detail-row">
            <span>Количество услуг</span><strong>${services.length}</strong>
        </div>
        <div class="booking-detail-row booking-detail-total">
            <span>Стоимость</span><strong>${total.toLocaleString('ru-RU')} ₽</strong>
        </div>
        <div class="booking-payment-panel">
            <div class="booking-payment-heading"><span>Оплата</span><strong class="payment-state payment-${payment.status}">${payment.label}</strong></div>
            <div class="booking-payment-meta">Внесено: ${payment.paid.toLocaleString('ru-RU')} ₽ · Остаток: ${Math.max(0, total-payment.paid).toLocaleString('ru-RU')} ₽</div>
            <div class="booking-payment-meta">Способ: ${escapeBookingHtml(payment.methodLabel)}</div>
            ${payment.transactions.length ? '<div class="booking-payment-history">' + payment.transactions.map(item => '<div class="booking-payment-transaction"><span>' + escapeBookingHtml(item.method ? (PAYMENT_METHOD_LABELS[item.method] || item.method) : 'Ранее внесено') + '</span><strong>' + Number(item.amount || 0).toLocaleString('ru-RU') + ' ₽</strong></div>').join('') + '</div>' : ''}

            ${currentUser && booking.status !== 'cancelled' ? '<button type="button" class="booking-payment-edit" onclick="openBookingPaymentEditor(\'' + escapeBookingHtml(String(booking.id)) + '\')">Добавить оплату</button>' : ''}
        </div>
        <div class="booking-detail-row">
            <span>Длительность</span><strong>${duration} мин.</strong>
        </div>
        <button type="button" class="booking-client-link" id="bookingClientLink">
            Открыть историю клиента →
        </button>
        <section class="booking-history-section">
            <div class="booking-history-heading"><strong>История записи</strong></div>
            ${renderBookingHistory(booking)}
        </section>
    `;

    const clientBtn = document.getElementById('bookingClientLink');
    if (clientBtn) {
        clientBtn.onclick = () => {
            closeModal('actionModal');
            showClientDetails(booking.clientName, booking.barberId);
        };
    }

    if (editBtn) editBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';
    completeBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';
    cancelBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';

    openModal('actionModal');
}

function openEditBooking() {
    if (!requireAdminAction('Редактировать записи может только Али')) return;
    const booking = bookings.find(
        b => String(b.id) === String(selectedBookingId)
    );

    if (!booking) {
        return showToast('Запись не найдена', 'error');
    }

    if (!isBookingBlockingSchedule(booking)) {
        return showToast('Завершённую или отменённую запись нельзя редактировать', 'error');
    }

    const availableStaff = mockStaff;
    if (!availableStaff.some(s => s.id === booking.barberId)) {
        return showToast('Мастер не найден', 'error');
    }

    const dateMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(booking.date || ''));
    const bookingTime = parseScheduleTimeMinutes(booking.time);
    if (!dateMatch || bookingTime === null) {
        return showToast('У записи некорректные дата или время. Исправьте данные перед редактированием', 'error');
    }
    const [, day, month, year] = dateMatch;
    const dateValue = `${year}-${month}-${day}`;
    const parsedDate = new Date(dateValue + 'T00:00:00');
    if (Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== Number(year) ||
        parsedDate.getMonth() + 1 !== Number(month) ||
        parsedDate.getDate() !== Number(day)) {
        return showToast('У записи некорректная дата. Исправьте её перед редактированием', 'error');
    }

    editingBookingId = booking.id;
    const repeatToggle = document.getElementById('repeatBookingWeekly');
    if (repeatToggle) repeatToggle.checked = false;
    const repeatCountWrap = document.getElementById('bookingRepeatCountWrap');
    if (repeatCountWrap) repeatCountWrap.hidden = true;

    const barberSelect = document.getElementById('newBookingBarber');
    if (!barberSelect) {
        editingBookingId = null;
        return showToast('Форма редактирования недоступна', 'error');
    }

    barberSelect.innerHTML = availableStaff.map(s =>
        `<option value="${escapeBookingHtml(String(s.id))}">${escapeBookingHtml(s.name)}</option>`
    ).join('');

    if (!availableStaff.some(s => s.id === booking.barberId)) {
        return showToast('Нет доступа к этому мастеру', 'error');
    }

    barberSelect.value = booking.barberId;
    renderBookingBarberChoices();

    document.getElementById('newBookingClient').value = booking.clientName;
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = booking.clientPhone || '';

    document.getElementById('newBookingDate').value = booking.date;

    document.getElementById('newBookingTime').value = booking.time;

    updateNewBookingServices();

    const selectedIds = (booking.services || []).map(s => s.id);

    document.querySelectorAll('#newBookingServicesList input').forEach(input => {
        input.checked = selectedIds.includes(input.value);
    });

    updateNewBookingSummary();

    document.querySelector('#newBookingModal h2').textContent =
        'Перенос / изменение записи';

    document.querySelector('#newBookingModal .checkout-btn').textContent =
        'Сохранить изменения';

    closeModal('actionModal');
    openModal('newBookingModal');
}


function completeBooking() {
    if (!requireAdminAction('Изменять статус записи может только Али')) return;
    const booking = bookings.find(b => String(b.id) === String(selectedBookingId));
    if (!booking) return showToast('Запись не найдена', 'error');
    if (!isBookingBlockingSchedule(booking)) {
        return showToast('Эта запись уже завершена или отменена', 'info');
    }

    booking.status = 'completed';
    addBookingHistoryEntry(booking, 'Визит завершён');
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    closeModal('actionModal');
    showToast('Запись завершена', 'success');
    renderSchedule();
    if (currentUser.role === 'admin') renderFinance();
    renderBarberRevenue();
}

function openCancelBookingModal() {
    if (!requireAdminAction('Отменять записи может только Али')) return;
    const booking = bookings.find(b => String(b.id) === String(selectedBookingId));
    if (!booking || !isBookingBlockingSchedule(booking)) return showToast('Эту запись нельзя отменить', 'info');
    const reason = document.getElementById('bookingCancelReason');
    const note = document.getElementById('bookingCancelNote');
    if (reason) reason.value = 'Клиент отменил запись';
    if (note) note.value = '';
    closeModal('actionModal');
    openModal('bookingCancelModal');
}
function cancelBooking() {
    if (!requireAdminAction('Отменять записи может только Али')) return;
    const booking = bookings.find(b => String(b.id) === String(selectedBookingId));
    if (!booking) return showToast('Запись не найдена', 'error');
    if (!isBookingBlockingSchedule(booking)) return showToast('Эта запись уже завершена или отменена', 'info');
    const reason = document.getElementById('bookingCancelReason')?.value || '';
    const note = document.getElementById('bookingCancelNote')?.value.trim() || '';
    if (!reason) return showToast('Выберите причину отмены', 'error');
    booking.status = 'cancelled';
    booking.cancelReason = reason;
    booking.cancelNote = note;
    addBookingHistoryEntry(booking, 'Запись отменена', reason + (note ? ' — ' + note : ''));
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    closeModal('bookingCancelModal');
    showToast('Запись отменена', 'success');
    renderSchedule();
    if (currentUser.role === 'admin') renderFinance();
    const matches = getWaitlistMatchesForSlot(booking);
    if (matches.length) openWaitlistSlotSuggestions(booking.id);
}

function getWaitlistMatchesForSlot(booking) {
    const serviceNames = (booking.services || []).map(service => String(service.title || '').trim().toLowerCase()).filter(Boolean);
    return waitlistEntries.filter(item => (item.status || 'waiting') !== 'closed' &&
        (!item.date || item.date === booking.date) &&
        (!item.time || item.time === booking.time) &&
        (!item.barberId || String(item.barberId) === String(booking.barberId)) &&
        (!item.serviceTitle || serviceNames.includes(String(item.serviceTitle).trim().toLowerCase()))
    ).sort((a,b) => ({urgent:0,high:1,normal:2}[a.priority||'normal'] - {urgent:0,high:1,normal:2}[b.priority||'normal']) || new Date(a.createdAt||0)-new Date(b.createdAt||0));
}
function openWaitlistSlotSuggestions(bookingId) {
    const booking = bookings.find(item => String(item.id) === String(bookingId));
    const host = document.getElementById('waitlistSlotSuggestionsList');
    if (!booking || !host) return;
    const matches = getWaitlistMatchesForSlot(booking);
    if (!matches.length) return;
    host.innerHTML = matches.map(item => `<article class="waitlist-suggestion-row"><div><strong>${escapeBookingHtml(item.clientName)}</strong><small>${escapeBookingHtml(item.phone || 'Телефон не указан')} · ${escapeBookingHtml(item.serviceTitle || 'Любая услуга')}</small><span class="waitlist-priority priority-${item.priority||'normal'}">${item.priority==='urgent'?'Срочно':item.priority==='high'?'Высокий приоритет':'Обычный приоритет'}</span></div><button type="button" onclick="promoteWaitlistToFreedSlot('${escapeBookingHtml(item.id)}','${escapeBookingHtml(booking.id)}')">Предложить слот</button></article>`).join('');
    const caption = document.getElementById('waitlistSlotSuggestionsCaption');
    if (caption) caption.textContent = booking.date + ' · ' + booking.time + ' · ' + (mockStaff.find(person => String(person.id) === String(booking.barberId))?.name || 'Мастер');
    openModal('waitlistSlotSuggestionsModal');
}
function promoteWaitlistToFreedSlot(waitlistId, bookingId) {
    if (!requireAdminAction('Создавать записи может только администратор')) return;
    const item = waitlistEntries.find(entry => String(entry.id) === String(waitlistId));
    const slot = bookings.find(entry => String(entry.id) === String(bookingId));
    if (!item || !slot) return;
    openNewBookingModal(slot.barberId, slot.time, slot.date);
    const client = document.getElementById('newBookingClient'); if (client) client.value = item.clientName;
    const phone = document.getElementById('newBookingClientPhone'); if (phone) phone.value = item.phone || '';
    const barber = document.getElementById('newBookingBarber'); if (barber) barber.value = slot.barberId;
    renderBookingBarberChoices(); updateNewBookingServices();
    if (item.serviceId) { const option=document.querySelector('#newBookingServicesList input[value="'+CSS.escape(String(item.serviceId))+'"]'); if(option){option.checked=true;updateNewBookingSummary();} }
    editingWaitlistId = item.id;
    closeModal('waitlistSlotSuggestionsModal');
    showToast('Клиент выбран для освободившегося времени. Проверьте и сохраните запись','info');
}


function updateBlockBarberSelect(selectedId = '') {
    const group = document.getElementById('blockBarberGroup');
    const select = document.getElementById('blockBarberSelect');
    if (!group || !select) return;

    const isAdmin = currentUser.role === 'admin';
    group.style.display = isAdmin ? 'block' : 'none';

    const staff = isAdmin
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);

    select.innerHTML = staff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const targetId = selectedId || currentUser.id;
    if (staff.some(s => s.id === targetId)) {
        select.value = targetId;
    }
}


// --- БЛОКИРОВКА ВРЕМЕНИ ---

function openBlockTimeModal() {
    if (!requireAdminAction('Создавать перерывы может только Али')) return;
    editingBlockId = null;

    const selectedDate = parseReportDate(selectedScheduleDate) || new Date();
    selectedBlockDate = formatReportDate(selectedDate);

    document.getElementById('customDateDisplay').innerText = selectedBlockDate;

    pickerYear = selectedDate.getFullYear();
    pickerMonth = selectedDate.getMonth();

    document.getElementById('blockStartTime').value = '';
    document.getElementById('blockEndTime').value = '';
    document.getElementById('blockAllDay').checked = false;
    document.getElementById('blockRepeatWeekly').checked = false;
    toggleBlockAllDay();

    updateBlockBarberSelect();

    document.querySelector('#blockTimeModal h2').innerText = 'Блокировка времени';
    document.querySelector('#blockTimeModal .checkout-btn').innerText = 'Заблокировать';

    openModal('blockTimeModal');
}

// Функции для календаря
function openNewBookingDatePicker() {
    const input = document.getElementById('newBookingDate');
    if (!input) return;
    calendarTargetInputId = 'newBookingDate';
    const parts = input.value ? input.value.split('.').map(Number) : [];
    const base = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
    selectedBlockDate = input.value || base.toLocaleDateString('ru-RU');
    pickerYear = base.getFullYear();
    pickerMonth = base.getMonth();
    renderCalendar();
    openModal('calendarModal');
}

function openCustomDatePicker() {
    calendarTargetInputId = null;
    renderCalendar();
    openModal('calendarModal');
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    document.getElementById('calendarMonthYearDisplay').innerText = `${monthNames[pickerMonth]} ${pickerYear}`;

    grid.innerHTML = '';
    
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    let startDayOfWeek = firstDay.getDay(); // 0=Вс, 1=Пн
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Сдвигаем Вс на 7 место
    
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

    // Пустые ячейки до 1-го числа
    for (let i = 1; i < startDayOfWeek; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    // Дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = i;
        
        const thisDateStr = `${String(i).padStart(2, '0')}.${String(pickerMonth + 1).padStart(2, '0')}.${pickerYear}`;
        
        if (thisDateStr === selectedBlockDate) {
            dayDiv.classList.add('selected');
        }

        dayDiv.onclick = () => {
            selectedBlockDate = thisDateStr;
            if (reportDatePickerTarget) {
                const target = reportDatePickerTarget;
                if (target === 'financeStart') { financeRangeStart = thisDateStr; if (parseReportDate(financeRangeStart) > parseReportDate(financeRangeEnd)) financeRangeEnd = thisDateStr; }
                if (target === 'financeEnd') { financeRangeEnd = thisDateStr; if (parseReportDate(financeRangeEnd) < parseReportDate(financeRangeStart)) financeRangeStart = thisDateStr; }
                if (target === 'clientsStart') { clientsRangeStart = thisDateStr; if (parseReportDate(clientsRangeStart) > parseReportDate(clientsRangeEnd)) clientsRangeEnd = thisDateStr; }
                if (target === 'clientsEnd') { clientsRangeEnd = thisDateStr; if (parseReportDate(clientsRangeEnd) < parseReportDate(clientsRangeStart)) clientsRangeStart = thisDateStr; }
                if (target === 'teamStart') { teamRangeStart = thisDateStr; if (parseReportDate(teamRangeStart) > parseReportDate(teamRangeEnd)) teamRangeEnd = thisDateStr; }
                if (target === 'teamEnd') { teamRangeEnd = thisDateStr; if (parseReportDate(teamRangeEnd) < parseReportDate(teamRangeStart)) teamRangeStart = thisDateStr; }
                reportDatePickerTarget = null;
                closeModal('calendarModal');
                if (target.startsWith('dashboard')) {
                    if (target === 'dashboardDay') {
                        dashboardSelectedDate = thisDateStr;
                        dashboardRangeStart = dashboardRangeEnd = thisDateStr;
                        dashboardPeriodMode = 'day';
                    } else if (target === 'dashboardStart') {
                        dashboardRangeStart = thisDateStr;
                        if (parseReportDate(dashboardRangeEnd) < parseReportDate(dashboardRangeStart)) dashboardRangeEnd = thisDateStr;
                    } else {
                        dashboardRangeEnd = thisDateStr;
                        if (parseReportDate(dashboardRangeEnd) < parseReportDate(dashboardRangeStart)) dashboardRangeStart = thisDateStr;
                    }
                    renderDashboard();
                }
                else if (target.startsWith('finance')) renderFinance();
                else if (target.startsWith('clients')) renderClients(currentClientsTab);
                else renderTeam();
                return;
            }
            if (calendarTargetInputId === 'newBookingDate' || calendarTargetInputId === 'waitlistDate') {
                const target = document.getElementById(calendarTargetInputId);
                if (target) target.value = thisDateStr;
                calendarTargetInputId = null;
                if (target?.id === 'newBookingDate') renderAvailableBookingSlots();
            } else {
                const display = document.getElementById('customDateDisplay');
                if (display) display.innerText = selectedBlockDate;
            }
            closeModal('calendarModal');
        };
        grid.appendChild(dayDiv);
    }
}

function changeMonth(delta) {
    pickerMonth += delta;
    if (pickerMonth < 0) {
        pickerMonth = 11;
        pickerYear--;
    } else if (pickerMonth > 11) {
        pickerMonth = 0;
        pickerYear++;
    }
    renderCalendar();
}




function moveBookingToSlot(event, barberId, date) {
    if (!requireAdminAction('Перемещать записи может только Али')) return;
    const bookingId = event.dataTransfer?.getData('text/plain');
    const booking = bookings.find(item => String(item.id) === String(bookingId));
    if (!booking || !isBookingBlockingSchedule(booking)) return;
    if (!mockStaff.some(person => String(person.id) === String(barberId))) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Один 15-минутный слот календаря занимает 30px.
    const slotIndex = Math.max(0, Math.floor((event.clientY - rect.top) / 30));
    const start = 8 * 60 + slotIndex * 15;
    const duration = getBookingDurationMinutes(booking);
    const end = start + duration;
    if (end > 22 * 60) return showToast('Запись должна завершаться не позже 22:00', 'error');
    if (!isWithinBarberWorkSchedule(barberId,date,start,end)) return showToast('Это время вне рабочего графика мастера','error');
    const time = String(Math.floor(start / 60)).padStart(2,'0') + ':' + String(start % 60).padStart(2,'0');
    const overlaps = (a,b,c,d) => a < d && b > c;
    const conflict = bookings.find(other => {
        if (String(other.id) === String(booking.id) || other.date !== date || String(other.barberId) !== String(barberId) || !isBookingBlockingSchedule(other)) return false;
        const otherStart = parseScheduleTimeMinutes(other.time);
        return otherStart !== null && overlaps(start,end,otherStart,otherStart+getBookingDurationMinutes(other));
    });
    if (conflict) return showToast('У мастера уже есть запись в ' + conflict.time, 'error');
    const block = timeBlocks.find(item => {
        if (item.date !== date || String(item.barberId) !== String(barberId)) return false;
        const blockStart = parseScheduleTimeMinutes(item.startTime);
        const blockEnd = parseScheduleTimeMinutes(item.endTime);
        return blockStart !== null && blockEnd !== null && overlaps(start,end,blockStart,blockEnd);
    });
    if (block) return showToast('Это время занято перерывом', 'error');
    if (booking.date === date && String(booking.barberId) === String(barberId) && booking.time === time) return showToast('Запись уже находится в этом времени', 'info');
    const previous = booking.date + ' · ' + booking.time + ' · ' + (mockStaff.find(person => String(person.id) === String(booking.barberId))?.name || 'Мастер');
    const next = date + ' · ' + time + ' · ' + (mockStaff.find(person => String(person.id) === String(barberId))?.name || 'Мастер');
    booking.date = date; booking.barberId = String(barberId); booking.time = time;
    addBookingHistoryEntry(booking, 'Запись перенесена', previous + ' → ' + next);
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    // Сохраняем позицию страницы и прокрутку календаря до полного перерендера.
    const scrollState = {
        page: document.scrollingElement?.scrollTop || window.scrollY || 0,
        view: document.getElementById('viewSchedule')?.scrollTop || 0,
        calendarTop: document.querySelector('#desktopSchedule .desktop-calendar-scroll')?.scrollTop || 0,
        calendarLeft: document.querySelector('#desktopSchedule .desktop-calendar-scroll')?.scrollLeft || 0
    };
    selectedScheduleDate = date;
    renderSchedule();
    const restoreScroll = () => {
        if (document.scrollingElement) document.scrollingElement.scrollTop = scrollState.page;
        window.scrollTo(0, scrollState.page);
        const view = document.getElementById('viewSchedule');
        if (view) view.scrollTop = scrollState.view;
        const calendarScroll = document.querySelector('#desktopSchedule .desktop-calendar-scroll');
        if (calendarScroll) { calendarScroll.scrollTop = scrollState.calendarTop; calendarScroll.scrollLeft = scrollState.calendarLeft; }
    };
    // renderSchedule() обновляет desktop-календарь с задержкой 200 мс.
    // Восстанавливаем прокрутку только после того, как новый .desktop-calendar-scroll уже создан.
    // Раньше восстановление происходило до перерисовки, поэтому новый календарь начинался с 08:00.
    setTimeout(() => {
        requestAnimationFrame(() => {
            restoreScroll();
            requestAnimationFrame(restoreScroll);
        });
    }, 260);
    showToast('Запись перенесена', 'success');
}
function openNewBookingAtExactSlot(event, barberId, date, time) {
    event.preventDefault();
    event.stopPropagation();
    if (!requireAdminAction('Создавать записи может только Али')) return;
    if (currentScheduleTab !== 'bookings') return;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time))) return;
    openNewBookingModal(barberId, time, date);
}

function openNewBookingFromSlot(event, barberId, date) {
    if (!requireAdminAction('Создавать записи может только Али')) return;
    if (currentScheduleTab !== 'bookings') return;

    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();

    const SLOT_HEIGHT = 30;
    const START_HOUR = 8;

    const offsetY = Math.max(0, event.clientY - rect.top);
    const slotIndex = Math.floor(offsetY / SLOT_HEIGHT);

    const totalMinutes = START_HOUR * 60 + slotIndex * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes + 45 > 22 * 60) {
        showToast('На это время нельзя поставить запись', 'error');
        return;
    }

    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    openNewBookingModal(barberId, time, date);
}



let activeTimePickerInputId = null;
let calendarTargetInputId = null;

function openTimePicker(inputId) {
    const input = document.getElementById(inputId);
    const grid = document.getElementById('timePickerGrid');
    if (!input || !grid) return;
    activeTimePickerInputId = inputId;
    const current = input.value || '10:00';
    grid.innerHTML = '';
    for (let minutes = 8 * 60; minutes <= 21 * 60 + 45; minutes += 15) {
        const value = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'time-picker-option' + (value === current ? ' is-selected' : '');
        option.textContent = value;
        option.onclick = () => selectTimePickerValue(value);
        grid.appendChild(option);
    }
    openModal('timePickerModal');
}

function selectTimePickerValue(value) {
    const input = document.getElementById(activeTimePickerInputId);
    if (!input) return;
    if (inputIdIsBookingTime(activeTimePickerInputId) && input.max && value > input.max) {
        return showToast('Это время не подходит для выбранной длительности услуг', 'error');
    }
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (activeTimePickerInputId === 'newBookingTime') renderAvailableBookingSlots();
    closeModal('timePickerModal');
}

function inputIdIsBookingTime(inputId) {
    return inputId === 'newBookingTime';
}

function setBookingPaymentMethod(method) {
    const select = document.getElementById('bookingPaymentMethod');
    if (!select || !['cash', 'card', 'transfer', 'online'].includes(method)) return;
    select.value = method;
    document.querySelectorAll('#bookingPaymentMethodChoices .payment-choice').forEach(button => {
        button.classList.toggle('is-selected', button.dataset.method === method);
    });
}

function renderBookingBarberChoices() {
    const select = document.getElementById('newBookingBarber');
    const container = document.getElementById('bookingBarberChoices');
    if (!select || !container) return;

    container.innerHTML = '';
    Array.from(select.options).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'booking-barber-choice' + (option.value === select.value ? ' is-selected' : '');
        button.textContent = option.textContent;
        button.setAttribute('aria-pressed', option.value === select.value ? 'true' : 'false');
        button.addEventListener('click', () => {
            select.value = option.value;
            renderBookingBarberChoices();
            updateNewBookingServices();
        });
        container.appendChild(button);
    });
}

function openNewBookingModal(barberId = '', time = '', date = selectedScheduleDate) {
    if (!requireAdminAction('Создавать записи может только Али')) return;
    editingBookingId = null;
    editingWaitlistId = null;
    const repeatToggle = document.getElementById('repeatBookingWeekly');
    if (repeatToggle) repeatToggle.checked = false;
    const repeatCountWrap = document.getElementById('bookingRepeatCountWrap');
    if (repeatCountWrap) repeatCountWrap.hidden = true;

    document.querySelector('#newBookingModal h2').textContent = 'Новая запись';
    document.querySelector('#newBookingModal .checkout-btn').textContent = 'Создать запись';
    const barberSelect = document.getElementById('newBookingBarber');
    const dateInput = document.getElementById('newBookingDate');
    const timeInput = document.getElementById('newBookingTime');
    const clientInput = document.getElementById('newBookingClient');

    if (!barberSelect || !dateInput || !timeInput || !clientInput) return;

    const availableStaff = currentUser.role === 'admin'
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);

    barberSelect.innerHTML = availableStaff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const defaultBarber = barberId || currentUser.id;
    if (availableStaff.some(s => s.id === defaultBarber)) {
        barberSelect.value = defaultBarber;
    }
    renderBookingBarberChoices();

    const parts = date.split('.');
    dateInput.value = parts.length === 3 ? date : '';

    timeInput.value = time || '10:00';
    clientInput.value = '';
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = '';
    const lookup = document.getElementById('bookingClientLookup');
    if (lookup) lookup.innerHTML = '';

    updateNewBookingServices();
    openModal('newBookingModal');
}


function lookupBookingClientByPhone() {
    const phoneInput=document.getElementById('newBookingClientPhone');
    const host=document.getElementById('bookingClientLookup');
    if(!phoneInput||!host)return;
    const phone=normalizeClientPhone(phoneInput.value);
    if(phone.length<7){host.innerHTML='';return}
    const matches=[];
    const seen=new Set();
    Object.entries(clientProfiles).forEach(([key,profile])=>{
        if(normalizeClientPhone(profile?.phone)!==phone)return;
        const identity=String(profile.clientName||profile.name||key);
        if(seen.has(identity))return;
        seen.add(identity);
        matches.push({key,profile});
    });
    if(!matches.length){
        host.innerHTML='<div class="booking-client-lookup-new">Новый номер — клиент будет добавлен в CRM после создания записи</div>';
        return;
    }
    const match=matches[0];
    const clientName=String(match.profile.clientName||match.profile.name||'').trim();
    const visitBookings=bookings.filter(booking=>{
        const profile=findClientProfile(booking.clientName||'',booking.barberId||'').profile;
        return normalizeClientPhone(profile.phone)===phone;
    });
    const completed=visitBookings.filter(booking=>booking.status==='completed').length;
    const last=visitBookings.slice().sort((a,b)=>{
        const pa=parseReportDate(a.date),pb=parseReportDate(b.date);
        return (pb?.getTime()||0)-(pa?.getTime()||0);
    })[0];
    if(clientName)document.getElementById('newBookingClient').value=clientName;
    host.innerHTML='<button type="button" class="booking-client-match" onclick="applyBookingClientMatch(\''+String(match.key).replace(/\\/g,'\\\').replace(/'/g,"\'")+'\')"><span class="booking-client-match-icon">✓</span><span class="booking-client-match-copy"><strong>'+escapeBookingHtml(clientName||'Клиент найден')+'</strong><small>В CRM · '+completed+' завершённых визитов'+(last?' · последний '+escapeBookingHtml(last.date):'')+'</small></span><span class="booking-client-match-tag">'+(completed?'Повторный':'Есть профиль')+'</span></button>';
}
function applyBookingClientMatch(key) {
    const profile=clientProfiles[key];
    if(!profile)return;
    const name=String(profile.clientName||profile.name||'').trim();
    if(name)document.getElementById('newBookingClient').value=name;
    const phone=document.getElementById('newBookingClientPhone');
    if(phone)phone.value=profile.phone||phone.value;
    const host=document.getElementById('bookingClientLookup');
    if(host)host.innerHTML='<div class="booking-client-lookup-new">Профиль клиента выбран</div>';
}

function updateNewBookingServices() {
    const barberId = document.getElementById('newBookingBarber')?.value;
    const container = document.getElementById('newBookingServicesList');
    if (!barberId || !container) return;

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    container.innerHTML = catalog.map(service => `
        <label class="new-booking-service-option">
            <input type="checkbox"
                value="${escapeBookingHtml(String(service.id))}"
                onchange="updateNewBookingSummary()">
            <span>${escapeBookingHtml(service.title)}</span>
            <strong>${(Number(service.price) || 0).toLocaleString('ru-RU')} ₽ · ${getServiceDurationMinutes(service)} мин.</strong>
        </label>
    `).join('');

    updateNewBookingSummary();
}

function updateNewBookingSummary() {
    const barberId = document.getElementById('newBookingBarber')?.value;
    const container = document.getElementById('newBookingServicesList');
    if (!barberId || !container) return;

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    const selectedIds = [...container.querySelectorAll('input:checked')]
        .map(input => input.value);

    const selected = catalog.filter(s => selectedIds.includes(String(s.id)));
    const duration = selected.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0);
    const price = selected.reduce((sum, s) => sum + Number(s.price || 0), 0);

    document.getElementById('newBookingDuration').textContent =
        `${duration} минут`;

    document.getElementById('newBookingPrice').textContent =
        `${price.toLocaleString('ru-RU')} ₽`;

    renderAvailableBookingSlots();

    // Ограничиваем последнее допустимое время начала так, чтобы все услуги
    // завершались до закрытия расписания в 22:00.
    const timeInput = document.getElementById('newBookingTime');
    if (timeInput) {
        const latestStart = Math.max(8 * 60, 22 * 60 - duration);
        const maxHours = String(Math.floor(latestStart / 60)).padStart(2, '0');
        const maxMinutes = String(latestStart % 60).padStart(2, '0');
        timeInput.max = `${maxHours}:${maxMinutes}`;
        if (timeInput.value && timeInput.value > timeInput.max) {
            timeInput.setCustomValidity('Выбранное время не подходит для длительности услуг');
        } else {
            timeInput.setCustomValidity('');
        }
    }
}



function renderAvailableBookingSlots() {
    const host=document.getElementById('availableSlotsList');
    if(!host)return;
    const barberId=document.getElementById('newBookingBarber')?.value;
    const dateValue=document.getElementById('newBookingDate')?.value;
    const container=document.getElementById('newBookingServicesList');
    const timeInput=document.getElementById('newBookingTime');
    if(!barberId||!dateValue||!container){host.innerHTML='<div class="available-slots-empty">Выберите мастера и дату</div>';return}
    const catalog=(barberId==='b_al'?servicesData.top:servicesData.barber).filter(service=>service.active!==false);
    const selectedIds=[...container.querySelectorAll('input:checked')].map(input=>input.value);
    const duration=catalog.filter(service=>selectedIds.includes(String(service.id))).reduce((sum,service)=>sum+getServiceDurationMinutes(service),0);
    if(!duration){host.innerHTML='<div class="available-slots-empty">Сначала выберите услуги</div>';return}
    if(!parseReportDate(dateValue)){host.innerHTML='<div class="available-slots-empty">Выберите корректную дату</div>';return}
    const overlaps=(a,b,c,d)=>a<d&&b>c;
    const workDay=getBarberWorkDay(barberId,dateValue);
    if(!workDay.enabled){host.innerHTML='<div class="available-slots-empty">У мастера выходной в этот день</div>';return}
    const workStart=parseScheduleTimeMinutes(workDay.start),workEnd=parseScheduleTimeMinutes(workDay.end);
    if(workStart===null||workEnd===null||workStart>=workEnd){host.innerHTML='<div class="available-slots-empty">Рабочий график не настроен корректно</div>';return}
    const busyBookings=bookings.filter(booking=>booking.date===dateValue&&String(booking.barberId)===String(barberId)&&String(booking.id)!==String(editingBookingId)&&isBookingBlockingSchedule(booking)).map(booking=>{const start=parseScheduleTimeMinutes(booking.time);return start===null?null:{start,end:start+getBookingDurationMinutes(booking)}}).filter(Boolean);
    const busyBlocks=timeBlocks.filter(block=>block.date===dateValue&&String(block.barberId)===String(barberId)).map(block=>({start:parseScheduleTimeMinutes(block.startTime),end:parseScheduleTimeMinutes(block.endTime)})).filter(block=>block.start!==null&&block.end!==null&&block.start<block.end);
    const slots=[];
    for(let start=Math.ceil(workStart/15)*15;start+duration<=workEnd;start+=15){
        const end=start+duration;
        if(busyBookings.some(item=>overlaps(start,end,item.start,item.end)))continue;
        if(busyBlocks.some(item=>overlaps(start,end,item.start,item.end)))continue;
        slots.push(start);
    }
    if(!slots.length){host.innerHTML='<div class="available-slots-empty">Свободных окон для выбранной длительности нет</div>';return}
    host.innerHTML=slots.map(start=>{
        const value=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');
        return "<button type='button' class='available-slot "+(timeInput?.value===value?'is-selected':'')+"' onclick='selectAvailableBookingSlot(\""+value+"\")'>"+value+"</button>";
    }).join('');
}
function selectAvailableBookingSlot(value) {
    const input=document.getElementById('newBookingTime');
    if(!input)return;
    input.value=value;
    input.setCustomValidity('');
    renderAvailableBookingSlots();
}

function parseScheduleTimeMinutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function getServiceDurationMinutes(service) {
    const duration = Number(service?.duration);
    return Number.isFinite(duration) && Number.isInteger(duration) && duration > 0
        ? duration
        : 45;
}

function getBookingDurationMinutes(booking) {
    const services = Array.isArray(booking?.services) ? booking.services : [];
    return services.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0) || 45;
}

function isBookingBlockingSchedule(booking) {
    // Старые записи используют статус active; новые статусы также должны
    // занимать время мастера до завершения или отмены.
    return ['active', 'pending', 'confirmed'].includes(booking?.status || 'active');
}

function toggleBookingRepeatOptions() { const enabled=Boolean(document.getElementById('repeatBookingWeekly')?.checked); const wrap=document.getElementById('bookingRepeatCountWrap'); if(wrap) wrap.hidden=!enabled; }

function saveNewBooking() {
    if (!requireAdminAction('Создавать и изменять записи может только Али')) return;
    const clientName = document.getElementById('newBookingClient').value.trim();
    const barberId = document.getElementById('newBookingBarber').value;
    const dateValue = document.getElementById('newBookingDate').value;
    const time = document.getElementById('newBookingTime').value;
    const container = document.getElementById('newBookingServicesList');

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    const selectedIds = [...container.querySelectorAll('input:checked')]
        .map(input => input.value);

    const selectedServices = catalog.filter(s => selectedIds.includes(String(s.id)));

    if (!clientName || !barberId || !dateValue || !time || !selectedServices.length) {
        return showToast('Укажите клиента, мастера, услуги, дату и время', 'error');
    }

    const [day, month, year] = dateValue.split('.').map(Number);
    const date = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;

    const parsedDate = new Date(year, month - 1, day);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
        !/^\d{2}\.\d{2}\.\d{4}$/.test(dateValue) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() + 1 !== month ||
        parsedDate.getDate() !== day) {
        return showToast('Укажите корректные дату и время записи', 'error');
    }

    const [hours, minutes] = time.split(':').map(Number);
    const start = hours * 60 + minutes;
    const duration = selectedServices.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0);
    const end = start + duration;

    if (start < 8 * 60 || end > 22 * 60) {
        return showToast('Запись должна завершаться не позже 22:00', 'error');
    }
    if (!isWithinBarberWorkSchedule(barberId,date,start,end)) return showToast('Это время вне рабочего графика мастера','error');

    const overlaps = (aStart, aEnd, bStart, bEnd) =>
        aStart < bEnd && aEnd > bStart;

    const bookingConflict = bookings.some(b => {
        if (String(b.id) === String(editingBookingId)) return false;

        if (b.date !== date || String(b.barberId) !== String(barberId) || !isBookingBlockingSchedule(b)) {
            return false;
        }

        const bStart = parseScheduleTimeMinutes(b.time);
        if (bStart === null) return false;
        const bDuration = getBookingDurationMinutes(b);

        return overlaps(start, end, bStart, bStart + bDuration);
    });

    if (bookingConflict) {
        return showToast('У мастера уже есть запись на это время', 'error');
    }

    const blockConflict = timeBlocks.some(block => {
        if (block.date !== date || String(block.barberId) !== String(barberId)) return false;

        const blockStart = parseScheduleTimeMinutes(block.startTime);
        const blockEnd = parseScheduleTimeMinutes(block.endTime);
        if (blockStart === null || blockEnd === null || blockStart >= blockEnd) return false;

        return overlaps(start, end, blockStart, blockEnd);
    });

    if (blockConflict) {
        return showToast('Это время занято перерывом', 'error');
    }

    const repeatEnabled = !editingBookingId && Boolean(document.getElementById('repeatBookingWeekly')?.checked);
    const repeatCount = repeatEnabled ? Math.max(2, Math.min(12, Number(document.getElementById('repeatBookingCount')?.value) || 4)) : 1;
    const recurringDates = [];
    if (repeatEnabled) {
        for (let week = 1; week < repeatCount; week++) {
            const occurrence = new Date(year, month - 1, day + week * 7);
            const occurrenceDate = occurrence.toLocaleDateString('ru-RU');
            if (!isWithinBarberWorkSchedule(barberId, occurrenceDate, start, end)) return showToast('Повторение не помещается в график мастера: ' + occurrenceDate, 'error');
            const occupied = bookings.some(item => item.date === occurrenceDate && String(item.barberId) === String(barberId) && isBookingBlockingSchedule(item) && (() => { const itemStart = parseScheduleTimeMinutes(item.time); return itemStart !== null && overlaps(start, end, itemStart, itemStart + getBookingDurationMinutes(item)); })());
            const blocked = timeBlocks.some(item => item.date === occurrenceDate && String(item.barberId) === String(barberId) && (() => { const a = parseScheduleTimeMinutes(item.startTime), b = parseScheduleTimeMinutes(item.endTime); return a !== null && b !== null && overlaps(start, end, a, b); })());
            if (occupied || blocked) return showToast('Нельзя создать повторение: ' + occurrenceDate + ' в это время уже занято', 'error');
            recurringDates.push(occurrenceDate);
        }
    }

    const wasEditing = Boolean(editingBookingId);
    const existingBooking = wasEditing
        ? bookings.find(b => String(b.id) === String(editingBookingId))
        : null;

    if (wasEditing && !existingBooking) {
        return showToast('Запись не найдена', 'error');
    }

    const newTotal = selectedServices.reduce((sum, service) =>
        sum + (Number(service.price) || 0), 0);
    if (existingBooking) {
        const previousTotal = (Array.isArray(existingBooking.services) ? existingBooking.services : [])
            .reduce((sum, service) => sum + (Number(service.price) || 0), 0);
        const alreadyPaid = getBookingPaymentState(existingBooking, previousTotal).paid;
        if (newTotal < alreadyPaid) {
            return showToast(
                `Новая стоимость не может быть меньше уже внесённой суммы ${alreadyPaid.toLocaleString('ru-RU')} ₽`,
                'error'
            );
        }
    }

    const clientPhone = document.getElementById('newBookingClientPhone')?.value.trim() || '';
    const bookingData = {
        barberId,
        clientName,
        clientPhone,
        time,
        date,
        services: selectedServices.map(s => ({ ...s }))
    };

    if (existingBooking) {
        const before = existingBooking.date + ' ' + existingBooking.time;
        Object.assign(existingBooking, bookingData);
        addBookingHistoryEntry(existingBooking, 'Запись изменена', before + ' → ' + date + ' ' + time);
    } else {
        const createdBooking = {id:Date.now(),...bookingData,status:'active',paidAmount:0,payments:[],paymentMethod:'',bookingSource:'admin_panel',history:[]};
        addBookingHistoryEntry(createdBooking, 'Запись создана', date + ' в ' + time);
        bookings.push(createdBooking);
        recurringDates.forEach((occurrenceDate, index) => {
            const recurringBooking = {id:'repeat-' + Date.now() + '-' + index,...bookingData,date:occurrenceDate,status:'active',paidAmount:0,payments:[],paymentMethod:'',bookingSource:'admin_panel',recurringGroupId:String(createdBooking.id),history:[]};
            addBookingHistoryEntry(recurringBooking, 'Повторная запись создана', 'Еженедельно · серия из ' + repeatCount + ' записей');
            bookings.push(recurringBooking);
        });
    }

    const normalizedClientPhone = normalizeClientPhone(clientPhone);
    if (normalizedClientPhone.length >= 7) {
        const profileKey = 'phone:' + normalizedClientPhone;
        const previousProfile = clientProfiles[profileKey] || {};
        const updatedProfile = { ...previousProfile, clientName, barberId, phone: clientPhone };
        clientProfiles[profileKey] = updatedProfile;
        clientProfiles[JSON.stringify([clientName, barberId])] = {
            ...(clientProfiles[JSON.stringify([clientName, barberId])] || {}),
            ...updatedProfile
        };
        localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    }

    editingBookingId = null;

    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    if (!wasEditing && editingWaitlistId) {
        waitlistEntries = waitlistEntries.filter(item => String(item.id) !== String(editingWaitlistId));
        editingWaitlistId = null;
        persistWaitlist();
        renderWaitlist();
    }

    selectedScheduleDate = date;
    closeModal('newBookingModal');
    renderSchedule();
    showToast(
    wasEditing ? 'Изменения сохранены' : 'Запись успешно создана',
        'success'
    );
}




function toggleBlockAllDay() {
    const allDay = Boolean(document.getElementById('blockAllDay')?.checked);
    ['blockStartTime','blockEndTime'].forEach(id => {
        const input = document.getElementById(id);
        if (input) { input.disabled = allDay; input.classList.toggle('is-disabled', allDay); if (allDay) input.value = ''; }
    });
}
function addTimeBlock() {
    if (!requireAdminAction('Создавать и изменять перерывы может только Али')) return;
    const allDay = Boolean(document.getElementById('blockAllDay')?.checked);
    const repeatWeekly = Boolean(document.getElementById('blockRepeatWeekly')?.checked) && !editingBlockId;
    const start = allDay ? '08:00' : document.getElementById('blockStartTime').value;
    const end = allDay ? '22:00' : document.getElementById('blockEndTime').value;
    const date = selectedBlockDate;
    const barberId = currentUser.role === 'admin' ? document.getElementById('blockBarberSelect').value : currentUser.id;
    if (!start || !end || !date || !barberId) return showToast('Укажите мастера, дату и время', 'error');
    const toMinutes = value => { const [h,m] = value.split(':').map(Number); return h*60+m; };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return showToast('Укажите корректное время начала и окончания','error');
    const newStart=toMinutes(start),newEnd=toMinutes(end);
    if (newStart>=newEnd) return showToast('Время окончания должно быть позже начала','error');
    if (newStart<8*60||newEnd>22*60) return showToast('Перерыв должен быть в пределах 08:00–22:00','error');
    const overlaps=(a,b,c,d)=>a<d&&b>c;
    const baseDate=parseReportDate(date);
    if(!baseDate) return showToast('Укажите корректную дату','error');
    const targetDates=Array.from({length:repeatWeekly?12:1},(_,index)=>{const d=new Date(baseDate);d.setDate(d.getDate()+index*7);return formatReportDate(d)});
    const conflicts=[];
    for(const targetDate of targetDates){
        const bookingConflict=bookings.find(b=>b.date===targetDate&&String(b.barberId)===String(barberId)&&isBookingBlockingSchedule(b)&&(()=>{const s=parseScheduleTimeMinutes(b.time);return s!==null&&overlaps(newStart,newEnd,s,s+getBookingDurationMinutes(b))})());
        if(bookingConflict){conflicts.push({date:targetDate,message:'запись в '+bookingConflict.time});continue}
        const blockConflict=timeBlocks.find(block=>block.date===targetDate&&String(block.barberId)===String(barberId)&&(!editingBlockId||String(block.id)!==String(editingBlockId))&&(()=>{const s=parseScheduleTimeMinutes(block.startTime),e=parseScheduleTimeMinutes(block.endTime);return s!==null&&e!==null&&s<e&&overlaps(newStart,newEnd,s,e)})());
        if(blockConflict) conflicts.push({date:targetDate,message:'другой перерыв'});
    }
    if(conflicts.length) return showToast('Есть конфликт: '+conflicts[0].date+' — '+conflicts[0].message,'error');
    if(editingBlockId){
        const block=timeBlocks.find(b=>String(b.id)===String(editingBlockId));
        if(!block) return showToast('Перерыв не найден','error');
        Object.assign(block,{date,barberId,startTime:start,endTime:end,allDay});
    }else{
        const groupId=repeatWeekly?'repeat-'+Date.now():null;
        targetDates.forEach((targetDate,index)=>timeBlocks.push({id:'block-'+Date.now()+'-'+index,barberId,date:targetDate,startTime:start,endTime:end,allDay,repeatGroup:groupId}));
    }
    localStorage.setItem(appStorageKey('mensfire_admin_blocks'),JSON.stringify(timeBlocks));
    closeModal('blockTimeModal');
    showToast(editingBlockId?'Перерыв обновлён':repeatWeekly?'График добавлен на 12 недель':allDay?'Выходной добавлен':'Перерыв добавлен','success');
    editingBlockId=null;
    renderSchedule();
}

// --- УПРАВЛЕНИЕ БЛОКИРОВКОЙ ---
function openBlockActionModal(id) {
    if (!requireAdminAction('Управлять перерывами может только Али')) return;
    editingBlockId = id;
    openModal('blockActionModal');
}

function editTimeBlock() {
    if (!requireAdminAction('Изменять перерывы может только Али')) return;
    const block = timeBlocks.find(tb => String(tb.id) === String(editingBlockId));
    if (!block) return;

    // Заполняем поля данными из блокировки
    selectedBlockDate = block.date;
    updateBlockBarberSelect(block.barberId);
    document.getElementById('customDateDisplay').innerText = block.date;
    
    // Устанавливаем даты в календаре
    const parts = block.date.split('.');
    pickerYear = parseInt(parts[2]);
    pickerMonth = parseInt(parts[1]) - 1;

    document.getElementById('blockStartTime').value = block.startTime;
    document.getElementById('blockEndTime').value = block.endTime;
    document.getElementById('blockAllDay').checked = Boolean(block.allDay);
    document.getElementById('blockRepeatWeekly').checked = false;
    toggleBlockAllDay();

    // Меняем заголовок и кнопку на "Редактирование"
    document.querySelector('#blockTimeModal h2').innerText = 'Редактирование перерыва';
    document.querySelector('#blockTimeModal .checkout-btn').innerText = 'Сохранить изменения';

    closeModal('blockActionModal');
    openModal('blockTimeModal');
}

function deleteTimeBlock() {
    if (!requireAdminAction('Удалять перерывы может только Али')) return;
    showConfirm(
        'Удалить перерыв?', 
        'Это действие нельзя отменить.', 
        'Да, удалить', 
        () => {
            timeBlocks = timeBlocks.filter(tb => String(tb.id) !== String(editingBlockId));
            localStorage.setItem(appStorageKey('mensfire_admin_blocks'), JSON.stringify(timeBlocks));
            closeModal('blockActionModal');
            showToast('Перерыв удален', 'success');
            renderSchedule();
        }
    );
}

function switchFinanceTab(tab) {
    if (!requireAdminAction('Просматривать финансы может только Али')) return;
    currentFinanceTab = tab;
    document.getElementById('tabFinExpenses').classList.toggle('active', tab === 'expenses');
    document.getElementById('tabFinRevenue').classList.toggle('active', tab === 'revenue');
    document.getElementById('tabFinAnalytics').classList.toggle('active', tab === 'analytics');

    document.getElementById('finTabExpenses').style.display = tab === 'expenses' ? 'block' : 'none';
    document.getElementById('finTabRevenue').style.display = tab === 'revenue' ? 'flex' : 'none';
    document.getElementById('finTabAnalytics').style.display = tab === 'analytics' ? 'block' : 'none';

    renderFinance();
}

function parseReportDate(value) {
    const parts = String(value || '').split('.').map(Number);
    if (parts.length !== 3 || !parts.every(Number.isInteger)) return null;
    const [day, month, year] = parts;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0,0,0,0);
    return Number.isFinite(date.getTime()) ? date : null;
}
function formatReportDate(date) { return date.toLocaleDateString('ru-RU'); }
function openReportDatePicker(target) {
    calendarTargetInputId = null;
    reportDatePickerTarget = target;
    const value = target === 'dashboardDay' ? dashboardSelectedDate : target === 'dashboardStart' ? dashboardRangeStart : target === 'dashboardEnd' ? dashboardRangeEnd : target === 'financeStart' ? financeRangeStart : target === 'financeEnd' ? financeRangeEnd : target === 'clientsStart' ? clientsRangeStart : target === 'clientsEnd' ? clientsRangeEnd : target === 'teamStart' ? teamRangeStart : teamRangeEnd;
    const date = parseReportDate(value) || new Date();
    selectedBlockDate = formatReportDate(date);
    pickerYear = date.getFullYear();
    pickerMonth = date.getMonth();
    renderCalendar();
    openModal('calendarModal');
}
function setFinancePeriod(mode) {
    if (!['day','month','custom'].includes(mode)) return;
    financePeriodMode = mode;
    if (mode === 'month') {
        const selected = parseReportDate(selectedFinanceDate) || new Date();
        financeRangeStart = formatReportDate(new Date(selected.getFullYear(),selected.getMonth(),1));
        financeRangeEnd = formatReportDate(new Date(selected.getFullYear(),selected.getMonth()+1,0));
    } else if (mode === 'custom') {
        if (!parseReportDate(financeRangeStart) || !parseReportDate(financeRangeEnd)) {
            financeRangeStart = formatReportDate(new Date(new Date().getFullYear(),new Date().getMonth(),1));
            financeRangeEnd = formatReportDate(new Date());
        }
    }
    renderFinance();
}
function setClientsPeriod(mode) {
    if (!['sixMonths','month','custom'].includes(mode)) return;
    clientsPeriodMode = mode;
    if (mode === 'month') {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        clientsRangeEnd = formatReportDate(new Date());
    } else if (mode === 'sixMonths') {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth()-5,1));
        clientsRangeEnd = formatReportDate(new Date());
    } else if (!parseReportDate(clientsRangeStart) || !parseReportDate(clientsRangeEnd)) {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        clientsRangeEnd = formatReportDate(now);
    }
    renderClients(currentClientsTab);
}
function setTeamPeriod(mode) {
    if (!['month','custom'].includes(mode)) return;
    teamPeriodMode = mode;
    if (mode === 'month') {
        const now = new Date();
        teamRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        teamRangeEnd = formatReportDate(now);
    } else if (!parseReportDate(teamRangeStart) || !parseReportDate(teamRangeEnd)) {
        const now = new Date();
        teamRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        teamRangeEnd = formatReportDate(now);
    }
    renderTeam();
}

function setDashboardPeriod(mode) {
    if (!['day','month','custom'].includes(mode)) return;
    dashboardPeriodMode = mode;
    const selected = parseReportDate(dashboardSelectedDate) || new Date();
    if (mode === 'day') {
        dashboardRangeStart = dashboardRangeEnd = formatReportDate(selected);
    } else if (mode === 'month') {
        dashboardRangeStart = formatReportDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        dashboardRangeEnd = formatReportDate(new Date(selected.getFullYear(), selected.getMonth() + 1, 0));
    } else if (!parseReportDate(dashboardRangeStart) || !parseReportDate(dashboardRangeEnd)) {
        dashboardRangeStart = formatReportDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        dashboardRangeEnd = formatReportDate(selected);
    }
    renderDashboard();
}
function dashboardEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function renderDashboard() {
    if (!currentUser) return;
    const controls = document.getElementById('dashboardPeriodControls');
    const rangeStart = parseReportDate(dashboardRangeStart) || new Date();
    const rangeEndDate = parseReportDate(dashboardRangeEnd) || rangeStart;
    rangeStart.setHours(0,0,0,0);
    rangeEndDate.setHours(0,0,0,0);
    const endExclusive = new Date(rangeEndDate); endExclusive.setDate(endExclusive.getDate()+1);
    const startKey = formatReportDate(rangeStart), endKey = formatReportDate(rangeEndDate);
    const inRange = value => { const date = parseReportDate(value); return !!date && date >= rangeStart && date < endExclusive; };
    const periodLabel = startKey === endKey ? startKey : startKey + ' — ' + endKey;
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период главной панели">
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='day'?'active':''}" onclick="setDashboardPeriod('day')">День</button>
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='month'?'active':''}" onclick="setDashboardPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='custom'?'active':''}" onclick="setDashboardPeriod('custom')">Период</button>
            </div>
            ${dashboardPeriodMode==='day' ? `<div class="finance-range-fields"><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardDay')">${dashboardEscape(startKey)}</button></div>` : dashboardPeriodMode==='custom' ? `<div class="finance-range-fields"><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardStart')">${dashboardEscape(startKey)}</button><span>—</span><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardEnd')">${dashboardEscape(endKey)}</button></div>` : ''}
        </div>`;
    const scoped = bookings.filter(item => inRange(item.date) && item.status !== 'cancelled' && (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)));
    const completed = scoped.filter(item => item.status === 'completed');
    const collected = scoped.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
    const outstanding = scoped.reduce((sum,item)=>{
        const total=(Array.isArray(item.services)?item.services:[]).reduce((n,s)=>n+Math.max(0,Number(s.price)||0),0);
        return sum+Math.max(0,total-getBookingPaymentState(item,total).paid);
    },0);
    const periodExpenses = currentUser.role === 'admin' ? expenses.filter(item=>inRange(item.date)).reduce((sum,item)=>sum+Math.max(0,Number(item.amount)||0),0) : 0;
    const newClients = completed.filter(item=>getBookingClientType(item)==='new').length;
    const kpis = document.getElementById('dashboardKpis');
    if (kpis) {
        const cards = [
            ['Записей',scoped.length,'Активные и завершённые визиты'],
            ['Завершено',completed.length,'Успешно оказанные услуги'],
            ['Получено',Math.round(collected).toLocaleString('ru-RU')+' ₽','Фактические оплаты'],
            ['К оплате',Math.round(outstanding).toLocaleString('ru-RU')+' ₽','Остаток по записям']
        ];
        if (currentUser.role === 'admin') {
            cards.push(['Расходы',Math.round(periodExpenses).toLocaleString('ru-RU')+' ₽','За выбранный период']);
            cards.push(['Результат',Math.round(collected-periodExpenses).toLocaleString('ru-RU')+' ₽','Получено минус расходы']);
        } else {
            cards.push(['Новые клиенты',newClients,'По завершённым визитам']);
            cards.push(['Средний чек',completed.length?Math.round(completed.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0)/completed.length).toLocaleString('ru-RU')+' ₽':'0 ₽','По завершённым визитам']);
        }
        kpis.innerHTML = cards.map((card,index)=>`<article class="dashboard-kpi-card ${index===2?'is-primary':''}"><span>${dashboardEscape(card[0])}</span><strong>${dashboardEscape(card[1])}</strong><small>${dashboardEscape(card[2])}</small></article>`).join('');
    }
    const chart = document.getElementById('dashboardRevenueChart');
    if (chart) {
        const days = Math.max(1,Math.round((endExclusive-rangeStart)/86400000));
        const bucketCount = days<=1?1:Math.min(7,days);
        const buckets=[];
        for(let i=0;i<bucketCount;i++){
            const from=new Date(rangeStart); from.setDate(from.getDate()+Math.floor(i*days/bucketCount));
            const to=new Date(rangeStart); to.setDate(to.getDate()+Math.floor((i+1)*days/bucketCount));
            if(to<=from)to.setDate(from.getDate()+1);
            const value=scoped.filter(item=>item.status==='completed'&&(()=>{const d=parseReportDate(item.date);return d&&d>=from&&d<to;})()).reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
            buckets.push({label:days===1?startKey:from.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}),value});
        }
        const max=Math.max(1,...buckets.map(b=>b.value));
        chart.innerHTML='<div class="dashboard-bars">'+buckets.map(b=>`<div class="dashboard-bar-col"><div class="dashboard-bar-track"><i style="height:${Math.max(4,b.value/max*100)}%"></i></div><strong>${Math.round(b.value).toLocaleString('ru-RU')} ₽</strong><span>${dashboardEscape(b.label)}</span></div>`).join('')+'</div>';
        const caption=document.getElementById('dashboardChartCaption'); if(caption)caption.textContent='Оплаченные завершённые визиты · '+periodLabel;
    }
    const mix=document.getElementById('dashboardBookingMix');
    if(mix){
        const counts=[['Завершено',completed.length,'completed'],['Ожидает',scoped.filter(item=>['pending','confirmed','active'].includes(item.status||'active')).length,'pending'],['Частично оплачено',scoped.filter(item=>{const total=(item.services||[]).reduce((n,s)=>n+Number(s.price||0),0);const p=getBookingPaymentState(item,total);return p.status==='partial';}).length,'partial']];
        mix.innerHTML='<div class="dashboard-mix-list">'+counts.map(([label,value,cls])=>`<div class="dashboard-mix-row"><span><i class="${cls}"></i>${label}</span><strong>${value}</strong></div>`).join('')+'</div>';
    }
    const team=document.getElementById('dashboardTeamSnapshot');
    if(team){
        const staff=mockStaff.filter(person=>currentUser.role==='admin'||String(person.id)===String(currentUser.id));
        team.innerHTML=staff.map(person=>{
            const own=scoped.filter(item=>String(item.barberId)===String(person.id));
            const paid=own.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
            const visits=own.filter(item=>item.status==='completed').length;
            return `<div class="dashboard-team-row"><span class="dashboard-avatar">${dashboardEscape(person.name.slice(0,1))}</span><div><strong>${dashboardEscape(person.name)}</strong><small>${visits} визитов</small></div><b>${Math.round(paid).toLocaleString('ru-RU')} ₽</b></div>`;
        }).join('')||'<div class="finance-empty">Нет данных за период</div>';
    }
    const upcoming=document.getElementById('dashboardUpcoming');
    if(upcoming){
        const now=new Date();
        const future=scoped.filter(item=>item.status!=='completed'&&(()=>{const d=parseReportDate(item.date);if(!d)return false;const [hh,mm]=String(item.time||'00:00').split(':').map(Number);d.setHours(hh||0,mm||0,0,0);return d>=now;})()).sort((a,b)=>{const da=parseReportDate(a.date),db=parseReportDate(b.date);return da-db||String(a.time||'').localeCompare(String(b.time||''));}).slice(0,5);
        upcoming.innerHTML=future.length?future.map(item=>{const clientMeta=getBookingClientTypeMeta(item);return `<div class="dashboard-upcoming-row"><div class="dashboard-upcoming-time"><strong>${dashboardEscape(item.time||'—')}</strong><small>${dashboardEscape(item.date||'')}</small></div><div class="dashboard-upcoming-info"><strong>${dashboardEscape(item.clientName||'Клиент')}</strong><small>${dashboardEscape(item.services?.map(s=>s.title).join(', ')||'Услуга')} · ${dashboardEscape(mockStaff.find(s=>String(s.id)===String(item.barberId))?.name||'Мастер')}</small><span class="booking-card-badges"><i class="booking-client-type type-${clientMeta.className}">${clientMeta.label}</i></span></div><span class="dashboard-upcoming-status">${item.status==='pending'?'Ожидает':'Подтверждена'}</span></div>`}).join(''):'<div class="finance-empty">Нет предстоящих записей в выбранном периоде</div>';
    }
}

function renderFinanceDateSelector() {
    const container = document.getElementById('financeDateSelector');
    if (!container) return;
    container.innerHTML = '';
    container.classList.toggle('is-hidden', financePeriodMode !== 'day');
    const fields = document.getElementById('financeRangeFields');
    if (fields) fields.hidden = financePeriodMode !== 'custom';
    document.querySelectorAll('[data-finance-period]').forEach(button => button.classList.toggle('active', button.dataset.financePeriod === financePeriodMode));
    const startButton = document.getElementById('financeRangeStartButton');
    const endButton = document.getElementById('financeRangeEndButton');
    if (startButton) startButton.textContent = financeRangeStart;
    if (endButton) endButton.textContent = financeRangeEnd;
    const selectedParts = selectedFinanceDate.split('.').map(Number);
    const base = selectedParts.length === 3 ? new Date(selectedParts[2],selectedParts[1]-1,selectedParts[0]) : new Date();
    base.setHours(0,0,0,0);
    const label = document.getElementById('financeSelectedDateLabel');
    if (label) {
        const today = new Date(); today.setHours(0,0,0,0);
        const sameDay = base.getTime() === today.getTime();
        label.textContent = financePeriodMode === 'day'
            ? (sameDay ? 'Сегодня · ' : '') + base.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
            : financePeriodMode === 'month'
                ? base.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})
                : formatReportDate(parseReportDate(financeRangeStart) || base) + ' — ' + formatReportDate(parseReportDate(financeRangeEnd) || base);
    }
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    for (let i = -7; i < 16; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        const today = new Date(); today.setHours(0,0,0,0);
        const isToday = d.getTime() === today.getTime();
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'date-selector-item' + (selectedFinanceDate === dateStr ? ' selected' : '') + (isToday ? ' is-today' : '');
        div.setAttribute('aria-pressed',String(selectedFinanceDate === dateStr));
        div.innerHTML = '<div class="day-name">' + (isToday ? 'Сегодня' : days[d.getDay()]) + '</div><div class="day-num">' + d.getDate() + '</div>';
        div.onclick = () => { selectedFinanceDate = dateStr; financePeriodMode = 'day'; renderFinance(); };
        container.appendChild(div);
    }
    requestAnimationFrame(() => {
        const selected = container.querySelector('.selected');
        if (selected) selected.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
    });
}

function renderFinance() {
    if (!requireAdminAction('Просматривать финансы может только Али')) return;
    renderFinanceDateSelector();

    const parseDate = value => parseReportDate(value);
    const fmt = value => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
    const getSafeServiceAmount = service => {
        const amount = Number(service?.price);
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    };
    const selectedDate = parseDate(selectedFinanceDate) || new Date();
    selectedDate.setHours(0, 0, 0, 0);
    const dateKey = date => date.toLocaleDateString('ru-RU');
    const shift = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
    const startOfWeek = date => { const next = new Date(date); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return next; };
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    const inRange = (value, start, end) => { const date = parseDate(value); return date && date >= start && date < end; };
    let periodStart = financePeriodMode === 'day' ? selectedDate : parseReportDate(financeRangeStart) || monthStart;
    let periodLastDay = financePeriodMode === 'day' ? selectedDate : parseReportDate(financeRangeEnd) || new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,0);
    if (financePeriodMode === 'month') {
        periodStart = monthStart;
        periodLastDay = new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,0);
    }
    if (periodLastDay < periodStart) [periodStart, periodLastDay] = [periodLastDay, periodStart];
    const periodEnd = shift(periodLastDay, 1);
    const periodLabel = financePeriodMode === 'day' ? formatReportDate(selectedDate) : (formatReportDate(periodStart) + ' — ' + formatReportDate(periodLastDay));
    const aggregationStart = financePeriodMode === 'day' ? monthStart : periodStart;
    const aggregationEnd = financePeriodMode === 'day' ? nextMonth : periodEnd;
    const aggregationLabel = financePeriodMode === 'day' ? selectedDate.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}) : periodLabel;
    const dayEnd = shift(selectedDate, 1);
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = shift(weekStart, 7);
    const dayBookings = bookings.filter(item => item.date === selectedFinanceDate && item.status !== 'cancelled');
    const dayCompleted = dayBookings.filter(item => item.status === 'completed');
    const periodCompleted = bookings.filter(item => inRange(item.date, periodStart, periodEnd) && item.status === 'completed');
    const retailSaleDate = sale => { const date = new Date(sale.soldAt || sale.createdAt || ''); return Number.isNaN(date.getTime()) ? '' : formatReportDate(date); };
    const retailSalesInRange = (start,end) => clientRetailSales.filter(sale => inRange(retailSaleDate(sale),start,end));
    const getRetailCashLedger = sale => {
        const totalRaw=Number(sale?.total),total=Number.isFinite(totalRaw)?Math.max(0,totalRaw):0;
        const refunds=Array.isArray(sale?.refunds)?sale.refunds:[];
        const recordedRefunds=refunds.reduce((sum,refund)=>{const amount=Number(refund?.paidAmount);return sum+(Number.isFinite(amount)?Math.max(0,amount):0);},0);
        const currentPaid=Number(sale?.paidAmount);
        const grossRaw=sale?.grossPaidAmount!=null?Number(sale.grossPaidAmount):(Number.isFinite(currentPaid)?Math.max(0,currentPaid):0)+recordedRefunds;
        const originalPaid=Number.isFinite(grossRaw)?Math.min(total,Math.max(0,grossRaw)):0;
        let refundable=originalPaid;
        const refundRows=refunds.map(refund=>{
            const raw=Number(refund?.paidAmount),requested=Number.isFinite(raw)?Math.max(0,raw):0;
            const paidAmount=Math.min(refundable,requested);
            refundable-=paidAmount;
            return {refund,paidAmount};
        });
        return {originalPaid,refundRows};
    };
    const retailRefundsInRange = (start,end) => clientRetailSales.flatMap(sale=>getRetailCashLedger(sale).refundRows.filter(row=>inRange(retailSaleDate({soldAt:row.refund.createdAt}),start,end)).map(row=>({sale,refund:row.refund,paidAmount:row.paidAmount})));
    const retailCollected = (start,end) => {
        const gross=retailSalesInRange(start,end).reduce((sum,sale)=>sum+getRetailCashLedger(sale).originalPaid,0);
        return gross-retailRefundsInRange(start,end).reduce((sum,row)=>sum+row.paidAmount,0);
    };
    const revenue = (start, end) => bookings.filter(item => inRange(item.date, start, end))
        .reduce((sum, item) => sum + getBookingCollectedAmount(item), 0) + retailCollected(start,end);
    const getSafeExpenseAmount = item => {
        const amount = Number(item?.amount);
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    };
    const expensesTotal = (start, end) => expenses.filter(item => inRange(item.date, start, end))
        .reduce((sum, item) => sum + getSafeExpenseAmount(item), 0);
    const dayRevenue = revenue(selectedDate, dayEnd);
    const weekRevenue = revenue(weekStart, weekEnd);
    const monthRevenue = revenue(aggregationStart, aggregationEnd);
    const dayExpenses = financePeriodMode === 'day' ? expenses.filter(item => item.date === selectedFinanceDate) : expenses.filter(item => inRange(item.date, periodStart, periodEnd));
    const dayExpenseTotal = dayExpenses.reduce((sum, item) => sum + getSafeExpenseAmount(item), 0);
    const weekExpenseTotal = expensesTotal(weekStart, weekEnd);
    const monthExpenseTotal = expensesTotal(aggregationStart, aggregationEnd);
    const dayProfit = dayRevenue - dayExpenseTotal;
    const monthProfit = monthRevenue - monthExpenseTotal;
    const activeBookings = bookings.filter(item => item.status !== 'cancelled');
    const bookingUnpaidBalance = activeBookings.filter(item => inRange(item.date, periodStart, periodEnd)).reduce((sum, item) => {
        const total = (Array.isArray(item.services) ? item.services : []).reduce((n, service) => n + getSafeServiceAmount(service), 0);
        return sum + Math.max(0, total - getBookingPaymentState(item, total).paid);
    }, 0);
    const retailUnpaidBalance = retailSalesInRange(periodStart,periodEnd).reduce((sum,sale)=>sum+Math.max(0,getRetailSaleNetTotal(sale)-(Number(sale.paidAmount)||0)),0);
    const unpaidBalance = bookingUnpaidBalance + retailUnpaidBalance;
    const paymentTotals = { cash: 0, card: 0, transfer: 0, online: 0, other: 0 };
    bookings.filter(item => inRange(item.date, aggregationStart, aggregationEnd)).forEach(item => {
        const serviceTotal = (Array.isArray(item.services) ? item.services : [])
            .reduce((sum, service) => sum + getSafeServiceAmount(service), 0);
        const transactions = Array.isArray(item.payments) ? item.payments : [];
        let remaining = getBookingCollectedAmount(item);
        if (transactions.length) {
            // Не учитываем дубли/переплаты сверх стоимости заказа и пропускаем некорректные суммы.
            transactions.forEach(payment => {
                const rawAmount = Number(payment?.amount);
                if (!Number.isFinite(rawAmount) || rawAmount <= 0 || remaining <= 0) return;
                const amount = Math.min(rawAmount, remaining, serviceTotal);
                const method = Object.prototype.hasOwnProperty.call(paymentTotals, payment?.method) ? payment.method : 'other';
                paymentTotals[method] += amount;
                remaining -= amount;
            });
        } else if (remaining > 0) {
            const method = Object.prototype.hasOwnProperty.call(paymentTotals, item.paymentMethod) ? item.paymentMethod : 'other';
            paymentTotals[method] += remaining;
        }
    });
    retailSalesInRange(aggregationStart,aggregationEnd).forEach(sale=>{
        const amount=getRetailCashLedger(sale).originalPaid;
        const method=Object.prototype.hasOwnProperty.call(paymentTotals,sale.paymentMethod)?sale.paymentMethod:'other';
        paymentTotals[method]+=amount;
    });
    retailRefundsInRange(aggregationStart,aggregationEnd).forEach(({sale,refund,paidAmount})=>{
        const method=Object.prototype.hasOwnProperty.call(paymentTotals,refund.paymentMethod||sale.paymentMethod)?(refund.paymentMethod||sale.paymentMethod):'other';
        paymentTotals[method]-=paidAmount;
    });

    const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    setText('financeToday', fmt(dayRevenue));
    setText('financeWeek', fmt(weekRevenue));
    setText('financeMonth', fmt(monthRevenue));
    const monthLabel = document.querySelector('#finTabRevenue .finance-kpi-card:nth-child(3) .finance-kpi-label');
    if (monthLabel) monthLabel.textContent = financePeriodMode === 'day' ? 'Месяц' : 'Период';
    const monthHint = document.querySelector('#finTabRevenue .finance-kpi-card:nth-child(3) small');
    if (monthHint) monthHint.textContent = aggregationLabel;
    setText('financeProfit', fmt(dayProfit));
    setText('profitWeek', fmt(weekRevenue - weekExpenseTotal));
    setText('profitMonth', fmt(monthProfit));
    const profitMonthLabel = document.querySelector('#finTabExpenses .finance-period-metrics > div:nth-child(3) span');
    if (profitMonthLabel) profitMonthLabel.textContent = financePeriodMode === 'day' ? 'За месяц' : 'За период';
    const teamPeriodHint = document.querySelector('#finTabRevenue .finance-panel-heading p');
    if (teamPeriodHint) teamPeriodHint.textContent = 'Поступления и завершённые визиты · ' + aggregationLabel;
    setText('financeMonthExpenses', fmt(monthExpenseTotal));
    const expensePeriodLabel = document.querySelector('#finTabExpenses .finance-total-row span');
    if (expensePeriodLabel) expensePeriodLabel.textContent = financePeriodMode === 'day' ? 'Расходы за месяц' : 'Расходы за период';
    const paymentSubtitle = document.querySelector('#finTabExpenses .finance-panel:nth-child(3) .finance-panel-heading p');
    if (paymentSubtitle) paymentSubtitle.textContent = financePeriodMode === 'day' ? 'Распределение поступлений за месяц' : 'Распределение поступлений за период';

    const expensesList = document.getElementById('expensesList');
    if (expensesList) expensesList.innerHTML = dayExpenses.length ? dayExpenses.map(item => `
        <div class="finance-operation">
            <div class="finance-operation-icon">↗</div>
            <div class="finance-operation-copy"><strong>${escapeBookingHtml(item.title || 'Расход')}</strong><span>${escapeBookingHtml(item.category || 'Операционные расходы')}</span></div>
            <strong class="finance-negative">−${fmt(item.amount)}</strong>
        </div>`).join('') : '<div class="finance-empty">Расходов за выбранный день нет</div>';

    const summary = document.getElementById('financeExecutiveSummary');
    if (summary) summary.innerHTML = `
        <div class="finance-kpi-card finance-kpi-primary"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'Получено за день' : 'Получено за период'}</span><strong>${fmt(financePeriodMode === 'day' ? dayRevenue : monthRevenue)}</strong><small>${financePeriodMode === 'day' ? dayCompleted.length + ' завершённых визитов' : periodLabel}</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'Чистый результат дня' : 'Чистый результат периода'}</span><strong class="${(financePeriodMode === 'day' ? dayProfit : monthProfit) < 0 ? 'finance-negative' : 'finance-positive'}">${fmt(financePeriodMode === 'day' ? dayProfit : monthProfit)}</strong><small>После расходов</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">Ожидает оплаты</span><strong>${fmt(unpaidBalance)}</strong><small>Баланс по активным записям</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">Средний чек</span><strong>${fmt((financePeriodMode === 'day' ? dayCompleted : periodCompleted).length ? (financePeriodMode === 'day' ? dayCompleted : periodCompleted).reduce((sum,b) => sum + (Array.isArray(b.services) ? b.services : []).reduce((n,x) => n + getSafeServiceAmount(x),0),0) / (financePeriodMode === 'day' ? dayCompleted : periodCompleted).length : 0)}</strong><small>По завершённым визитам</small></div>
        <div class="finance-kpi-card finance-kpi-comparison"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'К прошлому дню' : 'Выбранный период'}</span><strong>${periodLabel}</strong><small>${financePeriodMode === 'day' ? 'Сравнение с предыдущим днём' : 'Интервал для всех расчётов ниже'}</small></div>`;

    const chart = document.getElementById('financeRevenueChart');
    if (chart) {
        const spanDays = Math.round((periodEnd - periodStart) / 86400000);
        const buckets = [];
        if (financePeriodMode === 'day') {
            for (let offset = -6; offset <= 0; offset++) {
                const date = shift(selectedDate,offset);
                buckets.push({start:date,end:shift(date,1),label:date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        } else if (spanDays > 45) {
            const cursor = new Date(periodStart.getFullYear(),periodStart.getMonth(),1);
            while (cursor < periodEnd && buckets.length < 12) {
                const start = new Date(cursor), end = new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
                buckets.push({start,end,label:start.toLocaleDateString('ru-RU',{month:'short',year:'2-digit'}).replace('.','')});
                cursor.setMonth(cursor.getMonth()+1);
            }
        } else {
            const step = spanDays > 7 ? Math.ceil(spanDays / 7) : 1;
            for (let cursor = new Date(periodStart); cursor < periodEnd && buckets.length < 31; cursor = shift(cursor,step)) {
                const end = new Date(Math.min(shift(cursor,step).getTime(),periodEnd.getTime()));
                buckets.push({start:new Date(cursor),end,label:step===7?cursor.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.',''):cursor.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        }
        const values = buckets.map(bucket=>revenue(bucket.start,bucket.end));
        const max = Math.max(1,...values);
        chart.innerHTML = `<div class="finance-chart-bars" style="grid-template-columns:repeat(${Math.min(buckets.length,7)},minmax(0,1fr))">${buckets.map((bucket,index) => {
            const height = Math.max(values[index] > 0 ? 5 : 2, values[index] / max * 100);
            return `<div class="finance-chart-column"><strong>${values[index] ? fmt(values[index]) : '—'}</strong><div class="finance-chart-track"><i style="height:${height}%"></i></div><span>${bucket.label}</span></div>`;
        }).join('')}</div>`;
    }

    const methods = document.getElementById('financePaymentMethods');
    if (methods) {
        const labels = {cash:'Наличные',card:'Банковская карта',transfer:'Перевод',online:'Онлайн',other:'Не указан'};
        const total = Object.values(paymentTotals).reduce((sum,value) => sum + value, 0);
        methods.innerHTML = Object.entries(paymentTotals).filter(([,value]) => value > 0).sort((a,b) => b[1]-a[1]).map(([key,value]) => `
            <div class="finance-method-row"><div><span>${labels[key]}</span><strong>${fmt(value)}</strong></div><div class="finance-method-track"><i style="width:${total ? value/total*100 : 0}%"></i></div></div>`
        ).join('') || '<div class="finance-empty">Платежей за этот месяц пока нет</div>';
    }

    const teamStats = document.getElementById('financeTeamStats');
    if (teamStats) {
        const staff = Array.isArray(mockStaff) ? mockStaff : [];
        const teamRows = new Map(staff.map(person => [String(person.id), {
            name: person.name || 'Мастер',
            paid: 0,
            visits: 0
        }]));
        bookings.filter(item => inRange(item.date, aggregationStart, aggregationEnd)).forEach(item => {
            const id = item.barberId == null || item.barberId === '' ? '__unassigned__' : String(item.barberId);
            if (!teamRows.has(id)) {
                teamRows.set(id, {
                    name: id === '__unassigned__' ? 'Без мастера' : 'Мастер из старых записей',
                    paid: 0,
                    visits: 0
                });
            }
            const row = teamRows.get(id);
            row.paid += getBookingCollectedAmount(item);
            if (item.status === 'completed') row.visits += 1;
        });
        retailSalesInRange(aggregationStart,aggregationEnd).forEach(sale=>{
            const id=sale.staffId==null||sale.staffId===''?'__unassigned__':String(sale.staffId);
            if(!teamRows.has(id))teamRows.set(id,{name:id==='__unassigned__'?'Без мастера':'Мастер из старых продаж',paid:0,visits:0});
            teamRows.get(id).paid+=Math.min(Number(sale.total)||0,Number(sale.paidAmount)||0);
        });
        const rows = Array.from(teamRows.values()).sort((a,b) => b.paid-a.paid);
        const teamTotal = rows.reduce((sum,person) => sum + person.paid,0);
        teamStats.innerHTML = rows.length ? rows.map(person => {
            const share = teamTotal ? person.paid / teamTotal * 100 : 0;
            return `
            <div class="finance-team-row finance-team-row-detailed"><div class="finance-team-avatar">${escapeBookingHtml(String(person.name || '?').slice(0,1).toUpperCase())}</div><div class="finance-team-copy"><strong>${escapeBookingHtml(person.name)}</strong><span>${person.visits} визитов · ${share.toFixed(0)}% поступлений</span><div class="finance-team-share-track"><i style="width:${share}%"></i></div></div><strong>${fmt(person.paid)}</strong></div>`;
        }).join('') : '<div class="finance-empty">Нет данных за выбранный период</div>';
    }

    const analyticsBookings = bookings.filter(item => inRange(item.date, periodStart, periodEnd) && item.status !== 'cancelled');
    const analyticsHeader = document.getElementById('analyticsHeaderBlock');
    if (analyticsHeader) analyticsHeader.innerHTML = `<div><strong>${periodLabel}</strong><span class="finance-muted">Сводка по записям за период</span></div><strong>${analyticsBookings.length} записей</strong>`;
    const analyticsList = document.getElementById('analyticsHistoryList');
    if (analyticsList) analyticsList.innerHTML = analyticsBookings.length ? analyticsBookings.map(item => {
        const total = (Array.isArray(item.services) ? item.services : []).reduce((sum,service) => sum + getSafeServiceAmount(service),0);
        const state = getBookingPaymentState(item,total);
        const methodKey = ['cash','card','transfer','online','mixed'].includes(state.method) ? state.method : 'other';
        const paymentStatusClass = state.status === 'paid' ? 'is-paid' : state.status === 'partial' ? 'is-partial' : 'is-unpaid';
        return `<div class="finance-operation finance-analytics-operation">
            <div class="finance-operation-copy">
                <strong>${escapeBookingHtml(item.clientName || 'Клиент')}</strong>
                <span>${escapeBookingHtml(item.time || '')} · <span class="finance-payment-status ${paymentStatusClass}">${state.label}</span></span>
                <span class="finance-payment-method finance-payment-method--${methodKey}"><i></i>${escapeBookingHtml(state.methodLabel)}</span>
            </div>
            <strong>${fmt(state.paid)} / ${fmt(total)}</strong>
        </div>`;
    }).join('') : '<div class="finance-empty">За выбранный период записей нет</div>';

    const serviceCounts = {};
    bookings.filter(item => item.status === 'completed' && inRange(item.date, periodStart, periodEnd)).forEach(item => {
        (Array.isArray(item.services) ? item.services : []).forEach(service => {
            const name = String(service.title || 'Услуга');
            if (!serviceCounts[name]) serviceCounts[name] = {count:0,revenue:0};
            serviceCounts[name].count += 1;
            serviceCounts[name].revenue += getSafeServiceAmount(service);
        });
    });
    const topServices = document.getElementById('analyticsTopServicesList');
    if (topServices) {
        const sorted = Object.entries(serviceCounts).sort((a,b) => b[1].revenue-a[1].revenue).slice(0,5);
        const maxServiceRevenue = Math.max(1,...sorted.map(([,data]) => data.revenue));
        topServices.innerHTML = sorted.length ? sorted.map(([name,data],index) => `
            <div class="finance-service-row finance-service-row-detailed"><span class="finance-service-rank">${index+1}</span><div class="finance-service-copy"><strong>${escapeBookingHtml(name)}</strong><span>${data.count} выполнено за 30 дней</span><div class="finance-service-track"><i style="width:${data.revenue/maxServiceRevenue*100}%"></i></div></div><strong>${fmt(data.revenue)}</strong></div>`
        ).join('') : '<div class="finance-empty">Статистика появится после завершённых визитов</div>';
    }

    const expenseBreakdown = document.getElementById('financeExpenseBreakdown');
    if (expenseBreakdown) {
        const groups = {};
        dayExpenses.forEach(item => {
            const label = String(item.category || item.title || 'Прочие расходы');
            groups[label] = (groups[label] || 0) + getSafeExpenseAmount(item);
        });
        const rows = Object.entries(groups).sort((a,b) => b[1]-a[1]);
        const maxExpense = Math.max(1,...rows.map(([,amount]) => amount));
        expenseBreakdown.innerHTML = rows.length ? '<div class="finance-breakdown-heading">Структура расходов за период</div>' + rows.map(([label,amount]) => `
            <div class="finance-expense-breakdown-row"><div><span>${escapeBookingHtml(label)}</span><strong>${fmt(amount)}</strong></div><div class="finance-expense-track"><i style="width:${amount/maxExpense*100}%"></i></div></div>`
        ).join('') : '<div class="finance-empty">Добавьте расходы, чтобы увидеть структуру</div>';
    }
}
function openExpenseModal() {
    if (!requireAdminAction('Управлять финансами может только Али')) return;
    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    openModal('expenseModal');
}

function addExpense() {
    if (!requireAdminAction('Добавлять расходы может только Али')) return;
    const titleInput = document.getElementById('expenseTitle');
    const amountInput = document.getElementById('expenseAmount');
    const title = String(titleInput?.value || '').trim();
    const rawAmount = String(amountInput?.value || '').trim().replace(',', '.');
    const amount = rawAmount && /^\d+(?:\.\d{1,2})?$/.test(rawAmount) ? Number(rawAmount) : NaN;
    const expenseDate = parseReportDate(selectedFinanceDate);

    if (!title || !Number.isFinite(amount) || amount <= 0 || !expenseDate) {
        return showToast('Укажите название, корректную сумму и дату расхода', 'error');
    }

    const newExpense = {
        id: Date.now(),
        title: title,
        amount: Math.round(amount * 100) / 100,
        date: selectedFinanceDate
    };

    expenses.push(newExpense);
    localStorage.setItem(appStorageKey('mensfire_admin_expenses'), JSON.stringify(expenses));
    closeModal('expenseModal');
    showToast(`Расход добавлен на ${selectedFinanceDate}`, 'success');
    renderFinance();
}

// --- КОМАНДА (Только Админ) ---
function renderTeam() {
    if (!requireAdminAction('Просматривать команду и управлять PIN может только Али')) return;
    const listPC = document.getElementById('teamListPC');
    const listMobile = document.getElementById('teamList');

    const today = new Date(); today.setHours(0,0,0,0);
    const todayKey = today.toLocaleDateString('ru-RU');
    let rangeStart = teamPeriodMode === 'month' ? new Date(today.getFullYear(),today.getMonth(),1) : parseReportDate(teamRangeStart);
    let rangeEnd = teamPeriodMode === 'month' ? today : parseReportDate(teamRangeEnd);
    rangeStart = rangeStart || new Date(today.getFullYear(),today.getMonth(),1);
    rangeEnd = rangeEnd || today;
    if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
    const rangeEndExclusive = new Date(rangeEnd); rangeEndExclusive.setDate(rangeEndExclusive.getDate()+1);
    const inSelectedPeriod = value => { const date = parseReportDate(value); return date && date >= rangeStart && date < rangeEndExclusive; };
    const periodLabel = formatReportDate(rangeStart) + ' — ' + formatReportDate(rangeEnd);
    const teamCompleted = bookings.filter(item => item.status === 'completed' && inSelectedPeriod(item.date));
    const teamRevenue = bookings.reduce((sum,item) => sum + (inSelectedPeriod(item.date) ? getBookingCollectedAmount(item) : 0),0);
    const controls = document.getElementById('teamPeriodControls');
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период статистики команды">
                <button type="button" class="finance-range-btn ${teamPeriodMode==='month'?'active':''}" onclick="setTeamPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${teamPeriodMode==='custom'?'active':''}" onclick="setTeamPeriod('custom')">Период</button>
            </div>
            <div class="finance-range-fields" ${teamPeriodMode==='custom'?'':'hidden'}>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('teamStart')">${teamRangeStart}</button><span>—</span>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('teamEnd')">${teamRangeEnd}</button>
            </div>
        </div>`;
    const teamToday = bookings.filter(item => item.date === todayKey && item.status !== 'cancelled').length;
    const overview = document.getElementById('teamOverview');
    const trend = document.getElementById('teamRevenueTrend');
    if (trend) {
        const spanDays = Math.round((rangeEndExclusive-rangeStart)/86400000);
        const buckets = [];
        if (spanDays > 45) {
            const cursor = new Date(rangeStart.getFullYear(),rangeStart.getMonth(),1);
            while (cursor < rangeEndExclusive && buckets.length < 12) {
                const bucketStart = new Date(cursor), bucketEnd = new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
                buckets.push({start:bucketStart,end:bucketEnd,label:bucketStart.toLocaleDateString('ru-RU',{month:'short',year:'2-digit'}).replace('.','')});
                cursor.setMonth(cursor.getMonth()+1);
            }
        } else {
            const step = spanDays > 7 ? Math.ceil(spanDays/7) : 1;
            for (let cursor = new Date(rangeStart); cursor < rangeEndExclusive && buckets.length < 7; cursor.setDate(cursor.getDate()+step)) {
                const bucketStart = new Date(cursor), bucketEnd = new Date(Math.min(new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+step).getTime(),rangeEndExclusive.getTime()));
                buckets.push({start:bucketStart,end:bucketEnd,label:bucketStart.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        }
        const values = buckets.map(bucket=>bookings.filter(item=>item.status==='completed'&&(()=>{const date=parseReportDate(item.date);return date&&date>=bucket.start&&date<bucket.end;})()).reduce((sum,item)=>sum+getBookingCollectedAmount(item),0));
        const max = Math.max(1,...values);
        trend.innerHTML = '<div class="team-trend-bars" style="grid-template-columns:repeat(' + Math.min(buckets.length,7) + ',minmax(0,1fr))">' + buckets.map((bucket,index) => {
            const height = Math.max(values[index] > 0 ? 5 : 2,values[index]/max*100);
            const amount = values[index] ? Math.round(values[index]).toLocaleString('ru-RU') + ' ₽' : '—';
            return '<div class="team-trend-column"><strong>' + amount + '</strong><div class="team-trend-track"><i style="height:' + height + '%"></i></div><span>' + bucket.label + '</span></div>';
        }).join('') + '</div>';
    }

    if (overview) overview.innerHTML = `
        <div class="team-overview-card"><span>Мастеров в команде</span><strong>${mockStaff.length}</strong><small>Активные профили</small></div>
        <div class="team-overview-card"><span>Записей сегодня</span><strong>${teamToday}</strong><small>По всем мастерам</small></div>
        <div class="team-overview-card"><span>Визитов за период</span><strong>${teamCompleted.length}</strong><small>${teamPeriodMode === 'month' ? 'Текущий месяц' : periodLabel}</small></div>
        <div class="team-overview-card"><span>Получено за период</span><strong>${Math.round(teamRevenue).toLocaleString('ru-RU')} ₽</strong><small>${teamPeriodMode === 'month' ? 'Текущий месяц' : periodLabel}</small></div>`;

    if (mockStaff.length === 0) {
        const empty = '<p class="team-empty-state">Нет мастеров</p>';
        if (listPC) listPC.innerHTML = empty;
        if (listMobile) listMobile.innerHTML = empty;
        return;
    }

    const html = mockStaff.map(staff => {
        const id = escapeBookingHtml(staff.id);
        const name = escapeBookingHtml(staff.name);
        const pin = escapeBookingHtml(staff.pin);
        const isAdmin = staff.role === 'admin';
        const roleLabel = isAdmin ? 'Главный мастер' : 'Барбер';
        const initials = escapeBookingHtml(String(staff.name || '?').trim().slice(0, 1).toUpperCase() || '?');
        const staffBookings = bookings.filter(item => String(item.barberId) === String(staff.id));
        const staffMonthBookings = staffBookings.filter(item => inSelectedPeriod(item.date));
        const staffCompleted = staffMonthBookings.filter(item => item.status === 'completed').length;
        const staffRevenue = staffMonthBookings.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        return `
            <article class="team-card team-member-card" data-staff-card data-staff-id="${id}" tabindex="0" role="button" aria-label="Статистика: ${name}">
                <div class="team-avatar" aria-hidden="true">${initials}</div>
                <div class="team-info">
                    <h3 class="team-name">${name}</h3>
                    <span class="team-role">${roleLabel}</span>
                    <div class="team-performance"><span><strong>${staffCompleted}</strong> визитов</span><span><strong>${Math.round(staffRevenue).toLocaleString('ru-RU')} ₽</strong> получено</span></div>
                    <span class="team-pin">Доступ защищён · PIN скрыт</span>
                </div>
                <div class="team-actions">
                    <button type="button" class="team-action-btn reset" data-staff-action="edit" data-staff-id="${id}">Изменить имя</button>
                    <button type="button" class="team-action-btn reset" data-staff-action="reset" data-staff-id="${id}">Сменить PIN</button>
                    ${!isAdmin ? `<button type="button" class="team-action-btn delete" data-staff-action="delete" data-staff-id="${id}">Удалить</button>` : ''}
                </div>
            </article>
        `;
    }).join('');

    [listPC, listMobile].forEach(container => {
        if (!container) return;
        container.innerHTML = html;
        container.querySelectorAll('[data-staff-card]').forEach(card => {
            const id = card.getAttribute('data-staff-id');
            const openStats = () => showBarberStats(id);
            card.addEventListener('click', event => {
                if (event.target.closest('[data-staff-action]')) return;
                openStats();
            });
            card.addEventListener('keydown', event => {
                if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                openStats();
            });
        });
        container.querySelectorAll('[data-staff-action]').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const id = button.getAttribute('data-staff-id');
                if (button.getAttribute('data-staff-action') === 'edit') openStaffEditModal(id);
                if (button.getAttribute('data-staff-action') === 'reset') resetStaffPin(id);
                if (button.getAttribute('data-staff-action') === 'delete') deleteStaff(id);
            });
        });
    });
}

function openStaffModal() {
    if (!requireAdminAction('Управлять командой может только Али')) return;
    document.getElementById('staffName').value = '';
    document.getElementById('staffPin').value = '';
    openModal('staffModal');
}

function openStaffEditModal(id) {
    if (!requireAdminAction('Редактировать мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(id));
    if (!staff || staff.role === 'admin') return;
    staffToEditId = String(id);
    document.getElementById('staffEditName').value = staff.name || '';
    openModal('staffEditModal');
}
function saveStaffEdit() {
    if (!requireAdminAction('Редактировать мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(staffToEditId));
    const name = document.getElementById('staffEditName').value.trim();
    if (!staff || !name) return showToast('Введите имя мастера', 'error');
    if (mockStaff.some(item => String(item.id) !== String(staffToEditId) && item.name.trim().toLowerCase() === name.toLowerCase())) {
        return showToast('Мастер с таким именем уже есть', 'error');
    }
    staff.name = name;
    localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
    closeModal('staffEditModal');
    staffToEditId = null;
    renderTeam();
    showToast('Профиль мастера обновлён', 'success');
}

function addStaff() {
    if (!requireAdminAction('Добавлять мастеров может только Али')) return;
    const name = document.getElementById('staffName').value;
    const pin = document.getElementById('staffPin').value;

    if (!name || !/^\d{4}$/.test(pin)) return showToast('Введите имя и PIN из 4 цифр', 'error');
    if (mockStaff.some(s => s.pin === pin)) return showToast('Этот PIN уже занят', 'error');

    const newStaff = {
        id: 'b_' + Date.now(),
        name: name,
        role: 'barber',
        pin: pin,
        type: 'barber'
    };

    mockStaff.push(newStaff);
    localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
    closeModal('staffModal');
    showToast('Мастер добавлен', 'success');
    renderTeam();
}

function resetStaffPin(id) {
    if (!requireAdminAction('Изменять PIN мастеров может только Али')) return;
    staffToResetPin = id;
    document.getElementById('adminNewPinInput').value = '';
    openModal('adminResetPinModal');
}

function submitAdminResetPin() {
    if (!requireAdminAction('Изменять PIN мастеров может только Али')) return;
    const newPin = document.getElementById('adminNewPinInput').value;
    if (!/^\d{4}$/.test(newPin)) {
        return showToast('PIN должен состоять из 4 цифр', 'error');
    }
    
    // Проверка, что PIN не занят
    if (mockStaff.some(s => s.pin === newPin)) {
        return showToast('Этот PIN уже занят', 'error');
    }

    const staff = mockStaff.find(s => s.id === staffToResetPin);
    if (staff) {
        staff.pin = newPin;
        localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
        closeModal('adminResetPinModal');
        showToast('PIN обновлен', 'success');
        renderTeam();
        
        // Обновляем статистику, если она открыта
        if (document.getElementById('barberStatsModal').classList.contains('active')) {
            showBarberStats(staffToResetPin);
        }
    }
}

function deleteStaff(id) {
    if (!requireAdminAction('Удалять мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(id));
    if (!staff || staff.role === 'admin') return showToast('Главного мастера удалить нельзя', 'error');
    const today = new Date();
    today.setHours(0,0,0,0);
    const hasUpcoming = bookings.some(item => String(item.barberId) === String(id) && item.status !== 'cancelled' && (() => {
        const parts = String(item.date || '').split('.').map(Number);
        if (parts.length !== 3 || !parts.every(Number.isFinite)) return false;
        const date = new Date(parts[2],parts[1]-1,parts[0]);
        return date >= today;
    })());
    if (hasUpcoming) return showToast('Нельзя удалить мастера с будущими активными записями. Сначала перенесите их.', 'error');
    showConfirm('Удалить мастера?', 'История визитов сохранится, но мастер исчезнет из списка сотрудников.', 'Да, удалить', () => {
        const index = mockStaff.findIndex(item => String(item.id) === String(id));
        if (index < 0) return;
        mockStaff.splice(index,1);
        localStorage.setItem(appStorageKey('mensfire_admin_staff'),JSON.stringify(mockStaff));
        showToast('Мастер удалён из команды','success');
        renderTeam();
    });
}

// --- АНАЛИТИКА БАРБЕРА ---
function showBarberStats(id) {
    if (!requireAdminAction('Статистика мастеров доступна только Али')) return;
    const staff = mockStaff.find(s => s.id === id);
    if (!staff) return;

    document.getElementById('statsBarberName').innerText = staff.name;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayStr = today.toLocaleDateString('ru-RU');

    // Получаем все завершенные записи этого мастера
    const allCompleted = bookings.filter(b => b.barberId === id && b.status === 'completed');
    
    // За текущий месяц
    const monthBookings = allCompleted.filter(b => {
        const [d, m, y] = b.date.split('.');
        return parseInt(y) === currentYear && (parseInt(m) - 1) === currentMonth;
    });

    // За сегодня
    const todayBookings = allCompleted.filter(b => b.date === todayStr);

    // Считаем суммы
    const monthRevenue = monthBookings.reduce((sum, b) => sum + getBookingCollectedAmount(b), 0);
    const todayRevenue = todayBookings.reduce((sum, b) => sum + getBookingCollectedAmount(b), 0);
    
    const monthSalary = Math.round(monthRevenue * 0.4);
    const todaySalary = Math.round(todayRevenue * 0.4);

    // Уникальные клиенты за месяц
    const uniqueClients = new Set(monthBookings.map(b => b.clientName));

    // Топ услуга за месяц
    const serviceCounts = {};
    monthBookings.forEach(b => {
        (b.services || []).forEach(s => {
            serviceCounts[s.title] = (serviceCounts[s.title] || 0) + 1;
        });
    });
    let topService = '-';
    let topCount = 0;
    for (const [title, count] of Object.entries(serviceCounts)) {
        if (count > topCount) { topCount = count; topService = title; }
    }

    // Заполняем данные
    document.getElementById('statsMonthVisits').innerText = monthBookings.length;
    document.getElementById('statsMonthClients').innerText = uniqueClients.size;
    document.getElementById('statsMonthRevenue').innerText = monthRevenue + ' ₽';
    document.getElementById('statsMonthSalary').innerText = monthSalary + ' ₽';
    
    document.getElementById('statsTodayVisits').innerText = todayBookings.length;
    document.getElementById('statsTodayRevenue').innerText = todayRevenue + ' ₽';
    document.getElementById('statsTodaySalary').innerText = todaySalary + ' ₽';

    document.getElementById('statsTopService').innerText = topService;
    document.getElementById('statsTopServiceCount').innerText = topCount + ' раз';

    // Настраиваем кнопку сброса PIN
    const resetBtn = document.getElementById('statsResetPinBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            closeModal('barberStatsModal');
            resetStaffPin(id);
        };
    }

    openModal('barberStatsModal');
}

// Добавь эту переменную в начало скрипта или прямо перед функцией
let currentClientsTab = 'all';
let currentClientsWorkspaceMode = 'clients';
let clientsTasksFilter = 'all';
let clientsTasksSearchQuery = '';
let clientsTasksBarberFilter = 'all';
let clientsTaskAuditActionFilter = 'all';
let clientsTaskAuditActorFilter = 'all';
let clientsTaskAuditFrom = '';
let clientsTaskAuditTo = ''; 
let clientsSearchQuery = '';
let clientsSegmentFilter = 'all';
let clientsDataQualityExpanded = false;
let pendingClientMergePhone = '';

function setClientsSearchQuery(value) {
    clientsSearchQuery = value.trim().toLowerCase();
    renderClients(currentClientsTab);
}

let selectedClientProfileKey = null;

function normalizeClientPhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function getClientProfileKey(name, barberId, phone = '') {
    const normalizedPhone = normalizeClientPhone(phone);
    return normalizedPhone.length >= 7
        ? 'phone:' + normalizedPhone
        : JSON.stringify([name, barberId]);
}

function findClientProfile(name, barberId) {
    const legacyKey = JSON.stringify([name, barberId]);
    const legacyProfile = clientProfiles[legacyKey] || {};
    const canonicalKey = getClientProfileKey(name, barberId, legacyProfile.phone);
    return {
        key: canonicalKey,
        profile: clientProfiles[canonicalKey] || legacyProfile,
        legacyKey
    };
}

function openRetailHistoryProduct(productId, sku, title) {
    const product = (productId ? inventoryProducts.find(item => String(item.id) === String(productId)) : null) ||
        (sku ? inventoryProducts.find(item => String(item.sku || '').toLowerCase() === String(sku).toLowerCase()) : null) ||
        (!productId && !sku && title ? inventoryProducts.find(item => String(item.title || '').toLowerCase() === String(title).toLowerCase()) : null);
    if (!product) {
        showToast('Товар больше не найден на складе', 'error');
        return;
    }
    switchView('viewInventory');
    const search = document.getElementById('inventorySearch');
    if (search) search.value = product.title;
    renderInventory();
    setTimeout(() => {
        const cards = Array.from(document.querySelectorAll('#inventoryCatalog .inventory-product-card'));
        const card = cards.find(node => node.querySelector('h3')?.textContent.trim() === product.title);
        if (card) card.scrollIntoView({behavior:'smooth',block:'center'});
        else showToast('Карточка товара найдена, но не отображается в каталоге', 'info');
    }, 80);
}

function openRetailHistoryBooking(bookingId) {
    const booking = bookings.find(item => String(item.id) === String(bookingId));
    if (!booking) {
        showToast('Связанный визит не найден', 'error');
        return;
    }
    selectedScheduleDate = booking.date || selectedScheduleDate;
    switchView('viewSchedule');
    renderSchedule();
    setTimeout(() => openActionModal(booking.id), 120);
}

function renderClientRetailPurchases(clientBookings = []) {
    const root = document.getElementById('clientRetailPurchases');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const phone = normalizeClientPhone(profile.phone);
    const sales = clientRetailSales.filter(sale => {
        if (sale.clientProfileKey && sale.clientProfileKey === selectedClientProfileKey) return true;
        const salePhone = normalizeClientPhone(sale.clientPhone);
        if (phone.length >= 7 && salePhone.length >= 7) return phone === salePhone;
        return !salePhone && !phone && sale.clientNameSnapshot && sale.clientNameSnapshot.trim().toLowerCase() === String(profile.clientName || '').trim().toLowerCase();
    }).sort((a,b) => new Date(b.soldAt || 0) - new Date(a.soldAt || 0));
    const fmt = value => Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
    const dateLabel = value => {
        const date = new Date(value || '');
        return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleString('ru-RU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    };
    const totals = sales.reduce((sum,sale) => {
        const net = getRetailSaleNetTotal(sale);
        const received = Math.min(net,Math.max(0,Number(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.total : 0)) || 0));
        sum.purchases += net;
        sum.received += received;
        sum.debt += Math.max(0,net-received);
        sum.units += (sale.items || []).reduce((n,item) => n + Math.max(0,(Number(item.quantity)||0)-(Number(item.refundedQuantity)||0)),0);
        return sum;
    },{purchases:0,received:0,debt:0,units:0});
    const averagePurchase = totals.purchases / Math.max(1, sales.length);
    const productFrequency = new Map();
    sales.forEach(sale => (sale.items || []).forEach(item => {
        const remaining = Math.max(0, (Number(item.quantity) || 0) - (Number(item.refundedQuantity) || 0));
        if (!remaining) return;
        const title = String(item.titleSnapshot || 'Товар').trim() || 'Товар';
        productFrequency.set(title, (productFrequency.get(title) || 0) + remaining);
    }));
    const favoriteProduct = [...productFrequency.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))[0];
    const lastPurchaseLabel = dateLabel(sales[0].soldAt).replace(/,?\s*\d{2}:\d{2}$/, '');
    root.innerHTML = sales.length ?
        '<div class="client-retail-summary">' +
            '<div><span>Покупок</span><b>' + sales.length + '</b></div>' +
            '<div><span>Товаров</span><b>' + totals.units + ' ед.</b></div>' +
            '<div><span>Стоимость покупок</span><b>' + fmt(totals.purchases) + '</b></div>' +
            '<div><span>Средний чек</span><b>' + fmt(averagePurchase) + '</b></div>' +
            '<div><span>Получено</span><b class="is-received">' + fmt(totals.received) + '</b></div>' +
            '<div><span>Задолженность</span><b class="' + (totals.debt > 0 ? 'is-debt' : 'is-received') + '">' + fmt(totals.debt) + '</b></div>' +
            '<div><span>Последняя покупка</span><b>' + escapeBookingHtml(lastPurchaseLabel) + '</b></div>' +
            '<div><span>Частый товар</span><b title="' + escapeBookingHtml(favoriteProduct ? favoriteProduct[0] : '—') + '">' + escapeBookingHtml(favoriteProduct ? favoriteProduct[0] + ' · ' + favoriteProduct[1] + ' ед.' : '—') + '</b></div>' +
        '</div>' +
        '<div class="client-retail-list">' + sales.map(sale => {
            const booking = sale.bookingId ? ((clientBookings || []).find(item => String(item.id) === String(sale.bookingId)) || bookings.find(item => String(item.id) === String(sale.bookingId))) : null;
            const statusLabels = {paid:'Оплачено',partial:'Частично',unpaid:'Не оплачено',refunded:'Возврат'};
            const net = getRetailSaleNetTotal(sale);
            const received = Math.min(net,Math.max(0,Number(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.total : 0)) || 0));
            const debt = Math.max(0,net-received);
            const items = (sale.items || []).map(item => {
                const returned=Number(item.refundedQuantity)||0;
                const remaining=Math.max(0,(Number(item.quantity)||0)-returned);
                const product = (item.productId ? inventoryProducts.find(product => String(product.id) === String(item.productId)) : null) ||
                    (item.sku ? inventoryProducts.find(product => String(product.sku || '').toLowerCase() === String(item.sku).toLowerCase()) : null) ||
                    (!item.productId && !item.sku ? inventoryProducts.find(product => String(product.title || '').toLowerCase() === String(item.titleSnapshot || '').toLowerCase()) : null);
                const productAction = product
                    ? '<button type="button" class="client-retail-link" onclick="openRetailHistoryProduct(' + escapeBookingHtml(JSON.stringify(String(product.id))) + ',' + escapeBookingHtml(JSON.stringify(String(item.sku || product.sku || ''))) + ',' + escapeBookingHtml(JSON.stringify(String(item.titleSnapshot || product.title || ''))) + ')">Открыть товар</button>'
                    : '';
                return '<div class="client-retail-item"><span>' + escapeBookingHtml(item.titleSnapshot) + (item.sku ? ' · ' + escapeBookingHtml(item.sku) : '') + ' <small>× ' + remaining + (returned?' · возврат '+returned:'') + '</small>' + productAction + '</span><b>' + fmt(remaining*item.unitPrice) + '</b></div>';
            }).join('');
            const refunds = (Array.isArray(sale.refunds) ? sale.refunds : []).map(refund =>
                '<div class="client-retail-refund"><span>Возврат · ' + dateLabel(refund.createdAt) + (refund.note ? ' · ' + escapeBookingHtml(refund.note) : '') + '</span><b>−' + fmt(refund.value) + '</b></div>'
            ).join('');
            const bookingAction = booking
                ? '<button type="button" class="client-retail-link" onclick="openRetailHistoryBooking(' + escapeBookingHtml(JSON.stringify(String(booking.id))) + ')">Открыть визит</button>'
                : '';
            return '<article class="client-retail-sale"><div class="client-retail-sale-head"><div><strong>' + dateLabel(sale.soldAt) + '</strong><span>' + (booking ? 'Связано с визитом · ' + escapeBookingHtml(booking.date + ' в ' + booking.time) : sale.bookingId ? 'Визит не найден · ' + escapeBookingHtml(sale.bookingId) : 'Отдельная покупка') + '</span>' + bookingAction + '</div><b class="client-retail-status status-' + sale.paymentStatus + '">' + (statusLabels[sale.paymentStatus] || 'Статус не указан') + '</b></div>' +
                (items || '<div class="client-retail-empty-items">Состав покупки не указан</div>') +
                '<div class="client-retail-sale-total"><span>Стоимость после возвратов</span><strong>' + fmt(net) + '</strong></div>' +
                '<div class="client-retail-payment-detail"><span>Получено: <b>' + fmt(received) + '</b></span><span>Долг: <b class="' + (debt > 0 ? 'is-debt' : 'is-received') + '">' + fmt(debt) + '</b></span></div>' +
                (refunds ? '<div class="client-retail-refunds">' + refunds + '</div>' : '') +
                (sale.notes ? '<p>' + escapeBookingHtml(sale.notes) + '</p>' : '') + '</article>';
        }).join('') + '</div>' :
        '<div class="client-retail-empty"><span class="client-retail-empty-icon">▧</span><strong>Покупок товаров пока нет</strong><p>Здесь появятся продажи из отдельного товарного чека. Услуги и оплаты визитов не дублируются в этой истории.</p></div>';
}
function renderClientProductRecommendations() {
    const root = document.getElementById('clientProductRecommendations');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const phone = normalizeClientPhone(profile.phone);
    const sales = clientRetailSales.filter(sale => {
        if (sale.clientProfileKey && sale.clientProfileKey === selectedClientProfileKey) return true;
        const salePhone = normalizeClientPhone(sale.clientPhone);
        if (phone.length >= 7 && salePhone.length >= 7) return phone === salePhone;
        return !salePhone && !phone && sale.clientNameSnapshot &&
            sale.clientNameSnapshot.trim().toLowerCase() === String(profile.clientName || '').trim().toLowerCase();
    });
    const frequency = new Map();
    sales.forEach(sale => (sale.items || []).forEach(item => {
        const quantity = Math.max(0, (Number(item.quantity) || 0) - (Number(item.refundedQuantity) || 0));
        if (!quantity) return;
        const product = (item.productId ? inventoryProducts.find(entry => String(entry.id) === String(item.productId)) : null) ||
            (item.sku ? inventoryProducts.find(entry => String(entry.sku || '').toLowerCase() === String(item.sku).toLowerCase()) : null) ||
            (!item.productId && !item.sku ? inventoryProducts.find(entry => String(entry.title || '').trim().toLowerCase() === String(item.titleSnapshot || '').trim().toLowerCase()) : null);
        if (!product || !product.active || Number(product.stock) <= 0) return;
        const current = frequency.get(String(product.id)) || { product, quantity: 0, purchases: 0, lastBought: '' };
        current.quantity += quantity;
        current.purchases += 1;
        if (!current.lastBought || new Date(sale.soldAt || 0) > new Date(current.lastBought)) current.lastBought = sale.soldAt || '';
        frequency.set(String(product.id), current);
    }));
    const suggestions = [...frequency.values()].sort((a, b) =>
        b.purchases - a.purchases || b.quantity - a.quantity ||
        new Date(b.lastBought || 0) - new Date(a.lastBought || 0)
    ).slice(0, 4);
    const fmt = value => Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
    root.innerHTML = suggestions.length
        ? '<div class="client-product-recommendation-grid">' + suggestions.map(item =>
            '<article class="client-product-recommendation"><div><strong>' + escapeBookingHtml(item.product.title || 'Товар') + '</strong>' +
            '<span>Покупал: ' + item.purchases + ' ' + (item.purchases === 1 ? 'раз' : item.purchases < 5 ? 'раза' : 'раз') +
            ' · всего ' + item.quantity + ' ед.</span><small>В наличии: ' + Math.max(0, Number(item.product.stock) || 0) + ' ' + escapeBookingHtml(item.product.unit || 'шт.') + '</small></div>' +
            '<div class="client-product-recommendation-action"><b>' + fmt(item.product.salePrice) + '</b>' +
            '<button type="button" onclick="openRetailHistoryProduct(' + escapeBookingHtml(JSON.stringify(String(item.product.id))) + ',' +
            escapeBookingHtml(JSON.stringify(String(item.product.sku || ''))) + ',' +
            escapeBookingHtml(JSON.stringify(String(item.product.title || ''))) + ')">Открыть товар</button></div></article>'
        ).join('') + '</div>'
        : '<div class="client-product-recommendation-empty">' +
            (sales.length ? 'По истории покупок нет совпадений с активным каталогом и товарами в наличии.' : 'Рекомендации появятся после первой покупки товара, который есть в активном каталоге.') +
            '</div>';
}

function renderClientInteractionHistory() {
    const root = document.getElementById('clientInteractionHistory');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const items = Array.isArray(profile.interactions) ? profile.interactions.slice() : [];
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const labels = { call: 'Звонок', message: 'Сообщение', meeting: 'Личная встреча', note: 'Заметка', other: 'Другое' };
    root.innerHTML = items.length ? items.map(item => {
        const date = new Date(item.createdAt || '');
        const dateLabel = Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleString('ru-RU', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        return '<article class="client-interaction-item"><div class="client-interaction-meta"><b>' + escapeBookingHtml(labels[item.type] || 'Другое') + '</b><span>' + escapeBookingHtml(dateLabel) + '</span></div><p>' + escapeBookingHtml(item.text || '') + '</p><small>' + escapeBookingHtml(item.author || 'Сотрудник') + '</small></article>';
    }).join('') : '<div class="client-interaction-empty">Пока нет записей об общении с клиентом</div>';
}
function addClientInteraction() {
    if (!selectedClientProfileKey) return;
    const typeInput = document.getElementById('clientInteractionType');
    const textInput = document.getElementById('clientInteractionText');
    const text = String(textInput?.value || '').trim();
    if (!text) return showToast('Добавьте краткое описание контакта', 'error');
    const profile = clientProfiles[selectedClientProfileKey] || {};
    if (!Array.isArray(profile.interactions)) profile.interactions = [];
    const author = currentUser?.name || 'Сотрудник';
    profile.interactions.push({
        id: 'interaction_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: ['call','message','meeting','note','other'].includes(typeInput?.value) ? typeInput.value : 'note',
        text: text.slice(0, 1200),
        createdAt: new Date().toISOString(),
        author: String(author).slice(0, 100)
    });
    clientProfiles[selectedClientProfileKey] = profile;
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    if (textInput) textInput.value = '';
    renderClientInteractionHistory();
    refreshSelectedClientActivity();
    renderClientTasks();
    showToast('Контакт добавлен в историю', 'success');
}

function parseClientTaskDate(value) {
    const match = String(value || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1]) ? date : null;
}
function renderClientTasks() {
    const root = document.getElementById('clientTasksList');
    const summary = document.getElementById('clientTasksSummary');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const tasks = Array.isArray(profile.tasks) ? profile.tasks.slice() : [];
    tasks.sort((a, b) => {
        if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
        return (parseClientTaskDate(a.dueDate)?.getTime() || Infinity) - (parseClientTaskDate(b.dueDate)?.getTime() || Infinity);
    });
    const today = new Date(); today.setHours(0,0,0,0);
    const openTasks = tasks.filter(task => !task.done);
    const overdue = openTasks.filter(task => {
        const due = parseClientTaskDate(task.dueDate);
        return due && due < today;
    }).length;
    if (summary) summary.textContent = openTasks.length + ' активных' + (overdue ? ' · просрочено: ' + overdue : '');
    root.innerHTML = tasks.length ? tasks.map(task => {
        const due = parseClientTaskDate(task.dueDate);
        const isOverdue = !task.done && due && due < today;
        return '<article class="client-task-item' + (task.done ? ' is-done' : '') + (isOverdue ? ' is-overdue' : '') + '">' +
            '<div class="client-task-main"><strong>' + escapeBookingHtml(task.title || 'Задача') + '</strong>' +
            '<span>' + (task.dueDate ? 'Срок: ' + escapeBookingHtml(task.dueDate) : 'Без срока') + (task.done ? ' · Выполнено' : isOverdue ? ' · Просрочено' : '') + '</span></div>' +
            '<div class="client-task-actions">' +
            (!task.done ? '<button type="button" data-client-task-done="' + escapeBookingHtml(task.id) + '">Готово</button>' : '') +
            '<button type="button" class="client-task-delete" data-client-task-delete="' + escapeBookingHtml(task.id) + '">Удалить</button></div></article>';
    }).join('') : '<div class="client-interaction-empty">Пока нет задач и напоминаний</div>';
    root.querySelectorAll('[data-client-task-done]').forEach(button => button.addEventListener('click', () => completeClientTask(button.dataset.clientTaskDone)));
    root.querySelectorAll('[data-client-task-delete]').forEach(button => button.addEventListener('click', () => deleteClientTask(button.dataset.clientTaskDelete)));
}
function logClientTaskAction(profile, task, action, details = '') {
    if (!profile || !task) return;
    if (!Array.isArray(profile.taskHistory)) profile.taskHistory = [];
    profile.taskHistory.unshift({
        id: 'tasklog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        taskId: String(task.id || ''),
        taskTitle: String(task.title || 'Задача').slice(0, 180),
        action,
        details: String(details || '').slice(0, 300),
        actor: String(currentUser?.name || 'Сотрудник').slice(0, 100),
        actorId: String(currentUser?.id || ''),
        createdAt: new Date().toISOString()
    });
    profile.taskHistory = profile.taskHistory.slice(0, 300);
}

function addClientTask() {
    if (!selectedClientProfileKey) return;
    const titleInput = document.getElementById('clientTaskTitle');
    const dateInput = document.getElementById('clientTaskDueDate');
    const title = String(titleInput?.value || '').trim();
    const dueDate = String(dateInput?.value || '').trim();
    if (!title) return showToast('Напишите, что нужно сделать', 'error');
    if (dueDate && !parseClientTaskDate(dueDate)) return showToast('Укажите дату в формате ДД.ММ.ГГГГ', 'error');
    const profile = clientProfiles[selectedClientProfileKey] || {};
    if (!Array.isArray(profile.tasks)) profile.tasks = [];
    const newTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: title.slice(0, 180),
        dueDate,
        done: false,
        createdAt: new Date().toISOString(),
        author: String(currentUser?.name || 'Сотрудник').slice(0, 100)
    };
    profile.tasks.push(newTask);
    logClientTaskAction(profile, newTask, 'created', 'Задача создана');
    clientProfiles[selectedClientProfileKey] = profile;
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    if (titleInput) titleInput.value = '';
    if (dateInput) dateInput.value = '';
    renderClientTasks();
    refreshSelectedClientActivity();
    showToast('Напоминание добавлено', 'success');
}
function completeClientTask(taskId) {
    if (!selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const task = (profile.tasks || []).find(item => item.id === taskId);
    if (!task) return;
    task.done = true;
    task.completedAt = new Date().toISOString();
    logClientTaskAction(profile, task, 'completed', 'Задача отмечена выполненной');
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    renderClientTasks();
    refreshSelectedClientActivity();
    showToast('Задача отмечена выполненной', 'success');
}
function deleteClientTask(taskId) {
    if (!selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const removedTask = (profile.tasks || []).find(item => item.id === taskId);
    if (removedTask) logClientTaskAction(profile, removedTask, 'deleted', 'Задача удалена');
    profile.tasks = (profile.tasks || []).filter(item => item.id !== taskId);
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    renderClientTasks();
    refreshSelectedClientActivity();
    showToast('Задача удалена', 'success');
}

function saveClientProfile() {
    if (!selectedClientProfileKey) return;

    const previousProfile = clientProfiles[selectedClientProfileKey] || {};
    const clientName = previousProfile.clientName || '';
    const barberId = previousProfile.barberId || '';
    const legacyKey = JSON.stringify([clientName, barberId]);
    const phone = document.getElementById('clientDetailsPhone').value.trim();
    const canonicalKey = getClientProfileKey(clientName, barberId, phone);
    const updatedProfile = {
        ...previousProfile,
        ...(clientProfiles[canonicalKey] || {}),
        clientName,
        barberId,
        phone,
        birthday: document.getElementById('clientDetailsBirthday')?.value || '',
        tag: document.getElementById('clientDetailsTag')?.value || 'regular',
        notes: document.getElementById('clientDetailsNotes').value.trim(),
        preferences: document.getElementById('clientDetailsPreferences')?.value.trim() || ''
    };

    // Legacy-ключ связывает конкретную карточку с общим телефонным профилем.
    // Не удаляем общий phone:-ключ при смене номера: им могут пользоваться
    // карточки этого же клиента у других мастеров.
    clientProfiles[legacyKey] = updatedProfile;
    clientProfiles[canonicalKey] = updatedProfile;
    selectedClientProfileKey = canonicalKey;

    localStorage.setItem(
        appStorageKey('mensfire_client_profiles'),
        JSON.stringify(clientProfiles)
    );

    showToast('Данные клиента сохранены', 'success');
}
function setClientsSegmentFilter(filter) {
    clientsSegmentFilter = ['all','new','regular','vip','inactive','cancellations','highcheck','highvalue'].includes(filter) ? filter : 'all';
    renderClients(currentClientsTab);
}

function renderClientsAnalytics(sourceBookings, clientGroups) {
    const root = document.getElementById('clientsAnalytics');
    if (!root) return;
    const now = new Date();
    let rangeStart = clientsPeriodMode === 'sixMonths' ? new Date(now.getFullYear(),now.getMonth()-5,1) : clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),1) : parseReportDate(clientsRangeStart);
    let rangeEnd = clientsPeriodMode === 'sixMonths' || clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),now.getDate()) : parseReportDate(clientsRangeEnd);
    rangeStart = rangeStart || new Date(now.getFullYear(),now.getMonth()-5,1);
    rangeEnd = rangeEnd || now;
    if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
    const rangeEndExclusive = new Date(rangeEnd); rangeEndExclusive.setDate(rangeEndExclusive.getDate()+1);
    const inRange = booking => { const date = parseReportDate(booking.date); return date && date >= rangeStart && date < rangeEndExclusive; };
    const periodBookings = (sourceBookings || []).filter(inRange);
    const completed = periodBookings.filter(booking => booking.status === 'completed');
    const monthKeys = [];
    const cursor = new Date(rangeStart.getFullYear(),rangeStart.getMonth(),1);
    const lastMonth = new Date(rangeEnd.getFullYear(),rangeEnd.getMonth(),1);
    while (cursor <= lastMonth && monthKeys.length < 18) {
        monthKeys.push({key:cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0'),label:cursor.toLocaleDateString('ru-RU',{month:'short',year:rangeStart.getFullYear()!==rangeEnd.getFullYear()?'2-digit':undefined}).replace('.','')});
        cursor.setMonth(cursor.getMonth()+1);
    }
    const monthStats = monthKeys.map(month=>({...month,revenue:0,visits:0}));
    const monthIndex = new Map(monthStats.map((item,index)=>[item.key,index]));
    completed.forEach(booking=>{
        const date=parseReportDate(booking.date), key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'), index=monthIndex.get(key);
        if(index===undefined)return;
        monthStats[index].visits++;
        monthStats[index].revenue+=getBookingCollectedAmount(booking);
    });
    const maxRevenue=Math.max(1,...monthStats.map(item=>item.revenue));
    const chartWidth=520,chartHeight=154,left=12,right=12,top=12,bottom=28,plotWidth=chartWidth-left-right,plotHeight=chartHeight-top-bottom;
    const points=monthStats.map((item,index)=>({x:left+(monthStats.length===1?plotWidth/2:index*plotWidth/(monthStats.length-1)),y:top+plotHeight-(item.revenue/maxRevenue)*plotHeight,...item}));
    const linePath=points.map((point,index)=>(index?'L':'M')+point.x.toFixed(1)+' '+point.y.toFixed(1)).join(' ');
    const areaPath=linePath+' L '+points[points.length-1].x.toFixed(1)+' '+(top+plotHeight)+' L '+points[0].x.toFixed(1)+' '+(top+plotHeight)+' Z';
    const periodGroups=(clientGroups||[]).map(client=>{
        const visits=client.visits.filter(inRange),done=visits.filter(visit=>visit.status==='completed');
        return {...client,visits,lifetimeCompletedCount:client.completedCount,completedCount:done.length,totalSpent:visits.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0),completedRevenue:done.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0)};
    }).filter(client=>client.visits.length);
    const totalClients=periodGroups.length,totalVisits=completed.length,totalRevenue=completed.reduce((sum,booking)=>sum+getBookingCollectedAmount(booking),0);
    const segmentCounts={new:0,regular:0,vip:0};
    // Сегмент клиента — характеристика всей истории, а не только выбранного отчётного периода.
    periodGroups.forEach(client=>{const tag=client.profileSummary.tag||(client.lifetimeCompletedCount<=1?'new':'regular');segmentCounts[segmentCounts[tag]===undefined?'regular':tag]++;});
    const newPercent=totalClients?Math.round(segmentCounts.new/totalClients*100):0,regularPercent=totalClients?Math.round(segmentCounts.regular/totalClients*100):0,vipStart=newPercent+regularPercent;
    const maxVisits=Math.max(0,...monthStats.map(item=>item.visits));
    const periodLabel=formatReportDate(rangeStart)+' — '+formatReportDate(rangeEnd);
    const controls=document.getElementById('clientsPeriodControls');
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период аналитики клиентов">
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='sixMonths'?'active':''}" onclick="setClientsPeriod('sixMonths')">6 месяцев</button>
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='month'?'active':''}" onclick="setClientsPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='custom'?'active':''}" onclick="setClientsPeriod('custom')">Период</button>
            </div>
            <div class="finance-range-fields" ${clientsPeriodMode==='custom'?'':'hidden'}>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('clientsStart')">${formatReportDate(parseReportDate(clientsRangeStart)||rangeStart)}</button>
                <span>—</span>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('clientsEnd')">${formatReportDate(parseReportDate(clientsRangeEnd)||rangeEnd)}</button>
            </div>
        </div>`;
    root.innerHTML = `
        <div class="clients-analytics-heading">
            <div><span class="finance-eyebrow">CLIENT INSIGHTS</span><h3>Аналитика клиентов</h3><p>Визиты, выручка и структура аудитории за период</p></div>
            <span class="clients-analytics-period">${clientsPeriodMode==='sixMonths'?'6 месяцев':clientsPeriodMode==='month'?'Текущий месяц':periodLabel}</span>
        </div>
        <div class="clients-period-summary">
            <div><span>Получено за период</span><strong>${Math.round(totalRevenue).toLocaleString('ru-RU')} ₽</strong></div>
            <div><span>Завершено визитов</span><strong>${totalVisits}</strong></div>
            <div><span>Клиентов за период</span><strong>${totalClients}</strong></div>
        </div>
        <div class="clients-analytics-grid">
            <article class="clients-chart-card clients-revenue-chart">
                <div class="clients-chart-title"><div><span>Выручка по месяцам</span><strong>${Math.round(totalRevenue).toLocaleString('ru-RU')} ₽</strong></div><span class="clients-chart-icon">↗</span></div>
                <svg class="clients-line-chart" viewBox="0 0 520 154" role="img" aria-label="Динамика выручки по месяцам за выбранный период">
                    <defs><linearGradient id="clientsChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d4af37" stop-opacity=".30"/><stop offset="100%" stop-color="#d4af37" stop-opacity="0"/></linearGradient></defs>
                    <path d="M ${left} ${top+plotHeight/2} H ${chartWidth-right}" class="clients-chart-gridline"/><path d="M ${left} ${top+plotHeight} H ${chartWidth-right}" class="clients-chart-gridline"/>
                    <path d="${areaPath}" class="clients-chart-area"/><path d="${linePath}" class="clients-chart-line"/>
                    ${points.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="4" class="clients-chart-point"><title>${point.label}: ${Math.round(point.revenue).toLocaleString('ru-RU')} ₽</title></circle>`).join('')}
                    ${points.map(point=>`<text x="${point.x}" y="150" text-anchor="middle" class="clients-chart-label">${point.label}</text>`).join('')}
                </svg>
                <div class="clients-chart-footer"><span>${totalVisits} завершённых визитов · ${periodLabel}</span><span>Демо-данные</span></div>
            </article>
            <article class="clients-chart-card clients-loyalty-chart">
                <div class="clients-chart-title"><div><span>Сегменты аудитории</span><strong>${totalClients} клиентов</strong></div><span class="clients-chart-icon">◎</span></div>
                <div class="clients-donut-layout"><div class="clients-donut" style="--new-share:${newPercent}%;--regular-share:${vipStart}%;--vip-share:100%"><div><strong>${totalClients}</strong><small>всего</small></div></div>
                    <div class="clients-donut-legend"><div><i class="new"></i><span>Новые</span><strong>${segmentCounts.new}</strong></div><div><i class="regular"></i><span>Постоянные</span><strong>${segmentCounts.regular}</strong></div><div><i class="vip"></i><span>VIP</span><strong>${segmentCounts.vip}</strong></div></div>
                </div>
                <div class="clients-chart-footer"><span>Сегментация за период</span><span>Демо</span></div>
            </article>
        </div>
        <div class="clients-monthly-strip">${monthStats.map(item=>`<div class="clients-month-stat"><span>${item.label}</span><strong>${item.visits}</strong><small>визитов</small><div><i style="width:${maxVisits?Math.max(4,item.visits/maxVisits*100):0}%"></i></div></div>`).join('')}</div>`;
}

function renderClientFollowUpPanel(clientGroups) {
    const root = document.getElementById('clientFollowUpPanel');
    if (!root) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const dayMs = 86400000;
    const clients = (Array.isArray(clientGroups) ? clientGroups : []).map(client => {
        const profile = client.profileSummary || client.profiles?.[0] || {};
        const completed = (client.visits || []).filter(visit => visit.status === 'completed' && parseClientDateTime(visit) > 0)
            .sort((a,b) => parseClientDateTime(b) - parseClientDateTime(a));
        const lastVisit = completed[0] || null;
        const daysAway = lastVisit ? Math.floor((today.getTime() - new Date(parseClientDateTime(lastVisit)).setHours(0,0,0,0)) / dayMs) : null;
        const hasUpcoming = (client.visits || []).some(visit => !['cancelled','completed','no_show','missed'].includes(String(visit.status || '').toLowerCase()) && parseClientDateTime(visit) >= Date.now());
        let birthdayDays = null;
        if (profile.birthday && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthday)) {
            const [,month,day] = profile.birthday.split('-').map(Number);
            const birthday = new Date(today.getFullYear(),month-1,day); birthday.setHours(0,0,0,0);
            if (birthday < today) birthday.setFullYear(today.getFullYear()+1);
            birthdayDays = Math.round((birthday-today)/dayMs);
        }
        return {...client,profile,lastVisit,daysAway,hasUpcoming,birthdayDays};
    });
    const dormant = clients.filter(c => c.daysAway !== null && c.daysAway >= 45 && !c.hasUpcoming).sort((a,b)=>b.daysAway-a.daysAway);
    const birthdays = clients.filter(c => c.birthdayDays !== null && c.birthdayDays <= 30).sort((a,b)=>a.birthdayDays-b.birthdayDays);
    const action = c => 'showClientDetails(' + escapeBookingHtml(JSON.stringify(String(c.name || ''))) + ',' + escapeBookingHtml(JSON.stringify(String(c.barberId || ''))) + ')';
    const birthdayLabel = n => n===0?'Сегодня':n===1?'Завтра':'Через '+n+' дн.';
    const items = (arr,kind) => arr.length ? arr.slice(0,4).map(c => {
        const detail = kind==='birthday' ? birthdayLabel(c.birthdayDays) : c.daysAway+' дн. без визита';
        const sub = kind==='birthday' ? 'День рождения' : (c.lastVisit ? 'Последний визит: '+escapeBookingHtml(c.lastVisit.date) : 'Нет завершённых визитов');
        return '<button type="button" class="client-followup-item" onclick="'+action(c)+'"><span class="client-followup-avatar">'+escapeBookingHtml(String(c.name || '?').charAt(0).toUpperCase())+'</span><span class="client-followup-copy"><b>'+escapeBookingHtml(c.name || 'Клиент')+'</b><small>'+detail+' · '+sub+'</small></span><span class="client-followup-arrow">›</span></button>';
    }).join('') : '<div class="client-followup-empty">'+(kind==='birthday'?'В ближайшие 30 дней дней рождения нет':'Клиентов, которым нужно напомнить, пока нет')+'</div>';
    root.innerHTML = '<div class="client-followup-heading"><div><span class="client-followup-eyebrow">CRM · ВНИМАНИЕ</span><h3>Забота о клиентах</h3><p>Подсказки для повторных визитов и персонального контакта</p></div><span class="client-followup-total">'+(dormant.length+birthdays.length)+'</span></div><div class="client-followup-columns"><section class="client-followup-section"><div class="client-followup-section-title"><span>↻</span><b>Пора напомнить</b><em>'+dormant.length+'</em></div><p>Нет завершённого визита 45+ дней и нет будущей записи</p>'+items(dormant,'return')+'</section><section class="client-followup-section"><div class="client-followup-section-title"><span>✦</span><b>Дни рождения</b><em>'+birthdays.length+'</em></div><p>Ближайшие 30 дней — повод поздравить</p>'+items(birthdays,'birthday')+'</section></div>';
}

function setClientsWorkspaceMode(mode) {
    if (window.innerWidth < 768) return;
    currentClientsWorkspaceMode = mode === 'tasks' ? 'tasks' : 'clients';
    const view = document.getElementById('viewClients');
    if (view) view.classList.toggle('crm-tasks-mode', currentClientsWorkspaceMode === 'tasks');
    document.querySelectorAll('.crm-workspace-switch button').forEach(button => {
        button.classList.toggle('active', button.textContent.includes(currentClientsWorkspaceMode === 'tasks' ? 'Задачи CRM' : 'Клиенты'));
    });
    renderClientTasksHub();
}

function renderClientTasksHub() {
    let auditExportRows = [];
    const root = document.getElementById('clientsTasksHub');
    if (!root) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const rows = [];
    const seenTaskIds = new Set();
    const seenLegacyTasks = new Set();
    Object.entries(clientProfiles || {}).forEach(([profileKey, profile]) => {
        if (!profile || !Array.isArray(profile.tasks)) return;
        const name = String(profile.clientName || '').trim();
        const barberId = String(profile.barberId || '');
        if (currentUser?.role === 'barber' && barberId !== String(currentUser.id)) return;
        profile.tasks.forEach(task => {
            const uniqueTaskId = String(task.id || '');
            const legacySignature = JSON.stringify([String(task.title || '').trim().toLocaleLowerCase('ru-RU'),String(task.dueDate || ''),String(task.createdAt || ''),Boolean(task.done)]);
            if (uniqueTaskId && seenTaskIds.has(uniqueTaskId)) return;
            if (!uniqueTaskId && seenLegacyTasks.has(legacySignature)) return;
            if (uniqueTaskId) seenTaskIds.add(uniqueTaskId); else seenLegacyTasks.add(legacySignature);
            const due = parseClientTaskDate(task.dueDate);
            rows.push({ profileKey, name: name || 'Клиент', barberId, task, due, overdue: !task.done && due && due < today });
        });
    });
    rows.sort((a,b) => {
        if (Boolean(a.task.done) !== Boolean(b.task.done)) return a.task.done ? 1 : -1;
        if (Boolean(a.overdue) !== Boolean(b.overdue)) return a.overdue ? -1 : 1;
        return (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity);
    });
    const active = rows.filter(row => !row.task.done);
    const overdueCount = active.filter(row => row.overdue).length;
    const upcomingCount = active.length - overdueCount;
    const count = document.getElementById('crmTasksTabCount');
    if (count) count.textContent = String(active.length);
    const filters = [{id:'all',label:'Все',count:rows.length},{id:'overdue',label:'Просроченные',count:overdueCount},{id:'upcoming',label:'Предстоящие',count:upcomingCount},{id:'done',label:'Выполненные',count:rows.length-active.length}];
    const query = clientsTasksSearchQuery.trim().toLocaleLowerCase('ru-RU');
    const visible = rows.filter(row => {
        if (clientsTasksFilter === 'overdue' && !row.overdue) return false;
        if (clientsTasksFilter === 'upcoming' && (row.task.done || row.overdue)) return false;
        if (clientsTasksFilter === 'done' && !row.task.done) return false;
        if (clientsTasksBarberFilter !== 'all' && row.barberId !== clientsTasksBarberFilter) return false;
        if (query) {
            const haystack = [row.name,row.task.title,row.task.author,mockStaff.find(item => String(item.id) === row.barberId)?.name || ''].join(' ').toLocaleLowerCase('ru-RU');
            if (!haystack.includes(query)) return false;
        }
        return true;
    });
    const barberOptions = (mockStaff || []).filter(staff => currentUser?.role !== 'barber' || String(staff.id) === String(currentUser.id))
        .map(staff => '<option value="' + escapeBookingHtml(String(staff.id)) + '"' + (clientsTasksBarberFilter === String(staff.id) ? ' selected' : '') + '>' + escapeBookingHtml(staff.name) + '</option>').join('');
    root.innerHTML = `
        <div class="crm-tasks-heading">
            <div><span class="workspace-eyebrow">CLIENT FOLLOW-UP</span><h3>Задачи и напоминания</h3><p>Все задачи клиентов в одном месте</p></div>
            <div class="crm-tasks-summary"><span><b>${active.length}</b> активных</span><span class="is-overdue"><b>${overdueCount}</b> просрочено</span></div>
        </div>
        <div class="crm-tasks-filters">${filters.map(item => `<button type="button" class="${clientsTasksFilter===item.id?'active':''}" onclick="setClientsTasksFilter('${item.id}')">${item.label}<span>${item.count}</span></button>`).join('')}</div>
        <div class="crm-tasks-toolbar">
            <input id="crmTasksSearch" type="search" value="${escapeBookingHtml(clientsTasksSearchQuery)}" placeholder="Найти задачу или клиента…">
            <select id="crmTasksBarberFilter" aria-label="Фильтр по мастеру"><option value="all">Все мастера</option>${barberOptions}</select>
            <span>${visible.length} из ${rows.length}</span>
        </div>
        <div class="crm-tasks-list">${visible.length ? visible.map(row => {
            const profileArg = escapeBookingHtml(row.profileKey);
            const taskId = escapeBookingHtml(row.task.id || '');
            const safeTitle = escapeBookingHtml(row.task.title || 'Задача без названия');
            const dueLabel = row.task.dueDate ? escapeBookingHtml(row.task.dueDate) : 'Без срока';
            const master = mockStaff.find(item => String(item.id) === row.barberId)?.name || '';
            const assignee = mockStaff.find(item => String(item.id) === String(row.task.assigneeId || ''))?.name || '';
            return `<article class="crm-task-row ${row.overdue?'is-overdue':''} ${row.task.done?'is-done':''}">
                <button type="button" class="crm-task-client" data-crm-open-client="${profileArg}" aria-label="Открыть клиента ${escapeBookingHtml(row.name)}">
                    <span class="crm-task-avatar">${escapeBookingHtml(row.name.charAt(0).toUpperCase())}</span>
                    <span><b>${escapeBookingHtml(row.name)}</b><small>${assignee ? 'Ответственный: '+escapeBookingHtml(assignee)+' · ' : ''}${master ? escapeBookingHtml(master)+' · ' : ''}${dueLabel}${row.overdue?' · Просрочено':row.task.done?' · Выполнено':''}</small></span>
                </button>
                <div class="crm-task-description"><strong>${safeTitle}</strong><small>${escapeBookingHtml(row.task.author || 'Сотрудник')}</small></div>
                <div class="crm-task-actions">
                    <button type="button" data-crm-task-edit="${profileArg}" data-task-id="${taskId}">Изменить</button>
                    ${!row.task.done ? `<button type="button" data-crm-task-done="${profileArg}" data-task-id="${taskId}">Готово</button>` : ''}
                    <button type="button" class="delete" data-crm-task-delete="${profileArg}" data-task-id="${taskId}" aria-label="Удалить задачу">×</button>
                </div>
                <form class="crm-task-edit-form" data-crm-task-form="${profileArg}" data-task-id="${taskId}" hidden>
                    <label>Задача<input name="title" maxlength="180" required value="${safeTitle}"></label>
                    <label>Срок (ДД.ММ.ГГГГ)<input name="dueDate" inputmode="numeric" placeholder="Без срока" value="${escapeBookingHtml(row.task.dueDate || '')}"></label>
                    <label>Ответственный<select name="assigneeId"><option value="">Не назначен</option>${(mockStaff || []).filter(staff => currentUser?.role !== 'barber' || String(staff.id) === String(currentUser.id)).map(staff => '<option value="' + escapeBookingHtml(String(staff.id)) + '"' + (String(row.task.assigneeId || '') === String(staff.id) ? ' selected' : '') + '>' + escapeBookingHtml(staff.name) + '</option>').join('')}</select></label>
                    <div class="crm-task-edit-actions"><button type="submit">Сохранить</button><button type="button" data-crm-task-cancel>Отмена</button></div>
                </form>
            </article>`;
        }).join('') : '<div class="crm-tasks-empty">По выбранным условиям задач нет</div>'}</div>
        <section class="crm-task-audit">
            <div class="crm-task-audit-heading"><strong>История действий CRM</strong><span>Задачи, записи и полученные оплаты</span></div>
            ${(() => {
                const history = [];
                const seen = new Set();
                Object.entries(clientProfiles || {}).forEach(([key, profile]) => {
                    if (currentUser?.role === 'barber' && String(profile?.barberId || '') !== String(currentUser.id)) return;
                    (profile?.taskHistory || []).forEach(event => {
                        const id = String(event.id || JSON.stringify(event));
                        if (seen.has(id)) return;
                        seen.add(id);
                        history.push({ ...event, clientName: profile.clientName || 'Клиент' });
                    });
                });
                (bookings || []).forEach(booking => {
                    const client = findClientProfile(booking.clientName || '', booking.barberId);
                    const profile = client.profile || {};
                    if (currentUser?.role === 'barber' && String(booking.barberId || '') !== String(currentUser.id)) return;
                    const clientName = String(booking.clientName || profile.clientName || 'Клиент');
                    const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(service => service.title).filter(Boolean).join(', ');
                    (Array.isArray(booking.history) ? booking.history : []).forEach((event, index) => {
                        const actionText = String(event.action || '');
                        const normalized = actionText.toLocaleLowerCase('ru-RU');
                        let action = 'booking_updated';
                        if (normalized.includes('оплат')) action = 'payment_received';
                        else if (normalized.includes('создан')) action = 'booking_created';
                        else if (normalized.includes('отмен')) action = 'booking_cancelled';
                        else if (normalized.includes('заверш')) action = 'booking_completed';
                        const actor = String(event.by || 'Система');
                        history.push({
                            id: 'booking_' + String(booking.id) + '_' + index,
                            action,
                            taskTitle: actionText || 'Изменение записи',
                            details: [event.details, serviceNames ? 'Услуги: ' + serviceNames : ''].filter(Boolean).join(' · '),
                            actor,
                            actorId: '',
                            createdAt: event.at || booking.createdAt || '',
                            clientName
                        });
                    });
                    // Старые платежи могли быть сохранены до появления booking.history.
                    // Добавляем их в аудит, только если соответствующее событие ещё не записано.
                    (Array.isArray(booking.payments) ? booking.payments : []).forEach((payment, paymentIndex) => {
                        const paymentDate = String(payment?.createdAt || '');
                        const alreadyLogged = (Array.isArray(booking.history) ? booking.history : []).some(event => {
                            if (!String(event.action || '').toLocaleLowerCase('ru-RU').includes('оплат')) return false;
                            if (!paymentDate || !event.at) return false;
                            return Math.abs(new Date(event.at).getTime() - new Date(paymentDate).getTime()) < 5000;
                        });
                        if (alreadyLogged) return;
                        const amount = Number(payment?.amount);
                        const amountLabel = Number.isFinite(amount) ? amount.toLocaleString('ru-RU') + ' ₽' : 'Сумма не указана';
                        const methodLabel = PAYMENT_METHOD_LABELS[payment?.method] || payment?.method || 'Способ не указан';
                        history.push({
                            id: 'legacy_payment_' + String(booking.id) + '_' + paymentIndex,
                            action: 'payment_received',
                            taskTitle: 'Получена оплата · ' + amountLabel,
                            details: [methodLabel, serviceNames ? 'Услуги: ' + serviceNames : ''].join(' · '),
                            actor: String(payment?.by || 'Сотрудник'),
                            actorId: '',
                            createdAt: paymentDate || booking.createdAt || '',
                            clientName
                        });
                    });
                });
                history.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                const actors = [...new Map(history.map(event => {
                    const key = String(event.actorId || event.actor || 'unknown');
                    return [key, {key, label: event.actor || 'Сотрудник'}];
                })).values()].sort((a,b) => a.label.localeCompare(b.label,'ru'));
                const actionOptions = [{id:'all',label:'Все действия'},{id:'created',label:'Создание задачи'},{id:'updated',label:'Изменение задачи'},{id:'completed',label:'Выполнение задачи'},{id:'deleted',label:'Удаление задачи'},{id:'booking_created',label:'Создание записи'},{id:'booking_updated',label:'Изменение записи'},{id:'booking_cancelled',label:'Отмена записи'},{id:'booking_completed',label:'Завершение визита'},{id:'payment_received',label:'Получение оплаты'}];
                const actorOptions = actors.map(actor => '<option value="'+escapeBookingHtml(actor.key)+'"'+(clientsTaskAuditActorFilter===actor.key?' selected':'')+'>'+escapeBookingHtml(actor.label)+'</option>').join('');
                const localDateKey = value => {
                    const date = new Date(value || '');
                    if (Number.isNaN(date.getTime())) return '';
                    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
                };
                const filtered = history.filter(event => {
                    if (clientsTaskAuditActionFilter !== 'all' && event.action !== clientsTaskAuditActionFilter) return false;
                    if (clientsTaskAuditActorFilter !== 'all' && String(event.actorId || event.actor || 'unknown') !== clientsTaskAuditActorFilter) return false;
                    const day = localDateKey(event.createdAt);
                    if (clientsTaskAuditFrom && (!day || day < clientsTaskAuditFrom)) return false;
                    if (clientsTaskAuditTo && (!day || day > clientsTaskAuditTo)) return false;
                    return true;
                });
                const periodHistory = history.filter(event => {
                    const day = localDateKey(event.createdAt);
                    if (clientsTaskAuditFrom && (!day || day < clientsTaskAuditFrom)) return false;
                    if (clientsTaskAuditTo && (!day || day > clientsTaskAuditTo)) return false;
                    return true;
                });
                const employeeStats = new Map();
                const ensureEmployee = (id, name) => {
                    const key = String(id || 'unassigned');
                    if (!employeeStats.has(key)) employeeStats.set(key, {key, name: name || (key === 'unassigned' ? 'Не назначен' : 'Сотрудник'), created:0, completed:0, deleted:0, overdue:0});
                    return employeeStats.get(key);
                };
                (mockStaff || []).forEach(staff => {
                    if (currentUser?.role === 'barber' && String(staff.id) !== String(currentUser.id)) return;
                    ensureEmployee(staff.id, staff.name);
                });
                periodHistory.forEach(event => {
                    const stat = ensureEmployee(event.actorId || event.actor || 'unknown', event.actor || 'Сотрудник');
                    if (event.action === 'created') stat.created++;
                    if (event.action === 'completed') stat.completed++;
                    if (event.action === 'deleted') stat.deleted++;
                });
                const todayForAudit = new Date(); todayForAudit.setHours(0,0,0,0);
                rows.forEach(row => {
                    if (row.task.done || !row.due || row.due >= todayForAudit) return;
                    const assigneeId = String(row.task.assigneeId || 'unassigned');
                    const assigneeName = mockStaff.find(staff => String(staff.id) === assigneeId)?.name || (assigneeId === 'unassigned' ? 'Не назначен' : 'Сотрудник');
                    ensureEmployee(assigneeId, assigneeName).overdue++;
                });
                const employeeSummary = [...employeeStats.values()]
                    .filter(stat => stat.created || stat.completed || stat.deleted || stat.overdue)
                    .sort((a,b) => (b.overdue-a.overdue) || (b.completed-a.completed) || (b.created-a.created) || a.name.localeCompare(b.name,'ru'));
                const totals = periodHistory.reduce((sum, event) => {
                    if (event.action === 'created') sum.created++;
                    if (event.action === 'completed') sum.completed++;
                    if (event.action === 'deleted') sum.deleted++;
                    return sum;
                }, {created:0,completed:0,deleted:0});
                const currentOverdueTotal = rows.filter(row => !row.task.done && row.due && row.due < todayForAudit).length;
                const summaryMarkup = '<div class="crm-task-employee-summary"><div class="crm-task-employee-summary-heading"><strong>Сводка по сотрудникам</strong><span>Создание, выполнение и удаление — за выбранный период; просроченные — на текущий момент</span></div>'+
                    '<div class="crm-task-employee-summary-totals"><article><b>'+totals.created+'</b><span>создано за период</span></article><article><b>'+totals.completed+'</b><span>выполнено за период</span></article><article><b>'+totals.deleted+'</b><span>удалено за период</span></article><article class="is-overdue"><b>'+currentOverdueTotal+'</b><span>просрочено сейчас</span></article></div>'+
                    (employeeSummary.length ? '<div class="crm-task-employee-summary-list">'+employeeSummary.map(stat => '<article class="crm-task-employee-summary-row"><strong>'+escapeBookingHtml(stat.name)+'</strong><span><b>'+stat.created+'</b><small>создано</small></span><span><b>'+stat.completed+'</b><small>выполнено</small></span><span><b>'+stat.deleted+'</b><small>удалено</small></span><span class="'+(stat.overdue?'is-overdue':'')+'"><b>'+stat.overdue+'</b><small>просрочено</small></span></article>').join('')+'</div>' : '<div class="crm-tasks-empty">Нет данных по сотрудникам за выбранный период</div>')+'</div>';
                auditExportRows = filtered;
                const labels = {created:'Создал задачу',updated:'Изменил задачу',completed:'Выполнил задачу',deleted:'Удалил задачу',booking_created:'Создал запись',booking_updated:'Изменил запись',booking_cancelled:'Отменил запись',booking_completed:'Завершил визит',payment_received:'Принял оплату'};
                return summaryMarkup+'<div class="crm-task-audit-filters">'+
                    '<select id="crmTaskAuditAction" aria-label="Тип действия">'+actionOptions.map(item=>'<option value="'+item.id+'"'+(clientsTaskAuditActionFilter===item.id?' selected':'')+'>'+item.label+'</option>').join('')+'</select>'+
                    '<select id="crmTaskAuditActor" aria-label="Сотрудник"><option value="all">Все сотрудники</option>'+actorOptions+'</select>'+
                    '<label>С <input id="crmTaskAuditFrom" type="date" value="'+escapeBookingHtml(clientsTaskAuditFrom)+'"></label>'+
                    '<label>По <input id="crmTaskAuditTo" type="date" value="'+escapeBookingHtml(clientsTaskAuditTo)+'"></label>'+
                    '<button type="button" id="crmTaskAuditReset">Сбросить</button>'+
                    '<button type="button" id="crmTaskAuditExport" '+(filtered.length ? '' : 'disabled')+'>Экспорт CSV · '+filtered.length+'</button>'+
                    '<span class="crm-task-audit-count">'+filtered.length+' из '+history.length+'</span></div>'+
                    (filtered.length ? filtered.slice(0,50).map(event => {
                        const date = event.createdAt ? new Date(event.createdAt) : null;
                        const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
                        return '<article class="crm-task-audit-item"><span class="crm-task-audit-dot '+escapeBookingHtml(event.action)+'"></span><div><strong>'+escapeBookingHtml(labels[event.action] || 'Изменил задачу')+' · '+escapeBookingHtml(event.clientName)+'</strong><p>'+escapeBookingHtml(event.taskTitle || 'Задача')+'</p><small>'+escapeBookingHtml(event.actor || 'Сотрудник')+(event.details ? ' · '+escapeBookingHtml(event.details) : '')+'</small></div><time>'+escapeBookingHtml(when)+'</time></article>';
                    }).join('') : '<div class="crm-tasks-empty">За выбранный период действий нет</div>');
            })()}
        </section>`;
    const auditAction = root.querySelector('#crmTaskAuditAction');
    if (auditAction) auditAction.addEventListener('change', () => { clientsTaskAuditActionFilter = auditAction.value; renderClientTasksHub(); });
    const auditActor = root.querySelector('#crmTaskAuditActor');
    if (auditActor) auditActor.addEventListener('change', () => { clientsTaskAuditActorFilter = auditActor.value; renderClientTasksHub(); });
    const auditFrom = root.querySelector('#crmTaskAuditFrom');
    if (auditFrom) auditFrom.addEventListener('change', () => { clientsTaskAuditFrom = auditFrom.value; renderClientTasksHub(); });
    const auditTo = root.querySelector('#crmTaskAuditTo');
    if (auditTo) auditTo.addEventListener('change', () => { clientsTaskAuditTo = auditTo.value; renderClientTasksHub(); });
    const auditReset = root.querySelector('#crmTaskAuditReset');
    if (auditReset) auditReset.addEventListener('click', () => {
        clientsTaskAuditActionFilter = 'all';
        clientsTaskAuditActorFilter = 'all';
        clientsTaskAuditFrom = '';
        clientsTaskAuditTo = '';
        renderClientTasksHub();
    });
    const auditExport = root.querySelector('#crmTaskAuditExport');
    if (auditExport) auditExport.addEventListener('click', () => exportClientTaskAuditCsv(auditExportRows));
    const searchInput = root.querySelector('#crmTasksSearch');
    if (searchInput) searchInput.addEventListener('input', () => {
        clientsTasksSearchQuery = searchInput.value;
        const cursor = searchInput.selectionStart;
        renderClientTasksHub();
        const next = document.getElementById('crmTasksSearch');
        if (next) { next.focus(); next.setSelectionRange(cursor,cursor); }
    });
    const barberSelect = root.querySelector('#crmTasksBarberFilter');
    if (barberSelect) barberSelect.addEventListener('change', () => {
        clientsTasksBarberFilter = barberSelect.value;
        renderClientTasksHub();
    });
    root.querySelectorAll('[data-crm-open-client]').forEach(button => button.addEventListener('click', () => {
        const profile = clientProfiles[button.dataset.crmOpenClient] || {};
        if (profile.clientName && profile.barberId) showClientDetails(profile.clientName, profile.barberId);
        else showToast('Не удалось определить карточку клиента для этой задачи', 'info');
    }));
    root.querySelectorAll('[data-crm-task-edit]').forEach(button => button.addEventListener('click', () => {
        const form = root.querySelector('[data-crm-task-form="' + CSS.escape(button.dataset.crmTaskEdit) + '"][data-task-id="' + CSS.escape(button.dataset.taskId) + '"]');
        if (form) { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('[name="title"]')?.focus(); }
    }));
    root.querySelectorAll('[data-crm-task-cancel]').forEach(button => button.addEventListener('click', () => { button.closest('form').hidden = true; }));
    root.querySelectorAll('[data-crm-task-form]').forEach(form => form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        saveClientTaskFromHub(form.dataset.crmTaskForm, form.dataset.taskId, {
            title: String(data.get('title') || '').trim(),
            dueDate: String(data.get('dueDate') || '').trim(),
            assigneeId: String(data.get('assigneeId') || '')
        });
    }));
    root.querySelectorAll('[data-crm-task-done]').forEach(button => button.addEventListener('click', () => updateClientTaskFromHub(button.dataset.crmTaskDone, button.dataset.taskId, 'done')));
    root.querySelectorAll('[data-crm-task-delete]').forEach(button => button.addEventListener('click', () => updateClientTaskFromHub(button.dataset.crmTaskDelete, button.dataset.taskId, 'delete')));
}

function exportClientTaskAuditCsv(events) {
    const actionLabels = {created:'Создание задачи',updated:'Изменение задачи',completed:'Выполнение задачи',deleted:'Удаление задачи',booking_created:'Создание записи',booking_updated:'Изменение записи',booking_cancelled:'Отмена записи',booking_completed:'Завершение визита',payment_received:'Получение оплаты'};
    const columns = ['Дата и время','Клиент','Действие','Задача','Сотрудник','Подробности'];
    const cell = value => {
        let text = String(value ?? '');
        // Защита CSV от formula injection при открытии в Excel/LibreOffice.
        if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
        return /[",\\r\\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const rows = (Array.isArray(events) ? events : []).map(event => [
        event.createdAt ? new Date(event.createdAt).toLocaleString('ru-RU') : '',
        event.clientName || 'Клиент',
        actionLabels[event.action] || 'Изменение',
        event.taskTitle || 'Задача',
        event.actor || 'Сотрудник',
        event.details || ''
    ]);
    if (!rows.length) return showToast('Нет событий для экспорта', 'info');
    const csv = '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const day = new Date().toISOString().slice(0,10);
    link.href = url;
    link.download = 'mensfire-task-audit-' + day + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('CSV-файл подготовлен', 'success');
}

function setClientsTasksFilter(filter) {
    clientsTasksFilter = ['all','overdue','upcoming','done'].includes(filter) ? filter : 'all';
    renderClientTasksHub();
}

function updateClientTaskFromHub(profileKey, taskId, action) {
    const profile = clientProfiles[profileKey];
    if (!profile || !Array.isArray(profile.tasks)) return;
    const taskIndex = profile.tasks.findIndex(item => String(item.id) === String(taskId));
    if (taskIndex < 0) return;
    if (action === 'done') {
        profile.tasks[taskIndex].done = true;
        profile.tasks[taskIndex].completedAt = new Date().toISOString();
        logClientTaskAction(profile, profile.tasks[taskIndex], 'completed', 'Задача отмечена выполненной');
        showToast('Задача отмечена выполненной', 'success');
    } else {
        logClientTaskAction(profile, profile.tasks[taskIndex], 'deleted', 'Задача удалена');
        profile.tasks.splice(taskIndex, 1);
        showToast('Задача удалена', 'success');
    }
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    renderClientTasksHub();
    if (selectedClientProfileKey === profileKey) renderClientTasks();
}

function saveClientTaskFromHub(profileKey, taskId, changes) {
    const profile = clientProfiles[profileKey];
    const task = profile?.tasks?.find(item => String(item.id) === String(taskId));
    if (!task) return showToast('Задача не найдена', 'error');
    if (!changes.title) return showToast('Название задачи не может быть пустым', 'error');
    if (changes.dueDate && !parseClientTaskDate(changes.dueDate)) return showToast('Укажите срок в формате ДД.ММ.ГГГГ', 'error');
    const allowedStaff = (mockStaff || []).filter(staff => currentUser?.role !== 'barber' || String(staff.id) === String(currentUser.id));
    if (changes.assigneeId && !allowedStaff.some(staff => String(staff.id) === changes.assigneeId)) {
        return showToast('Выбранный ответственный недоступен', 'error');
    }
    const changesLog = [];
    if (task.title !== changes.title) changesLog.push('Название изменено');
    if (String(task.dueDate || '') !== changes.dueDate) changesLog.push('Срок: ' + (changes.dueDate || 'не указан'));
    if (String(task.assigneeId || '') !== changes.assigneeId) {
        const assigned = mockStaff.find(staff => String(staff.id) === changes.assigneeId)?.name || 'не назначен';
        changesLog.push('Ответственный: ' + assigned);
    }
    task.title = changes.title.slice(0, 180);
    task.dueDate = changes.dueDate;
    task.assigneeId = changes.assigneeId;
    task.updatedAt = new Date().toISOString();
    if (changesLog.length) logClientTaskAction(profile, task, 'updated', changesLog.join(' · '));
    localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    renderClientTasksHub();
    if (selectedClientProfileKey === profileKey) {
        renderClientTasks();
        refreshSelectedClientActivity();
    }
    showToast('Задача обновлена', 'success');
}

function toggleClientsDataQuality() {
    clientsDataQualityExpanded = !clientsDataQualityExpanded;
    const panel = document.getElementById('clientsDataQualityDetails');
    const button = document.getElementById('clientsDataQualityToggle');
    if (panel) panel.hidden = !clientsDataQualityExpanded;
    if (button) {
        button.setAttribute('aria-expanded', String(clientsDataQualityExpanded));
        const icon = button.querySelector('.crm-data-quality-chevron');
        if (icon) icon.textContent = clientsDataQualityExpanded ? '−' : '+';
    }
}

function getClientMergeSources(phone) {
    const normalizedPhone = normalizeClientPhone(phone);
    if (normalizedPhone.length < 7) return [];
    return Object.entries(clientProfiles).filter(([, profile]) =>
        normalizeClientPhone(profile?.phone) === normalizedPhone
    );
}

function showClientMergePreview(phone) {
    const normalizedPhone = normalizeClientPhone(phone);
    const sources = getClientMergeSources(normalizedPhone);
    if (sources.length < 2) {
        showToast('Для этого номера нет нескольких отдельных профилей для объединения', 'info');
        return;
    }
    pendingClientMergePhone = normalizedPhone;
    const host = document.getElementById('clientMergePreview');
    if (!host) return;
    const profiles = sources.map(([key, profile]) => ({
        name: profile.clientName || 'Имя не указано',
        barber: mockStaff.find(staff => String(staff.id) === String(profile.barberId))?.name || 'Мастер не указан',
        tasks: Array.isArray(profile.tasks) ? profile.tasks.length : 0,
        interactions: Array.isArray(profile.interactions) ? profile.interactions.length : 0
    }));
    const taskCount = profiles.reduce((sum, item) => sum + item.tasks, 0);
    const interactionCount = profiles.reduce((sum, item) => sum + item.interactions, 0);
    host.innerHTML = '<section class="crm-merge-preview"><strong>Предварительный просмотр объединения</strong>' +
        '<p>Номер: +' + escapeBookingHtml(normalizedPhone) + '</p>' +
        '<div class="crm-merge-preview-profiles">' + profiles.map(profile =>
            '<div><b>' + escapeBookingHtml(profile.name) + '</b><span>' + escapeBookingHtml(profile.barber) + '</span><small>Задач: ' + profile.tasks + ' · Контактов: ' + profile.interactions + '</small></div>'
        ).join('') + '</div>' +
        '<p class="crm-merge-preview-summary">Профили будут объединены в общий телефонный профиль. Задачи и контакты объединяются без повторов. Существующие карточки мастеров, визиты и чеки сохраняются.</p>' +
        '<div class="crm-merge-preview-actions"><button type="button" class="crm-merge-confirm" onclick="confirmClientPhoneMerge()">Подтвердить объединение</button><button type="button" class="crm-merge-cancel" onclick="cancelClientPhoneMerge()">Отмена</button></div></section>';
    host.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function cancelClientPhoneMerge() {
    pendingClientMergePhone = '';
    const host = document.getElementById('clientMergePreview');
    if (host) host.innerHTML = '';
}

function confirmClientPhoneMerge() {
    const phone = normalizeClientPhone(pendingClientMergePhone);
    const sources = getClientMergeSources(phone);
    if (phone.length < 7 || sources.length < 2) {
        cancelClientPhoneMerge();
        return showToast('Профили изменились. Повторно проверь совпадения', 'error');
    }
    const canonicalKey = getClientProfileKey('', '', phone);
    const merged = {...(clientProfiles[canonicalKey] || {})};
    ['tasks', 'interactions', 'taskHistory'].forEach(field => {
        const combined = Array.isArray(merged[field]) ? merged[field].slice() : [];
        const known = new Set(combined.map(item => item?.id ? String(item.id) : JSON.stringify(item)));
        sources.forEach(([key, profile]) => {
            if (key === canonicalKey || !Array.isArray(profile?.[field])) return;
            profile[field].forEach(item => {
                const signature = item?.id ? String(item.id) : JSON.stringify(item);
                if (!known.has(signature)) { combined.push(item); known.add(signature); }
            });
        });
        if (combined.length) merged[field] = combined;
    });
    sources.forEach(([key, profile]) => {
        if (key === canonicalKey) return;
        Object.entries(profile || {}).forEach(([field, value]) => {
            if (field === 'tasks' || field === 'interactions') return;
            if ((merged[field] === undefined || merged[field] === null || merged[field] === '') && value !== '') merged[field] = value;
        });
    });
    merged.phone = phone;
    if (!merged.clientName) merged.clientName = sources.map(([, profile]) => profile.clientName).find(Boolean) || '';
    let relinkedSales = 0;
    const previousSalesKeys = new Set(sources.map(([key]) => key));
    clientProfiles[canonicalKey] = merged;
    // Legacy-ключи оставляем: старые карточки и записи продолжают на них ссылаться.
    sources.forEach(([key, profile]) => {
        if (key !== canonicalKey) clientProfiles[key] = {...profile, phone};
    });
    clientRetailSales.forEach(sale => {
        if ((normalizeClientPhone(sale.clientPhone) === phone || previousSalesKeys.has(sale.clientProfileKey)) && sale.clientProfileKey !== canonicalKey) {
            sale.clientProfileKey = canonicalKey;
            relinkedSales++;
        }
    });
    try {
        localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
        if (relinkedSales) persistClientRetailSales();
    } catch (error) {
        showToast('Не удалось сохранить объединение. Проверь свободное место в браузере', 'error');
        return;
    }
    pendingClientMergePhone = '';
    const preview = document.getElementById('clientMergePreview');
    if (preview) preview.innerHTML = '';
    showToast('Общий профиль обновлён. История и карточки сохранены', 'success');
    renderClients(currentClientsTab);
}

function renderClientsDataQualityAudit(sourceClients) {
    const host = document.getElementById('clientsDataQuality');
    if (!host) return;
    const clients = Array.isArray(sourceClients) ? sourceClients : [];
    const byName = new Map();
    const byPhone = new Map();
    clients.forEach(client => {
        const profile = findClientProfile(client.name, client.barberId).profile || {};
        const name = String(client.name || '').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
        const phone = normalizeClientPhone(profile.phone);
        if (name) {
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push({client,phone});
        }
        if (phone.length >= 7) {
            if (!byPhone.has(phone)) byPhone.set(phone, []);
            byPhone.get(phone).push({client,phone});
        }
    });
    const possibleDuplicates = [...byName.values()].filter(items =>
        items.length > 1 && new Set(items.map(item => String(item.client.barberId))).size > 1 &&
        items.every(item => !item.phone)
    );
    const phoneConflicts = [...byPhone.values()].filter(items =>
        new Set(items.map(item => String(item.client.name || '').trim().toLocaleLowerCase('ru-RU'))).size > 1
    );
    const details = [
        ...possibleDuplicates.map(items => ({
            type:'name', title:items[0].client.name,
            description:'Одинаковое имя у разных мастеров без номера телефона. Это возможный дубль, но не доказательство.',
            items
        })),
        ...phoneConflicts.map(items => ({
            type:'phone',
            title:items.map(item => item.client.name).filter((name,index,names)=>names.indexOf(name)===index).join(' / '),
            description:'Один номер указан в карточках с разными именами. Проверь, не общий ли это телефон.',
            items
        }))
    ];
    const total = details.length;
    host.innerHTML = '<section class="crm-data-quality">' +
        '<button type="button" id="clientsDataQualityToggle" class="crm-data-quality-toggle" aria-expanded="' + String(clientsDataQualityExpanded) + '" onclick="toggleClientsDataQuality()">' +
            '<span><strong>Проверка клиентской базы</strong><small>' + (total ? 'Ситуаций для ручной проверки: ' + total : 'Явных совпадений для проверки не найдено') + '</small></span>' +
            '<span class="crm-data-quality-count">' + total + '</span><span class="crm-data-quality-chevron">' + (clientsDataQualityExpanded ? '−' : '+') + '</span>' +
        '</button>' +
        '<div id="clientsDataQualityDetails" class="crm-data-quality-details" ' + (clientsDataQualityExpanded ? '' : 'hidden') + '>' +
            (details.length ? details.map(group =>
                '<article class="crm-data-quality-item"><div><strong>' + escapeBookingHtml(group.title) + '</strong><p>' + escapeBookingHtml(group.description) + '</p>' +
                '<div class="crm-data-quality-profiles">' + group.items.map(item =>
                    '<button type="button" onclick="showClientDetails(' + escapeBookingHtml(JSON.stringify(String(item.client.name || ''))) + ',' + escapeBookingHtml(JSON.stringify(String(item.client.barberId || ''))) + ')">' +
                    escapeBookingHtml(item.client.name || 'Клиент') + ' · ' + escapeBookingHtml(mockStaff.find(staff => String(staff.id) === String(item.client.barberId))?.name || 'Мастер') +
                    '</button>'
                ).join('') + '</div>' +
                (group.type === 'phone' && getClientMergeSources(group.items[0].phone).length > 1 ? '<button type="button" class="crm-merge-open" onclick="showClientMergePreview(' + escapeBookingHtml(JSON.stringify(group.items[0].phone)) + ')">Проверить и объединить профили</button>' : '') +
                '</div><span class="crm-data-quality-kind">' + (group.type === 'name' ? 'Совпадение имени' : 'Общий номер') + '</span></article>'
            ).join('') : '<div class="crm-data-quality-empty">Пока нечего проверять. Новые совпадения появятся здесь автоматически.</div>') +
            '<p class="crm-data-quality-note">Объединяй только после личной проверки: общий номер может принадлежать семье или организации. Совпадение имени без телефона не позволяет объединить карточки автоматически.</p>' +
        '</div><div id="clientMergePreview"></div></section>';
}

function renderClients(tab = 'all') {
    currentClientsTab = tab;
    renderWaitlist();
    initDesktopClientDirectory();
    const list = document.getElementById('clientsList');
    const tabsContainer = document.getElementById('clientsTabsContainer');
    const title = document.getElementById('clientsPageTitle');
    const segmentContainer = document.getElementById('clientsSegmentContainer');
    if (!list || !tabsContainer || !title) return;

    title.innerText = currentUser.role === 'admin' ? 'Клиенты' : 'Мои клиенты';

    // 2. Рендерим табы (только для админа)
    if (currentUser.role === 'admin') {
        tabsContainer.innerHTML = `
            <div class="crm-workspace-switch">
                <button type="button" class="${currentClientsWorkspaceMode === 'clients' ? 'active' : ''}" onclick="setClientsWorkspaceMode('clients')">Клиенты</button>
                <button type="button" class="${currentClientsWorkspaceMode === 'tasks' ? 'active' : ''}" onclick="setClientsWorkspaceMode('tasks')">Задачи CRM <span id="crmTasksTabCount">0</span></button>
            </div>
            <div class="category-tabs crm-client-scope-tabs" style="margin-bottom: 15px;">
                <button class="tab-btn ${currentClientsTab === 'my' ? 'active' : ''}" onclick="renderClients('my')">Мои клиенты</button>
                <button class="tab-btn ${currentClientsTab === 'all' ? 'active' : ''}" onclick="renderClients('all')">Все клиенты</button>
            </div>
        `;
    } else {
        tabsContainer.innerHTML = '';
        currentClientsWorkspaceMode = 'clients';
    }
    if(window.innerWidth>=768){const legacyScopeTabs=tabsContainer.querySelector('.crm-client-scope-tabs');if(legacyScopeTabs)legacyScopeTabs.remove();}
    const clientsView = document.getElementById('viewClients');
    if (clientsView) clientsView.classList.toggle('crm-tasks-mode', currentClientsWorkspaceMode === 'tasks' && window.innerWidth >= 768);
    renderClientTasksHub();

    // 3. Фильтруем записи для подсчета
    let filteredBookings = bookings;
    
    // Если это барбер ИЛИ админ на вкладке "Мои клиенты" — фильтруем по ID
    if (currentUser.role === 'barber' || (currentUser.role === 'admin' && currentClientsTab === 'my')) {
        filteredBookings = filteredBookings.filter(b => String(b.barberId) === String(currentUser.id));
    }

        // Собираем клиентов (привязка к мастеру, чтобы не сливались)
    const clients = {};
    filteredBookings.forEach(b => {
        const clientKey = JSON.stringify([String(b.clientName || ''), String(b.barberId || '')]); 
        
        if (!clients[clientKey]) {
            clients[clientKey] = {
                name: b.clientName, barberId: b.barberId, visits: [],
                completedCount: 0, cancelledCount: 0, totalSpent: 0, completedRevenue: 0
            };
        }
        clients[clientKey].visits.push(b);
        // Потрачено — все фактически полученные суммы; завершённые визиты
        // считаются отдельно, чтобы отмены не завышали число посещений.
        clients[clientKey].totalSpent += getBookingCollectedAmount(b);
        if (b.status === 'completed') {
            clients[clientKey].completedCount++;
            clients[clientKey].completedRevenue += getBookingCollectedAmount(b);
        } else if (b.status === 'cancelled') {
            clients[clientKey].cancelledCount++;
        }
    });

    // Объединяем карточки только при наличии совпадающего подтверждённого телефона.
    // Без номера клиенты остаются раздельными по имени и мастеру.
    const groupedClients = {};
    Object.values(clients).forEach(client => {
        const { profile } = findClientProfile(client.name, client.barberId);
        const phoneKey = normalizeClientPhone(profile.phone);
        const groupKey = phoneKey.length >= 7
            ? 'phone:' + phoneKey
            : JSON.stringify([client.name, client.barberId]);

        if (!groupedClients[groupKey]) {
            groupedClients[groupKey] = {
                ...client,
                names: [client.name],
                barberIds: [client.barberId],
                profiles: [profile],
                profileSummary: {
                    phone: String(profile.phone || ''),
                    birthday: String(profile.birthday || ''),
                    tag: ['new', 'regular', 'vip'].includes(profile.tag) ? profile.tag : '',
                    notes: String(profile.notes || '')
                }
            };
        } else {
            const group = groupedClients[groupKey];
            if (!group.names.includes(client.name)) group.names.push(client.name);
            if (!group.barberIds.includes(client.barberId)) group.barberIds.push(client.barberId);
            group.visits.push(...client.visits);
            group.completedCount += client.completedCount;
            group.cancelledCount += client.cancelledCount;
            group.totalSpent += client.totalSpent;
            group.completedRevenue += client.completedRevenue;
            group.profiles.push(profile);
            ['phone', 'birthday', 'notes'].forEach(field => {
                if (!group.profileSummary[field] && profile[field]) {
                    group.profileSummary[field] = String(profile[field]);
                }
            });
            if (!group.profileSummary.tag && ['new', 'regular', 'vip'].includes(profile.tag)) {
                group.profileSummary.tag = profile.tag;
            }
        }
    });

    const allClientGroups = Object.values(groupedClients);
    const segmentNow = Date.now();
    const eligibleChecks = allClientGroups.filter(client => client.completedCount >= 2)
        .map(client => Math.round(client.completedRevenue / client.completedCount)).sort((a,b) => a-b);
    const highCheckThreshold = eligibleChecks.length
        ? eligibleChecks[Math.min(eligibleChecks.length - 1, Math.floor((eligibleChecks.length - 1) * 0.75))]
        : Infinity;
    const eligibleLifetimeValues = allClientGroups.filter(client => client.completedCount >= 1)
        .map(client => Math.round(client.completedRevenue)).sort((a,b) => a-b);
    const highLifetimeValueThreshold = eligibleLifetimeValues.length
        ? eligibleLifetimeValues[Math.min(eligibleLifetimeValues.length - 1, Math.floor((eligibleLifetimeValues.length - 1) * 0.75))]
        : Infinity;
    const getBehaviorSegments = client => {
        const completedVisits = client.visits.filter(visit => visit.status === 'completed');
        const lastCompletedAt = completedVisits.reduce((latest, visit) => {
            const value = parseClientDateTime(visit);
            return Number.isFinite(value) ? Math.max(latest, value) : latest;
        }, 0);
        const hasUpcoming = client.visits.some(visit => visit.status !== 'cancelled' && parseClientDateTime(visit) >= segmentNow);
        const cancelled = client.visits.filter(visit => visit.status === 'cancelled').length;
        const decided = completedVisits.length + cancelled;
        const average = completedVisits.length ? client.completedRevenue / completedVisits.length : 0;
        return {
            inactive: !!lastCompletedAt && !hasUpcoming && (segmentNow - lastCompletedAt) >= 45 * 86400000,
            cancellations: cancelled >= 3 && decided > 0 && cancelled / decided >= 0.25,
            highcheck: completedVisits.length >= 2 && average >= highCheckThreshold,
            highvalue: completedVisits.length >= 1 && client.completedRevenue >= highLifetimeValueThreshold
        };
    };
    const behaviorByClient = new Map(allClientGroups.map(client => [client, getBehaviorSegments(client)]));
    if (segmentContainer) {
        const tagOf = c => c.profileSummary.tag || (c.completedCount <= 1 ? 'new' : 'regular');
        const counts = {
            all: allClientGroups.length,
            new: allClientGroups.filter(c => tagOf(c) === 'new').length,
            regular: allClientGroups.filter(c => tagOf(c) === 'regular').length,
            vip: allClientGroups.filter(c => c.profileSummary.tag === 'vip').length,
            inactive: allClientGroups.filter(c => behaviorByClient.get(c).inactive).length,
            cancellations: allClientGroups.filter(c => behaviorByClient.get(c).cancellations).length,
            highcheck: allClientGroups.filter(c => behaviorByClient.get(c).highcheck).length,
            highvalue: allClientGroups.filter(c => behaviorByClient.get(c).highvalue).length
        };
        const filters = [
            {id:'all',label:'Все'}, {id:'new',label:'Новые'}, {id:'regular',label:'Постоянные'},
            {id:'vip',label:'VIP'}, {id:'inactive',label:'Давно не были'},
            {id:'cancellations',label:'Часто отменяют'}, {id:'highcheck',label:'Высокий чек'},
            {id:'highvalue',label:'Высокая ценность'}
        ];
        segmentContainer.innerHTML = '<div class="client-segment-tabs">' + filters.map(item =>
            '<button type="button" class="client-segment-btn ' + (clientsSegmentFilter === item.id ? 'active' : '') + '" onclick="setClientsSegmentFilter(\'' + item.id + '\')">' +
            item.label + '<span class="client-segment-count">' + counts[item.id] + '</span></button>'
        ).join('') + '</div><div id="clientsDataQuality"></div>';
    }
    renderClientsDataQualityAudit(Object.values(clients));
    renderClientsAnalytics(filteredBookings, allClientGroups);
    renderClientFollowUpPanel(allClientGroups);
    renderClientTasksHub();
    const clientsOverview = document.getElementById('clientsOverview');
    if (clientsOverview) {
        const now = new Date();
        let rangeStart = clientsPeriodMode === 'sixMonths' ? new Date(now.getFullYear(),now.getMonth()-5,1) : clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),1) : parseReportDate(clientsRangeStart);
        let rangeEnd = clientsPeriodMode === 'sixMonths' || clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),now.getDate()) : parseReportDate(clientsRangeEnd);
        rangeStart = rangeStart || new Date(now.getFullYear(),now.getMonth(),1); rangeEnd = rangeEnd || now;
        if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
        const endExclusive = new Date(rangeEnd); endExclusive.setDate(endExclusive.getDate()+1);
        const inPeriod = visit => { const date=parseReportDate(visit.date); return date && date>=rangeStart && date<endExclusive; };
        const periodGroups = allClientGroups.map(client=>{const visits=client.visits.filter(inPeriod),done=visits.filter(visit=>visit.status==='completed');return {...client,visits,completedCount:done.length,totalSpent:visits.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0),completedRevenue:done.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0)};}).filter(client=>client.visits.length);
        const loyalClients=periodGroups.filter(client=>client.completedCount>=3).length;
        const visitTotal=periodGroups.reduce((sum,client)=>sum+client.completedCount,0);
        const spentTotal=periodGroups.reduce((sum,client)=>sum+client.totalSpent,0);
        const completedRevenueTotal=periodGroups.reduce((sum,client)=>sum+client.completedRevenue,0);
        const averageCheck=visitTotal?Math.round(completedRevenueTotal/visitTotal):0;
        const upcomingClients=periodGroups.filter(client=>client.visits.some(visit=>visit.status!=='cancelled'&&parseClientDateTime(visit)>=Date.now())).length;
        const caption=clientsPeriodMode==='sixMonths'?'Последние 6 месяцев':clientsPeriodMode==='month'?'Текущий месяц':formatReportDate(rangeStart)+' — '+formatReportDate(rangeEnd);
        clientsOverview.innerHTML=`
            <div class="client-overview-card"><span>Клиентов за период</span><strong>${periodGroups.length}</strong><small>${caption}</small></div>
            <div class="client-overview-card"><span>Повторных клиентов</span><strong>${loyalClients}</strong><small>От 3 завершённых визитов за период</small></div>
            <div class="client-overview-card"><span>Завершённых визитов</span><strong>${visitTotal}</strong><small>${caption}</small></div>
            <div class="client-overview-card"><span>Средний чек</span><strong>${averageCheck.toLocaleString('ru-RU')} ₽</strong><small>По завершённым визитам</small></div>
            <div class="client-overview-card"><span>Оплачено</span><strong>${Math.round(spentTotal).toLocaleString('ru-RU')} ₽</strong><small>Фактически получено</small></div>
            <div class="client-overview-card"><span>Есть запись</span><strong>${upcomingClients}</strong><small>Будущие визиты в CRM</small></div>`;
    }

    const clientArray = Object.values(groupedClients)
    .filter(c => {
        if (['new','regular','vip'].includes(clientsSegmentFilter)) {
            const explicitTag = c.profileSummary.tag;
            const inferredTag = explicitTag || (c.completedCount <= 1 ? 'new' : 'regular');
            if (inferredTag !== clientsSegmentFilter) return false;
        } else if (['inactive','cancellations','highcheck','highvalue'].includes(clientsSegmentFilter)) {
            if (!behaviorByClient.get(c)?.[clientsSegmentFilter]) return false;
        }
        const phone = normalizeClientPhone(c.profileSummary.phone);
        const phoneQuery = normalizeClientPhone(clientsSearchQuery);
        return (
            c.names.some(name => String(name || '').toLowerCase().includes(clientsSearchQuery)) ||
            (phoneQuery.length > 0 && phone.includes(phoneQuery))
        );
    })
    .sort((a, b) => b.completedCount - a.completedCount || b.totalSpent - a.totalSpent);
    
    if (clientArray.length === 0) {
        list.innerHTML = '<div class="empty-bookings-msg" style="font-size: 16px;">Клиентов пока нет</div>';
        return;
    }

    // Выводим список
    list.innerHTML = clientArray.map(c => {
        const parseVisitDate = value => {
            const [day, month, year] = String(value || '').split('.').map(Number);
            if (!day || !month || !year) return 0;
            const parsed = new Date(year, month - 1, day).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const completedAverageCheck = c.completedCount ? Math.round(c.completedRevenue / c.completedCount) : 0;
        const clientPhoneKey = normalizeClientPhone((c.profileSummary || {}).phone);
        const loyaltyBookings = clientPhoneKey.length >= 7
            ? bookings.filter(booking => normalizeClientPhone(findClientProfile(booking.clientName, booking.barberId).profile.phone) === clientPhoneKey)
            : c.visits;
        const loyalty = getClientLoyaltyState(loyaltyBookings);
        const upcomingVisit = c.visits.filter(visit => visit.status !== 'cancelled' && parseClientDateTime(visit) >= Date.now())
            .sort((a,b) => parseClientDateTime(a) - parseClientDateTime(b))[0];
        const completedVisits = c.visits
            .filter(visit => visit.status === 'completed')
            .slice()
            .sort((a, b) => parseVisitDate(b.date) - parseVisitDate(a.date));
        const sortedVisits = c.visits.slice()
            .sort((a, b) => parseVisitDate(b.date) - parseVisitDate(a.date));
        const lastVisit = completedVisits[0] || sortedVisits[0];
        const profile = c.profileSummary || c.profiles[0] || {};
        const clientTagLabels = { new: 'Новый', regular: 'Постоянный', vip: 'VIP' };
        const clientTag = clientTagLabels[profile.tag || 'regular'] || 'Постоянный';
        const masterNames = c.barberIds.map(id => mockStaff.find(staff => String(staff.id) === String(id))?.name || 'Мастер');
        const masterBadge = currentUser.role === 'admin' && currentClientsTab === 'all'
            ? `<div class="client-meta" style="color: var(--gold); font-size: 10px; margin-top: 4px;">Мастера: ${masterNames.join(', ')}</div>`
            : '';
        const safeNameArg = escapeBookingHtml(JSON.stringify(String(c.name || '')));
        const safeBarberArg = escapeBookingHtml(JSON.stringify(String(c.barberId || '')));
        const safeTag = ['new', 'regular', 'vip'].includes(profile.tag) ? profile.tag : 'regular';
        const safeNames = c.names.map(escapeBookingHtml).join(' / ');
        const safeMasters = masterNames.map(escapeBookingHtml).join(', ');

        return `
            <div class="client-card" onclick="showClientDetails(${safeNameArg}, ${safeBarberArg})">
                <div class="client-avatar">${escapeBookingHtml(String(c.name || '?').charAt(0).toUpperCase())}</div>
                <div class="client-info">
                    <div class="client-name">${safeNames} <span class="client-tag-badge tag-${safeTag}">${clientTag}</span></div>
                    <div class="client-meta">Визитов: <span class="gold-text">${c.completedCount}</span> · Отмен: <span class="gold-text">${c.cancelledCount}</span></div>
                    <div class="client-loyalty-list-badge"><span class="client-loyalty-dot" style="background:${loyalty.level.color}"></span><b>${loyalty.level.name}</b><span>${loyalty.count} лояльных визитов</span><span>·</span><span>${loyalty.points.toLocaleString('ru-RU')} баллов</span></div>
                    <div class="booking-card-badges"><i class="booking-client-type type-${c.completedCount > 0 ? 'returning' : 'new'}">${c.completedCount > 0 ? 'Повторный клиент' : 'Новый клиент'}</i><i class="booking-origin origin-other">${[...new Set(c.visits.map(visit => getBookingSourceMeta(visit).label))].slice(0,2).map(escapeBookingHtml).join(' · ') || 'Канал не указан'}</i></div>
                    <div class="client-meta">Оплачено: <span class="gold-text">${Number(c.totalSpent || 0).toLocaleString('ru-RU')} ₽</span> · Средний чек: <span class="gold-text">${completedAverageCheck.toLocaleString('ru-RU')} ₽</span></div>
                    <div class="client-meta">${completedVisits.length ? 'Последний визит:' : 'Последняя запись:'} ${escapeBookingHtml(lastVisit.date)} в ${escapeBookingHtml(lastVisit.time)}</div>
                    ${profile.preferences ? '<div class="client-meta client-preferences-preview">✦ ' + escapeBookingHtml(profile.preferences) + '</div>' : ''}
                    <div class="client-meta client-next-visit">${upcomingVisit ? 'Следующая запись: ' + escapeBookingHtml(upcomingVisit.date) + ' в ' + escapeBookingHtml(upcomingVisit.time) : 'Будущих записей нет'}</div>
                    ${masterBadge ? `<div class="client-meta" style="color: var(--gold); font-size: 10px; margin-top: 4px;">Мастера: ${safeMasters}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}


/* Лояльность MensFire — правила синхронизированы с клиентским приложением. */
function getClientLoyaltyState(sourceBookings) {
    const eligible = (Array.isArray(sourceBookings) ? sourceBookings : [])
        .filter(booking => booking && ['active', 'completed'].includes(String(booking.status || '').toLowerCase()))
        .map(booking => {
            const serviceTotal = (Array.isArray(booking.services) ? booking.services : [])
                .reduce((sum, service) => {
                    const amount = Number(service?.price);
                    return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
                }, 0);
            const rawTotal = booking.total;
            const parsedTotal = rawTotal !== '' && rawTotal != null ? Number(rawTotal) : NaN;
            const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : serviceTotal;
            const parsedTimestamp = parseClientDateTime(booking);
            return {
                booking,
                total,
                timestamp: parsedTimestamp > 0 ? parsedTimestamp : Number.POSITIVE_INFINITY
            };
        })
        .filter(item => Number.isFinite(item.total) && item.total > 1000)
        // Повторяем порядок клиентского приложения: дата и точное время визита.
        .sort((a, b) => a.timestamp - b.timestamp);

    const count = eligible.length;
    let level;
    if (count < 10) level = { name: 'Бронзовый', next: 'Серебряный', percent: 1, base: 0, target: 10, color: '#CD7F32', light: '#A65D26' };
    else if (count < 20) level = { name: 'Серебряный', next: 'Золотой', percent: 2, base: 10, target: 20, color: '#C0C0C0', light: '#8C8C8C' };
    else level = { name: 'Золотой', next: 'Максимум', percent: 3, base: 20, target: 20, color: '#D4AF37', light: '#C79A2A' };

    let points = 0;
    const history = eligible.map((item, index) => {
        const rate = index < 10 ? 0.01 : index < 20 ? 0.02 : 0.03;
        const earned = Math.floor(item.total * rate);
        points += earned;
        return { ...item, rate, earned, runningPoints: points };
    });
    const progress = count >= 20 ? 100 : Math.max(0, Math.min(100, ((count - level.base) / (level.target - level.base)) * 100));
    return { count, level, points, progress, remaining: Math.max(0, level.target - count), history };
}

function renderClientLoyaltyPanel(sourceBookings) {
    const root = document.getElementById('clientLoyaltyPanel');
    if (!root) return;
    const state = getClientLoyaltyState(sourceBookings);
    const history = state.history.slice().reverse().slice(0, 8);
    root.innerHTML = `
        <section class="client-loyalty-card level-${state.level.name.toLowerCase()}">
            <div class="client-loyalty-heading">
                <div><span class="client-loyalty-eyebrow">ПРОГРАММА ЛОЯЛЬНОСТИ</span><strong>${state.level.name} уровень</strong></div>
                <span class="client-loyalty-percent">${state.level.percent}% кэшбэк</span>
            </div>
            <div class="client-loyalty-stats">
                <div><strong>${state.count}</strong><span>засчитанных визитов</span></div>
                <div><strong>${state.points.toLocaleString('ru-RU')}</strong><span>накоплено баллов</span></div>
            </div>
            <div class="client-loyalty-progress"><i style="width:${state.progress}%;background:${state.level.color}"></i></div>
            <div class="client-loyalty-next">${state.count >= 20 ? 'Достигнут максимальный уровень' : 'До уровня «' + state.level.next + '» осталось: ' + state.remaining + ' виз.'}</div>
            <div class="client-loyalty-history-title">Начисления баллов</div>
            <div class="client-loyalty-disclaimer">Расчёт по тем же правилам, что и в приложении клиента. Списание баллов здесь пока не предусмотрено.</div>
            ${history.length ? history.map(item => {
                const booking = item.booking;
                const date = escapeBookingHtml(booking.date || 'Дата не указана');
                const time = escapeBookingHtml(booking.time || '');
                const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(service => escapeBookingHtml(service?.title || 'Услуга')).join(', ');
                const barberName = mockStaff.find(staff => String(staff.id) === String(booking.barberId))?.name || 'Мастер';
                const visitMeta = [barberName, serviceNames, item.total.toLocaleString('ru-RU') + ' ₽ × ' + Math.round(item.rate * 100) + '%'].filter(Boolean).join(' · ');
                return '<div class="client-loyalty-row"><span><b>' + date + (time ? ' · ' + time : '') + '</b><small>' + escapeBookingHtml(visitMeta) + '</small></span><strong>+' + item.earned.toLocaleString('ru-RU') + ' б.</strong></div>';
            }).join('') : '<div class="client-loyalty-empty">Пока нет визитов, подходящих для начисления баллов</div>'}
        </section>`;
}

function parseClientDateTime(booking) {
    const [day, month, year] = String(booking?.date || '').split('.').map(Number);
    const [hour, minute] = String(booking?.time || '00:00').split(':').map(Number);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) ||
        !Number.isInteger(hour) || !Number.isInteger(minute) ||
        day < 1 || month < 1 || month > 12 || year < 1000 ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59) return 0;
    const date = new Date(year, month - 1, day, hour, minute);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
        date.getDate() !== day) return 0;
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}


let clientTimelineFilter = 'all';

function renderClientTimeline(clientBookings = []) {
    const root = document.getElementById('clientUnifiedTimeline');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const phone = normalizeClientPhone(profile.phone);
    const events = [];
    const addEvent = (type, timestamp, title, detail, amount, id) => {
        const time = timestamp ? new Date(timestamp).getTime() : 0;
        if (!time || !Number.isFinite(time)) return;
        events.push({ type, time, title, detail: detail || '', amount: Number.isFinite(Number(amount)) && amount !== null ? Number(amount) : null, id: String(id || '') });
    };
    (clientBookings || []).forEach(booking => {
        const timestamp = parseClientDateTime(booking);
        if (!timestamp) return;
        const status = String(booking.status || '').toLowerCase();
        const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(item => item?.title).filter(Boolean).join(', ');
        const statusLabel = status === 'completed' ? 'Визит завершён' :
            status === 'cancelled' ? 'Запись отменена' :
            ['no_show','missed'].includes(status) ? 'Неявка' : 'Запись';
        addEvent('visit', timestamp, statusLabel, [serviceNames, mockStaff.find(staff => String(staff.id) === String(booking.barberId))?.name].filter(Boolean).join(' · '), null, 'booking-' + booking.id);
        const serviceTotal = getBookingServiceTotal(booking);
        const payment = getBookingPaymentState(booking, serviceTotal);
        if (payment && Number(payment.paid) > 0) {
            addEvent('payment', timestamp, 'Оплата услуг', (payment.methodLabel || 'Способ не указан') + ' · по визиту', payment.paid, 'booking-payment-' + booking.id);
        }
    });
    const sales = clientRetailSales.filter(sale => {
        if (sale.clientProfileKey && sale.clientProfileKey === selectedClientProfileKey) return true;
        const salePhone = normalizeClientPhone(sale.clientPhone);
        if (phone.length >= 7 && salePhone.length >= 7) return phone === salePhone;
        return !salePhone && !phone && sale.clientNameSnapshot &&
            sale.clientNameSnapshot.trim().toLowerCase() === String(profile.clientName || '').trim().toLowerCase();
    });
    sales.forEach(sale => {
        const total = getRetailSaleNetTotal(sale);
        const paid = Math.max(0, Number(sale.paidAmount) || 0);
        const itemNames = (sale.items || []).map(item => item.titleSnapshot || item.title || '').filter(Boolean).join(', ');
        addEvent('purchase', sale.soldAt, 'Покупка товаров', itemNames || 'Товарный чек', total, 'sale-' + sale.id);
        (Array.isArray(sale.refunds) ? sale.refunds : []).forEach(refund => {
            addEvent('refund', refund.createdAt, 'Возврат товара', refund.notes || refund.reason || 'Возврат по товарному чеку', refund.value, 'refund-' + sale.id + '-' + refund.id);
        });
        if (paid > 0 && sale.paymentStatus === 'partial') {
            // Показываем фактически полученную сумму в событии покупки, не создавая отдельную фиктивную оплату.
        }
    });
    (Array.isArray(profile.interactions) ? profile.interactions : []).forEach(item => {
        const labels = { call:'Звонок', message:'Сообщение', meeting:'Личная встреча', note:'Заметка', other:'Взаимодействие' };
        addEvent('interaction', item.createdAt, labels[item.type] || 'Взаимодействие', item.text || '', null, 'interaction-' + item.id);
    });
    (Array.isArray(profile.tasks) ? profile.tasks : []).forEach(task => {
        addEvent('task', task.createdAt, 'Создана задача', task.title || 'Напоминание', null, 'task-created-' + task.id);
        if (task.done && task.completedAt) {
            addEvent('task', task.completedAt, 'Задача выполнена', task.title || 'Напоминание', null, 'task-done-' + task.id);
        }
    });
    events.sort((a,b) => b.time - a.time || a.id.localeCompare(b.id));
    const filter = ['all','visit','payment','purchase','refund','interaction','task'].includes(clientTimelineFilter) ? clientTimelineFilter : 'all';
    const filtered = filter === 'all' ? events : events.filter(event => event.type === filter);
    const labels = { visit:'Визиты', payment:'Оплаты', purchase:'Покупки', refund:'Возвраты', interaction:'Общение', task:'Задачи' };
    const dateLabel = timestamp => new Date(timestamp).toLocaleString('ru-RU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    root.innerHTML = '<div class="client-timeline-toolbar"><label for="clientTimelineFilter">Показать</label><select id="clientTimelineFilter">' +
        [['all','Все события'],['visit','Визиты и записи'],['payment','Оплаты услуг'],['purchase','Покупки товаров'],['refund','Возвраты'],['interaction','Общение'],['task','Задачи']].map(([value,label]) => '<option value="' + value + '"' + (filter === value ? ' selected' : '') + '>' + label + '</option>').join('') +
        '</select><span>' + filtered.length + ' событий</span></div>' +
        (filtered.length ? '<div class="client-timeline-list">' + filtered.map(event =>
            '<article class="client-timeline-item timeline-' + event.type + '"><i></i><div class="client-timeline-body"><div class="client-timeline-meta"><b>' + escapeBookingHtml(event.title) + '</b><time>' + escapeBookingHtml(dateLabel(event.time)) + '</time></div>' +
            (event.detail ? '<p>' + escapeBookingHtml(event.detail) + '</p>' : '') +
            (event.amount !== null ? '<strong class="client-timeline-amount">' + Math.round(event.amount).toLocaleString('ru-RU') + ' ₽</strong>' : '') +
            '<small>' + escapeBookingHtml(labels[event.type] || 'Событие') + '</small></div></article>'
        ).join('') + '</div>' : '<div class="client-timeline-empty">Событий этого типа пока нет</div>');
    const select = root.querySelector('#clientTimelineFilter');
    if (select) select.addEventListener('change', () => {
        clientTimelineFilter = select.value;
        renderClientTimeline(clientBookings);
    });
}


function getSelectedClientBookings() {
    if (!selectedClientProfileKey) return [];
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const phone = normalizeClientPhone(profile.phone);
    return bookings.filter(booking => {
        if (String(booking.clientName || '') === String(profile.clientName || '') &&
            String(booking.barberId || '') === String(profile.barberId || '')) return true;
        if (phone.length < 7) return false;
        const linkedProfile = findClientProfile(booking.clientName, booking.barberId).profile;
        return normalizeClientPhone(linkedProfile.phone) === phone;
    });
}

function refreshSelectedClientActivity(resetTimelineFilter = false) {
    const clientBookings = getSelectedClientBookings();
    if (resetTimelineFilter) clientTimelineFilter = 'all';
    renderClientTimeline(clientBookings);
    renderClientActivitySignals(clientBookings);
}

function renderClientActivitySignals(clientBookings = []) {
    const root = document.getElementById('clientActivitySignals');
    if (!root || !selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const signals = [];
    const addSignal = (level, title, detail) => signals.push({ level, title, detail });
    const overdueTasks = (Array.isArray(profile.tasks) ? profile.tasks : []).filter(task => {
        if (task.done || !task.dueDate) return false;
        const due = parseClientTaskDate(task.dueDate);
        return due && due.getTime() < today;
    });
    const dueSoonTasks = (Array.isArray(profile.tasks) ? profile.tasks : []).filter(task => {
        if (task.done || !task.dueDate) return false;
        const due = parseClientTaskDate(task.dueDate);
        return due && due.getTime() >= today && due.getTime() <= today + 7 * 86400000;
    });
    if (overdueTasks.length) addSignal('urgent', 'Просроченные задачи', overdueTasks.length + ' · ' + overdueTasks.slice(0,2).map(task => task.title).join(', '));
    else if (dueSoonTasks.length) addSignal('info', 'Ближайшие задачи', dueSoonTasks.length + ' на ближайшие 7 дней');

    const unpaid = clientBookings.filter(booking => !['cancelled','no_show','missed'].includes(String(booking.status || '').toLowerCase()))
        .map(booking => {
            const total = getBookingServiceTotal(booking);
            const payment = getBookingPaymentState(booking, total);
            return { balance: Math.max(0,total-(Number(payment?.paid)||0)), timestamp: parseClientDateTime(booking) };
        }).filter(item => item.balance > 0 && item.timestamp > 0 && item.timestamp < Date.now());
    const overdueAmount = unpaid.reduce((sum,item) => sum + item.balance,0);
    if (overdueAmount > 0) addSignal('urgent','Есть задолженность',Math.round(overdueAmount).toLocaleString('ru-RU') + ' ₽ · ' + unpaid.length + ' прошедших записей');

    const completed = clientBookings.filter(booking => booking.status === 'completed' && parseClientDateTime(booking) > 0)
        .sort((a,b) => parseClientDateTime(b)-parseClientDateTime(a));
    if (completed.length) {
        const days = Math.floor((Date.now()-parseClientDateTime(completed[0]))/86400000);
        if (days >= 90) addSignal('warning','Давно не посещал','Последний визит ' + days + ' дн. назад');
        else if (days >= 45) addSignal('info','Пора напомнить','Последний визит ' + days + ' дн. назад');
    }

    const datedBookings = clientBookings.filter(booking => parseClientDateTime(booking) > 0);
    const cancelled = datedBookings.filter(booking => String(booking.status || '').toLowerCase() === 'cancelled').length;
    if (datedBookings.length >= 3 && cancelled >= 3 && cancelled / datedBookings.length >= 0.3) {
        addSignal('warning','Частые отмены',cancelled + ' из ' + datedBookings.length + ' записей');
    }

    if (profile.birthday) {
        const match = String(profile.birthday).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const month = Number(match[2])-1, day = Number(match[3]);
            let next = new Date(now.getFullYear(),month,day);
            if (next.getTime() < today) next = new Date(now.getFullYear()+1,month,day);
            const days = Math.round((next.getTime()-today)/86400000);
            if (days <= 30) addSignal('positive',days === 0 ? 'Сегодня день рождения' : 'Скоро день рождения',days === 0 ? 'Можно поздравить клиента сегодня' : 'Через ' + days + ' дн.');
        }
    }

    const activeTasks = (Array.isArray(profile.tasks) ? profile.tasks : []).filter(task => !task.done).length;
    if (activeTasks && !overdueTasks.length && !dueSoonTasks.length) addSignal('neutral','Открытые задачи',activeTasks + ' без ближайшего срока');

    const priority = { urgent:0, warning:1, info:2, positive:3, neutral:4 };
    signals.sort((a,b) => priority[a.level]-priority[b.level]);
    root.innerHTML = '<div class="client-activity-heading"><div><strong>Сигналы внимания</strong><span>Что важно не упустить по этому клиенту</span></div><span>' + signals.length + '</span></div>' +
        (signals.length ? '<div class="client-activity-grid">' + signals.map(signal =>
            '<article class="client-activity-signal is-' + signal.level + '"><b>' + escapeBookingHtml(signal.title) + '</b><span>' + escapeBookingHtml(signal.detail) + '</span></article>'
        ).join('') + '</div>' : '<div class="client-activity-empty">Срочных вопросов нет — по этому клиенту всё спокойно</div>');
}

function showClientDetails(name, barberId) {
    const selectedProfile = findClientProfile(name, barberId);
    const selectedPhone = normalizeClientPhone(selectedProfile.profile.phone);
    const mergedClientProfile = { ...selectedProfile.profile };
    if (selectedPhone.length >= 7) {
        Object.values(clientProfiles)
            .filter(profile => normalizeClientPhone(profile.phone) === selectedPhone)
            .forEach(profile => {
                ['phone', 'birthday', 'tag', 'notes', 'preferences'].forEach(field => {
                    if (!mergedClientProfile[field] && profile[field]) {
                        mergedClientProfile[field] = profile[field];
                    }
                });
            });
    }
    const myBookings = bookings.filter(b => {
        if (b.clientName === name && String(b.barberId) === String(barberId)) return true;
        if (!selectedPhone) return false;
        const otherProfile = findClientProfile(b.clientName, b.barberId).profile;
        return normalizeClientPhone(otherProfile.phone) === selectedPhone;
    });
    
    // Правильная сортировка: от старых к новым
    const parseClientVisitTimestamp = booking => parseClientDateTime(booking);
    myBookings.sort((a, b) => parseClientVisitTimestamp(b) - parseClientVisitTimestamp(a));
    
    let total = 0;
    let completedRevenue = 0;
    let completedCount = 0;
    
    const historyHTML = myBookings.map(b => {
        const serviceTotal = (Array.isArray(b.services) ? b.services : []).reduce((sum, service) => {
            const amount = Number(service?.price);
            return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
        }, 0);
        const paymentState = getBookingPaymentState(b, serviceTotal);
        const paymentMethodKey = ['cash', 'card', 'transfer', 'online', 'mixed'].includes(paymentState.method)
            ? paymentState.method : 'other';
        const paymentMethodLabel = paymentState.methodLabel || 'Не указан';
        total += getBookingCollectedAmount(b);
        if (b.status === 'completed') {
            completedRevenue += getBookingCollectedAmount(b);
            completedCount++;
        }
        
        let statusIcon = '🕐';
        let statusColor = '#888';
        if (b.status === 'completed') { statusIcon = '✅'; statusColor = '#4CAF50'; }
        else if (b.status === 'cancelled') { statusIcon = '❌'; statusColor = '#ff4d4d'; }

        const servicesText = (b.services || []).map(s => escapeBookingHtml(s.title || 'Услуга')).join(', ');
        const masterName = mockStaff.find(s => s.id === b.barberId)?.name || '—';
        const sourceMeta = getBookingSourceMeta(b);
        const clientTypeMeta = getBookingClientTypeMeta(b);

        return `
            <article class="client-history-item status-${escapeBookingHtml(b.status || 'active')}">
                <div class="client-history-icon" aria-hidden="true">${statusIcon}</div>
                <div class="client-history-content">
                    <div class="client-history-date">${escapeBookingHtml(b.date)} в ${escapeBookingHtml(b.time)}</div>
                    <div class="booking-card-badges"><i class="booking-origin origin-${sourceMeta.className}">${sourceMeta.label}</i><i class="booking-client-type type-${clientTypeMeta.className}">${clientTypeMeta.label}</i></div>
                    <div class="client-history-services">${servicesText || 'Услуги не указаны'}</div>
                    <div class="client-history-master">Мастер: ${escapeBookingHtml(masterName)}</div>
                    <div class="client-history-payment">
                        Оплата: <b class="payment-state payment-${escapeBookingHtml(paymentState.status)}">${escapeBookingHtml(paymentState.label)}</b>
                        <span>${paymentState.paid.toLocaleString('ru-RU')} / ${serviceTotal.toLocaleString('ru-RU')} ₽</span>
                        <span class="finance-payment-method finance-payment-method--${paymentMethodKey}"><i></i>${escapeBookingHtml(paymentMethodLabel)}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    document.getElementById('clientDetailsName').innerText = name;
    selectedClientProfileKey = selectedProfile.key;
    clientProfiles[selectedClientProfileKey] = {
        ...mergedClientProfile,
        clientName: name,
        barberId
    };

    const profile = clientProfiles[selectedClientProfileKey] || {};
    // Открываем карточку до построения вторичных блоков: сбой аналитики не должен блокировать доступ к клиенту.
    openModal('clientDetailsModal');

    document.getElementById('clientDetailsPhone').value = profile.phone || '';
    const birthdayInput = document.getElementById('clientDetailsBirthday');
    if (birthdayInput) birthdayInput.value = profile.birthday || '';
    const tagInput = document.getElementById('clientDetailsTag');
    if (tagInput) tagInput.value = profile.tag || 'regular';
    document.getElementById('clientDetailsNotes').value = profile.notes || '';
    const preferencesInput = document.getElementById('clientDetailsPreferences');
    if (preferencesInput) preferencesInput.value = profile.preferences || '';
    document.getElementById('clientDetailsMaster').innerText = mockStaff.find(s => String(s.id) === String(barberId))?.name || 'Мастер';
    document.getElementById('clientDetailsVisits').innerText = completedCount;
    document.getElementById('clientDetailsTotal').innerText = total + ' ₽';
    
    const cancelledCount = myBookings.filter(b => b.status === 'cancelled').length;
    const noShowCount = myBookings.filter(b => ['no_show', 'missed'].includes(String(b.status || '').toLowerCase())).length;
    const completedVisits = myBookings
        .filter(booking => booking.status === 'completed' && parseClientDateTime(booking) > 0)
        .sort((a, b) => parseClientDateTime(a) - parseClientDateTime(b));
    const firstCompleted = completedVisits[0] || null;
    const lastCompleted = completedVisits[completedVisits.length - 1] || null;
    const averageCheck = completedCount ? Math.round(completedRevenue / completedCount) : 0;
    const visitGaps = completedVisits.slice(1).map((booking, index) =>
        (parseClientDateTime(booking) - parseClientDateTime(completedVisits[index])) / 86400000
    ).filter(days => Number.isFinite(days) && days > 0);
    const averageVisitGap = visitGaps.length
        ? Math.round(visitGaps.reduce((sum, days) => sum + days, 0) / visitGaps.length)
        : 0;
    const daysSinceLastVisit = lastCompleted
        ? Math.max(0, Math.floor((Date.now() - parseClientDateTime(lastCompleted)) / 86400000))
        : null;
    const activityLabel = daysSinceLastVisit === null
        ? 'Нет завершённых визитов'
        : daysSinceLastVisit >= 90
            ? 'Давно не был'
            : daysSinceLastVisit >= 45
                ? 'Пора напомнить'
                : 'Активный клиент';
    const metrics = document.getElementById('clientDetailsMetrics');
    if (metrics) {
        const nextVisit = myBookings.filter(booking => !['cancelled', 'completed', 'no_show', 'missed'].includes(String(booking.status || '').toLowerCase()) && parseClientDateTime(booking) >= Date.now())
            .sort((a,b) => parseClientDateTime(a) - parseClientDateTime(b))[0];
        metrics.innerHTML = `
            <span>Отмен: <b>${cancelledCount}</b></span>
            <span>Неявки: <b>${noShowCount}</b></span>
            <span>Средний чек: <b>${averageCheck.toLocaleString('ru-RU')} ₽</b></span>
            <span>Частота визитов: <b>${averageVisitGap ? 'раз в ' + averageVisitGap + ' дн.' : 'недостаточно данных'}</b></span>
            <span>Первый визит: <b>${firstCompleted ? escapeBookingHtml(firstCompleted.date) : '—'}</b></span>
            <span>Последний визит: <b>${lastCompleted ? escapeBookingHtml(lastCompleted.date) : '—'}</b></span>
            <span>Активность: <b>${activityLabel}</b></span>
            <span>Следующая запись: <b>${nextVisit ? escapeBookingHtml(nextVisit.date + ' · ' + nextVisit.time) : 'нет'}</b></span>
        `;
    }

    const clientSectionRenderers = [
        ['покупки товаров', () => renderClientRetailPurchases(myBookings)],
        ['рекомендации товаров', () => renderClientProductRecommendations()],
        ['лояльность', () => renderClientLoyaltyPanel(myBookings)],
        ['аналитика', () => renderClientInsights(myBookings)],
        ['ценность клиента', () => renderClientLifetimeValue(myBookings)],
        ['история общения', () => renderClientInteractionHistory()],
        ['активность', () => refreshSelectedClientActivity(true)],
        ['задачи', () => renderClientTasks()]
    ];
    clientSectionRenderers.forEach(([sectionName, renderSection]) => {
        try {
            renderSection();
        } catch (error) {
            console.error('Не удалось отобразить раздел карточки клиента (' + sectionName + '):', error);
        }
    });

    const historyContainer = document.getElementById('clientDetailsHistory');
    if (historyContainer) {
        historyContainer.innerHTML = historyHTML || '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">История пуста</div>';
    }

    try {
        renderClientMessageDraft('return');
    } catch (error) {
        console.error('Не удалось отобразить шаблон сообщения клиента:', error);
    }
}


function renderClientInsights(clientBookings) {
    const root = document.getElementById('clientDetailsInsights');
    if (!root) return;
    const completed = (clientBookings || []).filter(booking => booking.status === 'completed');
    const serviceCounts = new Map();
    const masterCounts = new Map();
    completed.forEach(booking => {
        // Считаем визиты с услугой, а не количество строк услуги в одном визите.
        const servicesInVisit = new Set(
            (Array.isArray(booking.services) ? booking.services : [])
                .map(service => String(service?.title || 'Услуга').trim())
                .filter(Boolean)
        );
        servicesInVisit.forEach(title => {
            serviceCounts.set(title, (serviceCounts.get(title) || 0) + 1);
        });
        const master = mockStaff.find(staff => String(staff.id) === String(booking.barberId))?.name || 'Мастер';
        masterCounts.set(master, (masterCounts.get(master) || 0) + 1);
    });
    const topService = [...serviceCounts.entries()].sort((a,b) => b[1] - a[1])[0];
    const topMaster = [...masterCounts.entries()].sort((a,b) => b[1] - a[1])[0];
    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        months.push({
            key: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
            label: date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
            revenue: 0
        });
    }
    const monthLookup = new Map(months.map(month => [month.key, month]));
    completed.forEach(booking => {
        const timestamp = parseClientDateTime(booking);
        if (!timestamp) return;
        const date = new Date(timestamp);
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        const month = monthLookup.get(key);
        if (month) month.revenue += getBookingCollectedAmount(booking);
    });
    const maxRevenue = Math.max(1, ...months.map(month => month.revenue));
    const recentRevenue = months.slice(3).reduce((sum, month) => sum + month.revenue, 0);
    const previousRevenue = months.slice(0, 3).reduce((sum, month) => sum + month.revenue, 0);
    let trendLabel = 'Пока недостаточно данных';
    let trendClass = 'neutral';
    if (recentRevenue > previousRevenue) {
        trendLabel = previousRevenue ? 'Рост на ' + Math.round((recentRevenue - previousRevenue) / previousRevenue * 100) + '%' : 'Есть расходы за последние 3 месяца';
        trendClass = 'positive';
    } else if (recentRevenue < previousRevenue) {
        trendLabel = 'Снижение на ' + (recentRevenue ? Math.round((previousRevenue - recentRevenue) / previousRevenue * 100) : 100) + '%';
        trendClass = 'negative';
    } else if (recentRevenue > 0) {
        trendLabel = 'Без изменений';
    }
    root.innerHTML = `
        <div class="client-insights-heading">
            <div><strong>Аналитика клиента</strong><span>По завершённым визитам</span></div>
            <span class="client-insights-period">6 месяцев</span>
        </div>
        <div class="client-insights-favorites">
            <div class="client-insight-favorite"><span>Любимая услуга</span><strong>${topService ? escapeBookingHtml(topService[0]) : '—'}</strong><small>${topService ? topService[1] + ' визит(а)' : 'Нет данных'}</small></div>
            <div class="client-insight-favorite"><span>Частый мастер</span><strong>${topMaster ? escapeBookingHtml(topMaster[0]) : '—'}</strong><small>${topMaster ? topMaster[1] + ' визит(а)' : 'Нет данных'}</small></div>
        </div>
        <div class="client-insights-chart-head"><span>Расходы по месяцам</span><b class="${trendClass}">${trendLabel}</b></div>
        <div class="client-insights-bars">${months.map(month => `
            <div class="client-insights-month" title="${month.label}: ${Math.round(month.revenue).toLocaleString('ru-RU')} ₽">
                <div class="client-insights-bar-track"><i style="height:${month.revenue ? Math.max(5, month.revenue / maxRevenue * 100) : 0}%"></i></div>
                <span>${escapeBookingHtml(month.label)}</span>
                <small>${month.revenue ? Math.round(month.revenue).toLocaleString('ru-RU') : '—'}</small>
            </div>`).join('')}</div>
    `;
}


function renderClientLifetimeValue(clientBookings) {
    const root = document.getElementById('clientLifetimeValue');
    if (!root) return;
    const completed = (clientBookings || [])
        .filter(booking => booking.status === 'completed')
        .sort((a,b) => parseClientDateTime(a) - parseClientDateTime(b));
    const total = completed.reduce((sum, booking) => sum + getBookingCollectedAmount(booking), 0);
    const count = completed.length;
    const average = count ? Math.round(total / count) : 0;
    const first = completed.find(booking => parseClientDateTime(booking) > 0);
    const last = completed.slice().reverse().find(booking => parseClientDateTime(booking) > 0);
    const daysSince = last ? Math.max(0, Math.floor((Date.now() - parseClientDateTime(last)) / 86400000)) : null;
    const now = Date.now();
    const unpaidBalances = (clientBookings || [])
        .filter(booking => booking.status !== 'cancelled')
        .map(booking => {
            const serviceTotal = getBookingServiceTotal(booking);
            const payment = getBookingPaymentState(booking, serviceTotal);
            const balance = Math.max(0, serviceTotal - payment.paid);
            const timestamp = parseClientDateTime(booking);
            return { balance, timestamp };
        })
        .filter(item => item.balance > 0);
    const totalBalance = unpaidBalances.reduce((sum, item) => sum + item.balance, 0);
    const overdueBalance = unpaidBalances
        .filter(item => item.timestamp > 0 && item.timestamp < now)
        .reduce((sum, item) => sum + item.balance, 0);
    const overdueCount = unpaidBalances.filter(item => item.timestamp > 0 && item.timestamp < now).length;
    let relationship = 'Пока без визитов';
    let relationshipNote = 'Статус появится после первого завершённого визита';
    if (count) {
        if (daysSince >= 90) {
            relationship = 'Клиент на паузе';
            relationshipNote = 'Последний визит был ' + daysSince + ' дн. назад';
        } else if (count >= 6) {
            relationship = 'Постоянный клиент';
            relationshipNote = '6 и более завершённых визитов';
        } else if (count >= 3) {
            relationship = 'Возвращающийся клиент';
            relationshipNote = 'Уже ' + count + ' завершённых визита';
        } else {
            relationship = 'Новый клиент';
            relationshipNote = count === 1 ? 'Пока один завершённый визит' : 'Есть первые повторные визиты';
        }
    }
    root.innerHTML = `
        <div class="client-ltv-heading">
            <div><strong>Ценность клиента за всё время</strong><span>Только фактически полученная оплата по завершённым визитам</span></div>
            <span class="client-ltv-status">${relationship}</span>
        </div>
        <div class="client-ltv-total"><strong>${Math.round(total).toLocaleString('ru-RU')} ₽</strong><span>Всего получено</span></div>
        <div class="client-ltv-stats">
            <div><b>${count}</b><span>Завершённых визитов</span></div>
            <div><b>${average.toLocaleString('ru-RU')} ₽</b><span>Средний чек</span></div>
            <div><b>${first ? escapeBookingHtml(first.date) : '—'}</b><span>Первый визит</span></div>
        </div>
        <div class="client-ltv-balance">
            <div><span>Остаток к оплате по записям</span><strong>${Math.round(totalBalance).toLocaleString('ru-RU')} ₽</strong></div>
            <div><span>По прошедшим записям · ${overdueCount}</span><strong class="${overdueBalance > 0 ? 'is-due' : ''}">${Math.round(overdueBalance).toLocaleString('ru-RU')} ₽</strong></div>
        </div>
        <p class="client-ltv-note">${relationshipNote}</p>
    `;
}

function renderClientMessageDraft(mode = 'return') {
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const name = String(profile.clientName || document.getElementById('clientDetailsName')?.textContent || 'Клиент').trim();
    const firstName = name.split(/\\s+/)[0] || 'Клиент';
    const birthday = profile.birthday ? new Date(profile.birthday + 'T12:00:00') : null;
    let draft = '';
    if (mode === 'birthday') {
        const dateLabel = birthday && !Number.isNaN(birthday.getTime())
            ? birthday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
            : '';
        draft = 'Здравствуйте, ' + firstName + '! 🎉 Поздравляем вас с днём рождения' +
            (dateLabel ? ' — ' + dateLabel : '') +
            '! Желаем отличного настроения и всего самого лучшего. Будем рады видеть вас в MensFire — подберём удобное время для визита.';
    } else {
        const clientBookings = bookings.filter(booking =>
            String(booking.clientName || '') === name &&
            String(booking.barberId || '') === String(profile.barberId || '')
        );
        const last = clientBookings.filter(booking => booking.status === 'completed' && parseClientDateTime(booking) > 0)
            .sort((a,b) => parseClientDateTime(b) - parseClientDateTime(a))[0];
        const days = last ? Math.max(0, Math.floor((Date.now() - parseClientDateTime(last)) / 86400000)) : null;
        draft = 'Здравствуйте, ' + firstName + '! Давно не виделись в MensFire' +
            (days !== null ? ' — уже ' + days + ' дн. с вашего последнего визита' : '') +
            '. Будем рады снова вас видеть! Если захотите обновить образ, напишите — подберём удобное время.';
    }
    const field = document.getElementById('clientMessageDraft');
    if (field) field.value = draft;
    document.querySelectorAll('[data-client-message-mode]').forEach(button => {
        const active = button.dataset.clientMessageMode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}
function setClientMessageMode(mode) {
    renderClientMessageDraft(mode === 'birthday' ? 'birthday' : 'return');
}
function copyClientMessageDraft() {
    const field = document.getElementById('clientMessageDraft');
    if (!field) return;
    field.focus();
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    if (copied) showToast('Текст сообщения скопирован', 'success');
    else showToast('Выделите текст и скопируйте его вручную', 'info');
}

function createBookingForClient() {
    if (!selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const clientName = profile.clientName || document.getElementById('clientDetailsName')?.textContent || '';
    const barberId = String(profile.barberId || currentUser?.id || '');
    closeModal('clientDetailsModal');
    openNewBookingModal(barberId);
    const input = document.getElementById('newBookingClient');
    if (input) {
        input.value = clientName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
// --- ПРОФИЛЬ ---
function renderBarberRevenue() {
    const card = document.getElementById('barberRevenueCard');
    if (!currentUser) {
        if (card) card.style.display = 'none';
        return;
    }
    if (card) card.style.display = 'block';
    const today = new Date().toLocaleDateString('ru-RU');
    const revenueEl = document.getElementById('barberRevenue');
    const titleEl = document.getElementById('profileRevenueTitle');
    if (!revenueEl || !titleEl) return;
    if (isAdminUser()) {
        const totalRevenue = bookings.filter(item => item.date === today && item.status === 'completed')
            .reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        const totalExpenses = expenses.filter(item => item.date === today)
            .reduce((sum,item) => sum + Number(item.amount || 0),0);
        const profit = totalRevenue-totalExpenses;
        titleEl.textContent = 'Прибыль барбершопа за сегодня';
        revenueEl.textContent = Math.round(profit).toLocaleString('ru-RU') + ' ₽';
        revenueEl.style.color = profit >= 0 ? '#4CAF50' : '#ff4d4d';
    } else {
        const revenue = bookings.filter(item => String(item.barberId) === String(currentUser.id) && item.date === today && item.status === 'completed')
            .reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        titleEl.textContent = 'Моя доля за сегодня · 40%';
        revenueEl.textContent = Math.round(revenue * .4).toLocaleString('ru-RU') + ' ₽';
        revenueEl.style.color = 'var(--gold)';
    }
}
function renderProfileOverview() {
    const container = document.getElementById('profileOverview');
    if (!container || !currentUser) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(),now.getMonth(),1);
    const parseDate = value => {
        const parts = String(value || '').split('.').map(Number);
        return parts.length === 3 && parts.every(Number.isFinite) ? new Date(parts[2],parts[1]-1,parts[0]) : null;
    };
    const scope = bookings.filter(item => {
        const date = parseDate(item.date);
        return date && date >= monthStart && (isAdminUser() || String(item.barberId) === String(currentUser.id));
    });
    const completed = scope.filter(item => item.status === 'completed');
    const collected = scope.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
    const clients = new Set(completed.map(item => String(item.clientName || '').trim().toLowerCase()).filter(Boolean));
    const due = scope.filter(item => item.status !== 'cancelled').reduce((sum,item) => {
        const total = (item.services || []).reduce((n,service) => n + Number(service.price || 0),0);
        return sum + Math.max(0,total-getBookingPaymentState(item,total).paid);
    },0);
    container.innerHTML = `
        <div class="profile-overview-card"><span>Визитов за месяц</span><strong>${completed.length}</strong></div>
        <div class="profile-overview-card"><span>${isAdminUser() ? 'Получено за месяц' : 'Моя выручка за месяц'}</span><strong>${Math.round(collected).toLocaleString('ru-RU')} ₽</strong></div>
        <div class="profile-overview-card"><span>Клиентов</span><strong>${clients.size}</strong></div>
        <div class="profile-overview-card"><span>Остаток к оплате</span><strong>${Math.round(due).toLocaleString('ru-RU')} ₽</strong></div>`;
}

/* Резервное копирование данных салона (хранение остаётся локальным). */
const MENSFIRE_BACKUP_KEYS = [
    'mensfire_admin_bookings',
    'mensfire_admin_blocks',
    'mensfire_admin_expenses',
    'mensfire_admin_staff',
    'mensfire_admin_services',
    'mensfire_client_profiles',
    'mensfire_inventory_products',
    'mensfire_inventory_movements',
    'mensfire_inventory_purchase_orders',
    'mensfire_inventory_suppliers',
    'mensfire_inventory_supplier_payments',
    'mensfire_client_retail_sales'
];

function exportMensfireBackup() {
    if (!requireAdminAction('Создавать резервные копии может только Али')) return;
    const data = {};
    MENSFIRE_BACKUP_KEYS.forEach(key => {
        const raw = localStorage.getItem(appStorageKey(key));
        if (raw !== null) {
            try { data[key] = JSON.parse(raw); }
            catch (error) { throw new Error('Не удалось прочитать данные для копии: ' + key); }
        } else {
            data[key] = key === 'mensfire_client_profiles' ? {} : [];
        }
    });

    const backup = {
        app: 'MENSFIRE',
        version: 1,
        createdAt: new Date().toISOString(),
        data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mensfire-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Резервная копия скачана', 'success');
}

function importMensfireBackup(input) {
    if (!requireAdminAction('Восстанавливать резервные копии может только Али')) {
        if (input) input.value = '';
        return;
    }
    const file = input?.files?.[0];
    if (!file) return;
    const MAX_BACKUP_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_BACKUP_SIZE) {
        showToast('Файл резервной копии слишком большой (максимум 20 МБ)', 'error');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        let backup;
        try {
            backup = JSON.parse(String(reader.result || ''));
            if (backup?.app !== 'MENSFIRE' || backup?.version !== 1 ||
                !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
                throw new Error('Неподдерживаемый формат резервной копии');
            }
            // Совместимость с копиями, созданными до появления отдельных модулей.
            if (backup.data.mensfire_admin_services === undefined) {
                backup.data.mensfire_admin_services = JSON.parse(JSON.stringify(defaultServicesData));
            }
            if (backup.data.mensfire_inventory_products === undefined) backup.data.mensfire_inventory_products = [];
            if (backup.data.mensfire_inventory_movements === undefined) backup.data.mensfire_inventory_movements = [];
            if (backup.data.mensfire_inventory_purchase_orders === undefined) backup.data.mensfire_inventory_purchase_orders = [];
            if (backup.data.mensfire_inventory_suppliers === undefined) backup.data.mensfire_inventory_suppliers = [];
            if (backup.data.mensfire_inventory_supplier_payments === undefined) backup.data.mensfire_inventory_supplier_payments = [];
            if (backup.data.mensfire_client_retail_sales === undefined) backup.data.mensfire_client_retail_sales = [];
            const expected = {
                mensfire_admin_bookings: Array.isArray,
                mensfire_admin_blocks: Array.isArray,
                mensfire_admin_expenses: Array.isArray,
                mensfire_admin_staff: Array.isArray,
                mensfire_admin_services: value => value && typeof value === 'object' && !Array.isArray(value) &&
                    Array.isArray(value.top) && Array.isArray(value.barber),
                mensfire_inventory_products: Array.isArray,
                mensfire_inventory_movements: Array.isArray,
                mensfire_inventory_purchase_orders: Array.isArray,
                mensfire_inventory_suppliers: Array.isArray,
                mensfire_inventory_supplier_payments: Array.isArray,
                mensfire_client_retail_sales: Array.isArray,
                mensfire_client_profiles: value => value && typeof value === 'object' && !Array.isArray(value)
            };
            for (const [key, validator] of Object.entries(expected)) {
                if (!validator(backup.data[key])) {
                    throw new Error('В копии отсутствуют или повреждены данные: ' + key);
                }
            }

            for (const group of ['top', 'barber']) {
                const serviceIds = new Set();
                for (const service of backup.data.mensfire_admin_services[group]) {
                    if (!service || typeof service !== 'object' || Array.isArray(service) ||
                        typeof service.id !== 'string' || !service.id.trim() ||
                        typeof service.title !== 'string' || !service.title.trim() ||
                        !Number.isFinite(Number(service.price)) || Number(service.price) < 0 ||
                        !Number.isFinite(Number(service.duration)) || Number(service.duration) < 5 ||
                        serviceIds.has(service.id)) {
                        throw new Error('Каталог услуг в резервной копии повреждён. Восстановление отменено.');
                    }
                    serviceIds.add(service.id);
                }
            }

            const staff = backup.data.mensfire_admin_staff;
            const staffIds = new Set();
            const staffPins = new Set();
            const hasAdmin = staff.some(member =>
                member && member.role === 'admin' && member.id && /^\d{4}$/.test(String(member.pin || ''))
            );
            if (!hasAdmin) {
                throw new Error('В резервной копии нет действующего администратора с корректным PIN. Восстановление отменено.');
            }
            for (const member of staff) {
                if (!member || typeof member.id !== 'string' || !member.id ||
                    typeof member.name !== 'string' || !member.name.trim() ||
                    !/^\d{4}$/.test(String(member.pin || '')) ||
                    staffIds.has(member.id) || staffPins.has(String(member.pin))) {
                    throw new Error('Список мастеров или PIN в резервной копии повреждён. Восстановление отменено.');
                }
                staffIds.add(member.id);
                staffPins.add(String(member.pin));
            }
        } catch (error) {
            showToast(error.message || 'Не удалось прочитать резервную копию', 'error');
            input.value = '';
            return;
        }

        showConfirm(
            'Восстановить резервную копию?',
            'Текущие записи, перерывы, расходы, мастера и карточки клиентов будут заменены данными из файла. Перед восстановлением скачай текущую копию.',
            'Восстановить',
            () => {
                // Подготавливаем весь набор до записи и сохраняем исходное состояние для отката.
                const prepared = new Map();
                const previous = new Map();
                try {
                    MENSFIRE_BACKUP_KEYS.forEach(key => {
                        if (!Object.prototype.hasOwnProperty.call(backup.data, key)) {
                            throw new Error('В копии отсутствуют данные: ' + key);
                        }
                        prepared.set(appStorageKey(key), JSON.stringify(backup.data[key]));
                    });
                    prepared.forEach((value, key) => previous.set(key, localStorage.getItem(key)));
                    prepared.forEach((value, key) => localStorage.setItem(key, value));
                } catch (error) {
                    let rollbackFailed = false;
                    previous.forEach((value, key) => {
                        try {
                            if (value === null) localStorage.removeItem(key);
                            else localStorage.setItem(key, value);
                        } catch (rollbackError) {
                            rollbackFailed = true;
                        }
                    });
                    showToast(rollbackFailed
                        ? 'Не удалось полностью восстановить прежние данные. Проверь локальное хранилище и резервную копию.'
                        : 'Восстановление отменено: данные не были полностью сохранены. Освободи место в браузере и попробуй снова.',
                        'error');
                    return;
                }
                showToast('Данные восстановлены. Перезагружаю приложение…', 'success');
                setTimeout(() => window.location.reload(), 700);
            }
        );
        input.value = '';
    };
    reader.onerror = () => {
        showToast('Не удалось прочитать выбранный файл', 'error');
        input.value = '';
    };
    reader.readAsText(file);
}

function openChangePasswordModal() {
    document.getElementById('newPin').value = '';
    openModal('passwordModal');
}

function changePassword() {
    const newPin = document.getElementById('newPin').value;
    if (!/^\d{4}$/.test(newPin)) return showToast('PIN должен состоять из 4 цифр', 'error');
    
    // Проверка, что PIN не занят другим мастером
    if (mockStaff.some(s => s.pin === newPin && s.id !== currentUser.id)) {
        return showToast('Этот PIN уже занят другим мастером', 'error');
    }

    const staff = mockStaff.find(s => s.id === currentUser.id);
    if (staff) {
        staff.pin = newPin;
        // Сессия не содержит PIN; сохраняем только обновлённые данные мастеров.
        localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
        closeModal('passwordModal');
        showToast('Пароль успешно изменен', 'success');
    }
}

// --- ИНТЕГРАЦИЯ С ПЕРЕКЛЮЧЕНИЕМ ЭКРАНОВ ---
// Переопределяем switchView из Части 1, чтобы добавлять вызов рендера при переходе
const originalSwitchView = switchView;
switchView = function(viewId, navElement) {
    originalSwitchView(viewId, navElement);
    
    if (viewId === 'viewSchedule') renderSchedule();
    if (viewId === 'viewFinance' && currentUser.role === 'admin') renderFinance();
    if (viewId === 'viewTeam' && currentUser.role === 'admin') renderTeam();
    if (viewId === 'viewClients') renderClients();
    if (viewId === 'viewInventory' && currentUser.role === 'admin') renderInventory();
    if (viewId === 'viewInventoryAnalytics' && currentUser.role === 'admin') renderInventoryAnalytics();
    if (viewId === 'viewPurchases' && currentUser.role === 'admin') renderPurchaseOrders();

    if (viewId === 'viewProfile') {
        renderBarberRevenue();
        
        // Показываем левую колонку с командой на ПК
        if (currentUser.role === 'admin' && window.innerWidth >= 768) {
            document.getElementById('profileLeftCol').style.display = 'block';
            renderTeam();
        } else {
            document.getElementById('profileLeftCol').style.display = 'none';
        }
    }
};

/* =========================================
   СКЛАД: КАТАЛОГ И УЧЁТ ОСТАТКОВ
   ========================================= */
let inventoryProducts = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_products')) || '[]');
        return Array.isArray(saved) ? saved.map(item => ({
            id: String(item.id || ''),
            title: String(item.title || 'Товар'),
            description: String(item.description || ''),
            brand: String(item.brand || ''),
            sourceProductId: String(item.sourceProductId || ''),
            sku: String(item.sku || ''),
            category: String(item.category || 'Без категории'),
            unit: String(item.unit || 'шт.'),
            purchasePrice: Math.max(0, Number(item.purchasePrice) || 0),
            salePrice: Math.max(0, Number(item.salePrice) || 0),
            stock: Math.max(0, Number(item.stock) || 0),
            minStock: Math.max(0, Number(item.minStock) || 0),
            active: item.active !== false,
            updatedAt: String(item.updatedAt || '')
        })).filter(item => item.id) : [];
    } catch (error) {
        console.warn('Не удалось загрузить каталог склада:', error);
        return [];
    }
})();


/* Справочник поставщиков. Данные хранятся отдельно от заказов и остаются локальными. */
let inventorySuppliers = (() => {
    try {
        const saved=JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_suppliers'))||'[]');
        return Array.isArray(saved)?saved.filter(item=>item&&item.id&&String(item.name||'').trim()).map(item=>({
            id:String(item.id),name:String(item.name||'').trim(),contactPerson:String(item.contactPerson||''),
            phone:String(item.phone||''),email:String(item.email||''),address:String(item.address||''),
            notes:String(item.notes||''),paymentTermDays:Math.min(365,Math.max(0,Number(item.paymentTermDays??30)||0)),active:item.active!==false,createdAt:String(item.createdAt||''),
            updatedAt:String(item.updatedAt||'')
        })):[];
    } catch(error){console.warn('Не удалось загрузить поставщиков:',error);return [];}
})();
function persistSuppliers(){localStorage.setItem(appStorageKey('mensfire_inventory_suppliers'),JSON.stringify(inventorySuppliers));}
let inventorySupplierPayments=(()=>{try{const a=JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_supplier_payments'))||'[]');return Array.isArray(a)?a.filter(p=>p&&p.id&&p.supplierId&&Number(p.amount)>0).map(p=>({id:String(p.id),supplierId:String(p.supplierId),supplierNameSnapshot:String(p.supplierNameSnapshot||''),amount:Number(p.amount),paidAt:String(p.paidAt||''),paymentMethod:String(p.paymentMethod||'Перевод'),note:String(p.note||''),allocations:(Array.isArray(p.allocations)?p.allocations:[]).filter(x=>x&&x.purchaseOrderId).map(x=>({purchaseOrderId:String(x.purchaseOrderId),amount:Math.max(0,Number(x.amount)||0)}))})):[];}catch(e){return [];}})();
function persistSupplierPayments(){localStorage.setItem(appStorageKey('mensfire_inventory_supplier_payments'),JSON.stringify(inventorySupplierPayments));}
let inventorySupplierRefunds=(()=>{try{const a=JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_supplier_refunds'))||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.orderId&&x.supplierId&&Number(x.amount)>0):[];}catch(e){return [];}})();
function persistSupplierRefunds(){localStorage.setItem(appStorageKey('mensfire_inventory_supplier_refunds'),JSON.stringify(inventorySupplierRefunds));}
let inventorySupplierReturns=(()=>{try{const a=JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_supplier_returns'))||'[]');return Array.isArray(a)?a.filter(item=>item&&item.id&&item.orderId&&item.supplierId&&Number(item.quantity)>0).map(item=>({id:String(item.id),orderId:String(item.orderId),supplierId:String(item.supplierId),supplierNameSnapshot:String(item.supplierNameSnapshot||''),productId:String(item.productId||''),productTitle:String(item.productTitle||'Товар'),itemIndex:Number(item.itemIndex),batchIndex:Number(item.batchIndex??-1),quantity:Number(item.quantity),unitCost:Math.max(0,Number(item.unitCost)||0),returnedAt:String(item.returnedAt||''),reason:String(item.reason||'')})):[];}catch(e){return [];}})();
function persistSupplierReturns(){localStorage.setItem(appStorageKey('mensfire_inventory_supplier_returns'),JSON.stringify(inventorySupplierReturns));}
function supplierReturnedQuantity(orderId,itemIndex,batchIndex=-1){return inventorySupplierReturns.filter(item=>item.orderId===String(orderId)&&item.itemIndex===Number(itemIndex)&&item.batchIndex===Number(batchIndex)).reduce((sum,item)=>sum+(Number(item.quantity)||0),0);}
function supplierReceivedTotal(order){return (order.items||[]).reduce((sum,line,itemIndex)=>{const gross=Array.isArray(line.receivedBatches)&&line.receivedBatches.length?line.receivedBatches.reduce((n,b)=>n+(Number(b.quantity)||0)*(Number(b.unitCost)||0),0):(Number(line.receivedQuantity)||0)*(Number(line.unitCost)||0);const returned=inventorySupplierReturns.filter(item=>item.orderId===String(order.id)&&item.itemIndex===itemIndex).reduce((n,item)=>n+(Number(item.quantity)||0)*(Number(item.unitCost)||0),0);return sum+Math.max(0,gross-returned);},0);}
function supplierOrderGrossReceivedTotal(order){return (order.items||[]).reduce((sum,line)=>sum+(Array.isArray(line.receivedBatches)&&line.receivedBatches.length?line.receivedBatches.reduce((n,b)=>n+(Number(b.quantity)||0)*(Number(b.unitCost)||0),0):(Number(line.receivedQuantity)||0)*(Number(line.unitCost)||0)),0);}
function supplierOrderGrossPaid(id){
    const cents=inventorySupplierPayments.reduce((sum,p)=>sum+(Array.isArray(p.allocations)?p.allocations.filter(a=>String(a.purchaseOrderId)===String(id)).reduce((n,a)=>n+Math.round(Number(a.amount)*100),0):0),0);
    return Number.isSafeInteger(cents)?cents/100:NaN;
}
function supplierOrderRefunded(id){
    const cents=inventorySupplierRefunds.filter(item=>String(item.orderId)===String(id)).reduce((sum,item)=>sum+Math.round(Number(item.amount)*100),0);
    return Number.isSafeInteger(cents)?cents/100:NaN;
}
function supplierOrderPaid(id){
    const paid=supplierOrderGrossPaid(id),refunded=supplierOrderRefunded(id);
    if(!Number.isFinite(paid)||!Number.isFinite(refunded))return 0;
    return Math.max(0,Math.round((paid-refunded)*100)/100);
}
function supplierOrderCredit(order){
    const paid=supplierOrderPaid(order.id),received=supplierReceivedTotal(order);
    if(!Number.isFinite(paid)||!Number.isFinite(received))return 0;
    return Math.max(0,Math.round((paid-received)*100)/100);
}
function supplierOrderDebt(order){
    const paid=supplierOrderPaid(order.id),received=supplierReceivedTotal(order);
    if(!Number.isFinite(paid)||!Number.isFinite(received))return 0;
    return Math.max(0,Math.round((received-paid)*100)/100);
}
function createSupplierRefund(data){
    if(!requireAdminAction('Фиксировать возврат денег от поставщика может только Али'))return false;
    const order=inventoryPurchaseOrders.find(item=>item.id===String(data?.orderId||''));
    if(!order||order.status==='cancelled'||!Array.isArray(order.items))return showToast('Заказ не найден или отменён','error'),false;
    const rawAmount=Number(data?.amount);
    if(!Number.isFinite(rawAmount)||rawAmount<=0)return showToast('Укажи корректную сумму возврата','error'),false;
    const amount=Math.round((rawAmount+Number.EPSILON)*100)/100;
    const amountCents=Math.round(amount*100),credit=supplierOrderCredit(order),creditCents=Math.round(credit*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||!Number.isSafeInteger(creditCents)||amountCents>creditCents)return showToast('Сумма превышает доступную переплату поставщику','error'),false;
    const date=String(data?.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime())||new Date(date+'T12:00:00').toISOString().slice(0,10)!==date)return showToast('Укажи корректную дату возврата','error'),false;
    const allowedMethods=['Перевод','Наличные','Карта','Зачёт'];
    const method=String(data?.method||'');
    if(!allowedMethods.includes(method))return showToast('Выбери корректный способ возврата','error'),false;
    const refunded=supplierOrderRefunded(order.id),grossPaid=supplierOrderGrossPaid(order.id);
    if(!Number.isFinite(refunded)||!Number.isFinite(grossPaid)||refunded<0||grossPaid<0||refunded>grossPaid)return showToast('В истории оплат или возвратов поставщику обнаружено расхождение','error'),false;
    const record={id:'srefund_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),orderId:order.id,supplierId:order.supplierId,supplierNameSnapshot:order.supplier||'',amount,refundedAt:new Date(date+'T12:00:00').toISOString(),method,note:String(data?.note||'').trim().slice(0,300)};
    inventorySupplierRefunds.unshift(record);
    try{persistSupplierRefunds();}
    catch(error){inventorySupplierRefunds.shift();return showToast('Не удалось сохранить возврат. Данные не изменены','error'),false;}
    renderSuppliers();renderPurchaseOrders();showToast('Возврат денег от поставщика сохранён','success');return record;
}

function createSupplierReturn(data){
    if(!requireAdminAction('Оформлять возвраты поставщикам может только Али'))return false;
    const order=inventoryPurchaseOrders.find(item=>item.id===String(data?.orderId||''));
    if(!order||order.status==='cancelled'||!Array.isArray(order.items))return showToast('Заказ не найден или отменён','error'),false;
    const itemIndex=Number(data.itemIndex);
    if(!Number.isSafeInteger(itemIndex)||itemIndex<0||itemIndex>=order.items.length)return showToast('Позиция заказа не найдена','error'),false;
    const line=order.items[itemIndex];
    const rawBatchIndex=Number(data.batchIndex);
    if(!Number.isSafeInteger(rawBatchIndex)||rawBatchIndex< -1)return showToast('Некорректно выбрана партия приёмки','error'),false;
    const batchIndex=rawBatchIndex,batches=Array.isArray(line.receivedBatches)?line.receivedBatches:[];
    const batch=batchIndex>=0?batches[batchIndex]:null;
    if(batchIndex>=0&&!batch)return showToast('Партия приёмки не найдена','error'),false;
    if(batchIndex===-1&&batches.length)return showToast('Выбери конкретную партию приёмки','error'),false;
    const grossQty=Number(batch?batch.quantity:line.receivedQuantity);
    if(!Number.isSafeInteger(grossQty)||grossQty<0)return showToast('В заказе указано некорректное принятое количество','error'),false;
    const rawCost=Number(batch?batch.unitCost:line.unitCost);
    if(!Number.isFinite(rawCost)||rawCost<0)return showToast('В заказе указана некорректная закупочная цена','error'),false;
    const unitCost=rawCost,quantity=Number(data.quantity);
    const alreadyReturned=supplierReturnedQuantity(order.id,itemIndex,batchIndex);
    if(!Number.isSafeInteger(alreadyReturned)||alreadyReturned<0||alreadyReturned>grossQty)return showToast('В истории возвратов обнаружено некорректное количество','error'),false;
    const available=grossQty-alreadyReturned;
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>available)return showToast('Количество возврата превышает доступный остаток партии','error'),false;
    const amount=quantity*unitCost;
    if(!Number.isFinite(amount))return showToast('Сумма возврата превышает допустимое значение','error'),false;
    const product=inventoryProducts.find(item=>item.id===line.productId);
    if(!product)return showToast('Товар не найден на складе','error'),false;
    const currentStock=Number(product.stock);
    if(!Number.isSafeInteger(currentStock)||currentStock<0)return showToast('У товара некорректный складской остаток. Возврат отменён','error'),false;
    if(currentStock<quantity)return showToast('На складе недостаточно товара для возврата','error'),false;
    const nextStock=currentStock-quantity;
    if(!Number.isSafeInteger(nextStock)||nextStock<0)return showToast('Не удалось безопасно пересчитать остаток товара','error'),false;
    const now=new Date().toISOString();
    const record={id:'sret_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),orderId:order.id,supplierId:order.supplierId,supplierNameSnapshot:order.supplier||'',productId:product.id,productTitle:line.titleSnapshot||product.title,itemIndex,batchIndex,quantity,unitCost,returnedAt:now,reason:String(data.reason||'').trim()};
    product.stock=nextStock;product.updatedAt=now;
    inventorySupplierReturns.unshift(record);
    inventoryMovements.push({id:'mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),productId:product.id,productTitle:product.title,type:'supplier_return',quantity:-quantity,supplier:order.supplier,totalCost:-amount,note:'Возврат поставщику по заказу '+order.id+(record.reason?' · '+record.reason:''),purchaseOrderId:order.id,supplierReturnId:record.id,createdAt:now});
    persistInventory();persistSupplierReturns();renderPurchaseOrders();renderSuppliers();
    showToast('Возврат поставщику зафиксирован','success');
    return record;
}

function openSupplierRefund(orderId){
    if(!requireAdminAction('Фиксировать возврат денег от поставщика может только Али'))return;
    const order=inventoryPurchaseOrders.find(item=>item.id===orderId);if(!order)return;
    const credit=supplierOrderCredit(order);if(credit<=0)return showToast('По заказу нет переплаты поставщику','info');
    document.getElementById('supplierRefundTitle').textContent='Возврат денег · '+order.supplier;
    document.getElementById('supplierRefundOrderId').value=order.id;
    document.getElementById('supplierRefundAmount').value=credit.toFixed(2);
    document.getElementById('supplierRefundAmount').max=credit.toFixed(2);
    document.getElementById('supplierRefundLimit').textContent='Доступная переплата: '+credit.toFixed(2)+' ₽';
    document.getElementById('supplierRefundDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('supplierRefundMethod').value='Перевод';
    document.getElementById('supplierRefundNote').value='';
    openModal('supplierRefundModal');
}
function submitSupplierRefund(){
    const record=createSupplierRefund({orderId:document.getElementById('supplierRefundOrderId')?.value,amount:document.getElementById('supplierRefundAmount')?.value,date:document.getElementById('supplierRefundDate')?.value,method:document.getElementById('supplierRefundMethod')?.value,note:document.getElementById('supplierRefundNote')?.value});
    if(record)closeModal('supplierRefundModal');
}
function supplierOrderReturnableQuantity(order){
    return (order.items||[]).reduce((sum,line,index)=>{const batches=Array.isArray(line.receivedBatches)?line.receivedBatches:[];if(batches.length)return sum+batches.reduce((n,batch,batchIndex)=>n+Math.max(0,(Number(batch.quantity)||0)-supplierReturnedQuantity(order.id,index,batchIndex)),0);return sum+Math.max(0,(Number(line.receivedQuantity)||0)-supplierReturnedQuantity(order.id,index,-1));},0);
}
function openSupplierReturn(orderId){
    if(!requireAdminAction('Оформлять возвраты поставщикам может только Али'))return;
    const order=inventoryPurchaseOrders.find(item=>item.id===orderId);if(!order||order.status==='cancelled')return;
    const select=document.getElementById('supplierReturnBatch');if(!select)return;
    const options=[];
    (order.items||[]).forEach((line,itemIndex)=>{
        const batches=Array.isArray(line.receivedBatches)?line.receivedBatches:[];
        const add=(batchIndex,batch)=>{const gross=Number(batch?batch.quantity:line.receivedQuantity)||0,product=inventoryProducts.find(item=>item.id===line.productId),batchAvailable=Math.max(0,gross-supplierReturnedQuantity(order.id,itemIndex,batchIndex)),available=Math.min(batchAvailable,Math.max(0,Number(product?.stock)||0));if(available<=0)return;const cost=Math.max(0,Number(batch?batch.unitCost:line.unitCost)||0),label=(line.titleSnapshot||'Товар')+(batch?' · '+new Date(batch.receivedAt||order.createdAt).toLocaleDateString('ru-RU'):' · без разбивки партий');options.push('<option value="'+itemIndex+':'+batchIndex+'" data-max="'+available+'" data-cost="'+cost+'">'+escapeBookingHtml(label)+' · доступно '+available+' шт. · '+cost.toFixed(2)+' ₽/ед.</option>');};
        if(batches.length)batches.forEach((batch,batchIndex)=>add(batchIndex,batch));else add(-1,null);
    });
    select.innerHTML=options.join('')||'<option value="">Нет доступных для возврата товаров</option>';
    document.getElementById('supplierReturnTitle').textContent='Возврат поставщику · '+order.supplier;
    document.getElementById('supplierReturnQuantity').value='1';document.getElementById('supplierReturnReason').value='';
    document.getElementById('supplierReturnOrderId').value=order.id;
    updateSupplierReturnLimit();openModal('supplierReturnModal');
}
function updateSupplierReturnLimit(){
    const select=document.getElementById('supplierReturnBatch'),option=select?.selectedOptions?.[0],qty=document.getElementById('supplierReturnQuantity');
    if(!option||!qty)return;const max=Number(option.dataset.max)||0;qty.max=String(max);qty.value=String(Math.min(Math.max(1,Number(qty.value)||1),max));document.getElementById('supplierReturnLimit').textContent='Максимум к возврату: '+max+' шт. · '+(Number(option.dataset.cost)||0).toFixed(2)+' ₽/ед.';
}
function submitSupplierReturn(){
    const orderId=document.getElementById('supplierReturnOrderId')?.value||'',parts=(document.getElementById('supplierReturnBatch')?.value||'').split(':');
    if(parts.length!==2||!orderId)return showToast('Выбери партию товара','error');
    const result=createSupplierReturn({orderId,itemIndex:Number(parts[0]),batchIndex:Number(parts[1]),quantity:Number(document.getElementById('supplierReturnQuantity')?.value),reason:document.getElementById('supplierReturnReason')?.value||''});
    if(result)closeModal('supplierReturnModal');
}
function supplierOrderFirstReceipt(order){
    const dates=(order.items||[]).flatMap(item=>(item.receivedBatches||[]).map(batch=>batch.receivedAt).filter(Boolean)).filter(value=>!Number.isNaN(new Date(value).getTime())).sort((a,b)=>new Date(a)-new Date(b));
    return dates[0]||order.updatedAt||order.createdAt||'';
}
function supplierOrderDueDate(order){
    const supplier=inventorySuppliers.find(item=>item.id===order.supplierId);
    const base=supplierOrderFirstReceipt(order),days=Math.max(0,Number(supplier?.paymentTermDays??30)||0);
    if(!base)return null;
    const date=new Date(base);date.setDate(date.getDate()+days);return date;
}
function supplierOrderOverdue(order,now=Date.now()){
    const due=supplierOrderDueDate(order);
    return due&&supplierOrderDebt(order)>0&&due.getTime()<now?supplierOrderDebt(order):0;
}
function supplierDebt(id){return inventoryPurchaseOrders.filter(o=>o.supplierId===id&&o.status!=='cancelled').reduce((n,o)=>n+supplierOrderDebt(o),0);}
let activeSupplierPaymentId=null;
function openSupplierPayment(id){if(!requireAdminAction('Вносить оплаты поставщикам может только Али'))return;const supplier=inventorySuppliers.find(x=>x.id===id);if(!supplier)return;const debt=supplierDebt(id);if(debt<=0)return showToast('По этому поставщику задолженности нет','info');activeSupplierPaymentId=id;document.getElementById('supplierPaymentTitle').textContent='Оплата · '+supplier.name;document.getElementById('supplierPaymentAmount').value=debt.toFixed(2);document.getElementById('supplierPaymentDate').value=new Date().toISOString().slice(0,10);document.getElementById('supplierPaymentMethod').value='Перевод';document.getElementById('supplierPaymentNote').value='';document.getElementById('supplierPaymentDebt').textContent='Текущая задолженность: '+Math.round(debt).toLocaleString('ru-RU')+' ₽';openModal('supplierPaymentModal');}
function saveSupplierPayment(){
    if(!requireAdminAction('Вносить оплаты поставщикам может только Али'))return;
    const supplier=inventorySuppliers.find(item=>item.id===activeSupplierPaymentId);if(!supplier)return;
    const rawAmount=Number(document.getElementById('supplierPaymentAmount')?.value);
    if(!Number.isFinite(rawAmount)||rawAmount<=0)return showToast('Укажи корректную сумму оплаты','error');
    const amount=Math.round((rawAmount+Number.EPSILON)*100)/100,amountCents=Math.round(amount*100);
    const debt=supplierDebt(supplier.id),debtCents=Math.round(debt*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||!Number.isSafeInteger(debtCents)||amountCents>debtCents)return showToast('Сумма не может превышать фактическую задолженность','error');
    const date=String(document.getElementById('supplierPaymentDate')?.value||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime())||new Date(date+'T12:00:00').toISOString().slice(0,10)!==date)return showToast('Укажи корректную дату оплаты','error');
    const method=String(document.getElementById('supplierPaymentMethod')?.value||'');
    if(!['Перевод','Наличные','Карта','Другое'].includes(method))return showToast('Выбери корректный способ оплаты','error');
    let left=amountCents;const allocations=[];
    const orders=inventoryPurchaseOrders.filter(order=>order.supplierId===supplier.id&&order.status!=='cancelled'&&supplierOrderDebt(order)>0).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    for(const order of orders){
        if(left<=0)break;
        const orderDebtCents=Math.round(supplierOrderDebt(order)*100);
        if(!Number.isSafeInteger(orderDebtCents)||orderDebtCents<0)return showToast('В задолженности заказа обнаружено некорректное значение','error');
        const part=Math.min(left,orderDebtCents);
        if(part>0){allocations.push({purchaseOrderId:order.id,amount:part/100});left-=part;}
    }
    if(left!==0)return showToast('Не удалось полностью распределить оплату','error');
    const record={id:'spay_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),supplierId:supplier.id,supplierNameSnapshot:supplier.name,amount,paidAt:new Date(date+'T12:00:00').toISOString(),paymentMethod:method,note:String(document.getElementById('supplierPaymentNote')?.value||'').trim().slice(0,300),allocations};
    inventorySupplierPayments.unshift(record);
    try{persistSupplierPayments();}
    catch(error){inventorySupplierPayments.shift();return showToast('Не удалось сохранить оплату. Данные не изменены','error');}
    closeModal('supplierPaymentModal');renderSuppliers();renderPurchaseOrders();showToast('Оплата поставщику сохранена','success');
}


let editingSupplierPaymentId=null;
function openSupplierPaymentAllocation(paymentId){
    if(!requireAdminAction('Изменять распределение оплат может только Али'))return;
    const payment=inventorySupplierPayments.find(item=>item.id===paymentId);if(!payment)return showToast('Платёж не найден','error');
    editingSupplierPaymentId=paymentId;
    const supplierOrders=inventoryPurchaseOrders.filter(order=>order.supplierId===payment.supplierId).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    const root=document.getElementById('supplierAllocationRows');if(!root)return;
    const fmt=value=>(Math.round((Number(value)||0)*100)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';
    root.innerHTML=supplierOrders.length?supplierOrders.map(order=>{
        const currentCents=payment.allocations.filter(item=>String(item.purchaseOrderId)===String(order.id)).reduce((sum,item)=>sum+Math.round(Number(item.amount)*100),0);
        const allocatedElsewhereCents=inventorySupplierPayments.filter(item=>item.id!==payment.id).reduce((sum,item)=>sum+item.allocations.filter(a=>String(a.purchaseOrderId)===String(order.id)).reduce((n,a)=>n+Math.round(Number(a.amount)*100),0),0);
        const receivedCents=Math.round(supplierReceivedTotal(order)*100),refundedCents=Math.round(supplierOrderRefunded(order.id)*100);
        const capacityCents=receivedCents+refundedCents-allocatedElsewhereCents;
        const maxCents=order.status==='cancelled'?currentCents:Math.max(0,capacityCents);
        const safeMax=Number.isSafeInteger(maxCents)?maxCents:currentCents;
        return '<label class="supplier-allocation-row"><span><b>Заказ № '+escapeBookingHtml(String(order.id).slice(-8))+'</b><small>'+(order.status==='cancelled'?'Отменён · текущую сумму можно сохранить':'Принято '+fmt(supplierReceivedTotal(order))+' · возвраты денег '+fmt(refundedCents/100)+' · доступно '+fmt(safeMax/100))+'</small></span><input type="number" min="0" max="'+(safeMax/100).toFixed(2)+'" step="0.01" data-order-id="'+escapeBookingHtml(order.id)+'" value="'+(currentCents/100).toFixed(2)+'" '+(order.status==='cancelled'?'readonly':'')+'></label>';
    }).join(''):'<small>Заказов поставщика не найдено</small>';
    document.getElementById('supplierAllocationTitle').textContent='Распределение оплаты · '+payment.supplierNameSnapshot;
    document.getElementById('supplierAllocationTotal').textContent='Сумма платежа: '+fmt(payment.amount);
    openModal('supplierAllocationModal');
}
function saveSupplierPaymentAllocation(){
    if(!requireAdminAction('Изменять распределение оплат может только Али'))return;
    const payment=inventorySupplierPayments.find(item=>item.id===editingSupplierPaymentId);if(!payment)return;
    const inputs=Array.from(document.querySelectorAll('#supplierAllocationRows [data-order-id]'));
    const paymentCents=Math.round(Number(payment.amount)*100);
    if(!Number.isSafeInteger(paymentCents)||paymentCents<=0)return showToast('У платежа некорректная сумма','error');
    let totalCents=0;const allocations=[],seen=new Set();
    for(const input of inputs){
        const orderId=String(input.dataset.orderId||''),order=inventoryPurchaseOrders.find(item=>String(item.id)===orderId);
        const amount=Number(input.value),cents=Math.round(amount*100);
        if(!order||order.supplierId!==payment.supplierId||seen.has(orderId)||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(cents)||Math.abs(amount*100-cents)>0.001)return showToast('Проверь суммы распределения','error');
        seen.add(orderId);
        const previousCents=payment.allocations.filter(item=>String(item.purchaseOrderId)===orderId).reduce((sum,item)=>sum+Math.round(Number(item.amount)*100),0);
        const otherPaymentsCents=inventorySupplierPayments.filter(item=>item.id!==payment.id).reduce((sum,item)=>sum+item.allocations.filter(a=>String(a.purchaseOrderId)===orderId).reduce((n,a)=>n+Math.round(Number(a.amount)*100),0),0);
        const receivedCents=Math.round(supplierReceivedTotal(order)*100),refundedCents=Math.round(supplierOrderRefunded(orderId)*100);
        const capacityCents=receivedCents+refundedCents-otherPaymentsCents;
        if(!Number.isSafeInteger(previousCents)||!Number.isSafeInteger(otherPaymentsCents)||!Number.isSafeInteger(receivedCents)||!Number.isSafeInteger(refundedCents)||!Number.isSafeInteger(capacityCents))return showToast('В финансовых данных заказа обнаружено некорректное значение','error');
        if(order.status==='cancelled'&&cents>previousCents)return showToast('Нельзя перенести дополнительную оплату на отменённый заказ','error');
        if(cents>Math.max(0,capacityCents))return showToast('По заказу № '+String(order.id).slice(-8)+' сумма превышает доступный остаток с учётом возвратов','error');
        if(cents>0){allocations.push({purchaseOrderId:orderId,amount:cents/100});totalCents+=cents;}
    }
    if(totalCents!==paymentCents)return showToast('Распределение должно точно равняться сумме платежа','error');
    const previous=payment.allocations;
    payment.allocations=allocations;
    try{persistSupplierPayments();}
    catch(error){payment.allocations=previous;return showToast('Не удалось сохранить распределение. Данные не изменены','error');}
    closeModal('supplierAllocationModal');renderSuppliers();renderPurchaseOrders();showToast('Распределение платежа обновлено','success');
}
function normalizeSupplierName(value){return String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/\\s+/g,' ');}
function findOrCreateSupplier(name){
    const clean=String(name||'').trim();if(!clean)return null;
    let supplier=inventorySuppliers.find(item=>normalizeSupplierName(item.name)===normalizeSupplierName(clean));
    if(!supplier){const now=new Date().toISOString();supplier={id:'sup_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name:clean,contactPerson:'',phone:'',email:'',address:'',notes:'',active:true,createdAt:now,updatedAt:now};inventorySuppliers.unshift(supplier);persistSuppliers();}
    return supplier;
}
let editingSupplierId=null;
function openSupplierModal(supplierId=''){
    if(!requireAdminAction('Управлять поставщиками может только Али'))return;
    const supplier=inventorySuppliers.find(item=>item.id===supplierId);editingSupplierId=supplier?.id||null;
    document.getElementById('supplierModalTitle').textContent=supplier?'Редактировать поставщика':'Новый поставщик';
    const fields={Name:'name',Contact:'contactPerson',Phone:'phone',Email:'email',Address:'address',Notes:'notes'};Object.entries(fields).forEach(([field,key])=>{const node=document.getElementById('supplier'+field);if(node)node.value=supplier?(supplier[key]||''):'';});const termNode=document.getElementById('supplierPaymentTermDays');if(termNode)termNode.value=String(supplier?.paymentTermDays??30);
    openModal('supplierModal');
}
function saveSupplier(){
    if(!requireAdminAction('Управлять поставщиками может только Али'))return;
    const name=document.getElementById('supplierName').value.trim();if(!name)return showToast('Укажи название поставщика','error');
    const duplicate=inventorySuppliers.find(item=>normalizeSupplierName(item.name)===normalizeSupplierName(name)&&item.id!==editingSupplierId);
    if(duplicate)return showToast('Поставщик с таким названием уже есть','error');
    const now=new Date().toISOString(),data={name,contactPerson:document.getElementById('supplierContact').value.trim(),phone:document.getElementById('supplierPhone').value.trim(),email:document.getElementById('supplierEmail').value.trim(),address:document.getElementById('supplierAddress').value.trim(),notes:document.getElementById('supplierNotes').value.trim(),paymentTermDays:Math.min(365,Math.max(0,Number(document.getElementById('supplierPaymentTermDays')?.value??30)||0)),updatedAt:now};
    let supplier=inventorySuppliers.find(item=>item.id===editingSupplierId);
    if(supplier)Object.assign(supplier,data);else inventorySuppliers.unshift({id:'sup_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),...data,active:true,createdAt:now});
    persistSuppliers();closeModal('supplierModal');renderSuppliers();showToast('Поставщик сохранён','success');
}

function exportSupplierStatement(supplierId){
    if(!requireAdminAction('Экспортировать ведомость поставщика может только Али'))return;
    const supplier=inventorySuppliers.find(item=>item.id===supplierId);
    if(!supplier)return showToast('Поставщик не найден','error');
    const orders=inventoryPurchaseOrders.filter(order=>order.supplierId===supplierId&&order.status!=='cancelled');
    const rows=[['Дата','Операция','Документ','Статус','Сумма документа, ₽','Оплачено, ₽','Долг, ₽','Срок оплаты','Способ оплаты','Комментарий']];
    const dateLabel=value=>{const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleDateString('ru-RU'):'';};
    const money=value=>(Math.round((Number(value)||0)*100)/100).toFixed(2).replace('.',',');
    orders.forEach(order=>{
        const received=supplierReceivedTotal(order),paid=supplierOrderPaid(order.id),due=supplierOrderDueDate(order);
        rows.push([dateLabel(supplierOrderFirstReceipt(order))||dateLabel(order.createdAt),'Приёмка / заказ',order.id,order.status,money(received),money(paid),money(Math.max(0,received-paid)),due?dateLabel(due):'','','']);
    });
    inventorySupplierPayments.filter(payment=>payment.supplierId===supplierId).forEach(payment=>{
        const allocationText=payment.allocations.map(item=>item.purchaseOrderId+': '+money(item.amount)+' ₽').join(' | ');
        rows.push([dateLabel(payment.paidAt),'Оплата',payment.id,'Проведена','',money(payment.amount),'','',payment.paymentMethod,(payment.note?payment.note+' · ':'')+allocationText]);
    });
    inventorySupplierReturns.filter(record=>record.supplierId===supplierId).forEach(record=>rows.push([dateLabel(record.returnedAt),'Возврат поставщику',record.id,'Проведён','-'+money((Number(record.quantity)||0)*(Number(record.unitCost)||0)),'','', '', '',(record.productTitle||'Товар')+' · '+(record.quantity||0)+' ед. · '+(record.reason||'')]));
    inventorySupplierRefunds.filter(record=>record.supplierId===supplierId).forEach(record=>rows.push([dateLabel(record.refundedAt),'Возврат денег от поставщика',record.id,'Получен','',money(record.amount),'','','', (record.method||'')+' · '+(record.note||'')]));
    if(rows.length===1)return showToast('Для этого поставщика пока нет операций для экспорта','info');
    const csvCell=value=>{let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    const safeName=supplier.name.replace(/[^a-z0-9а-яё_-]+/gi,'_').replace(/^_+|_+$/g,'')||'supplier';
    link.href=url;link.download='mensfire_supplier_'+safeName+'_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast('Ведомость поставщика экспортирована','success');
}


let supplierFinanceJournalFilteredEvents=[];


let supplierFinanceSummaryRows=[];
let supplierFinanceSummaryPeriod={from:'',to:''};


function getSupplierFinanceIntegrityIssues(){
    const issues=[],allocatedByOrder=new Map(),paymentIds=new Set(),refundIds=new Set(),returnIds=new Set();
    const cents=value=>{
        const number=Number(value);
        if(!Number.isFinite(number)||number<0||!Number.isSafeInteger(Math.round(number*100))||Math.abs(number*100-Math.round(number*100))>0.001)return null;
        return Math.round(number*100);
    };
    const validDate=value=>{const date=String(value||'');return /^\d{4}-\d{2}-\d{2}T/.test(date)&&!Number.isNaN(new Date(date).getTime());};
    inventorySupplierPayments.forEach(payment=>{
        if(paymentIds.has(String(payment.id)))issues.push({title:'Повторяется ID платежа',detail:'Платёж '+String(payment.id).slice(-8)});
        paymentIds.add(String(payment.id));
        const paymentCents=cents(payment.amount);
        if(!payment.id||!payment.supplierId||paymentCents===null||paymentCents<=0)issues.push({title:'Некорректные данные платежа',detail:'Платёж '+String(payment.id||'без ID').slice(-8)+' · проверь поставщика и сумму'});
        if(!inventorySuppliers.some(item=>item.id===payment.supplierId))issues.push({title:'Платёж ссылается на отсутствующего поставщика',detail:'Платёж '+String(payment.id).slice(-8)});
        if(!validDate(payment.paidAt))issues.push({title:'Некорректная дата платежа',detail:'Платёж '+String(payment.id).slice(-8)});
        const allocations=Array.isArray(payment.allocations)?payment.allocations:null;
        if(!allocations){issues.push({title:'У платежа повреждено распределение',detail:'Платёж '+String(payment.id).slice(-8)});return;}
        let allocatedCents=0;const seenOrders=new Set();
        allocations.forEach(allocation=>{
            const orderId=String(allocation?.purchaseOrderId||''),amountCents=cents(allocation?.amount);
            if(!orderId||amountCents===null||amountCents<=0){issues.push({title:'Некорректная строка распределения',detail:'Платёж '+String(payment.id).slice(-8)});return;}
            if(seenOrders.has(orderId))issues.push({title:'Заказ повторяется в распределении платежа',detail:'Платёж '+String(payment.id).slice(-8)+' · заказ '+orderId.slice(-8)});
            seenOrders.add(orderId);
            allocatedCents+=amountCents;
            const order=inventoryPurchaseOrders.find(item=>String(item.id)===orderId);
            if(!order){issues.push({title:'Платёж ссылается на отсутствующий заказ',detail:'Платёж '+String(payment.id).slice(-8)+' · заказ '+orderId});return;}
            if(order.supplierId!==payment.supplierId)issues.push({title:'Несовпадение поставщика',detail:'Платёж '+String(payment.id).slice(-8)+' привязан к заказу другого поставщика'});
            if(order.status==='cancelled')issues.push({title:'Оплата привязана к отменённому заказу',detail:'Заказ '+String(order.id).slice(-8)+' · '+(amountCents/100).toFixed(2)+' ₽'});
            allocatedByOrder.set(String(order.id),(allocatedByOrder.get(String(order.id))||0)+amountCents);
        });
        if(paymentCents!==null&&allocatedCents!==paymentCents)issues.push({title:'Платёж распределён не полностью',detail:'Платёж '+String(payment.id).slice(-8)+': сумма '+(paymentCents/100).toFixed(2)+' ₽, распределено '+(allocatedCents/100).toFixed(2)+' ₽'});
        if(!Number.isSafeInteger(allocatedCents))issues.push({title:'Переполнение суммы распределений',detail:'Платёж '+String(payment.id).slice(-8)});
    });
    const refundTotals=new Map();
    inventorySupplierRefunds.forEach(record=>{
        if(refundIds.has(String(record.id)))issues.push({title:'Повторяется ID возврата денег',detail:'Операция '+String(record.id).slice(-8)});
        refundIds.add(String(record.id));
        const amountCents=cents(record.amount),order=inventoryPurchaseOrders.find(item=>String(item.id)===String(record.orderId));
        if(!record.id||amountCents===null||amountCents<=0)issues.push({title:'Некорректная сумма возврата денег',detail:'Операция '+String(record.id||'без ID').slice(-8)});
        if(!validDate(record.refundedAt))issues.push({title:'Некорректная дата возврата денег',detail:'Операция '+String(record.id).slice(-8)});
        if(!order){issues.push({title:'Возврат денег ссылается на отсутствующий заказ',detail:'Операция '+String(record.id).slice(-8)});return;}
        if(order.supplierId!==record.supplierId)issues.push({title:'Несовпадение поставщика в возврате денег',detail:'Операция '+String(record.id).slice(-8)});
        if(amountCents!==null)refundTotalsSet(record.orderId,amountCents);
    });
    function refundTotalsSet(orderId,amountCents){refundTotals.set(String(orderId),(refundTotals.get(String(orderId))||0)+amountCents);}
    inventorySupplierReturns.forEach(record=>{
        if(returnIds.has(String(record.id)))issues.push({title:'Повторяется ID возврата товара',detail:'Возврат '+String(record.id).slice(-8)});
        returnIds.add(String(record.id));
        const order=inventoryPurchaseOrders.find(item=>String(item.id)===String(record.orderId)),itemIndex=Number(record.itemIndex),line=order?.items?.[itemIndex];
        const quantity=Number(record.quantity),unitCost=Number(record.unitCost);
        if(!record.id||!Number.isSafeInteger(itemIndex)||itemIndex<0||!Number.isSafeInteger(quantity)||quantity<=0||!Number.isFinite(unitCost)||unitCost<0)issues.push({title:'Некорректные данные возврата товара',detail:'Возврат '+String(record.id).slice(-8)});
        if(!validDate(record.returnedAt))issues.push({title:'Некорректная дата возврата товара',detail:'Возврат '+String(record.id).slice(-8)});
        if(!order||!line){issues.push({title:'Возврат ссылается на отсутствующую позицию',detail:'Возврат '+String(record.id).slice(-8)});return;}
        if(order.supplierId!==record.supplierId)issues.push({title:'Несовпадение поставщика в возврате',detail:'Возврат '+String(record.id).slice(-8)});
        const batches=Array.isArray(line.receivedBatches)?line.receivedBatches:[];
        const batchIndex=Number(record.batchIndex??-1);
        if(!Number.isSafeInteger(batchIndex)||batchIndex< -1||(batchIndex===-1&&batches.length)||(batchIndex>=0&&!batches[batchIndex]))issues.push({title:'Некорректная ссылка на партию возврата',detail:'Возврат '+String(record.id).slice(-8)});
        const gross=batchIndex>=0?Number(batches[batchIndex]?.quantity)||0:Number(line.receivedQuantity)||0;
        const batchCost=Number(batchIndex>=0?batches[batchIndex]?.unitCost:line.unitCost);
        const returned=supplierReturnedQuantity(order.id,itemIndex,batchIndex);
        if(returned>gross)issues.push({title:'Возврат превышает принятую партию',detail:'Заказ '+String(order.id).slice(-8)+' · '+(line.titleSnapshot||'Товар')});
        if(!Number.isFinite(batchCost)||Math.abs(batchCost-unitCost)>0.001)issues.push({title:'Цена возврата не совпадает с партией',detail:'Возврат '+String(record.id).slice(-8)+' · цена возврата '+(Number.isFinite(unitCost)?unitCost.toFixed(2):'—')+' ₽, цена партии '+(Number.isFinite(batchCost)?batchCost.toFixed(2):'—')+' ₽'});
        const product=inventoryProducts.find(item=>item.id===record.productId);
        if(!product||product.id!==line.productId)issues.push({title:'Возврат связан с неверным товаром',detail:'Возврат '+String(record.id).slice(-8)+' · заказ '+String(order.id).slice(-8)});
        const linkedMovements=inventoryMovements.filter(movement=>movement.supplierReturnId===record.id);
        if(linkedMovements.length!==1)issues.push({title:'Нет единственного складского движения возврата',detail:'Возврат '+String(record.id).slice(-8)+' · найдено движений: '+linkedMovements.length});
        else{
            const movement=linkedMovements[0],movementQty=Number(movement.quantity),movementCost=Number(movement.totalCost);
            if(movement.type!=='supplier_return'||movement.productId!==record.productId||String(movement.purchaseOrderId||'')!==String(record.orderId)||!Number.isFinite(movementQty)||Math.abs(movementQty+quantity)>0.001||!Number.isFinite(movementCost)||Math.abs(movementCost+quantity*unitCost)>0.01)
                issues.push({title:'Складское движение не совпадает с возвратом',detail:'Возврат '+String(record.id).slice(-8)+' · проверь заказ, товар, количество и сумму'});
        }
    });
    inventoryMovements.filter(move=>move.type==='supplier_return'&&!inventorySupplierReturns.some(record=>String(record.id)===String(move.supplierReturnId||''))).forEach(move=>{
        issues.push({title:'Складской возврат не связан с операцией поставщику',detail:'Движение '+String(move.id||'').slice(-8)+' · проверь журнал возвратов'});
    });
    const purchaseOrderIds=new Set(inventoryPurchaseOrders.map(order=>String(order.id)));
    inventoryMovements.filter(move=>move.type==='receipt'&&move.purchaseOrderId).forEach(move=>{
        if(!purchaseOrderIds.has(String(move.purchaseOrderId)))issues.push({title:'Приход склада ссылается на отсутствующий заказ',detail:'Движение '+String(move.id||'').slice(-8)+' · заказ '+String(move.purchaseOrderId).slice(-8)});
    });
    inventoryPurchaseOrders.forEach(order=>{
        const orderReceipts=inventoryMovements.filter(move=>move.type==='receipt'&&String(move.purchaseOrderId||'')===String(order.id));
        const ledgerQty=orderReceipts.reduce((sum,move)=>sum+(Number(move.quantity)||0),0);
        const expectedQty=(order.items||[]).reduce((sum,line)=>sum+(Number(line.receivedQuantity)||0),0);
        const ledgerValue=orderReceipts.reduce((sum,move)=>{
            const value=Number(move.totalCost);
            const unitCost=Number(move.unitCost);
            return sum+(Number.isFinite(value)&&value>=0?value:(Number(move.quantity)||0)*(Number.isFinite(unitCost)&&unitCost>=0?unitCost:0));
        },0);
        const expectedValue=supplierOrderGrossReceivedTotal(order);
        if(Math.abs(ledgerQty-expectedQty)>0.001)issues.push({title:'Приёмка не совпадает с приходами склада',detail:'Заказ '+String(order.id).slice(-8)+' · принято '+expectedQty+' ед., в журнале '+ledgerQty+' ед.'});
        if(Math.abs(ledgerValue-expectedValue)>0.01)issues.push({title:'Стоимость приёмки не совпадает с журналом склада',detail:'Заказ '+String(order.id).slice(-8)+' · по партиям '+expectedValue.toFixed(2)+' ₽, по движениям '+ledgerValue.toFixed(2)+' ₽'});
        if(order.status==='cancelled'&&(expectedQty>0||orderReceipts.length))issues.push({title:'Отменённый заказ содержит принятую поставку',detail:'Заказ '+String(order.id).slice(-8)+' · движений прихода: '+orderReceipts.length});
    });
    inventoryPurchaseOrders.forEach(order=>{
        const allocatedCents=allocatedByOrder.get(String(order.id))||0,receivedGross=Number(supplierOrderGrossReceivedTotal(order));
        const grossCents=cents(receivedGross);
        if(grossCents===null)issues.push({title:'Некорректная стоимость приёмки',detail:'Заказ '+String(order.id).slice(-8)});
        else if(order.status!=='cancelled'&&allocatedCents>grossCents)issues.push({title:'Распределено больше стоимости приёмки',detail:'Заказ '+String(order.id).slice(-8)+' · принято '+(grossCents/100).toFixed(2)+' ₽, распределено '+(allocatedCents/100).toFixed(2)+' ₽'});
        const refundCents=refundTotals.get(String(order.id))||0,netReceived=cents(supplierReceivedTotal(order));
        if(netReceived===null)issues.push({title:'Некорректная чистая стоимость заказа',detail:'Заказ '+String(order.id).slice(-8)});
        else{
            const available=Math.max(0,allocatedCents-netReceived);
            if(refundCents>available)issues.push({title:'Возврат денег превышает кредит поставщика',detail:'Заказ '+String(order.id).slice(-8)+' · возвраты '+(refundCents/100).toFixed(2)+' ₽, доступно '+(available/100).toFixed(2)+' ₽'});
        }
        (order.items||[]).forEach(item=>{
            if(Array.isArray(item.receivedBatches)&&item.receivedBatches.length){
                const batchQty=item.receivedBatches.reduce((sum,batch)=>sum+(Number(batch.quantity)||0),0);
                if(Math.abs(batchQty-(Number(item.receivedQuantity)||0))>0.001)issues.push({title:'Количество партий не совпадает с приёмкой',detail:(item.titleSnapshot||'Товар')+' · заказ '+String(order.id).slice(-8)});
            }
        });
    });
    return issues;
}

function renderSupplierFinanceSummary(events,from,to){
    const root=document.getElementById('supplierFinanceSummary');if(!root)return;
    const validDay=value=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date.toISOString().slice(0,10):'';};
    const suppliers=new Map();
    (Array.isArray(events)?events:[]).forEach(event=>{
        const id=event.supplierId||'unknown';
        if(!suppliers.has(id))suppliers.set(id,{name:event.supplierName||'Поставщик',opening:0,receipts:0,payments:0,returns:0,refunds:0,receiptCount:0,paymentCount:0,returnCount:0,refundCount:0});
        const row=suppliers.get(id),day=validDay(event.date),amount=Math.max(0,Number(event.amount)||0);
        if(from&&day&&day<from){row.opening+=(event.kind==='payment'||event.kind==='return')?-amount:amount;return;}
        if(from&&(!day||day<from))return;
        if(to&&(!day||day>to))return;
        if(event.kind==='payment'){row.payments+=amount;row.paymentCount++;}
        else if(event.kind==='return'){row.returns+=amount;row.returnCount++;}
        else if(event.kind==='refund'){row.refunds+=amount;row.refundCount++;}
        else{row.receipts+=amount;row.receiptCount++;}
    });
    const rows=[...suppliers.values()].map(row=>{const closing=row.opening+row.receipts-row.payments-row.returns+row.refunds;return {...row,closing,debt:Math.max(0,closing),credit:Math.max(0,-closing),change:row.receipts-row.payments-row.returns+row.refunds};})
        .sort((a,b)=>b.closing-a.closing||a.name.localeCompare(b.name,'ru'));
    supplierFinanceSummaryRows=rows;
    supplierFinanceSummaryPeriod={from:from||'',to:to||''};
    const fmt=value=>Math.round((Number(value)||0)*100/100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
    const totals=rows.reduce((acc,row)=>{acc.opening+=row.opening;acc.receipts+=row.receipts;acc.payments+=row.payments;acc.returns+=row.returns;acc.refunds+=row.refunds;acc.closing+=row.closing;acc.debt+=row.debt;acc.credit+=row.credit;return acc;},{opening:0,receipts:0,payments:0,returns:0,refunds:0,closing:0,debt:0,credit:0});
    const period=(from||to)?((from?new Date(from+'T00:00:00').toLocaleDateString('ru-RU'):'С начала')+' — '+(to?new Date(to+'T00:00:00').toLocaleDateString('ru-RU'):'по сегодня')):'За всё время';
    const integrityIssues=getSupplierFinanceIntegrityIssues();
    root.innerHTML='<div class="supplier-summary-heading"><div><strong>Сводка по поставщикам</strong><small>'+period+' · начальный долг рассчитан по операциям до начала периода</small></div><div class="supplier-summary-actions"><span>'+rows.length+' поставщиков</span><button type="button" class="inventory-sync-btn" onclick="exportSupplierFinanceSummary()">Экспорт CSV</button></div></div>'+
        '<div class="supplier-summary-totals"><div><small>Долг на начало</small><b>'+fmt(Math.max(0,totals.opening))+'</b></div><div><small>Приёмки за период</small><b>'+fmt(totals.receipts)+'</b></div><div><small>Оплаты за период</small><b>'+fmt(totals.payments)+'</b></div><div><small>Возвраты поставщику</small><b>'+fmt(totals.returns)+'</b></div><div><small>Деньги от поставщика</small><b>'+fmt(totals.refunds)+'</b></div><div><small>Долг на конец</small><b>'+fmt(totals.debt)+'</b></div><div><small>Переплата на конец</small><b>'+fmt(totals.credit)+'</b></div></div>'+
        (rows.length?'<div class="supplier-summary-table-wrap"><table class="supplier-summary-table"><thead><tr><th>Поставщик</th><th>На начало</th><th>Приёмки</th><th>Оплаты</th><th>Возвраты</th><th>Возврат денег</th><th>Долг</th><th>Переплата</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+escapeBookingHtml(row.name)+'<small>'+row.receiptCount+' приёмок · '+row.paymentCount+' оплат</small></td><td>'+fmt(row.opening)+'</td><td>'+fmt(row.receipts)+'</td><td>'+fmt(row.payments)+'</td><td>'+fmt(row.returns)+'</td><td>'+fmt(row.refunds)+'</td><td><b>'+fmt(row.debt)+'</b></td><td><b>'+fmt(row.credit)+'</b></td></tr>').join('')+'</tbody></table></div>':'<div class="inventory-empty compact">Нет финансовых операций за выбранный период</div>')+'<div class="supplier-integrity-check '+(integrityIssues.length?'has-issues':'is-clean')+'"><strong>'+(integrityIssues.length?'Найдены несоответствия: '+integrityIssues.length:'Проверка распределения оплат пройдена')+'</strong>'+(integrityIssues.length?'<ul>'+integrityIssues.map(issue=>'<li><b>'+escapeBookingHtml(issue.title)+'</b><small>'+escapeBookingHtml(issue.detail)+'</small></li>').join('')+'</ul>':'<small>Проверены суммы платежей, привязка к заказам и соответствие партий приёмки</small>')+'</div>';
}


function exportSupplierFinanceSummary(){
    if(!requireAdminAction('Экспортировать финансовую сводку поставщиков может только Али'))return;
    const rows=Array.isArray(supplierFinanceSummaryRows)?supplierFinanceSummaryRows:[];
    if(!rows.length)return showToast('Нет данных для экспорта','info');
    const columns=['Поставщик','Долг на начало, ₽','Приёмки за период, ₽','Оплаты за период, ₽','Возвраты поставщику, ₽','Возврат денег, ₽','Изменение долга, ₽','Долг на конец, ₽','Переплата на конец, ₽','Количество приёмок','Количество оплат'];
    const money=value=>(Number(value)||0).toFixed(2).replace('.',',');
    const cell=value=>{let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return /[\",;\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
    const data=rows.map(row=>[row.name,money(Math.max(0,row.opening)),money(row.receipts),money(row.payments),money(row.returns),money(row.refunds),money(row.change),money(row.debt),money(row.credit),row.receiptCount,row.paymentCount]);
    const total=rows.reduce((acc,row)=>{acc.opening+=Math.max(0,row.opening);acc.receipts+=row.receipts;acc.payments+=row.payments;acc.returns+=row.returns;acc.refunds+=row.refunds;acc.change+=row.change;acc.debt+=row.debt;acc.credit+=row.credit;acc.receiptCount+=row.receiptCount;acc.paymentCount+=row.paymentCount;return acc;},{opening:0,receipts:0,payments:0,returns:0,refunds:0,change:0,debt:0,credit:0,receiptCount:0,paymentCount:0});
    data.push(['ИТОГО',money(total.opening),money(total.receipts),money(total.payments),money(total.returns),money(total.refunds),money(total.change),money(total.debt),money(total.credit),total.receiptCount,total.paymentCount]);
    const period=supplierFinanceSummaryPeriod||{};
    const csv='\\uFEFF'+[columns,...data].map(row=>row.map(cell).join(';')).join('\\r\\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    const suffix=(period.from||'start')+'_'+(period.to||'today');
    link.href=url;link.download='mensfire-supplier-summary-'+suffix+'.csv';
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    showToast('Финансовая сводка экспортирована в CSV','success');
}

function renderSupplierFinanceJournal(){
    const root=document.getElementById('supplierFinanceJournal');if(!root)return;
    const supplierFilter=document.getElementById('supplierJournalSupplier')?.value||'all';
    const typeFilter=document.getElementById('supplierJournalType')?.value||'all';
    const from=document.getElementById('supplierJournalFrom')?.value||'';
    const to=document.getElementById('supplierJournalTo')?.value||'';
    const suppliers=[...inventorySuppliers].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    const supplierSelect=document.getElementById('supplierJournalSupplier');
    if(supplierSelect){
        const current=supplierSelect.value||'all';
        supplierSelect.innerHTML='<option value="all">Все поставщики</option>'+suppliers.map(item=>'<option value="'+escapeBookingHtml(item.id)+'">'+escapeBookingHtml(item.name)+'</option>').join('');
        supplierSelect.value=suppliers.some(item=>item.id===current)?current:'all';
    }
    const events=[];
    inventorySupplierPayments.forEach(payment=>{
        const supplier=inventorySuppliers.find(item=>item.id===payment.supplierId);
        events.push({kind:'payment',date:payment.paidAt,supplierId:payment.supplierId,supplierName:supplier?.name||payment.supplierNameSnapshot||'Поставщик',amount:Number(payment.amount)||0,method:payment.paymentMethod||'Перевод',note:payment.note||'',id:payment.id,allocations:payment.allocations||[]});
    });
    inventoryPurchaseOrders.forEach(order=>{
        const supplier=inventorySuppliers.find(item=>item.id===order.supplierId);
        if(order.status==='cancelled')return;
        (order.items||[]).forEach(item=>{
            const batches=Array.isArray(item.receivedBatches)?item.receivedBatches:[];
            if(batches.length){
                batches.forEach((batch,index)=>{
                    const amount=(Number(batch.quantity)||0)*(Number(batch.unitCost)||0);
                    if(amount>0)events.push({kind:'receipt',date:batch.receivedAt||order.updatedAt||order.createdAt,supplierId:order.supplierId,supplierName:supplier?.name||order.supplier||'Поставщик',amount,item:item.titleSnapshot||'Товар',quantity:Number(batch.quantity)||0,orderId:order.id});
                });
            }else if((Number(item.receivedQuantity)||0)>0){
                const amount=(Number(item.receivedQuantity)||0)*(Number(item.unitCost)||0);
                if(amount>0)events.push({kind:'receipt',date:order.updatedAt||order.createdAt,supplierId:order.supplierId,supplierName:supplier?.name||order.supplier||'Поставщик',amount,item:item.titleSnapshot||'Товар',quantity:Number(item.receivedQuantity)||0,orderId:order.id});
            }
        });
    });
    inventorySupplierRefunds.forEach(record=>{events.push({kind:'refund',date:record.refundedAt,supplierId:record.supplierId,supplierName:inventorySuppliers.find(item=>item.id===record.supplierId)?.name||record.supplierNameSnapshot||'Поставщик',amount:Number(record.amount)||0,item:'Возврат денег',quantity:'',orderId:record.orderId,note:record.note||'',method:record.method||'Перевод',id:record.id});});
    inventorySupplierReturns.forEach(record=>{const order=inventoryPurchaseOrders.find(item=>item.id===record.orderId);const supplier=inventorySuppliers.find(item=>item.id===record.supplierId);events.push({kind:'return',date:record.returnedAt,supplierId:record.supplierId,supplierName:supplier?.name||record.supplierNameSnapshot||'Поставщик',amount:(Number(record.quantity)||0)*(Number(record.unitCost)||0),item:record.productTitle||'Товар',quantity:Number(record.quantity)||0,orderId:record.orderId,note:record.reason||'',id:record.id});});
    const filtered=events.filter(event=>{
        const parsedDate=event.date?new Date(event.date):null;const day=parsedDate&&!Number.isNaN(parsedDate.getTime())?parsedDate.toISOString().slice(0,10):'';
        return (supplierFilter==='all'||event.supplierId===supplierFilter)&&(typeFilter==='all'||event.kind===typeFilter)&&(!from||day>=from)&&(!to||day<=to);
    }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    renderSupplierFinanceSummary(events,from,to);
    supplierFinanceJournalFilteredEvents=filtered;
    const total=filtered.reduce((sum,event)=>sum+(event.kind==='payment'||event.kind==='return'?-event.amount:event.amount),0);
    const fmt=value=>Math.round(value*100/100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
    const dateLabel=value=>{const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleDateString('ru-RU'):'Дата не указана';};
    const summary=document.getElementById('supplierJournalSummary');
    if(summary)summary.textContent=filtered.length+' операций · '+(total>=0?'поступления ':'списания ')+fmt(Math.abs(total))+' (приёмки и возвраты денег минус оплаты и возвраты товара)';
    root.innerHTML=filtered.length?filtered.map(event=>{
        const isPayment=event.kind==='payment',isReturn=event.kind==='return',isRefund=event.kind==='refund';
        const detail=isPayment?(event.allocations.length?event.allocations.map(allocation=>'Заказ № '+escapeBookingHtml(String(allocation.purchaseOrderId).slice(-8))+' — '+fmt(allocation.amount)).join(' · '):'Распределение не указано'):isRefund?'Заказ № '+escapeBookingHtml(String(event.orderId).slice(-8)):(escapeBookingHtml(event.item)+' · '+event.quantity+' ед. · заказ № '+escapeBookingHtml(String(event.orderId).slice(-8)));
        return '<article class="supplier-journal-row"><div class="supplier-journal-main"><span class="supplier-journal-kind '+(isPayment||isReturn?'is-payment':'is-receipt')+'">'+(isPayment?'Оплата':isReturn?'Возврат поставщику':isRefund?'Возврат денег от поставщика':'Приёмка')+'</span><b>'+escapeBookingHtml(event.supplierName)+'</b><small>'+dateLabel(event.date)+' · '+(isPayment||isRefund?escapeBookingHtml(event.method):isReturn?'Возврат товара':'Поступление товара')+'</small></div><strong class="'+(isPayment||isReturn?'is-payment':'is-receipt')+'">'+(isPayment||isReturn?'−':'+')+fmt(event.amount)+'</strong><small class="supplier-journal-detail">'+detail+(event.note?' · '+escapeBookingHtml(event.note):'')+'</small></article>';
    }).join(''):'<div class="inventory-empty compact">Операций по выбранным фильтрам нет</div>';
}

function exportSupplierFinanceJournal(){
    if(!requireAdminAction('Экспортировать журнал финансовых операций может только Али'))return;
    const events=Array.isArray(supplierFinanceJournalFilteredEvents)?supplierFinanceJournalFilteredEvents:[];
    if(!events.length)return showToast('Нет операций для экспорта','info');
    const columns=['Дата','Тип операции','Поставщик','Товар','Количество','Заказ','Сумма, ₽','Способ оплаты','Комментарий','Распределение оплат'];
    const cell=value=>{let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return /[\",;\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
    const rows=events.map(event=>[
        event.date?new Date(event.date).toLocaleString('ru-RU'):'',
        event.kind==='payment'?'Оплата':event.kind==='return'?'Возврат поставщику':event.kind==='refund'?'Возврат денег от поставщика':'Приёмка',
        event.supplierName||'',
        event.item||'',
        event.quantity??'',
        event.orderId||'',
        (Number(event.amount)||0).toFixed(2).replace('.',','),
        event.method||'',
        event.note||'',
        (event.allocations||[]).map(item=>(item.purchaseOrderId||'')+': '+(Number(item.amount)||0).toFixed(2)).join(' | ')
    ]);
    const csv='\\uFEFF'+[columns,...rows].map(row=>row.map(cell).join(';')).join('\\r\\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='mensfire-supplier-finance-journal-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    showToast('Журнал операций экспортирован в CSV','success');
}

function filterSupplierFinanceJournal(){renderSupplierFinanceJournal();}

function renderSuppliers(){
    const root=document.getElementById('suppliersList');if(!root)return;
    const query=String(document.getElementById('suppliersSearch')?.value||'').trim().toLocaleLowerCase('ru-RU');
    const ordersBySupplier=new Map();
    inventoryPurchaseOrders.forEach(order=>{
        let supplier=inventorySuppliers.find(item=>item.id===order.supplierId);
        if(!supplier&&order.supplier)supplier=findOrCreateSupplier(order.supplier);
        if(supplier){order.supplierId=supplier.id;ordersBySupplier.set(supplier.id,[...(ordersBySupplier.get(supplier.id)||[]),order]);}
    });
    persistPurchaseOrders();
    const visible=inventorySuppliers.filter(item=>!query||[item.name,item.contactPerson,item.phone,item.email].some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(query)));
    const active=inventorySuppliers.filter(item=>item.active).length;
    const totalOrders=inventoryPurchaseOrders.length;
    const totalValue=inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.items.reduce((n,line)=>n+line.quantity*line.unitCost,0),0);
    const fmt=v=>Math.round(v).toLocaleString('ru-RU')+' ₽';
    const now=Date.now();
    const debtOrders=inventoryPurchaseOrders.filter(order=>order.status!=='cancelled'&&supplierOrderDebt(order)>0);
    const outstanding=debtOrders.reduce((sum,order)=>sum+supplierOrderDebt(order),0);
    const overdue=debtOrders.reduce((sum,order)=>sum+supplierOrderOverdue(order,now),0);
    const overview=document.getElementById('suppliersOverview');
    if(overview)overview.innerHTML='<div class="inventory-kpi"><span>Поставщиков</span><strong>'+active+'</strong></div><div class="inventory-kpi"><span>Заказов</span><strong>'+totalOrders+'</strong></div><div class="inventory-kpi"><span>Сумма заказов</span><strong>'+Math.round(totalValue).toLocaleString('ru-RU')+' ₽</strong></div><div class="inventory-kpi"><span>Текущая задолженность</span><strong>'+fmt(outstanding)+'</strong><small>За фактически принятый товар</small></div><div class="inventory-kpi '+(overdue?'is-warning':'')+'"><span>Просрочено по срокам оплаты</span><strong>'+fmt(overdue)+'</strong><small>По условиям поставщиков</small></div>';
    root.innerHTML=visible.length?visible.map(supplier=>{
        const orders=(ordersBySupplier.get(supplier.id)||[]).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        const value=orders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.items.reduce((n,line)=>n+line.quantity*line.unitCost,0),0);
        const activeOrders=orders.filter(order=>order.status!=='cancelled');
        const received=activeOrders.reduce((sum,order)=>sum+order.items.reduce((n,line)=>n+(Number(line.receivedQuantity)||0),0),0);
        const receivedValue=activeOrders.reduce((n,o)=>n+supplierReceivedTotal(o),0),paidValue=activeOrders.reduce((n,o)=>n+supplierOrderPaid(o.id),0),debtValue=activeOrders.reduce((n,o)=>n+supplierOrderDebt(o),0),creditValue=activeOrders.reduce((n,o)=>n+supplierOrderCredit(o),0),payments=inventorySupplierPayments.filter(p=>p.supplierId===supplier.id).sort((a,b)=>new Date(b.paidAt)-new Date(a.paidAt));
        const outstandingOrders=orders.filter(order=>order.status!=='cancelled'&&supplierOrderDebt(order)>0).map(order=>{
            const due=supplierOrderDueDate(order),daysLeft=due?Math.ceil((due.getTime()-Date.now())/86400000):null;
            return {order,debt:supplierOrderDebt(order),due,daysLeft,overdue:supplierOrderOverdue(order)};
        }).sort((a,b)=>(b.overdue-a.overdue)||((a.due?.getTime()||Infinity)-(b.due?.getTime()||Infinity)));
        const oldestDebt=outstandingOrders[0];
        const latest=orders[0];
        return '<article class="supplier-card"><div class="supplier-card-top"><div><span class="purchase-order-status '+(supplier.active?'status-received':'status-cancelled')+'">'+(supplier.active?'Активен':'Архив')+'</span><h3>'+escapeBookingHtml(supplier.name)+'</h3><small>'+orders.length+' заказов · '+received+' ед. принято · '+fmt(value)+'</small></div><button type="button" class="inventory-sync-btn" onclick="openSupplierModal(\''+supplier.id+'\')">Изменить</button><button type="button" class="inventory-sync-btn" onclick="exportSupplierStatement(\''+supplier.id+'\')">Ведомость CSV</button></div><div class="supplier-balance-grid"><div><small>Принято на</small><b>'+fmt(receivedValue)+'</b></div><div><small>Оплачено</small><b>'+fmt(paidValue)+'</b></div><div><small>Долг</small><b>'+fmt(debtValue)+'</b></div><div><small>Переплата</small><b>'+fmt(creditValue)+'</b></div></div>'+(oldestDebt?'<div class="supplier-debt-age '+(oldestDebt.overdue?'is-warning':'')+'"><span>'+(oldestDebt.overdue?'Просроченная задолженность':'Ближайший срок оплаты')+'</span><strong>'+fmt(oldestDebt.debt)+'</strong><small>'+(oldestDebt.due?'Срок: '+oldestDebt.due.toLocaleDateString('ru-RU')+(oldestDebt.overdue?' · просрочено на '+Math.abs(oldestDebt.daysLeft)+' дн.':oldestDebt.daysLeft===0?' · срок сегодня':' · осталось '+oldestDebt.daysLeft+' дн.'):'Срок не определён')+' · заказ № '+escapeBookingHtml(oldestDebt.order.id.slice(-8))+'</small></div>':'')+'<button type="button" class="inventory-sync-btn supplier-payment-action" '+(debtValue<=0?'disabled':'')+' onclick="openSupplierPayment(&quot;'+supplier.id+'&quot;)">＋ Внести оплату</button><div class="supplier-payment-history"><strong>Последние оплаты</strong>'+(payments.length?payments.slice(0,4).map(p=>'<div><span>'+new Date(p.paidAt).toLocaleDateString('ru-RU')+' · '+escapeBookingHtml(p.paymentMethod)+'</span><b>'+fmt(p.amount)+'</b></div>').join(''):'<small>Оплат пока нет</small>')+'</div><details class="supplier-finance-details"><summary>Полная сверка · '+orders.length+' заказов · '+payments.length+' оплат</summary><div class="supplier-reconciliation"><strong>Сверка по заказам</strong>'+(orders.length?orders.map(order=>{const accepted=supplierReceivedTotal(order),paid=supplierOrderPaid(order.id),balance=supplierOrderDebt(order),due=supplierOrderDueDate(order),cancelled=order.status==='cancelled';return '<div class="supplier-reconciliation-row"><div><b>Заказ № '+escapeBookingHtml(order.id.slice(-8))+'</b><small>'+new Date(order.createdAt).toLocaleDateString('ru-RU')+' · '+(cancelled?'Отменён':'Принято '+fmt(accepted))+'</small></div><span>Оплачено <b>'+fmt(paid)+'</b></span><span>Остаток <b>'+fmt(cancelled?0:balance)+'</b></span><small>'+(due?'Срок оплаты: '+due.toLocaleDateString('ru-RU'):'Срок не определён')+'</small></div>';}).join(''):'<small>Заказов пока нет</small>')+'</div><div class="supplier-full-payment-history"><strong>Все платежи и распределение</strong>'+(payments.length?payments.map(p=>'<div class="supplier-payment-record"><div><b>'+fmt(p.amount)+'</b><small>'+new Date(p.paidAt).toLocaleDateString('ru-RU')+' · '+escapeBookingHtml(p.paymentMethod)+(p.note?' · '+escapeBookingHtml(p.note):'')+'</small></div><small>'+(p.allocations.length?p.allocations.map(a=>{const order=orders.find(o=>o.id===a.purchaseOrderId);return 'Заказ № '+escapeBookingHtml(order?order.id.slice(-8):a.purchaseOrderId)+' — '+fmt(a.amount);}).join('<br>'):'Распределение не указано')+'</small><button type="button" class="inventory-sync-btn supplier-allocation-edit" onclick="openSupplierPaymentAllocation(&quot;'+p.id+'&quot;)">Изменить распределение</button></div>').join(''):'<small>Оплат пока нет</small>')+'</div></details><div class="supplier-contacts">'+(supplier.contactPerson?'<span>Контакт: '+escapeBookingHtml(supplier.contactPerson)+'</span>':'')+(supplier.phone?'<span>Телефон: '+escapeBookingHtml(supplier.phone)+'</span>':'')+(supplier.email?'<span>'+escapeBookingHtml(supplier.email)+'</span>':'')+(supplier.address?'<span>'+escapeBookingHtml(supplier.address)+'</span>':'')+'</div>'+(supplier.notes?'<p class="purchase-order-note">'+escapeBookingHtml(supplier.notes)+'</p>':'')+'<div class="supplier-order-history"><strong>Последние закупки</strong>'+(orders.length?orders.slice(0,3).map(order=>'<div><span>№ '+escapeBookingHtml(order.id.slice(-8))+' · '+new Date(order.createdAt).toLocaleDateString('ru-RU')+'</span><b>'+fmt(order.items.reduce((sum,line)=>sum+line.quantity*line.unitCost,0))+'</b></div>').join(''):'<small>Закупок пока нет</small>')+'</div>'+(latest?'<small class="supplier-last-order">Последний заказ: '+new Date(latest.createdAt).toLocaleDateString('ru-RU')+'</small>':'')+'</article>';
    }).join(''):'<div class="inventory-empty">'+(query?'Поставщики не найдены':'Пока нет поставщиков. Добавь первого поставщика.')+'</div>';
    renderSupplierFinanceJournal();
}
let inventoryPurchaseOrders = (() => {
    try {
        const saved=JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_purchase_orders'))||'[]');
        return Array.isArray(saved)?saved.filter(order=>order&&order.id).map(order=>({
            id:String(order.id),supplier:String(order.supplier||''),supplierId:String(order.supplierId||''),createdAt:String(order.createdAt||''),
            expectedAt:String(order.expectedAt||''),note:String(order.note||''),
            status:['draft','ordered','partial','received','cancelled'].includes(order.status)?order.status:'draft',
            items:(Array.isArray(order.items)?order.items:[]).map(item=>({
                productId:String(item.productId||''),titleSnapshot:String(item.titleSnapshot||'Товар'),
                quantity:Math.max(1,Number(item.quantity)||1),receivedQuantity:Math.max(0,Number(item.receivedQuantity)||0),
                unitCost:Math.max(0,Number(item.unitCost)||0),
                receivedBatches:(Array.isArray(item.receivedBatches)?item.receivedBatches:[]).filter(batch=>batch&&typeof batch==='object').map(batch=>({quantity:Math.max(0,Number(batch.quantity)||0),unitCost:Math.max(0,Number(batch.unitCost)||0),receivedAt:String(batch.receivedAt||'')}))
            }))
        })): [];
    }catch(error){console.warn('Не удалось загрузить заказы поставщикам:',error);return [];}
})();
function persistPurchaseOrders(){localStorage.setItem(appStorageKey('mensfire_inventory_purchase_orders'),JSON.stringify(inventoryPurchaseOrders));}
let purchaseOrderDraft=[];
let activeReceivingOrderId=null;
function renderPurchaseOrderDraft(){
    const root=document.getElementById('purchaseOrderDraftRows');if(!root)return;
    root.innerHTML=purchaseOrderDraft.length?purchaseOrderDraft.map((row,index)=>{
        const product=inventoryProducts.find(item=>item.id===row.productId);
        return '<div class="purchase-draft-row"><div><strong>'+escapeBookingHtml(product?.title||'Товар не найден')+'</strong><small>'+escapeBookingHtml(product?.sku||'')+'</small></div><span>'+row.quantity+' × '+Number(row.unitCost).toLocaleString('ru-RU')+' ₽</span><button type="button" onclick="removePurchaseDraftItem('+index+')" aria-label="Убрать товар">×</button></div>';
    }).join(''):'<div class="inventory-empty compact">Добавь товары в заказ</div>';
    const total=purchaseOrderDraft.reduce((sum,row)=>sum+row.quantity*row.unitCost,0);
    const totalNode=document.getElementById('purchaseOrderDraftTotal');if(totalNode)totalNode.textContent=Math.round(total).toLocaleString('ru-RU')+' ₽';
}
function addPurchaseDraftItem(){
    const productId=document.getElementById('purchaseOrderProduct')?.value||'';
    const quantity=Number(document.getElementById('purchaseOrderQuantity')?.value);
    const unitCost=Number(document.getElementById('purchaseOrderUnitCost')?.value);
    const product=inventoryProducts.find(item=>item.id===productId&&item.active);
    if(!product||!Number.isInteger(quantity)||quantity<=0||!Number.isFinite(unitCost)||unitCost<0)return showToast('Проверь товар, количество и закупочную цену','error');
    const existing=purchaseOrderDraft.find(row=>row.productId===productId);
    if(existing){existing.quantity+=quantity;existing.unitCost=unitCost;}else purchaseOrderDraft.push({productId,quantity,unitCost});
    document.getElementById('purchaseOrderQuantity').value='1';renderPurchaseOrderDraft();
}
function removePurchaseDraftItem(index){purchaseOrderDraft.splice(index,1);renderPurchaseOrderDraft();}
function openPurchaseOrderModal(){
    if(!requireAdminAction('Создавать заказы поставщикам может только Али'))return;
    purchaseOrderDraft=[];
    const supplier=document.getElementById('purchaseOrderSupplier');if(supplier)supplier.value='';
    const expected=document.getElementById('purchaseOrderExpected');if(expected)expected.value='';
    const note=document.getElementById('purchaseOrderNote');if(note)note.value='';
    const product=document.getElementById('purchaseOrderProduct');
    if(product)product.innerHTML='<option value="">Выбери товар</option>'+inventoryProducts.filter(item=>item.active).map(item=>'<option value="'+escapeBookingHtml(item.id)+'">'+escapeBookingHtml(item.title)+' · остаток '+item.stock+'</option>').join('');
    renderPurchaseOrderDraft();openModal('purchaseOrderModal');
}
function savePurchaseOrder(){
    if(!requireAdminAction('Создавать заказы поставщикам может только Али'))return;
    const supplier=document.getElementById('purchaseOrderSupplier').value.trim();
    if(!supplier)return showToast('Укажи поставщика','error');
    if(!purchaseOrderDraft.length)return showToast('Добавь хотя бы один товар','error');
    const now=new Date().toISOString();
    inventoryPurchaseOrders.unshift({
        id:'po_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),supplier,supplierId:findOrCreateSupplier(supplier)?.id||'',
        createdAt:now,expectedAt:document.getElementById('purchaseOrderExpected').value||'',
        note:document.getElementById('purchaseOrderNote').value.trim(),status:'ordered',
        items:purchaseOrderDraft.map(row=>({productId:row.productId,titleSnapshot:inventoryProducts.find(item=>item.id===row.productId)?.title||'Товар',quantity:row.quantity,receivedQuantity:0,unitCost:row.unitCost,receivedBatches:[]}))
    });
    persistPurchaseOrders();closeModal('purchaseOrderModal');renderPurchaseOrders();
    showToast('Заказ поставщику создан','success');
}
function openPurchaseReceiving(orderId){
    if(!requireAdminAction('Принимать поставки может только Али'))return;
    const order=inventoryPurchaseOrders.find(item=>item.id===orderId);if(!order||['received','cancelled','draft'].includes(order.status))return;
    activeReceivingOrderId=orderId;
    const root=document.getElementById('purchaseReceivingRows');if(!root)return;
    root.innerHTML=order.items.map((item,index)=>{
        const remaining=Math.max(0,item.quantity-item.receivedQuantity);
        if(!remaining)return '';
        return '<div class="purchase-receive-row" data-line="'+index+'"><div><strong>'+escapeBookingHtml(item.titleSnapshot)+'</strong><small>Осталось принять: '+remaining+'</small></div><label>Принять<input type="number" min="0" max="'+remaining+'" step="1" value="'+remaining+'" data-receive-qty="'+index+'"></label><label>Цена за ед., ₽<input type="number" min="0" step="0.01" value="'+item.unitCost+'" data-receive-cost="'+index+'"></label></div>';
    }).join('')||'<div class="inventory-empty">Все позиции уже приняты</div>';
    document.getElementById('purchaseReceivingTitle').textContent='Приёмка · '+order.supplier;
    openModal('purchaseReceivingModal');
}
function receivePurchaseOrder(){
    if(!requireAdminAction('Принимать поставки может только Али'))return;
    const order=inventoryPurchaseOrders.find(item=>item.id===activeReceivingOrderId);
    if(!order||!['ordered','partial'].includes(order.status)||!Array.isArray(order.items)||!order.items.length)return showToast('Заказ уже закрыт или недоступен для приёмки','error');
    const root=document.getElementById('purchaseReceivingRows');
    if(!root)return showToast('Не удалось открыть список позиций приёмки','error');
    const now=new Date().toISOString(),receipts=[],projectedStocks=new Map(),projectedCosts=new Map();
    for(const input of root.querySelectorAll('[data-receive-qty]')){
        const index=Number(input.dataset.receiveQty),line=Number.isSafeInteger(index)&&index>=0?order.items[index]:null;
        if(!line||!Number.isSafeInteger(Number(line.quantity))||Number(line.quantity)<=0||!Number.isSafeInteger(Number(line.receivedQuantity))||Number(line.receivedQuantity)<0||Number(line.receivedQuantity)>Number(line.quantity))return showToast('В заказе обнаружено некорректное количество. Приёмка отменена','error');
        const qty=Number(input.value),costInput=root.querySelector('[data-receive-cost="'+index+'"]'),unitCost=Number(costInput?.value),remaining=Number(line.quantity)-Number(line.receivedQuantity);
        if(!Number.isSafeInteger(qty)||qty<0||qty>remaining||!Number.isFinite(unitCost)||unitCost<0)return showToast('Проверь количество и закупочную цену каждой позиции','error');
        if(qty>0){
            const product=inventoryProducts.find(item=>item.id===line.productId);
            if(!product)return showToast('Один из товаров больше не найден. Приёмка отменена','error');
            const currentStock=projectedStocks.has(product.id)?projectedStocks.get(product.id):Number(product.stock);
            const currentCost=projectedCosts.has(product.id)?projectedCosts.get(product.id):Number(product.purchasePrice)||0;
            if(!Number.isSafeInteger(currentStock)||currentStock<0)return showToast('У одного из товаров некорректный остаток. Приёмка отменена','error');
            const nextStock=currentStock+qty,totalCost=qty*unitCost;
            if(!Number.isSafeInteger(nextStock)||!Number.isFinite(totalCost))return showToast('Количество или стоимость приёмки превышает допустимые значения','error');
            const nextCost=currentStock>0&&currentCost>0?((currentStock*currentCost)+totalCost)/nextStock:unitCost;
            if(!Number.isFinite(nextCost)||nextCost<0)return showToast('Не удалось безопасно рассчитать себестоимость товара','error');
            projectedStocks.set(product.id,nextStock);projectedCosts.set(product.id,nextCost);
            receipts.push({line,product,qty,unitCost,nextStock,nextCost,totalCost});
        }
    }
    if(!receipts.length)return showToast('Укажи количество хотя бы для одной позиции','error');
    receipts.forEach(({line,product,qty,unitCost,nextStock,nextCost,totalCost})=>{
        product.stock=nextStock;product.purchasePrice=nextCost;product.updatedAt=now;
        line.receivedQuantity=Number(line.receivedQuantity)+qty;
        if(!Array.isArray(line.receivedBatches))line.receivedBatches=[];
        line.receivedBatches.push({quantity:qty,unitCost,receivedAt:now});
        inventoryMovements.push({id:'mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),productId:product.id,productTitle:product.title,type:'receipt',quantity:qty,supplier:order.supplier,unitCost,totalCost,note:'Приёмка заказа '+order.id+' · '+(order.note||'Заказ поставщику'),purchaseOrderId:order.id,createdAt:now});
    });
    const complete=order.items.every(item=>Number(item.receivedQuantity)>=Number(item.quantity));
    order.status=complete?'received':'partial';order.updatedAt=now;
    persistInventory();persistPurchaseOrders();closeModal('purchaseReceivingModal');renderPurchaseOrders();
    showToast(complete?'Заказ полностью принят':'Частичная поставка зафиксирована','success');
}
function cancelPurchaseOrder(orderId){
    if(!requireAdminAction('Отменять заказы может только Али'))return;
    const order=inventoryPurchaseOrders.find(item=>item.id===orderId);
    if(!order||order.status==='received'||order.status==='cancelled'||order.items.some(item=>item.receivedQuantity>0))return showToast('Нельзя отменить уже принятую поставку','error');
    order.status='cancelled';order.updatedAt=new Date().toISOString();persistPurchaseOrders();renderPurchaseOrders();showToast('Заказ отменён','success');
}
function initDesktopClientDirectory(){
    if(window.innerWidth<768)return;
    const mount=document.getElementById('clientDirectoryMount');if(!mount)return;
    ['clientsSegmentContainer','clientsSearch','clientsList'].forEach(id=>{
        const node=document.getElementById(id);if(!node)return;
        const wrapper=id==='clientsSearch'?node.closest('.clients-search-wrap'):node;
        if(wrapper&&!mount.contains(wrapper))mount.appendChild(wrapper);
    });
    const scope=document.getElementById('clientDirectoryScope');
    if(scope)scope.innerHTML='<div class="category-tabs crm-client-scope-tabs"><button class="tab-btn '+(currentClientsTab==='my'?'active':'')+'" onclick="renderClients(\'my\')">Мои клиенты</button><button class="tab-btn '+(currentClientsTab==='all'?'active':'')+'" onclick="renderClients(\'all\')">Все клиенты</button></div>';
}
function setPurchaseWorkspaceTab(tab){
    const selected=tab==='suppliers'?'suppliers':'orders';
    document.querySelectorAll('.purchase-workspace-tab').forEach(button=>button.classList.toggle('active',button.dataset.purchaseTab===selected));
    const orders=document.getElementById('purchaseOrdersTab'),suppliers=document.getElementById('suppliersTab');
    if(orders)orders.hidden=selected!=='orders';if(suppliers)suppliers.hidden=selected!=='suppliers';
    if(selected==='suppliers')renderSuppliers();else renderPurchaseOrders();
}
function renderPurchaseOrders(){
    const root=document.getElementById('purchaseOrdersList');if(!root)return;
    const fmt=value=>Math.round(Number(value)||0).toLocaleString('ru-RU')+' ₽';
    const labels={draft:'Черновик',ordered:'Ожидается',partial:'Частично принят',received:'Принят',cancelled:'Отменён'};
    const active=inventoryPurchaseOrders.filter(order=>['ordered','partial'].includes(order.status)).length;
    const pending=inventoryPurchaseOrders.filter(order=>['ordered','partial'].includes(order.status)).reduce((sum,order)=>sum+order.items.reduce((sub,item)=>sub+Math.max(0,item.quantity-item.receivedQuantity)*item.unitCost,0),0);
    const receivedUnits=inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.items.reduce((n,item)=>n+(Number(item.receivedQuantity)||0),0),0);
    const receivedValueAll=inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+supplierReceivedTotal(order),0);
    const kpis=document.getElementById('purchaseOrdersOverview');
    if(kpis)kpis.innerHTML='<div class="inventory-kpi"><span>Ожидают поставки</span><strong>'+active+'</strong></div><div class="inventory-kpi"><span>Стоимость ожидаемых товаров</span><strong>'+fmt(pending)+'</strong></div><div class="inventory-kpi"><span>Принято единиц</span><strong>'+receivedUnits.toLocaleString('ru-RU')+'</strong></div><div class="inventory-kpi"><span>Фактическая стоимость приёмок</span><strong>'+fmt(receivedValueAll)+'</strong></div>';
    root.innerHTML=inventoryPurchaseOrders.length?inventoryPurchaseOrders.map(order=>{
        const total=order.items.reduce((sum,item)=>sum+item.quantity*item.unitCost,0),receivedValue=supplierReceivedTotal(order),paidValue=supplierOrderPaid(order.id),debtValue=order.status==='cancelled'?0:supplierOrderDebt(order),creditValue=order.status==='cancelled'?0:supplierOrderCredit(order);
        const remaining=order.items.reduce((sum,item)=>sum+Math.max(0,item.quantity-item.receivedQuantity),0);
        const linkedMovements=inventoryMovements.filter(move=>move.purchaseOrderId===order.id&&move.type==='receipt');
        const ledgerQty=linkedMovements.reduce((sum,move)=>sum+(Number(move.quantity)||0),0);
        const orderReceivedQty=order.items.reduce((sum,item)=>sum+(Number(item.receivedQuantity)||0),0);
        const ledgerStatus=linkedMovements.length?'<small class="purchase-ledger-check '+(ledgerQty===orderReceivedQty?'is-matched':'is-mismatch')+'">Журнал склада: '+ledgerQty+' из '+orderReceivedQty+' принятых ед.</small>':'';
        const lines=order.items.map(item=>{
            const batches=Array.isArray(item.receivedBatches)?item.receivedBatches:[];
            const batchQty=batches.reduce((sum,b)=>sum+(Number(b.quantity)||0),0);
            const batchCost=batches.reduce((sum,b)=>sum+(Number(b.quantity)||0)*(Number(b.unitCost)||0),0);
            const hasBatchData=batches.length>0;
            const actualCost=hasBatchData&&batchQty>0?batchCost/batchQty:Number(item.unitCost)||0;
            const batchDetails=hasBatchData?'<div class="purchase-line-batches">'+batches.map(batch=>{
                const date=batch.receivedAt?new Date(batch.receivedAt).toLocaleDateString('ru-RU'):'Дата не указана';
                return '<span>'+date+' · '+(Number(batch.quantity)||0)+' шт. × '+fmt(batch.unitCost)+'/ед.</span>';
            }).join('')+'</div>':'';
            return '<div class="purchase-line-reconcile"><div><span>'+escapeBookingHtml(item.titleSnapshot||'Товар')+'</span><small>Принято '+(Number(item.receivedQuantity)||0)+' / '+(Number(item.quantity)||0)+' шт. · Цена заказа '+fmt(item.unitCost)+'/ед. · Факт. средняя '+(hasBatchData?fmt(actualCost):'нет разбивки')+'/ед.</small>'+batchDetails+'</div></div>';
        }).join('');
        return '<article class="purchase-order-card"><div class="purchase-order-top"><div><span class="purchase-order-status status-'+order.status+'">'+(labels[order.status]||'Заказ')+'</span><h3>'+escapeBookingHtml(order.supplier)+'</h3><small>'+new Date(order.createdAt).toLocaleDateString('ru-RU')+' · № '+escapeBookingHtml(order.id.slice(-8))+(order.expectedAt?' · Ожидается: '+escapeBookingHtml(order.expectedAt):'')+'</small></div><strong>'+fmt(total)+'</strong></div><div class="supplier-order-finance"><span>Принято: <b>'+fmt(receivedValue)+'</b></span><span>Оплачено: <b>'+fmt(paidValue)+'</b></span><span>Долг: <b>'+fmt(debtValue)+'</b></span></div><div class="purchase-order-lines">'+lines+'</div>'+ledgerStatus+(order.note?'<p class="purchase-order-note">'+escapeBookingHtml(order.note)+'</p>':'')+'<div class="purchase-order-actions">'+(['ordered','partial'].includes(order.status)?'<button type="button" class="inventory-sync-btn" onclick="openPurchaseReceiving(\''+order.id+'\')">Принять поставку · осталось '+remaining+'</button>':'')+(creditValue>0?'<button type="button" class="inventory-sync-btn" onclick="openSupplierRefund(\''+order.id+'\')">Возврат денег · '+supplierOrderCredit(order).toFixed(2)+' ₽</button>':'')+(supplierOrderReturnableQuantity(order)>0?'<button type="button" class="purchase-order-cancel" onclick="openSupplierReturn(\''+order.id+'\')">Вернуть поставщику</button>':'')+(order.status==='ordered'&&order.items.every(item=>!item.receivedQuantity)?'<button type="button" class="purchase-order-cancel" onclick="cancelPurchaseOrder(\''+order.id+'\')">Отменить</button>':'')+'</div></article>';
    }).join(''):'<div class="inventory-empty">Заказов поставщикам пока нет. Создай первый заказ, чтобы контролировать ожидаемые поставки.</div>';
}

let inventoryMovements = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_inventory_movements')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) { return []; }
})();
const clientAppNishmanCatalog = [
    {
        "id": "st1",
        "category": "Укладка и стайлинг",
        "title": "Матовая паста M1 Agran",
        "description": "Сильная фиксация, матовый финиш, 100 мл",
        "price": 1200
    },
    {
        "id": "st2",
        "category": "Укладка и стайлинг",
        "title": "Матовая глина M2 Matte Clay",
        "description": "Для густых волос, текстура и объем, 100 мл",
        "price": 1250
    },
    {
        "id": "st3",
        "category": "Укладка и стайлинг",
        "title": "Матовая паста M9 Matte Paste",
        "description": "Гибкая фиксация, не склеивает волосы, 100 мл",
        "price": 1300
    },
    {
        "id": "st4",
        "category": "Укладка и стайлинг",
        "title": "Воск-паутина S1 Blackwidow",
        "description": "Эффект художественного беспорядка, 150 мл",
        "price": 1400
    },
    {
        "id": "st5",
        "category": "Укладка и стайлинг",
        "title": "Воск-паутина S3 Blueweb",
        "description": "Сильная фиксация, паутинообразная текстура, 150 мл",
        "price": 1400
    },
    {
        "id": "st6",
        "category": "Укладка и стайлинг",
        "title": "Воск на водной основе 02 Sport",
        "description": "Легкая фиксация, подходит для ежедневного использования, 100 мл",
        "price": 1100
    },
    {
        "id": "st7",
        "category": "Укладка и стайлинг",
        "title": "Воск на водной основе 05 Keratin",
        "description": "Укрепление и блеск, 150 мл",
        "price": 1200
    },
    {
        "id": "st8",
        "category": "Укладка и стайлинг",
        "title": "Матовая пудра P1 Sport",
        "description": "Придает объем, 20 г",
        "price": 900
    },
    {
        "id": "st9",
        "category": "Укладка и стайлинг",
        "title": "Солевой спрей Sea Salt Spray 01",
        "description": "Создает эффект пляжных волн, 200 мл",
        "price": 1000
    },
    {
        "id": "st10",
        "category": "Укладка и стайлинг",
        "title": "Гель для укладки Gum Effect 5+",
        "description": "Ультрафиксация, 300 мл",
        "price": 1150
    },
    {
        "id": "st11",
        "category": "Укладка и стайлинг",
        "title": "Крем для укладки Styling Cream Blue",
        "description": "Подвижный контроль, легкая фиксация, 100 мл",
        "price": 1050
    },
    {
        "id": "hc1",
        "category": "Уход за волосами",
        "title": "Шампунь Pro-Hair Paragon Free",
        "description": "Без соли и парабенов, для ежедневного использования, 400 мл",
        "price": 1300
    },
    {
        "id": "hc2",
        "category": "Уход за волосами",
        "title": "Шампунь 01 Keratin Complex",
        "description": "Восстановление поврежденных волос, 400 мл",
        "price": 1350
    },
    {
        "id": "hc3",
        "category": "Уход за волосами",
        "title": "Кондиционер 2 Phase Keratin Complex",
        "description": "Двухфазный, не требует смывания, 400 мл",
        "price": 1450
    },
    {
        "id": "hc4",
        "category": "Уход за волосами",
        "title": "Кондиционер 2 Phase Argan",
        "description": "Питание и увлажнение, для волос и бороды, 400 мл",
        "price": 1500
    },
    {
        "id": "hc5",
        "category": "Уход за волосами",
        "title": "Тоник для волос Hair Tonic 1 Chilly",
        "description": "Стимулирует рост, укрепляет фолликулы, 200 мл",
        "price": 1200
    },
    {
        "id": "hc6",
        "category": "Уход за волосами",
        "title": "Парфюм для бороды Adonis",
        "description": "Аромат и уход, 75 мл",
        "price": 1100
    },
    {
        "id": "sh1",
        "category": "Бритье и уход",
        "title": "Гель для бритья Easy Shave",
        "description": "Скольжение и защита от раздражения, 400 мл",
        "price": 1250
    },
    {
        "id": "sh2",
        "category": "Бритье и уход",
        "title": "Гель для бритья 03-04 Transparent",
        "description": "Прозрачный, без горячих полотенец, 1000 мл",
        "price": 1800
    },
    {
        "id": "sh3",
        "category": "Бритье и уход",
        "title": "Крем-одеколон после бритья Gold One",
        "description": "Успокаивает и освежает, 200 мл",
        "price": 1200
    },
    {
        "id": "sh4",
        "category": "Бритье и уход",
        "title": "Крем-одеколон после бритья City Senior",
        "description": "2 в 1, защита от раздражения, 400 мл",
        "price": 1400
    },
    {
        "id": "sh5",
        "category": "Бритье и уход",
        "title": "Тальк после бритья Barber Shave Talc",
        "description": "Впитывает влагу, затягивает порезы",
        "price": 800
    },
    {
        "id": "sh6",
        "category": "Бритье и уход",
        "title": "Бальзам для бороды и усов",
        "description": "Смягчает и укладывает, 100 мл",
        "price": 1150
    },
    {
        "id": "sk1",
        "category": "Уход за кожей",
        "title": "Пилинг-гель для лица Peeling Gel",
        "description": "Глубокое очищение, от черных точек, 100 мл",
        "price": 1000
    },
    {
        "id": "sk2",
        "category": "Уход за кожей",
        "title": "Маска для лица Clay Mask",
        "description": "Очищает поры, матирует, 100 мл",
        "price": 1100
    },
    {
        "id": "sk3",
        "category": "Уход за кожей",
        "title": "Маска-пленка Peel-Off Black Mask",
        "description": "Удаляет загрязнения и ороговевшие клетки, 200 мл",
        "price": 1200
    },
    {
        "id": "sk4",
        "category": "Уход за кожей",
        "title": "Крем для лица и рук Pomegranate",
        "description": "Увлажнение 24 часа, 300 мл",
        "price": 1300
    },
    {
        "id": "sl1",
        "category": "Салонные продукты",
        "title": "Шампунь Salon Size 01",
        "description": "Профессиональный объем 5000 мл",
        "price": 4500
    },
    {
        "id": "sl2",
        "category": "Салонные продукты",
        "title": "Кондиционер Salon Size 01",
        "description": "Профессиональный объем 5000 мл",
        "price": 4800
    },
    {
        "id": "sl3",
        "category": "Салонные продукты",
        "title": "Воск для волос 07 Gold One",
        "description": "Классическая фиксация, 100 мл",
        "price": 1150
    },
    {
        "id": "sl4",
        "category": "Салонные продукты",
        "title": "Воск для волос 08 Matte Look",
        "description": "Матовая фиксация, 100 мл",
        "price": 1150
    }
];

function syncClientCatalogFromClientApp(notify = false) {
    let added = 0;
    let updated = 0;
    clientAppNishmanCatalog.forEach(source => {
        let item = inventoryProducts.find(product => product.sourceProductId === source.id || product.id === 'nishman_' + source.id);
        if (!item) {
            item = {
                id: 'nishman_' + source.id,
                sourceProductId: source.id,
                brand: 'NISHMAN',
                title: source.title,
                description: source.description,
                sku: source.id.toUpperCase(),
                category: source.category,
                unit: 'шт.',
                purchasePrice: 0,
                salePrice: source.price,
                stock: 0,
                minStock: 0,
                active: true,
                updatedAt: new Date().toISOString()
            };
            inventoryProducts.push(item);
            added++;
        } else {
            const changed = item.brand !== 'NISHMAN' || item.title !== source.title ||
                item.description !== source.description || item.category !== source.category ||
                Number(item.salePrice) !== source.price || !item.sku;
            item.sourceProductId = source.id;
            item.brand = 'NISHMAN';
            item.title = source.title;
            item.description = source.description;
            item.category = source.category;
            item.salePrice = source.price;
            item.sku = item.sku || source.id.toUpperCase();
            if (changed) {
                item.updatedAt = new Date().toISOString();
                updated++;
            }
        }
    });
    if (added || updated) persistInventory();
    if (notify) showToast('Каталог клиентского приложения синхронизирован: добавлено ' + added + ', обновлено ' + updated, 'success');
    return { added, updated, total: clientAppNishmanCatalog.length };
}

let inventoryMovementHistoryLimit = 12;
let editingInventoryProductId = null;

function persistInventory() {
    localStorage.setItem(appStorageKey('mensfire_inventory_products'), JSON.stringify(inventoryProducts));
    localStorage.setItem(appStorageKey('mensfire_inventory_movements'), JSON.stringify(inventoryMovements));
}

/* Розничные чеки: продажи товаров, складское списание и история CRM. */
let retailSaleCart = [];
function getRetailSaleClients() {
    const map = new Map();
    bookings.forEach(booking => {
        const name = String(booking.clientName || '').trim();
        if (!name) return;
        const found = findClientProfile(name, booking.barberId);
        const profile = found.profile || {};
        const key = found.key;
        if (!map.has(key)) map.set(key, {
            key, name: String(profile.clientName || name), phone: String(profile.phone || booking.clientPhone || ''),
            profile, bookings: []
        });
        map.get(key).bookings.push(booking);
    });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
function renderRetailSales() {
    if (!requireAdminAction('Оформлять товарные продажи может только Али')) return;
    syncClientCatalogFromClientApp(false);
    const clientSelect=document.getElementById('retailSaleClient');
    const productSelect=document.getElementById('retailSaleProduct');
    if(!clientSelect||!productSelect)return;
    const clients=getRetailSaleClients();
    const selectedClient=clientSelect.value;
    clientSelect.innerHTML='<option value="">Выбери клиента из CRM</option>'+clients.map(client=>'<option value="'+escapeBookingHtml(client.key)+'">'+escapeBookingHtml(client.name)+(client.phone?' · '+escapeBookingHtml(client.phone):'')+'</option>').join('');
    if(clients.some(client=>client.key===selectedClient))clientSelect.value=selectedClient;
    const selectedProduct=productSelect.value;
    const products=inventoryProducts.filter(item=>item.active);
    productSelect.innerHTML='<option value="">Выбери товар</option>'+products.map(item=>'<option value="'+escapeBookingHtml(item.id)+'" '+(item.stock<=0?'disabled':'')+'>'+escapeBookingHtml(item.title)+' · '+Math.round(item.salePrice).toLocaleString('ru-RU')+' ₽ · остаток '+item.stock+'</option>').join('');
    if(products.some(item=>item.id===selectedProduct))productSelect.value=selectedProduct;
    renderRetailSaleCart();
    renderRetailSaleBookings();
    const recent=document.getElementById('retailSalesHistory');
    if(recent){
        const fmt=v=>Math.round(Number(v)||0).toLocaleString('ru-RU')+' ₽';
        const sales=clientRetailSales.slice().sort((a,b)=>new Date(b.soldAt)-new Date(a.soldAt)).slice(0,12);
        recent.innerHTML=sales.length?sales.map(sale=>{
            const net=Math.max(0,Number(sale.netTotal ?? sale.total)||0);
            const refunded=(Array.isArray(sale.refunds)?sale.refunds:[]).reduce((sum,item)=>sum+(Number(item.value)||0),0);
            return '<article class="retail-history-row"><div><strong>'+escapeBookingHtml(sale.clientNameSnapshot||'Клиент')+'</strong><small>'+new Date(sale.soldAt).toLocaleString('ru-RU')+' · '+sale.items.length+' поз.'+(refunded?' · Возврат '+fmt(refunded):'')+'</small></div><div><b>'+fmt(net)+'</b><small>'+({paid:'Оплачено',partial:'Частично',unpaid:'Долг',refunded:'Полный возврат'}[sale.paymentStatus]||'')+'</small></div>'+(sale.paymentStatus!=='refunded'&&net>0?'<button type="button" class="retail-refund-btn" onclick="openRetailRefundModal(\''+escapeBookingHtml(sale.id)+'\')">Возврат</button>':'')+'</article>';
        }).join(''):'<div class="retail-empty">Пока нет товарных чеков</div>';
    }
}
function renderRetailSaleBookings(){
    const clientKey=document.getElementById('retailSaleClient')?.value||'';
    const select=document.getElementById('retailSaleBooking');
    if(!select)return;
    const client=getRetailSaleClients().find(item=>item.key===clientKey);
    const visits=(client?.bookings||[]).slice().sort((a,b)=>new Date((b.date||'')+' '+(b.time||''))-new Date((a.date||'')+' '+(a.time||'')));
    select.innerHTML='<option value="">Без привязки к визиту</option>'+visits.map(item=>'<option value="'+escapeBookingHtml(String(item.id))+'">'+escapeBookingHtml((item.date||'')+' · '+(item.time||'')+' · '+(item.status||''))+'</option>').join('');
}
function addRetailSaleItem(){
    const id=document.getElementById('retailSaleProduct')?.value;
    const qty=Number(document.getElementById('retailSaleQuantity')?.value||1);
    const product=inventoryProducts.find(item=>item.id===id&&item.active);
    if(!product)return showToast('Выбери товар','error');
    if(!Number.isInteger(qty)||qty<1)return showToast('Количество должно быть целым числом','error');
    const existing=retailSaleCart.find(item=>item.productId===id);
    const nextQty=qty+(existing?.quantity||0);
    if(nextQty>product.stock)return showToast('На складе только '+product.stock+' '+product.unit,'error');
    if(existing)existing.quantity=nextQty;
    else retailSaleCart.push({productId:id,quantity:qty,unitPrice:Number(product.salePrice)||0});
    document.getElementById('retailSaleQuantity').value='1';
    renderRetailSaleCart();
}
function removeRetailSaleItem(id){retailSaleCart=retailSaleCart.filter(item=>item.productId!==id);renderRetailSaleCart();}
function renderRetailSaleCart(){
    const root=document.getElementById('retailSaleCart');
    const totalNode=document.getElementById('retailSaleTotal');
    if(!root)return;
    const fmt=v=>Math.round(Number(v)||0).toLocaleString('ru-RU')+' ₽';
    const total=retailSaleCart.reduce((sum,row)=>sum+row.quantity*row.unitPrice,0);
    root.innerHTML=retailSaleCart.length?retailSaleCart.map(row=>{
        const product=inventoryProducts.find(item=>item.id===row.productId);
        return '<div class="retail-cart-row"><div><strong>'+escapeBookingHtml(product?.title||'Товар удалён')+'</strong><small>'+row.quantity+' × '+fmt(row.unitPrice)+'</small></div><b>'+fmt(row.quantity*row.unitPrice)+'</b><button type="button" aria-label="Убрать товар" onclick="removeRetailSaleItem(\''+escapeBookingHtml(row.productId)+'\')">×</button></div>';
    }).join(''):'<div class="retail-empty">Добавь товары в чек — здесь появится состав покупки</div>';
    if(totalNode)totalNode.textContent=fmt(total);
    const status=document.getElementById('retailSalePaymentStatus');
    const paid=document.getElementById('retailSalePaidAmount');
    if(status&&paid&&status.value==='paid')paid.value=String(total);
    if(status&&paid&&status.value==='unpaid')paid.value='0';
}
function updateRetailPaymentFields(){
    const status=document.getElementById('retailSalePaymentStatus')?.value||'paid';
    const paid=document.getElementById('retailSalePaidAmount');
    const group=document.getElementById('retailSalePaidGroup');
    if(group)group.style.display=status==='partial'?'':'none';
    if(paid&&status!=='partial'){
        const total=retailSaleCart.reduce((sum,row)=>sum+row.quantity*row.unitPrice,0);
        paid.value=status==='paid'?String(total):'0';
    }
}

let activeRetailRefundSaleId = null;
function getRetailSaleNetTotal(sale) {
    if (!sale) return 0;
    if (Number.isFinite(Number(sale.netTotal))) return Math.max(0,Number(sale.netTotal));
    const refunded=(Array.isArray(sale.refunds)?sale.refunds:[]).reduce((sum,item)=>sum+(Number(item.value)||0),0);
    return Math.max(0,(Number(sale.total)||0)-refunded);
}
function openRetailRefundModal(saleId) {
    if(!requireAdminAction('Оформлять возвраты может только Али'))return;
    const sale=clientRetailSales.find(item=>item.id===saleId);
    if(!sale||sale.paymentStatus==='refunded'||getRetailSaleNetTotal(sale)<=0)return showToast('Этот чек уже полностью возвращён','error');
    activeRetailRefundSaleId=saleId;
    const fmt=value=>Math.round(Number(value)||0).toLocaleString('ru-RU')+' ₽';
    const root=document.getElementById('retailRefundItems');
    if(!root)return;
    root.innerHTML=(sale.items||[]).map((item,index)=>{
        const available=Math.max(0,Number(item.quantity)||0)-(Number(item.refundedQuantity)||0);
        return '<div class="retail-refund-item"><div><strong>'+escapeBookingHtml(item.titleSnapshot||'Товар')+'</strong><small>'+fmt(item.unitPrice)+' за шт. · доступно к возврату: '+available+'</small></div><input type="number" min="0" max="'+available+'" step="1" value="0" data-refund-index="'+index+'" aria-label="Количество к возврату" oninput="previewRetailRefund()" '+(available?'':'disabled')+'></div>';
    }).join('');
    document.getElementById('retailRefundNote').value='';
    document.getElementById('retailRefundSummary').textContent='Выбери количество товаров для возврата';
    openModal('retailRefundModal');
}
function previewRetailRefund() {
    const sale=clientRetailSales.find(item=>item.id===activeRetailRefundSaleId);
    const root=document.getElementById('retailRefundItems');
    const summary=document.getElementById('retailRefundSummary');
    if(!sale||!root||!summary)return;
    let value=0,selectedCount=0,valid=true;
    root.querySelectorAll('[data-refund-index]').forEach(input=>{
        const index=Number(input.dataset.refundIndex);
        const item=Number.isInteger(index)?sale.items[index]:null;
        if(!item){valid=false;return;}
        const available=Math.max(0,Number(item.quantity)||0)-(Number(item.refundedQuantity)||0);
        const qty=Number(input.value||0);
        if(!Number.isInteger(qty)||qty<0||qty>available)valid=false;
        else {value+=qty*(Number(item.unitPrice)||0);if(qty>0)selectedCount+=qty;}
    });
    summary.textContent=valid&&selectedCount>0?'Выбрано '+selectedCount+' шт. · сумма возврата: '+Math.round(value).toLocaleString('ru-RU')+' ₽': 'Укажи количество для возврата';
}
function saveRetailRefund() {
    if(!requireAdminAction('Оформлять возвраты может только Али'))return;
    const sale=clientRetailSales.find(item=>item.id===activeRetailRefundSaleId);
    if(!sale||sale.paymentStatus==='refunded')return showToast('Чек уже возвращён или не найден','error');
    const root=document.getElementById('retailRefundItems');
    if(!root)return showToast('Не удалось открыть список товаров для возврата','error');
    if(!Array.isArray(sale.items))return showToast('В чеке отсутствуют товарные позиции','error');
    const selections=[];
    let refundValue=0;
    for(const input of root.querySelectorAll('[data-refund-index]')){
        const index=Number(input.dataset.refundIndex),item=Number.isInteger(index)?sale.items[index]:null;
        if(!item)return showToast('Позиция возврата не найдена. Обнови чек','error');
        const qty=Number(input.value||0);
        const originalQty=Number(item.quantity),alreadyRefunded=Number(item.refundedQuantity)||0;
        const unitPrice=Number(item.unitPrice);
        const available=Math.max(0,originalQty-alreadyRefunded);
        if(!Number.isSafeInteger(qty)||qty<0||!Number.isSafeInteger(originalQty)||originalQty<=0||!Number.isSafeInteger(alreadyRefunded)||alreadyRefunded<0||alreadyRefunded>originalQty||!Number.isFinite(unitPrice)||unitPrice<0||qty>available)return showToast('Проверь количество и цену возвращаемого товара','error');
        if(qty>0){selections.push({index,item,qty});refundValue+=qty*unitPrice;}
    }
    if(!selections.length)return showToast('Выбери хотя бы одну позицию для возврата','error');
    const refundCents=Math.round(refundValue*100);
    if(!Number.isFinite(refundValue)||refundValue<0||!Number.isSafeInteger(refundCents)||Math.abs(refundValue*100-refundCents)>0.001)return showToast('Сумма возврата должна быть указана с точностью до копеек','error');
    const netBefore=getRetailSaleNetTotal(sale);
    if(refundValue>netBefore+0.001)return showToast('Сумма возврата превышает остаток чека','error');
    const paidBefore=Math.max(0,Number(sale.paidAmount ?? (sale.paymentStatus==='paid'?sale.total:0))||0);
    const paidRefund=Math.min(refundValue,paidBefore);
    const now=new Date().toISOString();
    const refundId='refund_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const movementRows=[];
    for(const selection of selections){
        const product=inventoryProducts.find(item=>item.id===selection.item.productId);
        if(!product)return showToast('Товар из чека не найден в каталоге. Возврат отменён','error');
        const stock=Number(product.stock);
        if(!Number.isSafeInteger(stock)||stock<0||!Number.isSafeInteger(stock+selection.qty))return showToast('Невозможно безопасно пересчитать остаток товара. Возврат отменён','error');
        movementRows.push({selection,product});
    }
    // Сначала проверяем все позиции, затем одним действием обновляем остатки и чек.
    movementRows.forEach(({selection,product})=>{
        selection.item.refundedQuantity=(Number(selection.item.refundedQuantity)||0)+selection.qty;
        product.stock+=selection.qty;
        product.updatedAt=now;
        inventoryMovements.push({
            id:'mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
            productId:product.id,productTitle:product.title,type:'return',quantity:selection.qty,
            supplier:'',unitCost:selection.item.unitCostSnapshot??null,totalCost:selection.item.unitCostSnapshot==null?null:Number(selection.item.unitCostSnapshot)*selection.qty,note:'Возврат по чеку '+sale.id,
            saleId:sale.id,refundId,createdAt:now
        });
    });
    sale.refunds=Array.isArray(sale.refunds)?sale.refunds:[];
    sale.refunds.push({
        id:refundId,createdAt:now,value:refundValue,paidAmount:paidRefund,
        paymentMethod:sale.paymentMethod||'other',debtReduction:refundValue-paidRefund,
        items:selections.map(({item,qty})=>({productId:item.productId,titleSnapshot:item.titleSnapshot,quantity:qty,unitPrice:Number(item.unitPrice)||0,unitCostSnapshot:item.unitCostSnapshot??null})),
        note:document.getElementById('retailRefundNote').value.trim()
    });
    sale.netTotal=Math.max(0,netBefore-refundValue);
    sale.paidAmount=Math.max(0,paidBefore-paidRefund);
    sale.paymentStatus=sale.netTotal<=0.001?'refunded':sale.paidAmount<=0?'unpaid':sale.paidAmount>=sale.netTotal-0.001?'paid':'partial';
    sale.updatedAt=now;
    persistInventory();persistClientRetailSales();
    closeModal('retailRefundModal');
    activeRetailRefundSaleId=null;
    renderRetailSales();
    if(selectedClientProfileKey)renderClientRetailPurchases();
    if(document.getElementById('viewFinance')?.classList.contains('active'))renderFinance();
    showToast('Возврат оформлен, товар возвращён на склад','success');
}

function saveRetailSale(){
    if(!requireAdminAction('Оформлять товарные продажи может только Али'))return;
    const clientKey=document.getElementById('retailSaleClient')?.value||'';
    const client=getRetailSaleClients().find(item=>item.key===clientKey);
    if(!client)return showToast('Выбери клиента из CRM','error');
    if(!retailSaleCart.length)return showToast('Добавь хотя бы один товар','error');
    const status=document.getElementById('retailSalePaymentStatus').value;
    if(!['paid','unpaid','partial'].includes(status))return showToast('Выбран неизвестный статус оплаты','error');
    if(retailSaleCart.some(row=>!Number.isSafeInteger(Number(row.quantity))||Number(row.quantity)<=0||!Number.isFinite(Number(row.unitPrice))||Number(row.unitPrice)<0))return showToast('Проверь количество и цену каждого товара в чеке','error');
    const total=retailSaleCart.reduce((sum,row)=>sum+Number(row.quantity)*Number(row.unitPrice),0);
    const totalCents=Math.round(total*100);
    if(!Number.isFinite(total)||total<0||!Number.isSafeInteger(totalCents)||Math.abs(total*100-totalCents)>0.001)return showToast('Сумма товарного чека должна быть указана с точностью до копеек','error');
    const paidRaw=Number(document.getElementById('retailSalePaidAmount').value);
    const paid=status==='paid'?total:status==='unpaid'?0:paidRaw;
    const paidCents=Math.round(paid*100);
    if(!Number.isFinite(paid)||paid<0||paid>total||!Number.isSafeInteger(paidCents)||Math.abs(paid*100-paidCents)>0.001)return showToast('Сумма оплаты должна быть указана с точностью до копеек и не превышать сумму чека','error');
    if(status==='partial'&&(paid<=0||paid>=total))return showToast('Для частичной оплаты укажи сумму больше 0 и меньше итога','error');
    const checked=retailSaleCart.map(row=>{
        const product=inventoryProducts.find(item=>item.id===row.productId);
        return {row,product};
    });
    if(checked.some(item=>!item.product||!item.product.active||item.product.stock<item.row.quantity))return showToast('Остатки изменились. Обнови чек и проверь количество','error');
    const now=new Date().toISOString();
    const saleId='sale_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const bookingId=document.getElementById('retailSaleBooking')?.value||'';
    const linkedBooking=bookingId ? bookings.find(item=>String(item.id)===bookingId) : null;
    if (bookingId && (!linkedBooking || !(Array.isArray(client.bookings) && client.bookings.some(item=>String(item.id)===bookingId)))) {
        return showToast('Выбранный визит не относится к этому клиенту. Обнови список визитов и попробуй снова','error');
    }
    const items=checked.map(({row,product})=>{
        const movementId='mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
        const unitCostSnapshot=Number(product.purchasePrice)>0?Number(product.purchasePrice):null;
        product.stock-=row.quantity;product.updatedAt=now;
        inventoryMovements.push({id:movementId,productId:product.id,productTitle:product.title,type:'sale',quantity:row.quantity,supplier:'',unitCost:unitCostSnapshot,totalCost:unitCostSnapshot===null?null:unitCostSnapshot*row.quantity,note:'Продажа · чек '+saleId,saleId,createdAt:now});
        return {productId:product.id,sku:product.sku,titleSnapshot:product.title,quantity:row.quantity,unitPrice:row.unitPrice,lineTotal:row.quantity*row.unitPrice,unitCostSnapshot,refundedQuantity:0,stockMovementId:movementId};
    });
    clientRetailSales.push({
        id:saleId,clientProfileKey:client.key,clientPhone:normalizeClientPhone(client.phone)?client.phone:'',clientNameSnapshot:client.name,
        soldAt:now,bookingId,staffId:String(linkedBooking?.barberId||currentUser.id||''),paymentStatus:status,paymentMethod:document.getElementById('retailSalePaymentMethod').value,
        total,netTotal:total,paidAmount:paid,grossPaidAmount:paid,items,refunds:[],notes:document.getElementById('retailSaleNote').value.trim(),source:'retail',createdAt:now
    });
    persistInventory();persistClientRetailSales();
    retailSaleCart=[];
    document.getElementById('retailSaleNote').value='';
    document.getElementById('retailSalePaymentStatus').value='paid';
    document.getElementById('retailSalePaymentMethod').value='card';
    updateRetailPaymentFields();
    renderRetailSales();
    showToast('Товарный чек сохранён, остатки списаны','success');
}


function renderInventoryAnalytics(){
    if(!requireAdminAction('Аналитика доступна администратору'))return;
    const fromNode=document.getElementById('inventoryAnalyticsFrom');
    const toNode=document.getElementById('inventoryAnalyticsTo');
    if(!fromNode||!toNode)return;
    const today=new Date();
    const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
    if(!fromNode.value){const start=new Date(today);start.setDate(start.getDate()-29);fromNode.value=dateKey(start);}
    if(!toNode.value)toNode.value=dateKey(today);
    const from=fromNode.value,to=toNode.value;
    const summary=document.getElementById('inventoryAnalyticsOverview');
    const productsRoot=document.getElementById('inventoryAnalyticsProducts');
    const restockRoot=document.getElementById('inventoryAnalyticsRestock');
    if(!summary||!productsRoot||!restockRoot)return;
    if(!from||!to||from>to){summary.innerHTML='<div class="inventory-empty">Проверь даты отчёта: начало периода должно быть раньше окончания</div>';productsRoot.innerHTML='';restockRoot.innerHTML='';return;}
    const inRange=value=>{if(!value)return false;const date=new Date(value);if(Number.isNaN(date.getTime()))return false;return dateKey(date)>=from&&dateKey(date)<=to;};
    const productMap=new Map(inventoryProducts.map(product=>[product.id,{product,unitsSold:0,unitsReturned:0,revenue:0,refunds:0,cost:0,returnedCost:0,costKnownUnits:0,costUnknownUnits:0}]));
    let grossRevenue=0,refundRevenue=0,unitsSold=0,unitsReturned=0,cost=0,returnedCost=0,costKnownUnits=0,costUnknownUnits=0,returnedCostUnknownUnits=0,saleCount=0,refundCount=0;
    clientRetailSales.forEach(sale=>{
        const saleInRange=inRange(sale.soldAt||sale.createdAt);
        if(saleInRange){
            saleCount++;
            (sale.items||[]).forEach(item=>{
                const qty=Math.max(0,Number(item.quantity)||0),price=Math.max(0,Number(item.unitPrice)||0);
                const lineRevenue=qty*price;grossRevenue+=lineRevenue;unitsSold+=qty;
                const row=productMap.get(item.productId);
                if(row){row.unitsSold+=qty;row.revenue+=lineRevenue;}
                const unitCost=item.unitCostSnapshot!=null?Number(item.unitCostSnapshot):Number(inventoryProducts.find(p=>p.id===item.productId)?.purchasePrice)>0?Number(inventoryProducts.find(p=>p.id===item.productId).purchasePrice):null;
                if(unitCost!==null&&Number.isFinite(unitCost)&&unitCost>=0){cost+=unitCost*qty;costKnownUnits+=qty;if(row){row.cost+=unitCost*qty;row.costKnownUnits+=qty;}}
                else{costUnknownUnits+=qty;if(row)row.costUnknownUnits+=qty;}
            });
        }
        (Array.isArray(sale.refunds)?sale.refunds:[]).forEach(refund=>{
            if(!inRange(refund.createdAt))return;
            refundCount++;refundRevenue+=Math.max(0,Number(refund.value)||0);
            (refund.items||[]).forEach(item=>{
                const qty=Math.max(0,Number(item.quantity)||0),price=Math.max(0,Number(item.unitPrice)||0);
                const lineRefund=qty*price;unitsReturned+=qty;
                const row=productMap.get(item.productId);
                if(row){row.unitsReturned+=qty;row.refunds+=lineRefund;}
                let unitCost=item.unitCostSnapshot;
                if(unitCost==null){const original=(sale.items||[]).find(line=>line.productId===item.productId);unitCost=original?.unitCostSnapshot;}
                if(unitCost==null){const product=inventoryProducts.find(p=>p.id===item.productId);unitCost=Number(product?.purchasePrice)>0?Number(product.purchasePrice):null;}
                if(unitCost!==null&&Number.isFinite(Number(unitCost))&&Number(unitCost)>=0){returnedCost+=Number(unitCost)*qty;if(row)row.returnedCost+=Number(unitCost)*qty;}
                else{returnedCostUnknownUnits+=qty;if(row)row.costUnknownUnits+=qty;}
            });
        });
    });
    const netRevenue=grossRevenue-refundRevenue,netCost=cost-returnedCost,profit=netRevenue-netCost;
    const fmt=value=>Math.round(Number(value)||0).toLocaleString('ru-RU')+' ₽';
    const pct=value=>value.toFixed(1).replace('.',',')+'%';
    const totalUnits=inventoryProducts.reduce((sum,item)=>sum+item.stock,0);
    const low=inventoryProducts.filter(item=>item.active&&item.stock<=item.minStock);
    const debt=clientRetailSales.reduce((sum,sale)=>sum+(inRange(sale.soldAt||sale.createdAt)?Math.max(0,getRetailSaleNetTotal(sale)-(Number(sale.paidAmount)||0)):0),0);
    summary.innerHTML=
        '<div class="inventory-kpi"><span>Продажи товаров</span><strong>'+fmt(grossRevenue)+'</strong><small>'+saleCount+' чеков за период</small></div>'+
        '<div class="inventory-kpi"><span>Возвраты</span><strong>'+fmt(refundRevenue)+'</strong><small>'+refundCount+' операций · '+unitsReturned+' ед.</small></div>'+
        '<div class="inventory-kpi"><span>Выручка после возвратов</span><strong>'+fmt(netRevenue)+'</strong><small>'+unitsSold+' продано · '+Math.max(0,unitsSold-unitsReturned)+' ед. чистыми</small></div>'+
        '<div class="inventory-kpi"><span>Валовая прибыль*</span><strong>'+fmt(profit)+'</strong><small>Маржа '+(netRevenue>0?pct(profit/netRevenue*100):'—')+'</small></div>'+
        '<div class="inventory-kpi"><span>Себестоимость продаж*</span><strong>'+fmt(netCost)+'</strong><small>'+costKnownUnits+' ед. с известной себестоимостью</small></div>'+
        '<div class="inventory-kpi"><span>Долг по товарным чекам</span><strong>'+fmt(debt)+'</strong><small>По чекам, созданным в периоде</small></div>'+
        '<div class="inventory-kpi"><span>Товаров на складе</span><strong>'+totalUnits.toLocaleString('ru-RU')+'</strong><small>'+inventoryProducts.filter(item=>item.active).length+' активных позиций</small></div>'+
        '<div class="inventory-kpi '+(low.length?'is-warning':'')+'"><span>Нужно пополнить</span><strong>'+low.length+'</strong><small>Позиции на минимуме или ниже</small></div>';
    const rows=Array.from(productMap.values()).filter(row=>row.unitsSold||row.unitsReturned).sort((a,b)=>(b.revenue-b.refunds)-(a.revenue-a.refunds));
    productsRoot.innerHTML=rows.length?'<div class="inventory-analytics-table-wrap"><table class="inventory-analytics-table"><thead><tr><th>Товар</th><th>Продано</th><th>Возврат</th><th>Выручка</th><th>Прибыль*</th></tr></thead><tbody>'+rows.map(row=>{
        const net=row.revenue-row.refunds,netUnits=row.unitsSold-row.unitsReturned;
        const known=row.costUnknownUnits===0;
        return '<tr><td><strong>'+escapeBookingHtml(row.product.title)+'</strong><small>'+escapeBookingHtml(row.product.category)+'</small></td><td>'+row.unitsSold+'</td><td>'+row.unitsReturned+'</td><td>'+fmt(net)+'</td><td>'+ (known?fmt(net-(row.cost-row.returnedCost)):'Нет полной себестоимости')+'</td></tr>';
    }).join('')+'</tbody></table></div>':'<div class="inventory-empty">За выбранный период товарных продаж и возвратов нет</div>';
    const priceRoot=document.getElementById('inventoryPurchasePriceChanges');
    if(priceRoot){
        const history=new Map();
        inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').forEach(order=>(order.items||[]).forEach(item=>{
            (Array.isArray(item.receivedBatches)?item.receivedBatches:[]).forEach(batch=>{
                const date=batch.receivedAt||order.updatedAt||order.createdAt;
                if(!inRange(date)||!(Number(batch.quantity)>0)||!Number.isFinite(Number(batch.unitCost)))return;
                const key=item.productId||item.titleSnapshot;
                if(!history.has(key))history.set(key,{title:item.titleSnapshot||'Товар',batches:[]});
                history.get(key).batches.push({date,quantity:Number(batch.quantity),unitCost:Number(batch.unitCost),supplier:order.supplier||'Поставщик не указан'});
            });
        }));
        const changes=[...history.values()].map(row=>{
            const batches=row.batches.sort((a,b)=>new Date(a.date)-new Date(b.date));
            const first=batches[0],last=batches[batches.length-1];
            const firstCost=first.unitCost,lastCost=last.unitCost;
            return {...row,first,last,firstCost,lastCost,delta:lastCost-firstCost,percent:firstCost>0?(lastCost-firstCost)/firstCost*100:null};
        }).filter(row=>row.batches.length>1&&Math.abs(row.delta)>0.001).sort((a,b)=>Math.abs(b.percent??0)-Math.abs(a.percent??0));
        priceRoot.innerHTML=changes.length?'<div class="inventory-price-change-list">'+changes.slice(0,12).map(row=>{
            const up=row.delta>0,percent=row.percent===null?'—':(up?'+':'')+row.percent.toFixed(1)+'%';
            return '<div class="inventory-price-change-row"><div><strong>'+escapeBookingHtml(row.title)+'</strong><small>'+row.batches.length+' партий · '+row.first.supplier+' → '+row.last.supplier+'</small></div><div class="inventory-price-change-values"><span>'+fmt(row.firstCost)+' → '+fmt(row.lastCost)+'</span><b class="'+(up?'is-up':'is-down')+'">'+(up?'▲ ':'▼ ')+percent+'</b></div></div>';
        }).join('')+'</div>':'<div class="inventory-empty compact">За выбранный период пока нет товаров с несколькими приёмками для сравнения закупочной цены</div>';
    }
    const supplierCompareRoot=document.getElementById('inventorySupplierComparison');
    if(supplierCompareRoot){
        const comparisons=new Map();
        inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').forEach(order=>(order.items||[]).forEach(item=>{
            (Array.isArray(item.receivedBatches)?item.receivedBatches:[]).forEach(batch=>{
                const date=batch.receivedAt||order.updatedAt||order.createdAt,qty=Number(batch.quantity),unitCost=Number(batch.unitCost);
                if(!inRange(date)||!(qty>0)||!Number.isFinite(unitCost)||unitCost<=0||!order.supplier)return;
                const key=item.productId||item.titleSnapshot;
                if(!comparisons.has(key))comparisons.set(key,{title:item.titleSnapshot||'Товар',suppliers:new Map()});
                const suppliers=comparisons.get(key).suppliers;
                if(!suppliers.has(order.supplier))suppliers.set(order.supplier,{quantity:0,total:0,batches:0});
                const stat=suppliers.get(order.supplier);stat.quantity+=qty;stat.total+=qty*unitCost;stat.batches++;
            });
        }));
        const rows=[...comparisons.values()].map(row=>{
            const suppliers=[...row.suppliers.entries()].map(([name,stat])=>({name,quantity:stat.quantity,average:stat.total/stat.quantity,batches:stat.batches})).sort((a,b)=>a.average-b.average);
            if(suppliers.length<2)return null;
            const best=suppliers[0],highest=suppliers[suppliers.length-1],spread=highest.average-best.average;
            return {...row,best,highest,spread,percent:highest.average>0?spread/highest.average*100:0};
        }).filter(Boolean).sort((a,b)=>b.spread-a.spread);
        supplierCompareRoot.innerHTML=rows.length?'<div class="inventory-supplier-compare-list">'+rows.slice(0,12).map(row=>{
            const qty=Math.max(1,Number(inventoryProducts.find(p=>p.title===row.title)?.minStock)||1);
            return '<div class="inventory-supplier-compare-row"><div class="inventory-supplier-compare-product"><strong>'+escapeBookingHtml(row.title)+'</strong><small>'+row.suppliers.length+' поставщика · '+row.best.batches+' партий у выгоднейшего</small></div><div class="inventory-supplier-compare-prices"><span><b>'+escapeBookingHtml(row.best.name)+'</b> · '+fmt(row.best.average)+'/ед.</span><span>Дороже: '+escapeBookingHtml(row.highest.name)+' · '+fmt(row.highest.average)+'/ед.</span><strong>Разница '+fmt(row.spread)+'/ед. ('+row.percent.toFixed(1)+'%)</strong><small>Потенциальная экономия на '+qty+' шт.: '+fmt(row.spread*qty)+'</small></div></div>';
        }).join('')+'</div>':'<div class="inventory-empty compact">Для сравнения пока недостаточно партий от двух разных поставщиков по одному товару</div>';
    }
    const priceAlertRoot=document.getElementById('inventoryPurchasePriceAlerts');
    if(priceAlertRoot){
        const productBatches=new Map();
        inventoryPurchaseOrders.filter(order=>order.status!=='cancelled').forEach(order=>(order.items||[]).forEach(item=>{
            if(!item.productId)return;
            (Array.isArray(item.receivedBatches)?item.receivedBatches:[]).forEach(batch=>{
                const date=batch.receivedAt||order.updatedAt||order.createdAt,quantity=Number(batch.quantity),unitCost=Number(batch.unitCost);
                if(!(quantity>0)||!Number.isFinite(unitCost)||unitCost<=0||!date||Number.isNaN(new Date(date).getTime()))return;
                if(!productBatches.has(item.productId))productBatches.set(item.productId,{title:item.titleSnapshot||inventoryProducts.find(p=>p.id===item.productId)?.title||'Товар',batches:[]});
                productBatches.get(item.productId).batches.push({date,quantity,unitCost,supplier:order.supplier||'Поставщик не указан'});
            });
        }));
        const alerts=[];
        productBatches.forEach(row=>{
            const batches=row.batches.sort((a,b)=>new Date(a.date)-new Date(b.date));
            for(let index=1;index<batches.length;index++){
                const previous=batches[index-1],current=batches[index];
                if(!inRange(current.date)||previous.unitCost<=0)continue;
                const increase=(current.unitCost-previous.unitCost)/previous.unitCost*100;
                if(increase>=10)alerts.push({...row,previous,current,increase});
            }
        });
        alerts.sort((a,b)=>b.increase-a.increase);
        priceAlertRoot.innerHTML=alerts.length?'<div class="inventory-price-alert-list">'+alerts.slice(0,12).map(alert=>{
            return '<div class="inventory-price-alert-row"><div><strong>'+escapeBookingHtml(alert.title)+'</strong><small>'+escapeBookingHtml(alert.previous.supplier)+' → '+escapeBookingHtml(alert.current.supplier)+' · '+new Date(alert.current.date).toLocaleDateString('ru-RU')+'</small></div><div><b>+'+alert.increase.toFixed(1)+'%</b><span>'+fmt(alert.previous.unitCost)+' → '+fmt(alert.current.unitCost)+'/ед.</span><small>Новая партия: '+alert.current.quantity+' шт.</small></div></div>';
        }).join('')+'</div>':'<div class="inventory-empty compact">В выбранном периоде не обнаружено повышений закупочной цены на 10% и более относительно предыдущей принятой партии</div>';
    }
    const restock=low.slice().sort((a,b)=>(a.stock-a.minStock)-(b.stock-b.minStock));
    restockRoot.innerHTML=restock.length?restock.map(item=>'<div class="inventory-movement-row"><div><strong>'+escapeBookingHtml(item.title)+'</strong><small>Остаток: '+item.stock+' '+escapeBookingHtml(item.unit)+' · минимум: '+item.minStock+' · рекомендуется добавить '+Math.max(0,item.minStock-item.stock)+'</small></div><span class="is-negative">'+(item.stock<=0?'Нет': 'Мало')+'</span></div>').join(''):'<div class="inventory-empty compact">Все активные товары выше минимального остатка</div>';
    const note=document.getElementById('inventoryAnalyticsNote');
    if(note)note.textContent='* Себестоимость рассчитывается по цене закупки, сохранённой в момент продажи. Для старых чеков без снимка используется текущая закупочная цена товара. Для '+costUnknownUnits+' проданных единиц себестоимость неизвестна; ещё для '+returnedCostUnknownUnits+' возвращённых единиц себестоимость восстановить не удалось. Прибыль может быть неполной.';
}

function renderInventory() {
    if (!requireAdminAction('Управлять складом может только Али')) return;
    syncClientCatalogFromClientApp(false);
    const root = document.getElementById('inventoryCatalog');
    if (!root) return;
    const totalUnits = inventoryProducts.reduce((sum,item) => sum + item.stock, 0);
    const stockCost = inventoryProducts.reduce((sum,item) => sum + item.stock * item.purchasePrice, 0);
    const low = inventoryProducts.filter(item => item.active && item.stock <= item.minStock);
    const active = inventoryProducts.filter(item => item.active);
    const summary = document.getElementById('inventoryOverview');
    if (summary) summary.innerHTML =
        '<div class="inventory-kpi"><span>Активных товаров</span><strong>' + active.length + '</strong></div>' +
        '<div class="inventory-kpi"><span>Единиц на складе</span><strong>' + totalUnits.toLocaleString('ru-RU') + '</strong></div>' +
        '<div class="inventory-kpi"><span>Закупочная стоимость остатков</span><strong>' + Math.round(stockCost).toLocaleString('ru-RU') + ' ₽</strong></div>' +
        '<div class="inventory-kpi ' + (low.length ? 'is-warning' : '') + '"><span>Ниже минимума</span><strong>' + low.length + '</strong></div>';
    const query = (document.getElementById('inventorySearch')?.value || '').trim().toLowerCase();
    const category = document.getElementById('inventoryCategoryFilter')?.value || 'all';
    const filtered = inventoryProducts.filter(item => (category === 'all' || item.category === category) &&
        (!query || [item.title,item.sku,item.category].some(value => value.toLowerCase().includes(query))));
    const categories = [...new Set(inventoryProducts.map(item => item.category))].sort((a,b) => a.localeCompare(b,'ru'));
    const filter = document.getElementById('inventoryCategoryFilter');
    if (filter) {
        const previous = filter.value || 'all';
        filter.innerHTML = '<option value="all">Все категории</option>' + categories.map(value => '<option value="' + escapeBookingHtml(value) + '">' + escapeBookingHtml(value) + '</option>').join('');
        filter.value = categories.includes(previous) ? previous : 'all';
    }
    root.innerHTML = filtered.length ? filtered.map(item => {
        const isLow = item.stock <= item.minStock;
        const isOut = item.stock <= 0;
        return '<article class="inventory-product-card ' + (isLow ? 'is-low' : '') + '">' +
            '<div class="inventory-product-main"><div><span class="inventory-product-category">' + escapeBookingHtml(item.category) + '</span><h3>' + escapeBookingHtml(item.title) + '</h3><small>' + escapeBookingHtml(item.brand || 'Товар') + ' · Артикул: ' + escapeBookingHtml(item.sku || '—') + '</small>' +
            (item.description ? '<p class="inventory-product-description">' + escapeBookingHtml(item.description) + '</p>' : '') + '</div>' +
            '<span class="inventory-stock-state ' + (isLow ? 'is-low' : '') + '">' + (isOut ? 'Нет остатка' : (isLow ? 'Ниже минимума' : 'В наличии')) + '</span></div>' +
            '<div class="inventory-product-metrics"><div><span>Остаток</span><strong>' + item.stock.toLocaleString('ru-RU') + ' ' + escapeBookingHtml(item.unit) + '</strong></div><div><span>Мин. остаток</span><strong>' + item.minStock.toLocaleString('ru-RU') + ' ' + escapeBookingHtml(item.unit) + '</strong></div><div><span>Цена продажи</span><strong>' + Math.round(item.salePrice).toLocaleString('ru-RU') + ' ₽</strong></div><div><span>Закупка</span><strong>' + (item.purchasePrice > 0 ? Math.round(item.purchasePrice).toLocaleString('ru-RU') + ' ₽' : 'Не задана') + '</strong></div></div>' +
            '<div class="inventory-product-actions"><button type="button" onclick="openInventoryProductModal(\'' + item.id + '\')">Изменить</button><button type="button" onclick="openInventoryMovementModal(\'' + item.id + '\',\'receipt\')">＋ Приход</button><button type="button" onclick="openInventoryMovementModal(\'' + item.id + '\',\'writeoff\')">− Списание</button></div></article>';
    }).join('') : '<div class="inventory-empty"><strong>' + (inventoryProducts.length ? 'Ничего не найдено' : 'Каталог пока пуст') + '</strong><span>' + (inventoryProducts.length ? 'Измени поисковый запрос или категорию.' : 'Добавь первые товары, укажи закупочную и розничную цену, а затем фиксируй приход и списание.') + '</span></div>';
    renderInventoryMovementHistory();
}
function getRetailInventoryIntegrityIssues(){
    const issues=[];
    clientRetailSales.forEach(sale=>{
        const saleItems=Array.isArray(sale.items)?sale.items:[];
        saleItems.forEach(item=>{
            const linked=inventoryMovements.filter(move=>move.saleId===sale.id&&move.type==='sale'&&(item.stockMovementId?move.id===item.stockMovementId:move.productId===item.productId));
            const soldQty=Number(item.quantity)||0;
            const movementQty=linked.reduce((sum,move)=>sum+(Number(move.quantity)||0),0);
            if(linked.length!==1||Math.abs(movementQty-soldQty)>0.001||linked[0]?.productId!==item.productId){
                issues.push({title:'Продажа не совпадает со складским списанием',detail:'Чек '+String(sale.id).slice(-8)+' · '+(item.titleSnapshot||'Товар')+' · движений: '+linked.length+', списано: '+movementQty+'/'+soldQty});
            }
        });
        (Array.isArray(sale.refunds)?sale.refunds:[]).forEach(refund=>{
            const linked=inventoryMovements.filter(move=>move.refundId===refund.id&&move.saleId===sale.id&&move.type==='return');
            const expected=new Map();
            (Array.isArray(refund.items)?refund.items:[]).forEach(item=>expected.set(String(item.productId),(expected.get(String(item.productId))||0)+(Number(item.quantity)||0)));
            const actual=new Map();
            linked.forEach(move=>actual.set(String(move.productId),(actual.get(String(move.productId))||0)+(Number(move.quantity)||0)));
            const keys=new Set([...expected.keys(),...actual.keys()]);
            const mismatch=[...keys].some(key=>Math.abs((expected.get(key)||0)-(actual.get(key)||0))>0.001);
            if(mismatch){
                issues.push({title:'Возврат не совпадает со складским приходом',detail:'Возврат '+String(refund.id).slice(-8)+' · чек '+String(sale.id).slice(-8)+' · движений: '+linked.length});
            }
        });
    });
    const retailSaleIds=new Set(clientRetailSales.map(sale=>String(sale.id)));
    inventoryMovements.filter(move=>move.type==='sale'&&move.saleId&&retailSaleIds.has(String(move.saleId))).forEach(move=>{
        const sale=clientRetailSales.find(item=>String(item.id)===String(move.saleId));
        const linkedItems=(sale?.items||[]).filter(item=>item.stockMovementId?String(item.stockMovementId)===String(move.id):String(item.productId)===String(move.productId));
        if(linkedItems.length!==1)issues.push({title:'Складское списание привязано неоднозначно',detail:'Движение '+String(move.id).slice(-8)+' · чек '+String(move.saleId).slice(-8)});
    });
    return issues;
}
function getInventoryStockIntegrityIssues(){
    const issues=[];
    const movementTypes=new Set(['receipt','return','sale','writeoff','supplier_return']);
    inventoryProducts.forEach(product=>{
        const productMoves=inventoryMovements.filter(move=>String(move.productId)===String(product.id));
        const actual=Number(product.stock);
        if(!Number.isSafeInteger(actual)||actual<0){
            issues.push({title:'Некорректный фактический остаток',detail:(product.title||'Товар')+' · записано: '+String(product.stock)});
            return;
        }
        if(!productMoves.length){
            if(actual>0)issues.push({title:'Остаток без истории движений',detail:(product.title||'Товар')+' · на складе '+actual+' '+(product.unit||'шт.')+' · исходный остаток не подтверждён журналом'});
            return;
        }
        let expected=0,canReconcile=true;
        productMoves.forEach(move=>{
            if(!movementTypes.has(move.type)){
                issues.push({title:'Неизвестный тип складского движения',detail:(product.title||'Товар')+' · '+String(move.type||'без типа')+' · движение '+String(move.id||'').slice(-8)});
                canReconcile=false;
                return;
            }
            const quantity=Number(move.quantity);
            if(!Number.isSafeInteger(quantity)||quantity===0){
                issues.push({title:'Некорректное количество в журнале',detail:(product.title||'Товар')+' · движение '+String(move.id||'').slice(-8)+' · '+String(move.quantity)});
                canReconcile=false;
                return;
            }
            if((move.type==='receipt'||move.type==='return'||move.type==='sale'||move.type==='writeoff')&&quantity<0){
                issues.push({title:'Неверный знак количества движения',detail:(product.title||'Товар')+' · '+move.type+' · движение '+String(move.id||'').slice(-8)});
                canReconcile=false;
                return;
            }
            if(move.type==='supplier_return'&&quantity>0){
                issues.push({title:'Неверный знак возврата поставщику',detail:(product.title||'Товар')+' · движение '+String(move.id||'').slice(-8)});
                canReconcile=false;
                return;
            }
            expected+=move.type==='receipt'||move.type==='return' ? quantity : move.type==='sale'||move.type==='writeoff' ? -quantity : quantity;
        });
        if(!Number.isSafeInteger(expected)){
            issues.push({title:'Не удалось рассчитать остаток по журналу',detail:product.title||'Товар'});
            return;
        }
        if(canReconcile&&expected<0){
            issues.push({title:'Журнал приводит к отрицательному остатку',detail:(product.title||'Товар')+' · расчётный остаток: '+expected});
            canReconcile=false;
        }
        if(canReconcile&&actual!==expected){
            issues.push({title:'Фактический остаток не совпадает с журналом',detail:(product.title||'Товар')+' · на складе '+actual+', по движениям '+expected+' '+(product.unit||'шт.')});
        }
    });
    return issues;
}
function renderInventoryMovementHistory(){
    const history=document.getElementById('inventoryMovementHistory');
    if(!history)return;
    const search=(document.getElementById('inventoryMovementSearch')?.value||'').trim().toLocaleLowerCase('ru');
    const type=document.getElementById('inventoryMovementTypeFilter')?.value||'all';
    const labels={return:'Возврат',sale:'Продажа',receipt:'Приход',writeoff:'Списание',supplier_return:'Возврат поставщику'};
    const sorted=inventoryMovements.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const filtered=sorted.filter(move=>{
        if(type!=='all'&&move.type!==type)return false;
        if(!search)return true;
        const product=inventoryProducts.find(item=>item.id===move.productId);
        const haystack=[move.productTitle,product?.title,move.note,move.supplier,move.saleId,move.refundId,move.purchaseOrderId,move.createdAt].filter(Boolean).join(' ').toLocaleLowerCase('ru');
        return haystack.includes(search);
    });
    const shown=filtered.slice(0,inventoryMovementHistoryLimit);
    const retailIssues=getRetailInventoryIntegrityIssues();
    const stockIssues=getInventoryStockIntegrityIssues();
    const integrityIssues=retailIssues.concat(stockIssues);
    const integrityBanner=integrityIssues.length
        ?'<div class="inventory-empty" style="border-color:var(--danger,#dc6262);margin-bottom:12px"><strong>Проверка склада: '+integrityIssues.length+' замечаний</strong>'+integrityIssues.slice(0,7).map(issue=>'<small>'+escapeBookingHtml(issue.title)+' · '+escapeBookingHtml(issue.detail)+'</small>').join('')+(integrityIssues.length>7?'<small>И ещё '+(integrityIssues.length-7)+' замечаний</small>':'')+'</div>'
        :'<div class="inventory-empty compact" style="margin-bottom:12px">Товарные чеки и фактические остатки сверены с журналом · расхождений нет</div>';
    history.innerHTML=integrityBanner+(shown.length?shown.map(move=>{
        const positive=move.type==='receipt'||move.type==='return';
        const label=labels[move.type]||'Движение';
        const date=new Date(move.createdAt);
        const dateLabel=Number.isNaN(date.getTime())?'Дата не указана':date.toLocaleString('ru-RU');
        const costLabel=move.unitCost!==null&&move.unitCost!==undefined?' · Себестоимость: '+Number(move.unitCost).toLocaleString('ru-RU')+' ₽/ед.':'';
        const quantity=Math.abs(Number(move.quantity)||0);
        return '<div class="inventory-movement-row"><div><strong>'+escapeBookingHtml(move.productTitle||'Товар')+'</strong><small>'+dateLabel+' · '+label+(move.supplier?' · Поставщик: '+escapeBookingHtml(move.supplier):'')+costLabel+' · '+escapeBookingHtml(move.note||'Без комментария')+'</small></div><span class="'+(positive?'is-positive':'is-negative')+'">'+(positive?'+':'−')+quantity+'</span></div>';
    }).join(''):'<div class="inventory-empty compact">'+(inventoryMovements.length?'По заданным условиям движений не найдено':'Движений пока нет')+'</div>');
    const meta=document.getElementById('inventoryMovementHistoryMeta');
    if(meta)meta.textContent='Показано '+shown.length+' из '+filtered.length+' движений';
    const more=document.getElementById('inventoryMovementHistoryMore');
    if(more)more.hidden=shown.length>=filtered.length;
}
function showMoreInventoryMovements(){
    inventoryMovementHistoryLimit+=24;
    renderInventoryMovementHistory();
}
function openInventoryProductModal(id = '') {
    if (!requireAdminAction('Управлять складом может только Али')) return;
    editingInventoryProductId = id || null;
    const item = id ? inventoryProducts.find(product => product.id === id) : null;
    document.getElementById('inventoryProductTitle').textContent = item ? 'Изменить товар' : 'Новый товар';
    document.getElementById('inventoryProductName').value = item?.title || '';
    document.getElementById('inventoryProductSku').value = item?.sku || '';
    document.getElementById('inventoryProductCategory').value = item?.category || '';
    document.getElementById('inventoryProductUnit').value = item?.unit || 'шт.';
    document.getElementById('inventoryProductPurchase').value = item?.purchasePrice || '';
    document.getElementById('inventoryProductSale').value = item?.salePrice ?? '';
    document.getElementById('inventoryProductMin').value = item?.minStock ?? 0;
    document.getElementById('inventoryProductStock').value = item?.stock ?? 0;
    document.getElementById('inventoryProductStock').disabled = Boolean(item);
    openModal('inventoryProductModal');
}
function saveInventoryProduct() {
    if (!requireAdminAction('Управлять складом может только Али')) return;
    const title = document.getElementById('inventoryProductName').value.trim();
    const sku = document.getElementById('inventoryProductSku').value.trim();
    const category = document.getElementById('inventoryProductCategory').value.trim() || 'Без категории';
    const unit = document.getElementById('inventoryProductUnit').value.trim() || 'шт.';
    const purchasePrice = Number(document.getElementById('inventoryProductPurchase').value);
    const salePrice = Number(document.getElementById('inventoryProductSale').value);
    const minStock = Number(document.getElementById('inventoryProductMin').value);
    const openingStock = Number(document.getElementById('inventoryProductStock').value);
    if (!title || !Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(salePrice) || salePrice < 0 ||
        !Number.isSafeInteger(minStock) || minStock < 0 || !Number.isSafeInteger(openingStock) || openingStock < 0) {
        return showToast('Проверь название, цены и целые неотрицательные остатки товара', 'error');
    }
    if (sku && inventoryProducts.some(item => String(item.sku || '').toLowerCase() === sku.toLowerCase() && item.id !== editingInventoryProductId)) {
        return showToast('Такой артикул уже используется', 'error');
    }
    const now = new Date().toISOString();
    if (editingInventoryProductId) {
        const item = inventoryProducts.find(product => product.id === editingInventoryProductId);
        if (!item) return;
        Object.assign(item,{title,sku,category,unit,purchasePrice,salePrice,minStock,updatedAt:now});
    } else {
        const item = {id:'prd_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),title,sku,category,unit,purchasePrice,salePrice,minStock,stock:0,active:true,updatedAt:now};
        inventoryProducts.push(item);
        if (openingStock > 0) {
            item.stock = openingStock;
            const openingUnitCost=purchasePrice>0?purchasePrice:null;
            inventoryMovements.push({id:'mov_' + Date.now()+'_'+Math.random().toString(36).slice(2,7),productId:item.id,productTitle:item.title,type:'receipt',quantity:openingStock,unitCost:openingUnitCost,totalCost:openingUnitCost===null?null:openingUnitCost*openingStock,note:'Начальный остаток',createdAt:now});
        }
    }
    persistInventory();
    closeModal('inventoryProductModal');
    renderInventory();
    showToast(editingInventoryProductId ? 'Товар обновлён' : 'Товар добавлен', 'success');
}
function openInventoryMovementModal(id, type) {
    if (!requireAdminAction('Управлять складом может только Али')) return;
    const item = inventoryProducts.find(product => product.id === id);
    if (!item) return;
    document.getElementById('inventoryMovementProductId').value = id;
    document.getElementById('inventoryMovementType').value = type;
    document.getElementById('inventoryMovementTitle').textContent = type === 'receipt' ? 'Приход товара' : 'Списание товара';
    document.getElementById('inventoryMovementProduct').textContent = item.title + ' · остаток ' + item.stock + ' ' + item.unit;
    document.getElementById('inventoryMovementQuantity').value = '';
    document.getElementById('inventoryMovementNote').value = '';
    document.getElementById('inventoryMovementSupplier').value = '';
    document.getElementById('inventoryMovementUnitCost').value = '';
    document.getElementById('inventoryMovementSupplierGroup').style.display = type === 'receipt' ? '' : 'none';
    document.getElementById('inventoryMovementCostGroup').style.display = type === 'receipt' ? '' : 'none';
    openModal('inventoryMovementModal');
}
function saveInventoryMovement() {
    if (!requireAdminAction('Управлять складом может только Али')) return;
    const id = document.getElementById('inventoryMovementProductId').value;
    const type = document.getElementById('inventoryMovementType').value;
    const quantity = Number(document.getElementById('inventoryMovementQuantity').value);
    const item = inventoryProducts.find(product => product.id === id);
    const supplier = document.getElementById('inventoryMovementSupplier').value.trim();
    const unitCostRaw = document.getElementById('inventoryMovementUnitCost').value.trim();
    const unitCost = unitCostRaw === '' ? null : Number(unitCostRaw);
    if (!item || !['receipt','writeoff'].includes(type)) return showToast('Не удалось определить товар или тип складской операции','error');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return showToast('Укажи целое количество больше нуля','error');
    const previousStock=Number(item.stock);
    if (!Number.isSafeInteger(previousStock) || previousStock < 0) return showToast('Текущий остаток товара некорректен. Сначала проверь склад','error');
    if (type === 'writeoff' && quantity > previousStock) return showToast('Нельзя списать больше, чем есть на складе', 'error');
    const nextStock=type==='receipt'?previousStock+quantity:previousStock-quantity;
    if (!Number.isSafeInteger(nextStock) || nextStock < 0) return showToast('Операция приведёт к некорректному остатку. Проверь количество','error');
    if (type === 'receipt' && unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) return showToast('Проверь закупочную цену за единицу', 'error');
    const now=new Date().toISOString();
    if (type === 'receipt' && unitCost !== null) {
        item.purchasePrice = previousStock > 0 && Number(item.purchasePrice) > 0
            ? ((previousStock * Number(item.purchasePrice)) + (quantity * unitCost)) / nextStock
            : unitCost;
    }
    item.stock=nextStock;
    item.updatedAt=now;
    inventoryMovements.push({
        id:'mov_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        productId:item.id,
        productTitle:item.title,
        type,
        quantity,
        supplier: type === 'receipt' ? supplier : '',
        unitCost: type === 'receipt' ? unitCost : null,
        totalCost: type === 'receipt' && unitCost !== null ? quantity * unitCost : null,
        note:document.getElementById('inventoryMovementNote').value.trim(),
        createdAt:now
    });
    persistInventory();
    closeModal('inventoryMovementModal');
    renderInventory();
    showToast(type === 'receipt' ? 'Приход зафиксирован' : 'Списание зафиксировано', 'success');
}
