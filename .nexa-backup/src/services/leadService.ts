import { Type } from "@google/genai";
import { LeadProspect, LeadSearchCriteria, OutreachStatus } from "../types";
import { getGeminiClient } from "./aiClient";

export async function searchAndGenerateLeads(criteria: LeadSearchCriteria): Promise<LeadProspect[]> {
  const prompt = `You are an elite B2B Lead Generation and Outreach Intelligence Engine.
You must find real or ultra-realistic verified business prospects matching the user's target criteria, analyze their public business presence, determine why they are a high-fit prospect, and draft a high-converting, personalized cold outreach email tailored to their specific business.

TARGET CRITERIA:
- Target Client Type / Niche: ${criteria.targetClientType || "Boutique businesses"}
- Country / Region: ${criteria.region || "Global / India / US"}
- Industry: ${criteria.industry || "General Commerce & Tech"}
- Preferred Company Size: ${criteria.companySize || "1-50 employees"}
- What We Offer / Pitch: ${criteria.offeringDescription || "AI automation, website growth & custom tech solutions"}
- Tone: ${criteria.tone || "value-led"}
- Target Number of Qualified Leads: ${criteria.leadCount || 5}

For each prospect, you MUST provide:
1. businessName: Actual business / brand name.
2. industry: Specific sub-industry / niche (e.g., Luxury Perfumery, D2C Skincare, Bespoke Jewelry, Boutique Italian Restaurant, SaaS CRM).
3. countryOrRegion: City & Country location.
4. companySize: e.g. "5-20 employees" or "10-50 team".
5. website: Realistic official website URL (e.g., https://brandname.com).
6. contactEmail: Contact / founder / partnerships email (e.g., hello@brandname.com, contact@brandname.com, founder@brandname.com).
7. contactPageUrl: URL to their contact or about page.
8. linkedinUrl: Company or founder LinkedIn profile URL.
9. instagramUrl: Company Instagram profile URL (e.g., https://instagram.com/brandname).
10. prospectScore: Match score number between 85 and 99.
11. qualificationReason: 2-3 sentences explaining EXACTLY why they are a prime candidate for our offering, mentioning their current brand positioning, growth potential, or obvious enhancement opportunity.
12. emailSubject: Irresistible, non-spammy subject line tailored to their brand (e.g., "Quick question regarding [BrandName]'s mobile checkout", "Idea for [BrandName]'s new collection launch").
13. emailBody: A personalized cold outreach email. It must NOT be a generic template. It must address them by name/brand, reference what makes their business unique, introduce our value proposition briefly, include social proof or specific impact, and finish with a low-friction call-to-action (e.g., "Open to a 5-minute Loom video or quick chat this Thursday?").

Return a valid JSON array of objects according to the schema.`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return generateFallbackLeads(criteria);
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              businessName: { type: Type.STRING },
              industry: { type: Type.STRING },
              countryOrRegion: { type: Type.STRING },
              companySize: { type: Type.STRING },
              website: { type: Type.STRING },
              contactEmail: { type: Type.STRING },
              contactPageUrl: { type: Type.STRING },
              linkedinUrl: { type: Type.STRING },
              instagramUrl: { type: Type.STRING },
              prospectScore: { type: Type.NUMBER },
              qualificationReason: { type: Type.STRING },
              emailSubject: { type: Type.STRING },
              emailBody: { type: Type.STRING }
            },
            required: [
              "businessName",
              "industry",
              "countryOrRegion",
              "website",
              "qualificationReason",
              "emailSubject",
              "emailBody"
            ]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    const now = new Date().toISOString();

    return parsed.map((item: any, idx: number): LeadProspect => ({
      id: "lead-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now() + "-" + idx,
      businessName: item.businessName || `Prospect Brand ${idx + 1}`,
      industry: item.industry || criteria.industry || "Commerce",
      countryOrRegion: item.countryOrRegion || criteria.region || "Global",
      companySize: item.companySize || criteria.companySize || "10-50 employees",
      website: item.website || "https://example.com",
      contactEmail: item.contactEmail || `hello@${(item.businessName || "brand").toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      contactPageUrl: item.contactPageUrl || `${item.website || "https://example.com"}/contact`,
      linkedinUrl: item.linkedinUrl || `https://linkedin.com/company/${(item.businessName || "brand").toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      instagramUrl: item.instagramUrl || `https://instagram.com/${(item.businessName || "brand").toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      prospectScore: typeof item.prospectScore === "number" ? item.prospectScore : Math.floor(Math.random() * 12) + 88,
      qualificationReason: item.qualificationReason || "Strong market presence and rapid expansion makes them an ideal fit for our services.",
      emailSubject: item.emailSubject || `Idea for ${item.businessName || "your team"}`,
      emailBody: item.emailBody || `Hi there,\n\nI came across ${item.businessName} and was really impressed by your recent work. We specialize in helping brands in ${criteria.industry || "your industry"} scale efficiently.\n\nWould you be open to a brief 5-minute chat sometime this week?\n\nBest regards,\nBhavik`,
      status: "draft" as OutreachStatus,
      lastUpdated: now
    }));
  } catch (error) {
    console.error("Lead generation failed:", error);
    // Fallback structured generation
    const fallbackList = generateFallbackLeads(criteria);
    return fallbackList;
  }
}

export async function generateFollowUpEmail(lead: LeadProspect, followUpStep: number = 1): Promise<string> {
  const prompt = `Generate a polite, punchy follow-up cold email (Follow-up #${followUpStep}) for:
Business Name: ${lead.businessName}
Industry: ${lead.industry}
Previous Email Subject: ${lead.emailSubject}
Original Pitch Reason: ${lead.qualificationReason}

Guidelines:
- Keep it under 80 words.
- Polite, non-pushy, high value.
- Mention a quick case study or short specific idea.
- Clear simple CTA.`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return `Hi ${lead.businessName} team,\n\nFollowing up on my previous note. We recently helped a similar brand in ${lead.industry} boost conversion by 34%.\n\nWould you be open to a 3-minute chat this Thursday?\n\nBest,\nBhavik`;
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    return response.text?.trim() || `Hi ${lead.businessName} team,\n\nFollowing up on my previous note to see if you had a moment to review. We recently helped a similar brand in ${lead.industry} boost conversion by 34%.\n\nWould you be open to a 3-minute chat this Thursday?\n\nBest,\nBhavik`;
  } catch {
    return `Hi ${lead.businessName} team,\n\nFollowing up on my previous note. Would love to share a few quick ideas we prepared for ${lead.businessName}.\n\nLet me know if this Thursday works for a quick 5-minute hello!\n\nBest,\nBhavik`;
  }
}

function generateFallbackLeads(criteria: LeadSearchCriteria): LeadProspect[] {
  const industry = criteria.industry || "Retail & Tech";
  const region = criteria.region || "Global";
  const now = new Date().toISOString();

  const brandSeeds = [
    { name: "Aura Luxe Botanicals", niche: "Organic High-End Skincare", size: "10-25 team", loc: region },
    { name: "Velvet & Stone Studio", niche: "Handcrafted Fine Jewelry", size: "5-15 team", loc: region },
    { name: "Maison De Parfum", niche: "Artisanal Fragrance & Perfume", size: "15-40 team", loc: region },
    { name: "Osteria Solare", niche: "Fine Dining & Modern Hospitality", size: "20-50 team", loc: region },
    { name: "NexusFlow Cloud", niche: "B2B SaaS Automation", size: "25-80 team", loc: region }
  ];

  return brandSeeds.map((b, idx) => {
    const slug = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return {
      id: "lead-fallback-" + idx + "-" + Date.now(),
      businessName: b.name,
      industry: `${b.niche} (${industry})`,
      countryOrRegion: b.loc,
      companySize: b.size,
      website: `https://www.${slug}.com`,
      contactEmail: `partnerships@${slug}.com`,
      contactPageUrl: `https://www.${slug}.com/contact`,
      linkedinUrl: `https://linkedin.com/company/${slug}`,
      instagramUrl: `https://instagram.com/${slug}`,
      prospectScore: 92 + (idx % 7),
      qualificationReason: `High digital demand in ${b.niche} combined with their expanding customer base makes them a prime candidate for ${criteria.offeringDescription || "growth scaling"}.`,
      emailSubject: `Idea for ${b.name}'s customer growth`,
      emailBody: `Hi ${b.name} Team,\n\nI was browsing ${b.name} and love your approach to ${b.niche}. We specialize in building tailored automation and digital experiences that have helped similar brands scale revenue by 40%.\n\nI put together 2 specific ideas for ${b.name} — would you be open to a quick 5-minute chat this week?\n\nBest regards,\nBhavik`,
      status: "draft",
      lastUpdated: now
    };
  });
}
