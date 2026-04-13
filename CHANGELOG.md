# Changelog

Toutes les modifications notables apportées à ce projet seront documentées dans ce fichier.

## [1.1.0] - 2026-04-13

### Ajouts
- **Streaming des réponses** : Le résumé s'affiche désormais en temps réel au fur et à mesure de sa génération.
- **Historique des résumés** : Bouton "Historique" permettant de consulter, copier ou supprimer les anciens résumés.
- **Cache local** : Les résumés sont enregistrés localement (clé basée sur le hash SHA-256 du texte). Les résumés identiques se chargent instantanément et sans appel API supplémentaire.
- **Permission `storage`** : Ajoutée au manifest pour permettre la persistance des données.

### Améliorations
- Meilleure gestion des erreurs lors des appels API.
- Retours visuels améliorés dans le popup ("Génération en cours...", "Récupéré du cache ✅").

---

## [1.0.0] - 2026-04-13

### Version Initiale
- Lecture de la sélection de texte dans l'onglet actif.
- Envoi à Mistral AI pour un résumé en un paragraphe.
- Affichage dans un popup avec bouton de copie.
- Configuration via `config.js`.
