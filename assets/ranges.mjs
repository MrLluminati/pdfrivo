// Convert human-readable, 1-based page ranges into unique 0-based indices.
export function parseRanges(input, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('This PDF contains no pages.');
  const groups = String(input).split(',').map(s => s.trim());
  if (groups.some(s => !s)) throw new Error('Enter pages like 1-3, 5, 8-10.');
  const selected = [];
  for (const group of groups) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(group);
    if (!match) throw new Error('Invalid range "' + group + '". Use 1-3, 5, 8-10.');
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > pageCount) {
      throw new Error('Range "' + group + '" must be between 1 and ' + pageCount + '.');
    }
    for (let page = start; page <= end; page++) {
      if (!selected.includes(page - 1)) selected.push(page - 1);
    }
  }
  return selected;
}

export function parseGroups(input, pageCount) {
  const groups = String(input).split(',').map(s => s.trim());
  if (!groups.length || groups.some(s => !s)) throw new Error('Enter one or more page ranges.');
  if (groups.length > 200) throw new Error('Please use no more than 200 separate page groups per operation.');
  return groups.map(group => parseRanges(group, pageCount));
}
