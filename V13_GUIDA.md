# LEGO MOC HUB V13 — Community (Preview)

## Cosa cambia
- Registrazione pubblica email/password per nuovi membri (`role=member`), senza codice di attivazione.
- Accesso alla galleria di progetti pubblici anche senza login.
- Ogni progetto nuovo è pubblico automaticamente, senza possibilità per il membro di cambiarlo.
- L'account originario `role=owner` può cambiare **Pubblico / Privato** per ogni progetto, incluso quello caricato da un amico.
- Un membro può modificare solo i propri progetti, caricare solo nelle proprie versioni e vedere dal cloud le proprie schede più la galleria pubblica.
- File Blob conservati come **private objects**: il backend permette il download solo per progetti pubblici, proprietari e amministratore.
- Il viewer LDraw hotfix precedente è incluso, ma richiede un test visivo nel browser.

## Database
La migrazione SQL `migrations/001_public_projects.sql` è **già stata applicata** a Turso `lego-moc-hub` durante la preparazione V13. NON eseguirla nuovamente. Le due schede esistenti (Kurumi, Partenone) risultano pubbliche (`is_public = 1`). Le tabelle utenti e file non sono state alterate.

## Deployment
Sviluppare e verificare solo su `develop` / Vercel Preview. Nessuna modifica al branch `main` o al dominio di produzione finché i test manuali non sono terminati.

## Test browser da eseguire
1. Visitare senza login: si devono vedere nella galleria Kurumi e Partenone.
2. Accedere come amministratore: accanto a ogni progetto apparirà il flag **Pubblico**.
3. Impostare Kurumi privato: dal browser in incognito non deve più comparire; il vecchio ID del suo file deve restituire 404.
4. Riportare Kurumi pubblico: deve ricomparire.
5. Registrarsi da un altro browser con un'altra email: ruolo membro, dashboard personale vuota, ma galleria visibile.
6. Caricare un piccolo `.ldr` col nuovo account: compare automaticamente nella galleria per tutti.
7. Verificare che il membro non veda alcun controllo sulla privacy e che il backend rifiuti PATCH.
8. Verificare il caricamento delle geometrie LDraw e le istruzioni di Kurumi.

## Sicurezza / limiti
La registrazione è protetta da un throttling elementare (massimo 4 tentativi per IP/ora). **Non è ancora implementata la verifica dell'email né il reset password**, quindi è adatta per una community ristretta e per i test, non per un lancio pubblico su larga scala senza ulteriori difese anti-spam. Non distribuire credenziali di amministrazione.
