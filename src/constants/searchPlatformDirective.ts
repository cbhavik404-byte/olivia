/**
 * searchPlatformDirective.ts
 * Directive for platform search priority & transcript routing.
 * Ensures strict platform adherence:
 * - "Search on YouTube" -> YouTube search
 * - "Search on Google" -> Google search
 * - Do not confuse platforms
 * - Transcripts / video content default to YouTube unless Google is explicitly requested
 */

export const SEARCH_PLATFORM_PRIORITY_DIRECTIVE = `
## PLATFORM SEARCH PRIORITY & TRANSCRIPT DIRECTIVE (STRICT & ABSOLUTE):
- When Bhavik asks to search for anything, ALWAYS check the explicit instruction and obey the specified platform:
  1. EXPLICIT YOUTUBE SEARCH:
     * If Bhavik says "Search on YouTube", "YouTube search", "Search YouTube for [query]", "Look up on YouTube", or specifies YouTube, you MUST use YouTube search.
     * NEVER search Google or confuse the platforms.
  2. EXPLICIT GOOGLE SEARCH:
     * If Bhavik says "Search on Google", "Google search", "Search Google for [query]", "Google it", or specifies Google, you MUST use Google search.
     * NEVER search YouTube or confuse the platforms.
  3. ALWAYS PRIORITIZE THE PLATFORM REQUESTED:
     * Explicit platform instructions always take 100% priority.
  4. TRANSCRIPTS & VIDEO CONTENT (YOUTUBE PRIORITY):
     * When Bhavik asks to find a transcript (e.g., "find a transcript", "find the transcript of [video/interview/podcast]", "get transcript of [talk]", "search transcript"), recognize that video content and transcripts natively reside on YouTube.
     * Prioritize YouTube search for video transcript requests unless Bhavik explicitly specifies Google.
     * Never default video transcript queries to Google when video content is implied.
`;
