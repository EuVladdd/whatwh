import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

export function createStorage(root) {
  mkdirSync(root,{recursive:true});
  const db=new DatabaseSync(join(root,'printio.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, created TEXT NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS catalog (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,path)); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const old=join(root,'orders.json');
  if(existsSync(old)) for(const o of JSON.parse(readFileSync(old,'utf8'))) db.prepare('INSERT OR IGNORE INTO orders VALUES (?,?,?,?)').run(o.id,o.createdAt,o.status,JSON.stringify(o));
  let credentials=db.prepare("SELECT value FROM settings WHERE key='credentials'").get();
  function setPassword(password){const salt=randomBytes(16).toString('hex');const value=JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')});db.prepare("INSERT OR REPLACE INTO settings VALUES ('credentials',?)").run(value);credentials={value};}
  if(process.env.ADMIN_PASSWORD){if(process.env.ADMIN_PASSWORD.length<12) throw new Error('ADMIN_PASSWORD must have at least 12 characters');setPassword(process.env.ADMIN_PASSWORD);}
  if(!credentials){const password=randomBytes(18).toString('base64url');setPassword(password);writeFileSync(join(root,'admin-access.txt'),`PRINTIO — acces local\nhttp://localhost:${process.env.PORT||3000}/admin\nParolă: ${password}\n\nPentru schimbare: pornește serverul cu ADMIN_PASSWORD (minimum 12 caractere).\n`,{mode:0o600});}
  return {
    password(value){if(typeof value!=='string'||value.length>200)return false;const c=JSON.parse(credentials.value);return timingSafeEqual(scryptSync(value,c.salt,64),Buffer.from(c.hash,'hex'));},
    orders(){return db.prepare('SELECT body,status FROM orders ORDER BY created DESC').all().map(r=>({...JSON.parse(r.body),status:r.status}));},
    saveOrder(o){db.prepare('INSERT INTO orders VALUES (?,?,?,?)').run(o.id,o.createdAt,o.status,JSON.stringify(o));},
    status(id,status){return db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,id).changes;},
    catalog(){return db.prepare('SELECT body FROM catalog').all().map(r=>JSON.parse(r.body));},
    saveProduct(p){db.prepare('INSERT OR REPLACE INTO catalog VALUES (?,?)').run(p.id,JSON.stringify(p));},
    visit(path){db.prepare('INSERT INTO visits VALUES (?,?,1) ON CONFLICT(day,path) DO UPDATE SET views=views+1').run(new Date().toISOString().slice(0,10),path);},
    stats(){return db.prepare('SELECT day,SUM(views) AS views FROM visits GROUP BY day ORDER BY day DESC LIMIT 30').all();},
    pages(){return db.prepare('SELECT path,SUM(views) AS views FROM visits GROUP BY path ORDER BY views DESC LIMIT 10').all();}
  };
}
