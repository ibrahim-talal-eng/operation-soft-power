export const SAVE_VERSION = 1;
export const MAX_ROUNDS = 5;
export const ROUND_BUDGET = 6;
export const MAX_OPERATIONS = 2;
export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const LOW_CREDIBILITY_THRESHOLD = 35;

export const INITIAL_STATS = Object.freeze({ reach: 15, credibility: 55 });
export const INITIAL_REGIONS = Object.freeze({ europe: 40, afroasia: 40, latam: 40 });

export const REGIONS = [
  { id: 'europe', name: 'Western Europe' },
  { id: 'afroasia', name: 'Africa & Asia' },
  { id: 'latam', name: 'Latin America' }
];
export const REGION_IDS = REGIONS.map((r) => r.id);

export const ROUNDS = [
  { round: 1, year: '1956' },
  { round: 2, year: '1957' },
  { round: 3, year: '1957-1958' },
  { round: 4, year: '1960' },
  { round: 5, year: '1962' }
];

export const OPERATIONS = [
  {
    id: 'jazz',
    name: 'Jazz Ambassadors',
    description: "From 1956 the State Department sent American jazz musicians on tours abroad, beginning with Dizzy Gillespie's visit to the Middle East and the Balkans. Officials valued the music because it drew large audiences, and because many of the musicians were Black, which complicated Soviet claims about American race relations. The same fact exposed the distance between how these musicians were received overseas and how they were treated at home.",
    cost: 3,
    focus: 'reach',
    effects: { reach: 7, credibility: 2, region: 8 },
    delayed: null,
    lowCredibilityPenalty: null
  },
  {
    id: 'academic',
    name: 'Academic Exchange',
    description: "The Fulbright Act of 1946 funded scholarly exchanges partly through the sale of surplus war property abroad. Participants returned home with firsthand knowledge of the United States. The effect accumulated slowly, over years rather than months.",
    cost: 4,
    focus: 'credibility',
    effects: { reach: 2, credibility: 7, region: 5 },
    delayed: { region: 2, rounds: 1 },
    lowCredibilityPenalty: null
  },
  {
    id: 'broadcast',
    name: 'International Broadcasting',
    description: "The Voice of America began broadcasting in 1942 and was placed under the United States Information Agency in 1953. Radio crossed borders that officials could not. Listeners nonetheless judged a station by the reliability of its reports, and a record of evasion cost it its audience.",
    cost: 2,
    focus: 'reach',
    effects: { reach: 12, credibility: 0, region: 3 },
    delayed: null,
    lowCredibilityPenalty: { threshold: LOW_CREDIBILITY_THRESHOLD, credibility: -4 }
  },
  {
    id: 'hollywood',
    name: 'Hollywood Showcase',
    description: "American films were widely shown abroad before the Cold War, and after 1945 the government encouraged their export. They presented a picture of prosperity and informality that many audiences liked. Critics in Europe and elsewhere regarded the same films as commercial and shallow.",
    cost: 3,
    focus: 'reach',
    effects: { reach: 10, credibility: 1, region: 5 },
    delayed: null,
    lowCredibilityPenalty: null
  },
  {
    id: 'festival',
    name: 'Joint Cultural Festival',
    description: "Joint events with local artists and institutions treated foreign audiences as participants. They reached fewer people than radio or film. They were also harder to dismiss as one-way propaganda.",
    cost: 4,
    focus: 'credibility',
    effects: { reach: 2, credibility: 6, region: 7 },
    delayed: null,
    lowCredibilityPenalty: null
  }
];

export const STANCE_LABELS = {
  candid: 'Candid',
  promotional: 'Promotional',
  evasive: 'Evasive',
  denial: 'Denial',
  measured: 'Measured'
};

export const ENDINGS = {
  credible: {
    title: 'A Credible Superpower',
    narrative: 'You built real relationships abroad and kept America\'s message believable.'
  },
  dominance: {
    title: 'Cultural Dominance',
    narrative: 'American culture reached everywhere. Its political message was not always trusted.'
  },
  divided: {
    title: 'A House Divided',
    narrative: 'The gap between American ideals and American behavior cost you your influence.'
  },
  failed: {
    title: 'Mission Failed',
    narrative: 'You did not build enough influence or credibility.'
  }
};

export const DEBRIEF = 'Cultural programs of this period drew large audiences abroad. Events such as Little Rock in 1957 and the U-2 affair in 1960 gave foreign critics evidence that American conduct did not always match American statements. In this game those events cost credibility unless the player addressed them openly.';
