
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
const detailPanel = document.getElementById("detailPanel");
const detailClose = document.getElementById("detailClose");
const detailTextEl = document.getElementById("detailText");
const likeBtn = document.getElementById("likeBtn");
const likeCountEl = document.getElementById("likeCount");
const saveDetailBtn = document.getElementById("saveDetailBtn");
const commentListEl = document.getElementById("commentList");
const commentInputEl = document.getElementById("commentInput");
const commentSubmit = document.getElementById("commentSubmit");

// Initial state
let isLoading = false;
let currentRequestId = 0; // 오래된 응답을 무시하기 위한 토큰
let pendingSaveText = null;
let lastKeyword = "";
let lastResults = [];
let currentBoardView = null; // 현재 보드 필터
let selectedText = "";
const BOARD_KEY = "brainstorm_boards";
const LIKE_KEY = "brainstorm_likes";
const COMMENT_KEY = "brainstorm_comments";
let boards = {
    "회화": [],
    "잡지": []
};
let likes = {};
let comments = {};

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

function loadReactions() {
    try {
        likes = JSON.parse(localStorage.getItem(LIKE_KEY) || "{}");
        comments = JSON.parse(localStorage.getItem(COMMENT_KEY) || "{}");
    } catch (e) {
        console.error("Failed to load reactions", e);
    }
}

function saveReactions() {
    try {
        localStorage.setItem(LIKE_KEY, JSON.stringify(likes));
        localStorage.setItem(COMMENT_KEY, JSON.stringify(comments));
    } catch (e) {
        console.error("Failed to save reactions", e);
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

function getRelated(text) {
    if (!lastResults || lastResults.length === 0) return [];
    const words = text.split(/\s+/).filter(Boolean);
    const scored = lastResults
        .filter((t) => t !== text)
        .map((t) => {
            let score = 0;
            words.forEach((w) => {
                if (t.includes(w)) score += 1;
            });
            return { t, score };
        })
        .sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score > 0).map((s) => s.t);
    // 부족하면 랜덤 추가
    if (top.length < 8) {
        const extras = lastResults.filter((t) => t !== text && !top.includes(t)).slice(0, 8 - top.length);
        return [...top, ...extras];
    }
    return top.slice(0, 8);
}

function renderRelated(text) {
    if (!commentListEl) return; // keep compatibility
    return;
}

function openDetail(text) {
    selectedText = text;
    if (detailTextEl) detailTextEl.textContent = text;
    if (likeCountEl) likeCountEl.textContent = likes[text] || 0;
    renderComments(text);
    renderRelated(text);
    detailPanel?.classList.remove("hidden");
    // 관련된 텍스트로 피드 업데이트
    const related = getRelated(text);
    if (related.length) render(related);
}

function closeDetail() {
    detailPanel?.classList.add("hidden");
}

function toggleLike() {
    if (!selectedText) return;
    likes[selectedText] = (likes[selectedText] || 0) + 1;
    if (likeCountEl) likeCountEl.textContent = likes[selectedText];
    saveReactions();
}

function renderComments(text) {
    if (!commentListEl) return;
    const list = comments[text] || [];
    commentListEl.innerHTML = "";
    list.forEach((c) => {
        const div = document.createElement("div");
        div.textContent = c;
        commentListEl.appendChild(div);
    });
}

function submitComment() {
    if (!selectedText || !commentInputEl) return;
    const value = commentInputEl.value.trim();
    if (!value) return;
    if (!comments[selectedText]) comments[selectedText] = [];
    comments[selectedText].push(value);
    commentInputEl.value = "";
    renderComments(selectedText);
    saveReactions();
}

async function callGemini(keyword) {
    const seeds = [
        "부드러운", "따뜻한", "차가운", "빛나는", "몽환적인", "미니멀", "빈티지",
        "파스텔", "딥톤", "메탈릭", "나무 향", "안개 낀", "밤하늘", "해질녘",
        "새벽공기", "비 오는 날", "첫눈", "봄꽃", "질감", "반사광", "입체감",
        "모노톤", "컬러풀", "질주", "고요", "잔잔한", "강렬한",
        // 감정/분위기
        "포근한","아늑한","차분한","평온한","우울한","쓸쓸한","고독한","서늘한",
    "긴장감 있는","불안한","초조한","설레는","두근거리는","로맨틱한","관능적인",
    "몽글몽글한","아련한","향수 어린","드라마틱한","서사적인","영화 같은",
    "위태로운","날카로운","거친","분노","해방감","희망적인","낙관적인","비관적인",

    // 시간/계절/날씨
    "한낮","정오","황혼","어스름","한밤","새벽","이른 아침","늦은 밤",
    "장마","폭우","소나기","이슬","서리","눈보라","바람 부는","태풍 전야",
    "안개 자욱한","미세먼지 낀","맑은","햇살 가득한","역광","노을빛","청명한",
    "여름 공기","가을 냄새","겨울빛","봄바람","벚꽃비","겨울 바다","여름밤",

    // 빛/색/채도/질감
    "하이키","로우키","고대비","저대비","소프트 라이트","하드 라이트",
    "네온","형광","무광","유광","새틴","펄","홀로그램","그라데이션","듀오톤",
    "트라이톤","단색","보색 대비","유사색 조합","톤온톤","톤인톤",
    "채도 낮은","채도 높은","탁한","맑은","스모키","투명한","반투명","유리 같은",
    "물기 있는","젖은 표면","건조한","거칠거칠한","매끈한","보송보송한",
    "모래 같은","석재 질감","콘크리트","종이 질감","필름 그레인","노이즈","빛 번짐",

    // 재료/물성/오브제 느낌
    "세라믹","도자기","점토","유리","아크릴","플라스틱","라텍스","고무",
    "스테인리스","황동","구리","녹슨 금속","철","알루미늄","대리석","화강암","자갈",
    "목재","합판","종이","신문지","천","린넨","벨벳","실크","가죽","데님","니트",
    "비닐","테이프","스티커","한지","먹","수채","유채","파스텔","목탄",

    // 형태/구성/리듬
    "대칭","비대칭","중심 구도","삼분할","여백 많은","빽빽한","레이어드","콜라주",
    "반복","패턴","리듬감","균형","불균형","기하학적","유기적인","곡선","직선","각진",
    "덩어리감","부유하는","떠다니는","쌓인","엉킨","흩어진","파편화된","왜곡된",
    "확대된","미니어처","모듈형","그리드","모자이크","프랙탈",

    // 무드/미학 키워드(검색 잘 됨)
    "키치","레트로","Y2K","90s","70s","80s","모던","컨템포러리","클래식",
    "아방가르드","하이엔드","럭셔리","로파이","하이테크","퓨처리스틱","사이버펑크",
    "솔라펑크","스팀펑크","다크 아카데미아","라이트 아카데미아","코티지코어",
    "노멀코어","고프","그런지","보헤미안","스칸디","재패니즈 미니멀","젠","와비사비",

    // 움직임/카메라/연출
    "롱테이크","클로즈업","와이드샷","틸트","패닝","줌인","줌아웃",
    "슬로모션","모션 블러","정지된","스냅샷","다큐멘터리 톤","시네마틱",
    "필름 룩","아날로그","디지털","손떨림 느낌",

    // 공간/장소 감각
    "실내","창가","커튼 너머","복도","계단","옥상","지하","골목","도시 야경","네온 거리",
    "바닷가","파도","숲","초원","온실","도서관","전시장","작업실","카페","방 한구석",
    "빈 방","폐허","공사장","미로 같은","좁은","넓은","밀실","광장"
    ];
    const variations = [
        "일러스트", "포스터", "아트워크", "무드보드", "질감 레퍼런스",
        "색 조합", "폰트 무드", "형태 실루엣", "사진 스타일", "스케치",

        // 디자인 산출물
        "브랜딩 무드","로고 컨셉","패키지 디자인","라벨 디자인","북커버","앨범커버",
    "웹사이트 히어로 이미지","랜딩페이지 무드","앱 UI 무드","에디토리얼 레이아웃",
    "타이포 포스터","키비주얼","캠페인 비주얼","전시 포스터","티켓 디자인",
    "스티커 시트","굿즈 디자인","머천다이즈","명함 디자인","포스터 시리즈",

    // 아트/스타일/기법
    "콜라주","포토몽타주","리소그래프","실크스크린","스텐실","에어브러시",
    "수채화 스타일","유화 스타일","파스텔 드로잉","잉크 드로잉","펜화",
    "연필 스케치","마커 렌더","픽셀아트","로우폴리","3D 렌더","클레이 렌더",
    "아날로그 필름 사진","폴라로이드","롱 노출 사진","매크로 사진","푸드 사진",
    "제품 사진","인테리어 사진","패션 화보","스트릿 스냅","다큐 사진",

    // 형태/모티프
    "패턴 타일","반복 패턴","심볼 아이콘","아이콘 세트","픽토그램","실루엣 세트",
    "캐릭터 컨셉","마스코트","오브제 스터디","재료 스터디","구조 스터디",
    "구도 연구","색감 테스트","질감 샘플","형태 변주",

    // 영상/모션
    "모션 그래픽","오프닝 타이틀","시네마틱 스틸","쇼츠 썸네일","릴스 커버",
    "애니메이션 프레임","스토리보드","콘티","카메라 무드 레퍼런스",

    // 글/리서치 느낌
    "키워드 클러스터","컨셉 문장","한 줄 카피","슬로건","내레이션 톤",
    "세계관 설정","캐릭터 성격 키워드","장면 묘사 문장","브리프 문장"
    ];

    const keywordSeed = keyword || "아이디어";
    const count = 100; // 더 많은 예시 생성
    const shuffledSeeds = [...seeds].sort(() => 0.5 - Math.random());
    const shuffledVars = [...variations].sort(() => 0.5 - Math.random());
    const combos = [];

    while (combos.length < count) {
        const adj = shuffledSeeds[combos.length % shuffledSeeds.length];
        const varr = shuffledVars[combos.length % shuffledVars.length];
        combos.push(`${adj} ${keywordSeed} ${varr}`);
    }
    return combos;
}

function createCard(text) {
    const card = document.createElement("article");
    card.className = "card text-card";
    card.addEventListener("click", () => openDetail(text));

    const overlay = document.createElement("div");
    overlay.className = "card-overlay";

    const saveBtn = document.createElement("button");
    saveBtn.className = "card-save";
    saveBtn.type = "button";
    saveBtn.textContent = "저장";
    saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        pendingSaveText = text;
        openBoardModal();
    });

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

function goHome() {
    if (lastResults.length > 0) {
        searchInput.value = lastKeyword;
        render(lastResults);
    } else {
        resetFeed();
    }
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
                lastKeyword = keyword;
                lastResults = results;
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
    goHome();
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

detailClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeDetail();
});

likeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleLike();
});

saveDetailBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (selectedText) {
        pendingSaveText = selectedText;
        openBoardModal();
    }
});

commentSubmit?.addEventListener("click", (e) => {
    e.preventDefault();
    submitComment();
});

commentInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitComment();
    }
});

// 초기 보드 로드
loadBoards();
updateProfileBoards();
renderBoardBar();
loadReactions();

// Initial demo
// render(["Search for something...", "Ideas will appear here", "Try 'Ocean'", "Try 'Future'"]);
