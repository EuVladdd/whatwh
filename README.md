# Printio — magazin static pentru Netlify

Magazinul Printio are catalog RO/RU, constructor cu design separat pe față și spate, coș și formular de cerere. Varianta publicată pe Netlify rulează din fișierele din `public/`, fără Node.js sau bază de date pe server. `netlify.toml` publică numai acest director și configurează rutele site-ului.

## Publicare pe Netlify

1. Conectează repository-ul GitHub la un site Netlify. Directorul de publicare este `public`; nu este necesară comandă de build.
2. În Netlify, activează **Forms / Form detection** și declanșează un deploy nou. Formularul `printio-order` este definit în `public/index.html`; Netlify trebuie să îl detecteze la deploy.
3. Înainte de a primi cereri reale, completează tarifele din `public/config/prices.json` și setează `demo` la `false`. Verifică datele de contact și livrare din `public/config/business.json` și zonele de print din `public/config/print-areas.json`.
4. Trimite o cerere de test de pe domeniul Netlify și verifică apariția ei în **Netlify → Forms → printio-order**, inclusiv imaginile atașate. Prețul trimis este o estimare; confirmă manual produsul, grafica și tariful cu clientul.

Pe site-ul static, fotografiile încărcate în constructor sunt păstrate local în browser până la trimiterea cererii, apoi sunt atașate formularului Netlify. Sunt acceptate cel mult șase imagini distincte per cerere și un total de aproximativ 7,5 MB pentru cerere. Nu șterge datele browserului înainte de trimitere. Formularul afișează o eroare dacă un fișier local nu mai este disponibil.

Pagina `/admin` explică fluxul static. Comenzile se consultă în contul Netlify, iar statisticile în Netlify Analytics, dacă este activat. Panoul Printio cu statusuri, editare în browser și grafice necesită backendul Node; o pagină statică nu poate proteja o parolă de administrator sau păstra comenzi într-o bază de date privată.

## Adăugarea produselor

Pentru un model gata creat, adaugă imaginea în `public/assets/`, apoi o intrare în `public/config/models.json` și prețul aferent în `public/config/prices.json` la `models`. Pentru un produs de personalizat, adaugă imaginile față/spate în `public/assets/`, produsul în `public/config/products.json`, zona de print în `public/config/print-areas.json` și prețul de bază în `public/config/prices.json`. Folosește un ID unic și păstrează numele și descrierea în `ro` și `ru`. Publică modificările prin GitHub; Netlify va face un deploy nou.

| Fișier | Conținut |
| --- | --- |
| `public/config/products.json` | Produse de personalizat, mărimi, culori, imagini față/spate |
| `public/config/models.json` | Modele gata create și imagini |
| `public/config/prices.json` | Prețuri și reduceri de cantitate |
| `public/config/print-areas.json` | Zonele orientative de imprimare |
| `public/config/business.json` | Contact, program și livrare |
| `public/config/promotions.json` | Structură pentru promoții viitoare |
| `public/translations/` | Texte RO/RU |

Editorul salvează poziția, dimensiunea, rotația și partea fiecărui element. Previzualizarea și zona de print sunt orientative; nu produc automat un fișier pentru imprimare.

## Verificare locală fără Node.js

Servește directorul `public/` printr-un server static. De exemplu, dacă Python este instalat:

```powershell
python -m http.server 3100 --bind 127.0.0.1 --directory public
```

Deschide `http://localhost:3100/`. Catalogul, constructorul și coșul funcționează local. Trimiterea cererilor este blocată intenționat pe localhost, pentru a evita o confirmare falsă; testeaz-o după deploy pe Netlify. Un server static simplu poate răspunde cu 404 la reîncărcarea directă a `/constructor`; regulile de rutare din `netlify.toml` rezolvă acest lucru pe Netlify. Deschiderea `index.html` direct prin `file://` nu este suportată de modulele JavaScript și încărcarea JSON.

## Backendul Node opțional

Pentru panoul Printio complet, pornește `server.mjs` cu Node.js 24+. Acesta folosește aceleași fișiere din `public/config/`, dar stochează comenzile, produsele adăugate din admin și statisticile în SQLite. Backendul nu rulează pe Netlify în această configurare.

```powershell
node --env-file-if-exists=.env server.mjs
node --test tests/api.test.mjs
```

Serverul local este disponibil la `http://localhost:3000/`, iar adminul la `/admin`. La prima pornire, parola inițială este generată în `data/admin-access.txt`. Pentru schimbare, configurează `ADMIN_PASSWORD` în `.env` conform `.env.example`. Nu publica `data/`, `.env` sau fișierul cu parola; `netlify.toml` le exclude prin publicarea exclusivă a directorului `public/`.
