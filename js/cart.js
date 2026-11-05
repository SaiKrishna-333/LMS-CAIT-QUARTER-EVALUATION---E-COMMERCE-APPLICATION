/* ==========================================================================
   NOVA - cart.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page shows the items the shopper wants to buy, lets
   them change quantities or remove lines, and calculates the running bill
   (subtotal, discount, delivery, total) before they head to checkout.

   NO MATHS IS DUPLICATED HERE
   The money rules and the cart data itself live in common.js / storage.js.
   This file only draws what those functions report and reacts to the +/- and
   remove buttons, so the cart, the header badge and the bill can never
   disagree.

   FUNCTIONS IN THIS FILE
   - drawCart()  - loop over novaCart, look up each product, and build a row
                   with its picture, name, price, a quantity stepper and a
                   remove link; shows an empty-cart message with a nudge to
                   browse products when there is nothing inside
   - drawBill()  - call cartTotals() and paint the order-summary box, then
                   wire the "Proceed to Checkout" button

   Every change (quantity, remove) re-runs drawCart() + drawBill() so the
   numbers on screen are always up to the second.
   ========================================================================== */

/* ==========================================================================
   NOVA - cart.js  (SHOPPING CART LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Renders one row per cart line and recalculates the whole bill after
   every quantity change. cartTotals() in common.js does the shared maths.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("cart");
    renderFooter();
    drawCart();
});

// Full redraw: simple, always correct, and cheap for a demo-size cart.
function drawCart() {
    var cart = getCart();
    var rowsBox = document.getElementById("cartRows");

    if (cart.length === 0) {
        document.getElementById("cartLayout").hidden = true;
        document.getElementById("cartEmpty").hidden = false;
        document.getElementById("cartCount").textContent = "";
        return;
    }

    document.getElementById("cartLayout").hidden = false;
    document.getElementById("cartEmpty").hidden = true;
    document.getElementById("cartCount").textContent = cart.length + " line(s) in cart";

    var html = "";

    cart.forEach(function (line) {
        var product = findProduct(line.id);
        if (!product) { return; } // product deleted by admin: skip

        var lineTotal = product.price * line.quantity;

        html += '<div class="card cart-row">' +
            '<img src="' + getProductImage(product, 0) + '" alt="' + escapeHtml(product.name) + '" onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',0)">' +
            '<div class="cart-actions-col" style="display:flex;flex-direction:column;gap:6px">' +
            '<b>' + escapeHtml(product.name) + '</b>' +
            '<span class="card-category">' + product.category + '</span>' +
            '<span style="font-size:0.82rem;color:var(--text-2)">' + formatMoney(product.price) + ' each &times; ' + line.quantity + '</span>' +
            '<button class="btn btn-outline btn-sm" style="width:max-content;margin-top:6px" ' +
            'onclick="removeFromCart(\'' + product.id + '\');drawCart()"><i data-lucide="trash-2"></i> Remove</button>' +
            '</div>' +
            '<div class="qty-stepper">' +
            '<button onclick="changeQuantity(\'' + product.id + '\',-1);drawCart()">−</button>' +
            '<input type="text" value="' + line.quantity + '" readonly aria-label="Quantity">' +
            '<button onclick="changeQuantity(\'' + product.id + '\',1);drawCart()">+</button>' +
            '</div>' +
            '<div class="cart-line-total">' + formatMoney(lineTotal) + '</div>' +
            '</div>';
    });

    rowsBox.innerHTML = html;
    drawBill();
    refreshIcons();
}

// Fill the Order Summary panel from the shared calculation helper.
function drawBill() {
    var totals = cartTotals();
    var settings = getSettings();

    document.getElementById("billSubtotal").textContent = formatMoney(totals.subtotal);
    document.getElementById("billDiscount").textContent = "−" + formatMoney(totals.discount) + " saved";
    document.getElementById("billDelivery").textContent =
        totals.delivery === 0 ? "FREE" : formatMoney(totals.delivery);
    document.getElementById("billTotal").textContent = formatMoney(totals.total);

    // Friendly nudge toward free delivery.
    var hint = document.getElementById("freeShipHint");
    if (totals.delivery > 0) {
        var need = settings.freeDeliveryMin - totals.subtotal;
        hint.textContent = "Add " + formatMoney(need) + " more to unlock free delivery.";
        hint.style.color = "var(--amber)";
    } else {
        hint.textContent = "Free delivery unlocked on this order.";
        hint.style.color = "var(--green)";
    }
}
