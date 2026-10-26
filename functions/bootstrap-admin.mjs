// Run with Application Default Credentials for the selected project only.
// Identity is an email or E.164 phone number; no secrets are command arguments.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const [projectId,identity]=process.argv.slice(2);
const phone=typeof identity==='string'&&/^\+[1-9]\d{7,14}$/.test(identity);
if(!projectId||(!phone&&!identity?.includes('@')))throw new Error('Usage: node bootstrap-admin.mjs PROJECT_ID VERIFIED_EMAIL_OR_E164_PHONE');
initializeApp({credential:applicationDefault(),projectId});
const user=phone?await getAuth().getUserByPhoneNumber(identity):await getAuth().getUserByEmail(identity);
if(user.disabled)throw new Error('The account is disabled.');
if(phone){
 const member=await getFirestore().doc(`members/${user.uid}`).get();
 if(!member.exists||member.data().verifiedPhone!==identity)throw new Error('First sign in using the SMS code and submit the membership application.');
}else if(!user.emailVerified)throw new Error('First register and verify this exact email.');
await getAuth().setCustomUserClaims(user.uid,{...user.customClaims,admin:true});
console.log('Admin role granted for the verified account. Sign out and sign in to refresh access.');
