/**
 * Sample records for the demo build: what a few weeks of use by one person might look
 * like. Names and content are examples, not real people or accounts.
 */
import type { Automation, Connector, Memory, Preferences, Project, Skill } from "../lib/types"

const DAY_MS = 24 * 60 * 60 * 1000
export const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString()

export function seedProjects(): Project[] {
  return [
    {
      id: "p-thesis",
      name: "Thesis: mobile money",
      instructions:
        "I am writing a master's thesis on mobile money adoption in rural Bangladesh. Prefer peer-reviewed sources and cite them.",
      pinned: true,
      created_at: daysAgo(40),
      updated_at: daysAgo(1),
    },
    {
      id: "p-shop",
      name: "Online shop",
      instructions: "My small clothing shop sells on Facebook. Keep advice practical and low-cost.",
      pinned: false,
      created_at: daysAgo(20),
      updated_at: daysAgo(4),
    },
    {
      id: "p-hsc",
      name: "HSC physics",
      instructions:
        "Explain like a patient tutor for HSC students, in Bangla when I write in Bangla.",
      pinned: false,
      created_at: daysAgo(60),
      updated_at: daysAgo(12),
    },
  ]
}

export function seedAutomations(): Automation[] {
  return [
    {
      id: "a-news",
      title: "Morning tech news",
      prompt: "Summarise the top five technology stories in Bangladesh today, with sources.",
      frequency: "daily",
      time: "08:00",
      enabled: true,
      next_run_at: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
      last_run_at: daysAgo(0.4),
    },
    {
      id: "a-rates",
      title: "Weekly exchange rates",
      prompt: "Give me the USD, GBP and SAR rates against BDT this week, with sources.",
      frequency: "weekly",
      time: "09:30",
      enabled: false,
      next_run_at: null,
      last_run_at: daysAgo(9),
    },
  ]
}

export function seedConnectors(): Connector[] {
  return [
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Search and cite your Docs, Sheets and PDFs",
      category: "Files",
      connected: true,
    },
    {
      id: "gmail",
      name: "Gmail",
      description: "Find and summarise email threads",
      category: "Communication",
      connected: false,
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Check your schedule and plan meetings",
      category: "Productivity",
      connected: false,
    },
    {
      id: "github",
      name: "GitHub",
      description: "Read issues, pull requests and code",
      category: "Development",
      connected: false,
    },
    {
      id: "notion",
      name: "Notion",
      description: "Search your workspace pages",
      category: "Productivity",
      connected: false,
    },
    {
      id: "onedrive",
      name: "OneDrive",
      description: "Search Word, Excel and PowerPoint files",
      category: "Files",
      connected: false,
    },
  ]
}

export function seedSkills(): Skill[] {
  return [
    {
      id: "s-academic",
      name: "Academic editor",
      description: "Tightens academic prose and keeps citations intact",
      instructions: "Edit for clarity and formal register. Never change citations.",
      author: "kothora",
      installed: true,
    },
    {
      id: "s-bangla",
      name: "Bangla proofreader",
      description: "Fixes spelling and grammar in Bangla text",
      instructions: "Correct Bangla spelling and grammar; explain each change briefly.",
      author: "kothora",
      installed: true,
    },
    {
      id: "s-translate",
      name: "Translator",
      description: "Translates between Bangla and English, keeping tone",
      instructions: "Translate faithfully, keeping names and tone.",
      author: "kothora",
      installed: false,
    },
    {
      id: "s-exam",
      name: "Exam tutor",
      description: "Quizzes you and explains wrong answers",
      instructions: "Ask one question at a time and explain mistakes.",
      author: "kothora",
      installed: false,
    },
    {
      id: "s-cv",
      name: "CV reviewer",
      description: "Reviews a CV for jobs in Bangladesh",
      instructions: "Review against local hiring norms; be specific.",
      author: "me",
      installed: true,
    },
  ]
}

export function seedPreferences(): Preferences {
  return {
    response_language: "auto",
    about_me: "Master's student in Dhaka. I run a small online shop on the side.",
    instructions: "Keep answers short unless I ask for detail. Use taka for prices.",
    memory_enabled: true,
  }
}

export function seedMemories(): Memory[] {
  return [
    { id: "m-1", text: "Is writing a thesis on mobile money adoption.", created_at: daysAgo(30) },
    { id: "m-2", text: "Prefers prices in taka.", created_at: daysAgo(18) },
    { id: "m-3", text: "Sells clothing through a Facebook page.", created_at: daysAgo(6) },
  ]
}
