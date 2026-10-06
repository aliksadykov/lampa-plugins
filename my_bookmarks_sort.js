(function () {
    'use strict';

    var DEBUG = true; // false убирает всплывающее сообщение после выбора

    var MODES = {
        added: 'По дате добавления',
        title: 'По алфавиту',
        date: 'По дате выхода (новые сверху)'
    };

    var SORT_ICON =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M7 4V20M7 20L4 17M7 20L10 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M17 20V4M17 4L14 7M17 4L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

    var button = null;
    var stat = { calls: 0, total: 0, withDate: 0 };

    function active() {
        try { return Lampa.Activity.active(); } catch (e) { return null; }
    }

    function isFav(act) {
        return !!(act && act.component === 'favorite' && act.type);
    }

    // ключ только по типу вкладки (как раньше, сохранённые настройки не пропадут)
    function keyFor(type) { return 'cfsort_' + type; }

    function getMode(type) {
        var mode = Lampa.Storage.get(keyFor(type), 'added');
        return MODES[mode] ? mode : 'added';
    }

    function getTitle(c) {
        return String(c.title || c.name || c.original_title || c.original_name || '').trim();
    }

    function getDate(c) {
        return String(c.release_date || c.first_air_date || '').trim();
    }

    function sortCards(list, mode) {
        if (!Array.isArray(list)) return list;

        stat.calls++;
        stat.total = list.length;
        stat.withDate = list.filter(getDate).length;

        if (mode === 'added') return list;

        var indexed = list.map(function (card, index) {
            return { card: card, index: index };
        });

        indexed.sort(function (a, b) {
            var result = 0;

            if (mode === 'title') {
                try {
                    result = getTitle(a.card).localeCompare(
                        getTitle(b.card),
                        ['ru', 'uk', 'en'],
                        { sensitivity: 'base', numeric: true }
                    );
                } catch (e) {
                    var ta = getTitle(a.card).toLowerCase();
                    var tb = getTitle(b.card).toLowerCase();
                    result = ta < tb ? -1 : ta > tb ? 1 : 0;
                }
            }

            if (mode === 'date') {
                var da = getDate(a.card), db = getDate(b.card);
                // карточки без даты всегда в конце
                if (!da && !db) return a.index - b.index;
                if (!da) return 1;
                if (!db) return -1;
                result = da < db ? 1 : da > db ? -1 : 0; // новые сверху
            }

            // при равенстве сохраняем исходный порядок
            return result !== 0 ? result : a.index - b.index;
        });

        return indexed.map(function (item) { return item.card; });
    }

    function hookGet() {
        if (Lampa.Favorite.__cfSortInstalled) return;
        Lampa.Favorite.__cfSortInstalled = true;

        var prev = Lampa.Favorite.get;

        Lampa.Favorite.get = function (params) {
            var res = prev.apply(this, arguments);
            if (params && params.type) {
                return sortCards(res, getMode(params.type));
            }
            return res;
        };
    }

    function refresh(act) {
        var copy = {};
        ['url', 'title', 'component', 'type', 'filter', 'source'].forEach(function (k) {
            if (act[k] !== undefined) copy[k] = act[k];
        });
        copy.page = 1;

        try {
            Lampa.Activity.replace(copy);
        } catch (e) {
            Lampa.Activity.back();
            setTimeout(function () { Lampa.Activity.push(copy); }, 150);
        }
    }

    function openMenu() {
        var act = active();
        if (!isFav(act)) return;

        var type = act.type;
        var current = getMode(type);
        var prevCtrl = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: 'Сортировка',
            items: Object.keys(MODES).map(function (k) {
                return { title: MODES[k], value: k, selected: k === current };
            }),
            onBack: function () {
                Lampa.Controller.toggle(prevCtrl);
            },
            onSelect: function (item) {
                Lampa.Storage.set(keyFor(type), item.value);
                Lampa.Controller.toggle(prevCtrl);
                stat.calls = 0;
                refresh(act);

                if (DEBUG) {
                    setTimeout(function () {
                        Lampa.Noty.show(
                            MODES[item.value] + ' | вкладка: ' + type +
                            ' | вызовов: ' + stat.calls +
                            ' | карточек: ' + stat.total +
                            ' | с датой: ' + stat.withDate
                        );
                    }, 1500);
                }
            }
        });
    }

    function createButton() {
        if (button) return;

        if (Lampa.Head && typeof Lampa.Head.addIcon === 'function') {
            button = Lampa.Head.addIcon(SORT_ICON, openMenu);
        }

        // запасной вариант, если Head.addIcon недоступен
        if (!button || !button.length) {
            button = $('<div class="head__action head__settings selector">' + SORT_ICON + '</div>');
            button.on('hover:enter click', openMenu);
            $('.head .head__actions').prepend(button);
        }

        button.addClass('custom-sort-btn').attr('title', 'Сортировка');
    }

    function updateButton() {
        createButton();
        if (button) button.toggle(isFav(active()));
    }

    function init() {
        hookGet();
        updateButton();

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' || e.type === 'destroy' || e.type === 'archive') {
                setTimeout(updateButton, 50);
            }
        });
    }

    function start() {
        // ждём, пока my_bookmarks.js поставит свою обёртку Favorite.get,
        // чтобы наша была поверх неё
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            if (window.custom_favorites || tries > 50) {
                clearInterval(timer);
                init();
            }
        }, 200);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
