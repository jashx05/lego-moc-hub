# LEGO MOC HUB — sorgenti V11 per GitHub

Repository destinazione: https://github.com/jashx05/lego-moc-hub

## Contenuto
- `public/`: frontend, viewer LDraw, cloud UI.
- `api/`: backend Vercel Functions (auth, projects, versions, upload, files, status).
- `tests/`: test Node.
- `vercel.json`, `package.json`, `release.json`: configurazione e versione.

## Primo caricamento da Windows / VS Code

1. Estrai lo ZIP in una cartella temporanea.
2. In VS Code apri il terminale PowerShell.
3. Clona la repository vuota: `git clone https://github.com/jashx05/lego-moc-hub.git`
4. Copia i **contenuti** della cartella estratta dentro `lego-moc-hub` (non creare una sottocartella `lego-moc-hub` annidata). Includi `.gitignore` e `.env.example`.
5. Nella cartella repository esegui `npm test`, poi `git add .`, `git commit -m "Import LEGO MOC HUB V11 fullstack"`, `git push origin main`.

## Importante
- NON caricare file `.env` reali, token Turso/Blob, password o il codice di setup privato. `.gitignore` li esclude, ma controlla `git status` prima del commit.
- Il repository e' pubblico: tutto il contenuto committato sara' leggibile da chiunque.
- Il push su GitHub NON deve sostituire il sito di produzione prima dei test. Non collegare il repository al progetto Vercel di produzione finché non avremo verificato una Preview V11.
- La cartella `public/` e `api/` devono stare entrambe alla radice della repository.
- Per la prima attivazione servira' `MOC_HUB_SETUP_KEY` configurata come variabile server privata su Vercel; non inserirla nel repository.
- `deploy_windows.ps1` e' uno script legacy per deploy CLI: **non lanciarlo** durante la migrazione GitHub.

## Verifica
`npm test` deve eseguire i test del codice V11. Per test end-to-end di auth, sync e Blob e' necessaria una Preview Vercel collegata ai servizi di test/produzione in modo controllato.
