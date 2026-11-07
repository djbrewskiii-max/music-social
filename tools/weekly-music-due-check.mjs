import {syncCall} from './weekly-music-identity.mjs';
import {appendFileSync} from 'node:fs';

const response=await syncCall({action:'list_due'});
const profiles=Array.isArray(response.profiles)?response.profiles:[];
const count=profiles.length;
const output=process.env.GITHUB_OUTPUT;
if(output)appendFileSync(output,'has_due='+(count>0?'true':'false')+'\n');
console.log('OVRLEE weekly profile refresh: '+count+' opted-in profile'+(count===1?'':'s')+' due.');
