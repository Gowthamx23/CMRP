import React, { useState } from "react";

const TrackComplaint = () => {
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState(null);

  const handleTrack = async (e) => {
    e.preventDefault();
    const res = await fetch(`/public/complaints/track/${trackingId}`);
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
            <pre>{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackComplaint;
