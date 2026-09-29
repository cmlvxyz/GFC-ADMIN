/**
 * Seed for the public website event grid.
 *
 * These are the WEBSITE events (Desktop/GFC), rendered three per row in this
 * exact order. They are intentionally kept separate from the admin's own
 * `events` collection, which tracks internal operations (registration, QR
 * check-in, attendance) rather than what the public sees.
 *
 * dateEntries carry the real photo paths. Those files live in the website's
 * own public/ folder and are served by the website itself, not by this API.
 *
 * Generated from the website's DEFAULT_EVENTS + the legacy photo albums.
 */

export interface SiteEvent {
  id: string;
  title: string;
  date: string;
  tag: string;
  description: string;
  location?: string;
  defaultVerse?: string;
  defaultVerseRef?: string;
  image?: string;
  albumType?: 'date' | 'year';
  dateEntries: Array<{
    date: string;
    photos: string[];
    coverImage?: string;
    verse?: string;
    verseRef?: string;
    photoCount?: number;
    /**
     * A Church Anniversary album shows a Year above the cover and an Event name
     * below it. Both are set only for albums the admin paired together, so a
     * plain date album keeps rendering the way it always has.
     */
    albumYear?: string;
    albumEvent?: string;
  }>;
}

export const DEFAULT_SITE_EVENTS: SiteEvent[] = [
  {
    "id": "anniversary",
    "title": "Church Anniversary",
    "date": "Every 2nd Sunday of the month",
    "tag": "🎉 Celebration",
    "description": "Special thanksgiving gathering celebrating God's faithfulness and guidance in our church history.",
    "location": "📍 Gospel Fellowship Church Main Sanctuary",
    "defaultVerse": "I will bless the Lord at all times; His praise shall continually be in my mouth.",
    "defaultVerseRef": "Psalm 34:1",
    "image": "/image-circle.png",
    "dateEntries": []
  },
  {
    "id": "prayer",
    "title": "Prayer Meeting",
    "date": "Every Monday • 7:00 PM",
    "tag": "🙏 Prayer",
    "description": "Come together as a community to pray for our church, our nation, and one another.",
    "location": "📍 Gospel Fellowship Church Sanctuary",
    "defaultVerse": "Pray without ceasing.",
    "defaultVerseRef": "Jeremiah 29:13",
    "image": "/Prayer Meeting/prayer-meeting.jpg",
    "dateEntries": []
  },
  {
    "id": "biblestudy",
    "title": "Bible Study",
    "date": "Every Wednesday • 7:00 PM",
    "tag": "📖 Word",
    "description": "Interactive mid-week study diving deep into the scriptures and practical Christian living.",
    "location": "📍 Gospel Fellowship Church",
    "defaultVerse": "Your word is a lamp to my feet and a light to my path.",
    "defaultVerseRef": "Psalm 119:105",
    "image": "/Bible Study/bible-study.jpg",
    "dateEntries": []
  },
  {
    "id": "worship",
    "title": "Worship Night",
    "date": "Every Friday • 7:00 PM",
    "tag": "🎵 Music",
    "description": "A dedicated evening of intimate praise, prayer, and acoustic worship.",
    "location": "📍 Gospel Fellowship Church Sanctuary",
    "defaultVerse": "Sing to the Lord a new song; sing to the Lord, all the earth.",
    "defaultVerseRef": "Psalm 96:1",
    "image": "/Worship Night/worship-night.jpg",
    "dateEntries": []
  },
  {
    "id": "sunday",
    "title": "Sunday Service",
    "date": "Every Sunday • 8:30 AM",
    "tag": "⛪ Worship",
    "description": "Our main weekly worship service. Join us for joyful praise, passionate prayer, and the faithful preaching of God's Word.",
    "location": "📍 Gospel Fellowship Church, Limay, Bataan",
    "defaultVerse": "I was glad when they said to me, \"Let us go into the house of the Lord.\"",
    "defaultVerseRef": "Psalm 122:1",
    "image": "/Sunday Service/sunday-service.jpg",
    "dateEntries": []
  },
  {
    "id": "youth",
    "title": "Next Generation Youth",
    "date": "Every Sunday • 7:00 PM",
    "tag": "🌟 Youth",
    "description": "Fellowship, games, worship, and Bible discussions tailored specifically for students and young adults.",
    "location": "📍 Gospel Fellowship Church Youth Hall",
    "defaultVerse": "Let no one despise your youth, but set the believers an example.",
    "defaultVerseRef": "1 Timothy 4:12",
    "image": "/Next Gen/next-gen.jpg",
    "dateEntries": []
  },
  {
    "id": "gospel-network",
    "title": "Gospel Network",
    "date": "",
    "tag": "OBEDIENCE",
    "description": "Your willingness to obey and Love others",
    "location": "",
    "defaultVerse": "",
    "defaultVerseRef": "",
    "image": "/image-circle.png",
    "dateEntries": []
  }
];
