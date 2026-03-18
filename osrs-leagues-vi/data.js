// =============================================
// OSRS Leagues VI - Region Data
// Based on Leagues 5 (Raging Echoes) + known L6 updates
// L6 confirmed: Varlamore = starter, Karamja = free, No Misthalin, No Sailing
// Echo boss data from L5 — speculative for L6 but likely similar
// =============================================

const SKILL_ICONS = {
  Attack:       '⚔️',  Strength:    '💪',  Defence:    '🛡️',
  Ranged:       '🏹',  Prayer:      '🙏',  Magic:      '🔮',
  Runecrafting: '🔯',  Hitpoints:   '❤️',  Crafting:   '💎',
  Mining:       '⛏️',  Smithing:    '🔨',  Fishing:    '🎣',
  Cooking:      '🍳',  Firemaking:  '🔥',  Woodcutting:'🪓',
  Agility:      '🤸',  Herblore:    '🌿',  Thieving:   '🗝️',
  Fletching:    '🪶',  Slayer:      '💀',  Farming:    '🌱',
  Construction: '🏗️',  Hunter:      '🦌',
};

const ALL_SKILLS = [
  'Attack','Strength','Defence','Ranged','Prayer','Magic',
  'Runecrafting','Hitpoints','Crafting','Mining','Smithing','Fishing',
  'Cooking','Firemaking','Woodcutting','Agility','Herblore','Thieving',
  'Fletching','Slayer','Farming','Construction','Hunter',
];

const RATINGS = { EXCELLENT:'excellent', GOOD:'good', DECENT:'decent', POOR:'poor' };

const WIKI = 'https://oldschool.runescape.wiki/w/';

// =============================================
// REGIONS
// =============================================
const REGIONS = [

  // ─── VARLAMORE (starter) ──────────────────
  {
    id: 'varlamore', name: 'Varlamore', icon: '🦅', type: 'starter',
    description: 'Your home base. Hunter Guild, Fortis Colosseum, Perilous Moons, and new L6 bosses Doom of Mokhaiotl and Hueycoatl.',

    skills: [
      { skill:'Hunter', rating:RATINGS.EXCELLENT, summary:"Hunter's Guild, moth trapping, carnivorous chinchompas",
        methods:["Hunter's Guild (fastest mid–high XP)",'Carnivorous (grey) chinchompas in Varlamore','Moth trapping near Fortis Colosseum','Herbiboar on Fossil Island — if Fremennik unlocked','Red chinchompas — if Fremennik unlocked'],
        notes:['Chins → best Ranged XP when chinning at Catacombs (Kourend)'] },
      { skill:'Agility', rating:RATINGS.GOOD, summary:'Civitas illa Fortis + Fortis Colosseum courses',
        methods:['Civitas illa Fortis Agility Course (low–mid)','Eclipse Atoll obstacle course'],
        notes:[] },
      { skill:'Herblore', rating:RATINGS.GOOD, summary:'Herb patches near Civitas',
        methods:['Civitas illa Fortis herb patches','Allotment patches in Varlamore'], notes:[] },
      { skill:'Farming', rating:RATINGS.GOOD, summary:'Multiple allotment/herb/bush patches',
        methods:['Herb patches near Civitas','Allotment + bush + flower patches'], notes:[] },
      { skill:'Thieving', rating:RATINGS.DECENT, summary:'Pickpocketing Varlamore citizens',
        methods:['Pickpocketing guards/citizens','Artefact stealing (mid-level)'], notes:[] },
      { skill:'Ranged', rating:RATINGS.DECENT, summary:'Grey chinchompas from Hunter',
        methods:['Grey chinchompas (Varlamore Hunter)','Red chins with Fremennik unlock'],
        notes:['Chinning + Kourend = best Ranged XP combo'] },
      { skill:'Slayer', rating:RATINGS.DECENT, summary:'Varlamore dungeon creatures',
        methods:['Varlamore dungeon Slayer creatures'], notes:[] },
    ],

    bosses: [
      { name:'Sol Heredit', icon:'🏟️', wikiUrl:`${WIKI}Sol_Heredit`,
        drops:['Sunfire fanatic helm','Sunfire fanatic cuirass','Sunfire fanatic chausses','Sunfire fanatic longsword','Dual macuahuitl','Dizana\'s quiver'] },
      { name:'Perilous Moons (Blood / Eclipse / Blue)', icon:'🌙', wikiUrl:`${WIKI}Moons_of_Peril`,
        drops:['Eclipse moon helm','Eclipse moon chestplate','Eclipse moon tassets','Blood moon helm','Blood moon chestplate','Blood moon tassets','Blue moon helm','Blue moon chestplate','Blue moon tassets','Eclipse atlatl','Dual macuahuitl','Lunar chest key'] },
      { name:'Hueycoatl', icon:'🦎', wikiUrl:`${WIKI}Hueycoatl`,
        drops:['Tonalztics of ralos','Quetzal feathers'] },
      { name:'Doom of Mokhaiotl', icon:'🌑', wikiUrl:`${WIKI}Doom_of_Mokhaiotl`,
        drops:['TBC — new L6 boss'] },
    ],

    raids: [],

    echoBosses: [
      { name:'Sol Heredit (Echo)', icon:'🏟️', difficulty:'Grandmaster',
        wikiUrl:`${WIKI}Sol_Heredit_(echo)`,
        drops:['Sunlight spear','Sunlit bracers'] },
    ],

    specialUnlocks: [
      { name:'Fortis Colosseum', desc:'Wave-based combat challenge (12 waves). Access to Sol Heredit.' },
      { name:"Hunter's Guild", desc:'High-level hunting training, contracts, and rewards.' },
      { name:'Eclipse Atoll', desc:'Area with unique resources and skilling content.' },
      { name:'Lunar Chest', desc:'Reward chest opened with Moon Boss keys.' },
    ],

    quests: [
      { name:'Children of the Sun', icon:'📜', desc:'Introductory Varlamore quest.' },
      { name:"Twilight's Promise", icon:'📜', desc:'Unlocks Fortis Colosseum.' },
      { name:'Moon of Peril', icon:'📜', desc:'Required for Perilous Moons bosses.' },
    ],
  },

  // ─── KARAMJA (free unlock) ────────────────
  {
    id:'karamja', name:'Karamja', icon:'🌴', type:'free',
    description:'Free first unlock. Brimhaven Agility Arena, TzHaar Fight Cave, Inferno, and excellent Fishing via Karambwans.',

    skills: [
      { skill:'Agility', rating:RATINGS.EXCELLENT, summary:'Brimhaven Agility Arena — best early/mid XP',
        methods:['Brimhaven Agility Arena (viable 1–99, gives tickets)','Brimhaven Dungeon obstacles (passive Agility XP)'],
        notes:['Tickets can be exchanged for XP or cosmetics'] },
      { skill:'Fishing', rating:RATINGS.GOOD, summary:'Karambwans (best 1-tick fishing)',
        methods:['Karambwan fishing (1-tick method — best Fishing XP)','Lobster / Tuna / Swordfish at Karamja docks'],
        notes:['Karambwans are also excellent food for bossing'] },
      { skill:'Cooking', rating:RATINGS.GOOD, summary:'Cooking Karambwans + Cooking gauntlets',
        methods:['Cooking Karambwans (no burns with Cooking gauntlets)'],
        notes:['Cooking gauntlets from Family Crest quest'] },
      { skill:'Slayer', rating:RATINGS.DECENT, summary:'Duradel access after Shilo Village quest',
        methods:['Duradel (Shilo Village) — best Slayer master (req. 100 combat + Shilo quest)','TzHaar tasks in Fight Cave'],
        notes:[] },
    ],

    bosses: [
      { name:'TzTok-Jad (Fight Cave)', icon:'🌋', wikiUrl:`${WIKI}TzTok-Jad`,
        drops:['Fire cape'] },
      { name:'TzKal-Zuk (Inferno)', icon:'🔥', wikiUrl:`${WIKI}TzKal-Zuk`,
        drops:['Infernal cape'] },
    ],

    raids: [],

    echoBosses: [],

    specialUnlocks: [
      { name:'TzHaar Shop (Tokkul)', desc:'Obsidian weapons, armour, and gems purchasable with Tokkul.' },
      { name:'Brimhaven Agility Arena', desc:'Best early Agility XP. Ticket rewards.' },
      { name:'Duradel (Slayer master)', desc:'Best Slayer master — requires Shilo Village quest + 100 combat.' },
      { name:'Brimhaven Dungeon', desc:'Red Dragons, Agility XP shortcuts.' },
      { name:'Karambwan Fishing', desc:'1-tick fishing — best Fishing XP method.' },
    ],

    quests: [
      { name:'Jungle Potion', icon:'📜', desc:'Opens Tai Bwo Wannai area.' },
      { name:'Tai Bwo Wannai Trio', icon:'📜', desc:'Required for Karambwan fishing.' },
      { name:'Shilo Village', icon:'📜', desc:'Unlocks Duradel — best Slayer master.' },
    ],
  },

  // ─── ASGARNIA ─────────────────────────────
  {
    id:'asgarnia', name:'Asgarnia', icon:'🏰', type:'choice',
    description:'God Wars Dungeon, Artisans Workshop, Motherlode Mine, Cerberus. Strong Smithing, Mining, and GWD boss content.',

    skills: [
      { skill:'Mining', rating:RATINGS.EXCELLENT, summary:'Mining Guild (Amethyst) + Motherlode Mine',
        methods:['Motherlode Mine (mid-level AFK, gold bag + coal)','Mining Guild extension — Amethyst at 72+ (best AFK)','Gem rocks (Mining Guild extension)'],
        notes:['Mining Guild gives invisible +7 Mining boost inside'] },
      { skill:'Smithing', rating:RATINGS.EXCELLENT, summary:"Artisans Workshop — best Smithing XP method",
        methods:["Artisans Workshop (Falador) — ~3x XP vs regular smithing",'Gold bars at Blast Furnace (requires Kandarin for best setup)'],
        notes:['Artisans Workshop is the go-to Smithing training method'] },
      { skill:'Crafting', rating:RATINGS.GOOD, summary:'Crafting Guild (gems, gold/silver rocks)',
        methods:['Crafting Guild — gem cutting, gold/silver jewellery','Dragonhide crafting from GWD drops'], notes:[] },
      { skill:'Slayer', rating:RATINGS.GOOD, summary:'Nieve/Steve (2nd best master), Cerberus at 91',
        methods:['Blue Dragons in Taverley Dungeon (task)','Hellhounds in Taverley Dungeon','Nieve/Steve at Stronghold — second best Slayer master','Cerberus (91 Slayer — boot crystals)'],
        notes:[] },
      { skill:'Prayer', rating:RATINGS.DECENT, summary:'Dragon bones from Taverley Blue Dragons',
        methods:['Dragon bones from Blue Dragons (Taverley)','Ourg bones from GWD bosses'],
        notes:['Gilded Altar in POH gives 3.5x XP'] },
      { skill:'Agility', rating:RATINGS.DECENT, summary:'Falador rooftop course (50–60)',
        methods:['Falador Agility Course (50–60)'], notes:[] },
    ],

    bosses: [
      { name:'General Graardor', icon:'👹', wikiUrl:`${WIKI}General_Graardor`,
        drops:['Bandos chestplate','Bandos tassets','Bandos boots','Bandos hilt'] },
      { name:"Kree'arra", icon:'🦅', wikiUrl:`${WIKI}Kree%27arra`,
        drops:['Armadyl helmet','Armadyl chestplate','Armadyl chainskirt','Armadyl hilt','Armadyl crossbow'] },
      { name:'Commander Zilyana', icon:'⭐', wikiUrl:`${WIKI}Commander_Zilyana`,
        drops:['Saradomin sword','Saradomin hilt','Armadyl crossbow'] },
      { name:"K'ril Tsutsaroth", icon:'😈', wikiUrl:`${WIKI}K%27ril_Tsutsaroth`,
        drops:['Zamorakian spear','Staff of the dead','Zamorak hilt','Steam battlestaff'] },
      { name:'Cerberus', icon:'🐕', wikiUrl:`${WIKI}Cerberus`,
        drops:['Primordial crystal','Pegasian crystal','Eternal crystal','Smouldering stone'] },
      { name:'Corporeal Beast', icon:'👻', wikiUrl:`${WIKI}Corporeal_Beast`,
        drops:['Elysian sigil','Arcane sigil','Spectral sigil','Spirit shield','Holy elixir'] },
      { name:'Giant Mole', icon:'🐭', wikiUrl:`${WIKI}Giant_Mole`,
        drops:['Mole skin','Mole claw'] },
    ],

    raids: [],

    echoBosses: [
      { name:'Cerberus (Echo)', icon:'🐕', difficulty:'Master',
        wikiUrl:`${WIKI}Cerberus_(echo)`,
        drops:['The dogsword'] },
    ],

    specialUnlocks: [
      { name:'God Wars Dungeon', desc:'All 4 generals — Bandos, Armadyl, Saradomin, Zamorak.' },
      { name:'Artisans Workshop', desc:'Best Smithing XP method in game.' },
      { name:'Mining Guild Extension', desc:'Amethyst mining, gem rocks, extra ore deposits.' },
      { name:'Crafting Guild', desc:'Gold/Silver rocks, gem cutting, Crafting skillcape shop.' },
      { name:'Falador Diary', desc:'Coal bag (hard), noted pure essence from Wizard Tower (elite).' },
    ],

    quests: [
      { name:'Dragon Slayer I', icon:'📜', desc:'Required for Rune platebody.' },
      { name:"The Knight's Sword", icon:'📜', desc:'Good Smithing XP for early game.' },
      { name:"Doric's Quest", icon:'📜', desc:'Quick Mining XP boost.' },
    ],
  },

  // ─── KHARIDIAN DESERT ────────────────────
  {
    id:'desert', name:'Kharidian Desert', icon:'🏜️', type:'choice',
    description:'Best Thieving via Pyramid Plunder, Ancient Magicks, and the Tombs of Amascut raid. Home to Phantom Muspah and The Whisperer.',

    skills: [
      { skill:'Thieving', rating:RATINGS.EXCELLENT, summary:'Pyramid Plunder — best Thieving XP in game',
        methods:['Pyramid Plunder (Sophanem) — best Thieving XP, rare Pharaoh Sceptre','Blackjacking in Pollnivneach — great AFK option','Menaphite Thugs — click-intensive but very fast'],
        notes:['Pyramid Plunder at 71+ is arguably best to 99'] },
      { skill:'Magic', rating:RATINGS.EXCELLENT, summary:'Ancient Magicks via Desert Treasure I',
        methods:['Ancient Magicks: Ice Barrage (best burst)','Shadow Spells (accuracy debuff)'],
        notes:['Desert Treasure I is a major power spike for all Magic users'] },
      { skill:'Agility', rating:RATINGS.DECENT, summary:'Pollnivneach rooftop, Sophanem course',
        methods:['Pollnivneach Rooftop Course (60–70)','Sophanem Agility Course (advanced)'], notes:[] },
      { skill:'Mining', rating:RATINGS.DECENT, summary:'Desert Quarry (granite)',
        methods:['Desert Quarry — Granite blocks'], notes:[] },
      { skill:'Slayer', rating:RATINGS.DECENT, summary:'Smoke Dungeon, Kalphite tasks, Sumona',
        methods:['Smoke Dungeon — Smoke Devils (93 Slayer)','Kalphite tasks','Sumona — mid-tier master in Pollnivneach'],
        notes:[] },
    ],

    bosses: [
      { name:'Kalphite Queen', icon:'🐛', wikiUrl:`${WIKI}Kalphite_Queen`,
        drops:['Dragon chainbody','Dragon 2h sword','Jar of sand','Kq head'] },
      { name:'Phantom Muspah', icon:'👁️', wikiUrl:`${WIKI}Phantom_Muspah`,
        drops:['Saturated heart','Ancient essence'] },
      { name:'The Whisperer', icon:'🌊', wikiUrl:`${WIKI}The_Whisperer`,
        drops:['Bellator ring','Ancient icon','Chromium ingot'] },
      { name:'Thermonuclear Smoke Devil', icon:'💨', wikiUrl:`${WIKI}Thermonuclear_Smoke_Devil`,
        drops:['Occult necklace','Smoke battlestaff','Jar of smoke'] },
    ],

    raids: [
      { name:'Tombs of Amascut', icon:'⚱️', wikiUrl:`${WIKI}Tombs_of_Amascut`,
        drops:["Tumeken's shadow","Osmumten's fang","Masori mask","Masori body","Masori chaps","Elidinis' ward","Lightbearer","Breach of the scarab","Eye of the corruptor","Jewel of the sun"] },
    ],

    echoBosses: [
      { name:'Kalphite Queen (Echo)', icon:'🐛', difficulty:'Elite',
        wikiUrl:`${WIKI}Kalphite_Queen_(echo)`,
        drops:['Drygore blowpipe'] },
    ],

    specialUnlocks: [
      { name:'Ancient Magicks', desc:'Ice/Shadow/Blood/Smoke spells. Ice Barrage is the meta burst weapon.' },
      { name:'Pyramid Plunder', desc:'Best Thieving XP. Also chance at Pharaoh Sceptre.' },
      { name:'Nardah', desc:'Divine spring for HP/run energy restoration. Teleport via fairy ring.' },
      { name:'Desert Diary', desc:'Noted Ugthanki kebabs, bank chest at Nardah (elite).' },
    ],

    quests: [
      { name:'Desert Treasure I', icon:'📜', desc:'Unlocks Ancient Magicks — major power spike.' },
      { name:'Desert Treasure II', icon:'📜', desc:'4 DT2 bosses, ring upgrades.' },
      { name:"Icthlarin's Little Helper", icon:'📜', desc:'Required for Sophanem + Pyramid Plunder.' },
      { name:'Contact!', icon:'📜', desc:'Full Sophanem access.' },
    ],
  },

  // ─── FREMENNIK PROVINCES ─────────────────
  {
    id:'fremennik', name:'Fremennik Provinces', icon:'🧊', type:'choice',
    description:'Dagannoth Kings, Vorkath, and Lunar Magic. Best rings in game, The Leviathan and Duke Sucellus.',

    skills: [
      { skill:'Hunter', rating:RATINGS.GOOD, summary:'Herbiboar on Fossil Island + Red chinchompas',
        methods:['Herbiboar on Fossil Island (80+ Hunter, excellent mid-level method)','Red chinchompas in Piscatoris (85+)'],
        notes:['Red chins → best Ranged XP when chinning'] },
      { skill:'Slayer', rating:RATINGS.EXCELLENT, summary:'Fremennik Slayer Dungeon, Vorkath on task',
        methods:['Fremennik Slayer Dungeon (Basilisks, Dagannoth, Brine Rats)','Vorkath (Blue Dragon Slayer task)','Basilisk Knights (Neitiznot Faceguard)'],
        notes:[] },
      { skill:'Magic', rating:RATINGS.GOOD, summary:'Lunar Spellbook — String Jewellery, Tan Leather',
        methods:['Lunar Spellbook: String Jewellery (best mid-level Magic XP)','Tan Leather (fast XP + GP)','Superheat Item'],
        notes:['String Jewellery is one of the best Magic XP methods at 80+'] },
      { skill:'Crafting', rating:RATINGS.GOOD, summary:'Tan Leather Lunar spell + hides from drops',
        methods:['Tan Leather (from Fremennik drops)','Crafting Dagannoth hides'], notes:[] },
      { skill:'Prayer', rating:RATINGS.DECENT, summary:'Dagannoth bones from DKs',
        methods:['Dagannoth bones from DKs'], notes:[] },
      { skill:'Woodcutting', rating:RATINGS.DECENT, summary:'Miscellania Kingdom passive income',
        methods:['Miscellania Kingdom (passive logs/fish/herbs)','Arctic Pine Logs on Neitiznot'], notes:[] },
    ],

    bosses: [
      { name:'Dagannoth Rex', icon:'🦈', wikiUrl:`${WIKI}Dagannoth_Rex`,
        drops:['Berserker ring','Berserker necklace'] },
      { name:'Dagannoth Prime', icon:'🌊', wikiUrl:`${WIKI}Dagannoth_Prime`,
        drops:['Seers ring'] },
      { name:'Dagannoth Supreme', icon:'🏹', wikiUrl:`${WIKI}Dagannoth_Supreme`,
        drops:['Archers ring','Warriors ring'] },
      { name:'Vorkath', icon:'🐉', wikiUrl:`${WIKI}Vorkath`,
        drops:["Vorkath's head",'Draconic visage','Skeletal visage','Dragonbone necklace'] },
      { name:'Duke Sucellus', icon:'😴', wikiUrl:`${WIKI}Duke_Sucellus`,
        drops:['Magus ring','Chromium ingot'] },
      { name:'The Leviathan', icon:'🐋', wikiUrl:`${WIKI}The_Leviathan`,
        drops:['Venator ring','Chromium ingot'] },
    ],

    raids: [],

    echoBosses: [
      { name:'Dagannoth Kings (Echo)', icon:'🦈', difficulty:'Master',
        wikiUrl:`${WIKI}Dagannoth_Kings_(echo)`,
        drops:['Amulet of the monarchs','Emperor ring'] },
    ],

    specialUnlocks: [
      { name:'Dagannoth Kings', desc:'4 BIS rings: Berserker, Archer, Seers, Warriors.' },
      { name:'Lunar Spellbook', desc:'String Jewellery, Tan Leather — excellent Magic training.' },
      { name:'Vorkath', desc:'Consistent GP boss. Dragon bones + hides every kill.' },
      { name:'Kingdom of Miscellania', desc:'Passive income — logs, fish, herbs, seeds.' },
      { name:'Neitiznot Faceguard', desc:'From Basilisk Knights — BIS melee helmet.' },
    ],

    quests: [
      { name:'The Fremennik Trials', icon:'📜', desc:'Unlocks Rellekka and the Fremennik region.' },
      { name:'Lunar Diplomacy', icon:'📜', desc:'Unlocks Lunar Spellbook.' },
      { name:'Dream Mentor', icon:'📜', desc:'Extends Lunar Spellbook with combat spells.' },
      { name:'The Fremennik Exiles', icon:'📜', desc:'Required for Neitiznot Faceguard.' },
    ],
  },

  // ─── KANDARIN ────────────────────────────
  {
    id:'kandarin', name:'Kandarin', icon:'🏕️', type:'choice',
    description:'Most skill-rich region. Best Agility courses, Barbarian Fishing, Demonic Gorillas (Zenyte), and strong skilling hubs throughout.',

    skills: [
      { skill:'Agility', rating:RATINGS.EXCELLENT, summary:'Seers + Ardougne rooftop — best marks of grace',
        methods:['Gnome Stronghold Circuit (low levels)','Barbarian Outpost Course (35–60)','Seers Rooftop Course (60–80, best marks/hr)','Ardougne Rooftop Course (90+, best marks in game)'],
        notes:['Most marks of grace of any rooftop — fastest Graceful outfit'] },
      { skill:'Fishing', rating:RATINGS.EXCELLENT, summary:'Barbarian Fishing — best XP + passive Agility/Str',
        methods:['Barbarian Fishing (best XP to 99, also trains Agility + Strength)','Fishing Guild — Minnows at 82+, Shark at 76'],
        notes:['Barbarian Fishing passively trains Agility + Strength — very efficient'] },
      { skill:'Herblore', rating:RATINGS.EXCELLENT, summary:'Catherby, Ardougne, Gnome herb patches',
        methods:['Herb patches: Catherby, Ardougne','Grimy herbs from Slayer tasks'], notes:[] },
      { skill:'Magic', rating:RATINGS.EXCELLENT, summary:'High Alchemy, Enchanting, Camelot teleport',
        methods:['High Alchemy (passive Magic XP + GP from any loot)','Enchanting bolts/jewellery'], notes:[] },
      { skill:'Farming', rating:RATINGS.GOOD, summary:'Catherby, Ardougne, Gnome patches',
        methods:['Herb: Catherby, Ardougne','Tree: Gnome Stronghold','Fruit tree: Gnome Stronghold, Brimhaven (Karamja), Tree Gnome Village'], notes:[] },
      { skill:'Fletching', rating:RATINGS.GOOD, summary:'Dart fletching, Magic Longbow stringing',
        methods:['Dart fletching (fastest Fletching XP)','Stringing Magic Longbows (XP + GP)','Broad Bolts (Slayer)'], notes:[] },
      { skill:'Slayer', rating:RATINGS.GOOD, summary:'Chaeldar (Zanaris), Demonic Gorillas on task',
        methods:['Chaeldar in Zanaris — good mid-level master','Demonic Gorillas on task (Ape Atoll)'],
        notes:['Black Mask → Slayer Helmet is a massive Slayer DPS boost'] },
      { skill:'Strength', rating:RATINGS.GOOD, summary:'Barbarian Fishing passively trains Strength',
        methods:['Barbarian Fishing (passive Strength XP)'], notes:[] },
    ],

    bosses: [
      { name:'Demonic Gorillas', icon:'🦍', wikiUrl:`${WIKI}Demonic_gorilla`,
        drops:['Zenyte shard','Ballista limbs','Ballista spring','Monkey tail'] },
      { name:'Thermonuclear Smoke Devil', icon:'💨', wikiUrl:`${WIKI}Thermonuclear_Smoke_Devil`,
        drops:['Occult necklace','Smoke battlestaff','Jar of smoke'] },
    ],

    raids: [],

    echoBosses: [
      { name:'Thermonuclear Smoke Devil (Echo)', icon:'💨', difficulty:'Elite',
        wikiUrl:`${WIKI}Thermonuclear_Smoke_Devil_(echo)`,
        drops:["Devil's element"] },
    ],

    specialUnlocks: [
      { name:'Demonic Gorillas (MM2)', desc:'Zenyte shards → all BIS jewellery. Ballista for Ranged spec.' },
      { name:'Barbarian Fishing', desc:'Best Fishing XP. Passively trains Agility + Strength.' },
      { name:'Fishing Guild', desc:'Shark fishing, Minnows at 82+.' },
      { name:'Seers/Ardougne Rooftop', desc:'Best marks of grace income — fastest Graceful outfit.' },
      { name:'Dragon Scimitar', desc:'Available after Monkey Madness I from Ape Atoll shop.' },
      { name:'Kandarin Diary', desc:'Coal trucks (passive), Seer\'s Bank teleport at rooftop (hard).' },
    ],

    quests: [
      { name:'Monkey Madness I', icon:'📜', desc:'Unlocks Ape Atoll and Dragon Scimitar.' },
      { name:'Monkey Madness II', icon:'📜', desc:'Unlocks Demonic Gorillas — Zenyte + Ballista.' },
      { name:"Legends' Quest", icon:'📜', desc:'Cape of Legends, Legends Guild.' },
      { name:'Barbarian Training', icon:'📜', desc:'Unlocks Barbarian Fishing and Firemaking methods.' },
    ],
  },

  // ─── KOUREND ─────────────────────────────
  {
    id:'kourend', name:'Kourend', icon:'🏛️', type:'choice',
    description:'Chambers of Xeric (first Raid), Alchemical Hydra, Yama (new L6 boss), Arceuus Spellbook, and the best Farming/Slayer content.',

    skills: [
      { skill:'Slayer', rating:RATINGS.EXCELLENT, summary:'Catacombs of Kourend + Konar + Alchemical Hydra',
        methods:['Catacombs of Kourend (passive Prayer XP, Ancient Shards → Darklight)','Konar quo Maten — best for Brimstone Keys + clue scrolls','Alchemical Hydra (95 Slayer)'],
        notes:['Catacombs = passive Prayer XP while Slaying'] },
      { skill:'Prayer', rating:RATINGS.EXCELLENT, summary:'Catacombs passive XP + Arceuus ensouled heads',
        methods:['Catacombs passive bone drops (Prayer XP automatically)','Ensouled Heads (Arceuus Spellbook) — fast + cheap Prayer XP'],
        notes:['Ensouled heads is arguably best Prayer XP/GP ratio'] },
      { skill:'Farming', rating:RATINGS.EXCELLENT, summary:'Farming Guild — all patch types in one location',
        methods:['Farming Guild (herb, allotment, tree, bush, cactus, hops, flower, celastrus)','Hosidius disease-free herb patch (50% favour)'],
        notes:['Disease-free Hosidius patch = reliable Herblore income'] },
      { skill:'Magic', rating:RATINGS.EXCELLENT, summary:'Arceuus Spellbook (Thralls, Reanimation, teleports)',
        methods:['Resurrection Thralls (+1 max hit, works with all styles)','Reanimation spells (Prayer XP)','Barrows teleports (Arceuus)'],
        notes:['Thralls are a free DPS boost — major upgrade for all combat styles'] },
      { skill:'Herblore', rating:RATINGS.GOOD, summary:'Disease-free herb patch + Farming Guild',
        methods:['Hosidius disease-free herb patch','Farming Guild herb patches'], notes:[] },
      { skill:'Woodcutting', rating:RATINGS.GOOD, summary:'Woodcutting Guild, Redwood trees at 90+',
        methods:['Woodcutting Guild (+7 invisible boost)','Redwood Trees at 90+ (best AFK Woodcutting XP)'],
        notes:['Guild invisible boost helps cut higher logs earlier'] },
      { skill:'Runecrafting', rating:RATINGS.DECENT, summary:'Blood Altar + Soul Altar (AFK no banking)',
        methods:['Blood Rune Altar (77+ RC, AFK, no banking)','Soul Rune Altar (90+ RC, great GP)'],
        notes:['Blood Altar is excellent AFK RC — no banking needed'] },
    ],

    bosses: [
      { name:'Alchemical Hydra', icon:'🐲', wikiUrl:`${WIKI}Alchemical_Hydra`,
        drops:["Hydra's claw",'Hydra leather','Hydra tail','Dragon thrownaxe',"Hydra's eye","Hydra's fang","Hydra's heart"] },
      { name:'Yama', icon:'🔱', wikiUrl:`${WIKI}Yama`,
        drops:['TBC — new L6 boss'] },
      { name:'Skotizo', icon:'👁️', wikiUrl:`${WIKI}Skotizo`,
        drops:['Dexterous prayer scroll','Arcane prayer scroll'] },
      { name:'Sarachnis', icon:'🕷️', wikiUrl:`${WIKI}Sarachnis`,
        drops:['Sarachnis cudgel','Jar of eyes','Giant egg sac'] },
      { name:'Duke Sucellus', icon:'😴', wikiUrl:`${WIKI}Duke_Sucellus`,
        drops:['Magus ring','Chromium ingot'] },
      { name:'Vardorvis', icon:'🪓', wikiUrl:`${WIKI}Vardorvis`,
        drops:["Executioner's axe head",'Ultor ring','Chromium ingot'] },
    ],

    raids: [
      { name:'Chambers of Xeric', icon:'🏔️', wikiUrl:`${WIKI}Chambers_of_Xeric`,
        drops:['Twisted bow','Elder maul','Kodai insignia','Dragon hunter crossbow','Twisted buckler','Dragon claws','Ancestral hat','Ancestral robe top','Ancestral robe bottom','Dinh\'s bulwark','Olmlet'] },
    ],

    echoBosses: [
      { name:'Hespori (Echo)', icon:'🌿', difficulty:'Elite',
        wikiUrl:`${WIKI}Hespori_(echo)`,
        drops:["Nature's reprisal"] },
    ],

    specialUnlocks: [
      { name:'Arceuus Spellbook', desc:'Thralls (free DPS boost), Reanimation (Prayer XP), Barrows/DKs teleports.' },
      { name:'Chambers of Xeric', desc:'CoX Raid — Twisted Bow, Elder Maul, Kodai, Dragon Claws.' },
      { name:'Farming Guild', desc:'Best farming hub — all patch types, contracts for XP.' },
      { name:'Catacombs of Kourend', desc:'Passive Prayer XP while Slaying. Ancient Shards → Skotizo.' },
      { name:'Woodcutting Guild', desc:'+7 invisible Woodcutting boost, Redwood trees.' },
      { name:'Blood/Soul Altar', desc:'AFK Runecrafting — no banking needed.' },
    ],

    quests: [
      { name:'X Marks the Spot', icon:'📜', desc:'Quick quest with good early rewards.' },
      { name:'Client of Kourend', icon:'📜', desc:'Starts Kourend questline.' },
      { name:'A Kingdom Divided', icon:'📜', desc:'Major Kourend quest. Kharedst memoirs + diary access.' },
      { name:'Architectural Alliance', icon:'📜', desc:"Unlocks Xeric's Talisman Kourend teleport." },
    ],
  },

  // ─── MORYTANIA ───────────────────────────
  {
    id:'morytania', name:'Morytania', icon:'🧛', type:'choice',
    description:'Theatre of Blood, Hallowed Sepulchre, best Prayer via Ectofuntus. Home to Barrows, Nightmare of Ashihama, and Slayer Tower.',

    skills: [
      { skill:'Prayer', rating:RATINGS.EXCELLENT, summary:'Ectofuntus gives 4x Prayer XP from bones',
        methods:['Ectofuntus (4x XP/bone — best method)','Shades of Mort\'ton (Firemaking + Prayer keys)'],
        notes:['Requires Buckets of Slime from Ectofuntus basement'] },
      { skill:'Thieving', rating:RATINGS.EXCELLENT, summary:'Hallowed Sepulchre — best high-level Thieving',
        methods:['Hallowed Sepulchre (Agility + Thieving XP, Ring of Endurance)','Vyrewatch Sentinel thieving (very high level)'],
        notes:['Ring of Endurance extends Stamina potions — extremely valuable'] },
      { skill:'Agility', rating:RATINGS.GOOD, summary:'Canifis Rooftop + Hallowed Sepulchre',
        methods:['Canifis Rooftop Course (40–50)','Hallowed Sepulchre (60–99, also Thieving XP)'], notes:[] },
      { skill:'Slayer', rating:RATINGS.GOOD, summary:'Slayer Tower (Abyssal Demons, Gargoyles)',
        methods:['Abyssal Demons (Abyssal Whip)','Gargoyles (Granite Maul, good GP)','Banshees (Mystic Gloves)','Abyssal Sire (Abyssal Dagger)'],
        notes:[] },
      { skill:'Firemaking', rating:RATINGS.DECENT, summary:"Shades of Mort'ton pyres",
        methods:["Shades of Mort'ton (Pyre logs — Firemaking + Prayer keys)"], notes:[] },
    ],

    bosses: [
      { name:'Nightmare of Ashihama', icon:'👿', wikiUrl:`${WIKI}Nightmare_of_Ashihama`,
        drops:["Inquisitor's great helm","Inquisitor's hauberk","Inquisitor's plateskirt",'Nightmare staff','Eldritch orb','Volatile orb','Harmonised orb'] },
      { name:"Phosani's Nightmare", icon:'💤', wikiUrl:`${WIKI}Phosani%27s_Nightmare`,
        drops:["Inquisitor's great helm","Inquisitor's hauberk","Inquisitor's plateskirt",'Nightmare staff','Eldritch orb','Volatile orb','Harmonised orb'] },
      { name:'Grotesque Guardians', icon:'🗿', wikiUrl:`${WIKI}Grotesque_Guardians`,
        drops:['Black tourmaline core','Granite gloves','Granite hammer','Granite ring','Jar of stone'] },
      { name:'Abyssal Sire', icon:'👹', wikiUrl:`${WIKI}Abyssal_Sire`,
        drops:['Abyssal dagger','Unsired'] },
      { name:'Barrows', icon:'⚰️', wikiUrl:`${WIKI}Barrows`,
        drops:["Dharok's set","Guthan's set","Verac's set","Karil's set","Torag's set","Ahrim's set"] },
    ],

    raids: [
      { name:'Theatre of Blood', icon:'🩸', wikiUrl:`${WIKI}Theatre_of_Blood`,
        drops:['Scythe of vitur','Sanguinesti staff','Justiciar faceguard','Justiciar chestguard','Justiciar legguards','Avernic defender hilt'] },
    ],

    echoBosses: [
      { name:'Grotesque Guardians (Echo)', icon:'🗿', difficulty:'Elite',
        wikiUrl:`${WIKI}Grotesque_Guardians_(echo)`,
        drops:['Gloves of the damned'] },
    ],

    specialUnlocks: [
      { name:'Theatre of Blood', desc:'Scythe, Sanguinesti, Justiciar, Avernic — top-tier items.' },
      { name:'Hallowed Sepulchre', desc:'Ring of Endurance, Dark Dye, Dark Graceful recolour.' },
      { name:'Ectofuntus', desc:'Best Prayer XP per bone — 4x vs altar 3.5x.' },
      { name:'Morytania Diary', desc:'Double XP at Ectofuntus (elite), noted Mort Myre fungi, teleports.' },
    ],

    quests: [
      { name:'Priest in Peril', icon:'📜', desc:'Required to enter Morytania.' },
      { name:'Darkness of Hallowvale', icon:'📜', desc:'Opens lower Morytania content.' },
      { name:'Sins of the Father', icon:'📜', desc:'Blisterwood weapons, Vyrewatch Sentinel access.' },
      { name:'A Taste of Hope', icon:'📜', desc:'Ivandis Flail — required for Vampyre combat.' },
    ],
  },

  // ─── TIRANNWN ────────────────────────────
  {
    id:'tirannwn', name:'Tirannwn', icon:'🌲', type:'choice',
    description:'Prifddinas — the elven city. Best Thieving and Woodcutting methods. Home to the Gauntlet, Zulrah, and Zalcano.',

    skills: [
      { skill:'Woodcutting', rating:RATINGS.EXCELLENT, summary:'Crystallise on Magic Trees — fastest Woodcutting XP',
        methods:['Crystallise + Light Form on Magic Trees (Prifddinas) — best XP','Magic Trees in Prifddinas (high XP without Crystallise)'],
        notes:['Crystallise requires Lunar Spellbook (Fremennik) for best results'] },
      { skill:'Thieving', rating:RATINGS.EXCELLENT, summary:'Elf pickpocketing — best Thieving XP at 85+',
        methods:['Pickpocketing Elves in Prifddinas (best at 85+)','Crystal chest loot (seeds, herbs, gems)'],
        notes:['Elves give 250 XP each vs 99 for H.A.M. members'] },
      { skill:'Fletching', rating:RATINGS.EXCELLENT, summary:'Crystal armour/weapons + Magic longbow stringing',
        methods:['Stringing Magic Longbows (from Prifddinas Magic Trees)','Crystal bow/armour crafting at Singing Bowl'],
        notes:[] },
      { skill:'Crafting', rating:RATINGS.GOOD, summary:'Crystal equipment at Singing Bowl',
        methods:['Crystal Armour/Tools at Singing Bowl (Prifddinas)','Gem cutting from Zalcano + Gauntlet drops'], notes:[] },
      { skill:'Herblore', rating:RATINGS.GOOD, summary:'Iorwerth herb patch + Gauntlet herbs',
        methods:['Prifddinas Iorwerth herb patch','Herb supplies from Gauntlet prep room'], notes:[] },
      { skill:'Agility', rating:RATINGS.GOOD, summary:'Prifddinas Agility Course (75+, crystal shards)',
        methods:['Prifddinas Agility Course (75 Agility — good XP + crystal shards)'],
        notes:['Crystal shards from Prifddinas Agility are valuable for Gauntlet prep'] },
      { skill:'Slayer', rating:RATINGS.GOOD, summary:'Iorwerth Dungeon, Dark Beasts',
        methods:['Iorwerth Dungeon (Elves, superior encounters)','Dark Beasts (require MED II)'], notes:[] },
    ],

    bosses: [
      { name:'Crystalline Hunllef (Gauntlet)', icon:'🔮', wikiUrl:`${WIKI}Crystalline_Hunllef`,
        drops:['Crystal armour seed','Crystal weapon seed'] },
      { name:'Corrupted Hunllef (Corrupted Gauntlet)', icon:'💎', wikiUrl:`${WIKI}Corrupted_Hunllef`,
        drops:['Crystal armour seed','Enhanced crystal weapon seed'] },
      { name:'Zalcano', icon:'⛏️', wikiUrl:`${WIKI}Zalcano`,
        drops:['Crystal tool seed','Zalcano shard'] },
      { name:'Zulrah', icon:'🐍', wikiUrl:`${WIKI}Zulrah`,
        drops:['Tanzanite fang','Magic fang','Serpentine visage','Tanzanite mutagen','Magma mutagen','Uncut onyx'] },
    ],

    raids: [],

    echoBosses: [
      { name:'Corrupted Hunllef (Echo)', icon:'💎', difficulty:'Master',
        wikiUrl:`${WIKI}Corrupted_Hunllef_(echo)`,
        drops:['Crystal blessing'] },
    ],

    specialUnlocks: [
      { name:'Prifddinas', desc:'8 elf clan districts, each with daily bonuses (extra XP, resources).' },
      { name:'The Gauntlet', desc:'Enhanced crystal weapon seed → Blade of Saeldor, Bow of Faerdhinen.' },
      { name:'Zulrah', desc:'Blowpipe (from fang), Serpentine helm, Toxic trident. Consistent GP.' },
      { name:'Zalcano', desc:'Crystal Tool Seeds for Crystallise methods + passive skilling XP.' },
      { name:'Elf Clan Districts', desc:'Daily bonuses: Ithell (Crafting), Iorwerth (Slayer), Trahaearn (Mining), etc.' },
    ],

    quests: [
      { name:'Regicide', icon:'📜', desc:'Required to enter Tirannwn and access Zulrah.' },
      { name:"Mourning's Ends I", icon:'📜', desc:'Opens the elven lands.' },
      { name:"Mourning's Ends II", icon:'📜', desc:'Temple of Light — required for Prifddinas.' },
      { name:'Song of the Elves', icon:'📜', desc:'Grand Master quest. Unlocks full Prifddinas.' },
    ],
  },

  // ─── WILDERNESS ──────────────────────────
  {
    id:'wilderness', name:'Wilderness', icon:'☠️', type:'choice',
    description:'Best Runecrafting via the Abyss, Wilderness bosses with unique rings/weapons, Imbued God Cape, and highest Slayer point rate.',

    skills: [
      { skill:'Runecrafting', rating:RATINGS.EXCELLENT, summary:'Abyss — fastest Runecrafting XP',
        methods:['Abyss (bypass walking to any altar — best RC XP)','Blood/Death/Nature Runes via Abyss (GP + XP)'],
        notes:['In Leagues PvP risk is reduced — Abyss is very safe'] },
      { skill:'Slayer', rating:RATINGS.GOOD, summary:'Krystilia — highest Slayer point rate',
        methods:['Krystilia (Wilderness Slayer only) — highest Slayer points per task','Wilderness Slayer Cave (safe from PvP)','Revenants as Slayer task'],
        notes:['Krystilia gives far more Slayer points than any other master — fastest imbues'] },
      { skill:'Magic', rating:RATINGS.DECENT, summary:'Mage Arena I & II — Imbued God Cape',
        methods:['Mage Arena I: God Cape + God spells','Mage Arena II: Imbued God Cape'],
        notes:['Imbued God Cape is the BIS Magic cape'] },
      { skill:'Fishing', rating:RATINGS.DECENT, summary:'Dark Crabs (Resource Area)',
        methods:['Dark Crabs (Wilderness Resource Area — excellent GP + XP)'], notes:[] },
      { skill:'Mining', rating:RATINGS.DECENT, summary:'Rune rocks in deep Wilderness',
        methods:['Rune Rocks (deep Wilderness)'], notes:[] },
    ],

    bosses: [
      { name:'Callisto / Artio', icon:'🐻', wikiUrl:`${WIKI}Callisto`,
        drops:['Dragon pickaxe','Tyrannical ring'] },
      { name:'Venenatis / Spindel', icon:'🕷️', wikiUrl:`${WIKI}Venenatis`,
        drops:['Dragon pickaxe','Treasonous ring'] },
      { name:"Vet'ion / Calvar'ion", icon:'💀', wikiUrl:`${WIKI}Vet%27ion`,
        drops:['Dragon pickaxe','Ring of the gods'] },
      { name:'Scorpia', icon:'🦂', wikiUrl:`${WIKI}Scorpia`,
        drops:['Odium shard 1','Odium shard 2','Odium shard 3','Malediction shard 1','Malediction shard 2','Malediction shard 3'] },
      { name:'Chaos Elemental', icon:'🌀', wikiUrl:`${WIKI}Chaos_Elemental`,
        drops:['Dragon pickaxe','Dragon 2h sword','Dragon med helm'] },
      { name:'King Black Dragon', icon:'🐲', wikiUrl:`${WIKI}King_Black_Dragon`,
        drops:['Draconic visage','KBD heads'] },
      { name:'Chaos Fanatic', icon:'🌪️', wikiUrl:`${WIKI}Chaos_Fanatic`,
        drops:['Odium shard 1','Malediction shard 1','Ancient staff'] },
      { name:'Crazy Archaeologist', icon:'📚', wikiUrl:`${WIKI}Crazy_archaeologist`,
        drops:['Odium shard 2','Malediction shard 2'] },
      { name:'Revenants', icon:'👻', wikiUrl:`${WIKI}Revenant`,
        drops:["Craw's bow","Thammaron's sceptre","Viggora's chainmace",'Ancient shard','Ancient totem','Ancient statuette'] },
    ],

    raids: [],

    echoBosses: [
      { name:'King Black Dragon (Echo)', icon:'🐲', difficulty:'Elite',
        wikiUrl:`${WIKI}King_Black_Dragon_(echo)`,
        drops:['Thunder khopesh','Thousand-dragon ward'] },
    ],

    specialUnlocks: [
      { name:'Abyss Runecrafting', desc:'Fastest RC XP. Access any altar without walking.' },
      { name:'Wilderness Bosses', desc:'Dragon Pickaxe + unique rings (crush/stab/Prayer) + Odium/Malediction.' },
      { name:'Revenant Caves', desc:"Craw's Bow, Thammaron's Sceptre, Viggora's Chainmace." },
      { name:'Krystilia Slayer', desc:'Highest Slayer point rate — fastest imbues and Slayer rewards.' },
      { name:'Imbued God Cape', desc:'BIS Magic cape from Mage Arena II miniquest.' },
    ],

    quests: [
      { name:'Enter the Abyss (miniquest)', icon:'📜', desc:'Unlocks the Abyss for Runecrafting.' },
      { name:'Mage Arena I (miniquest)', icon:'📜', desc:'God Cape + God spells.' },
      { name:'Mage Arena II (miniquest)', icon:'📜', desc:'Imbued God Cape — BIS Magic cape.' },
    ],
  },
];

// =============================================
// ECHO BOSSES — Confirmed from L5 (Raging Echoes)
// Source: https://oldschool.runescape.wiki/w/Raging_Echoes_League#Echo_bosses_and_echo_equipment
// L6 echo bosses speculative — likely similar pattern
// =============================================
const ECHO_BOSSES_NOTE = "Echo Bosses for Leagues 6 are not yet confirmed. The list below is based on Leagues 5 (Raging Echoes) — each unlockable region had one echo boss that dropped unique echo equipment. L6 will likely follow the same pattern, possibly with different bosses.";
