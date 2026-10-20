/** Kiểm tra nhanh luồng đăng ký / đăng nhập / đăng xuất với máy chủ thật. */
const BASE = 'http://127.0.0.1:8787';

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 120);
  }
  return { status: res.status, json, cookie: res.headers.get('set-cookie') };
}

const stamp = Date.now();
const email = `t5a${stamp}@example.com`;

console.log('GET /api/me (chưa đăng nhập):', (await fetch(BASE + '/api/me')).status);

const reg = await post('/api/auth/register', {
  username: `t5a${stamp % 100000}`,
  email,
  password: 'matkhau123',
});
console.log('register:', reg.status, JSON.stringify(reg.json));

const res = await post('/api/auth/register', {
  username: 'photobooth',
  email: `x${stamp}@example.com`,
  password: 'matkhau123',
});
console.log('register tên cấm:', res.status, JSON.stringify(res.json));

const dup = await post('/api/auth/register', {
  username: `t5b${stamp % 100000}`,
  email,
  password: 'matkhau123',
});
console.log('register email trùng:', dup.status, JSON.stringify(dup.json));

const weak = await post('/api/auth/register', {
  username: `t5c${stamp % 100000}`,
  email: `w${stamp}@example.com`,
  password: 'ngan',
});
console.log('register mật khẩu yếu:', weak.status, JSON.stringify(weak.json));

const bad = await post('/api/auth/login', { email, password: 'saibimatkhau' });
console.log('login sai mật khẩu:', bad.status, JSON.stringify(bad.json));

const login = await post('/api/auth/login', { email, password: 'matkhau123' });
console.log('login đúng:', login.status, JSON.stringify(login.json));
console.log('cookie sid:', login.cookie ? login.cookie.split(';')[0] : 'KHÔNG CÓ');

const cookie = login.cookie ? login.cookie.split(';')[0] : '';
const me = await fetch(BASE + '/api/me', { headers: { cookie } });
console.log('GET /api/me (đã đăng nhập):', me.status, JSON.stringify(await me.json()));

const out = await post('/api/auth/logout', {});
console.log('logout:', out.status, JSON.stringify(out.json));
