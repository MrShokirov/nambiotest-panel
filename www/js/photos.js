// Private progress photos (front / side / back) with a before–after comparison slider.
import * as S from './store.js';
import { esc, sheet, closeSheet, choose, confirmBox, toast } from './ui.js';

let ctx = null, urls = [];
export const init = c => { ctx = c; };
const POSES = { front: 'Old', side: 'Yon', back: 'Orqa' };
const fmt = iso => new Date(iso).toLocaleDateString('ru');

export async function cardHtml() {
  urls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const all = await S.listPhotos().catch(() => []);
  const last = all[all.length - 1];
  const days = last ? Math.round((Date.now() - Date.parse(last.date)) / 86400000) : null;
  const pose = p => all.filter(x => x.pose === p);
  const thumbs = Object.keys(POSES).map(p => {
    const list = pose(p);
    if (!list.length) return '';
    return `<div class="phrow"><small>${POSES[p]} (${list.length})</small><div class="phstrip">${list.slice(-6).map(x => {
      const u = URL.createObjectURL(x.blob); urls.push(u);
      return `<button class="phthumb" data-a="ph-del" data-arg="${x.id}" aria-label="Rasm"><img src="${u}" alt=""><span>${fmt(x.date)}</span></button>`;
    }).join('')}</div></div>`;
  }).join('');
  return `<div class="card"><div class="row between"><h3>📸 Progress rasmlari</h3><button class="btn small primary" data-a="ph-add">+ Rasm</button></div>
    <p class="insight">${!all.length ? 'Oyiga 1 marta: old, yon, orqa — bir xil joy va yorug‘likda. Rasmlar faqat ilova ichida saqlanadi.' : days >= 28 ? `Oxirgi rasm ${days} kun oldin — yangisini olish vaqti 📸` : `Oxirgi rasm ${days} kun oldin.`}</p>
    ${thumbs}${Object.keys(POSES).some(p => pose(p).length >= 2) ? '<button class="btn wide" data-a="ph-compare">🔀 Oldin / Keyin solishtirish</button>' : ''}</div>`;
}

async function add() {
  const pose = await choose('Qaysi holat?', Object.entries(POSES).map(([k, v]) => [k, v]));
  if (!pose) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    try { await S.addPhoto(f, pose); toast('✅ Rasm saqlandi (faqat ilova ichida)'); } catch (e) { toast('❌ Saqlab bo‘lmadi — joy yetmayapti'); }
    ctx.render();
  };
  inp.click();
}

async function compare() {
  const all = await S.listPhotos();
  const poses = Object.keys(POSES).filter(p => all.filter(x => x.pose === p).length >= 2);
  const pose = poses.length === 1 ? poses[0] : await choose('Qaysi holat?', poses.map(p => [p, POSES[p]]));
  if (!pose) return;
  const list = all.filter(x => x.pose === pose);
  const a = list[0], b = list[list.length - 1];
  const ua = URL.createObjectURL(a.blob), ub = URL.createObjectURL(b.blob);
  await sheet(`<h3>🔀 ${POSES[pose]}: ${fmt(a.date)} → ${fmt(b.date)}</h3>
    <div class="ba"><img src="${ua}" alt="oldin"><div class="ba-top" id="baTop"><img src="${ub}" alt="keyin"></div><i class="ba-line" id="baLine"></i>
      <span class="ba-l">Oldin</span><span class="ba-r">Keyin</span></div>
    <input type="range" min="0" max="100" value="50" id="baR" aria-label="Solishtirish">
    <button class="btn wide" data-s="x">Yopish</button>`, { onClick: () => closeSheet() });
  URL.revokeObjectURL(ua); URL.revokeObjectURL(ub);
}
document.addEventListener('input', e => {
  if (e.target.id !== 'baR') return;
  const v = e.target.value;
  document.getElementById('baTop').style.clipPath = `inset(0 0 0 ${v}%)`;
  document.getElementById('baLine').style.left = v + '%';
});

export async function action(a, arg) {
  if (a === 'ph-add') return add();
  if (a === 'ph-compare') return compare();
  if (a === 'ph-del') {
    if (await confirmBox('Bu rasmni o‘chiraymi?', 'O‘chirish', 'Yo‘q', true)) { await S.deletePhoto(Number(arg)); ctx.render(); }
  }
}
