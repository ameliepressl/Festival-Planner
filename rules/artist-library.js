// Festival Architect — the artist library: real artists to browse, filter and add to a festival.
// Only data and pure rules live here (no screen code), so they can be tested.
//
// IMPORTANT: the fees are fictional planning estimates based on the artist's size (rising / main stage /
// headliner). They are NOT real quotes and say nothing about what an artist actually charges.
// Photos are not stored here: the screen loads the artist's freely licensed Wikimedia Commons photo
// from Wikipedia (see artist-library/artist-photos.js) and shows initials when there is none.

// Each row: [name, Wikipedia article title ('' = same as the name), genre, style, country, size]
// size: H = headliner, M = main stage, R = rising
const ARTIST_ROWS = [
  // ---------- Pop ----------
  ['Taylor Swift', '', 'Pop', 'Pop', 'United States', 'H'],
  ['Dua Lipa', '', 'Pop', 'Dance pop', 'United Kingdom', 'H'],
  ['Billie Eilish', '', 'Pop', 'Alt pop', 'United States', 'H'],
  ['Ed Sheeran', '', 'Pop', 'Pop', 'United Kingdom', 'H'],
  ['Harry Styles', '', 'Pop', 'Pop rock', 'United Kingdom', 'H'],
  ['Olivia Rodrigo', '', 'Pop', 'Pop rock', 'United States', 'H'],
  ['Sabrina Carpenter', '', 'Pop', 'Pop', 'United States', 'H'],
  ['Charli XCX', '', 'Pop', 'Hyperpop', 'United Kingdom', 'H'],
  ['Lady Gaga', '', 'Pop', 'Dance pop', 'United States', 'H'],
  ['Ariana Grande', '', 'Pop', 'Pop / R&B', 'United States', 'H'],
  ['Adele', '', 'Pop', 'Soul pop', 'United Kingdom', 'H'],
  ['Bruno Mars', '', 'Pop', 'Funk pop', 'United States', 'H'],
  ['Katy Perry', '', 'Pop', 'Pop', 'United States', 'H'],
  ['Miley Cyrus', '', 'Pop', 'Pop rock', 'United States', 'H'],
  ['Sam Smith', '', 'Pop', 'Soul pop', 'United Kingdom', 'M'],
  ['Lizzo', '', 'Pop', 'Funk pop', 'United States', 'M'],
  ['Shawn Mendes', '', 'Pop', 'Pop', 'Canada', 'M'],
  ['Lewis Capaldi', '', 'Pop', 'Pop ballads', 'United Kingdom', 'M'],
  ['Rita Ora', '', 'Pop', 'Dance pop', 'United Kingdom', 'M'],
  ['Ellie Goulding', '', 'Pop', 'Electropop', 'United Kingdom', 'M'],
  ['Sia', '', 'Pop', 'Pop', 'Australia', 'M'],
  ['Lorde', '', 'Pop', 'Art pop', 'New Zealand', 'M'],
  ['Chappell Roan', '', 'Pop', 'Synth pop', 'United States', 'M'],
  ['Tate McRae', '', 'Pop', 'Dance pop', 'Canada', 'M'],
  ['Kylie Minogue', '', 'Pop', 'Disco pop', 'Australia', 'M'],
  ['Robbie Williams', '', 'Pop', 'Pop', 'United Kingdom', 'M'],
  ['Zara Larsson', '', 'Pop', 'Dance pop', 'Sweden', 'M'],
  ['Tove Lo', '', 'Pop', 'Electropop', 'Sweden', 'M'],
  ['Aurora', 'Aurora (singer)', 'Pop', 'Art pop', 'Norway', 'M'],
  ['Sigrid', 'Sigrid (singer)', 'Pop', 'Pop', 'Norway', 'R'],
  ['Raye', 'Raye (singer)', 'Pop', 'Pop / soul', 'United Kingdom', 'M'],
  ['Jessie Ware', '', 'Pop', 'Disco pop', 'United Kingdom', 'R'],
  ['Christine and the Queens', '', 'Pop', 'Synth pop', 'France', 'M'],
  ['Stromae', '', 'Pop', 'Electro chanson', 'Belgium', 'H'],
  ['Angèle', 'Angèle (singer)', 'Pop', 'French pop', 'Belgium', 'M'],
  ['Loreen', '', 'Pop', 'Dance pop', 'Sweden', 'R'],
  ['Benson Boone', '', 'Pop', 'Pop rock', 'United States', 'M'],
  ['Conan Gray', '', 'Pop', 'Indie pop', 'United States', 'R'],
  ['Gracie Abrams', '', 'Pop', 'Singer-songwriter pop', 'United States', 'M'],
  ['Troye Sivan', '', 'Pop', 'Dance pop', 'Australia', 'M'],
  ['Justin Bieber', '', 'Pop', 'Pop', 'Canada', 'H'],
  ['Coldplay', '', 'Pop', 'Pop rock', 'United Kingdom', 'H'],
  ['Imagine Dragons', '', 'Pop', 'Pop rock', 'United States', 'H'],
  ['OneRepublic', '', 'Pop', 'Pop rock', 'United States', 'M'],
  ['Maroon 5', '', 'Pop', 'Pop rock', 'United States', 'H'],
  ['Blackpink', '', 'Pop', 'K-pop', 'South Korea', 'H'],
  ['BTS', '', 'Pop', 'K-pop', 'South Korea', 'H'],
  ['Stray Kids', '', 'Pop', 'K-pop', 'South Korea', 'H'],
  ['Twice', 'Twice (group)', 'Pop', 'K-pop', 'South Korea', 'M'],
  ['Seventeen', 'Seventeen (South Korean band)', 'Pop', 'K-pop', 'South Korea', 'M'],
  ['Yoasobi', '', 'Pop', 'J-pop', 'Japan', 'M'],
  ['Fujii Kaze', '', 'Pop', 'J-pop', 'Japan', 'M'],
  ['Hikaru Utada', '', 'Pop', 'J-pop', 'Japan', 'M'],
  ['Kenshi Yonezu', '', 'Pop', 'J-pop', 'Japan', 'M'],
  ['Rina Sawayama', '', 'Pop', 'Art pop', 'United Kingdom', 'R'],
  ['Måneskin', '', 'Rock', 'Glam rock', 'Italy', 'H'],

  // ---------- Rock ----------
  ['Foo Fighters', '', 'Rock', 'Rock', 'United States', 'H'],
  ['Arctic Monkeys', '', 'Rock', 'Indie rock', 'United Kingdom', 'H'],
  ['Muse', 'Muse (band)', 'Rock', 'Alternative rock', 'United Kingdom', 'H'],
  ['Queens of the Stone Age', '', 'Rock', 'Stoner rock', 'United States', 'M'],
  ['Red Hot Chili Peppers', '', 'Rock', 'Funk rock', 'United States', 'H'],
  ['Green Day', '', 'Rock', 'Punk rock', 'United States', 'H'],
  ['Pearl Jam', '', 'Rock', 'Grunge', 'United States', 'H'],
  ['The Killers', '', 'Rock', 'Indie rock', 'United States', 'H'],
  ['Kings of Leon', '', 'Rock', 'Rock', 'United States', 'M'],
  ['Placebo', 'Placebo (band)', 'Rock', 'Alternative rock', 'United Kingdom', 'M'],
  ['The Black Keys', '', 'Rock', 'Blues rock', 'United States', 'M'],
  ['Royal Blood', 'Royal Blood (band)', 'Rock', 'Hard rock', 'United Kingdom', 'M'],
  ['Greta Van Fleet', '', 'Rock', 'Hard rock', 'United States', 'M'],
  ['Biffy Clyro', '', 'Rock', 'Alternative rock', 'United Kingdom', 'M'],
  ['Jack White', '', 'Rock', 'Garage rock', 'United States', 'M'],
  ['Pixies', '', 'Rock', 'Alternative rock', 'United States', 'M'],
  ['The Smashing Pumpkins', '', 'Rock', 'Alternative rock', 'United States', 'M'],
  ['Franz Ferdinand', 'Franz Ferdinand (band)', 'Rock', 'Indie rock', 'United Kingdom', 'M'],
  ['Kasabian', '', 'Rock', 'Indie rock', 'United Kingdom', 'M'],
  ['Blur', 'Blur (band)', 'Rock', 'Britpop', 'United Kingdom', 'H'],
  ['Pulp', 'Pulp (band)', 'Rock', 'Britpop', 'United Kingdom', 'M'],
  ['Oasis', 'Oasis (band)', 'Rock', 'Britpop', 'United Kingdom', 'H'],
  ['The Cure', '', 'Rock', 'Post-punk', 'United Kingdom', 'H'],
  ['Garbage', 'Garbage (band)', 'Rock', 'Alternative rock', 'United States', 'M'],
  ['Interpol', 'Interpol (band)', 'Rock', 'Post-punk revival', 'United States', 'M'],
  ['The Strokes', '', 'Rock', 'Garage rock', 'United States', 'H'],
  ['Yeah Yeah Yeahs', '', 'Rock', 'Art punk', 'United States', 'M'],
  ['Wolf Alice', '', 'Rock', 'Alternative rock', 'United Kingdom', 'M'],
  ['Idles', '', 'Rock', 'Post-punk', 'United Kingdom', 'M'],
  ['Fontaines D.C.', '', 'Rock', 'Post-punk', 'Ireland', 'M'],
  ['Turnstile', 'Turnstile (band)', 'Rock', 'Hardcore', 'United States', 'R'],
  ['Paramore', '', 'Rock', 'Pop punk', 'United States', 'H'],
  ['Linkin Park', '', 'Rock', 'Nu metal / rock', 'United States', 'H'],
  ['Weezer', '', 'Rock', 'Power pop', 'United States', 'M'],
  ['Nothing But Thieves', '', 'Rock', 'Alternative rock', 'United Kingdom', 'R'],
  ['The Hives', '', 'Rock', 'Garage rock', 'Sweden', 'M'],
  ['Xutos & Pontapés', '', 'Rock', 'Portuguese rock', 'Portugal', 'M'],
  ['Ornatos Violeta', '', 'Rock', 'Alternative rock', 'Portugal', 'R'],

  // ---------- Indie & Alternative ----------
  ['Tame Impala', '', 'Indie', 'Psychedelic pop', 'Australia', 'H'],
  ['Phoenix', 'Phoenix (band)', 'Indie', 'Indie pop', 'France', 'M'],
  ['Vampire Weekend', '', 'Indie', 'Indie rock', 'United States', 'M'],
  ['Florence and the Machine', '', 'Indie', 'Art rock', 'United Kingdom', 'H'],
  ['Lana Del Rey', '', 'Indie', 'Dream pop', 'United States', 'H'],
  ['The 1975', '', 'Indie', 'Pop rock', 'United Kingdom', 'H'],
  ['Bon Iver', '', 'Indie', 'Indie folk', 'United States', 'M'],
  ['Bombay Bicycle Club', '', 'Indie', 'Indie rock', 'United Kingdom', 'R'],
  ['Two Door Cinema Club', '', 'Indie', 'Indie pop', 'United Kingdom', 'M'],
  ['Glass Animals', '', 'Indie', 'Psychedelic pop', 'United Kingdom', 'M'],
  ['alt-J', '', 'Indie', 'Art rock', 'United Kingdom', 'M'],
  ['Foals', 'Foals (band)', 'Indie', 'Indie rock', 'United Kingdom', 'M'],
  ['Mitski', '', 'Indie', 'Indie rock', 'United States', 'M'],
  ['Phoebe Bridgers', '', 'Indie', 'Indie folk', 'United States', 'M'],
  ['Beach House', '', 'Indie', 'Dream pop', 'United States', 'M'],
  ['MGMT', '', 'Indie', 'Psychedelic pop', 'United States', 'M'],
  ['Hozier', 'Hozier (musician)', 'Indie', 'Soul rock', 'Ireland', 'H'],
  ['Radiohead', '', 'Indie', 'Art rock', 'United Kingdom', 'H'],
  ['Massive Attack', '', 'Indie', 'Trip hop', 'United Kingdom', 'M'],
  ['Portishead', '', 'Indie', 'Trip hop', 'United Kingdom', 'M'],
  ['Björk', '', 'Indie', 'Art pop', 'Iceland', 'M'],
  ['Japanese Breakfast', '', 'Indie', 'Indie pop', 'United States', 'R'],
  ['Mac DeMarco', '', 'Indie', 'Slacker rock', 'Canada', 'R'],
  ['King Gizzard & the Lizard Wizard', '', 'Indie', 'Psychedelic rock', 'Australia', 'M'],
  ['Khruangbin', '', 'Indie', 'Psychedelic funk', 'United States', 'M'],
  ['Parcels', 'Parcels (band)', 'Indie', 'Electro funk', 'Australia', 'R'],
  ['Wet Leg', '', 'Indie', 'Indie rock', 'United Kingdom', 'R'],
  ['Sufjan Stevens', '', 'Indie', 'Indie folk', 'United States', 'M'],
  ['The National', 'The National (band)', 'Indie', 'Indie rock', 'United States', 'M'],
  ['Metronomy', '', 'Indie', 'Electropop', 'United Kingdom', 'R'],
  ['Cigarettes After Sex', '', 'Indie', 'Dream pop', 'United States', 'M'],
  ['Arlo Parks', '', 'Indie', 'Indie soul', 'United Kingdom', 'R'],
  ['Clairo', '', 'Indie', 'Bedroom pop', 'United States', 'R'],
  ['Beabadoobee', '', 'Indie', 'Indie rock', 'United Kingdom', 'R'],
  ['Girl in Red', '', 'Indie', 'Indie pop', 'Norway', 'R'],
  ['Sampha', '', 'Indie', 'Electronic soul', 'United Kingdom', 'R'],
  ['Salvador Sobral', '', 'Indie', 'Jazz pop', 'Portugal', 'R'],

  // ---------- Electronic ----------
  ['Calvin Harris', '', 'Electronic', 'EDM', 'United Kingdom', 'H'],
  ['David Guetta', '', 'Electronic', 'EDM', 'France', 'H'],
  ['Martin Garrix', '', 'Electronic', 'EDM', 'Netherlands', 'H'],
  ['Tiësto', '', 'Electronic', 'EDM', 'Netherlands', 'H'],
  ['Swedish House Mafia', '', 'Electronic', 'Progressive house', 'Sweden', 'H'],
  ['Disclosure', 'Disclosure (band)', 'Electronic', 'House', 'United Kingdom', 'M'],
  ['The Chemical Brothers', '', 'Electronic', 'Big beat', 'United Kingdom', 'H'],
  ['Justice', 'Justice (band)', 'Electronic', 'French house', 'France', 'M'],
  ['Peggy Gou', '', 'Electronic', 'House', 'South Korea', 'M'],
  ['Charlotte de Witte', '', 'Electronic', 'Techno', 'Belgium', 'M'],
  ['Amelie Lens', '', 'Electronic', 'Techno', 'Belgium', 'M'],
  ['Carl Cox', '', 'Electronic', 'Techno / house', 'United Kingdom', 'M'],
  ['Solomun', '', 'Electronic', 'Deep house', 'Germany', 'M'],
  ['Black Coffee', 'Black Coffee (DJ)', 'Electronic', 'Afro house', 'South Africa', 'M'],
  ['Bonobo', 'Bonobo (musician)', 'Electronic', 'Downtempo', 'United Kingdom', 'M'],
  ['Four Tet', '', 'Electronic', 'Electronica', 'United Kingdom', 'M'],
  ['Jamie xx', '', 'Electronic', 'Electronica', 'United Kingdom', 'M'],
  ['Fred Again', '', 'Electronic', 'House', 'United Kingdom', 'H'],
  ['Kaytranada', '', 'Electronic', 'House / R&B', 'Canada', 'M'],
  ['Rüfüs Du Sol', '', 'Electronic', 'Melodic house', 'Australia', 'M'],
  ['Moderat', '', 'Electronic', 'Electronica', 'Germany', 'M'],
  ['Paul Kalkbrenner', '', 'Electronic', 'Techno', 'Germany', 'M'],
  ['Boris Brejcha', '', 'Electronic', 'High-tech minimal', 'Germany', 'M'],
  ['Armin van Buuren', '', 'Electronic', 'Trance', 'Netherlands', 'H'],
  ['Alok', 'Alok (DJ)', 'Electronic', 'Brazilian bass', 'Brazil', 'M'],
  ['Kygo', '', 'Electronic', 'Tropical house', 'Norway', 'H'],
  ['Marshmello', '', 'Electronic', 'EDM', 'United States', 'H'],
  ['Skrillex', '', 'Electronic', 'Dubstep', 'United States', 'H'],
  ['Diplo', '', 'Electronic', 'EDM', 'United States', 'M'],
  ['Purple Disco Machine', '', 'Electronic', 'Nu-disco', 'Germany', 'M'],
  ['Fatboy Slim', '', 'Electronic', 'Big beat', 'United Kingdom', 'M'],
  ['Underworld', 'Underworld (band)', 'Electronic', 'Techno', 'United Kingdom', 'M'],
  ['Moby', '', 'Electronic', 'Electronica', 'United States', 'M'],
  ['Röyksopp', '', 'Electronic', 'Electronica', 'Norway', 'M'],
  ['Air', 'Air (French band)', 'Electronic', 'Downtempo', 'France', 'M'],
  ['Kraftwerk', '', 'Electronic', 'Electro', 'Germany', 'M'],
  ['Jon Hopkins', '', 'Electronic', 'Ambient techno', 'United Kingdom', 'R'],
  ['Floating Points', '', 'Electronic', 'Electronica', 'United Kingdom', 'R'],
  ['Overmono', '', 'Electronic', 'UK bass', 'United Kingdom', 'R'],
  ['Eric Prydz', '', 'Electronic', 'Progressive house', 'Sweden', 'M'],
  ['Odesza', '', 'Electronic', 'Electronica', 'United States', 'M'],
  ['Flume', 'Flume (musician)', 'Electronic', 'Future bass', 'Australia', 'M'],
  ['DJ Snake', '', 'Electronic', 'EDM / trap', 'France', 'H'],
  ['Sofi Tukker', '', 'Electronic', 'Dance pop', 'United States', 'R'],
  ['Dom Dolla', '', 'Electronic', 'Tech house', 'Australia', 'M'],
  ['John Summit', '', 'Electronic', 'Tech house', 'United States', 'M'],
  ['Nina Kraviz', '', 'Electronic', 'Techno', 'Russia', 'M'],
  ['The Prodigy', '', 'Electronic', 'Big beat', 'United Kingdom', 'M'],
  ['Depeche Mode', '', 'Electronic', 'Synth pop', 'United Kingdom', 'H'],
  ['Buraka Som Sistema', '', 'Electronic', 'Kuduro', 'Portugal', 'R'],

  // ---------- Hip-hop ----------
  ['Kendrick Lamar', '', 'Hip-hop', 'Hip-hop', 'United States', 'H'],
  ['Travis Scott', '', 'Hip-hop', 'Trap', 'United States', 'H'],
  ['Drake', 'Drake (musician)', 'Hip-hop', 'Hip-hop', 'Canada', 'H'],
  ['Post Malone', '', 'Hip-hop', 'Pop rap', 'United States', 'H'],
  ['Tyler, the Creator', '', 'Hip-hop', 'Alternative hip-hop', 'United States', 'H'],
  ['J. Cole', '', 'Hip-hop', 'Hip-hop', 'United States', 'H'],
  ['Eminem', '', 'Hip-hop', 'Hip-hop', 'United States', 'H'],
  ['Nicki Minaj', '', 'Hip-hop', 'Hip-hop / pop', 'Trinidad and Tobago', 'H'],
  ['Megan Thee Stallion', '', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['Cardi B', '', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['Doja Cat', '', 'Hip-hop', 'Pop rap', 'United States', 'H'],
  ['Lil Nas X', '', 'Hip-hop', 'Pop rap', 'United States', 'M'],
  ['Stormzy', '', 'Hip-hop', 'Grime', 'United Kingdom', 'H'],
  ['Dave', 'Dave (rapper)', 'Hip-hop', 'UK rap', 'United Kingdom', 'M'],
  ['Little Simz', '', 'Hip-hop', 'UK rap', 'United Kingdom', 'M'],
  ['Central Cee', '', 'Hip-hop', 'UK drill', 'United Kingdom', 'M'],
  ['Skepta', '', 'Hip-hop', 'Grime', 'United Kingdom', 'M'],
  ['ASAP Rocky', 'ASAP Rocky', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['21 Savage', '', 'Hip-hop', 'Trap', 'United States', 'M'],
  ['Metro Boomin', '', 'Hip-hop', 'Trap', 'United States', 'M'],
  ['Run the Jewels', '', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['Missy Elliott', '', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['Snoop Dogg', '', 'Hip-hop', 'West Coast hip-hop', 'United States', 'H'],
  ['Wu-Tang Clan', '', 'Hip-hop', 'East Coast hip-hop', 'United States', 'M'],
  ['Denzel Curry', '', 'Hip-hop', 'Hip-hop', 'United States', 'R'],
  ['JID', '', 'Hip-hop', 'Hip-hop', 'United States', 'R'],
  ['Doechii', '', 'Hip-hop', 'Hip-hop', 'United States', 'M'],
  ['Ice Spice', '', 'Hip-hop', 'Drill', 'United States', 'R'],
  ['Future', 'Future (rapper)', 'Hip-hop', 'Trap', 'United States', 'H'],
  ['Kano', 'Kano (rapper)', 'Hip-hop', 'Grime', 'United Kingdom', 'R'],
  ['Loyle Carner', '', 'Hip-hop', 'Jazz rap', 'United Kingdom', 'R'],
  ['Apache 207', '', 'Hip-hop', 'German rap', 'Germany', 'M'],
  ['Booba', '', 'Hip-hop', 'French rap', 'France', 'M'],
  ['PNL', 'PNL (group)', 'Hip-hop', 'French rap', 'France', 'M'],
  ['Aya Nakamura', '', 'Hip-hop', 'Afropop / R&B', 'France', 'M'],
  ['Slow J', '', 'Hip-hop', 'Portuguese hip-hop', 'Portugal', 'M'],
  ['ProfJam', '', 'Hip-hop', 'Portuguese hip-hop', 'Portugal', 'R'],
  ['Capicua', '', 'Hip-hop', 'Portuguese hip-hop', 'Portugal', 'R'],
  ['Dillaz', '', 'Hip-hop', 'Portuguese hip-hop', 'Portugal', 'R'],

  // ---------- R&B & Soul ----------
  ['The Weeknd', '', 'R&B & Soul', 'Alternative R&B', 'Canada', 'H'],
  ['SZA', '', 'R&B & Soul', 'Alternative R&B', 'United States', 'H'],
  ['Beyoncé', '', 'R&B & Soul', 'R&B / pop', 'United States', 'H'],
  ['Rihanna', '', 'R&B & Soul', 'R&B / pop', 'Barbados', 'H'],
  ['Frank Ocean', '', 'R&B & Soul', 'Alternative R&B', 'United States', 'H'],
  ['Alicia Keys', '', 'R&B & Soul', 'R&B / soul', 'United States', 'H'],
  ['H.E.R.', '', 'R&B & Soul', 'R&B', 'United States', 'M'],
  ['Daniel Caesar', '', 'R&B & Soul', 'R&B / soul', 'Canada', 'M'],
  ['Jorja Smith', '', 'R&B & Soul', 'R&B / soul', 'United Kingdom', 'M'],
  ['Victoria Monét', '', 'R&B & Soul', 'R&B', 'United States', 'R'],
  ['Brent Faiyaz', '', 'R&B & Soul', 'Alternative R&B', 'United States', 'M'],
  ['Steve Lacy', '', 'R&B & Soul', 'Alternative R&B', 'United States', 'M'],
  ['Anderson .Paak', '', 'R&B & Soul', 'Funk / soul', 'United States', 'M'],
  ['Leon Bridges', '', 'R&B & Soul', 'Retro soul', 'United States', 'M'],
  ['Erykah Badu', '', 'R&B & Soul', 'Neo soul', 'United States', 'M'],
  ['Lauryn Hill', '', 'R&B & Soul', 'Neo soul / hip-hop', 'United States', 'M'],
  ['Janelle Monáe', '', 'R&B & Soul', 'Funk / R&B', 'United States', 'M'],
  ['Usher', 'Usher (musician)', 'R&B & Soul', 'R&B', 'United States', 'H'],
  ['Mary J. Blige', '', 'R&B & Soul', 'R&B / soul', 'United States', 'M'],
  ['Jon Batiste', '', 'R&B & Soul', 'Soul / jazz', 'United States', 'M'],
  ['Black Pumas', '', 'R&B & Soul', 'Psychedelic soul', 'United States', 'R'],
  ['Michael Kiwanuka', '', 'R&B & Soul', 'Soul', 'United Kingdom', 'M'],
  ['Celeste', 'Celeste (singer)', 'R&B & Soul', 'Soul', 'United Kingdom', 'R'],
  ['Cleo Sol', '', 'R&B & Soul', 'Neo soul', 'United Kingdom', 'R'],
  ['Masego', '', 'R&B & Soul', 'Jazz / R&B', 'United States', 'R'],

  // ---------- Latin ----------
  ['Bad Bunny', '', 'Latin', 'Reggaeton', 'Puerto Rico', 'H'],
  ['Karol G', '', 'Latin', 'Reggaeton', 'Colombia', 'H'],
  ['Rosalía', '', 'Latin', 'Flamenco pop', 'Spain', 'H'],
  ['J Balvin', '', 'Latin', 'Reggaeton', 'Colombia', 'H'],
  ['Shakira', '', 'Latin', 'Latin pop', 'Colombia', 'H'],
  ['Peso Pluma', '', 'Latin', 'Corridos tumbados', 'Mexico', 'H'],
  ['Rauw Alejandro', '', 'Latin', 'Reggaeton', 'Puerto Rico', 'M'],
  ['Feid', '', 'Latin', 'Reggaeton', 'Colombia', 'M'],
  ['Anitta', 'Anitta (singer)', 'Latin', 'Funk carioca / pop', 'Brazil', 'H'],
  ['Maluma', '', 'Latin', 'Reggaeton', 'Colombia', 'M'],
  ['Daddy Yankee', '', 'Latin', 'Reggaeton', 'Puerto Rico', 'H'],
  ['Ozuna', 'Ozuna (singer)', 'Latin', 'Reggaeton', 'Puerto Rico', 'M'],
  ['Bizarrap', '', 'Latin', 'Argentine trap', 'Argentina', 'M'],
  ['Myke Towers', '', 'Latin', 'Latin trap', 'Puerto Rico', 'M'],
  ['Natalia Lafourcade', '', 'Latin', 'Latin folk', 'Mexico', 'M'],
  ['Jorge Drexler', '', 'Latin', 'Singer-songwriter', 'Uruguay', 'R'],
  ['C. Tangana', '', 'Latin', 'Urban flamenco', 'Spain', 'M'],
  ['Quevedo', 'Quevedo (singer)', 'Latin', 'Reggaeton', 'Spain', 'M'],
  ['Bomba Estéreo', '', 'Latin', 'Electro cumbia', 'Colombia', 'R'],
  ['Café Tacvba', '', 'Latin', 'Latin rock', 'Mexico', 'M'],
  ['Los Ángeles Azules', '', 'Latin', 'Cumbia', 'Mexico', 'M'],
  ['Juanes', '', 'Latin', 'Latin rock', 'Colombia', 'M'],
  ['Marc Anthony', '', 'Latin', 'Salsa', 'United States', 'H'],
  ['Romeo Santos', '', 'Latin', 'Bachata', 'United States', 'H'],
  ['Mon Laferte', '', 'Latin', 'Latin rock / bolero', 'Chile', 'R'],
  ['Nathy Peluso', '', 'Latin', 'Latin urban / salsa', 'Argentina', 'R'],
  ['Ivete Sangalo', '', 'Latin', 'Axé', 'Brazil', 'M'],
  ['Caetano Veloso', '', 'Latin', 'MPB', 'Brazil', 'M'],
  ['Gilberto Gil', '', 'Latin', 'MPB', 'Brazil', 'M'],
  ['Seu Jorge', '', 'Latin', 'Samba / MPB', 'Brazil', 'R'],
  ['Ludmilla', 'Ludmilla (singer)', 'Latin', 'Funk carioca', 'Brazil', 'M'],
  ['Pabllo Vittar', '', 'Latin', 'Brazilian pop', 'Brazil', 'M'],

  // ---------- Afrobeats & Amapiano ----------
  ['Burna Boy', '', 'Afrobeats', 'Afro-fusion', 'Nigeria', 'H'],
  ['Wizkid', '', 'Afrobeats', 'Afrobeats', 'Nigeria', 'H'],
  ['Davido', '', 'Afrobeats', 'Afrobeats', 'Nigeria', 'H'],
  ['Tems', 'Tems (singer)', 'Afrobeats', 'Alté / R&B', 'Nigeria', 'M'],
  ['Rema', 'Rema (singer)', 'Afrobeats', 'Afrobeats', 'Nigeria', 'M'],
  ['Ayra Starr', '', 'Afrobeats', 'Afropop', 'Nigeria', 'M'],
  ['Asake', '', 'Afrobeats', 'Afrobeats / amapiano', 'Nigeria', 'M'],
  ['Tyla', 'Tyla (singer)', 'Afrobeats', 'Amapiano pop', 'South Africa', 'M'],
  ['Uncle Waffles', '', 'Afrobeats', 'Amapiano', 'Eswatini', 'R'],
  ['Master KG', '', 'Afrobeats', 'Afro house', 'South Africa', 'R'],
  ['Diamond Platnumz', '', 'Afrobeats', 'Bongo flava', 'Tanzania', 'M'],
  ['Sauti Sol', '', 'Afrobeats', 'Afropop', 'Kenya', 'R'],
  ['Dino D\'Santiago', '', 'Afrobeats', 'Kriolu / Afro-Portuguese', 'Portugal', 'R'],
  ['Pongo', 'Pongo (musician)', 'Afrobeats', 'Kuduro', 'Portugal', 'R'],
  ['Calema', '', 'Afrobeats', 'Kizomba / Afropop', 'São Tomé and Príncipe', 'R'],
  ['Mayra Andrade', '', 'Afrobeats', 'Cape Verdean music', 'Cape Verde', 'R'],

  // ---------- World & Fado ----------
  ['Ana Moura', '', 'World & Fado', 'Fado', 'Portugal', 'M'],
  ['Mariza', '', 'World & Fado', 'Fado', 'Portugal', 'M'],
  ['Carminho', '', 'World & Fado', 'Fado', 'Portugal', 'R'],
  ['Madredeus', '', 'World & Fado', 'Fado / folk', 'Portugal', 'R'],
  ['Rodrigo Leão', '', 'World & Fado', 'Neoclassical', 'Portugal', 'R'],
  ['Angélique Kidjo', '', 'World & Fado', 'Afropop', 'Benin', 'M'],
  ['Salif Keita', '', 'World & Fado', 'Afropop', 'Mali', 'R'],
  ['Youssou N\'Dour', '', 'World & Fado', 'Mbalax', 'Senegal', 'M'],
  ['Tinariwen', '', 'World & Fado', 'Desert blues', 'Mali', 'R'],
  ['Bombino', 'Bombino (musician)', 'World & Fado', 'Desert blues', 'Niger', 'R'],
  ['Mdou Moctar', '', 'World & Fado', 'Desert rock', 'Niger', 'R'],
  ['Fatoumata Diawara', '', 'World & Fado', 'Wassoulou', 'Mali', 'R'],
  ['Seun Kuti', '', 'World & Fado', 'Afrobeat', 'Nigeria', 'R'],
  ['Femi Kuti', '', 'World & Fado', 'Afrobeat', 'Nigeria', 'R'],
  ['Amadou & Mariam', '', 'World & Fado', 'Afropop', 'Mali', 'R'],
  ['Sona Jobarteh', '', 'World & Fado', 'Kora', 'The Gambia', 'R'],
  ['Anoushka Shankar', '', 'World & Fado', 'Sitar / fusion', 'United Kingdom', 'R'],
  ['A. R. Rahman', '', 'World & Fado', 'Film music', 'India', 'H'],
  ['Diljit Dosanjh', '', 'World & Fado', 'Punjabi pop', 'India', 'H'],
  ['Ibrahim Maalouf', '', 'World & Fado', 'Jazz fusion', 'France', 'R'],

  // ---------- Jazz & Blues ----------
  ['Kamasi Washington', '', 'Jazz & Blues', 'Spiritual jazz', 'United States', 'M'],
  ['Norah Jones', '', 'Jazz & Blues', 'Vocal jazz', 'United States', 'M'],
  ['Gregory Porter', '', 'Jazz & Blues', 'Vocal jazz', 'United States', 'M'],
  ['Esperanza Spalding', '', 'Jazz & Blues', 'Jazz', 'United States', 'R'],
  ['Robert Glasper', '', 'Jazz & Blues', 'Jazz / hip-hop', 'United States', 'R'],
  ['Snarky Puppy', '', 'Jazz & Blues', 'Jazz fusion', 'United States', 'R'],
  ['Herbie Hancock', '', 'Jazz & Blues', 'Jazz', 'United States', 'M'],
  ['Diana Krall', '', 'Jazz & Blues', 'Vocal jazz', 'Canada', 'M'],
  ['Jacob Collier', '', 'Jazz & Blues', 'Jazz / pop', 'United Kingdom', 'M'],
  ['GoGo Penguin', '', 'Jazz & Blues', 'Jazz trio', 'United Kingdom', 'R'],
  ['Ezra Collective', '', 'Jazz & Blues', 'UK jazz', 'United Kingdom', 'R'],
  ['Nubya Garcia', '', 'Jazz & Blues', 'UK jazz', 'United Kingdom', 'R'],
  ['Shabaka Hutchings', '', 'Jazz & Blues', 'Jazz', 'United Kingdom', 'R'],
  ['Cécile McLorin Salvant', '', 'Jazz & Blues', 'Vocal jazz', 'United States', 'R'],
  ['Samara Joy', '', 'Jazz & Blues', 'Vocal jazz', 'United States', 'R'],
  ['Gary Clark Jr.', '', 'Jazz & Blues', 'Blues rock', 'United States', 'M'],
  ['Joe Bonamassa', '', 'Jazz & Blues', 'Blues rock', 'United States', 'M'],
  ['Buddy Guy', '', 'Jazz & Blues', 'Chicago blues', 'United States', 'M'],
  ['Melody Gardot', '', 'Jazz & Blues', 'Vocal jazz', 'United States', 'R'],
  ['Avishai Cohen', 'Avishai Cohen (bassist)', 'Jazz & Blues', 'Jazz', 'Israel', 'R'],
  ['Hiromi Uehara', '', 'Jazz & Blues', 'Jazz fusion', 'Japan', 'R'],
  ['BadBadNotGood', '', 'Jazz & Blues', 'Jazz / hip-hop', 'Canada', 'R'],
  ['Thundercat', 'Thundercat (musician)', 'Jazz & Blues', 'Jazz funk', 'United States', 'M'],
  ['Tom Misch', '', 'Jazz & Blues', 'Jazz pop', 'United Kingdom', 'R'],
  ['Yussef Dayes', '', 'Jazz & Blues', 'UK jazz', 'United Kingdom', 'R'],

  // ---------- Folk & Country ----------
  ['Mumford & Sons', '', 'Folk & Country', 'Folk rock', 'United Kingdom', 'M'],
  ['The Lumineers', '', 'Folk & Country', 'Folk rock', 'United States', 'M'],
  ['Of Monsters and Men', '', 'Folk & Country', 'Indie folk', 'Iceland', 'M'],
  ['First Aid Kit', 'First Aid Kit (band)', 'Folk & Country', 'Folk', 'Sweden', 'R'],
  ['Passenger', 'Passenger (singer)', 'Folk & Country', 'Folk pop', 'United Kingdom', 'R'],
  ['Ben Howard', '', 'Folk & Country', 'Folk', 'United Kingdom', 'R'],
  ['José González', 'José González (singer)', 'Folk & Country', 'Indie folk', 'Sweden', 'R'],
  ['Fleet Foxes', '', 'Folk & Country', 'Indie folk', 'United States', 'M'],
  ['Iron & Wine', '', 'Folk & Country', 'Indie folk', 'United States', 'R'],
  ['Noah Kahan', '', 'Folk & Country', 'Folk pop', 'United States', 'M'],
  ['Zach Bryan', '', 'Folk & Country', 'Country / folk', 'United States', 'H'],
  ['Kacey Musgraves', '', 'Folk & Country', 'Country pop', 'United States', 'M'],
  ['Brandi Carlile', '', 'Folk & Country', 'Americana', 'United States', 'M'],
  ['Damien Rice', '', 'Folk & Country', 'Folk', 'Ireland', 'R'],
  ['Chris Stapleton', '', 'Folk & Country', 'Country', 'United States', 'H'],
  ['Dolly Parton', '', 'Folk & Country', 'Country', 'United States', 'H'],
  ['Luke Combs', '', 'Folk & Country', 'Country', 'United States', 'H'],
  ['Ludovico Einaudi', '', 'Folk & Country', 'Neoclassical', 'Italy', 'M'],
  ['Agnes Obel', '', 'Folk & Country', 'Neoclassical folk', 'Denmark', 'R'],
  ['Ólafur Arnalds', '', 'Folk & Country', 'Neoclassical', 'Iceland', 'R'],
  ['Nils Frahm', '', 'Folk & Country', 'Neoclassical', 'Germany', 'R'],
  ['Max Richter', '', 'Folk & Country', 'Neoclassical', 'United Kingdom', 'R'],

  // ---------- Metal & Punk ----------
  ['Metallica', '', 'Metal & Punk', 'Heavy metal', 'United States', 'H'],
  ['Iron Maiden', '', 'Metal & Punk', 'Heavy metal', 'United Kingdom', 'H'],
  ['Rammstein', '', 'Metal & Punk', 'Industrial metal', 'Germany', 'H'],
  ['Ghost', 'Ghost (Swedish band)', 'Metal & Punk', 'Heavy metal', 'Sweden', 'M'],
  ['Slipknot', '', 'Metal & Punk', 'Nu metal', 'United States', 'H'],
  ['System of a Down', '', 'Metal & Punk', 'Alternative metal', 'United States', 'H'],
  ['Gojira', 'Gojira (band)', 'Metal & Punk', 'Progressive metal', 'France', 'M'],
  ['Bring Me the Horizon', '', 'Metal & Punk', 'Metalcore', 'United Kingdom', 'H'],
  ['Architects', 'Architects (British band)', 'Metal & Punk', 'Metalcore', 'United Kingdom', 'M'],
  ['Tool', 'Tool (band)', 'Metal & Punk', 'Progressive metal', 'United States', 'H'],
  ['Avenged Sevenfold', '', 'Metal & Punk', 'Heavy metal', 'United States', 'M'],
  ['Sleep Token', '', 'Metal & Punk', 'Alternative metal', 'United Kingdom', 'M'],
  ['Babymetal', '', 'Metal & Punk', 'Kawaii metal', 'Japan', 'M'],
  ['Parkway Drive', '', 'Metal & Punk', 'Metalcore', 'Australia', 'M'],
  ['Mastodon', 'Mastodon (band)', 'Metal & Punk', 'Progressive metal', 'United States', 'M'],
  ['Deftones', '', 'Metal & Punk', 'Alternative metal', 'United States', 'M'],
  ['Korn', '', 'Metal & Punk', 'Nu metal', 'United States', 'M'],
  ['The Offspring', '', 'Metal & Punk', 'Punk rock', 'United States', 'M'],
  ['Bad Religion', '', 'Metal & Punk', 'Punk rock', 'United States', 'R'],
  ['Rise Against', '', 'Metal & Punk', 'Punk rock', 'United States', 'M'],
  ['Blink-182', '', 'Metal & Punk', 'Pop punk', 'United States', 'H'],
  ['Moonspell', '', 'Metal & Punk', 'Gothic metal', 'Portugal', 'R'],

  // ---------- More Portuguese pop ----------
  ['Bárbara Bandeira', '', 'Pop', 'Portuguese pop', 'Portugal', 'R'],
  ['Carolina Deslandes', '', 'Pop', 'Portuguese pop', 'Portugal', 'R'],
  ['Pedro Abrunhosa', '', 'Pop', 'Portuguese pop rock', 'Portugal', 'R'],
  ['Diogo Piçarra', '', 'Pop', 'Portuguese pop', 'Portugal', 'R'],
  ['Richie Campbell', '', 'Pop', 'Reggae / pop', 'Portugal', 'R']
];

const ARTIST_SIZES = {
  H: { label: 'Headliner', min: 90000, max: 250000, step: 5000, duration: 90 },
  M: { label: 'Main stage', min: 25000, max: 85000, step: 2500, duration: 75 },
  R: { label: 'Rising', min: 4000, max: 20000, step: 500, duration: 50 }
};

const REGION_OF = {
  'United States': 'North America', Canada: 'North America', 'Puerto Rico': 'Latin America & Caribbean',
  Mexico: 'Latin America & Caribbean', Colombia: 'Latin America & Caribbean', Brazil: 'Latin America & Caribbean',
  Argentina: 'Latin America & Caribbean', Chile: 'Latin America & Caribbean', Uruguay: 'Latin America & Caribbean',
  Barbados: 'Latin America & Caribbean', 'Trinidad and Tobago': 'Latin America & Caribbean',
  Portugal: 'Portugal', 'United Kingdom': 'Europe', Ireland: 'Europe', France: 'Europe', Belgium: 'Europe',
  Netherlands: 'Europe', Germany: 'Europe', Sweden: 'Europe', Norway: 'Europe', Denmark: 'Europe', Iceland: 'Europe',
  Italy: 'Europe', Spain: 'Europe', Russia: 'Europe',
  Nigeria: 'Africa', 'South Africa': 'Africa', Eswatini: 'Africa', Tanzania: 'Africa', Kenya: 'Africa', Benin: 'Africa',
  Mali: 'Africa', Senegal: 'Africa', Niger: 'Africa', 'The Gambia': 'Africa', 'Cape Verde': 'Africa',
  'São Tomé and Príncipe': 'Africa',
  'South Korea': 'Asia', Japan: 'Asia', India: 'Asia', Israel: 'Asia',
  Australia: 'Oceania', 'New Zealand': 'Oceania'
};

// A stable number from a text (the same artist always gets the same estimate).
function textHash(text) {
  let hash = 2166136261;
  for (const ch of text) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash;
}

function artistSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The illustrative fee: a fixed point in the range of the artist's size, rounded to the size's step.
function estimatedFee(name, size) {
  const s = ARTIST_SIZES[size];
  const steps = Math.floor((s.max - s.min) / s.step);
  return s.min + (textHash(name) % (steps + 1)) * s.step;
}

const ARTIST_LIBRARY = ARTIST_ROWS.map(([name, wiki, genre, style, country, size]) => ({
  id: `lib-${artistSlug(name)}`, name, wiki: wiki || name, genre, style, country,
  region: REGION_OF[country] || 'Other', size, sizeLabel: ARTIST_SIZES[size].label,
  fee: estimatedFee(name, size), duration: ARTIST_SIZES[size].duration
}));

const ARTIST_GENRES = [...new Set(ARTIST_LIBRARY.map((a) => a.genre))];
const ARTIST_REGIONS = ['Portugal', 'Europe', 'North America', 'Latin America & Caribbean', 'Africa', 'Asia', 'Oceania'];

// Filter and sort the library.
// filters = { query, genre, region, size, maxFee, sort } — empty values mean "all".
// query matches the name, style or country (case and accents do not matter).
function filterArtistLibrary(list, filters = {}) {
  const plain = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = plain(filters.query || '').split(/\s+/).filter(Boolean);
  const maxFee = Number(filters.maxFee) > 0 ? Number(filters.maxFee) : Infinity;
  const result = list.filter((a) => (!filters.genre || a.genre === filters.genre)
    && (!filters.region || a.region === filters.region)
    && (!filters.size || a.size === filters.size)
    && a.fee <= maxFee
    && words.every((w) => plain(`${a.name} ${a.style} ${a.country}`).includes(w)));
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name, 'en'),
    'fee-low': (a, b) => a.fee - b.fee || a.name.localeCompare(b.name, 'en'),
    'fee-high': (a, b) => b.fee - a.fee || a.name.localeCompare(b.name, 'en')
  };
  return result.sort(sorters[filters.sort] || sorters.name);
}

// The festival's own catalogue entry for a library artist (the lineup planner's format).
// libraryId links back to the library, e.g. for the photo.
const GENRE_COLOURS = {
  Pop: '#f5c8be', Rock: '#ffd0a2', Indie: '#d8c7ed', Electronic: '#b7e4dc', 'Hip-hop': '#f9dc88',
  'R&B & Soul': '#e7c6d8', Latin: '#ffc9a8', Afrobeats: '#d4e8b7', 'World & Fado': '#e7d5ae',
  'Jazz & Blues': '#c7d9f4', 'Folk & Country': '#dfe8c8', 'Metal & Punk': '#d3d6d8'
};
function libraryArtistToCatalogue(entry) {
  return {
    id: entry.id, name: entry.name, genre: entry.style, fee: entry.fee, duration: entry.duration,
    colour: GENRE_COLOURS[entry.genre] || '#d8c7ed', libraryId: entry.id
  };
}

// Photos: only freely licensed Wikimedia Commons images are accepted (never the "fair use" images
// some Wikipedia articles use), and the Commons file page is used as the source / licence link.
function acceptableArtistPhoto(url) {
  // Wikipedia serves the images from upload.wikimedia.org or (newer) thumb.wikimedia.org.
  return typeof url === 'string' && /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(url);
}
function commonsFilePage(url) {
  if (!acceptableArtistPhoto(url)) return null;
  const parts = url.split(/[?#]/)[0].split('/');
  const thumb = parts.indexOf('thumb');
  const file = thumb >= 0 ? parts[thumb + 3] : parts[parts.length - 1];
  return file ? `https://commons.wikimedia.org/wiki/File:${file}` : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    ARTIST_ROWS, ARTIST_SIZES, ARTIST_LIBRARY, ARTIST_GENRES, ARTIST_REGIONS, REGION_OF, GENRE_COLOURS,
    artistSlug, estimatedFee, filterArtistLibrary, libraryArtistToCatalogue, acceptableArtistPhoto, commonsFilePage
  };
}
