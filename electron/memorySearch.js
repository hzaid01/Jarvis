// ============================================================
// Memory Search — Keyword extraction & relevance scoring
// ============================================================

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'like',
  'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among', 'and', 'but', 'or',
  'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'mine', 'we', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him',
  'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their',
  'theirs', 'myself', 'yourself', 'himself', 'herself', 'itself',
  'ourselves', 'yourselves', 'themselves', 'up', 'down', 'then',
  'here', 'there', 'now', 'also', 'well', 'hey', 'jarvis', 'sir',
  'please', 'thanks', 'thank', 'okay', 'ok', 'yes', 'no', 'yeah',
  'sure', 'right', 'let', 'get', 'got', 'go', 'going', 'went',
  'come', 'came', 'make', 'made', 'take', 'took', 'give', 'gave',
  'tell', 'told', 'say', 'said', 'know', 'knew', 'think', 'thought',
  'see', 'saw', 'want', 'need', 'use', 'used', 'try', 'tried',
]);

/**
 * Extract meaningful keywords from text.
 * Removes stop words, short words, and normalizes.
 */
function extractKeywords(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars
    .split(/\s+/)                    // Split on whitespace
    .filter(word =>
      word.length > 2 &&             // Skip short words
      !STOP_WORDS.has(word) &&       // Skip stop words
      !/^\d+$/.test(word)            // Skip pure numbers (but keep mixed)
    )
    .filter((word, idx, arr) => arr.indexOf(word) === idx); // Deduplicate
}

/**
 * Score how relevant an observation is to a set of keywords.
 * Higher score = more relevant.
 */
function scoreRelevance(observation, keywords) {
  if (!observation || !keywords || keywords.length === 0) return 0;

  let score = 0;
  const obsKeywords = (observation.keywords || '').toLowerCase();
  const obsContent = (observation.content || '').toLowerCase();

  for (const keyword of keywords) {
    // Exact keyword match in keywords field (strongest signal)
    if (obsKeywords.includes(keyword)) {
      score += 3;
    }
    // Content match
    if (obsContent.includes(keyword)) {
      score += 1;
    }
  }

  // Boost recent observations (recency bias)
  // More recent observations have higher IDs
  if (observation.id) {
    score += Math.min(observation.id / 1000, 1); // Small recency boost
  }

  // Boost certain observation types
  const typeBoosts = {
    'user_info': 2,
    'preference': 1.5,
    'task': 1,
    'decision': 1.5,
    'emotion': 0.5,
    'topic': 0.5,
  };
  score += typeBoosts[observation.type] || 0;

  return score;
}

/**
 * Rank observations by relevance and return top N.
 */
function rankObservations(observations, keywords, limit = 5) {
  if (!observations || observations.length === 0) return [];

  return observations
    .map(obs => ({ ...obs, _score: scoreRelevance(obs, keywords) }))
    .filter(obs => obs._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...obs }) => obs); // Remove internal score
}

module.exports = {
  extractKeywords,
  scoreRelevance,
  rankObservations,
};
