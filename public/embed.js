(function () {
  var script = document.currentScript;
  var tenant = (script && script.getAttribute("data-tenant")) || "";
  var listingId = (script && script.getAttribute("data-listing-id")) || "";
  var apiBase = (script && script.getAttribute("data-api-base")) || "https://api.atlaspms.in";
  var portalBase = (script && script.getAttribute("data-portal-base")) || "https://atlaspms.in";

  if (!tenant) return;

  var root = document.createElement("div");
  root.style.border = "1px solid #e5e7eb";
  root.style.borderRadius = "12px";
  root.style.padding = "12px";
  root.style.fontFamily = "Inter, Arial, sans-serif";
  root.style.maxWidth = "480px";
  root.innerHTML = "<div style='font-weight:700;margin-bottom:8px'>Atlas Booking Widget</div><div id='atlas-widget-body'>Loading...</div>";
  script.parentNode.insertBefore(root, script.nextSibling);

  function qs(id) { return root.querySelector(id); }

  fetch(apiBase + "/listings/public", { headers: { "X-Tenant-Slug": tenant } })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var list = Array.isArray(rows) ? rows : [];
      if (listingId) list = list.filter(function (x) { return String(x.id) === String(listingId); });
      if (!list.length) {
        qs("#atlas-widget-body").textContent = "No listings available.";
        return;
      }
      var first = list[0];
      var card = document.createElement("div");
      card.innerHTML =
        "<div style='font-size:14px;margin-bottom:6px'><b>" + (first.name || "Listing") + "</b></div>" +
        "<div style='font-size:12px;color:#6b7280;margin-bottom:10px'>From INR " + (first.baseNightlyRate || 0) + " / night</div>" +
        "<div style='display:flex;gap:8px;margin-bottom:8px'><input id='atlas-widget-checkin' type='date' style='flex:1;padding:8px;border:1px solid #ddd;border-radius:6px' /><input id='atlas-widget-checkout' type='date' style='flex:1;padding:8px;border:1px solid #ddd;border-radius:6px' /></div>" +
        "<button id='atlas-widget-book-btn' style='background:#111827;color:#fff;border:none;border-radius:8px;padding:10px 14px;cursor:pointer'>Book now</button>";
      qs("#atlas-widget-body").innerHTML = "";
      qs("#atlas-widget-body").appendChild(card);
      qs("#atlas-widget-book-btn").onclick = function () {
        var ci = qs("#atlas-widget-checkin").value;
        var co = qs("#atlas-widget-checkout").value;
        var target = portalBase + "/property/" + first.id + "?tenant=" + encodeURIComponent(tenant);
        if (ci) target += "&checkIn=" + encodeURIComponent(ci);
        if (co) target += "&checkOut=" + encodeURIComponent(co);
        window.open(target, "_blank");
      };
    })
    .catch(function () {
      qs("#atlas-widget-body").textContent = "Failed to load listings.";
    });
})();

