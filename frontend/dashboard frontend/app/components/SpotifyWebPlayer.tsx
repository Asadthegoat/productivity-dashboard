"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

const BASE_URL = "https://productivity-dashboard-218x.onrender.com";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

interface WebPlaybackSDKProps {
  userId: number;
  trackToPlay?: {
    id: string;
    uri: string;
    name: string;
    artists: string[];
  } | null;
  onPlayerReady?: (deviceId: string) => void;
  onPlaybackStart?: () => void;
  onPlaybackPause?: () => void;
}

interface PlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        images: Array<{ url: string }>;
      };
      uri: string;
    };
  };
}

export default function SpotifyWebPlayer({ 
  userId, 
  trackToPlay, 
  onPlayerReady,
  onPlaybackStart,
  onPlaybackPause
}: WebPlaybackSDKProps) {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [volume, setVolume] = useState<number>(0.5);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  
  const playerRef = useRef<any>(null);
  const positionUpdateInterval = useRef<NodeJS.Timeout>();

  // Load Spotify Web Playback SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer();
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
    };
  }, []);

  // Get access token
  const getAccessToken = async (): Promise<string> => {
    try {
      console.log('Fetching access token from:', `${BASE_URL}/api/spotify/token/${userId}`);
      
      const response = await fetch(`${BASE_URL}/api/spotify/token/${userId}`);
      
      console.log('Token response status:', response.status);
      console.log('Token response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Token response data:', data);
      
      if (data.success && data.access_token) {
        return data.access_token;
      } else {
        throw new Error(data.error || 'Failed to get access token');
      }
    } catch (error) {
      console.error('Error getting access token:', error);
      
      // Show user-friendly error
      if (error instanceof Error) {
        if (error.message.includes('not authenticated')) {
          console.error('User needs to authenticate with Spotify first');
        } else if (error.message.includes('<!DOCTYPE')) {
          console.error('Backend returned HTML instead of JSON - endpoint might not exist');
        }
      }
      
      throw error;
    }
  };

  // Initialize the Spotify Web Playback SDK
  const initializePlayer = async () => {
    try {
      setIsInitializing(true);
      setError('');
      
      console.log('Getting access token...');
      const token = await getAccessToken();
      setAccessToken(token);
      console.log('Access token received successfully');

      console.log('Creating Spotify Player...');
      const newPlayer = new window.Spotify.Player({
        name: 'Productivity Dashboard Player',
        getOAuthToken: (cb: (token: string) => void) => {
          console.log('Spotify SDK requesting OAuth token');
          cb(token);
        },
        volume: volume
      });

      // Error handling
      newPlayer.addListener('initialization_error', ({ message }: any) => {
        console.error('Failed to initialize:', message);
        setError(`Initialization error: ${message}`);
        setIsInitializing(false);
      });

      newPlayer.addListener('authentication_error', ({ message }: any) => {
        console.error('Failed to authenticate:', message);
        setError(`Authentication error: ${message}. Please reconnect your Spotify account.`);
        setIsInitializing(false);
      });

      newPlayer.addListener('account_error', ({ message }: any) => {
        console.error('Failed to validate Spotify account:', message);
        setError(`Account error: ${message}. Spotify Premium required for Web Playback.`);
        setIsInitializing(false);
      });

      newPlayer.addListener('playback_error', ({ message }: any) => {
        console.error('Failed to perform playback:', message);
        setError(`Playback error: ${message}`);
      });

      // Playback status updates
      newPlayer.addListener('player_state_changed', (state: PlayerState) => {
        console.log('Player state changed:', state);
        if (state) {
          setPlayerState(state);
          
          if (state.paused) {
            onPlaybackPause?.();
          } else {
            onPlaybackStart?.();
          }
        }
      });

      // Ready
      newPlayer.addListener('ready', ({ device_id }: any) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setIsInitializing(false);
        setError('');
        onPlayerReady?.(device_id);
        
        // Transfer playback to this device
        transferPlayback(device_id);
      });

      // Not Ready
      newPlayer.addListener('not_ready', ({ device_id }: any) => {
        console.log('Device ID has gone offline', device_id);
        setIsReady(false);
      });

      // Connect to the player!
      console.log('Connecting to Spotify Player...');
      const success = await newPlayer.connect();
      console.log('Player connection success:', success);
      
      if (success) {
        setPlayer(newPlayer);
        playerRef.current = newPlayer;
        
        // Start position tracking
        startPositionTracking();
      } else {
        throw new Error('Failed to connect to Spotify Player');
      }
    } catch (error) {
      console.error('Error initializing player:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize player');
      setIsInitializing(false);
    }
  };

  // Transfer playback to this device
  const transferPlayback = async (deviceId: string) => {
    try {
      await fetch(`${BASE_URL}/api/spotify/transfer-playback/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId }),
      });
      console.log('Playback transferred to web player');
    } catch (error) {
      console.error('Error transferring playback:', error);
    }
  };

  // Start position tracking
  const startPositionTracking = () => {
    positionUpdateInterval.current = setInterval(async () => {
      if (playerRef.current && isReady) {
        const state = await playerRef.current.getCurrentState();
        if (state && state.track_window?.current_track) {
          setPlayerState(state);
        }
      }
    }, 1000);
  };

  // Play a specific track
  const playTrack = async (trackUri: string) => {
    try {
      await fetch(`${BASE_URL}/api/spotify/play/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          track_uri: trackUri,
          device_id: deviceId 
        }),
      });
      console.log('Track started playing via API');
    } catch (error) {
      console.error('Error playing track via API:', error);
    }
  };

  // Toggle playback
  const togglePlayback = async () => {
    if (player && playerState) {
      if (playerState.paused) {
        await player.resume();
      } else {
        await player.pause();
      }
    }
  };

  // Skip to next track
  const skipNext = async () => {
    if (player) {
      await player.nextTrack();
    }
  };

  // Skip to previous track
  const skipPrevious = async () => {
    if (player) {
      await player.previousTrack();
    }
  };

  // Set volume
  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    if (player) {
      await player.setVolume(newVolume);
    }
  };

  // Handle track to play prop changes
  useEffect(() => {
    if (trackToPlay && isReady && deviceId) {
      playTrack(trackToPlay.uri);
    }
  }, [trackToPlay, isReady, deviceId]);

  // Format time
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="bg-red-600 text-white p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-6 h-6 bg-red-700 rounded-full flex items-center justify-center text-sm font-bold">
            !
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Spotify Web Player Error</h3>
            <p className="text-red-100 text-sm mb-3">{error}</p>
            <button
              onClick={() => {
                setError('');
                setIsInitializing(true);
                initializePlayer();
              }}
              className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady || !playerState?.track_window?.current_track) {
    return (
      <div className="bg-gradient-to-br from-green-600 to-green-800 text-white p-4 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <div>
            <span>
              {isInitializing 
                ? 'Initializing Spotify Web Player...' 
                : 'Waiting for player to be ready...'}
            </span>
            {!accessToken && isInitializing && (
              <p className="text-xs text-green-200 mt-1">Getting authentication token...</p>
            )}
            {accessToken && !isReady && (
              <p className="text-xs text-green-200 mt-1">Connecting to Spotify...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentTrack = playerState.track_window.current_track;
  const albumArt = currentTrack.album.images[0]?.url;
  const progress = playerState.duration > 0 ? (playerState.position / playerState.duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-green-600 to-green-800 text-white p-4 rounded-lg">
      <div className="flex items-start space-x-4">
        {/* Album Art */}
        {albumArt && (
          <img
            src={albumArt}
            alt={`${currentTrack.name} album art`}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Track Info */}
          <div className="mb-3">
            <h3 className="font-semibold truncate">{currentTrack.name}</h3>
            <p className="text-green-100 text-sm truncate">
              {currentTrack.artists.map(artist => artist.name).join(', ')}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>{formatTime(playerState.position)}</span>
              <span>{formatTime(playerState.duration)}</span>
            </div>
            <div className="w-full bg-green-800 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={skipPrevious}
                className="hover:scale-110 transition-transform"
                title="Previous track"
              >
                <SkipBack size={20} />
              </button>
              
              <button
                onClick={togglePlayback}
                className="bg-white text-green-600 rounded-full p-2 hover:scale-110 transition-transform"
                title={playerState.paused ? "Play" : "Pause"}
              >
                {playerState.paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              
              <button
                onClick={skipNext}
                className="hover:scale-110 transition-transform"
                title="Next track"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleVolumeChange(volume > 0 ? 0 : 0.5)}
                title={volume > 0 ? "Mute" : "Unmute"}
              >
                {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-green-800 rounded-lg appearance-none slider"
                title="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
