/**
 * 비비드 파스텔 투두리스트 JavaScript (script.js)
 * - 하루가 지나면 날짜별 자동 보관 (History)
 * - 미완료 할 일은 오늘 목록으로 자동 이월 & 강력 강조
 * - 7일 이상 지난 기록은 LocalStorage에서 자동 삭제 (Garbage Collection)
 * - 쨍한 비비드 파스텔 컬러 & 하루 넘기기 시뮬레이션 지원
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- LocalStorage Keys ---
  const STORAGE_KEY = 'vivid_pastel_todo_app';

  // --- DOM Elements ---
  // View Switcher
  const viewTodayBtn = document.getElementById('viewTodayBtn');
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  const todayView = document.getElementById('todayView');
  const historyView = document.getElementById('historyView');
  const historyCountPill = document.getElementById('historyCountPill');

  // Today View Elements
  const currentDateEl = document.getElementById('currentDate');
  const overdueBanner = document.getElementById('overdueBanner');
  const overdueCountEl = document.getElementById('overdueCount');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const todoForm = document.getElementById('todoForm');
  const todoInput = document.getElementById('todoInput');
  const todoList = document.getElementById('todoList');
  const emptyState = document.getElementById('emptyState');
  const itemsLeftEl = document.getElementById('itemsLeft');
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  const testDayRolloverBtn = document.getElementById('testDayRolloverBtn');

  // Filter Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const countAll = document.getElementById('countAll');
  const countActive = document.getElementById('countActive');
  const countCompleted = document.getElementById('countCompleted');

  // History View Elements
  const historyContainer = document.getElementById('historyContainer');
  const historyEmptyState = document.getElementById('historyEmptyState');

  // --- State ---
  let appState = {
    currentSimulatedDate: getTodayString(), // 실제 오늘 날짜 YYYY-MM-DD
    lastActiveDate: getTodayString(),
    todayTodos: [],
    history: {} // { "YYYY-MM-DD": [ { id, text, completed, originalDate } ] }
  };

  let currentFilter = 'all'; // 'all' | 'active' | 'completed'

  // --- 날짜 유틸 함수 ---
  function getTodayString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateKorean(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${year}. ${month}. ${day} ${dayNames[dateObj.getDay()]}`;
  }

  function getDaysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // --- LocalStorage 불러오기 & 초기화 ---
  function initApp() {
    loadState();
    checkDayRollover();
    cleanupOldRecords();
    saveState();
    renderTodayView();
    updateHistoryCountPill();
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        appState = { ...appState, ...parsed };
        return;
      } catch (e) {
        console.error('Failed to parse appState', e);
      }
    }

    // 신규 사용자를 위한 초기 예시 데이터 생성
    const today = getTodayString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getTodayString(yesterdayDate);

    appState.currentSimulatedDate = today;
    appState.lastActiveDate = today;
    appState.todayTodos = [
      {
        id: 1,
        text: '운동 30분 유산소 & 스트레칭 🏃‍♂️',
        completed: false,
        createdDate: yesterday,
        isCarriedOver: true, // 어제 미완료되어 이월된 항목 예시
        originalDate: yesterday
      },
      {
        id: 2,
        text: '프로젝트 기획서 작성하기 📝',
        completed: true,
        createdDate: today,
        isCarriedOver: false
      },
      {
        id: 3,
        text: '영양제 챙겨먹고 물 2L 마시기 💧',
        completed: false,
        createdDate: today,
        isCarriedOver: false
      }
    ];

    // 어제 완료 기록 샘플 하나 히스토리에 보관
    appState.history = {
      [yesterday]: [
        { id: 101, text: '신규 기능 요구사항 분석 완료 💡', completed: true, date: yesterday },
        { id: 102, text: '운동 30분 유산소 & 스트레칭 🏃‍♂️', completed: false, date: yesterday }
      ]
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }

  // --- 날짜 변경 체크 및 이월 (Day Rollover) 로직 ---
  function checkDayRollover() {
    const currentDate = appState.currentSimulatedDate;
    const lastDate = appState.lastActiveDate;

    if (lastDate && lastDate !== currentDate) {
      // 1. 이전 날짜의 할 일 목록을 History에 백업
      if (appState.todayTodos && appState.todayTodos.length > 0) {
        appState.history[lastDate] = appState.todayTodos.map(todo => ({
          id: todo.id,
          text: todo.text,
          completed: todo.completed,
          date: lastDate,
          originalDate: todo.originalDate || todo.createdDate || lastDate
        }));
      }

      // 2. 완료되지 않은(!completed) 할 일들을 오늘 목록으로 이월
      const uncompletedTodos = appState.todayTodos.filter(todo => !todo.completed);
      const carriedOverTodos = uncompletedTodos.map(todo => ({
        ...todo,
        isCarriedOver: true,
        originalDate: todo.originalDate || lastDate
      }));

      // 오늘 목록을 이월된 항목들로 새롭게 시작
      appState.todayTodos = carriedOverTodos;
      appState.lastActiveDate = currentDate;
    }
  }

  // --- 7일 지난 기록 자동 삭제 (Garbage Collection) ---
  function cleanupOldRecords() {
    const currentDate = appState.currentSimulatedDate;
    const historyDates = Object.keys(appState.history || {});

    historyDates.forEach(dateStr => {
      const daysDiff = getDaysDifference(dateStr, currentDate);
      // 7일 초과 시 저장소에서 완전 삭제
      if (daysDiff > 7) {
        delete appState.history[dateStr];
      }
    });
  }

  // --- 오늘 날짜 헤더 렌더링 ---
  function renderDateHeader() {
    currentDateEl.textContent = formatDateKorean(appState.currentSimulatedDate);
  }

  // --- 오늘 뷰 렌더링 ---
  function renderTodayView() {
    renderDateHeader();

    // 1. 미완료 이월 항목 파악 및 배너 표시
    const overdueItems = appState.todayTodos.filter(t => t.isCarriedOver && !t.completed);
    if (overdueItems.length > 0) {
      overdueCountEl.textContent = overdueItems.length;
      overdueBanner.classList.remove('hidden');
    } else {
      overdueBanner.classList.add('hidden');
    }

    // 2. 필터 적용
    const filteredTodos = appState.todayTodos.filter(todo => {
      if (currentFilter === 'active') return !todo.completed;
      if (currentFilter === 'completed') return todo.completed;
      return true;
    });

    // 3. 목록 렌더링
    if (filteredTodos.length === 0) {
      todoList.innerHTML = '';
      emptyState.classList.add('show');
    } else {
      emptyState.classList.remove('show');
      todoList.innerHTML = filteredTodos.map(todo => createTodoItemHTML(todo)).join('');
    }

    // 4. 통계 및 진행률 계산
    updateStats();
  }

  // 단일 Todo 항목 템플릿
  function createTodoItemHTML(todo) {
    const isOverdue = todo.isCarriedOver && !todo.completed;
    let overdueTagHtml = '';

    if (todo.isCarriedOver) {
      const daysAgo = todo.originalDate 
        ? getDaysDifference(todo.originalDate, appState.currentSimulatedDate)
        : 1;
      const daysText = daysAgo > 0 ? `${daysAgo}일 전 이월` : '어제 미완료 이월';
      overdueTagHtml = `<span class="tag-overdue">🔥 ${daysText}</span>`;
    }

    return `
      <li class="todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${todo.id}">
        <div class="todo-item-content" role="button" tabindex="0" aria-label="${todo.completed ? '미완료로 변경' : '완료로 변경'}">
          <div class="custom-checkbox">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="todo-text-wrap">
            ${overdueTagHtml}
            <span class="todo-text">${escapeHtml(todo.text)}</span>
          </div>
        </div>
        <button type="button" class="btn-delete" aria-label="할 일 삭제">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </li>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- 통계 & 진행 바 업데이트 ---
  function updateStats() {
    const total = appState.todayTodos.length;
    const completedCount = appState.todayTodos.filter(t => t.completed).length;
    const activeCount = total - completedCount;

    countAll.textContent = total;
    countActive.textContent = activeCount;
    countCompleted.textContent = completedCount;

    itemsLeftEl.textContent = `남은 할 일: ${activeCount}개`;

    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}% (${completedCount}/${total})`;
  }

  function updateHistoryCountPill() {
    const historyDates = Object.keys(appState.history || {});
    historyCountPill.textContent = `${historyDates.length}일 보관중`;
  }

  // --- 할 일 추가 핸들러 ---
  function addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      todoInput.classList.add('shake');
      setTimeout(() => todoInput.classList.remove('shake'), 400);
      todoInput.focus();
      return;
    }

    const newTodo = {
      id: Date.now(),
      text: trimmed,
      completed: false,
      createdDate: appState.currentSimulatedDate,
      isCarriedOver: false
    };

    appState.todayTodos.unshift(newTodo);
    saveState();
    renderTodayView();
    todoInput.value = '';
    todoInput.focus();
  }

  // --- 완료 토글 핸들러 ---
  function toggleTodo(id) {
    appState.todayTodos = appState.todayTodos.map(todo => {
      if (todo.id === id) {
        return { ...todo, completed: !todo.completed };
      }
      return todo;
    });
    saveState();
    renderTodayView();
  }

  // --- 할 일 삭제 핸들러 ---
  function deleteTodo(id, itemElement) {
    if (itemElement) {
      itemElement.classList.add('removing');
      setTimeout(() => {
        appState.todayTodos = appState.todayTodos.filter(todo => todo.id !== id);
        saveState();
        renderTodayView();
      }, 240);
    } else {
      appState.todayTodos = appState.todayTodos.filter(todo => todo.id !== id);
      saveState();
      renderTodayView();
    }
  }

  // --- 날짜별 기록 뷰 렌더링 (History View) ---
  function renderHistoryView() {
    updateHistoryCountPill();
    const historyDates = Object.keys(appState.history || {}).sort((a, b) => b.localeCompare(a));

    if (historyDates.length === 0) {
      historyContainer.innerHTML = '';
      historyEmptyState.classList.add('show');
      return;
    }

    historyEmptyState.classList.remove('show');

    historyContainer.innerHTML = historyDates.map(dateStr => {
      const items = appState.history[dateStr] || [];
      const total = items.length;
      const completedCount = items.filter(i => i.completed).length;
      const notDoneCount = total - completedCount;
      const isAllDone = total > 0 && completedCount === total;

      const statClass = isAllDone ? 'all-done' : 'has-uncompleted';
      const statLabel = isAllDone 
        ? `✨ 전체 완료 (${completedCount}/${total})` 
        : `⚠️ 미완료 ${notDoneCount}개 (${completedCount}/${total} 완료)`;

      const itemsHtml = items.map(item => `
        <li class="history-item ${item.completed ? 'done' : 'not-done'}">
          <span class="history-text">${escapeHtml(item.text)}</span>
          <span class="history-status-badge">
            ${item.completed ? '✓ 완료' : '미완료 ⚠️'}
          </span>
        </li>
      `).join('');

      return `
        <article class="history-card">
          <div class="history-card-header">
            <span class="history-card-date">
              📅 ${formatDateKorean(dateStr)}
            </span>
            <span class="history-card-stat ${statClass}">${statLabel}</span>
          </div>
          <ul class="history-todo-list">
            ${itemsHtml}
          </ul>
        </article>
      `;
    }).join('');
  }

  // --- 하루 넘기기 시뮬레이션 (테스트용) ---
  function simulateNextDay() {
    const cur = new Date(appState.currentSimulatedDate);
    cur.setDate(cur.getDate() + 1);
    const nextDateStr = getTodayString(cur);

    appState.currentSimulatedDate = nextDateStr;
    checkDayRollover();
    cleanupOldRecords();
    saveState();

    renderTodayView();
    updateHistoryCountPill();

    alert(`⚡ 하루가 지나 [${formatDateKorean(nextDateStr)}] 이 되었습니다!\n\n- 이전 날짜의 할 일이 기록 보관소로 저장되었습니다.\n- 완료되지 않은 할 일은 '이월' 배지와 함께 오늘 목록으로 이동되었습니다.`);
  }

  // --- 이벤트 리스너 바인딩 ---
  // 화면 전환 탭
  viewTodayBtn.addEventListener('click', () => {
    viewTodayBtn.classList.add('active');
    viewHistoryBtn.classList.remove('active');
    todayView.classList.add('active');
    historyView.classList.remove('active');
    renderTodayView();
  });

  viewHistoryBtn.addEventListener('click', () => {
    viewHistoryBtn.classList.add('active');
    viewTodayBtn.classList.remove('active');
    historyView.classList.add('active');
    todayView.classList.remove('active');
    renderHistoryView();
  });

  // 할 일 추가
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTodo(todoInput.value);
  });

  // TodoList 클릭 (완료 토글 및 삭제)
  todoList.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.todo-item');
    if (!itemEl) return;

    const id = Number(itemEl.dataset.id);

    // 삭제 버튼 클릭 시
    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
      e.stopPropagation();
      deleteTodo(id, itemEl);
      return;
    }

    // 아이템 본체 클릭 시 (완료 토글)
    const contentEl = e.target.closest('.todo-item-content');
    if (contentEl) {
      toggleTodo(id);
    }
  });

  // 필터 탭
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTodayView();
    });
  });

  // 완료 정리 버튼
  clearCompletedBtn.addEventListener('click', () => {
    const hasCompleted = appState.todayTodos.some(t => t.completed);
    if (!hasCompleted) return;

    appState.todayTodos = appState.todayTodos.filter(t => !t.completed);
    saveState();
    renderTodayView();
  });

  // 하루 넘기기 시뮬레이션 버튼
  testDayRolloverBtn.addEventListener('click', simulateNextDay);

  // --- 앱 시작 ---
  initApp();
});
