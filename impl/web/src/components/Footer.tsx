export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <p className="footer-brand">Hành Trình</p>
        <p className="footer-sources">
          Dữ liệu địa danh:{' '}
          <a href="https://www.geonames.org" target="_blank" rel="noreferrer noopener">
            GeoNames
          </a>{' '}
          (CC BY 4.0) · Ảnh vệ tinh: Esri, Maxar, Earthstar Geographics · Bản đồ đường:{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
            OpenStreetMap
          </a>{' '}
          contributors
        </p>
      </div>
    </footer>
  );
}
