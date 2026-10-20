import { Link } from 'react-router-dom';
import type { RecapChapter } from '../../api';

export interface ChapterEntry {
  id: string;
  title: string;
}

/** Thanh bên phải báo chương đang xem — chép theo `design/proto/tong-ket.html`. */
export function ChapterRail({
  chapters,
  activeId,
}: {
  chapters: ChapterEntry[];
  activeId: string | null;
}) {
  if (chapters.length === 0) return null;
  return (
    <nav className="rail content" aria-label="Các chương của năm">
      {chapters.map((chapter) => (
        <a
          key={chapter.id}
          href={`#${chapter.id}`}
          className={activeId === chapter.id ? 'on' : undefined}
        >
          <i />
          <span>{chapter.title}</span>
        </a>
      ))}
    </nav>
  );
}

const MONTH_WORDS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

function monthWord(month: number): string {
  return MONTH_WORDS[month - 1] ?? `tháng ${month}`;
}

/** Chương trải dài quanh năm thì không hiện số tháng. */
function spansWholeYear(chapter: RecapChapter): boolean {
  const days =
    (new Date(chapter.collection.endAt).getTime() -
      new Date(chapter.collection.startAt).getTime()) /
    (24 * 60 * 60 * 1000);
  return days > 60;
}

/** Số tháng (hoặc "Quanh năm") in to trong chữ mờ lớn của chương. */
function ghostText(chapter: RecapChapter): string {
  return spansWholeYear(chapter)
    ? 'Quanh năm'
    : String(chapter.month).padStart(2, '0');
}

export interface ChaptersProps {
  chapters: RecapChapter[];
  /** Mã của chương dùng làm dải ảnh toàn màn. */
  bandId: string | null;
}

/**
 * Chương xen kẽ trái/phải như bản mẫu: dải ảnh toàn màn không tính vào phép
 * xen kẽ, nên các chương sau nó vẫn đảo bên như `design/proto/tong-ket.html`.
 */
function flippedChapters(chapters: RecapChapter[], bandId: string | null): Set<string> {
  const flipped = new Set<string>();
  let plain = 0;
  for (const chapter of chapters) {
    const id = `ch-${chapter.collection.id}`;
    if (id === bandId) continue;
    if (plain % 2 === 1) flipped.add(id);
    plain += 1;
  }
  return flipped;
}

/** Các chương của năm xen kẽ trái/phải — chép theo `design/proto/tong-ket.html`. */
export function Chapters({ chapters, bandId }: ChaptersProps) {
  const flipped = flippedChapters(chapters, bandId);

  return (
    <div className="chapters content">
      {chapters.map((chapter) => {
        const id = `ch-${chapter.collection.id}`;
        const collection = chapter.collection;
        const highlights = chapter.highlights;
        const main = highlights[0];
        // Ảnh nhỏ nổi lên phải là tấm khác tấm chính, không lặp lại ảnh đã có.
        const small = highlights.find((media) => media.id !== main?.id);
        const wholeYear = spansWholeYear(chapter);
        const meta = `${wholeYear ? 'Quanh năm' : monthWord(chapter.month)}, ${collection.place}`;

        if (id === bandId && main) {
          // Ảnh nền dải toàn màn là ảnh bìa của mục (tấm đặc trưng nhất).
          const cover = collection.cover ?? main;
          return (
            <section className="band" id={id} key={id}>
              <div className="band-bg" data-bg>
                <img src={cover.url.lg} alt={cover.caption} loading="lazy" />
              </div>
              <span className="ghost" aria-hidden="true">
                {ghostText(chapter)}
              </span>
              <div className="band-t rv">
                <h2>{collection.title}</h2>
                <p className="meta">{monthWord(chapter.month)}</p>
                <p>{collection.summary}</p>
              </div>
            </section>
          );
        }

        return (
          <section className={`ch${flipped.has(id) ? ' rev' : ''}`} id={id} key={id}>
            <span className={`ghost${wholeYear ? ' word' : ''}`} aria-hidden="true">
              {ghostText(chapter)}
            </span>
            <div className="wrap ch-in">
              <div className="txt rv">
                <h2>{collection.title}</h2>
                <p className="meta">{meta}</p>
                <p>{collection.summary}</p>
                <Link className="btn vang nho" to={`/muc/${collection.id}`}>
                  Mở mục này
                </Link>
              </div>
              <div className={`col rv${small ? '' : ' mot-anh'}`}>
                {main ? (
                  <div className={`ph m${main.height > main.width ? ' tallish' : ''}`} data-par>
                    <img src={main.url.lg} alt={main.caption} loading="lazy" />
                  </div>
                ) : null}
                {small ? (
                  <div className="ph s" data-par="1.4">
                    <img src={small.url.lg} alt={small.caption} loading="lazy" />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
