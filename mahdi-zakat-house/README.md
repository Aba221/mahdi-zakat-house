# Mahdi Zakat House

Site de sensibilisation et de collecte de la Zakat pour la communauté Layenne.
Contenu basé sur la présentation *Mahdi Zakat House* et la note technique
*Renforcement du modèle communautaire Layenne*.

Stack : HTML/CSS/JS natif + Netlify Functions (serverless) + PayTech (paiement).
Pas de framework, pas de build — déploiement direct sur Netlify.

## Modèle produit — inspiré des meilleures plateformes de crowdfunding islamique

Le contenu (textes, chiffres, citations) provient exclusivement des deux documents
source. Ce qui a été ajouté est le **modèle produit**, aligné sur les pratiques des
plateformes de référence du secteur (LaunchGood, AmalQ, GlobalSadaqah/Ethis, BAZNAS,
Zakatify) :

- **Sélecteur de compartiment** au moment du don (Poche A/B/C/D) — le donateur choisit
  explicitement où va son argent, comme sur AmalQ.
- **Ticker de preuve sociale** (`/api/recent-donations`) — derniers dons anonymisés,
  à la manière de LaunchGood.
- **Don unique vs don mensuel** (rappel automatique) — inspiré de "Automate Ramadan
  Giving" (LaunchGood) et Zakatify. PayTech ne propose pas d'API d'abonnement/débit
  récurrent : l'option "mensuel" enregistre un rappel (SMS/email à implémenter) plutôt
  qu'un prélèvement automatique — c'est honnête vis-à-vis du donateur.
- **Chaîne de traçabilité visible** (Contributeur → ... → Audit) — directement reprise
  de la note technique, mais rendue visible au donateur comme le fait AmalQ
  ("traced from checkout through to delivery").
- **QR code de collecte physique** pour les événements communautaires — pratique
  généralisée par BAZNAS (Indonésie) pour la collecte en mosquée.

## 1. Déployer sur Netlify

1. Créez un dépôt Git (GitHub/GitLab) et poussez ce dossier tel quel.
2. Sur [app.netlify.com](https://app.netlify.com) : **Add new site → Import an existing project**, connectez le dépôt.
3. Build settings : laissez vide (aucune commande de build nécessaire). Publish directory : `.`
4. Déployez. Le site est en ligne sur `https://<nom-genere>.netlify.app`.

Vous pourrez ensuite y attacher un nom de domaine personnalisé (ex. `mahdizakathouse.sn` ou `.com`)
depuis **Site settings → Domain management**.

## 2. Configurer le paiement réel (PayTech)

Le site utilise [PayTech](https://paytech.sn) comme agrégateur de paiement : une seule intégration
couvre Wave, Orange Money, Free Money et les cartes bancaires (Visa/Mastercard) — les moyens
listés dans la présentation d'origine.

### Étape 1 — Créer un compte PayTech
- Inscrivez-vous sur https://paytech.sn
- Dans le Dashboard → **Paramètres → API**, récupérez votre `API_KEY` et `API_SECRET`.
- Par défaut votre compte est en mode **test** (montant débité aléatoire entre 100 et 150 FCFA,
  quel que soit le montant réel — utile pour valider le parcours sans risque).
- Pour passer en **production** (montant réel débité), envoyez à `contact@paytech.sn` :
  NINEA, pièce d'identité, registre de commerce, justificatif de domicile, etc.
  (voir la [documentation officielle](https://docs.intech.sn/doc_paytech.php) pour la liste complète).
  Le compte MZH étant une œuvre caritative, précisez-le dans votre demande — PayTech peut
  demander des justificatifs adaptés (statuts de l'association, autorisation religieuse/communautaire, etc.).

### Étape 2 — Variables d'environnement sur Netlify
Dans **Site settings → Environment variables**, ajoutez :

| Variable | Valeur |
|---|---|
| `PAYTECH_API_KEY` | votre clé API PayTech |
| `PAYTECH_API_SECRET` | votre clé secrète PayTech |
| `PAYTECH_ENV` | `test` puis `prod` une fois le compte validé |
| `SITE_URL` | l'URL finale du site, ex. `https://mahdizakathouse.sn` (sans slash final) |

Redéployez le site après avoir ajouté ces variables (**Deploys → Trigger deploy**).

### Étape 3 — Activer Netlify Blobs (stockage des dons)
Netlify Blobs est activé automatiquement sur tous les sites Netlify, aucune configuration
supplémentaire n'est nécessaire — les dons initiés et confirmés sont stockés dans le store
`donations` (visible depuis l'onglet **Blobs** du site dans le dashboard Netlify, ou via l'API
Netlify Blobs si vous construisez un tableau de bord d'administration plus tard).

### Comment ça marche
1. Le visiteur choisit un montant + un moyen de paiement sur `/#don`.
2. Le frontend appelle `/api/initiate-payment` (→ `netlify/functions/initiate-payment.js`).
3. La fonction appelle l'API PayTech (`POST /payment/request-payment`) et récupère une URL de
   paiement hébergée par PayTech.
4. Le donateur est redirigé, paie avec son moyen préféré, puis revient sur `/merci.html`
   (succès) ou `/don-annule.html` (annulation).
5. En parallèle, PayTech notifie `/api/payment-ipn` (→ `netlify/functions/payment-ipn.js`) de
   façon asynchrone et sécurisée (signature HMAC vérifiée) pour confirmer que le paiement est
   réellement passé — c'est cette notification, pas la redirection, qui fait foi.

## 3. Prochaines étapes suggérées

- **Nom de domaine** : rechercher et réserver `mahdizakathouse.sn` (registre NIC Sénégal) et/ou
  `.com`/`.org` en parallèle, puis les attacher au site Netlify.
- **Tableau de bord admin** : une page protégée listant les dons (Netlify Blobs) pour la cellule
  Contrôle & données décrite dans la note technique.
- **Virement bancaire** : PayTech ne couvre pas le virement direct — à traiter séparément
  (RIB affiché + confirmation manuelle) si vous voulez l'activer.
- **Validation religieuse/juridique** : comme le souligne la note technique, la mise en production
  réelle du paiement doit être précédée d'une validation formelle des autorités religieuses de la
  communauté sur l'usage des fonds collectés.

## 4. Développement local

```bash
npm install -g netlify-cli
netlify dev
```

Créez un fichier `.env` (non versionné) avec les mêmes variables que ci-dessus pour tester
les fonctions en local.
