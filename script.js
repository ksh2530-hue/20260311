const API_BASE = 'https://open.neis.go.kr/hub';
// Note: NEIS API is public but for high traffic a key is needed. 
// For this app, we'll try without a key first as it's a practice app.

const elements = {
    displayDate: document.getElementById('display-date'),
    displaySchoolName: document.getElementById('display-school-name'),
    displaySchoolLoc: document.getElementById('display-school-loc'),
    mealContainer: document.getElementById('meal-container'),
    calorieDisplay: document.getElementById('display-calorie'),
    originDisplay: document.getElementById('display-origin'),
    openSearchBtn: document.getElementById('open-search-btn'),
    closeSearchBtn: document.getElementById('close-search-btn'),
    searchModal: document.getElementById('search-modal'),
    schoolSearchInput: document.getElementById('school-search-input'),
    searchResults: document.getElementById('search-results'),
    tabs: document.querySelectorAll('.tab')
};

let currentState = {
    schoolCode: localStorage.getItem('schoolCode') || '',
    officeCode: localStorage.getItem('officeCode') || '',
    schoolName: localStorage.getItem('schoolName') || '학교를 선택해주세요',
    schoolLoc: localStorage.getItem('schoolLoc') || '상단 검색 버튼을 눌러주세요',
    currentDate: new Date(),
    mealType: '2' // Default to lunch
};

// Initialize
function init() {
    updateDateDisplay();
    if (currentState.schoolCode) {
        fetchMeals();
        elements.displaySchoolName.textContent = currentState.schoolName;
        elements.displaySchoolLoc.textContent = currentState.schoolLoc;
    } else {
        showNoSchool();
    }

    setupEventListeners();
}

function setupEventListeners() {
    elements.openSearchBtn.addEventListener('click', () => {
        elements.searchModal.classList.add('active');
        elements.schoolSearchInput.focus();
    });

    elements.closeSearchBtn.addEventListener('click', () => {
        elements.searchModal.classList.remove('active');
    });

    elements.schoolSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchSchool(elements.schoolSearchInput.value);
        }
    });

    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentState.mealType = tab.dataset.type;
            if (currentState.schoolCode) fetchMeals();
        });
    });
}

function updateDateDisplay() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    elements.displayDate.textContent = currentState.currentDate.toLocaleDateString('ko-KR', options);
}

async function searchSchool(query) {
    if (!query) return;
    
    elements.searchResults.innerHTML = '<div class="loader"></div>';
    
    try {
        const response = await fetch(`${API_BASE}/schoolInfo?Type=json&SCHUL_NM=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.schoolInfo) {
            const schools = data.schoolInfo[1].row;
            elements.searchResults.innerHTML = '';
            schools.forEach(school => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `
                    <span class="school-name">${school.SCHUL_NM}</span>
                    <span class="school-loc">${school.ORG_RDNMA}</span>
                `;
                div.onclick = () => selectSchool(school);
                elements.searchResults.appendChild(div);
            });
        } else {
            elements.searchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted);">검색 결과가 없습니다.</p>';
        }
    } catch (error) {
        console.error('Search error:', error);
        elements.searchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted);">검색 중 오류가 발생했습니다.</p>';
    }
}

function selectSchool(school) {
    currentState.schoolCode = school.SD_SCHUL_CODE;
    currentState.officeCode = school.ATPT_OFCDC_SC_CODE;
    currentState.schoolName = school.SCHUL_NM;
    currentState.schoolLoc = school.ORG_RDNMA;

    localStorage.setItem('schoolCode', currentState.schoolCode);
    localStorage.setItem('officeCode', currentState.officeCode);
    localStorage.setItem('schoolName', currentState.schoolName);
    localStorage.setItem('schoolLoc', currentState.schoolLoc);

    elements.displaySchoolName.textContent = currentState.schoolName;
    elements.displaySchoolLoc.textContent = currentState.schoolLoc;
    
    elements.searchModal.classList.remove('active');
    fetchMeals();
}

async function fetchMeals() {
    elements.mealContainer.innerHTML = '<div class="loader"></div>';
    
    const ymd = currentState.currentDate.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `${API_BASE}/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${currentState.officeCode}&SD_SCHUL_CODE=${currentState.schoolCode}&MLSV_YMD=${ymd}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.mealServiceDietInfo) {
            const allMeals = data.mealServiceDietInfo[1].row;
            const currentMeal = allMeals.find(m => m.MMEAL_SC_CODE === currentState.mealType);
            
            if (currentMeal) {
                renderMeal(currentMeal);
            } else {
                showNoMeal('선택하신 시간대에 급식 정보가 없습니다.');
            }
        } else {
            showNoMeal('오늘은 급식 정보가 없습니다.');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showNoMeal('데이터를 가져오는 중 오류가 발생했습니다.');
    }
}

function renderMeal(meal) {
    if (!meal) return;

    // Standardize dish names (remove numbers and parentheses for allergens)
    const dishText = meal.DDISH_NM || '';
    const dishes = dishText.split('<br/>').map(dish => {
        // Remove allergy info like (1.2.5.6)
        return dish.replace(/\([^)]*\)/g, '').trim();
    });

    elements.mealContainer.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'meal-list';
    
    dishes.forEach((dish, index) => {
        if (!dish) return;
        const li = document.createElement('li');
        li.className = 'meal-item';
        li.style.animationDelay = `${index * 0.1}s`;
        li.textContent = dish;
        ul.appendChild(li);
    });
    
    elements.mealContainer.appendChild(ul);
    elements.calorieDisplay.textContent = meal.CAL_INFO || '칼로리 정보 없음';
    
    // Clean up origin info (it's often long)
    if (meal.ORGRT_INFO) {
        const origins = meal.ORGRT_INFO.split('<br/>').slice(0, 3).join(', ') + '...';
        elements.originDisplay.textContent = `원산지: ${origins}`;
        elements.originDisplay.title = meal.ORGRT_INFO.replace(/<br\/>/g, '\n');
    } else {
        elements.originDisplay.textContent = '원산지 정보 없음';
    }
}

function showNoMeal(message) {
    elements.mealContainer.innerHTML = `
        <div class="no-meal">
            <i class="fas fa-utensils"></i>
            <p>${message}</p>
        </div>
    `;
    elements.calorieDisplay.textContent = '정보 없음';
    elements.originDisplay.textContent = '정보 없음';
}

function showNoSchool() {
    elements.mealContainer.innerHTML = `
        <div class="no-meal">
            <i class="fas fa-school"></i>
            <p>상단의 버튼을 눌러 학교를 검색해주세요.</p>
        </div>
    `;
}

init();
