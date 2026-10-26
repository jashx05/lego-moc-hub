# LEGO MOC Hub V11 — Cloud privato

## Struttura
- `public/index.html`, `public/engine.js`: UI e motore 3D LDraw, preservati dalla V10.
- `public/cloud.js`: accesso email/password, sync cloud, ripristino locali.
- `api/auth.js`: attivazione **solo del primo account** tramite codice una tantum, login/logout, sessioni HttpOnly.
- `api/projects.js`: elenco e inserimento protetti per proprietario.
- `api/versions.js`: versioni, distinta parti e contatori step.
- `api/upload.js`, `api/files.js`: file Blob privati con verifica proprietà.
- `api/status.js`: salute dei servizi senza divulgare credenziali.

## Variabili Vercel (solo server)
- `TURSO_DATABASE_URL` — già configurata.
- `TURSO_AUTH_TOKEN` — già configurata.
- `BLOB_READ_WRITE_TOKEN` — già collegata tramite Blob privato.
- `MOC_HUB_SETUP_KEY` — codice iniziale forte, necessario solo finché non esiste un proprietario.

## Autenticazione
- Non richiede account Vercel agli utenti.
- Registrazione pubblica disabilitata: soltanto **il primo proprietario** può creare un account col codice di attivazione.
- Password con scrypt + salt, sessioni casuali memorizzate come SHA-256 nel database, cookie `HttpOnly; Secure; SameSite=Lax`.
- Le richieste mutative richiedono header `X-MOC-Request: 1` e controllo Origin per CSRF.
- Tentativi di login bloccati temporaneamente dopo 5 errori.
- **Non c'è ancora recupero password via email**: usare un password manager.

## Limiti intenzionali
- Sync del file <= 4 MiB (limite richieste Vercel Functions 4.5 MiB); file superiori restano in IndexedDB; il sito comunica chiaramente la sincronizzazione incompleta.
- Cloud versioning v1: stesso progetto locale mantiene UUID e prima versione; aggiungere revisione richiederà gestione delle nuove versioni. Le versioni server e il catalogo sono strutturalmente predisposti.
- Prima di sincronizzare, scaricare sempre un backup ZIP del catalogo locale.
- Conservazione locale non rimossa. Cloud sync non elimina né modifica il modello originale.
- L'interfaccia è multi-device dopo login, ma in Beta: testare accesso/upload/download prima della promozione Production.

## Deployment
Il pacchetto può essere pubblicato su Vercel con sorgenti in root (`api/`, `public/`, `package.json`, `vercel.json`). Non aggiungere il codice di attivazione né token al repository Git. Node >= 20. 

## Sicurezza operativa
Dopo che il proprietario ha creato l'account, eliminare `MOC_HUB_SETUP_KEY` dagli ambienti Vercel (la registrazione iniziale rimarrà disabilitata grazie alla presenza di un utente). Limitare l'accesso ai database e non condividere credenziali in chat.

## Pubblicazione su Windows
Estrarre lo ZIP, aprire PowerShell nella cartella contenente `package.json` ed eseguire:
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy_windows.ps1
```
Una sola volta, prima di registrarsi, creare nelle impostazioni Vercel una variabile **Sensitive** chiamata `MOC_HUB_SETUP_KEY`, con un valore casuale di almeno 32 caratteri, in Preview e Production. Per generarla senza condividerla:
```powershell
py -c "import secrets; print(secrets.token_urlsafe(32))"
```
Conservare il codice in un password manager, poi nella pagina `Account e sincronizzazione` creare il primo account. Dopo il primo accesso, eliminare la variabile di setup e ripubblicare per rimuovere il segreto dall'ambiente di esecuzione.
