import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  alt?: string;
}

/** Avatar tròn; nếu không có ảnh thì hiện chữ cái đầu thay vì ảnh vỡ. */
export function Avatar({ src, name, size = 32, className, alt = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || '?';

  if (!src || failed) {
    return (
      <span
        className={`avatar avatar-fallback${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}
        role="img"
        aria-label={alt || `Ảnh đại diện của ${name}`}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      className={`avatar${className ? ` ${className}` : ''}`}
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
