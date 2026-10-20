/**
 * Sinh dữ liệu giả cho web r2 (MEGAPLAN_r2.md "Hợp đồng API").
 *
 * Chạy lại khi đổi dữ liệu:
 *   node impl/web/src/dev/mock/_gen.mjs
 *
 * Nguồn ảnh: design/proto/assets/photos/*.jpg (CC0, xem design/proto/CREDITS.md).
 * URL trong JSON trỏ tới `/proto-photos/<tên>.jpg` — Vite phục vụ thư mục đó (xem README.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
/** Thư mục `impl/server/scripts` — nơi xuất `seed-ai.json` cho Q2. */
const SERVER_SCRIPTS = path.resolve(DIR, '..', '..', '..', '..', '..', 'impl', 'server', 'scripts');
const PHOTO = (name) => `/proto-photos/${name}`;

/** Kích thước gốc của 27 ảnh proto (đọc bằng sharp). */
const DIMS = {
  'ba-chau.jpg': [960, 640],
  'banh-sn.jpg': [960, 640],
  'be-cuoi.jpg': [960, 641],
  'be-nuoc.jpg': [960, 639],
  'bep.jpg': [960, 640],
  'bien-nui.jpg': [960, 638],
  'bo-con-doc.jpg': [960, 640],
  'bo-con-mua.jpg': [960, 1440],
  'bong-bay.jpg': [960, 640],
  'cho-xe.jpg': [960, 640],
  'cua-so-xe.jpg': [960, 640],
  'da-ngoai-cho.jpg': [960, 652],
  'da-ngoai-ho.jpg': [960, 1438],
  'di-bien.jpg': [960, 640],
  'em-be.jpg': [960, 720],
  'giao-thua-2.jpg': [960, 640],
  'giao-thua.jpg': [960, 640],
  'hero-chay.jpg': [960, 640],
  'hero-co.jpg': [960, 640],
  'hero-om.jpg': [960, 640],
  'me-con-banh.jpg': [960, 640],
  'nen-sn.jpg': [960, 540],
  'phong-khach.jpg': [960, 640],
  'qua.jpg': [960, 640],
  'tay-be.jpg': [960, 640],
  'tk-hoang-hon.jpg': [960, 720],
  'van-deo.jpg': [960, 640],
};

const MEMBERS = [
  { id: 'm-tu-an', name: 'Bố Tuấn', color: '#F6C445' },
  { id: 'm-linh', name: 'Mẹ Linh', color: '#FFC2DB' },
  { id: 'm-su', name: 'Su', color: '#D9C6FF' },
  { id: 'm-bin', name: 'Bin', color: '#BFE8D6' },
  { id: 'm-ba', name: 'Bà nội', color: '#FFC79B' },
];
const memberOf = (id) => MEMBERS.find((m) => m.id === id);
const membersOf = (ids) => ids.map(memberOf);

/** Thông tin ảnh. `col` = id mục (null = ảnh lẻ chưa gom vào mục nào). */
const MEDIA_SPEC = [
  // 1. Tết ở quê nội, Nam Định
  {
    id: 'm-tet-1', file: 'giao-thua.jpg', col: 'tet-que-noi', at: '2026-02-16T23:20:00+07:00',
    place: 'Quê nội, Nam Định', lat: 20.42, lon: 106.17,
    caption: 'Nửa đêm giao thừa, pháo hoa nổ ngay trên đầu cả làng.',
    tags: ['pháo hoa', 'giao thừa', 'tết', 'đêm', 'làng quê'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-ba'],
  },
  {
    id: 'm-tet-2', file: 'giao-thua-2.jpg', col: 'tet-que-noi', at: '2026-02-16T23:45:00+07:00',
    place: 'Quê nội, Nam Định', lat: 20.42, lon: 106.18,
    caption: 'Một vòng pháo hoa thứ hai, Su bịt tai cười toe.',
    tags: ['pháo hoa', 'giao thừa', 'tết', 'su', 'gia đình'], score: 9,
    flags: { nearDuplicate: true }, members: ['m-tu-an', 'm-linh', 'm-su', 'm-ba'],
  },
  {
    id: 'm-tet-3', file: 'qua.jpg', col: 'tet-que-noi', at: '2026-02-17T09:10:00+07:00',
    place: 'Quê nội, Nam Định', lat: 20.41, lon: 106.16,
    caption: 'Sáng mùng 1, quà Tết đặt trên bàn.',
    tags: ['quà', 'tết', 'mùng 1', 'nhà nội', 'bàn'], score: 8,
    members: ['m-ba', 'm-su', 'm-linh'],
  },
  // 2. Bin tròn 1 tuổi
  {
    id: 'm-baby-1', file: 'em-be.jpg', col: 'bin-tron-mot-tuoi', at: '2026-03-08T10:05:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Bin nở nước mắt xoay một vòng rồi cười toe.',
    tags: ['bin', 'em bé', 'sinh nhật', 'cười', 'một tuổi'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-baby-2', file: 'tay-be.jpg', col: 'bin-tron-mot-tuoi', at: '2026-03-08T10:12:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Bàn tay bé xíu nắm chặt ngón tay bố.',
    tags: ['bin', 'bàn tay', 'em bé', 'bố', 'gia đình'], score: 8,
    members: ['m-tu-an', 'm-bin'],
  },
  // 3. Sinh nhật Su 7 tuổi
  {
    id: 'm-bd-1', file: 'banh-sn.jpg', col: 'sinh-nhat-su', at: '2026-05-02T16:30:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Bánh sinh nhật Su, nến thắp lên là cả nhà im băng.',
    tags: ['sinh nhật', 'bánh', 'nến', 'su', 'tiệc'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-bd-2', file: 'bong-bay.jpg', col: 'sinh-nhat-su', at: '2026-05-02T16:45:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Su thổi hết nến trong tiếng vỗ tay của cả nhà.',
    tags: ['sinh nhật', 'bong bóng', 'su', 'tiệc', 'vui'], score: 9,
    members: ['m-su', 'm-linh', 'm-bin'],
  },
  {
    id: 'm-bd-3', file: 'nen-sn.jpg', col: 'sinh-nhat-su', at: '2026-05-02T17:10:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Chụp lại cái bánh sau khi đã cắt gần hết.',
    tags: ['sinh nhật', 'bánh', 'kem', 'su', 'gia đình'], score: 7,
    members: ['m-su', 'm-ba'],
  },
  // 4. Hè ở Đà Lạt
  {
    id: 'm-dl-1', file: 'van-deo.jpg', col: 'he-da-lat', at: '2026-07-12T10:40:00+07:00',
    place: 'Đà Lạt', lat: 11.93, lon: 108.37,
    caption: 'Xe dừng bên đường đèo, sương mù phủ kín kính xe.',
    tags: ['đèo', 'xe', 'sương mù', 'đà lạt', 'di chuyển'], score: 8,
    members: ['m-tu-an', 'm-linh', 'm-su'],
  },
  {
    id: 'm-dl-2', file: 'cua-so-xe.jpg', col: 'he-da-lat', at: '2026-07-12T11:15:00+07:00',
    place: 'Đà Lạt', lat: 11.94, lon: 108.44,
    caption: 'Su ngồi cạnh cửa sổ, nhìn xuống thung lũng.',
    tags: ['cửa sổ', 'xe', 'su', 'đà lạt', 'phong cảnh'], score: 8,
    flags: { blurry: true }, members: ['m-su', 'm-linh'],
  },
  {
    id: 'm-dl-3', file: 'da-ngoai-ho.jpg', col: 'he-da-lat', at: '2026-07-13T06:50:00+07:00',
    place: 'Đà Lạt', lat: 11.88, lon: 108.51,
    caption: 'Hồ buổi sớm, hơi nước bảng lảng trên mặt nước.',
    tags: ['hồ', 'sáng sớm', 'đà lạt', 'sương', 'phong cảnh'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-dl-4', file: 'bien-nui.jpg', col: 'he-da-lat', at: '2026-07-13T09:20:00+07:00',
    place: 'Đà Lạt', lat: 11.94, lon: 108.44,
    caption: 'Bờ hồ và dãy núi xanh thẫm sau lớp sương.',
    tags: ['hồ', 'núi', 'đà lạt', 'phong cảnh', 'cả nhà'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-dl-5', file: 'cho-xe.jpg', col: 'he-da-lat', at: '2026-07-14T08:05:00+07:00',
    place: 'Đà Lạt', lat: 12.04, lon: 108.44,
    caption: 'Chú chó ở quán cà phê đợi Su cho nó ăn.',
    tags: ['chó', 'cà phê', 'sáng', 'đà lạt'], score: 6,
    flags: { blurry: true, hidden: true }, members: ['m-su', 'm-ba'],
  },
  {
    id: 'm-dl-6', file: 'da-ngoai-cho.jpg', col: 'he-da-lat', at: '2026-07-13T19:30:00+07:00',
    place: 'Đà Lạt', lat: 11.94, lon: 108.45,
    caption: 'Gian hàng ở chợ đêm, Su thích cái bóng đèn lộn loạn.',
    tags: ['chợ', 'đêm', 'đà lạt', 'đèn lồng', 'mua sắm'], score: 8,
    members: ['m-linh', 'm-su'],
  },
  // 5. Biển Nha Trang
  {
    id: 'm-nt-1', file: 'di-bien.jpg', col: 'bien-nha-trang', at: '2026-08-08T15:20:00+07:00',
    place: 'Nha Trang', lat: 12.24, lon: 109.19,
    caption: 'Cả nhà xuống biển lúc nắng chếch.',
    tags: ['biển', 'nha trang', 'nắng', 'cả nhà', 'hè'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-nt-2', file: 'be-nuoc.jpg', col: 'bien-nha-trang', at: '2026-08-09T09:30:00+07:00',
    place: 'Nha Trang', lat: 12.22, lon: 109.21,
    caption: 'Su và Bin nghịch nước, không ai chịu ra khỏi.',
    tags: ['biển', 'nước', 'trẻ con', 'nha trang', 'hè'], score: 8,
    members: ['m-su', 'm-bin'],
  },
  {
    id: 'm-nt-3', file: 'hero-co.jpg', col: 'bien-nha-trang', at: '2026-08-10T18:00:00+07:00',
    place: 'Nha Trang', lat: 12.25, lon: 109.17,
    caption: 'Cả nhà chụp chung ở bãi biển, ai cũng đủ mặt.',
    tags: ['biển', 'cả nhà', 'chụp chung', 'nha trang', 'kỷ niệm'], score: 9,
    members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin', 'm-ba'],
  },
  // 6. Cuối tuần ở nhà (Hà Nội)
  {
    id: 'm-wk-1', file: 'phong-khach.jpg', col: 'cuoi-tuan-o-nha', at: '2026-04-04T20:10:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Tối cuối tuần, cả nhà nằm xem phim trên phòng khách.',
    tags: ['phòng khách', 'tối', 'cuối tuần', 'xem phim', 'gia đình'], score: 7,
    flags: { nearDuplicate: true }, members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-wk-2', file: 'bep.jpg', col: 'cuoi-tuan-o-nha', at: '2026-04-05T07:20:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Bữa sáng ăn chung, ai cũng hỏi một câu.',
    tags: ['bữa sáng', 'bếp', 'gia đình', 'ăn uống', 'cuối tuần'], score: 8,
    members: ['m-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-wk-3', file: 'bo-con-mua.jpg', col: 'cuoi-tuan-o-nha', at: '2026-06-14T15:40:00+07:00',
    place: 'Ba Vì, Hà Nội', lat: 21.08, lon: 105.42,
    caption: 'Bố và con dưới cơn mưa chiều ở Ba Vì.',
    tags: ['ba vì', 'mưa', 'bố', 'con gái', 'cuối tuần'], score: 8,
    members: ['m-tu-an', 'm-su'],
  },
  {
    id: 'm-wk-4', file: 'bo-con-doc.jpg', col: 'cuoi-tuan-o-nha', at: '2026-10-10T16:25:00+07:00',
    place: 'Hồ Tây, Hà Nội', lat: 21.07, lon: 105.82,
    caption: 'Bố đọc truyện cho con nghe bên cửa sổ Hồ Tây.',
    tags: ['hồ tây', 'bố', 'con gái', 'đọc truyện', 'cuối tuần'], score: 8,
    members: ['m-tu-an', 'm-su'],
  },
  {
    id: 'm-wk-5', file: 'me-con-banh.jpg', col: 'cuoi-tuan-o-nha', at: '2026-09-12T10:00:00+07:00',
    place: 'Đồng Mô, Hà Nội', lat: 21.02, lon: 105.46,
    caption: 'Mẹ và Su cùng làm bánh chiều Chủ Nhật.',
    tags: ['làm bánh', 'mẹ', 'su', 'chủ nhật', 'nhà'], score: 9,
    members: ['m-linh', 'm-su'],
  },
  // 7. Giáng sinh với bà
  {
    id: 'm-xmas-1', file: 'ba-chau.jpg', col: 'giang-sinh-voi-ba', at: '2026-12-25T09:30:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Sáng Giáng sinh, bà mở bao quà cho các cháu.',
    tags: ['giáng sinh', 'bà', 'quà', 'sáng', 'gia đình'], score: 9,
    members: ['m-ba', 'm-linh', 'm-su', 'm-bin'],
  },
  // Ảnh lẻ chưa gom vào mục nào
  {
    id: 'm-hero-om', file: 'hero-om.jpg', col: null, at: '2026-10-11T17:10:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Mẹ Linh ôm Su dưới nắng chiều.',
    tags: ['mẹ', 'su', 'nắng chiều', 'ôm ấp', 'nhà'], score: 9,
    members: ['m-linh', 'm-su'],
  },
  {
    id: 'm-hero-chay', file: 'hero-chay.jpg', col: null, at: '2026-05-16T16:00:00+07:00',
    place: 'Công viên Yên Sở, Hà Nội', lat: 20.95, lon: 105.86,
    caption: 'Su và Bin đuổi nhau trên bãi cỏ ở Yên Sở.',
    tags: ['yên sở', 'chạy', 'trẻ con', 'bãi cỏ', 'chủ nhật'], score: 8,
    members: ['m-su', 'm-bin'],
  },
  {
    id: 'm-hoang-hon', file: 'tk-hoang-hon.jpg', col: null, at: '2026-12-24T17:30:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Cả nhà đứng dưới trời chiều ngày cuối năm.',
    tags: ['hoàng hôn', 'cả nhà', 'chiều', 'cuối năm'], score: 9,
    aiStatus: 'skipped', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
  },
  {
    id: 'm-onday-2025', file: 'be-cuoi.jpg', col: null, at: '2025-10-20T08:15:00+07:00',
    place: 'Hà Nội', lat: 21.03, lon: 105.85,
    caption: 'Bin cười to đến mức cả nhà phải bỏ đũa xuống.',
    tags: ['bin', 'cười', 'bữa sáng', 'gia đình', 'một năm trước'], score: 9,
    members: ['m-linh', 'm-bin'],
  },
];

const media = MEDIA_SPEC.map((s) => ({
  id: s.id,
  type: 'photo',
  takenAt: s.at,
  place: s.place,
  country: 'Việt Nam',
  lat: s.lat,
  lon: s.lon,
  caption: s.caption,
  tags: s.tags,
  score: s.score,
  collectionId: s.col,
  width: DIMS[s.file][0],
  height: DIMS[s.file][1],
  url: { sm: PHOTO(s.file), lg: PHOTO(s.file), orig: PHOTO(s.file) },
  flags: {
    blurry: Boolean(s.flags && s.flags.blurry),
    nearDuplicate: Boolean(s.flags && s.flags.nearDuplicate),
    hidden: Boolean(s.flags && s.flags.hidden),
  },
  aiStatus: s.aiStatus || 'done',
}));

const byId = new Map(media.map((m) => [m.id, m]));
const mediaOf = (ids) => ids.map((id) => byId.get(id));

/** 7 mục kỷ niệm theo design/proto/BRIEF_BUILD.md. */
const COLLECTION_SPECS = [
  {
    id: 'tet-que-noi', kind: 'tet', title: 'Tết ở quê nội',
    summary: 'Ba ngày ở Nam Định: pháo hoa nửa đêm, quà Tết sáng mùng 1 và bàn ăn đầy người.',
    place: 'Nam Định', startAt: '2026-02-16T06:30:00+07:00', endAt: '2026-02-18T20:00:00+07:00',
    count: 164, cover: 'm-tet-1', members: ['m-tu-an', 'm-linh', 'm-su', 'm-ba'],
    days: [
      { date: '2026-02-16', media: ['m-tet-1', 'm-tet-2'] },
      { date: '2026-02-17', media: ['m-tet-3'] },
    ],
    route: [
      { lat: 20.42, lon: 106.17 }, { lat: 20.43, lon: 106.16 }, { lat: 20.41, lon: 106.18 },
    ],
    suggestion: {
      hide: 'Ẩn 1 ảnh bị mờ chụp lúc bắn pháo hoa.',
      hideIds: ['m-tet-2'],
      merge: 'Gộp với mục Cuối tuần ở nhà? Hai mục có chung 6 ảnh chụp ở Hà Nội.',
      split: 'Tách ảnh chụp sáng mùng 1 ra thành mục riêng?',
      splitId: 'm-tet-3',
      rename: 'Đổi tên mục thành "Tết ở quê nội (Nam Định)"?',
      renameTo: 'Tết ở quê nội (Nam Định)',
    },
  },
  {
    id: 'bin-tron-mot-tuoi', kind: 'baby', title: 'Bin tròn 1 tuổi',
    summary: 'Ngày sinh nhật đầu tiên của Bin ở nhà: bánh chưa kịp cắt thì Bin đã cười.',
    place: 'Hà Nội', startAt: '2026-03-08T08:00:00+07:00', endAt: '2026-03-08T21:00:00+07:00',
    count: 98, cover: 'm-baby-1', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
    days: [{ date: '2026-03-08', media: ['m-baby-1', 'm-baby-2'] }],
    route: [{ lat: 21.03, lon: 105.85 }],
    suggestion: {
      hide: 'Ẩn 1 ảnh chụp mờ trong tiệc sinh nhật.',
      hideIds: [],
      merge: 'Gộp với mục Sinh nhật Su 7 tuổi? Cùng chỗ, cùng bánh.',
      split: 'Tách ảnh chụp tay bé xíu ra thành mục riêng?',
      splitId: 'm-baby-2',
      rename: 'Đổi tên mục thành "Sinh nhật Bin 1 tuổi"?',
      renameTo: 'Sinh nhật Bin 1 tuổi',
    },
  },
  {
    id: 'sinh-nhat-su', kind: 'birthday', title: 'Sinh nhật Su 7 tuổi',
    summary: 'Su thổi hết nến trong tiếng vỗ tay, rồi cả nhà ăn bánh tới tối.',
    place: 'Hà Nội', startAt: '2026-05-02T14:00:00+07:00', endAt: '2026-05-02T22:30:00+07:00',
    count: 121, cover: 'm-bd-1', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
    days: [{ date: '2026-05-02', media: ['m-bd-1', 'm-bd-2', 'm-bd-3'] }],
    route: [{ lat: 21.03, lon: 105.85 }],
    suggestion: {
      hide: 'Ẩn 1 ảnh chụp mờ lúc cắt bánh.',
      hideIds: ['m-bd-3'],
      merge: 'Gộp với mục Cuối tuần ở nhà? Cùng chụp ở nhà.',
      split: 'Tách phần ảnh chụp gia đình ra thành mục riêng?',
      splitId: 'm-bd-3',
      rename: 'Đổi tên mục thành "Sinh nhật Su (7 tuổi)"?',
      renameTo: 'Sinh nhật Su (7 tuổi)',
    },
  },
  {
    id: 'he-da-lat', kind: 'trip', title: 'Hè ở Đà Lạt',
    summary: 'Ba ngày hai đêm, chiếc xe bảy chỗ và rất nhiều sương.',
    place: 'Đà Lạt', startAt: '2026-07-12T06:00:00+07:00', endAt: '2026-07-14T20:00:00+07:00',
    count: 236, cover: 'm-dl-4', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
    days: [
      { date: '2026-07-12', media: ['m-dl-1', 'm-dl-2'] },
      { date: '2026-07-13', media: ['m-dl-3', 'm-dl-4', 'm-dl-6'] },
      { date: '2026-07-14', media: ['m-dl-5'] },
    ],
    route: [
      { lat: 11.93, lon: 108.37 }, { lat: 11.94, lon: 108.44 },
      { lat: 11.88, lon: 108.51 }, { lat: 12.04, lon: 108.44 },
    ],
    suggestion: {
      hide: '2 ảnh bị mờ đã được ẩn. Các ảnh chụp ở đèo Prenn bị rung tay.',
      hideIds: ['m-dl-2', 'm-dl-5'],
      merge: 'Gộp với mục Cuối tuần ở nhà? Hai mục có chung 9 ảnh chụp ngày 11 tháng 7.',
      split: 'Tách ngày 13 tháng 7 ra thành mục riêng?',
      splitId: 'm-dl-6',
      rename: 'Đổi tên mục thành "Đà Lạt tháng 7"?',
      renameTo: 'Đà Lạt tháng 7',
    },
  },
  {
    id: 'bien-nha-trang', kind: 'trip', title: 'Biển Nha Trang',
    summary: 'Bốn ngày ở Nha Trang, nước ấm và Su không chịu ra khỏi biển.',
    place: 'Nha Trang', startAt: '2026-08-08T09:00:00+07:00', endAt: '2026-08-11T17:00:00+07:00',
    count: 187, cover: 'm-nt-1', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin'],
    days: [
      { date: '2026-08-08', media: ['m-nt-1'] },
      { date: '2026-08-09', media: ['m-nt-2'] },
      { date: '2026-08-10', media: ['m-nt-3'] },
    ],
    route: [
      { lat: 12.24, lon: 109.19 }, { lat: 12.22, lon: 109.21 }, { lat: 12.25, lon: 109.17 },
    ],
    suggestion: {
      hide: 'Ẩn 1 ảnh chụp mờ lúc chụp dưới nước.',
      hideIds: [],
      merge: 'Gộp với mục Hè ở Đà Lạt? Cùng là chuyến đi hè.',
      split: 'Tách ảnh chụp chung ra thành mục riêng?',
      splitId: 'm-nt-3',
      rename: 'Đổi tên mục thành "Nha Trang tháng 8"?',
      renameTo: 'Nha Trang tháng 8',
    },
  },
  {
    id: 'cuoi-tuan-o-nha', kind: 'weekend', title: 'Cuối tuần ở nhà',
    summary: 'Những cuối tuần ở Hà Nội: bếp, phòng khách, Hồ Tây và mấy chuyến đi chỉ nửa ngày.',
    place: 'Hà Nội', startAt: '2026-01-11T08:00:00+07:00', endAt: '2026-12-28T22:00:00+07:00',
    count: 372, cover: 'm-wk-4', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin', 'm-ba'],
    days: [
      { date: '2026-04-04', media: ['m-wk-1'] },
      { date: '2026-04-05', media: ['m-wk-2'] },
      { date: '2026-06-14', media: ['m-wk-3'] },
      { date: '2026-09-12', media: ['m-wk-5'] },
      { date: '2026-10-10', media: ['m-wk-4'] },
    ],
    route: [
      { lat: 21.03, lon: 105.85 }, { lat: 21.07, lon: 105.82 }, { lat: 21.08, lon: 105.42 },
      { lat: 21.02, lon: 105.46 }, { lat: 20.99, lon: 105.94 }, { lat: 20.95, lon: 105.86 },
    ],
    suggestion: {
      hide: '1 ảnh bị mờ đã được ẩn. Ảnh chụp trong bếp tối bị rung tay.',
      hideIds: ['m-wk-1'],
      merge: 'Gộp với mục Giáng sinh với bà? Cùng ở nhà bà.',
      split: 'Tách các ảnh đi Ba Vì ra thành mục riêng?',
      splitId: 'm-wk-3',
      rename: 'Đổi tên mục thành "Ở nhà cuối tuần"?',
      renameTo: 'Ở nhà cuối tuần',
    },
  },
  {
    id: 'giang-sinh-voi-ba', kind: 'holiday', title: 'Giáng sinh với bà',
    summary: 'Sáng Giáng sinh ở nhà bà, quà, nước ngọt và tiếng cười của Bin.',
    place: 'Hà Nội', startAt: '2026-12-25T08:00:00+07:00', endAt: '2026-12-25T22:00:00+07:00',
    count: 70, cover: 'm-xmas-1', members: ['m-tu-an', 'm-linh', 'm-su', 'm-bin', 'm-ba'],
    days: [{ date: '2026-12-25', media: ['m-xmas-1'] }],
    route: [{ lat: 21.03, lon: 105.85 }],
    suggestion: {
      hide: 'Ẩn 1 ảnh chụp mờ do đèn flash.',
      hideIds: [],
      merge: 'Gộp với mục Cuối tuần ở nhà? Cùng ở nhà bà.',
      split: 'Tách ảnh chụp riêng với bà ra thành mục riêng?',
      splitId: 'm-xmas-1',
      rename: 'Đổi tên mục thành "Giáng sinh ở nhà bà"?',
      renameTo: 'Giáng sinh ở nhà bà',
    },
  },
];

/** Tháng mở đầu chương trong tổng kết năm. */
const CHAPTER_MONTH = {
  'tet-que-noi': 2,
  'bin-tron-mot-tuoi': 3,
  'sinh-nhat-su': 5,
  'he-da-lat': 7,
  'bien-nha-trang': 8,
  'cuoi-tuan-o-nha': 9,
  'giang-sinh-voi-ba': 12,
};

const collections = COLLECTION_SPECS.map((c) => ({
  id: c.id,
  kind: c.kind,
  title: c.title,
  summary: c.summary,
  place: c.place,
  startAt: c.startAt,
  endAt: c.endAt,
  status: 'accepted',
  cover: byId.get(c.cover),
  count: c.count,
  members: membersOf(c.members),
}));

const collectionDetails = {};
for (const c of COLLECTION_SPECS) {
  const base = collections.find((x) => x.id === c.id);
  collectionDetails[c.id] = {
    ...base,
    days: c.days.map((d) => ({ date: d.date, media: mediaOf(d.media) })),
    route: c.route,
    suggestions: [
      {
        id: `${c.id}-sug-hide`,
        type: 'hide_blurry',
        text: c.suggestion.hide,
        payload: { mediaIds: c.suggestion.hideIds },
      },
      {
        id: `${c.id}-sug-merge`,
        type: 'merge',
        text: c.suggestion.merge,
        payload: { intoId: 'cuoi-tuan-o-nha' },
      },
      {
        id: `${c.id}-sug-split`,
        type: 'split',
        text: c.suggestion.split,
        payload: { mediaId: c.suggestion.splitId },
      },
      {
        id: `${c.id}-sug-rename`,
        type: 'rename',
        text: c.suggestion.rename,
        payload: { title: c.suggestion.renameTo },
      },
    ],
  };
}

/** 9 nơi đã đến (tọa độ + số ảnh theo design/proto/ban-do.html). */
const PLACES = [
  { id: 'p-ha-noi', place: 'Nhà mình, Hà Nội', lat: 21.03, lon: 105.85, count: 212, cover: 'm-wk-1', collectionId: 'cuoi-tuan-o-nha' },
  { id: 'p-ho-tay', place: 'Hồ Tây', lat: 21.07, lon: 105.82, count: 48, cover: 'm-wk-4', collectionId: 'cuoi-tuan-o-nha' },
  { id: 'p-ba-vi', place: 'Ba Vì', lat: 21.08, lon: 105.42, count: 39, cover: 'm-wk-3', collectionId: 'cuoi-tuan-o-nha' },
  { id: 'p-dong-mo', place: 'Đồng Mô', lat: 21.02, lon: 105.46, count: 27, cover: 'm-wk-5', collectionId: 'cuoi-tuan-o-nha' },
  { id: 'p-ecopark', place: 'Ecopark', lat: 20.99, lon: 105.94, count: 31, cover: 'm-baby-1', collectionId: 'cuoi-tuan-o-nha' },
  { id: 'p-yen-so', place: 'Công viên Yên Sở', lat: 20.95, lon: 105.86, count: 15, cover: 'm-hero-chay', collectionId: null },
  { id: 'p-nam-dinh', place: 'Quê nội, Nam Định', lat: 20.42, lon: 106.17, count: 164, cover: 'm-tet-1', collectionId: 'tet-que-noi' },
  { id: 'p-da-lat', place: 'Đà Lạt', lat: 11.94, lon: 108.44, count: 236, cover: 'm-dl-3', collectionId: 'he-da-lat' },
  { id: 'p-nha-trang', place: 'Nha Trang', lat: 12.24, lon: 109.19, count: 187, cover: 'm-nt-1', collectionId: 'bien-nha-trang' },
];

const mapPoints = PLACES.map((p) => ({
  id: p.id,
  lat: p.lat,
  lon: p.lon,
  place: p.place,
  count: p.count,
  cover: byId.get(p.cover),
  collectionId: p.collectionId,
}));

const STATS = { photos: 1248, videos: 86, places: 9, collections: 7 };

const recent = [...media]
  .filter((m) => m.takenAt.startsWith('2026'))
  .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1))
  .slice(0, 12);

const me = {
  user: { id: 'u-tu-an', username: 'bo', displayName: 'Bố Tuấn', avatarColor: '#F6C445' },
  family: { id: 'fam-bin-su', name: 'Nhà Bin & Su', slug: 'nha-bin-su' },
};

const home = {
  greeting: 'Chào nhà Bin & Su. Một năm nhiều ngày đẹp đang chờ xem lại.',
  stats: STATS,
  recent,
  collections,
  onThisDay: {
    yearsAgo: 1,
    date: '2025-10-20',
    media: byId.get('m-onday-2025'),
  },
  mapPreview: {
    points: PLACES.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      count: p.count,
      cover: byId.get(p.cover),
    })),
  },
};

const chapters = COLLECTION_SPECS.map((c) => {
  const list = media.filter((m) => m.collectionId === c.id).sort((a, b) => b.score - a.score);
  return {
    month: CHAPTER_MONTH[c.id],
    collection: collections.find((x) => x.id === c.id),
    highlights: list.slice(0, 4),
  };
}).sort((a, b) => a.month - b.month);

const recap2026 = {
  year: 2026,
  intro:
    'Năm 2026 của nhà mình bắt đầu bằng pháo hoa nửa đêm ở quê nội và kết thúc bằng buổi sáng Giáng sinh cùng bà. '
    + '1.248 tấm ảnh, 86 đoạn video, 9 nơi đã đến và 7 mục kỷ niệm — nhiều nhất vẫn là những cuối tuần ở Hà Nội.',
  stats: { ...STATS, birthdays: 2, trips: 2 },
  chapters,
  topPlaces: PLACES.map((p) => ({ place: p.place, count: p.count }))
    .sort((a, b) => b.count - a.count),
};

/** Dòng thời gian năm 2026: gom theo tháng → ngày. */
const timelineMonths = [];
const monthMap = new Map();
for (const m of media) {
  if (!m.takenAt.startsWith('2026')) continue;
  const month = Number(m.takenAt.slice(5, 7));
  const date = m.takenAt.slice(0, 10);
  if (!monthMap.has(month)) {
    const entry = { month, days: [] };
    monthMap.set(month, entry);
    timelineMonths.push(entry);
  }
  const monthEntry = monthMap.get(month);
  let day = monthEntry.days.find((d) => d.date === date);
  if (!day) {
    day = { date, collectionId: m.collectionId, media: [] };
    monthEntry.days.push(day);
  }
  day.media.push(m);
}
for (const monthEntry of timelineMonths) {
  monthEntry.days.sort((a, b) => (a.date < b.date ? -1 : 1));
}
timelineMonths.sort((a, b) => a.month - b.month);

const timeline2026 = { months: timelineMonths, nextCursor: null };

/** Bốn câu tìm kiếm mẫu trong MEGAPLAN_r2.md + một câu không có kết quả. */
const SEARCHES = [
  {
    file: 'search-anh-sinh-nhat-su-nam-nay.json',
    slug: 'anh-sinh-nhat-su-nam-nay',
    query: 'ảnh sinh nhật Su năm nay',
    filters: {
      from: '2026-05-01', to: '2026-05-31', places: ['Hà Nội'],
      tags: ['sinh nhật', 'bánh', 'nến'], kinds: ['birthday'], members: ['m-su'],
    },
    results: ['m-bd-1', 'm-bd-2', 'm-bd-3'],
    collections: ['sinh-nhat-su'],
  },
  {
    file: 'search-di-bien-thang-8.json',
    slug: 'di-bien-thang-8',
    query: 'đi biển tháng 8',
    filters: {
      from: '2026-08-01', to: '2026-08-31', places: ['Nha Trang'],
      tags: ['biển', 'nước', 'nắng'], kinds: ['trip'], members: [],
    },
    results: ['m-nt-1', 'm-nt-2', 'm-nt-3'],
    collections: ['bien-nha-trang'],
  },
  {
    file: 'search-tet-o-que.json',
    slug: 'tet-o-que',
    query: 'Tết ở quê',
    filters: {
      from: '2026-02-10', to: '2026-02-20', places: ['Nam Định'],
      tags: ['tết', 'pháo hoa', 'quà'], kinds: ['tet'], members: ['m-ba'],
    },
    results: ['m-tet-1', 'm-tet-2', 'm-tet-3'],
    collections: ['tet-que-noi'],
  },
  {
    file: 'search-anh-co-banh-kem.json',
    slug: 'anh-co-banh-kem',
    query: 'ảnh có bánh kem',
    filters: {
      from: '2026-01-01', to: '2026-12-31', places: ['Hà Nội'],
      tags: ['bánh', 'kem', 'sinh nhật'], kinds: ['birthday'], members: [],
    },
    results: ['m-bd-1', 'm-bd-3', 'm-bd-2', 'm-wk-5'],
    collections: ['sinh-nhat-su', 'cuoi-tuan-o-nha'],
  },
];

const searchFiles = {};
for (const s of SEARCHES) {
  searchFiles[s.file] = {
    query: s.query,
    filters: s.filters,
    results: mediaOf(s.results),
    collections: s.collections.map((id) => collections.find((c) => c.id === id)),
  };
}

const searchEmpty = {
  query: '',
  filters: { from: null, to: null, places: [], tags: [], kinds: [], members: [] },
  results: [],
  collections: [],
};

/** Trạng thái AI từng ảnh (màn tải ảnh dùng để bật caption khi xong). */
const mediaStatus = [
  ...media.map((m) => ({
    id: m.id,
    aiStatus: m.aiStatus,
    caption: m.aiStatus === 'done' ? m.caption : '',
    collectionId: m.collectionId,
  })),
  { id: 'm-upload-28', aiStatus: 'pending', caption: '', collectionId: null },
  { id: 'm-upload-29', aiStatus: 'pending', caption: '', collectionId: null },
  { id: 'm-upload-30', aiStatus: 'failed', caption: '', collectionId: null },
];

/** ------------------------------------------------------------------ */
/* seed-ai.json: dữ liệu AI viết sẵn cho script seed của máy chủ      */
/* (caption/tags/score/kind_hint + ngày giờ, tọa độ, mục, người)       */
/** ------------------------------------------------------------------ */

const toUtc = (iso) => new Date(iso).toISOString();

const seedAi = {
  note:
    'Dữ liệu AI viết sẵn cho seed-family.js — KHÔNG gọi AI. '
    + 'Sinh bằng impl/web/src/dev/mock/_gen.mjs (nguồn chung với mock web).',
  family: { name: 'Nhà Bin & Su', slug: 'bin-su' },
  users: [
    {
      username: 'bo',
      email: 'bo@bin-su.vn',
      password: 'kyniem123',
      displayName: 'Bố Tuấn',
      avatarColor: '#F6C445',
    },
    {
      username: 'me',
      email: 'me@bin-su.vn',
      password: 'kyniem123',
      displayName: 'Mẹ Linh',
      avatarColor: '#FFC2DB',
    },
  ],
  members: MEMBERS.map((m) => ({ name: m.name, color: m.color })),
  photos: MEDIA_SPEC.map((s) => {
    const collection = s.col ? COLLECTION_SPECS.find((c) => c.id === s.col) : null;
    const order = collection ? collection.days.findIndex((d) => d.media.includes(s.id)) : 0;
    return {
      file: s.file,
      mockId: s.id,
      collectionId: s.col,
      takenAt: toUtc(s.at),
      lat: s.lat,
      lon: s.lon,
      place: s.place,
      country: 'Việt Nam',
      caption: s.caption,
      tags: s.tags,
      score: s.score,
      kindHint: collection ? collection.kind : 'everyday',
      members: (s.members ?? []).map((id) => memberOf(id).name),
      flags: {
        blurry: Boolean(s.flags && s.flags.blurry),
        nearDuplicate: Boolean(s.flags && s.flags.nearDuplicate),
        hidden: Boolean(s.flags && s.flags.hidden),
      },
      aiStatus: s.aiStatus || 'done',
      order: order >= 0 ? order : 0,
    };
  }),
  collections: COLLECTION_SPECS.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    summary: c.summary,
    place: c.place,
    startAt: toUtc(c.startAt),
    endAt: toUtc(c.endAt),
    coverFile: MEDIA_SPEC.find((s) => s.id === c.cover).file,
    count: c.count,
    members: c.members.map((id) => memberOf(id).name),
    suggestions: collectionDetails[c.id].suggestions.map((s) => ({
      type: s.type,
      text: s.text,
      payload: s.payload,
    })),
  })),
};

/** ------------------------------------------------------------------ */

const OUT = {
  'me.json': me,
  'home.json': home,
  'recap-2026.json': recap2026,
  'collections.json': collections,
  'timeline-2026.json': timeline2026,
  'map.json': { points: mapPoints },
  'search-empty.json': searchEmpty,
  'media-status.json': mediaStatus,
  'members.json': MEMBERS,
  ...searchFiles,
};
for (const c of COLLECTION_SPECS) {
  OUT[`collection-${c.id}.json`] = collectionDetails[c.id];
}

const written = [];
for (const [name, data] of Object.entries(OUT)) {
  fs.writeFileSync(path.join(DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  written.push(name);
}
written.sort();
fs.mkdirSync(SERVER_SCRIPTS, { recursive: true });
fs.writeFileSync(
  path.join(SERVER_SCRIPTS, 'seed-ai.json'),
  `${JSON.stringify(seedAi, null, 2)}\n`,
  'utf8',
);
console.log(`Đã ghi ${written.length} file vào ${DIR}`);
console.log(written.join('\n'));
console.log(`Đã ghi seed-ai.json vào ${SERVER_SCRIPTS}`);
console.log(`media: ${media.length}, collections: ${collections.length}, ảnh dùng: ${new Set(MEDIA_SPEC.map((m) => m.file)).size}`);
