/** Small inline SVG diagrams for CSCI 570 quiz prompts (no network). */

function svgUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HEAP = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">
  <rect width="360" height="220" fill="#F3EDE3"/>
  <g stroke="#2D3B45" stroke-width="1.5" fill="none">
    <line x1="180" y1="48" x2="100" y2="100"/>
    <line x1="180" y1="48" x2="260" y2="100"/>
    <line x1="100" y1="100" x2="60" y2="160"/>
    <line x1="100" y1="100" x2="140" y2="160"/>
    <line x1="260" y1="100" x2="220" y2="160"/>
    <line x1="260" y1="100" x2="300" y2="160"/>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" text-anchor="middle" fill="#2D3B45">
    <circle cx="180" cy="40" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="180" y="45">16</text>
    <circle cx="100" cy="100" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="100" y="105">14</text>
    <circle cx="260" cy="100" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="260" y="105">10</text>
    <circle cx="60" cy="160" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="60" y="165">8</text>
    <circle cx="140" cy="160" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="140" y="165">7</text>
    <circle cx="220" cy="160" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="220" y="165">9</text>
    <circle cx="300" cy="160" r="18" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="300" y="165">3</text>
  </g>
</svg>`);

const GRAPH = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="380" height="220" viewBox="0 0 380 220">
  <rect width="380" height="220" fill="#F3EDE3"/>
  <g stroke="#2D3B45" stroke-width="1.6" fill="none">
    <line x1="70" y1="110" x2="160" y2="50"/>
    <line x1="70" y1="110" x2="160" y2="170"/>
    <line x1="160" y1="50" x2="270" y2="50"/>
    <line x1="160" y1="170" x2="270" y2="170"/>
    <line x1="160" y1="50" x2="160" y2="170"/>
    <line x1="270" y1="50" x2="270" y2="170"/>
    <line x1="270" y1="50" x2="330" y2="110"/>
    <line x1="270" y1="170" x2="330" y2="110"/>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" text-anchor="middle" fill="#2D3B45">
    <circle cx="70" cy="110" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="70" y="115">s</text>
    <circle cx="160" cy="50" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="160" y="55">a</text>
    <circle cx="160" cy="170" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="160" y="175">b</text>
    <circle cx="270" cy="50" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="270" y="55">c</text>
    <circle cx="270" cy="170" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="270" y="175">d</text>
    <circle cx="330" cy="110" r="16" fill="#F4E6C3" stroke="#8B5E3C"/>
    <text x="330" y="115">t</text>
    <text x="115" y="70" fill="#8B5E3C" font-size="11">2</text>
    <text x="115" y="160" fill="#8B5E3C" font-size="11">5</text>
    <text x="215" y="42" fill="#8B5E3C" font-size="11">1</text>
    <text x="215" y="188" fill="#8B5E3C" font-size="11">2</text>
    <text x="148" y="118" fill="#8B5E3C" font-size="11">3</text>
    <text x="282" y="118" fill="#8B5E3C" font-size="11">4</text>
    <text x="310" y="68" fill="#8B5E3C" font-size="11">2</text>
    <text x="310" y="162" fill="#8B5E3C" font-size="11">1</text>
  </g>
</svg>`);

const KNAPSACK = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="160" viewBox="0 0 340 160">
  <rect width="340" height="160" fill="#F3EDE3"/>
  <g font-family="system-ui,sans-serif" font-size="12" fill="#2D3B45">
    <rect x="24" y="36" width="70" height="88" rx="8" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="59" y="72" text-anchor="middle" font-weight="600">A</text>
    <text x="59" y="92" text-anchor="middle">w=2</text>
    <text x="59" y="108" text-anchor="middle">v=3</text>
    <rect x="106" y="36" width="70" height="88" rx="8" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="141" y="72" text-anchor="middle" font-weight="600">B</text>
    <text x="141" y="92" text-anchor="middle">w=3</text>
    <text x="141" y="108" text-anchor="middle">v=4</text>
    <rect x="188" y="36" width="70" height="88" rx="8" fill="#E8D9C4" stroke="#8B5E3C"/>
    <text x="223" y="72" text-anchor="middle" font-weight="600">C</text>
    <text x="223" y="92" text-anchor="middle">w=4</text>
    <text x="223" y="108" text-anchor="middle">v=5</text>
    <rect x="270" y="36" width="50" height="88" rx="8" fill="#F4E6C3" stroke="#8B5E3C" stroke-dasharray="4 3"/>
    <text x="295" y="80" text-anchor="middle">W=8</text>
    <text x="295" y="98" text-anchor="middle" font-size="10">capacity</text>
  </g>
</svg>`);

export function imgHtml(src: string, alt: string): string {
  return `<p><img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border:1px solid #d6cbb8;border-radius:8px;background:#F3EDE3"/></p>`;
}

export const CS570_DIAGRAM = {
  heap: HEAP,
  graph: GRAPH,
  knapsack: KNAPSACK,
};
