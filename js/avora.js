// avora.js — depends on firebase-init.js (global: db)

// ── Scroll reveal ────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }),
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
);
document.querySelectorAll('[data-reveal]').forEach(el => {
    el.style.transitionDelay = (el.dataset.delay || 0) + 'ms';
    revealObserver.observe(el);
});

// ── Stats counter ─────────────────────────────────────────────
function countUp(el) {
    const raw = el.textContent.trim(), target = parseFloat(raw), suffix = raw.replace(/[\d.]/g, '');
    const duration = 1800; let startTime = null;
    function tick(now) {
        if (!startTime) startTime = now;
        const p = Math.min((now - startTime) / duration, 1), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}
const statsObserver = new IntersectionObserver(
    (entries) => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.querySelectorAll('.stat-number').forEach(countUp); statsObserver.unobserve(entry.target); }
    }),
    { threshold: 0.35 }
);
const statsRow = document.querySelector('.stats-row');
if (statsRow) statsObserver.observe(statsRow);

// ── Custom service dropdown ───────────────────────────────────
const selectWrap = document.querySelector('.custom-select');
if (selectWrap) {
    const trigger = selectWrap.querySelector('.select-trigger');
    const options = selectWrap.querySelector('.select-options');
    const valueEl = selectWrap.querySelector('.select-value');

    trigger.addEventListener('click', () => {
        const isOpen = options.classList.toggle('open');
        trigger.classList.toggle('open', isOpen);
    });
    options.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
            options.querySelectorAll('li').forEach(l => l.classList.remove('chosen'));
            li.classList.add('chosen');
            valueEl.textContent = li.dataset.label;
            valueEl.classList.add('chosen');
            options.classList.remove('open');
            trigger.classList.remove('open');
        });
    });
    document.addEventListener('click', e => {
        if (!selectWrap.contains(e.target)) { options.classList.remove('open'); trigger.classList.remove('open'); }
    });
}

// ── Contact form submit → Firestore ───────────────────────────
const contactSubmit = document.querySelector('.contact-submit');
if (contactSubmit) {
    contactSubmit.addEventListener('click', async () => {
        const wrap     = document.querySelector('.contact-form-wrap');
        const inputs   = wrap.querySelectorAll('input');
        const textarea = wrap.querySelector('textarea');
        const service  = wrap.querySelector('.select-value');

        const name    = inputs[0] ? inputs[0].value.trim() : '';
        const email   = inputs[1] ? inputs[1].value.trim() : '';
        const phone   = inputs[2] ? inputs[2].value.trim() : '';
        const message = textarea ? textarea.value.trim() : '';
        const svc     = service ? service.textContent.trim() : '';

        if (!name || !email) {
            if (!name && inputs[0]) inputs[0].focus();
            return;
        }

        contactSubmit.disabled    = true;
        contactSubmit.textContent = 'Sending…';

        try {
            await db.collection('avora_enquiries').add({
                name,
                email,
                phone,
                service: svc === 'Select a Service' ? '' : svc,
                message,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Reset form on success
            inputs.forEach(i => { i.value = ''; });
            if (textarea)  textarea.value = '';
            if (service) { service.textContent = 'Select a Service'; service.classList.remove('chosen'); }

            // Brief success state on button
            contactSubmit.textContent = 'Message Sent ✓';
            setTimeout(() => {
                contactSubmit.disabled    = false;
                contactSubmit.innerHTML   = 'Plan My Event <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
            }, 2500);
        } catch (err) {
            console.error('[Firestore] avora enquiry write error:', err);
            contactSubmit.textContent = 'Failed — try again';
            setTimeout(() => {
                contactSubmit.disabled    = false;
                contactSubmit.innerHTML   = 'Plan My Event <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
            }, 2500);
        }
    });
}
