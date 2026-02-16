// ==UserScript==
// @name         RuTube Cleaner by dah9
// @namespace    https://github.com/dah9l
// @version      1.1
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
    // Тексты элементов для удаления (по содержимому)
    // =============================================
    const TEXTS_TO_REMOVE = [
        'Оформить подписку',
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
    ];

    // =============================================
    // Ссылки для удаления (по href)
    // =============================================
    const HREFS_TO_REMOVE = [
        '/info/about',
        '/info/activity',
        '/info/agreement',
        '/info/privacy',
        '/info/legal',
        '/info/recommendatory',
        '/info/brandbook',
        '/info/faq',
        '/info/report',
        '/info/support',
        'help@rutube.ru',
        'premier.one',
        'start.ru',
        'apps.apple.com',
        'play.google.com',
        'appgallery.huawei.com',
        'apps.rustore.ru',
        'nashstore.ru',
        'vk.com/rutube',
        't.me/rutube',
        'ok.ru/rutube',
        'dzen.ru/rutube',
        'tiktok.com/@rutube',
    ];

    // Ссылки, которые удаляем ТОЛЬКО внутри футера (не из бокового меню)
    const HREFS_TO_REMOVE_FOOTER_ONLY = [
        '/apps',
        'smarttv',
        '/kids',
        '/sport',
    ];

    // =============================================
    // CSS-селекторы для удаления целых блоков
    // =============================================
    const SELECTORS_TO_REMOVE = [
        // Кнопка «Оформить подписку»
        '.premium-subscription-entrypoint-module__premium-entrypoint',
        // Кнопка «Безопасный режим»
        '.safe-mode-header-entrypoint-module__entrypoint',
        // Баннеры скачивания приложения
        '[class*="app-banner"]',
        '[class*="app-download"]',
        '[class*="apps-module"]',
        '[class*="mobile-app"]',
        '[class*="download-app"]',
        // Подвал (футер) — основной контейнер
        '[class*="footer-module"]',
        '[class*="wdp-footer"]',
        '[class*="bottom-footer"]',
    ];

    /**
     * Удаляет элемент и, если родитель пуст, удаляет и его
     */
    function removeElement(el) {
        if (!el) return;
        const parent = el.parentElement;
        el.remove();
        // Если родительский контейнер стал пустым — тоже удаляем
        if (parent && parent.children.length === 0 && parent.textContent.trim() === '') {
            parent.remove();
        }
    }

    /**
     * Находит ближайший «значимый» родительский блок для ссылки/кнопки
     * (секция, блок навигации, карточка и т.д.)
     */
    function findBlockParent(el) {
        let current = el.parentElement;
        const blockTags = ['SECTION', 'ARTICLE', 'NAV', 'ASIDE'];
        // Не поднимаемся выше этих контейнеров — это боковое меню и основной layout
        const stopClasses = /menu-content|application-module|wdp-mobile-menu|sidebar|main-content/i;
        for (let i = 0; i < 6 && current; i++) {
            if (current.className && stopClasses.test(current.className)) return null;
            if (blockTags.includes(current.tagName)) return current;
            if (current.className && (
                /footer|section|block|card|banner|widget|group|entrypoint/i.test(current.className)
            )) return current;
            current = current.parentElement;
        }
        return null;
    }

    /**
     * Проверяет, находится ли элемент внутри бокового меню
     */
    function isInsideMenu(el) {
        let current = el;
        while (current) {
            if (current.className && /menu-content|wdp-mobile-menu|sidebar-module|menu-module/i.test(current.className)) {
                return true;
            }
            if (current.tagName === 'NAV') return true;
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Проверяет, находится ли элемент внутри футера
     */
    function isInsideFooter(el) {
        let current = el;
        while (current) {
            if (current.tagName === 'FOOTER') return true;
            if (current.className && /footer/i.test(current.className)) return true;
            // Блок "bottom-content" — нижняя часть страницы
            if (current.className && /bottom-content|bottom-bar/i.test(current.className)) return true;
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Основная функция очистки
     */
    function cleanPage() {
        // 1. Удалить по CSS-селекторам
        SELECTORS_TO_REMOVE.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => removeElement(el));
            } catch (e) { /* игнорируем ошибки невалидных селекторов */ }
        });

        // 2. Удалить элементы по текстовому содержимому (НЕ в боковом меню)
        const allElements = document.querySelectorAll('a, button, span, div, p, h1, h2, h3, h4, h5, h6, li, section');
        allElements.forEach(el => {
            if (isInsideMenu(el)) return; // Не трогаем боковое меню
            const text = el.textContent.trim();
            TEXTS_TO_REMOVE.forEach(target => {
                if (text === target) {
                    // Попробовать удалить родительский блок
                    const blockParent = findBlockParent(el);
                    if (blockParent) {
                        removeElement(blockParent);
                    } else {
                        removeElement(el);
                    }
                }
            });
        });

        // 3. Удалить ссылки по href (НЕ в боковом меню)
        document.querySelectorAll('a[href]').forEach(a => {
            if (isInsideMenu(a)) return; // Не трогаем боковое меню
            const href = a.getAttribute('href') || '';
            let shouldRemove = HREFS_TO_REMOVE.some(target => href.includes(target));
            // Ссылки, которые удаляем только в футере
            if (!shouldRemove && isInsideFooter(a)) {
                shouldRemove = HREFS_TO_REMOVE_FOOTER_ONLY.some(target => href.includes(target));
            }
            if (shouldRemove) {
                const blockParent = findBlockParent(a);
                if (blockParent) {
                    removeElement(blockParent);
                } else {
                    removeElement(a);
                }
            }
        });

        // 4. Удалить кнопки скачивания приложений (по иконкам app store и т.д.)
        document.querySelectorAll('img[src], img[alt]').forEach(img => {
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const src = (img.getAttribute('src') || '').toLowerCase();
            if (
                alt.includes('app store') ||
                alt.includes('google play') ||
                alt.includes('rustore') ||
                alt.includes('huawei') ||
                alt.includes('nashstore') ||
                alt.includes('скачать') ||
                src.includes('app-store') ||
                src.includes('google-play') ||
                src.includes('rustore') ||
                src.includes('appgallery') ||
                src.includes('nashstore')
            ) {
                const blockParent = findBlockParent(img);
                if (blockParent) {
                    removeElement(blockParent);
                } else {
                    removeElement(img.closest('a') || img);
                }
            }
        });

        // 5. Удалить соцсети (блок с иконками VK, Telegram, OK, Дзен и т.д.)
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (
                href.includes('vk.com/rutube') ||
                href.includes('t.me/rutube') ||
                href.includes('ok.ru/rutube') ||
                href.includes('dzen.ru/rutube') ||
                href.includes('tiktok.com/@rutube')
            ) {
                removeElement(a);
            }
        });

        // 6. Изменить копирайт «© 20XX, RUTUBE» → «© 2026, RUTUBE edit by dah9» + ссылка на GitHub
        const allTextNodes = document.querySelectorAll('*');
        allTextNodes.forEach(el => {
            const text = el.textContent.trim();
            // Ищем элемент, содержащий только копирайт (не родительский контейнер с кучей текста)
            if (/^©\s*\d{4},?\s*RUTUBE$/i.test(text) && el.children.length === 0) {
                el.innerHTML = '© 2026, RUTUBE edit by <a href="https://github.com/dah9l" target="_blank" rel="noopener noreferrer" style="color: #00A1E7; text-decoration: underline;">dah9</a>';
            }
        });

        // Также пробуем найти в контейнерах, где копирайт — часть дочернего элемента
        document.querySelectorAll('span, div, p, small, footer').forEach(el => {
            if (el.childElementCount === 0) {
                const text = el.textContent.trim();
                if (/©\s*\d{4},?\s*RUTUBE/i.test(text) && text.length < 30) {
                    el.innerHTML = '© 2026, RUTUBE edit by <a href="https://github.com/dah9l" target="_blank" rel="noopener noreferrer" style="color: #00A1E7; text-decoration: underline;">dah9</a>';
                }
            }
        });
    }

    // =============================================
    // Запуск: первичная очистка + наблюдатель за DOM
    // =============================================

    // Первый запуск с задержкой, чтобы SPA успел отрисоваться
    setTimeout(cleanPage, 1500);
    setTimeout(cleanPage, 3000);
    setTimeout(cleanPage, 5000);

    // MutationObserver — отслеживает изменения DOM (переходы между страницами SPA)
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(cleanPage, 500);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // Также очищаем при навигации (SPA pushState / popstate)
    const originalPushState = history.pushState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        setTimeout(cleanPage, 1000);
    };
    window.addEventListener('popstate', () => {
        setTimeout(cleanPage, 1000);
    });

    console.log('[RuTube Cleaner by dah9] Скрипт загружен');
})();
