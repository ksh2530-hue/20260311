const STORAGE_KEY = "today-flow-tasks";
const DEFAULT_FILTER = "all";

const elements = {
  taskForm: document.querySelector("#taskForm"),
  titleInput: document.querySelector("#taskTitle"),
  dateInput: document.querySelector("#taskDate"),
  timeInput: document.querySelector("#taskTime"),
  noteInput: document.querySelector("#taskNote"),
  selectedDateInput: document.querySelector("#selectedDate"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  taskSummary: document.querySelector("#taskSummary"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  todayButton: document.querySelector("#todayButton"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  template: document.querySelector("#taskItemTemplate"),
};

const todayValue = formatDate(new Date());

const state = {
  tasks: loadTasks(),
  selectedDate: todayValue,
  activeFilter: DEFAULT_FILTER,
  draggedTaskId: null,
  editingTaskId: null,
};

initializeApp();

function initializeApp() {
  syncDateInputs(state.selectedDate);
  setDefaultTime();
  bindEvents();
  render();
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.selectedDateInput.addEventListener("change", handleDateChange);
  elements.todayButton.addEventListener("click", moveToToday);
  elements.taskList.addEventListener("click", handleTaskListClick);
  elements.taskList.addEventListener("change", handleTaskListChange);
  elements.taskList.addEventListener("dragstart", handleDragStart);
  elements.taskList.addEventListener("dragover", handleDragOver);
  elements.taskList.addEventListener("dragleave", handleDragLeave);
  elements.taskList.addEventListener("drop", handleDrop);
  elements.taskList.addEventListener("dragend", handleDragEnd);

  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter || DEFAULT_FILTER);
    });
  });
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const nextTask = buildTaskFromForm();
  if (!nextTask) {
    return;
  }

  state.tasks.unshift({
    ...nextTask,
    id: crypto.randomUUID(),
    done: false,
    position: getNextPosition(nextTask.date),
    createdAt: new Date().toISOString(),
  });

  state.selectedDate = nextTask.date;
  persistTasks();
  elements.taskForm.reset();
  syncDateInputs(nextTask.date);
  setDefaultTime();
  render();
  elements.titleInput.focus();
}

function handleDateChange(event) {
  state.selectedDate = event.target.value || todayValue;
  syncDateInputs(state.selectedDate);
  render();
}

function moveToToday() {
  state.selectedDate = todayValue;
  syncDateInputs(todayValue);
  render();
}

function handleTaskListClick(event) {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem) {
    return;
  }

  const taskId = taskItem.dataset.id;

  if (event.target.closest(".edit-btn")) {
    if (state.editingTaskId === taskId) {
      saveInlineEdit(taskItem, taskId);
    } else {
      state.editingTaskId = taskId;
      render();
      focusInlineEditor(taskId);
    }
    return;
  }

  if (event.target.closest(".delete-btn")) {
    if (state.editingTaskId === taskId) {
      state.editingTaskId = null;
      render();
      return;
    }

    removeTask(taskId);
  }
}

function handleTaskListChange(event) {
  const toggle = event.target.closest(".task-toggle");
  if (!toggle) {
    return;
  }

  const taskItem = toggle.closest(".task-item");
  if (!taskItem) {
    return;
  }

  toggleTask(taskItem.dataset.id, toggle.checked);
}

function setFilter(filter) {
  state.activeFilter = filter;

  elements.filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });

  render();
}

function buildTaskFromForm() {
  const title = elements.titleInput.value.trim();
  const date = elements.dateInput.value;
  const time = elements.timeInput.value;
  const note = elements.noteInput.value.trim();

  if (!title || !date) {
    return null;
  }

  return { title, date, time, note };
}

function removeTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.editingTaskId === taskId) {
    state.editingTaskId = null;
  }
  persistTasks();
  render();
}

function toggleTask(taskId, done) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  task.done = done;
  persistTasks();
  render();
}

function saveInlineEdit(taskItem, taskId) {
  const title = taskItem.querySelector(".task-edit-title")?.value.trim() || "";
  const time = taskItem.querySelector(".task-edit-time")?.value || "";
  const note = taskItem.querySelector(".task-edit-note")?.value.trim() || "";

  if (!title) {
    return;
  }

  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      title,
      time,
      note,
    };
  });

  state.editingTaskId = null;
  persistTasks();
  render();
}

function focusInlineEditor(taskId) {
  const item = elements.taskList.querySelector(`[data-id="${taskId}"]`);
  const input = item?.querySelector(".task-edit-title");
  if (input) {
    input.focus();
    input.select();
  }
}

function render() {
  const visibleTasks = getVisibleTasks();
  renderHeader(visibleTasks);
  renderTaskList(visibleTasks);
}

function renderHeader(visibleTasks) {
  elements.selectedDateLabel.textContent = formatDisplayDate(state.selectedDate);
  elements.taskSummary.textContent = `${visibleTasks.length}개의 일정`;
}

function renderTaskList(visibleTasks) {
  elements.taskList.innerHTML = "";

  visibleTasks.forEach((task) => {
    elements.taskList.appendChild(createTaskItem(task));
  });

  elements.emptyState.hidden = visibleTasks.length > 0;
}

function createTaskItem(task) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  const isEditing = state.editingTaskId === task.id;

  node.dataset.id = task.id;
  node.classList.toggle("done", task.done);
  node.classList.toggle("editing", isEditing);
  node.querySelector(".task-toggle").checked = task.done;

  if (isEditing) {
    renderEditableTask(node, task);
  } else {
    renderReadonlyTask(node, task);
  }

  return node;
}

function renderReadonlyTask(node, task) {
  node.querySelector(".task-title").textContent = task.title;
  node.querySelector(".task-time").textContent = task.time || "시간 미정";
  node.querySelector(".task-note").textContent = task.note || "메모 없음";
  node.querySelector(".edit-btn").textContent = "수정";
  node.querySelector(".delete-btn").textContent = "삭제";
}

function renderEditableTask(node, task) {
  node.querySelector(".task-topline").innerHTML = `
    <input class="task-edit-title" type="text" maxlength="80" value="${escapeAttribute(task.title)}" />
    <input class="task-edit-time" type="time" value="${escapeAttribute(task.time || "")}" />
  `;
  node.querySelector(".task-note").outerHTML = `
    <textarea class="task-edit-note" rows="3" maxlength="200">${escapeHtml(task.note || "")}</textarea>
  `;
  node.querySelector(".edit-btn").textContent = "저장";
  node.querySelector(".delete-btn").textContent = "취소";
}

function getVisibleTasks() {
  return state.tasks
    .filter((task) => task.date === state.selectedDate)
    .filter(matchesFilter)
    .sort(sortTasks);
}

function matchesFilter(task) {
  if (state.activeFilter === "active") {
    return !task.done;
  }

  if (state.activeFilter === "done") {
    return task.done;
  }

  return true;
}

function sortTasks(a, b) {
  return getTaskPosition(a) - getTaskPosition(b);
}

function syncDateInputs(dateValue) {
  elements.selectedDateInput.value = dateValue;
  elements.dateInput.value = dateValue;
}

function setDefaultTime() {
  elements.timeInput.value = formatTime(new Date());
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeTaskPositions(parsed);
  } catch (error) {
    console.error("Failed to parse stored tasks", error);
    return [];
  }
}

function handleDragStart(event) {
  const handle = event.target.closest(".drag-handle");
  const taskItem = handle ? handle.closest(".task-item") : null;

  if (!handle || !taskItem || state.editingTaskId === taskItem.dataset.id) {
    event.preventDefault();
    return;
  }

  state.draggedTaskId = taskItem.dataset.id;
  taskItem.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", state.draggedTaskId);
}

function handleDragOver(event) {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem || taskItem.dataset.id === state.draggedTaskId) {
    return;
  }

  event.preventDefault();
  clearDragOverState();
  taskItem.classList.add("drag-over");
  event.dataTransfer.dropEffect = "move";
}

function handleDragLeave(event) {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem) {
    return;
  }

  if (!taskItem.contains(event.relatedTarget)) {
    taskItem.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem || taskItem.dataset.id === state.draggedTaskId) {
    return;
  }

  event.preventDefault();
  reorderTasks(state.draggedTaskId, taskItem.dataset.id);
  clearDragState();
}

function handleDragEnd() {
  clearDragState();
}

function reorderTasks(draggedTaskId, targetTaskId) {
  const dateTasks = state.tasks
    .filter((task) => task.date === state.selectedDate)
    .sort(sortTasks);
  const visibleIds = dateTasks.filter(matchesFilter).map((task) => task.id);
  const draggedIndex = visibleIds.indexOf(draggedTaskId);
  const targetIndex = visibleIds.indexOf(targetTaskId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return;
  }

  const reorderedVisibleIds = [...visibleIds];
  const [movedId] = reorderedVisibleIds.splice(draggedIndex, 1);
  reorderedVisibleIds.splice(targetIndex, 0, movedId);

  let visibleCursor = 0;
  const reorderedDateIds = dateTasks.map((task) => {
    if (visibleIds.includes(task.id)) {
      const nextId = reorderedVisibleIds[visibleCursor];
      visibleCursor += 1;
      return nextId;
    }

    return task.id;
  });

  const positionMap = new Map(reorderedDateIds.map((id, index) => [id, index]));

  state.tasks = state.tasks.map((task) => {
    if (task.date !== state.selectedDate) {
      return task;
    }

    return {
      ...task,
      position: positionMap.get(task.id),
    };
  });

  persistTasks();
  render();
}

function clearDragState() {
  state.draggedTaskId = null;
  elements.taskList
    .querySelectorAll(".task-item")
    .forEach((item) => item.classList.remove("dragging", "drag-over"));
}

function clearDragOverState() {
  elements.taskList
    .querySelectorAll(".task-item.drag-over")
    .forEach((item) => item.classList.remove("drag-over"));
}

function getNextPosition(date) {
  const positions = state.tasks
    .filter((task) => task.date === date)
    .map(getTaskPosition);

  return positions.length ? Math.max(...positions) + 1 : 0;
}

function getTaskPosition(task) {
  if (typeof task.position === "number") {
    return task.position;
  }

  return Number.MAX_SAFE_INTEGER;
}

function normalizeTaskPositions(tasks) {
  const grouped = new Map();

  tasks.forEach((task) => {
    const group = grouped.get(task.date) || [];
    group.push(task);
    grouped.set(task.date, group);
  });

  return tasks.map((task) => {
    if (typeof task.position === "number") {
      return task;
    }

    const group = grouped.get(task.date) || [];
    const sortedGroup = [...group].sort((a, b) => {
      if (!a.time && !b.time) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (!a.time) {
        return 1;
      }
      if (!b.time) {
        return -1;
      }
      return a.time.localeCompare(b.time);
    });

    return {
      ...task,
      position: sortedGroup.findIndex((item) => item.id === task.id),
    };
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDisplayDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
