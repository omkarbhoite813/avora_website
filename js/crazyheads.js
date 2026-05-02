// crazyheads.js — depends on firebase-init.js (global: db)

// ── Toast notification ────────────────────────────────────────
function showToast(msg, type) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
        position:fixed;bottom:2rem;right:2rem;z-index:9999;
        background:${type === 'error' ? '#7f1d1d' : '#14532d'};
        color:${type === 'error' ? '#fca5a5' : '#86efac'};
        border:1px solid ${type === 'error' ? '#dc2626' : '#16a34a'};
        padding:.75rem 1.25rem;border-radius:10px;
        font-family:'Montserrat',sans-serif;font-size:.76rem;letter-spacing:.04em;
        box-shadow:0 8px 24px rgba(0,0,0,.4);
        animation:toastIn .3s ease forwards;
    `;
    if (!document.querySelector('#toast-style')) {
        const s = document.createElement('style');
        s.id = 'toast-style';
        s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(s);
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

async function saveDoc(collectionName, data) {
    try {
        await db.collection(collectionName).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Submitted successfully!', 'success');
        return true;
    } catch (err) {
        console.error('[Firestore] write error:', err);
        showToast('Submission failed — ' + (err.code || err.message), 'error');
        return false;
    }
}

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

// ── Ticket chip filter + dynamic event loader ─────────────────
const chips = document.querySelectorAll('.ticket-chip');
let allEvents    = [];
let activeFilter = 'present';

function formatINR_small(n) { return n ? '₹' + parseInt(n).toLocaleString('en-IN') : ''; }

function renderTicketCard(ev) {
    const statusMap = {
        past:     { cardClass: 'past-card',     tagClass: 'past-tag',     defaultLabel: 'Ended' },
        present:  { cardClass: 'present-card',  tagClass: 'present-tag',  defaultLabel: 'LIVE NOW' },
        upcoming: { cardClass: 'upcoming-card', tagClass: 'upcoming-tag', defaultLabel: 'Upcoming' }
    };
    const sm = statusMap[ev.status] || statusMap.upcoming;
    const label = ev.statusLabel || sm.defaultLabel;
    const pulseDot = ev.status === 'present' ? '<span class="pulse-dot"></span>' : '';
    const capacityLabel = ev.status === 'past' ? 'Attended' : 'Capacity';
    const capacityVal = ev.capacity ? Number(ev.capacity).toLocaleString('en-IN') : '';

    const footer = ev.status === 'past'
        ? `<span class="ticket-sold-out">SOLD OUT</span><a href="#" class="ticket-btn past-btn">View Recap →</a>`
        : `<a href="#" class="ticket-btn register-btn booking-trigger"
              data-normal="${ev.normalPrice || 199}"
              data-premium="${ev.premiumPrice || 499}"
              data-luxury="${ev.luxuryPrice || 999}">Register Yourself →</a>`;

    return `<div class="ticket-card ${sm.cardClass}" data-status="${ev.status}">
        <div class="ticket-main">
            <div class="ticket-top-row">
                <span class="ticket-status-tag ${sm.tagClass}">${pulseDot}${label}</span>
                <span class="ticket-date">${ev.date || ''}</span>
            </div>
            <h3 class="ticket-name">${ev.name || ''}</h3>
            <p class="ticket-subname">${ev.subname || ''}</p>
            <div class="ticket-info">
                ${ev.venue ? `<span>📍 ${ev.venue}</span>` : ''}
                ${ev.genre ? `<span>🎵 ${ev.genre}</span>` : ''}
                ${capacityVal ? `<span>👥 ${capacityLabel}: ${capacityVal}</span>` : ''}
            </div>
            <div class="ticket-footer">${footer}</div>
        </div>
        <div class="ticket-stub">
            <span class="stub-brand">Crazy Heads</span>
            <div class="stub-barcode"></div>
            <span class="stub-num">${ev.stubNum || ''}</span>
        </div>
    </div>`;
}

function filterTickets(status) {
    activeFilter = status;
    chips.forEach(c => c.classList.toggle('active', c.dataset.filter === status));

    const grid = document.getElementById('ticketsGrid');
    if (!grid) return;
    const filtered = allEvents.filter(e => e.status === status);

    if (!filtered.length) {
        grid.innerHTML = '<p style="text-align:center;color:#444;font-size:.8rem;letter-spacing:.08em;padding:3rem 0;grid-column:1/-1">No events in this category yet.</p>';
        return;
    }
    grid.innerHTML = filtered.map(renderTicketCard).join('');
    grid.querySelectorAll('.booking-trigger').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); openBooking(btn); })
    );
}

function loadEvents() {
    if (typeof db === 'undefined') { showStaticFallback(); return; }
    db.collection('ch_events').orderBy('createdAt', 'asc').get()
        .then(snap => {
            allEvents = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const loading = document.getElementById('ticketsLoading');
            if (loading) loading.remove();
            if (!allEvents.length) { showStaticFallback(); return; }
            filterTickets('present');
        })
        .catch(() => { showStaticFallback(); });
}

function showStaticFallback() {
    const dyn = document.getElementById('ticketsGrid');
    const sta = document.getElementById('ticketsStatic');
    if (dyn) dyn.style.display = 'none';
    if (sta) sta.style.display = '';
    // Wire up booking triggers in static cards
    document.querySelectorAll('#ticketsStatic .booking-trigger').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); openBooking(btn); })
    );
    // Wire up static chip filter
    const staticCards = document.querySelectorAll('#ticketsStatic .ticket-card');
    function filterStatic(status) {
        staticCards.forEach(card => { card.style.display = card.dataset.status === status ? '' : 'none'; });
    }
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterStatic(chip.dataset.filter);
        });
    });
    filterStatic('present');
}

chips.forEach(chip => {
    chip.addEventListener('click', () => {
        if (allEvents.length) filterTickets(chip.dataset.filter);
    });
});

loadEvents();

// ── Utilities ─────────────────────────────────────────────────
function lockScroll()   { document.body.style.overflow = 'hidden'; }
function unlockScroll() { document.body.style.overflow = ''; }
function formatINR(n)   { return '₹' + parseInt(n).toLocaleString('en-IN'); }

// ── Nav Dropdown — Be Part of It ─────────────────────────────
const joinItem = document.getElementById('joinDropdownItem');
const joinBtn  = document.getElementById('joinDropdownBtn');
if (joinItem && joinBtn) {
    joinBtn.addEventListener('click', e => { e.stopPropagation(); joinItem.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!joinItem.contains(e.target)) joinItem.classList.remove('open'); });
}

// ── FORM 1: Get Your Tickets ──────────────────────────────────
const bookingOverlay = document.getElementById('bookingOverlay');
const bookingClose   = document.getElementById('bookingClose');
const eventNameEl    = document.getElementById('bookingEventName');
const normalPriceEl  = document.getElementById('normalPrice');
const premiumPriceEl = document.getElementById('premiumPrice');
const luxuryPriceEl  = document.getElementById('luxuryPrice');
const typeCards      = document.querySelectorAll('.ticket-type-card');
const ticketFullName = document.getElementById('ticketFullName');
const referralInput  = document.getElementById('referralCodeInput');
let activeEventName  = '';

function openBooking(btn) {
    const card = btn.closest('.ticket-card');
    activeEventName = card.querySelector('.ticket-name').textContent;
    eventNameEl.textContent    = activeEventName;
    normalPriceEl.textContent  = formatINR(btn.dataset.normal);
    premiumPriceEl.textContent = formatINR(btn.dataset.premium);
    luxuryPriceEl.textContent  = formatINR(btn.dataset.luxury);
    typeCards.forEach(c => { c.classList.remove('active'); c.dataset.price = btn.dataset[c.dataset.type] || 0; });
    document.querySelector('[data-type="normal"]').classList.add('active');
    ticketFullName.value = ''; referralInput.value = '';
    bookingOverlay.classList.add('open'); lockScroll();
}
function closeBooking() { bookingOverlay.classList.remove('open'); unlockScroll(); }

typeCards.forEach(c => c.addEventListener('click', () => { typeCards.forEach(t => t.classList.remove('active')); c.classList.add('active'); }));
document.querySelectorAll('.booking-trigger').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); openBooking(btn); }));
bookingClose.addEventListener('click', closeBooking);
bookingOverlay.addEventListener('click', e => { if (e.target === bookingOverlay) closeBooking(); });

document.getElementById('bookingSubmitBtn').addEventListener('click', async () => {
    const name = ticketFullName.value.trim();
    if (!name) { ticketFullName.focus(); return; }
    const selectedType = document.querySelector('.ticket-type-card.active');
    const submitBtn = document.getElementById('bookingSubmitBtn');
    const phoneInput = document.getElementById('ticketPhone');
    const screenshotInput = document.getElementById('paymentScreenshot');

    const typeLabels = { normal: 'General Access', premium: 'VIP Access', luxury: 'Lounge + VIP Access' };
    const typeKey = selectedType ? selectedType.dataset.type : 'normal';

    submitBtn.disabled = true; submitBtn.textContent = 'Submitting…';
    const ok = await saveDoc('ch_tickets', {
        name,
        event:           activeEventName,
        ticketType:      typeLabels[typeKey] || typeKey,
        phone:           phoneInput ? phoneInput.value.trim() : '',
        referral:        referralInput.value.trim(),
        screenshotName:  screenshotInput && screenshotInput.files[0] ? screenshotInput.files[0].name : ''
    });
    submitBtn.disabled = false; submitBtn.textContent = 'Confirm Booking →';
    if (ok) closeBooking();
});

// ── Screenshot file name display ──────────────────────────────
const screenshotInputEl = document.getElementById('paymentScreenshot');
const screenshotFilename = document.getElementById('screenshotFilename');
if (screenshotInputEl && screenshotFilename) {
    screenshotInputEl.addEventListener('change', () => {
        screenshotFilename.textContent = screenshotInputEl.files[0]
            ? screenshotInputEl.files[0].name
            : 'No file selected';
    });
    document.querySelector('.screenshot-upload-wrap')?.addEventListener('click', () => screenshotInputEl.click());
}

// ── FORM 2: Partner with Your College ────────────────────────
const partnerOverlay = document.getElementById('partnerOverlay');
const partnerClose   = document.getElementById('partnerClose');
const partnerModal   = partnerOverlay.querySelector('.ch-form-modal');
const partnerSubmit  = partnerOverlay.querySelector('.ch-form-submit');

function openPartner()  { partnerOverlay.classList.add('open');    lockScroll(); }
function closePartner() { partnerOverlay.classList.remove('open'); unlockScroll(); }

document.querySelectorAll('.partner-trigger, .partner-trigger-link').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); joinItem && joinItem.classList.remove('open'); openPartner(); });
});
partnerClose.addEventListener('click', closePartner);
partnerOverlay.addEventListener('click', e => { if (e.target === partnerOverlay) closePartner(); });

partnerSubmit.addEventListener('click', async () => {
    const inputs    = partnerModal.querySelectorAll('input.ch-form-input');
    const textareas = partnerModal.querySelectorAll('textarea.ch-textarea');
    const role      = partnerModal.querySelector('input[name="partnerRole"]:checked');
    const college   = inputs[0] ? inputs[0].value.trim() : '';
    if (!college) { inputs[0] && inputs[0].focus(); return; }
    partnerSubmit.disabled = true; partnerSubmit.textContent = 'Submitting…';
    const ok = await saveDoc('ch_partners', {
        college,
        location:    inputs[1] ? inputs[1].value.trim() : '',
        footfall:    inputs[2] ? inputs[2].value.trim() : '',
        description: textareas[0] ? textareas[0].value.trim() : '',
        reason:      textareas[1] ? textareas[1].value.trim() : '',
        role:        role ? role.value : ''
    });
    partnerSubmit.disabled = false; partnerSubmit.textContent = 'Submit Proposal →';
    if (ok) {
        closePartner();
        partnerModal.querySelectorAll('input.ch-form-input, textarea.ch-textarea').forEach(el => { el.value = ''; });
        partnerModal.querySelectorAll('input[name="partnerRole"]').forEach(r => { r.checked = false; });
    }
});

// ── FORM 3: Be a CrazyHead Ambassador ────────────────────────
const ambassadorOverlay = document.getElementById('ambassadorOverlay');
const ambassadorClose   = document.getElementById('ambassadorClose');
const ambassadorModal   = ambassadorOverlay.querySelector('.ch-form-modal');
const ambassadorSubmit  = ambassadorOverlay.querySelector('.ch-form-submit');

function openAmbassador()  { ambassadorOverlay.classList.add('open');    lockScroll(); }
function closeAmbassador() { ambassadorOverlay.classList.remove('open'); unlockScroll(); }

document.querySelectorAll('.ambassador-trigger, .ambassador-trigger-link').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); joinItem && joinItem.classList.remove('open'); openAmbassador(); });
});
ambassadorClose.addEventListener('click', closeAmbassador);
ambassadorOverlay.addEventListener('click', e => { if (e.target === ambassadorOverlay) closeAmbassador(); });

ambassadorSubmit.addEventListener('click', async () => {
    const inputs    = ambassadorModal.querySelectorAll('input.ch-form-input');
    const textareas = ambassadorModal.querySelectorAll('textarea.ch-textarea');
    const name      = inputs[0] ? inputs[0].value.trim() : '';
    if (!name) { inputs[0] && inputs[0].focus(); return; }
    ambassadorSubmit.disabled = true; ambassadorSubmit.textContent = 'Submitting…';

    const nameSlug    = name.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    const rand        = Math.random().toString(36).slice(2, 6).toUpperCase();
    const referralCode = 'CH' + nameSlug + rand;

    try {
        const docRef = await db.collection('ch_ambassadors').add({
            name,
            college:      inputs[1]   ? inputs[1].value.trim()   : '',
            location:     inputs[2]   ? inputs[2].value.trim()   : '',
            address:      textareas[0] ? textareas[0].value.trim() : '',
            phone:        inputs[3]   ? inputs[3].value.trim()   : '',
            email:        inputs[4]   ? inputs[4].value.trim()   : '',
            instagram:    inputs[5]   ? inputs[5].value.trim()   : '',
            followers:    inputs[6]   ? inputs[6].value.trim()   : '',
            committees:   textareas[1] ? textareas[1].value.trim() : '',
            reason:       textareas[2] ? textareas[2].value.trim() : '',
            referralCode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('ch_referrals').add({
            referralCode,
            ambassadorId:   docRef.id,
            ambassadorName: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        ambassadorSubmit.disabled = false; ambassadorSubmit.textContent = 'Submit Application →';
        closeAmbassador();
        ambassadorModal.querySelectorAll('input.ch-form-input, textarea.ch-textarea').forEach(el => { el.value = ''; });

        document.getElementById('referralCodeDisplay').textContent = referralCode;
        document.getElementById('referralRevealOverlay').classList.add('open');
        lockScroll();

    } catch (err) {
        console.error('[Firestore] write error:', err);
        showToast('Submission failed — ' + (err.code || err.message), 'error');
        ambassadorSubmit.disabled = false; ambassadorSubmit.textContent = 'Submit Application →';
    }
});

// ── Referral Reveal Modal ─────────────────────────────────────
const referralRevealOverlay = document.getElementById('referralRevealOverlay');
const referralCopyBtn       = document.getElementById('referralCopyBtn');
const referralRevealClose   = document.getElementById('referralRevealClose');

function closeReferralReveal() { referralRevealOverlay.classList.remove('open'); unlockScroll(); }

referralCopyBtn.addEventListener('click', () => {
    const code    = document.getElementById('referralCodeDisplay').textContent;
    const origHTML = referralCopyBtn.innerHTML;
    const finish  = () => {
        referralCopyBtn.textContent = 'Copied!';
        referralCopyBtn.classList.add('copied');
        setTimeout(() => { referralCopyBtn.innerHTML = origHTML; referralCopyBtn.classList.remove('copied'); }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(finish).catch(finish);
    } else {
        const el = document.getElementById('referralCodeDisplay');
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        try { document.execCommand('copy'); } catch (e) {}
        window.getSelection().removeAllRanges();
        finish();
    }
});

referralRevealClose.addEventListener('click', closeReferralReveal);
referralRevealOverlay.addEventListener('click', e => { if (e.target === referralRevealOverlay) closeReferralReveal(); });

// ── Contact Us form ───────────────────────────────────────────
const contactSubmitBtn = document.getElementById('contactSubmitBtn');
if (contactSubmitBtn) {
    contactSubmitBtn.addEventListener('click', async () => {
        const name    = document.getElementById('contactName')?.value.trim();
        const email   = document.getElementById('contactEmail')?.value.trim();
        const phone   = document.getElementById('contactPhone')?.value.trim();
        const message = document.getElementById('contactMessage')?.value.trim();
        if (!name || !email) {
            if (!name) document.getElementById('contactName')?.focus();
            else document.getElementById('contactEmail')?.focus();
            return;
        }
        contactSubmitBtn.disabled = true; contactSubmitBtn.textContent = 'Sending…';
        const ok = await saveDoc('ch_contact', { name, email, phone, message });
        if (ok) {
            ['contactName','contactEmail','contactPhone','contactMessage'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            contactSubmitBtn.textContent = 'Message Sent ✓';
            setTimeout(() => { contactSubmitBtn.disabled = false; contactSubmitBtn.textContent = 'Send Message →'; }, 2500);
        } else {
            contactSubmitBtn.disabled = false; contactSubmitBtn.textContent = 'Send Message →';
        }
    });
}

// ── Global Escape ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (bookingOverlay.classList.contains('open'))         closeBooking();
    if (partnerOverlay.classList.contains('open'))         closePartner();
    if (ambassadorOverlay.classList.contains('open'))      closeAmbassador();
    if (referralRevealOverlay.classList.contains('open'))  closeReferralReveal();
    if (joinItem) joinItem.classList.remove('open');
});
