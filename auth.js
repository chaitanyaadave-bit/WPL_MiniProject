/* =========================================================
   Mediconnect — auth helpers (demo only, not real security)
   ========================================================= */

function mcCurrentUser() {
  const data = mcLoad();
  return data.currentUser;
}

function mcLogout() {
  const data = mcLoad();
  data.currentUser = null;
  mcSave(data);
  window.location.href = "index.html";
}

function mcLoginWith(identifier, password) {
  const data = mcLoad();
  const idNorm = identifier.trim().toLowerCase();
  const account = data.accounts.find(a =>
    a.password === password && (
      a.memberId.toLowerCase() === idNorm ||
      a.email.toLowerCase() === idNorm ||
      a.phone === identifier.trim()
    )
  );
  if (!account) return { ok: false, message: "We couldn't match that phone, email or Member ID with that password. Please try again." };
  data.currentUser = account.memberId;
  mcSave(data);
  return { ok: true, account };
}

function mcRegisterAccount({ name, phone, email, address, password }) {
  const data = mcLoad();
  const emailTaken = data.accounts.some(a => a.email.toLowerCase() === email.toLowerCase());
  const phoneTaken = data.accounts.some(a => a.phone === phone);
  if (emailTaken) return { ok: false, message: "An account already exists with this email address." };
  if (phoneTaken) return { ok: false, message: "An account already exists with this phone number." };

  const memberId = mcGenerateMemberId(data);
  const account = { memberId, name, phone, email, address, password };
  data.accounts.push(account);
  data.currentUser = memberId;
  mcSave(data);
  return { ok: true, account };
}

/* Renders the right-hand side of the navbar depending on login state.
   Call on every page after the navbar markup is in the DOM. */
function mcRenderNavAuth() {
  const slot = document.getElementById("navAuthSlot");
  if (!slot) return;
  const data = mcLoad();
  const user = data.currentUser ? data.accounts.find(a => a.memberId === data.currentUser) : null;

  if (user) {
    slot.innerHTML = `
      <span class="pill-outline d-none d-md-inline-flex">Hi, ${mcEscape(user.name.split(" ")[0])} &middot; ${mcEscape(user.memberId)}</span>
      <button class="btn btn-outline-navy btn-sm" id="navLogoutBtn" type="button">Log out</button>
    `;
    document.getElementById("navLogoutBtn").addEventListener("click", mcLogout);
  } else {
    slot.innerHTML = `
      <a href="login.html" class="nav-link" style="font-weight:600;">Log in</a>
      <a href="register.html" class="btn btn-teal btn-sm">Register</a>
    `;
  }
}

/* Guards an action that requires login. If logged out, shows a message
   and stores the intended redirect so login.html can send them back. */
function mcRequireLogin(redirectPage) {
  const user = mcCurrentUser();
  if (user) return true;
  sessionStorage.setItem("mc_redirect_after_login", redirectPage || "index.html");
  window.location.href = "login.html?redirect=" + encodeURIComponent(redirectPage || "index.html");
  return false;
}

function mcEscape(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
