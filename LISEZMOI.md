# Chef Claude – déploiement sur Vercel

## Contenu
- `index.html` : l'appli
- `api/chat.js` : fonction serveur qui appelle Claude (la clé API reste ici, jamais dans la page)
- `package.json`

## Étapes
1. **Clé API** : créez un compte sur console.anthropic.com, ajoutez un moyen de paiement (paiement à l'usage), puis créez une clé dans « API Keys ». Fixez une limite de dépense mensuelle (ex. 5 $) dans les réglages.
2. **GitHub** : créez un dépôt (github.com → New repository), puis envoyez-y tout le contenu de ce dossier (bouton « Add file → Upload files »).
3. **Vercel** : sur vercel.com, connectez-vous avec GitHub → « Add New… → Project » → choisissez le dépôt → ne changez aucun réglage de build.
4. **Variables d'environnement** (avant de cliquer sur Deploy, section « Environment Variables ») :
   - `ANTHROPIC_API_KEY` = votre clé
   - `APP_PASSWORD` = un code de votre choix (recommandé : sans lui, toute personne ayant le lien consomme votre crédit)
   - `MODEL` = optionnel (par défaut `claude-haiku-5-5`, rapide et économique ; `claude-sonnet-5-5` donne de meilleures réponses)
5. Cliquez sur **Deploy**. Vous obtenez une adresse `xxx.vercel.app`.
6. Au premier message, l'appli demande le code d'accès (retenu ensuite sur l'appareil).

## Sur téléphone
Ouvrez l'adresse, puis « Ajouter à l'écran d'accueil » dans le menu du navigateur.

## Si ça ne marche pas
- « Une erreur est survenue » : vérifiez `ANTHROPIC_API_KEY` et le crédit du compte, puis redéployez (Vercel → Deployments → Redeploy) après toute modification des variables.
- Le micro dépend du navigateur (Chrome/Safari ok en général).
