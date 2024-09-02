let map;
let markers = [];
let currentDestination = '';
let flightPath;
let currentView = 'box'; 
let currentDate = new Date().toISOString().split('T')[0]; 

const TICKETMASTER_API_KEY = 'ZjenxxlGlGA6R4yKlV9AkATiz72ax9yw';
const YELP_API_KEY = 'clXf93paFO6txLwFvG7sVWQCxMfZqGjCOteE5mUucRPIE9BKbVK8mPXc8hzcttmMmR5DwS7YMJfgUX51qye2B4H77SuetARPxyZ2S47wExuESHGV-s_7ab7CnMy_ZnYx';

window.addEventListener("load", function () {
    initMap();
    loadItinerary();
    addModalCloseListeners();
});

async function getAmadeusToken() {
    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'grant_type': 'client_credentials',
            'client_id': 'P4VJ6tzSSvr98ZEOo0J2C4zeuXyS6CU0',
            'client_secret': 'cARxw7u99UcMGJWs'
        })
    });

    const data = await response.json();
    return data.access_token;
}

function initMap() {
    map = L.map("map", {
        center: [0, 0],
        zoom: 3,
        zoomControl: false,
        minZoom: 2,
        maxZoom: 18,
        maxBounds: [
            [-90, -180],
            [90, 180],
        ],
        maxBoundsViscosity: 1.0,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control
        .zoom({
            position: "topright",
        })
        .addTo(map);

    setTimeout(function () {
        map.invalidateSize();
    }, 100);
}

function addModalCloseListeners() {
    document.querySelectorAll(".close").forEach(closeBtn => {
        closeBtn.onclick = function() {
            closeBtn.closest(".modal").style.display = "none";
        }
    });
}

async function getCoordinates(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        location
    )}&limit=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                return [lat, lon];
            } else {
                throw new Error(`Invalid coordinates returned for ${location}`);
            }
        } else {
            throw new Error(`Could not find coordinates for ${location}`);
        }
    } catch (error) {
        console.error("Error fetching coordinates:", error);
        throw error;
    }
}

async function updateMap(currentLocation, destination) {
    // Clear existing markers and flight path
    markers.forEach((marker) => map.removeLayer(marker));
    markers = [];

    if (flightPath) {
        map.removeLayer(flightPath);
    }

    try {
        // Get coordinates for both locations
        const currentCoords = await getCoordinates(currentLocation);
        const destCoords = await getCoordinates(destination);

        // Add markers for start and destination
        const currentMarker = L.marker(currentCoords)
            .addTo(map)
            .bindPopup(`Start: ${currentLocation}`)
            .openPopup();
        const destMarker = L.marker(destCoords)
            .addTo(map)
            .bindPopup(`Destination: ${destination}`);
        markers.push(currentMarker, destMarker);

        const bounds = L.latLngBounds([currentCoords, destCoords]);
        map.fitBounds(bounds, { padding: [50, 50] });

        flightPath = L.polyline([currentCoords, destCoords], {
            color: "red",
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1,
        }).addTo(map);
    } catch (error) {
        console.error("Error updating map:", error);
        alert(`Error: ${error.message}`);
    }
}

document.getElementById("travel-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const currentLocation = document.getElementById("current-location").value;
    const destination = document.getElementById("destination").value;
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    if (!currentLocation || !destination || !startDate || !endDate) {
        alert("Please fill in all fields.");
        return;
    }

    currentDestination = destination;
    updateMap(currentLocation, destination);
    showOptionsModal(currentLocation, destination, startDate, endDate);
});

document.getElementById("view-itinerary").addEventListener("click", function() {
    displayItinerary();
    document.getElementById("itineraryModal").style.display = "block";
});

function showOptionsModal(currentLocation, destination, startDate, endDate) {
    const modal = document.getElementById("optionsModal");
    modal.style.display = "block";

    document.getElementById("flightsOption").onclick = function() {
        document.getElementById("attractionFilters").style.display = "none";
        fetchFlights(currentLocation, destination, startDate);
    }

    document.getElementById("eventsOption").onclick = function() {
        document.getElementById("attractionFilters").style.display = "none";
        fetchEvents(destination, startDate, endDate);
    }

    document.getElementById("attractionsOption").onclick = function() {
        document.getElementById("attractionFilters").style.display = "block";
        fetchAttractions(destination);
    }

}

async function fetchFlights(currentLocation, destination, startDate) {
    const loadingIndicator = document.getElementById("loadingIndicator");
    const optionContent = document.getElementById("optionContent");

    loadingIndicator.style.display = "block";
    optionContent.style.display = "none";

    try {
        // Get authentication token and IATA codes
        const token = await getToken();
        const origin = await getIataCodeFromAmadeus(currentLocation);
        const dest = await getIataCodeFromAmadeus(destination);

        if (!origin || !dest) {
            optionContent.innerHTML = "<p>Error retrieving IATA codes.</p>";
            return;
        }

        // Fetch flight data from Amadeus API
        const response = await fetch(`https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${startDate}&adults=1&nonStop=false&max=5`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        optionContent.innerHTML = ''; 

        // Process and display flight data
        if (data.data) {
            data.data.forEach(flight => {
                const flightDiv = document.createElement('div');
                flightDiv.className = 'flight-box';

                const departure = flight.itineraries[0].segments[0].departure;
                const arrival = flight.itineraries[0].segments[0].arrival;

                const duration = calculateFlightDuration(departure.at, arrival.at);
                const departureDateTime = new Date(departure.at).toLocaleString(undefined, {
                    timeZoneName: 'short',
                    hour12: true
                });
                const arrivalDateTime = new Date(arrival.at).toLocaleString(undefined, {
                    timeZoneName: 'short',
                    hour12: true
                });

                const priceInUSD = (flight.price.total * 1.1).toFixed(2);
                const airlineName = flight.validatingAirlineCodes[0] || 'Unknown Airline';
                const flightNumber = flight.itineraries[0].segments[0].flightNumber || '';

                flightDiv.innerHTML = `
                    <h4>${airlineName} ${flightNumber ? `Flight ${flightNumber}` : ''}</h4>
                    <p><strong>From:</strong> ${departure.iataCode} at ${departureDateTime}</p>
                    <p><strong>To:</strong> ${arrival.iataCode} at ${arrivalDateTime}</p>
                    <p><strong>Duration:</strong> ${duration.hours}h ${duration.minutes}m</p>
                    <p><strong>Price:</strong> ${priceInUSD} USD</p>
                    <button class="add-to-itinerary" data-type="Flight" data-info='${JSON.stringify({
                        name: `${airlineName} ${flightNumber ? `Flight ${flightNumber}` : ''}`,
                        airline: flight.validatingAirlineCodes[0],
                        date: departure.at.split('T')[0],
                        time: departure.at.split('T')[1],
                        duration: (duration.hours + duration.minutes / 60).toFixed(2),
                        url: ''
                    })}'>Add to Itinerary</button>
                `;

                optionContent.appendChild(flightDiv);
            });
        } else if (data.errors) {
            optionContent.innerHTML = `<p>Error: ${data.errors[0].title} - ${data.errors[0].detail}</p>`;
        } else {
            optionContent.innerHTML = '<p>No flights found for the selected criteria.</p>';
        }
    } catch (error) {
        optionContent.innerHTML = "<p>Error fetching flights data.</p>";
        console.error("Error fetching flights data:", error);
    } finally {

        loadingIndicator.style.display = "none";
        optionContent.style.display = "block";
    }
}

function calculateFlightDuration(departureTime, arrivalTime) {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);

    const durationMs = arrival - departure;
    const durationHours = Math.floor(durationMs / 1000 / 60 / 60);
    const durationMinutes = Math.floor((durationMs / 1000 / 60) % 60);

    return {
        hours: durationHours,
        minutes: durationMinutes
    };
}

async function getToken() {
    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'grant_type': 'client_credentials',
            'client_id': 'P4VJ6tzSSvr98ZEOo0J2C4zeuXyS6CU0',
            'client_secret': 'cARxw7u99UcMGJWs'
        })
    });

    const data = await response.json();
    return data.access_token;
}

async function getIataCodeFromAmadeus(cityOrCode) {
    const token = await getToken();

    const response = await fetch(`https://test.api.amadeus.com/v1/reference-data/locations?subType=CITY,AIRPORT&keyword=${cityOrCode}&page[limit]=1`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (data && data.data && data.data.length > 0) {
        return data.data[0].iataCode;
    } else {
        console.error('No matching IATA code found for:', cityOrCode);
        return null;
    }
}

async function fetchEvents(destination, startDate, endDate) {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${destination}&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=100`;

    document.getElementById("optionContent").innerHTML = "<p>Loading events data...</p>";

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data._embedded && data._embedded.events) {
            const eventsContainer = document.getElementById("optionContent");
            eventsContainer.innerHTML = "<h3>Events</h3>";
            const groupedEvents = {};

            // Group events by name and process event data
            data._embedded.events.forEach(event => {
                if (groupedEvents[event.name]) {
                    groupedEvents[event.name].dates.push({
                        date: event.dates.start.localDate,
                        time: event.dates.start.localTime,
                        url: event.url
                    });
                } else {
                    groupedEvents[event.name] = {
                        name: event.name,
                        venue: event._embedded.venues[0].name,
                        dates: [{
                            date: event.dates.start.localDate,
                            time: event.dates.start.localTime,
                            url: event.url
                        }]
                    };
                }
            });

            // Display grouped events
            Object.values(groupedEvents).forEach(event => {
                const eventBox = document.createElement("div");
                eventBox.className = "event-box";
                eventBox.innerHTML = `
                    <h4>${event.name}</h4>
                    <p><strong>Venue:</strong> ${event.venue}</p>
                    <button class="show-dates">Show Dates</button>
                    <div class="event-dates" style="display: none;">
                        ${event.dates.map(d => `
                            <p>
                                ${d.date} at ${d.time}
                                <button class="add-to-itinerary" data-type="Event" data-info='${JSON.stringify({
                                    name: event.name,
                                    venue: event.venue,
                                    date: d.date,
                                    time: d.time,
                                    url: d.url
                                })}'>+</button>
                            </p>
                        `).join('')}
                    </div>
                `;
                eventsContainer.appendChild(eventBox);
            });

            document.querySelectorAll('.show-dates').forEach(btn => {
                btn.addEventListener('click', function() {
                    const dates = this.nextElementSibling;
                    dates.style.display = dates.style.display === 'none' ? 'block' : 'none';
                });
            });
        } else {
            document.getElementById("optionContent").innerHTML = "<p>No events found for the selected dates.</p>";
        }
    } catch (error) {
        document.getElementById("optionContent").innerHTML = "<p>Error fetching events data.</p>";
        console.error("Error fetching events data:", error);
    }
}

async function fetchAttractions(destination, filter = 'all') {
  // Construct the URL for the Yelp API request
  let url = `https://api.yelp.com/v3/businesses/search?location=${destination}&sort_by=review_count&limit=50`;
  if (filter !== 'all') {
      url += `&categories=${filter}`;
  }

  document.getElementById("optionContent").innerHTML = "<p>Loading attractions data...</p>";

  try {
      // Make the API request to Yelp
      const response = await fetch(url, {
          headers: {
              Authorization: `Bearer ${YELP_API_KEY}`,
          },
      });
      const data = await response.json();

      if (data.businesses && data.businesses.length > 0) {
          const attractionsContainer = document.getElementById("optionContent");
          attractionsContainer.innerHTML = "<h3>Attractions</h3>";

          // Filter and display attractions with a rating of 4 or higher
          data.businesses
              .filter(business => business.rating >= 4)
              .forEach((business) => {
                  const attractionBox = document.createElement("div");
                  attractionBox.className = "attraction-box";
                  attractionBox.innerHTML = `
                      <h4>${business.name}</h4>
                      <p><strong>Rating:</strong> ${business.rating} (${business.review_count} reviews)</p>
                      <p><strong>Address:</strong> ${business.location.address1}, ${business.location.city}</p>
                      <p><strong>Phone:</strong> ${business.phone}</p>
                      <p><a href="${business.url}" target="_blank">View on Yelp</a></p>
                      <button class="add-to-itinerary" data-type="Attraction" data-info='${JSON.stringify(business)}'>+</button>
                  `;
                  attractionsContainer.appendChild(attractionBox);
              });
      } else {
          document.getElementById("optionContent").innerHTML = "<p>No attractions found for the destination.</p>";
      }
  } catch (error) {
      document.getElementById("optionContent").innerHTML = "<p>Error fetching attractions data.</p>";
      console.error("Error fetching attractions data:", error);
  }
}

function addToItinerary(type, info) {
  // Create a new itinerary item
  const itineraryContent = document.getElementById("itineraryContent");
  const item = document.createElement("div");
  item.className = "itinerary-item";
  const isScheduled = info.date && info.time;

  // Populate the item with details and input fields
  item.innerHTML = `
      <h4>${type}</h4>
      <p>${info.name || info.airline}</p>
      <p>Date: <input type="date" value="${info.date || ''}" class="itinerary-date" ${isScheduled ? 'disabled' : ''}></p>
      <p>Time: <input type="time" value="${info.time || ''}" class="itinerary-time" ${isScheduled ? 'disabled' : ''}></p>
      <p>Duration: <input type="number" min="0" step="0.5" value="${info.duration || 1}" class="itinerary-duration" ${isScheduled ? 'disabled' : ''}> hours</p>
      ${info.url ? `<p><a href="${info.url}" target="_blank">More Info</a></p>` : ''}
      ${isScheduled ?
          `<button class="unschedule-item">Unschedule</button>` :
          `<button class="schedule-item">Schedule</button>`
      }
      <button class="remove-from-itinerary">Remove</button>
  `;
  itineraryContent.appendChild(item);

  // Save the updated itinerary, show a notification, and refresh the display
  saveItinerary();
  showNotification(`${type} added to itinerary`);
  displayItinerary();
}

function showNotification(message) {
  // Create and append a notification element
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  // Show the notification with a slight delay
  setTimeout(() => {
      notification.classList.add('show');
  }, 10);

  // Hide and remove the notification after a set time
  setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
          document.body.removeChild(notification);
      }, 300);
  }, 3000);
}

function displayItinerary() {
  const itineraryContent = document.getElementById("itineraryContent");
  const items = loadItineraryFromStorage();

  itineraryContent.innerHTML = ''; 

  // Create controls for switching between box and calendar views
  const controls = document.createElement('div');
  controls.className = 'itinerary-controls';
  controls.innerHTML = `
      <select id="view-toggle">
          <option value="box" ${currentView === 'box' ? 'selected' : ''}>Box View</option>
          <option value="calendar" ${currentView === 'calendar' ? 'selected' : ''}>Calendar View</option>
      </select>
      ${currentView === 'calendar' ? `
          <input type="date" id="date-selector" value="${currentDate}">
          <button id="confirm-date">Confirm Date</button>
      ` : ''}
  `;
  itineraryContent.appendChild(controls);

  // Display the appropriate view based on the current selection
  if (currentView === 'box') {
      displayBoxView(items, itineraryContent);
  } else {
      displayCalendarView(items, itineraryContent);
  }

  // Add event listeners for itinerary interactions
  addItineraryEventListeners(); 
}

function displayBoxView(items, container) {
  // Separate scheduled and unscheduled items
  const scheduledItems = items.filter(item => item.date && item.time);
  const unscheduledItems = items.filter(item => !item.date || !item.time);

  // Display unscheduled items
  const unscheduledContainer = document.createElement('div');
  unscheduledContainer.innerHTML = '<h3>Unscheduled Items</h3>';
  unscheduledItems.forEach(item => {
      const newItem = createItineraryItem(item);
      unscheduledContainer.appendChild(newItem);
  });
  container.appendChild(unscheduledContainer);

  // Display scheduled items if any exist
  if (scheduledItems.length > 0) {
      const scheduledContainer = document.createElement('div');
      scheduledContainer.innerHTML = '<h3>Scheduled Items</h3>';
      scheduledItems.forEach(item => {
          const newItem = createItineraryItem(item);
          scheduledContainer.appendChild(newItem);
      });
      container.appendChild(scheduledContainer);
  }
}

function displayCalendarView(items, container) {
  // Create and display a calendar view of scheduled items
  const calendar = createCalendarView(currentDate, items);
  container.appendChild(calendar);
}

function createCalendarView(date, items) {
  const calendar = document.createElement('div');
  calendar.className = 'calendar-view';

  const hours = Array.from({ length: 24 }, (_, i) => i);

  hours.forEach(hour => {
      const hourBlock = document.createElement('div');
      hourBlock.className = 'hour-block';
      hourBlock.innerHTML = `
          <div class="hour-label">${hour.toString().padStart(2, '0')}:00</div>
          <div class="hour-content"></div>
      `;

      // Place items in their corresponding time slots
      items.forEach(item => {
          const itemDate = item.date;
          const itemTime = item.time;
          const itemHour = itemTime ? parseInt(itemTime.split(':')[0]) : null;
          const itemMinute = itemTime ? parseInt(itemTime.split(':')[1]) : 0;
          const itemDuration = parseFloat(item.duration);

          if (itemDate === date && itemHour === hour) {
              const eventBlock = document.createElement('div');
              eventBlock.className = 'event-block';

              const blockHeight = (itemDuration * 60).toFixed(2);  
              eventBlock.style.height = `${blockHeight}px`;
              eventBlock.style.top = `${itemMinute}px`;  

              eventBlock.innerHTML = `
                  <strong>${item.type}</strong>
                  <p>${item.name}</p>
                  <p>${itemTime} - ${new Date(new Date(`${date}T${itemTime}`).getTime() + itemDuration * 60 * 60 * 1000).toTimeString().slice(0, 5)}</p>
              `;
              hourBlock.querySelector('.hour-content').appendChild(eventBlock);
          }
      });

      calendar.appendChild(hourBlock);
  });

  return calendar;
}

function addItineraryEventListeners() {
  // Add event listeners for removing items from the itinerary
  document.querySelectorAll('.remove-from-itinerary').forEach(button => {
      button.addEventListener('click', function() {
          const item = this.closest('.itinerary-item');
          item.remove();
          saveItinerary();
          displayItinerary();
      });
  });

  // Add event listeners for updating itinerary item details
  document.querySelectorAll('.itinerary-item input').forEach(input => {
      input.addEventListener('change', function() {
          const item = this.closest('.itinerary-item');
          const updatedItem = {
              type: item.querySelector('h4').textContent,
              name: item.querySelector('p').textContent,
              date: item.querySelector('.itinerary-date').value,
              time: item.querySelector('.itinerary-time').value,
              duration: item.querySelector('.itinerary-duration').value,
              url: item.querySelector('a') ? item.querySelector('a').href : null
          };
          updateItineraryItem(updatedItem);
          saveItinerary();
      });
  });

  // Add event listeners for scheduling and unscheduling items
  document.querySelectorAll('.schedule-item, .unschedule-item').forEach(button => {
      button.addEventListener('click', function() {
          const item = this.closest('.itinerary-item');
          const dateInput = item.querySelector('.itinerary-date');
          const timeInput = item.querySelector('.itinerary-time');
          const durationInput = item.querySelector('.itinerary-duration');

          if (this.classList.contains('schedule-item')) {
              if (dateInput.value && timeInput.value) {
                  this.textContent = 'Unschedule';
                  this.className = 'unschedule-item';
              } else {
                  alert('Please select both date and time before scheduling.');
                  return;
              }
          } else {
              dateInput.value = '';
              timeInput.value = '';
              this.textContent = 'Schedule';
              this.className = 'schedule-item';
          }

          const updatedItem = {
              type: item.querySelector('h4').textContent,
              name: item.querySelector('p').textContent,
              date: dateInput.value,
              time: timeInput.value,
              duration: durationInput.value,
              url: item.querySelector('a') ? item.querySelector('a').href : null
          };
          updateItineraryItem(updatedItem);
          saveItinerary();
          displayItinerary();
      });
  });

  // Add event listener for toggling between box and calendar views
  document.getElementById('view-toggle').addEventListener('change', function() {
      currentView = this.value;
      displayItinerary();
  });

  // Add event listener for confirming date in calendar view
  const confirmDateButton = document.getElementById('confirm-date');
  if (confirmDateButton) {
      confirmDateButton.addEventListener('click', function() {
          currentDate = document.getElementById('date-selector').value;
          displayItinerary();
      });
  }

  // Add event listeners for blocking time slots in calendar view
  document.querySelectorAll('.block-time').forEach(button => {
      button.addEventListener('click', function() {
          const hour = this.dataset.hour;
          const reason = prompt("Enter a reason for blocking this time (e.g., 'Sleep', 'Rest'):");
          if (reason) {
              addToItinerary('Blocked Time', {
                  name: reason,
                  date: currentDate,
                  time: `${hour.padStart(2, '0')}:00`,
                  duration: 1
              });
          }
      });
  });
}

function saveItinerary() {
  // Save the current itinerary to local storage
  const itineraryItems = Array.from(document.querySelectorAll('.itinerary-item')).map(item => ({
      type: item.querySelector('h4').textContent,
      name: item.querySelector('p').textContent,
      date: item.querySelector('.itinerary-date').value,
      time: item.querySelector('.itinerary-time').value,
      duration: item.querySelector('.itinerary-duration').value,
      url: item.querySelector('a') ? item.querySelector('a').href : null
  }));
  localStorage.setItem('trippy_itinerary', JSON.stringify(itineraryItems));
}

function loadItinerary() {
  // Load the saved itinerary from local storage and add items to the current itinerary
  const savedItinerary = localStorage.getItem('trippy_itinerary');
  if (savedItinerary) {
      const itineraryItems = JSON.parse(savedItinerary);
      itineraryItems.forEach(item => {
          addToItinerary(item.type, item);
      });
  }
}

document.addEventListener('click', function(e) {
  // Event delegation for adding items to the itinerary
  if (e.target.classList.contains('add-to-itinerary')) {
      const type = e.target.dataset.type;
      const info = JSON.parse(e.target.dataset.info);
      addToItinerary(type, info);
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  // Add event listeners for attraction filters
  btn.addEventListener('click', function() {
      const filter = this.dataset.filter;
      fetchAttractions(currentDestination, filter);
  });
});

function createItineraryItem(item) {
  // Create a DOM element for an itinerary item
  const itemElement = document.createElement('div');
  itemElement.className = 'itinerary-item';
  itemElement.innerHTML = `
      <h4>${item.type}</h4>
      <p>${item.name}</p>
      <p>Date: <input type="date" value="${item.date || ''}" class="itinerary-date"></p>
      <p>Time: <input type="time" value="${item.time || ''}" class="itinerary-time"></p>
      <p>Duration: <input type="number" min="0" step="0.5" value="${item.duration || 1}" class="itinerary-duration"> hours</p>
      ${item.url ? `<p><a href="${item.url}" target="_blank">More Info</a></p>` : ''}
      <button class="${item.date && item.time ? 'unschedule-item' : 'schedule-item'}">${item.date && item.time ? 'Unschedule' : 'Schedule'}</button>
      <button class="remove-from-itinerary">Remove</button>
  `;
  return itemElement;
}

function loadItineraryFromStorage() {
  // Load the itinerary from local storage
  const savedItinerary = localStorage.getItem('trippy_itinerary');
  return savedItinerary ? JSON.parse(savedItinerary) : [];
}

function updateItineraryItem(updatedItem) {
  // Update a specific item in the itinerary
  const items = loadItineraryFromStorage();
  const index = items.findIndex(item =>
      item.type === updatedItem.type &&
      item.name === updatedItem.name
  );
  if (index !== -1) {
      items[index] = updatedItem;
      localStorage.setItem('trippy_itinerary', JSON.stringify(items));
  }
}

document.getElementById('theme-blurple').addEventListener('click', function() {
  setTheme('blurple');
});

document.getElementById('theme-red').addEventListener('click', function() {
  setTheme('red');
});

document.getElementById('theme-green').addEventListener('click', function() {
  setTheme('green');
});

document.getElementById('theme-yellow').addEventListener('click', function() {
  setTheme('yellow');
});

function setTheme(theme) {
  // Set the color theme for the application
  document.body.className = `theme-${theme}`;
}