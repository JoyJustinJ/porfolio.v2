/* ============================================================
   CINEMATIC SCROLL TRANSFORM ENGINE — Joy Justin J Portfolio
   Realistic dust & ember physics, full-screen blinding flash,
   and permanent one-way transformation triggered at #ticker.
   ============================================================ */
'use strict';

const CinematicEngine = (() => {
  const TRIGGER_SECTION_ID = 'ticker';
  const TRANSITION_DURATION = 2000; // ms
  const BURST_PARTICLE_COUNT = 3400;
  const AMBIENT_PARTICLE_COUNT = 85;

  let hasTransformed    = false;
  let isTransitioning   = false;
  let animFrameId       = null;
  let transitionCanvas  = null;
  let ctx               = null;
  let burstParticles    = [];
  let ambientParticles  = [];
  let transitionStart   = null;
  let scrollTicking     = false;

  /* ---------- Canvas Setup ---------- */
  const createCanvas = () => {
    let canvas = document.getElementById('cinematic-transition-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cinematic-transition-canvas';
      document.body.appendChild(canvas);
    }
    transitionCanvas = canvas;
    ctx = transitionCanvas.getContext('2d');
    sizeCanvas();
  };

  const sizeCanvas = () => {
    if (!transitionCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    transitionCanvas.width  = Math.floor(window.innerWidth * dpr);
    transitionCanvas.height = Math.floor(window.innerHeight * dpr);
    transitionCanvas.style.width  = window.innerWidth + 'px';
    transitionCanvas.style.height = window.innerHeight + 'px';
  };

  /* ---------- Burst Dust & Ember Particle ---------- */
  class BurstParticle {
    constructor(W, H) {
      this.W = W;
      this.H = H;
      this.init();
    }

    init() {
      // Type: 0 = micro dust (65%), 1 = fluttering ash flake (20%), 2 = glowing ember (15%)
      const rand = Math.random();
      if (rand < 0.65) {
        this.type = 0; // micro dust
      } else if (rand < 0.85) {
        this.type = 1; // ash flake
      } else {
        this.type = 2; // glowing ember
      }

      this.delay = Math.random() * 0.38; // stagger start
      this.life  = 0.65 + Math.random() * 0.35;

      // Starting position: wave lifting off from center & bottom towards full screen
      this.x = this.W * (0.05 + Math.random() * 0.90);
      this.y = this.H * (0.15 + Math.random() * 0.85);

      // Trajectory: explosive lift + outward vortex spread
      const angle = (Math.random() - 0.5) * Math.PI * 1.8 - Math.PI / 2; // mostly upward & sideways
      const speed = 250 + Math.random() * 550;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;

      // Upward thermal lift
      this.lift = 180 + Math.random() * 320;
      // Air resistance
      this.drag = 0.92;

      // Swirling turbulence
      this.swirlSpeed = (Math.random() - 0.5) * 8;
      this.swirlRadius = 30 + Math.random() * 80;

      // Rotation & 3D flutter for ash flakes
      this.rot = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 12;

      // Visuals by type
      if (this.type === 0) {
        // Micro dust: tiny, semi-translucent, warm ash/chalk
        this.size = 0.9 + Math.random() * 1.8;
        const lum = 200 + Math.floor(Math.random() * 55);
        this.r = lum;
        this.g = lum - 15;
        this.b = lum - 35;
        this.baseAlpha = 0.45 + Math.random() * 0.45;
      } else if (this.type === 1) {
        // Ash flake: larger, irregular, dark soot with burnt umber
        this.size = 2.4 + Math.random() * 3.6;
        this.r = 45 + Math.floor(Math.random() * 30);
        this.g = 20 + Math.floor(Math.random() * 15);
        this.b = 15;
        this.baseAlpha = 0.75 + Math.random() * 0.25;
      } else {
        // Glowing hot ember: brilliant fiery core with soft aura
        this.size = 1.6 + Math.random() * 2.8;
        this.r = 255;
        this.g = 90 + Math.floor(Math.random() * 120);
        this.b = 20;
        this.baseAlpha = 0.95;
      }
    }

    draw(progress, dpr, ts) {
      if (progress < this.delay) return;

      const t = Math.min(1, Math.max(0, (progress - this.delay) / (1 - this.delay)));
      // Curve: fast explosion then atmospheric deceleration and floating
      const tEased = Math.sin(t * Math.PI * 0.5);
      const burstPhase = Math.sin(t * Math.PI);

      // Trajectory calculation
      const x = (this.x + (this.vx * tEased * 0.85) + Math.sin(t * this.swirlSpeed + this.delay) * this.swirlRadius) * dpr;
      const y = (this.y + (this.vy * tEased * 0.85) - (this.lift * t * t * 0.6) + Math.cos(t * this.swirlSpeed) * (this.swirlRadius * 0.5)) * dpr;

      // Alpha envelope: fade in quick, peak in middle, gradual drift fade
      const alpha = Math.min(1, burstPhase * 1.6) * this.baseAlpha;
      if (alpha <= 0.01) return;

      ctx.save();

      if (this.type === 2) {
        // Incandescent ember: glowing halo + fiery hot center
        const emberFlicker = 0.75 + 0.25 * Math.sin(ts * 0.03 + this.delay * 20);
        const sz = this.size * (0.8 + burstPhase * 0.8) * dpr;

        ctx.globalAlpha = Math.min(1, alpha * emberFlicker);
        ctx.shadowColor = '#FF2200';
        ctx.shadowBlur = 14 * dpr;

        // Outer glow
        ctx.fillStyle = 'rgb(' + this.r + ',' + this.g + ',' + this.b + ')';
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();

        // Hot white core
        ctx.shadowBlur = 6 * dpr;
        ctx.fillStyle = '#FFF8E8';
        ctx.beginPath();
        ctx.arc(x, y, sz * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 1) {
        // Ash flake: 3D fluttering ellipse
        ctx.globalAlpha = alpha;
        const currentRot = this.rot + t * this.rotSpeed;
        const flutterScaleX = Math.max(0.15, Math.abs(Math.cos(currentRot)));
        const sz = this.size * dpr;

        ctx.translate(x, y);
        ctx.rotate(currentRot);
        ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + alpha + ')';
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * flutterScaleX, sz, 0, 0, Math.PI * 2);
        ctx.fill();

        // Burnt edge glow
        if (burstPhase > 0.3) {
          ctx.strokeStyle = 'rgba(255, 60, 0, ' + (alpha * 0.4).toFixed(3) + ')';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
        }
      } else {
        // Micro dust: soft circular particle
        ctx.globalAlpha = alpha;
        const sz = this.size * (0.7 + burstPhase * 0.6) * dpr;
        ctx.fillStyle = 'rgb(' + this.r + ',' + this.g + ',' + this.b + ')';
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* ---------- Ambient Post-Transition Dust Particles ---------- */
  class AmbientParticle {
    constructor(W, H) {
      this.W = W;
      this.H = H;
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * this.W;
      this.y = initial ? Math.random() * this.H : this.H + 20;
      this.size = 0.9 + Math.random() * 2.2;
      this.speed = 12 + Math.random() * 28; // gentle rising speed
      this.drift = (Math.random() - 0.5) * 15;
      this.seed = Math.random() * 100;
      this.isEmber = Math.random() > 0.72;
      this.maxAlpha = this.isEmber ? 0.8 : 0.45;
      this.alpha = 0;
    }

    update(dt) {
      this.y -= this.speed * dt;
      this.x += Math.sin(this.seed + this.y * 0.01) * this.drift * dt;
      if (this.y < -30) {
        this.reset(false);
      }
    }

    draw(dpr, ts) {
      const cx = this.x * dpr;
      const cy = this.y * dpr;
      const flicker = 0.7 + 0.3 * Math.sin(ts * 0.003 + this.seed);
      const alpha = this.maxAlpha * flicker;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (this.isEmber) {
        ctx.shadowColor = '#FF2200';
        ctx.shadowBlur = 8 * dpr;
        ctx.fillStyle = '#FF5511';
      } else {
        ctx.fillStyle = 'rgba(220, 180, 160, 0.7)';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, this.size * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Ambient Dust Loop (Runs Continuously in Cinematic Mode) ---------- */
  let ambientLastTs = null;
  const runAmbientAtmosphere = () => {
    ambientParticles = Array.from(
      { length: AMBIENT_PARTICLE_COUNT },
      () => new AmbientParticle(window.innerWidth, window.innerHeight)
    );

    const ambientLoop = (ts) => {
      if (!ambientLastTs) ambientLastTs = ts;
      const dt = Math.min(0.1, (ts - ambientLastTs) / 1000);
      ambientLastTs = ts;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);

      for (let i = 0; i < ambientParticles.length; i++) {
        ambientParticles[i].update(dt);
        ambientParticles[i].draw(dpr, ts);
      }

      animFrameId = requestAnimationFrame(ambientLoop);
    };

    animFrameId = requestAnimationFrame(ambientLoop);
  };

  /* ---------- The Great Cinematic Explosion & Full-Screen Flash ---------- */
  const triggerTransformation = () => {
    if (hasTransformed || isTransitioning) return;
    hasTransformed  = true;
    isTransitioning = true;

    // Permanently detach scroll triggers so it CANNOT ever revert on scroll back!
    window.removeEventListener('scroll', onScroll);

    if (animFrameId) cancelAnimationFrame(animFrameId);

    createCanvas();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    burstParticles = Array.from(
      { length: BURST_PARTICLE_COUNT },
      () => new BurstParticle(W, H)
    );

    transitionCanvas.style.opacity = '1';
    transitionStart = null;
    let themeApplied = false;

    const transitionLoop = (ts) => {
      if (!transitionStart) transitionStart = ts;
      const elapsed = ts - transitionStart;
      const progress = Math.min(1, elapsed / TRANSITION_DURATION);

      ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);
      ctx.save();

      /* 1. Draw dust particles layer */
      for (let i = 0; i < burstParticles.length; i++) {
        burstParticles[i].draw(progress, dpr, ts);
      }

      /* 2. Screen-wide thermal vignette creeping from perimeter */
      if (progress < 0.85) {
        const vigIntensity = Math.sin(progress * Math.PI * 1.15) * 0.75;
        if (vigIntensity > 0.02) {
          const grad = ctx.createRadialGradient(
            (W * dpr) / 2, (H * dpr) / 2, (W * dpr) * 0.1,
            (W * dpr) / 2, (H * dpr) / 2, (W * dpr) * 0.75
          );
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.65, 'rgba(120,0,0,' + (vigIntensity * 0.45).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(6,0,0,' + Math.min(1, vigIntensity * 1.1).toFixed(3) + ')');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W * dpr, H * dpr);
        }
      }

      /* 3. FULL-SCREEN BLINDING FLASH CURVE
            - 0.00 -> 0.38: subtle ambient heat
            - 0.38 -> 0.50: exponential blinding white flash surge to 100% full screen
            - 0.50: PEAK (100% white-hot flash cover). Switch website theme here!
            - 0.50 -> 0.72: searing crimson afterglow decay
            - 0.72 -> 1.00: clear to reveal the dark world
      */
      let flashWhite = 0;
      let flashCrimson = 0;

      if (progress >= 0.35 && progress <= 0.50) {
        // Surge into blinding white
        const f = (progress - 0.35) / 0.15; // 0 to 1
        flashWhite = Math.pow(f, 2.8); // ramps to 1.0
        flashCrimson = Math.sin(f * Math.PI * 0.5);
      } else if (progress > 0.50 && progress <= 0.75) {
        // Decay from pure white through incandescent crimson
        const f = (progress - 0.50) / 0.25; // 0 to 1
        flashWhite = Math.max(0, 1 - f * 3.5); // white drops fast
        flashCrimson = Math.pow(1 - f, 1.8);  // crimson decays smoothly
      }

      // Render full screen crimson chromatic flash
      if (flashCrimson > 0.01) {
        const radGrad = ctx.createRadialGradient(
          (W * dpr) / 2, (H * dpr) / 2, 0,
          (W * dpr) / 2, (H * dpr) / 2, (W * dpr) * 0.8
        );
        radGrad.addColorStop(0, 'rgba(255, 60, 20, ' + (flashCrimson * 0.95).toFixed(3) + ')');
        radGrad.addColorStop(0.5, 'rgba(220, 10, 10, ' + (flashCrimson * 0.85).toFixed(3) + ')');
        radGrad.addColorStop(1, 'rgba(120, 0, 0, ' + (flashCrimson * 0.95).toFixed(3) + ')');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, W * dpr, H * dpr);
      }

      // Render full screen pure white-hot blinding flash
      if (flashWhite > 0.01) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(1, flashWhite).toFixed(3) + ')';
        ctx.fillRect(0, 0, W * dpr, H * dpr);
      }

      ctx.restore();

      /* 4. THEME SWITCH RIGHT AT THE BLINDING PEAK (100% white cover) */
      if (!themeApplied && progress >= 0.49) {
        themeApplied = true;
        // Instantly transform the site while masked under the blinding flash
        document.body.classList.add('cinematic-mode');
        document.body.classList.add('cinematic-shaking');
        if (typeof handleHeroParallax === 'function') {
          handleHeroParallax();
        }
        if (typeof window.triggerSlideInEntrance === 'function') {
          window.triggerSlideInEntrance();
        }
        setTimeout(() => {
          document.body.classList.remove('cinematic-shaking');
        }, 450);
      }

      if (progress < 1) {
        animFrameId = requestAnimationFrame(transitionLoop);
      } else {
        isTransitioning = false;
        burstParticles = [];
        // Switch to living ambient dust atmosphere
        runAmbientAtmosphere();
      }
    };

    animFrameId = requestAnimationFrame(transitionLoop);
  };

  /* ---------- Scroll Trigger Monitoring ---------- */
  const checkTrigger = () => {
    if (hasTransformed || isTransitioning) return;

    const el = document.getElementById(TRIGGER_SECTION_ID) || document.querySelector('.ticker-section');
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Triggers when the top of #ticker section comes into the viewport
    if (rect.top <= window.innerHeight * 0.78) {
      triggerTransformation();
    }
  };

  const onScroll = () => {
    if (hasTransformed) return;
    if (!scrollTicking) {
      window.requestAnimationFrame(() => {
        checkTrigger();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  };

  /* ---------- Initial Check on Page Load ---------- */
  const initialCheck = () => {
    const el = document.getElementById(TRIGGER_SECTION_ID) || document.querySelector('.ticker-section');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // If user refreshes or lands already past the ticker section
    if (rect.top <= window.innerHeight * 0.78) {
      hasTransformed = true;
      document.body.classList.add('cinematic-mode');
      createCanvas();
      transitionCanvas.style.opacity = '1';
      runAmbientAtmosphere();
      if (typeof handleHeroParallax === 'function') {
        handleHeroParallax();
      }
    }
  };

  /* ---------- Bootstrap ---------- */
  const init = () => {
    createCanvas();
    initialCheck();
    if (!hasTransformed) {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', () => {
      sizeCanvas();
      if (!hasTransformed) checkTrigger();
    }, { passive: true });
  };

  return { init, triggerTransformation };
})();

/* DOM Ready Setup */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', CinematicEngine.init);
} else {
  CinematicEngine.init();
}
