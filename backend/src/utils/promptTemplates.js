/**
 * Prompt Templates for AI Generation
 * Each template takes parameters and returns a fully-formed prompt string.
 */

const PROMPTS = {
  /**
   * User Story Generator
   * @param {string} requirement - Raw requirement text
   * @returns {string} prompt
   */
  userStory: (requirement) => `
You are a senior product manager and agile expert. Given the following software requirement, generate a structured list of user stories.

**Requirement:**
${requirement}

**Output Instructions:**
Return a JSON array (and ONLY the JSON array, no markdown) of user story objects with this exact schema:
[
  {
    "id": "US-001",
    "title": "Short title of the story",
    "asA": "role/persona",
    "iWant": "action or feature",
    "soThat": "benefit or goal",
    "priority": "High|Medium|Low",
    "storyPoints": 3,
    "acceptanceCriteria": [
      "Given [context], When [action], Then [expected result]",
      "..."
    ],
    "tags": ["authentication", "ui"]
  }
]

Generate between 3 and 8 user stories. Be specific and actionable.
`,

  /**
   * Website Feature Extractor (mock-capable)
   * @param {string} url - Website URL
   * @param {object} pageData - Explored page data
   * @returns {string} prompt
   */
  websiteFeatures: (url, pageData) => `
You are a QA architect analyzing a website. Based on the following crawled page data from ${url}, identify testable features, user flows, and potential issues.

**Crawled Data:**
${JSON.stringify(pageData, null, 2)}

**Output Instructions:**
Return a JSON object (and ONLY JSON, no markdown) with this schema:
{
  "url": "${url}",
  "title": "Website title",
  "pages": [
    {
      "url": "page url",
      "title": "page title",
      "features": ["feature 1", "feature 2"],
      "forms": ["login form", "search form"],
      "navigationLinks": ["link 1", "link 2"]
    }
  ],
  "technologies": ["React", "Tailwind", ...],
  "accessibilityIssues": ["Missing alt tags on X images", ...],
  "testableAreas": ["Login flow", "Search functionality", ...]
}
`,

  /**
   * Test Case Generator
   * @param {Array} userStories - Array of user story objects
   * @param {object} siteFeatures - Site exploration results
   * @returns {string} prompt
   */
  testCases: (userStories, siteFeatures) => `
You are a senior QA engineer. Generate comprehensive test cases based on the following user stories and website features.

**User Stories:**
${JSON.stringify(userStories, null, 2)}

**Website Features:**
${JSON.stringify(siteFeatures, null, 2)}

**Output Instructions:**
Return a JSON array (and ONLY JSON) with this schema:
[
  {
    "id": "TC-001",
    "storyId": "US-001",
    "title": "Verify login with valid credentials",
    "type": "Positive|Negative|Boundary|Edge Case",
    "priority": "High|Medium|Low",
    "steps": [
      { "step": 1, "action": "Navigate to /login", "selector": "#login-form" },
      { "step": 2, "action": "Enter valid email", "selector": "#email", "value": "test@example.com" }
    ],
    "expectedResult": "User is redirected to dashboard",
    "mapped": true
  }
]

Generate 5-15 test cases covering positive, negative, boundary, and edge cases.
`,

  /**
   * Combined Generator — merges story + site exploration into holistic test plan
   */
  combined: (requirement, url, storyData, siteData) => `
You are a senior QA architect. Combine the following user stories, site exploration data, and requirements to produce a holistic test strategy summary.

**Requirement:** ${requirement}
**URL:** ${url}
**User Stories:** ${JSON.stringify(storyData, null, 2)}
**Site Data:** ${JSON.stringify(siteData, null, 2)}

Summarize in plain English (2-3 paragraphs) the test coverage strategy, key risk areas, and recommended test prioritization. Keep it under 300 words.
`,
};

module.exports = PROMPTS;
