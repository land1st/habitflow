// js/ui.js — UI 렌더링 & 컴포넌트

import { store, formatDate, todayKey } from './store.js';

const ICONS = ['💪','💧','📖','🧘','🌙','🚶','✍️','🎵','🥗','☕','🏃','🎯','🛌','🧹','💊','🐕','🌿','🎨','🧠','❤️'];
const COLORS = ['#FFE0D0','#D0F0FF','#D0FFE5','#F0D0FF','#FFF5D0','#FFD0D0','#D0FFFA','#F5FFD0','#FFD0EC','#E5D0FF',
                '#FDEFD0','#D0EEFF','#D7F0D0','#FFD0F5','#F0EDD0'];

export const ui = {
  // ── Week Strip ──
  renderWeekStrip() {
    const strip = document.getElementById('week-strip');
    if (!strip) return;
    const DAYS = ['일','월','화','수','목','금','토'];
    const today = new Date();
    // 이번 주 월~일 표시
    const dow = today.getDay(); // 0=일
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    strip.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i);
      const isToday = formatDate(d) === todayKey();
      const isPast = d < today && !isToday;
      const el = document.createElement('div');
      el.className = 'day-item' + (isToday ? ' is-today' : isPast ? ' is-past' : '');
      el.innerHTML = `<div class="day-lbl">${DAYS[d.getDay()]}</div><div class="day-num">${d.getDate()}</div>`;
      strip.appendChild(el);
    }
  },

  // ── Greeting ──
  renderGreeting(userName) {
    const h = new Date().getHours();
    const greet = h < 6 ? '새벽이에요' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
    const name = userName ? `, ${userName.split(' ')[0]}님` : '';
    document.getElementById('greeting-text').textContent = `${greet}${name} 👋`;
    const WEEK = ['일','월','화','수','목','금','토'];
    const now = new Date();
    document.getElementById('today-label').textContent =
      `${now.getMonth()+1}월 ${now.getDate()}일 ${WEEK[now.getDay()]}요일`;
  },

  // ── Progress Banner ──
  updateProgress() {
    const today = todayKey();
    const total = store.data.habits.length;
    const done = store.getCompletionsForDate(today).length;
    const pct = total ? done / total : 0;

    document.getElementById('prog-bar-fill').style.width = (pct * 100) + '%';
    document.getElementById('prog-ring-label').textContent = `${done}/${total}`;
    document.getElementById('done-badge').textContent = `${done}/${total} 완료`;

    const circ = 150.8;
    document.getElementById('prog-ring-arc')
      .setAttribute('stroke-dashoffset', Math.round(circ * (1 - pct)));

    const rem = total - done;
    document.getElementById('prog-sub').textContent =
      rem > 0 ? `${rem}개만 더 하면 완료예요` : '오늘 모든 습관 완료! 🎉';
  },

  // ── Stats Row ──
  updateStats() {
    document.getElementById('stat-streak').innerHTML =
      `${store.getOverallStreak()}<span>일</span>`;
    document.getElementById('stat-best').innerHTML =
      `${store.getOverallBestStreak()}<span>일</span>`;
    document.getElementById('stat-week').innerHTML =
      `${store.getWeeklyRate()}<span>%</span>`;
  },

  // ── Habit List ──
  renderHabits(onToggle, onEdit) {
    const list = document.getElementById('habit-list');
    const empty = document.getElementById('empty-state');
    if (!list) return;
    list.innerHTML = '';

    const today = todayKey();
    const habits = store.data.habits;

    if (!habits.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    habits.forEach(h => {
      const done = store.isCompleted(h.id, today);
      const streak = store.getStreak(h.id);
      const card = document.createElement('div');
      card.className = 'habit-card' + (done ? ' is-done' : '');
      card.dataset.id = h.id;
      card.innerHTML = `
        <div class="hab-icon" style="background:${h.color}">${h.icon}</div>
        <div class="hab-body">
          <div class="hab-name">${escHtml(h.name)}</div>
          <div class="hab-meta">${h.sub ? escHtml(h.sub) + ' · ' : ''}<span class="streak">🔥 ${streak}일</span></div>
        </div>
        ${h.time ? `<div class="hab-time">${escHtml(h.time)}</div>` : ''}
        <div class="hab-check" aria-label="${done ? '완료' : '미완료'}">
          ${done ? `<svg class="hab-check-icon" width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
        </div>
        <button class="hab-edit-btn" data-id="${h.id}" aria-label="편집" title="편집">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      `;

      // toggle on card click (not edit btn)
      card.addEventListener('click', (e) => {
        if (e.target.closest('.hab-edit-btn')) return;
        onToggle(h.id);
      });
      card.querySelector('.hab-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onEdit(h);
      });
      list.appendChild(card);
    });
  },

  // ── Habit Modal ──
  openHabitModal(habit, onSave, onDelete) {
    const modal = document.getElementById('modal-habit');
    const titleEl = document.getElementById('modal-habit-title');
    const delBtn = document.getElementById('btn-del-habit');
    const saveBtn = document.getElementById('btn-save-habit');

    let selIcon = habit ? ICONS.indexOf(habit.icon) : 0;
    let selColor = habit ? COLORS.indexOf(habit.color) : 0;
    if (selIcon < 0) selIcon = 0;
    if (selColor < 0) selColor = 0;

    titleEl.textContent = habit ? '습관 수정' : '새 습관 추가';
    document.getElementById('hab-name').value = habit?.name || '';
    document.getElementById('hab-sub').value = habit?.sub || '';
    document.getElementById('hab-time').value = habit?.time || '';
    delBtn.style.display = habit ? 'block' : 'none';

    // Icon picker
    const picker = document.getElementById('icon-picker');
    picker.innerHTML = '';
    ICONS.forEach((ic, i) => {
      const el = document.createElement('div');
      el.className = 'icon-opt' + (i === selIcon ? ' sel' : '');
      el.textContent = ic;
      el.addEventListener('click', () => {
        selIcon = i;
        picker.querySelectorAll('.icon-opt').forEach((o, j) => o.className = 'icon-opt' + (j === i ? ' sel' : ''));
      });
      picker.appendChild(el);
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker');
    colorPicker.innerHTML = '';
    COLORS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'color-opt' + (i === selColor ? ' sel' : '');
      el.style.background = c;
      el.title = c;
      el.addEventListener('click', () => {
        selColor = i;
        colorPicker.querySelectorAll('.color-opt').forEach((o, j) => o.className = 'color-opt' + (j === i ? ' sel' : ''));
      });
      colorPicker.appendChild(el);
    });

    // Save
    const saveHandler = () => {
      const name = document.getElementById('hab-name').value.trim();
      if (!name) { document.getElementById('hab-name').focus(); return; }
      onSave({
        name,
        icon: ICONS[selIcon],
        color: COLORS[selColor],
        sub: document.getElementById('hab-sub').value.trim(),
        time: document.getElementById('hab-time').value.trim()
      });
      this.closeModal('modal-habit');
    };

    const delHandler = () => { onDelete(habit.id); this.closeModal('modal-habit'); };

    saveBtn.onclick = saveHandler;
    delBtn.onclick = delHandler;

    this.openModal('modal-habit');
    setTimeout(() => document.getElementById('hab-name').focus(), 350);
  },

  // ── Menu Drawer ──
  openMenu(user) {
    const name = document.getElementById('menu-name');
    const email = document.getElementById('menu-email');
    const avatar = document.getElementById('menu-avatar');
    const logoutBtn = document.getElementById('btn-logout');

    if (user) {
      name.textContent = user.name || '사용자';
      email.textContent = user.email || '';
      avatar.innerHTML = user.picture
        ? `<img src="${user.picture}" alt="${user.name}" referrerpolicy="no-referrer"/>`
        : (user.name?.[0] || '?');
      logoutBtn.style.display = 'flex';
    } else {
      name.textContent = '비로그인';
      email.textContent = '로컬 저장 중';
      avatar.textContent = '👤';
      logoutBtn.style.display = 'none';
    }
    this.openModal('modal-menu');
  },

  // ── Confirm Dialog ──
  confirm(title, msg, onOk) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-ok').onclick = () => { onOk(); this.closeModal('modal-confirm'); };
    document.getElementById('confirm-cancel').onclick = () => this.closeModal('modal-confirm');
    this.openModal('modal-confirm');
  },

  // ── Modal helpers ──
  openModal(id) {
    document.getElementById(id).classList.add('open');
  },
  closeModal(id) {
    document.getElementById(id).classList.remove('open');
  },

  // ── Toast ──
  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },

  // ── Sync indicator ──
  setSyncing(on) {
    const btn = document.getElementById('btn-sync');
    if (on) btn.classList.add('syncing'); else btn.classList.remove('syncing');
  }
};

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
