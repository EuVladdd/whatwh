import http from 'node:http';
import {createStorage} from './storage.mjs';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {calculatePrice} from './public/pricing.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = process.env.DATA_DIR || join(ROOT, 'data');
const store=createStorage(DATA);
const sessions=new Map();
const attempts=new Map();
const UPLOADS = join(DATA, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const maxOrderBytes = 1024 * 1024;
const maxUploadBody = 11 * 1024 * 1024;
const files = {products:'products.json',prices:'prices.json',areas:'print-areas.json',models:'models.json',promotions:'promotions.json',business:'business.json'};
const loadConfig = async () => {
 const c=Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key,file]) => [key, JSON.parse(await readFile(join(PUBLIC,'config',file),'utf8'))])));
 for(const p of store.catalog()) {
   if(p.kind==='base') {c.products=c.products.filter(v=>v.id!==p.id);c.products.push(p);c.prices.base[p.id]=p.price;c.areas[p.id]=c.areas[p.template]||c.areas.tshirt;}
   else {c.models=c.models.filter(v=>v.id!==p.id);c.models.push(p);c.prices.models[p.id]=p.price;}
 }
 return c;
};
const json = (res,status,value) => {const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)};
const readJson = async (req,max) => {
  const type = req.headers['content-type'] || '';
  if (!type.startsWith('application/json')) throw Object.assign(new Error('JSON required'),{status:415});
  let size=0;const chunks=[];
  for await (const chunk of req) {size+=chunk.length;if(size>max)throw Object.assign(new Error('Request too large'),{status:413});chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
};
const validImage = (bytes,type) => type==='image/png' ? bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : type==='image/jpeg' ? bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes.at(-2)===255 && bytes.at(-1)===217 : type==='image/webp' ? bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' : false;
const uploadTypes = {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'};
function validateDesign(d,config) {
  if(!d || typeof d!=='object')return false;
  const product=config.products.find(p=>p.id===d.product);
  if(!product || !product.colors.includes(d.color) || !product.sizes.includes(d.size) || !Number.isInteger(d.quantity) || d.quantity<1 || d.quantity>500 || !Array.isArray(d.layers) || d.layers.length>24)return false;
  return d.layers.every(l=>{
    if(!l || typeof l!=='object' || !['text','image'].includes(l.type) || !product.sides.includes(l.side) || typeof l.id!=='string' || l.id.length>80)return false;
    if(![l.x,l.y,l.width,l.height,l.rotation].every(Number.isFinite) || l.width<5 || l.width>100 || l.height<5 || l.height>100 || l.x<0 || l.y<0 || l.x+l.width>100.001 || l.y+l.height>100.001 || Math.abs(l.rotation)>180)return false;
    return l.type==='text' ? typeof l.text==='string' && l.text.length<=150 && typeof l.color==='string' && /^#[0-9a-fA-F]{6}$/.test(l.color) : typeof l.imageId==='string' && /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(l.imageId);
  });
}
async function order(req,res){
  const body=await readJson(req,maxOrderBytes);
  if(typeof body?.name!=='string' || body.name.trim().length<2 || body.name.length>100 || typeof body.phone!=='string' || !/^\+?[0-9() .-]{7,22}$/.test(body.phone) || !['call','message'].includes(body.method) || !['ro','ru'].includes(body.lang) || typeof body.notes!=='string' || body.notes.length>1000 || !Array.isArray(body.items) || !body.items.length || body.items.length>20) return json(res,400,{error:'Invalid order'});
  const config=await loadConfig();let total=0;const items=[];
  for(const item of body.items){
    if(!item || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>500)return json(res,400,{error:'Invalid item'});
    if(item.kind==='custom' && validateDesign(item.design,config) && item.quantity===item.design.quantity){
      for(const layer of item.design.layers.filter(l=>l.type==='image')){try{await stat(join(UPLOADS,layer.imageId))}catch{return json(res,400,{error:'Image unavailable'})}}
      const design={product:item.design.product,color:item.design.color,size:item.design.size,quantity:item.quantity,layers:item.design.layers.map(l=>l.type==='text'?{id:l.id,type:l.type,side:l.side,x:l.x,y:l.y,width:l.width,height:l.height,rotation:l.rotation,text:l.text,color:l.color}:{id:l.id,type:l.type,side:l.side,x:l.x,y:l.y,width:l.width,height:l.height,rotation:l.rotation,imageId:l.imageId})};
      total+=calculatePrice(design,config).total;items.push({kind:'custom',quantity:item.quantity,design,name:config.products.find(p=>p.id===design.product).name,price:calculatePrice(design,config).total});
    }else if(item.kind==='model' && typeof item.modelId==='string'){
      if(!config.models.some(m=>m.id===item.modelId))return json(res,400,{error:'Unknown model'});
      const model=config.models.find(m=>m.id===item.modelId);const base=config.products.find(p=>p.id===model.product);if(!base || !base.sizes.includes(item.size) || !base.colors.includes(item.color))return json(res,400,{error:'Choose size and color'});total+=config.prices.models[item.modelId]*item.quantity;items.push({kind:'model',modelId:item.modelId,name:model.name,quantity:item.quantity,size:item.size,color:item.color,price:config.prices.models[item.modelId],image:model.image});
    }else return json(res,400,{error:'Invalid item'});
  }
  const id=randomUUID();const reference='PR-'+id.slice(0,8).toUpperCase();
  const entry={id,reference,createdAt:new Date().toISOString(),status:'pending_confirmation',name:body.name.trim(),phone:body.phone.trim(),method:body.method,lang:body.lang,notes:body.notes.trim(),items,estimatedTotal:total,priceStatus:config.prices.demo?'demo':'configured'};
  store.saveOrder(entry);
  return json(res,201,{reference,status:entry.status,estimatedTotal:total});
}
async function upload(req,res){
  const body=await readJson(req,maxUploadBody);
  if(typeof body?.data!=='string' || typeof body?.type!=='string' || !uploadTypes[body.type] || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data))return json(res,400,{error:'Invalid image'});
  const bytes=Buffer.from(body.data,'base64');
  if(bytes.length<1 || bytes.length>8*1024*1024 || !validImage(bytes,body.type))return json(res,400,{error:'Invalid image'});
  const id=randomUUID()+uploadTypes[body.type];await writeFile(join(UPLOADS,id),bytes,{flag:'wx',mode:0o600});json(res,201,{imageId:id,url:'/api/images/'+id});
}
async function serve(req,res,path){
  const target=resolve(PUBLIC,'.'+path);
  if(target!==PUBLIC && !target.startsWith(PUBLIC+sep))return json(res,403,{error:'Forbidden'});
  let actual=target;let info;
  try{info=await stat(actual);if(!info.isFile())throw new Error()}catch{if(path.includes('.'))return json(res,404,{error:'Not found'});actual=join(PUBLIC,'index.html');info=await stat(actual)}
  res.writeHead(200,{'Content-Type':mime[extname(actual)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':path.startsWith('/assets/')?'public, max-age=3600':'no-cache','X-Content-Type-Options':'nosniff'});
  createReadStream(actual).pipe(res);
}
await mkdir(UPLOADS,{recursive:true});
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if(['POST','PATCH','PUT','DELETE'].includes(req.method) && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origin rejected'});
    const sid=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('printio_session='))?.slice(16);
    const session=sessions.get(sid);
    const authenticated=session && session>Date.now();
    if(req.method==='POST' && path==='/api/admin/login'){
      const ip=req.socket.remoteAddress;const now=Date.now();const a=attempts.get(ip)||{count:0,until:now+900000};if(now>a.until){a.count=0;a.until=now+900000;}if(a.count>=10)return json(res,429,{error:'Prea multe încercări. Revino în 15 minute.'});
      const body=await readJson(req,4096);a.count++;attempts.set(ip,a);if(!store.password(body?.password))return json(res,401,{error:'Parolă incorectă.'});
      attempts.delete(ip);for(const [key,expiry] of sessions)if(expiry<now)sessions.delete(key);const token=randomUUID()+randomUUID();sessions.set(token,now+8*3600000);res.setHeader('Set-Cookie',`printio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return json(res,200,{ok:true});
    }
    if(path.startsWith('/api/admin/')){
      if(!authenticated)return json(res,401,{error:'Autentificare necesară.'});
      if(req.method==='POST' && path==='/api/admin/logout'){sessions.delete(sid);res.setHeader('Set-Cookie','printio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
      if(req.method==='GET' && path==='/api/admin/dashboard')return json(res,200,{orders:store.orders(),visits:store.stats(),pages:store.pages(),config:await loadConfig()});
      if(req.method==='PATCH' && path.startsWith('/api/admin/orders/')){const b=await readJson(req,4096);if(!['pending_confirmation','confirmed','production','completed','cancelled'].includes(b.status))return json(res,400,{error:'Status invalid'});return json(res,store.status(path.split('/').at(-1),b.status)?200:404,{ok:true});}
      if(req.method==='POST' && path==='/api/admin/products'){
        const b=await readJson(req,20000);const c=await loadConfig();
        if(!b || !['base','model'].includes(b.kind) || typeof b.id!=='string' || !/^[a-z][a-z0-9-]{1,60}$/.test(b.id) || !['ro','ru'].every(l=>typeof b.name?.[l]==='string'&&b.name[l].trim().length>0&&b.name[l].length<=120&&typeof b.description?.[l]==='string'&&b.description[l].length<=2000) || !Number.isFinite(b.price)||b.price<=0||b.price>100000||typeof b.image!=='string'||!/^\/api\/images\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(b.image)&&!/^\/assets\/[a-z0-9-]+\.(jpg|png|webp)$/.test(b.image))return json(res,400,{error:'Completează corect numele, imaginea și prețul.'});
        if(b.kind==='base'){
          if(!c.areas[b.template]||!Array.isArray(b.colors)||b.colors.length<1||b.colors.length>20||!b.colors.every(v=>/^#[0-9a-fA-F]{6}$/.test(v))||!Array.isArray(b.sizes)||b.sizes.length<1||b.sizes.length>20||!b.sizes.every(v=>typeof v==='string'&&v.length>0&&v.length<20))return json(res,400,{error:'Variante invalide'});
          b.sides=Object.keys(c.areas[b.template]);
        }else if(!c.products.some(p=>p.id===b.product))return json(res,400,{error:'Produs invalid'});
        if(b.image.startsWith('/api/images/'))try{await stat(join(UPLOADS,b.image.split('/').at(-1)))}catch{return json(res,400,{error:'Imagine indisponibilă'});}
        const entry={id:b.id,kind:b.kind,name:b.name,description:b.description,price:b.price,image:b.image,...(b.kind==='base'?{template:b.template,colors:b.colors,sizes:b.sizes,sides:b.sides}:{product:b.product})};store.saveProduct(entry);return json(res,201,{ok:true,product:entry});
      }
      return json(res,404,{error:'Not found'});
    }
    if(req.method==='POST' && path==='/api/visit'){const b=await readJson(req,2048);if(typeof b?.path!=='string'||!/^\/[a-z0-9/-]{0,100}$/.test(b.path)||b.path.startsWith('/admin'))return json(res,400,{error:'Invalid path'});store.visit(b.path);return json(res,200,{ok:true});}
    if(path==='/admin' || path==='/admin/')return await serve(req,res,'/admin.html');
    if(req.method==='GET' && path==='/api/config')return json(res,200,await loadConfig());
    if(req.method==='POST' && path==='/api/upload')return await upload(req,res);
    if(req.method==='POST' && path==='/api/orders')return await order(req,res);
    if(req.method==='GET' && /^\/api\/images\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path)){
      const target=join(UPLOADS,path.split('/').at(-1));try{const info=await stat(target);res.writeHead(200,{'Content-Type':mime[extname(target)],'Content-Length':info.size,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'});return createReadStream(target).pipe(res)}catch{return json(res,404,{error:'Not found'})}
    }
    if(path.startsWith('/api/'))return json(res,404,{error:'Not found'});
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    return await serve(req,res,path);
  }catch(e){console.error(e);if(!res.headersSent)json(res,e.status||500,{error:e.status?'Invalid request':'Server unavailable'})}
}).listen(PORT,process.env.HOST||'127.0.0.1',()=>console.log(`Printio: http://localhost:${PORT}`));
