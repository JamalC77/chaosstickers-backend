/**
 * IP (Intellectual Property) Validation Service
 *
 * Maintains a reject list of trademarked/copyrighted brand terms
 * and validates prompts against them to prevent IP infringement.
 */

// Comprehensive list of brand/IP terms to reject
// Organized by category for maintainability
const REJECT_LIST: { [category: string]: string[] } = {
  // Entertainment Companies & Studios
  entertainment: [
    'disney', 'pixar', 'dreamworks', 'warner bros', 'warner brothers',
    'universal', 'paramount', 'sony pictures', 'lionsgate', 'mgm',
    'nickelodeon', 'cartoon network', 'netflix', 'hbo', 'hulu',
    'studio ghibli', 'ghibli', 'illumination', 'laika', 'aardman',
    'blue sky studios', 'lucasfilm', '20th century', 'fox studios'
  ],

  // Disney Properties & Characters
  disney_properties: [
    'mickey mouse', 'minnie mouse', 'donald duck', 'goofy', 'pluto',
    'frozen', 'elsa', 'anna', 'olaf', 'moana', 'maui',
    'lion king', 'simba', 'nala', 'mufasa', 'scar', 'timon', 'pumbaa',
    'little mermaid', 'ariel', 'sebastian', 'flounder', 'ursula',
    'beauty and the beast', 'belle', 'beast', 'gaston', 'lumiere',
    'aladdin', 'jasmine', 'genie', 'jafar', 'abu',
    'cinderella', 'snow white', 'sleeping beauty', 'aurora',
    'rapunzel', 'tangled', 'flynn rider', 'pascal',
    'pocahontas', 'mulan', 'mushu', 'tiana', 'princess and the frog',
    'lilo and stitch', 'stitch', 'lilo', 'experiment 626',
    'toy story', 'woody', 'buzz lightyear', 'jessie', 'rex', 'slinky',
    'finding nemo', 'finding dory', 'nemo', 'dory', 'marlin',
    'monsters inc', 'mike wazowski', 'sulley', 'boo', 'randall',
    'incredibles', 'mr incredible', 'elastigirl', 'jack jack', 'violet', 'dash',
    'cars', 'lightning mcqueen', 'mater', 'doc hudson',
    'ratatouille', 'remy', 'linguini', 'colette',
    'wall-e', 'wall e', 'eve', 'walle',
    'up', 'carl', 'russell', 'dug', 'kevin',
    'inside out', 'joy', 'sadness', 'anger', 'fear', 'disgust', 'bing bong',
    'coco', 'miguel', 'hector', 'ernesto de la cruz',
    'encanto', 'mirabel', 'bruno', 'isabela', 'luisa', 'dolores',
    'zootopia', 'judy hopps', 'nick wilde', 'chief bogo',
    'brave', 'merida', 'turning red', 'mei lee',
    'soul', 'joe gardner', '22', 'luca', 'alberto',
    'elemental', 'ember', 'wade',
    'winnie the pooh', 'pooh bear', 'piglet', 'tigger', 'eeyore', 'rabbit', 'kanga', 'roo',
    'bambi', 'thumper', 'dumbo', 'peter pan', 'tinkerbell', 'tinker bell',
    'alice in wonderland', 'mad hatter', 'cheshire cat', 'queen of hearts',
    'hercules', 'megara', 'hades', 'philoctetes',
    'tarzan', 'jane', 'emperor\'s new groove', 'kuzco', 'kronk', 'yzma',
    'atlantis', 'treasure planet', 'brother bear', 'chicken little',
    'bolt', 'meet the robinsons', 'big hero 6', 'baymax', 'hiro',
    'wreck it ralph', 'vanellope', 'ralph breaks the internet',
    'strange world', 'wish', 'asha'
  ],

  // Marvel/DC Comics
  comics: [
    'marvel', 'avengers', 'iron man', 'tony stark', 'captain america', 'steve rogers',
    'thor', 'hulk', 'bruce banner', 'black widow', 'natasha romanoff',
    'hawkeye', 'clint barton', 'spider-man', 'spiderman', 'spider man', 'peter parker', 'miles morales',
    'black panther', 't\'challa', 'wakanda', 'shuri', 'okoye',
    'doctor strange', 'scarlet witch', 'wanda maximoff', 'vision',
    'ant-man', 'wasp', 'falcon', 'winter soldier', 'bucky barnes',
    'guardians of the galaxy', 'star-lord', 'gamora', 'drax', 'rocket raccoon', 'groot',
    'thanos', 'loki', 'ultron', 'hela', 'kang',
    'x-men', 'xmen', 'wolverine', 'cyclops', 'jean grey', 'storm', 'magneto', 'professor x', 'rogue', 'gambit',
    'deadpool', 'wade wilson', 'cable', 'domino',
    'fantastic four', 'mister fantastic', 'invisible woman', 'human torch', 'the thing', 'doctor doom',
    'daredevil', 'matt murdock', 'punisher', 'frank castle', 'jessica jones', 'luke cage',
    'moon knight', 'ms marvel', 'kamala khan', 'she-hulk', 'jennifer walters',
    'blade', 'ghost rider', 'silver surfer', 'eternals', 'shang-chi',
    'dc comics', 'dc universe', 'justice league',
    'batman', 'bruce wayne', 'robin', 'batgirl', 'nightwing', 'gotham', 'joker', 'harley quinn',
    'catwoman', 'penguin', 'riddler', 'two-face', 'poison ivy', 'bane', 'scarecrow', 'mr freeze',
    'superman', 'clark kent', 'supergirl', 'krypton', 'lex luthor', 'metropolis', 'lois lane',
    'wonder woman', 'diana prince', 'amazon', 'themyscira',
    'aquaman', 'arthur curry', 'mera', 'atlantis',
    'flash', 'barry allen', 'wally west', 'reverse flash', 'zoom',
    'green lantern', 'hal jordan', 'green arrow', 'oliver queen', 'black canary',
    'cyborg', 'raven', 'starfire', 'beast boy', 'teen titans',
    'shazam', 'captain marvel', 'black adam', 'hawkgirl', 'hawkman',
    'constantine', 'zatanna', 'swamp thing', 'martian manhunter',
    'darkseid', 'apokolips', 'deathstroke', 'watchmen', 'rorschach',
    'suicide squad', 'peacemaker', 'bloodsport', 'king shark'
  ],

  // Pokemon
  pokemon: [
    'pokemon', 'pokémon', 'pikachu', 'charizard', 'bulbasaur', 'charmander', 'squirtle',
    'mewtwo', 'mew', 'eevee', 'jigglypuff', 'snorlax', 'gengar', 'dragonite',
    'articuno', 'zapdos', 'moltres', 'legendary pokemon',
    'ash ketchum', 'misty', 'brock', 'team rocket', 'jessie james meowth',
    'pokedex', 'pokeball', 'pokéball', 'poke ball', 'gym leader', 'pokemon trainer',
    'blastoise', 'venusaur', 'raichu', 'meowth', 'psyduck', 'machamp',
    'gyarados', 'lapras', 'ditto', 'vaporeon', 'jolteon', 'flareon',
    'espeon', 'umbreon', 'lucario', 'garchomp', 'greninja', 'mimikyu',
    'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina',
    'arceus', 'darkrai', 'celebi', 'jirachi', 'deoxys', 'lugia', 'ho-oh',
    'zekrom', 'reshiram', 'kyurem', 'xerneas', 'yveltal', 'zygarde',
    'solgaleo', 'lunala', 'necrozma', 'zacian', 'zamazenta', 'eternatus',
    'koraidon', 'miraidon', 'paldea', 'galar', 'alola', 'kalos', 'unova', 'sinnoh', 'hoenn', 'johto', 'kanto'
  ],

  // Nintendo
  nintendo: [
    'nintendo', 'mario', 'super mario', 'luigi', 'princess peach', 'bowser', 'koopa',
    'toad', 'yoshi', 'wario', 'waluigi', 'donkey kong', 'diddy kong',
    'mario kart', 'mario bros', 'mario party', 'paper mario', 'mario odyssey',
    'zelda', 'legend of zelda', 'link', 'ganon', 'ganondorf', 'hyrule', 'triforce',
    'sheik', 'princess zelda', 'breath of the wild', 'tears of the kingdom', 'ocarina',
    'metroid', 'samus', 'samus aran', 'ridley', 'mother brain',
    'kirby', 'meta knight', 'king dedede', 'waddle dee',
    'star fox', 'fox mccloud', 'falco', 'slippy', 'peppy', 'arwing',
    'f-zero', 'captain falcon',
    'fire emblem', 'marth', 'ike', 'roy', 'byleth', 'chrom', 'lucina', 'corrin',
    'animal crossing', 'isabelle', 'tom nook', 'k.k. slider', 'villager', 'nook',
    'splatoon', 'inkling', 'octoling', 'squid sisters', 'callie', 'marie',
    'pikmin', 'olimar', 'louie', 'xenoblade', 'shulk', 'pyra', 'mythra',
    'smash bros', 'super smash', 'amiibo',
    'earthbound', 'ness', 'lucas', 'mother 3',
    'kid icarus', 'pit', 'palutena', 'arms', 'min min',
    'nintendo switch', 'game boy', 'wii', 'wii u', 'gamecube', 'n64'
  ],

  // Anime/Manga
  anime: [
    'naruto', 'sasuke', 'sakura', 'kakashi', 'hokage', 'konoha', 'akatsuki', 'sharingan', 'byakugan',
    'one piece', 'luffy', 'monkey d luffy', 'zoro', 'nami', 'sanji', 'straw hat', 'going merry', 'thousand sunny',
    'dragon ball', 'dragonball', 'goku', 'vegeta', 'frieza', 'piccolo', 'gohan', 'trunks', 'cell', 'buu',
    'super saiyan', 'kamehameha', 'capsule corp', 'shenron',
    'attack on titan', 'eren yeager', 'mikasa', 'levi', 'titan', 'survey corps', 'colossal titan',
    'demon slayer', 'kimetsu no yaiba', 'tanjiro', 'nezuko', 'zenitsu', 'inosuke', 'hashira',
    'my hero academia', 'boku no hero', 'deku', 'izuku midoriya', 'all might', 'bakugo', 'todoroki', 'ua',
    'jujutsu kaisen', 'gojo', 'itadori', 'yuji', 'sukuna', 'megumi', 'nobara',
    'hunter x hunter', 'gon', 'killua', 'kurapika', 'leorio', 'hisoka', 'phantom troupe',
    'fullmetal alchemist', 'edward elric', 'alphonse', 'mustang', 'homunculus',
    'death note', 'light yagami', 'l', 'ryuk', 'misa',
    'bleach', 'ichigo', 'rukia', 'soul reaper', 'hollow', 'bankai', 'zanpakuto',
    'fairy tail', 'natsu', 'lucy heartfilia', 'erza', 'gray',
    'sword art online', 'kirito', 'asuna', 'sao',
    'tokyo ghoul', 'kaneki', 'one punch man', 'saitama', 'genos',
    'mob psycho', 'shigeo', 'cowboy bebop', 'spike spiegel', 'faye', 'jet', 'ein',
    'neon genesis evangelion', 'evangelion', 'shinji', 'rei', 'asuka', 'nerv', 'eva unit',
    'sailor moon', 'usagi', 'tuxedo mask', 'sailor scouts', 'luna',
    'cardcaptor sakura', 'inuyasha', 'kagome', 'sesshomaru',
    'yu-gi-oh', 'yugioh', 'yugi', 'kaiba', 'exodia', 'blue eyes white dragon',
    'chainsaw man', 'denji', 'power', 'makima', 'aki',
    'spy x family', 'anya', 'loid', 'yor', 'bond',
    'bocchi the rock', 'frieren', 'oshi no ko', 'hoshino ai',
    'violet evergarden', 'dororo', 'vinland saga', 'thorfinn',
    'studio ghibli', 'totoro', 'no face', 'spirited away', 'chihiro', 'howl', 'ponyo', 'kiki',
    'princess mononoke', 'san', 'ashitaka', 'castle in the sky', 'nausicaa'
  ],

  // Video Games
  games: [
    'playstation', 'xbox', 'sony', 'microsoft gaming', 'activision', 'blizzard', 'ea', 'electronic arts',
    'ubisoft', 'rockstar', 'bethesda', 'capcom', 'konami', 'sega', 'bandai namco', 'square enix',
    'fortnite', 'epic games', 'minecraft', 'steve minecraft', 'creeper', 'enderman', 'ender dragon',
    'roblox', 'robux', 'adopt me',
    'call of duty', 'cod', 'warzone', 'ghost', 'price', 'soap',
    'grand theft auto', 'gta', 'los santos', 'vice city', 'san andreas',
    'red dead redemption', 'arthur morgan', 'john marston',
    'the witcher', 'witcher', 'geralt', 'yennefer', 'ciri', 'triss',
    'cyberpunk', 'cyberpunk 2077', 'v', 'johnny silverhand',
    'halo', 'master chief', 'cortana', 'spartan', 'covenant', 'unsc',
    'gears of war', 'marcus fenix', 'locust',
    'god of war', 'kratos', 'atreus', 'boy', 'ragnarok',
    'horizon zero dawn', 'aloy', 'horizon forbidden west',
    'last of us', 'joel', 'ellie', 'tlou', 'cordyceps',
    'uncharted', 'nathan drake', 'sully',
    'ghost of tsushima', 'jin sakai',
    'final fantasy', 'cloud strife', 'sephiroth', 'tifa', 'aerith', 'chocobo', 'moogle', 'ff7', 'ffxiv',
    'kingdom hearts', 'sora', 'riku', 'kairi', 'keyblade', 'heartless', 'nobody', 'organization xiii',
    'resident evil', 'leon kennedy', 'jill valentine', 'chris redfield', 'umbrella corp', 'raccoon city',
    'street fighter', 'ryu', 'ken', 'chun li', 'guile', 'hadouken',
    'mortal kombat', 'scorpion', 'sub zero', 'liu kang', 'fatality',
    'tekken', 'kazuya', 'jin kazama', 'heihachi',
    'sonic', 'sonic the hedgehog', 'tails', 'knuckles', 'dr eggman', 'robotnik', 'shadow the hedgehog', 'amy rose',
    'mega man', 'rockman', 'mega man x',
    'pac man', 'pac-man', 'pacman', 'ms pac man',
    'metal gear', 'solid snake', 'big boss', 'raiden', 'ocelot',
    'silent hill', 'pyramid head',
    'dark souls', 'elden ring', 'bloodborne', 'sekiro', 'fromsoft', 'fromsoftware', 'soulslike',
    'destiny', 'guardian', 'traveler', 'cabal', 'fallen',
    'overwatch', 'tracer', 'genji', 'mercy', 'reinhardt', 'widowmaker', 'd.va',
    'league of legends', 'lol', 'ahri', 'jinx', 'yasuo', 'teemo', 'lux', 'arcane',
    'valorant', 'jett', 'sage', 'phoenix', 'reyna', 'killjoy',
    'dota', 'dota 2', 'counter strike', 'csgo', 'cs2',
    'world of warcraft', 'wow', 'azeroth', 'horde', 'alliance', 'thrall', 'sylvanas', 'arthas', 'lich king',
    'diablo', 'starcraft', 'hearthstone',
    'apex legends', 'titanfall',
    'borderlands', 'claptrap', 'handsome jack',
    'bioshock', 'big daddy', 'little sister', 'rapture', 'columbia',
    'assassin\'s creed', 'ezio', 'altair', 'desmond', 'bayek', 'eivor', 'kassandra',
    'far cry', 'watch dogs', 'rainbow six', 'tom clancy',
    'fallout', 'vault boy', 'vault dweller', 'wasteland', 'nuka cola', 'pip boy',
    'elder scrolls', 'skyrim', 'dovahkiin', 'dragonborn', 'oblivion', 'morrowind',
    'mass effect', 'commander shepard', 'garrus', 'tali', 'liara', 'normandy',
    'dragon age', 'baldur\'s gate',
    'persona', 'joker', 'phantom thieves', 'persona 5', 'morgana',
    'crash bandicoot', 'spyro', 'ratchet and clank', 'jak and daxter', 'sly cooper',
    'little big planet', 'sackboy',
    'hollow knight', 'undertale', 'sans', 'papyrus', 'frisk', 'deltarune',
    'cuphead', 'mugman', 'hades', 'zagreus', 'celeste', 'madeline',
    'stardew valley', 'terraria', 'among us', 'impostor', 'crewmate',
    'fall guys', 'rocket league',
    'five nights at freddy\'s', 'fnaf', 'freddy fazbear', 'foxy', 'bonnie', 'chica',
    'bendy', 'bendy and the ink machine', 'cuphead',
    'genshin impact', 'paimon', 'traveler', 'teyvat', 'mondstadt', 'liyue', 'inazuma',
    'honkai', 'star rail', 'zenless zone zero'
  ],

  // Star Wars
  star_wars: [
    'star wars', 'starwars', 'jedi', 'sith', 'lightsaber', 'force awakens',
    'luke skywalker', 'darth vader', 'anakin', 'obi-wan', 'obi wan', 'kenobi',
    'yoda', 'baby yoda', 'grogu', 'mandalorian', 'mando', 'boba fett', 'din djarin',
    'princess leia', 'leia organa', 'han solo', 'chewbacca', 'chewie', 'wookiee',
    'r2-d2', 'r2d2', 'c-3po', 'c3po', 'bb-8', 'bb8',
    'kylo ren', 'rey skywalker', 'palpatine', 'emperor', 'darth sidious', 'darth maul',
    'count dooku', 'general grievous', 'ahsoka', 'tano', 'padme', 'amidala',
    'mace windu', 'qui-gon', 'qui gon jinn',
    'stormtrooper', 'clone trooper', 'death star', 'millennium falcon', 'x-wing', 'tie fighter',
    'tatooine', 'coruscant', 'naboo', 'hoth', 'endor', 'dagobah', 'bespin',
    'galactic empire', 'rebel alliance', 'resistance', 'first order', 'trade federation',
    'clone wars', 'bad batch', 'rebels', 'andor', 'acolyte',
    'jabba', 'hutt', 'ewok', 'wampa', 'sarlacc', 'rancor',
    'grand moff tarkin', 'admiral ackbar', 'lando calrissian',
    'empire strikes back', 'return of the jedi', 'phantom menace', 'attack of the clones', 'revenge of the sith'
  ],

  // Harry Potter/Wizarding World
  harry_potter: [
    'harry potter', 'hogwarts', 'hogwarts legacy', 'wizarding world',
    'hermione', 'ron weasley', 'dumbledore', 'albus', 'severus snape', 'snape',
    'voldemort', 'he who must not be named', 'tom riddle', 'death eater',
    'hagrid', 'draco malfoy', 'malfoy', 'lucius', 'bellatrix', 'lestrange',
    'sirius black', 'remus lupin', 'neville longbottom', 'luna lovegood',
    'ginny weasley', 'fred and george', 'weasley twins', 'molly weasley', 'arthur weasley',
    'mcgonagall', 'flitwick', 'sprout', 'moody', 'mad-eye',
    'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff', 'house cup',
    'quidditch', 'golden snitch', 'bludger', 'quaffle', 'nimbus', 'firebolt',
    'horcrux', 'deathly hallows', 'elder wand', 'invisibility cloak', 'resurrection stone',
    'philosopher\'s stone', 'sorcerer\'s stone', 'chamber of secrets', 'prisoner of azkaban',
    'goblet of fire', 'order of the phoenix', 'half-blood prince',
    'patronus', 'expecto patronum', 'avada kedavra', 'expelliarmus', 'lumos', 'wingardium leviosa',
    'diagon alley', 'hogsmeade', 'azkaban', 'ministry of magic', 'platform 9 3/4',
    'dobby', 'hedwig', 'fawkes', 'buckbeak', 'nagini', 'basilisk',
    'fantastic beasts', 'newt scamander', 'grindelwald', 'niffler', 'bowtruckle',
    'butterbeer', 'bertie botts', 'chocolate frog'
  ],

  // Lord of the Rings/Tolkien
  lotr: [
    'lord of the rings', 'lotr', 'tolkien', 'middle earth', 'middle-earth',
    'frodo', 'frodo baggins', 'samwise', 'sam gamgee', 'bilbo', 'bilbo baggins',
    'gandalf', 'aragorn', 'legolas', 'gimli', 'boromir', 'faramir',
    'gollum', 'smeagol', 'my precious', 'precious',
    'sauron', 'saruman', 'mordor', 'mount doom', 'eye of sauron',
    'shire', 'hobbiton', 'rivendell', 'lothlorien', 'minas tirith', 'gondor', 'rohan',
    'isengard', 'orthanc', 'barad-dur',
    'merry', 'meriadoc', 'pippin', 'peregrin took',
    'elrond', 'galadriel', 'arwen', 'eowyn', 'theoden', 'eomer',
    'treebeard', 'ent', 'balrog', 'nazgul', 'ringwraith', 'witch king',
    'orc', 'uruk-hai', 'warg', 'mumakil', 'oliphaunt', 'shelob',
    'one ring', 'ring of power', 'rings of power', 'fellowship',
    'hobbit', 'thorin', 'oakenshield', 'smaug', 'lonely mountain', 'erebor',
    'thranduil', 'bard', 'beorn', 'radagast', 'tom bombadil',
    'silmarillion', 'valar', 'morgoth', 'numenor'
  ],

  // Brands & Companies
  brands: [
    'apple', 'iphone', 'ipad', 'macbook', 'airpods', 'apple watch', 'ios', 'macos',
    'google', 'android', 'chrome', 'gmail', 'youtube', 'pixel',
    'microsoft', 'windows', 'office', 'teams', 'azure', 'bing', 'copilot',
    'amazon', 'aws', 'prime', 'alexa', 'kindle', 'twitch',
    'meta', 'facebook', 'instagram', 'whatsapp', 'oculus', 'quest',
    'twitter', 'x.com', 'tesla', 'spacex', 'starlink', 'neuralink',
    'tiktok', 'bytedance', 'snapchat', 'snap', 'linkedin', 'pinterest', 'reddit',
    'spotify', 'discord', 'slack', 'zoom', 'dropbox', 'adobe', 'photoshop', 'illustrator',
    'nike', 'adidas', 'puma', 'reebok', 'under armour', 'new balance', 'jordan', 'air jordan',
    'coca cola', 'coke', 'pepsi', 'red bull', 'monster energy', 'gatorade',
    'mcdonald', 'mcdonalds', 'burger king', 'wendy', 'kfc', 'taco bell', 'chick fil a', 'starbucks', 'dunkin',
    'subway', 'pizza hut', 'domino', 'papa john',
    'walmart', 'target', 'costco', 'ikea', 'home depot', 'lowe\'s',
    'gucci', 'louis vuitton', 'prada', 'chanel', 'hermes', 'versace', 'dior', 'balenciaga',
    'rolex', 'cartier', 'tiffany', 'swarovski',
    'ferrari', 'lamborghini', 'porsche', 'bmw', 'mercedes', 'audi', 'bugatti', 'maserati',
    'ford', 'chevrolet', 'toyota', 'honda', 'nissan', 'mazda', 'subaru', 'volkswagen',
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'uefa', 'olympics', 'world cup',
    'supreme', 'bape', 'off-white', 'palace', 'kith', 'yeezy'
  ],

  // TV Shows & Streaming
  tv_shows: [
    'game of thrones', 'got', 'house of the dragon', 'targaryen', 'stark', 'lannister',
    'jon snow', 'daenerys', 'tyrion', 'cersei', 'jaime', 'arya', 'sansa', 'bran',
    'ned stark', 'robb stark', 'white walker', 'night king', 'dragon', 'iron throne',
    'winterfell', 'king\'s landing', 'westeros', 'essos', 'dothraki', 'unsullied',
    'stranger things', 'eleven', 'demogorgon', 'upside down', 'hawkins',
    'mike wheeler', 'dustin', 'lucas', 'will', 'max', 'hopper',
    'breaking bad', 'walter white', 'heisenberg', 'jesse pinkman', 'better call saul', 'saul goodman',
    'the office', 'michael scott', 'dwight schrute', 'jim halpert', 'pam beesly', 'dunder mifflin',
    'friends', 'rachel', 'monica', 'phoebe', 'joey', 'chandler', 'ross', 'central perk',
    'seinfeld', 'jerry seinfeld', 'george costanza', 'elaine', 'kramer',
    'simpsons', 'homer simpson', 'marge', 'bart', 'lisa', 'maggie', 'springfield', 'mr burns', 'ned flanders',
    'family guy', 'peter griffin', 'stewie', 'brian griffin', 'lois', 'meg', 'chris', 'quagmire',
    'south park', 'cartman', 'kyle', 'stan', 'kenny',
    'rick and morty', 'rick sanchez', 'morty smith', 'portal gun', 'pickle rick',
    'futurama', 'fry', 'leela', 'bender', 'professor farnsworth', 'zoidberg', 'planet express',
    'bob\'s burgers', 'bob belcher', 'tina', 'gene', 'louise',
    'adventure time', 'finn', 'jake the dog', 'princess bubblegum', 'marceline', 'ice king', 'bmo',
    'regular show', 'mordecai', 'rigby',
    'gravity falls', 'dipper', 'mabel', 'grunkle stan', 'bill cipher',
    'steven universe', 'the owl house', 'amphibia', 'star vs the forces of evil',
    'peppa pig', 'paw patrol', 'bluey', 'bingo', 'cocomelon', 'blippi',
    'spongebob', 'spongebob squarepants', 'patrick star', 'squidward', 'mr krabs', 'plankton', 'sandy cheeks', 'bikini bottom',
    'fairly oddparents', 'timmy turner', 'cosmo', 'wanda', 'danny phantom',
    'avatar the last airbender', 'aang', 'katara', 'sokka', 'toph', 'zuko', 'iroh', 'azula', 'appa', 'momo',
    'legend of korra', 'korra',
    'powerpuff girls', 'blossom', 'bubbles', 'buttercup', 'mojo jojo',
    'dexter\'s laboratory', 'dexter', 'dee dee', 'johnny bravo', 'ed edd n eddy',
    'courage the cowardly dog', 'samurai jack',
    'tom and jerry', 'looney tunes', 'bugs bunny', 'daffy duck', 'tweety', 'sylvester', 'road runner', 'wile e coyote',
    'scooby doo', 'scooby-doo', 'shaggy', 'velma', 'daphne', 'fred', 'mystery machine',
    'the mandalorian', 'boba fett', 'grogu', 'loki', 'wandavision', 'what if',
    'peaky blinders', 'thomas shelby', 'squid game', 'player 456',
    'wednesday', 'wednesday addams', 'addams family', 'thing',
    'arcane', 'bridgerton', 'the crown', 'succession', 'white lotus',
    'the boys', 'homelander', 'butcher', 'starlight', 'a-train', 'the deep',
    'invincible', 'omni-man', 'mark grayson',
    'ted lasso', 'yellowstone', 'true detective',
    'mandalorian', 'ahsoka', 'andor', 'obi-wan kenobi'
  ],

  // Music Artists & Bands
  music: [
    'taylor swift', 'swiftie', 'eras tour', 'taylor\'s version',
    'beyonce', 'beyoncé', 'beyhive', 'bts', 'army', 'bangtan',
    'jungkook', 'jimin', 'v', 'taehyung', 'suga', 'j-hope', 'rm', 'jin',
    'blackpink', 'jennie', 'lisa', 'rosé', 'jisoo', 'blink',
    'ariana grande', 'billie eilish', 'dua lipa', 'olivia rodrigo', 'doja cat',
    'drake', 'kendrick lamar', 'travis scott', 'kanye', 'ye', 'yeezy',
    'eminem', 'slim shady', 'snoop dogg', 'dr dre', 'fifty cent', '50 cent',
    'rihanna', 'fenty', 'lady gaga', 'katy perry', 'miley cyrus', 'selena gomez',
    'justin bieber', 'ed sheeran', 'bruno mars', 'the weeknd', 'post malone',
    'harry styles', 'one direction', 'niall horan', 'zayn', 'louis tomlinson', 'liam payne',
    'coldplay', 'imagine dragons', 'maroon 5', 'twenty one pilots',
    'panic at the disco', 'fall out boy', 'my chemical romance', 'paramore',
    'linkin park', 'green day', 'blink 182', 'foo fighters', 'nirvana', 'kurt cobain',
    'metallica', 'ac/dc', 'guns n roses', 'led zeppelin', 'pink floyd', 'queen', 'freddie mercury',
    'beatles', 'rolling stones', 'elton john', 'david bowie', 'michael jackson',
    'madonna', 'prince', 'elvis', 'elvis presley',
    'bad bunny', 'j balvin', 'daddy yankee', 'shakira', 'maluma', 'ozuna',
    'twice', 'stray kids', 'enhypen', 'aespa', 'itzy', 'txt', 'seventeen', 'nct', 'exo', 'red velvet',
    'newjeans', 'le sserafim', 'ive',
    'hatsune miku', 'vocaloid', 'miku'
  ],

  // Internet Culture / Memes (Copyrighted)
  internet_culture: [
    'nyan cat', 'doge', 'shiba inu', 'grumpy cat', 'keyboard cat',
    'pepe', 'pepe the frog', 'wojak', 'chad', 'gigachad',
    'trollface', 'rage comic', 'bad luck brian', 'success kid',
    'nft', 'bored ape', 'cryptopunk', 'azuki'
  ],

  // Sports Teams (Select Major)
  sports: [
    'yankees', 'red sox', 'dodgers', 'cubs', 'giants', 'cardinals',
    'patriots', 'cowboys', 'packers', 'steelers', '49ers', 'chiefs', 'eagles', 'raiders',
    'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'nets', 'knicks', 'spurs',
    'real madrid', 'barcelona', 'manchester united', 'manchester city', 'liverpool', 'chelsea', 'arsenal',
    'juventus', 'ac milan', 'inter milan', 'bayern munich', 'psg', 'paris saint germain'
  ]
};

// Flatten the reject list for efficient searching
const FLAT_REJECT_LIST: string[] = Object.values(REJECT_LIST).flat();

// Create a Set for O(1) lookups of exact matches
const REJECT_SET = new Set(FLAT_REJECT_LIST.map(term => term.toLowerCase()));

// Compile regex patterns for partial matching
const REJECT_PATTERNS: RegExp[] = FLAT_REJECT_LIST.map(term => {
  // Escape special regex characters
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Create word boundary pattern for better matching
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

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
    REJECT_SET.add(termLower);
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
