import { createRoot } from 'react-dom/client';
// Phông Google Fonts có tiếng Việt, tự host (chỉ nạp subset latin + vietnamese).
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/vietnamese-500.css';
import '@fontsource/oswald/vietnamese-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/vietnamese-400.css';
import '@fontsource/inter/vietnamese-500.css';
import '@fontsource/inter/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import '@fontsource/playfair-display/vietnamese-500.css';
import '@fontsource/playfair-display/vietnamese-500-italic.css';
import 'maplibre-gl/dist/maplibre-gl.css';
// CSS r1 còn dùng cho trang /me của coder-main (w1:pK).
import './styles/tokens.css';
import './styles/app.css';
import './styles/mobile.css';
// CSS r2 chép từ bản mẫu design/proto/assets/*.css làm gốc.
import './styles/base.css';
import './styles/home.css';
import './styles/recap.css';
import './styles/map.css';
import './styles/timeline.css';
import './styles/layout.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Không tìm thấy phần tử #root');

createRoot(container).render(<App />);
