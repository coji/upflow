/**
 * lab/lib/report.ts — 実験レポート生成ヘルパー
 *
 * 実験スクリプトから自己完結HTMLレポートを生成するビルダーAPI。
 * データはインライン埋め込み（サーバー不要でファイルを開くだけで閲覧可能）。
 * チャートはCanvas 2D APIで描画。
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// ── Types ──────────────────────────────────────────────────────────

interface StatItem {
  label: string
  value: string | number
  color?: 'green' | 'red' | 'accent'
  note?: string
}

interface BarChartData {
  [key: string]: number
}

interface ComparisonBarItem {
  label: string
  value: number
  color?: string
  reduction?: string
}

export interface LineSeries {
  label: string
  data: { x: string; y: number }[]
  color: string
  dash?: number[]
  width?: number
  fill?: boolean
}

export interface ScatterPoint {
  x: number
  y: number
  label?: string
  color?: string
}

interface TableColumn<T> {
  key: string
  label: string
  render?: (row: T) => string
  align?: 'left' | 'right' | 'center'
  maxWidth?: number
}

interface TableOpts<T> {
  columns: TableColumn<T>[]
  rows: T[]
}

interface LineChartOpts {
  yLabel?: string
  xLabelCount?: number
  areaFill?: { from: number; to: number }
}

interface ScatterChartOpts {
  xLabel?: string
  yLabel?: string
  annotations?: {
    type: 'arrow'
    from: [number, number]
    to: [number, number]
    label: string
    color: string
  }[]
  zones?: { points: ScatterPoint[]; color: string }[]
}

// ── Section Builder ────────────────────────────────────────────────

export class SectionBuilder {
  private parts: string[] = []
  private canvasScripts: { id: string; height: number; code: string }[] = []
  private canvasCounter: number

  constructor(canvasCounter: number) {
    this.canvasCounter = canvasCounter
  }

  barChart(
    data: BarChartData,
    opts?: { colorMap?: Record<string, string> },
  ): void {
    const entries = Object.entries(data)
    const maxVal = Math.max(...entries.map(([, v]) => v))
    const total = entries.reduce((s, [, v]) => s + v, 0)
    const colorMap = opts?.colorMap ?? {}
    const sizeColors: Record<string, string> = {
      XS: 'var(--xs)',
      S: 'var(--s)',
      M: 'var(--m)',
      L: 'var(--l)',
      XL: 'var(--xl)',
    }

    this.parts.push(
      entries
        .map(([key, count]) => {
          const pct = ((count / total) * 100).toFixed(1)
          const width = ((count / maxVal) * 100).toFixed(0)
          const color = colorMap[key] ?? sizeColors[key] ?? 'var(--accent)'
          const labelClass = ['xs', 's', 'm', 'l', 'xl'].includes(
            key.toLowerCase(),
          )
            ? ` ${key.toLowerCase()}`
            : ''
          return `<div class="size-bar-row">
      <div class="size-label${labelClass}" style="color:${color}">${key}</div>
      <div class="size-bar-track">
        <div class="size-bar-fill" style="width:${width}%;background:${color}">${count > 15 ? count : ''}</div>
      </div>
      <div class="size-count">${count} (${pct}%)</div>
    </div>`
        })
        .join('\n'),
    )
  }

  comparisonBars(items: ComparisonBarItem[]): void {
    const maxVal = Math.max(...items.map((i) => i.value))
    this.parts.push(
      items
        .map((item) => {
          const width = ((item.value / maxVal) * 100).toFixed(0)
          const color = item.color ?? 'var(--accent)'
          const reduction = item.reduction ?? ''
          const redColor = reduction ? color : 'var(--text-muted)'
          return `<div class="compare-row">
      <div class="compare-label">${item.label}</div>
      <div class="compare-bar-track">
        <div class="compare-bar-fill" style="width:${width}%;background:${color}">${item.value.toFixed(1)}</div>
      </div>
      <div class="compare-reduction" style="color:${redColor}">${reduction || '—'}</div>
    </div>`
        })
        .join('\n'),
    )
  }

  lineChart(series: LineSeries[], opts?: LineChartOpts): void {
    const id = `canvas_${this.canvasCounter++}`
    const height = 280
    const seriesJson = JSON.stringify(series)
    const optsJson = JSON.stringify(opts ?? {})

    this.parts.push(`<canvas id="${id}" height="${height}"></canvas>`)
    this.parts.push(
      `<div class="legend-row">${series
        .map(
          (s) =>
            `<span><span style="color:${resolveColor(s.color)}">━</span> ${s.label}</span>`,
        )
        .join('\n')}</div>`,
    )

    this.canvasScripts.push({
      id,
      height,
      code: `drawLineChart('${id}', ${height}, ${seriesJson}, ${optsJson});`,
    })
  }

  scatterChart(points: ScatterPoint[], opts?: ScatterChartOpts): void {
    const id = `canvas_${this.canvasCounter++}`
    const height = 280
    const pointsJson = JSON.stringify(points)
    const optsJson = JSON.stringify(opts ?? {})

    this.parts.push(`<canvas id="${id}" height="${height}"></canvas>`)
    if (opts?.zones) {
      this.parts.push(`<div class="legend-row">
        <span><span style="color:var(--text-muted)">●</span> 現状</span>
        ${opts.zones.map((z) => `<span><span style="color:${resolveColor(z.color)}">●</span> 推定ゾーン</span>`).join('')}
      </div>`)
    }

    this.canvasScripts.push({
      id,
      height,
      code: `drawScatterChart('${id}', ${height}, ${pointsJson}, ${optsJson});`,
    })
  }

  table<T>(opts: TableOpts<T>): void {
    const { columns, rows } = opts
    const thead = `<thead><tr>${columns
      .map((c) => `<th style="text-align:${c.align ?? 'left'}">${c.label}</th>`)
      .join('')}</tr></thead>`

    const tbody = `<tbody>${rows
      .map(
        (row) =>
          `<tr>${columns
            .map((c) => {
              const val = c.render
                ? c.render(row)
                : String((row as Record<string, unknown>)[c.key] ?? '')
              const style = [
                c.align ? `text-align:${c.align}` : '',
                c.maxWidth
                  ? `max-width:${c.maxWidth}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`
                  : '',
              ]
                .filter(Boolean)
                .join(';')
              return `<td${style ? ` style="${style}"` : ''}>${val}</td>`
            })
            .join('')}</tr>`,
      )
      .join('\n')}</tbody>`

    this.parts.push(`<table class="pr-table">${thead}${tbody}</table>`)
  }

  html(raw: string): void {
    this.parts.push(raw)
  }

  /** @internal */
  _getParts(): string[] {
    return this.parts
  }

  /** @internal */
  _getCanvasScripts(): { id: string; height: number; code: string }[] {
    return this.canvasScripts
  }

  /** @internal */
  _getCanvasCounter(): number {
    return this.canvasCounter
  }
}

// ── Report Builder ─────────────────────────────────────────────────

interface Section {
  title: string
  description?: string
  content: string
  canvasScripts: { id: string; height: number; code: string }[]
}

interface InsightBlock {
  title: string
  bullets: string[]
}

interface ReportOpts {
  subtitle?: string
}

class Report {
  private title: string
  private subtitle?: string
  private statItems: StatItem[] = []
  private sections: Section[] = []
  private insights: InsightBlock[] = []
  private canvasCounter = 0

  constructor(title: string, opts?: ReportOpts) {
    this.title = title
    this.subtitle = opts?.subtitle
  }

  stats(items: StatItem[]): void {
    this.statItems = items
  }

  section(
    title: string,
    builder: (s: SectionBuilder) => void,
    opts?: { description?: string },
  ): void {
    const sb = new SectionBuilder(this.canvasCounter)
    builder(sb)
    this.canvasCounter = sb._getCanvasCounter()
    this.sections.push({
      title,
      description: opts?.description,
      content: sb._getParts().join('\n'),
      canvasScripts: sb._getCanvasScripts(),
    })
  }

  insight(title: string, bullets: string[]): void {
    this.insights.push({ title, bullets })
  }

  save(filePath: string, opts?: { open?: boolean }): void {
    const html = this.render()
    const dir = path.dirname(filePath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, html)

    if (opts?.open) {
      try {
        execSync(`open "${filePath}"`, { stdio: 'ignore' })
      } catch {
        // ignore open failure on non-macOS
      }
    }
  }

  private render(): string {
    const allCanvasScripts = this.sections.flatMap((s) => s.canvasScripts)

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(this.title)}</title>
${CSS}
</head>
<body>

<h1>${escHtml(this.title)}</h1>
${this.subtitle ? `<p class="subtitle">${this.subtitle}</p>` : ''}

${this.renderStats()}
${this.sections.map((s) => this.renderSection(s)).join('\n')}
${this.insights.map((i) => this.renderInsight(i)).join('\n')}

<script>
${CHART_JS}

${allCanvasScripts.map((s) => s.code).join('\n')}

window.addEventListener('resize', () => {
${allCanvasScripts.map((s) => s.code).join('\n')}
});
</script>
</body>
</html>`
  }

  private renderStats(): string {
    if (this.statItems.length === 0) return ''
    return `<div class="stats-bar">
${this.statItems
  .map((item) => {
    const colorClass = item.color ? ` ${item.color}` : ''
    return `  <div class="stat-card">
    <div class="label">${escHtml(String(item.label))}</div>
    <div class="value${colorClass}">${escHtml(String(item.value))}</div>
    ${item.note ? `<div class="note">${item.note}</div>` : ''}
  </div>`
  })
  .join('\n')}
</div>`
  }

  private renderSection(section: Section): string {
    return `<div class="panel">
  <h2>${escHtml(section.title)}</h2>
  ${section.description ? `<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px">${section.description}</p>` : ''}
  ${section.content}
</div>`
  }

  private renderInsight(insight: InsightBlock): string {
    return `<div class="insight">
  <h3>${escHtml(insight.title)}</h3>
  <ul>
    ${insight.bullets.map((b) => `<li>${b}</li>`).join('\n    ')}
  </ul>
</div>`
  }
}

// ── Public API ─────────────────────────────────────────────────────

export function createReport(title: string, opts?: ReportOpts): Report {
  return new Report(title, opts)
}

// ── Helpers ────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveColor(color: string): string {
  const map: Record<string, string> = {
    red: 'var(--red)',
    green: 'var(--green)',
    orange: 'var(--orange)',
    purple: 'var(--purple)',
    accent: 'var(--accent)',
  }
  return map[color] ?? color
}

// ── CSS Template ───────────────────────────────────────────────────

const CSS = `<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --red: #f85149;
    --orange: #d29922;
    --purple: #bc8cff;
    --xs: #3fb950;
    --s: #58a6ff;
    --m: #d29922;
    --l: #f85149;
    --xl: #bc8cff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px;
    min-height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
  }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; margin-bottom: 12px; }
  .subtitle { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 24px; }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .stats-bar {
    display: flex;
    gap: 14px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 18px;
    min-width: 130px;
    flex: 1;
  }
  .stat-card .label { font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; }
  .stat-card .value { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat-card .note { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
  .stat-card .value.green { color: var(--green); }
  .stat-card .value.red { color: var(--red); }
  .stat-card .value.accent { color: var(--accent); }

  .size-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 0.85rem;
  }
  .size-label {
    min-width: 32px;
    font-weight: 700;
    text-align: right;
  }
  .size-label.xs { color: var(--xs); }
  .size-label.s { color: var(--s); }
  .size-label.m { color: var(--m); }
  .size-label.l { color: var(--l); }
  .size-label.xl { color: var(--xl); }
  .size-bar-track {
    flex: 1;
    height: 24px;
    background: var(--bg);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .size-bar-fill {
    height: 100%;
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding-left: 8px;
    font-size: 0.72rem;
    font-weight: 600;
    color: #fff;
    transition: width 0.5s;
  }
  .size-count { min-width: 80px; font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: 0.82rem; }

  .compare-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .compare-label {
    min-width: 180px;
    font-size: 0.85rem;
  }
  .compare-bar-track {
    flex: 1;
    height: 32px;
    background: var(--bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .compare-bar-fill {
    height: 100%;
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding-left: 10px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #fff;
    transition: width 0.5s;
  }
  .compare-reduction {
    min-width: 80px;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
  }

  canvas { width: 100%; }

  .review-time-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-top: 12px;
  }
  .review-time-card {
    background: var(--bg);
    border-radius: 6px;
    padding: 14px;
    text-align: center;
  }
  .review-time-card .size-tag {
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 6px;
  }
  .review-time-card .metric {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .review-time-card .metric-value {
    font-size: 1rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .insight {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
    line-height: 1.8;
    font-size: 0.88rem;
  }
  .insight h3 { font-size: 0.95rem; margin-bottom: 8px; color: var(--accent); }
  .insight ul { padding-left: 20px; margin-top: 6px; }
  .insight li { margin-bottom: 4px; }
  .insight .hl { color: var(--orange); font-weight: 600; }
  .insight .good { color: var(--green); font-weight: 600; }
  .insight .bad { color: var(--red); font-weight: 600; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } .review-time-grid { grid-template-columns: repeat(3, 1fr); } }

  .pr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 12px;
  }
  .pr-table th {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 2px solid var(--border);
    color: var(--text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .pr-table td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  .pr-table tr:hover { background: var(--bg); }
  .size-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .size-badge.xs { background: var(--xs); color: #000; }
  .size-badge.s { background: var(--s); color: #000; }
  .size-badge.m { background: var(--m); color: #000; }
  .size-badge.l { background: var(--l); color: #fff; }
  .size-badge.xl { background: var(--xl); color: #fff; }

  .legend-row { display:flex;gap:20px;justify-content:center;margin-top:8px;font-size:0.75rem; }
  .legend-row span { color: var(--text-muted); }

  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>`

// ── Chart JS (Canvas 2D) ──────────────────────────────────────────

const CHART_JS = `
function resolveColor(c) {
  var map = { red: '#f85149', green: '#3fb950', orange: '#d29922', purple: '#bc8cff', accent: '#58a6ff' };
  return map[c] || c;
}

function initCanvas(canvasId, height) {
  var canvas = document.getElementById(canvasId);
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  return { ctx: ctx, W: rect.width, H: height };
}

function drawGrid(ctx, pad, W, H, maxY, opts) {
  var steps = 4;
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (var i = 0; i <= steps; i++) {
    var yv = pad.top + (i / steps) * (H - pad.top - pad.bottom);
    ctx.beginPath(); ctx.moveTo(pad.left, yv); ctx.lineTo(W - pad.right, yv); ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(((steps - i) / steps * maxY).toFixed(0), pad.left - 6, yv + 4);
  }
  if (opts && opts.yLabel) {
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }
}

function drawLineChart(canvasId, height, series, opts) {
  var c = initCanvas(canvasId, height);
  var ctx = c.ctx, W = c.W, H = c.H;
  var pad = { top: 15, right: 20, bottom: 40, left: 45 };

  // Collect all x values
  var allX = [];
  var xSet = {};
  for (var si = 0; si < series.length; si++) {
    for (var di = 0; di < series[si].data.length; di++) {
      var xv = series[si].data[di].x;
      if (!xSet[xv]) { allX.push(xv); xSet[xv] = true; }
    }
  }
  allX.sort();

  if (allX.length === 0) return;

  // Max Y
  var maxY = 0;
  for (var si = 0; si < series.length; si++) {
    for (var di = 0; di < series[si].data.length; di++) {
      if (series[si].data[di].y > maxY) maxY = series[si].data[di].y;
    }
  }
  maxY *= 1.1;

  var x = function(i) { return pad.left + (i / (allX.length - 1)) * (W - pad.left - pad.right); };
  var y = function(v) { return H - pad.bottom - (v / maxY) * (H - pad.top - pad.bottom); };

  drawGrid(ctx, pad, W, H, maxY, opts);

  // Area fill between two series
  if (opts && opts.areaFill) {
    var from = opts.areaFill.from;
    var to = opts.areaFill.to;
    var fromMap = {};
    var toMap = {};
    for (var di = 0; di < series[from].data.length; di++) fromMap[series[from].data[di].x] = series[from].data[di].y;
    for (var di = 0; di < series[to].data.length; di++) toMap[series[to].data[di].x] = series[to].data[di].y;

    ctx.beginPath();
    var started = false;
    for (var i = 0; i < allX.length; i++) {
      if (fromMap[allX[i]] !== undefined && toMap[allX[i]] !== undefined) {
        if (!started) { ctx.moveTo(x(i), y(fromMap[allX[i]])); started = true; }
        else ctx.lineTo(x(i), y(fromMap[allX[i]]));
      }
    }
    for (var i = allX.length - 1; i >= 0; i--) {
      if (toMap[allX[i]] !== undefined) ctx.lineTo(x(i), y(toMap[allX[i]]));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(63,185,80,0.12)';
    ctx.fill();
  }

  // Draw lines
  for (var si = 0; si < series.length; si++) {
    var s = series[si];
    var dataMap = {};
    for (var di = 0; di < s.data.length; di++) dataMap[s.data[di].x] = s.data[di].y;

    ctx.beginPath();
    ctx.setLineDash(s.dash || []);
    var first = true;
    for (var i = 0; i < allX.length; i++) {
      var v = dataMap[allX[i]];
      if (v !== undefined) {
        if (first) { ctx.moveTo(x(i), y(v)); first = false; }
        else ctx.lineTo(x(i), y(v));
      }
    }
    ctx.strokeStyle = resolveColor(s.color);
    ctx.lineWidth = s.width || 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X labels
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  var labelCount = (opts && opts.xLabelCount) || 8;
  var step = Math.max(1, Math.floor(allX.length / labelCount));
  for (var i = 0; i < allX.length; i += step) {
    var d = new Date(allX[i]);
    ctx.fillText((d.getMonth() + 1) + '/' + d.getDate(), x(i), H - pad.bottom + 18);
  }
}

function drawScatterChart(canvasId, height, points, opts) {
  var c = initCanvas(canvasId, height);
  var ctx = c.ctx, W = c.W, H = c.H;
  var pad = { top: 15, right: 20, bottom: 40, left: 55 };

  if (points.length === 0) return;

  var maxX = 0, maxY = 0;
  for (var i = 0; i < points.length; i++) {
    if (points[i].x > maxX) maxX = points[i].x;
    if (points[i].y > maxY) maxY = points[i].y;
  }
  maxX *= 1.1;
  maxY *= 1.1;

  var xFn = function(v) { return pad.left + (v / maxX) * (W - pad.left - pad.right); };
  var yFn = function(v) { return H - pad.bottom - (v / maxY) * (H - pad.top - pad.bottom); };

  // Grid
  drawGrid(ctx, pad, W, H, maxY, opts);
  for (var i = 0; i <= 4; i++) {
    var xv = pad.left + (i / 4) * (W - pad.left - pad.right);
    ctx.beginPath(); ctx.moveTo(xv, pad.top); ctx.lineTo(xv, H - pad.bottom); ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((i / 4 * maxX).toFixed(0), xv, H - pad.bottom + 18);
  }

  // Points
  for (var i = 0; i < points.length; i++) {
    ctx.beginPath();
    ctx.arc(xFn(points[i].x), yFn(points[i].y), 4, 0, Math.PI * 2);
    ctx.fillStyle = resolveColor(points[i].color || 'rgba(139,148,158,0.4)');
    ctx.fill();
  }

  // Zones
  if (opts && opts.zones) {
    for (var zi = 0; zi < opts.zones.length; zi++) {
      var zone = opts.zones[zi];
      for (var pi = 0; pi < zone.points.length; pi++) {
        ctx.beginPath();
        ctx.arc(xFn(zone.points[pi].x), yFn(zone.points[pi].y), 4, 0, Math.PI * 2);
        ctx.fillStyle = resolveColor(zone.color);
        ctx.fill();
      }
    }
  }

  // Annotations (arrows)
  if (opts && opts.annotations) {
    for (var ai = 0; ai < opts.annotations.length; ai++) {
      var a = opts.annotations[ai];
      if (a.type === 'arrow') {
        ctx.beginPath();
        ctx.strokeStyle = resolveColor(a.color);
        ctx.lineWidth = 3;
        ctx.moveTo(xFn(a.from[0]), yFn(a.from[1]));
        ctx.lineTo(xFn(a.to[0]), yFn(a.to[1]));
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(xFn(a.to[0]), yFn(a.to[1]));
        ctx.lineTo(xFn(a.to[0]) + 8, yFn(a.to[1]) - 5);
        ctx.lineTo(xFn(a.to[0]) + 8, yFn(a.to[1]) + 5);
        ctx.closePath();
        ctx.fillStyle = resolveColor(a.color);
        ctx.fill();
        // Label
        ctx.fillStyle = resolveColor(a.color);
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.label, (xFn(a.from[0]) + xFn(a.to[0])) / 2, yFn(a.from[1]) - 12);
      }
    }
  }

  // Axis labels
  if (opts && opts.xLabel) {
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.xLabel, (pad.left + W - pad.right) / 2, H - 2);
  }
}
`
