let clerk = null;
let syncedUserId = null;

function persistMindmendLocalUser(u) {
  const email = u.primaryEmailAddress?.emailAddress || '';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  localStorage.setItem(
    'user',
    JSON.stringify({
      username: name || email || 'User',
      email,
      role: u.publicMetadata?.role || '',
    })
  );
}

function updateAuthStatus(state, message) {
  const pill = document.getElementById('sync-status');
  const label = document.getElementById('sync-status-text');
  if (pill) pill.dataset.state = state;
  if (label) label.textContent = message;
}

function loadClerk() {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Clerk timed out')), 15000);
    const tick = () => {
      if (window.Clerk?.load) {
        window.Clerk.load()
          .then(() => {
            clearTimeout(deadline);
            resolve(window.Clerk);
          })
          .catch(reject);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function mountSignIn() {
  const el = document.getElementById('clerk-sign-in');
  if (!el || !clerk) return;
  const origin = window.location.origin;
  clerk.mountSignIn(el, {
    appearance: {
      elements: {
        card: '!bg-transparent !border-none !shadow-none',
        headerTitle: '!text-white !text-2xl',
        headerSubtitle: '!text-white/50 !text-sm',
        formFieldLabel: '!text-white/70 !text-sm',
        formFieldInput:
          '!bg-white/5 !border-white/10 !text-white !rounded-lg !py-3',
        formButtonPrimary:
          '!bg-white !text-black !rounded-lg !font-semibold !py-3 hover:!shadow-[0_0_30px_rgba(255,255,255,0.5)]',
        socialButtonsBlockButton:
          '!bg-white/5 hover:!bg-white/10 !text-white !border-white/10 !rounded-lg !py-3 !transition-all !duration-300',
        socialButtonsBlockButton__facebook:
          'hover:!shadow-[0_0_25px_rgba(24,119,242,0.8),0_0_50px_rgba(24,119,242,0.4)]',
        socialButtonsBlockButton__twitter:
          'hover:!shadow-[0_0_25px_rgba(255,255,255,0.6),0_0_50px_rgba(255,255,255,0.3)]',
        socialButtonsBlockButtonText: '!text-white !font-medium',
        socialButtonsProviderIcon:
          '!brightness-100 !drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] hover:!drop-shadow-[0_0_20px_rgba(255,255,255,1)]',
        socialButtonsProviderIcon__facebook:
          '!drop-shadow-[0_0_10px_rgba(24,119,242,0.8)] hover:!drop-shadow-[0_0_20px_rgba(24,119,242,1)]',
        socialButtonsProviderIcon__twitter:
          '!drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] hover:!drop-shadow-[0_0_20px_rgba(255,255,255,1)]',
        footerActionLink: '!text-purple-400 hover:!text-purple-300',
      },
    },
    signInFallbackRedirectUrl: `${origin}/index.html`,
    signUpFallbackRedirectUrl: `${origin}/index.html`,
    afterSignInUrl: `${origin}/index.html`,
    afterSignUpUrl: `${origin}/index.html`,
  });
}

function redirectForUser() {
  const isAdmin = clerk.user.publicMetadata?.role === 'admin';
  return isAdmin ? '/admin.html' : '/index.html';
}

async function syncAndRedirect() {
  if (!clerk?.user?.id || !clerk.session) return;

  if (clerk.user.id === syncedUserId) {
    updateAuthStatus('success', 'Already synced. Redirecting…');
    persistMindmendLocalUser(clerk.user);
    setTimeout(() => {
      window.location.href = redirectForUser();
    }, 400);
    return;
  }

  try {
    updateAuthStatus('syncing', 'Syncing profile…');
    const token = await clerk.session.getToken();
    if (!token) throw new Error('Could not read session token. Try signing in again.');

    const res = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile: {
          userId: clerk.user.id,
          email: clerk.user.primaryEmailAddress?.emailAddress || '',
          firstName: clerk.user.firstName || '',
          lastName: clerk.user.lastName || '',
          imageUrl: clerk.user.imageUrl || '',
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Sync failed (${res.status})`);

    syncedUserId = clerk.user.id;
    persistMindmendLocalUser(clerk.user);

    const msg =
      data.degraded === true
        ? 'Signed in (database offline — journals may not save until connected). Redirecting…'
        : clerk.user.publicMetadata?.role === 'admin'
          ? 'Admin access granted. Redirecting…'
          : 'Signed in. Redirecting…';

    updateAuthStatus('success', msg);
    setTimeout(() => {
      window.location.href = redirectForUser();
    }, data.degraded ? 1200 : 800);
  } catch (e) {
    console.error(e);
    updateAuthStatus('error', e.message || 'Sync error');
  }
}

async function init() {
  try {
    updateAuthStatus('loading', 'Loading sign-in…');
    clerk = await loadClerk();
    mountSignIn();
    clerk.addListener(({ user }) => {
      if (user) syncAndRedirect();
      else {
        syncedUserId = null;
        updateAuthStatus('idle', 'Ready to sign in');
      }
    });

    if (clerk.user) await syncAndRedirect();
  } catch (e) {
    console.error(e);
    updateAuthStatus('error', e.message === 'Clerk timed out' ? 'Sign-in timed out — refresh the page' : 'Could not load sign-in');
    const holder = document.getElementById('clerk-sign-in');
    if (holder) {
      holder.innerHTML = `<div class="text-center text-white/70 text-sm p-6">${e.message}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
