import React, { useEffect, useState } from "react";

const ComplaintComments = ({ complaintId, token }) => {
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchComments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/complaints/${complaintId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      setComments(await res.json());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (complaintId && token) fetchComments();
    // eslint-disable-next-line
  }, [complaintId, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`/api/complaints/${complaintId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, type }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      setMessage("");
      setType("public");
      fetchComments();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h3>Comments</h3>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {comments.map((c, i) => (
          <li key={i} style={{ marginBottom: 12, borderLeft: c.type === "internal" ? "4px solid orange" : "4px solid #007bff", paddingLeft: 8 }}>
            <b>{c.author_name}</b> ({c.author_role}) [{c.type}]<br />
            <span>{c.message}</span>
            <div style={{ fontSize: 12, color: "#888" }}>{new Date(c.timestamp).toLocaleString()}</div>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment..."
          required
          rows={3}
          style={{ width: "100%" }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ marginTop: 4 }}>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
        </select>
        <button type="submit" style={{ marginTop: 8 }}>Add Comment</button>
      </form>
    </div>
  );
};

export default ComplaintComments;
