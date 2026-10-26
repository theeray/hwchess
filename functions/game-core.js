import {Chess} from 'chess.js';import {assert} from './engine.js';
export const MODES={blitz:{label:'Blitz · 3 + 2',initialMs:180000,incrementMs:2000},rapid:{label:'Rapid · 10 + 5',initialMs:600000,incrementMs:5000},untimed:{label:'No time limit',initialMs:null,incrementMs:0},correspondence:{label:'14 days per move',initialMs:1209600000,incrementMs:0}};
export function loadGame(g){const chess=new Chess();if(g.pgn)chess.loadPgn(g.pgn);return chess;}
export function createGame({id,whiteUid,blackUid,whiteName,blackName,mode},now){assert(MODES[mode],'Choose a supported time control.');assert(whiteUid!==blackUid,'Choose another member.');const chess=new Chess();return {id,type:'member',participantUids:[whiteUid,blackUid],whiteUid,blackUid,whiteName,blackName,mode,status:'active',fen:chess.fen(),pgn:'',revision:0,whiteMs:MODES[mode].initialMs,blackMs:MODES[mode].initialMs,turnStartedAt:now,drawOfferedBy:null,winnerUid:null,reason:null,completedAtMs:null};}
export function remainingMs(g,color,now){if(g.mode==='untimed')return null;const base=color==='w'?g.whiteMs:g.blackMs;const activeColor=g.fen.split(' ')[1];return Math.max(0,base-(g.status==='active'&&activeColor===color?Math.max(0,now-g.turnStartedAt):0));}
function finish(g,winnerUid,reason,now){return {...g,status:'completed',winnerUid,reason,completedAtMs:now,drawOfferedBy:null};}
function canMate(chess,color){const pieces=chess.board().flat().filter(p=>p&&p.color===color&&p.type!=='k');return pieces.length>0&&!chess.isInsufficientMaterial();}
export function checkTimeout(g,now){if(g.status!=='active'||g.mode==='untimed')return g;const turn=g.fen.split(' ')[1];if(remainingMs(g,turn,now)>0)return g;const other=turn==='w'?'b':'w',winner=canMate(loadGame(g),other)?(other==='w'?g.whiteUid:g.blackUid):null;return finish(g,winner,winner?'timeout':'timeout-insufficient-material',now);}
export function gameAction(input,uid,action,now){assert(input.participantUids.includes(uid),'You are not a player in this game.');assert(input.status==='active','This game has already finished.');let g=checkTimeout(structuredClone(input),now);if(g.status==='completed')return {...g,revision:g.revision+1};const chess=loadGame(g);const color=g.whiteUid===uid?'w':'b';
 if(action.type==='claimTimeout'){throw new Error('Neither player has run out of time.');}
 if(action.type==='resign')g=finish(g,color==='w'?g.blackUid:g.whiteUid,'resignation',now);
 else if(action.type==='offerDraw'){assert(g.drawOfferedBy!==uid,'You already offered a draw.');assert(!g.drawOfferedBy,'Respond to the existing draw offer.');g.drawOfferedBy=uid;}
 else if(action.type==='acceptDraw'){assert(g.drawOfferedBy&&g.drawOfferedBy!==uid,'Only the other player can accept a draw offer.');g=finish(g,null,'agreement',now);}
 else if(action.type==='declineDraw'){assert(g.drawOfferedBy&&g.drawOfferedBy!==uid,'There is no draw offer for you.');g.drawOfferedBy=null;}
 else if(action.type==='move'){
  assert(chess.turn()===color,'It is the other player’s turn.');assert(typeof action.uci==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action.uci),'Choose a legal move.');
  const move=chess.move({from:action.uci.slice(0,2),to:action.uci.slice(2,4),promotion:action.uci[4]});assert(move,'Illegal move.');
  const mode=MODES[g.mode];if(g.mode!=='untimed'){const key=color==='w'?'whiteMs':'blackMs';g[key]=g.mode==='correspondence'?mode.initialMs:remainingMs(input,color,now)+mode.incrementMs;}
  g.pgn=chess.pgn();g.fen=chess.fen();g.turnStartedAt=now;g.drawOfferedBy=null;
  if(chess.isCheckmate())g=finish(g,uid,'checkmate',now);
  else if(chess.isStalemate())g=finish(g,null,'stalemate',now);
  else if(chess.isThreefoldRepetition())g=finish(g,null,'threefold-repetition',now);
  else if(chess.isInsufficientMaterial())g=finish(g,null,'insufficient-material',now);
  else if(chess.isDrawByFiftyMoves())g=finish(g,null,'fifty-move-rule',now);
  assert(chess.history().length<=1200,'This game has reached the move limit. Agree a draw or resign.');
 }else throw new Error('Unknown game action.');
 return {...g,revision:input.revision+1};
}
