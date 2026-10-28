# Académie UNIS Togo

Plateforme de formation en ligne de l'UNIS : comptes sécurisés, progression enregistrée, quiz corrigés côté serveur et attestations vérifiables. Hébergement gratuit : site sur GitHub Pages, comptes et données sur Supabase.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | Le site. À ne modifier que pour changer le fonctionnement ou l'apparence. |
| `content.json` | **Les textes des modules.** C'est le fichier à modifier pour les mises à jour. |
| `config.js` | L'adresse du projet Supabase et sa clé publique. |
| `supabase/schema.sql` | La base de données, ses règles de sécurité et les bonnes réponses. |

## Mise en ligne (environ 30 minutes, une seule fois)

### 1. Créer la base sur Supabase

1. Créez un compte gratuit sur supabase.com, puis un nouveau projet. Notez le mot de passe de la base dans un endroit sûr. Choisissez la région disponible la plus proche.
2. Ouvrez **SQL Editor**, collez tout le contenu de `supabase/schema.sql` et cliquez sur **Run**.
3. Dans **Authentication > Sign In / Providers** (le nom du menu peut varier) :
   - laissez **Email** activé ;
   - activez **Confirm email** ;
   - fixez la longueur minimale du mot de passe à **10**.
4. Dans **Authentication > URL Configuration** :
   - **Site URL** : l'adresse de votre site, par exemple `https://votre-compte.github.io/academie-unis/` ;
   - ajoutez la même adresse dans **Redirect URLs**.
   Vous connaîtrez cette adresse à l'étape 2 ; revenez la compléter si besoin.
5. Dans **Project Settings > API**, copiez la **Project URL** et la clé publique (**anon** ou **publishable**). Ne copiez jamais la clé **service_role** ou **secret**.

### 2. Publier le site sur GitHub Pages

1. Ouvrez `config.js` et remplacez les deux valeurs par celles copiées à l'étape 1.5.
2. Sur github.com, créez un dépôt (par exemple `academie-unis`). Sur un compte gratuit, GitHub Pages exige un dépôt **public** : c'est sans risque, car aucun fichier du site ne contient de secret ni de bonne réponse.
3. Cliquez sur **Add file > Upload files** et déposez tous les fichiers du dossier (y compris le dossier `supabase`). Validez avec **Commit changes**.
4. Dans **Settings > Pages**, choisissez **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
5. Après une à deux minutes, l'adresse du site s'affiche en haut de cette page. Reportez-la dans Supabase (étape 1.4).

### 3. Devenir administrateur

1. Ouvrez le site et créez votre propre compte via l'onglet **Inscription**. Confirmez votre email.
2. Dans Supabase > **SQL Editor**, exécutez (avec votre email) :
   ```sql
   update public.profiles set role = 'admin', approved = true
    where email = 'votre.email@exemple.tg';
   ```
3. Reconnectez-vous : le bouton **Administration** apparaît. Vous pouvez désormais valider les comptes et nommer d'autres administrateurs depuis le site.

### 4. Avant d'ouvrir à de nombreux apprenants : l'envoi des emails

Le service d'email intégré à Supabase est fait pour les tests et n'envoie que quelques messages par heure. Avant d'inscrire un groupe, configurez un serveur d'envoi dans **Authentication > Emails > SMTP Settings** : le serveur de messagerie du ministère, ou un service comme Brevo, qui propose une offre gratuite. Vous pouvez aussi traduire les modèles d'emails en français dans **Authentication > Emails > Templates**.

## Fonctionnement des comptes

1. L'apprenant s'inscrit (nom, structure, fonction, email, mot de passe) et confirme son email.
2. Son compte reste **en attente** : il ne peut rien valider tant qu'un administrateur ne l'a pas approuvé.
3. L'administrateur le valide depuis **Administration**. Il peut aussi suspendre un compte, nommer ou retirer un administrateur, rechercher un apprenant et exporter la liste en CSV (ouvrable dans Excel).
4. Mot de passe oublié : l'apprenant reçoit un lien de réinitialisation par email.

Pour corriger le nom d'un apprenant (il figure sur les attestations), modifiez-le dans Supabase > **Table Editor > profiles** avant qu'il ne génère son attestation.

## Mettre à jour les contenus

### Modifier un texte

1. Sur GitHub, ouvrez `content.json`, cliquez sur le crayon, modifiez, puis **Commit changes**.
2. Le site est à jour en une à deux minutes.

Attention aux guillemets et aux virgules : une erreur de syntaxe rend les modules indisponibles (le site affiche alors un message). Avant d'enregistrer, vous pouvez coller le contenu dans jsonlint.com pour le vérifier. En cas d'erreur, l'onglet **History** du fichier permet de revenir à la version précédente.

### Modifier une question ou ajouter un module

Les bonnes réponses ne sont pas dans `content.json` (sinon n'importe qui pourrait les lire). Elles sont dans la table **answer_keys** de Supabase (**Table Editor**) :

| Colonne | Valeur |
|---|---|
| `module_id` | Le code du module, par exemple `TC3` |
| `kind` | `seq` pour une question de séquence, `quiz` pour une question du quiz |
| `idx` | Le numéro de la question **en partant de 0** (séquences : 0 à 4 ; quiz : 0, 1, 2, 3…) |
| `answer` | La position de la bonne option **en partant de 0** (première option = 0) |

Si vous changez l'ordre des options d'une question dans `content.json`, mettez à jour `answer` en conséquence. Pour un nouveau module : ajoutez-le dans `content.json` (même structure que TC1, cinq séquences), puis ajoutez ses 5 lignes `seq` et ses lignes `quiz` dans answer_keys. Les modules marqués « en préparation » (TC3, TC4, AN2, AN3) n'attendent que cela.

Le seuil de réussite du quiz est de trois quarts des questions (3 sur 4).

## Sécurité : ce qui est en place

- Le site n'écrit **jamais** directement dans la base. Chaque étape passe par une fonction serveur qui vérifie que la personne est connectée, que son compte est validé, que l'étape précédente est faite et que la réponse est juste.
- Les bonnes réponses ne sont jamais envoyées au navigateur. Le quiz indique seulement quelles questions sont à revoir.
- Chaque apprenant ne voit que ses propres données ; seuls les administrateurs voient l'ensemble.
- Un apprenant ne peut ni valider son propre compte ni se donner des droits d'administration.
- Les attestations portent un code unique vérifiable publiquement (lien `?verifier=CODE`), sans connexion, qui n'affiche que le nom, le module et la date.
- Mots de passe gérés par Supabase (jamais stockés en clair), confirmation de l'email obligatoire, politique de sécurité du contenu (CSP) qui limite les scripts autorisés.

Recommandations complémentaires : activer l'authentification à deux facteurs sur les comptes GitHub et Supabase des administrateurs ; si des inscriptions indésirables apparaissent, activer la protection CAPTCHA dans **Authentication > Attack Protection**.

## Limites de l'offre gratuite

Les offres gratuites suffisent pour un pilote de plusieurs centaines d'apprenants. Points à connaître : un projet Supabase gratuit resté inactif plusieurs jours peut être mis en pause (il se relance depuis le tableau de bord) et l'offre gratuite n'inclut pas de sauvegardes automatiques. Pour une mise en production durable, prévoyez l'offre payante de Supabase ou un hébergement institutionnel. Vérifiez aussi avec le ministère le lieu d'hébergement acceptable pour les données personnelles des agents.
