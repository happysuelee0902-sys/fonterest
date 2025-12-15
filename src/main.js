
const feedEl = document.getElementById("feed");
const searchInput = document.getElementById("searchInput");
const homeBtn = document.getElementById("homeBtn");
const messageBtn = document.getElementById("messageBtn");
const messageModal = document.getElementById("messageModal");
const messageClose = document.getElementById("messageClose");
const boardModal = document.getElementById("boardModal");
const boardClose = document.getElementById("boardClose");
const boardListEl = document.getElementById("boardList");
const profileBtn = document.getElementById("profileBtn");
const profileModal = document.getElementById("profileModal");
const profileClose = document.getElementById("profileClose");
const profileBoardsEl = document.getElementById("profileBoards");
const boardBarEl = document.getElementById("boardBar");
const createBoardBtn = document.getElementById("createBoardBtn");
const createBoardModal = document.getElementById("createBoardModal");
const createBoardClose = document.getElementById("createBoardClose");
const createBoardCancel = document.getElementById("createBoardCancel");
const createBoardForm = document.getElementById("createBoardForm");
const createBoardInput = document.getElementById("createBoardInput");
const notifyBtn = document.getElementById("notifyBtn");
const notifyModal = document.getElementById("notifyModal");
const notifyClose = document.getElementById("notifyClose");

// Initial state
let isLoading = false;
let currentRequestId = 0; // 오래된 응답을 무시하기 위한 토큰
let pendingSaveText = null;
const BOARD_KEY = "brainstorm_boards";
let boards = {
    "회화": [],
    "잡지": []
};
let currentBoardView = null; // 현재 보드 필터

function loadBoards() {
    try {
        const raw = localStorage.getItem(BOARD_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            boards = { "회화": [], "잡지": [], ...parsed };
        }
    } catch (e) {
        console.error("Failed to load boards", e);
    }
}

function saveBoards() {
    try {
        localStorage.setItem(BOARD_KEY, JSON.stringify(boards));
    } catch (e) {
        console.error("Failed to save boards", e);
    }
}

function updateProfileBoards() {
    if (!profileBoardsEl) return;
    profileBoardsEl.innerHTML = "";
    Object.entries(boards).forEach(([name, items]) => {
        const card = document.createElement("div");
        card.className = "board-card";

        const thumb = document.createElement("div");
        thumb.className = "board-thumb";
        const preview = items.slice(-4).reverse();
        if (preview.length === 0) {
            thumb.textContent = "📌";
        } else {
            preview.forEach((txt) => {
                const t = document.createElement("div");
                t.className = "board-thumb-cell";
                t.textContent = txt.slice(0, 10);
                thumb.appendChild(t);
            });
        }

        const meta = document.createElement("div");
        meta.className = "board-meta";
        const title = document.createElement("div");
        title.className = "board-title";
        title.textContent = name;
        const count = document.createElement("div");
        count.className = "board-count";
        count.textContent = `핀 ${items.length}개`;

        meta.appendChild(title);
        meta.appendChild(count);

        card.appendChild(thumb);
        card.appendChild(meta);
        profileBoardsEl.appendChild(card);
    });
}

function renderBoardBar() {
    if (!boardBarEl) return;
    boardBarEl.innerHTML = "";
    Object.keys(boards).forEach((name) => {
        const chip = document.createElement("button");
        chip.className = "board-chip";
        if (currentBoardView === name) chip.classList.add("active");
        chip.type = "button";
        chip.textContent = name;
        chip.addEventListener("click", () => {
            currentBoardView = name;
            renderBoardBar();
            showBoardItems(name);
        });
        boardBarEl.appendChild(chip);
    });
}

function openCreateBoardModal() {
    if (!createBoardModal) return;
    createBoardModal.classList.remove("hidden");
    if (createBoardInput) {
        createBoardInput.value = "";
        createBoardInput.focus();
    }
}

function closeCreateBoardModal() {
    if (!createBoardModal) return;
    createBoardModal.classList.add("hidden");
    if (createBoardInput) createBoardInput.value = "";
}

async function callGemini(keyword) {
    const seeds = [
        "부드러운", "따뜻한", "차가운", "빛나는", "몽환적인", "미니멀", "빈티지",
        "파스텔", "딥톤", "메탈릭", "나무 향", "안개 낀", "밤하늘", "해질녘",
        "새벽공기", "비 오는 날", "첫눈", "봄꽃", "질감", "반사광", "입체감",
        "모노톤", "컬러풀", "질주", "고요", "잔잔한", "강렬한"
    ];
    const variations = [
        "일러스트", "포스터", "아트워크", "무드보드", "질감 레퍼런스",
        "색 조합", "폰트 무드", "형태 실루엣", "사진 스타일", "스케치"
    ];

    const keywordSeed = keyword || "아이디어";
    const shuffled = seeds.sort(() => 0.5 - Math.random()).slice(0, 12);
    const combos = [];
    while (combos.length < 12) {
        const adj = shuffled[combos.length % shuffled.length];
        const varr = variations[combos.length % variations.length];
        combos.push(`${adj} ${keywordSeed} ${varr}`);
    }
    return combos;
}

function createCard(text) {
    const card = document.createElement("article");
    card.className = "card text-card";

    const overlay = document.createElement("div");
    overlay.className = "card-overlay";

    const badge = document.createElement("div");
    badge.className = "card-badge";
    badge.textContent = "new";

    const saveBtn = document.createElement("button");
    saveBtn.className = "card-save";
    saveBtn.type = "button";
    saveBtn.textContent = "저장";
    saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        pendingSaveText = text;
        openBoardModal();
    });

    overlay.appendChild(badge);
    overlay.appendChild(saveBtn);

    const content = document.createElement("div");
    content.className = "card-content";
    content.textContent = text;

    card.appendChild(content);
    card.appendChild(overlay);

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

function resetFeed() {
    searchInput.value = "";
    feedEl.innerHTML = '<div class="loading">보드를 선택하거나 검색어를 입력하세요.</div>';
    isLoading = false;
}

function openBoardModal() {
    if (!boardModal) return;
    boardModal.classList.remove("hidden");
    renderBoardList();
}

function closeBoardModal() {
    if (!boardModal) return;
    boardModal.classList.add("hidden");
    pendingSaveText = null;
}

function renderBoardList() {
    if (!boardListEl) return;
    boardListEl.innerHTML = "";
    Object.keys(boards).forEach((name) => {
        const item = document.createElement("button");
        item.className = "modal-action board-item";
        item.type = "button";

        const icon = document.createElement("div");
        icon.className = "action-icon red";
        icon.textContent = "📌";

        const text = document.createElement("div");
        text.className = "action-text";
        const title = document.createElement("div");
        title.className = "action-title";
        title.textContent = name;
        const desc = document.createElement("div");
        desc.className = "action-desc";
        desc.textContent = `핀 ${boards[name].length}개`;

        text.appendChild(title);
        text.appendChild(desc);
        item.appendChild(icon);
        item.appendChild(text);

        item.addEventListener("click", () => {
            if (pendingSaveText) {
                boards[name].push(pendingSaveText);
                saveBoards();
                updateProfileBoards();
                renderBoardBar();
            }
            closeBoardModal();
        });

        boardListEl.appendChild(item);
    });
}

function showBoardItems(name) {
    const items = boards[name] || [];
    if (!items.length) {
        feedEl.innerHTML = `<div class="loading">${name} 보드가 비어있습니다. 아이디어를 저장해보세요.</div>`;
    } else {
        render(items);
    }
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

homeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetFeed();
});

function openMessageModal() {
    if (!messageModal) return;
    messageModal.classList.remove("hidden");
}

function closeMessageModal() {
    if (!messageModal) return;
    messageModal.classList.add("hidden");
}

messageBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openMessageModal();
});

messageClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMessageModal();
});

messageModal?.addEventListener("click", (e) => {
    if (e.target === messageModal || e.target.classList.contains("modal-backdrop")) {
        closeMessageModal();
    }
});

boardClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeBoardModal();
});

boardModal?.addEventListener("click", (e) => {
    if (e.target === boardModal || e.target.classList.contains("modal-backdrop")) {
        closeBoardModal();
    }
});

profileBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    updateProfileBoards();
    profileModal?.classList.remove("hidden");
});

profileClose?.addEventListener("click", (e) => {
    e.preventDefault();
    profileModal?.classList.add("hidden");
});

profileModal?.addEventListener("click", (e) => {
    if (e.target === profileModal || e.target.classList.contains("modal-backdrop")) {
        profileModal?.classList.add("hidden");
    }
});

createBoardBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openCreateBoardModal();
});

createBoardClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeCreateBoardModal();
});

createBoardCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    closeCreateBoardModal();
});

createBoardModal?.addEventListener("click", (e) => {
    if (e.target === createBoardModal || e.target.classList.contains("modal-backdrop")) {
        closeCreateBoardModal();
    }
});

createBoardForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!createBoardInput) return;
    const name = createBoardInput.value.trim();
    if (!name) return;
    if (!boards[name]) {
        boards[name] = [];
        saveBoards();
        renderBoardBar();
        updateProfileBoards();
        currentBoardView = name;
        showBoardItems(name);
    }
    closeCreateBoardModal();
});

notifyBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    notifyModal?.classList.remove("hidden");
});

notifyClose?.addEventListener("click", (e) => {
    e.preventDefault();
    notifyModal?.classList.add("hidden");
});

notifyModal?.addEventListener("click", (e) => {
    if (e.target === notifyModal || e.target.classList.contains("modal-backdrop")) {
        notifyModal?.classList.add("hidden");
    }
});

// 초기 보드 로드
loadBoards();
updateProfileBoards();
renderBoardBar();

// Initial demo
// render(["Search for something...", "Ideas will appear here", "Try 'Ocean'", "Try 'Future'"]);
