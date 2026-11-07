#!/usr/bin/env node
// One-off technical feasibility test only. Not a production collector.
// Reads the explicitly public, unauthenticated recently-played artist page.
const url='https://open.spotify.com/user/8712xitlaly/recently-played-artists';
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},
   userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
   locale:'en-US'});
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForTimeout(5000);
 const initialHtml=await response?.text().catch(()=>null);
 const rawHtmlSignals={
   bytes:initialHtml?.length||0,
   hasRecentHeading:/Recently played artists/i.test(initialHtml||''),
   artistHrefCount:(initialHtml?.match(/href=["'][^"']*\/artist\//g)||[]).length,
   gridMarkerPresent:(initialHtml||'').includes('grid-container'),
   knownArtistPresent:/girl in red/i.test(initialHtml||''),
 };
 const details=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('[data-encore-id="card"]')];
  const artistLinks=[...document.querySelectorAll('a[href*="/artist/"]')];
  const titleFor=a=>a.closest('[data-encore-id="card"]')?.querySelector('[data-encore-id="cardTitle"]')?.getAttribute('title')
      || a.querySelector('[data-encore-id="cardTitle"]')?.getAttribute('title')||a.getAttribute('title')||a.textContent?.trim();
  const artists=[...new Map(artistLinks.map(a=>[a.getAttribute('href'),titleFor(a)]).filter(([href,title])=>href&&title).map(([href,title])=>[href,{name:title,href}])).values()];
  return {title:document.title,bodySnippet:document.body?.innerText?.slice(0,650),
    gridCount:document.querySelectorAll('[data-testid="grid-container"]').length,
    cardCount:cards.length,artistLinkCount:artistLinks.length,
    artists:artists.slice(0,20)};
 });
 console.log('PUBLIC_ARTIST_PROBE',JSON.stringify({status:response?.status(),url,rawHtmlSignals,...details}));
}finally{await browser.close();}
