(() => {
  if (!localStorage.getItem('mindmend-theme') && localStorage.getItem('theme')) {
    localStorage.setItem('mindmend-theme', localStorage.getItem('theme'));
  }
  const legacyBold = localStorage.getItem('boldText');
  if (legacyBold !== null && localStorage.getItem('mindmend-bold-text') === null) {
    localStorage.setItem('mindmend-bold-text', legacyBold === 'true' ? 'true' : 'false');
  }
})();

function waitForClerk() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    function tick() {
      if (Date.now() - started > 20000) {
        reject(new Error('timeout'));
        return;
      }
      if (!window.Clerk?.load) {
        setTimeout(tick, 50);
        return;
      }
      window.Clerk.load()
        .then(() => {
          if (!window.Clerk.user) {
            window.location.href = '/login.html';
            reject(new Error('nosession'));
            return;
          }
          resolve(window.Clerk);
        })
        .catch(() => {
          window.location.href = '/login.html';
          reject(new Error('loadfail'));
        });
    }
    tick();
  });
}

function persistUserSnapshot(user) {
  const email = user.primaryEmailAddress?.emailAddress || '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  localStorage.setItem(
    'user',
    JSON.stringify({
      username: name || email || 'User',
      email,
      role: user.publicMetadata?.role || '',
    })
  );
}

function paintTheme() {
  const theme = localStorage.getItem('mindmend-theme') || 'dark';
  const bold = localStorage.getItem('mindmend-bold-text') === 'true';
  const elDark = document.getElementById('theme-dark');
  const elLight = document.getElementById('theme-light');
  const body = document.body;
  body.classList.remove('bold-text');

  if (theme === 'light') {
    body.classList.add('light-mode');
    elLight?.classList.add('bg-white/10');
    elLight?.classList.remove('bg-white/5', 'text-white/50');
    elDark?.classList.remove('bg-white/10');
    elDark?.classList.add('bg-white/5', 'text-white/50');
  } else {
    body.classList.remove('light-mode');
    elDark?.classList.add('bg-white/10');
    elDark?.classList.remove('bg-white/5', 'text-white/50');
    elLight?.classList.remove('bg-white/10');
    elLight?.classList.add('bg-white/5', 'text-white/50');
  }

  const boldToggle = document.getElementById('bold-text-toggle');
  if (boldToggle) boldToggle.checked = bold;
  if (bold) body.classList.add('bold-text');
}

waitForClerk()
  .then((clerk) => {
    const u = clerk.user;
    persistUserSnapshot(u);

    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    const adminSection = document.getElementById('admin-section');

    if (nameEl) nameEl.textContent = u.fullName || u.firstName || 'User';
    if (emailEl) emailEl.textContent = u.primaryEmailAddress?.emailAddress || '';
    if (avatarEl && u.imageUrl) {
      avatarEl.innerHTML = `<img src="${u.imageUrl}" alt="" class="w-full h-full rounded-full object-cover"/>`;
    } else if (avatarEl) {
      const letter = (
        ((u.fullName || u.firstName || u.primaryEmailAddress?.emailAddress || 'U') + '').trim()[0] || 'U'
      ).toUpperCase();
      avatarEl.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white text-2xl font-bold">${letter}</div>`;
    }

    if (adminSection && u.publicMetadata?.role === 'admin') {
      adminSection.classList.remove('hidden');
    }

    paintTheme();

    document.getElementById('theme-dark')?.addEventListener('click', () => {
      localStorage.setItem('mindmend-theme', 'dark');
      paintTheme();
    });
    document.getElementById('theme-light')?.addEventListener('click', () => {
      localStorage.setItem('mindmend-theme', 'light');
      paintTheme();
    });
    document.getElementById('bold-text-toggle')?.addEventListener('change', (e) => {
      const on = e.target.checked;
      localStorage.setItem('mindmend-bold-text', on ? 'true' : 'false');
      paintTheme();
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to sign out?')) return;
      localStorage.removeItem('user');
      await clerk.signOut();
      window.location.href = '/login.html';
    });
  })
  .catch(() => {});
