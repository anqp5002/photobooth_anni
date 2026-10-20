import type { CameraError, CameraErrorKind } from './types';

/**
 * Mở camera trước 1280x720, không xin micro (R-102).
 * Lỗi được phân loại theo R-118 để màn vào báo đúng câu.
 */

const IDEAL: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};

export function cameraErrorMessage(error: CameraError): string {
  switch (error.kind) {
    case 'denied':
      return 'Bạn đã từ chối quyền camera. Bấm vào biểu tượng khoá cạnh địa chỉ trang, cho phép "Camera" rồi bấm "thử lại".';
    case 'unsupported':
      return 'Trình duyệt này không mở được camera. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới, hoặc tải ảnh lên thay vì chụp.';
    case 'insecure':
      return 'Trang đang chạy không bảo mật (cần HTTPS hoặc localhost) nên trình duyệt chặn camera. Mở trang bằng HTTPS, hoặc tải ảnh lên.';
    case 'notfound':
      return 'Máy không tìm thấy camera nào. Cắm camera rồi bấm "thử lại", hoặc tải ảnh lên.';
    case 'inuse':
      return 'Camera đang bị ứng dụng khác dùng. Đóng ứng dụng đó (Zoom, Teams, ứng dụng gọi video…) rồi bấm "thử lại".';
    case 'overconstrained':
      return 'Camera không nhận được độ phân giải 1280x720. Bấm "thử lại" để app mở camera ở chế độ thường.';
    default:
      return `Không mở được camera${error.detail ? `: ${error.detail}` : '.'} Bấm "thử lại" hoặc tải ảnh lên.`;
  }
}

function makeError(kind: CameraErrorKind, detail?: string): CameraError {
  return { kind, message: '', detail };
}

function classify(error: unknown): CameraError {
  const name = (error as { name?: string } | null)?.name ?? '';
  const detail = (error as { message?: string } | null)?.message;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return makeError('denied', detail);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return makeError('notfound', detail);
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return makeError('inuse', detail);
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return makeError('overconstrained', detail);
    case 'TypeError':
      return makeError('unsupported', detail);
    default:
      return makeError('other', detail);
  }
}

export class CameraController {
  private stream: MediaStream | null = null;

  get active(): boolean {
    return this.stream !== null;
  }

  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  /** Mở camera; ném CameraError đã phân loại (message điền sau). */
  async start(): Promise<MediaStream> {
    if (this.stream) return this.stream;
    if (typeof window !== 'undefined' && window.isSecureContext === false && !isLocalHost()) {
      throw withMessage(makeError('insecure'));
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw withMessage(makeError('unsupported'));
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: IDEAL, audio: false });
    } catch (error) {
      const classified = classify(error);
      // R-118: không đáp ứng được độ phân giải thì tự thử lại không ràng buộc.
      if (classified.kind === 'overconstrained') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (retryError) {
          throw withMessage(classify(retryError));
        }
      } else {
        throw withMessage(classified);
      }
    }

    this.stream = stream;
    return stream;
  }

  stop(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
  }
}

function isLocalHost(): boolean {
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
}

export function withMessage(error: CameraError): CameraError {
  return { ...error, message: cameraErrorMessage(error) };
}
