/**
 * Cửa vào vùng của coder-2 cho router của cmd (`w1:pP`):
 *
 *   const CollectionPage = lazy(() => import('./pages/collection'));
 *   <Route path="/muc/:id" element={<CollectionPage />} />
 *
 * Trang tự dựng header + nền riêng (theo bản mẫu `design/proto/muc.html`) nên
 * không cần layout chung; nếu cmd có layout thì bỏ `ProtoHeader` trong `CollectionPage.tsx`.
 */
export { CollectionPage, default } from './CollectionPage';
