/* ==========================================================================
   NOVA - admin-orders.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This is the order desk for the shop owner. It lists every
   order from every customer and lets the admin move each one along the
   delivery pipeline by changing its status from a dropdown.

   HOW IT CONNECTS TO THE CUSTOMER
   When the admin picks a new status here, the order object in novaOrders is
   updated. The customer's own orders.html reads that same record, so the
   tracking timeline on the shopper's side advances automatically - the two
   screens are two views of one piece of data.

   FUNCTIONS IN THIS FILE
   - buildContent()          - renderAdminShell + draw the full order table
   - drawOrders()            - one row per order (id, customer, date, total,
                               current status) with an expandable detail area
   - detailHtml(order)       - the line-items + address block revealed on click
   - toggleDetails(orderId)  - open/close one order's details without reload
   - updateStatus(orderId, newStatus) - write the new status back to storage,
                               log it in the activity feed and refresh the row

   A filter row lets the admin see all orders or only a chosen status, making
   busy days easy to triage.
   ========================================================================== */

/* ==========================================================================
   NOVA - admin-orders.js  (ADMIN ORDER MANAGEMENT)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Lists every order (real + sample), lets the admin search them, open a
   detail view and move an order forward through the five tracking stages.
   A status change is written straight back into novaOrders, so the
   customer's orders.html shows the new state on their next visit.
   ========================================================================== */

var orderSearch = "";
var openOrderId = null; // which row is currently expanded

document.addEventListener("DOMContentLoaded", function () {
    if (!renderAdminShell("orders")) { return; }
    buildContent();
});

function buildContent() {
    document.getElementById("adminContent").innerHTML =
        '<div class="panel">' +
        '<div class="toolbar">' +
        '<input class="form-control" id="orderSearch" placeholder="Search by order id or customer...">' +
        '<div class="spacer"></div>' +
        '<span style="font-size:0.8rem;color:var(--text-2)">⚠ = sample demonstration order</span>' +
        "</div>" +
        '<div class="table-wrap"><table class="admin-table" id="orderTable"></table></div>' +
        "</div>";

    document.getElementById("orderSearch").addEventListener("input", function () {
        orderSearch = this.value.trim().toLowerCase();
        drawOrders();
    });

    drawOrders();
    refreshIcons();
}

function drawOrders() {
    var orders = getOrders().filter(function (o) {
        return o.id.toLowerCase().indexOf(orderSearch) !== -1 ||
            o.customerName.toLowerCase().indexOf(orderSearch) !== -1;
    });

    var rows = "";
    orders.forEach(function (order) {
        rows += "<tr><td><b>" + order.id + "</b>" + (order.demo ? " ⚠" : "") + "</td>" +
            "<td>" + escapeHtml(order.customerName) +
            '<div style="font-size:0.74rem;color:var(--text-2)">' + formatDate(order.date) + "</div></td>" +
            "<td>" + formatMoney(order.total) + "</td>" +
            "<td>" + order.payMethod +
            '<div style="font-size:0.74rem;color:' + (order.payStatus === "Paid" ? "var(--green)" : "var(--amber)") + '">' +
            order.payStatus + "</div></td>" +
            "<td><span class='status-pill " + order.status + "'>" + order.status + "</span></td>" +
            "<td><div class='row-actions'>" +
            "<button class='mini-btn' title='Details' onclick='toggleDetails(\"" + order.id + "\")'><i data-lucide='search'></i></button>" +
            "<select class='panel-chip' onchange='updateStatus(\"" + order.id + "\",this.value)'>" +
            statusOptions(order.status) + "</select>" +
            "</div></td></tr>";

        // Hidden detail row (shown when the magnifier is clicked).
        rows += "<tr id='det-" + order.id + "' " + (openOrderId === order.id ? "" : "hidden") + ">" +
            "<td colspan=6 style='background:var(--panel)'>" + detailHtml(order) + "</td></tr>";
    });

    document.getElementById("orderTable").innerHTML =
        "<thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th>" +
        "<th>Status</th><th>Manage</th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan=6>No orders found.</td></tr>") + "</tbody>";
    refreshIcons();
}

// Everything the admin may want to see about one order.
function detailHtml(order) {
    var items = "";
    order.items.forEach(function (item) {
        items += "<li>✔ " + escapeHtml(item.name) + " × " + item.quantity +
            " — " + formatMoney(item.price * item.quantity) + "</li>";
    });

    return "<div style='display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.82rem'>" +
        "<div><b>Items</b><ul style='margin-top:6px'>" + items + "</ul>" +
        "<div style='margin-top:8px'>Subtotal " + formatMoney(order.subtotal) +
        " · Discount " + formatMoney(order.discount) +
        " · Delivery " + formatMoney(order.delivery) + "</div></div>" +
        "<div><b>Customer</b><div style='margin-top:6px'>" +
        escapeHtml(order.customerName) + "<br>" +
        (order.phone ? order.phone + "<br>" : "") +
        (order.email ? order.email + "<br>" : "") +
        (order.address ? escapeHtml(order.address) : "Address not captured (sample order)") +
        "</div></div></div>";
}

function toggleDetails(orderId) {
    openOrderId = openOrderId === orderId ? null : orderId;
    drawOrders();
}

/* ---------- STATUS UPDATE ---------- */
// Moving to Shipped also marks a Cash-on-Delivery order as still pending;
// Delivered COD orders become Paid (the courier collected the money).
function updateStatus(orderId, newStatus) {
    var orders = getOrders();

    for (var i = 0; i < orders.length; i++) {
        if (orders[i].id === orderId) {
            orders[i].status = newStatus;

            if (newStatus === "Delivered" && orders[i].payMethod === "Cash on Delivery") {
                orders[i].payStatus = "Paid";
            }
        }
    }

    saveOrders(orders);
    logActivity("Order " + orderId + " moved to " + newStatus);
    adminToast("Order " + orderId + " is now " + newStatus);
    drawOrders();
}
