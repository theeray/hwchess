import {hasVerifiedIdentity} from '../functions/auth-identity.js';
import {randomId} from '../functions/engine.js';
export const session={configured:!!window.HEADWATERS_FIREBASE,user:null,member:null,verified:false,admin:false,ready:false};
let auth,db,storage,functions,api,notify=()=>{};
export async function initialize(onChange){notify=onChange;if(!session.configured){session.ready=true;return;}
 try{
 const [appSDK,authSDK,firestoreSDK,functionsSDK,storageSDK]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore'),import('firebase/functions'),import('firebase/storage')]);
 api={...authSDK,...firestoreSDK,...functionsSDK,...storageSDK};const app=appSDK.initializeApp(window.HEADWATERS_FIREBASE);auth=api.getAuth(app);db=api.getFirestore(app);storage=api.getStorage(app);functions=api.getFunctions(app,'us-central1');
 api.onAuthStateChanged(auth,async user=>{session.user=user;session.admin=false;session.verified=false;session.member=null;
 try{if(user){const token=await user.getIdTokenResult();session.verified=hasVerifiedIdentity(token.claims);session.admin=session.verified&&token.claims.admin===true;const s=await api.getDoc(api.doc(db,'members',user.uid));session.member=s.exists()?s.data():null;}}catch(e){session.error=e.message;}session.ready=true;notify();});
 }catch(e){session.ready=true;session.error='Online services could not load. Please try again later.';notify();}
}
export async function call(name,data){if(!session.configured||!functions)throw new Error('Online services are not connected yet.');return (await api.httpsCallable(functions,name)(data)).data;}
export async function login(email,password){await api.signInWithEmailAndPassword(auth,email,password);}
export async function signup(email,password){const {user}=await api.createUserWithEmailAndPassword(auth,email,password);await api.sendEmailVerification(user);}
export async function resetPassword(email){await api.sendPasswordResetEmail(auth,email);}
export async function signout(){await api.signOut(auth);}
export async function refreshUser(){await auth.currentUser.reload();await auth.currentUser.getIdToken(true);session.user=auth.currentUser;const token=await auth.currentUser.getIdTokenResult();session.verified=hasVerifiedIdentity(token.claims);session.admin=session.verified&&token.claims.admin===true;const s=await api.getDoc(api.doc(db,'members',auth.currentUser.uid));session.member=s.exists()?s.data():null;notify();}
export async function resendVerification(){await api.sendEmailVerification(auth.currentUser);}
export async function list(name,all=false){if(!db)return [];const col=api.collection(db,name);const q=all?api.query(col,api.limit(300)):api.query(col,api.where('published','==',true),api.limit(300));return (await api.getDocs(q)).docs.map(s=>({...s.data(),id:s.id}));}
export async function members(){if(!db)return [];return (await api.getDocs(api.query(api.collection(db,'members'),api.limit(300)))).docs.map(s=>({...s.data(),id:s.id}));}
export async function getTournament(id){const s=await api.getDoc(api.doc(db,'tournaments',id));if(!s.exists())throw new Error('Tournament not found.');return {...s.data(),id:s.id};}
export function watchTournament(id,onData,onError){return api.onSnapshot(api.doc(db,'tournaments',id),s=>{if(s.exists())onData({...s.data(),id:s.id});else onError(new Error('Tournament not found.'));},onError);}
export async function albumPhotos(id,admin=false){const col=api.collection(db,'albums',id,'photos');const q=admin?api.query(col,api.limit(500)):api.query(col,api.where('visible','==',true),api.limit(500));return (await api.getDocs(q)).docs.map(s=>({...s.data(),id:s.id})).sort((a,b)=>a.order-b.order);}
const blobUrls=new Map();
export async function photoUrl(path){if(blobUrls.has(path))return blobUrls.get(path);const blob=await api.getBlob(api.ref(storage,path),20*1024*1024);const url=URL.createObjectURL(blob);blobUrls.set(path,url);return url;}
export async function uploadPhoto(albumId,file,order){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Choose JPEG, PNG, or WebP files under 20 MB.');
 const id=randomId(),originalPath=`albums/${albumId}/originals/${id}`,previewPath=`albums/${albumId}/previews/${id}`;
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const preview=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
 await api.uploadBytes(api.ref(storage,originalPath),file,{contentType:file.type});await api.uploadBytes(api.ref(storage,previewPath),preview,{contentType:'image/webp'});
 await call('savePhoto',{albumId,photoId:id,caption:'',credit:'',alt:file.name.replace(/\.[^.]+$/,'').slice(0,250),visible:false,order});
 return id;
}
export async function directory(){return (await api.getDocs(api.query(api.collection(db,'memberDirectory'),api.where('active','==',true)))).docs.map(s=>({...s.data(),id:s.id}));}
export function watchGames(onData,onError){return api.onSnapshot(api.query(api.collection(db,'games'),api.where('participantUids','array-contains',session.user.uid),api.orderBy('createdAt','desc'),api.limit(100)),s=>onData(s.docs.map(d=>({...d.data(),id:d.id}))),onError);}
export function watchChallenges(onData,onError){return api.onSnapshot(api.query(api.collection(db,'challenges'),api.where('participantUids','array-contains',session.user.uid)),s=>onData(s.docs.map(d=>({...d.data(),id:d.id}))),onError);}
export function watchMemberGame(id,onData,onError){return api.onSnapshot(api.doc(db,'games',id),s=>s.exists()?onData({...s.data(),id:s.id}):onError(new Error('Game not found.')),onError);}
export async function dashboardData(){const uid=session.user.uid;const [stats,opponents,practice,games]=await Promise.all([api.getDoc(api.doc(db,'memberStats',uid)),api.getDocs(api.collection(db,'memberStats',uid,'opponents')),api.getDocs(api.query(api.collection(db,'members',uid,'practice'),api.orderBy('createdAt','desc'),api.limit(100))),api.getDocs(api.query(api.collection(db,'games'),api.where('participantUids','array-contains',uid),api.orderBy('createdAt','desc'),api.limit(100)))]);return {games:games.docs.map(d=>({...d.data(),id:d.id})),stats:stats.exists()?stats.data():{},opponents:opponents.docs.map(d=>({...d.data(),id:d.id})),practice:practice.docs.map(d=>({...d.data(),id:d.id}))};}

let phoneVerifier=null,phoneConfirmation=null,phoneCooldown=0;
export function clearPhoneChallenge(){phoneVerifier?.clear();phoneVerifier=null;phoneConfirmation=null;}
export async function sendPhoneCode(raw){
 if(Date.now()<phoneCooldown)throw new Error('Please wait one minute before requesting another code.');
 let phone=raw.replace(/[\s().-]/g,'');if(/^\d{10}$/.test(phone))phone='+1'+phone;
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error('Enter a phone number with its country code, such as +1 for the US.');
 clearPhoneChallenge();phoneVerifier=new api.RecaptchaVerifier(auth,'phone-recaptcha',{size:'compact'});
 try{phoneConfirmation=await api.signInWithPhoneNumber(auth,phone,phoneVerifier);phoneCooldown=Date.now()+60000;}
 catch(e){clearPhoneChallenge();throw e;}
}
export async function confirmPhoneCode(code){
 if(!phoneConfirmation)throw new Error('Request a new verification code first.');
 if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit verification code.');
 await phoneConfirmation.confirm(code);clearPhoneChallenge();
}
