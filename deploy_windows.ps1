# LEGO MOC Hub V11 — deployment guidato (Windows PowerShell)
# Usa il tuo account Vercel soltanto per pubblicare il codice.
# I visitatori accedono al sito con email e password, non con Vercel.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js e npm non trovati. Installa Node.js LTS prima di procedere.'
}
if (!(Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host 'Installazione Vercel CLI...'
  npm install -g vercel
}
Write-Host 'Autenticazione Vercel, richiesta solo allo sviluppatore del sito...'
vercel login
if ($LASTEXITCODE -ne 0) { throw 'Login Vercel non riuscito.' }
Write-Host 'Collegamento al progetto lego-moc-hub esistente...'
vercel link --yes --project lego-moc-hub --scope jash-de70
if ($LASTEXITCODE -ne 0) { throw 'Collegamento al progetto fallito. Verifica lo scope in Vercel.' }
Write-Host 'Pubblico SOLO una Preview per verificare l’accesso e la sincronizzazione.'
vercel deploy --yes
if ($LASTEXITCODE -ne 0) { throw 'Deployment non riuscito. Controlla i log Vercel.' }
Write-Host 'Preview creata. Verifica /api/status e Account e sincronizzazione.'
Write-Host 'Non usare --prod prima di aver effettuato un backup locale e testato la preview.'
