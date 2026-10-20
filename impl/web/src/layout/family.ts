import { fetchMe, type Me } from '../api';

let pending: Promise<Me | null> | null = null;

/**
 * Thông tin gia đình (`GET /api/me`), gọi một lần rồi nhớ lại cho cả phiên
 * để khung và các trang dùng chung mà không phải hỏi máy chủ nhiều lần.
 */
export function getFamily(): Promise<Me | null> {
  pending ??= fetchMe();
  return pending;
}
