import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ComplaintMap = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/public/complaints/locations")
      .then((res) => res.json())
      .then((data) => {
        setComplaints(data);
        setLoading(false);
      });
  }, []);

  // Default center (India)
  const center = [20.5937, 78.9629];

  return (
    <div style={{ height: "500px", width: "100%" }}>
      {loading ? (
        <div>Loading map...</div>
      ) : (
        <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {complaints.map((c) =>
            c.latitude && c.longitude ? (
              <CircleMarker
                key={c.id}
                center={[c.latitude, c.longitude]}
                radius={8}
                color={c.status === "resolved" ? "green" : c.status === "in_progress" ? "orange" : "red"}
                fillOpacity={0.7}
              >
                <Popup>
                  <b>{c.category}</b> ({c.status})<br />
                  {c.address || "No address"}<br />
                  {new Date(c.created_at).toLocaleString()}
                </Popup>
              </CircleMarker>
            ) : null
          )}
        </MapContainer>
      )}
    </div>
  );
};

export default ComplaintMap;
