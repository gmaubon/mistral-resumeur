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
const outputEl = $("output");
const selectionRawEl = $("selectionRaw");
const mainSection = $("mainSection");
const historySection = $("historySection");
const historyList = $("historyList");
const statusEl = $("status");

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
 * Génère un hash SHA-256 d'un texte pour servir de clé de cache.
 */
async function hashText(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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
 * Appel en mode direct vers l'API de Mistral avec support du streaming.
 */
async function callMistralDirect(prompt, onChunk) {
    const body = {
        model: MODEL,
        messages: [
            { role: "system", content: "Tu es un assistant concis qui résume fidèlement." },
            { role: "user", content: prompt }
        ],
        temperature: TEMPERATURE,
        stream: true
    };

    const resp = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const msg = data?.error?.message || JSON.stringify(data) || `HTTP ${resp.status}`;
        throw new Error(`Mistral: ${msg}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine || dataLine === "data: [DONE]") continue;

            if (dataLine.startsWith("data: ")) {
                try {
                    const json = JSON.parse(dataLine.slice(6));
                    const content = json.choices?.[0]?.delta?.content || "";
                    if (content) {
                        fullText += content;
                        if (onChunk) onChunk(fullText);
                    }
                } catch (e) {
                    console.error("Erreur parsing chunk", e);
                }
            }
        }
    }
    return fullText.trim();
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
        const cacheKey = await hashText(prompt);

        // Vérification du cache
        const cache = await chrome.storage.local.get(cacheKey);
        if (cache[cacheKey]) {
            statusEl.textContent = "Récupéré du cache ✅";
            outputEl.textContent = cache[cacheKey];
            outputEl.hidden = false;
            return;
        }

        // Appel API avec streaming
        statusEl.textContent = "Appel à Mistral…";
        outputEl.hidden = false;
        
        const summary = await callMistralDirect(prompt, (chunk) => {
            outputEl.textContent = chunk;
            statusEl.textContent = "Génération en cours…";
        });

        if (summary) {
            // Mise en cache du résultat
            await chrome.storage.local.set({ [cacheKey]: summary });
            statusEl.textContent = "";
        } else {
            outputEl.textContent = "(Résumé vide)";
            statusEl.textContent = "";
        }
    } catch (e) {
        statusEl.textContent = e?.message || String(e);
    }
}

// ---- Bascule de vue ---------------------------------------------------------
function showView(view) {
    if (view === "history") {
        mainSection.hidden = true;
        historySection.hidden = false;
        renderHistory();
    } else {
        mainSection.hidden = false;
        historySection.hidden = true;
    }
}

async function renderHistory() {
    historyList.innerHTML = "<div class='muted'>Chargement…</div>";
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.length === 64); // filtres les hash SHA256

    if (keys.length === 0) {
        historyList.innerHTML = "<div class='muted'>Aucun résumé en cache.</div>";
        return;
    }

    historyList.innerHTML = "";
    // Trier par usage récent (pas possible sans timestamp, mais on affiche tout)
    keys.forEach(key => {
        const text = all[key];
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
            <div class="history-text">${text}</div>
            <div class="history-actions">
                <button class="btn-small copy-btn">Copier</button>
                <button class="btn-small delete-btn">Supprimer</button>
            </div>
        `;

        item.querySelector(".copy-btn").addEventListener("click", async () => {
            await navigator.clipboard.writeText(text);
            statusEl.textContent = "Copié !";
            setTimeout(() => statusEl.textContent = "", 1000);
        });

        item.querySelector(".delete-btn").addEventListener("click", async () => {
            await chrome.storage.local.remove(key);
            renderHistory();
        });

        historyList.appendChild(item);
    });
}

// ---- Boutons UI -------------------------------------------------------------
$("refreshSel").addEventListener("click", () => { showView("main"); runSummarizeFlow(true); });
$("summarize").addEventListener("click", () => { showView("main"); runSummarizeFlow(false); });
$("viewCache").addEventListener("click", () => showView("history"));
$("backToMain").addEventListener("click", () => showView("main"));

$("clearCache").addEventListener("click", async () => {
    if (confirm("Vider tout l'historique ?")) {
        await chrome.storage.local.clear();
        renderHistory();
    }
});

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
