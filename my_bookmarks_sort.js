(function () {
    'use strict';

    var MODES = {
        added: 'По дате добавления',
        title: 'По алфавиту',
        date: 'По дате выхода (новые сверху)'
    };
    var stat = { calls: 0, total: 0, withDate: 0 };

    function active() {
        try { return Lampa.Activity.active(); } catch (e) { return null; }
    }
    function isFav(act) { return act && act.component === 'favorite'; }
    function keyFor(type) { return 'cfsort_' + type; }
    function getMode(type) { return Lampa.Storage.get(keyFor(type), 'added'); }

    function title(c) {
        return String(c.title || c.name || c.original_title || c.original_name || '').toLowerCase();
    }
    function date(c) { return c.release_date || c.first_air_date || ''; }

    function sortCards(list, mode) {
        if (!Array.isArray(list)) return list;
        stat.calls++;
        stat.total = list.length;
        stat.withDate = list.filter(date).length;
        if (mode === 'added') return list;
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
            onBack: function () { Lampa.Controller.toggle(prevCtrl); },
            onSelect: function (item) {
                Lampa.Storage.set(keyFor(type), item.value);
                Lampa.Controller.toggle(prevCtrl);
                stat.calls = 0;
                refresh(act);
                setTimeout(function () {
                    Lampa.Noty.show(
                        MODES[item.value] + ' | вкладка: ' + type +
                        ' | вызовов: ' + stat.calls +
                        ' | карточек: ' + stat.total +
                        ' | с датой: ' + stat.withDate
                    );
                }, 1500);
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
        setInterval(function () { btn.toggle(isFav(active())); }, 700);
    }

    function start() {
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
