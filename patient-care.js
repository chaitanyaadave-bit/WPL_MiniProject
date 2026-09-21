document.addEventListener("DOMContentLoaded", function () {
  const data = mcLoad();
  const paymentModalEl = document.getElementById("paymentModal");
  const paymentModal = new bootstrap.Modal(paymentModalEl);
  let pendingPayment = null; // function returning a detail string

  /* ---------------------------------------------------
     Buy Medicine
     --------------------------------------------------- */
  const cart = {}; // medicineId -> qty
  const medicineList = document.getElementById("medicineList");
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("checkoutBtn");

  medicineList.innerHTML = data.medicines.map(m => `
    <div class="card shadow-sm">
      <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <div class="d-flex align-items-center gap-2">
            <h3 class="h6 mb-0">${m.name}</h3>
            ${m.rx ? '<span class="badge bg-dark">Rx</span>' : ''}
          </div>
          <p class="small text-muted mb-0">${m.category} &middot; ₹${m.price} / strip</p>
        </div>
        <button class="btn btn-outline-navy btn-sm" data-add-medicine="${m.id}">Add to cart</button>
      </div>
    </div>
  `).join("");

  function renderCart() {
    const ids = Object.keys(cart).filter(id => cart[id] > 0);
    if (ids.length === 0) {
      cartItemsEl.innerHTML = '<p class="small text-muted mb-0">Your cart is empty.</p>';
      cartTotalEl.textContent = "₹0";
      checkoutBtn.disabled = true;
      return;
    }
    let total = 0;
    cartItemsEl.innerHTML = ids.map(id => {
      const med = data.medicines.find(m => m.id === id);
      const lineTotal = med.price * cart[id];
      total += lineTotal;
      return `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
          <div>
            <div class="small fw-semibold">${med.name}</div>
            <div class="small text-muted">Qty ${cart[id]} &times; ₹${med.price}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="small fw-semibold">₹${lineTotal}</span>
            <button class="btn btn-sm btn-outline-navy py-0 px-2" data-remove-medicine="${id}" aria-label="Remove">&minus;</button>
          </div>
        </div>`;
    }).join("");
    cartTotalEl.textContent = "₹" + total;
    checkoutBtn.disabled = false;
  }

  medicineList.querySelectorAll("[data-add-medicine]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-add-medicine");
      cart[id] = (cart[id] || 0) + 1;
      renderCart();
      mcToast(data.medicines.find(m => m.id === id).name + " added to cart");
    });
  });

  cartItemsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-medicine]");
    if (!btn) return;
    const id = btn.getAttribute("data-remove-medicine");
    cart[id] = Math.max(0, (cart[id] || 0) - 1);
    renderCart();
  });

  checkoutBtn.addEventListener("click", () => {
    if (!mcRequireLogin("patient-care.html")) return;
    const ids = Object.keys(cart).filter(id => cart[id] > 0);
    const total = ids.reduce((sum, id) => sum + data.medicines.find(m => m.id === id).price * cart[id], 0);
    const rxItems = ids.filter(id => data.medicines.find(m => m.id === id).rx);

    const summaryHtml = `
      <div class="d-flex justify-content-between small mb-1"><span>Items</span><span>${ids.reduce((s, id) => s + cart[id], 0)}</span></div>
      <div class="d-flex justify-content-between fw-semibold"><span>Total</span><span>₹${total}</span></div>
      ${rxItems.length ? '<div class="small text-muted mt-2 mb-0"><i class="bi bi-info-circle me-1"></i>We\'ll confirm your prescription before dispatch.</div>' : ''}
    `;
    openPaymentModal(summaryHtml, function () {
      const fresh = mcLoad();
      const orderId = "ORD" + Math.floor(1000 + Math.random() * 9000);
      fresh.orders.push({ orderId, memberId: mcCurrentUser(), items: ids.map(id => ({ id, qty: cart[id] })), total });
      mcSave(fresh);
      ids.forEach(id => cart[id] = 0);
      renderCart();
      return `Order ${orderId} placed for ₹${total}. You'll get a pickup/delivery update by SMS.`;
    });
  });

  renderCart();

  /* ---------------------------------------------------
     Health Checkups
     --------------------------------------------------- */
  const checkupGrid = document.getElementById("checkupGrid");
  checkupGrid.innerHTML = data.packages.map(p => `
    <div class="col-md-6 col-lg-3">
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column">
          <h3 class="h6">${p.name}</h3>
          <p class="small text-muted flex-grow-1">${p.includes}</p>
          <p class="fw-bold mb-3">₹${p.price}</p>
          <button class="btn btn-teal btn-sm w-100 mt-auto" data-book-package="${p.id}">Book this package</button>
        </div>
      </div>
    </div>
  `).join("");

  checkupGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-package]");
    if (!btn) return;
    if (!mcRequireLogin("patient-care.html")) return;
    const pkg = data.packages.find(p => p.id === btn.getAttribute("data-book-package"));
    const summaryHtml = `
      <div class="d-flex justify-content-between small mb-1"><span>${pkg.name}</span><span>₹${pkg.price}</span></div>
      <div class="small text-muted mb-0">${pkg.includes}</div>
    `;
    openPaymentModal(summaryHtml, function () {
      const bookingId = "CKP" + Math.floor(1000 + Math.random() * 9000);
      return `Checkup booking ${bookingId} confirmed. Our lab team will call to schedule your sample collection.`;
    });
  });

  /* ---------------------------------------------------
     View Reports
     --------------------------------------------------- */
  const reportForm = document.getElementById("reportSearchForm");
  const reportResult = document.getElementById("reportResult");
  reportForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const memberId = document.getElementById("reportMemberId").value.trim().toUpperCase();
    const reportId = document.getElementById("reportId").value.trim().toUpperCase();
    const fresh = mcLoad();
    const report = fresh.reports.find(r => r.memberId.toUpperCase() === memberId && r.reportId.toUpperCase() === reportId);

    if (!report) {
      reportResult.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>No report found for that Member ID and Report ID combination. Double-check both fields and try again.
        </div>`;
      return;
    }
    reportResult.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
            <h3 class="h6 mb-0">${report.type}</h3>
            <span class="badge bg-success">${report.status}</span>
          </div>
          <p class="small text-muted mb-1"><i class="bi bi-calendar3 me-2"></i>${report.date}</p>
          <p class="small text-muted mb-3"><i class="bi bi-person me-2"></i>Ordered by ${report.doctor}</p>
          <p class="mb-0">${report.summary}</p>
        </div>
      </div>`;
  });

  /* ---------------------------------------------------
     Bills & Payments
     --------------------------------------------------- */
  const billForm = document.getElementById("billSearchForm");
  const billResult = document.getElementById("billResult");

  function renderBills(memberId) {
    const fresh = mcLoad();
    const bills = fresh.bills.filter(b => b.memberId.toUpperCase() === memberId.toUpperCase());
    if (bills.length === 0) {
      billResult.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>No bills found for Member ID "${memberId}".
        </div>`;
      return;
    }
    billResult.innerHTML = `
      <div class="table-responsive">
        <table class="table table-striped align-middle bg-white shadow-sm">
          <thead style="background:var(--navy);color:#fff;"><tr><th>Bill ID</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${bills.map(b => `
              <tr>
                <td>${b.billId}</td>
                <td>${b.description}</td>
                <td>${b.date}</td>
                <td>₹${b.amount}</td>
                <td>${b.status === "Paid" ? '<span class="badge bg-success">Paid</span>' : '<span class="badge bg-warning text-dark">Unpaid</span>'}</td>
                <td>${b.status === "Unpaid" ? `<button class="btn btn-teal btn-sm" data-pay-bill="${b.billId}">Pay now</button>` : ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    billResult.querySelectorAll("[data-pay-bill]").forEach(btn => {
      btn.addEventListener("click", () => {
        const bill = bills.find(b => b.billId === btn.getAttribute("data-pay-bill"));
        const summaryHtml = `
          <div class="d-flex justify-content-between small mb-1"><span>${bill.description}</span><span>₹${bill.amount}</span></div>
          <div class="small text-muted mb-0">Bill ${bill.billId}</div>
        `;
        openPaymentModal(summaryHtml, function () {
          const latest = mcLoad();
          const target = latest.bills.find(x => x.billId === bill.billId);
          if (target) target.status = "Paid";
          mcSave(latest);
          renderBills(memberId);
          return `Bill ${bill.billId} marked as paid. A receipt has been sent to your registered email.`;
        });
      });
    });
  }

  billForm.addEventListener("submit", function (e) {
    e.preventDefault();
    renderBills(document.getElementById("billMemberId").value.trim());
  });

  /* ---------------------------------------------------
     Shared payment modal
     --------------------------------------------------- */
  function openPaymentModal(summaryHtml, onConfirm) {
    document.getElementById("paymentSummary").innerHTML = summaryHtml;
    document.getElementById("paymentFormWrap").classList.remove("d-none");
    document.getElementById("paymentSuccess").classList.add("d-none");
    pendingPayment = onConfirm;
    paymentModal.show();
  }

  document.getElementById("confirmPaymentBtn").addEventListener("click", function () {
    if (!pendingPayment) return;
    const detail = pendingPayment();
    document.getElementById("paymentFormWrap").classList.add("d-none");
    document.getElementById("paymentSuccessDetail").textContent = detail;
    document.getElementById("paymentSuccess").classList.remove("d-none");
    pendingPayment = null;
  });
});
