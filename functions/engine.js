export const MAX_PLAYERS = 128;
export function assert(condition, message) { if (!condition) throw new Error(message); }
export function randomId() { if(globalThis.crypto.randomUUID)return globalThis.crypto.randomUUID();const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-'); }
export function shuffle(items, random = cryptoRandom) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function cryptoRandom() { return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; }
export function makeTournament({title, date, division, id = randomId()}) {
  assert(typeof title === 'string' && title.trim().length > 0 && title.length <= 100, 'Enter a title of 1–100 characters.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date, 'Choose a valid date.');
  assert(typeof division === 'string' && division.trim().length > 0 && division.length <= 40, 'Enter a division of 1–40 characters.');
  return {id, title:title.trim(), date, division:division.trim(), status:'draft', published:false, roster:[], rounds:[], revision:0, createdAt:new Date().toISOString(), completedAt:null};
}
export function addPlayers(t, names) {
  assert(t.status === 'draft', 'The roster is locked once pairings are generated.');
  assert(Array.isArray(names) && names.length, 'Add at least one player.');
  const clean = names.map(n=>n.trim()).filter(Boolean);
  assert(t.roster.length + clean.length <= MAX_PLAYERS, `A division supports up to ${MAX_PLAYERS} players.`);
  const keys = new Set(t.roster.map(p=>p.name.toLocaleLowerCase()));
  for (const name of clean) { assert(name.length <= 60, 'Player names must be 60 characters or less.'); assert(!keys.has(name.toLocaleLowerCase()), `“${name}” is already on the roster. Add an initial to distinguish players.`); keys.add(name.toLocaleLowerCase()); }
  return {...t, roster:[...t.roster, ...clean.map(name=>({id:randomId(),name}))]};
}
export function removePlayer(t,id) { assert(t.status==='draft','The roster is locked.'); return {...t,roster:t.roster.filter(p=>p.id!==id)}; }
export function startTournament(t, random=cryptoRandom) {
  assert(t.status==='draft','Pairings have already been generated.');
  assert(t.roster.length >= 2 && t.roster.length <= MAX_PLAYERS,'Add 2–128 players before generating pairings.');
  const roster = shuffle(t.roster,random); const size=2**Math.ceil(Math.log2(roster.length)); const byes=size-roster.length;
  let cursor=0;
  const first = Array.from({length:size/2},(_,i)=>({id:`r1m${i+1}`,slots:i<byes?[roster[cursor++].id,null]:[roster[cursor++].id,roster[cursor++].id],games:[],winnerId:null,bye:i<byes}));
  for(const m of first) if(m.bye)m.winnerId=m.slots[0];
  const rounds=[{number:1,matches:first}];
  for(let count=size/4;count>=1;count/=2) rounds.push({number:rounds.length+1,matches:Array.from({length:count},(_,i)=>({id:`r${rounds.length+1}m${i+1}`,slots:[null,null],games:[],winnerId:null,bye:false}))});
  return propagate({...t,status:'active',rounds});
}
function propagate(t) {
  for(let r=1;r<t.rounds.length;r++) for(let i=0;i<t.rounds[r].matches.length;i++) {
    const m=t.rounds[r].matches[i], sources=t.rounds[r-1].matches.slice(i*2,i*2+2);
    if(!m.games.length) m.slots=sources.map(s=>s.winnerId);
  }
  return t;
}
export function recordResult(input, matchId, outcome, note='') {
  assert(input.status==='active','Only an active tournament can accept results.');
  assert(['white','black','draw','white-forfeit','black-forfeit'].includes(outcome),'Choose a game outcome.');
  assert(typeof note==='string' && note.length<=300,'Notes must be 300 characters or less.');
  const t=structuredClone(input),m=t.rounds.flatMap(r=>r.matches).find(m=>m.id===matchId);
  assert(m && m.slots.every(Boolean) && !m.winnerId && !m.bye,'This match is not ready for a result.');
  assert(m.games.length<20,'Maximum replay count reached. Contact the tournament director.');
  m.games.push({whiteId:m.slots[0],blackId:m.slots[1],outcome,note,recordedAt:new Date().toISOString()});
  if(outcome==='draw') m.slots.reverse();
  else m.winnerId=outcome==='white'||outcome==='black-forfeit'?m.slots[0]:m.slots[1];
  return propagate(t);
}
export function resetMatch(input, matchId) {
  assert(input.status==='active','Reopen the completed tournament before correcting results.');
  const t=structuredClone(input);let r=t.rounds.findIndex(r=>r.matches.some(m=>m.id===matchId));
  assert(r>=0,'Match not found.');let i=t.rounds[r].matches.findIndex(m=>m.id===matchId);
  assert(!t.rounds[r].matches[i].bye,'A bye does not have a game result.');
  const match=t.rounds[r].matches[i];
  if(match.games.length)match.slots=[match.games[0].whiteId,match.games[0].blackId];
  for(;r<t.rounds.length;r++,i=Math.floor(i/2)){const m=t.rounds[r].matches[i];m.games=[];m.winnerId=null;}
  return propagate(t);
}
export function finishTournament(t) {assert(t.status==='active' && champion(t),'Complete the final match before archiving results.'); return {...t,status:'completed',completedAt:new Date().toISOString()};}
export function reopenTournament(t){assert(t.status==='completed','This tournament is not archived.');return {...t,status:'active',completedAt:null};}
export function champion(t){return t.rounds.at(-1)?.matches[0]?.winnerId||null;}
export function statistics(t) {
  const rows=t.roster.map(p=>({...p,wins:0,losses:0,draws:0,byes:0,forfeits:0,games:0}));const byId=Object.fromEntries(rows.map(p=>[p.id,p]));
  for(const m of t.rounds.flatMap(r=>r.matches)) {
    if(m.bye){byId[m.winnerId].byes++;continue;}
    for(const g of m.games) {
      const w=byId[g.whiteId],b=byId[g.blackId]; w.games++; b.games++;
      if(g.outcome==='draw'){w.draws++;b.draws++;}
      else if(g.outcome==='white'||g.outcome==='black-forfeit'){w.wins++;b.losses++;if(g.outcome==='black-forfeit')b.forfeits++;}
      else{b.wins++;w.losses++;if(g.outcome==='white-forfeit')w.forfeits++;}
    }
  }
  return rows.sort((a,b)=>(b.id===champion(t))-(a.id===champion(t))||b.wins-a.wins||a.losses-b.losses||a.name.localeCompare(b.name));
}
export function applyAction(t, action) {
  switch(action.type){
    case 'addPlayers':return addPlayers(t,action.names);
    case 'removePlayer':return removePlayer(t,action.playerId);
    case 'start':return startTournament(t);
    case 'result':return recordResult(t,action.matchId,action.outcome,action.note||'');
    case 'reset':return resetMatch(t,action.matchId);
    case 'finish':return finishTournament(t);
    case 'reopen':return reopenTournament(t);
    case 'publish':return {...t,published:!!action.published};
    default:throw new Error('Unknown tournament action.');
  }
}
