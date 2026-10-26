import {initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {makeTournament,applyAction,assert} from './engine.js';
import * as v from './validation.js';
import {hasVerifiedIdentity} from './auth-identity.js';
initializeApp(); const db=getFirestore();
const options={region:'us-central1',maxInstances:5,timeoutSeconds:60};
function verified(request){if(!request.auth||!hasVerifiedIdentity(request.auth.token))throw new HttpsError('unauthenticated','Sign in with a verified email or phone number first.');return request.auth;}
async function admin(request){const auth=verified(request);const user=await getAuth().getUser(auth.uid);if(user.disabled||!(user.emailVerified||(auth.token.firebase?.sign_in_provider==='phone'&&user.phoneNumber===auth.token.phone_number))||user.customClaims?.admin!==true)throw new HttpsError('permission-denied','Administrator access is required.');return auth;}
function callable(handler){return onCall(options,async request=>{try{return await handler(request);}catch(e){if(e instanceof HttpsError)throw e;throw new HttpsError('invalid-argument',e.message||'Invalid request.');}});}
function audit(tx,auth,action,target){tx.create(db.collection('audit').doc(),{actorUid:auth.uid,action,target,createdAt:FieldValue.serverTimestamp()});}
export const applyForMembership=callable(async req=>{
 const auth=verified(req),input=v.memberInput(req.data),ref=db.doc(`members/${auth.uid}`);
 return db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)return {status:old.data().status};tx.create(ref,{...input,email:auth.token.email||null,phone:auth.token.phone_number||null,verifiedPhone:auth.token.firebase?.sign_in_provider==='phone'?auth.token.phone_number:null,uid:auth.uid,status:'pending',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {status:'pending'};});
});
export const reviewMember=callable(async req=>{
 const auth=await admin(req);v.object(req.data,['uid','status']);const uid=v.id(req.data.uid),status=req.data.status;assert(['approved','declined','pending'].includes(status),'Invalid membership status.');
 await db.runTransaction(async tx=>{const ref=db.doc(`members/${uid}`),old=await tx.get(ref);assert(old.exists,'Member not found.');tx.update(ref,{status,updatedAt:FieldValue.serverTimestamp()});if(status==='approved')tx.set(db.doc(`memberDirectory/${uid}`),{displayName:old.data().displayName,active:true});else tx.set(db.doc(`memberDirectory/${uid}`),{displayName:old.data().displayName,active:false});audit(tx,auth,`member:${status}`,uid);});return {ok:true};
});
export const createTournament=callable(async req=>{
 const auth=await admin(req);v.object(req.data,['title','date','division']);const ref=db.collection('tournaments').doc(),t=makeTournament({...req.data,id:ref.id});
 await db.runTransaction(async tx=>{tx.create(ref,{...t,createdBy:auth.uid,updatedAt:FieldValue.serverTimestamp()});audit(tx,auth,'tournament:create',ref.id);});return t;
});
export const updateTournament=callable(async req=>{
 const auth=await admin(req),{id,revision,action}=v.actionInput(req.data),ref=db.doc(`tournaments/${id}`);
 return db.runTransaction(async tx=>{const snap=await tx.get(ref);assert(snap.exists,'Tournament not found.');const old=snap.data();if(old.revision!==revision)throw new HttpsError('aborted','Another administrator changed this tournament. Refresh before trying again.');const next=applyAction(old,action);next.revision=revision+1;assert(JSON.stringify(next).length<700000,'Tournament storage limit reached.');tx.set(ref,{...next,updatedAt:FieldValue.serverTimestamp()});audit(tx,auth,`tournament:${action.type}`,`${id}${action.matchId?'/'+action.matchId:''}`);return {ok:true};});
});
export const saveAlbum=callable(async req=>{
 const auth=await admin(req),input=v.albumInput(req.data),ref=req.data.id?db.doc(`albums/${v.id(req.data.id)}`):db.collection('albums').doc();
 await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists){assert(old.data().revision===req.data.revision,'This album changed. Refresh before saving.');tx.update(ref,{...input,revision:old.data().revision+1,updatedAt:FieldValue.serverTimestamp()});}else{assert(!req.data.id,'Album not found.');tx.create(ref,{...input,revision:0,createdBy:auth.uid,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});}audit(tx,auth,'album:save',ref.id);});return {id:ref.id};
});
export const savePhoto=callable(async req=>{
 const auth=await admin(req),input=v.photoInput(req.data),albumId=v.id(req.data.albumId),photoId=v.id(req.data.photoId),albumRef=db.doc(`albums/${albumId}`),photoRef=albumRef.collection('photos').doc(photoId);
 const originalPath=`albums/${albumId}/originals/${photoId}`,previewPath=`albums/${albumId}/previews/${photoId}`;
 for(const path of [originalPath,previewPath]){const [meta]=await getStorage().bucket().file(path).getMetadata();assert(['image/jpeg','image/png','image/webp'].includes(meta.contentType)&&Number(meta.size)<=20*1024*1024,'Upload a JPEG, PNG, or WebP under 20 MB.');}
 await db.runTransaction(async tx=>{const album=await tx.get(albumRef),photo=await tx.get(photoRef);assert(album.exists,'Album not found.');tx.set(photoRef,{...input,originalPath,previewPath,createdAt:photo.exists?photo.data().createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});audit(tx,auth,'photo:save',`${albumId}/${photoId}`);});return {ok:true};
});
export {challengeMember,respondChallenge,playMemberMove,savePracticeGame} from './online.js';
