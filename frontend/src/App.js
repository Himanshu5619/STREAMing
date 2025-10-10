import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Auth Context
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            setUser(data);
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (tokenData, userData) => {
    localStorage.setItem('token', tokenData);
    setToken(tokenData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// Auth Page
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin 
      ? { username: formData.username, password: formData.password }
      : formData;

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        login(data.access_token, data.user);
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md">
        <h1 className="text-5xl font-bold text-center mb-2 bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">WatchWave</h1>
        <p className="text-center text-gray-600 mb-8 font-medium">Watch Together, Anytime</p>

        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${isLogin ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg transform scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${!isLogin ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg transform scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Layout Component
const MainLayout = ({ children, activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-8">
          <h1 className="text-3xl font-black tracking-tight">VAULT.</h1>
        </div>

        <nav className="flex-1 px-6">
          {/* Menu Section */}
          <div className="mb-8">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Menu</h2>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setActiveTab('browse')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'browse' 
                      ? 'bg-red-50 text-red-600 border-l-4 border-red-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Browse
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('watchlist')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'watchlist' 
                      ? 'bg-red-50 text-red-600 border-l-4 border-red-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Watchlist
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Coming soon
                </button>
              </li>
            </ul>
          </div>

          {/* Social Section */}
          <div className="mb-8">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Social</h2>
            <ul className="space-y-2">
              <li>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Friends
                  </div>
                  <span className="bg-gray-200 text-xs font-bold px-2 py-1 rounded-full">8</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('parties')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'parties' 
                      ? 'bg-red-50 text-red-600 border-l-4 border-red-600' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Parties
                </button>
              </li>
            </ul>
          </div>

          {/* General Section */}
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">General</h2>
            <ul className="space-y-2">
              <li>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </li>
              <li>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* Bottom Badge */}
        <div className="p-6">
          <div className="bg-gray-100 rounded-2xl p-5 text-center">
            <h3 className="font-bold text-gray-800 mb-1">Popcorn Addict</h3>
            <p className="text-xs text-gray-500 mb-3">4/20 viewing time</p>
            <div className="w-full bg-gray-300 rounded-full h-2 mb-4">
              <div className="bg-gradient-to-r from-red-600 to-pink-600 h-2 rounded-full" style={{width: '20%'}}></div>
            </div>
            <button className="bg-white hover:bg-gray-50 border border-gray-300 text-sm font-semibold py-2 px-4 rounded-lg w-full transition">
              View challenges
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="relative flex-1 max-w-md mx-8">
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-red-500 transition"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-6">
              <button className="relative text-gray-600 hover:text-gray-800 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-500">Level 12</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

// Browse Page
const BrowsePage = ({ onVideoSelect, onCreateRoom }) => {
  const [videos, setVideos] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const { token } = useAuth();

  useEffect(() => {
    fetchVideos();
    fetchWatchlist();
    fetchRooms();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API}/videos`);
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error('Error fetching videos:', err);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${API}/watchlist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API}/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const toggleWatchlist = async (videoId) => {
    const isInWatchlist = watchlist.some(v => v.id === videoId);
    const endpoint = `${API}/watchlist/${videoId}`;
    const method = isInWatchlist ? 'DELETE' : 'POST';

    try {
      await fetch(endpoint, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchWatchlist();
    } catch (err) {
      console.error('Error updating watchlist:', err);
    }
  };

  const isInWatchlist = (videoId) => watchlist.some(v => v.id === videoId);

  const featuredVideo = videos[0];

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'browse' && (
        <div>
          {/* Hero Section */}
          {featuredVideo && (
            <section className="relative h-96 rounded-3xl overflow-hidden mb-12 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-transparent">
                <img 
                  src={featuredVideo.thumbnail} 
                  alt={featuredVideo.title}
                  className="w-full h-full object-cover opacity-30"
                />
              </div>
              <div className="absolute inset-0 flex flex-col justify-end p-12">
                <div className="flex items-center gap-3 text-white text-sm mb-3">
                  <span className="font-semibold">Featured</span>
                  <span className="opacity-50">•</span>
                  <span className="opacity-75">Trending Now</span>
                </div>
                <h2 className="text-6xl font-black text-white mb-3">{featuredVideo.title}</h2>
                <p className="text-gray-300 text-sm mb-6 max-w-xl">{featuredVideo.description}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onVideoSelect(featuredVideo)}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-2 shadow-lg transition-all transform hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Watch
                  </button>
                  <button
                    onClick={() => toggleWatchlist(featuredVideo.id)}
                    className="w-14 h-14 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-xl flex items-center justify-center text-white transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Parties Section */}
          {rooms.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Parties</h3>
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div className="w-1/3 h-2 bg-gray-400 rounded-full"></div>
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
                {rooms.slice(0, 4).map((room, idx) => {
                  const colors = ['bg-gray-800', 'bg-orange-500', 'bg-cyan-500', 'bg-indigo-600'];
                  return (
                    <div key={room.id} className={`flex-shrink-0 w-60 ${colors[idx]} rounded-3xl p-6 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer`}
                      onClick={async () => {
                        const videoRes = await fetch(`${API}/videos/${room.video_id}`);
                        const video = await videoRes.json();
                        onCreateRoom(video, room.id);
                      }}
                    >
                      <div className="flex justify-center -space-x-2 mb-4">
                        <div className="w-8 h-8 bg-blue-400 rounded-full border-2 border-white"></div>
                        <div className="w-8 h-8 bg-pink-400 rounded-full border-2 border-white"></div>
                      </div>
                      <div className="w-24 h-24 mx-auto bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 text-4xl font-bold">
                        {room.name.charAt(0).toUpperCase()}
                      </div>
                      <h4 className="font-bold text-center text-lg mb-1">{room.name}</h4>
                      <p className="text-xs text-center opacity-75">Hosted by {room.host_username}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Continue Watching */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Continue watching</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {videos.slice(0, 4).map((video) => (
                <div 
                  key={video.id}
                  className="group cursor-pointer"
                  onClick={() => onVideoSelect(video)}
                >
                  <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 shadow-md hover:shadow-xl transition-all">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  </div>
                  <h4 className="font-bold text-gray-800">{video.title}</h4>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-8">My Watchlist</h2>
          {watchlist.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <p className="text-gray-500 text-lg">Your watchlist is empty. Add some videos!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {watchlist.map((video) => (
                <div key={video.id} className="group">
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-3 shadow-md hover:shadow-xl transition-all">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button
                          onClick={() => onVideoSelect(video)}
                          className="flex-1 bg-white text-gray-800 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 transition"
                        >
                          Watch
                        </button>
                        <button
                          onClick={() => toggleWatchlist(video.id)}
                          className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-800 truncate">{video.title}</h4>
                  <p className="text-sm text-gray-500">{video.category}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'parties' && (
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-8">Watch Parties</h2>
          {rooms.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 text-lg">No active watch parties. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div key={room.id} className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
                  onClick={async () => {
                    const videoRes = await fetch(`${API}/videos/${room.video_id}`);
                    const video = await videoRes.json();
                    onCreateRoom(video, room.id);
                  }}
                >
                  <div className="w-20 h-20 mx-auto bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-xl text-center mb-2 text-gray-800">{room.name}</h3>
                  <p className="text-gray-500 text-sm text-center mb-4">Hosted by {room.host_username}</p>
                  <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl transition-all">
                    Join Party
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
};

// Watch Room Component
const WatchRoom = ({ video, roomId, onBack }) => {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const { token, user } = useAuth();
  const ignoreNextEvent = useRef(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (roomId) {
      fetchRoom();
    } else {
      createRoom();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRoom = async () => {
    try {
      const res = await fetch(`${API}/rooms/${roomId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRoom(data);
      connectWebSocket(roomId);
    } catch (err) {
      console.error('Error fetching room:', err);
    }
  };

  const createRoom = async () => {
    try {
      const res = await fetch(`${API}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `${user.username}'s Watch Party - ${video.title}`,
          video_id: video.id
        })
      });
      const data = await res.json();
      setRoom(data);
      connectWebSocket(data.id);
    } catch (err) {
      console.error('Error creating room:', err);
    }
  };

  const connectWebSocket = (rId) => {
    const ws = new WebSocket(`${WS_URL}/ws/${rId}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chat':
          setMessages(prev => [...prev, {
            username: data.username,
            message: data.message
          }]);
          break;
        
        case 'video_action':
          if (videoRef.current) {
            ignoreNextEvent.current = true;
            if (data.action === 'play') {
              videoRef.current.currentTime = data.currentTime;
              videoRef.current.play();
            } else if (data.action === 'pause') {
              videoRef.current.currentTime = data.currentTime;
              videoRef.current.pause();
            } else if (data.action === 'seek') {
              videoRef.current.currentTime = data.currentTime;
            }
          }
          break;
        
        case 'user_joined':
        case 'user_left':
        case 'user_list':
          setUsers(data.users || []);
          if (data.type === 'user_joined') {
            setMessages(prev => [...prev, {
              username: 'System',
              message: `${data.username} joined the party`
            }]);
          } else if (data.type === 'user_left') {
            setMessages(prev => [...prev, {
              username: 'System',
              message: `${data.username} left the party`
            }]);
          }
          break;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendVideoAction = (action, currentTime) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'video_action',
        action,
        currentTime
      }));
    }
  };

  const handlePlay = () => {
    if (!ignoreNextEvent.current && videoRef.current) {
      sendVideoAction('play', videoRef.current.currentTime);
    }
    ignoreNextEvent.current = false;
  };

  const handlePause = () => {
    if (!ignoreNextEvent.current && videoRef.current) {
      sendVideoAction('pause', videoRef.current.currentTime);
    }
    ignoreNextEvent.current = false;
  };

  const handleSeeked = () => {
    if (!ignoreNextEvent.current && videoRef.current) {
      sendVideoAction('seek', videoRef.current.currentTime);
    }
    ignoreNextEvent.current = false;
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message: newMessage
      }));
      setNewMessage('');
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${room.id}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied! Share with friends to watch together.');
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-800 text-xl">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-red-600 hover:text-red-700 font-bold flex items-center gap-2 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Browse
          </button>
          <h1 className="text-xl font-bold text-gray-800">{room.name}</h1>
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isConnected ? '● Live' : '● Disconnected'}
            </span>
            <button
              onClick={copyRoomLink}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg"
            >
              Share Room
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-3xl overflow-hidden mb-6 shadow-2xl">
              <video
                ref={videoRef}
                src={video.video_url}
                controls
                className="w-full"
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">{video.title}</h2>
            <p className="text-gray-600 leading-relaxed">{video.description}</p>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Users */}
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="font-bold text-lg text-gray-800 mb-4">Watching ({users.length})</h3>
              <div className="space-y-3">
                {users.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-gray-700">{u.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-white rounded-2xl p-6 shadow-md flex flex-col flex-1">
              <h3 className="font-bold text-lg text-gray-800 mb-4">Chat</h3>
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-96">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded-xl ${
                    msg.username === 'System' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}>
                    <span className={`font-bold text-sm ${
                      msg.username === 'System' ? 'text-yellow-700' : 'text-red-600'
                    }`}>
                      {msg.username}
                    </span>
                    <p className="text-gray-700 text-sm mt-1">{msg.message}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:ring-2 focus:ring-red-500 border-none transition"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App
function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('browse');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId && user) {
      setSelectedRoomId(roomId);
    }
  }, [user]);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    setSelectedRoomId(null);
    setCurrentView('watch');
  };

  const handleCreateRoom = (video, existingRoomId = null) => {
    setSelectedVideo(video);
    setSelectedRoomId(existingRoomId);
    setCurrentView('watch');
  };

  const handleBack = () => {
    setCurrentView('browse');
    setSelectedVideo(null);
    setSelectedRoomId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-800 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (currentView === 'watch' && selectedVideo) {
    return <WatchRoom video={selectedVideo} roomId={selectedRoomId} onBack={handleBack} />;
  }

  return <BrowsePage onVideoSelect={handleVideoSelect} onCreateRoom={handleCreateRoom} />;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;