# Boligappen

Husstandsapp til tre roomies: humør, energi, noter, aktivitetsforslag og idéer til appen. Data synkroniseres med en husstandskode. Ingen telefon er server.

Denne mappe er hjemmesiden, som også vises i Android-appen.

## Ret appen i browseren

1. Åbn filen, du vil ændre, på GitHub, fx [index.html](index.html), [app.js](app.js), [style.css](style.css) eller [logic.js](logic.js).
2. Tryk på blyanten (**Edit**) øverst i filen.
3. Ret det, du vil, og tryk **Commit changes** (gem).
4. Efter ca. et minut er ændringen live på hjemmesiden. Åbn appen igen (eller træk ned for at opdatere) for at se den.

Hjemmeside (når GitHub Pages er slået til): https://smokeydk6.github.io/boligappen/

## Slå GitHub Pages til (første gang)

1. Gå til **https://github.com/Smokeydk6/boligappen/settings/pages**
2. Under **Build and deployment** → **Source** skal du vælge **Deploy from a branch**.
3. Vælg branch **main** og mappen **/ (root)**.
4. Tryk **Save**.

Derefter er siden klar på adressen ovenfor. Indtil det er slået til, viser appen en indbygget kopi.

## Nyt i version 1.4

- **Notifikationer** (kan slås til under Indstillinger – kræver Android-appen v1.4).
- **Egne humør** med navn og emoji, som deles med hele husstanden.

Ændrede filer: `app.js`, `logic.js`, `style.css` (`index.html` og `mascot.svg` er uændrede).

## Nyt i version 1.5 (kun hjemmesiden – ingen ny APK)

- **Ingen genopfrisk hvert 5. sekund.** Appen henter nyt, når den åbnes, når man kommer tilbage til den, lige efter man har gemt noget og stille i baggrunden én gang i minuttet.
- Nye data tegnes **aldrig**, mens et vindue (fx *Alle humør*) er åbent, mens man skriver eller lige har rørt skærmen. I stedet vises pillen **"Nye opdateringer – tryk"** øverst.
- Tryk på synk-pillen øverst for at hente nyt med det samme.
- **＋ Nyt humør** står nu først i *Alle humør*, og det humør, man har valgt, vises altid i gitteret på *I dag*.
- Når man gemmer, hentes og flettes de andres ændringer først, så ingen ændringer går tabt.

Ændrede filer: `app.js`, `style.css` (`logic.js` er uændret siden 1.4, men upload alle filer for en sikkerheds skyld).
