/* ============================================================
   KachowTasks — app.js
   Full todo app: add, complete, delete, filter, sort, persist
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
let tasks   = [];
let filter  = 'all';
let sortDir = 'newest'; // 'newest' | 'oldest' | 'priority'

// ── DOM refs ───────────────────────────────────────────────
const form           = document.getElementById('todoForm');
const taskInput      = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const categorySelect = document.getElementById('categorySelect');
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const progressFill   = document.getElementById('progressFill');
const progressLabel  = document.getElementById('progressLabel');
const totalCount     = document.getElementById('totalCount');
const doneCount      = document.getElementById('doneCount');
const filterTabs     = document.getElementById('filterTabs');
const sortBtn        = document.getElementById('sortBtn');
const clearDoneBtn   = document.getElementById('clearDoneBtn');
const toastContainer = document.getElementById('toastContainer');

// ── Priority sort order ────────────────────────────────────
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ── Category display labels ────────────────────────────────
const CAT_LABELS = {
  general:  '📌 General',
  work:     '💼 Work',
  personal: '🏠 Personal',
  health:   '💪 Health',
  learning: '📚 Learning',
};

// ── Helpers ────────────────────────────────────────────────
const uid  = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const save = () => localStorage.setItem('kachow_tasks', JSON.stringify(tasks));
const load = () => {
  try { tasks = JSON.parse(localStorage.getItem('kachow_tasks')) || []; }
  catch { tasks = []; }
};

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1)  return 'just now';
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}

// ── Render all tasks ───────────────────────────────────────
function render() {
  // Filter
  let visible = tasks.filter(t => {
    if (filter === 'all')       return true;
    if (filter === 'active')    return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'high' || filter === 'medium' || filter === 'low') return t.priority === filter;
    return true;
  });

  // Sort
  visible = [...visible].sort((a, b) => {
    if (sortDir === 'newest')   return b.createdAt - a.createdAt;
    if (sortDir === 'oldest')   return a.createdAt - b.createdAt;
    if (sortDir === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return 0;
  });

  // Separate: incomplete first, completed at bottom (within sort)
  if (sortDir !== 'priority') {
    visible = [
      ...visible.filter(t => !t.completed),
      ...visible.filter(t =>  t.completed),
    ];
  }

  taskList.innerHTML = '';

  if (visible.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    visible.forEach(t => taskList.appendChild(buildTaskEl(t)));
  }

  updateStats();
}

// ── Build task element ─────────────────────────────────────
function buildTaskEl(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}`;
  li.dataset.id       = task.id;
  li.dataset.priority = task.priority;

  li.innerHTML = `
    <button class="task-checkbox" aria-label="Toggle complete">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </button>
    <div class="task-body">
      <div class="task-text">${escapeHtml(task.text)}</div>
      <div class="task-meta">
        <span class="task-badge badge-priority-${task.priority}">${task.priority}</span>
        <span class="task-badge badge-category">${CAT_LABELS[task.category] || task.category}</span>
        <span class="task-time">${formatTime(task.createdAt)}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn delete" aria-label="Delete task" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  // Toggle complete
  li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
  // Delete
  li.querySelector('.delete').addEventListener('click', () => deleteTask(task.id, li));

  return li;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Update header stats & progress ────────────────────────
function updateStats() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  totalCount.textContent = total;
  doneCount.textContent  = done;
  progressFill.style.width = `${pct}%`;

  if (total === 0) {
    progressLabel.textContent = 'No tasks yet — add something!';
  } else if (done === total) {
    progressLabel.textContent = `🎉 All ${total} tasks complete — you're crushing it!`;
  } else {
    progressLabel.textContent = `${done} of ${total} tasks done (${pct}%)`;
  }
}

// ── Add task ───────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) { shake(taskInput); return; }

  const task = {
    id:        uid(),
    text,
    priority:  prioritySelect.value,
    category:  categorySelect.value,
    completed: false,
    createdAt: Date.now(),
  };

  tasks.unshift(task);
  save();
  render();

  taskInput.value = '';
  taskInput.focus();
  toast('✅', 'Task added!');
});

// ── Toggle complete ────────────────────────────────────────
function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  save();
  render();
  toast(t.completed ? '🎉' : '↩️', t.completed ? 'Task marked done!' : 'Task reopened');
}

// ── Delete task ────────────────────────────────────────────
function deleteTask(id, el) {
  el.classList.add('removing');
  el.addEventListener('animationend', () => {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
  }, { once: true });
  toast('🗑️', 'Task removed');
}

// ── Filter tabs ────────────────────────────────────────────
filterTabs.addEventListener('click', e => {
  const btn = e.target.closest('.filter-tab');
  if (!btn) return;
  filterTabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.filter;
  render();
});

// ── Sort ───────────────────────────────────────────────────
const sortCycle = ['newest', 'oldest', 'priority'];
const sortLabels = { newest: '🕓 Newest', oldest: '🕓 Oldest', priority: '🎯 Priority' };
sortBtn.addEventListener('click', () => {
  const idx = sortCycle.indexOf(sortDir);
  sortDir = sortCycle[(idx + 1) % sortCycle.length];
  sortBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
    ${sortLabels[sortDir]}
  `;
  render();
  toast('🔀', `Sorted by ${sortDir}`);
});

// ── Clear completed ────────────────────────────────────────
clearDoneBtn.addEventListener('click', () => {
  const countBefore = tasks.filter(t => t.completed).length;
  if (countBefore === 0) { toast('ℹ️', 'No completed tasks to clear'); return; }
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
  toast('🧹', `Cleared ${countBefore} completed task${countBefore !== 1 ? 's':''}`);
});

// ── Shake animation on empty submit ───────────────────────
function shake(el) {
  el.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-8px)' },
    { transform: 'translateX(8px)' },
    { transform: 'translateX(-5px)' },
    { transform: 'translateX(0)' },
  ], { duration: 350, easing: 'ease-in-out' });
}

// ── Toast notifications ────────────────────────────────────
function toast(icon, msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('exiting');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2400);
}

// ── Refresh timestamps every minute ───────────────────────
setInterval(render, 60000);

// ── Boot ───────────────────────────────────────────────────
load();

// Seed demo tasks on first visit
if (tasks.length === 0) {
  tasks = [
    { id: uid(), text: 'Review project proposal', priority: 'high',   category: 'work',     completed: false, createdAt: Date.now() - 3600000*2 },
    { id: uid(), text: 'Go for a morning run',    priority: 'medium', category: 'health',   completed: false, createdAt: Date.now() - 3600000   },
    { id: uid(), text: 'Read "Atomic Habits"',    priority: 'low',    category: 'learning', completed: true,  createdAt: Date.now() - 86400000  },
  ];
  save();
}

render();
