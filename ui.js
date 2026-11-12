export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function status(message, error = false) {
  const node = document.getElementById('status');
  node.textContent = message; node.classList.toggle('error', error);
}
export function dateLabel(timestamp) { return new Date(timestamp).toLocaleString(); }
export function analysisUrl(id) { return chrome.runtime.getURL(`analysis.html?entry=${encodeURIComponent(id)}`); }

export function galleryCard(entry, onOpen, onDelete) {
  const card = element('article', undefined, 'gallery-card');
  const open = element('button', undefined, 'gallery-open');
  const image = element('img');
  image.src = entry.thumbnail || ''; image.alt = 'Screenshot preview'; image.loading = 'lazy';
  open.append(image, element('span', dateLabel(entry.timestamp), 'muted'), element('span', entry.analysis, 'preview'));
  open.addEventListener('click', () => onOpen(entry.id));
  card.append(open);
  if (onDelete) {
    const remove = element('button', 'Delete', 'secondary small');
    remove.addEventListener('click', () => onDelete(entry.id)); card.append(remove);
  }
  return card;
}
