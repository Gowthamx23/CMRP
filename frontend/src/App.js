import React, { useState, useEffect } from 'react';
// Updated imports for routing and charts
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';


// Import UI components
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
// Updated icon imports
import { AlertTriangle, MapPin, User, Phone, Mail, FileText, Calendar, Eye, Upload, CheckCircle, Clock, AlertCircle, XCircle, Search, BarChart2, PieChart as PieChartIcon, ArrowLeft, Activity } from 'lucide-react';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// API Configuration
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Map component for location selection
function LocationSelector({ position, setPosition, onAddressChange }) {
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(false);

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setPosition([e.latlng.lat, e.latlng.lng]);
        // Get address for clicked location
        getAddressFromCoordinates(e.latlng.lat, e.latlng.lng);
      },
    });

    return position === null ? null : (
      <Marker position={position}>
        <Popup>Selected location</Popup>
      </Marker>
    );
  };

  // Component to update map view when position changes
  const MapUpdater = () => {
    const map = useMap();

    React.useEffect(() => {
      if (position && !isLoadingLocation) {
        map.flyTo(position, 16, {
          animate: true,
          duration: 1.5
        });
      }
    }, [position, map, isLoadingLocation]);

    return null;
  };

  const getAddressFromCoordinates = async (lat, lng) => {
    try {
      console.log('🌐 Making reverse geocoding request for:', { lat, lng });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CMRP-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📍 Reverse geocoding response:', data);

      if (data && data.display_name) {
        const address = data.display_name;
        console.log('✅ Address found:', address);

        if (onAddressChange) {
          onAddressChange(address);
          console.log('✅ Address callback executed');
        } else {
          console.warn('⚠️ onAddressChange callback not available');
        }
      } else {
        console.warn('⚠️ No address found in response');
        onAddressChange && onAddressChange('Location selected (address not found)');
      }
    } catch (error) {
      console.error('❌ Error getting address:', error);
      // Still call callback with coordinates if address lookup fails
      onAddressChange && onAddressChange(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const getCurrentLocation = (e) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser. Please select your location manually on the map.');
      return;
    }

    setIsLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          console.log('📍 Got current location:', { lat, lng });

          // Set position first to trigger map update
          setPosition([lat, lng]);

          // Wait a bit for the map to animate, then get address
          setTimeout(async () => {
            await getAddressFromCoordinates(lat, lng);
            setIsLoadingLocation(false);
          }, 500);
        } catch (error) {
          console.error('❌ Error processing location:', error);
          alert('Got your location but failed to get address. Please check manually.');
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error('❌ Geolocation error:', error);
        let errorMessage = 'Unable to get your current location. ';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permission denied. Please allow location access and try again, or select manually on the map.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information unavailable. Please select manually on the map.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again or select manually on the map.';
            break;
          default:
            errorMessage += 'Please select manually on the map.';
            break;
        }

        alert(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-slate-300">Select Location</Label>
        <Button
          type="button"
          onClick={getCurrentLocation}
          variant="outline"
          size="sm"
          disabled={isLoadingLocation}
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          {isLoadingLocation ? (
            <>
              <div className="animate-spin w-4 h-4 mr-2 border-2 border-slate-400 border-t-transparent rounded-full" />
              Getting Location...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Use Current Location
            </>
          )}
        </Button>
      </div>
      <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-700 relative">
        {isLoadingLocation && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 z-[1000] flex items-center justify-center">
            <div className="bg-slate-800 rounded-lg shadow-xl p-4 flex items-center space-x-3 border border-slate-700">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full" />
              <span className="text-sm font-medium text-slate-200">Locating you...</span>
            </div>
          </div>
        )}
        <MapContainer
          center={position || [28.6139, 77.2088]}
          zoom={position ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LocationMarker />
          <MapUpdater />
        </MapContainer>
      </div>
      {position && (
        <div className="flex items-center space-x-2 text-sm text-slate-200 bg-green-900/30 p-3 rounded-lg border border-green-700">
          <MapPin className="w-4 h-4 text-green-400" />
          <span>
            <strong className="text-green-300">Selected:</strong> {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}

// Auth Context
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      const { access_token, user: userInfo } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Mock Data for Analytics Charts ---
const barChartData = [
  { name: 'Roads', total: 120, resolved: 75 },
  { name: 'Water', total: 98, resolved: 80 },
  { name: 'Electricity', total: 75, resolved: 60 },
  { name: 'Garbage', total: 150, resolved: 90 },
  { name: 'Safety', total: 45, resolved: 40 },
];

const pieChartData = [
  { name: 'Open', value: 45 },
  { name: 'In Progress', value: 85 },
  { name: 'Resolved', value: 345 },
  { name: 'Closed', value: 120 },
];

const PIE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#6B7280'];

// --- NEW Home Page Component ---
function HomePage() {
  const [trackingId, setTrackingId] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const navigate = useNavigate();

  const handleTrackComplaint = (e) => {
    e.preventDefault();
    if (trackingId.trim()) {
      navigate(`/track/${trackingId.trim()}`);
    }
  };

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const response = await api.get('/api/analytics');
        setAnalyticsData(response.data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Transform analytics data for charts
  const getBarChartData = () => {
    if (!analyticsData) return barChartData;

    // Use real category data from backend
    if (analyticsData.byCategory && analyticsData.byCategory.length > 0) {
      return analyticsData.byCategory.slice(0, 5); // Show top 5 categories
    }

    // Fallback to status data if no category data
    return [
      { name: 'Total', total: analyticsData.total, resolved: analyticsData.byStatus.RESOLVED || 0 },
      { name: 'Pending', total: analyticsData.byStatus.PENDING || 0, resolved: 0 },
      { name: 'In Progress', total: analyticsData.byStatus.IN_PROGRESS || 0, resolved: 0 },
      { name: 'Resolved', total: analyticsData.byStatus.RESOLVED || 0, resolved: analyticsData.byStatus.RESOLVED || 0 },
    ];
  };

  const getPieChartData = () => {
    if (!analyticsData) return pieChartData;

    return [
      { name: 'Pending', value: analyticsData.byStatus.PENDING || 0 },
      { name: 'In Progress', value: analyticsData.byStatus.IN_PROGRESS || 0 },
      { name: 'Resolved', value: analyticsData.byStatus.RESOLVED || 0 },
    ];
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen">
      {/* 1. Hero Section */}
      <section className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4 bg-gradient-to-b from-slate-900 to-purple-900/50">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">
          Voice Your Concerns. Drive the Change.
        </h1>
        <p className="max-w-3xl text-lg md:text-xl text-slate-300 mb-8">
          The Complaint Management & Resolution Portal (CMRP) is your direct line to civic authorities. Report issues, track progress, and help build a better community.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="bg-purple-600 hover:bg-purple-700">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-slate-900 transition-colors">
            <Link to="/register">Register Account</Link>
          </Button>
        </div>
      </section>

      {/* Main content area */}
      <main className="container mx-auto px-4 py-12 md:py-20 space-y-16">

        {/* 2. Complaint Tracker Section */}
        <section id="tracker">
          <Card className="max-w-2xl mx-auto bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Search className="w-6 h-6 mr-2 text-purple-400" />
                Track Your Complaint
              </CardTitle>
              <CardDescription>
                Enter the unique tracking ID to check the current status of your complaint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrackComplaint} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="e.g., CMP20250809-A4T7B1"
                  className="flex-grow bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                />
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                  Track Status
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* 3. Analysis Graphs Section */}
        <section id="analytics">
          <h2 className="text-3xl font-bold text-center mb-8">
            Live Complaint Analytics
          </h2>

          {/* Stats Cards */}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">
                    {analyticsData.total}
                  </div>
                  <div className="text-slate-300">Total Complaints</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    {analyticsData.byStatus.PENDING || 0}
                  </div>
                  <div className="text-slate-300">Pending</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {analyticsData.byStatus.IN_PROGRESS || 0}
                  </div>
                  <div className="text-slate-300">In Progress</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    {analyticsData.byStatus.RESOLVED || 0}
                  </div>
                  <div className="text-slate-300">Resolved</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            <Card className="lg:col-span-3 bg-slate-800/80 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart2 className="w-5 h-5 mr-2 text-purple-400" />
                  Complaints by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-slate-400">Loading analytics...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getBarChartData()}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                      <Legend />
                      <Bar dataKey="total" name="Total Filed" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 bg-slate-800/80 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChartIcon className="w-5 h-5 mr-2 text-purple-400" />
                  Overall Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-slate-400">Loading analytics...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={110}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

          </div>
        </section>
      </main>
    </div>
  );
}

// --- Enhanced Tracking Page Component ---
function TrackingPage() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiUrl = API_BASE_URL ? `${API_BASE_URL}/api/complaints/public/${id}` : `/api/complaints/public/${id}`;
    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Complaint not found');
        }
        return res.json();
      })
      .then(setComplaint)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'Pending Review';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'RESOLVED':
        return 'Resolved';
      default:
        return status || 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Complaint Tracker</h1>
                <p className="text-slate-400">Track your complaint status</p>
              </div>
            </div>
            <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-white mb-2">Complaint Details</CardTitle>
                <CardDescription className="text-slate-400">
                  Tracking ID: <span className="font-mono font-bold text-purple-400">{id}</span>
                </CardDescription>
              </div>
              {complaint && (
                <div className={`px-4 py-2 rounded-full border flex items-center space-x-2 ${getStatusColor(complaint.status)}`}>
                  {getStatusIcon(complaint.status)}
                  <span className="font-medium">{getStatusText(complaint.status)}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading complaint details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Complaint Not Found</h3>
                <p className="text-slate-400 mb-6">
                  The complaint ID <span className="font-mono text-red-400">{id}</span> could not be found.
                </p>
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Please check that:</p>
                  <ul className="text-sm text-slate-500 space-y-1">
                    <li>• The complaint ID is correct</li>
                    <li>• The complaint exists in our system</li>
                    <li>• You have the right tracking number</li>
                  </ul>
                </div>
                <Button asChild className="mt-6 bg-purple-600 hover:bg-purple-700">
                  <Link to="/">Search Another Complaint</Link>
                </Button>
              </div>
            ) : complaint ? (
              <div className="space-y-6">
                {/* Description */}
                <div className="bg-slate-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-purple-400" />
                    Description
                  </h3>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {complaint.description}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Location */}
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-purple-400" />
                      Location
                    </h3>
                    <p className="text-slate-300">
                      {complaint.location || 'Location not specified'}
                    </p>
                  </div>

                  {/* Last Updated */}
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-purple-400" />
                      Last Updated
                    </h3>
                    <p className="text-slate-300">
                      {complaint.updatedAt ? new Date(complaint.updatedAt).toLocaleString() : 'Not available'}
                    </p>
                  </div>
                </div>

                {/* Photo */}
                {complaint.photoUrl && (
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <Upload className="w-5 h-5 mr-2 text-purple-400" />
                      Attached Photo
                    </h3>
                    <div className="relative">
                      <img
                        src={complaint.photoUrl}
                        alt="Complaint photo"
                        className="w-full max-w-md h-64 object-cover rounded-lg border border-slate-600 shadow-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="bg-slate-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-purple-400" />
                    Status Timeline
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-white font-medium">Complaint Submitted</p>
                        <p className="text-slate-400 text-sm">Your complaint has been received and is under review</p>
                      </div>
                    </div>
                    <div className={`flex items-center space-x-4 ${complaint.status === 'IN_PROGRESS' || complaint.status === 'RESOLVED' ? 'opacity-100' : 'opacity-50'}`}>
                      <div className={`w-3 h-3 rounded-full ${complaint.status === 'IN_PROGRESS' || complaint.status === 'RESOLVED' ? 'bg-yellow-500' : 'bg-slate-600'}`}></div>
                      <div>
                        <p className="text-white font-medium">In Progress</p>
                        <p className="text-slate-400 text-sm">Officials are working on your complaint</p>
                      </div>
                    </div>
                    <div className={`flex items-center space-x-4 ${complaint.status === 'RESOLVED' ? 'opacity-100' : 'opacity-50'}`}>
                      <div className={`w-3 h-3 rounded-full ${complaint.status === 'RESOLVED' ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                      <div>
                        <p className="text-white font-medium">Resolved</p>
                        <p className="text-slate-400 text-sm">Your complaint has been successfully resolved</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// Officer Login Component
function OfficerLoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = React.useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('username', formData.username);
      formDataToSend.append('password', formData.password);

      const response = await api.post('/api/officer/login', formDataToSend);

      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Update the AuthContext user state
      setUser(user);

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">CMRP</CardTitle>
            <CardDescription className="text-slate-400">
              Officer Login
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                Login
              </Button>
              <div className="text-center text-sm text-slate-400">
                <p>Don't have credentials? Contact your administrator.</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Admin Login Component
function AdminLoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = React.useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('username', formData.username);
      formDataToSend.append('password', formData.password);

      const response = await api.post('/api/officer/login', formDataToSend);

      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Update the AuthContext user state
      setUser(user);

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
        <Card className="bg-slate-800 border-slate-700 border-l-4 border-l-red-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">CMRP Admin</CardTitle>
            <CardDescription className="text-slate-400">
              Administrator Login
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="Enter admin username"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="Enter admin password"
                />
              </div>
              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
                Login as Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// Login/Register Page Component
function AuthPage({ mode = 'login' }) {
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'citizen'
  });
  const { login, register } = React.useContext(AuthContext);

  useEffect(() => {
    setIsLogin(mode === 'login');
  }, [mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = isLogin
      ? await login(formData.email, formData.password)
      : await register(formData);

    if (!success) {
      alert(isLogin ? 'Login failed' : 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">CMRP</CardTitle>
            <CardDescription>
              {isLogin ? 'Login to your account' : 'Create a new account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {isLogin ? 'Login' : 'Register'}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  asChild
                >
                  {isLogin ? (
                    <Link to="/register">Need an account? Register</Link>
                  ) : (
                    <Link to="/login">Have an account? Login</Link>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Header Component
function Header({ user, logout }) {
  return (
    <header className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 shadow-xl border-b-2 border-purple-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg border border-white/20">
              <div className="bg-white/20 p-2 rounded-lg mr-3">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">CMRP</h1>
                <p className="text-xs text-white/90 font-medium">Complaint Management & Resolution Portal</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center text-sm text-white bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg border border-white/20">
              <div className="bg-white/20 p-1.5 rounded-lg mr-2.5">
                <User className="w-4 h-4" />
              </div>
              <span className="font-semibold mr-2">{user.full_name}</span>
              <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 shadow-sm">
                {user.role}
              </Badge>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/40 backdrop-blur-md shadow-lg font-medium transition-all duration-200"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Status Badge Component
function StatusBadge({ status }) {
  const norm = (status || '').toUpperCase();
  const statusConfig = {
    PENDING: { icon: AlertCircle, color: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm', text: 'Pending', border: 'border-red-300' },
    IN_PROGRESS: { icon: Clock, color: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-sm', text: 'In Progress', border: 'border-yellow-300' },
    RESOLVED: { icon: CheckCircle, color: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm', text: 'Resolved', border: 'border-green-300' },
    NO_OFFICER: { icon: User, color: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-sm', text: 'No Officer', border: 'border-purple-300' },
  };

  const config = statusConfig[norm] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${config.color} ${config.border} shadow-sm`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {config.text}
    </span>
  );
}

// Complaint Form Component
function ComplaintForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    address: '',
    pincode: ''
  });
  const [position, setPosition] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastPublicId, setLastPublicId] = useState('');

  const categories = [
    'Road & Infrastructure',
    'Water Supply',
    'Electricity',
    'Garbage Collection',
    'Street Lighting',
    'Public Safety',
    'Noise Pollution',
    'Other'
  ];

  const handleAddressFromLocation = (address) => {
    console.log('📝 Updating address field with:', address);
    setFormData({ ...formData, address: address });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const complaintData = {
      ...formData,
      latitude: position ? position[0] : null,
      longitude: position ? position[1] : null
    };

    const created = await onSubmit(complaintData, imageFile);
    if (created && created.public_id) {
      setLastPublicId(created.public_id);
    }

    setFormData({
      title: '',
      description: '',
      category: '',
      priority: 'medium',
      address: '',
      pincode: ''
    });
    setPosition(null);
    setImageFile(null);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title" className="text-slate-300">Complaint Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
          />
        </div>
        <div>
          <Label htmlFor="category" className="text-slate-300">Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {categories.map(category => (
                <SelectItem key={category} value={category} className="text-white hover:bg-slate-700">{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description" className="text-slate-300">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          required
          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority" className="text-slate-300">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="low" className="text-white hover:bg-slate-700">Low</SelectItem>
              <SelectItem value="medium" className="text-white hover:bg-slate-700">Medium</SelectItem>
              <SelectItem value="high" className="text-white hover:bg-slate-700">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="address" className="text-slate-300">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Select location on map or use current location button"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
          />
        </div>
        <div>
          <Label htmlFor="pincode" className="text-slate-300">Pincode *</Label>
          <Input
            id="pincode"
            type="text"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="Enter pincode"
            required
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
          />
        </div>
      </div>

      <LocationSelector
        position={position}
        setPosition={setPosition}
        onAddressChange={handleAddressFromLocation}
      />


      <div>
        <Label htmlFor="image" className="text-slate-300">Upload Image</Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
          className="bg-slate-700 border-slate-600 text-white file:bg-purple-600 file:text-white file:border-0 file:rounded file:px-4 file:py-2 file:mr-4"
        />
      </div>

      <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Complaint'}
      </Button>

      {lastPublicId && (
        <div className="mt-4 p-4 rounded-lg border border-purple-700 bg-purple-900/20">
          <div className="text-sm text-purple-300 mb-2">Your public complaint ID:</div>
          <div className="font-mono text-sm select-all bg-slate-800 p-2 rounded border border-slate-700 text-purple-200">{lastPublicId}</div>
          <Button type="button" variant="outline" size="sm" className="mt-3 border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white" onClick={() => navigator.clipboard.writeText(lastPublicId)}>
            Copy ID
          </Button>
        </div>
      )}
    </form>
  );
}

// Complaint Card Component
function ComplaintCard({ complaint, isAdmin = false, onUpdate, officersMap = {} }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: complaint.status,
    assigned_to: complaint.assigned_to || '',
    admin_comments: complaint.admin_comments || ''
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Use different endpoints based on user role
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const isOfficer = user.role === 'OFFICER';

      if (isOfficer) {
        // Officers use the officer endpoint
        await api.put(`/api/officer/complaints/${complaint.id}`, {
          status: updateData.status,
          admin_comments: updateData.admin_comments
        });
      } else {
        // Admin uses the regular endpoint
        await api.put(`/api/complaints/${complaint.id}`, updateData);
      }
      onUpdate && onUpdate();
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update complaint: ' + error.message);
    }
    setIsUpdating(false);
  };

  const getOfficerName = () => {
    if (!complaint.assigned_to) return 'Not assigned';
    const officer = officersMap[complaint.assigned_to];
    console.log(officer);
    return officer ? officer.full_name : complaint.assigned_to;
  };

  return (
    <Card className="mb-4 hover:shadow-2xl transition-all duration-300 border-l-4 border-l-purple-500 overflow-hidden bg-slate-800 border-slate-700">
      <CardHeader className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-b border-slate-700">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-xl font-bold text-white">{complaint.title}</CardTitle>
              <Badge variant="outline" className="text-xs bg-purple-900 text-purple-300 border-purple-700 font-mono">
                {complaint.public_id || complaint.id}
              </Badge>
            </div>
            <CardDescription className="flex items-center text-slate-300">
              <User className="w-4 h-4 mr-1.5 text-slate-400" />
              <span className="font-medium">{complaint.user_name}</span>
              <span className="mx-2 text-slate-500">•</span>
              <span className="text-sm">{complaint.user_email}</span>
            </CardDescription>
          </div>
          <div className="text-right flex-shrink-0">
            <StatusBadge status={complaint.status} />
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-end">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {new Date(complaint.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-slate-800 p-6">
        <div className="space-y-4">
          <p className="text-slate-200 leading-relaxed">{complaint.description}</p>

          <div className="flex flex-wrap gap-2">
            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm">
              {complaint.category}
            </Badge>
            <Badge variant={complaint.priority === 'high' ? 'destructive' : complaint.priority === 'medium' ? 'default' : 'secondary'} className="shadow-sm">
              {complaint.priority} priority
            </Badge>
            {complaint.latitude && complaint.longitude && (
              <Badge variant="outline" className="bg-slate-700 border-slate-600 text-slate-300">
                <MapPin className="w-3 h-3 mr-1" />
                Location Set
              </Badge>
            )}
          </div>

          {complaint.address && (
            <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-200">{complaint.address}</span>
              </div>
            </div>
          )}

          {complaint.image_url && (
            <div className="rounded-lg overflow-hidden border border-slate-700 shadow-lg">
              <img
                src={`${API_BASE_URL}${complaint.image_url}`}
                alt="Complaint evidence"
                className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}

          {complaint.admin_comments && (
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-semibold text-blue-300 mb-1 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Officer Comments
              </p>
              <p className="text-sm text-blue-200 leading-relaxed">{complaint.admin_comments}</p>
            </div>
          )}

          {complaint.workNotes && complaint.workNotes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-green-300 flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Officer Work Updates
              </h4>
              {complaint.workNotes.map((note, index) => (
                <div key={index} className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 rounded-lg border-l-4 border-green-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-300">Officer Update</span>
                    <span className="text-xs text-green-400">
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {note.note && (
                    <p className="text-sm text-green-200 leading-relaxed mb-2">{note.note}</p>
                  )}
                  {note.photoUrl && (
                    <div className="rounded-lg overflow-hidden border border-green-700 shadow-lg">
                      <img
                        src={`${API_BASE_URL}${note.photoUrl}`}
                        alt="Officer work photo"
                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert(`Contact Officer: ${getOfficerName()}`)}
              className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
            >
              <User className="w-4 h-4 mr-2" />
              Contact Officer
            </Button>

            {isAdmin && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                    <Eye className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Update Complaint</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Update the status and add comments for this complaint.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Status</Label>
                      <Select value={updateData.status} onValueChange={(value) => setUpdateData({ ...updateData, status: value })}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="PENDING" className="text-white hover:bg-slate-700">Pending</SelectItem>
                          <SelectItem value="IN_PROGRESS" className="text-white hover:bg-slate-700">In Progress</SelectItem>
                          <SelectItem value="RESOLVED" className="text-white hover:bg-slate-700">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Assigned To</Label>
                      <Input
                        value={updateData.assigned_to}
                        onChange={(e) => setUpdateData({ ...updateData, assigned_to: e.target.value })}
                        placeholder="Officer name"
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Officer Comments</Label>
                      <Textarea
                        value={updateData.admin_comments}
                        onChange={(e) => setUpdateData({ ...updateData, admin_comments: e.target.value })}
                        rows={3}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <Button onClick={handleUpdate} disabled={isUpdating} className="w-full bg-purple-600 hover:bg-purple-700">
                      {isUpdating ? 'Updating...' : 'Update Complaint'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Officer Management Component
function OfficerManagement({
  officers,
  loading,
  onCreateOfficer,
  onUpdateOfficer,
  onUpdatePassword,
  onDeactivateOfficer,
  complaints = []
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    pincodes: []
  });
  const [passwordData, setPasswordData] = useState({ new_password: '' });

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    try {
      await onCreateOfficer(formData);
      // console.log('formData', formData);
      setFormData({ username: '', password: '', full_name: '', pincodes: [] });
      setShowCreateForm(false);
    } catch (error) {
      alert('Failed to create officer: ' + error.message);
    }
  };

  const handleUpdateOfficer = async (e) => {
    e.preventDefault();
    try {
      await onUpdateOfficer(editingOfficer.id, formData);
      setEditingOfficer(null);
      setFormData({ username: '', password: '', full_name: '', pincodes: [] });
    } catch (error) {
      alert('Failed to update officer: ' + error.message);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
      await onUpdatePassword(showPasswordForm, passwordData.new_password);
      setShowPasswordForm(null);
      setPasswordData({ new_password: '' });
    } catch (error) {
      alert('Failed to update password: ' + error.message);
    }
  };

  const handleDeactivateOfficer = async (officerId) => {
    if (window.confirm('Are you sure you want to deactivate this officer?')) {
      try {
        await onDeactivateOfficer(officerId);
      } catch (error) {
        alert('Failed to deactivate officer: ' + error.message);
      }
    }
  };

  const startEdit = (officer) => {
    setEditingOfficer(officer);
    setFormData({
      username: officer.username,
      password: '',
      full_name: officer.full_name,
      pincodes: officer.pincodes || []
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading officers...</div>;
  }

  // Get pincodes that need officers
  const pincodesNeedingOfficers = [...new Set(
    complaints
      .filter(c => c.status === 'NO_OFFICER')
      .map(c => c.pincode)
      .filter(Boolean)
  )];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Officer Management</h2>
        <Button onClick={() => setShowCreateForm(true)} className="bg-purple-600 hover:bg-purple-700">
          <User className="w-4 h-4 mr-2" />
          Add New Officer
        </Button>
      </div>

      {/* Pincodes needing officers */}
      {pincodesNeedingOfficers.length > 0 && (
        <Card className="border-l-4 border-l-purple-500 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-purple-300">⚠️ Pincodes Needing Officers</CardTitle>
            <CardDescription className="text-slate-400">
              Create officers for these pincodes to handle pending complaints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pincodesNeedingOfficers.map(pincode => (
                <Badge key={pincode} variant="outline" className="bg-purple-900 text-purple-300 border-purple-700">
                  {pincode}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Officer Form */}
      {showCreateForm && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Create New Officer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOfficer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Pincodes (comma-separated)</Label>
                <Input
                  placeholder="534101, 534102, 534103"
                  value={formData.pincodes.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    pincodes: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                  })}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">Create Officer</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit Officer Form */}
      {editingOfficer && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Edit Officer: {editingOfficer.full_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateOfficer} className="space-y-4">
              <div>
                <Label className="text-slate-300">Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Pincodes (comma-separated)</Label>
                <Input
                  placeholder="534101, 534102, 534103"
                  value={formData.pincodes.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    pincodes: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                  })}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">Update Officer</Button>
                <Button type="button" variant="outline" onClick={() => setEditingOfficer(null)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Password Update Form */}
      {showPasswordForm && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Update Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <Label className="text-slate-300">New Password</Label>
                <Input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ new_password: e.target.value })}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">Update Password</Button>
                <Button type="button" variant="outline" onClick={() => setShowPasswordForm(null)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Officers List */}
      <div className="grid gap-4">
        {officers.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="text-center py-8">
              <User className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-300">No officers found</p>
            </CardContent>
          </Card>
        ) : (
          officers.map(officer => (
            <Card key={officer.id} className="hover:shadow-xl transition-all duration-300 bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{officer.full_name}</h3>
                    <p className="text-slate-400">@{officer.username}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="mr-2 bg-slate-700 text-slate-300 border-slate-600">
                        {officer.pincodes.length} Pincodes
                      </Badge>
                      <span className="text-sm text-slate-400">
                        Created: {new Date(officer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {officer.pincodes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-slate-400">Assigned Pincodes:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {officer.pincodes.map(pincode => (
                            <Badge key={pincode} variant="secondary" className="text-xs bg-purple-900 text-purple-300 border-purple-700">
                              {pincode}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(officer)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Eye className="w-4 h-4 mr-1" />
                      Edit
                    </Button> 
                    <Button size="sm" variant="outline" onClick={() => setShowPasswordForm(officer.id)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <User className="w-4 h-4 mr-1" />
                      Password
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeactivateOfficer(officer.id)} className="bg-red-600 hover:bg-red-700">
                      <XCircle className="w-4 h-4 mr-1" />
                      Deactivate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// Main Dashboard Component
function Dashboard() {
  const { user, logout } = React.useContext(AuthContext);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const normalizedRole = (user.role || '').toLowerCase();
  const [activeTab, setActiveTab] = useState(
    normalizedRole === 'admin' ? 'all-complaints' :
      normalizedRole === 'officer' ? 'officer-complaints' :
        'my-complaints'
  );
  const [officerData, setOfficerData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [officers, setOfficers] = useState([]);
  const [officerLoading, setOfficerLoading] = useState(false);

  // Create a mapping of officer IDs to officer details
  const officersMap = React.useMemo(() => {
    const map = {};
    officers.forEach(officer => {
      map[officer.id] = officer;
    });
    return map;
  }, [officers]);

  const loadComplaints = async () => {
    try {
      console.log('🔍 Loading complaints - User:', user.id, 'Role:', normalizedRole, 'ActiveTab:', activeTab);
      let response;
      if (normalizedRole === 'admin' && (activeTab === 'all-complaints' || activeTab === 'no-officer' || activeTab === 'officer-management')) {
        console.log('📋 Loading admin complaints');
        response = await api.get('/api/complaints');
      } else if (normalizedRole === 'officer') {
        // For officers, load their assigned complaints
        console.log('👮 Loading officer complaints for:', user.id);
        response = await api.get('/api/officer/complaints');
        console.log('📊 Officer complaints response:', response.data);
        setOfficerData({
          items: response.data.items || [],
          total: response.data.total || 0,
          page: response.data.page || 1,
          pageSize: response.data.pageSize || 20
        });
        // Also set complaints for the Dashboard component
        setComplaints(response.data.items || []);
        return;
      } else {
        console.log('👤 Loading citizen complaints');
        response = await api.get('/api/complaints/my');
      }
      setComplaints(response.data);
    } catch (error) {
      console.error('❌ Error loading complaints:', error);
    }
  };

  const loadStats = async () => {
    if (normalizedRole === 'admin') {
      try {
        const response = await api.get('/api/dashboard/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
  };

  const loadOfficerComplaints = async (page = 1) => {
    if (normalizedRole !== 'officer') {
      console.log('❌ Not an officer, skipping loadOfficerComplaints');
      return;
    }
    try {
      console.log('👮 Loading officer complaints for page:', page);
      const res = await api.get('/api/officer/complaints');
      console.log('📊 Officer complaints response:', res.data);
      // Convert the response to match the expected format
      setOfficerData({
        items: res.data.items || [],
        page: res.data.page || 1,
        pageSize: res.data.pageSize || 20,
        total: res.data.total || 0
      });
    } catch (e) {
      console.error('❌ Error loading officer complaints', e);
    }
  };

  // Officer Management Functions
  const loadOfficers = async () => {
    try {
      setOfficerLoading(true);
      const response = await api.get('/api/admin/officers');
      setOfficers(response.data);
    } catch (error) {
      console.error('Error loading officers:', error);
      // If it's a 403 error (forbidden), try the public endpoint
      if (error.response?.status === 403) {
        try {
          const response = await api.get('/api/officers');
          setOfficers(response.data);
        } catch (publicError) {
          console.error('Error loading officers from public endpoint:', publicError);
          if (normalizedRole === 'admin') {
            alert('Failed to load officers: ' + publicError.message);
          }
        }
      } else if (normalizedRole === 'admin') {
        alert('Failed to load officers: ' + error.message);
      }
    } finally {
      setOfficerLoading(false);
    }
  };

  const createOfficer = async (officerData) => {
    try {
      const response = await api.post('/api/admin/officers', officerData);
      setOfficers([...officers, response.data]);

      // Reload complaints to reflect the automatic assignment
      if (normalizedRole === 'admin') {
        await loadComplaints();
      }

      return response.data;
    } catch (error) {
      console.error('Error creating officer:', error);
      throw error;
    }
  };

  const updateOfficer = async (officerId, updateData) => {
    try {
      const response = await api.put(`/api/admin/officers/${officerId}`, updateData);
      setOfficers(officers.map(o => o.id === officerId ? response.data : o));
      return response.data;
    } catch (error) {
      console.error('Error updating officer:', error);
      throw error;
    }
  };

  const updateOfficerPassword = async (officerId, newPassword) => {
    try {
      await api.put(`/api/admin/officers/${officerId}/password`, { new_password: newPassword });
      alert('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };

  const deactivateOfficer = async (officerId) => {
    try {
      await api.delete(`/api/admin/officers/${officerId}`);
      setOfficers(officers.filter(o => o.id !== officerId));
      alert('Officer deactivated successfully');
    } catch (error) {
      console.error('Error deactivating officer:', error);
      throw error;
    }
  };


  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      console.log('🔄 Loading data - User:', user.id, 'Role:', normalizedRole);

      if (normalizedRole === 'officer') {
        // For officers, only load officer complaints
        await loadOfficerComplaints(1);
      } else {
        // For admin and citizens, load regular complaints and stats
        await Promise.all([
          loadComplaints(),
          loadStats(),
        ]);
      }
      setLoading(false);
    };

    loadData();
  }, [activeTab, normalizedRole, user.id]);

  // Load officers for all users so they can see officer names
  useEffect(() => {
    if (officers.length === 0) {
      loadOfficers();
    }
  }, []);

  const handleComplaintSubmit = async (complaintData, imageFile) => {
    try {
      const response = await api.post('/api/complaints', complaintData);

      if (imageFile && response.data.id) {
        const formData = new FormData();
        formData.append('file', imageFile);
        await api.post(`/api/complaints/${response.data.id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      loadComplaints();
      alert('Complaint submitted successfully! Copy your ID shown below.');
      return response.data;
    } catch (error) {
      console.error('Error submitting complaint:', error);
      alert('Error submitting complaint. Please try again.');
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={user} logout={logout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header user={user} logout={logout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {normalizedRole === 'admin' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                  <div className="bg-white/20 p-2 rounded-lg mr-2">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  Total Complaints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white mb-1">{stats.total_complaints}</div>
                <p className="text-xs text-white/80 font-medium">All time</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                  <div className="bg-white/20 p-2 rounded-lg mr-2">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  Open
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white mb-1">{stats.open_complaints}</div>
                <p className="text-xs text-white/80 font-medium">Pending review</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                  <div className="bg-white/20 p-2 rounded-lg mr-2">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white mb-1">{stats.in_progress_complaints}</div>
                <p className="text-xs text-white/80 font-medium">Being handled</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                  <div className="bg-white/20 p-2 rounded-lg mr-2">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  Resolved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white mb-1">{stats.resolved_complaints}</div>
                <p className="text-xs text-white/80 font-medium">Completed</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-slate-800 p-1.5 rounded-xl shadow-inner border border-slate-700">
            {normalizedRole === 'citizen' && (
              <>
                <TabsTrigger value="my-complaints" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  My Complaints
                </TabsTrigger>
                <TabsTrigger value="new-complaint" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  New Complaint
                </TabsTrigger>
              </>
            )}
            {normalizedRole === 'admin' && (
              <>
                <TabsTrigger value="all-complaints" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  All Complaints
                </TabsTrigger>
                <TabsTrigger value="no-officer" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  No Officer Assigned
                </TabsTrigger>
                <TabsTrigger value="officer-management" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  Officer Management
                </TabsTrigger>
              </>
            )}
            {normalizedRole === 'officer' && (
              <>
                <TabsTrigger value="officer-complaints" className="rounded-lg font-semibold text-slate-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:text-white">
                  My Assigned Complaints
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="my-complaints">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText className="w-6 h-6 mr-2 text-purple-400" />
                My Complaints
              </h2>
              {complaints.length === 0 ? (
                <Card className="border-2 border-dashed border-slate-700 bg-slate-800">
                  <CardContent className="text-center py-12">
                    <div className="bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">No complaints yet</h3>
                    <p className="text-slate-400">Start by submitting your first complaint</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map(complaint => (
                  <ComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    isAdmin={normalizedRole === 'admin'}
                    onUpdate={loadComplaints}
                    officersMap={officersMap}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all-complaints">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-purple-400" />
                All Complaints
              </h2>
              {complaints.length === 0 ? (
                <Card className="border-2 border-dashed border-slate-700 bg-slate-800">
                  <CardContent className="text-center py-12">
                    <div className="bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">No complaints found</h3>
                    <p className="text-slate-400">Complaints will appear here when submitted</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map(complaint => (
                  <ComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    isAdmin={true}
                    onUpdate={loadComplaints}
                    officersMap={officersMap}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="no-officer">
            <div className="space-y-4">
              <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                <h2 className="text-xl font-semibold text-purple-300 mb-2">⚠️ Complaints Needing Officer Assignment</h2>
                <p className="text-purple-200">
                  These complaints have pincodes that don't have assigned officers. Create officers for these pincodes in the Officer Management tab.
                </p>
              </div>

              {(() => {
                const noOfficerComplaints = complaints.filter(c => c.status === 'NO_OFFICER');
                console.log('🔍 All complaints:', complaints);
                console.log('🔍 No officer complaints:', noOfficerComplaints);
                return noOfficerComplaints.length === 0;
              })() ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                    <p className="text-slate-300">All complaints have officers assigned!</p>
                  </CardContent>
                </Card>
              ) : (
                complaints
                  .filter(c => c.status === 'NO_OFFICER')
                  .map(complaint => {
                    console.log('🔍 Rendering no-officer complaint:', complaint);
                    return (
                      <Card key={complaint.id} className="border-l-4 border-l-purple-500 bg-slate-800 border-slate-700">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{complaint.title}</h3>
                              <p className="text-slate-300 mt-1">{complaint.description}</p>
                              <div className="mt-2 flex items-center gap-4">
                                <Badge variant="outline" className="bg-purple-900 text-purple-300 border-purple-700">
                                  Pincode: {complaint.pincode}
                                </Badge>
                                <span className="text-sm text-slate-400">
                                  Created: {new Date(complaint.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <StatusBadge status={complaint.status} />
                              <p className="text-sm text-purple-300 mt-2">
                                Create officer for pincode: <strong>{complaint.pincode}</strong>
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </div>
          </TabsContent>

          <TabsContent value="officer-management">
            <OfficerManagement
              officers={officers}
              loading={officerLoading}
              onCreateOfficer={createOfficer}
              onUpdateOfficer={updateOfficer}
              onUpdatePassword={updateOfficerPassword}
              onDeactivateOfficer={deactivateOfficer}
              complaints={complaints}
            />
          </TabsContent>

          <TabsContent value="new-complaint">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Submit New Complaint</CardTitle>
                <CardDescription className="text-slate-400">
                  Fill out the form below to submit a new complaint. All required fields must be completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComplaintForm onSubmit={handleComplaintSubmit} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="officer-complaints">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <User className="w-6 h-6 mr-2 text-purple-400" />
                My Assigned Complaints
              </h2>

              {/* Officer Stats */}
              {officerData.items.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                        <div className="bg-white/20 p-2 rounded-lg mr-2">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        Total Assigned
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-white mb-1">{officerData.total}</div>
                      <p className="text-xs text-white/80 font-medium">Your workload</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                        <div className="bg-white/20 p-2 rounded-lg mr-2">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        Pending
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-white mb-1">
                        {officerData.items.filter(c => c.status === 'PENDING').length}
                      </div>
                      <p className="text-xs text-white/80 font-medium">Need attention</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                        <div className="bg-white/20 p-2 rounded-lg mr-2">
                          <Activity className="w-4 h-4 text-white" />
                        </div>
                        In Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-white mb-1">
                        {officerData.items.filter(c => c.status === 'IN_PROGRESS').length}
                      </div>
                      <p className="text-xs text-white/80 font-medium">Being handled</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 hover:shadow-2xl hover:scale-105 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-white/90 flex items-center">
                        <div className="bg-white/20 p-2 rounded-lg mr-2">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        Resolved
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-white mb-1">
                        {officerData.items.filter(c => c.status === 'RESOLVED').length}
                      </div>
                      <p className="text-xs text-white/80 font-medium">Completed</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {officerData.items.length === 0 ? (
                <Card className="border-2 border-dashed border-slate-700 bg-slate-800">
                  <CardContent className="text-center py-12">
                    <div className="bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">No complaints assigned</h3>
                    <p className="text-slate-400">You'll see complaints here when they're assigned to you</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {officerData.items.map((complaint) => (
                    <ComplaintCard
                      key={complaint.id}
                      complaint={complaint}
                      isAdmin={true}
                      onUpdate={() => loadOfficerComplaints(officerData.page)}
                      officersMap={officersMap}
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={officerData.page <= 1} onClick={() => loadOfficerComplaints(officerData.page - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={(officerData.page * officerData.pageSize) >= officerData.total} onClick={() => loadOfficerComplaints(officerData.page + 1)}>Next</Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>


        </Tabs>
      </main>
    </div>
  );
}

// Main App Component with Updated Routing
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AuthContext.Consumer>
            {({ user, loading }) => {
              if (loading) {
                return (
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin text-4xl mb-4">⚡</div>
                      <p>Loading CMRP...</p>
                    </div>
                  </div>
                );
              }

              return (
                <Routes>
                  <Route
                    path="/"
                    element={user ? <Navigate to="/dashboard" /> : <HomePage />}
                  />
                  <Route
                    path="/login"
                    element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="login" />}
                  />
                  <Route
                    path="/register"
                    element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="register" />}
                  />
                  <Route
                    path="/track/:id"
                    element={<TrackingPage />}
                  />
                  <Route
                    path="/officer"
                    element={user ? <Navigate to="/dashboard" /> : <OfficerLoginPage />}
                  />
                  <Route
                    path="/admin"
                    element={user ? <Navigate to="/dashboard" /> : <AdminLoginPage />}
                  />
                  <Route
                    path="/dashboard"
                    element={user ? <Dashboard /> : <Navigate to="/login" />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to={user ? "/dashboard" : "/"} />}
                  />
                </Routes>
              );
            }}
          </AuthContext.Consumer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;