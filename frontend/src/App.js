import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
import { AlertTriangle, MapPin, User, Phone, Mail, FileText, Calendar, Eye, Upload, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

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
    
    // Change button text to show loading
    const button = e.target;
    const originalText = button.textContent;
    button.textContent = 'Getting location...';
    button.disabled = true;
    
    const resetButton = () => {
      button.textContent = originalText;
      button.disabled = false;
    };
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser. Please select your location manually on the map.');
      resetButton();
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          console.log('✅ Geolocation success:', { lat, lng });
          
          setPosition([lat, lng]);
          
          // Get address for current location with better error handling
          console.log('🔍 Fetching address for coordinates:', lat, lng);
          await getAddressFromCoordinates(lat, lng);
          
          resetButton();
        } catch (error) {
          console.error('❌ Error processing location:', error);
          alert('Got your location but failed to get address. Please check manually.');
          resetButton();
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
        resetButton();
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
        <Label>Select Location</Label>
        <Button 
          type="button" 
          onClick={getCurrentLocation} 
          variant="outline" 
          size="sm"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Use Current Location
        </Button>
      </div>
      <div className="h-64 w-full rounded-lg overflow-hidden border">
        <MapContainer 
          center={position || [28.6139, 77.2088]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LocationMarker />
        </MapContainer>
      </div>
      {position && (
        <p className="text-sm text-gray-600">
          Selected: {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </p>
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
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Login Component
function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'citizen'
  });
  const { login, register } = React.useContext(AuthContext);

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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">CMRP</CardTitle>
          <CardDescription>Complaint Management & Resolution Portal</CardDescription>
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
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="citizen">Citizen</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
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
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Header Component
function Header({ user, logout }) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-purple-600 mr-3" />
            <h1 className="text-xl font-bold text-gray-900">CMRP</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-700">
              <User className="w-4 h-4 mr-2" />
              {user.full_name}
              <Badge variant="outline" className="ml-2">{user.role}</Badge>
            </div>
            <Button onClick={logout} variant="outline" size="sm">
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
  const statusConfig = {
    open: { icon: AlertCircle, color: 'bg-red-100 text-red-800', text: 'Open' },
    in_progress: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', text: 'In Progress' },
    resolved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', text: 'Resolved' },
    closed: { icon: XCircle, color: 'bg-gray-100 text-gray-800', text: 'Closed' }
  };

  const config = statusConfig[status] || statusConfig.open;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3 mr-1" />
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
    address: ''
  });
  const [position, setPosition] = useState(null);
  const [imageFile, setImageFile] = useState(null);

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
    setFormData({...formData, address: address});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const complaintData = {
      ...formData,
      latitude: position ? position[0] : null,
      longitude: position ? position[1] : null
    };
    
    await onSubmit(complaintData, imageFile);
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      category: '',
      priority: 'medium',
      address: ''
    });
    setPosition(null);
    setImageFile(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Complaint Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="category">Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="Select location on map or use current location button"
          />
        </div>
      </div>

      <LocationSelector 
        position={position} 
        setPosition={setPosition}
        onAddressChange={handleAddressFromLocation}
      />

      <div>
        <Label htmlFor="image">Upload Image</Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Complaint
      </Button>
    </form>
  );
}

// Complaint Card Component
function ComplaintCard({ complaint, isAdmin = false, onUpdate }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: complaint.status,
    assigned_to: complaint.assigned_to || '',
    admin_comments: complaint.admin_comments || ''
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await api.put(`/api/complaints/${complaint.id}`, updateData);
      onUpdate && onUpdate();
    } catch (error) {
      console.error('Update error:', error);
    }
    setIsUpdating(false);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{complaint.title}</CardTitle>
            <CardDescription className="flex items-center mt-2">
              <User className="w-4 h-4 mr-1" />
              {complaint.user_name} • {complaint.user_email}
            </CardDescription>
          </div>
          <div className="text-right">
            <StatusBadge status={complaint.status} />
            <div className="text-sm text-gray-500 mt-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              {new Date(complaint.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-700">{complaint.description}</p>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{complaint.category}</Badge>
            <Badge variant={complaint.priority === 'high' ? 'destructive' : 'outline'}>
              {complaint.priority} priority
            </Badge>
            {complaint.latitude && complaint.longitude && (
              <Badge variant="outline">
                <MapPin className="w-3 h-3 mr-1" />
                Location: {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
              </Badge>
            )}
          </div>

          {complaint.address && (
            <p className="text-sm text-gray-600">
              <MapPin className="w-4 h-4 inline mr-1" />
              {complaint.address}
            </p>
          )}

          {complaint.image_url && (
            <div>
              <img 
                src={`${API_BASE_URL}${complaint.image_url}`} 
                alt="Complaint" 
                className="max-w-full h-48 object-cover rounded-lg border"
              />
            </div>
          )}

          {complaint.admin_comments && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Admin Comments:</p>
              <p className="text-sm text-blue-800">{complaint.admin_comments}</p>
            </div>
          )}

          {isAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Update Complaint</DialogTitle>
                  <DialogDescription>
                    Update the status and add comments for this complaint.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={updateData.status} onValueChange={(value) => setUpdateData({...updateData, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <Input
                      value={updateData.assigned_to}
                      onChange={(e) => setUpdateData({...updateData, assigned_to: e.target.value})}
                      placeholder="Officer name"
                    />
                  </div>
                  <div>
                    <Label>Admin Comments</Label>
                    <Textarea
                      value={updateData.admin_comments}
                      onChange={(e) => setUpdateData({...updateData, admin_comments: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
                    {isUpdating ? 'Updating...' : 'Update Complaint'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
function Dashboard() {
  const { user, logout } = React.useContext(AuthContext);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(user.role === 'admin' ? 'all-complaints' : 'my-complaints');

  const loadComplaints = async () => {
    try {
      let response;
      if (user.role === 'admin' && activeTab === 'all-complaints') {
        response = await api.get('/api/complaints');
      } else {
        response = await api.get('/api/complaints/my');
      }
      setComplaints(response.data);
    } catch (error) {
      console.error('Error loading complaints:', error);
    }
  };

  const loadStats = async () => {
    if (user.role === 'admin') {
      try {
        const response = await api.get('/api/dashboard/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadComplaints(), loadStats()]);
      setLoading(false);
    };
    
    loadData();
  }, [activeTab, user.role]);

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
      alert('Complaint submitted successfully!');
    } catch (error) {
      console.error('Error submitting complaint:', error);
      alert('Error submitting complaint. Please try again.');
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
    <div className="min-h-screen bg-gray-50">
      <Header user={user} logout={logout} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === 'admin' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_complaints}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Open</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.open_complaints}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.in_progress_complaints}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.resolved_complaints}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {user.role === 'citizen' && (
              <>
                <TabsTrigger value="my-complaints">My Complaints</TabsTrigger>
                <TabsTrigger value="new-complaint">New Complaint</TabsTrigger>
              </>
            )}
            {user.role === 'admin' && (
              <>
                <TabsTrigger value="all-complaints">All Complaints</TabsTrigger>
                <TabsTrigger value="my-complaints">My Assigned</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="my-complaints">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                {user.role === 'admin' ? 'All Complaints' : 'My Complaints'}
              </h2>
              {complaints.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No complaints found</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map(complaint => (
                  <ComplaintCard 
                    key={complaint.id} 
                    complaint={complaint} 
                    isAdmin={user.role === 'admin'}
                    onUpdate={loadComplaints}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all-complaints">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">All Complaints</h2>
              {complaints.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No complaints found</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map(complaint => (
                  <ComplaintCard 
                    key={complaint.id} 
                    complaint={complaint} 
                    isAdmin={true}
                    onUpdate={loadComplaints}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="new-complaint">
            <Card>
              <CardHeader>
                <CardTitle>Submit New Complaint</CardTitle>
                <CardDescription>
                  Fill out the form below to submit a new complaint. All required fields must be completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComplaintForm onSubmit={handleComplaintSubmit} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Main App Component
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
                    path="/login" 
                    element={user ? <Navigate to="/dashboard" /> : <LoginPage />} 
                  />
                  <Route 
                    path="/dashboard" 
                    element={user ? <Dashboard /> : <Navigate to="/login" />} 
                  />
                  <Route 
                    path="/" 
                    element={<Navigate to={user ? "/dashboard" : "/login"} />} 
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