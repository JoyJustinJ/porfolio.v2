/* ---- 1. CINEMATIC DUST PARTICLE & PARALLAX ENGINE ---- */
const textTop = document.getElementById('parallax-text-top');
const textBottom = document.getElementById('parallax-text-bottom');
const profileImg = document.getElementById('parallax-profile-img');
const collageWrapper = document.getElementById('parallax-collage-wrapper');
const collageImg = document.getElementById('parallax-collage-img');
const particleCanvas = document.getElementById('hero-particle-canvas');
const cinematicCutout = document.getElementById('parallax-cinematic-cutout');
const fixedHeroBg = document.querySelector('.fixed-hero-bg');

// Cross-browser scroll position helper
const getScrollY = () => {
  return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
};

/* ---- PARTICLE ENGINE (WEBGL ACCELERATED WITH 2D FALLBACK) ---- */
const ParticleEngine = (() => {
  if (!particleCanvas) return null;

  let gl = null;
  let isWebGL = false;
  let ctx2d = null;
  let program = null;

  let pos1Buffer = null;
  let pos2Buffer = null;
  let color1Buffer = null;
  let color2Buffer = null;
  let randomBuffer = null;

  let uProgressLoc = null;
  let uDprLoc = null;

  let numParticles = 0;
  let particleData = []; // for resize re-projection & 2D fallback
  let isReady = false;

  const init = () => {
    // Attempt WebGL
    try {
      gl = particleCanvas.getContext('webgl', { alpha: true, antialias: true }) ||
           particleCanvas.getContext('experimental-webgl', { alpha: true, antialias: true });
      if (gl) isWebGL = true;
    } catch (e) {
      isWebGL = false;
    }

    if (!isWebGL) {
      ctx2d = particleCanvas.getContext('2d');
    }

    resizeCanvas();
    loadAndSampleImages();
  };

  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    particleCanvas.width = width * dpr;
    particleCanvas.height = height * dpr;

    if (isWebGL && gl) {
      gl.viewport(0, 0, particleCanvas.width, particleCanvas.height);
      if (uDprLoc) gl.uniform1f(uDprLoc, dpr);
    }

    if (isReady) {
      reprojectPositions();
    }
  };

  const createShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const initShaders = () => {
    const vsSource = `
      attribute vec2 a_pos1;
      attribute vec2 a_pos2;
      attribute vec4 a_color1;
      attribute vec4 a_color2;
      attribute vec4 a_random;

      uniform float u_progress;
      uniform float u_dpr;

      varying vec4 v_color;

      void main() {
        float p = u_progress;

        // Individual particle stagger based on a_random.w
        float delay = a_random.w * 0.35;
        float t = clamp((p - delay) / (1.0 - delay + 0.001), 0.0, 1.0);

        // Smooth cubic hermite curve
        float ease = t * t * (3.0 - 2.0 * t);

        // Dust burst amplitude: peaks in the middle of transition
        float burst = sin(t * 3.14159265);

        // Swirling dust turbulence
        float angle = burst * 3.14159 * (a_random.z - 0.5) * 1.6;
        float cosA = cos(angle);
        float sinA = sin(angle);

        vec2 dust = vec2(
          a_random.x * burst * 0.42,
          a_random.y * burst * 0.42 - (burst * 0.09) // gentle floating dust upward lift
        );

        vec2 rotatedDust = vec2(
          dust.x * cosA - dust.y * sinA,
          dust.x * sinA + dust.y * cosA
        );

        vec2 basePos = mix(a_pos1, a_pos2, ease);
        vec2 finalPos = basePos + rotatedDust;

        gl_Position = vec4(finalPos, 0.0, 1.0);

        // Particle size: 2.2px to 4.5px, slightly larger during dust dispersal
        gl_PointSize = mix(2.2, 4.5, burst) * u_dpr * (0.8 + a_random.z * 0.4);

        // Color morphing with warm golden ember glow during flight
        vec4 emberColor = vec4(0.85, 0.65, 0.40, 0.95);
        vec4 baseColor = mix(a_color1, a_color2, ease);
        v_color = mix(baseColor, emberColor, burst * 0.50);
        v_color.a *= mix(0.95, 1.0, 1.0 - burst * 0.15);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec4 v_color;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) {
          discard;
        }
        // Soft feathered circular dust particle
        float alpha = smoothstep(0.5, 0.15, dist) * v_color.a;
        gl_FragColor = vec4(v_color.rgb, alpha);
      }
    `;

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    uProgressLoc = gl.getUniformLocation(program, 'u_progress');
    uDprLoc = gl.getUniformLocation(program, 'u_dpr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  };

  const loadAndSampleImages = () => {
    let img1Loaded = false;
    let img2Loaded = false;

    const img1 = new Image();
    const img2 = new Image();

    img1.onload = () => {
      img1Loaded = true;
      if (img2Loaded) processImages(img1, img2);
    };

    img2.onload = () => {
      img2Loaded = true;
      if (img1Loaded) processImages(img1, img2);
    };

    img1.src = 'joy_profile.png';
    img2.src = 'joy_hero_cinematic_bg.png';
  };

  const processImages = (img1, img2) => {
    // 1. Sample non-transparent pixels from portrait
    const sampleCanvas1 = document.createElement('canvas');
    const sW1 = 180;
    const sH1 = 240;
    sampleCanvas1.width = sW1;
    sampleCanvas1.height = sH1;
    const sCtx1 = sampleCanvas1.getContext('2d');
    sCtx1.drawImage(img1, 0, 0, sW1, sH1);
    const data1 = sCtx1.getImageData(0, 0, sW1, sH1).data;

    const points1 = [];
    for (let y = 0; y < sH1; y += 2) {
      for (let x = 0; x < sW1; x += 2) {
        const idx = (y * sW1 + x) * 4;
        const a = data1[idx + 3];
        if (a > 30) {
          points1.push({
            u: x / sW1,
            v: y / sH1,
            r: data1[idx] / 255,
            g: data1[idx + 1] / 255,
            b: data1[idx + 2] / 255,
            a: a / 255
          });
        }
      }
    }

    // 2. Sample pixels from cinematic collage
    const sampleCanvas2 = document.createElement('canvas');
    const sW2 = 200;
    const sH2 = 113; // ~16:9 ratio
    sampleCanvas2.width = sW2;
    sampleCanvas2.height = sH2;
    const sCtx2 = sampleCanvas2.getContext('2d');
    sCtx2.drawImage(img2, 0, 0, sW2, sH2);
    const data2 = sCtx2.getImageData(0, 0, sW2, sH2).data;

    const points2 = [];
    for (let y = 0; y < sH2; y += 1) {
      for (let x = 0; x < sW2; x += 1) {
        const idx = (y * sW2 + x) * 4;
        points2.push({
          u: x / sW2,
          v: y / sH2,
          r: data2[idx] / 255,
          g: data2[idx + 1] / 255,
          b: data2[idx + 2] / 255,
          a: 1.0
        });
      }
    }

    // Match counts to create particle pairs
    numParticles = Math.min(18000, Math.max(points1.length, 12000));
    particleData = [];

    for (let i = 0; i < numParticles; i++) {
      const p1 = points1[i % points1.length];
      const p2 = points2[Math.floor((i / numParticles) * points2.length)];

      particleData.push({
        u1: p1.u,
        v1: p1.v,
        r1: p1.r,
        g1: p1.g,
        b1: p1.b,
        a1: p1.a,
        u2: p2.u,
        v2: p2.v,
        r2: p2.r,
        g2: p2.g,
        b2: p2.b,
        a2: p2.a,
        rx: (Math.random() - 0.5) * 2.0,
        ry: (Math.random() - 0.5) * 2.0,
        rz: Math.random(),
        rw: Math.random() // trigger delay
      });
    }

    if (isWebGL) {
      if (!initShaders()) {
        isWebGL = false;
        ctx2d = particleCanvas.getContext('2d');
      }
    }

    reprojectPositions();
    isReady = true;

    // Trigger initial check
    if (typeof handleHeroParallax === 'function') {
      handleHeroParallax();
    }
  };

  const reprojectPositions = () => {
    if (!numParticles || particleData.length === 0) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Source rect from profile image
    const rect1 = profileImg ? profileImg.getBoundingClientRect() : {
      left: W * 0.25, top: H * 0.15, width: W * 0.5, height: H * 0.8
    };

    // Destination rect: covers the full viewport (background-size: cover)
    const screenAspect = W / H;
    const imgAspect = 1672 / 941;
    let r2W, r2H;
    if (screenAspect > imgAspect) {
      r2W = W;
      r2H = W / imgAspect;
    } else {
      r2H = H;
      r2W = H * imgAspect;
    }
    const rect2 = {
      width: r2W,
      height: r2H,
      left: (W - r2W) / 2,
      top: (H - r2H) / 2
    };

    if (isWebGL && gl && program) {
      const pos1Arr = new Float32Array(numParticles * 2);
      const pos2Arr = new Float32Array(numParticles * 2);
      const col1Arr = new Float32Array(numParticles * 4);
      const col2Arr = new Float32Array(numParticles * 4);
      const rndArr = new Float32Array(numParticles * 4);

      for (let i = 0; i < numParticles; i++) {
        const p = particleData[i];

        // Screen coords to WebGL clip space [-1, 1]
        const sX1 = rect1.left + p.u1 * rect1.width;
        const sY1 = rect1.top + p.v1 * rect1.height;
        pos1Arr[i * 2] = (sX1 / W) * 2 - 1;
        pos1Arr[i * 2 + 1] = -((sY1 / H) * 2 - 1);

        const sX2 = rect2.left + p.u2 * rect2.width;
        const sY2 = rect2.top + p.v2 * rect2.height;
        pos2Arr[i * 2] = (sX2 / W) * 2 - 1;
        pos2Arr[i * 2 + 1] = -((sY2 / H) * 2 - 1);

        col1Arr[i * 4] = p.r1;
        col1Arr[i * 4 + 1] = p.g1;
        col1Arr[i * 4 + 2] = p.b1;
        col1Arr[i * 4 + 3] = p.a1;

        col2Arr[i * 4] = p.r2;
        col2Arr[i * 4 + 1] = p.g2;
        col2Arr[i * 4 + 2] = p.b2;
        col2Arr[i * 4 + 3] = p.a2;

        rndArr[i * 4] = p.rx;
        rndArr[i * 4 + 1] = p.ry;
        rndArr[i * 4 + 2] = p.rz;
        rndArr[i * 4 + 3] = p.rw;
      }

      const bindBuffer = (attrName, data, size) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, attrName);
        if (loc !== -1) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }
        return buf;
      };

      pos1Buffer = bindBuffer('a_pos1', pos1Arr, 2);
      pos2Buffer = bindBuffer('a_pos2', pos2Arr, 2);
      color1Buffer = bindBuffer('a_color1', col1Arr, 4);
      color2Buffer = bindBuffer('a_color2', col2Arr, 4);
      randomBuffer = bindBuffer('a_random', rndArr, 4);
    } else {
      // 2D fallback data cache
      for (let i = 0; i < numParticles; i++) {
        const p = particleData[i];
        p.sX1 = rect1.left + p.u1 * rect1.width;
        p.sY1 = rect1.top + p.v1 * rect1.height;
        p.sX2 = rect2.left + p.u2 * rect2.width;
        p.sY2 = rect2.top + p.v2 * rect2.height;
      }
    }
  };

  const render = (progress) => {
    if (!isReady || numParticles === 0) return;

    if (isWebGL && gl && program) {
      gl.useProgram(program);
      gl.uniform1f(uProgressLoc, progress);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.uniform1f(uDprLoc, dpr);

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.POINTS, 0, numParticles);
    } else if (ctx2d) {
      const W = particleCanvas.width;
      const H = particleCanvas.height;
      ctx2d.clearRect(0, 0, W, H);

      const p = progress;
      for (let i = 0; i < numParticles; i += 2) {
        const pt = particleData[i];
        const delay = pt.rw * 0.35;
        const t = Math.min(1, Math.max(0, (p - delay) / (1.0 - delay + 0.001)));
        const ease = t * t * (3 - 2 * t);
        const burst = Math.sin(t * Math.PI);

        const x = pt.sX1 + (pt.sX2 - pt.sX1) * ease + pt.rx * burst * 150;
        const y = pt.sY1 + (pt.sY2 - pt.sY1) * ease + pt.ry * burst * 150 - burst * 40;

        const r = Math.round(pt.r1 * (1 - ease) + pt.r2 * ease) * 255;
        const g = Math.round(pt.g1 * (1 - ease) + pt.g2 * ease) * 255;
        const b = Math.round(pt.b1 * (1 - ease) + pt.b2 * ease) * 255;

        ctx2d.fillStyle = `rgba(${r},${g},${b},0.85)`;
        ctx2d.fillRect(x, y, 2.5, 2.5);
      }
    }
  };

  return {
    init,
    resize: resizeCanvas,
    render,
    isReady: () => isReady
  };
})();

// Initialize Particle Engine
ParticleEngine.init();

/* ---- SCROLL COORDINATION & PARALLAX ENGINE ---- */
/* Signature Horizontal Slide-In Entrance Controller */
const triggerSlideInEntrance = () => {
  const scrollY = getScrollY();
  if (scrollY < 80) {
    if (textTop) {
      textTop.classList.remove('slide-in-left');
      void textTop.offsetWidth; // trigger reflow
      textTop.classList.add('slide-in-left');
      textTop.addEventListener('animationend', () => {
        textTop.classList.remove('slide-in-left');
        handleHeroParallax();
      }, { once: true });
    }
    if (textBottom) {
      textBottom.classList.remove('slide-in-right');
      void textBottom.offsetWidth; // trigger reflow
      textBottom.classList.add('slide-in-right');
      textBottom.addEventListener('animationend', () => {
        textBottom.classList.remove('slide-in-right');
        handleHeroParallax();
      }, { once: true });
    }
  }
};
window.triggerSlideInEntrance = triggerSlideInEntrance;

const handleHeroParallax = () => {
  const scrollY = getScrollY();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
  const parallaxProgress = Math.min(1, Math.max(0, scrollY / viewportHeight));
  const isCinematic = document.body.classList.contains('cinematic-mode');

  // Cancel any active entrance keyframe so scroll control is immediate and fluid
  if (scrollY > 0) {
    if (textTop && textTop.classList.contains('slide-in-left')) {
      textTop.classList.remove('slide-in-left');
    }
    if (textBottom && textBottom.classList.contains('slide-in-right')) {
      textBottom.classList.remove('slide-in-right');
    }
  }

  // Exact signature horizontal split calculations
  const moveX = parallaxProgress * Math.min(320, window.innerWidth * 0.40);
  const opacityText = Math.max(0, 1 - parallaxProgress * 0.65);

  // 1. Top text ("JOY") translates LEFT
  if (textTop) {
    textTop.style.transform = `translate3d(${-moveX}px, 0, 0)`;
    textTop.style.opacity = opacityText;
    if (!isCinematic) {
      textTop.style.color = parallaxProgress > 0.15 ? '#9E6A6A' : '#6B1C1C';
    } else {
      textTop.style.color = '#CC0000';
    }
  }

  // 2. Bottom text ("JUSTIN J") translates RIGHT
  if (textBottom) {
    textBottom.style.transform = `translate3d(${moveX}px, 0, 0)`;
    textBottom.style.opacity = opacityText;
    if (!isCinematic) {
      textBottom.style.color = parallaxProgress > 0.15 ? '#9E6A6A' : '#6B1C1C';
    } else {
      textBottom.style.color = '#CC0000';
    }
  }

  // 3. Center person (Joy portrait) translates DOWN with parallax
  if (profileImg) {
    profileImg.style.opacity = '1';
    profileImg.style.transform = `translate3d(0, ${16 + scrollY * 0.3}px, 0) scale(${1 - parallaxProgress * 0.05})`;
  }

  // 4. Background and Foreground Cutout handling
  if (!isCinematic) {
    if (collageWrapper) {
      collageWrapper.classList.remove('visible');
    }
  } else {
    if (collageWrapper) {
      collageWrapper.classList.add('visible');
      collageWrapper.style.transform = `translate3d(0, ${scrollY * 0.15}px, 0)`;
    }
    if (cinematicCutout) {
      cinematicCutout.style.transform = `translate3d(0, ${scrollY * 0.15}px, 0)`;
    }
  }

  // Hero Visibility Toggle
  if (scrollY <= viewportHeight * 2.5) {
    if (fixedHeroBg) fixedHeroBg.style.visibility = 'visible';
  } else if (fixedHeroBg) {
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
window.addEventListener('resize', () => {
  ParticleEngine.resize();
  requestParallaxTick();
}, { passive: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    handleHeroParallax();
    triggerSlideInEntrance();
  });
} else {
  handleHeroParallax();
  triggerSlideInEntrance();
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
