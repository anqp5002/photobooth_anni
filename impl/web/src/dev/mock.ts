/**
 * Dữ liệu giả đúng hợp đồng API (MEGAPLAN_r1.md) dùng khi máy chủ chưa sẵn sàng.
 * ≥ 6 chặng, ≥ 2 nước, đủ phương tiện, có chặng thiếu nhiệt độ, có mô tả dài.
 */
import { avatarImage, scenePhoto, type SceneKind } from '../lib/scene';
import { encodePolyline, type LatLon } from '../map/polyline';
import type {
  Country,
  Media,
  Segment,
  Step,
  Trip,
  TripSummary,
  UserProfile,
  Vehicle,
} from '../api/types';

const HOUR = 3_600_000;
const DAY = 86_400_000;

const anchor = (() => {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d.getTime();
})();

const VN: Country = { code: 'VN', name: 'Việt Nam' };
const TH: Country = { code: 'TH', name: 'Thái Lan' };
const JP: Country = { code: 'JP', name: 'Nhật Bản' };
const CH: Country = { code: 'CH', name: 'Thụy Sĩ' };

interface StepSpec {
  id: string;
  slug: string;
  name: string;
  country: Country;
  lat: number;
  lon: number;
  offsetHours: number;
  tempC: number | null;
  weatherIcon: string | null;
  photos: number;
  videos: number;
  kind: SceneKind;
  seed: number;
  likes: number;
  comments: number;
  description: string;
}

const XUYEN_VIET_STEPS: StepSpec[] = [
  {
    id: 's-hanoi',
    slug: 'ha-noi',
    name: 'Hà Nội mùa thể dục',
    country: VN,
    lat: 21.0278,
    lon: 105.8342,
    offsetHours: 0,
    tempC: 31,
    weatherIcon: 'sunny',
    photos: 4,
    videos: 0,
    kind: 'town',
    seed: 11,
    likes: 128,
    comments: 14,
    description:
      'Ba ngày ở Hà Nội để quen lại mùi phở, đi bộ quanh Hồ Hoàn Kiếm và ngồi ăn mì tôm lúc sáng sớm. Xe máy cũ chạy đều, phố cũ buồn nhưng đẹp.',
  },
  {
    id: 's-sapa',
    slug: 'sa-pa',
    name: 'Sa Pa trong sương',
    country: VN,
    lat: 22.3364,
    lon: 103.8438,
    offsetHours: 29,
    tempC: null,
    weatherIcon: null,
    photos: 3,
    videos: 0,
    kind: 'mountain',
    seed: 23,
    likes: 96,
    comments: 6,
    description:
      'Leo bằng xe máy qua đèo Hoàng Su Phì, dọc đường mây mà đầu lạnh. Ở đây không có dữ liệu thời tiết nên mình chỉ ghi lại cảm giác: sương mù ướt, đám trà thành từng đợt trôi qua cửa sổ.',
  },
  {
    id: 's-dalat',
    slug: 'da-lat',
    name: 'Đà Lạt, chiều thứ hai',
    country: VN,
    lat: 12.2388,
    lon: 108.9921,
    offsetHours: 51,
    tempC: 22,
    weatherIcon: 'cloudy',
    photos: 6,
    videos: 1,
    kind: 'lake',
    seed: 37,
    likes: 241,
    comments: 32,
    description: `Chiều thứ hai ở Đà Lạt, trời chuyển màu nhanh hơn cả cái đồng hồ. Mình thuê một chiếc xe máy cũ để chạy vòng hồ Xuân Hương, rồi dừng ở một quán cà phê trên đường Trần Phú để ngồi cho tới khi trời tối.

Chuyện đáng nhớ nhất buổi chiều hôm ấy không phải cảnh, mà là con đường. Đường mòn đi bộ trên đỉng Langbiang lúc đó vắng lặng đến mức nghe rõ tiếng gió kéo qua lá thông. Trên đường có một người phụ nữ dắt xe điện lên dốc, bà dừng lại chỉ cho mình đường rẽ vào một khoảnh đồng cỏ mà bà gọi là "chỗ ngủ của mây". Bà nói vào buổi sáng nào trời cũng trắng xóa, nên người ta hay đến ngồi uống trà.

Mình ở lại tới khi trời tối hẳn rồi mới xuống thành. Phố Đà Lạt buổi tối lạ ẩm, ánh đèn vàng vọt dọc hai bên đường, rồi tiếng xe cộ kéo dài. Ở chợ đêm mình ăn bánh hỏi nóng, uống một ly sữa đậu nành rồi đi bộ ngược về khách sạn. Đêm đó trời mưa lất, mưa kiểu mưa phố núi, rào lên hiên rồi tạnh trong chốc lát.

Sáng hôm sau dậy sớm, ngồi ở hiên nhìn lên đồi thông, mây lại cuộn trên mặt đất lần nữa. Có lẽ vì vậy mà mình vẫn còn nhớ Đà Lạt vào chiều thứ hai hơn cả những nơi mình đã ở lâu hơn nhiều.

Chiều muộn mình ghé một quán cà phê nhỏ trên đường Nguyễn Trãi, ngồi ở góc cuối, nghe tiếng đàn ghi ta ai đó tập chưa xong bài. Chủ quán đặt cho mình một tách cà phê sữa đá và bảo rằng hôm đó trời "đẹp lắm, giữ lấy". Mình không biết nên trả lời gì, chỉ gật đầu.

Chiều thứ hai ở Đà Lạt, mình không làm được chuyện gì lớn. Mình chỉ đi bộ, ngồi, uống cà phê, và nhìn mây.`,
  },
  {
    id: 's-nhatrang',
    slug: 'nha-trang',
    name: 'Biển Nha Trang',
    country: VN,
    lat: 12.2381,
    lon: 109.196,
    offsetHours: 55,
    tempC: 29,
    weatherIcon: 'sunny',
    photos: 5,
    videos: 0,
    kind: 'sea',
    seed: 53,
    likes: 178,
    comments: 21,
    description:
      'Bãi biển dài và nước ấm. Chiều ngồi ở quán hải sản ven đường, ăn tôm nướng và nhìn thuyền cá ra khơi.',
  },
  {
    id: 's-phuquoc',
    slug: 'phu-quoc',
    name: 'Phú Quốc ngoài đảo',
    country: VN,
    lat: 10.2899,
    lon: 103.984,
    offsetHours: 77,
    tempC: 30,
    weatherIcon: 'sunny',
    photos: 2,
    videos: 0,
    kind: 'sea',
    seed: 71,
    likes: 84,
    comments: 9,
    description:
      'Đi phà từ Nha Trang sang Phú Quốc, cả ngày trên biển. Ở đây đi bộ bằng dép, ăn cá nướng và nước dừa tươi.',
  },
  {
    id: 's-bangkok',
    slug: 'bangkok',
    name: 'Bangkok nghiêng mình về phía sông',
    country: TH,
    lat: 13.7563,
    lon: 100.5018,
    offsetHours: 106,
    tempC: 33,
    weatherIcon: 'hot',
    photos: 4,
    videos: 0,
    kind: 'city',
    seed: 89,
    likes: 156,
    comments: 18,
    description:
      'Bay sang Bangkok, nắng đổ ngay khi bước ra sân bay. Đi chợ thành, ăn xôi gà, rồi ngồi bên sông Chao Phraya nhìn đèn sáng.',
  },
  {
    id: 's-tokyo',
    slug: 'tokyo',
    name: 'Tōkyō giữa khuya',
    country: JP,
    lat: 35.6762,
    lon: 139.6503,
    offsetHours: 132,
    tempC: 26,
    weatherIcon: 'cloudy',
    photos: 3,
    videos: 1,
    kind: 'city',
    seed: 103,
    likes: 312,
    comments: 41,
    description:
      'Mười một giờ đêm ở Shinjuku, biển người vẫn đông. Ăn ramen ở quán nhỏ dưới tầng, đi bộ về khách sạn giữa những tòa nhà sáng đèn.',
  },
  {
    id: 's-zurich',
    slug: 'zurich',
    name: 'Zürich và chiếc tàu đồng hồ',
    country: CH,
    lat: 47.3769,
    lon: 8.5417,
    offsetHours: 180,
    tempC: 19,
    weatherIcon: 'rain',
    photos: 2,
    videos: 0,
    kind: 'mountain',
    seed: 127,
    likes: 143,
    comments: 12,
    description:
      'Chuyến tàu từ sân bay Zurich HB, ngồi bên cửa sổ nhìn hồ và dãy Alps. Trời mưa nhẹ, mọi thứ xám và rất gọn.',
  },
  {
    id: 's-sion',
    slug: 'sion',
    name: 'Sion dưới chân núi',
    country: CH,
    lat: 46.2331,
    lon: 7.3605,
    offsetHours: 185,
    tempC: 16,
    weatherIcon: 'snow',
    photos: 3,
    videos: 0,
    kind: 'snow',
    seed: 149,
    likes: 187,
    comments: 17,
    description:
      'Đi tàu xuống Sion rồi đi bộ lên các chỗ vườn nho. Trên cao tuyết phủ mỏng, mùi rượu vang lên từ một quán nhỏ ven đường.',
  },
  {
    id: 's-hoian',
    slug: 'hoi-an',
    name: 'Hội An, đèn lồng và mưa',
    country: VN,
    lat: 15.8801,
    lon: 108.338,
    offsetHours: 215,
    tempC: 28,
    weatherIcon: 'rain',
    photos: 4,
    videos: 0,
    kind: 'temple',
    seed: 167,
    likes: 224,
    comments: 27,
    description:
      'Bay về lại Việt Nam và dừng chân ở Hội An. Tối đèn lồng thắp đầy phố, dù mưa. ăn cao lầu, ngồi bên bếp nước mắm nghe mưa.',
  },
];

const XUYEN_VIET_VEHICLES: Vehicle[] = [
  'motorbike',
  'bus',
  'none',
  'ferry',
  'ship',
  'plane',
  'plane',
  'train',
  'plane',
];

function mediaUri(seed: number, kind: SceneKind, portrait: boolean): { lg: string; sm: string; w: number; h: number } {
  const w = portrait ? 960 : 1280;
  const h = portrait ? 1280 : 960;
  return {
    lg: scenePhoto(seed, kind, w, h),
    sm: scenePhoto(seed, kind, Math.round(w / 2.4), Math.round(h / 2.4)),
    w,
    h,
  };
}

function buildMedia(step: StepSpec): Media[] {
  const out: Media[] = [];
  for (let i = 0; i < step.photos; i += 1) {
    const portrait = i % 3 !== 1;
    const { lg, sm, w, h } = mediaUri(step.seed + i * 7, step.kind, portrait);
    out.push({
      id: `${step.id}-p${i + 1}`,
      type: 'photo',
      order: i + 1,
      orig: lg,
      lg,
      sm,
      width: w,
      height: h,
      duration: null,
      flags: { blurry: false, nearDuplicate: false, hidden: false },
    });
  }
  for (let v = 0; v < step.videos; v += 1) {
    const { lg, sm, w, h } = mediaUri(step.seed + 900 + v * 5, step.kind, false);
    out.push({
      id: `${step.id}-v${v + 1}`,
      type: 'video',
      order: step.photos + v + 1,
      orig: lg,
      lg,
      sm,
      width: w,
      height: h,
      duration: 18 + v * 7,
      flags: { blurry: false, nearDuplicate: false, hidden: false },
    });
  }
  return out;
}

function roadPolyline(a: LatLon, b: LatLon, seed: number): LatLon[] {
  const pts: LatLon[] = [];
  const steps = 5;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const wobble = ((seed % 7) - 3) * 0.09;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bulge = Math.sin(t * Math.PI) * wobble;
    pts.push([a[0] + dx * t + bulge * 0.35, a[1] + dy * t + bulge]);
  }
  return pts;
}

function buildTrip(spec: {
  id: string;
  name: string;
  slug: string;
  author: UserProfile;
  startedAtMs: number;
  endedAt: string | null;
  km: number;
  views: number;
  likes: number;
  steps: StepSpec[];
  vehicles: Vehicle[];
}): Trip {
  const steps: Step[] = spec.steps.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    startedAt: new Date(spec.startedAtMs + s.offsetHours * HOUR).toISOString(),
    location: { lat: s.lat, lon: s.lon, name: s.name.split(',')[0].trim(), country: s.country },
    weather: s.tempC === null ? null : { tempC: s.tempC, icon: s.weatherIcon ?? 'sunny' },
    comments: s.comments,
    likes: s.likes,
    media: buildMedia(s),
    draft: null,
  }));

  const segments: Segment[] = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    const vehicle = spec.vehicles[i] ?? 'none';
    const kind = vehicle === 'car' || vehicle === 'bus' || vehicle === 'motorbike' || vehicle === 'train' ? 'road' : 'straight';
    const a: LatLon = [steps[i].location.lat, steps[i].location.lon];
    const b: LatLon = [steps[i + 1].location.lat, steps[i + 1].location.lon];
    const points = kind === 'road' ? roadPolyline(a, b, i + 3) : [a, b];
    segments.push({
      fromStepId: steps[i].id,
      toStepId: steps[i + 1].id,
      vehicle,
      kind,
      polyline: encodePolyline(points, 5),
    });
  }

  const countries: Country[] = [];
  for (const s of steps) {
    const country = s.location.country;
    if (!countries.some((c) => c.code === country.code)) countries.push(country);
  }

  const firstMedia = steps[0].media[0];

  return {
    id: spec.id,
    name: spec.name,
    slug: spec.slug,
    startedAt: new Date(spec.startedAtMs).toISOString(),
    endedAt: spec.endedAt,
    timezone: 'Asia/Ho_Chi_Minh',
    km: spec.km,
    views: spec.views,
    likes: spec.likes,
    visibility: 'public',
    cover: { orig: firstMedia.orig, lg: firstMedia.lg, sm: firstMedia.sm },
    author: {
      username: spec.author.username,
      displayName: spec.author.displayName,
      avatar: spec.author.avatar,
    },
    countries,
    stepsTotal: steps.length,
    steps,
    segments,
    nextOffset: null,
  };
}

const MINH: UserProfile = {
  username: 'minh',
  displayName: 'Minh Nguyễn',
  avatar: avatarImage('Minh Nguyễn', 3),
  countryCount: 0,
  trips: [],
};

const LINH: UserProfile = {
  username: 'linh',
  displayName: 'Linh Trần',
  avatar: avatarImage('Linh Trần', 8),
  countryCount: 0,
  trips: [],
};

const xuyenViet = buildTrip({
  id: 'tripxuyenviet',
  name: 'Xuyên Việt',
  slug: 'xuyen-viet',
  author: MINH,
  startedAtMs: anchor - 9 * DAY,
  endedAt: null,
  km: 18420,
  views: 12893,
  likes: 2041,
  steps: XUYEN_VIET_STEPS,
  vehicles: XUYEN_VIET_VEHICLES,
});

const alpsTrip = buildTrip({
  id: 'tripmuaethuysi',
  name: 'Mùa hè Thụy Sĩ',
  slug: 'mua-he-thuysi',
  author: MINH,
  startedAtMs: anchor - 120 * DAY,
  endedAt: new Date(anchor - 113 * DAY).toISOString(),
  km: 1240,
  views: 5421,
  likes: 860,
  vehicles: ['train', 'car', 'bus', 'motorbike', 'none'],
  steps: [
    {
      id: 'a-geneva',
      slug: 'geneve',
      name: 'Genève',
      country: CH,
      lat: 46.2044,
      lon: 6.1432,
      offsetHours: 0,
      tempC: 24,
      weatherIcon: 'sunny',
      photos: 3,
      videos: 0,
      kind: 'city',
      seed: 211,
      likes: 61,
      comments: 4,
      description: 'Một ngày ở Genève, đi bộ quanh hồ và ăn mì ốc bên bếnh.',
    },
    {
      id: 'a-zermatt',
      slug: 'zermatt',
      name: 'Zermatt',
      country: CH,
      lat: 46.0207,
      lon: 7.7491,
      offsetHours: 26,
      tempC: 11,
      weatherIcon: 'snow',
      photos: 4,
      videos: 0,
      kind: 'snow',
      seed: 223,
      likes: 118,
      comments: 11,
      description: 'Tàu điện lên Matterhorn, tuyết trắng xóa, cà phê sữa nóng.',
    },
    {
      id: 'a-interlaken',
      slug: 'interlaken',
      name: 'Interlaken',
      country: CH,
      lat: 46.6863,
      lon: 7.8632,
      offsetHours: 49,
      tempC: 17,
      weatherIcon: 'cloudy',
      photos: 3,
      videos: 1,
      kind: 'mountain',
      seed: 237,
      likes: 92,
      comments: 8,
      description: 'Đi đứt cáp lên First, nhìn xuống thung lũng.',
    },
    {
      id: 'a-lucerne',
      slug: 'lucerne',
      name: 'Lucerne',
      country: CH,
      lat: 47.0502,
      lon: 8.3093,
      offsetHours: 62,
      tempC: 20,
      weatherIcon: 'sunny',
      photos: 2,
      videos: 0,
      kind: 'lake',
      seed: 251,
      likes: 70,
      comments: 5,
      description: 'Đi thuyền trên hồ Lucerne, ăn cá rán nướng bên bờ.',
    },
    {
      id: 'a-bern',
      slug: 'bern',
      name: 'Bern',
      country: CH,
      lat: 46.948,
      lon: 7.4474,
      offsetHours: 120,
      tempC: 18,
      weatherIcon: 'rain',
      photos: 2,
      videos: 0,
      kind: 'town',
      seed: 263,
      likes: 54,
      comments: 3,
      description: 'Thành phố cổ, đi dạo dọc sông Aare.',
    },
  ],
});

const bienPhuongNam = buildTrip({
  id: 'tripbienphuongnam',
  name: 'Biển phương Nam',
  slug: 'bien-phuong-nam',
  author: MINH,
  startedAtMs: anchor - 300 * DAY,
  endedAt: new Date(anchor - 291 * DAY).toISOString(),
  km: 3260,
  views: 9034,
  likes: 1512,
  vehicles: ['car', 'bus', 'ferry', 'ship', 'none'],
  steps: [
    {
      id: 'b-da-lat',
      slug: 'da-lat',
      name: 'Đà Lạt',
      country: VN,
      lat: 12.2388,
      lon: 108.9921,
      offsetHours: 0,
      tempC: 21,
      weatherIcon: 'cloudy',
      photos: 3,
      videos: 0,
      kind: 'lake',
      seed: 307,
      likes: 88,
      comments: 7,
      description: 'Khởi hành từ Đà Lạt.',
    },
    {
      id: 'b-hue',
      slug: 'hue',
      name: 'Huế',
      country: VN,
      lat: 16.0544,
      lon: 107.2022,
      offsetHours: 30,
      tempC: 30,
      weatherIcon: 'sunny',
      photos: 4,
      videos: 0,
      kind: 'temple',
      seed: 311,
      likes: 133,
      comments: 19,
      description: 'Cung điện và món bún bèo Huế lúc trưa.',
    },
    {
      id: 'b-da-nang',
      slug: 'da-nang',
      name: 'Đà Nẵng',
      country: VN,
      lat: 16.0544,
      lon: 108.2022,
      offsetHours: 52,
      tempC: 29,
      weatherIcon: 'sunny',
      photos: 3,
      videos: 0,
      kind: 'sea',
      seed: 331,
      likes: 96,
      comments: 10,
      description: 'Cầu Vàng, bãi biển Mỹ Khê.',
    },
    {
      id: 'b-hue-2',
      slug: 'hue-lai',
      name: 'Huế lần hai',
      country: VN,
      lat: 16.4634,
      lon: 107.5909,
      offsetHours: 190,
      tempC: 27,
      weatherIcon: 'rain',
      photos: 2,
      videos: 0,
      kind: 'forest',
      seed: 347,
      likes: 51,
      comments: 4,
      description: 'Quay lại Huế trên đường điện.',
    },
  ],
});

const linhTrip = buildTrip({
  id: 'tripvungvinh',
  name: 'Một tuần ở vùng vịnh',
  slug: 'mot-tuan-vung-vinh',
  author: LINH,
  startedAtMs: anchor - 60 * DAY,
  endedAt: new Date(anchor - 53 * DAY).toISOString(),
  km: 2140,
  views: 3311,
  likes: 480,
  vehicles: ['plane', 'train', 'ferry', 'none'],
  steps: [
    {
      id: 'l-bangkok',
      slug: 'bangkok',
      name: 'Bangkok',
      country: TH,
      lat: 13.7563,
      lon: 100.5018,
      offsetHours: 0,
      tempC: 32,
      weatherIcon: 'hot',
      photos: 3,
      videos: 0,
      kind: 'city',
      seed: 401,
      likes: 74,
      comments: 9,
      description: 'Ba ngày ở Bangkok, ăn chè và đi thuyền sông.',
    },
    {
      id: 'l-singapore',
      slug: 'singapore',
      name: 'Singapore',
      country: { code: 'SG', name: 'Singapore' },
      lat: 1.3521,
      lon: 103.8198,
      offsetHours: 40,
      tempC: 30,
      weatherIcon: 'sunny',
      photos: 3,
      videos: 0,
      kind: 'city',
      seed: 419,
      likes: 88,
      comments: 6,
      description: 'Ăn ở hawker centre, đi bộ dọc Marina Bay.',
    },
    {
      id: 'l-phu-quoc',
      slug: 'phu-quoc',
      name: 'Phú Quốc',
      country: VN,
      lat: 10.2899,
      lon: 103.984,
      offsetHours: 150,
      tempC: 29,
      weatherIcon: 'sunny',
      photos: 2,
      videos: 0,
      kind: 'sea',
      seed: 433,
      likes: 45,
      comments: 3,
      description: 'Đi phà qua biển, nằm nắng cả buổi chiều.',
    },
  ],
});

const TRIPS: Trip[] = [xuyenViet, alpsTrip, bienPhuongNam, linhTrip];

function summarise(trip: Trip): TripSummary {
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    cover: { sm: trip.cover.sm, lg: trip.cover.lg },
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    steps: trip.stepsTotal,
    km: trip.km,
    countries: trip.countries.length,
  };
}

MINH.trips = [summarise(xuyenViet), summarise(alpsTrip), summarise(bienPhuongNam)];
MINH.countryCount = new Set(
  TRIPS.filter((t) => t.author.username === 'minh').flatMap((t) => t.countries.map((c) => c.code)),
).size;
LINH.trips = [summarise(linhTrip)];
LINH.countryCount = new Set(linhTrip.countries.map((c) => c.code)).size;

const USERS: UserProfile[] = [MINH, LINH];

export function mockUser(username: string): UserProfile | null {
  return USERS.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export function mockTrip(id: string): Trip | null {
  return TRIPS.find((t) => t.id === id) ?? null;
}

export function mockTrips(): Trip[] {
  return TRIPS;
}

/** Danh sách nơi đã đến, dùng cho bản đồ thế giới ở hồ sơ. */
export function mockVisitedPlaces(username: string): { name: string; lat: number; lon: number; country: string }[] {
  const out: { name: string; lat: number; lon: number; country: string }[] = [];
  for (const trip of TRIPS.filter((t) => t.author.username === username)) {
    for (const step of trip.steps) {
      if (!out.some((p) => p.name === step.location.name)) {
        out.push({
          name: step.location.name,
          lat: step.location.lat,
          lon: step.location.lon,
          country: step.location.country.name,
        });
      }
    }
  }
  return out;
}
