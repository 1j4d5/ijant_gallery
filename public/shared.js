function esc(s) {
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function imgUrl(id){ return '/photo/'+id; }

// Attach onerror="imgRetry(this)" to any <img> for silent retries.
// After 3 failures, swaps in a clean placeholder instead of a broken icon.
function imgRetry(img) {
  img.style.opacity = '0';
  const tries = parseInt(img.dataset.retries || '0', 10);
  const MAX = 3;
  const delays = [1000, 3000, 6000];
  if (tries < MAX) {
    img.dataset.retries = tries + 1;
    setTimeout(() => {
      const base = img.dataset.origSrc || img.src.split('?')[0];
      img.dataset.origSrc = base;
      img.src = base + '?r=' + tries;
    }, delays[tries]);
    img.style.background = '#1c222e';
    img.style.transition = 'opacity .3s';
  } else {
    const w = img.clientWidth  || img.closest('[style*="aspect"]')?.clientWidth  || 120;
    const h = img.clientHeight || w;
    const ph = document.createElement('div');
    ph.style.cssText = `width:${w}px;height:${h}px;max-width:100%;background:#12161f;` +
      `display:flex;align-items:center;justify-content:center;` +
      `color:#3a4255;font-size:22px;border-radius:inherit;`;
    ph.title = 'Image unavailable';
    ph.textContent = '🖼';
    img.replaceWith(ph);
  }
}
