// MAC vendor lookup — fully client-side. Data: IEEE OUI registry (built into oui.json).
(function () {
  var db = null;
  var btn = document.getElementById('check');
  var input = document.getElementById('macs');
  var out = document.getElementById('results');
  if (!btn) return;

  function loadDb() {
    if (db) return Promise.resolve(db);
    out.innerHTML = '<div class="result-row"><span class="vendor">Loading vendor database…</span></div>';
    return fetch('/assets/oui.json').then(function (r) { return r.json(); }).then(function (j) { db = j; return db; });
  }

  function normalize(line) {
    var hex = line.toUpperCase().replace(/[^0-9A-F]/g, '');
    if (hex.length < 6) return null;
    return { prefix: hex.slice(0, 6), full: line.trim() };
  }

  function isLocallyAdministered(prefix) {
    // 2nd hex digit of first octet: 2,6,A,E => locally administered (randomized) address
    return '26AE'.indexOf(prefix.charAt(1)) !== -1;
  }

  function rowHtml(mac, entry) {
    var vendor, badge;
    if (entry) {
      vendor = entry[0];
      if (entry[1] === 1) badge = '<span class="badge badge-cam">camera brand</span>';
      else if (entry[1] === 2) badge = '<span class="badge badge-maybe">makes cameras</span>';
      else badge = '<span class="badge badge-ok">not a camera brand</span>';
    } else if (isLocallyAdministered(mac.prefix)) {
      vendor = 'Randomized address (likely a phone or laptop)';
      badge = '<span class="badge badge-unknown">private address</span>';
    } else {
      vendor = 'Unknown vendor';
      badge = '<span class="badge badge-unknown">not in registry</span>';
    }
    return '<div class="result-row"><span class="mac">' + mac.full.replace(/</g, '&lt;') + '</span><span class="vendor">' + vendor.replace(/</g, '&lt;') + '</span>' + badge + '</div>';
  }

  btn.addEventListener('click', function () {
    var lines = input.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) {
      out.innerHTML = '<div class="result-row"><span class="vendor">Paste at least one MAC address above, like A4:CF:12:0E:3B:91.</span></div>';
      return;
    }
    loadDb().then(function (d) {
      var html = '';
      var found = 0;
      lines.slice(0, 200).forEach(function (line) {
        var mac = normalize(line);
        if (!mac) { html += '<div class="result-row"><span class="mac">' + line.replace(/</g, '&lt;') + '</span><span class="vendor">Not a valid MAC address</span><span class="badge badge-unknown">skipped</span></div>'; return; }
        var entry = d[mac.prefix];
        if (entry && entry[1]) found++;
        html += rowHtml(mac, entry);
      });
      if (found) {
        html += '<div class="result-row" style="border-color:rgba(245,158,11,.45)"><span class="vendor">' + found + ' device' + (found > 1 ? 's' : '') + ' matched a camera-capable brand. Verify physically before assuming the worst: check our room sweep guides below.</span></div>';
      }
      out.innerHTML = html;
    }).catch(function () {
      out.innerHTML = '<div class="result-row"><span class="vendor">Could not load the vendor database. Refresh and try again.</span></div>';
    });
  });
})();
