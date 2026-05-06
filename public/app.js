async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Xatolik yuz berdi.");
  }
  return data;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uz-UZ");
}

async function loadAuthState() {
  const userBox = document.getElementById("userBox");
  const logoutBtn = document.getElementById("logoutBtn");
  if (!userBox || !logoutBtn) return null;

  try {
    const { user } = await api("/api/auth/me", { method: "GET" });
    if (user) {
      userBox.textContent = `Salom, ${user.fullName}`;
      logoutBtn.classList.remove("hidden");
      logoutBtn.onclick = async () => {
        await api("/api/auth/logout", { method: "POST" });
        window.location.href = "/login.html";
      };
      return user;
    }

    userBox.textContent = "Mehmon foydalanuvchi";
    logoutBtn.classList.add("hidden");
    return null;
  } catch (_err) {
    userBox.textContent = "Mehmon foydalanuvchi";
    logoutBtn.classList.add("hidden");
    return null;
  }
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  const output = document.getElementById("loginMsg");
  if (!form || !output) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      output.textContent = "Login bo'ldi. Contact sahifasiga o'ting.";
      window.location.href = "/contact.html";
    } catch (err) {
      output.textContent = err.message;
    }
  });
}

function setupSignupForm() {
  const form = document.getElementById("signupForm");
  const output = document.getElementById("signupMsg");
  if (!form || !output) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password })
      });
      output.textContent = "Ro'yxatdan o'tdingiz. Contact sahifasiga o'ting.";
      window.location.href = "/contact.html";
    } catch (err) {
      output.textContent = err.message;
    }
  });
}

async function loadNews() {
  const list = document.getElementById("newsList");
  if (!list) return;

  try {
    const rows = await api("/api/news", { method: "GET" });
    list.innerHTML = "";

    rows.forEach((item) => {
      const block = document.createElement("article");
      block.className = "news-item";
      block.innerHTML = `
        <h3>${item.title}</h3>
        <p>${item.content}</p>
        <div class="meta">${formatDate(item.created_at)}</div>
      `;
      list.appendChild(block);
    });
  } catch (err) {
    list.innerHTML = `<p class="msg">${err.message}</p>`;
  }
}

async function setupContact() {
  const form = document.getElementById("messageForm");
  const list = document.getElementById("messageList");
  const msg = document.getElementById("contactMsg");
  if (!form || !list || !msg) return;

  const user = await loadAuthState();
  if (!user) {
    msg.textContent = "Xabar qoldirish uchun login qiling.";
    form.classList.add("hidden");
    return;
  }

  async function refreshMessages() {
    try {
      const rows = await api("/api/messages", { method: "GET" });
      list.innerHTML = "";
      rows.forEach((item) => {
        const block = document.createElement("article");
        block.className = "message-item";
        block.innerHTML = `
          <p>${item.message_text}</p>
          <div class="meta">${item.full_name} | ${formatDate(item.created_at)}</div>
        `;
        list.appendChild(block);
      });
    } catch (err) {
      msg.textContent = err.message;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("messageText").value;
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ message: text })
      });
      document.getElementById("messageText").value = "";
      msg.textContent = "Xabaringiz saqlandi.";
      await refreshMessages();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  await refreshMessages();
}

function setupYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", async () => {
  setupYear();
  await loadAuthState();
  setupLoginForm();
  setupSignupForm();
  await loadNews();
  await setupContact();
});
