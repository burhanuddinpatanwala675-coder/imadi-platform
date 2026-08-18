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

        const contactText = [settings.primaryEmail, settings.phoneNumber, settings.address].filter(Boolean).join(' · ') || 'Contact our team for verified details.';
        const contact = document.querySelector('#company-contact');
        if (contact) contact.textContent = contactText;
        document.querySelectorAll('[data-company-contact]').forEach((element) => {
            element.textContent = contactText;
        });

        // Structured data ("Organization" JSON-LD) starts with no url/email in the
        // markup so nothing fake is ever shipped — fill in the real deployed
        // origin and the admin-configured contact email once settings load.
        const jsonLd = document.querySelector('#org-jsonld');
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd.textContent);
                data.url = window.location.origin;
                if (settings.primaryEmail) data.email = settings.primaryEmail;
                jsonLd.textContent = JSON.stringify(data);
            } catch (error) {
                console.warn('Structured data update failed:', error);
            }
        }

        // Social links stay hidden (see the "hidden" attribute in the markup)
        // until a real URL is set in Admin > Site settings, so no dead or
        // placeholder links are ever shown to visitors.
        const socialLinkTargets = {
            linkedin: '#linkedin-link',
            x: '#x-link',
            linkedinFounder: '#founder-linkedin-link',
            instagram: '#instagram-link',
            facebook: '#facebook-link',
            tiktok: '#tiktok-link',
        };
        Object.entries(socialLinkTargets).forEach(([key, selector]) => {
            const url = settings.socialLinks?.[key];
            const element = document.querySelector(selector);
            if (element && url) {
                element.href = url;
                element.hidden = false;
            }
        });

        // The admin "Analytics ID" field was previously saved but never wired
        // up to anything. Only inject a real analytics script once an ID is
        // actually set, and only for a recognised GA4 ("G-XXXXXXX") ID — no
        // script gets injected for an unrecognised value rather than risking
        // a broken <script> tag.
        const analyticsId = (settings.analyticsId || '').trim();
        if (/^G-[A-Z0-9]+$/i.test(analyticsId) && !document.querySelector(`script[data-analytics-id="${analyticsId}"]`)) {
            const loader = document.createElement('script');
            loader.async = true;
            loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
            loader.dataset.analyticsId = analyticsId;
            document.head.append(loader);
            window.dataLayer = window.dataLayer || [];
            function gtag() { window.dataLayer.push(arguments); }
            gtag('js', new Date());
            gtag('config', analyticsId);
        }
    } catch (error) {
        console.warn('Settings loading failed:', error);
    }
})(); const nav = document.querySelector('.nav'), menu = document.querySelector('.menu');
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
    // Homepage "featured work" teaser: pulls the same published case studies
    // from the CMS and shows up to 3. The section starts hidden and only
    // reveals once there's real published work to show, so nothing empty or
    // fabricated is ever displayed before Maria adds real case studies.
    const list = document.querySelector('#featured-case-studies');
    if (!list) return;
    const section = document.querySelector('#featured-work');
    (async () => {
        try {
            const response = await fetch(`${await apiBase()}/api/case-studies`); const result = await response.json();
            if (!response.ok || !result.success) throw new Error();
            const items = result.data.items.slice(0, 3);
            if (!items.length) return;
            list.replaceChildren();
            items.forEach((item) => { const card = document.createElement('article'); card.className = 'card article reveal'; const tag = document.createElement('div'); tag.className = 'meta'; tag.textContent = item.industry; const title = document.createElement('h2'); title.textContent = item.title; const summary = document.createElement('p'); summary.textContent = item.outcomes; const link = document.createElement('a'); link.className = 'arrow'; link.href = `case-study.html?slug=${encodeURIComponent(item.slug)}`; link.textContent = 'Read case study →'; card.append(tag, title, summary, link); list.append(card); observer.observe(card); });
            if (section) section.hidden = false;
        } catch (error) { console.warn('Featured case studies loading failed:', error); }
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
            const gallery = document.querySelector('#case-gallery');
            if (gallery && Array.isArray(item.galleryImages) && item.galleryImages.length) {
                gallery.hidden = false;
                item.galleryImages.forEach((url) => { const img = document.createElement('img'); img.src = url; img.alt = item.title; img.loading = 'lazy'; gallery.append(img); });
            }
            applySeoOverrides(item, item.outcomes);
        } catch { title.textContent = 'Case study not found'; }
    })();
})();
(async () => {
    const list = document.querySelector('#insights-list');
    if (!list) return;
    const filterBar = document.querySelector('#insights-filter');
    const pager = document.querySelector('#insights-pagination');
    const PER_PAGE = 9;
    let allPosts = [];
    let activeCategory = '';
    let activePage = 1;

    function renderList() {
        const filtered = activeCategory ? allPosts.filter((post) => post.category === activeCategory) : allPosts;
        const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
        activePage = Math.min(activePage, pageCount);
        const pageItems = filtered.slice((activePage - 1) * PER_PAGE, activePage * PER_PAGE);

        list.replaceChildren();
        if (!pageItems.length) {
            list.innerHTML = '<p class="muted">No insights in this category yet.</p>';
        } else {
            pageItems.forEach((post) => {
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
        }

        if (pager) {
            pager.hidden = pageCount <= 1;
            pager.innerHTML = '';
            if (pageCount > 1) {
                const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'btn'; prev.textContent = '← Previous'; prev.disabled = activePage <= 1;
                prev.addEventListener('click', () => { activePage -= 1; renderList(); window.scrollTo({ top: list.offsetTop - 100, behavior: 'smooth' }); });
                const label = document.createElement('span'); label.className = 'muted'; label.textContent = `Page ${activePage} of ${pageCount}`;
                const next = document.createElement('button'); next.type = 'button'; next.className = 'btn'; next.textContent = 'Next →'; next.disabled = activePage >= pageCount;
                next.addEventListener('click', () => { activePage += 1; renderList(); window.scrollTo({ top: list.offsetTop - 100, behavior: 'smooth' }); });
                pager.append(prev, label, next);
            }
        }
    }

    function renderFilters() {
        if (!filterBar) return;
        const categories = [...new Set(allPosts.map((post) => post.category).filter(Boolean))].sort();
        if (categories.length < 2) { filterBar.hidden = true; return; }
        filterBar.hidden = false;
        filterBar.innerHTML = '';
        const makePill = (label, value) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'btn' + (activeCategory === value ? ' primary' : '');
            pill.textContent = label;
            pill.addEventListener('click', () => { activeCategory = value; activePage = 1; renderFilters(); renderList(); });
            return pill;
        };
        filterBar.append(makePill('All', ''));
        categories.forEach((category) => filterBar.append(makePill(category, category)));
    }

    try {
        // Fetched once at a generous limit and paginated/filtered client-side —
        // simple and fast at the site's current content volume. The public
        // /api/blog endpoint also supports true server-side page/category
        // params if the archive grows large enough to need it later.
        const response = await fetch(`${await apiBase()}/api/blog?limit=60`);
        const result = await response.json();
        if (!result.success || !result.data?.items) return;
        allPosts = result.data.items;
        renderFilters();
        renderList();
    } catch (error) {
        console.warn('Blog loading failed:', error);
        list.innerHTML = '<p class="muted">Insights are unavailable at the moment.</p>';
    }
})();
// Post content is written as plain text in a plain <textarea> in the admin
// dashboard (no rich-text editor), so it normally has no HTML markup at all.
// Inserted as-is, HTML collapses every newline to a single space and the
// whole post renders as one unbroken wall of text. If the content already
// contains real HTML (written directly as markup), leave it untouched;
// otherwise escape it and turn each line into its own paragraph so headings
// and paragraphs the author separated with line breaks actually show as
// separate lines.
// Applies an editor-set SEO title/description (from Admin > Content or
// Admin > Case studies) to the live document once a post/case study loads.
// Search engine crawlers won't see this (it runs after page load), but it
// keeps the browser tab title and any client-side share/bookmark correct,
// and falls back to the post's own excerpt/outcome when no override is set.
function applySeoOverrides(item, fallbackDescription) {
    if (item.seoTitle) document.title = item.seoTitle;
    const description = item.seoDescription || fallbackDescription;
    if (!description) return;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
    meta.content = description;
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = description;
}

function formatArticleContent(raw) {
    if (!raw) return '';
    if (/<(p|h[1-6]|ul|ol|li|blockquote|div|img|table)[\s>]/i.test(raw)) return raw;
    const escapeHtml = (value) => value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
    return raw
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');
}

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
            formatArticleContent(post.content);

        applySeoOverrides(post, post.excerpt);

    } catch (error) {
        console.error('Article loading failed:', error);
    }
})();

(() => {
    const root = document.querySelector('#assessment-wizard');
    if (!root) return;

    // Rule-based scoring only — no fabricated stats or testimonials. Each
    // answer nudges a running score for the site's four existing AI
    // Solutions categories (see #ai-solutions on index.html) plus a
    // separate "opportunity" score used to label how much friction the
    // answers suggest. The report is generated entirely client-side from
    // the visitor's own answers.
    const CATEGORY_INFO = {
        agents: { name: 'AI Agents', description: 'Digital agents that understand tasks, use your business tools, and help your team get work done faster.' },
        whatsapp: { name: 'WhatsApp AI', description: 'Automate customer and operational conversations on the channel your customers already use.' },
        documents: { name: 'Document Intelligence', description: 'Extract, classify, and validate information from documents and forms with far less manual effort.' },
        workflow: { name: 'Workflow Automation', description: 'Connect your people, software, and AI to remove repetitive steps and keep operations moving.' },
    };

    const QUESTIONS = [
        {
            key: 'industry', eyebrow: 'Step 1 of 6', question: 'Which best describes your business?',
            options: [
                { label: 'Retail & ecommerce', weights: { whatsapp: 2, agents: 1 } },
                { label: 'Logistics & supply chain', weights: { workflow: 2, documents: 1 } },
                { label: 'Professional services', weights: { documents: 2, agents: 1 } },
                { label: 'Healthcare', weights: { documents: 2 } },
                { label: 'Education', weights: { agents: 2 } },
                { label: 'Real estate', weights: { whatsapp: 2, agents: 1 } },
                { label: 'Manufacturing', weights: { workflow: 2 } },
                { label: 'Financial services', weights: { documents: 2, workflow: 1 } },
                { label: 'Something else', weights: {} },
            ],
        },
        {
            key: 'teamSize', eyebrow: 'Step 2 of 6', question: 'How big is your team?',
            options: [
                { label: 'Just me', weights: {}, opportunity: 0 },
                { label: '2–10 people', weights: {}, opportunity: 1 },
                { label: '11–50 people', weights: { workflow: 1 }, opportunity: 2 },
                { label: '51–200 people', weights: { workflow: 2 }, opportunity: 3 },
                { label: '200+ people', weights: { workflow: 2 }, opportunity: 3 },
            ],
        },
        {
            key: 'repetitiveTask', eyebrow: 'Step 3 of 6', question: 'What is the single most repetitive task your team does?',
            options: [
                { label: 'Answering the same customer questions again and again', weights: { whatsapp: 3, agents: 2 }, opportunity: 2 },
                { label: 'Manually processing documents, forms, or invoices', weights: { documents: 3 }, opportunity: 2 },
                { label: 'Manually entering data between different systems', weights: { workflow: 3 }, opportunity: 2 },
                { label: 'Scheduling, reminders, and follow-ups', weights: { agents: 2, workflow: 2 }, opportunity: 1 },
                { label: 'Something else', weights: { agents: 1, workflow: 1 }, opportunity: 1 },
            ],
        },
        {
            key: 'software', eyebrow: 'Step 4 of 6', question: 'How would you describe the software you use today?',
            options: [
                { label: 'Mostly manual — spreadsheets or paper', weights: { workflow: 2, documents: 1 }, opportunity: 3 },
                { label: 'A mix of disconnected tools', weights: { workflow: 3 }, opportunity: 2 },
                { label: 'One core system that isn’t fully used', weights: { workflow: 1, agents: 1 }, opportunity: 1 },
                { label: 'A modern, well-integrated stack', weights: { agents: 1 }, opportunity: 0 },
            ],
        },
        {
            key: 'channel', eyebrow: 'Step 5 of 6', question: 'Where do most of your customer conversations happen?',
            options: [
                { label: 'WhatsApp', weights: { whatsapp: 4 }, opportunity: 2 },
                { label: 'Email', weights: { documents: 2, agents: 1 }, opportunity: 1 },
                { label: 'Phone calls', weights: { agents: 3 }, opportunity: 2 },
                { label: 'Instagram or social DMs', weights: { whatsapp: 3, agents: 1 }, opportunity: 1 },
                { label: 'We don’t handle much customer communication', weights: { workflow: 1 }, opportunity: 0 },
            ],
        },
        {
            key: 'bottleneck', eyebrow: 'Step 6 of 6', question: 'What is the biggest bottleneck holding your business back right now?',
            options: [
                { label: 'Slow response times to customers', weights: { whatsapp: 2, agents: 2 }, opportunity: 2 },
                { label: 'Too much manual admin work', weights: { documents: 2, workflow: 2 }, opportunity: 2 },
                { label: 'Lack of visibility into what is happening', weights: { workflow: 3 }, opportunity: 2 },
                { label: 'Inconsistent processes across the team', weights: { workflow: 2 }, opportunity: 2 },
                { label: 'Difficulty scaling without hiring more people', weights: { agents: 3 }, opportunity: 2 },
            ],
        },
    ];

    const progress = document.querySelector('#wizard-progress');
    const progressFill = document.querySelector('#wizard-progress-fill');
    const stepLabel = document.querySelector('#wizard-step-label');
    const questionsHost = document.querySelector('#wizard-questions');
    const actions = document.querySelector('#wizard-actions');
    const backBtn = document.querySelector('#wizard-back');
    const continueBtn = document.querySelector('#wizard-continue');
    const reportPanel = document.querySelector('#wizard-report');
    const leadPanel = document.querySelector('#wizard-lead');
    const successPanel = document.querySelector('#wizard-success');

    let stepIndex = 0;
    const answers = new Array(QUESTIONS.length).fill(null);

    function renderStep() {
        const step = QUESTIONS[stepIndex];
        progress.hidden = false;
        actions.hidden = false;
        stepLabel.textContent = step.eyebrow;
        progressFill.style.width = `${Math.round(((stepIndex) / QUESTIONS.length) * 100)}%`;

        const selected = answers[stepIndex];
        questionsHost.innerHTML = `
            <div class="wizard-question">
                <div class="eyebrow">${step.eyebrow}</div>
                <h2>${step.question}</h2>
                <div class="wizard-options" role="radiogroup" aria-label="${step.question}">
                    ${step.options.map((option, i) => `
                        <button type="button" class="wizard-option${selected === i ? ' selected' : ''}" data-index="${i}" role="radio" aria-checked="${selected === i}">${option.label}</button>
                    `).join('')}
                </div>
            </div>
        `;

        questionsHost.querySelectorAll('.wizard-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                answers[stepIndex] = Number(btn.dataset.index);
                renderStep();
            });
        });

        backBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
        continueBtn.disabled = selected === null || selected === undefined;
        continueBtn.textContent = stepIndex === QUESTIONS.length - 1 ? 'See my results →' : 'Continue';
    }

    function computeReport() {
        const totals = { agents: 0, whatsapp: 0, documents: 0, workflow: 0 };
        let opportunityScore = 0;

        QUESTIONS.forEach((step, i) => {
            const option = step.options[answers[i]];
            if (!option) return;
            Object.entries(option.weights || {}).forEach(([key, value]) => {
                totals[key] = (totals[key] || 0) + value;
            });
            if (typeof option.opportunity === 'number') opportunityScore += option.opportunity;
        });

        const ranked = Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => key);

        let level = 'Emerging opportunity';
        if (opportunityScore >= 8) level = 'High opportunity';
        else if (opportunityScore >= 4) level = 'Strong opportunity';

        return { ranked: ranked.slice(0, 3), level, opportunityScore };
    }

    function renderReport() {
        progress.hidden = true;
        actions.hidden = true;
        questionsHost.innerHTML = '';
        reportPanel.hidden = false;

        const { ranked, level } = computeReport();
        document.querySelector('#report-level').textContent = level;
        document.querySelector('#report-summary').textContent =
            'Based on your answers, here is where AI and automation are likely to create the most value for your business first.';

        document.querySelector('#report-recommendations').innerHTML = ranked.map((key, i) => `
            <div class="report-recommendation">
                <span class="rank">${i + 1}</span>
                <div>
                    <h3>${CATEGORY_INFO[key].name}</h3>
                    <p>${CATEGORY_INFO[key].description}</p>
                </div>
            </div>
        `).join('');
    }

    continueBtn.addEventListener('click', () => {
        if (stepIndex < QUESTIONS.length - 1) {
            stepIndex += 1;
            renderStep();
        } else {
            renderReport();
        }
    });

    backBtn.addEventListener('click', () => {
        if (stepIndex === 0) return;
        stepIndex -= 1;
        renderStep();
    });

    document.querySelector('#report-restart').addEventListener('click', () => {
        stepIndex = 0;
        answers.fill(null);
        reportPanel.hidden = true;
        renderStep();
    });

    document.querySelector('#report-continue').addEventListener('click', () => {
        reportPanel.hidden = true;
        leadPanel.hidden = false;
        document.querySelector('#a-name')?.focus();
    });

    const leadForm = document.querySelector('#assessment-lead-form');
    leadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const status = document.querySelector('#wizard-lead-status');
        const name = document.querySelector('#a-name').value.trim();
        const workEmail = document.querySelector('#a-email').value.trim();
        const companyName = document.querySelector('#a-company').value.trim();
        const phoneNumber = document.querySelector('#a-phone').value.trim();

        if (!name || !workEmail || !companyName) {
            status.style.color = '#ff9e9e';
            status.textContent = 'Please fill in your name, work email, and company.';
            return;
        }

        const { ranked, level } = computeReport();
        const summaryLines = QUESTIONS.map((step, i) => {
            const option = step.options[answers[i]];
            return `${step.question} ${option ? option.label : 'Not answered'}`;
        });
        const message = [
            `AI Opportunity Assessment submission — ${level}.`,
            `Top recommendations: ${ranked.map((key, i) => `${i + 1}. ${CATEGORY_INFO[key].name}`).join(' ')}`,
            '',
            'Answers:',
            ...summaryLines.map((line) => `- ${line}`),
        ].join('\n');

        const submitBtn = leadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        status.style.color = '#b9c8da';
        status.textContent = 'Sending…';

        try {
            const response = await fetch(`${await apiBase()}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    workEmail,
                    companyName,
                    phoneNumber: phoneNumber || undefined,
                    projectType: 'AI opportunity assessment',
                    message,
                    sourcePage: '/assessment.html',
                }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || 'Unable to submit right now.');
            }
            leadPanel.hidden = true;
            successPanel.hidden = false;
        } catch (error) {
            console.error('Assessment submission failed:', error);
            status.style.color = '#ff9e9e';
            status.textContent = 'Something went wrong. Please try again in a moment.';
            submitBtn.disabled = false;
        }
    });

    renderStep();
})();
