
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PLACEHOLDER_KEY = "your_api_key_here";
// 기본 추천: gemini-1.5-flash-latest (무료 키로 가장 폭넓게 지원됨)
// env에 명시된 모델이 있으면 가장 먼저 사용
const MODEL_CANDIDATES = [
    import.meta.env.VITE_GEMINI_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-pro",
].filter(Boolean);

const feedEl = document.getElementById("feed");
const searchInput = document.getElementById("searchInput");

// Initial state
let isLoading = false;
let workingModel = null;
let currentRequestId = 0; // 오래된 응답을 무시하기 위한 토큰

function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const opts = { ...options, signal: controller.signal };
    return fetch(url, opts).finally(() => clearTimeout(timer));
}

async function callGemini(keyword) {
    if (!API_KEY || API_KEY === PLACEHOLDER_KEY) {
        alert("Gemini API 키가 설정되지 않았습니다. 루트의 .env.local 파일에 실제 키를 넣고 개발 서버를 재시작하세요.");
        return [];
    }

    const prompt = `
    List 20 creative brainstorming phrases, words, idioms, or short sentences related to the keyword: "${keyword}".
    Focus on visual, emotional, or abstract concepts.
    Return ONLY a raw JSON array of strings. Do not use Markdown formatting.
    대부분 한글로 작성하고, 한국인이 보기에 자연스럽게 출력해.
    Example: ["Baby powder scent", "Soft touch", "Newborn cry", "Pastel yellow"]
    `;

    try {
        const errors = [];
        const tried = new Set();

        // 이전에 성공했던 모델을 우선 시도하여 반복 검색 속도 향상
        const orderedModels = workingModel
            ? [workingModel, ...MODEL_CANDIDATES.filter(m => m !== workingModel)]
            : MODEL_CANDIDATES;

        for (const model of orderedModels) {
            if (tried.has(model)) continue;
            tried.add(model);
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

            try {
                const response = await fetchWithTimeout(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    }),
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    const apiMessage = data.error?.message;
                    errors.push(`${model}: ${apiMessage || `${response.status} ${response.statusText}`}`);
                    // 모델이 없거나 지원 안 되면 이후 후보로 즉시 넘어감
                    if (response.status === 404 || response.status === 400) {
                        continue;
                    }
                    continue;
                }

                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    errors.push(`${model}: 응답에서 텍스트를 찾지 못했습니다.`);
                    continue;
                }

                workingModel = model; // 정상 동작 모델 기억
                const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                return JSON.parse(cleanText);
            } catch (err) {
                if (err?.name === "AbortError") {
                    errors.push(`${model}: 요청이 시간 초과되었습니다.`);
                } else {
                    errors.push(`${model}: ${err?.message || "알 수 없는 오류"}`);
                }
            }
        }

        throw new Error(errors.join(" | "));

    } catch (error) {
        console.error("Gemini API Error:", error);
        alert(`아이디어를 불러오지 못했습니다. 사유: ${error.message || "알 수 없음"}`);
        return [];
    }
}

function createCard(text) {
    const card = document.createElement("article");
    card.className = "card text-card";

    const content = document.createElement("div");
    content.className = "card-content";
    content.textContent = text;

    card.appendChild(content);

    // Random height/size effect for Masonry feel
    const size = Math.floor(Math.random() * 3); // 0, 1, 2
    if (size === 1) card.classList.add("medium");
    if (size === 2) card.classList.add("large");

    return card;
}

function render(items) {
    feedEl.innerHTML = "";
    items.forEach(item => {
        feedEl.appendChild(createCard(item));
    });
}

function showLoading() {
    feedEl.innerHTML = '<div class="loading">Thinking...</div>';
}

async function handleSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) return;

    if (isLoading) return;
    isLoading = true;
    const requestId = ++currentRequestId;
    showLoading();

    try {
        const results = await callGemini(keyword);
        // 오래된 응답이면 무시하고 최신 요청만 반영
        if (requestId === currentRequestId) {
            if (!results || results.length === 0) {
                feedEl.innerHTML = '<div class="loading">결과가 없습니다. 키워드나 모델 설정을 다시 확인하세요.</div>';
            } else {
                render(results);
            }
        }
    } finally {
        isLoading = false;
    }
}

// Event Listeners
searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        handleSearch();
    }
});

// Initial demo
// render(["Search for something...", "Ideas will appear here", "Try 'Ocean'", "Try 'Future'"]);
