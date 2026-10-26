## V11 — Cloud privato (22 ottobre 2026)

- Accesso indipendente da Vercel tramite email e password.
- Attivazione iniziale limitata a un solo proprietario e codice one-time.
- Sessioni persistenti protette, blocco tentativi ripetuti, controlli CSRF.
- Database Turso: progetti, versioni, inventari e passaggi; utenti e sessioni.
- Vercel Blob privato per allegati; download solo dopo login.
- Sincronizzazione dal catalogo locale e ripristino sul nuovo dispositivo.
- Versionamento sorgente e test di sicurezza di base.

Nessun file locale viene cancellato dopo la sincronizzazione.

## V12-preview (2026-10-26)
- Motore 3D LDraw reale per pezzi speciali, mantenendo il motore esistente per quelli comuni.
- Download su richiesta della libreria LDraw mediante jsDelivr; le geometrie sono quelle ufficiali, senza approssimazioni a cubi.
- Viewer, selezione e step di costruzione supportati dal renderer dinamico.
- Verifiche automatiche di inventario e roundtrip delle 443 pose di Kurumi.
- Da verificare in Preview: caricamento completo da CDN, prestazioni, selezione su Kurumi e altri dispositivi.
