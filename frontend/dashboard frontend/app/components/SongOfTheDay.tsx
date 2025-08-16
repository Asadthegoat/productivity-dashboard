"use client"

import { Music, Play, Pause, RotateCw, ExternalLink, Heart, User } from "lucide-react"
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

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    fetchSongOfTheDay();
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
      const response = await fetch(`${BASE_URL}/api/spotify/auth-status/${defaultUserId}`);
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const fetchSongOfTheDay = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/spotify/song-of-the-day/${defaultUserId}`);
      const data = await response.json();
      
      if (data.success) {
        setSong(data.song);
        setNeedsAuth(false);
      } else if (data.needsAuth) {
        setNeedsAuth(true);
      }
    } catch (error) {
      console.error('Error fetching song of the day:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyAuth = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/spotify/auth/${defaultUserId}`);
      const data = await response.json();
      
      if (data.authUrl) {
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

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (needsAuth || !isAuthenticated) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white font-medium mb-2">Connect Your Spotify</h3>
          <p className="text-gray-400 text-sm mb-4">
            Connect your Spotify account to get personalized song recommendations based on your listening history.
          </p>
          <button
            onClick={handleSpotifyAuth}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <Music className="w-4 h-4" />
            Connect Spotify
          </button>
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
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm mb-4">
            No song available. Make sure you've listened to music on Spotify recently.
          </p>
          <button
            onClick={fetchSongOfTheDay}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const albumImage = song.images?.[0]?.url || song.images?.[1]?.url;

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Music className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
        <button
          onClick={refreshSong}
          className="ml-auto text-gray-400 hover:text-white transition-colors"
          title="Get new song"
        >
          <RotateCw className="w-4 h-4" />
        </button>
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
