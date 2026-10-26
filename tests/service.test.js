import test from 'node:test';import assert from 'node:assert/strict';import * as v from '../functions/validation.js';
const member={displayName:'Player A',level:'Beginner',consent:true};
test('membership schema rejects injected roles, wrong types, oversized values and omitted required fields',()=>{assert.equal(v.memberInput(member).displayName,'Player A');for(const input of [{...member,admin:true},{...member,status:'approved'},{...member,displayName:42},{...member,displayName:'x'.repeat(61)},{...member,consent:false},{displayName:'A'}])assert.throws(()=>v.memberInput(input));});
test('IDs reject traversal, unexpected fields and exhaustion',()=>{for(const value of ['../members/x','a/b','',{},'x'.repeat(129)])assert.throws(()=>v.id(value));assert.throws(()=>v.object({extra:'x'},['title']));assert.throws(()=>v.object({title:'x'.repeat(24001)},['title']));});
test('albums enforce exact shape, bounded strings and typed publication',()=>{const a={title:'Club',description:'',dateLabel:'2026',published:false};assert.equal(v.albumInput(a).published,false);assert.throws(()=>v.albumInput({...a,published:'true'}));assert.throws(()=>v.albumInput({...a,title:'x'.repeat(101)}));assert.throws(()=>v.albumInput({...a,createdBy:'other'}));});
test('photos cannot inject storage paths, omit descriptions, use wrong visibility or overflow order',()=>{const p={albumId:'a',photoId:'b',caption:'',credit:'',alt:'A game of chess',visible:false,order:0};assert.equal(v.photoInput(p).order,0);for(const x of [{...p,originalPath:'elsewhere'},{...p,alt:''},{...p,order:-1},{...p,order:2e9},{...p,caption:'x'.repeat(301)},{...p,visible:'true'}])assert.throws(()=>v.photoInput(x));});
test('tournament updates require a valid revision and bounded, named actions',()=>{assert.equal(v.actionInput({id:'a',revision:0,action:{type:'start'}}).revision,0);for(const x of [{id:'a',revision:-1,action:{type:'start'}},{id:'a',revision:0,action:{type:'admin'}},{id:'a',revision:0,action:{type:'publish',published:'yes'}},{id:'a',revision:0,action:{type:'addPlayers',names:['x'.repeat(61)]}}])assert.throws(()=>v.actionInput(x));});

import {hasVerifiedIdentity} from '../functions/auth-identity.js';
test('identity verification accepts completed phone sign-in, never an unverified phone field',()=>{
 assert.equal(hasVerifiedIdentity({email_verified:true}),true);
 assert.equal(hasVerifiedIdentity({phone_number:'+16505550101',firebase:{sign_in_provider:'phone'}}),true);
 for(const token of [null,{}, {email_verified:false}, {phone_number:'+16505550101'}, {phone_number:'+16505550101',firebase:{sign_in_provider:'password'}}, {phone_number:'not-a-number',firebase:{sign_in_provider:'phone'}}])assert.equal(hasVerifiedIdentity(token),false);
});
