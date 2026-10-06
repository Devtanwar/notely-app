let isRegisterMode = false;
let editModeId = null;
let showingAdmin = false;

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('authTitle').textContent = isRegisterMode ? 'Create an account' : 'Welcome back';
  document.getElementById('authBtn').textContent = isRegisterMode ? 'Register' : 'Sign In';
  document.getElementById('switchText').textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('switchLink').textContent = isRegisterMode ? 'Sign In' : 'Register';
}

async function handleAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';

  if (!email || !password) return alert('Please enter both email and password.');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Authentication failed');

    if (isRegisterMode) {
      alert('Account created! Sign in now.');
      toggleAuthMode();
    } else {
      localStorage.setItem('token', data.token);
      localStorage.setItem('email', data.email);
      localStorage.setItem('role', data.role);
      initDashboard();
    }
  } catch (err) {
    alert('Server unreachable. Make sure your server is running.');
  }
}

function initDashboard() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (token) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('notesSection').classList.remove('hidden');
    document.getElementById('userGreeting').textContent = localStorage.getItem('email');

    if (role === 'admin') {
      document.getElementById('roleBadge').classList.remove('hidden');
      document.getElementById('toggleAdminBtn').classList.remove('hidden');
    } else {
      document.getElementById('roleBadge').classList.add('hidden');
      document.getElementById('toggleAdminBtn').classList.add('hidden');
      document.getElementById('adminWorkspace').classList.add('hidden');
      document.getElementById('personalWorkspace').classList.remove('hidden');
      showingAdmin = false;
    }

    loadNotes();
  } else {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('notesSection').classList.add('hidden');
  }
}

function logout() {
  localStorage.clear();
  showingAdmin = false;
  document.getElementById('adminWorkspace').classList.add('hidden');
  document.getElementById('personalWorkspace').classList.remove('hidden');
  initDashboard();
}

function toggleAdminPanel() {
  showingAdmin = !showingAdmin;
  const adminWorkspace = document.getElementById('adminWorkspace');
  const personalWorkspace = document.getElementById('personalWorkspace');
  const toggleBtn = document.getElementById('toggleAdminBtn');

  if (showingAdmin) {
    personalWorkspace.classList.add('hidden');
    adminWorkspace.classList.remove('hidden');
    toggleBtn.textContent = 'Back to Workspace';
    loadAdminOverview();
  } else {
    personalWorkspace.classList.remove('hidden');
    adminWorkspace.classList.add('hidden');
    toggleBtn.textContent = 'All Users & Notes';
    loadNotes();
  }
}

async function loadAdminOverview() {
  if (localStorage.getItem('role') !== 'admin') return;

  const container = document.getElementById('adminReportContainer');
  container.innerHTML = '<p style="color:var(--text-dim); text-align:center; padding: 20px;">Loading users and notes...</p>';

  try {
    const res = await fetch('/admin/overview', {
      headers: { 'Authorization': localStorage.getItem('token') }
    });

    if (!res.ok) {
      const errData = await res.json();
      container.innerHTML = `<p style="color:var(--danger); text-align:center; padding: 20px;">${errData.message || 'Error loading records'}</p>`;
      return;
    }

    const report = await res.json();
    container.innerHTML = '';

    if (!report.length) {
      container.innerHTML = '<p style="color:var(--text-dim); text-align:center; padding: 20px;">No registered users found.</p>';
      return;
    }

    report.forEach(u => {
      const userCard = document.createElement('div');
      userCard.className = 'user-block';
      
      let notesHTML = '';
      if (!u.notes || u.notes.length === 0) {
        notesHTML = '<p style="font-size:13px; color:var(--text-dim); margin-top:6px;">No notes created yet.</p>';
      } else {
        notesHTML = u.notes.map(n => `
          <div class="sub-note-card">
            <div style="font-weight:600; font-size:14px; color:#f8fafc; margin-bottom:4px;">${escapeHTML(n.title)}</div>
            <div style="font-size:13px; color:var(--text-dim);">${escapeHTML(n.description)}</div>
          </div>
        `).join('');
      }

      userCard.innerHTML = `
        <div class="user-block-header">
          <div>
            <strong style="color:#ffffff; font-size:15px;">${escapeHTML(u.email)}</strong>
            <span style="font-size:11px; margin-left:8px; color:#94a3b8;">(${u.role})</span>
          </div>
          <span style="font-size:12px; color:#f472b6;">${u.notesCount} Notes</span>
        </div>
        <div>${notesHTML}</div>
      `;

      container.appendChild(userCard);
    });
  } catch (err) {
    console.error('Failed to load admin overview:', err);
    container.innerHTML = '<p style="color:var(--danger); text-align:center; padding: 20px;">Failed to reach backend server.</p>';
  }
}

async function loadNotes() {
  try {
    const res = await fetch('/notes', {
      headers: { 'Authorization': localStorage.getItem('token') }
    });

    if (res.status === 401) return logout();

    const notes = await res.json();
    const container = document.getElementById('notesContainer');
    const countBadge = document.getElementById('notesCount');
    
    container.innerHTML = '';
    countBadge.textContent = Array.isArray(notes) ? `${notes.length} Notes` : '0 Notes';

    if (!Array.isArray(notes) || notes.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-dim);">No notes yet. Create your first note above!</p>';
      return;
    }

    [...notes].reverse().forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.innerHTML = `
        <div>
          <h3 style="font-size:16px; margin-bottom:6px;">${escapeHTML(note.title)}</h3>
          <p style="font-size:14px; color:var(--text-dim);">${escapeHTML(note.description)}</p>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-action" onclick="startEdit('${note._id}', '${escapeAttr(note.title)}', '${escapeAttr(note.description)}')">Edit</button>
          <button class="btn-action" style="color:var(--danger);" onclick="deleteNote('${note._id}')">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function submitNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const description = document.getElementById('noteDesc').value.trim();

  if (!title || !description) return alert('Both title and description are required.');

  const url = editModeId ? `/notes/${editModeId}` : '/notes';
  const method = editModeId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': localStorage.getItem('token')
    },
    body: JSON.stringify({ title, description })
  });

  if (res.ok) {
    cancelEdit();
    loadNotes();
  } else {
    alert('Action failed.');
  }
}

function startEdit(id, title, desc) {
  editModeId = id;
  document.getElementById('noteTitle').value = title;
  document.getElementById('noteDesc').value = desc;
  document.getElementById('submitBtn').textContent = 'Update Note';
  document.getElementById('cancelBtn').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editModeId = null;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteDesc').value = '';
  document.getElementById('submitBtn').textContent = 'Create Note';
  document.getElementById('cancelBtn').classList.add('hidden');
}

async function deleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  await fetch(`/notes/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': localStorage.getItem('token') }
  });
  loadNotes();
}

function escapeHTML(str) {
  return str ? str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag)) : '';
}

function escapeAttr(str) {
  return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ') : '';
}

// Start app
initDashboard();