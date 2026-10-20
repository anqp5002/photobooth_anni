/** Trạng thái đang tải trang chuyến (SPEC R-024). */
export function TripSkeleton() {
  return (
    <div className="trip-page is-loading">
      <header className="app-header">
        <span className="app-logo">
          <span className="skeleton-block skeleton-logo" />
        </span>
        <span className="skeleton-block skeleton-nav" />
        <span className="skeleton-block skeleton-actions" />
      </header>

      <main className="trip-main">
        <div className="trip-title-block">
          <div className="trip-title-left">
            <span className="skeleton-block skeleton-title" />
            <span className="skeleton-block skeleton-author" />
          </div>
          <div className="trip-title-actions">
            <span className="skeleton-block skeleton-btn" />
            <span className="skeleton-block skeleton-btn" />
          </div>
        </div>

        <div className="trip-columns">
          <section className="step-column">
            <div className="loading-spinner" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>Đang tải chuyến đi…</span>
            </div>
            <div className="skeleton-card">
              <span className="skeleton-block skeleton-line-lg" />
              <span className="skeleton-block skeleton-line" />
              <span className="skeleton-block skeleton-photos" />
            </div>
          </section>

          <section className="map-column">
            <div className="map-skeleton" aria-hidden="true" />
          </section>
        </div>
      </main>
    </div>
  );
}
