import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDB } from '../src/config/db.js';
import Deliverable from '../src/models/Deliverable.js';
import Event from '../src/models/Event.js';
import Message from '../src/models/Message.js';
import Notification from '../src/models/Notification.js';
import Proposal from '../src/models/Proposal.js';
import User from '../src/models/User.js';
import { embedEvent, embedSponsor } from '../src/services/embeddingService.js';

const demoEmailPattern = /@demo\.fynd$/i;
const demoPassword = 'Demo@1234';
const delay = (milliseconds) => new Promise((resolvePromise) => {
  setTimeout(resolvePromise, milliseconds);
});

const organizers = [
  {
    name: 'Ananya Rao',
    email: 'organizer1@demo.fynd',
    organization: 'Bengaluru Institute of Technology Tech Club',
    city: 'Bengaluru',
    orgType: 'college',
    bio: 'A student-led community hosting practical technology events and campus showcases.',
  },
  {
    name: 'Ishaan Mehta',
    email: 'organizer2@demo.fynd',
    organization: 'Mumbai Rang Sanskriti Cultural Committee',
    city: 'Mumbai',
    orgType: 'college',
    bio: 'Our cultural committee brings student performers, artists, and local communities together.',
  },
  {
    name: 'Meera Khanna',
    email: 'organizer3@demo.fynd',
    organization: 'Delhi Founders Circle',
    city: 'Delhi',
    orgType: 'community',
    bio: 'We create welcoming meetups where early-stage founders can learn and build useful connections.',
  },
  {
    name: 'Rohan Deshpande',
    email: 'organizer4@demo.fynd',
    organization: 'Pune City Sports Club',
    city: 'Pune',
    orgType: 'club',
    bio: 'A volunteer sports club organizing inclusive tournaments and active community days.',
  },
  {
    name: 'Sana Reddy',
    email: 'organizer5@demo.fynd',
    organization: 'Hyderabad Indie Music Society',
    city: 'Hyderabad',
    orgType: 'club',
    bio: 'We support emerging musicians through intimate live shows and collaborative showcases.',
  },
];

const sponsors = [
  {
    name: 'Kavya Nair',
    email: 'sponsor1@demo.fynd',
    organization: 'Misty Mile Coffee Roasters',
    city: 'Bengaluru',
    industry: 'Food and beverage',
    targetAudience: 'Students, young professionals, and independent coffee fans',
    budgetMin: 12000,
    budgetMax: 60000,
    goals: 'Build local brand awareness and offer coffee samples to new customers.',
    bio: 'A small-batch coffee roaster focused on approachable, responsibly sourced coffee.',
  },
  {
    name: 'Arjun Bhat',
    email: 'sponsor2@demo.fynd',
    organization: 'BrightPath Learning',
    city: 'Mumbai',
    industry: 'Education technology',
    targetAudience: 'College students and early-career professionals',
    budgetMin: 18000,
    budgetMax: 80000,
    goals: 'Introduce learners to practical courses and grow our student community.',
    bio: 'An ed-tech startup helping learners build job-ready skills through short courses.',
  },
  {
    name: 'Nisha Verma',
    email: 'sponsor3@demo.fynd',
    organization: 'Pulse Habit',
    city: 'Delhi',
    industry: 'Fitness and wellness',
    targetAudience: 'Active adults, sports fans, and people building healthy routines',
    budgetMin: 10000,
    budgetMax: 55000,
    goals: 'Encourage healthy habits and introduce our fitness app to local communities.',
    bio: 'A friendly fitness app that makes simple daily movement easier to maintain.',
  },
  {
    name: 'Devika Kulkarni',
    email: 'sponsor4@demo.fynd',
    organization: 'Paperplane Stationery',
    city: 'Pune',
    industry: 'Stationery and retail',
    targetAudience: 'Students, teachers, designers, and journal enthusiasts',
    budgetMin: 5000,
    budgetMax: 30000,
    goals: 'Increase local discovery and let people try our notebooks and creative supplies.',
    bio: 'An independent stationery brand making useful notebooks and everyday creative tools.',
  },
  {
    name: 'Sameer Iyer',
    email: 'sponsor5@demo.fynd',
    organization: 'CommonGround Workspaces',
    city: 'Hyderabad',
    industry: 'Coworking and real estate',
    targetAudience: 'Freelancers, founders, and small distributed teams',
    budgetMin: 25000,
    budgetMax: 75000,
    goals: 'Meet local founders and introduce flexible workspace memberships.',
    bio: 'A neighborhood coworking space for independent professionals and growing teams.',
  },
];

const categoryBenefits = {
  tech: [
    'Logo on the event website',
    'Branded demo booth',
    'Stage acknowledgment',
    'Social media mention',
  ],
  cultural: [
    'Logo on event materials',
    'On-site activity space',
    'Program acknowledgment',
    'Social media mention',
  ],
  sports: [
    'Logo on tournament materials',
    'Community activity booth',
    'Match-day acknowledgment',
    'Social media mention',
  ],
  business: [
    'Logo on conference materials',
    'Networking lounge presence',
    'Session acknowledgment',
    'Social media mention',
  ],
  music: [
    'Logo on show promotions',
    'Branded sampling booth',
    'On-stage acknowledgment',
    'Social media mention',
  ],
  social: [
    'Logo on community event page',
    'Activity booth for attendees',
    'Host acknowledgment',
    'Social media mention',
  ],
};

const publishedEventSeeds = [
  {
    organizer: 0,
    title: 'Build Bengaluru: Student Innovation Summit',
    description: 'Student teams will demonstrate practical prototypes in software, robotics, and climate technology. The day includes mentor conversations and a friendly project showcase. Local companies can meet emerging builders in an informal setting.',
    category: 'tech',
    city: 'Bengaluru',
    venue: 'Bengaluru Institute of Technology Auditorium',
    expectedFootfall: 1800,
    audienceProfile: 'Engineering students, early-career developers, and technology mentors',
    prices: [80000, 45000, 20000],
  },
  {
    organizer: 1,
    title: 'Mumbai Mosaic: Campus Arts and Culture Week',
    description: 'Mumbai Mosaic brings student dance, theatre, crafts, and regional food into one lively campus program. Visitors can explore performances throughout the day and meet the student groups behind them. The committee welcomes partners who support local arts.',
    category: 'cultural',
    city: 'Mumbai',
    venue: 'Ruia College Open-Air Theatre',
    expectedFootfall: 4200,
    audienceProfile: 'College students, families, local artists, and culture enthusiasts',
    prices: [90000, 50000, 25000],
  },
  {
    organizer: 2,
    title: 'Delhi Founders Breakfast and Demo Hour',
    description: 'This morning gathering connects first-time founders with operators, designers, and local mentors. Short demos are followed by open networking over breakfast. The format is deliberately relaxed and focused on useful introductions.',
    category: 'business',
    city: 'Delhi',
    venue: 'India Habitat Centre',
    expectedFootfall: 650,
    audienceProfile: 'Startup founders, independent professionals, and early-stage teams',
    prices: [70000, 35000, 15000],
  },
  {
    organizer: 3,
    title: 'Pune Monsoon 5-a-Side Community Cup',
    description: 'Neighborhood teams will compete in a one-day five-a-side football tournament with beginner-friendly and open divisions. Spectators can enjoy local food stalls and a family viewing area. The club prioritizes fair play and broad community participation.',
    category: 'sports',
    city: 'Pune',
    venue: 'Pune District Sports Complex',
    expectedFootfall: 2400,
    audienceProfile: 'Football players, students, families, and local sports fans',
    prices: [75000, 40000, 18000],
  },
  {
    organizer: 4,
    title: 'Hyderabad Rooftop Sessions: New Voices',
    description: 'Emerging independent musicians will perform original sets across acoustic, indie, and alternative styles. The show pairs live music with a small local food pop-up. Guests can meet the artists and discover new work in an intimate venue.',
    category: 'music',
    city: 'Hyderabad',
    venue: 'Lamakaan Courtyard',
    expectedFootfall: 900,
    audienceProfile: 'Young music listeners, independent artists, and local creative communities',
    prices: [65000, 32000, 12000],
  },
  {
    organizer: 0,
    title: 'Campus Green Days: Repair and Reuse Fair',
    description: 'Campus Green Days invites students and neighbors to learn about repair, reuse, and low-waste living. Visitors can join hands-on workshops and browse local maker stalls. The program is built around practical ideas people can take home.',
    category: 'social',
    city: 'Bengaluru',
    venue: 'Bengaluru Institute of Technology Main Quad',
    expectedFootfall: 1300,
    audienceProfile: 'University students, sustainability groups, families, and local makers',
    prices: [50000, 28000, 10000],
  },
  {
    organizer: 1,
    title: 'Mumbai Product Design Exchange',
    description: 'Design students and product teams will share case studies on building useful digital and physical experiences. Small-group critiques give attendees time to exchange feedback. The event also includes a portfolio review corner for early-career designers.',
    category: 'tech',
    city: 'Mumbai',
    venue: 'St. Xavier’s College Conference Hall',
    expectedFootfall: 1100,
    audienceProfile: 'Product designers, design students, founders, and creative technologists',
    prices: [85000, 48000, 22000],
  },
  {
    organizer: 2,
    title: 'Dilli Dastangoi: Stories Across Generations',
    description: 'Local performers and storytellers will share oral histories, poetry, and contemporary retellings. The program welcomes audiences of different ages and backgrounds. A post-show conversation will give attendees a chance to meet the artists.',
    category: 'cultural',
    city: 'Delhi',
    venue: 'Kamani Auditorium',
    expectedFootfall: 1600,
    audienceProfile: 'Families, students, storytellers, and fans of performing arts',
    prices: [70000, 38000, 16000],
  },
  {
    organizer: 3,
    title: 'Pune Play Together: Open Sports Carnival',
    description: 'This community carnival offers casual badminton, throwball, relay games, and accessible activities for all ages. Teams can sign up on the day, and volunteer coaches will help newcomers join in. The event celebrates participation as much as competition.',
    category: 'social',
    city: 'Pune',
    venue: 'Deccan Gymkhana Grounds',
    expectedFootfall: 3200,
    audienceProfile: 'Families, school and college students, and recreational athletes',
    prices: [60000, 30000, 14000],
  },
  {
    organizer: 4,
    title: 'Hyderabad Indie Weekend: Sound and Street Food',
    description: 'Independent bands from across the city will share the stage for an evening of live music. A curated food lane will feature small local kitchens and makers. The society aims to make the event welcoming to first-time gig-goers.',
    category: 'music',
    city: 'Hyderabad',
    venue: 'Ravindra Bharathi Open Plaza',
    expectedFootfall: 5200,
    audienceProfile: 'Music fans, students, young professionals, and local food explorers',
    prices: [100000, 55000, 25000],
  },
  {
    organizer: 0,
    title: 'Bengaluru Climate Tech Mini-Hackathon',
    description: 'Small teams will explore practical software ideas for urban heat, energy use, and neighborhood mobility. Mentors will help participants refine prototypes during a focused weekend sprint. A final showcase highlights learning and collaboration rather than competition alone.',
    category: 'tech',
    city: 'Bengaluru',
    venue: 'Bengaluru Institute of Technology Innovation Lab',
    expectedFootfall: 780,
    audienceProfile: 'Engineering students, climate advocates, designers, and early-stage founders',
    prices: [80000, 42000, 19000],
  },
  {
    organizer: 1,
    title: 'Mumbai Harbor Lights: Community Celebration',
    description: 'Harbor Lights is an evening gathering with local performances, creative workshops, and neighborhood food stalls. Community groups will share projects and invite visitors to take part. The event is designed for residents, students, and families.',
    category: 'social',
    city: 'Mumbai',
    venue: 'Bandra Fort Amphitheatre',
    expectedFootfall: 7000,
    audienceProfile: 'Mumbai residents, families, students, and neighborhood organizations',
    prices: [95000, 52000, 24000],
  },
];

const draftEventSeeds = [
  {
    title: 'Bengaluru Makers Evening',
    description: 'A planned evening for local makers to demonstrate small projects and share how they built them. The organizing team is coordinating the venue and program with campus groups.',
    category: 'tech',
    city: 'Bengaluru',
    venue: 'Bengaluru Institute of Technology Workshop Hall',
    expectedFootfall: 500,
    audienceProfile: 'Students, hobbyists, and local makers',
  },
  {
    title: 'Campus Creators Open Mic',
    description: 'A draft community program for student performers, poets, and storytellers. The team is gathering interest before confirming the final schedule and participant lineup.',
    category: 'cultural',
    city: 'Bengaluru',
    venue: 'Bengaluru Institute of Technology Student Courtyard',
    expectedFootfall: 350,
    audienceProfile: 'Students, performers, and campus community members',
  },
];

const proposalSeeds = [
  { status: 'pending', sponsor: 0, event: 0, message: 'We would love to introduce our coffee to the student community at this summit.' },
  { status: 'pending', sponsor: 1, event: 1, message: 'We are interested in supporting the arts week and meeting creative learners.' },
  { status: 'pending', sponsor: 2, event: 2, message: 'Our team would be glad to support a founder gathering with practical wellness resources.' },
  {
    status: 'countered',
    sponsor: 0,
    event: 5,
    amount: 35000,
    counterNote: 'Could you include a staffed sampling space? We can meet at INR 35,000 instead of INR 50,000.',
    message: 'We would like to support the repair fair and introduce our neighborhood coffee range.',
  },
  {
    status: 'countered',
    sponsor: 3,
    event: 4,
    amount: 22000,
    counterNote: 'A smaller activation area works for us at INR 22,000 instead of INR 65,000.',
    message: 'Our stationery team would love to provide creative supplies for the music community.',
  },
  { status: 'accepted', sponsor: 0, event: 6, message: 'We would be excited to meet designers and share a coffee tasting at the exchange.' },
  { status: 'accepted', sponsor: 1, event: 3, message: 'We would like to support the tournament and share learning resources with participants.' },
  {
    status: 'rejected',
    sponsor: 2,
    event: 7,
    note: 'The available activation format does not fit this event’s program.',
    message: 'We are interested in supporting the storytelling program with a wellness corner.',
  },
  { status: 'withdrawn', sponsor: 3, event: 8, message: 'We would like to offer notebooks for the community sports carnival.' },
  { status: 'completed', sponsor: 0, event: 9, message: 'We are pleased to support local musicians and offer coffee to the audience.' },
];

const messageTexts = [
  'Thanks for sending the proposal. We are reviewing the tier details this week.',
  'Happy to clarify the sampling setup and share what our team can bring.',
  'That sounds helpful. I will check the venue plan and follow up shortly.',
  'Great, we can keep the activation compact and easy for the volunteers.',
];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
}

function eventTiers(category, prices) {
  const benefits = categoryBenefits[category];
  return [
    { name: 'Gold', price: prices[0], slots: 2, slotsFilled: 0, benefits: benefits.slice(0, 4) },
    { name: 'Silver', price: prices[1], slots: 3, slotsFilled: 0, benefits: benefits.slice(1, 4) },
    { name: 'Bronze', price: prices[2], slots: 4, slotsFilled: 0, benefits: benefits.slice(0, 2) },
  ];
}

async function deleteSeededData() {
  const seededUsers = await User.find({ email: demoEmailPattern }).select('_id').lean();
  const userIds = seededUsers.map(({ _id }) => _id);
  const seededEvents = userIds.length
    ? await Event.find({ organizer: { $in: userIds } }).select('_id').lean()
    : [];
  const eventIds = seededEvents.map(({ _id }) => _id);
  const proposalFilter = {
    $or: [
      { sponsor: { $in: userIds } },
      { organizer: { $in: userIds } },
      { event: { $in: eventIds } },
    ],
  };
  const seededProposals = userIds.length || eventIds.length
    ? await Proposal.find(proposalFilter).select('_id').lean()
    : [];
  const proposalIds = seededProposals.map(({ _id }) => _id);
  const proposalLinks = proposalIds.map((proposalId) => `/proposals/${proposalId.toString()}`);

  const [deliverables, messages, notifications, proposals, events, users] = await Promise.all([
    proposalIds.length
      ? Deliverable.deleteMany({ proposal: { $in: proposalIds } })
      : { deletedCount: 0 },
    proposalIds.length
      ? Message.deleteMany({ proposal: { $in: proposalIds } })
      : { deletedCount: 0 },
    Notification.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { link: { $in: proposalLinks } },
      ],
    }),
    proposalIds.length
      ? Proposal.deleteMany({ _id: { $in: proposalIds } })
      : { deletedCount: 0 },
    eventIds.length
      ? Event.deleteMany({ _id: { $in: eventIds } })
      : { deletedCount: 0 },
    userIds.length
      ? User.deleteMany({ _id: { $in: userIds } })
      : { deletedCount: 0 },
  ]);

  return {
    users: users.deletedCount,
    events: events.deletedCount,
    proposals: proposals.deletedCount,
    deliverables: deliverables.deletedCount,
    messages: messages.deletedCount,
    notifications: notifications.deletedCount,
  };
}

async function createSeedUsers(passwordHash) {
  const userDocs = [
    ...organizers.map((organizer) => ({
      ...organizer,
      role: 'organizer',
      passwordHash,
    })),
    ...sponsors.map((sponsor) => ({
      ...sponsor,
      role: 'sponsor',
      passwordHash,
    })),
  ];
  const users = await User.insertMany(userDocs);
  return new Map(users.map((user) => [user.email, user]));
}

async function createSeedEvents(userByEmail) {
  const events = [];
  for (const [index, seed] of publishedEventSeeds.entries()) {
    const startDate = daysFromNow(10 + index * 6);
    const event = await Event.create({
      organizer: userByEmail.get(organizers[seed.organizer].email)._id,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      city: seed.city,
      venue: seed.venue,
      startDate,
      endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      expectedFootfall: seed.expectedFootfall,
      audienceProfile: seed.audienceProfile,
      status: 'published',
      tiers: eventTiers(seed.category, seed.prices),
    });
    events.push(event);
  }

  const draftEvents = [];
  for (const [index, seed] of draftEventSeeds.entries()) {
    const startDate = daysFromNow(82 + index * 6);
    const event = await Event.create({
      organizer: userByEmail.get(organizers[0].email)._id,
      ...seed,
      startDate,
      endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      status: 'draft',
      tiers: eventTiers(seed.category, [55000, 28000, 12000]),
    });
    draftEvents.push(event);
  }

  return { events, draftEvents };
}

function proposalHistory(seed, sponsor, organizer, createdAt) {
  const pending = {
    from: null,
    to: 'pending',
    by: sponsor._id,
    note: 'Sponsor submitted the proposal.',
    at: createdAt,
  };
  const later = (hours) => new Date(createdAt.getTime() + hours * 60 * 60 * 1000);

  switch (seed.status) {
    case 'countered':
      return [
        pending,
        {
          from: 'pending',
          to: 'countered',
          by: organizer._id,
          note: seed.counterNote,
          at: later(6),
        },
      ];
    case 'accepted':
      return [
        pending,
        {
          from: 'pending',
          to: 'accepted',
          by: organizer._id,
          note: 'The organizer accepted the proposal.',
          at: later(8),
        },
      ];
    case 'completed':
      return [
        pending,
        {
          from: 'pending',
          to: 'accepted',
          by: organizer._id,
          note: 'The organizer accepted the proposal.',
          at: later(8),
        },
        {
          from: 'accepted',
          to: 'completed',
          by: organizer._id,
          note: 'All deliverables were approved and the deal was completed.',
          at: later(32),
        },
      ];
    case 'rejected':
      return [
        pending,
        {
          from: 'pending',
          to: 'rejected',
          by: organizer._id,
          note: seed.note,
          at: later(5),
        },
      ];
    case 'withdrawn':
      return [
        pending,
        {
          from: 'pending',
          to: 'withdrawn',
          by: sponsor._id,
          note: 'The sponsor withdrew the proposal.',
          at: later(5),
        },
      ];
    default:
      return [pending];
  }
}

async function createSeedProposals(userByEmail, events) {
  const proposalEntries = proposalSeeds.map((seed, index) => {
    const event = events[seed.event];
    const tier = event.tiers[0];
    const sponsor = userByEmail.get(sponsors[seed.sponsor].email);
    const organizer = userByEmail.get(organizers[publishedEventSeeds[seed.event].organizer].email);
    const history = proposalHistory(seed, sponsor, organizer, daysAgo(2 + (index % 3)));
    const currentAmount = seed.amount ?? tier.price;

    return {
      seed,
      event,
      tier,
      sponsor,
      organizer,
      history,
      doc: {
        event: event._id,
        tierId: tier._id,
        sponsor: sponsor._id,
        organizer: organizer._id,
        tierSnapshot: {
          name: tier.name,
          price: tier.price,
          benefits: tier.benefits,
        },
        amount: currentAmount,
        message: seed.message,
        status: seed.status,
        counterNote: seed.counterNote ?? '',
        history,
        createdAt: history[0].at,
        updatedAt: history.at(-1).at,
      },
    };
  });

  for (const entry of proposalEntries) {
    if (entry.seed.status === 'accepted' || entry.seed.status === 'completed') {
      entry.tier.slotsFilled += 1;
      if (entry.tier.slotsFilled > entry.tier.slots) {
        throw new Error(`Seed proposals exceed tier capacity for ${entry.event.title}`);
      }
    }
  }

  await Promise.all([...new Set(proposalEntries.map(({ event }) => event))]
    .map((event) => event.save()));

  const proposals = await Proposal.create(proposalEntries.map(({ doc }) => doc));
  return proposalEntries.map((entry, index) => ({
    ...entry,
    proposal: proposals[index],
  }));
}

async function createSeedDeliverables(proposalEntries) {
  const docs = [];
  const acceptedStatuses = [
    'pending',
    'delivered',
    'disputed',
    'approved',
  ];

  for (const entry of proposalEntries) {
    if (entry.seed.status !== 'accepted' && entry.seed.status !== 'completed') continue;

    for (const [index, title] of entry.tier.benefits.entries()) {
      const status = entry.seed.status === 'completed'
        ? 'approved'
        : acceptedStatuses[(index + (entry.seed.sponsor === 0 ? 0 : 1)) % acceptedStatuses.length];
      const note = status === 'delivered'
        ? 'Event-day placement has been completed; photos are being organized.'
        : status === 'disputed'
          ? 'Could we adjust the placement to be more visible near the entrance?'
          : status === 'approved'
            ? 'Reviewed and approved by the sponsor.'
            : undefined;

      docs.push({
        proposal: entry.proposal._id,
        title,
        status,
        ...(note ? { note } : {}),
        createdAt: entry.proposal.createdAt,
        updatedAt: entry.proposal.updatedAt,
      });
    }
  }

  return docs.length ? Deliverable.insertMany(docs) : [];
}

async function createSeedMessages(proposalEntries) {
  const selected = proposalEntries.filter(({ seed }) => (
    ['pending', 'countered', 'accepted', 'completed'].includes(seed.status)
  ));
  const docs = [];

  for (const [proposalIndex, entry] of selected.entries()) {
    for (let messageIndex = 0; messageIndex < 3; messageIndex += 1) {
      const sender = messageIndex % 2 === 0 ? entry.sponsor : entry.organizer;
      docs.push({
        proposal: entry.proposal._id,
        sender: sender._id,
        text: messageTexts[(proposalIndex + messageIndex) % messageTexts.length],
        createdAt: daysAgo(1 + (proposalIndex % 2), 8 + messageIndex * 2),
      });
    }
  }

  return docs.length ? Message.insertMany(docs) : [];
}

async function createSeedNotifications(userByEmail, proposalEntries) {
  const entryForStatus = (email, status, eventIndex) => proposalEntries.find((entry) => (
    entry.sponsor.email === email
      && entry.seed.status === status
      && (eventIndex === undefined || entry.seed.event === eventIndex)
  ));
  const organizerOneEmail = organizers[0].email;
  const sponsorOneEmail = sponsors[0].email;
  const notifications = [
    {
      user: userByEmail.get(organizerOneEmail)._id,
      type: 'proposal',
      text: 'Misty Mile Coffee Roasters sent a proposal for Build Bengaluru.',
      proposal: entryForStatus(sponsorOneEmail, 'pending', 0),
    },
    {
      user: userByEmail.get(organizerOneEmail)._id,
      type: 'proposal_countered',
      text: 'Misty Mile Coffee Roasters replied to your revised offer.',
      proposal: entryForStatus(sponsorOneEmail, 'countered', 5),
    },
    {
      user: userByEmail.get(sponsorOneEmail)._id,
      type: 'proposal_countered',
      text: 'Bengaluru Institute of Technology Tech Club sent a revised offer.',
      proposal: entryForStatus(sponsorOneEmail, 'countered', 5),
    },
    {
      user: userByEmail.get(sponsorOneEmail)._id,
      type: 'proposal_accepted',
      text: 'Your sponsorship proposal for Mumbai Product Design Exchange was accepted.',
      proposal: entryForStatus(sponsorOneEmail, 'accepted', 6),
    },
  ];

  return Notification.insertMany(notifications.map(({ proposal, ...notification }) => {
    if (!proposal) throw new Error('Could not link a demo notification to its proposal');
    return {
      ...notification,
      link: `/proposals/${proposal.proposal._id}`,
      read: false,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    };
  }));
}

async function seedEmbeddings(events, userByEmail) {
  if (process.env.SEED_EMBEDDINGS?.toLowerCase() !== 'true') {
    console.info('Embeddings skipped. Run npm run backfill-embeddings when ready.');
    return { attempted: 0, failed: 0 };
  }

  const tasks = [
    ...events.map((event) => ({
      label: `event "${event.title}"`,
      run: () => embedEvent(event._id),
    })),
    ...sponsors.map((sponsor) => ({
      label: `sponsor "${sponsor.organization}"`,
      run: () => embedSponsor(userByEmail.get(sponsor.email)._id),
    })),
  ];
  let failed = 0;

  for (const [index, task] of tasks.entries()) {
    try {
      if (!await task.run()) {
        failed += 1;
        console.error(`Embedding failed for ${task.label}`);
      } else {
        console.info(`Embedded ${task.label}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`Embedding failed for ${task.label}:`, error);
    }
    if (index < tasks.length - 1) await delay(700);
  }

  return { attempted: tasks.length, failed };
}

export async function seedDatabase() {
  try {
    await connectDB();
    const deleted = await deleteSeededData();
    console.info('Deleted previous demo data:', deleted);

    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const userByEmail = await createSeedUsers(passwordHash);
    const { events, draftEvents } = await createSeedEvents(userByEmail);
    const proposalEntries = await createSeedProposals(userByEmail, events);
    const deliverables = await createSeedDeliverables(proposalEntries);
    const messages = await createSeedMessages(proposalEntries);
    const notifications = await createSeedNotifications(userByEmail, proposalEntries);
    const embeddings = await seedEmbeddings(events, userByEmail);

    const proposalCounts = Object.fromEntries(
      ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed']
        .map((status) => [
          status,
          proposalEntries.filter((entry) => entry.seed.status === status).length,
        ]),
    );
    console.info('Created demo data:', {
      users: userByEmail.size,
      publishedEvents: events.length,
      draftEvents: draftEvents.length,
      proposals: proposalEntries.length,
      proposalsByStatus: proposalCounts,
      deliverables: deliverables.length,
      messages: messages.length,
      notifications: notifications.length,
      embeddings,
    });
    console.info('Demo logins:');
    console.info('Organizer: organizer1@demo.fynd / Demo@1234');
    console.info('Sponsor:   sponsor1@demo.fynd / Demo@1234');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  seedDatabase().catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  });
}
