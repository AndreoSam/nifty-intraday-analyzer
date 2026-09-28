const QUERIES = [
  { id: 'india', label: 'India', q: '(India OR Nifty OR Sensex OR RBI OR SEBI OR rupee OR INR OR Indian stocks) (market OR economy OR stocks OR policy)' },
  { id: 'global', label: 'Global macro', q: '(Fed OR ECB OR BOJ OR China OR tariffs OR inflation OR oil OR crude OR bonds OR dollar OR recession) (markets OR economy OR stocks)' },
  { id: 'risk', label: 'Risk events', q: '(war OR conflict OR sanctions OR cyberattack OR banking crisis OR emergency OR earthquake OR hurricane) (markets OR economy OR oil)' }
];

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

function cleanHtml(value='') {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRss(xml, source) {
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return items.map(item => {
    const pick = tag => {
      const match = item.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>', 'i'));
      return match ? cleanHtml(match[1]) : '';
    };
    const title = pick('title');
    const link = pick('link');
    const pubDate = pick('pubDate');
    const description = pick('description');
    return { title, link, publishedAt: pubDate ? Date.parse(pubDate) : 0, description, source };
  }).filter(x => x.title && x.link);
}

function classify(article) {
  const text = (article.title + ' ' + article.description).toLowerCase();
  const positive = ['rate cut','stimulus','beat estimates','strong growth','cooling inflation','deal reached','ceasefire','eases','surge in demand'];
  const negative = ['rate hike','tariff','war','missile','sanction','inflation rises','bank crisis','default','recession','selloff','downgrade','attack','escalat'];
  const india = ['india','nifty','sensex','rbi','sebi','rupee','inr'];
  let score = 0;
  positive.forEach(k => { if (text.includes(k)) score += 1; });
  negative.forEach(k => { if (text.includes(k)) score -= 1; });
  const marketRelevance = india.some(k => text.includes(k)) ? 'INDIA' : 'GLOBAL';
  return {
    ...article,
    tone: score > 0 ? 'POSITIVE' : score < 0 ? 'NEGATIVE' : 'NEUTRAL',
    impact: Math.min(5, Math.max(1, Math.abs(score) + (/(rbi|fed|tariff|war|oil|inflation|bank)/i.test(text) ? 1 : 0))),
    marketRelevance
  };
}

export async function getNews() {
  const all = [];
  for (const query of QUERIES) {
    const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query.q) + '&hl=en-IN&gl=IN&ceid=IN:en';
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) continue;
    const xml = await res.text();
    all.push(...parseRss(xml, query.label));
  }
  const seen = new Set();
  const articles = all
    .filter(a => {
      const key = a.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(classify)
    .sort((a,b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 60);

  const highImpact = articles.filter(a => a.impact >= 3);
  const neg = highImpact.filter(a => a.tone === 'NEGATIVE').length;
  const pos = highImpact.filter(a => a.tone === 'POSITIVE').length;
  const pressure = neg - pos;
  const regime = pressure >= 3 ? 'RISK_OFF' : pressure <= -3 ? 'RISK_ON' : 'MIXED';

  return {
    generatedAt: Date.now(),
    regime,
    pressure,
    articles,
    methodology: 'News is grouped from public RSS search results and classified with transparent keyword rules. It is an early-warning layer, not a guaranteed market prediction.'
  };
}
