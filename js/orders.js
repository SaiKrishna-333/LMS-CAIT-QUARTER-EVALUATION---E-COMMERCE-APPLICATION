/* ==========================================================================
   NOVA - orders.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This is the shopper's order history. It lists every order
   the signed-in customer has placed and lets them open a 5-stage tracking
   timeline (Placed > Confirmed > Packed > Shipped > Delivered).

   WHERE THE DATA COMES FROM
   Orders are stored in novaOrders (created by checkout.js and by the demo
   seed). This page keeps only the ones that belong to the current user and
   draws a card per order.

   FUNCTIONS IN THIS FILE
   - requireLogin runs first so guests are sent to log in.
   - drawOrders()          - filter this user's orders and lay out the cards;
                             shows a friendly "no orders yet" state if empty
   - buildOrderCard(order) - one summary card: id, date, items, total and a
                             status pill, plus a button to reveal tracking
   - buildTimeline(status) - the horizontal 5-step tracker with completed
                             stages highlighted up to the order's current step
   - toggleTracking(index) - show/hide a card's timeline without reloading

   Customers only ever see their own orders, so the list stays private and
   tidy even though all orders share one storage key.
   ========================================================================== */

/* ==========================================================================
   NOVA - orders.js  (CUSTOMER ORDER HISTORY + TRACKING TIMELINE)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Shows the signed-in customer's orders (newest first). Each card can be
   expanded to reveal the five-stage tracking timeline. The customer sees
   the status; the ADMIN changes it (admin/orders.html) - both read and
   write the same novaOrders list, which is how the update "travels".
   ========================================================================== */

// The five fixed tracking stages, in order.
var ORDER_STAGES = ["Placed", "Confirmed", "Packed", "Shipped", "Delivered"];

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("orders");
    renderFooter();
    drawOrders();
});

function drawOrders() {
    var user = getCurrentUser();

    if (!user) {
        // Guests get a friendly prompt instead of an empty list.
        document.getElementById("ordersEmpty").hidden = false;
        document.getElementById("ordersEmpty").querySelector("h3").textContent = "Please sign in";
        document.getElementById("ordersEmpty").querySelector("p").textContent = "Orders are linked to your account.";
        document.getElementById("ordersEmpty").querySelector("a").setAttribute("href", "login.html");
        document.getElementById("ordersEmpty").querySelector("a").textContent = "Sign In";
        return;
    }

    // Only this user's orders (sample orders belong to the demo customer).
    var orders = getOrders().filter(function (order) {
        return order.userId === user.id;
    });

    document.getElementById("orderCount").textContent = orders.length + " order(s)";

    if (orders.length === 0) {
        document.getElementById("ordersEmpty").hidden = false;
        return;
    }

    var html = "";
    orders.forEach(function (order, index) {
        html += buildOrderCard(order, index);
    });

    document.getElementById("ordersList").innerHTML = html;
    refreshIcons();
}

/* ---------- ONE ORDER CARD ---------- */
function buildOrderCard(order, index) {
    // Item thumbnails: images are regenerated from the product id.
    var thumbs = "";
    order.items.forEach(function (item) {
        var product = findProduct(item.id);
        var src = product ? getProductImage(product, 0) : "";
        var fb = product ? ' onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',0)"' : "";
        thumbs += '<img class="order-thumb" src="' + src + '" title="' +
            escapeHtml(item.name) + " x" + item.quantity + '" alt="' + escapeHtml(item.name) + '"' + fb + '>';
    });

    var demoTag = order.demo ? ' <span class="stock-tag low">sample order</span>' : "";

    return '<div class="order-card">' +
        '<div class="order-head">' +
        "<span><b style=color:var(--text)>Order " + order.id + "</b>" + demoTag + "</span>" +
        "<span>Placed on " + formatDate(order.date) + "</span>" +
        "<span>" + formatMoney(order.total) + " &middot; " + order.payMethod + "</span>" +
        '<span class="status-pill ' + order.status + '">' + order.status + "</span>" +
        '<span style="color:' + (order.payStatus === "Paid" ? "var(--green)" : "var(--amber)") + '">' +
        order.payStatus + "</span></div>" +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px">' +
        '<div class="order-items-row">' + thumbs + "</div>" +
        '<button class="btn btn-outline btn-sm" onclick="toggleTracking(' + index + ')">' +
        '<i data-lucide="route"></i> Track Order</button></div>' +
        // Hidden tracking panel, revealed by the button above.
        '<div id="track' + index + '" hidden>' + buildTimeline(order.status) + "</div>" +
        "</div>";
}

/* ---------- TRACKING TIMELINE ---------- */
// Stages before the current one are "done", the current one is "current".
function buildTimeline(status) {
    var currentIndex = ORDER_STAGES.indexOf(status);
    var html = '<div class="timeline">';

    ORDER_STAGES.forEach(function (stage, i) {
        var cls = "";
        if (i < currentIndex) { cls = "done"; }
        if (i === currentIndex) { cls = "done current"; }

        html += '<div class="timeline-step ' + cls + '">' +
            '<div class="dot">' + (i < currentIndex ? "✓" : i + 1) + "</div>" +
            "<span>" + stage + "</span></div>";
    });

    return html + "</div>";
}

function toggleTracking(index) {
    var panel = document.getElementById("track" + index);
    panel.hidden = !panel.hidden;
}
