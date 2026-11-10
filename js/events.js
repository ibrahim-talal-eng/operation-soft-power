const commons = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800`;

export const EVENTS = [
  {
    id: 'suez',
    round: 1,
    date: '1956',
    title: 'The Suez Crisis',
    image: commons('British tanks in Port Said.jpg'),
    background: "In July 1956 Egypt nationalized the Suez Canal Company. In late October Israel invaded the Sinai, and Britain and France intervened militarily, ostensibly to separate the combatants and secure the canal. The Eisenhower administration opposed the action and pressed its allies to withdraw. At the same time the Soviet Union was suppressing the Hungarian uprising. Washington had to condemn Soviet conduct while visibly disagreeing with its NATO allies, and governments in Africa and Asia were watching for signs of colonial attitudes.",
    choices: [
      {
        id: 'a',
        label: 'Emphasize sovereignty and diplomacy',
        stance: 'candid',
        effects: { credibility: 7, reach: 2, regions: { afroasia: 5 } }
      },
      {
        id: 'b',
        label: 'Focus messaging on Cold War competition',
        stance: 'promotional',
        effects: { reach: 6, credibility: -3, regions: { europe: 2 } }
      },
      {
        id: 'c',
        label: 'Avoid taking a prominent public position',
        stance: 'evasive',
        effects: { credibility: -1 }
      }
    ]
  },
  {
    id: 'littlerock',
    round: 2,
    date: '1957',
    title: 'The American Contradiction',
    image: commons('Operation Arkansas, Little Rock Nine.jpg'),
    background: "In September 1957 Governor Orval Faubus used the Arkansas National Guard to prevent nine Black students from entering Little Rock Central High School, despite a federal court order. President Eisenhower federalized the Guard and sent soldiers of the 101st Airborne Division, the first use of federal troops to enforce desegregation since Reconstruction. Photographs of the confrontation appeared in newspapers abroad, and Soviet media cited them against American claims about freedom.",
    choices: [
      {
        id: 'a',
        label: 'Reaffirm equality and federal enforcement',
        stance: 'candid',
        effects: { credibility: 10, reach: -2, allRegions: 2 }
      },
      {
        id: 'b',
        label: 'Dismiss criticism as Soviet propaganda',
        stance: 'denial',
        effects: { reach: 5, credibility: -10 }
      },
      {
        id: 'c',
        label: 'Highlight progress while acknowledging remaining problems',
        stance: 'measured',
        effects: { credibility: 5, reach: 2 }
      }
    ]
  },
  {
    id: 'sputnik',
    round: 3,
    date: '1957-1958',
    title: 'The Sputnik Shock',
    image: commons('Sputnik asm.jpg'),
    background: "The Soviet Union launched Sputnik 1, the first artificial satellite, on 4 October 1957. The launch undermined the assumption that the United States led in science and technology, and it raised the prestige of the Soviet system abroad. In the United States it produced public alarm and, in 1958, the National Defense Education Act and the creation of NASA.",
    choices: [
      {
        id: 'a',
        label: 'Invest in educational and scientific cooperation',
        stance: 'candid',
        effects: { credibility: 6, reach: 3, allRegions: 2 }
      },
      {
        id: 'b',
        label: 'Intensify American promotional messaging',
        stance: 'promotional',
        effects: { reach: 9, credibility: -2 }
      },
      {
        id: 'c',
        label: 'Emphasize existing American cultural achievements',
        stance: 'measured',
        effects: { reach: 4, credibility: 2 }
      }
    ]
  },
  {
    id: 'u2',
    round: 4,
    date: '1960',
    title: 'The U-2 Incident',
    image: commons('U-2 Spy Plane With Fictitious NASA Markings - GPN-2000-000112.jpg'),
    background: "On 1 May 1960 a U-2 reconnaissance aircraft flown by Francis Gary Powers was shot down over the Soviet Union. The administration first said that a NASA weather research aircraft had strayed off course after its pilot reported oxygen problems. On 7 May Premier Khrushchev announced that the pilot was alive and the wreckage recovered. President Eisenhower then acknowledged the reconnaissance flights, and the Paris summit that opened later in May collapsed.",
    choices: [
      {
        id: 'a',
        label: 'Acknowledge the incident and defend national security',
        stance: 'candid',
        effects: { credibility: 5, reach: -2 }
      },
      {
        id: 'b',
        label: 'Continue denying the allegations',
        stance: 'denial',
        effects: { reach: 5, credibility: -12 }
      },
      {
        id: 'c',
        label: 'Redirect attention toward American cultural achievements',
        stance: 'evasive',
        effects: { reach: 4, credibility: -2 }
      }
    ]
  },
  {
    id: 'cuba',
    round: 5,
    date: '1962',
    title: 'The Cuban Missile Crisis',
    image: commons('U2 Image of Cuban Missile Crisis.jpg'),
    background: "In October 1962 American reconnaissance aircraft photographed Soviet medium-range missile sites under construction in Cuba. On 22 October President Kennedy announced a naval quarantine of the island. After several days of negotiation the Soviet Union agreed to remove the missiles, and the United States privately agreed to remove its own missiles from Turkey. Many governments, including American allies, feared that the confrontation could lead to nuclear war, and the crisis raised questions about American judgment as well as American strength.",
    choices: [
      {
        id: 'a',
        label: 'Emphasize diplomatic communication and peaceful resolution',
        stance: 'candid',
        effects: { credibility: 8, reach: 2, allRegions: 2 }
      },
      {
        id: 'b',
        label: 'Emphasize American military resolve',
        stance: 'promotional',
        effects: { reach: 6, credibility: -4, regions: { europe: 2 } }
      },
      {
        id: 'c',
        label: 'Avoid escalating rhetoric and focus on stability',
        stance: 'measured',
        effects: { credibility: 4, reach: -2, regions: { afroasia: 2 } }
      }
    ]
  }
];

export function getEvent(round) {
  return EVENTS.find((e) => e.round === round) || null;
}

export function getChoice(round, choiceId) {
  const event = getEvent(round);
  return event ? event.choices.find((c) => c.id === choiceId) || null : null;
}
