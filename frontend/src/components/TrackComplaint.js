import React, { useState } from "react";

const TrackComplaint = () => {
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState(null);

  const handleTrack = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/complaints/public/${trackingId}`);
    if (res.ok) setResult(await res.json());
    else setResult({ error: "Not found" });
  };

  return (
    <div>
      <h2>Track Your Complaint</h2>
      <form onSubmit={handleTrack}>
        <input
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          placeholder="Enter Tracking ID"
        />
        <button type="submit">Track</button>
      </form>
      {result && (
        <div>
          {result.error ? (
            <span style={{ color: "red" }}>{result.error}</span>
          ) : (
            <div>
              <p><strong>ID:</strong> {result.publicId}</p>
              <p><strong>Status:</strong> {result.status}</p>
              <p><strong>Location:</strong> {result.location || "-"}</p>
              <p><strong>Updated:</strong> {result.updatedAt ? new Date(result.updatedAt).toLocaleString() : "-"}</p>
              {result.photoUrl && (
                <div style={{ marginTop: 8 }}>
                  <img src={result.photoUrl} alt="Complaint" style={{ maxWidth: 300 }} />
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                {result.description}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackComplaint;
