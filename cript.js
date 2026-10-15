
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const KEYS = {
  tasks: "studyapp_pro_tasks",
  exams: "studyapp_pro_exams",
  notes: "studyapp_pro_notes",
  profile: "studyapp_pro_profile"
};

function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

let tasks = load(KEYS.tasks, []);
let exams = load(KEYS.exams, []);
let notes = load(KEYS.notes, []);
let profile = load(KEYS.profile, { name: "Estudiante", course: "" });

let calendarDate = new Date();
let selectedDate = dateKey(new Date());
let toastTimeout;
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let timerMode = 25;

function saveData() {
  localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
  localStorage.setItem(KEYS.exams, JSON.stringify(exams));
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value, options = {}) {
  if (!value) return "Sin fecha";
  return parseDate(value).toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    ...options
  });
}

function todayKey() {
  return dateKey(new Date());
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setSection(section) {
  const target = $("#" + section);
  if (!target) return;

  $$(".page-section").forEach(page => page.classList.remove("active"));
  target.classList.add("active");

  $$(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.section === section);
  });

  const activeLink = $(`.nav-link[data-section="${section}"]`);
  $("#breadcrumbTitle").textContent =
    activeLink ? activeLink.textContent.trim().replace(/^\S+\s/, "") :
    ({
      inicio: "Inicio",
      tareas: "Mis tareas",
      calendario: "Calendario",
      examenes: "Exámenes",
      notas: "Notas rápidas",
      estadisticas: "Estadísticas",
      temporizador: "Temporizador",
      configuracion: "Configuración"
    }[section] || "Inicio");

  if (section === "calendario") renderCalendar();
  if (section === "estadisticas") renderStatistics();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProfile() {
  const name = profile.name || "Estudiante";
  const initial = name.trim().charAt(0).toUpperCase() || "E";

  $("#welcomeName").textContent = name;
  $("#sidebarName").textContent = name;
  $("#sidebarInitial").textContent = initial;
  $("#topInitial").textContent = initial;
  $("#settingsInitial").textContent = initial;
  $("#profileName").value = profile.name || "";
  $("#profileCourse").value = profile.course || "";

  $(".workspace small").textContent = profile.course || "Plan de estudiante";
  $("#todayLabel").textContent = new Date().toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).toUpperCase();
}

function taskStatus(task) {
  if (task.completed) return "Completada";
  if (task.date < todayKey()) return "Vencida";
  return "Pendiente";
}

function taskItem(task, full = false) {
  const status = taskStatus(task);
  return `
    <article class="task-item ${task.completed ? "completed" : ""}">
      <input class="task-check" type="checkbox"
        data-complete="${escapeHTML(task.id)}"
        ${task.completed ? "checked" : ""}
        aria-label="Marcar ${escapeHTML(task.title)} como completada">
      <div class="task-info">
        <strong>${escapeHTML(task.title)}</strong>
        <p>${escapeHTML(task.subject)} · ${formatDate(task.date, { year: "numeric" })}</p>
        ${full && task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
        <div class="task-meta">
          <span class="priority priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority)}</span>
          <span class="status-chip">${status}</span>
        </div>
      </div>
      <div class="task-actions">
        ${full ? `<button class="small-action" data-edit-task="${escapeHTML(task.id)}" title="Editar tarea">Editar</button>` : ""}
        <button class="small-action" data-delete-task="${escapeHTML(task.id)}" title="Eliminar tarea">Eliminar</button>
      </div>
    </article>`;
}

function renderTasks() {
  const search = ($("#taskFilterSearch")?.value || "").trim().toLowerCase();
  const status = $("#taskFilterStatus")?.value || "todas";
  const priority = $("#taskFilterPriority")?.value || "todas";

  const filtered = [...tasks]
    .filter(task => {
      const matchesSearch = `${task.title} ${task.subject}`.toLowerCase().includes(search);
      const matchesStatus = status === "todas" ||
        (status === "completada" && task.completed) ||
        (status === "pendiente" && !task.completed);
      const matchesPriority = priority === "todas" || task.priority === priority;
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  $("#allTasks").innerHTML = filtered.map(task => taskItem(task, true)).join("");
  $("#allTasksEmpty").classList.toggle("hidden", filtered.length > 0);

  const pending = tasks.filter(task => !task.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  $("#dashboardTasks").innerHTML = pending.map(task => taskItem(task)).join("");
  $("#dashboardTasksEmpty").classList.toggle("hidden", pending.length > 0);
  $("#taskBadge").textContent = tasks.filter(task => !task.completed).length;

  renderSummary();
}

function renderSummary() {
  const total = tasks.length;
  const done = tasks.filter(task => task.completed).length;
  const pending = total - done;
  const percent = total ? Math.round(done / total * 100) : 0;

  $("#totalTasks").textContent = total;
  $("#completedTasks").textContent = done;
  $("#pendingTasks").textContent = `${pending} pendientes`;
  $("#productivity").textContent = percent;

  $("#taskProgressBar").style.width = `${total ? 100 : 0}%`;
  $("#completedProgressBar").style.width = `${percent}%`;
  $("#productivityBar").style.width = `${percent}%`;

  $("#statsTotal").textContent = total;
  $("#statsDone").textContent = done;
  $("#statsPending").textContent = pending;
  $("#statsExams").textContent = exams.length;
}

function openTaskDialog() {
  $("#taskForm").reset();
  $("#taskDate").value = todayKey();
  $("#taskDialog").showModal();
}

function closeTaskDialog() {
  $("#taskDialog").close();
}

function addTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  tasks.push({
    id: makeId(),
    title: form.get("title").trim(),
    subject: form.get("subject").trim(),
    date: form.get("date"),
    priority: form.get("priority"),
    description: form.get("description").trim(),
    completed: false
  });

  saveData();
  renderAll();
  closeTaskDialog();
  showToast("¡Tarea guardada correctamente!");
}

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  if (!confirm(`¿Quieres eliminar la tarea "${task.title}"?`)) return;

  tasks = tasks.filter(item => item.id !== id);
  saveData();
  renderAll();
  showToast("Tarea eliminada.");
}

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  const title = prompt("Nombre de la tarea:", task.title);
  if (title === null) return;
  if (!title.trim()) return showToast("El nombre no puede estar vacío.");

  const subject = prompt("Materia:", task.subject);
  if (subject === null) return;
  if (!subject.trim()) return showToast("La materia no puede estar vacía.");

  const date = prompt("Fecha de entrega (AAAA-MM-DD):", task.date);
  if (date === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parseDate(date).getTime()) ||
      dateKey(parseDate(date)) !== date) {
    return showToast("Escribe una fecha válida.");
  }

  task.title = title.trim();
  task.subject = subject.trim();
  task.date = date;
  saveData();
  renderAll();
  showToast("Tarea actualizada.");
}

function renderExams() {
  const sorted = [...exams].sort((a, b) => {
    return (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
  });

  $("#totalExams").textContent = exams.length;

  const next = sorted.find(exam => exam.date >= todayKey());
  $("#nextExamText").textContent = next
    ? `${next.title} · ${formatDate(next.date)}`
    : "Sin próximos exámenes";

  $("#dashboardExams").innerHTML = sorted
    .filter(exam => exam.date >= todayKey())
    .slice(0, 3)
    .map(exam => `
      <div class="exam-item">
        <div class="date-block">
          <strong>${parseDate(exam.date).getDate()}</strong>
          <small>${parseDate(exam.date).toLocaleDateString("es-DO", { month: "short" }).replace(".", "")}</small>
        </div>
        <div class="exam-item-info">
          <strong>${escapeHTML(exam.title)}</strong>
          <p>${escapeHTML(exam.subject)}${exam.time ? " · " + escapeHTML(exam.time) : ""}</p>
        </div>
      </div>`).join("");

  $("#dashboardExamsEmpty").classList.toggle(
    "hidden",
    sorted.some(exam => exam.date >= todayKey())
  );

  $("#allExams").innerHTML = sorted.map(exam => `
    <article class="exam-card">
      <div class="exam-card-top">
        <div><h3>${escapeHTML(exam.title)}</h3><p>${escapeHTML(exam.subject)}</p></div>
        <span class="stat-icon pink">▣</span>
      </div>
      <div class="date-block">
        <strong>${parseDate(exam.date).getDate()}</strong>
        <small>${parseDate(exam.date).toLocaleDateString("es-DO", { month: "long" })}</small>
      </div>
      <p>${formatDate(exam.date, { weekday: "long", year: "numeric" })}${exam.time ? " · " + escapeHTML(exam.time) : ""}</p>
      ${exam.topics ? `<div class="exam-topics"><strong>Temas:</strong> ${escapeHTML(exam.topics)}</div>` : ""}
      <div class="exam-card-actions"><button class="small-action" data-delete-exam="${escapeHTML(exam.id)}">Eliminar examen</button></div>
    </article>`).join("");

  $("#allExamsEmpty").classList.toggle("hidden", exams.length > 0);
}

function renderNotes() {
  $("#notesGrid").innerHTML = notes.map(note => `
    <article class="note-card">
      <button class="small-action note-delete" data-delete-note="${escapeHTML(note.id)}" title="Eliminar nota">×</button>
      <h3>${escapeHTML(note.title)}</h3>
      <p>${escapeHTML(note.content)}</p>
      <small>${formatDate(note.date, { year: "numeric" })}</small>
    </article>`).join("");

  $("#notesEmpty").classList.toggle("hidden", notes.length > 0);
}

function renderStatistics() {
  const total = tasks.length;
  const done = tasks.filter(task => task.completed).length;
  const pending = total - done;
  const percent = total ? Math.round(done / total * 100) : 0;

  $("#donutPercent").textContent = `${percent}%`;
  $("#taskDonut").style.background =
    `conic-gradient(var(--purple) ${percent * 3.6}deg, #eeeaf7 ${percent * 3.6}deg)`;
  $("#legendDone").textContent = done;
  $("#legendPending").textContent = pending;

  const priorities = ["Alta", "Media", "Baja"];
  $("#priorityChart").innerHTML = priorities.map(priority => {
    const count = tasks.filter(task => !task.completed && task.priority === priority).length;
    const width = pending ? count / pending * 100 : 0;
    return `<div class="bar-row">
      <span>${priority}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <strong>${count}</strong>
    </div>`;
  }).join("");
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  $("#calendarMonth").textContent = calendarDate.toLocaleDateString("es-DO", {
    month: "long", year: "numeric"
  });

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  let html = days.map(day => `<div class="calendar-day-name">${day}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const dayTasks = tasks.filter(task => task.date === key).length;
    const dayExams = exams.filter(exam => exam.date === key).length;

    html += `
      <button class="calendar-day ${date.getMonth() !== month ? "outside" : ""} ${key === todayKey() ? "today" : ""} ${key === selectedDate ? "selected" : ""}" data-calendar-date="${key}">
        <span class="day-number">${date.getDate()}</span>
        <span class="day-dots">
          ${dayTasks ? `<i class="task-dot" title="${dayTasks} tareas"></i>` : ""}
          ${dayExams ? `<i class="exam-dot" title="${dayExams} exámenes"></i>` : ""}
        </span>
      </button>`;
  }

  $("#calendarGrid").innerHTML = html;
  renderSelectedDate();
}

function renderSelectedDate() {
  const dayTasks = tasks.filter(task => task.date === selectedDate);
  const dayExams = exams.filter(exam => exam.date === selectedDate);

  let html = `<h3>Actividades del ${formatDate(selectedDate, { year: "numeric" })}</h3>`;

  if (!dayTasks.length && !dayExams.length) {
    html += `<p>No hay actividades registradas para este día.</p>`;
  }

  dayTasks.forEach(task => {
    html += `<div class="exam-item"><span class="stat-icon purple">▤</span><div class="exam-item-info"><strong>${escapeHTML(task.title)}</strong><p>Tarea · ${escapeHTML(task.subject)} · ${task.completed ? "Completada" : "Pendiente"}</p></div></div>`;
  });

  dayExams.forEach(exam => {
    html += `<div class="exam-item"><span class="stat-icon pink">▣</span><div class="exam-item-info"><strong>${escapeHTML(exam.title)}</strong><p>Examen · ${escapeHTML(exam.subject)}${exam.time ? " · " + escapeHTML(exam.time) : ""}</p></div></div>`;
  });

  $("#selectedDateEvents").innerHTML = html;
}

function addExam(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  exams.push({
    id: makeId(),
    title: form.get("title").trim(),
    subject: form.get("subject").trim(),
    date: form.get("date"),
    time: form.get("time"),
    topics: form.get("topics").trim()
  });

  saveData();
  event.currentTarget.reset();
  $("#examForm").classList.add("hidden");
  renderAll();
  showToast("¡Examen registrado!");
}

function addNote(event) {
  event.preventDefault();
  notes.unshift({
    id: makeId(),
    title: $("#noteTitle").value.trim(),
    content: $("#noteContent").value.trim(),
    date: todayKey()
  });

  saveData();
  event.currentTarget.reset();
  renderNotes();
  showToast("Nota guardada correctamente.");
}

function renderNotifications() {
  const overdue = tasks.filter(task => !task.completed && task.date < todayKey());
  const upcoming = exams.filter(exam => {
    const difference = (parseDate(exam.date) - parseDate(todayKey())) / 86400000;
    return difference >= 0 && difference <= 3;
  });

  const items = [
    ...overdue.map(task => ({
      title: "Tarea vencida",
      message: `${task.title} · ${task.subject} · ${formatDate(task.date)}`
    })),
    ...upcoming.map(exam => ({
      title: "Examen próximo",
      message: `${exam.title} · ${exam.subject} · ${formatDate(exam.date)}`
    }))
  ];

  $("#notificationList").innerHTML = items.length
    ? items.map(item => `<div class="notification-item"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.message)}</p></div>`).join("")
    : `<div class="empty-state"><span>✓</span><strong>Todo tranquilo por ahora</strong><p>No tienes tareas vencidas ni exámenes en los próximos tres días.</p></div>`;
}

function renderAll() {
  renderTasks();
  renderExams();
  renderNotes();
  renderStatistics();
  if ($("#calendario").classList.contains("active")) renderCalendar();
}

function searchEverywhere(query) {
  const value = query.trim().toLowerCase();
  if (!value) return;

  const foundTask = tasks.find(task =>
    `${task.title} ${task.subject}`.toLowerCase().includes(value)
  );

  const foundExam = exams.find(exam =>
    `${exam.title} ${exam.subject}`.toLowerCase().includes(value)
  );

  if (foundTask) {
    setSection("tareas");
    $("#taskFilterSearch").value = query;
    renderTasks();
  } else if (foundExam) {
    setSection("examenes");
  } else {
    setSection("tareas");
    $("#taskFilterSearch").value = query;
    renderTasks();
    showToast("No se encontraron coincidencias.");
  }
}

/* Navegación */
document.addEventListener("click", event => {
  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) setSection(sectionButton.dataset.section);

  if (event.target.closest("[data-open-task]")) openTaskDialog();

  const completeButton = event.target.closest("[data-complete]");
  if (completeButton) {
    const task = tasks.find(item => item.id === completeButton.dataset.complete);
    if (task) {
      task.completed = completeButton.checked;
      saveData();
      renderAll();
      showToast(task.completed ? "¡Tarea completada!" : "Tarea marcada como pendiente.");
    }
  }

  const deleteTaskButton = event.target.closest("[data-delete-task]");
  if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);

  const editTaskButton = event.target.closest("[data-edit-task]");
  if (editTaskButton) editTask(editTaskButton.dataset.editTask);

  const deleteExamButton = event.target.closest("[data-delete-exam]");
  if (deleteExamButton) {
    const id = deleteExamButton.dataset.deleteExam;
    if (confirm("¿Quieres eliminar este examen?")) {
      exams = exams.filter(exam => exam.id !== id);
      saveData();
      renderAll();
      showToast("Examen eliminado.");
    }
  }

  const deleteNoteButton = event.target.closest("[data-delete-note]");
  if (deleteNoteButton) {
    const id = deleteNoteButton.dataset.deleteNote;
    if (confirm("¿Quieres eliminar esta nota?")) {
      notes = notes.filter(note => note.id !== id);
      saveData();
      renderNotes();
      showToast("Nota eliminada.");
    }
  }

  const calendarButton = event.target.closest("[data-calendar-date]");
  if (calendarButton) {
    selectedDate = calendarButton.dataset.calendarDate;
    calendarDate = parseDate(selectedDate);
    renderCalendar();
  }
});

/* Tareas */
$("#taskForm").addEventListener("submit", addTask);
$("#closeTask").addEventListener("click", closeTaskDialog);
$("#cancelTask").addEventListener("click", closeTaskDialog);
$("#taskFilterSearch").addEventListener("input", renderTasks);
$("#taskFilterStatus").addEventListener("change", renderTasks);
$("#taskFilterPriority").addEventListener("change", renderTasks);

$("#taskDialog").addEventListener("click", event => {
  if (event.target === $("#taskDialog")) closeTaskDialog();
});

/* Exámenes */
$("#openExamForm").addEventListener("click", () => {
  $("#examForm").classList.toggle("hidden");
  $("#examForm").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#cancelExam").addEventListener("click", () => {
  $("#examForm").reset();
  $("#examForm").classList.add("hidden");
});

$("#examForm").addEventListener("submit", addExam);

/* Notas */
$("#noteForm").addEventListener("submit", addNote);

/* Perfil */
$("#profileForm").addEventListener("submit", event => {
  event.preventDefault();
  profile = {
    name: $("#profileName").value.trim() || "Estudiante",
    course: $("#profileCourse").value.trim()
  };
  saveData();
  updateProfile();
  showToast("¡Perfil actualizado!");
});

/* Calendario */
$("#prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  selectedDate = dateKey(calendarDate);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  selectedDate = dateKey(calendarDate);
  renderCalendar();
});

/* Búsqueda */
$("#globalSearch").addEventListener("keydown", event => {
  if (event.key === "Enter") searchEverywhere(event.target.value);
});

/* Notificaciones */
$("#notificationButton").addEventListener("click", () => {
  renderNotifications();
  $("#notificationDialog").showModal();
});

$("#closeNotifications").addEventListener("click", () => {
  $("#notificationDialog").close();
});

/* Temporizador */
function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  $("#timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  $("#timerStart").textContent = "▶ Iniciar";
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    return;
  }

  if (timerSeconds <= 0) timerSeconds = timerMode * 60;

  timerRunning = true;
  $("#timerStart").textContent = "Ⅱ Pausar";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      stopTimer();
      $("#timerStatus").textContent = "¡Sesión finalizada!";
      showToast("¡Tiempo terminado! Puedes tomar un descanso.");
      alert("¡Tiempo terminado! Buen trabajo.");
    }
  }, 1000);
}

function resetTimer() {
  stopTimer();
  timerSeconds = timerMode * 60;
  $("#timerStatus").textContent =
    $(`.timer-tab[data-minutes="${timerMode}"]`).dataset.label;
  updateTimerDisplay();
}

$("#timerStart").addEventListener("click", startTimer);
$("#timerReset").addEventListener("click", resetTimer);

$$(".timer-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    timerMode = Number(tab.dataset.minutes);
    $$(".timer-tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    resetTimer();
  });
});

/* Borrar datos */
$("#clearData").addEventListener("click", () => {
  const accepted = confirm(
    "¿Estás segura? Se eliminarán todas tus tareas, exámenes y notas de este navegador."
  );
  if (!accepted) return;

  tasks = [];
  exams = [];
  notes = [];
  saveData();
  renderAll();
  showToast("Se han eliminado tus tareas, exámenes y notas.");
});

/* Inicio */
function initialize() {
  updateProfile();
  renderAll();
  updateTimerDisplay();

  $("#taskDate").value = todayKey();
  $("#examForm").querySelector('[name="date"]').value = todayKey();
}

initialize();
