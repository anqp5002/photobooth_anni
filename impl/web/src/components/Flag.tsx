/** Cờ quốc gia vẽ tay bằng SVG — không dùng ảnh của sản phẩm khác. */

interface FlagProps {
  code: string;
  size?: number;
  className?: string;
}

const W = 60;
const H = 40;

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const BUILDERS: Record<string, () => string> = {
  VN: () => `<rect width="${W}" height="${H}" fill="#DA251D"/><path d="${starPath(W / 2, H / 2, H * 0.3, H * 0.126)}" fill="#FFFF00"/>`,
  TH: () => {
    const u = H / 6;
    return `<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="${u}" fill="#A51931"/><rect y="${u}" width="${W}" height="${u}" fill="#F4F5F8"/><rect y="${u * 2}" width="${W}" height="${u * 2}" fill="#2D2A4A"/><rect y="${u * 4}" width="${W}" height="${u}" fill="#F4F5F8"/><rect y="${u * 5}" width="${W}" height="${u}" fill="#A51931"/>`;
  },
  JP: () => `<rect width="${W}" height="${H}" fill="#fff"/><circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.3}" fill="#BC002D"/>`,
  CH: () => {
    const t = H * 0.2;
    const s = t * 2;
    const x0 = (W - s) / 2;
    const y0 = (H - s) / 2;
    return `<rect width="${W}" height="${H}" fill="#DA291C"/><rect x="${x0}" y="${y0}" width="${s}" height="${s}" fill="#fff"/><rect x="${W / 2 - t / 2}" y="0" width="${t}" height="${H}" fill="#fff"/><rect x="0" y="${H / 2 - t / 2}" width="${W}" height="${t}" fill="#fff"/>`;
  },
  FR: () =>
    `<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W / 3}" height="${H}" fill="#002395"/><rect x="${(W / 3) * 2}" width="${W / 3}" height="${H}" fill="#ED2939"/>`,
  DE: () =>
    `<rect width="${W}" height="${H}" fill="#000"/><rect y="${H / 3}" width="${W}" height="${H / 3}" fill="#DD0000"/><rect y="${(H / 3) * 2}" width="${W}" height="${H / 3}" fill="#FFCE00"/>`,
  IT: () =>
    `<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W / 3}" height="${H}" fill="#009246"/><rect x="${(W / 3) * 2}" width="${W / 3}" height="${H}" fill="#CE2B37"/>`,
  ES: () => `<rect width="${W}" height="${H}" fill="#AA151B"/><rect y="${H * 0.25}" width="${W}" height="${H * 0.5}" fill="#F1BF00"/>`,
  ID: () => `<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W / 2}" height="${H}" fill="#CE1126"/>`,
  IN: () => {
    const u = H / 3;
    return `<rect width="${W}" height="${H}" fill="#fff"/><rect y="${u}" width="${W}" height="${u}" fill="#FF9933"/><rect y="${u * 2}" width="${W}" height="${u}" fill="#138808"/><circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.08}" fill="none" stroke="#000080" stroke-width="${(H * 0.012).toFixed(2)}"/>`;
  },
  MY: () => {
    let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
    for (let i = 0; i < 14; i += 1) {
      if (i % 2 === 0) s += `<rect y="${((H / 14) * i).toFixed(2)}" width="${W}" height="${(H / 14).toFixed(2)}" fill="#CC0001"/>`;
    }
    s += `<rect width="${W / 2}" height="${H / 2}" fill="#010066"/><circle cx="${W / 4}" cy="${H / 4}" r="${H * 0.13}" fill="#FFCC00"/><circle cx="${W / 4}" cy="${H / 4}" r="${H * 0.1}" fill="#010066"/><circle cx="${W / 4}" cy="${H / 4}" r="${H * 0.07}" fill="#FFCC00"/>`;
    return s;
  },
  PT: () => `<rect width="${W * 0.4}" height="${H}" fill="#006600"/><rect x="${W * 0.4}" width="${W * 0.6}" height="${H}" fill="#FF0000"/><circle cx="${W * 0.4}" cy="${H / 2}" r="${H * 0.18}" fill="#FFCC00"/>`,
  NL: () =>
    `<rect width="${W}" height="${H}" fill="#AE1C28"/><rect y="${H / 3}" width="${W}" height="${H / 3}" fill="#fff"/><rect y="${(H / 3) * 2}" width="${W}" height="${H / 3}" fill="#21468B"/>`,
};

export function Flag({ code, size = 20, className }: FlagProps) {
  const key = code.toUpperCase();
  const builder = BUILDERS[key];
  const clipId = `flag-clip-${key}`;
  const body = builder
    ? builder()
    : `<rect width="${W}" height="${H}" fill="#8493A6"/><text x="${W / 2}" y="${H / 2 + 5}" font-family="sans-serif" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">${key.slice(0, 2)}</text>`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      className={className}
      role="img"
      aria-label={`Cờ ${key}`}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="30" cy="30" r="30" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} transform="translate(0, 10)" dangerouslySetInnerHTML={{ __html: body }} />
      <circle cx="30" cy="30" r="29.4" fill="none" stroke="rgba(0,41,61,0.2)" strokeWidth="1.2" />
    </svg>
  );
}
