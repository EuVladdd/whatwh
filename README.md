# Printio — magazin și administrare

Magazin pentru Moldova, cu interfață RO/RU, MDL, editor față/spate, coș, cereri de comandă și admin. Aspectul urmează brandbook-ul, iar modelele folosesc fotografiile furnizate. Originalele din `printio temp` au rămas intacte.

## Pornire

Necesită **Node.js 24+**, fără pachete suplimentare.

```powershell
cd C:\printio.md
node --env-file-if-exists=.env server.mjs
```



## Adăugarea produselor

1. Intră în admin → **Adaugă produs**.
2. Trage o imagine în zona punctată sau selecteaz-o: JPG, PNG, WEBP, maximum 8 MB.
3. Alege **Model gata creat** pentru un design cu preț fix sau **Produs de personalizat** pentru o bază nouă disponibilă în editor.
4. Completează numele RO/RU, descrierile și prețul în MDL.
5. Pentru model, alege produsul de bază de la care se preiau mărimile și culorile. Pentru o bază nouă, completează variantele și alege șablonul zonei de print.
6. Salvează. Produsul apare la următoarea încărcare a catalogului public.

În **Produse → Editează** poți modifica fotografia, textele, prețul și variantele. Pentru bazele inițiale fără fotografie, adaugă una la prima editare din admin. Produsele și comenzile nu se șterg automat.

## Comenzi și statistici

Clientul alege mărimea, culoarea și cantitatea, apoi trimite numele, telefonul, preferința de contact și observațiile. Serverul validează datele și **recalculează prețul**, ignorând totalurile furnizate de browser.

Comanda începe ca **De confirmat**. În admin poți alege Confirmată, În producție, Finalizată sau Anulată. Detaliile păstrează varianta, numele și prețul de la plasarea cererii. Pentru personalizări se salvează textele, culorile, părțile, coordonatele, dimensiunile relative, rotația și imaginile originale.

Dashboardul arată cererile, cele de confirmat, valoarea estimativă fără anulări, vizualizările și paginile accesate. Valoarea nu reprezintă încasări; vizualizările nu sunt vizitatori unici. Sunt numărate și vizitele proprii. Nu se stochează IP-uri sau identificatori individuali în statistici. Dashboardul și comenzile se actualizează la 30 de secunde când sunt vizibile; lista are și actualizare manuală, căutare și filtru de status.

Nu se procesează plăți și nu se trimit automat SMS-uri sau e-mailuri. Confirmarea cu clientul este manuală.

## Configurări

| Fișier | Conținut |
|---|---|
| `config/prices.json` | Prețuri de bază, text, imagini, reduceri de cantitate, prețuri modele |
| `config/products.json` | Bazele inițiale, mărimi, culori, părți |
| `config/models.json` | Modelele inițiale și fotografiile |
| `config/print-areas.json` | Zone orientative în procente și centimetri |
| `config/business.json` | Telefon, e-mail, Instagram, TikTok, program, livrare RO/RU |
| `config/promotions.json` | Structură pentru promoții viitoare |
| `public/translations/ro.json`, `ru.json` | Textele magazinului |

Produsele salvate din admin sunt în SQLite și au prioritate față de JSON pentru același ID. Modifică prețurile lor din admin.

**Înainte de publicare:** completează tarifele reale și setează `demo: false` în `config/prices.json`; completează contactele și livrarea în `config/business.json`; confirmă zonele de print și instrucțiunile de îngrijire. Bazele fără fotografii sunt afișate schematic.

Reducerile de cantitate pentru produsele personalizate funcționează. Codurile promoționale, combo-urile și cadourile sunt extensii viitoare; activarea exemplului din `promotions.json` nu aplică o ofertă. Modelele gata create au preț fix per bucată. Nu se deschid cu grafica preîncărcată în editor, deoarece materialele furnizate sunt fotografii, nu grafici de print separate.

## Implementare

Am extins baza existentă în **HTML/CSS/JavaScript și Node.js nativ**, cu pornire fără dependențe. Această versiune **nu migrează la React/TypeScript/Express**. SQLite folosește `node:sqlite` din Node 24.

```text
public/app.js                Magazin, navigare, coș și editor
public/styles.css           Stiluri de bază
public/printio.css           Design Printio și responsive
public/admin.html/js/css     Panou de administrare
public/pricing.mjs          Calculator comun browser + server
public/translations/       Texte RO/RU
public/assets/             Copii optimizate ale materialelor
server.mjs                 HTTP, API, autentificare, validări
storage.mjs                SQLite, parole și statistici
data/printio.sqlite         Comenzi, produse admin, statistici
data/uploads/              Fotografii și imagini încărcate
tests/api.test.mjs          Teste de integrare
```

Editorul folosește elemente DOM poziționate, cu glisare, rotație și redimensionare, limitate vizual la zona de print. Previzualizarea este orientativă; nu generează automat un fișier de producție. Comenzile vechi din `data/orders.json`, dacă există, se importă în SQLite pe ID, fără a șterge originalul.

## Verificare

```powershell
node --test tests/api.test.mjs
```

Cele șase teste de integrare verifică autentificarea, accesul neautorizat, cross-origin, prețurile recalculate, variantele, personalizările, imaginile, editarea produselor, statusurile, statisticile și persistența după repornire. Rulează pe portul 3197 într-un director temporar separat, pe care îl curăță după test.

Verificări în browser: căutare, selectarea variantelor, trimiterea cererii, autentificare admin, detalii și status, încărcarea fotografiei, produs nou în catalogul rusesc. Datele de verificare au fost păstrate separat de magazin.

## Publicare și backup

`netlify.toml` publică numai `public/`, setează antetele CSP/HTTPS și rutele vizibile ale magazinului. Astfel parola, SQLite, sursa serverului și comenzile din rădăcina proiectului nu ajung în publish-ul Netlify.

**Limita importantă:** Netlify publică aici doar frontendul. Nu rulează `server.mjs`; comenzile, autentificarea adminului, încărcările și API-ul încă au nevoie de acest server. Înainte de a accepta cereri reale, mută backendul pe un host Node 24 cu disc persistent/SQLite, setează domeniul API în frontend și `HOST=0.0.0.0`, `COOKIE_SECURE=true` și parola admin prin secret manager. Nu considera doar `publish = "public"` o migrare a backendului.

Proiectul primit în acest director nu are `.git` sau remote Git configurat. Prin urmare, `git push` nu poate fi executat din acest checkout fără URL-ul repository-ului și istoricul sursă. Setarea `.gitignore` împiedică includerea bazei și a parolei la un push viitor; ea nu șterge obiecte dintr-un remote sau din istoricul Git. Dacă versiuni anterioare au fost publicate, rotește parola expusă din panoul Netlify și păstrează datele reale în afara repository-ului înainte de următorul deploy.

Site-ul de dezvoltare rulează local; nu am publicat schimbări pe site-ul de producție. Ai nevoie de hosting Node 24 cu disc persistent și HTTPS. La găzduire setează `HOST=0.0.0.0`, `COOKIE_SECURE=true` și o parolă admin prin configurarea securizată a gazdei. Local, serverul ascultă implicit doar pe `127.0.0.1`.

Parolele sunt hash scrypt cu salt; sesiunile folosesc cookie HttpOnly/SameSite, expiră în 8 ore și se invalidează la repornire. Autentificarea limitează încercările. Nu publica `data`, `.env` sau `admin-access.txt` printr-un server static.

Pentru backup, oprește serverul și copiază **întregul director data**, plus `config` și `public/assets`. Cât timp serverul rulează, folosește un backup SQLite consistent, care ține cont de jurnalul WAL. Instalarea este pentru un singur proces Node și un singur administrator; rolurile multiple și notificările necesită extindere.
