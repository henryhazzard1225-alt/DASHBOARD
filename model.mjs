export function normalize(rows) {
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Expected an array of up to 10,000 daily metric rows.');
  const keys = new Set();
  return rows.map((r, i) => {
    if (!r || typeof r !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date) throw new Error(`Row ${i+1}: date must be a valid YYYY-MM-DD.`);
    const source = String(r.source || 'Imported').slice(0,80);
    const key = r.date + '\0' + source;
    if (keys.has(key)) throw new Error(`Row ${i+1}: duplicate date/source. Aggregate each source by day first.`);
    keys.add(key);
    const out = {date:r.date, source};
    for (const field of ['revenue','orders','customers']) {
      if (typeof r[field] !== 'number' || !Number.isFinite(r[field]) || r[field]<0 || (field !== 'revenue' && !Number.isInteger(r[field]))) throw new Error(`Row ${i+1}: ${field} must be a nonnegative ${field === 'revenue' ? 'number' : 'integer'}.`);
      out[field]=r[field];
    }
    return out;
  });
}
export function sample() {
  const rows=[];
  for(let d=89;d>=0;d--) for(let s=0;s<3;s++) {
    const date=new Date(); date.setUTCDate(date.getUTCDate()-d);
    const orders=Math.round(22+(89-d)*.3+Math.sin(d*.7+s)*12+s*9);
    rows.push({date:date.toISOString().slice(0,10),source:['Online store','Subscriptions','Marketplace'][s],orders,customers:Math.round(orders*.6),revenue:Math.round(orders*(55+s*18)*100)/100});
  }
  return rows;
}
