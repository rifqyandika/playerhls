const icefileService = require('../services/icefileService');
const cache = require('../services/cacheService');
const { encrypt } = require('../utils/encrypt');

const CACHE_KEY_PREFIX = 'icefile_play_';

const getMedia = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const cacheKey = `${CACHE_KEY_PREFIX}${fileId}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      const encryptedId = encrypt(fileId);
      return res.status(200).json({
        success: true,
        play_url: `${baseUrl}/api/v1/play/${encodeURIComponent(encryptedId)}`,
        from_cache: true,
      });
    }

    const raw = await icefileService.getMediaByFileId(fileId);

    const hlsList = Array.isArray(raw.encoded?.hls) && raw.encoded.hls.length > 0
      ? raw.encoded.hls
      : [];

    if (hlsList.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Tidak ada kualitas HLS tersedia untuk file ini' },
      });
    }

    cache.set(cacheKey, raw);

    const encryptedId = encrypt(fileId);
    return res.status(200).json({
      success: true,
      play_url: `${baseUrl}/api/v1/play/${encodeURIComponent(encryptedId)}`,
      from_cache: false,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMedia };
