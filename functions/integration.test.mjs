import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {initializeApp as adminApp,deleteApp as deleteAdmin,getApp as getAdminApp} from 'firebase-admin/app';import {getAuth as adminAuth} from 'firebase-admin/auth';import {getFirestore as adminDb} from 'firebase-admin/firestore';
import {initializeApp,deleteApp} from 'firebase/app';import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
const projectId='demo-headwaters';let trusted,handlers;const direct=process.env.HCC_DIRECT_CALLS==='1';const clients={};
before(async()=>{trusted=adminApp({projectId},'integration-admin');if(direct)handlers=await import('./index.js');const au=adminAuth(trusted);for(const uid of ['director','alice','bob','pending']){const email=`${uid}@example.invalid`,password='Testing-only-passphrase-493';try{await au.createUser({uid,email,password,emailVerified:true});}catch{}if(uid==='director')await au.setCustomUserClaims(uid,{admin:true});const app=initializeApp({projectId,apiKey:'fake-api-key',authDomain:`${projectId}.firebaseapp.com`},uid);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});await signInWithEmailAndPassword(auth,email,password);const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',5001);clients[uid]={app,call:async(name,data)=>{if(!direct)return (await httpsCallable(functions,name,{timeout:15000})(data)).data;const token=await au.verifyIdToken(await auth.currentUser.getIdToken());return handlers[name].run({data,auth:{uid:token.uid,token}});}};} });
after(async()=>{await Promise.all(Object.values(clients).map(c=>deleteApp(c.app)));await adminDb(trusted).terminate();await deleteAdmin(trusted);if(direct){await adminDb(getAdminApp()).terminate();await deleteAdmin(getAdminApp());}});
test('membership approvals, randomized brackets, safe corrections, albums, member chess and idempotent stats',{timeout:45000},async()=>{
 const db=adminDb(trusted),director=clients.director;
 const issued=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneNumber:'+16505550101',recaptchaToken:'emulator-only'})}).then(r=>r.json());
 const codes=await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/verificationCodes`).then(r=>r.json());const sms=codes.verificationCodes.find(c=>c.sessionInfo===issued.sessionInfo);assert.ok(sms);
 let phoneSession=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionInfo:issued.sessionInfo,code:sms.code})}).then(r=>r.json());assert.ok(phoneSession.idToken);
 const phoneClient={call:async(name,data)=>{if(direct){const token=await adminAuth(trusted).verifyIdToken(phoneSession.idToken);return handlers[name].run({data,auth:{uid:token.uid,token}});}const response=await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${phoneSession.idToken}`},body:JSON.stringify({data})});const body=await response.json();if(!response.ok||body.error)throw new Error(body.error?.message||'Callable failed');return body.result;}};
 await phoneClient.call('applyForMembership',{displayName:'Phone player',level:'Beginner',consent:true});
 const phoneMember=(await db.doc(`members/${phoneSession.localId}`).get()).data();assert.equal(phoneMember.email,null);assert.equal(phoneMember.verifiedPhone,'+16505550101');
 await assert.rejects(phoneClient.call('createTournament',{title:'Unauthorized',date:'2026-11-22',division:'Open'}));
 await adminAuth(trusted).setCustomUserClaims(phoneSession.localId,{admin:true});const refreshed=await fetch('http://127.0.0.1:9099/securetoken.googleapis.com/v1/token?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:phoneSession.refreshToken})}).then(r=>r.json());phoneSession.idToken=refreshed.id_token;assert.ok(phoneSession.idToken);
 const phoneTournament=await phoneClient.call('createTournament',{title:'Phone-admin tournament',date:'2026-11-22',division:'Open'});assert.ok(phoneTournament.id);

 for(const uid of ['alice','bob','pending']){await clients[uid].call('applyForMembership',{displayName:uid,level:'Beginner',consent:true});}
 await assert.rejects(clients.alice.call('reviewMember',{uid:'alice',status:'approved'}));
 await director.call('reviewMember',{uid:'alice',status:'approved'});await director.call('reviewMember',{uid:'bob',status:'approved'});
 assert.equal((await db.doc('memberDirectory/alice').get()).data().active,true);
 await assert.rejects(clients.pending.call('challengeMember',{toUid:'bob',mode:'rapid'}));
 const tournament=await director.call('createTournament',{title:'Emulator tournament',date:'2026-11-22',division:'Open'});
 const tpath=`tournaments/${tournament.id}`;
 await director.call('updateTournament',{id:tournament.id,revision:0,action:{type:'addPlayers',names:['First','Second','Third']}});
 await assert.rejects(director.call('updateTournament',{id:tournament.id,revision:0,action:{type:'start'}}));
 await director.call('updateTournament',{id:tournament.id,revision:1,action:{type:'start'}});
 let t=(await db.doc(tpath).get()).data();assert.equal(t.status,'active');assert.equal(t.rounds[0].matches.filter(m=>m.bye).length,1);
 while(!t.rounds.at(-1).matches[0].winnerId){const m=t.rounds.flatMap(r=>r.matches).find(m=>m.slots.every(Boolean)&&!m.winnerId);await director.call('updateTournament',{id:t.id,revision:t.revision,action:{type:'result',matchId:m.id,outcome:'white',note:''}});t=(await db.doc(tpath).get()).data();}
 await director.call('updateTournament',{id:t.id,revision:t.revision,action:{type:'finish'}});
 const album=await director.call('saveAlbum',{title:'Private album',description:'',dateLabel:'',published:false});assert.equal((await db.doc(`albums/${album.id}`).get()).data().published,false);
 const challenge=await clients.alice.call('challengeMember',{toUid:'bob',mode:'rapid'});
 await assert.rejects(clients.alice.call('respondChallenge',{id:challenge.id,response:'accept'}));
 const {gameId}=await clients.bob.call('respondChallenge',{id:challenge.id,response:'accept'});const ref=db.doc(`games/${gameId}`);let g=(await ref.get()).data();
 const white=clients[g.whiteUid],black=clients[g.blackUid];
 await assert.rejects(black.call('playMemberMove',{id:gameId,revision:g.revision,action:{type:'move',uci:'e7e5'}}));
 await white.call('playMemberMove',{id:gameId,revision:g.revision,action:{type:'move',uci:'e2e4'}});g=(await ref.get()).data();assert.equal(g.revision,1);assert.equal(g.fen.split(' ')[1],'b');
 await assert.rejects(black.call('playMemberMove',{id:gameId,revision:0,action:{type:'move',uci:'e7e5'}}));
 await black.call('playMemberMove',{id:gameId,revision:1,action:{type:'resign'}});
 assert.equal((await db.doc(`memberStats/${g.whiteUid}`).get()).data().memberWins,1);
 assert.equal((await db.doc(`memberStats/${g.blackUid}/opponents/${g.whiteUid}`).get()).data().losses,1);
 await assert.rejects(black.call('playMemberMove',{id:gameId,revision:2,action:{type:'resign'}}));
 assert.equal((await db.doc(`memberStats/${g.whiteUid}`).get()).data().memberWins,1);
 const practice={id:'practice-one',bot:'paul',pgn:'1. f3 e5 2. g4 Qh4#',humanColor:'w',resigned:false,opening:'King’s Pawn Game'};
 await clients.alice.call('savePracticeGame',practice);await clients.alice.call('savePracticeGame',practice);
 assert.equal((await db.doc('memberStats/alice').get()).data().practiceGames,1);
 await assert.rejects(clients.alice.call('savePracticeGame',{...practice,id:'practice-two',pgn:'1. e4'}));
});
