/**
 * Boty: element paska statusu Hermes Desktop.
 *
 * Wersja minimalna i odporna: tylko STATUSBAR_AREAS z SDK, React hooks
 * i jsx. Dane pobiera z własnego backendu (/api/plugins/hermes-dashboard/summary)
 * przez ctx.rest. Pasek: „boty 6/6 · $0.71”. Menu: boty, modele, limity.
 */
import { ROUTES_AREA, SIDEBAR_NAV_AREA, STATUSBAR_AREAS } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useCallback, useEffect, useState } from 'react'

const CACHE = { data: null, at: 0 }

let rest = null

function snapshot() {
  return CACHE.data
}

async function load() {
  if (!rest) throw new Error('backend wtyczki niepodłączony')
  const data = await rest('/summary?days=1')
  CACHE.data = data
  CACHE.at = Date.now()
  return data
}

function useBoty() {
  const [data, setData] = useState(CACHE.data)
  const [err, setErr] = useState(null)

  const refresh = useCallback(() => {
    load()
      .then(d => {
        setData(d)
        setErr(null)
      })
      .catch(e => setErr(String((e && e.message) || e)))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [refresh])

  return { data, err, refresh }
}

const money = v => '$' + Number(v || 0).toFixed(2)
const num = v => Number(v || 0).toLocaleString('pl-PL')
const short = (s, n) => {
  const t = String(s || '')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function ago(iso) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!isFinite(t)) return '—'
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'teraz'
  if (m < 60) return m + ' min'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' h'
  return Math.round(h / 24) + ' dni'
}

const CELL = { padding: '3px 6px', fontSize: 11.5, whiteSpace: 'nowrap' }
const NUM = { ...CELL, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const HEAD = {
  ...CELL,
  fontSize: 9.5,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  opacity: 0.55
}
const LINE = { borderTop: '1px solid var(--ui-stroke-tertiary, #3a3f4a)' }

function BarDetail() {
  useBoty()
  const d = snapshot()
  const t = d && d.windows && d.windows['24h'] && d.windows['24h'].totals
  return jsx('span', {
    children: t ? 'boty ' + t.active + '/' + t.bots + ' · ' + money(t.cost) : 'boty …'
  })
}

function BotRow({ b }) {
  return jsxs('div', {
    style: { ...LINE, padding: '3px 0' },
    children: [
      jsx('div', { style: { fontSize: 11.5 }, children: b.name }),
      jsxs('div', {
        style: { display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.55 },
        children: [
          jsx('span', { children: short(b.model, 24) }),
          jsx('span', {
            children: num(b.calls) + ' wyw. · ' + money(b.cost) + ' · ' + ago(b.last_work)
          })
        ]
      })
    ]
  })
}

function ProviderRow({ p }) {
  const win = (p.windows || [])[0]
  const cash = (p.money || [])[0]
  const pct = win ? Math.max(0, Math.min(100, Number(win.percent) || 0)) : null
  const value = pct !== null ? Math.round(pct) + '%' : cash ? money(cash.left) : '—'
  const tone = pct !== null && pct >= 80 ? '#e0a44b' : 'inherit'
  return jsxs('div', {
    style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, padding: '1px 0' },
    children: [
      jsx('span', { style: { opacity: 0.85 }, children: p.name || p.id }),
      jsx('span', { style: { color: tone, fontVariantNumeric: 'tabular-nums' }, children: value })
    ]
  })
}

function BotyPanel() {
  const { data, err, refresh } = useBoty()
  if (!data) {
    return jsx('div', {
      style: { padding: 12, fontSize: 11.5, minWidth: 300 },
      children: err ? 'błąd: ' + err : 'wczytywanie…'
    })
  }
  const w = data.windows || {}
  const t24 = (w['24h'] || {}).totals || {}
  const t7 = (w['7d'] || {}).totals || {}
  const bots = (w['24h'] || {}).bots || []
  const models = (w['7d'] || {}).models || []
  const limits = (data.limits || {}).providers || []

  const head = jsxs('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
    children: [
      jsx('div', { style: { fontSize: 12, fontWeight: 600 }, children: 'Boty' }),
      jsx('div', { style: { fontSize: 10.5, opacity: 0.55 }, children: '24 h · ' + num(t24.calls) + ' wyw.' })
    ]
  })
  const totals = jsxs('div', {
    style: { display: 'flex', gap: 14, marginTop: 3, fontSize: 12, fontVariantNumeric: 'tabular-nums' },
    children: [
      jsx('span', { children: money(t24.cost) }),
      jsx('span', { style: { opacity: 0.5 }, children: '7 dni ' + money(t7.cost) })
    ]
  })

  const modelLines = models.slice(0, 5).map(m =>
    jsxs('div', {
      style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, padding: '1px 0' },
      children: [
        jsx('span', { style: { opacity: 0.85 }, children: short(m.model, 26) }),
        jsx('span', { style: { fontVariantNumeric: 'tabular-nums' }, children: money(m.cost) })
      ]
    }, m.model)
  )

  return jsxs('div', {
    style: {
      minWidth: 330,
      padding: '10px 12px 8px',
      borderRadius: 8,
      border: '1px solid var(--ui-stroke-tertiary, #3a3f4a)',
      background: 'var(--ui-surface-1, #20242c)'
    },
    children: [
      head,
      totals,
      jsx('div', { style: { ...HEAD, marginTop: 8 }, children: '24 h · boty' }),
      ...bots.map(b => jsx(BotRow, { b }, b.name)),
      jsx('div', { style: { ...HEAD, marginTop: 8, ...LINE, paddingTop: 5 }, children: 'Modele — 7 dni' }),
      ...(modelLines.length ? modelLines : [jsx('div', { style: { fontSize: 11, opacity: 0.5 }, children: 'brak danych' }, 'empty')]),
      jsx('div', { style: { ...HEAD, marginTop: 8, ...LINE, paddingTop: 5 }, children: 'Limity providerów' }),
      ...(limits.length
        ? limits.map(p => jsx(ProviderRow, { p }, p.id))
        : [jsx('div', { style: { fontSize: 11, opacity: 0.5 }, children: 'brak danych' }, 'empty')]),
      jsxs('div', {
        style: { ...LINE, marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10.5 },
        children: [
          jsx('span', { style: { opacity: 0.5 }, children: err ? 'błąd odczytu' : 'auto 60 s' }),
          jsx('span', {
            onClick: refresh,
            style: { cursor: 'pointer', color: '#a855f7' },
            children: 'odśwież'
          })
        ]
      })
    ]
  })
}


/* ---------- strona w menu bocznym ---------- */

const WINDOWS = [['24h', '24 h'], ['7d', '7 dni'], ['30d', '30 dni']]

const INK = 'var(--foreground, #ececf3)'
const DIM = 'rgba(236,236,243,0.56)'
const FAINT = 'rgba(236,236,243,0.34)'
const GOOD = '#4ade80'
const WARN = '#fbbf24'
const BAD = '#f87171'
const GRAD = 'linear-gradient(120deg,#a855f7,#ec4899)'
const SOFT = 'linear-gradient(120deg,rgba(168,85,247,.85),rgba(96,165,250,.75))'

const GLASS = {
  background: 'linear-gradient(155deg, rgba(255,255,255,0.085), rgba(255,255,255,0.028) 55%, rgba(255,255,255,0.05))',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 16,
  backdropFilter: 'blur(18px) saturate(170%)',
  WebkitBackdropFilter: 'blur(18px) saturate(170%)',
  boxShadow: '0 10px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)'
}
const GLASS_BTN = {
  color: INK,
  background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)'
}
const SP = { flex: 1 }

const tok = v => {
  const n = Number(v || 0)
  return n >= 1e6 ? (n / 1e6).toFixed(1) + ' mln' : n >= 1e3 ? Math.round(n / 1e3) + ' tys.' : String(n)
}
const pctOf = (a, b) => (b > 0 ? Math.max(2, Math.min(100, (a / b) * 100)) : 0)

function until(iso) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!isFinite(t)) return '—'
  const m = Math.round((t - Date.now()) / 60000)
  if (m < 1) return 'teraz'
  if (m < 90) return 'za ' + m + ' min'
  const h = Math.round(m / 60)
  return h < 48 ? 'za ' + h + ' h' : 'za ' + Math.round(h / 24) + ' dni'
}

// miękkie światło w kafelku: jedna funkcja zamiast powtarzanego gradientu
const glow = (rgb, pct) => ({
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: 'radial-gradient(120% 90% at 0% 0%, rgba(' + rgb + ',' + (pct || 0.22) + '), transparent 65%)'
})

const barStyle = {
  height: 5, borderRadius: 5, background: 'rgba(255,255,255,.10)', overflow: 'hidden', flex: 1
}

function Bar({ pct, color }) {
  return jsx('div', {
    style: barStyle,
    children: jsx('div', { style: { width: Math.max(0, Math.min(100, pct)) + '%', height: '100%', borderRadius: 5, background: color || SOFT } })
  })
}

function Aurora() {
  const blobs = [
    { key: 'a', style: { top: -120, left: -80, width: 520, height: 420, background: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,.30), transparent 68%)', filter: 'blur(30px)' } },
    { key: 'b', style: { top: 60, right: -140, width: 560, height: 460, background: 'radial-gradient(circle at 50% 50%, rgba(236,72,153,.22), transparent 68%)', filter: 'blur(34px)' } },
    { key: 'c', style: { bottom: -160, left: '22%', width: 620, height: 420, background: 'radial-gradient(circle at 50% 50%, rgba(96,165,250,.20), transparent 70%)', filter: 'blur(36px)' } }
  ]
  return jsx('div', {
    'aria-hidden': 'true',
    style: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 },
    children: blobs.map(b => jsx('div', { style: { position: 'absolute', borderRadius: '50%' }, ...b.style }, b.key))
  })
}

function Pill({ active, label, onClick }) {
  return jsx('button', {
    type: 'button',
    onClick,
    style: {
      ...GLASS_BTN,
      padding: '5px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
      fontWeight: active ? 600 : 500, color: active ? '#fff' : INK,
      border: active ? '1px solid rgba(255,255,255,.22)' : GLASS_BTN.border,
      background: active ? GRAD : GLASS_BTN.background,
      boxShadow: active ? '0 6px 18px rgba(168,85,247,.38), inset 0 1px 0 rgba(255,255,255,.25)' : GLASS_BTN.boxShadow,
      transition: 'all .18s ease'
    },
    children: label
  })
}

function Panel({ title, note, children, style }) {
  return jsx('section', {
    style: { ...GLASS, padding: '14px 16px 16px', marginTop: 14, ...(style || {}) },
    children: [
      jsx('div', {
        style: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
        children: [
          jsx('div', { style: { fontSize: 13, fontWeight: 650, letterSpacing: '.01em' }, children: title }, 't'),
          note ? jsx('div', { style: { fontSize: 11, color: DIM }, children: note }, 'n') : null
        ]
      }, 'h'),
      jsx('div', { children }, 'b')
    ]
  })
}

function Tile({ label, value, sub, tint, share }) {
  return jsx('div', {
    style: { ...GLASS, position: 'relative', overflow: 'hidden', flex: '1 1 190px', minWidth: 175, padding: '14px 16px 15px' },
    children: [
      jsx('div', { style: glow(tint) }, 'g'),
      jsx('div', {
        style: { position: 'relative' },
        children: [
          jsx('div', { style: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em', color: DIM, fontWeight: 600 }, children: label }, 'l'),
          jsx('div', { style: { fontSize: 25, fontWeight: 700, marginTop: 5, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }, children: value }, 'v'),
          sub ? jsx('div', { style: { fontSize: 11, color: DIM, marginTop: 3 }, children: sub }, 's') : null,
          typeof share === 'number' ? jsx('div', { style: { marginTop: 9, display: 'flex' }, children: jsx(Bar, { pct: share }) }, 'r') : null
        ]
      }, 'c')
    ]
  })
}

function Stat({ k, v }) {
  return jsx('div', {
    children: [
      jsx('div', { style: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: FAINT, fontWeight: 600 }, children: k }, 'k'),
      jsx('div', { style: { fontSize: 12.5, fontVariantNumeric: 'tabular-nums', marginTop: 1 }, children: v }, 'v')
    ]
  })
}

function BotCard({ b, total, winLabel }) {
  const active = (b.calls || 0) > 0
  return jsx('div', {
    style: {
      ...GLASS, position: 'relative', overflow: 'hidden', flex: '1 1 235px', minWidth: 225,
      padding: '13px 15px 14px', display: 'flex', flexDirection: 'column', gap: 9
    },
    children: [
      jsx('div', { style: active ? glow('168,85,247', 0.20) : { display: 'none' } }, 'g'),
      jsx('div', {
        style: { position: 'relative', display: 'flex', alignItems: 'center', gap: 7 },
        children: [
          jsx('span', {
            style: {
              width: 7, height: 7, borderRadius: 9, flex: '0 0 auto',
              background: active ? GOOD : FAINT,
              boxShadow: active ? '0 0 8px rgba(74,222,128,.75)' : 'none'
            }
          }, 'd'),
          jsx('div', { style: { fontSize: 14, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: b.name }, 'n'),
          jsx('div', { style: SP }, 'sp'),
          jsx('div', {
            style: { fontSize: 10, color: DIM, border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' },
            children: ago(b.last_work)
          }, 'a')
        ]
      }, 'top'),
      jsx('div', {
        style: { position: 'relative', fontSize: 10.5, color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        children: b.model || 'brak wywołań'
      }, 'm'),
      jsx('div', {
        style: { position: 'relative', display: 'flex', alignItems: 'baseline', gap: 6 },
        children: [
          jsx('div', { style: { fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: money(b.cost) }, 'v'),
          jsx('div', { style: { fontSize: 10.5, color: FAINT }, children: winLabel }, 'w')
        ]
      }, 'c'),
      jsx('div', { style: { position: 'relative', display: 'flex' }, children: jsx(Bar, { pct: pctOf(b.cost, total) }) }, 'bar'),
      jsx('div', {
        style: { position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' },
        children: [
          jsx(Stat, { k: 'Wywołania', v: num(b.calls) }, 'a'),
          jsx(Stat, { k: 'Zadania', v: num(b.sessions) }, 'b'),
          jsx(Stat, { k: 'Tokeny', v: tok((b.tokens_in || 0) + (b.tokens_out || 0)) }, 'c'),
          jsx(Stat, { k: 'Dziennik', v: (b.journal || 0) + ' dni' }, 'd')
        ]
      }, 'st')
    ]
  })
}

function LimitCard({ p }) {
  const win = (p.windows || [])[0]
  const cash = (p.money || [])[0]
  const err = p.status === 'error'
  const used = win && win.percent !== undefined && win.percent !== null
    ? Math.max(0, Math.min(100, Number(win.percent) || 0))
    : null
  const tone = used === null ? SOFT : used >= 90 ? BAD : used >= 80 ? WARN : SOFT
  const value = err ? 'błąd' : used !== null ? Math.round(used) + '%' : cash ? money(cash.left) : '—'
  const caption = err ? 'brak dostępu' : used !== null ? 'zużyte' : cash ? 'saldo' : '—'
  const sub = err
    ? String(p.error || '').slice(0, 60)
    : win && win.resets_at ? 'reset ' + until(win.resets_at) : cash ? 'z ' + money(cash.total) : (win && win.label) || '—'
  return jsx('div', {
    style: { ...GLASS, display: 'flex', flexDirection: 'column', gap: 7, flex: '1 1 210px', minWidth: 195, padding: '12px 14px 13px' },
    children: [
      jsx('div', {
        style: { display: 'flex', alignItems: 'center', gap: 6 },
        children: [
          jsx('div', { style: { fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: p.name || p.id }, 'n'),
          jsx('div', { style: SP }, 'sp'),
          jsx('div', { style: { fontSize: 10, color: DIM }, children: p.tag || '' }, 't')
        ]
      }, 'h'),
      jsx('div', {
        style: { display: 'flex', alignItems: 'baseline', gap: 4 },
        children: [
          jsx('div', { style: { fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: err ? BAD : INK }, children: value }, 'x'),
          jsx('div', { style: { fontSize: 11, color: DIM }, children: caption }, 'u')
        ]
      }, 'v'),
      used !== null ? jsx('div', { style: { display: 'flex' }, children: jsx(Bar, { pct: used, color: tone }) }, 'bar') : null,
      jsx('div', { style: { fontSize: 10.5, color: FAINT }, children: sub }, 's')
    ]
  })
}

function DashRow({ name, sub, cost, calls, share }) {
  return jsx('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,.075)' },
    children: [
      jsx('div', {
        style: { flex: '1 1 auto', minWidth: 0 },
        children: [
          jsx('div', { style: { fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: name }, 'a'),
          sub ? jsx('div', { style: { fontSize: 10.5, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: sub }, 'b') : null
        ]
      }, 'n'),
      jsx('div', { style: { width: '22%', minWidth: 60, display: 'flex' }, children: jsx(Bar, { pct: share }) }, 'bar'),
      jsx('div', { style: { fontSize: 11.5, color: DIM, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 54 }, children: num(calls) }, 'c'),
      jsx('div', { style: { fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 58 }, children: money(cost) }, 'm')
    ]
  })
}

function DashboardPage() {
  const { data, err, refresh } = useBoty()
  const [win, setWin] = useState('24h')
  const w = (data && data.windows && data.windows[win]) || {}
  const t = w.totals || {}
  const t24 = ((data && data.windows && data.windows['24h']) || {}).totals || {}
  const limits = (data && data.limits && data.limits.providers) || []
  const cash = ((limits.find(p => p.id === 'openrouter') || {}).money || [])[0]
  const winLabel = (WINDOWS.find(x => x[0] === win) || ['', ''])[1]
  const empty = txt => jsx('div', { style: { fontSize: 12, color: DIM }, children: txt })

  const tabs = jsx('div', {
    style: { display: 'flex', gap: 6, padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)' },
    children: WINDOWS.map(([k, label]) => jsx(Pill, { active: k === win, label, onClick: () => setWin(k) }, k))
  }, 'tabs')

  return jsx('div', {
    style: { position: 'relative', padding: '20px 24px 44px', overflow: 'auto', height: '100%', boxSizing: 'border-box' },
    children: [
      jsx(Aurora, {}, 'aurora'),
      jsx('div', {
        style: { position: 'relative', zIndex: 1, maxWidth: 1180 },
        children: [
          jsx('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
            children: [
              jsx('div', {
                children: [
                  jsx('div', { style: { fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }, children: 'Hermes Dashboard' }, 't'),
                  jsx('div', {
                    style: { fontSize: 11, color: DIM, marginTop: 2 },
                    children: data && data.generated_at
                      ? 'boty, modele i limity · auto 60 s · ' + new Date(data.generated_at).toLocaleTimeString('pl-PL')
                      : err ? 'odczyt nieudany: ' + err : 'boty, modele i limity · auto 60 s'
                  }, 's')
                ]
              }, 'v'),
              jsx('div', {
                style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
                children: [
                  tabs,
                  jsx('button', {
                    type: 'button', onClick: refresh,
                    style: { ...GLASS_BTN, padding: '5px 13px', borderRadius: 999, fontSize: 12, cursor: 'pointer' },
                    children: 'Odśwież'
                  }, 'r')
                ]
              }, 'r')
            ]
          }, 'head'),
          data
            ? jsx('div', {
                children: [
                  jsx('div', {
                    style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
                    children: [
                      jsx(Tile, { label: 'Koszt', value: money(t.cost), sub: winLabel + ' · szacowany z cennika', tint: '168,85,247' }, 'c'),
                      jsx(Tile, { label: 'Wywołania', value: num(t.calls), sub: (t.active || 0) + ' z ' + (t.bots || 0) + ' botów pracowało', tint: '236,72,153' }, 'w'),
                      jsx(Tile, { label: 'Tokeny', value: tok((t.tokens_in || 0) + (t.tokens_out || 0)), sub: 'wej. ' + tok(t.tokens_in) + ' · wyj. ' + tok(t.tokens_out), tint: '96,165,250' }, 'k'),
                      jsx(Tile, {
                        label: 'OpenRouter — saldo',
                        value: cash ? money(cash.left) : '—',
                        sub: cash ? 'z ' + money(cash.total) + ' · 24 h ' + money(t24.cost) : 'brak danych',
                        tint: cash && cash.left / (cash.total || 1) < 0.25 ? '251,191,36' : '74,222,128',
                        share: cash && cash.total ? pctOf(cash.left, cash.total) : undefined
                      }, 'o')
                    ]
                  }, 'tiles'),
                  jsx(Panel, {
                    title: 'Boty',
                    note: (t.active || 0) + ' aktywnych z ' + (t.bots || 0) + ' · ' + winLabel,
                    children: w.bots && w.bots.length
                      ? jsx('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: w.bots.map(b => jsx(BotCard, { b, total: t.cost || 0, winLabel }, b.name)) })
                      : empty('brak pracy w tym okresie')
                  }, 'bots'),
                  jsx('div', {
                    style: { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' },
                    children: [
                      jsx(Panel, {
                        title: 'Modele',
                        note: winLabel + ' · według kosztu',
                        style: { flex: '2 1 380px' },
                        children: w.models && w.models.length
                          ? w.models.map(m => jsx(DashRow, {
                              name: m.model,
                              sub: (m.provider || '—') + (m.bots && m.bots.length ? ' · ' + m.bots.join(', ') : ''),
                              cost: m.cost, calls: m.calls, share: pctOf(m.cost || 0, t.cost || 0)
                            }, m.model))
                          : empty('brak danych w tym okresie')
                      }, 'models'),
                      jsx(Panel, {
                        title: 'Providerzy',
                        note: winLabel,
                        style: { flex: '1 1 260px' },
                        children: w.providers && w.providers.length
                          ? w.providers.map(p => jsx(DashRow, {
                              name: p.provider, sub: p.models + ' modeli',
                              cost: p.cost, calls: p.calls, share: pctOf(p.cost || 0, t.cost || 0)
                            }, p.provider))
                          : empty('brak danych w tym okresie')
                      }, 'prov')
                    ]
                  }, 'two'),
                  jsx(Panel, {
                    title: 'Limity i salda',
                    note: 'odczyt z provider-usage',
                    children: limits.length
                      ? jsx('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: limits.map(p => jsx(LimitCard, { p }, p.id)) })
                      : empty('brak danych (wymaga wtyczki Provider Usage)')
                  }, 'lim'),
                  jsx('div', {
                    style: { marginTop: 14, fontSize: 10.5, color: FAINT },
                    children: 'Koszty są szacowane z cennika modeli, nie z faktur. Salda i limity pochodzą z API providerów.'
                  }, 'foot')
                ]
              }, 'body')
            : jsx('div', { style: { marginTop: 20, fontSize: 13, color: DIM }, children: err ? 'Błąd odczytu: ' + err : 'Wczytywanie…' }, 'ld')
        ]
      }, 'c')
    ]
  })
}

const ICON = jsx('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: { width: 12, height: 12, display: 'block' },
  children: [
    jsx('rect', { x: 3, y: 8, width: 18, height: 12, rx: 3 }, 'r'),
    jsx('path', { d: 'M12 8V5' }, 'p'),
    jsx('circle', { cx: 8.5, cy: 14.5, r: 1 }, 'c1'),
    jsx('circle', { cx: 15.5, cy: 14.5, r: 1 }, 'c2')
  ]
})

export default {
  id: 'hermes-dashboard',
  name: 'Hermes Dashboard',
  description: 'Praca botów, koszty modeli i limity providerów w pasku statusu.',
  register(ctx) {
    rest = ctx.rest || null
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: '/hermes-dashboard' }, render: () => jsx(DashboardPage, {}) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: '/hermes-dashboard', label: 'Dashboard', codicon: 'dashboard' } }
    ])
    ctx.register({
      id: 'status',
      area: STATUSBAR_AREAS.right,
      order: 41,
      data: {
        id: 'hermes-dashboard',
        icon: ICON,
        detail: jsx(BarDetail, {}),
        variant: 'menu',
        menuAlign: 'end',
        menuContent: () => jsx(BotyPanel, {}),
        toggleLabel: 'Boty'
      }
    })
  }
}
