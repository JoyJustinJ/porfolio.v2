/* ============================================================
   JOY JUSTIN J — PORTFOLIO INTERACTIVITY & PARALLAX ENGINE
   ============================================================ */

'use strict';

/* ---- 1. EXACT REFERENCE PARALLAX SCROLL ENGINE ---- */
const textTop = document.getElementById('parallax-text-top');
const textBottom = document.getElementById('parallax-text-bottom');
const profileImg = document.getElementById('parallax-profile-img');
const fixedHeroBg = document.querySelector('.fixed-hero-bg');

// Cross-browser scroll position helper
const getScrollY = () => {
  return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
};

const handleHeroParallax = () => {
  const scrollY = getScrollY();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;

  // Run animations while within hero range
  if (scrollY <= viewportHeight * 1.5) {
    const progress = Math.min(1, Math.max(0, scrollY / viewportHeight));
    
    // Split text outwardly — capped at 40vw so it never flies off narrow screens
    const moveX = progress * Math.min(320, window.innerWidth * 0.40); 
    const opacityText = Math.max(0, 1 - progress * 0.65);
    
    if (textTop) {
      textTop.style.transform = `translate3d(${-moveX}px, 0, 0)`;
      textTop.style.opacity = opacityText;
      textTop.style.color = progress > 0.15 ? '#9E6A6A' : '#6B1C1C';
    }
    if (textBottom) {
      textBottom.style.transform = `translate3d(${moveX}px, 0, 0)`;
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
  } else if (fixedHeroBg) {
    // Hide fixed layer once scrolled past to save GPU drawing cycles
    fixedHeroBg.style.visibility = 'hidden';
  }
};

// High-refresh rate (144Hz / 165Hz) rAF throttling for Lenovo LOQ gaming displays
let parallaxTicking = false;
const requestParallaxTick = () => {
  if (!parallaxTicking) {
    window.requestAnimationFrame(() => {
      handleHeroParallax();
      parallaxTicking = false;
    });
    parallaxTicking = true;
  }
};

window.addEventListener('scroll', requestParallaxTick, { passive: true });
window.addEventListener('resize', requestParallaxTick, { passive: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleHeroParallax);
} else {
  handleHeroParallax();
}

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
  const currentScrollY = getScrollY();

  // Reveal floating navbar only after scrolling down from initial hero poster view
  if (pillNavContainer) {
    if (currentScrollY > 80) {
      pillNavContainer.classList.add('visible-nav');
    } else {
      pillNavContainer.classList.remove('visible-nav');
    }
  }

  sections.forEach(section => {
    if (!section.element) return;
    
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

window.addEventListener('scroll', () => {
  window.requestAnimationFrame(updatePillNav);
}, { passive: true });
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

/* ---- 5. SMOOTH ANCHOR LINK SCROLLING ---- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const targetTop = target.getBoundingClientRect().top + getScrollY() - offset;
      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
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
