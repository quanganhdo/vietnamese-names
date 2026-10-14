import { createShareUrl, readSharedUrl, encodeSavedNames, createShareSvg, svgToPng } from './share.mjs?v=31';
import { createClassListSvg, createNameCardSvg } from './preview.mjs';
import { cleanName, capitalizeFamily, formatFullName } from './names-format.mjs';
import { prepareNames, searchNames, shuffle, highlightParts, normalize } from './search.mjs';

const $ = id => document.getElementById(id);
const format = number => number.toLocaleString('en-US');
const storageKey = 'vietnamese-names:saved:v1';
const familyKey = 'vietnamese-names:family:v1';
const params = new URLSearchParams(location.search);
const incomingShare = readSharedUrl(location.href);
const state = { rows: [], matches: [], broader: [], saved: new Set(), savedOnly: incomingShare.savedOnly, sharedSaved: null, previewOpen: false, limit: 24, randomOrder: null, previewName: '', classmates: [] };
let toastTimer;
let shareRestored = false;
let shareContext = null;
let shareTrigger = null;
const shareDialog = $('share-modal');
let scrollObserver = null;
let lastPreviewTrigger = null;
let previewPageLock = null;
let keepSidebarOnClose = false;
const previewMedia = window.matchMedia?.('(max-width: 1100px)') || { matches: false };
const previewDialog = $('preview-modal');
const previewAnchor = document.createComment('preview position');
$('preview-panel').before(previewAnchor);

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) state.saved = new Set(stored.filter(name => typeof name === 'string').map(cleanName));
  $('family').value = capitalizeFamily(localStorage.getItem(familyKey) ?? 'Nguyễn');
} catch { /* Browsing and in-memory favorites still work without storage. */ }

if (incomingShare.family !== undefined) $('family').value = incomingShare.family;
$('query').value = (params.get('q') || '').slice(0, 200);
$('given').value = capitalizeFamily((params.get('given') || '').slice(0, 80));
for (const key of ['gender', 'length', 'scope', 'display']) {
  const value = params.get(key);
  const radio = [...document.querySelectorAll(`input[name="${key}"]`)].find(input => input.value === value);
  if (radio) radio.checked = true;
}

function syncClearButtons() {
  document.querySelectorAll('.clear-input').forEach(button => {
    button.hidden = !$(button.dataset.input).value;
  });
}

syncClearButtons();

function filters() {
  return {
    query: $('query').value,
    given: $('given').value,
    scope: document.querySelector('input[name="scope"]:checked').value,
    gender: document.querySelector('input[name="gender"]:checked').value,
    length: document.querySelector('input[name="length"]:checked').value,
    savedOnly: state.savedOnly,
    saved: state.sharedSaved || state.saved,
  };
}

function updateUrl() {
  const values = filters();
  const query = new URLSearchParams();
  if (values.query.trim()) query.set('q', values.query.trim());
  if (values.given.trim()) query.set('given', values.given.trim());
  if (values.gender !== 'all') query.set('gender', values.gender);
  if (values.length !== 'all') query.set('length', values.length);
  if (values.scope !== 'name') query.set('scope', values.scope);
  if (document.querySelector('input[name="display"]:checked').value === 'en') query.set('display', 'en');
  if (state.savedOnly) query.set('view', 'saved');
  if (state.previewOpen && state.previewName) query.set('name', state.previewName);
  if (incomingShare.family !== undefined) query.set('family', $('family').value.trim());
  const hash = state.sharedSaved ? '#saved=' + encodeSavedNames(state.sharedSaved)
    : location.hash.startsWith('#saved=') ? '' : location.hash;
  history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + hash);
}

function fullName(name) {
  return formatFullName($('family').value, name, document.querySelector('input[name="display"]:checked').value);
}

function appendHighlighted(parent, text, query = $('query').value, wholeWords = false) {
  for (const part of highlightParts(text, query, { wholeWords })) {
    if (part.matched) {
      const mark = document.createElement('mark');
      mark.textContent = part.text;
      parent.append(mark);
    } else parent.append(document.createTextNode(part.text));
  }
}

function headingFor(name) {
  const heading = document.createElement('h2');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'name-title';
  button.setAttribute('aria-pressed', String(name === state.previewName));
  button.setAttribute('aria-label', `Xem thử ${fullName(name)}`);
  const ending = normalize($('given').value);
  if (ending && normalize(name).endsWith(` ${ending}`)) {
    button.classList.add('picking-middle');
    const words = cleanName(name).split(' ');
    const count = ending.split(' ').length;
    const display = document.querySelector('input[name="display"]:checked').value;
    const family = formatFullName($('family').value, '', display);
    const middle = formatFullName('', words.slice(0, -count).join(' '), display);
    const given = formatFullName('', words.slice(-count).join(' '), display);
    if (display === 'vi' && family) button.append(`${family} `);
    const strong = document.createElement('strong');
    appendHighlighted(strong, middle, $('query').value, true);
    button.append(strong, ' ');
    appendHighlighted(button, given, $('query').value, true);
    if (display === 'en' && family) button.append(` ${family}`);
  } else appendHighlighted(button, fullName(name), $('query').value, true);
  button.addEventListener('click', () => selectPreview(name, button));
  heading.append(button);
  return heading;
}

function paintSave(button, name) {
  const saved = state.saved.has(name);
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', `${saved ? 'Bỏ lưu' : 'Lưu tên'} ${fullName(name)}`);
  button.title = saved ? 'Bỏ lưu tên' : 'Lưu tên';
  button.textContent = saved ? '★' : '☆';
}

function cardFor(row) {
  const card = document.createElement('article');
  card.className = 'name-card';
  card.dataset.name = row.name;
  card.classList.toggle('selected', row.name === state.previewName);
  const gender = document.createElement('p');
  gender.className = 'gender';
  gender.textContent = { male: 'Nam', female: 'Nữ', unisex: 'Nam / Nữ' }[row.gender];
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save-button';
  paintSave(save, row.name);
  save.addEventListener('click', () => toggleSave(row.name, save));
  const meaning = document.createElement('p');
  meaning.className = 'meaning';
  appendHighlighted(meaning, row.meaning, filters().scope === 'all' ? $('query').value : '');
  const label = document.createElement('div');
  label.className = 'name-label';
  label.append(headingFor(row.name), gender);
  card.append(label, meaning, save);
  card.addEventListener('click', event => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    selectPreview(row.name, card.querySelector('.name-title'));
  });
  return card;
}

function updateFamily() {
  syncClearButtons();
  document.querySelectorAll('.name-card').forEach(card => {
    card.querySelector('h2').replaceWith(headingFor(card.dataset.name));
    paintSave(card.querySelector('.save-button'), card.dataset.name);
  });
  const family = $('family').value.trim();
  $('family-example').hidden = !family;
  $('family-example').textContent = family ? fullName(state.matches[0]?.name || 'Gia An') : '';
  updatePreview();
}



function createClassmates(name) {
  const families = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const previous = new Set(state.classmates.map(([, name]) => name));
  const pool = state.rows.filter(row => row.words === 2 && row.name !== name);
  const fresh = pool.filter(row => !previous.has(row.name));
  return shuffle(fresh.length >= 9 ? fresh : pool).slice(0, 9)
    .map(row => [families[Math.floor(Math.random() * families.length)], row.name]);
}


function lockPreviewPage() {
  if (previewPageLock) return;
  const body = document.body;
  previewPageLock = {
    x: window.scrollX, y: window.scrollY,
    body: Object.fromEntries(['position', 'top', 'left', 'width', 'overflow'].map(key => [key, body.style[key]])),
    rootOverflow: document.documentElement.style.overflow,
  };
  scrollObserver?.disconnect();
  body.style.position = 'fixed';
  body.style.top = `-${previewPageLock.y}px`;
  body.style.left = `-${previewPageLock.x}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function unlockPreviewPage() {
  if (!previewPageLock) return;
  const saved = previewPageLock;
  previewPageLock = null;
  for (const [key, value] of Object.entries(saved.body)) document.body.style[key] = value;
  document.documentElement.style.overflow = saved.rootOverflow;
  window.scrollTo(saved.x, saved.y);
}

function openPreviewOverlay() {
  lockPreviewPage();
  previewDialog.append($('preview-panel'));
  $('preview-panel').classList.add('is-open');
  if (!previewDialog.open) {
    previewDialog.showModal();
    previewDialog.scrollTop = 0;
  }
  $('close-preview').focus({ preventScroll: true });
}

function finishPreviewClose() {
  state.previewOpen = keepSidebarOnClose;
  previewAnchor.after($('preview-panel'));
  $('preview-panel').hidden = !keepSidebarOnClose;
  $('preview-panel').classList.toggle('is-open', keepSidebarOnClose);
  keepSidebarOnClose = false;
  unlockPreviewPage();
  if (lastPreviewTrigger?.isConnected) lastPreviewTrigger.focus({ preventScroll: true });
  else ($('name-grid').querySelector('.name-title') || $('results')).focus({ preventScroll: true });
  updateScrollStatus();
  updateUrl();
}

function closePreview() {
  if (previewDialog.open) previewDialog.close();
  else finishPreviewClose();
}

function selectPreview(name, trigger) {
  state.classmates = createClassmates(name);
  state.previewName = name;
  state.previewOpen = true;
  lastPreviewTrigger = trigger;
  $('preview-panel').hidden = false;
  if (previewMedia.matches) openPreviewOverlay();
  else $('preview-panel').classList.add('is-open');
  document.querySelectorAll('.name-card').forEach(card => {
    const selected = card.dataset.name === name;
    card.classList.toggle('selected', selected);
    card.querySelector('.name-title').setAttribute('aria-pressed', String(selected));
  });
  updatePreview();
  updateUrl();
}

function updateShareButtons() {
  $('share-saved').hidden = !state.savedOnly || !(state.sharedSaved || state.saved).size;
  $('share-name').disabled = !state.previewName;
}

function updatePreviewSave() {
  const name = state.previewName;
  const saved = state.saved.has(name);
  const button = $('preview-save');
  button.disabled = !name;
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', name ? (saved ? 'Bỏ lưu ' : 'Lưu tên ') + fullName(name) : 'Lưu tên');
  button.title = saved ? 'Bỏ lưu tên' : 'Lưu tên';
  button.textContent = saved ? '★ Đã lưu' : '☆ Lưu tên';
}

function updatePreview() {
  updateShareButtons();
  updatePreviewSave();
  const name = state.previewName;
  $('preview-body').hidden = !name;
  $('preview-empty').hidden = Boolean(name);
  if (!name) return;
  const vn = formatFullName($('family').value, name, 'vi');
  $('preview-vn').textContent = vn;
  const meaning = state.rows.find(row => row.name === name)?.meaning || '';
  $('preview-meaning').replaceChildren();
  $('preview-meaning-block').hidden = !meaning;
  appendHighlighted($('preview-meaning'), meaning, filters().scope === 'all' ? $('query').value : '');
  $('preview-en').textContent = formatFullName($('family').value, name, 'en');
  $('name-card-image').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(createNameCardSvg($('family').value, name));
  $('name-card-image').alt = `Họ: ${formatFullName($('family').value, '', 'en') || '—'}. Tên đệm và tên: ${formatFullName('', name, 'en')}.`;
  $('preview-upper').textContent = vn.toLocaleUpperCase('vi-VN');
  $('class-preview-image').alt = `Danh sách lớp mẫu. ${vn} được tô sáng.`;
  $('class-preview-image').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(createClassListSvg($('family').value, name, state.classmates));
}

function render({ resetLimit = true, resetOrder = resetLimit, preservePreview = false } = {}) {
  if (resetOrder) state.randomOrder = null;
  if (resetLimit) state.limit = 24;
  const activeFilters = filters();
  state.matches = searchNames(state.rows, activeFilters);
  if (state.randomOrder) state.matches.sort((a, b) => state.randomOrder.get(a.name) - state.randomOrder.get(b.name));
  if (!preservePreview && !state.matches.some(row => row.name === state.previewName)) {
    state.previewName = state.matches[0]?.name || '';
    state.classmates = state.previewName ? createClassmates(state.previewName) : [];
  }
  const displayed = state.matches.slice(0, state.limit);
  $('name-grid').replaceChildren(...displayed.map(cardFor));
  $('name-grid').setAttribute('aria-busy', 'false');
  $('saved-count').textContent = format((state.sharedSaved || state.saved).size);
  $('browse-tab').classList.toggle('active', !state.savedOnly);
  $('saved-tab').classList.toggle('active', state.savedOnly);
  $('browse-tab').setAttribute('aria-pressed', String(!state.savedOnly));
  $('saved-tab').setAttribute('aria-pressed', String(state.savedOnly));
  $('result-count').textContent = `${format(state.matches.length)} ${state.savedOnly ? (state.sharedSaved ? 'tên được chia sẻ' : 'tên đã lưu') : 'tên'}`;
  $('empty').hidden = state.matches.length !== 0;
  const noFavorites = state.savedOnly && (state.sharedSaved || state.saved).size === 0;
  $('empty-title').textContent = noFavorites ? 'Chưa lưu tên nào.' : 'Không có kết quả.';
  $('empty-copy').textContent = noFavorites ? 'Bấm ngôi sao bên cạnh tên để lưu.' : 'Đổi từ khóa hoặc xóa bộ lọc.';
  $('empty-reset').textContent = noFavorites ? 'Xem tất cả tên' : 'Xóa bộ lọc';
  $('shuffle').disabled = state.matches.length < 2;
  $('alphabetical').disabled = !state.matches.length;
  $('alphabetical').setAttribute('aria-pressed', String(!state.randomOrder));
  $('shuffle').setAttribute('aria-pressed', String(Boolean(state.randomOrder)));
  updateBroaderResults(activeFilters);
  updateScrollStatus();
  $('copy-saved').hidden = !state.savedOnly || !(state.sharedSaved || state.saved).size;
  updateFamily();
  updateUrl();
}

function updateBroaderResults(activeFilters) {
  const hasFilters = activeFilters.gender !== 'all' || activeFilters.length !== 'all' || activeFilters.savedOnly;
  const hasSearch = normalize(activeFilters.query) || normalize(activeFilters.given);
  const current = new Set(state.matches.map(row => row.name));
  state.broader = hasFilters && hasSearch
    ? searchNames(state.rows, { query: activeFilters.query, given: activeFilters.given, scope: activeFilters.scope })
      .filter(row => !current.has(row.name))
    : [];
  if (state.randomOrder) state.broader.sort((a, b) => state.randomOrder.get(a.name) - state.randomOrder.get(b.name));
  $('broader-grid').replaceChildren(...state.broader.slice(0, 3).map(cardFor));
  $('broader-count').textContent = `${format(state.broader.length)} tên khác khớp tìm kiếm`;
}


function updateScrollStatus() {
  const displayed = $('name-grid').children.length;
  $('shown-count').textContent = state.matches.length ? `Đang xem ${format(displayed)} / ${format(state.matches.length)} tên` : '';
  $('scroll-sentinel').hidden = displayed >= state.matches.length;
  $('broader-results').hidden = !state.broader.length || !$('scroll-sentinel').hidden;
  scrollObserver?.disconnect();
  if (!previewPageLock && !$('scroll-sentinel').hidden) scrollObserver?.observe($('scroll-sentinel'));
  if (!previewPageLock && !scrollObserver && !$('scroll-sentinel').hidden) requestAnimationFrame(checkScrollPosition);
}

function appendMore() {
  if (previewPageLock || $('scroll-sentinel').hidden) return;
  const start = $('name-grid').children.length;
  const end = Math.min(start + 24, state.matches.length);
  $('name-grid').append(...state.matches.slice(start, end).map(cardFor));
  state.limit = end;
  updateScrollStatus();
}

function checkScrollPosition() {
  if (!previewPageLock && !$('scroll-sentinel').hidden && $('scroll-sentinel').getBoundingClientRect().top <= window.innerHeight + 600) appendMore();
}

function toggleSave(name, button) {
  const saving = !state.saved.has(name);
  if (saving) { state.saved.add(name); state.sharedSaved?.add(name); }
  else { state.saved.delete(name); state.sharedSaved?.delete(name); }
  try { localStorage.setItem(storageKey, JSON.stringify([...state.saved])); }
  catch { toast('Không lưu được vào trình duyệt. Tên chỉ lưu trong phiên này.'); }
  if (state.savedOnly) {
    const index = [...$('name-grid').children].findIndex(card => card.dataset.name === name);
    render({ resetLimit: false, preservePreview: state.previewOpen && name === state.previewName });
    const next = $('name-grid').children[Math.min(index, $('name-grid').children.length - 1)];
    if (button === $('preview-save')) $('preview-save').focus({ preventScroll: true });
    else (next?.querySelector('.save-button') || $('saved-tab')).focus();
  } else {
    document.querySelectorAll('.name-card').forEach(card => {
      if (card.dataset.name === name) paintSave(card.querySelector('.save-button'), name);
    });
    updatePreviewSave();
    $('saved-count').textContent = format((state.sharedSaved || state.saved).size);
    updateShareButtons();
  }
}

function resetFilters() {
  document.querySelector('input[name="scope"][value="name"]').checked = true;
  $('query').value = '';
  $('given').value = '';
  for (const group of ['gender', 'length']) document.querySelector(`input[name="${group}"][value="all"]`).checked = true;
  render();
}

async function load() {
  $('load-error').hidden = true;
  $('shuffle').disabled = true;
  $('result-count').textContent = 'Đang tải danh sách tên…';
  $('name-grid').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(new URL('./names.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.rows = prepareNames(await response.json());
    state.randomOrder = new Map(shuffle(state.rows).map((row, index) => [row.name, index]));
    const valid = new Set(state.rows.map(row => row.name));
    state.saved = new Set([...state.saved].filter(name => valid.has(name)));
    if (!shareRestored) {
      if (incomingShare.savedOnly && incomingShare.names !== null) {
        state.sharedSaved = new Set(incomingShare.names.filter(name => valid.has(name)));
        state.saved = new Set([...state.saved, ...state.sharedSaved]);
        state.randomOrder = null;
        try { localStorage.setItem(storageKey, JSON.stringify([...state.saved])); } catch { /* In-memory restoration still works. */ }
      }
      shareRestored = true;
    }
    render({ resetOrder: false });
    if (incomingShare.name && valid.has(incomingShare.name)) {
      const trigger = [...$('name-grid').children].find(card => card.dataset.name === incomingShare.name)?.querySelector('.name-title') || $('results');
      selectPreview(incomingShare.name, trigger);
    }
  } catch {
    $('load-error').hidden = false;
    $('name-grid').setAttribute('aria-busy', 'false');
    $('result-count').textContent = 'Danh sách tên chưa sẵn sàng';
  }
}

document.querySelectorAll('.clear-input').forEach(button => {
  const input = $(button.dataset.input);
  input.addEventListener('input', syncClearButtons);
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', () => {
    input.value = '';
    input.focus({ preventScroll: true });
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

$('query').addEventListener('input', () => { render(); });
$('given').addEventListener('input', event => {
  if (event.isComposing) return;
  render();
});
$('given').addEventListener('compositionend', () => render());
$('expand-results').addEventListener('click', () => {
  for (const group of ['gender', 'length']) document.querySelector(`input[name="${group}"][value="all"]`).checked = true;
  state.savedOnly = false;
  state.sharedSaved = null;
  render({ resetOrder: false });
  $('result-count').focus();
});
document.querySelectorAll('input[name="gender"], input[name="length"], input[name="scope"]').forEach(input => input.addEventListener('change', () => { render(); }));
document.querySelectorAll('input[name="display"]').forEach(input => input.addEventListener('change', () => {
  updateFamily();
  updateUrl();
}));
function familyChanged(event) {
  if (event.isComposing) return;
  const input = $('family');
  const original = input.value;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const capitalized = capitalizeFamily(original);
  if (capitalized !== original) {
    input.value = capitalized;
    input.setSelectionRange(capitalizeFamily(original.slice(0, start)).length, capitalizeFamily(original.slice(0, end)).length);
  }
  updateFamily();
  updateUrl();
  try { localStorage.setItem(familyKey, input.value); } catch { /* Optional preference. */ }
}
$('family').addEventListener('input', familyChanged);
$('family').addEventListener('compositionend', familyChanged);
$('browse-tab').addEventListener('click', () => { state.savedOnly = false; state.sharedSaved = null; render(); });
$('saved-tab').addEventListener('click', () => { state.savedOnly = true; state.sharedSaved = null; render(); });
$('reset').addEventListener('click', resetFilters);
$('empty-reset').addEventListener('click', () => {
  if (state.savedOnly && !(state.sharedSaved || state.saved).size) {
    state.savedOnly = false;
    state.sharedSaved = null;
  }
  resetFilters();
});
$('alphabetical').addEventListener('click', () => render());
$('shuffle').addEventListener('click', () => {
  state.previewName = '';
  state.randomOrder = new Map(shuffle(state.rows).map((row, index) => [row.name, index]));
  render({ resetOrder: false });
});

function downloadText(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text, filename = 'ten-da-luu.txt') {
  try { await navigator.clipboard.writeText(text); toast('Đã sao chép.'); }
  catch { downloadText(text, 'text/plain;charset=utf-8', filename); toast('Đã tải danh sách.'); }
}

$('copy-saved').addEventListener('click', () => copyText([...(state.sharedSaved || state.saved)].map(fullName).join('\n')));


$('close-preview').addEventListener('click', closePreview);
previewDialog.addEventListener('close', finishPreviewClose);
previewDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closePreview();
});
previewDialog.addEventListener('click', event => {
  if (event.target !== previewDialog) return;
  const bounds = previewDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePreview();
});
previewMedia.addEventListener?.('change', event => {
  if (!event.matches && previewDialog.open) {
    keepSidebarOnClose = true;
    previewDialog.close();
  } else if (event.matches && !$('preview-panel').hidden && $('preview-panel').classList.contains('is-open')) {
    openPreviewOverlay();
  }
});

$('retry').addEventListener('click', load);
window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    try {
      const names = JSON.parse(event.newValue || '[]');
      if (!Array.isArray(names)) return;
      const valid = new Set(state.rows.map(row => row.name));
      state.saved = new Set(names.filter(name => typeof name === 'string').map(cleanName).filter(name => valid.has(name)));
      if (state.sharedSaved) state.sharedSaved = new Set([...state.sharedSaved].filter(name => state.saved.has(name)));
      render({ resetLimit: false, preservePreview: state.previewOpen });
    } catch { /* Ignore malformed storage from other tabs. */ }
  }
});
if ('IntersectionObserver' in window) {
  scrollObserver = new window.IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) appendMore();
  }, { rootMargin: '600px 0px' });
} else {
  window.addEventListener('scroll', checkScrollPosition, { passive: true });
  window.addEventListener('resize', checkScrollPosition);
}


function openShare(kind, trigger) {
  const saved = state.sharedSaved || state.saved;
  const names = state.rows.filter(row => saved.has(row.name)).map(row => row.name);
  const display = document.querySelector('input[name="display"]:checked').value;
  const family = $('family').value;
  const row = state.rows.find(row => row.name === state.previewName);
  const title = kind === 'name' ? fullName(state.previewName) : 'tenhay.fyi';
  const url = createShareUrl(location.href, { ...filters(), kind, name: state.previewName, names, family, display });
  const context = { kind, title, url, file: null, objectUrl: null };
  shareContext = context;
  shareTrigger = trigger;
  $('share-title').textContent = kind === 'name' ? 'Chia sẻ tên' : kind === 'saved' ? 'Chia sẻ danh sách' : 'Chia sẻ';
  $('share-url').value = url;
  $('share-image').hidden = true;
  $('share-image').removeAttribute('src');
  $('share-image').alt = kind === 'name' ? title + '. ' + (row?.meaning || '') : title;
  $('share-status').textContent = 'Đang tạo ảnh…';
  $('share-file').disabled = true;
  $('share-file').hidden = false;
  $('save-share-image').hidden = true;
  $('share-link').hidden = !navigator.share;
  $('share-facebook').href = 'https://www.facebook.com/sharer/sharer.php?' + new URLSearchParams({ u: url });
  $('share-threads').href = 'https://www.threads.com/intent/post?' + new URLSearchParams({ text: title, url });
  lockPreviewPage();
  shareDialog.showModal();
  prepareShareImage(context, { kind, family, display, name: state.previewName, meaning: row?.meaning || '', names });
}

async function prepareShareImage(context, imageData) {
  try {
    let blob;
    if (context.kind === 'page') {
      const response = await fetch(new URL('./share.png?v=2', import.meta.url));
      if (!response.ok) throw new Error('Sharing image unavailable');
      blob = await response.blob();
    } else {
      const canvasContext = document.createElement('canvas').getContext('2d');
      if (!canvasContext) throw new Error('Canvas unavailable');
      const measureText = (text, fontSize, fontWeight = 400) => {
        canvasContext.font = fontWeight + ' ' + fontSize + 'px Arial, sans-serif';
        return canvasContext.measureText(text).width;
      };
      blob = await svgToPng(createShareSvg(imageData, measureText));
    }
    if (shareContext !== context || !shareDialog.open) return;
    context.file = new File([blob], context.kind === 'saved' ? 'tenhay-danh-sach.png' : 'tenhay-ten.png', { type: 'image/png' });
    context.objectUrl = URL.createObjectURL(blob);
    $('share-image').src = context.objectUrl;
    $('share-image').hidden = false;
    $('save-share-image').href = context.objectUrl;
    $('save-share-image').download = context.file.name;
    $('save-share-image').hidden = false;
    let canShareImage = false;
    try { canShareImage = Boolean(navigator.share && navigator.canShare?.({ files: [context.file] })); } catch { /* Use the saved-image option. */ }
    $('share-file').hidden = !canShareImage;
    $('share-file').disabled = false;
    $('share-status').textContent = canShareImage
      ? 'Dùng Chia sẻ ảnh để chọn Zalo, Instagram hoặc ứng dụng khác trên điện thoại.'
      : 'Lưu ảnh để đăng hoặc gửi trong Zalo, Instagram và ứng dụng khác.';
  } catch {
    if (shareContext !== context) return;
    $('share-file').hidden = true;
    $('share-status').textContent = 'Chưa tạo được ảnh. Bạn vẫn có thể chia sẻ liên kết.';
  }
}

function finishShareClose() {
  if (shareContext?.objectUrl) URL.revokeObjectURL(shareContext.objectUrl);
  shareContext = null;
  if (!previewDialog.open) {
    unlockPreviewPage();
    updateScrollStatus();
  }
  if (shareTrigger?.isConnected) shareTrigger.focus({ preventScroll: true });
}

$('share-page').addEventListener('click', event => openShare(state.savedOnly ? 'saved' : 'page', event.currentTarget));
$('share-name').addEventListener('click', event => openShare('name', event.currentTarget));
$('preview-save').addEventListener('click', event => {
  if (state.previewName) toggleSave(state.previewName, event.currentTarget);
});
$('share-saved').addEventListener('click', event => openShare('saved', event.currentTarget));
$('close-share').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('close', finishShareClose);
shareDialog.addEventListener('click', event => {
  if (event.target !== shareDialog) return;
  const bounds = shareDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) shareDialog.close();
});
$('share-file').addEventListener('click', async () => {
  const context = shareContext;
  if (!context?.file) return;
  try { await navigator.share({ files: [context.file], title: context.title, text: context.url }); }
  catch (error) {
    if (error.name !== 'AbortError' && shareContext === context) $('share-status').textContent = 'Không chia sẻ được ảnh. Bạn có thể lưu ảnh hoặc chia sẻ liên kết.';
  }
});
$('share-link').addEventListener('click', async () => {
  const context = shareContext;
  if (!context) return;
  try { await navigator.share({ title: context.title, url: context.url }); }
  catch (error) {
    if (error.name !== 'AbortError' && shareContext === context) $('share-status').textContent = 'Không chia sẻ được. Bạn có thể sao chép liên kết.';
  }
});
$('copy-share-link').addEventListener('click', async () => {
  const context = shareContext;
  if (!context) return;
  try {
    await navigator.clipboard.writeText(context.url);
    if (shareContext === context) $('share-status').textContent = 'Đã sao chép liên kết.';
  } catch {
    if (shareContext !== context) return;
    $('share-url').focus();
    $('share-url').select();
    $('share-status').textContent = 'Chọn và sao chép liên kết bên dưới.';
  }
});
$('share-url').addEventListener('click', event => event.currentTarget.select());

load();
