import React, { useEffect, useState } from "react";

const PublicDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    zone: "",
    from_date: "",
    to_date: "",
  });

  const fetchComplaints = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    const res = await fetch(`/public/complaints/dashboard?${params.toString()}`);
    setComplaints(await res.json());
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchComplaints();
  };

  return (
    <div>
      <h2>Public Complaints Dashboard</h2>
      <form onSubmit={handleFilter} style={{ marginBottom: 16 }}>
        <input name="status" placeholder="Status" value={filters.status} onChange={handleChange} />
        <input name="category" placeholder="Category" value={filters.category} onChange={handleChange} />
        <input name="zone" placeholder="Zone" value={filters.zone} onChange={handleChange} />
        <input name="from_date" type="date" value={filters.from_date} onChange={handleChange} />
        <input name="to_date" type="date" value={filters.to_date} onChange={handleChange} />
        <button type="submit">Filter</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Tracking ID</th>
            <th>Status</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Created</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((c) => (
            <tr key={c.tracking_id}>
              <td>{c.tracking_id}</td>
              <td>{c.status}</td>
              <td>{c.category}</td>
              <td>{c.priority}</td>
              <td>{new Date(c.created_at).toLocaleString()}</td>
              <td>{c.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PublicDashboard;
