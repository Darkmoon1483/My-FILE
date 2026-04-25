/**
 * T-Goda Shared Utilities
 * ─────────────────────────────────────────────
 * Provides:
 *   1. Date Range Picker  (TgodaDatePicker)
 *   2. Google Places Autocomplete  (TgodaPlaces)
 *   3. Google Maps embed helper     (TgodaMap)
 *
 * HOW TO CONFIGURE:
 *   Set your Google API key in ONE place before this script loads:
 *     <script>window.TGODA_GOOGLE_API_KEY = 'YOUR_KEY_HERE';</script>
 *
 *   Required Google APIs to enable in your Cloud Console:
 *     • Maps JavaScript API
 *     • Places API (New)
 */

/* ═══════════════════════════════════════════════════
   0.  GOOGLE MAPS LOADER  (loads once, calls callbacks)
   ═══════════════════════════════════════════════════ */
const TgodaLoader = (() => {
  let loaded = false;
  let loading = false;
  const queue = [];

  function onReady(cb) {
    if (loaded) { cb(); return; }
    queue.push(cb);
    if (loading) return;
    loading = true;

    const key = window.TGODA_GOOGLE_API_KEY || 'YAIzaSyDoyHlnphzfK405yh7Ws1tLUR2Nt5JsYJk';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__tgodaMapsReady`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  window.__tgodaMapsReady = function () {
    loaded = true;
    queue.forEach(fn => fn());
    queue.length = 0;
  };

  return { onReady };
})();


/* ═══════════════════════════════════════════════════
   1.  DATE RANGE PICKER
   ═══════════════════════════════════════════════════
   Usage:
     new TgodaDatePicker({
       trigger: '#my-date-field',   // element that opens the picker
       display: '#date-display',    // element that shows formatted range
       onSelect: (checkIn, checkOut) => { ... }
     });
*/
class TgodaDatePicker {
  constructor({ trigger, display, onSelect, initialIn, initialOut } = {}) {
    this.triggerEl  = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
    this.displayEl  = typeof display === 'string' ? document.querySelector(display) : display;
    this.onSelect   = onSelect || (() => {});
    this.checkIn    = initialIn  ? new Date(initialIn)  : null;
    this.checkOut   = initialOut ? new Date(initialOut) : null;
    this.selecting  = 'in';    // 'in' | 'out'
    this.viewYear   = new Date().getFullYear();
    this.viewMonth  = new Date().getMonth();
    this._open      = false;

    this._buildDOM();
    this._attachTrigger();
    if (this.checkIn && this.checkOut) this._updateDisplay();
  }

  /* ── Build picker DOM ── */
  _buildDOM() {
    // Remove any existing picker
    const existing = document.getElementById('tgoda-datepicker');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'tgoda-datepicker';
    el.className = 'tgoda-dp';
    el.innerHTML = `
      <div class="tgoda-dp-arrow"></div>
      <div class="tgoda-dp-header">
        <button class="tgoda-dp-nav" id="tgoda-dp-prev">‹</button>
        <div class="tgoda-dp-months">
          <div class="tgoda-dp-month" id="tgoda-dp-month-left"></div>
          <div class="tgoda-dp-month" id="tgoda-dp-month-right"></div>
        </div>
        <button class="tgoda-dp-nav" id="tgoda-dp-next">›</button>
      </div>
      <div class="tgoda-dp-legend">
        <span id="tgoda-dp-status">Select check-in date</span>
      </div>
      <div class="tgoda-dp-actions">
        <button class="tgoda-dp-clear" id="tgoda-dp-clear">Clear</button>
        <button class="tgoda-dp-done"  id="tgoda-dp-done">Done</button>
      </div>`;
    document.body.appendChild(el);
    this._pickerEl = el;

    el.querySelector('#tgoda-dp-prev').addEventListener('click', () => this._shiftMonths(-1));
    el.querySelector('#tgoda-dp-next').addEventListener('click', () => this._shiftMonths(1));
    el.querySelector('#tgoda-dp-clear').addEventListener('click', () => {
      this.checkIn = null; this.checkOut = null; this.selecting = 'in';
      this._renderCalendars();
      if (this.displayEl) this.displayEl.textContent = 'Select dates';
    });
    el.querySelector('#tgoda-dp-done').addEventListener('click', () => this._closePicker());

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this._open && !el.contains(e.target) && e.target !== this.triggerEl && !this.triggerEl.contains(e.target)) {
        this._closePicker();
      }
    });

    this._injectStyles();
    this._renderCalendars();
  }

  _attachTrigger() {
    if (!this.triggerEl) return;
    this.triggerEl.style.cursor = 'pointer';
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this._open ? this._closePicker() : this._openPicker();
    });
  }

  _openPicker() {
    this._open = true;
    this._pickerEl.classList.add('visible');
    this._positionPicker();
    this._renderCalendars();
  }

  _closePicker() {
    this._open = false;
    this._pickerEl.classList.remove('visible');
    if (this.checkIn && this.checkOut) {
      this._updateDisplay();
      this.onSelect(this.checkIn, this.checkOut);
    }
  }

  _positionPicker() {
    const rect = this.triggerEl.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    const pw = this._pickerEl.offsetWidth || 660;
    let left = rect.left + scrollX;
    if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    if (left < 5) left = 5;
    this._pickerEl.style.top  = (rect.bottom + scrollY + 8) + 'px';
    this._pickerEl.style.left = left + 'px';
  }

  _shiftMonths(delta) {
    this.viewMonth += delta;
    if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
    if (this.viewMonth < 0)  { this.viewMonth = 11; this.viewYear--; }
    this._renderCalendars();
  }

  _renderCalendars() {
    const months = [0, 1].map(offset => {
      let m = this.viewMonth + offset;
      let y = this.viewYear;
      if (m > 11) { m -= 12; y++; }
      return { m, y };
    });

    ['left', 'right'].forEach((side, idx) => {
      const { m, y } = months[idx];
      document.getElementById(`tgoda-dp-month-${side}`).innerHTML = this._buildMonth(m, y);
    });

    this._pickerEl.querySelectorAll('.tgoda-dp-day[data-date]').forEach(cell => {
      cell.addEventListener('click', () => this._onDayClick(cell.dataset.date));
      cell.addEventListener('mouseover', () => this._onDayHover(cell.dataset.date));
    });

    const status = document.getElementById('tgoda-dp-status');
    if (!this.checkIn) status.textContent = 'Select check-in date';
    else if (!this.checkOut) status.textContent = `Check-in: ${this._fmt(this.checkIn)} — now select check-out`;
    else status.textContent = `${this._fmt(this.checkIn)}  →  ${this._fmt(this.checkOut)}`;
  }

  _buildMonth(month, year) {
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const today  = new Date(); today.setHours(0,0,0,0);

    let html = `<div class="tgoda-dp-month-title">${MONTHS[month]} ${year}</div>`;
    html += `<div class="tgoda-dp-grid">`;
    DAYS.forEach(d => { html += `<div class="tgoda-dp-dow">${d}</div>`; });

    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < first; i++) html += `<div class="tgoda-dp-day tgoda-dp-empty"></div>`;

    for (let d = 1; d <= total; d++) {
      const date = new Date(year, month, d);
      const key  = this._key(date);
      const isPast = date < today;

      let cls = 'tgoda-dp-day';
      if (isPast) cls += ' past';
      else {
        if (this.checkIn  && this._key(this.checkIn)  === key) cls += ' check-in';
        if (this.checkOut && this._key(this.checkOut) === key) cls += ' check-out';
        if (this.checkIn && this.checkOut && date > this.checkIn && date < this.checkOut) cls += ' in-range';
        if (this.checkIn && !this.checkOut && this._hoverDate) {
          const hd = new Date(this._hoverDate);
          if (date > this.checkIn && date < hd) cls += ' in-range';
        }
      }

      html += `<div class="${cls}"${!isPast ? ` data-date="${key}"` : ''}>${d}</div>`;
    }

    html += `</div>`;
    return html;
  }

  _onDayClick(dateStr) {
    const date = new Date(dateStr);
    if (this.selecting === 'in' || (this.checkIn && date <= this.checkIn)) {
      this.checkIn  = date;
      this.checkOut = null;
      this.selecting = 'out';
    } else {
      this.checkOut  = date;
      this.selecting = 'in';
    }
    this._renderCalendars();
  }

  _onDayHover(dateStr) {
    if (this.checkIn && !this.checkOut) {
      this._hoverDate = dateStr;
      this._renderCalendars();
    }
  }

  _updateDisplay() {
    if (!this.displayEl || !this.checkIn || !this.checkOut) return;
    const nights = Math.round((this.checkOut - this.checkIn) / 86400000);
    this.displayEl.textContent = `${this._fmtShort(this.checkIn)} – ${this._fmtShort(this.checkOut)} · ${nights} night${nights !== 1 ? 's' : ''}`;
  }

  _key(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  _fmt(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  _fmtShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ── Inject CSS once ── */
  _injectStyles() {
    if (document.getElementById('tgoda-dp-styles')) return;
    const style = document.createElement('style');
    style.id = 'tgoda-dp-styles';
    style.textContent = `
      .tgoda-dp {
        position: absolute;
        z-index: 9999;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,.18);
        padding: 20px;
        width: 660px;
        max-width: calc(100vw - 20px);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-6px);
        transition: opacity .18s ease, transform .18s ease;
        font-family: 'Manrope', sans-serif;
      }
      .tgoda-dp.visible { opacity: 1; pointer-events: all; transform: translateY(0); }
      .tgoda-dp-header { display: flex; align-items: flex-start; gap: 8px; }
      .tgoda-dp-months { display: flex; gap: 16px; flex: 1; }
      .tgoda-dp-month { flex: 1; }
      .tgoda-dp-month-title { text-align: center; font-weight: 700; font-size: .9rem; margin-bottom: 10px; color: #111; }
      .tgoda-dp-nav {
        background: none; border: 1px solid #e5e7eb; border-radius: 8px;
        width: 32px; height: 32px; cursor: pointer; font-size: 1.1rem; color: #374151;
        flex-shrink: 0; margin-top: 2px;
      }
      .tgoda-dp-nav:hover { background: #f3f4f6; }
      .tgoda-dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
      .tgoda-dp-dow { text-align: center; font-size: .7rem; font-weight: 600; color: #9ca3af; padding: 4px 0; }
      .tgoda-dp-day {
        text-align: center; padding: 7px 2px; font-size: .8rem; border-radius: 6px;
        cursor: pointer; color: #111; transition: background .12s;
      }
      .tgoda-dp-day:hover:not(.past):not(.tgoda-dp-empty) { background: #f0f4ff; }
      .tgoda-dp-day.past { color: #d1d5db; cursor: default; }
      .tgoda-dp-day.check-in, .tgoda-dp-day.check-out {
        background: #FF5A5F !important; color: #fff !important; font-weight: 700; border-radius: 8px;
      }
      .tgoda-dp-day.in-range { background: #FEE2E2; color: #111; border-radius: 0; }
      .tgoda-dp-legend { text-align: center; font-size: .8rem; color: #6b7280; margin: 12px 0 6px; }
      .tgoda-dp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid #f0f0f0; padding-top: 12px; }
      .tgoda-dp-clear { background: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 16px; cursor: pointer; font-size: .82rem; color: #374151; }
      .tgoda-dp-clear:hover { background: #f9fafb; }
      .tgoda-dp-done { background: #FF5A5F; color: #fff; border: none; border-radius: 8px; padding: 7px 20px; cursor: pointer; font-size: .82rem; font-weight: 600; }
      .tgoda-dp-done:hover { background: #e04e53; }
      @media (max-width: 680px) {
        .tgoda-dp { width: calc(100vw - 16px); padding: 14px; }
        .tgoda-dp-months { flex-direction: column; gap: 8px; }
        #tgoda-dp-month-right { display: none; }
      }
    `;
    document.head.appendChild(style);
  }
}


/* ═══════════════════════════════════════════════════
   2.  GOOGLE PLACES AUTOCOMPLETE
   ═══════════════════════════════════════════════════
   Usage:
     TgodaPlaces.attach('#search-input', (place) => {
       console.log(place.name, place.formatted_address);
     });
*/
const TgodaPlaces = {
  attach(inputSelector, onSelect) {
    TgodaLoader.onReady(() => {
      const input = typeof inputSelector === 'string'
        ? document.querySelector(inputSelector)
        : inputSelector;
      if (!input) return;

      const ac = new google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
      });

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place && place.name) onSelect(place);
      });

      // Style the Google autocomplete dropdown to match T-Goda
      TgodaPlaces._injectACStyles();
    });
  },

  _injectACStyles() {
    if (document.getElementById('tgoda-places-styles')) return;
    const s = document.createElement('style');
    s.id = 'tgoda-places-styles';
    s.textContent = `
      .pac-container {
        border-radius: 12px !important;
        box-shadow: 0 12px 40px rgba(0,0,0,.15) !important;
        border: none !important;
        font-family: 'Manrope', sans-serif !important;
        margin-top: 4px !important;
      }
      .pac-item { padding: 10px 16px !important; cursor: pointer !important; font-size: .875rem !important; }
      .pac-item:hover { background: #f0f4ff !important; }
      .pac-item-selected { background: #f0f4ff !important; }
      .pac-matched { font-weight: 700 !important; color: #FF5A5F !important; }
      .pac-icon { display: none !important; }
    `;
    document.head.appendChild(s);
  }
};


/* ═══════════════════════════════════════════════════
   3.  GOOGLE MAP EMBED
   ═══════════════════════════════════════════════════
   Usage:
     TgodaMap.render('#map-container', {
       lat: 35.2641,
       lng: 25.7166,
       zoom: 13,
       marker: { title: 'Grand Azure Resort & Spa' },
       nearbySearch: 'hotel'   // optional: show nearby hotels
     });
*/
const TgodaMap = {
  render(containerSelector, { lat, lng, zoom = 14, marker, nearbySearch, onMarkerClick } = {}) {
    TgodaLoader.onReady(() => {
      const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;
      if (!container) return;

      const map = new google.maps.Map(container, {
        center: { lat, lng },
        zoom,
        styles: TgodaMap._mapStyle(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });

      if (marker) {
        const pin = new google.maps.Marker({
          position: { lat, lng },
          map,
          title: marker.title || '',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF5A5F',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          animation: google.maps.Animation.DROP,
        });

        if (marker.title) {
          const iw = new google.maps.InfoWindow({ content: `<div style="font-family:Manrope,sans-serif;font-weight:600;padding:2px 4px;">${marker.title}</div>` });
          pin.addListener('click', () => iw.open(map, pin));
          if (onMarkerClick) pin.addListener('click', () => onMarkerClick(marker));
        }
      }

      if (nearbySearch) {
        const svc = new google.maps.places.PlacesService(map);
        svc.nearbySearch({ location: { lat, lng }, radius: 5000, type: nearbySearch }, (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK) return;
          results.slice(0, 8).forEach(place => {
            const m = new google.maps.Marker({
              map,
              position: place.geometry.location,
              title: place.name,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#3B82F6',
                fillOpacity: .85,
                strokeColor: '#fff',
                strokeWeight: 1.5,
              },
            });
            const iw = new google.maps.InfoWindow({
              content: `<div style="font-family:Manrope,sans-serif;padding:4px;">
                <strong>${place.name}</strong><br>
                ${place.vicinity || ''}${place.rating ? `<br>⭐ ${place.rating}` : ''}
              </div>`
            });
            m.addListener('click', () => iw.open(map, m));
          });
        });
      }

      return map;
    });
  },

  /* Minimal clean map style matching T-Goda palette */
  _mapStyle() {
    return [
      { featureType: 'water', stylers: [{ color: '#cce4f7' }] },
      { featureType: 'landscape', stylers: [{ color: '#f5f5f0' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4edda' }] },
      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    ];
  }
};
