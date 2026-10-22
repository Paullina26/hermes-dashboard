/**
 * Boty — zakładka w dashboardzie Hermesa.
 *
 * Pokazuje, co robią boty i ile to kosztuje: koszt 24 h / 7 dni / 30 dni,
 * rozbicie na modele i providerów, ostatnią pracę każdego bota oraz limity
 * i salda providerów (żeby nie wchodzić na stronę OpenRouter).
 *
 * Dane: /api/plugins/hermes-dashboard/summary (backend czyta lokalne bazy botów).
 */
(function () {
  "use strict";

  const registry = window.__HERMES_PLUGINS__;
  const sdk = window.__HERMES_PLUGIN_SDK__;
  if (!registry || !registry.register) return;
  if (!sdk) return;

  const { React, fetchJSON } = sdk;
  const { useState, useEffect, useCallback } = React;
  const h = React.createElement;

  const BASE = "/api/plugins/hermes-dashboard";
  const SURFACE = "rgba(255,255,255,0.04)";
  const BORDER = "rgba(255,255,255,0.10)";
  const TEXT = "#e5e5e5";
  const DIM = "rgba(255,255,255,0.45)";
  const ACCENT = "#a855f7";
  const WARN = "#e0a44b";
  const GOOD = "#4ade80";

  const money = (v) => "$" + Number(v || 0).toFixed(2);
  const num = (v) => Number(v || 0).toLocaleString("pl-PL");
  const short = (s, n) => {
    const t = String(s || "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  };

  function ago(iso) {
    if (!iso) return "—";
    const t = Date.parse(iso);
    if (!isFinite(t)) return "—";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "teraz";
    if (m < 60) return m + " min";
    const hrs = Math.round(m / 60);
    if (hrs < 24) return hrs + " h";
    return Math.round(hrs / 24) + " dni";
  }

  const card = (label, value, sub, tint) =>
    h(
      "div",
      {
        style: {
          flex: "1 1 150px",
          minWidth: 140,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid " + BORDER,
          background: SURFACE
        }
      },
      h("div", { style: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: DIM } }, label),
      h("div", { style: { fontSize: 22, fontWeight: 700, marginTop: 4, color: tint || TEXT, fontVariantNumeric: "tabular-nums" } }, value),
      sub ? h("div", { style: { fontSize: 11, color: DIM, marginTop: 2 } }, sub) : null
    );

  const th = (label, right) =>
    h(
      "th",
      {
        style: {
          textAlign: right ? "right" : "left",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          color: DIM,
          padding: "6px 8px",
          borderBottom: "1px solid " + BORDER,
          fontWeight: 600,
          whiteSpace: "nowrap"
        }
      },
      label
    );

  const td = (content, right, color) =>
    h(
      "td",
      {
        style: {
          textAlign: right ? "right" : "left",
          padding: "6px 8px",
          fontSize: 12,
          borderBottom: "1px solid " + BORDER,
          fontVariantNumeric: right ? "tabular-nums" : undefined,
          color: color || TEXT,
          whiteSpace: "nowrap"
        }
      },
      content
    );

  function table(headers, rows) {
    return h(
      "table",
      { style: { width: "100%", borderCollapse: "collapse" } },
      h("thead", null, h("tr", null, headers.map((x, i) => th(x, i > 0)))),
      h("tbody", null, rows)
    );
  }

  function section(title, note, body) {
    return h(
      "div",
      { style: { marginTop: 18 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 } },
        h("div", { style: { fontSize: 13, fontWeight: 700 } }, title),
        note ? h("div", { style: { fontSize: 11, color: DIM } }, note) : null
      ),
      body
    );
  }

  function limitsBlock(limits) {
    if (!limits) return null;
    if (limits.error) {
      return h("div", { style: { fontSize: 11.5, color: DIM } }, "limity providerów: " + limits.error);
    }
    const list = limits.providers || [];
    if (!list.length) return h("div", { style: { fontSize: 11.5, color: DIM } }, "brak dostępnych providerów");

    const rows = list.map((p) => {
      const win = (p.windows || [])[0];
      const cash = (p.money || [])[0];
      const pct = win ? Math.max(0, Math.min(100, Number(win.percent) || 0)) : null;
      const color = pct !== null ? (pct >= 90 ? WARN : pct >= 80 ? WARN : GOOD) : TEXT;
      return h(
        "tr",
        { key: p.id },
        td(p.name || p.id),
        td(
          pct !== null
            ? h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" } },
                h(
                  "div",
                  { style: { width: 90, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" } },
                  h("div", { style: { width: pct + "%", height: "100%", background: color } })
                ),
                h("span", { style: { color: pct >= 80 ? WARN : TEXT } }, Math.round(pct) + "%")
              )
            : "—",
          true
        ),
        td(
          cash
            ? money(cash.left) + (cash.total ? " / " + money(cash.total) : "")
            : win && win.resets_at
            ? "reset " + ago(win.resets_at).replace("temu", "")
            : "—",
          true
        )
      );
    });

    return table(["Provider", "Zużycie okna", "Saldo / reset"], rows);
  }

  function BotyDashboard() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const [auto, setAuto] = useState(true);

    const load = useCallback(() => {
      setBusy(true);
      fetchJSON(BASE + "/summary?days=1")
        .then((d) => {
          setData(d);
          setErr(null);
        })
        .catch((e) => setErr(String((e && e.message) || e)))
        .finally(() => setBusy(false));
    }, []);

    useEffect(() => {
      load();
    }, [load]);

    useEffect(() => {
      if (!auto) return undefined;
      const id = setInterval(load, 60000);
      return () => clearInterval(id);
    }, [auto, load]);

    const toolbar = h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } },
      h("div", { style: { fontSize: 18, fontWeight: 700 } }, "Boty"),
      h("div", { style: { fontSize: 11.5, color: DIM } }, data ? "stan na " + (data.generated_at || "").replace("T", " ") : ""),
      h("div", { style: { flex: 1 } }),
      h(
        "label",
        { style: { fontSize: 11.5, color: DIM, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" } },
        h("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) }),
        "auto 60 s"
      ),
      h(
        "button",
        {
          onClick: load,
          style: {
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid " + BORDER,
            background: busy ? "rgba(168,85,247,.2)" : SURFACE,
            color: TEXT,
            cursor: "pointer",
            fontSize: 12
          }
        },
        busy ? "odświeżam…" : "Odśwież"
      )
    );

    if (!data) {
      return h(
        "div",
        { style: { padding: 24 } },
        toolbar,
        h("div", { style: { fontSize: 12.5, color: err ? WARN : DIM } }, err ? "błąd: " + err : "wczytywanie…")
      );
    }

    const w = data.windows || {};
    const t24 = (w["24h"] || {}).totals || {};
    const t7 = (w["7d"] || {}).totals || {};
    const t30 = (w["30d"] || {}).totals || {};
    const lim = data.limits || {};
    const or = (lim.providers || []).find((p) => p.id === "openrouter");
    const orMoney = or && (or.money || [])[0];

    const cards = h(
      "div",
      { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
      card("Koszt 24 h", money(t24.cost), num(t24.calls) + " wywołań · " + (t24.active || 0) + "/" + (t24.bots || 0) + " botów"),
      card("Koszt 7 dni", money(t7.cost), num(t7.calls) + " wywołań"),
      card("Koszt 30 dni", money(t30.cost), num(t30.calls) + " wywołań"),
      card(
        "OpenRouter — saldo",
        orMoney ? money(orMoney.left) : "—",
        orMoney && orMoney.total ? "z " + money(orMoney.total) + " doładowania" : "brak danych",
        orMoney && orMoney.total && orMoney.left / orMoney.total < 0.25 ? WARN : ACCENT
      )
    );

    const botsRows = ((w["24h"] || {}).bots || []).map((b) =>
      h(
        "tr",
        { key: b.name },
        td(b.name),
        td(short(b.model, 30), false, DIM),
        td(num(b.sessions), true),
        td(num(b.calls), true),
        td(money(b.cost), true),
        td(ago(b.last_work), true, DIM),
        td(b.journal ? String(b.journal) : "—", true, DIM)
      )
    );

    const modelRows = ((w["7d"] || {}).models || []).map((m) =>
      h(
        "tr",
        { key: m.model },
        td(short(m.model, 34)),
        td(short(m.provider, 14), false, DIM),
        td(num(m.calls), true),
        td(num(Math.round((m.tokens_in + m.tokens_out) / 1000)) + "k", true, DIM),
        td(money(m.cost), true),
        td(short((m.bots || []).join(", "), 26), false, DIM)
      )
    );

    const provRows = ((w["7d"] || {}).providers || []).map((p) =>
      h(
        "tr",
        { key: p.provider },
        td(p.provider),
        td(num(p.models), true, DIM),
        td(num(p.calls), true),
        td(money(p.cost), true)
      )
    );

    return h(
      "div",
      { style: { padding: "18px 20px 40px", maxWidth: 1100 } },
      toolbar,
      err ? h("div", { style: { fontSize: 12, color: WARN, marginBottom: 10 } }, "ostatni odczyt nieudany: " + err) : null,
      cards,
      section("Boty — 24 h", "zadania, zużycie i ostatnia praca", table(["Bot", "Model", "Zadania", "Wywołania", "Koszt", "Ostatnio", "Dziennik"], botsRows)),
      section("Modele — 7 dni", "ile kosztuje każdy model i kto go używał", table(["Model", "Provider", "Wywołania", "Tokeny", "Koszt", "Boty"], modelRows)),
      section("Providerzy — 7 dni", "koszt po stronie dostawcy", table(["Provider", "Modeli", "Wywołania", "Koszt"], provRows)),
      section("Limity i salda", "odczyt z provider-usage, bez wchodzenia na strony providerów", limitsBlock(lim)),
      h(
        "div",
        { style: { marginTop: 22, fontSize: 10.5, color: DIM } },
        "Koszty są szacowane z cennika modeli, nie z faktur. Salda i limity pochodzą z API providerów."
      )
    );
  }

  registry.register("hermes-dashboard", BotyDashboard);
})();
