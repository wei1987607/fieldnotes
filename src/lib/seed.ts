/**
 * Sample field notes, so the app (and the demo video) has realistic content
 * on first launch. Loaded only when the user clicks "Load sample notes".
 */
import type { FieldNote } from '../types';

const now = Date.now();
const day = 86_400_000;

export const SAMPLE_NOTES: FieldNote[] = [
  {
    id: 'sample-mangrove',
    title: 'Mangrove survey — Beihai boardwalk, transect 3',
    body: 'Morning low tide, 07:40. Counted 14 white egrets and 3 grey herons along the boardwalk transect. Water at the mangrove edge smelled faintly of diesel near the fishing boat mooring — worth flagging to the reserve office. Two local fishermen said the crab catch is down about a third compared with last spring, and they blame the new dredging upstream. Noticed fresh planting rows of Kandelia candel on the east bank, roughly 60% survival by eye. Tide turned at 09:15 and the mudflat birds moved off quickly. Spoke with Ms. Liang from the village co-op: she wants the school kids to visit the nursery next month, and asked if we can print a simple identification sheet for the five common mangrove species.',
    tags: ['mangrove', 'birds', 'water-quality'],
    location: 'Beihai mangrove boardwalk, Guangxi',
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day,
    synced: false,
  },
  {
    id: 'sample-classroom',
    title: 'Classroom observation — Grade 4 reading, village primary school',
    body: 'Observed a 40-minute reading lesson with 32 pupils. The teacher used paired reading: stronger readers read aloud with a partner, then pairs swapped roles. Engagement was high for the first 20 minutes, then dipped — four pupils at the back stopped following and started chatting. The picture-book pages were too small for the back rows; the teacher said the projector bulb blew last term and has not been replaced. Three pupils asked what "tide" means during the story about the sea — none of them has seen the sea, even though the coast is only an hour away by bus. The teacher keeps a handmade word wall, very neat, but it only covers last month\'s vocabulary. She asked for a printable vocabulary sheet with pictures for the next unit on rivers and seas.',
    tags: ['classroom', 'reading', 'observation'],
    location: 'Village primary school, Qinzhou',
    createdAt: now - 1 * day,
    updatedAt: now - 1 * day,
    synced: false,
  },
  {
    id: 'sample-market',
    title: 'Night market interviews — street food vendors',
    body: 'Interviewed four vendors between 19:00 and 21:00. All four said the same thing: the new delivery apps take about 20% of their orders now, but the apps also bring customers who never walk the market. Mrs. Chen (sugarcane juice, stall 12) said her busiest hour shifted from 20:00 to 18:30 because office workers order ahead and pick up on their way home. Two vendors share one portable card reader because the rental fee is too high for one stall alone. Everyone mentioned the same problem: no cold storage overnight, so unsold skewers are thrown away. One vendor, Mr. Huang, tried a shared freezer with the stall next door last summer and said it worked — he wants to try again with three stalls splitting the electricity bill. Recorded 12 minutes of audio with Mrs. Chen (with permission) about how the market has changed since 2019.',
    tags: ['interviews', 'market', 'livelihood'],
    location: 'Night market, Nanning',
    createdAt: now - 5 * 60 * 60 * 1000,
    updatedAt: now - 5 * 60 * 60 * 1000,
    synced: false,
  },
];
