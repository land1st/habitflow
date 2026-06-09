// js/app.js — 메인 진입점

import { store, driveSync, todayKey } from './store.js';
import { auth } from './auth.js';
import { ui } from './ui.js';

// ── Init ──
async function init() {
  store.load();
  const restored = auth.restore();

  if (restored) {
    driveSync.setToken(auth.accessToken);
    showApp();
    syncInBackground();
  } else if (store.data.habits.length > 0) {
    // 로컬 데이터가 있으면 바로 앱 진입
    showApp();
  } else {
    showLogin();
  }

  bindGlobalEvents();
}

function showLogin() {
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('screen-app').classList.remove('active');
}

function showApp() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  renderAll();
}

function renderAll() {
  ui.renderGreeting(auth.user?.name);
  ui.renderWeekStrip();
  ui.renderHabits(handleToggle, handleEdit);
  ui.updateProgress();
  ui.updateStats();
}

// ── Background Sync ──
async function syncInBackground() {
  if (!auth.accessToken) return;
  ui.setSyncing(true);
  const ok = await driveSync.sync(store.data);
  ui.setSyncing(false);
  if (ok) {
    renderAll();
  }
}

// ── Habit Handlers ──
function handleToggle(habitId) {
  store.toggleCompletion(habitId, todayKey());
  ui.renderHabits(handleToggle, handleEdit);
  ui.updateProgress();
  ui.updateStats();
  autoSync();
}

function handleEdit(habit) {
  ui.openHabitModal(
    habit,
    (updates) => {
      store.updateHabit(habit.id, updates);
      renderAll();
      ui.toast('습관이 수정됐어요 ✏️');
      autoSync();
    },
    (id) => {
      ui.confirm('습관을 삭제할까요?', `"${habit.name}" 기록이 모두 삭제됩니다.`, () => {
        store.deleteHabit(id);
        renderAll();
        ui.toast('삭제됐어요 🗑️');
        autoSync();
      });
    }
  );
}

let _syncTimer = null;
function autoSync() {
  if (!auth.accessToken) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncInBackground, 3000); // 3초 디바운스
}

// ── Global Event Bindings ──
function bindGlobalEvents() {

  // ── Login Screen ──
  document.getElementById('btn-google-login').addEventListener('click', async () => {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.textContent = '로그인 중...';
    try {
      const { user, accessToken } = await auth.signIn();
      driveSync.setToken(accessToken);
      showApp();
      ui.toast(`안녕하세요, ${user.name.split(' ')[0]}님! ☁️ Drive와 연결됐어요`);
      syncInBackground();
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Google로 시작하기`;
      ui.toast('로그인에 실패했어요. CLIENT_ID를 확인해주세요 😅');
    }
  });

  document.getElementById('btn-local-login').addEventListener('click', () => {
    showApp();
  });

  // ── FAB: 습관 추가 ──
  document.getElementById('btn-add-habit').addEventListener('click', () => {
    ui.openHabitModal(
      null,
      (data) => {
        store.addHabit(data);
        renderAll();
        ui.toast('새 습관이 추가됐어요 🌱');
        autoSync();
      },
      () => {}
    );
  });

  // ── Sync Button ──
  document.getElementById('btn-sync').addEventListener('click', async () => {
    if (!auth.accessToken) {
      ui.toast('로그인하면 Drive 동기화가 가능해요 ☁️');
      return;
    }
    ui.setSyncing(true);
    const ok = await driveSync.sync(store.data);
    ui.setSyncing(false);
    if (ok) {
      renderAll();
      ui.toast('동기화 완료 ☁️✅');
    } else {
      ui.toast('동기화에 실패했어요 😅');
    }
  });

  // ── Menu Button ──
  document.getElementById('btn-menu').addEventListener('click', () => {
    ui.openMenu(auth.user);
  });

  // ── Menu: Export ──
  document.getElementById('btn-export').addEventListener('click', () => {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `habitflow_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.closeModal('modal-menu');
    ui.toast('백업 파일을 저장했어요 📤');
  });

  // ── Menu: Import ──
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        store.importJSON(ev.target.result);
        renderAll();
        ui.closeModal('modal-menu');
        ui.toast('데이터를 가져왔어요 📥');
        autoSync();
      } catch (err) {
        ui.toast('파일 형식이 맞지 않아요 😅');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // ── Menu: Share ──
  document.getElementById('btn-share').addEventListener('click', async () => {
    const shareData = {
      title: 'HabitFlow',
      text: '매일 습관을 추적하고 성장하세요 🌱',
      url: window.location.href
    };
    ui.closeModal('modal-menu');
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        if (e.name !== 'AbortError') copyToClipboard(window.location.href);
      }
    } else {
      copyToClipboard(window.location.href);
      ui.toast('링크를 클립보드에 복사했어요 🔗');
    }
  });

  // ── Menu: Reset ──
  document.getElementById('btn-reset').addEventListener('click', () => {
    ui.closeModal('modal-menu');
    ui.confirm(
      '정말 초기화할까요?',
      '모든 습관 데이터와 기록이 삭제됩니다. 되돌릴 수 없어요.',
      () => {
        store.reset();
        renderAll();
        ui.toast('초기화됐어요 🗑️');
      }
    );
  });

  // ── Menu: Logout ──
  document.getElementById('btn-logout').addEventListener('click', () => {
    ui.confirm('로그아웃 할까요?', '로컬 데이터는 유지돼요. Drive 동기화만 중단됩니다.', () => {
      auth.signOut();
      ui.closeModal('modal-menu');
      ui.toast('로그아웃 됐어요 👋');
      renderAll();
    });
  });

  // ── Modal close on overlay click ──
  ['modal-habit','modal-menu','modal-confirm'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      if (e.target.id === id) ui.closeModal(id);
    });
  });

  // ── Enter key on inputs ──
  document.getElementById('hab-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-save-habit').click();
  });
}

// ── Utility ──
function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  });
}

// ── Start ──
init();
