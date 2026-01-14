/**
 * IP (Intellectual Property) Validation Service
 *
 * Maintains a reject list of trademarked/copyrighted brand terms.
 * ONLY includes highly specific, unmistakable brand references.
 * Generic words that could have legitimate uses are NOT included.
 */

// Focused list - ONLY distinctive brand terms that are unmistakably IP
const REJECT_LIST: { [category: string]: string[] } = {
  // Disney - Only distinctive character/property names
  disney: [
    'mickey mouse', 'minnie mouse', 'donald duck', 'disney',
    'pixar', 'dreamworks', 'walt disney',
    'toy story', 'buzz lightyear', 'woody cowboy',
    'lion king', 'simba', 'mufasa', 'timon and pumbaa',
    'finding nemo', 'finding dory',
    'monsters inc', 'mike wazowski', 'sulley monsters',
    'frozen elsa', 'frozen anna', 'frozen olaf',
    'moana disney', 'encanto disney', 'mirabel encanto',
    'little mermaid', 'ariel mermaid',
    'aladdin disney', 'aladdin genie', 'aladdin jasmine',
    'cinderella disney', 'snow white disney', 'sleeping beauty disney',
    'beauty and the beast', 'belle disney',
    'rapunzel tangled', 'tangled disney',
    'pocahontas disney', 'mulan disney',
    'lilo and stitch', 'stitch disney', 'experiment 626',
    'winnie the pooh', 'pooh bear', 'tigger', 'piglet pooh', 'eeyore',
    'peter pan disney', 'tinkerbell', 'tinker bell',
    'bambi disney', 'dumbo disney',
    'zootopia', 'judy hopps', 'nick wilde zootopia',
    'ratatouille', 'remy ratatouille',
    'wall-e', 'walle', 'wall e robot',
    'incredibles', 'mr incredible', 'elastigirl',
    'lightning mcqueen', 'cars pixar',
    'inside out pixar', 'bing bong inside out',
    'coco pixar', 'coco disney',
    'big hero 6', 'baymax',
    'wreck it ralph', 'vanellope'
  ],

  // Marvel - Distinctive character names
  marvel: [
    'marvel', 'avengers', 'iron man', 'tony stark',
    'captain america', 'steve rogers captain',
    'spider-man', 'spiderman', 'spider man', 'peter parker spiderman', 'miles morales',
    'black panther marvel', 'wakanda forever', 't\'challa',
    'thor marvel', 'thor odinson',
    'hulk marvel', 'bruce banner hulk',
    'black widow marvel', 'natasha romanoff',
    'doctor strange', 'scarlet witch', 'wanda maximoff',
    'guardians of the galaxy', 'star-lord', 'groot', 'rocket raccoon',
    'thanos marvel', 'loki marvel',
    'x-men', 'wolverine xmen', 'magneto xmen', 'professor xavier',
    'deadpool', 'wade wilson deadpool',
    'fantastic four', 'doctor doom',
    'daredevil marvel', 'punisher marvel',
    'venom marvel', 'carnage marvel',
    'ant-man marvel', 'wasp marvel'
  ],

  // DC Comics - Distinctive character names
  dc_comics: [
    'dc comics', 'justice league',
    'batman', 'bruce wayne batman', 'gotham city batman', 'batmobile',
    'joker batman', 'harley quinn',
    'superman', 'clark kent superman', 'krypton superman', 'metropolis superman',
    'wonder woman dc', 'diana prince',
    'aquaman dc', 'flash dc comics', 'barry allen flash',
    'green lantern dc', 'green arrow dc',
    'teen titans dc', 'cyborg dc',
    'shazam dc', 'black adam dc',
    'suicide squad', 'darkseid',
    'watchmen', 'rorschach watchmen'
  ],

  // Pokemon - Distinctive names
  pokemon: [
    'pokemon', 'pokémon', 'pikachu', 'charizard', 'bulbasaur', 'charmander', 'squirtle',
    'mewtwo', 'mew pokemon', 'eevee pokemon', 'jigglypuff', 'snorlax', 'gengar pokemon',
    'ash ketchum', 'team rocket pokemon', 'pokeball', 'pokéball', 'pokedex',
    'blastoise', 'venusaur', 'raichu', 'psyduck pokemon',
    'gyarados', 'lapras pokemon', 'dragonite', 'meowth pokemon',
    'lucario', 'greninja', 'garchomp', 'rayquaza', 'groudon', 'kyogre',
    'articuno', 'zapdos', 'moltres'
  ],

  // Nintendo - Distinctive names
  nintendo: [
    'nintendo', 'super mario', 'mario bros', 'mario kart',
    'luigi mario', 'princess peach mario', 'bowser mario', 'koopa troopa',
    'yoshi nintendo', 'donkey kong', 'diddy kong',
    'legend of zelda', 'zelda link', 'link zelda', 'ganondorf', 'hyrule', 'triforce',
    'metroid', 'samus aran',
    'kirby nintendo', 'meta knight kirby', 'king dedede',
    'star fox', 'fox mccloud',
    'animal crossing nintendo', 'isabelle animal crossing', 'tom nook',
    'splatoon', 'inkling splatoon',
    'smash bros', 'super smash',
    'fire emblem nintendo'
  ],

  // Anime - Distinctive series/character names
  anime: [
    'naruto', 'sasuke naruto', 'kakashi naruto', 'hokage', 'konoha', 'akatsuki', 'sharingan',
    'one piece anime', 'luffy one piece', 'monkey d luffy', 'straw hat pirates',
    'dragon ball', 'dragonball', 'goku dragon ball', 'vegeta dragon ball', 'super saiyan', 'kamehameha',
    'attack on titan', 'eren yeager', 'mikasa ackerman', 'levi ackerman', 'survey corps',
    'demon slayer', 'kimetsu no yaiba', 'tanjiro', 'nezuko', 'hashira',
    'my hero academia', 'boku no hero', 'deku midoriya', 'all might', 'bakugo',
    'jujutsu kaisen', 'gojo satoru', 'itadori yuji', 'sukuna jujutsu',
    'hunter x hunter', 'gon freecss', 'killua zoldyck', 'hisoka hunter',
    'fullmetal alchemist', 'edward elric', 'alphonse elric',
    'death note', 'light yagami', 'ryuk death note',
    'bleach anime', 'ichigo kurosaki', 'bankai',
    'sailor moon', 'usagi sailor moon',
    'studio ghibli', 'totoro', 'spirited away', 'no face ghibli', 'howl\'s moving castle', 'princess mononoke',
    'chainsaw man', 'denji chainsaw',
    'spy x family', 'anya forger'
  ],

  // Video Games - Distinctive names
  games: [
    'fortnite', 'minecraft', 'creeper minecraft', 'enderman', 'steve minecraft',
    'roblox',
    'call of duty', 'warzone cod',
    'grand theft auto', 'gta',
    'sonic the hedgehog', 'sonic sega', 'tails sonic', 'knuckles sonic', 'dr eggman',
    'mega man', 'pac-man', 'pacman',
    'halo master chief', 'master chief',
    'god of war kratos', 'kratos',
    'the witcher', 'geralt of rivia', 'geralt witcher',
    'final fantasy', 'cloud strife', 'sephiroth', 'chocobo', 'moogle',
    'kingdom hearts', 'sora kingdom hearts', 'keyblade',
    'resident evil', 'umbrella corporation',
    'metal gear solid', 'solid snake',
    'elden ring', 'dark souls', 'bloodborne',
    'overwatch', 'league of legends',
    'world of warcraft', 'warcraft',
    'assassin\'s creed', 'ezio assassin',
    'fallout vault boy', 'vault boy', 'nuka cola',
    'elder scrolls', 'skyrim', 'dovahkiin',
    'mass effect', 'commander shepard',
    'crash bandicoot', 'spyro dragon',
    'undertale', 'sans undertale',
    'five nights at freddy\'s', 'fnaf', 'freddy fazbear',
    'genshin impact', 'paimon genshin',
    'among us game', 'among us impostor'
  ],

  // Star Wars
  star_wars: [
    'star wars', 'starwars', 'lightsaber', 'jedi knight', 'sith lord',
    'darth vader', 'luke skywalker', 'anakin skywalker',
    'obi-wan kenobi', 'obi wan kenobi',
    'yoda star wars', 'baby yoda', 'grogu',
    'mandalorian', 'boba fett', 'din djarin',
    'princess leia', 'han solo', 'chewbacca', 'millennium falcon',
    'r2-d2', 'r2d2', 'c-3po', 'c3po', 'bb-8', 'bb8',
    'kylo ren', 'palpatine emperor', 'darth maul', 'darth sidious',
    'stormtrooper', 'death star', 'x-wing fighter',
    'clone trooper', 'clone wars',
    'ahsoka tano'
  ],

  // Harry Potter
  harry_potter: [
    'harry potter', 'hogwarts', 'wizarding world',
    'hermione granger', 'ron weasley', 'dumbledore',
    'voldemort', 'he who must not be named',
    'severus snape', 'draco malfoy', 'hagrid',
    'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff',
    'quidditch', 'golden snitch',
    'horcrux', 'deathly hallows', 'elder wand',
    'expecto patronum', 'avada kedavra', 'wingardium leviosa',
    'diagon alley', 'platform 9 3/4', 'azkaban',
    'dobby house elf', 'hedwig owl',
    'fantastic beasts', 'newt scamander'
  ],

  // Lord of the Rings
  lotr: [
    'lord of the rings', 'lotr', 'middle earth tolkien',
    'frodo baggins', 'samwise gamgee', 'bilbo baggins',
    'gandalf', 'aragorn', 'legolas', 'gimli',
    'gollum', 'smeagol', 'my precious ring',
    'sauron', 'mordor', 'eye of sauron',
    'mount doom', 'the shire', 'rivendell', 'minas tirith',
    'nazgul', 'ringwraith', 'balrog',
    'one ring to rule', 'ring of power tolkien'
  ],

  // Major Distinctive Brands
  brands: [
    'coca cola', 'coca-cola',
    'mcdonalds logo', 'mcdonald\'s logo',
    'nike swoosh', 'nike logo',
    'adidas logo', 'adidas stripes',
    'louis vuitton', 'gucci logo',
    'ferrari logo', 'lamborghini logo',
    'starbucks logo', 'starbucks mermaid',
    'apple logo', 'apple inc'
  ],

  // TV Shows - Distinctive names only
  tv_shows: [
    'game of thrones', 'house of the dragon', 'iron throne',
    'daenerys targaryen', 'jon snow got', 'tyrion lannister', 'white walkers got',
    'stranger things', 'demogorgon', 'upside down stranger',
    'breaking bad', 'walter white', 'heisenberg breaking bad',
    'the office dunder mifflin', 'michael scott office', 'dwight schrute',
    'simpsons', 'homer simpson', 'bart simpson',
    'family guy', 'peter griffin', 'stewie griffin',
    'south park', 'cartman south park',
    'rick and morty', 'pickle rick',
    'spongebob', 'spongebob squarepants', 'patrick star spongebob', 'bikini bottom',
    'avatar the last airbender', 'aang avatar', 'appa avatar',
    'adventure time cartoon', 'finn and jake',
    'gravity falls', 'bill cipher',
    'peppa pig', 'paw patrol', 'bluey cartoon', 'cocomelon',
    'scooby doo', 'scooby-doo', 'mystery machine',
    'looney tunes', 'bugs bunny', 'daffy duck',
    'tom and jerry cartoon',
    'powerpuff girls',
    'squid game', 'squid game player'
  ],

  // Music - Only very distinctive names/terms
  music: [
    'taylor swift', 'swiftie', 'eras tour',
    'beyonce', 'beyoncé',
    'bts kpop', 'bts army', 'bangtan',
    'blackpink kpop',
    'beatles band', 'the beatles'
  ]
};

// Flatten the reject list for efficient searching
const FLAT_REJECT_LIST: string[] = Object.values(REJECT_LIST).flat();

export interface ValidationResult {
  isValid: boolean;
  violatedTerms: string[];
  category?: string;
  message: string;
}

/**
 * Validates a prompt against the IP reject list
 * @param prompt - The user's prompt to validate
 * @returns ValidationResult object with validation status and details
 */
export function validatePrompt(prompt: string): ValidationResult {
  if (!prompt || typeof prompt !== 'string') {
    return {
      isValid: true,
      violatedTerms: [],
      message: 'Empty or invalid prompt'
    };
  }

  const normalizedPrompt = prompt.toLowerCase().trim();
  const violatedTerms: string[] = [];
  let violatedCategory: string | undefined;

  // Check each category for violations
  for (const [category, terms] of Object.entries(REJECT_LIST)) {
    for (const term of terms) {
      const termLower = term.toLowerCase();
      // Use word boundary check for more accurate matching
      const pattern = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

      if (pattern.test(normalizedPrompt)) {
        if (!violatedTerms.includes(term)) {
          violatedTerms.push(term);
        }
        if (!violatedCategory) {
          violatedCategory = category;
        }
      }
    }
  }

  if (violatedTerms.length > 0) {
    return {
      isValid: false,
      violatedTerms,
      category: violatedCategory,
      message: `Prompt contains protected brand/IP terms: ${violatedTerms.slice(0, 3).join(', ')}${violatedTerms.length > 3 ? ` and ${violatedTerms.length - 3} more` : ''}`
    };
  }

  return {
    isValid: true,
    violatedTerms: [],
    message: 'Prompt is valid'
  };
}

/**
 * Quick check if a prompt contains any blocked terms
 * @param prompt - The user's prompt to check
 * @returns boolean - true if prompt is clean, false if it contains blocked terms
 */
export function isPromptClean(prompt: string): boolean {
  return validatePrompt(prompt).isValid;
}

/**
 * Gets the full reject list organized by category
 * @returns Object with categories and their terms
 */
export function getRejectList(): { [category: string]: string[] } {
  return { ...REJECT_LIST };
}

/**
 * Gets all reject terms as a flat array
 * @returns Array of all rejected terms
 */
export function getAllRejectTerms(): string[] {
  return [...FLAT_REJECT_LIST];
}

/**
 * Adds a new term to the reject list (runtime only, not persisted)
 * @param term - The term to add
 * @param category - The category to add it to (default: 'custom')
 */
export function addRejectTerm(term: string, category: string = 'custom'): void {
  if (!REJECT_LIST[category]) {
    REJECT_LIST[category] = [];
  }
  const termLower = term.toLowerCase();
  if (!REJECT_LIST[category].includes(termLower)) {
    REJECT_LIST[category].push(termLower);
    FLAT_REJECT_LIST.push(termLower);
  }
}

/**
 * Validates multiple image IDs against their stored prompts
 * Used for checking orders before fulfillment
 * @param imageIds - Array of GeneratedImage IDs to check
 * @param prisma - Prisma client instance
 * @returns Array of validation results for each image
 */
export async function validateImagePrompts(
  imageIds: number[],
  prisma: any
): Promise<{ imageId: number; validation: ValidationResult }[]> {
  const images = await prisma.generatedImage.findMany({
    where: { id: { in: imageIds } },
    select: { id: true, prompt: true }
  });

  return images.map((image: { id: number; prompt: string }) => ({
    imageId: image.id,
    validation: validatePrompt(image.prompt)
  }));
}
