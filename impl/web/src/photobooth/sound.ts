/**
 * Tiếng màn trập ngắn (R-106: bản xây lại thêm, mặc định bật, tắt được).
 * Sinh bằng WebAudio, không cần tệp âm thanh, không gọi mạng.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Tiếng "tách" ~70ms: nhiễu trắng qua lọc thông cao, tắt rất nhanh. */
export function playShutter(): void {
  const ctx = getContext();
  if (!ctx) return;
  const duration = 0.07;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const decay = Math.pow(1 - i / frames, 3);
    data[i] = (Math.random() * 2 - 1) * decay * 0.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 1400;
  const gain = ctx.createGain();
  gain.gain.value = 0.35;
  source.connect(highpass).connect(gain).connect(ctx.destination);
  source.start();
}
