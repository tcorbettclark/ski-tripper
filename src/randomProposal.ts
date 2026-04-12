interface Proposal {
  title?: string
  description: string
  resortName: string
  country: string
  altitudeRange: string
  nearestAirport: string
  transferTime: string
}

const PROPOSALS: Proposal[] = [
  {
    resortName: 'Verbier',
    country: 'Switzerland',
    altitudeRange: '1500m – 3330m',
    nearestAirport: 'GVA',
    transferTime: '2h 00m',
    description:
      'World-class freeride terrain across the 4 Vallées. Challenging off-piste and iconic black runs, with a lively après-ski scene in town.',
  },
  {
    resortName: "Val d'Isère",
    country: 'France',
    altitudeRange: '1850m – 3456m',
    nearestAirport: 'GVA',
    transferTime: '2h 30m',
    description:
      'Part of the Espace Killy with Tignes. Excellent snow record, varied terrain for all levels, and a charming traditional village centre.',
  },
  {
    resortName: 'Zermatt',
    country: 'Switzerland',
    altitudeRange: '1620m – 3883m',
    nearestAirport: 'GVA',
    transferTime: '3h 00m',
    description:
      'Car-free village beneath the Matterhorn. Glacier skiing, superb piste variety, and a refined atmosphere with excellent dining.',
  },
  {
    resortName: 'Courchevel 1850',
    country: 'France',
    altitudeRange: '1850m – 2738m',
    nearestAirport: 'GVA',
    transferTime: '2h 15m',
    description:
      'The jewel of the Trois Vallées. Immaculately groomed pistes, world-class restaurants, and ski-in/ski-out convenience at altitude.',
  },
  {
    resortName: 'Chamonix',
    country: 'France',
    altitudeRange: '1035m – 3842m',
    nearestAirport: 'GVA',
    transferTime: '1h 15m',
    description:
      'Iconic valley resort beneath Mont Blanc. The Vallée Blanche off-piste route is unmissable; varied terrain from beginner blues to extreme couloirs.',
  },
  {
    resortName: 'St. Anton am Arlberg',
    country: 'Austria',
    altitudeRange: '1304m – 2811m',
    nearestAirport: 'INN',
    transferTime: '1h 30m',
    description:
      "Birthplace of alpine skiing with legendary steep terrain and deep powder. The Arlberg ski area is Austria's largest, linked with Lech and Zürs.",
  },
  {
    resortName: 'Kitzbühel',
    country: 'Austria',
    altitudeRange: '762m – 2000m',
    nearestAirport: 'INN',
    transferTime: '1h 00m',
    description:
      'Medieval town with a glamorous ski scene. Home of the Hahnenkamm downhill race, with 170km of varied pistes and charming cobbled streets.',
  },
  {
    resortName: "Cortina d'Ampezzo",
    country: 'Italy',
    altitudeRange: '1224m – 2930m',
    nearestAirport: 'VCE',
    transferTime: '2h 30m',
    description:
      'The Queen of the Dolomites. Stunning scenery, wide sunny pistes, and a chic Italian atmosphere. Part of the vast Dolomiti Superski area.',
  },
  {
    resortName: 'Cervinia',
    country: 'Italy',
    altitudeRange: '2050m – 3480m',
    nearestAirport: 'GVA',
    transferTime: '3h 00m',
    description:
      'High-altitude resort with reliable snow and easy long cruising runs. Links with Zermatt over the Swiss border via the Klein Matterhorn cable car.',
  },
  {
    resortName: 'Les Arcs',
    country: 'France',
    altitudeRange: '1600m – 3226m',
    nearestAirport: 'GVA',
    transferTime: '2h 15m',
    description:
      'Purpose-built resort with car-free villages. Linked with La Plagne to form Paradiski — one of the largest ski areas in the world.',
  },
  {
    resortName: 'Tignes',
    country: 'France',
    altitudeRange: '2100m – 3456m',
    nearestAirport: 'GVA',
    transferTime: '2h 45m',
    description:
      "High-altitude resort with year-round glacier skiing on the Grande Motte. Shares the Espace Killy with Val d'Isère for over 300km of marked runs.",
  },
  {
    resortName: 'Méribel',
    country: 'France',
    altitudeRange: '1400m – 2952m',
    nearestAirport: 'GVA',
    transferTime: '2h 00m',
    description:
      'Charming chalet-style village at the heart of the Trois Vallées. Central position gives easy access to 600km of pistes across Courchevel and Val Thorens.',
  },
  {
    resortName: "Alpe d'Huez",
    country: 'France',
    altitudeRange: '1860m – 3330m',
    nearestAirport: 'GNB',
    transferTime: '1h 30m',
    description:
      'Famous for sunshine and the legendary 16km Sarenne black run. 249km of pistes with something for every ability, plus excellent snow parks.',
  },
  {
    resortName: 'Ischgl',
    country: 'Austria',
    altitudeRange: '1377m – 2872m',
    nearestAirport: 'INN',
    transferTime: '2h 00m',
    description:
      'Known as the Ibiza of the Alps for its famous après-ski. High-altitude terrain with reliable snow, linked with Samnaun in Switzerland.',
  },
  {
    resortName: 'Lech am Arlberg',
    country: 'Austria',
    altitudeRange: '1450m – 2450m',
    nearestAirport: 'INN',
    transferTime: '2h 00m',
    description:
      'Exclusive village favoured by European royalty. Varied terrain, superb snow, and the White Ring race circuit linking Lech, Zürs, and Oberlech.',
  },
  {
    resortName: 'Saas-Fee',
    country: 'Switzerland',
    altitudeRange: '1800m – 3600m',
    nearestAirport: 'GVA',
    transferTime: '3h 00m',
    description:
      'The "Pearl of the Alps" — a car-free village surrounded by thirteen 4000m peaks. Year-round glacier skiing and consistently excellent snow conditions.',
  },
  {
    resortName: 'Davos',
    country: 'Switzerland',
    altitudeRange: '1560m – 2844m',
    nearestAirport: 'ZRH',
    transferTime: '2h 15m',
    description:
      "Europe's highest city with five distinct ski areas. Linked with Klosters, offering 300km of varied pistes and a cosmopolitan resort atmosphere.",
  },
  {
    resortName: 'Livigno',
    country: 'Italy',
    altitudeRange: '1816m – 2798m',
    nearestAirport: 'BGY',
    transferTime: '3h 00m',
    description:
      'Duty-free resort in a beautiful high-altitude valley. Great value, reliable snow, and a 115km ski area popular with freestyle skiers and families.',
  },
  {
    resortName: 'Madonna di Campiglio',
    country: 'Italy',
    altitudeRange: '1550m – 2504m',
    nearestAirport: 'VRN',
    transferTime: '2h 00m',
    description:
      'Elegant Dolomite resort with a glamorous Italian feel. Part of the Skirama Dolomiti area with 150km of well-groomed runs and stunning scenery.',
  },
  {
    resortName: 'Niseko United',
    country: 'Japan',
    altitudeRange: '250m – 1308m',
    nearestAirport: 'CTS',
    transferTime: '2h 30m',
    description:
      "Legendary for its dry, light powder — Hokkaido receives some of the world's deepest annual snowfall. Four linked resorts with superb off-piste tree skiing.",
  },
  {
    resortName: 'Whistler Blackcomb',
    country: 'Canada',
    altitudeRange: '675m – 2182m',
    nearestAirport: 'YVR',
    transferTime: '2h 00m',
    description:
      "North America's largest ski area with over 200 marked runs. Epic bowls, deep powder glades, and a vibrant village atmosphere at the base.",
  },
  {
    resortName: 'Aspen Snowmass',
    country: 'USA',
    altitudeRange: '2422m – 3813m',
    nearestAirport: 'ASE',
    transferTime: '15m',
    description:
      'Four mountains in one resort — Aspen Mountain, Aspen Highlands, Buttermilk, and Snowmass. Glamorous, challenging, and with extraordinary dining.',
  },
  {
    resortName: 'Park City',
    country: 'USA',
    altitudeRange: '2103m – 3050m',
    nearestAirport: 'SLC',
    transferTime: '45m',
    description:
      "Utah's flagship resort with 7,300 acres of skiable terrain. Linked with Canyons Village, it's the largest ski resort in the USA with famous Sundance atmosphere.",
  },
  {
    resortName: 'Kronplatz',
    country: 'Italy',
    altitudeRange: '1067m – 2275m',
    nearestAirport: 'BZO',
    transferTime: '1h 00m',
    description:
      'South Tyrol sun trap with a unique plateau summit giving 360° panoramic views. 119km of pistes with excellent snow-making and a relaxed Alpine atmosphere.',
  },
  {
    resortName: 'La Grave',
    country: 'France',
    altitudeRange: '1400m – 3568m',
    nearestAirport: 'GNB',
    transferTime: '1h 30m',
    description:
      "Off-piste purists' paradise with a single two-stage cable car. No marked or groomed runs — just wild, untracked glacier terrain on the flanks of La Meije.",
  },
  {
    resortName: 'Saalbach-Hinterglemm',
    country: 'Austria',
    altitudeRange: '1003m – 2096m',
    nearestAirport: 'SZG',
    transferTime: '1h 30m',
    description:
      'The "Skicircus" links five valleys and 270km of pistes. Consistently good snow, vibrant après-ski, and a circular route that keeps all abilities entertained.',
  },
  {
    resortName: 'St. Moritz',
    country: 'Switzerland',
    altitudeRange: '1856m – 3303m',
    nearestAirport: 'ZRH',
    transferTime: '2h 45m',
    description:
      'The original luxury ski resort. Reliable sunshine, broad open pistes, and a world-famous social scene. The Engadin valley is a UNESCO World Heritage site.',
  },
  {
    resortName: 'Laax',
    country: 'Switzerland',
    altitudeRange: '1100m – 3018m',
    nearestAirport: 'ZRH',
    transferTime: '2h 15m',
    description:
      "Coolest resort in the Alps with a strong snowboard and freestyle heritage. Part of the Flims Laax Falera area with 235km of pistes and Europe's largest halfpipe.",
  },
  {
    resortName: 'Les Deux Alpes',
    country: 'France',
    altitudeRange: '1650m – 3568m',
    nearestAirport: 'GNB',
    transferTime: '2h 00m',
    description:
      'Year-round glacier skiing and a renowned summer snow park. The resort stretches across a wide plateau with 225km of runs and excellent beginner terrain.',
  },
  {
    resortName: 'Engelberg',
    country: 'Switzerland',
    altitudeRange: '1000m – 3020m',
    nearestAirport: 'ZRH',
    transferTime: '1h 15m',
    description:
      'Dominated by the Titlis glacier, Engelberg offers challenging terrain and reliable snow close to Zurich. A traditional Swiss village with a Benedictine monastery at its heart.',
  },
]

export function randomProposal(): Proposal & {
  startDate: string
  endDate: string
} {
  const proposal = PROPOSALS[Math.floor(Math.random() * PROPOSALS.length)]

  const departureStart = new Date('2026-12-01')
  const departureEnd = new Date('2027-04-15')
  const duration = Math.floor(Math.random() * 7) + 7

  const departDate = new Date(
    departureStart.getTime() +
      Math.random() * (departureEnd.getTime() - departureStart.getTime())
  )
  const endDate = new Date(
    departDate.getTime() + duration * 24 * 60 * 60 * 1000
  )

  return {
    ...proposal,
    startDate: departDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}
