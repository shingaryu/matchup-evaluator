require('dotenv').config();
import { program } from 'commander'
import PokemonSet from '../models/PokemonSet';
program
.option('-n, --numOfIteration [numOfIteration]', "Each matchup evaluation is iterated and averaged by the number of trials. [10]", "10")
.option('-d --depth [depth]', "Minimax bot searches to this depth in the matchup evaluation. [2]", "2")
.parse(process.argv);

const fs = require('fs');
const { Dex, PcmBattle, Minimax, initLog4js, Util, TeamValidator, TeamImporter } = require('percymon');
const moment = require('moment');

// Setup Logging
initLog4js(true, true);
const logger = require('log4js').getLogger("app");

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

const customGameFormat = Dex.getFormat(`gen8customgame`, true);
customGameFormat.ruleset = customGameFormat.ruleset.filter((rule: string) => rule !== 'Team Preview');
customGameFormat.forcedLevel = 50;

simulateFromLocalFiles(weights, program.numOfIteration, program.depth, 1);

type GameEndResult = {
  p1Team: PokemonSet[],
  p2Team: PokemonSet[],
  winner: number,
  turns: number,
  p1PokeHp: number[],
  p2PokeHp: number[],
  calculatedAt: string
}

// async function simulateFromDBItems(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
//   const allStrategyId = await sqlService.selectAllPokemonStrategyId();

// }

async function simulateFromLocalFiles(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
  const targetPokemonDir = 'Target Pokemons';
  const teamPokemonDir = 'Team Pokemons';

  // const customGameFormat = Dex.getFormat(`gen8customgame`, true);
  // customGameFormat.ruleset = customGameFormat.ruleset.filter((rule: string) => rule !== 'Team Preview');
  // customGameFormat.forcedLevel = 50;
  const teamValidator = new TeamValidator(customGameFormat);

  const targetPokemons = loadPokemonSetsFromTexts(`./${targetPokemonDir}`);
  const teamPokemons = loadPokemonSetsFromTexts(`./${teamPokemonDir}`);
  validatePokemonSets(teamValidator, targetPokemons);
  validatePokemonSets(teamValidator, teamPokemons);

  logger.info(teamPokemons.length + ' team pokemons are loaded.');
  logger.info(targetPokemons.length + ' target pokemons are loaded.');

  const teamSelections = threeOfAllCombinations(teamPokemons).slice(0, 1);
  const targetSelections = threeOfAllCombinations(targetPokemons).slice(0, 1);

  simulateFromTeamSelections(teamSelections, targetSelections, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton);
}

async function simulateFromTeamSelections(teamSelections: PokemonSet[][], targetSelections: PokemonSet[][], weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
  logger.info("start evaluating game end win/lose...")
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
  // const minimax = new Minimax(false, minimaxRepetiton, false, weights);
  const evalValueTable = [];
  // const results = [];
  for (let i = 0; i < teamSelections.length; i++) {
    const myTeam = teamSelections[i];  
    // const evalRecord = [];
    for (let j = 0; j < targetSelections.length; j++) {
      const oppTeam = targetSelections[j];
      const results = simulateGameMatch(myTeam, oppTeam, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
      let turnsSum = 0.0;
      results.forEach(x => x.turns);

      console.log(`botPlayerWins: ${results.filter(x => x.winner === 0).length}`)
      console.log(`humanPlayerWins: ${results.filter(x => x.winner === 1).length}`)
      console.log(`average turns: ${turnsSum / results.length}`)
    };
  }

	console.log("calculation finished");
}


function simulateGameMatch(myTeam: PokemonSet[], oppTeam: PokemonSet[], weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: string) {
  const minimax = new Minimax(false, minimaxRepetiton, false, weights);
  const results: GameEndResult[] = [];

  logger.info(`Simulate about ${teamPokemonStr(myTeam)} vs ${teamPokemonStr(oppTeam)}`);
  const repeatedOneOnOneValues = []; 
  for (let k = 0; k < oneOnOneRepetition; k++) {
    const p1 = { name: 'botPlayer', avatar: 1, team: myTeam };
    const p2 = { name: 'humanPlayer', avatar: 1, team: oppTeam };								
    const battleOptions = { format: customGameFormat, rated: false, send: null, p1, p2 };
    const battle = new PcmBattle(battleOptions);
    battle.start();              
    battle.makeRequest();                   

    const limitSteps = 20;
    let l = 0;
    for (l = 1; l <= limitSteps; l++) {
      console.log(`\nStep: ${l}, Turn: ${battle.turn}`);

      const { p1Choices } = Util.parseRequest(battle.p1.request);
      const minimaxDecision = minimax.decide(Util.cloneBattle(battle), p1Choices, minimaxDepth);

      if (battle.p1.request.wait) {
        const p2BestChoice = minimaxDecision.tree.action;
        battle.choose('p2', Util.toChoiceString(p2BestChoice, battle.p2), battle.rqid);
        console.log("Player action: (wait)");
        console.log("Opponent action: " + Util.toChoiceString(p2BestChoice, battle.p2));            
      } else if (battle.p2.request.wait) {
        const p1BestChoice = minimaxDecision.tree.action;             
        battle.choose('p1', Util.toChoiceString(p1BestChoice, battle.p1), battle.rqid);
        console.log("Player action: " + Util.toChoiceString(p1BestChoice, battle.p1));
        console.log("Opponent action: (wait)");            
      } else {
        const p1BestChoice = minimaxDecision.tree.action;

        if (minimaxDecision.tree.type !== 'max') {
          throw new Error('Child tree of root is not maximum tree. this is likely caused because this turn p1 has a wait request')                
        }
        const p1BestChoiceTree = minimaxDecision.tree.children.find((x: any) => x.value === minimaxDecision.tree.value);
        if (p1BestChoiceTree.type !== 'min') {
          throw new Error('Child tree of p1 best choice is not minimum tree. this is likely caused because this turn p2 has a wait request')                
        }
        const p2BestChoice = p1BestChoiceTree.action;
        
        battle.choose('p1', Util.toChoiceString(p1BestChoice, battle.p1), battle.rqid);
        battle.choose('p2', Util.toChoiceString(p2BestChoice, battle.p2), battle.rqid);
        console.log("Player action: " + Util.toChoiceString(p1BestChoice, battle.p1));
        console.log("Opponent action: " + Util.toChoiceString(p2BestChoice, battle.p2));            
      }

      showBothSideHp(battle);
      if (battle.ended) {
        console.log(`battle ended!`);
        console.log(`winner: ${battle.winner}`)
        console.log()
        repeatedOneOnOneValues.push({ myTeam: p1.team, steps: l, winner: battle.winner});
        break;  
      } else if (l === limitSteps) {
        throw new Error(`battle did not finished within ${limitSteps} steps`);
      } else {
        continue;
      }
    }

    const result: GameEndResult = {
      p1Team: myTeam,
      p2Team: oppTeam,
      winner: battle.winner === 'botPlayer' ? 0: 1,
      turns: battle.turn,
      p1PokeHp: battle.p1.pokemon.map((x: any) => x.hp),
      p2PokeHp: battle.p2.pokemon.map((x: any) => x.hp),
      calculatedAt: calculatedAt
    }

    // await sqlService.insertGameEndResult(result.p1Team, result.p2Team, result.winner, result.turns, 
    //   result.p1PokeHp, result.p2PokeHp, result.calculatedAt);
    results.push(result);
  }
  
  return results;
}


function teamPokemonStr(team: PokemonSet[]) {
  return `[${team.map(x => x.species).join(', ')}]`;
}

function showBothSideHp(battle: any)  {
  // console.log("Current status of both sides:");
  let logP1 = '';
  for(let k = 0; k < battle.p1.pokemon.length; k++) {
      logP1 += (battle.p1.pokemon[k].species.name + ": " + battle.p1.pokemon[k].hp + "/" + battle.p1.pokemon[k].maxhp) + ', ';
  }
  console.log(`p1: ${logP1}`)
  let logP2 = '';
  for(let k = 0; k < battle.p2.pokemon.length; k++) {
      logP2 += (battle.p2.pokemon[k].species.name + ": " + battle.p2.pokemon[k].hp + "/" + battle.p2.pokemon[k].maxhp) + ', ';
  }
  console.log(`p2: ${logP2}`)
}

function threeOfAllCombinations(pokemons: any[]) {
  const combinations = [];
  for (let i = 0; i < pokemons.length; i++) {
    for (let j = i + 1; j < pokemons.length; j++) {
      for (let k = j + 1; k < pokemons.length; k++) {
        combinations.push([pokemons[i], pokemons[j], pokemons[k]]);
      }
    }
  }

  return combinations;
}

// Read target pokemon sets from team text. If an error occurs, just skip the file and continue.
function loadPokemonSetsFromTexts(directoryPath: string) {
  const filenames = fs.readdirSync(directoryPath);
  const pokemons: PokemonSet[] = [];

  filenames.forEach((filename: string) => {
    try {
      const rawText = fs.readFileSync(`${directoryPath}/${filename}`, "utf8");
      const pokemonSets = TeamImporter.importTeam(rawText); 
      if (!pokemonSets) {
        logger.warn(`'${filename}' doesn't contain a valid pokemon expression. We will just ignore this file.`);
      } else if (pokemonSets.length > 1) {
        logger.warn(`'${filename}' seems to have more than one pokemon expression. Subsequent ones are ignored.`);
      }
      pokemons.push(pokemonSets[0]);
    } catch (error) {
      logger.warn(`Failed to import '${filename}'. Is this a text of a target pokemon?`);
      logger.warn(error);
    }
  });

  return pokemons;
}

// Validate pokemon sets. If the validation failed about one of target pokemons, throw an exception.
function validatePokemonSets(teamValidator: any, pokemonSets: PokemonSet[]) {
  pokemonSets.forEach(pokemonSet => {
    const setValidationProblems = teamValidator.validateSet(pokemonSet);
    if (setValidationProblems) {
      logger.error(`${setValidationProblems.length} problem(s) is found about ${pokemonSet.species} during the validation.`);
      setValidationProblems.forEach((problem: any) => {
        logger.error(problem);
      })
      throw new Error('Pokemon Set Validation Error');
    }  
  })
}

