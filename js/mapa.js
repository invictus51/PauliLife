(function () {

  const mapElement = document.getElementById("mapa-paulina");
  if (!mapElement || !window.L) return;
  const paulinaCenter = [-22.7609, -47.1543];
  const map = L.map(mapElement).setView(paulinaCenter, 13);
  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 20,

      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',

      referrerPolicy: "strict-origin-when-cross-origin"
    }
  ).addTo(map);
  let selectedLocation = null;
  let selectionMarker = null;
  const reportMarkers = new Map();
  function iconForStatus(status) {

    const concluida = status === "Concluída";

    return L.divIcon({
      className: "eco-map-marker",

      html: `
        <span class="marker-pin ${concluida ? "marker-done" : ""}">
        </span>
      `,

      iconSize: [22, 30],
      iconAnchor: [11, 28],
      popupAnchor: [0, -25]
    });

  }
  map.on("click", (event) => {
    const form = document.getElementById("form-denuncia");
    if (!form || form.classList.contains("hidden")) {
      return;
    }
    selectedLocation = {
      latitude: event.latlng.lat,
      longitude: event.latlng.lng
    };
    if (selectionMarker) {
      map.removeLayer(selectionMarker);
    }

    selectionMarker = L.marker(event.latlng, {
      title: "Local selecionado"
    })
      .addTo(map)
      .bindPopup("Local aproximado selecionado para a denúncia.")
      .openPopup();
    const label = document.getElementById("local-selecionado");

    if (label) {
      label.textContent =
        `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;
    }

  });
  function popupElement(report) {

    const wrapper = document.createElement("div");

    const title = document.createElement("strong");

    title.textContent =
      report.category || "Denúncia ambiental";

    const reporter = document.createElement("p");

    reporter.textContent =
      `Registrada por: ${report.reporter_name || "Morador"}`;

    reporter.style.margin = "6px 0";

    const details = document.createElement("small");

    const date = report.created_at
      ? new Date(report.created_at).toLocaleDateString("pt-BR")
      : "Data não informada";

    details.textContent =
      `${report.status || "Recebida"} · ${date}`;

    wrapper.append(title, reporter, details);

    return wrapper;

  }

  function addOrUpdateReport(report) {
    if (
      !report ||
      report.id == null ||
      report.latitude == null ||
      report.longitude == null
    ) {
      return;
    }
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    const point = [latitude, longitude];

    const icon = iconForStatus(report.status);

    const popup = popupElement(report);

    const existingMarker = reportMarkers.get(report.id);
    if (existingMarker) {

      existingMarker.setLatLng(point);

      existingMarker.setIcon(icon);

      existingMarker.setPopupContent(popup);

      return;
    }
    const newMarker = L.marker(point, {
      icon: icon
    });
    newMarker.bindPopup(popup);
    newMarker.addTo(map);
    reportMarkers.set(report.id, newMarker);

  }
  function removeReport(id) {

    const marker = reportMarkers.get(id);

    if (!marker) return;

    map.removeLayer(marker);

    reportMarkers.delete(id);

  }
  function clearReports() {

    reportMarkers.forEach((marker) => {
      map.removeLayer(marker);
    });

    reportMarkers.clear();

  }
  function clearSelection() {

    selectedLocation = null;

    if (selectionMarker) {

      map.removeLayer(selectionMarker);

      selectionMarker = null;

    }
    const label = document.getElementById("local-selecionado");
    if (label) {
      label.textContent =
        "Clique no mapa para marcar o local aproximado.";

    }
  }

  window.EcoMapa = {
    map,
    get selectedLocation() {
      return selectedLocation;
    },
    addOrUpdateReport,
    removeReport,
    clearReports,
    clearSelection,

    fitPaulínia() {
      map.setView(paulinaCenter, 13);
    }

  };

})();
