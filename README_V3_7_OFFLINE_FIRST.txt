DL TECHNIK PWA V3.7 — Offline-first

- démarrage cache-first après une première synchronisation ;
- dashboard, listes, référentiel et interventions déjà consultées disponibles hors ligne ;
- brouillons, horaires et checklist conservés localement ;
- photos compressées stockées localement si pas de réseau ;
- indicateur HORS LIGNE / éléments à synchroniser ;
- retour du réseau : envoi automatique des rapports et photos ;
- si l'application est fermée, synchronisation au prochain lancement ;
- photos déjà consultées mises en cache par le Service Worker.

Limites :
- première connexion nécessite du réseau ;
- une intervention doit avoir été synchronisée/consultée au moins une fois pour être garantie hors ligne ;
- la création d'une toute nouvelle intervention reste en ligne dans cette version.

Aucun SQL.
Conserver l'Edge Function V3.6 multi-techniciens.
