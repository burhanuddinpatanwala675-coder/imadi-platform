const state = { user: null, csrf: null, inquiries: [], posts: [], users: [], cases: [], subscribers: [], settings: null, editingPostId: null, editingCaseId: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

function setStatus(message = '', type = '') {
    const status = $('#dashboard-status');
    status.textContent = message;
    status.className = `status ${type}`;
}

async function csrf() {
    if (state.csrf) return state.csrf;
    const response = await fetch('/api/csrf', { credentials: 'include' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Unable to establish a secure session.');
    state.csrf = result.data.token;
    return state.csrf;
}

async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = new Headers(options.headers || {});
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-csrf-token', await csrf());
    if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, method, headers, credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error?.message || 'The request could not be completed.');
    return result;
}
function asDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }); }

function showPanel(name) {
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${name}-panel`));
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.panel === name));
    $('#panel-label').textContent = name;
    $('#panel-title').textContent = ({ overview: 'Good to see you.', inquiries: 'Keep opportunities moving.', content: 'Share useful thinking.', 'case-studies': 'Show the work behind the results.', subscribers: 'Build a permission-based audience.', settings: 'Keep your public details current.', team: 'Manage your team.' })[name];
    $('.sidebar').classList.remove('open');
    $('#mobile-menu').setAttribute('aria-expanded', 'false');
}

function statusBadge(status) { return `<span class="badge ${escapeHtml(status)}">${escapeHtml(status.replace(/_/g, ' '))}</span>`; }

function renderDashboard(data) {
    const count = (status) => data.statusBreakdown.find((item) => item.status === status)?._count || 0;
    $('#stat-inquiries').textContent = data.leadTotal;
    $('#stat-new').textContent = count('new');
    $('#stat-subscribers').textContent = data.newsletterGrowth;
    $('#recent-inquiries').innerHTML = data.recentLeads.length ? data.recentLeads.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.companyName)}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.createdAt)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No inquiries yet.</td></tr>';
}

function renderInquiries() {
    const filter = $('#inquiry-filter').value;
    const items = filter ? state.inquiries.filter((item) => item.status === filter) : state.inquiries;
    $('#inquiry-list').innerHTML = items.length ? items.map((item) => `<article class="inquiry-card"><div><h3>${escapeHtml(item.name)}</h3><p class="inquiry-meta">${escapeHtml(item.workEmail)} · ${escapeHtml(item.companyName)}</p>${statusBadge(item.status)}</div><p>${escapeHtml(item.message)}</p><label>Status<select class="inquiry-status" data-id="${item.id}">${['new','contacted','qualified','proposal_sent','won','lost','archived'].map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status.replace(/_/g, ' ')}</option>`).join('')}</select></label><label>Assign to<select class="inquiry-assignee" data-id="${item.id}"><option value="">Unassigned</option>${state.users.map((user) => `<option value="${user.id}" ${item.assignedToId === user.id ? 'selected' : ''}>${escapeHtml(user.fullName)} (${escapeHtml(user.role)})</option>`).join('')}</select></label><label>Internal notes<textarea class="inquiry-notes" data-id="${item.id}">${escapeHtml(item.notes || '')}</textarea></label><div class="inquiry-actions"><button class="primary-button save-inquiry" data-id="${item.id}">Save changes</button></div></article>`).join('') : '<p class="empty">No inquiries match this filter.</p>';
}

function renderPosts() {
    const list = $('#blog-list');
    if (!list) return;
    list.innerHTML = state.posts.length ? state.posts.map((post) => `<tr><td><strong>${escapeHtml(post.title)}</strong><br><small>${escapeHtml(post.slug)}</small></td><td>${statusBadge(post.status)}</td><td>${escapeHtml(post.category)}</td><td>${formatDate(post.updatedAt)}</td><td><div class="row-actions"><button class="text-button edit-post" data-id="${post.id}">Edit</button><button class="text-button danger-button delete-post" data-id="${post.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No posts yet.</td></tr>';
}

function renderUsers() {
    const list = $('#user-list');
    if (!list) return;
    list.innerHTML = state.users.length ? state.users.map((user) => `<tr><td><strong>${escapeHtml(user.fullName)}</strong><br><small>${escapeHtml(user.email)}</small></td><td>${statusBadge(user.role)}</td><td>${formatDate(user.lastLoginAt)}</td><td>${user.id === state.user.id ? '<small>Current user</small>' : `<button class="text-button danger-button delete-user" data-id="${user.id}">Remove</button>`}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No team members found.</td></tr>';
}

function renderCases() {
    const list = $('#case-list'); if (!list) return;
    list.innerHTML = state.cases.length ? state.cases.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.industry)}</small></td><td>${escapeHtml(item.clientName || '—')}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.updatedAt)}</td><td><div class="row-actions"><button class="text-button edit-case" data-id="${item.id}">Edit</button><button class="text-button danger-button delete-case" data-id="${item.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No case studies yet.</td></tr>';
}
function renderSubscribers() {
    const list = $('#subscriber-list'); if (!list) return;
    list.innerHTML = state.subscribers.length ? state.subscribers.map((item) => `<tr><td><strong>${escapeHtml(item.email)}</strong></td><td>${escapeHtml(item.firstName || '—')}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.createdAt)}</td><td><button class="text-button subscriber-status" data-id="${item.id}" data-status="${item.status === 'active' ? 'unsubscribed' : 'active'}">${item.status === 'active' ? 'Unsubscribe' : 'Reactivate'}</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No subscribers yet.</td></tr>';
}
function renderSettings() { if (!state.settings) return; $('#setting-company').value = state.settings.companyName || ''; $('#setting-email').value = state.settings.primaryEmail || ''; $('#setting-phone').value = state.settings.phoneNumber || ''; $('#setting-address').value = state.settings.address || ''; $('#setting-cta').value = state.settings.consultationCTA || ''; $('#setting-analytics').value = state.settings.analyticsId || ''; $('#setting-notifications').value = (state.settings.notificationEmails || []).join(', '); }

async function loadAll() {
    const [dashboard, inquiries, posts, cases] = await Promise.all([api('/api/admin/dashboard'), api('/api/admin/inquiries'), state.user.role === 'sales' ? Promise.resolve({ data: [] }) : api('/api/admin/blog'), state.user.role === 'sales' ? Promise.resolve({ data: [] }) : api('/api/admin/case-studies')]);
    state.inquiries = inquiries.data;
    state.posts = posts.data;
    state.cases = cases.data;
    if (state.user.role === 'super_admin') { const [users, subscribers, settings] = await Promise.all([api('/api/admin/users'), api('/api/admin/subscribers'), api('/api/admin/settings')]); state.users = users.data; state.subscribers = subscribers.data; state.settings = settings.data; }
    renderDashboard(dashboard.data); renderInquiries(); renderPosts(); renderUsers(); renderCases(); renderSubscribers(); renderSettings();
}

function openCase(item = null) { state.editingCaseId = item?.id || null; $('#case-editor').hidden = false; $('#case-editor-title').textContent = item ? 'Edit case study' : 'New case study'; $('#case-title').value = item?.title || ''; $('#case-slug').value = item?.slug || ''; $('#case-client').value = item?.clientName || ''; $('#case-industry').value = item?.industry || ''; $('#case-status').value = item?.status || 'draft'; $('#case-cover').value = item?.coverImageUrl || ''; $('#case-challenge').value = item?.challenge || ''; $('#case-solution').value = item?.solution || ''; $('#case-outcomes').value = item?.outcomes || ''; }

function openPost(post = null) {
    state.editingPostId = post?.id || null;
    $('#post-editor').hidden = false;
    $('#post-editor-title').textContent = post ? 'Edit post' : 'New post';
    $('#post-title').value = post?.title || '';
    $('#post-slug').value = post?.slug || '';
    $('#post-category').value = post?.category || 'Technology';
    $('#post-status').value = post?.status || 'draft';
    $('#post-tags').value = post?.tags?.join(', ') || '';
    $('#post-cover').value = post?.coverImageUrl || '';
    $('#post-excerpt').value = post?.excerpt || '';
    $('#post-content').value = post?.content || '';
    $('#post-title').focus();
}

async function boot() {
    try {
        const me = await api('/api/admin/auth/me');
        state.user = me.data.user;
        $('#welcome').textContent = `${state.user.fullName} · ${state.user.role.replace(/_/g, ' ')}`;
        if (state.user.role === 'sales') document.querySelectorAll('[data-editor-only]').forEach((element) => element.remove());
        if (state.user.role !== 'super_admin') document.querySelectorAll('[data-admin-only]').forEach((element) => element.remove());
        await loadAll();
    } catch { window.location.replace('index.html'); }
}

document.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
        if (button.dataset.panel) return showPanel(button.dataset.panel);
        if (button.dataset.showPanel) return showPanel(button.dataset.showPanel);
        if (button.id === 'mobile-menu') { const open = $('.sidebar').classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); return; }
        if (button.id === 'new-post') return openPost();
        if (button.id === 'new-case') return openCase();
        if (button.id === 'close-case-editor' || button.id === 'cancel-case') { $('#case-editor').hidden = true; return; }
        if (button.id === 'close-post-editor' || button.id === 'cancel-post') { $('#post-editor').hidden = true; return; }
        if (button.id === 'new-user') { $('#user-editor').hidden = false; $('#user-name').focus(); return; }
        if (button.id === 'close-user-editor' || button.id === 'cancel-user') { $('#user-editor').hidden = true; return; }
        if (button.classList.contains('edit-post')) return openPost(state.posts.find((post) => post.id === button.dataset.id));
        if (button.classList.contains('edit-case')) return openCase(state.cases.find((item) => item.id === button.dataset.id));
        if (button.classList.contains('delete-case')) { if (!confirm('Delete this case study permanently?')) return; await api(`/api/admin/case-studies/${button.dataset.id}`, { method: 'DELETE' }); await loadAll(); return setStatus('Case study deleted.', 'success'); }
        if (button.classList.contains('subscriber-status')) { await api(`/api/admin/subscribers/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); await loadAll(); return setStatus('Subscriber updated.', 'success'); }
        if (button.classList.contains('delete-post')) { if (!confirm('Delete this post permanently?')) return; await api(`/api/admin/blog/${button.dataset.id}`, { method: 'DELETE' }); await loadAll(); return setStatus('Post deleted.', 'success'); }
        if (button.classList.contains('delete-user')) { if (!confirm('Remove this team member?')) return; await api(`/api/admin/users/${button.dataset.id}`, { method: 'DELETE' }); await loadAll(); return setStatus('Team member removed.', 'success'); }
        if (button.classList.contains('save-inquiry')) { const id = button.dataset.id; await api(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status: $(`.inquiry-status[data-id="${id}"]`).value, assignedToId: $(`.inquiry-assignee[data-id="${id}"]`).value || null, notes: $(`.inquiry-notes[data-id="${id}"]`).value }) }); await loadAll(); return setStatus('Inquiry updated.', 'success'); }
        if (button.id === 'logout') { await api('/api/admin/auth/logout', { method: 'POST' }); window.location.replace('index.html'); }
    } catch (error) { setStatus(error.message, 'error'); }
});

$('#inquiry-filter').addEventListener('change', renderInquiries);
$('#post-form').addEventListener('submit', async (event) => { event.preventDefault(); try { let coverImageUrl = $('#post-cover').value.trim() || null; const file = $('#post-image-file').files[0]; if (file) { if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.'); setStatus('Uploading image…'); coverImageUrl = (await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ filename: file.name, dataUrl: await asDataUrl(file) }) })).data.url; } const body = { title: $('#post-title').value.trim(), slug: $('#post-slug').value.trim(), category: $('#post-category').value.trim(), status: $('#post-status').value, tags: $('#post-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean), coverImageUrl, excerpt: $('#post-excerpt').value.trim(), content: $('#post-content').value.trim() }; await api(state.editingPostId ? `/api/admin/blog/${state.editingPostId}` : '/api/admin/blog', { method: state.editingPostId ? 'PATCH' : 'POST', body: JSON.stringify(body) }); $('#post-editor').hidden = true; await loadAll(); setStatus(`Post ${state.editingPostId ? 'updated' : 'created'}.`, 'success'); } catch (error) { setStatus(error.message, 'error'); } });
$('#case-form').addEventListener('submit', async (event) => { event.preventDefault(); try { let coverImageUrl = $('#case-cover').value.trim() || null; const file = $('#case-image-file').files[0]; if (file) { if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.'); setStatus('Uploading image…'); coverImageUrl = (await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ filename: file.name, dataUrl: await asDataUrl(file) }) })).data.url; } const body = { title: $('#case-title').value.trim(), slug: $('#case-slug').value.trim(), clientName: $('#case-client').value.trim() || null, industry: $('#case-industry').value.trim(), status: $('#case-status').value, coverImageUrl, galleryImages: [], challenge: $('#case-challenge').value.trim(), solution: $('#case-solution').value.trim(), outcomes: $('#case-outcomes').value.trim() }; await api(state.editingCaseId ? `/api/admin/case-studies/${state.editingCaseId}` : '/api/admin/case-studies', { method: state.editingCaseId ? 'PATCH' : 'POST', body: JSON.stringify(body) }); $('#case-editor').hidden = true; await loadAll(); setStatus(`Case study ${state.editingCaseId ? 'updated' : 'created'}.`, 'success'); } catch (error) { setStatus(error.message, 'error'); } });
$('#settings-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ companyName: $('#setting-company').value.trim(), primaryEmail: $('#setting-email').value.trim(), phoneNumber: $('#setting-phone').value.trim() || null, address: $('#setting-address').value.trim() || null, consultationCTA: $('#setting-cta').value.trim() || null, analyticsId: $('#setting-analytics').value.trim() || null, notificationEmails: $('#setting-notifications').value.split(',').map((item) => item.trim()).filter(Boolean) }) }); await loadAll(); setStatus('Site settings saved.', 'success'); } catch (error) { setStatus(error.message, 'error'); } });
$('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ fullName: $('#user-name').value.trim(), email: $('#user-email').value.trim(), role: $('#user-role').value, password: $('#user-password').value }) }); event.currentTarget.reset(); $('#user-editor').hidden = true; await loadAll(); setStatus('Team member added.', 'success'); } catch (error) { setStatus(error.message, 'error'); } });

boot();
