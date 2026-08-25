/* ============================================================
   notes.js — review comments, one per date
   ------------------------------------------------------------
   GitHub Pages serves static files and nothing else, so there is no
   server here to post to. Notes live in the reviewer's own browser
   (localStorage) and "Copy all" puts the whole set on the clipboard
   as plain text to send back.

   That means notes do not travel between people or machines on their
   own — each reviewer keeps their own list and sends it. For shared,
   live comments the site would need a small backend (a Cloudflare
   Worker with KV is the least effort); this is the version that
   needs no account, no service and no waiting.
   ============================================================ */

var NOTES = (function () {

  var KEY = "tlc30-notes";
  var el = {}, store = {}, current = null, onPause = null;

  function load() {
    try { store = JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { store = {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }

  function init(pauseFn) {
    onPause = pauseFn;
    load();
    el.panel = document.getElementById("notes");
    el.where = document.getElementById("notes-where");
    el.when  = document.getElementById("notes-when");
    el.text  = document.getElementById("notes-text");
    el.count = document.getElementById("notes-count");
    el.btn   = document.getElementById("btn-note");

    el.btn.onclick = function () { toggle(); this.blur(); };
    document.getElementById("notes-save").onclick = function () { commit(); };
    document.getElementById("notes-copy").onclick = function () { copyAll(this); };

    /* space must type a space here, not play the piece */
    el.text.addEventListener("keydown", function (e) { e.stopPropagation(); });
  }

  /* which date is on screen right now — the note belongs to it */
  function setDate(d) {
    current = d;
    if (!el.btn) return;
    var has = d && store[d.id] && store[d.id].text;
    el.btn.classList.toggle("has", !!has);
    if (el.panel.classList.contains("open")) fill();
  }

  function fill() {
    if (!current) return;
    el.where.textContent = current.title || current.short || "";
    el.when.textContent  = ((current.label ? current.label + " " : "") + current.year).trim();
    el.text.value = (store[current.id] && store[current.id].text) || "";
    var n = Object.keys(store).filter(function (k) { return store[k].text; }).length;
    el.count.textContent = n === 0 ? "no notes yet"
      : n === 1 ? "1 note saved" : n + " notes saved";
  }

  function toggle() {
    var open = el.panel.classList.toggle("open");
    if (open) { if (onPause) onPause(); fill(); el.text.focus(); }
  }

  function commit() {
    if (!current) return;
    var v = el.text.value.trim();
    if (v) store[current.id] = { text: v, year: current.year, title: current.title };
    else delete store[current.id];
    save();
    el.btn.classList.toggle("has", !!v);
    fill();
    el.panel.classList.remove("open");
  }

  /* the whole set as plain text, ready to paste into a mail */
  function copyAll(btn) {
    var ids = Object.keys(store).filter(function (k) { return store[k].text; });
    if (!ids.length) { flash(btn, "nothing yet"); return; }
    var out = ["The Life Church — 30th Anniversary timeline", "Review notes", ""];
    ids.forEach(function (id) {
      var n = store[id];
      out.push("— " + n.year + "  " + (n.title || ""));
      out.push("  " + n.text.replace(/\n/g, "\n  "));
      out.push("");
    });
    var txt = out.join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(
        function () { flash(btn, "copied"); },
        function () { fallback(txt, btn); });
    } else fallback(txt, btn);
  }

  function fallback(txt, btn) {
    el.text.value = txt; el.text.select();
    try { document.execCommand("copy"); flash(btn, "copied"); }
    catch (e) { flash(btn, "select + copy"); }
    fill();
  }

  function flash(btn, msg) {
    var was = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = was; }, 1400);
  }

  return { init: init, setDate: setDate, toggle: toggle };
})();
