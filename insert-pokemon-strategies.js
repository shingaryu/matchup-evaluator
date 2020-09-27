require('dotenv').config();

global.program = require('commander');
global.program
.option('--directory [file]', "directory path from which showdown format pokemon files are loaded. ['./matchup-candidates']", './matchup-candidates')
.parse(process.argv);

const fs = require('fs');
const { TeamImporter, Dex } = require('percymon');
global.Dex = Dex;
global.toId = Dex.getId;
const SqlService = require('./sql-service').SqlService;
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;

const sqlService = new SqlService();

const matchupCandidates = loadPokemonSetsFromTexts(global.program.directory);
const customGameFormat = Dex.getFormat(`gen8customgame`, true);
customGameFormat.ruleset = customGameFormat.ruleset.filter(rule => rule !== 'Team Preview');
customGameFormat.forcedLevel = 50;
validatePokemonSets(customGameFormat, matchupCandidates)

const insertPromises = [];
matchupCandidates.forEach(poke => {
  console.log(`Insert ${poke.species} to DB...`);

  insertPromises.push(sqlService.insertPokemonStrategy(poke));
})

Promise.all(insertPromises).then(
  value => {
    sqlService.endConnection();
  },
  error => {
    console.log(error);
    sqlService.endConnection();
  }
);

// Read target pokemon sets from team text. If an error occurs, just skip the file and continue.
function loadPokemonSetsFromTexts(directoryPath) {
  const filenames = fs.readdirSync(directoryPath);
  const pokemons = [];

  filenames.forEach(filename => {
    try {
      const rawText = fs.readFileSync(`${directoryPath}/${filename}`, "utf8");
      const pokemonSets = TeamImporter.importTeam(rawText); 
      if (!pokemonSets) {
        console.log(`'${filename}' doesn't contain a valid pokemon expression. We will just ignore this file.`);
      } else if (pokemonSets.length > 1) {
        console.log(`'${filename}' seems to have more than one pokemon expression. Subsequent ones are ignored.`);
      }
      pokemons.push(pokemonSets[0]);
    } catch (error) {
      console.log(`Failed to import '${filename}'. Is this a text of a target pokemon?`);
      console.log(error);
    }
  });

  return pokemons;
}