// js/store.js — 로컬스토리지 + Google Drive 동기화

const STORAGE_KEY = 'habitflow_data';
const DRIVE_FILE_NAME = 'habitflow_backup.json';

export const store = {
  data: {
    habits: [],
    completions: {}, // { "YYYY-MM-DD": [habitId, ...] }
    meta: { version: 1, lastSync: null }
  },

  // ── Load from localStorage ──
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) {
      console.warn('store.load failed', e);
    }
    return this.data;
  },

  // ── Save to localStorage ──
  save() {
    try {
      this.data.meta.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('store.save failed', e);
    }
  },

  // ── Habits CRUD ──
  addHabit(habit) {
    const h = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: habit.name,
      icon: habit.icon || '⭐',
      color: habit.color || '#FFE0D0',
      sub: habit.sub || '',
      time: habit.time || '',
      createdAt: new Date().toISOString(),
      order: this.data.habits.length
    };
    this.data.habits.push(h);
    this.save();
    return h;
  },

  updateHabit(id, updates) {
    const idx = this.data.habits.findIndex(h => h.id === id);
    if (idx === -1) return null;
    this.data.habits[idx] = { ...this.data.habits[idx], ...updates };
    this.save();
    return this.data.habits[idx];
  },

  deleteHabit(id) {
    this.data.habits = this.data.habits.filter(h => h.id !== id);
    // remove from all completions
    for (const date in this.data.completions) {
      this.data.completions[date] = this.data.completions[date].filter(hid => hid !== id);
    }
    this.save();
  },

  // ── Completions ──
  toggleCompletion(habitId, date) {
    if (!this.data.completions[date]) this.data.completions[date] = [];
    const idx = this.data.completions[date].indexOf(habitId);
    if (idx === -1) {
      this.data.completions[date].push(habitId);
    } else {
      this.data.completions[date].splice(idx, 1);
    }
    this.save();
    return this.isCompleted(habitId, date);
  },

  isCompleted(habitId, date) {
    return (this.data.completions[date] || []).includes(habitId);
  },

  getCompletionsForDate(date) {
    return this.data.completions[date] || [];
  },

  // ── Stats ──
  getStreak(habitId) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDate(d);
      if ((this.data.completions[key] || []).includes(habitId)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getBestStreak(habitId) {
    let best = 0, cur = 0;
    const dates = Object.keys(this.data.completions).sort();
    for (const date of dates) {
      if ((this.data.completions[date] || []).includes(habitId)) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  },

  getWeeklyRate() {
    if (!this.data.habits.length) return 0;
    const today = new Date();
    let completed = 0, total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDate(d);
      total += this.data.habits.length;
      completed += (this.data.completions[key] || []).length;
    }
    return total ? Math.round((completed / total) * 100) : 0;
  },

  getOverallStreak() {
    // streak where ALL habits completed
    if (!this.data.habits.length) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDate(d);
      const done = (this.data.completions[key] || []).length;
      if (done === this.data.habits.length && done > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getOverallBestStreak() {
    if (!this.data.habits.length) return 0;
    const dates = Object.keys(this.data.completions).sort();
    let best = 0, cur = 0;
    let prev = null;
    for (const date of dates) {
      const done = (this.data.completions[date] || []).length;
      const isAll = done === this.data.habits.length && done > 0;
      if (isAll) {
        if (prev && dayDiff(prev, date) === 1) { cur++; }
        else { cur = 1; }
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
      prev = date;
    }
    return best;
  },

  // ── Import / Export ──
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.habits || !Array.isArray(parsed.habits)) throw new Error('Invalid format');
    // merge completions
    this.data.habits = parsed.habits;
    this.data.completions = { ...this.data.completions, ...parsed.completions };
    this.data.meta = { ...this.data.meta, ...parsed.meta };
    this.save();
  },

  reset() {
    this.data = { habits: [], completions: {}, meta: { version: 1 } };
    localStorage.removeItem(STORAGE_KEY);
  }
};

// ── Google Drive Sync ──
export const driveSync = {
  accessToken: null,
  fileId: null,

  setToken(token) { this.accessToken = token; },

  async findOrCreateFile() {
    // search in appDataFolder
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="${DRIVE_FILE_NAME}"&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const json = await res.json();
    if (json.files && json.files.length > 0) {
      this.fileId = json.files[0].id;
      return { fileId: this.fileId, exists: true, modifiedTime: json.files[0].modifiedTime };
    }
    return { fileId: null, exists: false };
  },

  async upload(data) {
    if (!this.accessToken) return false;
    const body = JSON.stringify(data);
    const metadata = { name: DRIVE_FILE_NAME, parents: this.fileId ? undefined : ['appDataFolder'] };

    if (this.fileId) {
      // update
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'multipart/related; boundary=boundary'
          },
          body: buildMultipart(metadata, body)
        }
      );
      return res.ok;
    } else {
      // create
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'multipart/related; boundary=boundary'
          },
          body: buildMultipart(metadata, body)
        }
      );
      if (res.ok) {
        const json = await res.json();
        this.fileId = json.id;
        return true;
      }
      return false;
    }
  },

  async download() {
    if (!this.accessToken) return null;
    const info = await this.findOrCreateFile();
    if (!info.exists) return null;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (!res.ok) return null;
    return await res.json();
  },

  async sync(localData) {
    try {
      const info = await this.findOrCreateFile();
      if (info.exists) {
        const remote = await this.download();
        if (remote) {
          // merge: take whichever was modified more recently
          const localTime = new Date(localData.meta?.lastModified || 0);
          const remoteTime = new Date(remote.meta?.lastModified || 0);
          if (remoteTime > localTime) {
            store.importJSON(JSON.stringify(remote));
          }
        }
      }
      await this.upload(store.data);
      store.data.meta.lastSync = new Date().toISOString();
      store.save();
      return true;
    } catch (e) {
      console.warn('Drive sync failed', e);
      return false;
    }
  }
};

// ── Helpers ──
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() { return formatDate(new Date()); }

function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function buildMultipart(metadata, body) {
  const boundary = 'boundary';
  return [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    body,
    `\r\n--${boundary}--`
  ].join('');
}
