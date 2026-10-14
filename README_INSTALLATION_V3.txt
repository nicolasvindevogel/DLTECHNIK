DL TECHNIK PWA V3
=================

MODIFICATIONS DEMANDÉES
-----------------------
- nouveau design visuel plus proche de WAPILOT ;
- intégration du logo DL TECHNIK fourni ;
- icône PWA générée à partir du logo DL TECHNIK ;
- saisie du PIN avec le clavier numérique natif du téléphone ;
- suppression complète du clavier PIN à l'écran ;
- suppression du chronomètre pour les rapports terrain ;
- temps passé saisi manuellement en heures + minutes ;
- pour une nouvelle intervention créée depuis la PWA :
  la fiche de rapport s'ouvre directement, sans bouton Démarrer ;
- pour une intervention attribuée par WAPILOT :
  bouton « Remplir le rapport » au lieu de « Démarrer » ;
- photos avant / après ;
- travail effectué ;
- matériel utilisé ;
- checklist nettoyage ;
- remarques ;
- envoi du rapport à WAPILOT.

DÉPLOIEMENT
-----------
1. Supabase :
Remplacer le code de l'Edge Function existante `dl-technik-auth`
par le fichier du package V3.
Conserver verify_jwt = false.

2. GitHub :
Remplacer :
- index.html
- manifest.webmanifest
- sw.js
- icons/
Ajouter :
- assets/dl-technik-logo.png

3. Cloudflare :
le déploiement GitHub reprend automatiquement ces fichiers.

Aucun SQL supplémentaire.
