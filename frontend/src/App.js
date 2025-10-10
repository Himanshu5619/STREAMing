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
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-red-600">WatchWave</h1>
        <p className="text-center text-gray-600 mb-8">Watch Together, Anytime</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${isLogin ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${!isLogin ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Browse Page
const BrowsePage = ({ onVideoSelect, onCreateRoom }) => {
  const [videos, setVideos] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');
  const { token, user, logout } = useAuth();

  useEffect(() => {
    fetchVideos();
    fetchWatchlist();
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-black bg-opacity-80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-red-600">WatchWave</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user?.username}</span>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-4 px-2 font-semibold border-b-2 transition ${
                activeTab === 'browse' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`py-4 px-2 font-semibold border-b-2 transition ${
                activeTab === 'watchlist' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              My Watchlist
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`py-4 px-2 font-semibold border-b-2 transition ${
                activeTab === 'rooms' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Watch Parties
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'browse' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Browse Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map(video => (
                <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden hover:transform hover:scale-105 transition">
                  <div className="relative aspect-video bg-gray-700">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2">{video.title}</h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{video.description}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onVideoSelect(video)}
                        className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold transition"
                      >
                        Watch
                      </button>
                      <button
                        onClick={() => onCreateRoom(video)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
                      >
                        Watch Party
                      </button>
                      <button
                        onClick={() => toggleWatchlist(video.id)}
                        className={`px-4 py-2 rounded-lg transition ${
                          isInWatchlist(video.id) ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {isInWatchlist(video.id) ? '★' : '☆'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">My Watchlist</h2>
            {watchlist.length === 0 ? (
              <p className="text-gray-400">Your watchlist is empty. Add some videos!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map(video => (
                  <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden hover:transform hover:scale-105 transition">
                    <div className="relative aspect-video bg-gray-700">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2">{video.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{video.description}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onVideoSelect(video)}
                          className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold transition"
                        >
                          Watch
                        </button>
                        <button
                          onClick={() => toggleWatchlist(video.id)}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition"
                        >
                          ★
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rooms' && <RoomsList onJoinRoom={onCreateRoom} />}
      </main>
    </div>
  );
};

// Rooms List Component
const RoomsList = ({ onJoinRoom }) => {
  const [rooms, setRooms] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    fetchRooms();
  }, []);

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

  const handleJoinRoom = async (room) => {
    try {
      const videoRes = await fetch(`${API}/videos/${room.video_id}`);
      const video = await videoRes.json();
      onJoinRoom(video, room.id);
    } catch (err) {
      console.error('Error joining room:', err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Active Watch Parties</h2>
      {rooms.length === 0 ? (
        <p className="text-gray-400">No active watch parties. Create one to get started!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <div key={room.id} className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-bold text-xl mb-2">{room.name}</h3>
              <p className="text-gray-400 text-sm mb-4">Hosted by {room.host_username}</p>
              <button
                onClick={() => handleJoinRoom(room)}
                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
              >
                Join Party
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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

  useEffect(() => {
    if (roomId) {
      fetchRoom();
    } else {
      createRoom();
    }
  }, []);

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
      console.log('WebSocket message:', data);

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
    alert('Room link copied to clipboard!');
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-black bg-opacity-80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-red-600 hover:text-red-700 font-semibold"
          >
            ← Back to Browse
          </button>
          <h1 className="text-xl font-bold">{room.name}</h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {isConnected ? '● Live' : '● Disconnected'}
            </span>
            <button
              onClick={copyRoomLink}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Share Room
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden mb-4">
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
            <h2 className="text-2xl font-bold mb-2">{video.title}</h2>
            <p className="text-gray-400">{video.description}</p>
          </div>

          {/* Chat & Users Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Users List */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Watching ({users.length})</h3>
              <div className="space-y-2">
                {users.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{u.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-gray-800 rounded-lg p-4 flex flex-col flex-1">
              <h3 className="font-bold mb-3">Chat</h3>
              <div className="flex-1 overflow-y-auto mb-4 space-y-2 max-h-96">
                {messages.map((msg, idx) => (
                  <div key={idx} className="text-sm">
                    <span className={`font-semibold ${
                      msg.username === 'System' ? 'text-yellow-400' : 'text-red-600'
                    }`}>
                      {msg.username}:
                    </span>{' '}
                    <span className="text-gray-300">{msg.message}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition"
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

// Main App Component
function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('browse');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  useEffect(() => {
    // Check for room ID in URL
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId && user) {
      // Will handle joining room after login
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
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