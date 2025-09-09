/**
 * popup.js – Extension Chrome (Manifest V3) pour résumé 1 paragraphe (FR) avec Mistral
 * ------------------------------------------------------------------------------------
 * Rôle :
 *  - Récupère la sélection texte de l'onglet actif.
 *  - Construit un prompt (template depuis config.js) avec "__TEXT__" remplacé.
 *  - Appelle API Mistral directement (mode perso, clé visible)
 *  - Affiche le résumé dans le popup et permet de le copier.
 *
 * Remarques :
 *  - Certaines pages (chrome://, Web Store, PDF interne…) bloquent l'injection => pas de sélection possible.
 */

// ---- Raccourcis DOM ---------------------------------------------------------
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const outputEl = $("output");
const selectionRawEl = $("selectionRaw");

// ---- Lecture de la configuration globale (injectée par config.js) -----------
const CFG = (window && window.MISTRAL_CONFIG) || {};
const API_KEY = CFG.API_KEY;
const MODEL = CFG.MODEL || "mistral-small-3.1";
const TEMPERATURE = typeof CFG.TEMPERATURE === "number" ? CFG.TEMPERATURE : 0.3;
const PROMPT_TEMPLATE = CFG.PROMPT_TEMPLATE || "__TEXT__";
const MAX_CHARS = Number(CFG.MAX_CHARS || 0);
const API_URL = CFG.API_URL || "https://api.mistral.ai/v1/chat/completions";

// ---- Petit contrôle : clé renseignée en mode direct -------------------------
if (!API_KEY || API_KEY.includes("VOTRE_CLE_API_MISTRAL_ICI")) {
    document.addEventListener("DOMContentLoaded", () => {
        statusEl.textContent = "⛔ Ajoute ta clé API dans config.js (ou active USE_PROXY) puis recharge.";
    });
}

/**
 * Récupère la sélection texte dans l'onglet actif. Fallback sur <textarea>/<input>.
 */
async function getPageSelection() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return "";

    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const s = window.getSelection()?.toString() || "";
                if (s) return s;
                const el = document.activeElement;
                if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
                    const { selectionStart, selectionEnd, value } = el;
                    if (selectionStart != null && selectionEnd != null && selectionStart !== selectionEnd) {
                        return value.slice(selectionStart, selectionEnd);
                    }
                }
                return "";
            }
        });
        return (result || "").toString();
    } catch {
        return "";
    }
}

/**
 * Construit le prompt à partir du template. Tronque si MAX_CHARS > 0.
 */
function buildPromptFromTemplate(rawText) {
    const text = (rawText || "").toString();
    const sliced = MAX_CHARS > 0 ? text.slice(0, MAX_CHARS) : text;
    return PROMPT_TEMPLATE.replace("__TEXT__", sliced);
}

/**
 * Appel en mode direct vers l'API de Mistral (clé visible côté client).
 * Endpoint: POST https://api.mistral.ai/v1/chat/completions
 * Payload standard "messages".
 */
async function callMistralDirect(prompt) {
    const body = {
        model: MODEL,
        messages: [
            { role: "system", content: "Tu es un assistant concis qui résume fidèlement." },
            { role: "user", content: prompt }
        ],
        temperature: TEMPERATURE
    };

    const resp = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const msg = data?.error?.message || JSON.stringify(data) || `HTTP ${resp.status}`;
        throw new Error(`Mistral: ${msg}`);
    }
    const summary = data?.choices?.[0]?.message?.content || "";
    return summary.trim();
}

/**
 * Chaîne complète : lit la sélection → construit le prompt → appelle Mistral → affiche.
 */
async function runSummarizeFlow(auto = false) {
    try {
        statusEl.textContent = auto ? "Lecture de la sélection…" : "Traitement…";
        outputEl.hidden = true;
        outputEl.textContent = "";

        const sel = await getPageSelection();
        selectionRawEl.value = sel; // debug caché (non affiché)
        if (!sel || sel.trim().length === 0) {
            statusEl.textContent = "Aucune sélection détectée. Sélectionne du texte dans la page, puis clique « Résumer ».";
            return;
        }

        // Construction du prompt
        const prompt = buildPromptFromTemplate(sel.trim());

        // Appel API : direct vs proxy
        statusEl.textContent = "Appel à Mistral…";
        const summary = await callMistralDirect(prompt);

        outputEl.textContent = summary || "(Résumé vide)";
        outputEl.hidden = false;
        statusEl.textContent = "";
    } catch (e) {
        statusEl.textContent = e?.message || String(e);
    }
}

// ---- Boutons UI -------------------------------------------------------------
$("refreshSel").addEventListener("click", () => runSummarizeFlow(true));
$("summarize").addEventListener("click", () => runSummarizeFlow(false));
$("copy").addEventListener("click", async () => {
    try {
        const txt = outputEl.hidden ? "" : outputEl.textContent;
        if (!txt) { statusEl.textContent = "Rien à copier."; return; }
        await navigator.clipboard.writeText(txt);
        statusEl.textContent = "Résumé copié ✅";
        setTimeout(() => (statusEl.textContent = ""), 1500);
    } catch {
        statusEl.textContent = "Impossible de copier.";
    }
});

// ---- Autostart à l'ouverture du popup --------------------------------------
document.addEventListener("DOMContentLoaded", () => runSummarizeFlow(true));
