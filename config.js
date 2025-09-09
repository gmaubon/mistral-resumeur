/**
 * FICHIER DE CONFIG – USAGE PERSO (clé visible côté client)
 * ---------------------------------------------------------
 * Copie ce fichier en "config.js", ajoute ta clé Mistral et adapte si besoin.
 * popup.html charge "config.js" avant "popup.js".
 */

window.MISTRAL_CONFIG = {
    /**
     * Clé API Mistral – "Authorization: Bearer <KEY>"
     * Obtenir une clé : voir README > "Obtenir une clé API Mistral"
     */
    API_KEY: "GBxZxEdnonf8tuG3lyfPzd84OFkXoMfA",

    /**
     * Modèle conseillé pour un bon ratio qualité/vitesse/coût.
     * Exemples possibles (vérifier la doc Mistral) :
     *  - "mistral-small-3.1"
     *  - "mistral-medium-2508"
     */
    MODEL: "mistral-small-latest",

    /**
     * Température : 0.0–1.0. 0.3 = concis/contrôlé → bien pour du résumé.
     */
    TEMPERATURE: 0.3,

    /**
     * Template du prompt. "__TEXT__" sera remplacé par la sélection.
     */
    PROMPT_TEMPLATE: [
        "<role> ",
        "Tu es maintenant un journaliste avec plus de 20 ans d'expérience.",
        "Tu es particulièrement reconnu dans le monde de la technologie, de l'informatique et du numérique.",
        "Tu as un vrai souci de l’exactitude des faits et à la clarté de l'information. ",
        "</role>",
        "<tache>",
        "Tu vas prendre le temps de lire le texte présent dans la partie [texte] et m’en faire un résumé.",
        "</tache>",
        "<instruction>",
        "Il est important que tu suives précisément la liste des instructions suivantes :",
        "1. Rédige un résumé simple en français, destiné à un lecteur non spécialiste.",
        "2. La longueur du résumé doit être de un paragraphe et d'un maximum de 150 mots",
        "</instruction>",
        "<contrainte>",
        "Ne pas inventer d’informations ni extrapoler. Rester absolument fidèle aux informations présentes dans le [texte] initial.",
        "Adopter un style sobre, précis, factuel.",
        "</contrainte>",
        "<texte>",
        "__TEXT__"
    ].join("</texte>\n"),

    /**
     * URL d’appel :
     *  - mode direct API Mistral : "https://api.mistral.ai/v1/chat/completions"
     */
    API_URL: "https://api.mistral.ai/v1/chat/completions",

    /**
     * Limite de caractères envoyés (0 = pas de limite).
     * Pratique si tu résumes des pages très longues.
     */
    MAX_CHARS: 0,
};

