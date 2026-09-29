/**
 * Every piece of text the public website shows, in one place.
 *
 * The website reads these through `settingText(key, fallback)`; the admin edits
 * them from the "Website Text" tab. `value` here is the default that ships with
 * the site, so a fresh install looks exactly like the one that exists today.
 */

export interface CopyField {
  key: string;
  label: string;
  value: string;
  /** Renders as a textarea in the admin (long copy). */
  multiline?: boolean;
}

export interface CopyGroup {
  id: string;
  title: string;
  blurb: string;
  fields: CopyField[];
}

const f = (key: string, label: string, value: string, multiline = false): CopyField => ({
  key, label, value, multiline,
});

export const SITE_COPY_GROUPS: CopyGroup[] = [
  {
    id: 'nav',
    title: 'Navbar',
    blurb: 'The links across the top of every page.',
    fields: [
      f('nav.home', 'Home link', 'Home'),
      f('nav.about', 'About link', 'About'),
      f('nav.events', 'Events link', 'Events'),
      f('nav.verse', 'Verse link', 'Verse'),
      f('nav.prayer', 'Prayer link', 'Prayer'),
      f('nav.contact', 'Contact link', 'Contact'),
      f('nav.give', 'Give button', 'Give'),
      f('brandName1', 'Church name - first word', 'Gospel'),
      f('brandName2', 'Church name - accent word', 'Fellowship'),
      f('brandName3', 'Church name - last word', 'Church'),
    ],
  },
  {
    id: 'hero',
    title: 'Home Hero',
    blurb: 'The big headline and buttons at the very top of the home page.',
    fields: [
      f('heroHeading1', 'Headline - first line', 'Your home in faith,'),
      f('heroHeading2', 'Headline - accent line', 'hope and love.'),
      f('heroCtaVisit', 'Button - Plan a Visit', 'Plan a Visit'),
      f('heroCtaEvents', 'Button - Upcoming Events', 'Upcoming Events'),
      f('heroServiceButton', 'Button - Service', 'Service'),
      f('heroServiceTimesLabel', 'Service dropdown heading', 'Service Times'),
      f('heroDirections', 'Button - Get Directions', 'Get Directions'),
      f('heroCountdownBadge', 'Countdown badge', 'Sunday · 8:30 AM'),
      f('heroCountdownDays', 'Countdown unit - days', 'Days'),
      f('heroCountdownHours', 'Countdown unit - hours', 'Hours'),
      f('heroCountdownMins', 'Countdown unit - minutes', 'Mins'),
      f('heroCountdownSecs', 'Countdown unit - seconds', 'Secs'),
      f('heroImage', 'Background image URL', 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=2000&q=80'),
    ],
  },
  {
    id: 'schedule',
    title: 'Service Schedule',
    blurb: 'Shown in the home page service dropdown and in the footer.',
    fields: [
      f('schedule.0.name', 'Service 1 - name', 'Sunday Worship'),
      f('schedule.0.time', 'Service 1 - time', '8:30 AM'),
      f('schedule.0.day', 'Service 1 - day', 'Sunday'),
      f('schedule.1.name', 'Service 2 - name', 'Prayer Meeting'),
      f('schedule.1.time', 'Service 2 - time', '7:00 PM'),
      f('schedule.1.day', 'Service 2 - day', 'Monday'),
      f('schedule.2.name', 'Service 3 - name', 'Worship Night'),
      f('schedule.2.time', 'Service 3 - time', '7:00 PM'),
      f('schedule.2.day', 'Service 3 - day', 'Friday'),
      f('schedule.3.name', 'Service 4 - name', 'Next Gen Youth'),
      f('schedule.3.time', 'Service 4 - time', '7:00 PM'),
      f('schedule.3.day', 'Service 4 - day', 'Sunday'),
    ],
  },
  {
    id: 'home',
    title: 'Home Page Sections',
    blurb: 'The tiles, headings and calls to action below the hero.',
    fields: [
      f('home.tile1.title', 'Tile 1 - title', 'Who We Are'),
      f('home.tile1.text', 'Tile 1 - text', 'Our mission, vision, ministries and leaders.'),
      f('home.tile1.cta', 'Tile 1 - link label', 'About GFC'),
      f('home.tile2.title', 'Tile 2 - title', 'Events & Schedule'),
      f('home.tile2.text', 'Tile 2 - text', 'Weekly services and photo albums from gatherings.'),
      f('home.tile2.cta', 'Tile 2 - link label', 'See Events'),
      f('home.tile3.title', 'Tile 3 - title', 'Verse of the Day'),
      f('home.tile3.text', 'Tile 3 - text', 'A daily word from the Lord to keep close.'),
      f('home.tile3.cta', 'Tile 3 - link label', 'Read Today'),
      f('home.tile4.title', 'Tile 4 - title', 'Prayer Requests'),
      f('home.tile4.text', 'Tile 4 - text', 'Share a request with our prayer team.'),
      f('home.tile4.cta', 'Tile 4 - link label', 'Pray With Us'),
      f('home.verseLabel', 'Verse band - label', 'Verse of the Day'),
      f('home.verseCta', 'Verse band - button', 'Read More from the Word'),
      f('home.eventsLabel', 'Events section - label', 'Gatherings'),
      f('home.eventsHeading', 'Events section - heading', 'Upcoming events'),
      f('home.eventsCta', 'Events section - link', 'View All Events'),
      f('home.eventsEmpty', 'Events section - empty state', 'No upcoming events yet. Check back soon.'),
      f('home.eventSeeMore', 'Event card - link', 'See more'),
      f('home.annLabel', 'Announcements - label', 'Announcements'),
      f('home.annHeading', 'Announcements - heading', "What's new at GFC"),
      f('home.annCategory', 'Announcement card - default category', 'Announcement'),
      f('home.annPinned', 'Announcement card - pinned tag', '· Pinned'),
      f('home.prayerLabel', 'Prayer band - label', "We're praying with you"),
      f('prayerTitle1', 'Prayer band - headline first line', 'Facing a burden?'),
      f('prayerTitle2', 'Prayer band - headline accent', 'Tell us.'),
      f('prayerText', 'Prayer band - body', 'Share a prayer request with our church family. No request is too small or too big for the Lord.', true),
      f('home.prayerCta', 'Prayer band - button', 'Submit a Prayer Request'),
      f('home.visitHeading', 'Visit card - heading', 'Where to find us'),
      f('visitAddress', 'Visit card - body', "008 National Road SF. 2 Purok 1, Limay, Bataan. Come as you are — we can't wait to meet you.", true),
      f('home.visitCta', 'Visit card - link', 'Get Directions & Register'),
      f('home.giveHeading', 'Give card - heading', 'Bless the church'),
      f('giveBlurb', 'Give card - body', 'Your tithes and offerings help us continue sharing the Gospel in Limay and beyond.', true),
      f('home.giveCta', 'Give card - link', 'Give Tithes & Offering'),
    ],
  },
  {
    id: 'about',
    title: 'About Page',
    blurb: 'Mission, vision, ministries and leaders.',
    fields: [
      f('aboutHeading1', 'Heading - first line', 'Rooted in the Word, formed by worship,'),
      f('aboutHeading2', 'Heading - accent line', 'sent in love.'),
      f('aboutEyebrow', 'Section label', 'About GFC'),
      f('aboutMissionTitle', 'Mission card title', 'Our Mission & Vision'),
      f('aboutMissionLabel', 'Mission card label', 'Mission'),
      f('aboutMissionText', 'Mission text', 'To proclaim the unqualified gospel of Jesus Christ, making disciples who love God and love one another, and serving our community with the grace we have received.', true),
      f('aboutVisionLabel', 'Vision card label', 'Vision'),
      f('aboutVisionText', 'Vision text', 'A church rooted in the Word, worshipping freely, and reaching the lost with the love of Christ — locally in Limay and Bataan, and beyond.', true),
      f('aboutMinistriesTitle', 'Ministries heading', 'Ministries & Community'),
      f('aboutMinistriesCta', 'Ministries link', 'Explore Our Ministries'),
      f('aboutMinistryFocus', 'Ministry card label', 'Ministry Focus'),
      f('aboutLeadershipTitle', 'Leaders heading', 'Our pastors & leaders'),
      f('aboutOverseer', 'Leader role - overseer', 'Overseer'),
      f('aboutWhereLabel', 'Worship lineup - label', 'Where'),
      f('aboutMeetsLabel', 'Worship lineup - label 2', 'Meets'),
      f('aboutWorshipLineup', 'Worship lineup heading', 'Worship Lineup'),
      f('aboutFindPlace', 'Call to action', 'Find your place to serve'),
      f('aboutPageTitle', 'Page heading - first line', 'A church family'),
      f('aboutPageTitle2', 'Page heading - accent', 'for everyone.'),
      f('aboutPageSubtitle', 'Page subheading', 'Get to know who we are, what we believe, and how you can find your place to belong.', true),
      f('aboutLocation', 'Location line', 'Limay, Bataan.'),
      f('aboutCommunity', 'Community card label', 'Community'),
      f('aboutMinistry', 'Ministry card label', 'Ministry'),
      f('aboutLeadership', 'Leadership card label', 'Leadership'),
    ],
  },
  {
    id: 'events',
    title: 'Events Page',
    blurb: 'The events grid, photo albums and empty states.',
    fields: [
      f('eventsHeroEyebrow', 'Page label', 'Events & Gatherings'),
      f('eventsHeroTitle1', 'Page heading - first line', 'Worship, prayer,'),
      f('eventsHeroTitle2', 'Page heading - accent', '& community.'),
      f('eventsHeroSubtitle', 'Page subheading', "From Sunday celebration to midweek prayer meetings — there's always a place for you.", true),
      f('eventsSectionHeading', 'Section heading', 'Church events & schedule'),
      f('eventsEmpty', 'Empty state - no events', 'No events yet. Check back soon for upcoming gatherings and activities.'),
      f('eventsEmptyAlbums', 'Empty state - no albums', 'No photo albums yet for this event.'),
      f('eventsEmptyPhotos', 'Empty state - no photos', 'No photos uploaded yet for this date.'),
      f('commonBack', 'Button - Back', 'Back'),
      f('commonClose', 'Button - Close', 'Close'),
      f('commonDetails', 'Button - Details', 'Details'),
    ],
  },
  {
    id: 'contact',
    title: 'Contact & Attendance',
    blurb: 'Church details and the Sunday service registration form.',
    fields: [
      f('contactHeroEyebrow', 'Page label', 'Contact & Location'),
      f('contactHeroTitle1', 'Page heading - first line', "We'd love to"),
      f('contactHeroTitle2', 'Page heading - accent', 'welcome you.'),
      f('contactHeroSubtitle', 'Page subheading', 'Reach out, get directions, or register your family for the next Sunday service.', true),
      f('contactChurchInfo', 'Info card heading', 'Church Information'),
      f('contactVisitHeading', 'Info card heading 2', 'Visit Us in Limay, Bataan'),
      f('contactPhoneLabel', 'Phone label', 'Contact No.'),
      f('contactPhone', 'Phone number', '123-456-7890 / 0912-345-6789'),
      f('contactEmail', 'Email address', 'gospelfellowshipchurch0923@gmail.com'),
      f('contactFacebookLabel', 'Facebook label', 'Official Facebook Page'),
      f('contactFacebookName', 'Facebook page name', 'Gospel Fellowship Church Facebook'),
      f('contactRegTitle', 'Registration card heading', 'Sunday Service Registration'),
      f('contactRegTitle2', 'Registration card heading 2', 'Register Your Attendance'),
      f('contactRegText', 'Registration card text', 'Register your name and family for the upcoming Sunday service.', true),
      f('contactRegName', 'Form - name field', 'Full Name *'),
      f('contactRegAge', 'Form - age field', 'Age'),
      f('contactRegPhone', 'Form - contact field', 'Contact No.'),
      f('contactRegFacebook', 'Form - facebook field', 'Facebook Account Name (Optional)'),
      f('contactRegSubmit', 'Form - submit button', 'Confirm Attendance'),
      f('contactRegSuccess', 'Form - thank you', 'Thank You for Registering!'),
      f('contactRegAnother', 'Form - register again', 'Register Another'),
    ],
  },
  {
    id: 'prayer',
    title: 'Prayer Page',
    blurb: 'The prayer wall and the request form.',
    fields: [
      f('prayerHeroEyebrow', 'Page label', 'Prayer Request'),
      f('prayerHeroTitle1', 'Page heading - first line', 'Cast your cares on'),
      f('prayerHeroTitle2', 'Page heading - accent', 'Him.'),
      f('prayerHeroSubtitle', 'Page subheading', "Our prayer team is ready to pray with you. No request is too small or too big for our Lord.", true),
      f('prayerWallHeading', 'Prayer wall heading', 'Community Prayer Wall'),
      f('prayerFormHeading', 'Form heading', 'Do You Have a Prayer Request?'),
      f('prayerFormName', 'Form - name field', 'Name (Optional)'),
      f('prayerFormContact', 'Form - contact field', 'Contact No. / Facebook (Optional)'),
      f('prayerFormCategory', 'Form - category field', 'Select Prayer Category'),
      f('prayerFormMessage', 'Form - message field', 'Write Your Prayer Request Here *'),
      f('prayerFormSafe', 'Form - reassurance', 'Safe & Easy to Use:'),
      f('prayerFormSubmit', 'Form - submit button', 'Submit Prayer Request'),
      f('prayerFormSuccess', 'Form - thank you', 'Your Prayer Request Has Been Recorded!'),
      f('prayerFormAnother', 'Form - submit again', 'Submit Another Prayer'),
      f('prayerEmpty', 'Empty state', 'No prayer requests yet. Be the first to lift one up.'),
      f('prayerWallText', 'Prayer wall intro', 'Let us also pray for the requests of our brothers and sisters in faith.', true),
    ],
  },
  {
    id: 'verse',
    title: 'Verse Page',
    blurb: 'The daily devotion page.',
    fields: [
      f('verseHeroEyebrow', 'Page label', 'Daily Devotion'),
      f('verseHeroTitle1', 'Page heading - first line', 'The Word for'),
      f('verseHeroTitle2', 'Page heading - accent', 'today.'),
      f('verseHeroSubtitle', 'Page subheading', "A daily reminder of God's faithfulness — a verse to reflect on, memorize, and share.", true),
      f('verseHeading', 'Section heading', 'Verse of the Day'),
      f('verseMore', 'More verses heading', 'More from the Word'),
      f('verseTagline', 'Tagline', 'Reflect · Memorize · Share'),
      f('verseCopy', 'Button - copy verse', 'Copy Verse'),
      f('verseCopied', 'Button - copied state', 'Copied!'),
    ],
  },
  {
    id: 'give',
    title: 'Giving',
    blurb: 'The tithes and offering popup.',
    fields: [
      f('giveTitle', 'Modal heading', 'Give Your Tithes & Offering'),
      f('giveGcashLabel', 'GCash label', 'GCash Account'),
      f('giveBankLabel', 'Bank label', 'Bank Transfer / BDO'),
    ],
  },
  {
    id: 'footer',
    title: 'Footer',
    blurb: 'Everything at the bottom of every page.',
    fields: [
      f('footerNavTitle', 'Navigation heading', 'Navigation'),
      f('footerScheduleTitle', 'Schedule heading', 'Worship With Us'),
      f('footerContactTitle', 'Contact heading', 'Contact'),
      f('footerAddress', 'Address', '008 National Road SF. 2 Purok 1, Limay, Bataan'),
      f('footerBlurb', 'Tagline under the church name', 'A family of faith in Limay, Bataan — rooted in the Word, formed by worship, and sent in love.', true),
      f('footerPhone', 'Phone', '123-456-7890 / 0912-345-6789'),
      f('footerEmail', 'Email', 'gospelfellowshipchurch0923@gmail.com'),
      f('footerFacebook', 'Facebook link label', 'Facebook Page'),
      f('footerCopyright', 'Copyright line', 'Gospel Fellowship Church Limay, Bataan. All Rights Reserved.'),
      f('footerSeniors', 'Small note', 'Seniors & Mobile Data Friendly'),
      f('footerBackToTop', 'Back to top button', 'Back to top'),
      f('footerNavHome', 'Footer link - Home', 'Home'),
      f('footerNavAbout', 'Footer link - About', 'About Us'),
      f('footerNavEvents', 'Footer link - Events', 'Events & Schedule'),
      f('footerNavVerse', 'Footer link - Verse', 'Verse of the Day'),
      f('footerNavPrayer', 'Footer link - Prayer', 'Prayer Request'),
      f('footerNavContact', 'Footer link - Contact', 'Contact & Location'),
    ],
  },
];

/** Flat key -> default value map, used to backfill missing rows. */
export const SITE_COPY_DEFAULTS: Record<string, string> = Object.fromEntries(
  SITE_COPY_GROUPS.flatMap(g => g.fields).map(x => [x.key, x.value]),
);

export const SITE_COPY_FIELD_COUNT = Object.keys(SITE_COPY_DEFAULTS).length;
