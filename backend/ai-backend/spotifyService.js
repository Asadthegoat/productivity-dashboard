import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

// Spotify API credentials - you'll need to add these to your .env file
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback/spotify'
});

class SpotifyService {
  constructor() {
    this.userTokens = new Map(); // In production, store this in your database
  }

  // Generate authorization URL for Spotify OAuth
  getAuthUrl(userId, forceReauth = false) {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'user-read-recently-played',
      'playlist-read-private',
      'playlist-read-collaborative',
      'streaming',
      'user-read-playback-state',
      'user-modify-playback-state'
    ];
    
    const state = `user_${userId}`; // Include user ID in state for security
    
    const authUrl = spotifyApi.createAuthorizeURL(scopes, state);
    
    // Add parameters to force account selection and logout existing session
    if (forceReauth) {
      return `${authUrl}&show_dialog=true`;
    }
    
    return authUrl;
  }

  // Handle OAuth callback and get access tokens
  async handleCallback(code, state) {
    try {
      const data = await spotifyApi.authorizationCodeGrant(code);
      const { access_token, refresh_token, expires_in } = data.body;
      
      // Extract user ID from state
      const userId = state.replace('user_', '');
      
      // Store tokens (in production, store in database)
      this.userTokens.set(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000)
      });
      
      // Set access token for this user
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);
      
      return { success: true, userId };
    } catch (error) {
      console.error('Error handling Spotify callback:', error);
      return { success: false, error: error.message };
    }
  }

  // Refresh access token when it expires
  async refreshAccessToken(userId) {
    const userToken = this.userTokens.get(userId);
    if (!userToken || !userToken.refreshToken) {
      throw new Error('No refresh token available for user');
    }

    try {
      spotifyApi.setRefreshToken(userToken.refreshToken);
      const data = await spotifyApi.refreshAccessToken();
      const { access_token, expires_in } = data.body;

      // Update stored tokens
      this.userTokens.set(userId, {
        ...userToken,
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in * 1000)
      });

      spotifyApi.setAccessToken(access_token);
      return access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  // Ensure valid access token for user
  async ensureValidToken(userId) {
    const userToken = this.userTokens.get(userId);
    if (!userToken) {
      throw new Error('User not authenticated with Spotify');
    }

    // Check if token is expired
    if (Date.now() >= userToken.expiresAt) {
      await this.refreshAccessToken(userId);
    } else {
      spotifyApi.setAccessToken(userToken.accessToken);
    }
  }

  // Get user's top tracks
  async getTopTracks(userId, timeRange = 'medium_term', limit = 20) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getMyTopTracks({
        time_range: timeRange, // short_term, medium_term, long_term
        limit: limit
      });
      return data.body.items;
    } catch (error) {
      console.error('Error getting top tracks:', error);
      throw error;
    }
  }

  // Get user's top artists
  async getTopArtists(userId, timeRange = 'medium_term', limit = 20) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getMyTopArtists({
        time_range: timeRange,
        limit: limit
      });
      return data.body.items;
    } catch (error) {
      console.error('Error getting top artists:', error);
      throw error;
    }
  }

  // Get recently played tracks
  async getRecentlyPlayed(userId, limit = 50) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getMyRecentlyPlayedTracks({
        limit: limit
      });
      return data.body.items;
    } catch (error) {
      console.error('Error getting recently played tracks:', error);
      throw error;
    }
  }

  // Get audio features for tracks
  async getAudioFeatures(userId, trackIds) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getAudioFeaturesForTracks(trackIds);
      return data.body.audio_features;
    } catch (error) {
      console.error('Error getting audio features:', error);
      throw error;
    }
  }

  // Your custom algorithm to select song of the day
  async getSongOfTheDay(userId) {
    try {
      // Get user's music data
      const [topTracks, recentlyPlayed, topArtists] = await Promise.all([
        this.getTopTracks(userId, 'medium_term', 50),
        this.getRecentlyPlayed(userId, 50),
        this.getTopArtists(userId, 'medium_term', 20)
      ]);

      // Your custom algorithm here
      const songOfTheDay = await this.selectSongAlgorithm({
        topTracks,
        recentlyPlayed,
        topArtists
      });

      return songOfTheDay;
    } catch (error) {
      console.error('Error getting song of the day:', error);
      throw error;
    }
  }

  // Custom algorithm to select the perfect song
  async selectSongAlgorithm({ topTracks, recentlyPlayed, topArtists }) {
    // Example algorithm - you can customize this logic
    const now = new Date();
    const hour = now.getHours();
    
    // Get recently played track IDs to avoid immediate repeats
    const recentTrackIds = recentlyPlayed.map(item => item.track.id);
    
    // Filter out recently played tracks from top tracks
    const availableTracks = topTracks.filter(track => 
      !recentTrackIds.includes(track.id)
    );
    
    if (availableTracks.length === 0) {
      // If all top tracks were recently played, just use top tracks
      availableTracks.push(...topTracks);
    }

    // Time-based selection
    let selectedTrack;
    
    if (hour >= 6 && hour < 12) {
      // Morning: energetic songs
      selectedTrack = this.selectByEnergy(availableTracks, 'high');
    } else if (hour >= 12 && hour < 18) {
      // Afternoon: balanced
      selectedTrack = this.selectByEnergy(availableTracks, 'medium');
    } else {
      // Evening/Night: chill songs
      selectedTrack = this.selectByEnergy(availableTracks, 'low');
    }

    return selectedTrack || availableTracks[0]; // Fallback to first available track
  }

  // Helper method to select by energy level
  selectByEnergy(tracks, energyLevel) {
    // This is a simplified version - you'd typically get audio features
    // and filter by actual energy/valence values
    
    // For now, just return a random track from the available ones
    const randomIndex = Math.floor(Math.random() * tracks.length);
    return tracks[randomIndex];
  }

  // Get track preview URL and other playback info
  async getTrackPlaybackInfo(userId, trackId) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getTrack(trackId);
      return {
        name: data.body.name,
        artists: data.body.artists.map(artist => artist.name),
        album: data.body.album.name,
        preview_url: data.body.preview_url,
        external_urls: data.body.external_urls,
        images: data.body.album.images,
        duration_ms: data.body.duration_ms
      };
    } catch (error) {
      console.error('Error getting track playback info:', error);
      throw error;
    }
  }

  // Check if user has Spotify Premium (required for full playback)
  async checkUserPremium(userId) {
    await this.ensureValidToken(userId);
    
    try {
      const data = await spotifyApi.getMe();
      return data.body.product === 'premium';
    } catch (error) {
      console.error('Error checking user premium status:', error);
      return false;
    }
  }

  // Disconnect user from Spotify (remove stored tokens)
  disconnectUser(userId) {
    try {
      // Remove tokens from memory
      const hadTokens = this.userTokens.has(userId);
      this.userTokens.delete(userId);
      
      // In production, you would also delete from database:
      // await pool.query('DELETE FROM spotify_tokens WHERE user_id = $1', [userId]);
      
      console.log(`User ${userId} disconnected from Spotify`);
      return { success: true, hadTokens };
    } catch (error) {
      console.error('Error disconnecting user:', error);
      throw error;
    }
  }

  // Get user authentication status
  isUserAuthenticated(userId) {
    return this.userTokens.has(userId);
  }
}

export default new SpotifyService();
