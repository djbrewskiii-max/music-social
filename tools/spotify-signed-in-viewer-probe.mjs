#!/usr/bin/env node
/**
 * One-time, user-controlled experiment:
 * Can a normal *signed-in viewer* see the public Recently played artists
 * section for another Spotify profile in a regular browser?
 *
 * This is not a production scraper. No cookies, passwords, tokens,
 * browser storage states, or network request bodies are exported.
 * Uses a fresh in-memory browser context each time; sign-in is user-driven.
 *
 * Run (Playwright needs to be installed as an optional dependency):
 *   node tools/spotify-signed-in-viewer-probe.mjs https://open.spotify.com/user/8712xitlaly
 *
 * Do not automate repeated collection, bypass access restrictions, or
 * deploy as a collection service without Spotify policy/legal approval.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function profileURL(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') {
    throw new Error('Only open.spotify.com HTTPS profile links are accepted.');
  }
  const match = url.pathname.match(/^\/user\/([a-zA-Z0-9_-]{2,80})\/?$/);
  if (!match) throw new Error('Pass a Spotify user profile URL (/user/...).');
  return 'https://open.spotify.com/user/' + match[1];
}
function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0,120);
}

const provided = process.argv[2];
if (!provided) {
  console.error('Usage: node tools/spotify-signed-in-viewer-probe.mjs https://open.spotify.com/user/<id>');
  process.exit(2);
}
const target = profileURL(provided);
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright not installed. Install with: npm install --no-save playwright');
  console.error('Then run: npx playwright install chromium');
  process.exit(2);
}
// macOS Monterey cannot install Playwright's bundled Chromium build.
// Prefer an already-installed Chromium-based browser on macOS.
const { existsSync } = await import('node:fs');
const candidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const browserPath = process.env.OVRLEE_BROWSER_PATH || candidates.find(existsSync);
if (process.platform === 'darwin' && !browserPath) {
  console.error('No supported Chrome/Edge/Brave/Chromium installation was found.');
  console.error('Install Google Chrome on your Mac, or set OVRLEE_BROWSER_PATH to its executable.');
  process.exit(2);
}
const browser = await chromium.launch({
  headless: false,
  ...(browserPath ? { executablePath: browserPath } : {}),
});
const context = await browser.newContext({ locale: 'en-US' });
const page = await context.newPage();
const reader = createInterface({ input: stdin, output: stdout });
try {
  // Sign-in is performed by the actual viewer in Spotify's own site.
  // This program never reads their password or cookies.
  await page.goto('https://open.spotify.com/', { waitUntil:'domcontentloaded',timeout:35000 });
  console.log('\nA Spotify browser window is open. Sign in there, as you normally would.');
  console.log('Once you see your signed-in Spotify homepage, return here.');
  await reader.question('Press ENTER after you have signed in (or to attempt while logged out): ');

  const checks = [
    target + '/recently-played-artists',
    target,
  ];
  let found = [];
  const evidence = [];
  for (const url of checks) {
    const response = await page.goto(url, {waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForTimeout(6500);
    // Only the on-screen artist cards or the specifically labeled section.
    // Do not collect hidden app state, session information, or unrelated links.
    const observed = await page.evaluate(() => {
      const grids = [...document.querySelectorAll('[data-testid="grid-container"]')];
      const cards = grids.flatMap(g => [...g.querySelectorAll('[data-encore-id="card"]')]);
      let sections = cards;
      if (!sections.length) {
        const headings = [...document.querySelectorAll('h1,h2,h3,h4')];
        const h = headings.find(x => /recently played artists/i.test(x.textContent || ''));
        if (h) {
          const parent = h.parentElement?.parentElement;
          if (parent) sections = [...parent.querySelectorAll('[data-encore-id="card"]')];
        }
      }
      const artists = [];
      const seen = new Set();
      for (const card of sections) {
        const anchor = card.querySelector('a[href*="/artist/"]');
        const artistId = anchor?.getAttribute('href')?.match(/\/artist\/([a-zA-Z0-9]+)/)?.[1];
        const title = card.querySelector('[data-encore-id="cardTitle"]')?.getAttribute('title')
          || card.querySelector('[data-encore-id="cardTitle"]')?.textContent?.trim()
          || anchor?.getAttribute('title') || anchor?.textContent?.trim();
        if (!artistId || !title || seen.has(artistId)) continue;
        seen.add(artistId);
        artists.push({ id: artistId, name: title });
      }
      return {
        artistCount: artists.length,
        artists,
        hasRecentHeading: [...document.querySelectorAll('h1,h2,h3,h4')].some(
          el => /recently played artists/i.test(el.textContent || '')
        ),
        hasLoginCallToAction: /Log in|Sign up/.test(document.body?.innerText || ''),
        profileNotFound: /couldn['’]?t find that page|page not found|we can['’]?t seem to find/i.test(document.body?.innerText || ''),
        documentTitle: document.title,
        visibleHeadings: [...document.querySelectorAll('h1,h2,h3')]
          .filter(el => !!el.getClientRects().length)
          .map(el => (el.textContent || '').trim().replace(/\s+/g,' ').slice(0,100))
          .filter(Boolean).slice(0,12),
        visibleArtistLinks: [...document.querySelectorAll('a[href*="/artist/"]')]
          .filter(el => !!el.getClientRects().length).length,
        visiblePageExcerpt: (document.querySelector('main')?.innerText || document.body?.innerText || '')
          .replace(/\s+/g,' ').slice(0,420),
      };
    });
    evidence.push({
      path: new URL(url).pathname,
      status: response?.status() || 0,
      visibleArtistCards: observed.artistCount,
      sectionVisible: observed.hasRecentHeading,
      loginCallToActionVisible: observed.hasLoginCallToAction,
      profileNotFound: observed.profileNotFound,
      pageTitle: observed.documentTitle,
      headings: observed.visibleHeadings,
      artistLinksVisible: observed.visibleArtistLinks,
      pageExcerpt: observed.visiblePageExcerpt,
    });
    if (observed.artists.length) {
      found = observed.artists.map(({name,id}) => ({ name: safeText(name), spotifyArtistUrl:'https://open.spotify.com/artist/'+id }));
      break;
    }
  }
  console.log('\nSPOTIFY SIGNED-IN VIEWER FEASIBILITY');
  console.log(JSON.stringify({ target, evidence, artists: found }, null, 2));
  if(evidence.some(e=>e.path===new URL(target).pathname && e.profileNotFound)){
    console.log('\nPROFILE PAGE NOT FOUND: Spotify did not resolve this user URL in Chrome. Copy the exact profile link using Spotify mobile → three dots → Share → Copy link to profile. Do not infer the URL from the display name.');
  }else{
    console.log(found.length
      ? '\nPublic artist cards were found on this profile.'
      : '\nNo artist cards found. Use the visible headings and page excerpt above to distinguish missing content from selector issues.');
  }
  await reader.question('Inspect the final Spotify profile page in Chrome. Press ENTER to close it: ');
} finally {
  reader.close();
  await context.close(); // session stays in memory only; no cookies exported
  await browser.close();
}
