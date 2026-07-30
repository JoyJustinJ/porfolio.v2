/* ============================================================
   JOY JUSTIN J — PORTFOLIO INTERACTIVITY & PARALLAX ENGINE
   ============================================================ */

'use strict';

/* ---- 1. EXACT REFERENCE PARALLAX SCROLL ENGINE ---- */
const textTop = document.getElementById('parallax-text-top');
const textBottom = document.getElementById('parallax-text-bottom');
const profileImg = document.getElementById('parallax-profile-img');
const fixedHeroBg = document.querySelector('.fixed-hero-bg');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const handleHeroParallax = () => {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;

  // Only run animations if within the hero viewport and motion is enabled
  if (!prefersReducedMotion && scrollY <= viewportHeight * 1.5) {
    const progress = Math.min(1, scrollY / viewportHeight);
    
    // Split text outwardly just like in Image 2 ("AFRIT... / SULTHAN")
    const moveX = progress * 320; 
    const scaleText = 1 + progress * 0.45;
    const opacityText = 1 - progress * 0.65;
    
    if (textTop) {
      textTop.style.transform = `translate3d(${-moveX}px, 0, 0) scale(${scaleText})`;
      textTop.style.opacity = opacityText;
      textTop.style.color = progress > 0.15 ? '#9E6A6A' : '#6B1C1C';
    }
    if (textBottom) {
      textBottom.style.transform = `translate3d(${moveX}px, 0, 0) scale(${scaleText})`;
      textBottom.style.opacity = opacityText;
      textBottom.style.color = progress > 0.15 ? '#9E6A6A' : '#6B1C1C';
    }

    // Keep person photo naturally positioned while white sheet rises over it
    if (profileImg) {
      profileImg.style.transform = `translate3d(0, ${16 + scrollY * 0.3}px, 0) scale(${1 - progress * 0.05})`;
    }
    
    if (fixedHeroBg) {
      fixedHeroBg.style.visibility = 'visible';
    }
  } else if (scrollY > viewportHeight * 1.5 && fixedHeroBg) {
    // Hide fixed layer once scrolled past to save GPU drawing cycles
    fixedHeroBg.style.visibility = 'hidden';
  }
};

window.addEventListener('scroll', handleHeroParallax, { passive: true });
window.addEventListener('resize', handleHeroParallax, { passive: true });
handleHeroParallax();

/* ---- 2. FLOATING PILL NAV ACTIVE TAB MONITORING & SCROLL REVEAL ---- */
const pillLinks = document.querySelectorAll('.pill-link');
const pillNavContainer = document.querySelector('.pill-nav-container');
const sections = [
  { id: 'home', element: document.getElementById('home') },
  { id: 'experience', element: document.getElementById('experience') },
  { id: 'skills', element: document.getElementById('skills') },
  { id: 'projects', element: document.getElementById('projects') },
  { id: 'contact', element: document.getElementById('contact') }
];

const updatePillNav = () => {
  const currentScrollY = window.scrollY;

  // Reveal floating navbar only after scrolling down from initial hero poster view
  if (pillNavContainer) {
    if (currentScrollY > 80) {
      pillNavContainer.classList.add('visible-nav');
    } else {
      pillNavContainer.classList.remove('visible-nav');
    }
  }

  const scrollPosition = currentScrollY + 250;
  
  sections.forEach(section => {
    if (!section.element) return;
    const top = section.element.offsetTop + window.innerHeight; // compensate for 100vh spacer
    const height = section.element.offsetHeight;
    
    // Calculate effective section bounds
    const elementRect = section.element.getBoundingClientRect();
    const isVisible = elementRect.top < window.innerHeight * 0.5 && elementRect.bottom >= 100;
    
    if (isVisible) {
      pillLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${section.id}`) {
          link.classList.add('active');
        }
      });
    }
  });
};

window.addEventListener('scroll', updatePillNav, { passive: true });
updatePillNav();

/* ---- 3. BOTTOM TAB ICON SWITCHER WITH GLOWING DOT (IMAGE 3) ---- */
const tabButtons = document.querySelectorAll('.tab-icon-btn');
const tabWrappers = document.querySelectorAll('.tab-button-wrap');
const panels = document.querySelectorAll('.skill-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');

    // Deactivate all buttons and wrappers
    tabWrappers.forEach(wrap => wrap.classList.remove('active'));
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    // Activate selected tab and wrapper
    const currentWrap = btn.closest('.tab-button-wrap');
    if (currentWrap) currentWrap.classList.add('active');
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    // Hide all panels and display target panel
    panels.forEach(panel => {
      panel.classList.remove('active');
      panel.hidden = true;
    });

    const targetPanel = document.getElementById(`panel-${target}`);
    if (targetPanel) {
      targetPanel.hidden = false;
      setTimeout(() => targetPanel.classList.add('active'), 10);
    }
  });
});

/* ---- 4. SCROLL REVEAL (INTERSECTION OBSERVER) ---- */
const revealElements = document.querySelectorAll('.reveal-up, .reveal-stagger');

if (prefersReducedMotion) {
  revealElements.forEach(el => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        const delay = entry.target.classList.contains('reveal-stagger') ? (idx % 4) * 100 : 0;
        setTimeout(() => entry.target.classList.add('visible'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(el => observer.observe(el));
}

/* ---- 5. SMOOTH ANCHOR LINK SCROLLING ---- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      const offset = 80;
      // Adjust scroll calculation based on whether target is before or after spacer
      const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top: targetTop,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  });
});

/* ---- 6. CONTACT FORM SUBMISSION ---- */
const form = document.getElementById('contact-form');
const successAlert = document.getElementById('form-success');
const submitBtn = document.getElementById('submit-btn');

if (form && submitBtn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = 'Sending Message...';
    submitBtn.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 1200));

    successAlert.hidden = false;
    form.reset();
    submitBtn.textContent = 'Send Message';
    submitBtn.disabled = false;

    setTimeout(() => { successAlert.hidden = true; }, 5000);
  });
}
