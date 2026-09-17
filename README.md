# NOREST STUDIO

Strona studia wizualizacji architektonicznych (Kraków). Next.js 16 (App Router),
TypeScript, Tailwind 4.

**Na żywo:** https://jakubskrzypiec.github.io/noreststudio/

## Deploy

Każdy push na `main` uruchamia `.github/workflows/deploy.yml`: statyczny eksport
(`output: "export"`) i publikacja na GitHub Pages.

Strona stoi pod `/noreststudio`, nie pod korzeniem domeny, więc build dostaje
`NEXT_PUBLIC_BASE_PATH=/noreststudio`. Next dokleja ten prefiks tylko do własnych
zasobów i do `<Link>` — zwykłe `<img>`, `<video>` i maski CSS przechodzą przez
helper `asset()` z `src/lib/assets.ts`. Przy przenosinach na własną domenę
wystarczy wyczyścić obie zmienne w workflow; kod zostaje bez zmian.

`public/media` (236 MB) **jest** w repo — Pages nie ma skąd wziąć plików inaczej.

## Szybki start

```bash
npm install
npm run media     # konwersja surowych renderów -> public/media (wymaga ffmpeg)
npm run dev
```

## Struktura

```
data/projects.json   opis projektów: nazwa, slug, klient, data, lista plików źródłowych
data/media.json      wynik konwersji: ścieżki, wymiary, placeholdery (generowany)
scripts/             narzędzia jednorazowe i pipeline mediów
src/lib/site.ts      dane firmy i teksty interfejsu
src/lib/media.ts     jedyny punkt dostępu do zdjęć i filmów
src/components/      Header, Logo, HomeHero, HorizontalRail, ProjectImage
src/app/             /  /work  /work/[slug]  /projects  /contact
```

## Materiały źródłowe

Foldery `PROJECTS/`, `HOME/`, `IKONKI/`, `CZCIONKI/`, `SLIDER PROJECTS/` oraz plansza PDF
to surowe rendery od klienta — **są poza repo** (`.gitignore`), bo ważą ~2,8 GB.
Trzymaj je lokalnie w katalogu projektu; `npm run media` czyta je stamtąd.

Konwersja jest przyrostowa: ponowne uruchomienie przerabia tylko brakujące pliki.
`npm run media -- --force` wymusza wszystko od nowa.

`scripts/make-logo.mjs` jest jednorazowy — robi z `IKONKI/` maski PNG w `public/logo/`,
których używa komponent `Logo` (kolor bierze z `currentColor`, więc to samo logo działa
na czarno na papierze i na biało na pełnoekranowym renderze).

## Ekrany

| Ścieżka        | Co to jest                                                        |
| -------------- | ----------------------------------------------------------------- |
| `/`            | HOME — pełnoekranowa animacja, twarde cięcie na kolejną co ~6 s    |
| `/work`        | galeria pod logo — poziomy pas kafli, przewijany kółkiem myszy     |
| `/work/[slug]` | pojedynczy projekt: siatka zdjęć i filmów, `NEXT PROJECT →`        |
| `/projects`    | tekstowa lista wszystkich projektów                                |
| `/contact`     | adres i kontakt                                                    |

Logo w nagłówku prowadzi do `/work` — tak jak opisuje to plansza klienta
(„po kliknięciu w logo”).

## Czego brakuje od klienta

- **Tekst „o nas”** do sekcji CONTACT. Ten z planszy to placeholder przepisany
  z australijskiego studia Third Aesthetic — nie da się go użyć. Do czasu
  dostarczenia treści sekcja się nie renderuje (`site.about` jest puste).
- **Zdjęcie zespołu w lepszej jakości.** To na CONTACT jest wyciągnięte z planszy PDF
  (`public/media/contact/team.jpg`) — ma tyle szczegółu, ile dało się z niej odzyskać.
  Jeśli klient ma oryginał, wystarczy podmienić plik.
- **Klient i data** dla każdego projektu — pola `client` i `date` w `data/projects.json`
  są puste; dopóki są puste, nie pojawiają się na stronie.
- **Licencja webowa Helvetica Neue.** Krój jest komercyjny i nie wolno go hostować
  bez licencji, więc na razie ładujemy Intera w lekkich odmianach. Na macOS i tak
  pierwszeństwo ma systemowa Helvetica Neue.
- **Kolejność projektów** w galerii — teraz alfabetyczna, po nazwach folderów.
