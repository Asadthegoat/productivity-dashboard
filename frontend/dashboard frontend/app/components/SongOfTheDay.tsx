"use client"

import { Music, Play, Pause, RotateCw, ExternalLink, Heart, User, LogOut } from "lucide-react"
import { useEffect, useState } from "react"

const BASE_URL = "https://productivity-dashboard-218x.onrender.com";
const defaultUserId = 1;

interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  duration_ms: number;
}

export default function SongOfTheDay() {
  const [song, setSong] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsMoreMusic, setNeedsMoreMusic] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    fetchSongOfTheDay();
    
    // Check URL parameters for Spotify auth result
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyAuth = urlParams.get('spotify_auth');
    
    if (spotifyAuth === 'success') {
      // Clear URL parameter and refresh auth status
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        checkAuthStatus();
        fetchSongOfTheDay();
      }, 1000);
    } else if (spotifyAuth === 'error') {
      console.error('Spotify authentication failed');
      // Clear URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Listen for WebSocket updates (song updates)
  useEffect(() => {
    if (window.socket) {
      window.socket.on('song-update', (data: any) => {
        if (data.song) {
          setSong(data.song);
        }
      });
    }
    return () => {
      if (window.socket) window.socket.off('song-update');
    };
  }, []);

  // Audio progress tracking
  useEffect(() => {
    if (audio) {
      const updateProgress = () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(progress);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audio]);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...'); // Debug log
      const response = await fetch(`${BASE_URL}/api/spotify/auth-status/${defaultUserId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Auth status response:', data); // Debug log
      setIsAuthenticated(data.authenticated);
      setBackendError(false);
      setAuthError(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
      console.log('BASE_URL being used:', BASE_URL); // Debug log
      setIsAuthenticated(false);
      setAuthError(true);
      if (error instanceof Error && error.message.includes('fetch')) {
        setBackendError(true);
      }
    }
  };

  const fetchSongOfTheDay = async () => {
    setLoading(true);
    try {
      console.log('Fetching song of the day...'); // Debug log
      const response = await fetch(`${BASE_URL}/api/spotify/song-of-the-day/${defaultUserId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Song of the day response:', data); // Debug log
      
      if (data.success) {
        setSong(data.song);
        setNeedsAuth(false);
        setNeedsMoreMusic(false);
        setBackendError(false);
        setAuthError(false);
      } else if (data.needsAuth) {
        setNeedsAuth(true);
        setNeedsMoreMusic(false);
        setBackendError(false);
        setAuthError(true);
      } else if (data.needsMoreMusic) {
        setNeedsMoreMusic(true);
        setNeedsAuth(false);
        setBackendError(false);
        setAuthError(false);
      }
    } catch (error) {
      console.error('Error fetching song of the day:', error);
      console.log('Fetch URL:', `${BASE_URL}/api/spotify/song-of-the-day/${defaultUserId}`); // Debug log
      
      if (error instanceof Error && error.message.includes('fetch')) {
        setBackendError(true);
      } else {
        setAuthError(true);
        setNeedsAuth(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyAuth = async (forceReauth = false) => {
    try {
      const url = `${BASE_URL}/api/spotify/auth/${defaultUserId}${forceReauth ? '?force_reauth=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.authUrl) {
        // If forcing reauth, first clear any existing Spotify session
        if (forceReauth) {
          // Open Spotify logout in a hidden iframe to clear session
          const logoutFrame = document.createElement('iframe');
          logoutFrame.style.display = 'none';
          logoutFrame.src = 'https://accounts.spotify.com/logout';
          document.body.appendChild(logoutFrame);
          
          // Remove iframe after a moment
          setTimeout(() => {
            document.body.removeChild(logoutFrame);
          }, 1000);
        }

        // Open Spotify auth in a popup window
        const popup = window.open(
          data.authUrl,
          'spotify-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for popup close (user completed auth)
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Wait a moment then check auth status
            setTimeout(() => {
              checkAuthStatus();
              fetchSongOfTheDay();
            }, 1000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error starting Spotify auth:', error);
    }
  };

  const togglePlay = () => {
    if (!song?.preview_url) {
      // Open in Spotify if no preview available
      if (song?.external_urls?.spotify) {
        window.open(song.external_urls.spotify, '_blank');
      }
      return;
    }

    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
    } else {
      if (!audio) {
        const newAudio = new Audio(song.preview_url);
        setAudio(newAudio);
        newAudio.play();
      } else {
        audio.play();
      }
      setIsPlaying(true);
    }
  };

  const refreshSong = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/spotify/refresh-song/${defaultUserId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setSong(data.song);
        // Stop current audio if playing
        if (audio) {
          audio.pause();
          setIsPlaying(false);
          setAudioProgress(0);
          setAudio(null);
        }
      }
    } catch (error) {
      console.error('Error refreshing song:', error);
    }
  };

  const disconnectSpotify = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/spotify/disconnect/${defaultUserId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Reset all state
        setSong(null);
        setIsAuthenticated(false);
        setNeedsAuth(true);
        if (audio) {
          audio.pause();
          setIsPlaying(false);
          setAudioProgress(0);
          setAudio(null);
        }
        
        // Immediately start reauth flow with account selection
        setTimeout(() => {
          handleSpotifyAuth(true); // Force reauth with account selection
        }, 500);
      }
    } catch (error) {
      console.error('Error disconnecting from Spotify:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show backend error state
  if (backendError) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white font-medium mb-2">Backend Not Available</h3>
          <p className="text-gray-400 text-sm mb-4">
            Unable to connect to the backend server. This could be because:
          </p>
          <ul className="text-gray-400 text-xs mb-4 text-left max-w-sm mx-auto space-y-1">
            <li>• The backend is still deploying to Render</li>
            <li>• The Render service is sleeping (free tier)</li>
            <li>• Network connectivity issues</li>
          </ul>
          <button
            onClick={() => {
              setBackendError(false);
              checkAuthStatus();
              fetchSongOfTheDay();
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
          <p className="text-xs text-gray-500 mt-3">
            Trying to connect to: {BASE_URL}
          </p>
        </div>
      </div>
    );
  }

  // Show account switching interface for auth issues
  if (authError || needsAuth || !isAuthenticated) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        
        {/* Prominent Account Switching Section */}
        <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-4 mb-4 border border-green-600">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-medium">Spotify Account Required</h3>
          </div>
          <p className="text-green-100 text-sm mb-4">
            {authError 
              ? "There was an issue with your Spotify authentication. Please connect or switch accounts."
              : "Connect your Spotify account to get personalized song recommendations."
            }
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleSpotifyAuth(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2 text-center justify-center"
            >
              <User className="w-4 h-4" />
              Switch Spotify Account
            </button>
            <button
              onClick={() => handleSpotifyAuth(false)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 text-center justify-center"
            >
              <Music className="w-4 h-4" />
              Connect Spotify
            </button>
          </div>
        </div>
        
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <div className="text-gray-400 text-xs space-y-2">
            <p>Need help switching accounts?</p>
            <ul className="space-y-1">
              <li>• Use "Switch Account" to choose a different Spotify account</li>
              <li>• Make sure the account has some music listening history</li>
              <li>• Try logging out of Spotify.com first if switching doesn't work</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (needsMoreMusic) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Music className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
          </div>
          <button
            onClick={disconnectSpotify}
            className="p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors border border-red-500"
            title="Switch to different Spotify account"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white font-medium mb-2">Need More Listening History</h3>
          <p className="text-gray-400 text-sm mb-4">
            This Spotify account doesn't have enough listening history to generate recommendations.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <div className="bg-gray-700 rounded-lg p-4 max-w-sm">
              <p className="text-gray-300 text-sm mb-3">Try one of these options:</p>
              <ul className="text-gray-400 text-xs space-y-2 text-left">
                <li>• Listen to music on Spotify first, then refresh</li>
                <li>• Switch to a different Spotify account with more history</li>
                <li>• Create some playlists and play music from them</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchSongOfTheDay}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={disconnectSpotify}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors inline-flex items-center gap-1"
              >
                <User className="w-3 h-3" />
                Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Music className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSongOfTheDay}
              className="p-2 bg-gray-700 text-white hover:bg-gray-600 rounded-lg transition-colors border border-gray-600"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={disconnectSpotify}
              className="p-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors border border-green-500"
              title="Switch Spotify account"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Prominent Account Switching Section */}
        <div className="bg-gradient-to-r from-yellow-900 to-orange-900 rounded-lg p-4 mb-4 border border-yellow-600">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white font-medium">Need Different Account?</h3>
          </div>
          <p className="text-yellow-100 text-sm mb-3">
            Current account might not have enough listening history. Try switching to an account with more Spotify activity.
          </p>
          <button
            onClick={disconnectSpotify}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2 w-full justify-center"
          >
            <User className="w-4 h-4" />
            Switch to Different Account
          </button>
        </div>
        
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white font-medium mb-2">No Songs Available</h3>
          <p className="text-gray-400 text-sm mb-4">
            {isAuthenticated 
              ? "Make sure you've listened to music on Spotify recently. Try listening to a few songs on Spotify, then come back and refresh."
              : "You may need to reconnect your Spotify account or listen to more music on Spotify first."
            }
          </p>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={fetchSongOfTheDay}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
            <p className="text-xs text-gray-500 mt-2 max-w-sm">
              If this persists: 1) Switch accounts using the yellow button above, 2) Listen to music on Spotify first, 3) Make sure you have some listening history
            </p>
          </div>
        </div>
      </div>
    );
  }

  const albumImage = song.images?.[0]?.url || song.images?.[1]?.url;

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshSong}
            className="p-2 bg-gray-700 text-white hover:bg-gray-600 rounded-lg transition-colors border border-gray-600"
            title="Get new song"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={disconnectSpotify}
            className="p-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors border border-green-500"
            title="Switch Spotify account"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
          {albumImage ? (
            <img 
              src={albumImage} 
              alt={`${song.album} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Play className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium mb-1 truncate">{song.name}</h3>
          <p className="text-gray-400 text-sm mb-2 truncate">
            {song.artists.join(', ')} • {song.album}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-600 rounded-full h-1 max-w-32">
              <div 
                className="bg-purple-500 h-1 rounded-full transition-all duration-300" 
                style={{ width: `${audioProgress}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-400">
              {song.duration_ms ? formatDuration(song.duration_ms) : '0:30'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition-colors"
            title={song.preview_url ? (isPlaying ? "Pause" : "Play preview") : "Open in Spotify"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          {song.external_urls?.spotify && (
            <button
              onClick={() => window.open(song.external_urls.spotify, '_blank')}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title="Open in Spotify"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!song.preview_url && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Preview not available - click play to open in Spotify
        </div>
      )}
    </div>
  )
}
