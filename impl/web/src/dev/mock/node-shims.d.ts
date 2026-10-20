/**
 * Khai báo tối thiểu cho các module Node dùng trong `proto-photos-plugin.ts`
 * (`impl/web` chưa cài `@types/node`). Chỉ đủ để `tsc --noEmit` qua; plugin
 * chạy trong tiến trình Vite nên không cần kiểu chi tiết.
 *
 * File này do coder-2 thêm lúc làm G1 vì `npm run build` đang hỏng ở plugin của qa;
 * ai cài `@types/node` thì xoá file này được.
 */

declare module 'node:fs' {
  interface ReadStream {
    pipe<T>(destination: T): T;
  }
  interface FsShim {
    existsSync(path: string): boolean;
    createReadStream(path: string): ReadStream;
  }
  const fs: FsShim;
  export default fs;
}

declare module 'node:path' {
  interface PathShim {
    dirname(p: string): string;
    join(...parts: string[]): string;
    extname(p: string): string;
  }
  const path: PathShim;
  export default path;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
