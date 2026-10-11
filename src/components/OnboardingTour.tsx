import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

export interface TourConfig {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function createBittyTour(config?: TourConfig): any {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    keyboardNavigation: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true,
      },
      classes: 'bitty-shepherd-theme',
      scrollTo: {
        behavior: 'smooth',
        block: 'center',
      },
    },
  });

  // Step 1: Welcome Center Modal
  tour.addStep({
    id: 'step-welcome',
    title: '<div class="flex items-center gap-2 text-cyan-300 font-cyber"><span class="text-base">👋</span> WELCOME TO BITTY BOX</div>',
    text: `
      <div class="space-y-2 text-xs font-sans text-purple-100">
        <p class="leading-relaxed">
          <strong class="text-cyan-300">Bitty Box</strong> makes it simple to build and store entire web projects, portfolios, and interactive apps <strong>directly inside a single shareable link</strong>.
        </p>
        <div class="p-2.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-[11px] text-cyan-200 leading-normal">
          ✨ <strong>No servers. No hosting bills. No account setup required.</strong> Your work is stored right inside the web link!
        </div>
      </div>
    `,
    buttons: [
      {
        text: 'SKIP TOUR',
        classes: 'shepherd-btn-secondary',
        action: () => tour.cancel(),
      },
      {
        text: 'SHOW ME AROUND →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 2: Document Title & Metadata
  tour.addStep({
    id: 'step-title',
    attachTo: {
      element: '#doc-title-input',
      on: 'bottom',
    },
    title: '<div class="flex items-center gap-2 text-cyan-300 font-cyber"><span class="text-base">🏷️</span> NAME YOUR PROJECT</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Give your project a friendly name and choose a fun emoji icon.</p>
        <p class="text-[11px] text-cyan-300/90">Bitty Box automatically stores your title and settings directly inside your saved link so it always looks polished when shared.</p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 3: Template Gallery
  tour.addStep({
    id: 'step-templates',
    attachTo: {
      element: '#bitty-presets-btn',
      on: 'bottom',
    },
    title: '<div class="flex items-center gap-2 text-fuchsia-300 font-cyber"><span class="text-base">⚡</span> READY-MADE TEMPLATES</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Want a quick head start? Choose from popular pre-built templates:</p>
        <ul class="list-disc list-inside text-[11px] text-cyan-200/90 space-y-1 pl-1">
          <li>Personal Portfolios &amp; Digital Bio Cards</li>
          <li>Help Guides, Notes &amp; Documentation</li>
          <li>Visual Dashboards &amp; Interactive Charts</li>
          <li>Playable Mini-Games &amp; Interactive Tools</li>
        </ul>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 4: Code Workspace & Prettier
  tour.addStep({
    id: 'step-code-editor',
    attachTo: {
      element: '#format-code-btn',
      on: 'bottom',
    },
    title: '<div class="flex items-center gap-2 text-cyan-300 font-cyber"><span class="text-base">💻</span> YOUR CREATIVE WORKSPACE</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Write standard HTML, CSS, JavaScript, or Markdown with immediate live preview.</p>
        <p class="text-[11px] text-teal-300">
          💡 Click <strong>FORMAT CODE</strong> (or press <kbd class="px-1 py-0.5 rounded bg-black/60 border border-cyan-500/30">Shift+Alt+F</kbd>) anytime to tidy up and organize your code in one click!
        </p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 5: Telemetry & URL Compression Gauge
  tour.addStep({
    id: 'step-telemetry',
    attachTo: {
      element: '#stats-copy-url-btn',
      on: 'top',
    },
    title: '<div class="flex items-center gap-2 text-cyan-300 font-cyber"><span class="text-base">📊</span> STORING YOUR WORK IN YOUR LINK</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>See how smoothly your project packs into a single link. The bar shows your link size and confirms it fits easily into modern web browsers.</p>
        <p class="text-[11px] text-cyan-300">Whenever you are ready, click <strong>COPY GENERATED URL</strong> to share your work with anyone in the world!</p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 6: Parameter & AES-256 Vault Cipher
  tour.addStep({
    id: 'step-security',
    attachTo: {
      element: '#bitty-meta-btn',
      on: 'top',
    },
    title: '<div class="flex items-center gap-2 text-fuchsia-300 font-cyber"><span class="text-base">🔒</span> LOCK YOUR WORK WITH A PASSWORD</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Need privacy? You can lock your work with a secure password so only people with the key can open your link.</p>
        <p class="text-[11px] text-fuchsia-300/90">You can also schedule timed capsules that unlock on a specific date or event.</p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 7: QR Holograms & Sharing
  tour.addStep({
    id: 'step-qr-share',
    attachTo: {
      element: '#nav-qr-btn',
      on: 'bottom',
    },
    title: '<div class="flex items-center gap-2 text-teal-300 font-cyber"><span class="text-base">📱</span> INSTANT QR CODES &amp; DOWNLOADS</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Open your work on any phone or tablet by scanning a QR code, or download a standalone copy to keep safely on your computer.</p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'NEXT →',
        classes: 'shepherd-btn-primary',
        action: () => tour.next(),
      },
    ],
  });

  // Step 8: Workspace Themes
  tour.addStep({
    id: 'step-themes',
    attachTo: {
      element: '#nav-theme-toggle-btn',
      on: 'bottom',
    },
    title: '<div class="flex items-center gap-2 text-cyan-300 font-cyber"><span class="text-base">🎨</span> CHOOSE YOUR STYLE</div>',
    text: `
      <div class="space-y-1.5 text-xs font-sans text-purple-100">
        <p>Pick the color theme that feels right for you:</p>
        <ul class="list-disc list-inside text-[11px] text-cyan-200/90 space-y-1 pl-1">
          <li><strong class="text-fuchsia-300">Neon Synthwave</strong> (Glowing cyberpunk purple &amp; cyan)</li>
          <li><strong class="text-zinc-200">Minimalist Monochrome</strong> (Clean high-contrast slate)</li>
          <li><strong class="text-emerald-300">Matrix Cyber</strong> (Retro green terminal style)</li>
        </ul>
        <p class="text-[11px] text-emerald-400 font-bold mt-2">You are ready to create and store your work in links!</p>
      </div>
    `,
    buttons: [
      {
        text: '← BACK',
        classes: 'shepherd-btn-secondary',
        action: () => tour.back(),
      },
      {
        text: 'START CREATING NOW 🚀',
        classes: 'shepherd-btn-primary',
        action: () => tour.complete(),
      },
    ],
  });

  if (config?.onComplete) {
    tour.on('complete', config.onComplete);
  }
  if (config?.onCancel) {
    tour.on('cancel', config.onCancel);
  }

  return tour;
}
