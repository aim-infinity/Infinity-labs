const codeByTab = {
  html: `<button class="ai-btn">
  <img
    class="ai-btn__icon"
    src="search_spark.png"
    alt="AI search spark"
  />
  <span class="ai-btn__label">AI Mode</span>
</button>`,

  css: `@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin-border {
  to { --angle: 360deg; }
}

.ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 41px;
  padding: 0 18px;
  border-radius: 60px;
  border: 2px solid transparent;
  cursor: pointer;
  background-image:
    linear-gradient(#F6F6F6, #F6F6F6),
    linear-gradient(transparent, transparent);
  background-origin: padding-box, border-box;
  background-clip: padding-box, border-box;
  animation: none;
}

.ai-btn:hover {
  background-image:
    linear-gradient(#fff, #fff),
    conic-gradient(
      from var(--angle),
      transparent   0deg,
      transparent  40deg,
      #4285F4       75deg,  /* blue   */
      #4285F4      195deg,  /* blue   */
      #EA4335      225deg,  /* red    */
      #FBBC04      248deg,  /* yellow */
      #34A853      268deg,  /* green  */
      transparent 305deg,
      transparent 360deg
    );
  background-origin: padding-box, border-box;
  background-clip: padding-box, border-box;
  animation: spin-border 2.4s linear infinite;
  box-shadow:
    0 2px 10px rgba(0,0,0,.10),
    0 4px 20px rgba(66,133,244,.18);
}

.ai-btn__icon {
  width: 20px;
  height: 20px;
  display: block;
}

.ai-btn__label {
  font-size: 12px;
  font-weight: 400;
  color: #000;
}`,

  js: `// No JavaScript required.
// The animation is driven entirely by CSS
// using @property and conic-gradient.`,
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

  // Update tab buttons
  document.querySelectorAll('.code-tab').forEach(btn => {
    btn.classList.toggle('code-tab--active', btn.textContent.trim().toLowerCase() === tab);
  });

  // Show the matching code block
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
          <rect x="4.5" y="4.5" width="7" height="7" rx="1.5"
            stroke="currentColor" stroke-width="1.2"/>
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
});
