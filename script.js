/* ============================================================
   M.Tech CSE Learning App — Core JavaScript
   Modules: ProgressManager, QuizEngine, Confetti, ChainLock,
            ContentProtection, Nav, Theme, Utilities
   ============================================================ */

'use strict';

/* ============================ Utilities ============================ */
const Utils = {
  qs: (sel, root) => (root || document).querySelector(sel),
  qsa: (sel, root) => Array.from((root || document).querySelectorAll(sel)),
  esc: (str) => String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m])),
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
  percentage: (part, total) => total === 0 ? 0 : Math.round((part / total) * 100),
};

/* ============================ Toast ============================ */
const Toast = {
  container: null,
  ensure() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  },
  show(message, type = 'info', duration = 2600) {
    const container = this.ensure();
    const el = document.createElement('div');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${Utils.esc(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 350);
    }, duration);
    return el;
  }
};

/* ============================ Progress Manager ============================ */
const ProgressManager = {
  STORAGE_KEY: 'mtcse_progress',
  PASS_RATIO: 0.4, // pass if the learner scores at least 40% on the activity

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}; }
    catch { return {}; }
  },

  get(key) {
    const data = this.getAll();
    return data[key] || null;
  },

  set(key, value) {
    const data = this.getAll();
    data[key] = value;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  complete(subjectId, unitId, score, total, passing) {
    const key = `unit_${subjectId}_${unitId}`;
    const prev = this.get(key) || {};
    this.set(key, {
      completed: passing,
      score,
      total,
      passing,
      bestScore: Math.max(prev.bestScore || 0, score),
      attempts: (prev.attempts || 0) + 1,
      lastTimestamp: Date.now(),
    });
    return this.get(key);
  },

  isUnitCompleted(subjectId, unitId) {
    const r = this.get(`unit_${subjectId}_${unitId}`);
    return !!(r && r.completed);
  },

  isUnlocked(subjectId, unitId) {
    if (unitId === 1) return true;
    return this.isUnitCompleted(subjectId, unitId - 1);
  },

  overallProgress() {
    const data = this.getAll();
    const keys = Object.keys(data).filter((k) => k.startsWith('unit_'));
    if (keys.length === 0) return 0;
    const completed = keys.filter((k) => data[k] && data[k].completed).length;
    return this.percentage(completed, keys.length);
  },

  markUnitDone(subjectId, unitId, score = 30, total = 30) {
    // Utility to mark a unit complete from a theory page
    return this.complete(subjectId, unitId, score, total, true);
  },

  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  percentage: (p, t) => Utils.percentage(p, t),
};

/* ============================ Chain Lock ============================ */
const ChainLock = {
  init(containerId, units, subjectId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    grid.innerHTML = units.map((u) => {
      const unlocked = u.id === 1 || ProgressManager.isUnitCompleted(subjectId, u.id - 1);
      const completed = ProgressManager.isUnitCompleted(subjectId, u.id);
      const classes = ['unit-card'];
      if (!unlocked) classes.push('locked');
      if (completed) classes.push('completed');
      return `
        <div class="${classes.join(' ')}" onclick="${unlocked ? `location.href='${u.href}'` : ''}">
          <div class="card-icon c-${u.color || 1}">
            ${unlocked ? `<i class="fas fa-${u.icon}"></i>` : '<i class="fas fa-lock"></i>'}
          </div>
          <h3>${Utils.esc(u.name)}</h3>
          <p class="sub">${Utils.esc(u.description)}</p>
          <div class="tags">
            ${completed ? '<span class="tag" style="background:var(--success-bg);color:var(--success)">Completed</span>' : ''}
            ${!unlocked ? '<span class="tag">🔒 Locked</span>' : '<span class="tag">Open</span>'}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = '';
    container.appendChild(grid);
  }
};

/* ============================ Confetti (bug-fixed) ============================
   FIXED: previous implementations used the width of a non-existent element,
   called document.body.clientWidth before render, or generated pieces that
   never animated because the animation was reset. Here we:
   1. Create a container that exists in the DOM before measuring width.
   2. Use a fixed spawn area derived from the viewport at call time.
   3. Apply the animation AFTER the element is in the DOM (forces reflow).
   4. Clean up all pieces and the container on completion.
   ============================ */
const Confetti = {
  COLORS: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#db2777', '#f59e0b', '#ef4444'],

  fire(duration = 3000, count = 180) {
    // 1) Build container and append to body BEFORE measuring/positioning
    let container = document.getElementById('confetti-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'confetti-container';
      document.body.appendChild(container);
    }

    // 2) Measure viewport AFTER the container is in the DOM
    const vw = window.innerWidth || document.documentElement.clientWidth || 400;
    const vh = window.innerHeight || document.documentElement.clientHeight || 600;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';

      const size = 6 + Math.random() * 8;
      const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];

      piece.style.width = size + 'px';
      piece.style.height = (size * (0.6 + Math.random() * 0.8)) + 'px';
      piece.style.left = Math.random() * vw + 'px';
      piece.style.background = color;
      piece.style.animationDuration = (2 + Math.random() * 2.4) + 's';
      piece.style.animationDelay = (Math.random() * 0.5) + 's';

      fragment.appendChild(piece);
    }

    container.appendChild(fragment);

    // 3) Clean up after the animation completes
    setTimeout(() => {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, duration + 800);

    return container;
  }
};

/* ============================ Quiz Engine ============================ */
const QuizEngine = {
  questions: [],
  userAnswers: {},
  currentQuestion: 0,
  subjectId: '',
  unitId: 0,
  config: { shuffleQuestions: false, shuffleOptions: false },

  init(questionBank, options = {}) {
    this.config = Object.assign(this.config, options);
    this.questions = [...questionBank];
    if (this.config.shuffleQuestions) this.shuffle(this.questions);
    this.userAnswers = {};
    this.currentQuestion = 0;

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.style.display = 'none';

    this.render();
    this.updateProgress();
    this.bindNav();
  },

  setMeta(subjectId, unitId) {
    this.subjectId = subjectId;
    this.unitId = unitId;
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  shuffleOptions(q) {
    if (!q.options) return q;
    const idx = [...q.options.keys()];
    this.shuffle(idx);
    const newOpts = idx.map((i) => q.options[i]);
    q.correct = idx.indexOf(q.correct);
    q.options = newOpts;
    return q;
  },

  render() {
    const container = document.getElementById('quizContainer');
    if (!container) return;
    if (this.currentQuestion >= this.questions.length) { this.showResults(); return; }

    const q = this.questions[this.currentQuestion];
    const answered = this.userAnswers[this.currentQuestion] !== undefined;

    let body = '';
    switch (q.type) {
      case 'mcq': body = this.renderMCQ(q, answered); break;
      case 'truefalse': body = this.renderTrueFalse(q, answered); break;
      case 'fillblank': body = this.renderFillBlank(q); break;
      case 'matching': body = this.renderMatching(q); break;
      default: body = this.renderMCQ(q, answered); break;
    }

    container.innerHTML = `
      <div class="question-card">
        <div class="q-count">Question ${this.currentQuestion + 1} of ${this.questions.length}</div>
        <div class="question-text">${Utils.esc(q.question)}</div>
        ${body}
        ${answered ? this.renderExplanation(q) : ''}
      </div>
    `;

    this.updateProgress();
    this.updateNavButtons();
  },

  renderMCQ(q, answered) {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    q.options = q.options || [];
    return `
      <div class="options">
        ${q.options.map((opt, i) => {
          const selected = this.userAnswers[this.currentQuestion] === i;
          let cls = 'option-btn';
          if (answered) {
            if (i === q.correct) cls += ' correct';
            else if (selected) cls += ' incorrect';
          } else if (selected) {
            cls += ' selected';
          }
          return `
            <button class="${cls}" ${answered ? 'disabled' : ''} onclick="QuizEngine.selectAnswer(${i})">
              <span class="option-letter">${letters[i]}</span>
              <span>${Utils.esc(opt)}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTrueFalse(q, answered) {
    const opts = ['True', 'False'];
    q.options = opts;
    q.correct = q.correct === 0 ? 0 : (q.correct ? q.correct : (q.answer === 1 ? 0 : (q.answer === false ? 1 : q.correct)));
    return `
      <div class="options">
        ${opts.map((opt, i) => {
          const selected = this.userAnswers[this.currentQuestion] === i;
          let cls = 'option-btn';
          if (answered) {
            if (i === q.correct) cls += ' correct';
            else if (selected) cls += ' incorrect';
          } else if (selected) cls += ' selected';
          return `
            <button class="${cls}" ${answered ? 'disabled' : ''} onclick="QuizEngine.selectAnswer(${i})">
              <span class="option-letter">${i === 0 ? 'T' : 'F'}</span>
              <span>${opt}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  },

  renderFillBlank(q, answered) {
    const answeredVal = this.userAnswers[this.currentQuestion];
    const isCorrect = answered && String(answeredVal).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
    return `
      <div class="options flex-col" style="align-items:stretch">
        <input
          id="fillBlankInput"
          class="glossary-search-input"
          style="padding:.7rem 1rem;border:1.5px solid var(--border-light);border-radius:var(--radius-md);font-family:inherit;font-size:.95rem;${answered ? (isCorrect ? 'border-color:var(--success);background:var(--success-bg)' : 'border-color:var(--danger);background:var(--danger-bg)') : ''}"
          type="text"
          placeholder="Type your answer..."
          value="${answered ? Utils.esc(answeredVal || '') : ''}"
          ${answered ? 'disabled' : ''}
        />
        ${answered
          ? `<div class="explanation"><strong>${isCorrect ? 'Correct' : 'Correct answer'}:</strong> ${Utils.esc(q.correct)}</div>`
          : `<button class="btn btn-primary mt-2" onclick="QuizEngine.submitFillBlank()"><i class="fas fa-check"></i> Submit</button>`}
      </div>
    `;
  },

  renderMatching(q, answered) {
    if (answered) {
      const isCorrect = this.userAnswers[this.currentQuestion] === q.correct;
      return `
        <div class="options flex-col">
          <div class="option-btn ${isCorrect ? 'correct' : 'incorrect'}" disabled>
            <span class="option-letter">${isCorrect ? '✓' : '✗'}</span>
            <span>${Utils.esc(q.question)}</span>
          </div>
          ${this.renderExplanation(q)}
        </div>
      `;
    }
    const letters = ['A', 'B', 'C', 'D'];
    const opts = q.options || [];
    return `
      <div class="options">
        ${opts.map((opt, i) => `
          <button class="option-btn" onclick="QuizEngine.selectAnswer(${i})">
            <span class="option-letter">${letters[i]}</span>
            <span>${Utils.esc(opt)}</span>
          </button>
        `).join('')}
      </div>
    `;
  },

  submitFillBlank() {
    const input = document.getElementById('fillBlankInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) { Toast.show('Please type an answer', 'error'); return; }
    this.userAnswers[this.currentQuestion] = val;
    this.render();
  },

  renderExplanation(q) {
    return `<div class="explanation"><strong>Explanation:</strong> ${Utils.esc(q.explanation || 'As per the syllabus / standard answer.')}</div>`;
  },

  selectAnswer(idx) {
    if (this.userAnswers[this.currentQuestion]) {
      // Prevent changing a truefalse/fillblank that was submitted via object
    }
    const q = this.questions[this.currentQuestion];
    if (q.type === 'fillblank') return;
    this.userAnswers[this.currentQuestion] = idx;
    this.render();
  },

  selectTrueFalse(idx) { this.selectAnswer(idx); },

  next() {
    if (this.currentQuestion < this.questions.length - 1) {
      // For mcq auto-advance? keep manual; just move on
    }
    this.currentQuestion++;
    this.render();
  },

  prev() {
    if (this.currentQuestion > 0) {
      this.currentQuestion--;
      this.render();
    }
  },

  updateProgress() {
    const answered = Object.keys(this.userAnswers).length;
    const pct = Utils.percentage(Math.min(this.currentQuestion + 1, this.questions.length), this.questions.length);
    const bar = document.getElementById('progressBar');
    const text = document.getElementById('answeredCount');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `${answered} / ${this.questions.length} answered`;
  },

  updateNavButtons() {
    const prev = document.getElementById('prevBtn');
    const next = document.getElementById('nextBtn');
    if (prev) prev.disabled = this.currentQuestion === 0;
    if (next) {
      const answered = this.userAnswers[this.currentQuestion] !== undefined;
      next.disabled = !answered;
      next.innerHTML = this.currentQuestion >= this.questions.length - 1
        ? '<i class="fas fa-flag-checkered"></i> Finish'
        : '<i class="fas fa-arrow-right"></i> Next';
    }
  },

  bindNav() {
    const prev = document.getElementById('prevBtn');
    const next = document.getElementById('nextBtn');
    if (prev && !prev.getAttribute('data-bound')) {
      prev.addEventListener('click', () => { this.prev(); });
      prev.setAttribute('data-bound', '1');
    }
    if (next && !next.getAttribute('data-bound')) {
      next.addEventListener('click', () => {
        if (this.currentQuestion >= this.questions.length - 1) {
          this.checkAllAndFinish();
        } else {
          this.currentQuestion++;
          this.render();
        }
      });
      next.setAttribute('data-bound', '1');
    }
  },

  calculateScore() {
    let correct = 0;
    const q = this.questions;
    const answers = this.userAnswers;
    q.forEach((question, i) => {
      if (answers[i] === undefined) return;
      if (question.type === 'fillblank') {
        if (String(answers[i]).trim().toLowerCase() === String(question.correct).trim().toLowerCase()) correct++;
      } else if (answers[i] === question.correct) {
        correct++;
      }
    });
    return correct;
  },

  checkAllAndFinish() {
    const unanswered = this.questions.filter((_, i) => this.userAnswers[i] === undefined);
    if (unanswered.length > 0) {
      // Jump to first unanswered
      const firstIdx = this.questions.findIndex((_, i) => this.userAnswers[i] === undefined);
      this.currentQuestion = firstIdx;
      this.render();
      Toast.show('Please answer the remaining question', 'error');
      return;
    }
    this.showResults();
  },

  showResults() {
    const score = this.calculateScore();
    const total = this.questions.length;
    const percent = Utils.percentage(score, total);
    const passed = score >= Math.ceil(total * ProgressManager.PASS_RATIO);
    let message, icon;

    if (passed && percent >= 80) { message = 'Outstanding! You have a strong command of this unit.'; icon = 'fa-trophy'; }
    else if (passed) { message = 'Great job! You passed this unit. You are exam-ready.'; icon = 'fa-medal'; }
    else { message = 'Keep practising! Revisit the unit and try again.'; icon = 'fa-book-open'; }

    const container = document.getElementById('quizContainer');
    const progressWrap = document.querySelector('.progress-wrapper');
    if (progressWrap) progressWrap.style.display = 'none';

    const navBtns = document.getElementById('quizNav');
    if (navBtns) navBtns.style.display = 'none';

    // Save progress
    const subjectId = this.subjectId;
    const unitId = this.unitId;
    ProgressManager.complete(subjectId, unitId, score, total, passed);

    if (container) {
      container.innerHTML = `
        <div class="results-panel animate-fadeIn">
          <div class="progress-ring results-ring" style="--pg:${percent}"><span>${percent}%</span></div>
          <div class="results-score">
            <span class="score-number">${score}</span>
            <span class="score-total"> / ${total}</span>
          </div>
          <div class="results-percent">You scored ${percent}% (pass at ${Math.round(ProgressManager.PASS_RATIO * 100)}%)</div>
          <div class="results-message"><i class="fas ${icon}"></i> ${message}</div>
          <div class="results-actions">
            <button class="btn btn-primary" onclick="QuizEngine.retake()"><i class="fas fa-redo"></i> Retake Quiz</button>
            <a href="${this.returnHref || 'javascript:history.back()'}" class="btn btn-outline"><i class="fas fa-arrow-left"></i> Back to Unit</a>
          </div>
        </div>
      `;
    }

    // Fire confetti on pass
    if (passed) {
      setTimeout(() => Confetti.fire(3200, 200), 250);
      Toast.show('Unit completed! 🎉', 'success');
    } else {
      Toast.show('Not yet — review the unit and retry.', 'error');
    }

    // Announce overall progress
    this.renderOverallProgress();
  },

  retake() {
    this.userAnswers = {};
    this.currentQuestion = 0;
    const progressWrap = document.querySelector('.progress-wrapper');
    if (progressWrap) progressWrap.style.display = '';
    const navBtns = document.getElementById('quizNav');
    if (navBtns) navBtns.style.display = '';
    this.render();
    this.updateProgress();
  },

  renderOverallProgress() {
    if (document.getElementById('overallProgress')) {
      document.getElementById('overallProgress').textContent = ProgressManager.overallProgress() + '%';
    }
  }
};

/* ============================ Content Protection (optional) ============================ */
const ContentProtection = {
  enabled: false,
  init(enabled = false) {
    this.enabled = enabled;
    if (!enabled) return;

    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.no-select')) { e.preventDefault(); this.toast('Content is protected'); }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault(); this.toast('This action is disabled');
      }
    });
  },
  toast(msg) {
    if (!document.querySelector('.toast-container')) {
      const d = document.createElement('div');
      d.className = 'toast-container';
      document.body.appendChild(d);
    }
    const el = document.createElement('div');
    el.className = 'toast error';
    el.innerHTML = `<i class="fas fa-shield-halved"></i><span>${Utils.esc(msg)}</span>`;
    document.querySelector('.toast-container').appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
};

/* ============================ Nav / Mobile Menu ============================ */
const AppNav = {
  init() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
    }
    // Highlight active nav link
    const path = location.pathname.split('/').pop() || 'index.html';
    Utils.qsa('.nav-link').forEach((a) => {
      if (a.getAttribute('href') === path) a.classList.add('active');
    });
    this.updateProgress();
  },
  updateProgress() {
    const el = document.getElementById('overallProgress');
    if (el) el.textContent = ProgressManager.overallProgress() + '%';
  }
};

/* ============================ Mermaid diagram helpers ============================ */
const MermaidControl = {
  init() {
    if (typeof mermaid === 'undefined') return;
    // Global zoom helpers are bound via onclick attributes in HTML
  },
  zoomIn(btn) {
    const c = btn.closest('.diagram-wrapper')?.querySelector('.diagram-container');
    if (!c) return;
    const m = (c.style.transform || '').match(/scale\(([\d.]+)\)/);
    const cur = m ? parseFloat(m[1]) : 1;
    c.style.transform = `scale(${Math.min(cur + 0.2, 3)})`;
  },
  zoomOut(btn) {
    const c = btn.closest('.diagram-wrapper')?.querySelector('.diagram-container');
    if (!c) return;
    const m = (c.style.transform || '').match(/scale\(([\d.]+)\)/);
    const cur = m ? parseFloat(m[1]) : 1;
    c.style.transform = `scale(${Math.max(cur - 0.2, 0.5)})`;
  },
  reset(btn) {
    const c = btn.closest('.diagram-wrapper')?.querySelector('.diagram-container');
    if (c) c.style.transform = 'scale(1)';
  }
};

/* ============================ Global helper exposure ============================ */
function zoomIn(btn) { MermaidControl.zoomIn(btn); }
function zoomOut(btn) { MermaidControl.zoomOut(btn); }
function resetZoom(btn) { MermaidControl.reset(btn); }

function fireConfetti(duration = 3000, count = 180) { Confetti.fire(duration, count); }

/* ============================ Init ============================ */
document.addEventListener('DOMContentLoaded', () => {
  AppNav.init();
  MermaidControl.init();
  // ContentProtection.init(true); // uncomment to enable
});
