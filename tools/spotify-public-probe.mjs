#!/usr/bin/env node
/**
 * EXPERIMENTAL / NON-PRODUCTION PUBLIC WEB PAGE PROBE
 *
 * Spotify User Guidelines prohibit crawling/scraping its Service.
 * This is a local technical experiment for a developer reviewing public
 * browser-visible markup, NOT a production data acquisition integration.
 * No Spotify authentication, bypass, anti-bot evasion, hidden endpoint use,
 * mass collection, Supabase write, or storage of audio.
 *
 * Install the optional browser driver on your own test machine:
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *   node tools/spotify-public-probe.mjs 'https://open.spotify.com/user/...'
 */
import { writeFile } from 'node:fs/promises';
import { parseSpotifyEmbedHtml } from './spotify-embed-parser.mjs';

const PROFILE_ID_PATTERN = /^[a-zA-Z0-9_]{3,64}$/;
const MAX_PLAYLISTS = 25;
const MAX_VISIBLE_TRACKS = 50;
const MAX_PAGE_MS = 30000;
const args = process.argv.slice(2);
const raw = args[0];
if (!raw) {
  console.error('Usage: node tools/spotify-public-probe.mjs https://open.spotify.com/user/<id>');
  process.exit(2);
}

function validateProfile(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') {
    throw new Error('Only HTTPS public open.spotify.com profile URLs are supported');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'user' || !PROFILE_ID_PATTERN.test(parts[1])) {
    throw new Error('Expected https://open.spotify.com/user/<spotify-user-id>');
  }
  return { userId: parts[1], url: 'https://open.spotify.com/user/' + parts[1] };
}

function playlistHref(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:' || u.hostname !== 'open.spotify.com') return null;
    const match = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?playlist\/([a-zA-Z0-9]{10,64})\/?$/);
    return match ? `https://open.spotify.com/playlist/${match[1]}` : null;
  } catch { return null; }
}
function sanitize(text) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0,200); }
const dedup = (items, idFn) => [...new Map(items.map(i => [idFn(i), i])).values()];

async function main() {
  const profile = validateProfile(raw);
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Optional browser dependency is not installed. Run npm install --no-save playwright followed by npx playwright install chromium.');
  }
  const browser = await chromium.launch({ headless: true });
  const result = {
    status: 'experimental_unverified',
    userId: profile.userId,
    profileUrl: profile.url,
    collectedAt: new Date().toISOString(),
    publicPlaylists: [],
    inventoryComplete: false,
    warnings: [
      'Spotify prohibits automated scraping in its User Guidelines.',
      'This output is not licensed for OVRLEE recommendations or user profiling.',
      'Only publicly delivered page HTML and its embedded page-hydration data are inspected.',
    ],
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const res = await page.goto(profile.url, { waitUntil: 'domcontentloaded', timeout: MAX_PAGE_MS });
    await page.waitForTimeout(4000);
    result.httpStatus = res?.status() ?? null;
    result.pageTitle = sanitize(await page.title());
    const links = await page.locator('a[href*="/playlist/"]').evaluateAll((anchors) =>
      anchors.map(a => ({
        href: a.href,
        name: (a.innerText || a.getAttribute('aria-label') || a.textContent || '').trim(),
      }))
    );
    const playlists = dedup(
      links.map(l => ({ url: playlistHref(l.href), title: sanitize(l.name) }))
        .filter(l => l.url),
      l => l.url
    );
    result.profilePlaylistLinksFound = playlists.length;
    result.inventoryComplete = Boolean(res?.ok()) && playlists.length > 0 && playlists.length <= MAX_PLAYLISTS;
    if (!playlists.length) {
      result.warnings.push('No playlist anchors were visible in the public page DOM. Profile might require Spotify app authentication, more rendering, or may be unavailable to browser automation.');
    }
    for (const item of playlists.slice(0, MAX_PLAYLISTS)) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        const embedUrl = item.url.replace('/playlist/', '/embed/playlist/');
        const response = await p.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: MAX_PAGE_MS });
        const parsed = parseSpotifyEmbedHtml(await p.content(), item.url, MAX_VISIBLE_TRACKS);
        result.publicPlaylists.push({
          title: parsed.title || item.title || sanitize(await p.title()),
          url: item.url,
          httpStatus: response?.status() ?? null,
          visibleTracks: parsed.tracks,
          trackCountVisible: parsed.tracks.length,
          completeness: parsed.completeness,
          observedRows: parsed.observedRows || 0,
          status: parsed.status,
        });
      } catch (error) {
        result.publicPlaylists.push({ title: item.title, url: item.url, status: 'error', error: String(error.message).slice(0,180), visibleTracks: [] });
      } finally { await p.close(); }
      await page.waitForTimeout(1500);
    }
    if (playlists.length > MAX_PLAYLISTS) result.warnings.push(`Only the first ${MAX_PLAYLISTS} public playlist links were inspected.`);
    result.status = result.publicPlaylists.some(p => p.visibleTracks.length) ? 'tracks_visible_in_public_embed' :
      playlists.length ? 'playlists_visible_tracks_unavailable' : 'profile_playlists_unavailable';
    const filename = 'spotify-public-probe-result.json';
    await writeFile(filename, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({
      status: result.status,
      userId: result.userId,
      playlistLinksFound: result.profilePlaylistLinksFound,
      playlistResults: result.publicPlaylists.map(p => ({ title: p.title, url: p.url, status: p.status, tracksVisible: p.visibleTracks.length })),
      saved: filename,
      warnings: result.warnings,
    }, null, 2));
  } finally { await browser.close(); }
}
main().catch(e => { console.error('Probe failed:', e.message); process.exitCode = 1; });
