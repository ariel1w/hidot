// Turns question data into SVG. Everything is vector, so the same drawings print sharply.
// mono = true draws in black and white only, for the printed booklet.
const INK = '#2b2d42', ACCENT = '#e76f51', PAPER = '#ffffff', SOFT = '#f3eee3', DOT = '#3d5a80';

// ---------- grid figures ----------
export function bitmapSvg(bm, { variant = 'grid', size = 96, highlight = -1, mono = false } = {}) {
  const n = bm.n, cells = bm.s.split('').map(Number), pad = 3, cell = (size - pad * 2) / n, ink = mono ? '#000' : INK;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="bm" shape-rendering="crispEdges">`;
  out += `<rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="2" fill="${variant === 'blocks' && !mono ? SOFT : PAPER}" stroke="${ink}" stroke-width="${variant === 'blocks' ? 1.2 : 2}"/>`;
  cells.forEach((v, i) => {
    if (!v) return;
    const r = Math.floor(i / n), c = i % n, x = pad + c * cell, y = pad + r * cell;
    const fill = i === highlight ? ACCENT : variant === 'dots' && !mono ? DOT : ink;
    if (variant === 'dots') out += `<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${cell * 0.34}" fill="${fill}" shape-rendering="auto"/>`;
    else out += `<rect x="${x}" y="${y}" width="${cell + 0.4}" height="${cell + 0.4}" fill="${fill}"/>`;
  });
  if (variant !== 'blocks') {
    for (let k = 1; k < n; k++) {
      const p = pad + k * cell, w = variant === 'dots' ? 0.8 : 1.5, col = variant === 'dots' ? '#b9b4a8' : ink;
      out += `<line x1="${p}" y1="${pad}" x2="${p}" y2="${size - pad}" stroke="${col}" stroke-width="${w}"/><line x1="${pad}" y1="${p}" x2="${size - pad}" y2="${p}" stroke="${col}" stroke-width="${w}"/>`;
    }
  }
  return out + '</svg>';
}

// ---------- official-style figures: arrow, circles around a centre, dot counts ----------
const DOT_LAYOUTS = {
  1: [[50, 50]], 2: [[35, 35], [65, 65]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[32, 32], [68, 32], [32, 68], [68, 68]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]], 6: [[32, 26], [68, 26], [32, 50], [68, 50], [32, 74], [68, 74]],
  7: [[30, 24], [70, 24], [30, 50], [50, 50], [70, 50], [30, 76], [70, 76]], 8: [[28, 24], [50, 24], [72, 24], [28, 50], [72, 50], [28, 76], [50, 76], [72, 76]],
  9: [[28, 24], [50, 24], [72, 24], [28, 50], [50, 50], [72, 50], [28, 76], [50, 76], [72, 76]],
};
export function glyphSvg(st, { size = 96, mono = false } = {}) {
  const ink = mono ? '#000' : INK;
  let body = '';
  if (st.g === 'arrow') {
    body = `<rect x="3" y="3" width="94" height="94" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>
      <path d="M50 14 L70 40 L58 40 L58 84 L42 84 L42 40 L30 40 Z" fill="${PAPER}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" transform="rotate(${st.dir * 45} 50 50)"/>`;
  } else if (st.g === 'orbit') {
    body = `<circle cx="50" cy="50" r="46" fill="${PAPER}" stroke="${ink}" stroke-width="2"/><circle cx="50" cy="50" r="7" fill="${st.center ? ink : PAPER}" stroke="${ink}" stroke-width="2"/>`;
    st.dots.split('').forEach((v, i) => {
      if (v !== '1') return;
      const a = ((i * 45 - 90) * Math.PI) / 180;
      body += `<circle cx="${50 + 31 * Math.cos(a)}" cy="${50 + 31 * Math.sin(a)}" r="6" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>`;
    });
  } else {
    body = `<rect x="3" y="3" width="94" height="94" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>` + DOT_LAYOUTS[st.n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${ink}"/>`).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="bm">${body}</svg>`;
}

const figure = (f, opts) => (f.g ? glyphSvg(f, opts) : bitmapSvg(f, opts));
const unknownBox = (size) => `<div class="unknown" style="width:${size}px;height:${size}px">?</div>`;
const solved = (f, opts) => `<div class="answer-frame">${figure(f, opts)}</div>`;

export function seriesHtml(frames, opts, answer) {
  const items = frames.map((f) => figure(f, opts));
  items.push(answer ? solved(answer, opts) : unknownBox(opts.size));
  return `<div class="series" dir="ltr">${items.map((h) => `<div class="frame">${h}</div>`).join('<div class="arrow">›</div>')}</div>`;
}
export function analogyHtml(stem, opts, answer) {
  const cell = (h) => `<div class="frame">${h}</div>`;
  return `<div class="analogy" dir="ltr">
    <div class="row">${cell(figure(stem.a, opts))}<div class="arrow">›</div>${cell(figure(stem.b, opts))}</div>
    <div class="row">${cell(figure(stem.c, opts))}<div class="arrow">›</div>${cell(answer ? solved(answer, opts) : unknownBox(opts.size))}</div></div>`;
}
export function matrixHtml(stem, opts, answer) {
  const cells = stem.cells.map((f) => `<div class="frame">${figure(f, opts)}</div>`);
  cells.push(`<div class="frame">${answer ? solved(answer, opts) : unknownBox(opts.size)}</div>`);
  return `<div class="matrix" dir="ltr">${cells.join('')}</div>`;
}

// ---------- numbers in shapes ----------
const num = (x, y, v, sizePx = 20, mono = false) => {
  const missing = v === '?';
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${missing ? sizePx + 6 : sizePx}" font-weight="${missing ? 800 : 600}" fill="${missing && !mono ? ACCENT : mono ? '#000' : INK}">${v}</text>`;
};
const shown = (isMissing, reveal, value) => (isMissing ? (reveal === undefined ? '?' : reveal) : value);

export function circlesSvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK;
  const one = (c, ox, idx) => {
    const cx = ox + 70, cy = 72, R = 62, v = (pos) => shown(stem.missing.circle === idx && stem.missing.pos === pos, reveal, c[pos]);
    let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>`;
    [-90, 30, 150].forEach((deg) => { const a = (deg * Math.PI) / 180; out += `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" stroke="${ink}" stroke-width="2"/>`; });
    return out + num(cx - 30, cy - 18, v('a'), 20, mono) + num(cx + 30, cy - 18, v('b'), 20, mono) + num(cx, cy + 34, v('c'), 20, mono);
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 144" width="450" height="144" class="shape" direction="ltr">${stem.circles.map((c, i) => one(c, i * 155, i)).join('')}</svg>`;
}

export function pyramidSvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK, v = stem.v, W = 240, H = 208, rowH = H / 3, half = W / 6;
  const val = (k) => shown(stem.missing === k, reveal, v[k]);
  const down = (cx, top) => `${cx - half},${top} ${cx + half},${top} ${cx},${top + rowH}`;
  let out = `<polygon points="${W / 2},0 0,${H} ${W},${H}" fill="${PAPER}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
  out += `<line x1="${W / 2 - half}" y1="${rowH}" x2="${W / 2 + half}" y2="${rowH}" stroke="${ink}" stroke-width="2"/><line x1="${W / 2 - 2 * half}" y1="${2 * rowH}" x2="${W / 2 + 2 * half}" y2="${2 * rowH}" stroke="${ink}" stroke-width="2"/>`;
  out += `<polygon points="${down(W / 2, rowH)}" fill="${ink}"/><polygon points="${down(W / 2 - half, 2 * rowH)}" fill="${ink}"/><polygon points="${down(W / 2 + half, 2 * rowH)}" fill="${ink}"/>`;
  out += num(W / 2, rowH * 0.68, val('top'), 19, mono) + num(W / 2 - half, rowH * 1.66, val('m1'), 19, mono) + num(W / 2 + half, rowH * 1.66, val('m2'), 19, mono);
  out += num(W / 2 - 2 * half, rowH * 2.66, val('x'), 19, mono) + num(W / 2, rowH * 2.66, val('y'), 19, mono) + num(W / 2 + 2 * half, rowH * 2.66, val('z'), 19, mono);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${W + 8} ${H + 8}" width="${W + 8}" height="${H + 8}" class="shape" direction="ltr">${out}</svg>`;
}

// Official demonstration test, part 4, questions 3 to 5: the machine, the fan and the counted arrows.
const arrowHead = (ink) => `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${ink}"/></marker></defs>`;
export function machineSvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK;
  const row = (r, y, last) => {
    const v = (pos) => shown(last && stem.missing === pos, reveal, r[pos]);
    return `<ellipse cx="50" cy="${y}" rx="34" ry="24" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>${num(50, y, v('a'), 20, mono)}<line x1="86" y1="${y}" x2="146" y2="${y}" stroke="${ink}" stroke-width="2" marker-end="url(#ah)"/><rect x="150" y="${y - 32}" width="64" height="64" fill="${PAPER}" stroke="${ink}" stroke-width="4"/>${num(182, y, v('b'), 20, mono)}<line x1="216" y1="${y}" x2="276" y2="${y}" stroke="${ink}" stroke-width="2" marker-end="url(#ah)"/><ellipse cx="314" cy="${y}" rx="34" ry="24" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>${num(314, y, v('c'), 20, mono)}`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 364 190" width="364" height="190" class="shape" direction="ltr">${arrowHead(ink)}${row(stem.rows[0], 44, false)}${row(stem.rows[1], 146, true)}</svg>`;
}
export function fanSvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK;
  const one = (f, ox, last) => {
    const v = (pos) => shown(last && stem.missing === pos, reveal, f[pos]);
    const c = (x, y, val) => `<circle cx="${ox + x}" cy="${y}" r="27" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>${num(ox + x, y, val, 19, mono)}`;
    return `<line x1="${ox + 78}" y1="92" x2="${ox + 52}" y2="58" stroke="${ink}" stroke-width="3" marker-end="url(#ah)"/><line x1="${ox + 102}" y1="92" x2="${ox + 128}" y2="58" stroke="${ink}" stroke-width="3" marker-end="url(#ah)"/>` + c(40, 34, v('l')) + c(140, 34, v('r')) + c(90, 116, f.s);
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 150" width="420" height="150" class="shape" direction="ltr">${arrowHead(ink)}${one(stem.fans[0], 0, false)}${one(stem.fans[1], 240, true)}</svg>`;
}
export function arrowsSvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK, v = stem.v;
  const pair = (left, right, arrows, ox) => {
    let out = `<rect x="${ox}" y="10" width="44" height="90" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>${num(ox + 22, 55, left, 19, mono)}<rect x="${ox + 92}" y="10" width="44" height="90" fill="${PAPER}" stroke="${ink}" stroke-width="2"/>${num(ox + 114, 55, right, 19, mono)}`;
    for (let i = 0; i < arrows; i++) { const y = 55 + (i - (arrows - 1) / 2) * 26; out += `<path d="M${ox + 46} ${y - 6} h26 v-7 l18 13 l-18 13 v-7 h-26 Z" fill="${ink}"/>`; }
    return out;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 110" width="470" height="110" class="shape" direction="ltr">${pair(v[0], v[1], 1, 0)}${pair(v[1], v[2], 2, 165)}${pair(v[2], reveal === undefined ? '?' : reveal, 3, 330)}</svg>`;
}

export function ringSvg(stem, reveal, mono) {
  const R = 118, M = 66, C = 30, cx = 130, cy = 130, ink = mono ? '#000' : INK;
  const val = (i, pos) => shown(stem.missing.sector === i && stem.missing.pos === pos, reveal, stem.sectors[i][pos]);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260" class="shape" direction="ltr">`;
  out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${mono ? PAPER : '#fdf3dc'}" stroke="${ink}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${M}" fill="${mono ? PAPER : '#e3f0fb'}" stroke="${ink}" stroke-width="2"/>`;
  [-90, 30, 150].forEach((deg) => {
    const a = (deg * Math.PI) / 180;
    out += `<line x1="${cx + C * Math.cos(a)}" y1="${cy + C * Math.sin(a)}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" stroke="${ink}" stroke-width="2"/>`;
  });
  out += `<circle cx="${cx}" cy="${cy}" r="${C}" fill="${PAPER}" stroke="${ink}" stroke-width="2.5"/>` + num(cx, cy, stem.centre, 22, mono);
  [-30, 90, 210].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    out += num(cx + 92 * Math.cos(a), cy + 92 * Math.sin(a), val(i, 'outer'), 20, mono);
    out += num(cx + 48 * Math.cos(a), cy + 48 * Math.sin(a), val(i, 'inner'), 18, mono);
  });
  return out + '</svg>';
}

export function butterflySvg(stem, reveal, mono) {
  const ink = mono ? '#000' : INK;
  const one = (f, ox, idx) => {
    const v = (pos) => shown(stem.missing.fly === idx && stem.missing.pos === pos, reveal, f[pos]);
    const wing = (x, y, rx, ry, rot, fill) => `<ellipse cx="${ox + x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${ox + x} ${y})" fill="${mono ? PAPER : fill}" stroke="${ink}" stroke-width="2"/>`;
    return wing(52, 58, 46, 36, -24, '#fde2c4') + wing(148, 58, 46, 36, 24, '#fde2c4') + wing(60, 128, 34, 27, 24, '#d8ebfb') + wing(140, 128, 34, 27, -24, '#d8ebfb')
      + `<path d="M${ox + 94} 40 q-8 -20 -18 -24 M${ox + 106} 40 q8 -20 18 -24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
      + `<ellipse cx="${ox + 100}" cy="92" rx="21" ry="50" fill="${PAPER}" stroke="${ink}" stroke-width="2.5"/>`
      + num(ox + 100, 92, f.body, 19, mono) + num(ox + 48, 58, v('tl'), 20, mono) + num(ox + 152, 58, v('tr'), 20, mono) + num(ox + 58, 128, v('bl'), 18, mono) + num(ox + 142, 128, v('br'), 18, mono);
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 170" width="430" height="170" class="shape" direction="ltr">${one(stem.flies[0], 0, 0)}${one(stem.flies[1], 230, 1)}</svg>`;
}

// ---------- one entry point per question ----------
export function stemHtml(q, { reveal = false, mono = false, size = 96 } = {}) {
  const s = q.stem, opts = { variant: q.variant, size, mono };
  const solvedFigure = reveal ? (q.explanation.answerBm || q.explanation.answerSt) : null;
  if (s.kind === 'series') return seriesHtml(s.frames, opts, solvedFigure);
  if (s.kind === 'analogy') return analogyHtml(s, opts, solvedFigure);
  if (s.kind === 'matrix') return matrixHtml(s, { ...opts, size: Math.round(size * 0.85) }, solvedFigure);
  const answer = reveal ? q.options[q.correctIndex].value : undefined;
  if (s.kind === 'circles') return circlesSvg(s, answer, mono);
  if (s.kind === 'pyramid') return pyramidSvg(s, answer, mono);
  if (s.kind === 'machine') return machineSvg(s, answer, mono);
  if (s.kind === 'fan') return fanSvg(s, answer, mono);
  if (s.kind === 'arrows') return arrowsSvg(s, answer, mono);
  if (s.kind === 'ring') return ringSvg(s, answer, mono);
  if (s.kind === 'butterfly') return butterflySvg(s, answer, mono);
  if (s.kind === 'equation') return `<div class="equation" dir="ltr">${reveal ? s.text.replace('?', `<b>${answer}</b>`) : s.text.replace('?', '<span class="qbox">?</span>')}</div>`;
  if (s.kind === 'pair') return `<div class="pair">${s.text}</div>`;
  if (s.kind === 'sentence') return `<div class="sentence">${s.text.replace(/____/g, '<span class="blank"></span>')}</div>`;
  return '';
}

export function optionHtml(q, o, { mono = false, size = 84 } = {}) {
  if (o.kind === 'bitmap') return bitmapSvg(o.bm, { variant: q.variant, size, mono });
  if (o.kind === 'glyph') return glyphSvg(o.st, { size, mono });
  if (o.kind === 'number') return `<span class="opt-number" dir="ltr">${o.value}</span>${o.unit ? `<span class="opt-unit">${o.unit}</span>` : ''}`;
  return `<span class="opt-text">${o.text}</span>`;
}

// An explanation line is either an equation (left to right), an equation with a Hebrew note, or a Hebrew sentence.
export function explainLineHtml(line) {
  const [eq, note] = line.split('  (');
  if (note) return `<div class="eq"><span dir="ltr">${eq}</span> <small>${note.replace(/\)$/, '')}</small></div>`;
  if (/[א-ת]/.test(line) && !line.includes('=')) return `<div class="eq he">${line}</div>`;
  return `<div class="eq" dir="ltr">${line}</div>`;
}

// Lesson demo: an L shape turning a quarter turn each step, optionally tracking one cell in colour.
export function rotateDemoHtml(track) {
  const frames = ['110100100', '111001000', '001001011', '000100111'];
  const marks = [1, 5, 7, 3];
  const items = frames.map((s, i) => bitmapSvg({ n: 3, s }, { variant: 'blocks', size: 92, highlight: track ? marks[i] : -1 }));
  return `<div class="series" dir="ltr">${items.map((h) => `<div class="frame">${h}</div>`).join('<div class="arrow">›</div>')}</div>`;
}
