// ==UserScript==
// @name         RuTube Cleaner by dah9
// @namespace    https://github.com/dah9l
// @version      1.4
// @description  Удаляет лишние элементы интерфейса RuTube: кнопки подписки, безопасный режим, футер и прочее
// @author       dah9
// @match        *://rutube.ru/*
// @icon         https://rutube.ru/favicon.ico
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/dah9l/RuTube-Cleaner
// @updateURL    https://raw.githubusercontent.com/dah9l/RuTube-Cleaner/main/rutube-clean.user.js
// @downloadURL  https://raw.githubusercontent.com/dah9l/RuTube-Cleaner/main/rutube-clean.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =============================================
    // Тексты элементов для удаления (Set для O(1) поиска)
    // =============================================
    const TEXTS_TO_REMOVE = new Set([
        'Оформить подписку',
        'Активировать промокод',
        'Безопасный режим',
        'RUTUBE x PREMIER',
        'RUTUBE x START',
        'RUTUBE всегда с вами',
        'Больше от Rutube',
        'Больше от RUTUBE',
        'RUTUBE детям',
        'RUTUBE Детям',
        'RUTUBE Спорт',
        'RUTUBE спорт',
        'Rutube в других соцсетях',
        'RUTUBE в других соцсетях',
        'Вопросы и ответы',
        'Сообщить о проблеме',
        'Написать в поддержку',
        'help@rutube.ru',
        'О RUTUBE',
        'О Rutube',
        'Направления деятельности',
        'Пользовательское соглашение',
        'Конфиденциальность',
        'Правовая информация',
        'Рекомендательная система',
        'Фирменный стиль',
    ]);

    // =============================================
    // Ссылки для удаления — единый regex вместо массива .some()
    // =============================================
    const HREFS_RE = /\/info\/(?:about|activity|agreement|privacy|legal|recommendatory|recomlegal|brandbook|faq|report|support)|\/brand\/|help@rutube\.ru|premier\.one|start\.ru|apps\.apple\.com|play\.google\.com|appgallery\.huawei\.com|apps\.rustore\.ru|nashstore\.ru|vk\.com\/rutube|t\.me\/rutube|ok\.ru\/rutube|dzen\.ru\/rutube|tiktok\.com\/@rutube/;

    // Ссылки, которые удаляем ТОЛЬКО внутри футера (не из бокового меню)
    const HREFS_FOOTER_RE = /\/apps|smarttv|\/kids|\/sport/;

    // =============================================
    // CSS-селекторы — объединённый селектор (один querySelectorAll вместо 15)
    // =============================================
    const COMBINED_SELECTOR = [
        '.premium-subscription-entrypoint-module__premium-entrypoint',
        '.safe-mode-header-entrypoint-module__entrypoint',
        '[class*="app-banner"]',
        '[class*="app-download"]',
        '[class*="apps-module"]',
        '[class*="mobile-app"]',
        '[class*="download-app"]',
        '[class*="menu-guide-module"]',
        'ul[aria-label="Оставте отзыв"]',
        'ul[aria-label="Оставьте отзыв"]',
        'li:has(> a[href="/feeds/premier/"])',
        'li:has(> a[href="/feeds/start/"])',
        '[class*="wdp-footer"]',
        '[class*="bottom-footer"]',
        '[class*="page-footer-module"]',
        'footer[class*="footer-module"]:not([class*="menu-footer"])',
    ].join(', ');

    // Regex для иконок магазинов приложений
    const APP_STORE_RE = /app.store|google.play|rustore|huawei|nashstore|скачать|appgallery/i;

    // Regex для копирайта
    const COPYRIGHT_RE = /^©\s*\d{4},?\s*RUTUBE$/i;
    const COPYRIGHT_HTML = '© 2026, RUTUBE edit by <a href="https://github.com/dah9l" target="_blank" rel="noopener noreferrer" style="color: #00A1E7; text-decoration: underline;">dah9</a>';

    // Кэш для проверок принадлежности к меню/навигации/футеру (WeakMap — не мешает GC)
    const menuCache = new WeakMap();
    const navCache = new WeakMap();
    const footerCache = new WeakMap();

    /**
     * Удаляет элемент и, если родитель пуст, удаляет и его
     */
    function removeElement(el) {
        if (!el || !el.parentElement) return;
        const parent = el.parentElement;
        el.remove();
        if (parent.children.length === 0 && parent.textContent.trim() === '') {
            parent.remove();
        }
    }

    /**
     * Проверяет, находится ли элемент внутри бокового меню (с кэшем)
     */
    function isInsideMenu(el) {
        if (menuCache.has(el)) return menuCache.get(el);
        let current = el;
        while (current) {
            if (current.className && /menu-content-module|wdp-mobile-menu/i.test(current.className)) {
                menuCache.set(el, true);
                return true;
            }
            current = current.parentElement;
        }
        menuCache.set(el, false);
        return false;
    }

    /**
     * Проверяет, является ли элемент навигационным пунктом меню (с кэшем)
     */
    function isNavigationItem(el) {
        if (navCache.has(el)) return navCache.get(el);
        const re = /menu-link-module|menu-links-module|navigation_group/i;
        let current = el;
        for (let i = 0; i < 4 && current; i++) {
            if (current.className && re.test(current.className)) {
                navCache.set(el, true);
                return true;
            }
            current = current.parentElement;
        }
        navCache.set(el, false);
        return false;
    }

    /**
     * Проверяет, находится ли элемент внутри футера (с кэшем)
     */
    function isInsideFooter(el) {
        if (footerCache.has(el)) return footerCache.get(el);
        let current = el;
        while (current) {
            if (current.tagName === 'FOOTER' ||
                (current.className && /footer|bottom-content/i.test(current.className))) {
                footerCache.set(el, true);
                return true;
            }
            current = current.parentElement;
        }
        footerCache.set(el, false);
        return false;
    }

    /**
     * Находит ближайший «значимый» родительский блок
     * Внутри бокового меню — поднимается только до <li> или section menu-info
     */
    function findBlockParent(el) {
        if (isInsideMenu(el)) {
            return el.closest('li') ||
                   el.closest('[class*="menu-info-module__wrapper"]') ||
                   null;
        }
        let current = el.parentElement;
        const stopRe = /menu-content|application-module|wdp-mobile-menu|sidebar|main-content/i;
        const blockRe = /footer|section|block|card|banner|widget|group|entrypoint/i;
        for (let i = 0; i < 6 && current; i++) {
            if (current.tagName === 'NAV' || (current.className && stopRe.test(current.className))) return null;
            if (['SECTION', 'ARTICLE', 'ASIDE'].includes(current.tagName)) return current;
            if (current.className && blockRe.test(current.className)) return current;
            current = current.parentElement;
        }
        return null;
    }

    /**
     * Удаляет элемент вместе с родительским блоком (если найден)
     */
    function removeWithParent(el) {
        const block = findBlockParent(el);
        removeElement(block || el);
    }

    // =============================================
    // Флаг для приостановки observer во время очистки
    // =============================================
    let cleaning = false;

    /**
     * Основная функция очистки
     */
    function cleanPage() {
        if (cleaning) return;
        cleaning = true;

        try {
            // 1. Удалить по объединённому CSS-селектору (один вызов вместо 15)
            document.querySelectorAll(COMBINED_SELECTOR).forEach(removeElement);

            // 2. Удалить элементы по тексту + ссылки по href (один обход DOM)
            document.querySelectorAll('a, button, span, div, p, h1, h2, h3, h4, h5, h6, li, section').forEach(el => {
                if (isNavigationItem(el)) return;

                // Проверка текста
                const text = el.textContent.trim();
                if (TEXTS_TO_REMOVE.has(text)) {
                    removeWithParent(el);
                    return;
                }

                // Проверка href (только для ссылок, совмещаем шаги 3 и 5)
                if (el.tagName === 'A') {
                    const href = el.getAttribute('href') || '';
                    if (HREFS_RE.test(href)) {
                        removeWithParent(el);
                    } else if (HREFS_FOOTER_RE.test(href) && isInsideFooter(el)) {
                        removeWithParent(el);
                    }
                }
            });

            // 3. Удалить кнопки скачивания приложений по иконкам
            document.querySelectorAll('img[src], img[alt]').forEach(img => {
                const alt = img.getAttribute('alt') || '';
                const src = img.getAttribute('src') || '';
                if (APP_STORE_RE.test(alt) || APP_STORE_RE.test(src)) {
                    removeWithParent(img.closest('a') || img);
                }
            });

            // 4. Изменить копирайт
            document.querySelectorAll('[class*="copyright"], [class*="menu-info-module"] p, footer p, footer span').forEach(el => {
                if (el.childElementCount === 0 && COPYRIGHT_RE.test(el.textContent.trim())) {
                    el.innerHTML = COPYRIGHT_HTML;
                }
            });

        } finally {
            cleaning = false;
        }
    }

    // =============================================
    // Запуск: первичная очистка + наблюдатель за DOM
    // =============================================

    // Первый запуск — быстро + повтор после полной загрузки SPA
    setTimeout(cleanPage, 1000);
    setTimeout(cleanPage, 3000);

    // MutationObserver — с debounce и проверкой флага cleaning
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        if (cleaning) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(cleanPage, 400);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // Очистка при SPA-навигации
    const origPush = history.pushState;
    history.pushState = function () {
        origPush.apply(this, arguments);
        setTimeout(cleanPage, 800);
    };
    window.addEventListener('popstate', () => setTimeout(cleanPage, 800));

    console.log('[RuTube Cleaner by dah9] v1.4 загружен');
})();
