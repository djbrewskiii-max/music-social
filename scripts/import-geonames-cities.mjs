#!/usr/bin/env node
/**
 * One-time/import refresh for OVRLEE worldwide city search.
 * Source: GeoNames cities1000.zip, countryInfo.txt, admin1CodesASCII.txt.
 * License: Creative Commons Attribution 4.0 — https://www.geonames.org/about.html
 *
 * Dry-run (no credentials needed):
 *   node scripts/import-geonames-cities.mjs
 *
 * Explicit production import (service key NEVER committed or logged):
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<server-only-key> \
 *     node scripts/import-geonames-cities.mjs --apply
 *
 * Never use a service-role key inside Expo, the browser, or a public CI log.
 * The public client only calls the RLS-protected search_world_cities RPC.
 */
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const ORIGIN='https://download.geonames.org/export/dump/';
const apply=process.argv.includes('--apply');
const batchSize=400;
const maxRecordsArg=process.argv.find(x=>x.startsWith('--limit='));
const maxRecords=maxRecordsArg?Number(maxRecordsArg.split('=')[1]):Infinity;
if(!Number.isInteger(maxRecords)&&maxRecords!==Infinity)throw new Error('Use a positive --limit=N');
if(maxRecords<=0)throw new Error('Use a positive --limit=N');

async function download(name){
  const res=await fetch(ORIGIN+name,{signal:AbortSignal.timeout(90000)});
  if(!res.ok)throw new Error('GeoNames download failed ('+name+'): '+res.status);
  return Buffer.from(await res.arrayBuffer());
}
function fromZip(zipFile,root){
  const result=spawnSync('unzip',['-p',zipFile],{
    encoding:'utf8',maxBuffer:150*1024*1024,timeout:60000,
  });
  if(result.error||result.status!==0)
    throw new Error('Unzip failed (macOS unzip command required): '+(result.stderr||result.error||result.status));
  return result.stdout;
}
const parseRows=(raw)=>raw.split(/\r?\n/).filter(line=>line&&!line.startsWith('#'))
  .map(line=>line.split('\t'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const dir=await mkdtemp(join(tmpdir(),'ovrlee-geonames-'));
try{
  const [zipBuffer,countryBuffer,adminBuffer]=await Promise.all([
    download('cities1000.zip'),download('countryInfo.txt'),download('admin1CodesASCII.txt')
  ]);
  const zipFile=join(dir,'cities1000.zip');
  await writeFile(zipFile,zipBuffer);
  const countryLookup=new Map(parseRows(countryBuffer.toString('utf8'))
    .filter(row=>row[0]&&row[4]).map(row=>[row[0],row[4]]));
  const regionLookup=new Map(parseRows(adminBuffer.toString('utf8'))
    .filter(row=>row[0]&&row[1]).map(row=>[row[0],row[1]]));
  const imported=[];
  for(const fields of parseRows(fromZip(zipFile,dir))){
    if(imported.length>=maxRecords)break;
    const [geoid,name,ascii,,lat,lon,,,countryCode,,,,,,population,,,,modified]=fields;
    const admin1=fields[10];
    const id=Number(geoid),latitude=Number(lat),longitude=Number(lon);
    if(!Number.isSafeInteger(id)||!name||!countryCode||countryCode.length!==2||
       !Number.isFinite(latitude)||!Number.isFinite(longitude)||
       Math.abs(latitude)>90||Math.abs(longitude)>180)continue;
    const pop=Number(population||0);
    imported.push({
      geoname_id:id,name,ascii_name:ascii||name,
      country:countryLookup.get(countryCode)||countryCode,
      country_code:countryCode,
      region:regionLookup.get(countryCode+'.'+admin1)||null,
      latitude,longitude,population:Number.isFinite(pop)&&pop>0?pop:0,
      source_modified:/^\d{4}-\d{2}-\d{2}$/.test(modified||'')?modified:null,
    });
  }
  const preview=imported.filter(city=>['Manchester','Accra','Springfield'].includes(city.name))
    .sort((a,b)=>b.population-a.population).slice(0,12)
    .map(x=>[x.name,x.region,x.country,x.population].join(' · '));
  console.log('GeoNames cities:',imported.length,'Countries:',new Set(imported.map(x=>x.country_code)).size);
  console.log('Sample city matches:\n'+preview.join('\n'));
  if(!apply){
    console.log('\nDRY RUN ONLY. Nothing changed in Supabase. Pass --apply with server credentials after review.');
    process.exitCode=0;
  } else {
    const url=process.env.SUPABASE_URL?.trim();
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if(!url||!key)throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply');
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))
      throw new Error('SUPABASE_URL must be the HTTPS project hostname');
    const {createClient}=await import('@supabase/supabase-js');
    const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    let written=0;
    for(let start=0;start<imported.length;start+=batchSize){
      const rows=imported.slice(start,start+batchSize);
      let lastError=null;
      for(let attempt=0;attempt<4;attempt++){
        const {error}=await client.from('world_city_directory')
          .upsert(rows,{onConflict:'geoname_id'});
        if(!error){lastError=null;break;}
        lastError=error;
        await pause((attempt+1)*1000);
      }
      if(lastError)throw new Error('Import stopped after '+written+' rows: '+lastError.message);
      written+=rows.length;
      if(written%4000===0||written===imported.length)
        console.log('Imported '+written+'/'+imported.length);
    }
    // Read-only client search serves this gazetteer; no third-party geocoding
    // credentials or paid endpoint are required after the import.
    console.log('GeoNames import complete. Verify city queries and show CC BY 4.0 attribution.');
  }
}finally{
  await rm(dir,{recursive:true,force:true});
}
