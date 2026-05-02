// ── Scroll — nav background ───────────────────────────────────
window.addEventListener('scroll', () => {
    document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ── Hamburger nav toggle ──────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
const navLinks  = document.querySelector('.nav-links');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('open');
        navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            navToggle.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });

    // Close on outside tap
    document.addEventListener('click', e => {
        if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navToggle.classList.remove('open');
            navLinks.classList.remove('open');
        }
    });
}

// ── Smooth scroll (cubic-ease-in-out) ────────────────────────
function smoothScrollTo(target, duration) {
    const startY = window.scrollY;
    const navH   = (document.querySelector('nav') || { offsetHeight: 80 }).offsetHeight;
    const endY   = target.getBoundingClientRect().top + window.scrollY - navH - 16;
    const diff   = endY - startY;
    let startTime = null;

    function ease(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now) {
        if (!startTime) startTime = now;
        const progress = Math.min((now - startTime) / duration, 1);
        window.scrollTo(0, startY + diff * ease(progress));
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        const hash = anchor.getAttribute('href');
        if (hash === '#') return;
        const target = document.querySelector(hash);
        if (!target) return;
        e.preventDefault();
        smoothScrollTo(target, 950);
    });
});
