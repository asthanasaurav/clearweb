const test=require('node:test');const assert=require('node:assert/strict');const {candidateFromElementLike,heuristicClassify,policy}=require('../packages/ai/classifier');
test('high confidence ad is removable',()=>{const c=candidateFromElementLike({tag:'DIV',text:'Sponsored',classes:[]});assert.equal(policy(c,heuristicClassify(c)).action,'remove')});
test('interactive controls fail open',()=>{const c=candidateFromElementLike({tag:'BUTTON',text:'Sponsored checkout',classes:[]});assert.equal(policy(c,heuristicClassify(c)).action,'keep')});
