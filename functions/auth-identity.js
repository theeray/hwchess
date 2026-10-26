// Only Firebase-issued, verified identity claims qualify. A phone field alone
// never substitutes for completing Firebase's SMS sign-in flow.
export function hasVerifiedIdentity(token){
 return token?.email_verified===true || (token?.firebase?.sign_in_provider==='phone' && typeof token.phone_number==='string' && /^\+[1-9]\d{7,14}$/.test(token.phone_number));
}
