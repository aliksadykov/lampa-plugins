(function () {
    'use strict';

    var MODES = {
        added: 'По дате добавления',
        title: 'По алфавиту',
        date: 'По дате выхода (новые сверху)'
    };

    function active() {
        try { return Lampa.Activity.active(); } catch (e) { return null; }
    }

    function isFav(act) {
        return act && act.component === 'favorite';
    }

    // отдельный ключ для каждой вкладки (+ фильтр фильмы/сериалы, если есть)
    function keyFor(act) {
        return 'cfsort_' + (act.type || 'all') + (act.filter ? '_' + act.filter : '');
    }

    function getMode(act) {
        return Lampa.Storage.get(keyFor(act), 'added');
    }

    function title(c) {
        return (c.title || c.name || c.original_title || c.original_name || '').toLowerCase();
    }

    function date(c) {
        return c.release_date || c.first_air_date || '';
    }

    function sortCards(list, mode) {
        if (!Array.isArray(list) || mode === 'added') return list;
        var arr = list.slice();
        if (mode === 'title') {
            arr.sort(function (a, b) {
                return title(a).localeCompare(title(b), ['ru', 'uk', 'en']);
            });
        } else if (mode === 'date') {
            arr.sort(function (a, b) {
                var da = date(a), db = date(b);
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return da < db ? 1 : da > db ? -1 : 0;
            });
        }
        return arr;
    }

    function hookGet() {
        var prev = Lampa.Favorite.get;
        Lampa.Favorite.get = function (params) {
            var res = prev.apply(this, arguments);
            var act = active();
            // сортируем только когда открыта страница закладок этой же вкладки
            if (params && isFav(act) && act.type === params.type) {
                return sortCards(res, getMode(act));
            }
            return res;
        };
    }

    function refresh(act) {
        try {
            Lampa.Activity.replace({ page: 1 });
        } catch (e) {
            var copy = {};
            ['url', 'title', 'component', 'type', 'filter', 'page'].forEach(function (k) {
                if (act[k] !== undefined) copy[k] = act[k];
            });
            copy.page = 1;
            Lampa.Activity.back();
            setTimeout(function () { Lampa.Activity.push(copy); }, 100);
        }
    }

    function openMenu() {
        var act = active();
        if (!isFav(act)) return;

        var current = getMode(act);
        var prev = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: 'Сортировка',
            items: Object.keys(MODES).map(function (k) {
                return { title: MODES[k], value: k, selected: k === current };
            }),
            onBack: function () {
                Lampa.Controller.toggle(prev);
            },
            onSelect: function (item) {
                Lampa.Storage.set(keyFor(act), item.value);
                Lampa.Controller.toggle(prev);
                refresh(act);
            }
        });
    }

    function addButton() {
        var btn = $(
            '<div class="head__action head__settings selector custom-sort-btn" style="display:none">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
            '</svg></div>'
        );

        btn.on('hover:enter click', openMenu);
        $('.head .head__actions').prepend(btn);

        // показываем кнопку только на страницах закладок
        setInterval(function () {
            btn.toggle(isFav(active()));
        }, 700);
    }

    function start() {
        // ждём, пока плагин закладок поставит свою обёртку Favorite.get,
        // чтобы наша была поверх неё
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            if (window.custom_favorites || tries > 50) {
                clearInterval(timer);
                hookGet();
                addButton();
            }
        }, 200);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
    });
})();
