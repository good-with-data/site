// Chatbot modal — Good With Data CIC
// Reads API URL from window.CHATBOT_API_URL (set in chat-modal.html partial)

(function () {
  'use strict';

  // Wait until DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const chatPanel = document.getElementById('chat-panel');
    if (!chatPanel) return; // modal not present on this page

    const API_URL = (window.CHATBOT_API_URL || 'http://localhost:3000').replace(/\/$/, '');

    const contactPanel = document.getElementById('contact-panel');
    const successPanel = document.getElementById('success-panel');
    const chatThread = document.getElementById('chat-thread');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const showContactBtn = document.getElementById('show-contact-btn');
    const backToChatBtn = document.getElementById('back-to-chat-btn');
    const backToChatSuccessBtn = document.getElementById('back-to-chat-success-btn');
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');
    const contactSubmitBtn = document.getElementById('contact-submit-btn');

    let chatHistory = []; // { role: 'user'|'assistant', content: string }[]

    // ── Panel helpers ──────────────────────────────────────────────────────────

    function showPanel(name) {
      chatPanel.style.display = name === 'chat' ? 'block' : 'none';
      contactPanel.style.display = name === 'contact' ? 'block' : 'none';
      successPanel.style.display = name === 'success' ? 'block' : 'none';
    }

    // ── Chat rendering ─────────────────────────────────────────────────────────

    function appendBubble(sender, text, isBot) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('d-flex', 'mb-2');

      const bubble = document.createElement('div');
      bubble.classList.add('rounded', 'p-2');
      bubble.style.maxWidth = '85%';

      if (isBot) {
        bubble.style.background = '#e9ecef';
        bubble.classList.add('me-auto');
        const label = document.createElement('small');
        label.classList.add('text-muted', 'fw-semibold', 'd-block', 'mb-1');
        label.textContent = 'Good With Data';
        bubble.appendChild(label);
      } else {
        bubble.style.background = '#0d6efd';
        bubble.style.color = '#fff';
        bubble.classList.add('ms-auto');
      }

      // Render newlines as <br>
      text.split('\n').forEach(function (line, i, arr) {
        bubble.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) bubble.appendChild(document.createElement('br'));
      });

      wrapper.appendChild(bubble);
      chatThread.appendChild(wrapper);
      chatThread.scrollTop = chatThread.scrollHeight;
    }

    function showTyping() {
      const div = document.createElement('div');
      div.id = 'typing-indicator';
      div.classList.add('d-flex', 'mb-2');
      div.innerHTML = '<div class="rounded p-2 me-auto" style="background:#e9ecef;"><em class="text-muted small">typing…</em></div>';
      chatThread.appendChild(div);
      chatThread.scrollTop = chatThread.scrollHeight;
    }

    function removeTyping() {
      const el = document.getElementById('typing-indicator');
      if (el) el.remove();
    }

    // ── Send message ───────────────────────────────────────────────────────────

    async function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;

      chatInput.value = '';
      chatSendBtn.disabled = true;
      chatInput.disabled = true;

      appendBubble('You', text, false);

      // Build history snapshot before adding current message
      const historySnapshot = chatHistory.slice();
      chatHistory.push({ role: 'user', content: text });

      showTyping();

      try {
        const res = await fetch(API_URL + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: historySnapshot }),
        });

        removeTyping();

        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || '';
          chatHistory.push({ role: 'assistant', content: reply });
          // Cap history at 20 messages (10 turns)
          if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
          appendBubble('GWD', reply, true);
        } else {
          chatHistory.pop(); // remove the user message we added
          appendBubble('GWD', 'Sorry, something went wrong. Please try again or email hello@goodwithdata.org.uk', true);
        }
      } catch (_err) {
        removeTyping();
        chatHistory.pop();
        appendBubble('GWD', 'I\'m unable to connect right now. Please email hello@goodwithdata.org.uk', true);
      }

      chatSendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }

    // ── Event listeners ────────────────────────────────────────────────────────

    chatSendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    showContactBtn.addEventListener('click', function () {
      showPanel('contact');
    });

    backToChatBtn.addEventListener('click', function () {
      contactStatus.textContent = '';
      showPanel('chat');
      chatInput.focus();
    });

    backToChatSuccessBtn.addEventListener('click', function () {
      showPanel('chat');
      chatInput.focus();
    });

    // Reset panels when modal is closed and reopened
    const modalEl = document.getElementById('chatModal');
    if (modalEl) {
      modalEl.addEventListener('show.bs.modal', function () {
        showPanel('chat');
        contactStatus.textContent = '';
        contactForm.reset();
      });
      modalEl.addEventListener('shown.bs.modal', function () {
        chatInput.focus();
      });
    }

    // ── Contact form ───────────────────────────────────────────────────────────

    contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      contactStatus.textContent = '';

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      const consent = document.getElementById('gdpr-consent').checked;

      if (!name || !email) {
        contactStatus.textContent = 'Please fill in your name and email.';
        return;
      }
      if (!consent) {
        contactStatus.textContent = 'Please tick the consent checkbox to continue.';
        return;
      }

      contactSubmitBtn.disabled = true;
      contactStatus.textContent = 'Sending…';

      try {
        const res = await fetch(API_URL + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message }),
        });

        if (res.ok) {
          showPanel('success');
        } else {
          const data = await res.json().catch(function () { return {}; });
          contactStatus.textContent = data.error || 'Failed to send. Please email hello@goodwithdata.org.uk';
        }
      } catch (_err) {
        contactStatus.textContent = 'Unable to connect. Please email hello@goodwithdata.org.uk';
      }

      contactSubmitBtn.disabled = false;
    });
  }
})();
