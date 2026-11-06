/**
 * User-supplied playlist export parser. Does not fetch or scrape Spotify.
 * Supports CSV (including quoted commas/newlines), TSV, JSON arrays, and
 * "Artist - Song" lines. Data is previewed before any upload.
 */
export type PlaylistTrack = { song: string; artist: string; album: string };
export type ImportParseResult = { tracks: PlaylistTrack[]; skipped: number; format: string };
export const trackKey = (t: {song:string;artist:string}) =>
  (t.artist.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase() + '::' +
   t.song.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()).slice(0,450);
function parseDelimited(input: string, separator: string): string[][] {
 const rows: string[][]=[];let row:string[]=[],cell='',quote=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quote&&input[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
  else if(c===separator&&!quote){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function pick(row:Record<string,unknown>):PlaylistTrack|null {
 const value=(...keys:string[])=>{for(const k of keys){const v=row[k];if(typeof v==='string'&&v.trim())return v.trim();}return '';};
 const song=value('title','song','track','trackname','track name','name');
 const artist=value('artist','artists','artistname','artist name','performer');
 if(!song||!artist||song.length>220||artist.length>220)return null;
 return {song,artist,album:value('album','albumname','album name').slice(0,250)};
}
export function parsePlaylistExport(text:string):ImportParseResult {
 if(text.length>300000)throw new Error('This paste is too large. Import smaller batches (300 tracks at a time).');
 const trimmed=text.replace(/^\uFEFF/,'').trim();
 if(!trimmed)return {tracks:[],skipped:0,format:'empty'};
 const candidates:PlaylistTrack[]=[];let skipped=0,format='text';
 if(trimmed.startsWith('[')||trimmed.startsWith('{')){
  let obj:unknown;
  try{obj=JSON.parse(trimmed);}catch{throw new Error('Invalid JSON. Try a CSV, TSV, or pasted song list.');}
  const items=Array.isArray(obj)?obj:(obj&&typeof obj==='object'&&'tracks' in obj&&Array.isArray(obj.tracks)?obj.tracks:null);
  if(!items)throw new Error('JSON must be an array of tracks or an object containing a tracks array.');
  format='json';
  for(const x of items){if(!x||typeof x!=='object'){skipped++;continue;}
   const raw=x as Record<string,unknown>;
   const row:Record<string,unknown>={};
   for(const [k,v] of Object.entries(raw))row[k.toLowerCase()]=v;
   const item=pick(row);if(item)candidates.push(item);else skipped++;
  }
 }else{
  const first=trimmed.split(/\r?\n/,1)[0];
  const separator=first.includes('\t')?'\t':first.includes(',')?',':null;
  if(separator){
   const rows=parseDelimited(trimmed,separator);
   const headers=rows[0]?.map(x=>x.trim().toLowerCase())||[];
   const isHeader=headers.includes('artist')||headers.includes('artists')||headers.includes('artist name')||headers.includes('artistname');
   format=separator==='\t'?'tsv':'csv';
   if(!isHeader)throw new Error('The export needs column headers such as title,artist,album. For a plain list, use Artist - Song on each line.');
   for(const cells of rows.slice(1)){
    const obj:Record<string,unknown>={};headers.forEach((h,i)=>obj[h]=cells[i]||'');
    const item=pick(obj);if(item)candidates.push(item);else skipped++;
   }
  }else{
   for(const line of trimmed.split(/\r?\n/)){
    const s=line.trim();if(!s)continue;
    const delimiter=s.includes(' — ')?' — ':s.includes(' - ')?' - ':null;
    if(!delimiter){skipped++;continue;}
    const p=s.split(delimiter),artist=p.shift()?.trim()||'',song=p.join(delimiter).trim();
    const item=pick({song,artist});if(item)candidates.push(item);else skipped++;
   }
  }
 }
 const seen=new Set<string>();const tracks:PlaylistTrack[]=[];
 for(const t of candidates){const key=trackKey(t);if(seen.has(key))continue;seen.add(key);tracks.push(t);}
 if(tracks.length>300)throw new Error('Import up to 300 unique songs per batch.');
 return {tracks,skipped,format};
}
