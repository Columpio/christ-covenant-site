/* Страница для пасторов: появление карточек, вкладки, перевёртыши, счётчики и прогресс прокрутки.
   Без скрипта всё содержимое раскрыто; скрипт только добавляет движение и переключатели. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Появление при прокрутке */
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); seen.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
  $$("[data-reveal], .lenses").forEach(function (el) { seen.observe(el); });

  /* Бесконечные анимации и расчёты прокрутки — только для блоков на экране */
  var visible = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle("offscreen", !e.isIntersecting); });
  });
  $$(".hero, .final, .swim, .bridge, .timeline").forEach(function (el) { visible.observe(el); });
  function onScreen(el) { return !el.classList.contains("offscreen"); }

  /* Счётчики: без движения цифры сразу стоят на месте */
  var counted = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      counted.unobserve(e.target);
      var el = e.target, to = +el.dataset.count;
      var t0 = performance.now(), dur = 1600;
      (function tick(t) {
        var k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = v;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  if (!reduce) $$("[data-count]").forEach(function (el) { el.textContent = "0"; counted.observe(el); });

  /* Веер карточек на первом экране: верхняя уходит назад */
  var deck = $(".deck");
  if (deck) {
    var cards = $$("li", deck), order = cards.map(function (_, i) { return i; });
    var place = function () { order.forEach(function (c, pos) { cards[c].style.setProperty("--pos", pos); }); };
    var shuffle = function () {
      var top = cards[order[0]];
      top.classList.add("out");
      setTimeout(function () {
        top.classList.remove("out");
        order.push(order.shift());
        place();
      }, reduce ? 0 : 420);
    };
    place();
    // Вопрос на карточке нужно успеть прочесть; пока курсор или фокус на колоде, она стоит.
    var DELAY = 7000, paused = false, timer = null;
    var restart = function () {
      clearInterval(timer);
      timer = reduce ? null : setInterval(function () { if (!paused) shuffle(); }, DELAY);
    };
    restart();
    deck.addEventListener("mouseenter", function () { paused = true; });
    deck.addEventListener("mouseleave", function () { paused = false; restart(); });
    deck.addEventListener("focusin", function () { paused = true; });
    deck.addEventListener("focusout", function () { paused = false; restart(); });
    deck.addEventListener("click", function () { shuffle(); restart(); });
  }

  /* Подсказка над полосой канона */
  var bars = $(".bars"), tip = $(".tip");
  if (bars && tip) {
    bars.addEventListener("pointermove", function (e) {
      var b = e.target.closest(".bar");
      if (!b) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = b.dataset.book + " · " + b.dataset.ch + " " + (bars.dataset.chapters || "");
      tip.style.left = (b.offsetLeft + b.offsetWidth / 2) + "px";
    });
    bars.addEventListener("pointerleave", function () { tip.hidden = true; });
  }

  /* Вкладки (роли и сравнение): стрелки, Home/End, свайп */
  function tabs(list, onShow) {
    var btns = $$("[role=tab]", list);
    var panels = btns.map(function (b) { return document.getElementById(b.getAttribute("aria-controls")); });
    var current = 0;
    function show(i, focus) {
      var back = i < current;
      btns.forEach(function (b, j) {
        var on = j === i;
        b.setAttribute("aria-selected", on);
        b.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
        panels[j].classList.remove("enter", "back", "show");
      });
      var p = panels[i];
      void p.offsetWidth;
      p.classList.add("enter", "show");
      if (back) p.classList.add("back");
      current = i;
      if (focus) btns[i].focus();
      if (onShow) onShow(i);
    }
    btns.forEach(function (b, i) {
      b.addEventListener("click", function () { show(i); });
      b.addEventListener("keydown", function (e) {
        var k = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: btns.length - 1 }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        show((k + btns.length) % btns.length, true);
      });
    });
    panels.forEach(function (p) {
      var x0 = null;
      p.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      p.addEventListener("touchend", function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 60) show(Math.max(0, Math.min(btns.length - 1, current + (dx < 0 ? 1 : -1))));
      });
    });
    btns.forEach(function (_, j) { panels[j].hidden = j !== 0; });
    panels[0].classList.add("show");
    return show;
  }
  var roles = $(".roles");
  if (roles) tabs(roles);
  var compare = $(".tabs");
  if (compare) tabs(compare);

  /* Диагноз: счёт отмеченных вопросов */
  var meter = $(".meter");
  if (meter) {
    var boxes = $$(".rolesets input[type=checkbox]"), total = boxes.length;
    // Тексты выводов на языке страницы: [число отметок, текст].
    var verdicts = JSON.parse(meter.dataset.verdicts || "[[0, \"\"]]");
    var update = function () {
      var n = 0;
      $$(".roleset").forEach(function (set) {
        var k = $$("input:checked", set).length;
        n += k;
        var hit = $('[data-hits="' + set.dataset.role + '"]');
        if (hit) hit.textContent = k;
      });
      $("[data-tally]", meter).textContent = n;
      meter.style.setProperty("--m", Math.round(n / total * 100));
      var text = verdicts[0][1];
      verdicts.forEach(function (v) { if (n >= v[0]) text = v[1]; });
      $("[data-verdict]", meter).textContent = text;
    };
    boxes.forEach(function (b) { b.addEventListener("change", update); });
  }

  /* Карточки-перевёртыши */
  $$(".flip button").forEach(function (b) {
    b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); });
  });

  /* Бассейн или Босфор */
  var swim = $(".swim");
  if (swim) {
    var setSwim = function (mode) {
      swim.dataset.mode = mode;
      $$("[data-swim]", swim).forEach(function (b) { b.setAttribute("aria-checked", b.dataset.swim === mode); });
      $$("[data-swim-text]", swim).forEach(function (p) { p.hidden = p.dataset.swimText !== mode; });
    };
    $$("[data-swim]", swim).forEach(function (b) { b.addEventListener("click", function () { setSwim(b.dataset.swim); }); });
    setSwim("pool");
    var swum = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { swum.disconnect(); setTimeout(function () { setSwim("strait"); }, 1400); }
    }, { threshold: 0.6 });
    swum.observe(swim);
  }

  /* Раскрытие «Подробнее» с плавной высотой */
  $$("details").forEach(function (d) {
    var s = $("summary", d), more = $(".more", d);
    if (!s || !more || reduce) return;
    s.addEventListener("click", function (e) {
      e.preventDefault();
      if (d.open) {
        var h = more.scrollHeight;
        more.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 280, easing: "ease-in" })
          .onfinish = function () { d.open = false; };
      } else {
        d.open = true;
        var h2 = more.scrollHeight;
        more.animate([{ height: "0px", opacity: 0 }, { height: h2 + "px", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
  });

  /* Вопросы: фильтр по темам */
  var chips = $(".chips");
  if (chips) {
    chips.hidden = false;
    $$(".chip", chips).forEach(function (c) {
      c.addEventListener("click", function () {
        $$(".chip", chips).forEach(function (o) { o.setAttribute("aria-pressed", o === c); });
        $$(".faq-group").forEach(function (g) {
          g.classList.toggle("hide", c.dataset.filter !== "all" && g.dataset.group !== c.dataset.filter);
        });
      });
    });
  }

  /* Кнопки, которые тянутся за курсором */
  if (!reduce && window.matchMedia("(hover: hover)").matches) {
    $$(".magnetic").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.3 + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* Прокрутка: полоса прогресса, мост, линия времени */
  var navBar = $(".topnav .bar");
  var line = $(".timeline"), lineFill = line && $(".progress", line);
  var eras = $$(".era"), rail = $$(".era-rail a");
  var bridge = $(".bridge"), arch = bridge && $(".span-line", bridge), spark = bridge && $(".spark", bridge);
  var archLen = arch ? arch.getTotalLength() : 0;
  var ticking = false;
  function frame() {
    ticking = false;
    // Сначала все чтения разметки, потом все записи: без принудительного пересчёта layout на кадре.
    var y = window.scrollY, vh = window.innerHeight, docH = document.documentElement.scrollHeight - vh;
    var b = -1, t = -1, on = -1;
    if (arch && (reduce || onScreen(bridge))) {
      // Мост строится, пока сцена проходит от низа экрана до его верхней трети.
      b = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.9 - bridge.getBoundingClientRect().top) / (vh * 0.55)));
    }
    if (line && lineFill && onScreen(line)) {
      var lr = line.getBoundingClientRect();
      t = Math.max(0, Math.min(1, (vh * 0.6 - lr.top) / lr.height));
      eras.forEach(function (e, i) { if (e.getBoundingClientRect().top < vh * 0.5) on = i; });
    }
    if (navBar) navBar.style.setProperty("--p", Math.min(1, y / docH));
    if (b >= 0) {
      bridge.style.setProperty("--b", b);
      var pt = arch.getPointAtLength(archLen * b);
      spark.setAttribute("cx", pt.x);
      spark.setAttribute("cy", pt.y);
      bridge.classList.toggle("lit", b > 0.97);
    }
    if (t >= 0) {
      lineFill.style.setProperty("--t", t);
      rail.forEach(function (a, i) { a.classList.toggle("on", i === on); });
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  frame();
})();
