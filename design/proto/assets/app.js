(function(){
const I={
 home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
 star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
 map:'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 up:'<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
 img:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
 alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/>',
 refresh:'<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
 share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
 film:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 12h8M8 17h8"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 down:'<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2 .6 3.3 2.4 3.5 6"/>'
};
window.icon=n=>'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>';
const page=document.body.dataset.page;
const links=[['index.html','Trang chủ','home'],['tong-ket.html','Tổng kết','tk'],['ban-do.html','Bản đồ','map']];
const q=location.search.match(/state=(loading|empty|error)/);
if(q) document.body.dataset.state=q[1];
const qs=q?('?state='+q[1]):'';
const ANN={home:'Tổng kết năm 2026 của nhà mình đã sẵn sàng',tk:'Tổng kết năm 2026 của nhà mình đã sẵn sàng',map:'9 nơi nhà mình đã đến trong năm nay',muc:'Mục này có 2 gợi ý mới từ AI đang chờ bạn'};
const ic2=(n)=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>';
const hdHtml='<div class="ann" role="note">'+(ANN[page]||ANN.home)+'</div>'+
 '<header class="hd"><div class="hd-row">'+
 '<button class="burger" id="burger" aria-label="Mở menu" aria-expanded="false" aria-controls="drawer">'+ic2('menu')+'</button>'+
 '<nav class="hd-l" aria-label="Điều hướng chính">'+links.map(l=>'<a href="'+l[0]+qs+'"'+(l[2]==page?' aria-current="page"':'')+'>'+l[1]+'</a>').join('')+'</nav>'+
 '<a class="brand" href="index.html'+qs+'" aria-label="Hành Trình, trang chủ"><b>Hành Trình</b><small>kỷ niệm nhà Bin &amp; Su</small></a>'+
 '<div class="hd-r"><button class="hide-m" aria-label="Tìm kiếm" data-toast="Tìm theo mục, nơi hoặc ngày sẽ có ở bản chính thức.">'+ic2('search')+'</button>'+
 '<button aria-label="Tải ảnh lên" data-upload>'+ic2('up')+'</button>'+
 '<a href="#" aria-label="Tài khoản nhà Bin và Su" title="Nhà Bin &amp; Su" data-noop><span class="av-i">B</span></a></div></div></header>';
const drawer='<div class="scrim" id="scrim"></div><aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden="true"><button class="dx" id="dx" aria-label="Đóng menu">'+ic2('x')+'</button><ul>'+
 links.map(l=>'<li><a href="'+l[0]+qs+'"'+(l[2]==page?' aria-current="page"':'')+'>'+l[1]+'</a></li>').join('')+
 '<li><button data-upload>Tải ảnh lên</button></li><li><a href="#" data-noop>Nhà Bin &amp; Su</a></li></ul></aside>';
document.body.insertAdjacentHTML('afterbegin','<a class="sr" href="#main">Bỏ qua điều hướng</a>'+hdHtml);
document.body.insertAdjacentHTML('beforeend',drawer+'<div class="toast" role="status" id="toast"></div>'+
 '<div class="dialog-bg" id="upload"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="up-t"><button class="x" aria-label="Đóng" data-close>'+icon('x')+'</button>'+
 '<h2 id="up-t">Tải ảnh lên</h2><p>Ảnh có ngày giờ và vị trí sẽ tự về đúng mục và đúng nơi trên bản đồ.</p>'+
 '<div class="drop">'+icon('img')+'<p>Kéo ảnh vào đây hoặc chọn từ máy</p><button class="btn dac" data-toast="Đã chọn 12 ảnh. Đang gom về các mục...">Chọn ảnh từ máy</button></div></div></div>');
// drawer + focus trap
const dr=document.getElementById('drawer'),sc=document.getElementById('scrim'),bg=document.getElementById('burger');
function setDrawer(on){dr.classList.toggle('on',on);sc.classList.toggle('on',on);dr.setAttribute('aria-hidden',!on);bg.setAttribute('aria-expanded',on);document.body.style.overflow=on?'hidden':'';
  if(on){document.getElementById('dx').focus()}else{bg.focus()}}
bg.onclick=()=>setDrawer(true);sc.onclick=()=>setDrawer(false);document.getElementById('dx').onclick=()=>setDrawer(false);
dr.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=[...dr.querySelectorAll('a,button')];const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
dr.addEventListener('click',e=>{if(e.target.closest('[data-upload]'))setDrawer(false)});
const toast=document.getElementById('toast');let tt;
window.showToast=m=>{toast.textContent=m;toast.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('on'),2600)};
document.addEventListener('click',e=>{
  const u=e.target.closest('[data-upload]');if(u){e.preventDefault();document.getElementById('upload').classList.add('on');return}
  const t=e.target.closest('[data-toast]');if(t){showToast(t.dataset.toast);document.getElementById('upload').classList.remove('on')}
  if(e.target.closest('[data-close]')||e.target.id=='upload')document.getElementById('upload').classList.remove('on');
  if(e.target.closest('[data-noop]'))e.preventDefault();
});
document.addEventListener('keydown',e=>{if(e.key=='Escape'){document.querySelectorAll('.dialog-bg.on').forEach(d=>d.classList.remove('on'));if(dr.classList.contains('on'))setDrawer(false)}});
// khung trạng thái
const main=document.querySelector('main');
if(main){
 const cfg=main.dataset;
 const box=(cls,ic,t,p,b)=>'<section class="state-view '+cls+'"><div class="wrap"><div class="sv-box"><div class="dot"><svg viewBox="0 0 24 24">'+I[ic]+'</svg></div><h2>'+t+'</h2><p>'+p+'</p>'+b+'</div></div></section>';
 main.insertAdjacentHTML('afterbegin',
  '<section class="state-view sv-loading" aria-busy="true"><div class="wrap"><div class="sk" style="height:56px;width:min(420px,80%);margin-top:190px"></div><div class="sk" style="height:22px;width:min(560px,90%);margin-top:16px"></div><div class="sk-grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div></section>'+
  box('sv-empty','img',cfg.emptyTitle||'Chưa có ảnh nào',cfg.emptyText||'Tải ảnh đầu tiên của nhà mình lên, mình sẽ gom lại thành từng mục.','<button class="btn dac" data-upload>Tải ảnh đầu tiên lên</button>')+
  box('sv-error','alert','Chưa tải được kỷ niệm của nhà mình','Kết nối bị gián đoạn nên mình chưa lấy được dữ liệu. Kiểm tra mạng rồi thử lại.','<a class="btn dac" href="'+(location.pathname.split('/').pop()||'index.html')+'">'+icon('refresh')+'Thử lại</a>'));
}
// parallax chuột ở hero
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const hero=document.querySelector('[data-parallax]');
if(hero&&!reduce&&matchMedia('(pointer:fine)').matches){
 const layers=[...hero.querySelectorAll('[data-depth]')];let raf;
 hero.addEventListener('pointermove',e=>{
  const r=hero.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>layers.forEach(l=>{const d=+l.dataset.depth;l.style.translate=(x*d)+'px '+(y*d)+'px'}));
 });
 hero.addEventListener('pointerleave',()=>layers.forEach(l=>l.style.translate='0 0'));
}
})();
