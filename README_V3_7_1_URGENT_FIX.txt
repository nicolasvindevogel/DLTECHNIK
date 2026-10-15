DL TECHNIK PWA V3.7.1 — Correctif urgent rapport bloqué

Correction :
- un brouillon appartient désormais au technicien connecté si technician_id correspond,
  même si le champ can_edit est absent d'une réponse/cache ;
- compatibilité avec session renvoyant technician_id OU id ;
- purge du cache job_detail juste après création/préparation d'un rapport ;
- conservation de l'offline-first V3.7 ;
- conservation du multi-techniciens : un vrai brouillon commencé par un autre technicien reste verrouillé.

Aucun SQL.
Pas besoin de modifier l'Edge Function si la V3.6 multi-techniciens est déjà déployée.
