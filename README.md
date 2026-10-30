# Mariage — invitations QR

1. Supabase > SQL Editor : colle `supabase.sql` > Run
2. Supabase > Project Settings > API : copie l'URL et la clé `anon`
3. Vercel > New Project > importe ce dossier, ajoute les variables :
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Ouvre /admin — mot de passe : mariage2026 (change-le dans Paramètres)

Local : `npm install` puis `npm run dev` (avec un fichier .env.local)
