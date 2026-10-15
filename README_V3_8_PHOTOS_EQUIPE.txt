DL TECHNIK PWA V3.8 — Photos arrière-plan + ajout de techniciens

PHOTOS
- la photo est d'abord enregistrée localement sur le téléphone ;
- elle apparaît immédiatement dans le rapport ;
- le technicien peut continuer à compléter son rapport sans attendre ;
- compression et envoi Supabase se font en arrière-plan ;
- plusieurs photos prises avec la caméra sont mises en file sans écran bloquant ;
- même comportement pour une sélection multiple depuis la galerie ;
- réseau faible ou absent : les photos restent sécurisées localement et repartent plus tard.

ÉQUIPE
- bouton « Ajouter un technicien » dans une intervention existante ;
- choix d'un ou plusieurs collègues actifs ;
- ils voient ensuite l'intervention dans leur PWA ;
- aucun retrait depuis la PWA pour éviter une désaffectation accidentelle ;
- la gestion complète de l'équipe reste disponible dans WAPILOT ;
- un seul rapport commun reste autorisé.

Déploiement
1. remplacer l'Edge Function dl-technik-auth par V3.8 ;
2. remplacer les fichiers GitHub de la PWA par V3.8 ;
3. aucun SQL supplémentaire si technik_job_assignees existe déjà.
