// ---------- To‑Do App (Local-time safe) ----------
// Key fixes:
// 1) Never use toISOString() for deadlines.
// 2) Store deadlines exactly as entered: "YYYY-MM-DDTHH:mm" (local).
// 3) Parse with a safe local parser (no timezone shifts).
// 4) Sorting/filters/overdue checks all use local parsing consistently.

document.addEventListener("DOMContentLoaded", () => {
    wireUI();
    loadTasks();
    sortTasksByDeadline();
    // Start on Inbox by default (or keep current active)
    const active = document.querySelector(".sidebar nav ul li.active");
    if (active) filterTasks(active.textContent.trim());
});

const addTaskBtn = document.getElementById("addTaskBtn");
const taskInput = document.getElementById("taskInput");
const taskDateTime = document.getElementById("taskDateTime");
const taskList = document.getElementById("taskList");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const clearCompletedContainer = document.getElementById("clearCompletedContainer");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");


// ---------- Helpers: Local date handling ----------
const pad2 = n => String(n).padStart(2, "0");

// Convert a Date (local) -> "YYYY-MM-DDTHH:mm" (local)
function toLocalInputValue(d) {
    return (
        d.getFullYear() + "-" +
        pad2(d.getMonth() + 1) + "-" +
        pad2(d.getDate()) + "T" +
        pad2(d.getHours()) + ":" +
        pad2(d.getMinutes())
    );
}

// Parse "YYYY-MM-DDTHH:mm" as a *local* Date (no timezone shift)
function parseLocalDateTime(str) {
    if (!str || !str.includes("-")) return null;
    const [datePart, timePart = "00:00"] = str.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh = 0, mm = 0] = timePart.split(":").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

// Display formatting (local) like "15 Aug 2025, 07:30 PM"
function formatForDisplay(localDate) {
    if (!localDate) return "";
    const date = localDate.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    const time = localDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    return `${date} ${time}`;
}

// Today string in local "YYYY-MM-DD"
function todayStrLocal() {
    const now = new Date();
    return toLocalInputValue(now).slice(0, 10);
}

// Current filter label
function currentFilter() {
    return (
        document.querySelector(".sidebar nav ul li.active")?.textContent.trim() ||
        "Inbox"
    );
}

// ---------- UI wiring ----------
function wireUI() {
    // Add task button
    addTaskBtn.addEventListener("click", addTask);

    // ✅ NEW: Add task when pressing Enter
    taskInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTask();
        }
    });

    taskDateTime.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTask();
        }
    });

    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("hidden");
        });
    }
    // Sidebar filters
    document.querySelectorAll(".sidebar nav ul li").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".sidebar nav ul li").forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            filterTasks(item.textContent.trim());
            // On mobile, close the sidebar after selection
            if (window.matchMedia("(max-width: 768px)").matches) {
                sidebar.classList.add("hidden");
            }
        });
    });
}

// ---------- Add / Create / Render ----------
function addTask() {
    const text = taskInput.value.trim();
    let deadlineStr = taskDateTime.value; // already local "YYYY-MM-DDTHH:mm"

    if (!text) {
        alert("Task cannot be empty!");
        return;
    }

    // Default deadline = today 23:59 (local) if not provided
    if (!deadlineStr) {
        const now = new Date();
        now.setHours(23, 59, 0, 0);
        deadlineStr = toLocalInputValue(now);
    }

    const li = createTaskElement(text, false, deadlineStr);
    taskList.appendChild(li);
    saveTasks();
    sortTasksByDeadline();
    filterTasks(currentFilter());

    taskInput.value = "";
    taskDateTime.value = "";
}

function createTaskElement(text, completed = false, deadlineStr = null) {
    const li = document.createElement("li");
    if (completed) li.classList.add("completed");

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.addEventListener("change", () => {
        li.classList.toggle("completed");
        updateOverdueState(li); // if completed, remove overdue visual
        saveTasks();
        filterTasks(currentFilter());
    });

    // Text
    const titleSpan = document.createElement("span");
    titleSpan.textContent = text;

    // Deadline
    const metaSmall = document.createElement("small");
    if (deadlineStr) {
        li.dataset.deadline = deadlineStr; // store raw local string
        const localDate = parseLocalDateTime(deadlineStr);
        metaSmall.textContent = ` (Due: ${formatForDisplay(localDate)})`;
    }

    // Actions
    const actions = document.createElement("div");
    actions.classList.add("task-actions");

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.classList.add("edit");
    editBtn.addEventListener("click", () => {
        const newText = prompt("Edit task:", titleSpan.textContent);
        if (newText && newText.trim()) {
            titleSpan.textContent = newText.trim();
            saveTasks();
        }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.classList.add("delete");
    deleteBtn.addEventListener("click", () => {
        li.remove();
        saveTasks();
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // Assemble
    const textContainer = document.createElement("div");
    textContainer.appendChild(titleSpan);
    if (deadlineStr) textContainer.appendChild(metaSmall);

    li.appendChild(checkbox);
    li.appendChild(textContainer);
    li.appendChild(actions);

    // Overdue visual (after assemble so classes/styles apply)
    updateOverdueState(li);

    return li;
}

// Mark or unmark "overdue" depending on deadline vs now & completion
function updateOverdueState(li) {
    li.classList.remove("overdue");
    if (!li.dataset.deadline) return;
    if (li.classList.contains("completed")) return;

    const deadline = parseLocalDateTime(li.dataset.deadline);
    if (!deadline) return;

    if (deadline.getTime() < Date.now()) {
        li.classList.add("overdue"); // CSS makes this darker red
    }
}

// ---------- Persistence ----------
function saveTasks() {
    const tasks = [];
    taskList.querySelectorAll("li").forEach(li => {
        tasks.push({
            text: li.querySelector("span")?.textContent || "",
            completed: li.classList.contains("completed"),
            deadline: li.dataset.deadline || null // keep local "YYYY-MM-DDTHH:mm"
        });
    });
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

function loadTasks() {
    const saved = JSON.parse(localStorage.getItem("tasks") || "[]");
    taskList.innerHTML = "";
    saved.forEach(t => {
        const li = createTaskElement(t.text, !!t.completed, t.deadline || null);
        taskList.appendChild(li);
    });
}

// ---------- Sorting & Filtering ----------
function sortTasksByDeadline() {
    const items = Array.from(taskList.children);
    items.sort((a, b) => {
        const aStr = a.dataset.deadline;
        const bStr = b.dataset.deadline;
        const aTime = aStr ? parseLocalDateTime(aStr).getTime() : Number.POSITIVE_INFINITY;
        const bTime = bStr ? parseLocalDateTime(bStr).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
    });
    taskList.innerHTML = "";
    items.forEach(li => taskList.appendChild(li));
}

function filterTasks(filterType) {
    const tasks = document.querySelectorAll("#taskList li");
    const todayYMD = todayStrLocal(); // "YYYY-MM-DD"

    // Show/hide Clear All Completed button
    if (filterType.includes("Completed")) {
        clearCompletedContainer.style.display = "block";
    } else {
        clearCompletedContainer.style.display = "none";
    }

    tasks.forEach(task => {
        task.style.display = "flex"; // default visible
        const deadline = task.dataset.deadline ? parseLocalDateTime(task.dataset.deadline) : null;
        const deadlineStr = deadline ? toLocalInputValue(deadline).slice(0, 10) : null;

        if (filterType.includes("Inbox")) {
            task.style.display = "flex";
        } 
        else if (filterType.includes("Today")) {
            if (deadlineStr !== todayYMD) task.style.display = "none";
        } 
        else if (filterType.includes("Upcoming")) {
            if (!deadlineStr || deadlineStr <= todayYMD) task.style.display = "none";
        } 
        else if (filterType.includes("Completed")) {
            if (!task.classList.contains("completed")) task.style.display = "none";
        }
    });
}
// Clear all completed tasks
if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", () => {
        document.querySelectorAll("#taskList li.completed").forEach(li => li.remove());
        saveTasks();
    });
}

