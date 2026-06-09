// js/auth.js — Google Identity Services (GIS) OAuth

// ⚠️  아래 CLIENT_ID를 Google Cloud Console에서 발급받은 값으로 교체하세요
// https://console.cloud.google.com/apis/credentials
export const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata profile email';

export const auth = {
  user: null,       // { name, email, picture }
  accessToken: null,

  // 저장된 세션 복원
  restore() {
    try {
      const saved = sessionStorage.getItem('hf_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.user = parsed.user;
        this.accessToken = parsed.accessToken;
        return true;
      }
    } catch (e) {}
    return false;
  },

  // GIS implicit flow — 팝업으로 Google 로그인
  async signIn() {
    return new Promise((resolve, reject) => {
      if (!window.google) {
        reject(new Error('Google Identity Services가 로드되지 않았어요.'));
        return;
      }

      // 1) ID 토큰 → 사용자 정보
      const idClient = google.accounts.id;
      idClient.initialize({
        client_id: CLIENT_ID,
        callback: async (resp) => {
          if (!resp.credential) { reject(new Error('로그인 취소됨')); return; }
          const payload = parseJwt(resp.credential);
          this.user = { name: payload.name, email: payload.email, picture: payload.picture };

          // 2) OAuth2 토큰 → Drive 접근권한
          try {
            const token = await this._getAccessToken();
            this.accessToken = token;
            sessionStorage.setItem('hf_user', JSON.stringify({ user: this.user, accessToken: this.accessToken }));
            resolve({ user: this.user, accessToken: this.accessToken });
          } catch (e) {
            reject(e);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      idClient.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap이 안 되면 팝업으로 직접 열기
          idClient.renderButton(
            Object.assign(document.createElement('div'), { id: '__gsi_hidden' }),
            { theme: 'outline', size: 'large' }
          );
          // fallback: tokenClient만으로 진행
          this._getAccessToken()
            .then(token => {
              this.accessToken = token;
              // user info via tokeninfo
              return fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
                headers: { Authorization: `Bearer ${token}` }
              });
            })
            .then(r => r.json())
            .then(info => {
              this.user = { name: info.name, email: info.email, picture: info.picture };
              sessionStorage.setItem('hf_user', JSON.stringify({ user: this.user, accessToken: this.accessToken }));
              resolve({ user: this.user, accessToken: this.accessToken });
            })
            .catch(reject);
        }
      });
    });
  },

  _getAccessToken() {
    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          resolve(resp.access_token);
        }
      });
      tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  signOut() {
    if (window.google) google.accounts.id.disableAutoSelect();
    sessionStorage.removeItem('hf_user');
    this.user = null;
    this.accessToken = null;
  },

  isLoggedIn() { return !!this.user; }
};

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}
