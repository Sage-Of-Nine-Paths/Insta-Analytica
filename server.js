import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { ApifyClient } from "apify-client";
import 'dotenv/config';


// Use the modern Gemini SDK
import { GoogleGenAI } from "@google/genai";
// import * as genai from '@google/genai';

const gemini = new GoogleGenAI({ apiKey: process.env.API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Aindex.html'));
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Initialize Apify client
const client = new ApifyClient({
  token: process.env.APIFY_KEY
});

app.post("/api/scrape", async (req, res) => {
  const { username } = req.body;
  console.log("Received scrape request for username:", username);

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  try {
    // 1) Profile Scraper
    const profileRun = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username]
    });

    const { items: profileItems } = await client
      .dataset(profileRun.defaultDatasetId)
      .listItems();

    console.log("Profile items:", profileItems);

    if (!profileItems || profileItems.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = profileItems[0];

    // 2) Post Scraper — correct input schema: `username` array
    console.log("Running post scraper with username array...");
    const postsRun = await client.actor("apify/instagram-post-scraper").call({
      username: [username], // ✅ must be array
      resultsLimit: 6
    });

    const { items: postItems } = await client
      .dataset(postsRun.defaultDatasetId)
      .listItems();

    console.log("Post items:", postItems);

    const posts = postItems.map(item => ({
      caption: item.caption ?? "",
      likes: item.likesCount ?? 0,
      comments: item.commentsCount ?? 0,
      image: item.displayUrl || (item.carouselImages ? item.carouselImages[0] : "") || "",
      hashtags: (item.caption || "").match(/#[a-zA-Z0-9_]+/g) || []
    }));

    // 3) Engagement metrics
    let avgLikes = 0, avgComments = 0, engagementRate = 0;
    if (posts.length > 0) {
      const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
      avgLikes = totalLikes / posts.length;
      avgComments = totalComments / posts.length;
      if (profile.followersCount && profile.followersCount > 0) {
        engagementRate = ((avgLikes + avgComments) / profile.followersCount) * 100;
      }
    }
    // --- 4) Generate short summary using Gemini ---
    let summary = "";
    try {
      const prompt = `Write a short 6-7 sentence professional summary + latest news(if applicable) about an Instagram profile with the following details:
  Name: ${profile.fullName ?? profile.username}
  Username: ${profile.username}
  Followers: ${profile.followersCount}
  Following: ${profile.followsCount}
  Posts: ${profile.postsCount}`;

      // Use a more modern model like gemini-1.5-flash
      const result = await gemini.models.generateContent({
        model: "gemini-2.5-flash",  // latest model
        contents: prompt,
        config: {
          systemInstruction: "You are an assistant that summarizes social media profiles."
        }
      });

      summary = result.text || "Summary not available.";

    } catch (err) {
      console.error("Gemini summary error:", err);
      summary = "Summary not available.";
    }
    res.json({
      profile: {
        name: profile.fullName ?? profile.username,
        username: profile.username,
        followers: profile.followersCount,
        following: profile.followsCount,
        posts: profile.postsCount,
        profilePic: profile.profilePicUrlHD || profile.profilePicUrl || "",
        summary
      },
      engagement: { avgLikes, avgComments, engagementRate },
      posts
    });

  } catch (err) {
    console.error("Error in /api/scrape:", err.message || err);
    return res.status(500).json({ error: err.message || "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
