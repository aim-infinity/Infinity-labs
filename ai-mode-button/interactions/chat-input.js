const codeByTab = {
  html: `<div class="chat-wrap">
  <div class="grey-outline"></div>
  <div class="gradient-ring"></div>
  <div class="chat-inner">
    <textarea class="chat-textarea"
      placeholder="Type your message..."></textarea>
    <div class="chat-row">...</div>
  </div>
</div>`,

  css: `@property --shimmer-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes shimmer-spin {
  to { --shimmer-angle: 360deg; }
}

.grey-outline {
  border: 1px solid #EDEDED;
}

.gradient-ring {
  padding: 2px;
  background: conic-gradient(from var(--shimmer-angle), ...);
  animation: shimmer-spin 4s linear infinite;
  mask-composite: exclude;
}

.chat-wrap.is-active .gradient-ring { opacity: 1; }`,

  js: `const chatWrap = document.querySelector('.chat-wrap');
const textarea  = document.querySelector('.chat-textarea');
let cooldownTimer;

function activateBeam() {
  clearTimeout(cooldownTimer);
  chatWrap.classList.remove('is-cooling');
  chatWrap.classList.add('is-active');
}

function fadeBeam() {
  chatWrap.classList.remove('is-active');
  chatWrap.classList.add('is-cooling');
}

textarea.addEventListener('focus', () => {
  activateBeam();
});

textarea.addEventListener('input', () => {
  activateBeam();
});

textarea.addEventListener('blur', () => {
  clearTimeout(cooldownTimer);
  cooldownTimer = setTimeout(() => {
    if (document.activeElement !== textarea) {
      fadeBeam();
    }
  }, 700);
});`,
};

let activeTab = 'html';
let activeTopTab = 'explanation';

function switchTopTab(tab) {
  activeTopTab = tab;
  document.querySelectorAll('.top-tab').forEach(btn => {
    btn.classList.toggle('top-tab--active', btn.dataset.topTab === tab);
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('view-panel--active', panel.dataset.viewPanel === tab);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.code-tab').forEach(btn => {
    btn.classList.toggle('code-tab--active', btn.textContent.trim().toLowerCase() === tab);
  });
  document.querySelectorAll('.code-block').forEach(block => {
    block.classList.toggle('code-block--active', block.id === `block-${tab}`);
  });
}

function copyCode() {
  navigator.clipboard.writeText(codeByTab[activeTab]).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copy-btn--copied');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 7L5 10L11 3" stroke="currentColor" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!`;
    setTimeout(() => {
      btn.classList.remove('copy-btn--copied');
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M3 8.5H2C1.45 8.5 1 8.05 1 7.5V2C1 1.45 1.45 1 2 1H7.5
            C8.05 1 8.5 1.45 8.5 2V3" stroke="currentColor" stroke-width="1.2"
            stroke-linecap="round"/>
        </svg>
        Copy`;
    }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  switchTopTab(activeTopTab);

  const chatWrap = document.querySelector('.chat-wrap');
  const textarea  = document.querySelector('.chat-textarea');
  if (!chatWrap || !textarea) return;

  let cooldownTimer;

  const activateBeam = () => {
    clearTimeout(cooldownTimer);
    chatWrap.classList.remove('is-cooling');
    chatWrap.classList.add('is-active');
  };

  const fadeBeam = () => {
    chatWrap.classList.remove('is-active');
    chatWrap.classList.add('is-cooling');
  };

  textarea.addEventListener('focus', activateBeam);
  textarea.addEventListener('input', activateBeam);

  textarea.addEventListener('blur', () => {
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      if (document.activeElement !== textarea) {
        fadeBeam();
      }
    }, 700);
  });
});
