# Académie UNIS Togo

Plateforme de formation en ligne de l'UNIS : comptes sécurisés, progression enregistrée, quiz corrigés côté serveur et attestations vérifiables. Hébergement gratuit : site sur GitHub Pages, comptes et données sur Supabase.

## Les parcours de formation (version 2)

La plateforme propose **66 modules** : un tronc commun pour tous et un parcours de six modules pour chacun des dix postes de l'UNIS (fiches de poste de novembre 2026).

| Parcours | Modules | Public |
|---|---|---|
| Tronc commun | TC1 à TC6 | Tous les membres de l'UNIS |
| Chargé de Pilotage & d'Évaluation des Projets | PE1 à PE6 | Rattaché au Responsable de l'Unité |
| Chargé de Formation & Adoption | FA1 à FA6 | Pôle Opérations & Adoption |
| Chargé des opérations du Hub | OP1 à OP6 | Pôle Opérations & Adoption |
| Chargé IT & support utilisateurs | IT1 à IT6 | Pôle Opérations & Adoption |
| Ingénieur plateforme | PF1 à PF6 | Pôle Données & Plateforme |
| Ingénieur de données | DE1 à DE6 | Pôle Données & Plateforme |
| Data Scientist | DS1 à DS6 | Pôle Données & Plateforme |
| Analyste de données | AN1 à AN6 | Pôle Données & Plateforme |
| Épidémiologiste | EP1 à EP6 | Pôle Données & Plateforme |
| Biostatisticien | BS1 à BS6 | Pôle Données & Plateforme |

Chaque nouveau module dure environ 6 heures et progresse du niveau fondamental au niveau expert. Le sixième module de chaque parcours est un projet intégrateur sur un cas d'usage réel de l'UNIS. Chaque module comprend :

- ses objectifs et son lien avec la vision UNIS / HOS (CSU, autonomie de l'équipe nationale avec l'appui de SAND Technologies) ;
- cinq séquences, chacune avec un cours détaillé, les points à retenir, une étude de cas située au Togo (données fictives), un exercice pratique sur le poste et une question de validation ;
- un quiz final de 8 questions (6 bonnes réponses exigées) et une attestation vérifiable.

**Choix du parcours.** À l'inscription, l'agent indique son poste à l'UNIS. Il voit alors le tronc commun et son parcours métier ; les autres parcours restent consultables. Il peut changer de poste depuis la barre latérale. Ordre de déblocage : les modules d'un même parcours se suivent ; le premier module d'un parcours métier s'ouvre dès l'attestation TC1. Les administrateurs ont accès à tout.

**Points à faire relire par les experts de l'UNIS avant ouverture.** Les chiffres nationaux cités (mortalité maternelle d'environ 399 pour 100 000 en 2021, mortalité néonatale de 27 à 29 pour 1 000) sont présentés comme des ordres de grandeur à confirmer. Les cas pratiques utilisent des données fictives. L'architecture réelle de HOS n'est pas décrite : les modules techniques présentent une architecture type, à comparer à la documentation officielle du programme. Les références bibliographiques sont réelles mais doivent être vérifiées (éditions, liens).

### Mettre à jour une plateforme déjà installée

1. Remplacez sur GitHub les fichiers `app.js`, `styles.css`, `content.json` et `supabase/schema.sql`.
2. Dans Supabase > **SQL Editor**, exécutez à nouveau **tout** `supabase/schema.sql`. Le script peut être relancé sans risque : il ajoute la colonne `parcours`, la fonction `set_my_parcours` et les bonnes réponses des nouveaux modules, sans toucher aux comptes ni aux progressions.
3. Les agents déjà inscrits choisissent leur poste dans la barre latérale à leur prochaine connexion.

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

Si vous changez l'ordre des options d'une question dans `content.json`, mettez à jour `answer` en conséquence. Pour un nouveau module : ajoutez-le dans `content.json` (même structure que les autres, exactement cinq séquences, et `track` égal au code du parcours), puis ajoutez ses 5 lignes `seq` et ses lignes `quiz` dans answer_keys. Les champs `level`, `vision`, `objectives`, `resources` (module) et `keypoints`, `case`, `practice` (séquence) sont facultatifs : la plateforme les affiche s'ils sont présents. Un nouveau parcours s'ajoute dans la liste `tracks` en tête de `content.json` ; ajoutez aussi son code dans les deux listes de codes autorisés de `schema.sql` (`handle_new_user` et `set_my_parcours`).

Le seuil de réussite du quiz est de trois quarts des questions (3 sur 4, 6 sur 8).

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
