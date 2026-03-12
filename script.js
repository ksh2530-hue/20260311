import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
  updateDoc, doc, arrayUnion, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// User's Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD48dDo-_lNvRRhqVw83KU5zjQcUqNcM4E",
  authDomain: "qna2-edbdc.firebaseapp.com",
  projectId: "qna2-edbdc",
  storageBucket: "qna2-edbdc.firebasestorage.app",
  messagingSenderId: "150441888865",
  appId: "1:150441888865:web:32a9a1d81aab046486ee20",
  measurementId: "G-FNSK2EVY4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const questionsCol = collection(db, "questions");

const questionForm = document.getElementById("question-form");
const questionList = document.getElementById("question-list");
const template = document.getElementById("question-template");
const totalCounter = document.getElementById("total-questions");
const answeredCounter = document.getElementById("answered-count");
const feedCountDisplay = document.getElementById("feed-count");
const filters = document.getElementById("subject-filters");

let questions = []; 
let activeSubject = "all";

function updateCounters() {
  const total = questions.length;
  const answered = questions.filter(q => q.answers && q.answers.length > 0).length;
  totalCounter.innerText = total;
  answeredCounter.innerText = answered;
  const filteredCount = activeSubject === "all" ? total : questions.filter(q => q.subject === activeSubject).length;
  feedCountDisplay.innerText = filteredCount;
}

function renderAnswers(container, answers) {
  container.innerHTML = "";
  if (!answers || answers.length === 0) {
    container.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center"><p class="text-sm text-slate-400 italic">아직 답변이 없습니다. 첫 답변의 주인공이 되어보세요!</p></div>`;
    return;
  }
  answers.forEach(answer => {
    const div = document.createElement("div");
    div.className = "bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm shadow-sm animate-[fadeInUp_0.3s_ease-out]";
    div.textContent = answer;
    container.appendChild(div);
  });
}

function createQuestionCard(q) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector("div");
  const subjectTag = card.querySelector(".subject-tag");
  const statusBadge = card.querySelector(".status-badge");
  const title = card.querySelector(".question-title");
  const context = card.querySelector(".context-info");
  const details = card.querySelector(".card-details");
  const answersContainer = card.querySelector(".answers-container");
  const answerBtn = card.querySelector(".btn-answer");

  subjectTag.textContent = q.subject;
  subjectTag.className = `subject-tag text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider subject-${q.subject}`;
  title.textContent = q.question;
  context.textContent = q.context || "추가 설명 없음";

  const refreshStatus = () => {
    if (q.answers && q.answers.length > 0) {
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${q.answers.length} Replies`;
      statusBadge.classList.replace("text-slate-400", "text-emerald-500");
    } else {
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span> Pending`;
      statusBadge.classList.add("text-slate-400");
    }
  };

  refreshStatus();
  renderAnswers(answersContainer, q.answers);

  card.addEventListener("click", (e) => {
    if (e.target.closest('button')) return;
    document.querySelectorAll(".card-details").forEach(d => { if (d !== details) d.classList.add("hidden"); });
    details.classList.toggle("hidden");
  });

  answerBtn.addEventListener("click", async () => {
    const { value: text } = await Swal.fire({
      title: '답변 작성하기',
      input: 'textarea',
      inputLabel: '작성하신 답변은 모든 공부 친구들에게 공유됩니다.',
      inputPlaceholder: '답변 내용을 입력하세요...',
      showCancelButton: true,
      confirmButtonText: '답변 게시',
      confirmButtonColor: '#4f46e5',
      customClass: { popup: 'rounded-3xl' }
    });

    if (text) {
      try {
        const docRef = doc(db, "questions", q.id);
        await updateDoc(docRef, { answers: arrayUnion(text) });
        Swal.fire({ icon: 'success', title: '등록 성공!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
      } catch (e) { console.error("Error updating document: ", e); }
    }
  });

  return card;
}

function renderQuestions() {
  questionList.innerHTML = "";
  const filtered = questions.filter(q => activeSubject === "all" || q.subject === activeSubject);
  if (filtered.length === 0) {
    questionList.innerHTML = `<div class="text-center py-20"><h3 class="text-xl font-bold text-slate-800">질문이 없습니다</h3><p class="text-slate-400">새로운 질문을 등록해보세요!</p></div>`;
    updateCounters();
    return;
  }
  filtered.forEach(q => questionList.appendChild(createQuestionCard(q)));
  updateCounters();
}

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const subject = document.getElementById("subject").value;
  const questionText = document.getElementById("question-text").value.trim();
  const context = document.getElementById("context").value.trim();

  if (!subject || !questionText) return;

  try {
    await addDoc(questionsCol, {
      subject,
      question: questionText,
      context,
      answers: [],
      createdAt: serverTimestamp() // [수정] 클라이언트 시간 대신 서버 시간을 사용합니다.
    });

    questionForm.reset();
    activeSubject = "all";
    document.querySelectorAll('#subject-filters button').forEach(b => b.classList.remove('active', 'active-filter'));
    document.querySelector('[data-subject="all"]').classList.add('active', 'active-filter');

    Swal.fire({ icon: 'success', title: '질문 등록 완료!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
  } catch (e) { console.error("Error adding document: ", e); }
});

filters.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  activeSubject = btn.dataset.subject;
  document.querySelectorAll('#subject-filters button').forEach(b => b.classList.remove('active', 'active-filter'));
  btn.classList.add('active', 'active-filter');
  renderQuestions();
});

// [정렬] serverTimestamp를 사용하므로 정렬 쿼리 유지
const q = query(questionsCol, orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
  questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderQuestions();
  updateCounters();
});


