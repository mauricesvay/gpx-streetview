const DEFAULT_POSITION = { lat: 48.85376, lng: 2.347237 };

async function initialize() {
  // State
  let path = [];
  let currentIndex = 0;
  let currentPosition = DEFAULT_POSITION;
  let currentHeading = 0;
  const follow = true;

  // DOM elements
  const trackbar = document.getElementById("trackbar");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const fileSelector = document.getElementById("file-selector");

  // Map elements
  const map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_POSITION,
    zoom: 14,
  });
  const marker = new google.maps.Marker({
    position: DEFAULT_POSITION,
  });
  const line = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: "#FF0000",
    strokeOpacity: 1.0,
    strokeWeight: 2,
  });
  const streetViewService = new google.maps.StreetViewService();
  let panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano"),
    {
      position: currentPosition,
      pov: {
        heading: currentHeading,
        pitch: 10,
      },
      source: google.maps.StreetViewSource.OUTDOOR,
    }
  );
  map.setStreetView(panorama);

  if (fileSelector) {
    fileSelector.addEventListener("change", (event) => {
      if (event.target.files.length === 1) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", (event) => {
          const gpxText = event.target.result;
          var gpx = new gpxParser();
          gpx.parse(gpxText);
          const gpxPath = gpx.tracks[0].points.map((point) => ({
            lat: point.lat,
            lng: point.lon,
          }));
          clearPath();
          setPath(gpxPath);
          moveToIndex(0);
          console.log(`GPX Loaded with ${path.length} points`);
        });
        reader.readAsText(file);
      }
    });
  }

  function disableControls() {
    prev?.setAttribute("disabled", "disabled");
    next?.setAttribute("disabled", "disabled");
    trackbar?.setAttribute("disabled", "disabled");
  }

  function enableControls() {
    prev?.removeAttribute("disabled");
    next?.removeAttribute("disabled");
    trackbar?.removeAttribute("disabled");
  }

  function centerMap() {
    map.setCenter(currentPosition);
  }

  function setPath(newPath) {
    path = newPath;
    currentIndex = 0;
    trackbar.value = 0;
    currentPosition = path[0];
    line.setPath(path);
    line.setMap(map);
    marker.setMap(map);
    updateMarker();
    enableControls();
    centerMap();
  }

  function clearPath() {
    path = [DEFAULT_POSITION];
    currentIndex = 0;
    currentPosition = path[0];
    line.setMap(null);
    marker.setMap(null);
    disableControls();
    centerMap();
  }

  const updateState = (index) => {
    currentIndex = index;
    currentPosition = path[currentIndex];

    let headingFrom;
    let headingTo;
    if (index === 0) {
      headingFrom = path[0];
      headingTo = path[1];
    } else if (index === path.length - 1) {
      headingFrom = path[path.length - 2];
      headingTo = path[path.length - 1];
    } else {
      headingFrom = path[currentIndex - 1];
      headingTo = path[currentIndex + 1];
    }
    const heading = google.maps.geometry.spherical.computeHeading(
      headingFrom,
      headingTo
    );
    currentHeading = heading;
  };

  let previous_panorama_state = false;

  const updateStreetView = _.debounce(() => {
    streetViewService.getPanorama({ location: currentPosition, radius: 50 }, function (data, status) {
      if (status === google.maps.StreetViewStatus.OK) {

        if (!previous_panorama_state) { // Reset panorama if it was not available before / crashed
          panorama = new google.maps.StreetViewPanorama(
            document.getElementById("pano"),
            {
              position: currentPosition,
              pov: {
                heading: currentHeading,
                pitch: 10,
              },
              source: google.maps.StreetViewSource.OUTDOOR,
            }
          )
          previous_panorama_state = true;
        }
        panorama.setPosition(currentPosition);
        panorama.setPov({
          heading: currentHeading,
          pitch: 10,
        });
        map.setStreetView(panorama);
        if (follow) {
          centerMap();
        }

      } else {
        previous_panorama_state = false;
        // Street View panorama is not available for this location
        console.error("Street View panorama is not available for this location.");
        document.getElementById("pano").innerHTML = "Street View is not available for this location.";
        // You can provide a fallback or handle the error as needed here.
      }
    });
  }, 500);

  function updateTrackbar() {
    const percent = Math.floor((currentIndex / path.length) * 100);
    trackbar.value = percent;
  }

  function updateMarker() {
    marker.setPosition(currentPosition);
  }

  function moveToIndex(newIndex) {
    if (!path.length) {
      return;
    }
    updateState(newIndex);
    updateMarker();
    updateTrackbar();
    updateStreetView();
  }

  function movePrev() {
    const newIndex = _.clamp(currentIndex - 1, 0, path.length - 1);
    moveToIndex(newIndex);
  }

  function moveNext() {
    const newIndex = _.clamp(currentIndex + 1, 0, path.length - 1);
    moveToIndex(newIndex);
  }

  prev?.addEventListener("click", movePrev);
  Mousetrap.bind("j", () => movePrev());
  next?.addEventListener("click", moveNext);
  Mousetrap.bind("k", () => moveNext());

  trackbar?.addEventListener("input", (e) => {
    const percent = parseFloat(e.target?.value ?? "0");
    const newIndex = _.clamp(
      Math.round((percent * path.length) / 100),
      0,
      path.length - 1
    );
    updateState(newIndex);
    updateMarker();
  });

  trackbar?.addEventListener("change", () => {
    updateStreetView();
  });
}

window.initialize = initialize;
