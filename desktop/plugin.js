/**
 * Boty: element paska statusu Hermes Desktop.
 *
 * Wersja minimalna i odporna: tylko STATUSBAR_AREAS z SDK, React hooks
 * i jsx. Dane pobiera z własnego backendu (/api/plugins/boty/summary)
 * przez ctx.rest. Pasek: „boty 6/6 · $0.71”. Menu: boty, modele, limity.
 */
import { STATUSBAR_AREAS } from '@hermes/plugin-sdk'
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
      key: m.model,
      style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, padding: '1px 0' },
      children: [
        jsx('span', { style: { opacity: 0.85 }, children: short(m.model, 26) }),
        jsx('span', { style: { fontVariantNumeric: 'tabular-nums' }, children: money(m.cost) })
      ]
    })
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
      ...(modelLines.length ? modelLines : [jsx('div', { style: { fontSize: 11, opacity: 0.5 }, children: 'brak danych' })]),
      jsx('div', { style: { ...HEAD, marginTop: 8, ...LINE, paddingTop: 5 }, children: 'Limity providerów' }),
      ...(limits.length
        ? limits.map(p => jsx(ProviderRow, { p }, p.id))
        : [jsx('div', { style: { fontSize: 11, opacity: 0.5 }, children: 'brak danych' })]),
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

const ICON = jsx('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: { width: 12, height: 12, display: 'block' },
  children: [
    jsx('rect', { x: 3, y: 8, width: 18, height: 12, rx: 3 }),
    jsx('path', { d: 'M12 8V5' }),
    jsx('circle', { cx: 8.5, cy: 14.5, r: 1 }),
    jsx('circle', { cx: 15.5, cy: 14.5, r: 1 })
  ]
})

export default {
  id: 'boty',
  name: 'Boty',
  description: 'Praca botów, koszty modeli i limity providerów w pasku statusu.',
  register(ctx) {
    try {
      rest = ctx.rest || null
    } catch (e) {
      rest = null
    }
    ctx.register({
      id: 'status',
      area: STATUSBAR_AREAS.right,
      order: 41,
      data: {
        id: 'boty',
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
