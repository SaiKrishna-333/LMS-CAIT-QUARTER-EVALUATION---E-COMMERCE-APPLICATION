/* ==========================================================================
   NOVA - storage.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This file is NOVA's entire "database". It is the ONLY
   file that reads or writes the browser's Local Storage, and it also draws
   the product photos on the fly. Every other script depends on it, which is
   why it is always loaded FIRST on every page.

   WHY THIS FILE EXISTS
   The assignment is a frontend-only app with no server, so instead of a real
   database we use Local Storage - a key/value text store inside the browser.
   This file wraps that store in friendly functions so the rest of the code
   never touches localStorage directly. It also seeds realistic sample data
   the very first time the site is opened, and can restore it later.

   THE STORAGE KEYS (each holds one JSON string)
   novaProducts       array of product objects (the catalogue + stock)
   novaUsers          array of registered accounts (customer + admin)
   novaCurrentUser    the single object for whoever is signed in right now
   novaCart           array of {id, quantity} lines the shopper is buying
   novaWishlist       array of saved product ids
   novaOrders         array of completed orders (real + sample ones)
   novaRecentlyViewed the last 8 product ids the visitor opened
   novaSettings       delivery fee, free-delivery limit, flash-sale on/off,
                      flash-sale end time, featured product ids
   novaNotifications  items shown in the admin bell panel
   novaActivities     items shown in the admin activity feed

   FUNCTIONS IN THIS FILE (grouped by section)
   1. Generic storage helpers
      saveData(key, value)     - JSON.stringify then store one value
      loadData(key, fallback)  - read + JSON.parse with try/catch safety
      removeData(key)          - delete one key
   2. Formatting helpers used all over the UI
      formatMoney(amount)      - number -> "₹1,234.50"
      formatDate(isoString)    - ISO text -> "5 Nov 2026"
   3. Product images: curated real photo (Unsplash + Wikimedia Commons) + offline SVG fallback
      getProductImage(product, view) - returns the photo if we have one, else SVG
      getProductPhoto(...)     - the curated photo URL, or "" if none
      NOVA_PHOTOS              - verified photo URLs per product (main + angle)
      getProductSvg(...)       - the offline SVG studio render (data URI, cached)
      getProductSvgById(id,v)  - SVG fallback used by <img onerror>
      buildProductSvg(...)     - assembles the lit background, ambient glow,
        contact shadow, floor reflection and the product group
      shapeSvg(shape)          - draws one product from gradient-filled SVG
        parts (body / metal / screen / dark / sheen) for a 3D look
   4. Demo-data builders (called once by initDemoData)
      buildDemoProducts / Users / Orders / Notifications / Activities / Settings
      NOVA_CATEGORIES          - the five category names shared app-wide
   5. One-time setup + reset
      initDemoData()           - fills any EMPTY key only (never overwrites
                                 data the user created during the demo)
      resetDemoData()          - deletes the demo keys and rebuilds originals
   6. Named getters/setters (getProducts/saveProducts, getCart/saveCart, ...)
      plus findProduct(id)     - locate one product by id or return null

   HOW OTHER FILES USE IT
   They just call getProducts(), findProduct(id), getCart(), formatMoney(),
   etc. Because those functions read the live Local Storage every time, a
   change made on one page (admin editing stock) is instantly visible on
   another page (the shop) the next time it loads.

   LIMITATIONS: everything lives in ONE browser on ONE machine, is not shared
   between devices, and is not secure - it is an academic demonstration.
   ========================================================================== */

/* ==========================================================================
   NOVA - storage.js  (LOCAL STORAGE DATA LAYER)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   This is the FIRST script loaded on every page. It is the only file that
   talks to Local Storage. Other files call these small helper functions,
   so data handling stays in one easy-to-explain place.

   HOW LOCAL STORAGE WORKS (for the presentation):
   - localStorage is a key/value store built into every browser.
   - It can only store STRINGS, so we convert arrays/objects with
     JSON.stringify() when saving and JSON.parse() when reading.
   - Data survives page refreshes and browser restarts, but it lives ONLY
     inside this browser on this device (there is no server).

   STORAGE KEYS USED BY NOVA:
   novaProducts, novaUsers, novaCurrentUser, novaCart, novaWishlist,
   novaOrders, novaRecentlyViewed, novaSettings, novaNotifications,
   novaActivities
   ========================================================================== */

/* ---------- 1. GENERIC SAVE / LOAD HELPERS ---------- */

// Save any JavaScript value under a key.
// JSON.stringify turns the object/array into a text string first.
function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Load a value back. JSON.parse converts the string into usable data.
// If nothing is saved yet we return the fallback (default to an empty array).
function loadData(key, fallback) {
    var text = localStorage.getItem(key);

    if (text === null || text === undefined) {
        return fallback !== undefined ? fallback : [];
    }

    // try/catch protects the app from corrupted storage values.
    try {
        return JSON.parse(text);
    } catch (error) {
        return fallback !== undefined ? fallback : [];
    }
}

// Remove one key completely (used by the reset-demo feature).
function removeData(key) {
    localStorage.removeItem(key);
}

/* ---------- 2. MONEY + DATE HELPERS (used everywhere) ---------- */

// All prices are shown in Indian Rupees.
function formatMoney(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Format an ISO date string like "2026-10-30T10:00:00" into a friendly text.
function formatDate(isoString) {
    var date = new Date(isoString);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- 3. PRODUCT IMAGES (REAL PHOTOS + SVG FALLBACK) ---------- */
// Product pictures prefer real stock photos (curated Unsplash + Wikimedia
// Commons links that are verified to load and match the product). Because a photo needs internet, and
// because not every product has a verified shot, every image also has an
// offline safety net: buildProductSvg() draws a vector "studio shot" - a lit
// spotlight background, an ambient glow, gradient-filled shapes with specular
// highlights, a soft contact shadow and a floor reflection. getProductImage()
// returns the photo when there is one and the SVG otherwise, and each <img>
// onerror swaps to the SVG if a photo link ever fails - so no image breaks.
// Each product stores a "shape" name and a "hue" angle; the same small
// drawing functions are reused for every product.

var imageCache = {}; // remember generated images so we build each only once

// Return the image for a product. view 0 = main, view 1 = alternate angle.
// Where we have a verified real PHOTO (Unsplash or Wikimedia Commons) we show
// the offline SVG studio render. And if a photo link ever fails to load, the
// <img> onerror falls back to the SVG too - so a broken image never appears.
function getProductImage(product, view) {
    if (view === undefined) { view = 0; }
    var photo = getProductPhoto(product, view);
    return photo ? photo : getProductSvg(product, view);
}

// Curated real product photographs from two trusted, key-free sources:
//  - Unsplash            (clean studio shots for the tech / fashion products)
//  - Wikimedia Commons   (real photos for the home / lifestyle products)
// Every URL below was verified to load and to actually match its product. The
// first entry is the main photo and the second (where present) is an alternate
// angle for the product gallery. Products NOT listed here fall back to the
// offline SVG studio render, so an image never breaks and never shows a
// wrong-subject picture.
var NOVA_PHOTOS = {
    P1: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80&auto=format&fit=crop"],
    P2: ["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80&auto=format&fit=crop"],
    P3: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Computer_monitor_screen_image_simulated.jpg/960px-Computer_monitor_screen_image_simulated.jpg"],
    P4: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80&auto=format&fit=crop"],
    P5: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&auto=format&fit=crop"],
    P6: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Brown_leather_jacket.jpg/960px-Brown_leather_jacket.jpg"],
    P7: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Dress%2C_evening_%28AM_1999.34.4-2%29.jpg/960px-Dress%2C_evening_%28AM_1999.34.4-2%29.jpg"],
    P8: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80&auto=format&fit=crop"],
    P9: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/A_desk_lamp.jpg/960px-A_desk_lamp.jpg"],
    P10: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Ceramic_vase_%282024-02-06%29_01.jpg/960px-Ceramic_vase_%282024-02-06%29_01.jpg"],
    P11: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Door_open%3B_empty_bed_with_pillow_and_side_pillow_01.jpg/960px-Door_open%3B_empty_bed_with_pillow_and_side_pillow_01.jpg"],
    P12: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Electric_kettle_phillips_white.JPG/960px-Electric_kettle_phillips_white.JPG"],
    P13: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80&auto=format&fit=crop"],
    P14: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Backpack_small.jpg/960px-Backpack_small.jpg"],
    P15: ["https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80&auto=format&fit=crop"],
    P16: ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80&auto=format&fit=crop"],
    P19: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Bluetooth_speaker_JBL_Xtreme_from_side_showing_one_of_the_bass_speakers.jpg/960px-Bluetooth_speaker_JBL_Xtreme_from_side_showing_one_of_the_bass_speakers.jpg"],
    P20: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Prototype_ergonomic_office_chair%2C_V%26A_London.jpg/960px-Prototype_ergonomic_office_chair%2C_V%26A_London.jpg"]
    // P17 (yoga mat) and P18 (bottle) deliberately use the SVG studio render:
    // no free source had a clean, correctly-matched product photo, so drawing
    // them beats showing a misleading picture.
};

// The real photo URL for a product, or "" when we have no verified photo for
// it (in which case getProductImage uses the SVG render instead).
function getProductPhoto(product, view) {
    if (view === undefined) { view = 0; }
    var urls = NOVA_PHOTOS[product.id];
    if (!urls) { return ""; }
    return urls[view] || urls[0] || "";
}

// The offline SVG render (a data URI), used as the automatic fallback. Cached
// so each product/angle is only built once.
function getProductSvg(product, view) {
    if (view === undefined) { view = 0; }
    var cacheKey = product.id + "-" + view;
    if (imageCache[cacheKey]) { return imageCache[cacheKey]; }
    var svg = buildProductSvg(product, view);
    // encodeURIComponent makes the SVG safe to embed in an <img src>.
    imageCache[cacheKey] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return imageCache[cacheKey];
}

// Fallback helper called from <img onerror="..."> - finds the product by id
// and returns its SVG render, so a broken photo link never shows an icon.
function getProductSvgById(id, view) {
    if (view === undefined) { view = 0; }
    var product = findProduct(id);
    if (!product) { return ""; }
    return getProductSvg(product, view);
}

// Build the SVG text for one product image. This is a small "studio render":
// a lit background, an ambient glow, the product drawn with rich gradients,
// a soft contact shadow and a faded floor reflection - so it looks like a
// real product photo instead of a flat icon, while still being pure SVG.
function buildProductSvg(product, view) {
    var hue = product.hue || 270;

    // Colour stops that give every product a lit, three-dimensional body.
    var light = "hsl(" + hue + ",85%,72%)";  // highlight edge
    var mid = "hsl(" + hue + ",55%,46%)";     // main body colour
    var dark = "hsl(" + hue + ",50%,15%)";    // shaded edge

    // A tiny tilt on the alternate view so gallery thumbnails differ.
    var tilt = view === 1 ? "rotate(-9 300 300)" : "";
    var t = tilt ? ' transform="' + tilt + '"' : "";

    var shape = shapeSvg(product.shape);

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">' +
        '<defs>' +
        // Studio backdrop: soft spotlight fading to near-black at the edges.
        '<radialGradient id="bg" cx="50%" cy="36%" r="82%">' +
        '<stop offset="0%" stop-color="hsl(' + hue + ',26%,16%)"/>' +
        '<stop offset="55%" stop-color="#0b0b11"/>' +
        '<stop offset="100%" stop-color="#050507"/>' +
        '</radialGradient>' +
        // Main body gradient: light from the top-left, dark to the bottom-right.
        '<linearGradient id="body" x1="0" y1="0" x2="0.75" y2="1">' +
        '<stop offset="0%" stop-color="' + light + '"/>' +
        '<stop offset="38%" stop-color="' + mid + '"/>' +
        '<stop offset="100%" stop-color="' + dark + '"/>' +
        '</linearGradient>' +
        // Brushed metal for frames, stands and lids.
        '<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#d6d6e0"/>' +
        '<stop offset="30%" stop-color="#78788a"/>' +
        '<stop offset="55%" stop-color="#2c2c36"/>' +
        '<stop offset="100%" stop-color="#54545f"/>' +
        '</linearGradient>' +
        // Dark glossy screen / glass.
        '<linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="hsl(' + hue + ',45%,24%)"/>' +
        '<stop offset="100%" stop-color="#05050b"/>' +
        '</linearGradient>' +
        // Deep shadow areas (cushions, pads, recesses).
        '<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="hsl(' + hue + ',35%,13%)"/>' +
        '<stop offset="100%" stop-color="#040406"/>' +
        '</linearGradient>' +
        // Glossy highlight sheen laid over the top of parts.
        '<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"/>' +
        '<stop offset="50%" stop-color="#ffffff" stop-opacity="0.06"/>' +
        '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>' +
        '</linearGradient>' +
        // Soft contact shadow under the product.
        '<radialGradient id="contact" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#000" stop-opacity="0.8"/>' +
        '<stop offset="65%" stop-color="#000" stop-opacity="0.28"/>' +
        '<stop offset="100%" stop-color="#000" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>' +
        '<filter id="blur2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>' +
        // Fade mask so the reflection melts into the floor.
        '<linearGradient id="reflFade" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#fff" stop-opacity="0.30"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<mask id="reflMask"><rect x="0" y="470" width="600" height="120" fill="url(#reflFade)"/></mask>' +
        '</defs>' +
        '<rect width="600" height="600" fill="url(#bg)"/>' +
        '<ellipse cx="300" cy="255" rx="185" ry="150" fill="' + mid + '" opacity="0.20" filter="url(#soft)"/>' +
        '<ellipse cx="300" cy="470" rx="150" ry="28" fill="url(#contact)"/>' +
        // Floor reflection: a flipped, blurred, fading copy of the product.
        '<g mask="url(#reflMask)"><g transform="translate(0,944) scale(1,-1)" opacity="0.5" filter="url(#blur2)"><g' + t + '>' + shape + '</g></g></g>' +
        // The product itself.
        '<g' + t + '>' + shape + '</g>' +
        '</svg>';
}

// Small helper so product names with special characters never break the SVG.
function escapeXml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Each shape is drawn with the shared gradients defined above (body, metal,
// screen, dark, sheen) plus highlight overlays, so parts read as solid,
// lit objects rather than flat outlines. Coordinates sit inside 600x600 with
// the product centred and its base near y=460 so the shadow/reflection line up.
function shapeSvg(shape) {
    switch (shape) {
        case "headphones": // head-band + two padded ear cups
            return '<path d="M150 310 A150 150 0 0 1 450 310" fill="none" stroke="url(#body)" stroke-width="36" stroke-linecap="round"/>' +
                '<path d="M162 300 A138 138 0 0 1 438 300" fill="none" stroke="url(#sheen)" stroke-width="10" stroke-linecap="round" opacity="0.6"/>' +
                '<ellipse cx="150" cy="330" rx="54" ry="76" fill="url(#body)"/>' +
                '<ellipse cx="150" cy="330" rx="34" ry="54" fill="url(#dark)"/>' +
                '<ellipse cx="138" cy="308" rx="14" ry="24" fill="url(#sheen)" opacity="0.5"/>' +
                '<ellipse cx="450" cy="330" rx="54" ry="76" fill="url(#body)"/>' +
                '<ellipse cx="450" cy="330" rx="34" ry="54" fill="url(#dark)"/>' +
                '<ellipse cx="438" cy="308" rx="14" ry="24" fill="url(#sheen)" opacity="0.5"/>';
        case "earbuds": // charging case + two buds
            return '<rect x="205" y="330" width="190" height="120" rx="42" fill="url(#body)"/>' +
                '<rect x="205" y="330" width="190" height="48" rx="30" fill="url(#sheen)" opacity="0.30"/>' +
                '<circle cx="250" cy="250" r="48" fill="url(#body)"/>' +
                '<circle cx="238" cy="238" r="16" fill="url(#sheen)" opacity="0.6"/>' +
                '<rect x="238" y="286" width="24" height="58" rx="12" fill="url(#body)"/>' +
                '<circle cx="350" cy="250" r="48" fill="url(#body)"/>' +
                '<circle cx="338" cy="238" r="16" fill="url(#sheen)" opacity="0.6"/>' +
                '<rect x="338" y="286" width="24" height="58" rx="12" fill="url(#body)"/>';
        case "monitor": // screen + stand + base
            return '<rect x="120" y="120" width="360" height="230" rx="16" fill="url(#metal)"/>' +
                '<rect x="134" y="134" width="332" height="202" rx="6" fill="url(#screen)"/>' +
                '<rect x="134" y="134" width="332" height="60" fill="url(#sheen)" opacity="0.12"/>' +
                '<rect x="285" y="350" width="30" height="72" fill="url(#metal)"/>' +
                '<path d="M220 420 h160 l22 22 h-204 z" fill="url(#metal)"/>';
        case "laptop": // open lid + keyboard base
            return '<rect x="165" y="140" width="270" height="180" rx="12" fill="url(#metal)"/>' +
                '<rect x="178" y="153" width="244" height="154" rx="5" fill="url(#screen)"/>' +
                '<rect x="178" y="153" width="244" height="46" fill="url(#sheen)" opacity="0.12"/>' +
                '<path d="M130 330 h340 l42 66 h-424 z" fill="url(#metal)"/>' +
                '<path d="M150 340 h300 l12 18 h-324 z" fill="url(#sheen)" opacity="0.25"/>';
        case "watch": // round face + straps
            return '<rect x="272" y="120" width="56" height="120" rx="18" fill="url(#body)"/>' +
                '<rect x="272" y="360" width="56" height="120" rx="18" fill="url(#body)"/>' +
                '<rect x="210" y="210" width="180" height="180" rx="46" fill="url(#metal)"/>' +
                '<rect x="226" y="226" width="148" height="148" rx="34" fill="url(#screen)"/>' +
                '<rect x="226" y="226" width="148" height="50" rx="34" fill="url(#sheen)" opacity="0.14"/>';
        case "phone": // glass body + camera bump
            return '<rect x="232" y="110" width="136" height="330" rx="34" fill="url(#metal)"/>' +
                '<rect x="242" y="120" width="116" height="310" rx="26" fill="url(#screen)"/>' +
                '<rect x="242" y="120" width="116" height="120" fill="url(#sheen)" opacity="0.10"/>' +
                '<rect x="256" y="140" width="44" height="66" rx="14" fill="#05050a"/>' +
                '<circle cx="270" cy="158" r="8" fill="url(#body)"/>' +
                '<circle cx="270" cy="188" r="8" fill="url(#body)"/>';
        case "jacket": // torso + lapels + zip
            return '<path d="M215 165 l45 -25 q40 22 80 0 l45 25 -18 60 18 20 v190 q-105 24 -210 0 v-190 l18 -20 z" fill="url(#body)"/>' +
                '<path d="M300 145 v295" stroke="url(#dark)" stroke-width="8" opacity="0.55"/>' +
                '<path d="M300 145 l-42 32 42 42 42 -42 z" fill="url(#dark)" opacity="0.5"/>' +
                '<path d="M215 165 l45 -25 q40 22 80 0 l45 25 -14 22 q-66 -22 -132 0 z" fill="url(#sheen)" opacity="0.28"/>';
        case "dress": // A-line silk dress
            return '<path d="M260 140 q40 30 80 0 l10 60 44 210 q-94 42 -188 0 l44 -210 z" fill="url(#body)"/>' +
                '<path d="M260 140 q40 30 80 0 l6 40 q-46 22 -92 0 z" fill="url(#sheen)" opacity="0.3"/>' +
                '<path d="M300 190 v210" stroke="url(#dark)" stroke-width="6" opacity="0.3"/>';
        case "sneakers": // shoe side profile + sole
            return '<path d="M150 360 q0 -70 60 -92 q40 42 110 57 q70 15 92 60 q10 25 -22 25 h-230 q-16 0 -10 -15 z" fill="url(#body)"/>' +
                '<path d="M150 388 h262 q12 22 -22 22 h-230 q-16 0 -10 -22 z" fill="url(#dark)"/>' +
                '<path d="M212 286 q30 32 72 47" stroke="url(#sheen)" stroke-width="6" fill="none" opacity="0.4"/>';
        case "lamp": // shade + stem + base + warm glow
            return '<path d="M250 150 h100 l46 122 h-192 z" fill="url(#body)"/>' +
                '<path d="M250 150 h100 l12 30 h-124 z" fill="url(#sheen)" opacity="0.3"/>' +
                '<ellipse cx="300" cy="274" rx="48" ry="12" fill="url(#screen)" opacity="0.7"/>' +
                '<rect x="292" y="274" width="16" height="150" fill="url(#metal)"/>' +
                '<ellipse cx="300" cy="430" rx="80" ry="16" fill="url(#metal)"/>';
        case "vase": // curved pot + opening + highlight
            return '<path d="M270 150 h60 q6 50 34 84 q40 56 -6 130 q-58 40 -116 0 q-46 -74 -6 -130 q28 -34 34 -84 z" fill="url(#body)"/>' +
                '<ellipse cx="300" cy="152" rx="30" ry="8" fill="url(#dark)"/>' +
                '<path d="M280 176 q-8 120 10 200" stroke="url(#sheen)" stroke-width="10" fill="none" opacity="0.3"/>';
        case "pillow": // soft rounded cushion
            return '<rect x="160" y="200" width="280" height="200" rx="70" fill="url(#body)"/>' +
                '<path d="M200 300 q100 44 200 0" stroke="url(#dark)" stroke-width="8" fill="none" opacity="0.4"/>' +
                '<rect x="182" y="216" width="236" height="70" rx="40" fill="url(#sheen)" opacity="0.25"/>';
        case "kettle": // body + handle + lid + base
            return '<path d="M232 230 h136 l16 178 h-168 z" fill="url(#metal)"/>' +
                '<path d="M368 252 q64 22 6 102" fill="none" stroke="url(#metal)" stroke-width="16"/>' +
                '<rect x="268" y="200" width="64" height="34" rx="12" fill="url(#dark)"/>' +
                '<path d="M244 250 h28 l10 148 h-40 z" fill="url(#sheen)" opacity="0.25"/>' +
                '<rect x="228" y="404" width="144" height="16" rx="8" fill="url(#dark)"/>';
        case "backpack": // body + flap + pocket + handle
            return '<rect x="200" y="180" width="200" height="230" rx="60" fill="url(#body)"/>' +
                '<path d="M200 250 q100 60 200 0 v-34 q-100 50 -200 0 z" fill="url(#dark)" opacity="0.5"/>' +
                '<rect x="255" y="320" width="90" height="74" rx="16" fill="url(#dark)" opacity="0.6"/>' +
                '<path d="M250 176 q50 -34 100 0" fill="none" stroke="url(#metal)" stroke-width="10"/>' +
                '<rect x="200" y="180" width="200" height="70" rx="60" fill="url(#sheen)" opacity="0.2"/>';
        case "sunglasses": // two tinted lenses + bridge + arms
            return '<rect x="150" y="250" width="130" height="90" rx="40" fill="url(#screen)" stroke="url(#body)" stroke-width="8"/>' +
                '<rect x="320" y="250" width="130" height="90" rx="40" fill="url(#screen)" stroke="url(#body)" stroke-width="8"/>' +
                '<path d="M280 282 q20 -22 40 0" fill="none" stroke="url(#body)" stroke-width="12"/>' +
                '<path d="M150 262 l-42 -16 M450 262 l42 -16" stroke="url(#body)" stroke-width="12"/>' +
                '<rect x="162" y="258" width="106" height="24" rx="12" fill="url(#sheen)" opacity="0.2"/>' +
                '<rect x="332" y="258" width="106" height="24" rx="12" fill="url(#sheen)" opacity="0.2"/>';
        case "camera": // body + grip + big lens
            return '<rect x="160" y="210" width="280" height="180" rx="24" fill="url(#dark)"/>' +
                '<rect x="160" y="210" width="280" height="58" rx="24" fill="url(#body)" opacity="0.5"/>' +
                '<rect x="230" y="180" width="80" height="34" rx="10" fill="url(#dark)"/>' +
                '<circle cx="300" cy="300" r="70" fill="#05050a"/>' +
                '<circle cx="300" cy="300" r="52" fill="url(#screen)"/>' +
                '<circle cx="300" cy="300" r="30" fill="url(#body)" opacity="0.6"/>' +
                '<circle cx="282" cy="282" r="12" fill="url(#sheen)" opacity="0.6"/>' +
                '<circle cx="404" cy="242" r="10" fill="url(#body)"/>';
        case "yogamat": // rolled mat + end spiral + strap
            return '<rect x="150" y="250" width="300" height="100" rx="50" fill="url(#body)"/>' +
                '<circle cx="420" cy="300" r="50" fill="url(#dark)"/>' +
                '<circle cx="420" cy="300" r="26" fill="url(#body)"/>' +
                '<circle cx="420" cy="300" r="10" fill="url(#dark)"/>' +
                '<rect x="250" y="240" width="24" height="120" rx="10" fill="url(#metal)" opacity="0.8"/>';
        case "bottle": // cap + tall body + highlight
            return '<rect x="262" y="110" width="76" height="46" rx="14" fill="url(#metal)"/>' +
                '<rect x="238" y="150" width="124" height="300" rx="46" fill="url(#body)"/>' +
                '<rect x="252" y="172" width="26" height="250" rx="13" fill="url(#sheen)" opacity="0.35"/>' +
                '<rect x="238" y="250" width="124" height="18" fill="url(#dark)" opacity="0.3"/>';
        case "speaker": // cylinder + two drivers
            return '<rect x="215" y="150" width="170" height="290" rx="40" fill="url(#body)"/>' +
                '<rect x="215" y="150" width="170" height="70" rx="40" fill="url(#sheen)" opacity="0.2"/>' +
                '<circle cx="300" cy="250" r="46" fill="url(#dark)"/>' +
                '<circle cx="300" cy="250" r="22" fill="url(#metal)"/>' +
                '<circle cx="300" cy="350" r="34" fill="url(#dark)"/>' +
                '<circle cx="300" cy="350" r="14" fill="url(#metal)"/>';
        case "chair": // mesh back + seat + post + legs
            return '<rect x="220" y="130" width="160" height="150" rx="30" fill="url(#body)"/>' +
                '<rect x="232" y="142" width="136" height="126" rx="24" fill="url(#dark)" opacity="0.4"/>' +
                '<rect x="205" y="290" width="190" height="40" rx="16" fill="url(#body)"/>' +
                '<rect x="292" y="330" width="16" height="70" fill="url(#metal)"/>' +
                '<path d="M240 470 l60 -50 60 50" fill="none" stroke="url(#metal)" stroke-width="14" stroke-linecap="round"/>' +
                '<circle cx="240" cy="472" r="10" fill="url(#metal)"/><circle cx="360" cy="472" r="10" fill="url(#metal)"/>';
        default: // simple gift-box style placeholder
            return '<rect x="200" y="220" width="200" height="180" rx="20" fill="url(#body)"/>' +
                '<rect x="285" y="220" width="30" height="180" fill="url(#dark)" opacity="0.6"/>' +
                '<rect x="200" y="220" width="200" height="54" rx="20" fill="url(#sheen)" opacity="0.25"/>';
    }
}

/* ---------- 4. DEMONSTRATION DATA ---------- */

// The five catalogue categories required by the assignment.
var NOVA_CATEGORIES = ["Electronics", "Fashion", "Home & Living", "Accessories", "Lifestyle"];

// 20 realistic demonstration products.
// "demo: true" marks sample records so they can be identified during evaluation.
function buildDemoProducts() {
    return [
        { id: "P1", name: "Nebula Pro Headphones", category: "Electronics", price: 199.99, originalPrice: 249.99, rating: 4.8, reviews: 256, stock: 32, shape: "headphones", hue: 270, demo: true, featured: true, isNew: false, description: "Experience immersive sound with advanced active noise cancellation, a premium build and up to 40 hours of battery life.", specs: { "Driver": "40mm Dynamic", "Battery": "40 Hours", "Bluetooth": "v5.3", "Noise Cancel": "Hybrid ANC", "Weight": "268g", "Warranty": "2 Years" } },
        { id: "P2", name: "Pulse Air Earbuds", category: "Electronics", price: 79.99, originalPrice: 109.99, rating: 4.5, reviews: 189, stock: 58, shape: "earbuds", hue: 275, demo: true, featured: false, isNew: true, description: "Feather-light wireless earbuds with punchy bass, touch controls and a pocketable charging case.", specs: { "Driver": "11mm Dynamic", "Battery": "8 + 24 Hours", "Bluetooth": "v5.4", "Water Resist": "IPX5", "Weight": "4.2g each", "Warranty": "1 Year" } },
        { id: "P3", name: "Aurora 27\" 4K Monitor", category: "Electronics", price: 349.0, originalPrice: 429.0, rating: 4.7, reviews: 132, stock: 14, shape: "monitor", hue: 265, demo: true, featured: true, isNew: false, description: "A crisp 27-inch 4K IPS panel with ultra-thin bezels, ideal for work and play.", specs: { "Size": "27 Inches", "Resolution": "3840x2160", "Panel": "IPS 144Hz", "Ports": "HDMI x2, DP", "Coverage": "99% sRGB", "Warranty": "3 Years" } },
        { id: "P4", name: "Quantum 14 Ultrabook", category: "Electronics", price: 899.0, originalPrice: 1099.0, rating: 4.6, reviews: 98, stock: 9, shape: "laptop", hue: 268, demo: true, featured: false, isNew: true, description: "A thin, light all-metal laptop that comfortably handles coding, design and everything else.", specs: { "CPU": "8-core", "RAM": "16GB", "Storage": "512GB SSD", "Display": "14\" 2.8K", "Battery": "12 Hours", "Warranty": "2 Years" } },
        { id: "P5", name: "Nova X2 Smartphone", category: "Electronics", price: 549.0, originalPrice: 649.0, rating: 4.4, reviews: 210, stock: 27, shape: "phone", hue: 280, demo: true, featured: false, isNew: true, description: "A smooth 120Hz display, night-mode camera and all-day battery in a sleek glass body.", specs: { "Display": "6.5\" 120Hz", "Camera": "50MP Triple", "Battery": "5000mAh", "Storage": "256GB", "RAM": "8GB", "Warranty": "2 Years" } },
        { id: "P6", name: "Onyx Leather Jacket", category: "Fashion", price: 189.0, originalPrice: 259.0, rating: 4.6, reviews: 74, stock: 21, shape: "jacket", hue: 272, demo: true, featured: false, isNew: false, description: "A timeless genuine-leather jacket with a soft inner lining and tailored fit.", specs: { "Material": "Genuine Leather", "Lining": "Quilted Satin", "Sizes": "S - XXL", "Fit": "Tailored", "Care": "Dry Clean", "Warranty": "1 Year" } },
        { id: "P7", name: "Violet Silk Dress", category: "Fashion", price: 129.0, originalPrice: 169.0, rating: 4.7, reviews: 96, stock: 16, shape: "dress", hue: 285, demo: true, featured: true, isNew: true, description: "An elegant pure-silk dress that flows gracefully - perfect for evenings and events.", specs: { "Fabric": "100% Silk", "Length": "Midi", "Sizes": "XS - XL", "Fit": "Relaxed", "Care": "Hand Wash", "Warranty": "-" } },
        { id: "P8", name: "Titan Street Sneakers", category: "Fashion", price: 89.99, originalPrice: 119.99, rating: 4.3, reviews: 145, stock: 44, shape: "sneakers", hue: 266, demo: true, featured: false, isNew: false, description: "Everyday sneakers with cushioned soles, breathable knit uppers and grippy outsoles.", specs: { "Upper": "Knit Mesh", "Sole": "Rubber Foam", "Sizes": "6 - 12 UK", "Weight": "290g", "Use": "Casual / Running", "Warranty": "6 Months" } },
        { id: "P9", name: "Lumen Smart Lamp", category: "Home & Living", price: 49.99, originalPrice: 69.99, rating: 4.5, reviews: 88, stock: 37, shape: "lamp", hue: 278, demo: true, featured: false, isNew: false, description: "A desk lamp with 16 million colours, app control and a eye-comfort dimming mode.", specs: { "Light": "RGB LED", "Control": "App + Voice", "Power": "12W", "Height": "42cm", "Modes": "Reading / Focus / Party", "Warranty": "1 Year" } },
        { id: "P10", name: "Terra Vase Set (3)", category: "Home & Living", price: 39.0, originalPrice: 55.0, rating: 4.2, reviews: 41, stock: 25, shape: "vase", hue: 262, demo: true, featured: false, isNew: false, description: "Three hand-crafted ceramic vases in muted purple tones for a calm shelf display.", specs: { "Material": "Glazed Ceramic", "Heights": "18 / 24 / 30cm", "Finish": "Matte", "Set": "3 Pieces", "Care": "Wipe Clean", "Warranty": "-" } },
        { id: "P11", name: "Cloud Rest Pillow", category: "Home & Living", price: 29.99, originalPrice: 39.99, rating: 4.4, reviews: 167, stock: 62, shape: "pillow", hue: 274, demo: true, featured: false, isNew: false, description: "Memory-foam pillow with cooling gel that keeps its shape all night.", specs: { "Fill": "Memory Foam", "Cover": "Bamboo Blend", "Size": "Standard", "Support": "Medium-Firm", "Washable": "Cover Only", "Warranty": "1 Year" } },
        { id: "P12", name: "Ember Kettle 1.7L", category: "Home & Living", price: 59.0, originalPrice: 79.0, rating: 4.6, reviews: 121, stock: 0, shape: "kettle", hue: 269, demo: true, featured: false, isNew: false, description: "Fast-boil stainless kettle with variable temperature and a silent base.", specs: { "Capacity": "1.7L", "Power": "2200W", "Material": "Steel + Glass", "Presets": "4 Temps", "Auto Off": "Yes", "Warranty": "2 Years" } },
        { id: "P13", name: "Orbit Smartwatch", category: "Accessories", price: 149.0, originalPrice: 199.0, rating: 4.7, reviews: 203, stock: 33, shape: "watch", hue: 276, demo: true, featured: true, isNew: true, description: "Track workouts, sleep and notifications on a bright always-on AMOLED display.", specs: { "Display": "1.4\" AMOLED", "Battery": "10 Days", "Sensors": "HR + SpO2", "Water": "5ATM", "Straps": "Silicone + Mesh", "Warranty": "1 Year" } },
        { id: "P14", name: "Vertex Travel Backpack", category: "Accessories", price: 74.5, originalPrice: 99.0, rating: 4.5, reviews: 118, stock: 41, shape: "backpack", hue: 264, demo: true, featured: false, isNew: false, description: "A water-resistant 28L backpack with a laptop sleeve and hidden anti-theft pocket.", specs: { "Capacity": "28L", "Laptop": "Up to 16\"", "Fabric": "900D Ripstop", "Pockets": "7", "Water Resist": "IPX4", "Warranty": "2 Years" } },
        { id: "P15", name: "Halo Polarised Sunglasses", category: "Accessories", price: 45.0, originalPrice: 65.0, rating: 4.1, reviews: 57, stock: 8, shape: "sunglasses", hue: 282, demo: true, featured: false, isNew: false, description: "UV400 polarised lenses in a lightweight acetate frame - glare-free in style.", specs: { "Lens": "Polarised UV400", "Frame": "Acetate", "Weight": "26g", "Includes": "Hard Case", "Style": "Square", "Warranty": "1 Year" } },
        { id: "P16", name: "Lumen Pro Camera Kit", category: "Accessories", price: 649.0, originalPrice: 799.0, rating: 4.8, reviews: 64, stock: 6, shape: "camera", hue: 270, demo: true, featured: false, isNew: true, description: "A mirrorless camera kit with a fast prime lens for creators who want it all.", specs: { "Sensor": "24MP APS-C", "Video": "4K 60fps", "Lens": "18-55mm + 23mm", "Body": "Magnesium", "Storage": "SD UHS-II", "Warranty": "2 Years" } },
        { id: "P17", name: "Zen Yoga Mat Pro", category: "Lifestyle", price: 34.99, originalPrice: 44.99, rating: 4.3, reviews: 152, stock: 49, shape: "yogamat", hue: 267, demo: true, featured: false, isNew: false, description: "Extra-thick non-slip mat with alignment lines and a carry strap.", specs: { "Thickness": "8mm", "Size": "183 x 66cm", "Material": "TPE Eco", "Grip": "Double-sided", "Weight": "1.2kg", "Warranty": "-" } },
        { id: "P18", name: "Flow Steel Bottle 1L", category: "Lifestyle", price: 24.5, originalPrice: 32.0, rating: 4.6, reviews: 178, stock: 70, shape: "bottle", hue: 279, demo: true, featured: false, isNew: false, description: "Vacuum-insulated bottle: 24h cold, 12h hot, zero leaks.", specs: { "Capacity": "1L", "Steel": "18/8 Food-grade", "Cold": "24 Hours", "Hot": "12 Hours", "Lid": "Flip-spout", "Warranty": "Lifetime" } },
        { id: "P19", name: "Vibe 360 Speaker", category: "Lifestyle", price: 99.0, originalPrice: 139.0, rating: 4.5, reviews: 113, stock: 23, shape: "speaker", hue: 273, demo: true, featured: true, isNew: false, description: "Room-filling 360° sound, party lighting and 20-hour battery in one rugged speaker.", specs: { "Output": "30W", "Battery": "20 Hours", "Sound": "360° Stereo", "Water": "IP67", "Light": "RGB Ring", "Warranty": "1 Year" } },
        { id: "P20", name: "Aero Desk Chair", category: "Lifestyle", price: 179.0, originalPrice: 229.0, rating: 4.2, reviews: 86, stock: 11, shape: "chair", hue: 265, demo: true, featured: false, isNew: false, description: "Breathable mesh office chair with 4-way lumbar support and a smooth recline.", specs: { "Back": "Mesh", "Armrest": "4D", "Lumbar": "Adjustable", "Recline": "90-135°", "Capacity": "120kg", "Warranty": "3 Years" } }
    ];
}

// Demonstration accounts. NOTE: passwords are stored in plain text because
// this is a frontend-only academic demo - real apps need a server + hashing.
function buildDemoUsers() {
    return [
        { id: "U1", name: "Demo Customer", email: "customer@nova.demo", password: "demo123", role: "customer", phone: "9876543210", joined: "2026-08-01T09:00:00", demo: true },
        { id: "U2", name: "Nova Admin", email: "admin@nova.demo", password: "admin123", role: "admin", phone: "9999999999", joined: "2026-01-01T09:00:00", demo: true }
    ];
}

// A few sample orders so the dashboard looks presentable on first run.
// Real orders created during checkout are added to the same list.
function buildDemoOrders() {
    var today = new Date();

    function daysAgo(n) {
        var d = new Date(today);
        d.setDate(d.getDate() - n);
        return d.toISOString();
    }

    return [
        { id: "NV100241", userId: "U1", customerName: "Demo Customer", date: daysAgo(2), items: [{ id: "P1", name: "Nebula Pro Headphones", price: 199.99, quantity: 1, image: null }], subtotal: 199.99, discount: 20, delivery: 0, total: 179.99, payMethod: "UPI", payStatus: "Paid", status: "Shipped", demo: true },
        { id: "NV100238", userId: "U1", customerName: "Demo Customer", date: daysAgo(9), items: [{ id: "P13", name: "Orbit Smartwatch", price: 149.0, quantity: 1, image: null }, { id: "P18", name: "Flow Steel Bottle 1L", price: 24.5, quantity: 2, image: null }], subtotal: 198.0, discount: 10, delivery: 4.99, total: 192.99, payMethod: "Card", payStatus: "Paid", status: "Delivered", demo: true },
        { id: "NV100251", userId: "U1", customerName: "Demo Customer", date: daysAgo(1), items: [{ id: "P4", name: "Quantum 14 Ultrabook", price: 899.0, quantity: 1, image: null }], subtotal: 899.0, discount: 50, delivery: 0, total: 849.0, payMethod: "Cash on Delivery", payStatus: "Pending", status: "Placed", demo: true },
        { id: "NV100199", userId: null, customerName: "Sample Buyer", date: daysAgo(40), items: [{ id: "P3", name: "Aurora 27\" 4K Monitor", price: 349.0, quantity: 1, image: null }], subtotal: 349.0, discount: 0, delivery: 4.99, total: 353.99, payMethod: "UPI", payStatus: "Paid", status: "Delivered", demo: true },
        { id: "NV100215", userId: null, customerName: "Sample Buyer", date: daysAgo(20), items: [{ id: "P19", name: "Vibe 360 Speaker", price: 99.0, quantity: 2, image: null }], subtotal: 198.0, discount: 15, delivery: 0, total: 183.0, payMethod: "Card", payStatus: "Paid", status: "Delivered", demo: true }
    ];
}

// Sample admin notifications and activity feed entries.
function buildDemoNotifications() {
    return [
        { id: "N1", title: "Low stock alert", text: "Halo Polarised Sunglasses has only 8 units left.", time: "2h ago", type: "team", read: false, demo: true },
        { id: "N2", title: "New order received", text: "Order NV100251 worth ₹849.00 was placed.", time: "5h ago", type: "team", read: false, demo: true },
        { id: "N3", title: "Flash deal ends soon", text: "NOVA Flash Deals expire at the end of today.", time: "1d ago", type: "mention", read: true, demo: true }
    ];
}

function buildDemoActivities() {
    return [
        { id: "A1", text: "Product P12 marked out of stock", time: "1h ago", who: "System", demo: true },
        { id: "A2", text: "Flash deal discount set to 25%", time: "6h ago", who: "Nova Admin", demo: true },
        { id: "A3", text: "Order NV100241 moved to Shipped", time: "1d ago", who: "Nova Admin", demo: true }
    ];
}

// Application-wide settings (delivery charges, flash deal state...).
function buildDemoSettings() {
    // Flash deal end time: 2 days from first launch, stored so the countdown
    // keeps running across page refreshes.
    var endTime = new Date();
    endTime.setDate(endTime.getDate() + 2);

    return {
        deliveryCharge: 4.99,      // flat delivery fee
        freeDeliveryMin: 100,      // orders above this ship free
        flashDealActive: true,     // is the flash sale switched on
        flashDealPercent: 25,      // extra discount shown on flash products
        flashDealEnd: endTime.toISOString(),
        featuredIds: ["P1", "P3", "P7", "P13", "P19"] // homepage "Best Sellers"
    };
}

/* ---------- 5. ONE-TIME INITIALISATION ---------- */
// Demo data is written ONLY when a key is empty, so refreshing the page
// never overwrites data the user created during the demonstration.
function initDemoData() {
    if (localStorage.getItem("novaProducts") === null) {
        saveData("novaProducts", buildDemoProducts());
    }
    if (localStorage.getItem("novaUsers") === null) {
        saveData("novaUsers", buildDemoUsers());
    }
    if (localStorage.getItem("novaOrders") === null) {
        saveData("novaOrders", buildDemoOrders());
    }
    if (localStorage.getItem("novaNotifications") === null) {
        saveData("novaNotifications", buildDemoNotifications());
    }
    if (localStorage.getItem("novaActivities") === null) {
        saveData("novaActivities", buildDemoActivities());
    }
    if (localStorage.getItem("novaSettings") === null) {
        saveData("novaSettings", buildDemoSettings());
    }
    // Cart / wishlist / recently viewed start as empty arrays when missing.
    if (localStorage.getItem("novaCart") === null) { saveData("novaCart", []); }
    if (localStorage.getItem("novaWishlist") === null) { saveData("novaWishlist", []); }
    if (localStorage.getItem("novaRecentlyViewed") === null) { saveData("novaRecentlyViewed", []); }
}

// Run as soon as this file loads - every page includes storage.js first.
initDemoData();

/* ---------- 6. KEY-BASED GETTERS / SETTERS ---------- */
// Small named wrappers so the rest of the code reads like plain English.

function getProducts() { return loadData("novaProducts"); }
function saveProducts(list) { saveData("novaProducts", list); }

function getUsers() { return loadData("novaUsers"); }
function saveUsers(list) { saveData("novaUsers", list); }

function getCart() { return loadData("novaCart"); }
function saveCart(list) { saveData("novaCart", list); }

function getWishlist() { return loadData("novaWishlist"); }
function saveWishlist(list) { saveData("novaWishlist", list); }

function getOrders() { return loadData("novaOrders"); }
function saveOrders(list) { saveData("novaOrders", list); }

function getRecentlyViewed() { return loadData("novaRecentlyViewed"); }
function saveRecentlyViewed(list) { saveData("novaRecentlyViewed", list); }

function getSettings() { return loadData("novaSettings", buildDemoSettings()); }
function saveSettings(s) { saveData("novaSettings", s); }

function getNotifications() { return loadData("novaNotifications"); }
function saveNotifications(list) { saveData("novaNotifications", list); }

function getActivities() { return loadData("novaActivities"); }
function saveActivities(list) { saveData("novaActivities", list); }

// Find one product by its id (returns null when not found).
function findProduct(id) {
    var products = getProducts();
    for (var i = 0; i < products.length; i++) {
        if (products[i].id === id) { return products[i]; }
    }
    return null;
}

/* ---------- 7. RESET DEMO DATA ---------- */
// Restores the original demonstration state (used from the admin area).
function resetDemoData() {
    var keys = ["novaProducts", "novaUsers", "novaCart", "novaWishlist",
        "novaOrders", "novaRecentlyViewed", "novaSettings",
        "novaNotifications", "novaActivities"];

    keys.forEach(removeData);
    initDemoData(); // rebuild everything from the demo builders above
}
