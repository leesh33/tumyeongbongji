// SVG에는 줄바꿈이 없어서, 글자 폭을 어림해 직접 줄을 나눈다.
const WIDE = /[\u1100-\u11FF\u2E80-\uD7AF\uAC00-\uD7A3\u3130-\u318F\uFF00-\uFF60]/;

export function charWidth(ch, size) {
  if (ch === ' ') return size * 0.3;
  if (ch === '·' || ch === 'ㆍ') return size * 0.34;
  if (WIDE.test(ch)) return size * 1.0;
  if (/[A-Z]/.test(ch)) return size * 0.68;
  if (/[a-z0-9]/.test(ch)) return size * 0.56;
  return size * 0.52;
}

export function textWidth(str, size) {
  let w = 0;
  for (const ch of String(str)) w += charWidth(ch, size);
  return w;
}

/** maxWidth에 맞춰 최대 maxLines 줄로 나눈다. 넘치면 마지막 줄을 …로 자른다. */
export function wrapText(str, size, maxWidth, maxLines = 2) {
  const text = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  let idx = 0;
  let truncated = false;

  while (idx < words.length) {
    const word = words[idx];
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= maxWidth) {
      line = candidate;
      idx += 1;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }
    // 한 단어가 한 줄보다 길면 글자 단위로 자른다.
    let chunk = '';
    for (const ch of word) {
      if (textWidth(chunk + ch, size) > maxWidth) break;
      chunk += ch;
    }
    if (!chunk) chunk = word.slice(0, 1);
    lines.push(chunk);
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    const rest = word.slice(chunk.length);
    if (rest) words[idx] = rest;
    else idx += 1;
  }
  if (line) lines.push(line);

  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last && textWidth(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/\s+$/, '')}…`;
  }
  return lines.slice(0, maxLines);
}

export function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
