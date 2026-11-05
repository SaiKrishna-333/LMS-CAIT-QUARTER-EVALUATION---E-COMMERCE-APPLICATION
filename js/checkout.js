/* ==========================================================================
   NOVA - checkout.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This file takes the cart all the way to a real order in
   three guided steps - Delivery details, Payment method, then a simulated
   Payment processing screen - and finally writes the order to storage.

   THE THREE STEPS
   1) DELIVERY  - a form for name / phone / address / city / pin; every field
                  is checked with inline rules (no browser alerts).
   2) PAYMENT   - pick UPI, Card or Cash-on-Delivery. Card/UPI numbers are
                  validated in the browser but are NEVER stored (demo only).
   3) PROCESS   - a short animated "contacting bank" wait, then success.

   SAFEGUARDS
   - requireLogin() sends guests to log in first.
   - an isProcessing flag stops a double-tap from creating two orders.
   - when payment succeeds it reduces product stock and clears the cart.

   FUNCTIONS IN THIS FILE
   - gotoStep(step)          - show one step panel and update the progress bar
   - setupDeliveryForm()     - attach the field validators + Next button
   - v(id)                   - tidy helper: an input's trimmed value
   - checkText/checkPattern  - rule helpers (min length / regex) per field
   - show(id, message)       - print a red note under a delivery field
   - drawSummary()           - the fixed price panel beside the form
   - setupPaymentChoice()    - show/hide the UPI or Card box when picked
   - selectedMethod()        - which payment the shopper chose
   - validatePayment()       - check UPI id / card number / expiry / CVV
   - setPayError(id, msg)    - inline error under a payment field
   - payNow()                - guard, show the processing view, then finish
   - createOrder(method)     - snapshot items, cut stock, save a new order in
                               novaOrders, add an admin notification +
                               activity, empty the cart, go to the receipt
   - drawMiniBill()          - the compact totals on the payment step

   The order id is built as "NV" + a time-based tail so it looks realistic and
   the shopper can track it later on orders.html.
   ========================================================================== */

/* ==========================================================================
   NOVA - checkout.js  (CHECKOUT + PAYMENT SIMULATION)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   - Drives the 3-step checkout (Delivery -> Summary -> Payment).
   - Validates each step before allowing the next.
   - Simulates a payment gateway with a short delay, then:
       1. creates a unique order,
       2. reduces product stock,
       3. saves the order into novaOrders,
       4. clears the cart.
   Nothing is sent anywhere - the "bank" is a setTimeout!
   ========================================================================== */

// In-memory checkout data. Filled as the customer types; lost on refresh
// (which is fine - the cart itself is persisted).
var delivery = { name: "", phone: "", email: "", address: "", city: "", pin: "" };
var isProcessing = false; // guard against double-clicking Pay Now

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("checkout");
    renderFooter();

    // Checkout belongs to a signed-in customer so orders can be listed later.
    requireLogin();

    if (getCart().length === 0) {
        document.getElementById("panel1").hidden = true;
        document.getElementById("miniBill").hidden = true;
        document.getElementById("stepBar").hidden = true;
        document.getElementById("emptyGuard").hidden = false;
        return;
    }

    // Pre-fill the form from the account - a small convenience.
    var user = getCurrentUser();
    document.getElementById("dName").value = user.name;
    document.getElementById("dPhone").value = user.phone || "";
    document.getElementById("dEmail").value = user.email;

    setupDeliveryForm();
    setupPaymentChoice();
    drawMiniBill();
});

/* ---------- STEP NAVIGATION ---------- */
var currentStep = 1;

function gotoStep(step) {
    currentStep = step;

    // Show exactly one panel.
    [1, 2, 3].forEach(function (n) {
        document.getElementById("panel" + n).hidden = n !== step;
    });
    document.getElementById("panelProcessing").hidden = true;
    document.getElementById("panelSuccess").hidden = true;

    // Update the step indicator: active = now, finished = behind us.
    document.querySelectorAll("#stepBar .step").forEach(function (el) {
        var n = Number(el.dataset.step);
        el.classList.toggle("active", n === step);
        el.classList.toggle("finished", n < step);
    });

    if (step === 2) { drawSummary(); }
    refreshIcons();
}

/* ---------- STEP 1: DELIVERY FORM ---------- */
function setupDeliveryForm() {
    document.getElementById("deliveryForm").addEventListener("submit", function (event) {
        event.preventDefault();

        var ok = true;

        // Each field is checked with a tiny rule; the first failure wins.
        ok = checkText("dName", 3, "Enter the full name (3+ characters).") && ok;
        ok = checkPattern("dPhone", /^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number.") && ok;
        ok = checkPattern("dEmail", /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address.") && ok;
        ok = checkText("dAddress", 6, "Enter the complete delivery address.") && ok;
        ok = checkText("dCity", 2, "Enter the city name.") && ok;
        ok = checkPattern("dPin", /^\d{6}$/, "PIN code must be exactly 6 digits.") && ok;

        if (!ok) {
            showToast("Please fix the highlighted fields.", "error");
            return;
        }

        // Remember the values so moving Back does not lose them.
        delivery = {
            name: v("dName"), phone: v("dPhone"), email: v("dEmail"),
            address: v("dAddress"), city: v("dCity"), pin: v("dPin")
        };

        gotoStep(2);
    });

    // Small local helpers.
    function v(id) { return document.getElementById(id).value.trim(); }

    function checkText(id, minLength, message) {
        var value = v(id);
        var good = value.length >= minLength;
        show(id, good ? "" : message);
        return good;
    }

    function checkPattern(id, pattern, message) {
        var value = v(id);
        var good = pattern.test(value);
        show(id, good ? "" : message);
        return good;
    }

    function show(id, message) {
        document.getElementById(id + "Error").textContent = message;
        document.getElementById(id).classList.toggle("input-error", message ? true : false);
    }
}

/* ---------- STEP 2: ORDER SUMMARY ---------- */
function drawSummary() {
    var totals = cartTotals();
    var html = "";

    // One line per cart item: name x quantity = line price.
    getCart().forEach(function (line) {
        var product = findProduct(line.id);
        if (!product) { return; }
        html += '<div class="summary-line"><span>' + escapeHtml(product.name) +
            " &times; " + line.quantity + "</span><span>" +
            formatMoney(product.price * line.quantity) + "</span></div>";
    });

    html += '<div class="summary-line"><span>Subtotal</span><span>' + formatMoney(totals.subtotal) + "</span></div>";
    html += '<div class="summary-line"><span>Discount saved</span><span style="color:var(--green)">−' + formatMoney(totals.discount) + "</span></div>";
    html += '<div class="summary-line"><span>Delivery</span><span>' +
        (totals.delivery === 0 ? "FREE" : formatMoney(totals.delivery)) + "</span></div>";
    html += '<div class="summary-line" style="border-bottom:none;font-weight:700;color:var(--text)">' +
        "<span>Total payable</span><span>" + formatMoney(totals.total) + "</span></div>";
    html += '<p style="font-size:0.8rem;margin-top:10px">Delivering to ' +
        escapeHtml(delivery.name) + ", " + escapeHtml(delivery.address) + ", " +
        escapeHtml(delivery.city) + " - " + escapeHtml(delivery.pin) + "</p>";

    document.getElementById("summaryLines").innerHTML = html;
}

/* ---------- STEP 3: PAYMENT ---------- */
// Highlight the selected payment card and show its form.
function setupPaymentChoice() {
    document.getElementById("payOptions").addEventListener("click", function (event) {
        var option = event.target.closest(".pay-option");
        if (!option) { return; }

        document.querySelectorAll(".pay-option").forEach(function (el) { el.classList.remove("selected"); });
        option.classList.add("selected");
        option.querySelector("input").checked = true;

        var method = option.dataset.method;
        document.getElementById("upiForm").hidden = method !== "UPI";
        document.getElementById("cardForm").hidden = method !== "Card";
    });
}

// Work out which payment method is currently chosen.
function selectedMethod() {
    var radios = document.querySelectorAll('input[name="pay"]');
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) { return radios[i].value; }
    }
    return "";
}

// Validate the demo payment fields for the chosen method.
function validatePayment() {
    var method = selectedMethod();

    if (method === "UPI") {
        var upi = document.getElementById("upiId").value.trim();
        var good = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi);
        setPayError("upiId", good ? "" : "Use a UPI ID like name@bank (demo value is fine).");
        return good;
    }

    if (method === "Card") {
        var number = document.getElementById("cardNo").value.replace(/\s/g, "");
        var expiry = document.getElementById("cardExp").value.trim();
        var cvv = document.getElementById("cardCvv").value;

        var okNumber = /^\d{16}$/.test(number);
        var okExpiry = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
        var okCvv = /^\d{3}$/.test(cvv);

        setPayError("cardNo", okNumber ? "" : "Card number must be 16 digits (use any fake number).");
        setPayError("cardExp", okExpiry ? "" : "Use MM/YY format, e.g. 12/28.");
        setPayError("cardCvv", okCvv ? "" : "CVV must be 3 digits.");
        return okNumber && okExpiry && okCvv;
    }

    // Cash on Delivery needs no extra information.
    return true;
}

function setPayError(id, message) {
    document.getElementById(id + "Error").textContent = message;
    document.getElementById(id).classList.toggle("input-error", message ? true : false);
}

/* ---------- PAY NOW: THE SIMULATED GATEWAY ---------- */
function payNow() {
    // Prevent accidental duplicate orders from rapid repeated clicks.
    if (isProcessing) { return; }

    if (!validatePayment()) {
        showToast("Please correct the payment details.", "error");
        return;
    }

    isProcessing = true;
    document.getElementById("payNowBtn").disabled = true;

    // Show the processing screen...
    [1, 2, 3].forEach(function (n) { document.getElementById("panel" + n).hidden = true; });
    document.getElementById("panelProcessing").hidden = false;

    // ...and pretend to talk to a bank for 1.8 seconds.
    setTimeout(function () {
        var method = selectedMethod();
        var order = createOrder(method);

        document.getElementById("panelProcessing").hidden = true;
        document.getElementById("panelSuccess").hidden = false;
        document.getElementById("successOrderId").textContent = order.id;

        showToast("Payment simulated successfully. Order " + order.id + " created.");
        isProcessing = false;
    }, 1800);
}

/* ---------- ORDER CREATION (the important academic part) ---------- */
function createOrder(method) {
    var user = getCurrentUser();
    var totals = cartTotals();
    var products = getProducts();
    var items = [];

    // Build item snapshots AND reduce stock in the same pass.
    getCart().forEach(function (line) {
        for (var i = 0; i < products.length; i++) {
            var product = products[i];
            if (product.id === line.id) {
                items.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: line.quantity
                });
                product.stock = product.stock - line.quantity; // sell the units
            }
        }
    });

    saveProducts(products);

    // Unique order id: NV + part of the timestamp (ms precision).
    var orderId = "NV" + Date.now().toString().slice(-8);

    var order = {
        id: orderId,
        userId: user.id,
        customerName: delivery.name,
        phone: delivery.phone,
        email: delivery.email,
        address: delivery.address + ", " + delivery.city + " - " + delivery.pin,
        date: new Date().toISOString(),
        items: items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        delivery: totals.delivery,
        total: totals.total,
        payMethod: method,
        // Cash on Delivery is unpaid until the courier collects it.
        payStatus: method === "Cash on Delivery" ? "Pending" : "Paid",
        status: "Placed",
        demo: false
    };

    // Card data is NEVER stored - not even a masked number.

    var orders = getOrders();
    orders.unshift(order);      // newest first
    saveOrders(orders);

    // Notify the admin side + show it in the activity feed.
    var notifications = getNotifications();
    notifications.unshift({
        id: "N" + Date.now(),
        title: "New order received",
        text: "Order " + orderId + " worth " + formatMoney(order.total) + " from " + delivery.name + ".",
        time: "just now",
        type: "team",
        read: false,
        demo: false
    });
    saveNotifications(notifications);

    var activities = getActivities();
    activities.unshift({
        id: "A" + Date.now(),
        text: "Order " + orderId + " placed via " + method,
        time: "just now",
        who: user.name,
        demo: false
    });
    saveActivities(activities);

    // The purchased items leave the cart - this is why refreshing after
    // checkout shows an empty cart.
    saveCart([]);
    updateBadges();

    return order;
}

/* ---------- MINI BILL (right column) ---------- */
function drawMiniBill() {
    var totals = cartTotals();
    var lines = getCart().length;

    document.getElementById("miniCount").textContent = lines + " line(s)";
    document.getElementById("miniSubtotal").textContent = formatMoney(totals.subtotal);
    document.getElementById("miniDelivery").textContent =
        totals.delivery === 0 ? "FREE" : formatMoney(totals.delivery);
    document.getElementById("miniTotal").textContent = formatMoney(totals.total);
}
