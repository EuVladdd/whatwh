import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculatePrice} from '../public/pricing.mjs';

const prices=JSON.parse(await readFile(new URL('../public/config/prices.json',import.meta.url)));
const areas=JSON.parse(await readFile(new URL('../public/config/print-areas.json',import.meta.url)));
const config={prices,areas};
const text=(side,id,rotation=0)=>({id,type:'text',side,x:20,y:20,width:40,height:20,rotation,text:'Salut',color:'#211c19'});
const design=(layers,quantity=1)=>({product:'tshirt',color:'#f1f0eb',size:'M',quantity,layers});

test('simple design has no difficulty surcharge',()=>{
  const p=calculatePrice(design([text('front','one')]),config);
  assert.equal(p.difficultyLevel,'simple');
  assert.equal(p.difficultySetup,0);
  assert.equal(p.difficultyUnit,0);
});

test('extra elements and second side raise difficulty; setup is charged once',()=>{
  const layers=[text('front','one'),text('back','two')];
  const one=calculatePrice(design(layers),config);
  const ten=calculatePrice(design(layers,10),config);
  assert.equal(one.difficultyLevel,'medium');
  assert.equal(one.difficultySetup,35);
  assert.equal(ten.difficultySetup,35);
  assert.equal(ten.total,Math.round(ten.subtotal*.95+35));
});

test('detailed artwork can be priced as complex work',()=>{
  const image={id:'image',type:'image',side:'front',x:20,y:20,width:40,height:20,rotation:20,detail:'detailed'};
  const simple=calculatePrice(design([{...image,detail:'simple',rotation:0}]),config);
  const complex=calculatePrice(design([image,text('back','second')]),config);
  assert.equal(simple.difficultyLevel,'simple');
  assert.equal(complex.difficultyLevel,'complex');
  assert.equal(complex.difficultySetup,80);
  assert.ok(complex.total>simple.total);
});
