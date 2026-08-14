(() => { const icon = document.createElement('link'); icon.rel = 'icon'; icon.type = 'image/svg+xml'; icon.href = 'favicon.svg'; document.head.append(icon); })();

(async () => {
    try {
        const config = await fetch('config.json').then(r => r.json());
        const response = await fetch(`${config.apiBaseUrl}/api/settings/public`);
        const result = await response.json();

        if (!result.success) return;

        const settings = result.data;

        let whatsappNumber = (settings.phoneNumber || '').replace(/\D/g, '');
        // Site settings may contain a Pakistani local mobile number (03xx...).
        // WhatsApp requires an international E.164-style number without a plus sign.
        if (/^0\d{10}$/.test(whatsappNumber)) whatsappNumber = `92${whatsappNumber.slice(1)}`;
        if (/^3\d{9}$/.test(whatsappNumber)) whatsappNumber = `92${whatsappNumber}`;
        if (whatsappNumber) {
            const button = document.createElement('a');
            button.className = 'whatsapp-button';
            button.href = `https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent('Hello Imadi Technologies, I would like to speak with your team.')}`;
            button.target = '_blank';
            button.rel = 'noopener noreferrer';
            button.setAttribute('aria-label', 'Chat with our team on WhatsApp');
            button.innerHTML = '<span aria-hidden="true">⌕</span><span>Chat on WhatsApp</span>';
            document.body.append(button);
        }

        const contact = document.querySelector('#company-contact');
        if (contact) {
            contact.textContent = `${settings.primaryEmail || ''} · ${settings.address || ''}`;
        }
        document.querySelectorAll('[data-company-contact]').forEach((element) => {
            element.textContent = [settings.primaryEmail, settings.phoneNumber, settings.address].filter(Boolean).join(' · ') || 'Contact our team for verified details.';
        });

        const linkedin = document.querySelector('#linkedin-link');
        if (linkedin && settings.socialLinks?.linkedin) {
            linkedin.href = settings.socialLinks.linkedin;
        }

        const xLink = document.querySelector('#x-link');
        if (xLink && settings.socialLinks?.x) {
            xLink.href = settings.socialLinks.x;
        }
    } catch (error) {
        console.warn('Settings loading failed:', error);
    }
})(); const nav = document.querySelector('.nav'), menu = document.querySelector('.menu');
document.querySelectorAll('a[href="[Privacy policy URL]"]').forEach(a => a.href = 'privacy.html'); document.querySelectorAll('a[href="[Terms URL]"]').forEach(a => a.href = 'terms.html');
if (menu) { menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', open); menu.textContent = open ? '×' : '☰' }); document.querySelectorAll('.navlinks a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '☰' })) }
const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target) } }), { threshold: .1 }); document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
(() => {
    const form = document.querySelector('#contact-form'); if (!form) return; const controls = [...form.querySelectorAll('input,select,textarea')]; const messageFor = field => { const label = field.closest('.field')?.querySelector('label')?.textContent || 'This field'; const value = field.value.trim(); if (!value) return `${label} is required.`; if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid work email.'; return '' }; const validate = field => { const wrapper = field.closest('.field'); if (!wrapper) return true; const message = messageFor(field); let note = wrapper.querySelector('.validation-message'); if (!note) { note = document.createElement('small'); note.className = 'validation-message'; note.setAttribute('aria-live', 'polite'); wrapper.append(note) } wrapper.classList.toggle('has-error', Boolean(message)); wrapper.classList.toggle('is-valid', !message); field.setAttribute('aria-invalid', String(Boolean(message))); note.textContent = message || 'Looks good.'; return !message }; controls.forEach(field => { field.addEventListener('blur', () => validate(field)); field.addEventListener('input', () => { if (field.closest('.field').classList.contains('has-error')) validate(field) }); field.addEventListener('change', () => validate(field)) }); form.addEventListener('submit', async e => {
        e.preventDefault(); const valid = controls.map(validate).every(Boolean), status = document.querySelector('#form-status'); if (!valid) { status.style.color = '#ff9e9e'; status.textContent = 'Please review the highlighted fields.'; controls.find(f => f.getAttribute('aria-invalid') === 'true')?.focus(); return } try {

            const config = await fetch('config.json')
                .then(r => r.json());


            const formData = {

                name:
                    document.querySelector('#name').value,

                workEmail:
                    document.querySelector('#email').value,

                companyName:
                    document.querySelector('#company').value,

                phoneNumber:
                    document.querySelector('#phone').value,

                projectType:
                    document.querySelector('#project').value,

                budgetRange:
                    document.querySelector('#budget').value,

                message:
                    document.querySelector('#message').value,

                sourcePage:
                    document.querySelector('#sourcePage').value

            };



            const response = await fetch(
                `${config.apiBaseUrl}/api/contact`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(formData)
                }
            );



            const result = await response.json();


            if (!result.success) {

                throw new Error(
                    JSON.stringify(result.error)
                );

            }


            status.style.color = '#3ee6a8';

            status.textContent =
                'Thank you — your enquiry has been submitted successfully.';


            form.reset();


        }
            catch (error) {

                console.error(
                    'Contact submission failed:',
                    error
                );


                status.style.color = '#ff9e9e';

                status.textContent =
                    'Something went wrong. Please try again.';

            } form.querySelectorAll('.field').forEach(f => { f.classList.remove('has-error', 'is-valid'); f.querySelector('.validation-message')?.remove() })
    }, true)
})();

const apiBase = async () => {
    try { return (await fetch('config.json').then((r) => r.json())).apiBaseUrl?.replace(/\/$/, '') || ''; } catch { return ''; }
};

(() => {
    const form = document.querySelector('#newsletter-form');
    if (!form) return;
    const status = document.querySelector('#newsletter-status');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true; status.style.color = '#b9c8da'; status.textContent = 'Subscribing…';
        try {
            const response = await fetch(`${await apiBase()}/api/newsletter/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value.trim(), firstName: form.firstName.value.trim() || undefined, consent: form.consent.checked, honeypot: form.website.value }) });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to subscribe right now.');
            status.style.color = '#3ee6a8'; status.textContent = result.data?.message || 'You’re subscribed. Thank you.'; form.reset();
        } catch (error) { status.style.color = '#ff9e9e'; status.textContent = error.message || 'Unable to subscribe right now.'; }
        finally { submit.disabled = false; }
    });
})();

(() => {
    const button = document.querySelector('#unsubscribe-button');
    if (!button) return;
    const status = document.querySelector('#unsubscribe-status');
    const token = new URLSearchParams(location.search).get('token');
    if (!token || !/^[a-f0-9]{48}$/i.test(token)) { status.textContent = 'This unsubscribe link is invalid.'; return; }
    status.textContent = 'You can stop receiving Imadi updates at any time.'; button.hidden = false;
    button.addEventListener('click', async () => { button.disabled = true; status.textContent = 'Updating your preference…'; try { const response = await fetch(`${await apiBase()}/api/newsletter/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to update your preference.'); status.textContent = 'You have been unsubscribed.'; button.hidden = true; } catch (error) { status.textContent = error.message || 'Unable to update your preference.'; button.disabled = false; } });
})();

(() => {
    const list = document.querySelector('#case-studies-list');
    if (!list) return;
    (async () => {
        try {
            const response = await fetch(`${await apiBase()}/api/case-studies`); const result = await response.json();
            if (!response.ok || !result.success) throw new Error();
            list.replaceChildren();
            if (!result.data.items.length) { list.innerHTML = '<p class="muted">New case studies are on their way.</p>'; return; }
            result.data.items.forEach((item) => { const card = document.createElement('article'); card.className = 'card article reveal'; const tag = document.createElement('div'); tag.className = 'meta'; tag.textContent = item.industry; const title = document.createElement('h2'); title.textContent = item.title; const summary = document.createElement('p'); summary.textContent = item.outcomes; const link = document.createElement('a'); link.className = 'arrow'; link.href = `case-study.html?slug=${encodeURIComponent(item.slug)}`; link.textContent = 'Read case study →'; card.append(tag, title, summary, link); list.append(card); observer.observe(card); });
        } catch { list.innerHTML = '<p class="muted">Case studies are unavailable at the moment.</p>'; }
    })();
})();

(() => {
    const title = document.querySelector('#case-title');
    if (!title) return;
    (async () => {
        try {
            const slug = new URLSearchParams(location.search).get('slug'); if (!slug) throw new Error();
            const response = await fetch(`${await apiBase()}/api/case-studies/${encodeURIComponent(slug)}`); const result = await response.json(); if (!response.ok || !result.success) throw new Error(); const item = result.data;
            document.title = `${item.title} | Imadi Technologies`; title.textContent = item.title; document.querySelector('#case-industry').textContent = item.industry; document.querySelector('#case-client').textContent = item.clientName ? `Client: ${item.clientName}` : ''; document.querySelector('#case-challenge').textContent = item.challenge; document.querySelector('#case-solution').textContent = item.solution; document.querySelector('#case-outcomes').textContent = item.outcomes;
            const cover = document.querySelector('#case-cover'); if (item.coverImageUrl) { cover.src = item.coverImageUrl; cover.alt = item.title; cover.hidden = false; }
        } catch { title.textContent = 'Case study not found'; }
    })();
})();
(async () => {
    const list = document.querySelector('#insights-list');
    if (!list) return;

    try {
        const response = await fetch(`${await apiBase()}/api/blog`);
        const result = await response.json();

        if (!result.success || !result.data?.items) return;

        list.querySelector('.loading-card')?.remove();

        console.log('BLOG POSTS:', result.data.items);

        result.data.items.forEach(post => {
            const article = document.createElement('article');
            article.className = 'card article reveal';

            const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${post.category || 'Technology'} · ${new Date(post.publishedAt).toLocaleDateString()}`;
            const heading = document.createElement('h2'); heading.textContent = post.title;
            const excerpt = document.createElement('p'); excerpt.textContent = post.excerpt || '';
            const link = document.createElement('a'); link.className = 'arrow'; link.href = `article.html?slug=${encodeURIComponent(post.slug)}`; link.textContent = 'Read article →';
            article.append(meta, heading, excerpt, link);

            list.appendChild(article);
            observer.observe(article);
        });

    } catch (error) {
        console.warn('Blog loading failed:', error);
    }
})();
// Dynamic article loader
(async function loadArticle() {
    const title = document.querySelector('#article-title');
    if (!title) return;

    try {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug');

        if (!slug) {
            title.textContent = 'Article not found';
            return;
        }

        const config = await fetch('config.json').then(r => r.json());

        const response = await fetch(
            `${config.apiBaseUrl}/api/blog/${slug}`
        );

        const result = await response.json();

        if (!result.success) {
            title.textContent = 'Article not found';
            return;
        }

        const post = result.data;

        document.querySelector('#article-meta').textContent =
            `${post.category || 'Insights'} · By ${post.author?.fullName || 'Imadi Technologies'} · ${new Date(post.publishedAt).toLocaleDateString()}`;

        document.querySelector('#article-category').textContent =
            post.category || 'Insights';

        document.querySelector('#article-title').textContent =
            post.title;

        document.querySelector('#article-excerpt').textContent =
            post.excerpt || '';
        const cover = document.querySelector('#article-cover');

        if (cover && post.coverImageUrl) {
            cover.src = post.coverImageUrl;
            cover.alt = post.title;
            cover.style.display = 'block';
        } else if (cover) {
            cover.style.display = 'none';
        }
        document.querySelector('#article-body').innerHTML =
            post.content || '';

    } catch (error) {
        console.error('Article loading failed:', error);
    }
})();
