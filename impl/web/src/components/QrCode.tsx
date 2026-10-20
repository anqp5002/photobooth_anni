import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  size?: number;
}

/** Mã QR tạo ngay trong trình duyệt, không gọi dịch vụ ngoài. */
export function QrCode({ value, size = 128 }: QrCodeProps) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });

  return (
    <span
      className="qr-code"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Mã QR mở chuyến đi trên điện thoại"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
