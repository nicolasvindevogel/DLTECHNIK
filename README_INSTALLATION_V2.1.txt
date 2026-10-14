DL TECHNIK PWA V2
=================

OBJECTIF
-------
Première vraie version terrain utilisable avec WAPILOT V10.28.

DESIGN
------
- interface pensée smartphone ;
- en-tête DL TECHNIK sombre ;
- navigation basse fixe ;
- gros boutons utilisables sur chantier ;
- affichage clair du statut, du lieu et de la priorité ;
- fonctionnement PWA iPhone / Android.

FONCTIONS V2
------------
1. Authentification
- choix du technicien ;
- PIN 6 chiffres ;
- connexion persistante sur l'appareil ;
- reset PIN depuis WAPILOT toujours compatible.

2. Accueil
- interventions à faire ;
- intervention en cours ;
- terminées ;
- accès rapide.

3. Mes interventions
- interventions créées/affectées depuis WAPILOT ;
- statut, copropriété/adresse, type, priorité ;
- ouverture de la fiche.

4. Nouvelle intervention
- création par le technicien si son profil l'autorise ;
- copropriété WAPILOT avec recherche ;
- ou autre lieu/adresse ;
- type d'intervention ;
- priorité ;
- objet et description.

5. Passage terrain
- bouton Démarrer ;
- chronomètre automatique ;
- plusieurs passages possibles sur une même intervention ;
- travail effectué ;
- matériel utilisé ;
- remarques ;
- correction manuelle éventuelle de la durée.

6. Photos
- photos AVANT ;
- photos APRÈS ;
- plusieurs photos ;
- compression automatique pour les téléphones ;
- bucket privé Supabase ;
- upload via URL signée ;
- suppression avant validation.

7. Nettoyage régulier
- checklist automatique basée sur le modèle existant :
  Hall, escaliers, paliers, ascenseur, vitres, garage, local poubelles, extérieurs, autre.
- si un modèle spécifique à la copropriété existe plus tard, il est prioritaire.

8. Envoi WAPILOT
- Terminer et envoyer le rapport ;
- passage -> submitted ;
- intervention -> report_received ;
- apparition immédiate dans le module WAPILOT DL TECHNIK ;
- WAPILOT peut ensuite corriger et valider le rapport.

9. Terminées
- rapports reçus ;
- rapports validés ;
- historique consultable.

DÉPLOIEMENT
-----------
Aucun nouveau SQL n'est nécessaire pour cette V2 si les SQL précédents ont été exécutés.

1. SUPABASE EDGE FUNCTION
Remplacer le code de la fonction existante :
dl-technik-auth

par le nouveau fichier :
supabase/functions/dl-technik-auth/index.ts

Conserver :
verify_jwt = false

2. GITHUB
Dans le dépôt GitHub actuel de la PWA DL TECHNIK :
- remplacer index.html
- remplacer manifest.webmanifest
- remplacer sw.js
- remplacer le dossier icons/

3. CLOUDFLARE
Aucune nouvelle configuration :
Cloudflare redéploiera le dépôt automatiquement.

TEST CONSEILLÉ AVEC NICOLAS TEST
--------------------------------
A. Dans WAPILOT :
- créer une intervention ;
- l'affecter à Nicolas TEST.

B. Dans la PWA :
- ouvrir Mes interventions ;
- ouvrir l'intervention ;
- Démarrer ;
- ajouter 1 ou 2 photos avant ;
- renseigner le travail effectué ;
- ajouter 1 ou 2 photos après ;
- Terminer et envoyer le rapport.

C. Dans WAPILOT :
- actualiser Interventions DL TECHNIK ;
- le statut doit être Rapport reçu ;
- le passage, le temps, les textes et les photos doivent apparaître ;
- valider ensuite le rapport.

NOTE
----
La PWA utilise toujours la même URL Supabase et la même Edge Function.
La SERVICE_ROLE n'est jamais présente dans le navigateur.
