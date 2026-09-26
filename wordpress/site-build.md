# Printio pe WordPress.com

Site public: `https://printio1.wordpress.com/` (WordPress.com Simple, plan Free).

## Pagini și navigație

- Acasă (`/acasa-printio/`, ID 5) este prima pagină a site-ului.
- Produse (`/produse-printio/`, ID 6) prezintă catalogul și trimite la constructor.
- Русский (`/ru/`, ID 15) este pagina în rusă. Folosește șablonul dedicat `page-ru`, fără antetul și subsolul românesc.
- Navigația comună (ID 4) conține Acasă, Produse, Constructor și RU.
- Pagina demonstrativă About (ID 1) este în draft.

Aspectul urmează brandbookul Printio: `#211C19`, `#EFC48D`, `#F8F5F0`, font Inter, fotografii de produs, mesaj RO/RU și prețuri MDL. Imaginile sunt servite de storefrontul Printio.

## Constructor și prețuri

CTA-urile românești deschid `https://stunning-meerkat-2f9f38.netlify.app/constructor`; cele rusești adaugă `?lang=ru`. Constructorul permite design pe față și spate, text, imagine, mărime și cantitate. Estimarea include trepte configurabile de dificultate a designului, în plus față de produs, imprimare și cantitate.

Regulile sunt în `public/config/prices.json`. Formularul de la `/admin` exportă fișierul actualizat pentru redeploy pe găzduirea statică. În modul Node, salvarea adminului autentificat persistă regulile direct în SQLite.

Planul WordPress.com Free nu permite instalarea de pluginuri pe acest site (`simple_site_no_plugins`). WooCommerce și TShirt eCommerce cer un plan compatibil cu pluginuri sau un WordPress găzduit separat. Constructorul Printio funcționează separat și este legat din site-ul WordPress.
