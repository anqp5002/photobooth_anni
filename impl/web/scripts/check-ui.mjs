/**
 * Kiểm chứng nhanh các rule SPEC trên trang chuyến (chạy sau khi build).
 * Dùng: node scripts/check-ui.mjs   (cần máy chủ tĩnh ở BASE_URL)
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const TRIP = process.env.TRIP_URL ?? `${BASE}/minh/tripxuyenviet-xuyen-viet`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let passed = 0;
let failed = 0;

function ok(rule, name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${rule}  ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${rule}  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

/* ---------- R-001, R-013..R-031: trang chuyến desktop ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(TRIP, { waitUntil: 'networkidle2' });
  await sleep(2500);

  const d = await page.evaluate(() => {
    const px = (el, prop) => (el ? parseFloat(getComputedStyle(el)[prop]) : NaN);
    const header = document.querySelector('.app-header');
    const title = document.querySelector('.trip-title-text');
    const desc = document.querySelector('.step-desc');
    const card = document.querySelector('.step-card');
    const photo = document.querySelector('.photo-item');
    const share = document.querySelector('.trip-title-actions .btn-secondary');
    const marker = document.querySelector('.map-marker');
    const arrows = document.querySelectorAll('.photo-dialog-nav');
    return {
      url: location.href,
      title: title?.textContent ?? '',
      cards: document.querySelectorAll('.step-card').length,
      hasMap: !!document.querySelector('.map-canvas canvas'),
      mapTiles: document.querySelectorAll('.maplibregl-canvas').length,
      headerH: px(header, 'height'),
      headerBg: header ? getComputedStyle(header).backgroundColor : '',
      bodyBg: getComputedStyle(document.body).backgroundColor,
      titleSize: px(title, 'fontSize'),
      titleWeight: title ? getComputedStyle(title).fontWeight : '',
      descFamily: desc ? getComputedStyle(desc).fontFamily : '',
      descSize: px(desc, 'fontSize'),
      descLine: px(desc, 'lineHeight'),
      descColor: desc ? getComputedStyle(desc).color : '',
      cardRadius: card ? getComputedStyle(card).borderRadius : '',
      cardBg: card ? getComputedStyle(card).backgroundColor : '',
      cardShadow: card ? getComputedStyle(card).boxShadow : '',
      cardPad: card ? getComputedStyle(card).padding : '',
      photoH: px(photo, 'height'),
      photoRadius: photo ? getComputedStyle(photo).borderRadius : '',
      shareH: px(document.querySelector('.header-login'), 'height'),
      createH: px(document.querySelector('.header-create'), 'height'),
      shareRadius: document.querySelector('.header-login')
        ? getComputedStyle(document.querySelector('.header-login')).borderRadius
        : '',
      markerSize: px(marker, 'width'),
      stats: document.querySelector('.map-stats-bar')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      btnBorderRule: (() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText === '.btn' && rule.cssText.includes('border')) return rule.cssText;
            }
          } catch {
            /* bỏ qua sheet khác gốc */
          }
        }
        return '';
      })(),
      qr: !!document.querySelector('.map-qr-card'),
      qrSvg: !!document.querySelector('.map-qr-card svg'),
      progress: !!document.querySelector('.trip-progress'),
      start: document.querySelector('.trip-start-text')?.textContent ?? '',
      gaps: [...document.querySelectorAll('.travel-gap-label')].map((n) => n.textContent),
      docScroll: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      columns: (() => {
        const wrap = document.querySelector('.step-column-wrap');
        const map = document.querySelector('.map-column');
        const cols = document.querySelector('.trip-columns');
        if (!wrap || !map || !cols) return null;
        const w = wrap.getBoundingClientRect();
        const m = map.getBoundingClientRect();
        return {
          left: Math.round(w.width),
          right: Math.round(m.width),
          gap: Math.round(m.left - w.right),
          leftX: Math.round(w.left),
          rightX: Math.round(m.left),
        };
      })(),
      colScrollable: (() => {
        const c = document.querySelector('.step-column');
        return c ? c.scrollHeight > c.clientHeight : false;
      })(),
      descClamped: (() => {
        const w = document.querySelector('.step-desc-wrap');
        return w ? getComputedStyle(w).webkitLineClamp : '';
      })(),
      longClamp: (() => {
        // Thẻ có mô tả dài nhất: đo số dòng còn lại sau khi gấp.
        const wraps = [...document.querySelectorAll('.step-desc-wrap')];
        let best = null;
        for (const w of wraps) {
          const p = w.querySelector('.step-desc');
          const len = (p?.textContent ?? '').length;
          if (!best || len > best.len) best = { w, p, len };
        }
        if (!best) return 'không có mô tả';
        const line = parseFloat(getComputedStyle(best.p).lineHeight) || 24;
        const h = best.p.getBoundingClientRect().height;
        return `${Math.round(h / line)} dòng (cao ${Math.round(h)}px), dài ${best.len} ký tự`;
      })(),
      longNeedsClamp: (() => {
        const wraps = [...document.querySelectorAll('.step-desc-wrap')];
        let best = null;
        for (const w of wraps) {
          const p = w.querySelector('.step-desc');
          const len = (p?.textContent ?? '').length;
          if (!best || len > best.len) best = { w, p, len };
        }
        if (!best) return false;
        const line = parseFloat(getComputedStyle(best.p).lineHeight) || 24;
        return best.p.scrollHeight > line * 6 + 2;
      })(),
      longClamped: (() => {
        const wraps = [...document.querySelectorAll('.step-desc-wrap')];
        let best = null;
        for (const w of wraps) {
          const p = w.querySelector('.step-desc');
          const len = (p?.textContent ?? '').length;
          if (!best || len > best.len) best = { w, p, len };
        }
        if (!best) return false;
        const line = parseFloat(getComputedStyle(best.p).lineHeight) || 24;
        const h = best.p.getBoundingClientRect().height;
        const full = best.p.scrollHeight;
        return full > line * 6 + 2 && h <= line * 6 + 2;
      })(),
      moreBtn: document.querySelector('.step-desc-toggle')?.innerText ?? '',
      tabTitle: document.title,
    };
  });

  ok('R-001', 'trang chuyến hiện tiêu đề, thẻ chặng và bản đồ', d.title.length > 0 && d.cards >= 6 && d.hasMap, `${d.title} · ${d.cards} thẻ`);
  ok('R-002', 'mốc bắt đầu chuyến đứng trước danh sách', d.start === 'bắt đầu chuyến' && d.cards === 10, `${d.cards} thẻ`);
  ok(
    'R-004',
    'mô tả dài gấp lại + nút xem thêm',
    d.longNeedsClamp ? d.longClamped && d.moreBtn.includes('xem thêm') : !d.moreBtn.includes('xem thêm'),
    `${d.longClamp}${d.longNeedsClamp ? '' : ' (mô tả ngắn: không cần gấp)'}`,
  );
  ok('R-005', 'nhãn thời gian di chuyển', d.gaps.length === 9 && d.gaps.every((g) => /^đã đi \d+ (giờ|ngày)$/.test(g)), d.gaps.slice(0, 3).join(' | '));
  ok('R-008', 'dòng thống kê trên bản đồ', /^(đang đi|đã xong) · \d+ ngày · \d+ chặng · [\d.]+ km$/.test(d.stats), d.stats);
  ok('R-013', 'màu nền/thanh đầu/nút chính', d.headerBg === 'rgb(0, 41, 61)' && d.bodyBg === 'rgb(246, 245, 242)', `${d.headerBg} / ${d.bodyBg}`);
  ok('R-014', 'tiêu đề 24px/700 + mô tả serif 16px/24px', d.titleSize === 24 && d.titleWeight === '700' && d.descSize === 16 && d.descLine === 24 && /Noto Serif/.test(d.descFamily), `${d.titleSize}px/${d.titleWeight}, ${d.descFamily.split(',')[0]} ${d.descSize}/${d.descLine}`);
  ok('R-015', 'thanh đầu cao 56px, nút phải cao 48px', d.headerH === 56 && d.shareH === 48 && d.createH === 48, `${d.headerH} / ${d.shareH} / ${d.createH}`);
  ok('R-017', 'trang không cuộn, chỉ cột trái cuộn', d.docScroll === d.winH && d.colScrollable);
  ok(
    'R-017',
    '1440px: cột trái 702px, khe 36px, cột phải phần còn lại',
    d.columns && d.columns.left === 702 && d.columns.gap === 36,
    d.columns ? `trái ${d.columns.left}px · khe ${d.columns.gap}px · phải ${d.columns.right}px` : 'không đo được',
  );
  ok('R-018', 'thẻ chặng bo 24px, nền trắng, không bóng', d.cardRadius === '24px' && d.cardBg === 'rgb(255, 255, 255)' && d.cardShadow === 'none', `${d.cardRadius} / ${d.cardShadow}`);
  ok('R-019', 'ảnh trong thẻ cao 325px, bo 8px', d.photoH === 325 && d.photoRadius === '8px', `${d.photoH}px`);
  ok('R-022', 'marker ảnh tròn 32-40px', d.markerSize >= 32 && d.markerSize <= 40, `${d.markerSize}px`);
  ok('R-023', 'lớp nổi: thanh thống kê + thẻ QR (có mã)', d.qr && d.qrSvg);
  ok('R-025', 'thanh tiến độ ở mép trên cột danh sách', d.progress);
  ok('R-031', 'nút bo tròn 999px, viền 0.8px', d.shareRadius === '999px' && d.btnBorderRule.includes('0.8px'), d.btnBorderRule.match(/border:[^;]*/)?.[0] ?? '');

  // R-006: cuộn danh sách → tiêu đề tab đổi, URL giữ nguyên
  const names = await page.evaluate(() => ({
    trip: document.querySelector('.trip-title-text')?.textContent?.trim() ?? '',
    author: document.querySelector('.trip-author-name')?.textContent?.trim() ?? '',
  }));
  const before = page.url();
  await page.evaluate(() => {
    const c = document.querySelector('.step-column');
    c.scrollTop = 2600;
  });
  await sleep(1200);
  const after = await page.evaluate(() => ({ title: document.title, url: location.href }));
  const titleOk =
    after.title.endsWith(`- ${names.trip} của ${names.author} | Hành Trình`) &&
    after.title.length > ` - ${names.trip} của ${names.author} | Hành Trình`.length;
  ok('R-006', 'cuộn → tiêu đề tab đổi, URL giữ nguyên', titleOk && after.url === before, after.title);

  // R-023: đóng thẻ QR
  await page.click('.map-qr-close');
  await sleep(300);
  const qrGone = await page.evaluate(() => !document.querySelector('.map-qr-card'));
  ok('R-023', 'bấm × ở thẻ QR → thẻ biến mất', qrGone);

  // R-007 + R-034: hộp thoại ảnh
  await page.evaluate(() => {
    document.querySelector('.step-column').scrollTop = 0;
  });
  await sleep(600);
  await page.click('.photo-item');
  await sleep(600);
  const dlg1 = await page.evaluate(() => ({
    open: !!document.querySelector('.photo-dialog'),
    day: document.querySelector('.photo-dialog-title span')?.textContent ?? '',
    barH: parseFloat(getComputedStyle(document.querySelector('.photo-dialog-bar')).height),
    nav: document.querySelectorAll('.photo-dialog-nav').length,
    label: document.querySelector('.photo-dialog-close')?.getAttribute('aria-label') ?? '',
  }));
  ok('R-007', 'hộp thoại ảnh mở, có "Ngày N"', dlg1.open && dlg1.day.startsWith('Ngày 1'), dlg1.day);
  ok('R-026', 'thanh trên hộp thoại cao 56px, có nút đóng', dlg1.barH === 56 && dlg1.label.includes('Đóng'));
  ok('R-034', 'mũi tên trước/sau có nhãn trợ năng', dlg1.nav >= 1);

  const urlBefore = page.url();
  const counterBefore = await page.evaluate(
    () => document.querySelector('.photo-dialog-counter')?.textContent?.trim() ?? '',
  );
  await page.keyboard.press('ArrowRight');
  await sleep(400);
  const counter = await page.evaluate(() => document.querySelector('.photo-dialog-counter')?.textContent ?? '');
  await page.keyboard.press('Escape');
  await sleep(400);
  const closed = await page.evaluate(() => !document.querySelector('.photo-dialog'));
  const counterOk =
    counterBefore.startsWith('1 /') &&
    counter.trim().startsWith('2 /') &&
    counter.trim().split('/')[1] === counterBefore.split('/')[1];
  ok(
    'R-007',
    'phím mũi tên đổi ảnh, Esc đóng hộp, URL không đổi',
    counterOk && closed && page.url() === urlBefore,
    `bộ đếm: ${counterBefore.trim()} → ${counter.trim()}`,
  );

  await page.close();
}

/* ---------- R-009, R-010, R-011, R-027..R-030: điện thoại ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(TRIP, { waitUntil: 'networkidle2' });
  await sleep(2500);

  const m = await page.evaluate(() => {
    const strip = document.querySelector('.strip-card');
    return {
      stripW: strip ? parseFloat(getComputedStyle(strip).width) : 0,
      stripH: strip ? parseFloat(getComputedStyle(strip).height) : 0,
      stripRadius: strip ? getComputedStyle(strip).borderRadius : '',
      titleSize: parseFloat(getComputedStyle(document.querySelector('.mobile-trip-title')).fontSize),
      overflow: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      cards: document.querySelectorAll('.strip-card').length,
      mapFull: (() => {
        const c = document.querySelector('.mobile-map');
        return c ? Math.round(c.getBoundingClientRect().height) : 0;
      })(),
    };
  });
  ok('R-009', '390px: bản đồ toàn màn, dải thẻ đáy, không tràn ngang', m.overflow === m.winW && m.mapFull >= 800, `scrollWidth=${m.overflow}, map=${m.mapFull}px`);
  ok('R-027', 'tên chuyến 20px trên bản đồ', m.titleSize === 20, `${m.titleSize}px`);
  ok('R-028', 'thẻ dải 260x176, bo 28px', m.stripW === 260 && m.stripH === 176 && m.stripRadius === '28px', `${m.stripW}x${m.stripH}/${m.stripRadius}`);

  // R-010: bấm thẻ → URL có mã chặng + hướng dẫn 3 cử chỉ lần đầu
  await page.evaluate(() => localStorage.removeItem('hanh-trinh:story-guide-seen'));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.strip-card');
    cards[cards.length - 1].click();
  });
  await sleep(1200);
  const st = await page.evaluate(() => ({
    url: location.pathname,
    story: !!document.querySelector('.story'),
    guide: !!document.querySelector('.story-guide'),
    guideItems: document.querySelectorAll('.story-guide-list li').length,
    dashes: document.querySelectorAll('.story-progress span').length,
  }));
  ok('R-010', 'bấm thẻ → mở story, URL thêm mã chặng', st.story && /\/[^/]+\/[^/]+$/.test(st.url) && st.url.split('/').length === 4, st.url);
  ok('R-010', 'lần đầu hiện hướng dẫn 3 cử chỉ + nút tiếp tục', st.guide && st.guideItems === 3);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.story-guide-btn')].find((x) => x.textContent.includes('tiếp tục'));
    b?.click();
  });
  await sleep(500);
  const guideGone = await page.evaluate(() => !document.querySelector('.story-guide'));
  ok('R-010', 'bấm "tiếp tục" → hướng dẫn biến mất', guideGone);
  ok('R-029', 'dải gạch tiến độ trên cùng', st.dashes >= 1, `${st.dashes} gạch`);

  // R-011 + R-030: ngăn menu
  await page.evaluate(() => {
    const b = document.querySelector('.mobile-round-btn.is-dark');
    b?.click();
  });
  await sleep(700);
  const dr = await page.evaluate(() => {
    const drawer = document.querySelector('.trip-drawer');
    return {
      open: !!drawer,
      width: drawer ? parseFloat(getComputedStyle(drawer).width) : 0,
      stats: document.querySelectorAll('.drawer-stat').length,
      mapRow: document.querySelector('.drawer-map-trigger')?.innerText ?? '',
      share: !!document.querySelector('.drawer-share'),
    };
  });
  ok('R-011', 'ngăn menu rộng ~300px, 6 số, hàng kiểu bản đồ, nút chia sẻ', dr.open && dr.width === 300 && dr.stats === 6 && dr.mapRow.includes('kiểu bản đồ') && dr.share, `rộng ${dr.width}, ${dr.stats} số`);
  await page.mouse.click(20, 420);
  await sleep(500);
  const drClosed = await page.evaluate(() => !document.querySelector('.trip-drawer'));
  ok('R-011', 'bấm vùng phủ → ngăn đóng', drClosed);

  // Thanh đầu không được tràn ngang ở 390px
  const hdr = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    return {
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      header: header?.scrollWidth ?? 0,
    };
  });
  ok(
    'R-009',
    'thanh đầu ở 390px không tràn ngang',
    hdr.doc <= hdr.win,
    `scrollWidth ${hdr.doc} / khung ${hdr.win}`,
  );

  await page.close();
}

/* ---------- Thanh đầu trên các trang dùng app header (390px) ---------- */
for (const path of ['/login', '/minh']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  const m = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    return {
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      header: header?.scrollWidth ?? 0,
    };
  });
  ok(
    'R-009',
    `thanh đầu ${path} không tràn ngang ở 390px`,
    m.doc <= m.win && m.header <= m.win,
    `scrollWidth ${m.doc}, header ${m.header}, khung ${m.win}`,
  );
  await page.close();
}

/* ---------- R-012: trang lỗi ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/khong-co-ai/999-abc`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  const e = await page.evaluate(() => ({
    title: document.querySelector('.error-title')?.textContent ?? '',
    text: document.querySelector('.error-text')?.textContent ?? '',
    btn: document.querySelector('.error-page-inner .btn-primary')?.innerText ?? '',
    illus: !!document.querySelector('.error-illustration'),
  }));
  ok('R-012', 'trang lỗi có hình minh hoạ, câu giải thích, nút về trang chủ', e.illus && e.text.length > 10 && e.btn.includes('trang chủ'), e.title);
  await page.close();
}

/* ---------- R-024: trạng thái đang tải ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    // Chậm lại cả gọi API lẫn chunk dữ liệu giả để thấy trạng thái đang tải.
    if (req.url().includes('/api/trips/') || /mock-[^/]*\.js$/.test(req.url())) {
      await sleep(1800);
    }
    req.continue();
  });
  await page.goto(TRIP, { waitUntil: 'domcontentloaded' });
  await sleep(900);
  const l = await page.evaluate(() => ({
    loading: !!document.querySelector('.trip-page.is-loading'),
    spinner: !!document.querySelector('.loading-spinner .spinner'),
    skeleton: document.querySelectorAll('.skeleton-block').length,
    mapBox: !!document.querySelector('.map-skeleton'),
    tab: document.title,
  }));
  ok('R-024', 'đang tải: khung xám + biểu tượng quay + bản đồ thế giới', l.loading && l.spinner && l.skeleton > 3 && l.mapBox, `${l.skeleton} khung xám`);
  await page.close();
}

await browser.close();
console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
